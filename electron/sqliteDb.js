const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

//--------------------------------------------------------
// Helper
//--------------------------------------------------------

function createRelationalSchema(db) {
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      min_stock_threshold REAL NOT NULL DEFAULT 25,
      days_to_ready INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      krapin TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      contact_person TEXT DEFAULT '',
      address TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      batch_name TEXT NOT NULL,
      batch_number TEXT,
      quantity_planted REAL NOT NULL DEFAULT 0,
      quantity_remaining REAL NOT NULL DEFAULT 0,
      quantity_lost REAL NOT NULL DEFAULT 0,
      date_planted TEXT NOT NULL,
      expected_ready_date TEXT NOT NULL,
      ready_override INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,

      FOREIGN KEY (product_id)
        REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      sale_date TEXT NOT NULL,

      is_credit INTEGER NOT NULL DEFAULT 0,
      is_presale INTEGER NOT NULL DEFAULT 0,
      presale_status TEXT,

      total REAL NOT NULL DEFAULT 0,
      down_payment REAL NOT NULL DEFAULT 0,

      completed_at TEXT,
      completed_by TEXT,
      created_by TEXT,

      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,

      FOREIGN KEY (customer_id)
        REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,

      quantity REAL NOT NULL,
      selling_price REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,

      FOREIGN KEY (sale_id)
        REFERENCES sales(id)
        ON DELETE CASCADE,

      FOREIGN KEY (product_id)
        REFERENCES products(id),

      FOREIGN KEY (batch_id)
        REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,

      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,

      method TEXT NOT NULL DEFAULT 'cash',
      reference TEXT,
      recorded_by TEXT,
      note TEXT,

      created_at TEXT NOT NULL,

      FOREIGN KEY (sale_id)
        REFERENCES sales(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      supplier_id TEXT,
      purchase_date TEXT NOT NULL,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,

      FOREIGN KEY (supplier_id)
        REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity TEXT,
      unit TEXT DEFAULT '',
      unit_cost REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,

      FOREIGN KEY (purchase_id)
        REFERENCES purchases(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      expense_date TEXT NOT NULL,
      category TEXT DEFAULT '',
      description TEXT DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS spoilage (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      reason TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      recorded_by TEXT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,

      FOREIGN KEY (batch_id)
        REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT,
      email TEXT,
      password_hash TEXT,
      role TEXT DEFAULT 'staff',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mpesa_payments (
      checkout_request_id TEXT PRIMARY KEY,
      merchant_request_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      amount REAL NOT NULL DEFAULT 0,
      phone_number TEXT,
      transaction_id TEXT,
      transaction_date TEXT,
      result_code INTEGER,
      result_desc TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_products_active
      ON products(active);

    CREATE INDEX IF NOT EXISTS idx_products_name
      ON products(name);

    CREATE INDEX IF NOT EXISTS idx_customers_name
      ON customers(name);

    CREATE INDEX IF NOT EXISTS idx_batches_product
      ON batches(product_id);

    CREATE INDEX IF NOT EXISTS idx_batches_ready
      ON batches(expected_ready_date);

    CREATE INDEX IF NOT EXISTS idx_sales_date
      ON sales(sale_date);

    CREATE INDEX IF NOT EXISTS idx_sales_customer
      ON sales(customer_id);

    CREATE INDEX IF NOT EXISTS idx_sales_presale
      ON sales(is_presale, presale_status);

    CREATE INDEX IF NOT EXISTS idx_sale_items_sale
      ON sale_items(sale_id);

    CREATE INDEX IF NOT EXISTS idx_sale_items_batch
      ON sale_items(batch_id);

    CREATE INDEX IF NOT EXISTS idx_payments_sale
      ON payments(sale_id);

    CREATE INDEX IF NOT EXISTS idx_payments_date
      ON payments(payment_date);

    CREATE INDEX IF NOT EXISTS idx_purchases_date
      ON purchases(purchase_date);

    CREATE INDEX IF NOT EXISTS idx_expenses_date
      ON expenses(expense_date);
  `);
}

function createSqliteDbService(appPath) {
  const filePath = path.join(appPath, "bosco.sqlite");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const sqlite = new Database(filePath);

  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");

  // ==================================================
  // RELATIONAL SCHEMA
  // ==================================================

  createRelationalSchema(sqlite);

  // ==================================================
  // LEGACY DOCUMENT STORE
  // ==================================================
  //
  // Keep this temporarily while the existing React/PouchDB-style
  // code is being migrated to the relational API.

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      id TEXT PRIMARY KEY,
      type TEXT,
      body TEXT NOT NULL,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE INDEX IF NOT EXISTS docs_type_idx
      ON docs(type);

    CREATE INDEX IF NOT EXISTS docs_updated_idx
      ON docs(updatedAt);
  `);

  const now = () => new Date().toISOString();

  const newId = (prefix) =>
    `${prefix}:${Date.now()}:${Math.floor(Math.random() * 100000)}`;

  // ==================================================
  // LEGACY DOC API
  // ==================================================

  const normalizeDoc = (doc) => {
    const normalized = { ...doc };

    normalized._id =
      normalized._id ||
      `doc:${Date.now()}:${Math.floor(Math.random() * 100000)}`;

    normalized.createdAt =
      normalized.createdAt || now();

    normalized.updatedAt = now();

    return normalized;
  };

  const parseBody = (body) => {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  };

  const migrateLegacyDatabase = async (legacyDbPath) => {
    if (!fs.existsSync(legacyDbPath)) {
      throw new Error(
        `Legacy database not found: ${legacyDbPath}`
      );
    }

    const newFilePath = path.join(
      appPath,
      "bosco.sqlite.new"
    );

    const oldFilePath = path.join(
      appPath,
      "bosco.sqlite.old"
    );

    let legacyDb = null;
    let newDb = null;

    try {
      console.log(
        "Starting legacy database migration:",
        legacyDbPath
      );

      // --------------------------------------------------
      // OPEN OLD DATABASE READ-ONLY
      // --------------------------------------------------

      legacyDb = new Database(
        legacyDbPath,
        {
          readonly: true
        }
      );

      // --------------------------------------------------
      // VERIFY OLD DATABASE
      // --------------------------------------------------

      const docsTable = legacyDb
        .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = 'docs'
      `)
        .get();

      if (!docsTable) {
        throw new Error(
          "Selected database is not a legacy Bosco POS database."
        );
      }

      // --------------------------------------------------
      // REMOVE ANY PREVIOUS FAILED .NEW DATABASE
      // --------------------------------------------------

      if (fs.existsSync(newFilePath)) {
        fs.unlinkSync(newFilePath);
      }

      // --------------------------------------------------
      // CREATE NEW DATABASE
      // --------------------------------------------------

      newDb = new Database(
        newFilePath
      );

      createRelationalSchema(newDb);

      // --------------------------------------------------
      // READ OLD DOCUMENTS
      // --------------------------------------------------

      const rows = legacyDb
        .prepare(`
        SELECT
          id,
          type,
          body,
          createdAt,
          updatedAt
        FROM docs
        ORDER BY id
      `)
        .all();

      console.log(
        `Found ${rows.length} legacy documents.`
      );

      const report = {
        total: rows.length,
        products: 0,
        batches: 0,
        customers: 0,
        suppliers: 0,
        sales: 0,
        saleItems: 0,
        payments: 0,
        purchases: 0,
        purchaseItems: 0,
        expenses: 0,
        spoilage: 0,
        users: 0,
        mpesaPayments: 0,
        skipped: 0,
        errors: []
      };

      const docs = [];

      // --------------------------------------------------
      // PARSE ALL DOCUMENTS FIRST
      // --------------------------------------------------

      for (const row of rows) {
        let doc;

        try {
          doc = JSON.parse(row.body);
        } catch (error) {
          report.skipped++;

          report.errors.push(
            `Invalid JSON: ${row.id}`
          );

          continue;
        }

        docs.push({
          ...row,
          doc
        });
      }

      // --------------------------------------------------
      // HELPER FUNCTIONS
      // --------------------------------------------------

      const value = (
        doc,
        ...keys
      ) => {
        for (const key of keys) {
          if (
            doc[key] !== undefined &&
            doc[key] !== null
          ) {
            return doc[key];
          }
        }

        return null;
      };

      const idOf = (
        doc,
        row
      ) =>
        value(
          doc,
          "_id",
          "id"
        ) || row.id;

      const timestamp = (
        doc,
        row
      ) =>
        value(
          doc,
          "createdAt",
          "created_at"
        ) ||
        row.createdAt ||
        new Date().toISOString();

      // --------------------------------------------------
      // MIGRATION
      // --------------------------------------------------

      const transaction =
        newDb.transaction(() => {

          for (const row of docs) {
            const doc = row.doc;
            const type = row.type;

            try {

              // ==================================================
              // PRODUCTS
              // ==================================================

              if (type === "product") {

                newDb
                  .prepare(`
                  INSERT INTO products (
                    id,
                    name,
                    price,
                    min_stock_threshold,
                    days_to_ready,
                    active,
                    created_at,
                    updated_at
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id)
                  DO UPDATE SET
                    name = excluded.name,
                    price = excluded.price,
                    min_stock_threshold =
                      excluded.min_stock_threshold,
                    days_to_ready =
                      excluded.days_to_ready,
                    active = excluded.active,
                    updated_at =
                      excluded.updated_at
                `)
                  .run(
                    idOf(doc, row),
                    value(doc, "name") || "",
                    Number(
                      value(doc, "price") || 0
                    ),
                    Number(
                      value(
                        doc,
                        "minStockThreshold",
                        "min_stock_threshold"
                      ) ?? 25
                    ),
                    Number(
                      value(
                        doc,
                        "daysToReady",
                        "days_to_ready"
                      ) || 0
                    ),
                    value(doc, "active") === false
                      ? 0
                      : 1,
                    timestamp(doc, row),
                    value(
                      doc,
                      "updatedAt",
                      "updated_at"
                    ) ||
                    row.updatedAt ||
                    timestamp(doc, row)
                  );

                report.products++;
                continue;
              }

              // ==================================================
              // CUSTOMERS
              // ==================================================

              if (type === "customer") {

                newDb
                  .prepare(`
                  INSERT INTO customers (
                    id,
                    name,
                    krapin,
                    phone,
                    email,
                    notes,
                    created_at,
                    updated_at
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id)
                  DO UPDATE SET
                    name = excluded.name,
                    krapin = excluded.krapin,
                    phone = excluded.phone,
                    email = excluded.email,
                    notes = excluded.notes,
                    updated_at =
                      excluded.updated_at
                `)
                  .run(
                    idOf(doc, row),
                    value(doc, "name") || "",
                    value(doc, "krapin") || "",
                    value(doc, "phone") || "",
                    value(doc, "email") || "",
                    value(doc, "notes") || "",
                    timestamp(doc, row),
                    value(
                      doc,
                      "updatedAt",
                      "updated_at"
                    ) ||
                    row.updatedAt ||
                    timestamp(doc, row)
                  );

                report.customers++;
                continue;
              }

              // ==================================================
              // SUPPLIERS
              // ==================================================

              if (type === "supplier") {

                newDb
                  .prepare(`
                  INSERT INTO suppliers (
                    id,
                    name,
                    phone,
                    email,
                    contact_person,
                    address,
                    created_at,
                    updated_at
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id)
                  DO UPDATE SET
                    name = excluded.name,
                    phone = excluded.phone,
                    email = excluded.email,
                    contact_person =
                      excluded.contact_person,
                    address = excluded.address,
                    updated_at =
                      excluded.updated_at
                `)
                  .run(
                    idOf(doc, row),
                    value(doc, "name") || "",
                    value(doc, "phone") || "",
                    value(doc, "email") || "",
                    value(
                      doc,
                      "contactPerson",
                      "contact_person"
                    ) || "",
                    value(doc, "address") || "",
                    timestamp(doc, row),
                    value(
                      doc,
                      "updatedAt",
                      "updated_at"
                    ) ||
                    row.updatedAt ||
                    timestamp(doc, row)
                  );

                report.suppliers++;
                continue;
              }

              // ==================================================
              // BATCHES
              // ==================================================

              if (type === "batch") {

                const productId =
                  value(
                    doc,
                    "productId",
                    "product_id",
                    "cropId"
                  );

                if (!productId) {
                  throw new Error(
                    `Batch ${idOf(doc, row)} has no product/crop ID`
                  );
                }

                newDb
                  .prepare(`
                  INSERT INTO batches (
                    id,
                    product_id,
                    batch_name,
                    batch_number,
                    quantity_planted,
                    quantity_remaining,
                    quantity_lost,
                    date_planted,
                    expected_ready_date,
                    ready_override,
                    created_at,
                    updated_at
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id)
                  DO UPDATE SET
                    product_id =
                      excluded.product_id,
                    batch_name =
                      excluded.batch_name,
                    batch_number =
                      excluded.batch_number,
                    quantity_planted =
                      excluded.quantity_planted,
                    quantity_remaining =
                      excluded.quantity_remaining,
                    quantity_lost =
                      excluded.quantity_lost,
                    date_planted =
                      excluded.date_planted,
                    expected_ready_date =
                      excluded.expected_ready_date,
                    ready_override =
                      excluded.ready_override,
                    updated_at =
                      excluded.updated_at
                `)
                  .run(
                    idOf(doc, row),
                    productId,
                    value(
                      doc,
                      "batchName",
                      "batch_name"
                    ) || "",
                    value(
                      doc,
                      "batchNumber",
                      "batch_number"
                    ),
                    Number(
                      value(
                        doc,
                        "quantityPlanted",
                        "quantity_planted"
                      ) || 0
                    ),
                    Number(
                      value(
                        doc,
                        "quantityRemaining",
                        "quantity_remaining"
                      ) || 0
                    ),
                    Number(
                      value(
                        doc,
                        "quantityLost",
                        "quantity_lost"
                      ) || 0
                    ),
                    value(
                      doc,
                      "datePlanted",
                      "date_planted"
                    ) || timestamp(doc, row),
                    value(
                      doc,
                      "expectedReadyDate",
                      "expected_ready_date"
                    ) || timestamp(doc, row),
                    value(
                      doc,
                      "readyOverride",
                      "ready_override"
                    )
                      ? 1
                      : 0,
                    timestamp(doc, row),
                    value(
                      doc,
                      "updatedAt",
                      "updated_at"
                    ) ||
                    row.updatedAt ||
                    timestamp(doc, row)
                  );

                report.batches++;
                continue;
              }

              // ==================================================
              // EXPENSES
              // ==================================================

              if (type === "expense") {

                newDb
                  .prepare(`
                  INSERT INTO expenses (
                    id,
                    expense_date,
                    category,
                    description,
                    amount,
                    created_by,
                    created_at,
                    updated_at
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id)
                  DO UPDATE SET
                    expense_date =
                      excluded.expense_date,
                    category =
                      excluded.category,
                    description =
                      excluded.description,
                    amount =
                      excluded.amount,
                    created_by =
                      excluded.created_by,
                    updated_at =
                      excluded.updated_at
                `)
                  .run(
                    idOf(doc, row),
                    value(
                      doc,
                      "date",
                      "expenseDate",
                      "expense_date"
                    ) || timestamp(doc, row),
                    value(doc, "category") || "",
                    value(
                      doc,
                      "description",
                      "notes"
                    ) || "",
                    Number(
                      value(doc, "amount") || 0
                    ),
                    value(
                      doc,
                      "createdBy",
                      "recordedBy",
                      "created_by"
                    ),
                    timestamp(doc, row),
                    value(
                      doc,
                      "updatedAt",
                      "updated_at"
                    ) ||
                    row.updatedAt ||
                    timestamp(doc, row)
                  );

                report.expenses++;
                continue;
              }

              // ==================================================
              // USERS
              // ==================================================

              if (type === "user") {

                newDb
                  .prepare(`
                  INSERT INTO users (
                    id,
                    name,
                    username,
                    email,
                    password_hash,
                    role,
                    active,
                    created_at,
                    updated_at
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id)
                  DO UPDATE SET
                    name = excluded.name,
                    username = excluded.username,
                    email = excluded.email,
                    password_hash =
                      excluded.password_hash,
                    role = excluded.role,
                    active = excluded.active,
                    updated_at =
                      excluded.updated_at
                `)
                  .run(
                    idOf(doc, row),
                    value(doc, "name") || "",
                    value(doc, "username"),
                    value(doc, "email"),
                    value(
                      doc,
                      "passwordHash",
                      "password_hash"
                    ),
                    value(doc, "role") || "staff",
                    value(doc, "active") === false
                      ? 0
                      : 1,
                    timestamp(doc, row),
                    value(
                      doc,
                      "updatedAt",
                      "updated_at"
                    ) ||
                    row.updatedAt ||
                    timestamp(doc, row)
                  );

                report.users++;
                continue;
              }

              // ==================================================
              // M-PESA
              // ==================================================

              if (type === "mpesa_payment") {

                const checkoutRequestId =
                  value(
                    doc,
                    "checkoutRequestId",
                    "checkout_request_id"
                  );

                if (!checkoutRequestId) {
                  throw new Error(
                    `M-Pesa payment ${idOf(doc, row)} has no checkoutRequestId`
                  );
                }

                newDb
                  .prepare(`
                  INSERT INTO mpesa_payments (
                    checkout_request_id,
                    merchant_request_id,
                    status,
                    amount,
                    phone_number,
                    transaction_id,
                    transaction_date,
                    result_code,
                    result_desc,
                    created_at,
                    updated_at
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(checkout_request_id)
                  DO UPDATE SET
                    merchant_request_id =
                      excluded.merchant_request_id,
                    status = excluded.status,
                    amount = excluded.amount,
                    phone_number =
                      excluded.phone_number,
                    transaction_id =
                      excluded.transaction_id,
                    transaction_date =
                      excluded.transaction_date,
                    result_code =
                      excluded.result_code,
                    result_desc =
                      excluded.result_desc,
                    updated_at =
                      excluded.updated_at
                `)
                  .run(
                    checkoutRequestId,
                    value(
                      doc,
                      "merchantRequestId",
                      "merchant_request_id"
                    ),
                    value(doc, "status") || "pending",
                    Number(
                      value(doc, "amount") || 0
                    ),
                    value(
                      doc,
                      "phoneNumber",
                      "phone_number"
                    ),
                    value(
                      doc,
                      "transactionId",
                      "transaction_id"
                    ),
                    value(
                      doc,
                      "transactionDate",
                      "transaction_date"
                    ),
                    value(
                      doc,
                      "resultCode",
                      "result_code"
                    ),
                    value(
                      doc,
                      "resultDesc",
                      "result_desc"
                    ),
                    timestamp(doc, row),
                    value(
                      doc,
                      "updatedAt",
                      "updated_at"
                    ) ||
                    row.updatedAt ||
                    timestamp(doc, row)
                  );

                report.mpesaPayments++;
                continue;
              }

              // ==================================================
              // SALES
              // ==================================================

              if (type === "sale") {

                const saleId =
                  idOf(doc, row);

                let customerId =
                  value(
                    doc,
                    "customerId",
                    "customer_id"
                  );

                // Existing legacy sales sometimes only have
                // customerName. We handle that below.

                if (
                  !customerId &&
                  value(doc, "customerName")
                ) {
                  customerId =
                    `legacy-customer:${String(
                      value(doc, "customerName")
                    ).trim().toLowerCase()}`;

                  newDb
                    .prepare(`
                    INSERT INTO customers (
                      id,
                      name,
                      krapin,
                      phone,
                      email,
                      notes,
                      created_at,
                      updated_at
                    )
                    VALUES (?, ?, '', '', '', '', ?, ?)
                    ON CONFLICT(id)
                    DO NOTHING
                  `)
                    .run(
                      customerId,
                      String(
                        value(doc, "customerName")
                      ).trim(),
                      timestamp(doc, row),
                      timestamp(doc, row)
                    );
                }

                const saleDate =
                  value(
                    doc,
                    "saleDate",
                    "sale_date",
                    "timestamp",
                    "createdAt"
                  ) ||
                  timestamp(doc, row);

                const total =
                  Number(
                    value(doc, "total") || 0
                  );

                const downPayment =
                  Number(
                    value(
                      doc,
                      "dwnPayment",
                      "downPayment",
                      "down_payment"
                    ) || 0
                  );

                newDb
                  .prepare(`
                  INSERT INTO sales (
                    id,
                    customer_id,
                    sale_date,
                    is_credit,
                    is_presale,
                    presale_status,
                    total,
                    down_payment,
                    completed_at,
                    completed_by,
                    created_by,
                    created_at,
                    updated_at
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id)
                  DO UPDATE SET
                    customer_id =
                      excluded.customer_id,
                    sale_date =
                      excluded.sale_date,
                    is_credit =
                      excluded.is_credit,
                    is_presale =
                      excluded.is_presale,
                    presale_status =
                      excluded.presale_status,
                    total =
                      excluded.total,
                    down_payment =
                      excluded.down_payment,
                    completed_at =
                      excluded.completed_at,
                    completed_by =
                      excluded.completed_by,
                    created_by =
                      excluded.created_by,
                    updated_at =
                      excluded.updated_at
                `)
                  .run(
                    saleId,
                    customerId || null,
                    saleDate,
                    value(
                      doc,
                      "isCreditSale",
                      "is_credit"
                    )
                      ? 1
                      : 0,
                    value(
                      doc,
                      "isPresale",
                      "is_presale"
                    )
                      ? 1
                      : 0,
                    value(
                      doc,
                      "presaleStatus",
                      "presale_status"
                    ),
                    total,
                    downPayment,
                    value(
                      doc,
                      "completedAt",
                      "completed_at"
                    ),
                    value(
                      doc,
                      "completedBy",
                      "completed_by"
                    ),
                    value(
                      doc,
                      "createdBy",
                      "created_by"
                    ),
                    timestamp(doc, row),
                    value(
                      doc,
                      "updatedAt",
                      "updated_at"
                    ) ||
                    row.updatedAt ||
                    timestamp(doc, row)
                  );

                report.sales++;

                // ------------------------------------------------
                // SALE ITEMS
                // ------------------------------------------------

                const items =
                  Array.isArray(doc.items)
                    ? doc.items
                    : (
                      Array.isArray(doc.cart)
                        ? doc.cart
                        : []
                    );

                // Some older single-item sales did not have
                // an items array. Build one from the sale itself.

                const normalizedItems =
                  items.length
                    ? items
                    : [{
                      id:
                        `${saleId}:item`,
                      productId:
                        value(
                          doc,
                          "productId",
                          "cropId"
                        ),
                      product:
                        doc.product ||
                        null,
                      batchId:
                        value(
                          doc,
                          "batchId"
                        ),
                      quantity:
                        value(
                          doc,
                          "quantity",
                          "qty"
                        ),
                      discount:
                        value(
                          doc,
                          "discount",
                        ),
                      presale:
                        value(
                          doc,
                          "is_presale",
                          "presale"
                        ),
                      sellingPrice:
                        value(
                          doc,
                          "sellingPrice",
                          "price"
                        )
                    }];

                for (
                  let index = 0;
                  index <
                  normalizedItems.length;
                  index++
                ) {
                  const item =
                    normalizedItems[index];

                  const productId =
                    value(
                      item,
                      "productId",
                      "product_id",
                      "cropId"
                    ) ||
                    value(
                      item.product || {},
                      "_id",
                      "id"
                    );

                  const batchId =
                    value(
                      item,
                      "batchId",
                      "batch_id"
                    ) ||
                    value(
                      item.batch || {},
                      "_id",
                      "id"
                    ) ||
                    value(
                      doc,
                      "batchId"
                    );

                  if (
                    !productId ||
                    !batchId
                  ) {
                    throw new Error(
                      `Sale ${saleId} item ${index} is missing productId or batchId`
                    );
                  }

                  const quantity =
                    Number(
                      value(
                        item,
                        "quantity",
                        "qty"
                      ) || 0
                    );

                  const sellingPrice =
                    Number(
                      value(
                        item,
                        "sellingPrice",
                        "selling_price",
                        "price"
                      ) || 0
                    );

                  const itemTotal =
                    Number(
                      value(
                        item,
                        "total"
                      ) ??
                      (
                        quantity *
                        sellingPrice
                      )
                    );

                  newDb
                    .prepare(`
                    INSERT INTO sale_items (
                      id,
                      sale_id,
                      product_id,
                      batch_id,
                      quantity,
                      selling_price,
                      total
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id)
                    DO UPDATE SET
                      quantity =
                        excluded.quantity,
                      selling_price =
                        excluded.selling_price,
                      total =
                        excluded.total
                  `)
                    .run(
                      value(
                        item,
                        "id",
                        "_id"
                      ) ||
                      `${saleId}:item:${index}`,
                      saleId,
                      productId,
                      batchId,
                      quantity,
                      sellingPrice,
                      itemTotal
                    );

                  report.saleItems++;
                }

                // ------------------------------------------------
                // PAYMENT HISTORY
                // ------------------------------------------------

                const history =
                  Array.isArray(
                    doc.paymentHistory
                  )
                    ? doc.paymentHistory
                    : [];

                // Older sales used dwnPayment without
                // paymentHistory.

                if (
                  downPayment > 0 &&
                  history.length === 0
                ) {
                  newDb
                    .prepare(`
                    INSERT INTO payments (
                      id,
                      sale_id,
                      amount,
                      payment_date,
                      method,
                      reference,
                      recorded_by,
                      note,
                      created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `)
                    .run(
                      `${saleId}:initial-payment`,
                      saleId,
                      downPayment,
                      saleDate,
                      value(
                        doc,
                        "paymentMethod"
                      ) || "cash",
                      value(
                        doc,
                        "paymentReference"
                      ),
                      value(
                        doc,
                        "recordedBy",
                        "createdBy"
                      ),
                      "Initial payment",
                      saleDate
                    );

                  report.payments++;
                }

                for (
                  let index = 0;
                  index < history.length;
                  index++
                ) {
                  const payment =
                    history[index];

                  const amount =
                    Number(
                      value(
                        payment,
                        "amount"
                      ) || 0
                    );

                  if (amount <= 0) {
                    continue;
                  }

                  newDb
                    .prepare(`
                    INSERT INTO payments (
                      id,
                      sale_id,
                      amount,
                      payment_date,
                      method,
                      reference,
                      recorded_by,
                      note,
                      created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id)
                    DO NOTHING
                  `)
                    .run(
                      value(
                        payment,
                        "id",
                        "_id"
                      ) ||
                      `${saleId}:payment:${index}`,
                      saleId,
                      amount,
                      value(
                        payment,
                        "date",
                        "paymentDate",
                        "payment_date"
                      ) ||
                      saleDate,
                      value(
                        payment,
                        "method"
                      ) || "cash",
                      value(
                        payment,
                        "reference"
                      ),
                      value(
                        payment,
                        "recordedBy",
                        "recorded_by"
                      ),
                      value(
                        payment,
                        "note"
                      ) || "",
                      value(
                        payment,
                        "createdAt",
                        "created_at"
                      ) ||
                      saleDate
                    );

                  report.payments++;
                }

                continue;
              }

              // ==================================================
              // UNKNOWN DOCUMENT
              // ==================================================

              report.skipped++;

            } catch (error) {

              report.errors.push(
                `${row.id}: ${error.message}`
              );

              throw error;
            }
          }
        });

      transaction();

      // --------------------------------------------------
      // VALIDATION
      // --------------------------------------------------

      const count = (table) =>
        newDb
          .prepare(
            `SELECT COUNT(*) AS count FROM ${table}`
          )
          .get()
          .count;

      const validation = {
        products: count("products"),
        batches: count("batches"),
        customers: count("customers"),
        suppliers: count("suppliers"),
        sales: count("sales"),
        saleItems: count("sale_items"),
        payments: count("payments"),
        expenses: count("expenses"),
        users: count("users"),
        mpesaPayments:
          count("mpesa_payments")
      };

      console.log(
        "Migration validation:",
        validation
      );

      if (report.errors.length) {
        throw new Error(
          "Migration produced errors:\n" +
          report.errors.join("\n")
        );
      }

      // --------------------------------------------------
      // FOREIGN KEY VALIDATION
      // --------------------------------------------------

      const foreignKeys =
        newDb
          .prepare(`
          PRAGMA foreign_key_check
        `)
          .all();

      if (foreignKeys.length > 0) {
        throw new Error(
          "Foreign-key validation failed:\n" +
          JSON.stringify(
            foreignKeys,
            null,
            2
          )
        );
      }

      // --------------------------------------------------
      // CLOSE NEW DATABASE
      // --------------------------------------------------

      newDb.close();
      newDb = null;

      // Close legacy DB.

      legacyDb.close();
      legacyDb = null;

      // --------------------------------------------------
      // CHECKPOINT/CLOSE CURRENT DATABASE
      // --------------------------------------------------

      try {
        sqlite.pragma(
          "wal_checkpoint(TRUNCATE)"
        );
      } catch { }

      sqlite.close();

      // --------------------------------------------------
      // PRESERVE ORIGINAL
      // --------------------------------------------------

      if (
        fs.existsSync(oldFilePath)
      ) {
        fs.unlinkSync(oldFilePath);
      }

      fs.renameSync(
        filePath,
        oldFilePath
      );

      // --------------------------------------------------
      // ACTIVATE NEW DATABASE
      // --------------------------------------------------

      fs.renameSync(
        newFilePath,
        filePath
      );

      console.log(
        "Legacy database migration completed."
      );

      return {
        success: true,
        report,
        validation,

        oldDatabase:
          oldFilePath,

        newDatabase:
          filePath,

        requiresRestart: true
      };

    } catch (error) {

      console.error(
        "Legacy database migration failed:",
        error
      );

      if (newDb) {
        try {
          newDb.close();
        } catch { }
      }

      if (legacyDb) {
        try {
          legacyDb.close();
        } catch { }
      }

      // NEVER delete the original database here.

      if (
        fs.existsSync(newFilePath)
      ) {
        try {
          fs.unlinkSync(
            newFilePath
          );
        } catch { }
      }

      throw error;
    }
  };

  const allDocs = (options = {}) => {
    const includeDocs = Boolean(options.include_docs);

    const startKey =
      typeof options.startkey === "string"
        ? options.startkey
        : null;

    const endKey =
      typeof options.endkey === "string"
        ? options.endkey
        : null;

    const limit =
      Number.isInteger(options.limit)
        ? options.limit
        : null;

    let query = `
      SELECT
        id,
        type,
        body,
        createdAt,
        updatedAt
      FROM docs
    `;

    const clauses = [];
    const params = [];

    if (startKey && endKey) {
      clauses.push("id >= ? AND id <= ?");
      params.push(startKey, endKey);
    } else if (startKey) {
      clauses.push("id >= ?");
      params.push(startKey);
    } else if (endKey) {
      clauses.push("id <= ?");
      params.push(endKey);
    }

    if (clauses.length) {
      query += ` WHERE ${clauses.join(" AND ")}`;
    }

    query += " ORDER BY id ASC";

    if (limit !== null) {
      query += " LIMIT ?";
      params.push(limit);
    }

    const rows = sqlite
      .prepare(query)
      .all(...params);

    return {
      rows: rows.map((row) => {
        const doc = parseBody(row.body);

        return includeDocs
          ? {
            id: row.id,
            key: row.id,
            doc,
            value: {
              rev: doc?._rev || "1-restore",
            },
          }
          : {
            id: row.id,
            key: row.id,
            value: {
              rev: doc?._rev || "1-restore",
            },
          };
      }),
    };
  };

  const get = (id) => {
    const row = sqlite
      .prepare(`
        SELECT body
        FROM docs
        WHERE id = ?
      `)
      .get(id);

    if (!row) {
      const error = new Error("missing");
      error.status = 404;
      throw error;
    }

    return parseBody(row.body);
  };

  const put = (doc) => {
    const normalized = normalizeDoc(doc);

    sqlite
      .prepare(`
        INSERT INTO docs (
          id,
          type,
          body,
          createdAt,
          updatedAt
        )
        VALUES (
          @id,
          @type,
          @body,
          @createdAt,
          @updatedAt
        )

        ON CONFLICT(id)
        DO UPDATE SET
          type = excluded.type,
          body = excluded.body,
          updatedAt = excluded.updatedAt
      `)
      .run({
        id: normalized._id,
        type: normalized.type || null,
        body: JSON.stringify(normalized),
        createdAt: normalized.createdAt,
        updatedAt: normalized.updatedAt,
      });

    return {
      ok: true,
      id: normalized._id,
      rev: "1-local",
    };
  };

  const remove = (doc) => {
    const id =
      typeof doc === "string"
        ? doc
        : doc?._id;

    if (!id) {
      throw new Error("Document id is required");
    }

    const result = sqlite
      .prepare(`
        DELETE FROM docs
        WHERE id = ?
      `)
      .run(id);

    if (!result.changes) {
      const error = new Error("missing");
      error.status = 404;
      throw error;
    }

    return {
      ok: true,
      id,
      rev: "deleted",
    };
  };

  // ==================================================
  // PRODUCTS
  // ==================================================

  const getProducts = () => {
    return sqlite
      .prepare(`
        SELECT *
        FROM products
        WHERE active = 1
        ORDER BY name COLLATE NOCASE
      `)
      .all();
  };

  const getProduct = (id) => {
    return sqlite
      .prepare(`
        SELECT *
        FROM products
        WHERE id = ?
      `)
      .get(id);
  };

  const saveProduct = (product) => {
    const timestamp = now();

    const id =
      product.id ||
      product._id ||
      newId("product");

    sqlite
      .prepare(`
        INSERT INTO products (
          id,
          name,
          price,
          min_stock_threshold,
          days_to_ready,
          active,
          created_at,
          updated_at
        )
        VALUES (
          @id,
          @name,
          @price,
          @min_stock_threshold,
          @days_to_ready,
          @active,
          @created_at,
          @updated_at
        )

        ON CONFLICT(id)
        DO UPDATE SET
          name = excluded.name,
          price = excluded.price,
          min_stock_threshold = excluded.min_stock_threshold,
          days_to_ready = excluded.days_to_ready,
          active = excluded.active,
          updated_at = excluded.updated_at
      `)
      .run({
        id,
        name: product.name || "",
        price: Number(product.price || 0),
        min_stock_threshold:
          Number(product.minStockThreshold ?? 25),
        days_to_ready:
          Number(product.daysToReady || 0),
        active:
          product.active === false ? 0 : 1,
        created_at:
          product.createdAt || timestamp,
        updated_at:
          timestamp,
      });

    return getProduct(id);
  };

  // ==================================================
  // BATCHES
  // ==================================================

  const getBatches = ({ productId = null } = {}) => {
    let sql = `
      SELECT
        b.*,
        p.name AS product_name
      FROM batches b
      LEFT JOIN products p
        ON p.id = b.product_id
    `;

    const params = [];

    if (productId) {
      sql += `
        WHERE b.product_id = ?
      `;

      params.push(productId);
    }

    sql += `
      ORDER BY
        b.date_planted ASC
    `;

    return sqlite
      .prepare(sql)
      .all(...params);
  };

  const getBatchesById = (id) => {
    return sqlite
      .prepare(`
        SELECT
          b.*,
          p.name AS product_name
        FROM batches b
        LEFT JOIN products p
          ON p.id = b.product_id
        WHERE b.id = ?
      `)
      .get(id);
  };

  const saveBatch = (batch) => {
    const timestamp = now();

    const id =
      batch.id ||
      batch._id ||
      newId("batch");

    const productId =
      batch.product_id ||
      batch.productId ||
      batch.cropId;

    sqlite
      .prepare(`
        INSERT INTO batches (
          id,
          product_id,
          batch_name,
          batch_number,
          quantity_planted,
          quantity_remaining,
          quantity_lost,
          date_planted,
          expected_ready_date,
          ready_override,
          created_at,
          updated_at
        )
        VALUES (
          @id,
          @product_id,
          @batch_name,
          @batch_number,
          @quantity_planted,
          @quantity_remaining,
          @quantity_lost,
          @date_planted,
          @expected_ready_date,
          @ready_override,
          @created_at,
          @updated_at
        )

        ON CONFLICT(id)
        DO UPDATE SET
          product_id = excluded.product_id,
          batch_name = excluded.batch_name,
          batch_number = excluded.batch_number,
          quantity_planted = excluded.quantity_planted,
          quantity_remaining = excluded.quantity_remaining,
          quantity_lost = excluded.quantity_lost,
          date_planted = excluded.date_planted,
          expected_ready_date = excluded.expected_ready_date,
          ready_override = excluded.ready_override,
          updated_at = excluded.updated_at
      `)
      .run({
        id,

        product_id: productId,

        batch_name:
          batch.batch_name ||
          batch.batchName ||
          "",

        batch_number:
          batch.batch_number ||
          batch.batchNumber ||
          null,

        quantity_planted:
          Number(
            batch.quantity_planted ??
            batch.quantityPlanted ??
            0
          ),

        quantity_remaining:
          Number(
            batch.quantity_remaining ??
            batch.quantityRemaining ??
            0
          ),

        quantity_lost:
          Number(
            batch.quantity_lost ??
            batch.quantityLost ??
            0
          ),

        date_planted:
          batch.date_planted ||
          batch.datePlanted ||
          timestamp,

        expected_ready_date:
          batch.expected_ready_date ||
          batch.expectedReadyDate ||
          timestamp,

        ready_override:
          batch.ready_override ||
            batch.readyOverride
            ? 1
            : 0,

        created_at:
          batch.created_at ||
          batch.createdAt ||
          timestamp,

        updated_at:
          timestamp,
      });

    return getBatchesById(id);
  };

  const updateBatchQuantity = (
    batchId,
    quantityRemaining
  ) => {
    sqlite
      .prepare(`
        UPDATE batches
        SET
          quantity_remaining = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .run(
        Number(quantityRemaining),
        now(),
        batchId
      );

    return getBatchesById(batchId);
  };

  const deductFromBatch = (
    batchId,
    quantity
  ) => {
    const qty = Number(quantity);

    if (!qty || qty <= 0) {
      throw new Error("INVALID_QUANTITY");
    }

    const batch = getBatchesById(batchId);

    if (!batch) {
      throw new Error("BATCH_NOT_FOUND");
    }

    const ready =
      Boolean(batch.ready_override) ||
      new Date() >=
      new Date(batch.expected_ready_date);

    if (!ready) {
      throw new Error("BATCH_NOT_READY");
    }

    if (
      Number(batch.quantity_remaining) <
      qty
    ) {
      throw new Error("NOT_ENOUGH_IN_BATCH");
    }

    sqlite
      .prepare(`
        UPDATE batches
        SET
          quantity_remaining =
            quantity_remaining - ?,
          updated_at = ?
        WHERE id = ?
          AND quantity_remaining >= ?
      `)
      .run(
        qty,
        now(),
        batchId,
        qty
      );

    return getBatchesById(batchId);
  };

  // ==================================================
  // CUSTOMERS
  // ==================================================

  const getCustomers = () => {
    return sqlite
      .prepare(`
        SELECT *
        FROM customers
        ORDER BY name COLLATE NOCASE
      `)
      .all();
  };

  const saveCustomer = (customer) => {
    const timestamp = now();

    const id =
      customer.id ||
      customer._id ||
      newId("customer");

    sqlite
      .prepare(`
        INSERT INTO customers (
          id,
          name,
          krapin,
          phone,
          email,
          notes,
          created_at,
          updated_at
        )
        VALUES (
          @id,
          @name,
          @krapin,
          @phone,
          @email,
          @notes,
          @created_at,
          @updated_at
        )

        ON CONFLICT(id)
        DO UPDATE SET
          name = excluded.name,
          krapin = excluded.krapin,
          phone = excluded.phone,
          email = excluded.email,
          notes = excluded.notes,
          updated_at = excluded.updated_at
      `)
      .run({
        id,
        name: customer.name || "",
        krapin: customer.krapin || "",
        phone: customer.phone || "",
        email: customer.email || "",
        notes: customer.notes || "",
        created_at:
          customer.createdAt || timestamp,
        updated_at:
          timestamp,
      });

    return sqlite
      .prepare(`
        SELECT *
        FROM customers
        WHERE id = ?
      `)
      .get(id);
  };

  // ==================================================
  // SALES
  // ==================================================

  const getSales = ({
    startDate = null,
    endDate = null,
    presalesOnly = false,
    creditSalesOnly = false
  } = {}) => {
    let sql = `
      SELECT
        s.*,

        c.name AS customer_name

      FROM sales s

      LEFT JOIN customers c
        ON c.id = s.customer_id

      WHERE 1 = 1
    `;

    const params = [];

    if (startDate) {
      sql += `
        AND s.sale_date >= ?
      `;

      params.push(startDate);
    }

    if (endDate) {
      sql += `
        AND s.sale_date < ?
      `;

      params.push(endDate);
    }

    if (presalesOnly) {
      sql += `
        AND s.is_presale = 1
      `;
    }

    if (creditSalesOnly) {
      sql += `
        AND s.is_credit = 1
      `;
    }

    sql += `
      ORDER BY
        s.sale_date DESC
    `;

    const sales = sqlite
      .prepare(sql)
      .all(...params);

    const getItems = sqlite.prepare(`
      SELECT
        si.*,
        p.name AS product_name,
        b.batch_name,
        b.date_planted

      FROM sale_items si

      LEFT JOIN products p
        ON p.id = si.product_id

      LEFT JOIN batches b
        ON b.id = si.batch_id

      WHERE si.sale_id = ?
    `);

    const getPayments = sqlite.prepare(`
      SELECT *
      FROM payments
      WHERE sale_id = ?
      ORDER BY payment_date ASC
    `);

    const payments = getPayments.all(sale.id);
    const totalPaid = payments.reduce(
      (sum, payment) =>
        sum + Number(payment.amount || 0),
      0
    );

    return sales.map((sale) => ({
      ...sale,

      isCreditSale:
        Boolean(sale.is_credit),

      isPresale:
        Boolean(sale.is_presale),

      presaleStatus:
        sale.presale_status,

      customerName:
        sale.customer_name || "",

      dwnPayment:
        Number(sale.down_payment || 0),

      items:
        getItems.all(sale.id),

      paymentHistory:
        payments,

      totalPaid,
      balance: Math.max(
        0,
        Number(sale.total || 0) - totalPaid
      ),
    }));
  };

  const deductStockInTransaction = (batchId, quantity) => {
    const qty = Number(quantity);

    if (!batchId) {
      throw new Error("BATCH_ID_REQUIRED");
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error("INVALID_QUANTITY");
    }

    const result = sqlite
      .prepare(`
      UPDATE batches
      SET
        quantity_remaining = quantity_remaining - ?,
        updated_at = ?
      WHERE
        id = ?
        AND quantity_remaining >= ?
    `)
      .run(
        qty,
        now(),
        batchId,
        qty
      );

    if (result.changes === 0) {
      throw new Error("INSUFFICIENT_STOCK");
    }
  };

  const createSale = (sale) => {
    const timestamp = now();

    const saleId =
      sale.id ||
      sale._id ||
      newId("sale");

    const isPresale = Boolean(
      sale.is_presale ??
      sale.isPresale ??
      false
    );

    const isCredit = Boolean(
      sale.is_credit ??
      sale.isCreditSale ??
      false
    );

    const customerId =
      sale.customer_id ||
      sale.customerId ||
      null;

    const items =
      Array.isArray(sale.items)
        ? sale.items
        : [];

    const transaction =
      sqlite.transaction(() => {

        sqlite
          .prepare(`
            INSERT INTO sales (
              id,
              customer_id,
              sale_date,
              is_credit,
              is_presale,
              presale_status,
              total,
              down_payment,
              completed_at,
              completed_by,
              created_by,
              created_at,
              updated_at
            )
            VALUES (
              @id,
              @customer_id,
              @sale_date,
              @is_credit,
              @is_presale,
              @presale_status,
              @total,
              @down_payment,
              @completed_at,
              @completed_by,
              @created_by,
              @created_at,
              @updated_at
            )
          `)
          .run({
            id: saleId,

            customer_id: customerId,

            sale_date:
              sale.sale_date ||
              sale.saleDate ||
              sale.timestamp ||
              timestamp,

            is_credit: isCredit ? 1 : 0,
            is_presale: isPresale ? 1 : 0,

            presale_status:
              sale.presale_status ||
              sale.presaleStatus ||
              null,

            total:
              Number(sale.total || 0),

            down_payment:
              Number(
                sale.down_payment ??
                sale.dwnPayment ??
                0
              ),

            completed_at:
              sale.completed_at ||
              sale.completedAt ||
              null,

            completed_by:
              sale.completed_by ||
              sale.completedBy ||
              null,

            created_by:
              sale.created_by ||
              sale.createdBy ||
              null,

            created_at:
              sale.created_at ||
              sale.createdAt ||
              timestamp,

            updated_at:
              timestamp,
          });

        const insertItem =
          sqlite.prepare(`
            INSERT INTO sale_items (
              id,
              sale_id,
              product_id,
              batch_id,
              quantity,
              selling_price,
              total
            )
            VALUES (
              @id,
              @sale_id,
              @product_id,
              @batch_id,
              @quantity,
              @selling_price,
              @total
            )
          `);

        for (const item of items) {
          insertItem.run({
            id:
              item.id ||
              newId("saleitem"),

            sale_id:
              saleId,

            product_id:
              item.product_id ||
              item.productId ||
              item.product?._id ||
              null,

            batch_id:
              item.batch_id ||
              item.batchId ||
              item.batch?._id ||
              null,

            quantity:
              Number(item.quantity ?? item.qty ?? 0),

            selling_price:
              Number(
                item.selling_price ??
                item.sellingPrice ??
                0
              ),

            total:
              Number(
                item.total ??
                (
                  Number(item.quantity ?? item.qty ?? 0) *
                  Number(
                    item.selling_price ??
                    item.sellingPrice ??
                    0
                  )
                )
              ),
          });
        }

        if (
          Number(sale.dwnPayment ?? sale.down_payment ?? 0) >
          0
        ) {
          sqlite
            .prepare(`
              INSERT INTO payments (
                id,
                sale_id,
                amount,
                payment_date,
                method,
                reference,
                recorded_by,
                note,
                created_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .run(
              newId("payment"),
              saleId,
              Number(
                sale.dwnPayment ??
                sale.down_payment ??
                0
              ),
              timestamp,
              sale.paymentMethod || "cash",
              sale.paymentReference || null,
              sale.recordedBy || sale.createdBy || null,
              "Initial payment",
              timestamp
            );
        }
        // --------------------------------------------
        // Deduct physical stock
        // --------------------------------------------

        if (!isPresale) {
          deductStockInTransaction(
            batchId,
            quantity
          );
        }
      });



    transaction();

    return getSales({}).find(
      (sale) => sale.id === saleId
    );
  };

  // ==================================================
  // PAYMENTS
  // ==================================================

  const addPayment = (payment) => {
    const timestamp = now();

    const paymentId =
      payment.id ||
      payment._id ||
      newId("payment");

    sqlite
      .prepare(`
        INSERT INTO payments (
          id,
          sale_id,
          amount,
          payment_date,
          method,
          reference,
          recorded_by,
          note,
          created_at
        )
        VALUES (
          @id,
          @sale_id,
          @amount,
          @payment_date,
          @method,
          @reference,
          @recorded_by,
          @note,
          @created_at
        )
      `)
      .run({
        id: paymentId,

        sale_id:
          payment.sale_id ||
          payment.saleId,

        amount:
          Number(payment.amount || 0),

        payment_date:
          payment.payment_date ||
          payment.paymentDate ||
          timestamp,

        method:
          payment.method ||
          "cash",

        reference:
          payment.reference ||
          null,

        recorded_by:
          payment.recorded_by ||
          payment.recordedBy ||
          null,

        note:
          payment.note ||
          "",

        created_at:
          timestamp,
      });

    return sqlite
      .prepare(`
        SELECT *
        FROM payments
        WHERE id = ?
      `)
      .get(paymentId);
  };

  // ==================================================
  // COMPLETE PRESALE
  // ==================================================

  const completePresale = ({
    saleId,
    completedBy,
    finalPayment = 0,
    paymentMethod = "cash",
    paymentReference = null,
    completedAt = null
  }) => {

    const transaction =
      sqlite.transaction(() => {

        const sale = sqlite
          .prepare(`
            SELECT *
            FROM sales
            WHERE id = ?
          `)
          .get(saleId);

        if (!sale) {
          throw new Error(
            "SALE_NOT_FOUND"
          );
        }

        if (!sale.is_presale) {
          throw new Error(
            "NOT_A_PRESALE"
          );
        }

        if (
          sale.presale_status !==
          "pending"
        ) {
          throw new Error(
            "PRESALE_ALREADY_COMPLETED"
          );
        }

        const items = sqlite
          .prepare(`
            SELECT *
            FROM sale_items
            WHERE sale_id = ?
          `)
          .all(saleId);

        if (!items.length) {
          throw new Error(
            "PRESALE_HAS_NO_ITEMS"
          );
        }

        for (const item of items) {

          const batch = sqlite
            .prepare(`
              SELECT *
              FROM batches
              WHERE id = ?
            `)
            .get(item.batch_id);

          if (!batch) {
            throw new Error(
              "BATCH_NOT_FOUND"
            );
          }

          const ready =
            Boolean(batch.ready_override) ||
            new Date() >=
            new Date(
              batch.expected_ready_date
            );

          if (!ready) {
            throw new Error(
              "BATCH_NOT_READY"
            );
          }

          if (
            Number(batch.quantity_remaining) <
            Number(item.quantity)
          ) {
            throw new Error(
              "NOT_ENOUGH_IN_BATCH"
            );
          }
        }

        // Deduct all physical stock only when
        // the presale is actually collected.
        const deduct =
          sqlite.prepare(`
            UPDATE batches
            SET
              quantity_remaining =
                quantity_remaining - ?,
              updated_at = ?
            WHERE id = ?
              AND quantity_remaining >= ?
          `);

        for (const item of items) {
          const result =
            deduct.run(
              Number(item.quantity),
              now(),
              item.batch_id,
              Number(item.quantity)
            );

          if (!result.changes) {
            throw new Error(
              "STOCK_CHANGED"
            );
          }
        }

        // Record final payment, if any.
        if (
          Number(finalPayment) > 0
        ) {
          sqlite
            .prepare(`
              INSERT INTO payments (
                id,
                sale_id,
                amount,
                payment_date,
                method,
                reference,
                recorded_by,
                note,
                created_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .run(
              newId("payment"),
              saleId,
              Number(finalPayment),
              completedAt || now(),
              paymentMethod,
              paymentReference,
              completedBy || null,
              "Final payment",
              now()
            );
        }

        sqlite
          .prepare(`
            UPDATE sales
            SET
              presale_status = 'completed',
              completed_at = ?,
              completed_by = ?,

              down_payment = (
                SELECT
                  COALESCE(
                    SUM(amount),
                    0
                  )
                FROM payments
                WHERE sale_id = ?
              ),

              updated_at = ?

            WHERE id = ?
          `)
          .run(
            completedAt || now(),
            completedBy || null,
            saleId,
            now(),
            saleId
          );
      });

    transaction();

    return getSales({})
      .find(
        (sale) =>
          sale.id === saleId
      );
  };

  // ==================================================
  // PURCHASES
  // ==================================================

  const getPurchases = ({
    startDate = null,
    endDate = null
  } = {}) => {

    let sql = `
      SELECT
        p.*,
        s.name AS supplier_name

      FROM purchases p

      LEFT JOIN suppliers s
        ON s.id = p.supplier_id

      WHERE 1 = 1
    `;

    const params = [];

    if (startDate) {
      sql += `
        AND p.purchase_date >= ?
      `;

      params.push(startDate);
    }

    if (endDate) {
      sql += `
        AND p.purchase_date < ?
      `;

      params.push(endDate);
    }

    sql += `
      ORDER BY
        p.purchase_date DESC
    `;

    return sqlite
      .prepare(sql)
      .all(...params);
  };

  // ==================================================
  // EXPENSES
  // ==================================================

  const getExpenses = ({
    startDate = null,
    endDate = null
  } = {}) => {

    let sql = `
      SELECT *
      FROM expenses
      WHERE 1 = 1
    `;

    const params = [];

    if (startDate) {
      sql += `
        AND expense_date >= ?
      `;

      params.push(startDate);
    }

    if (endDate) {
      sql += `
        AND expense_date < ?
      `;

      params.push(endDate);
    }

    sql += `
      ORDER BY
        expense_date DESC
    `;

    return sqlite
      .prepare(sql)
      .all(...params);
  };

  // ==================================================
  // CASH SUMMARY
  // ==================================================

  const getCashSummary = ({
    startDate,
    endDate
  }) => {

    const sales =
      sqlite
        .prepare(`
          SELECT
            COALESCE(
              SUM(p.amount),
              0
            ) AS total

          FROM payments p

          WHERE p.payment_date >= ?
            AND p.payment_date < ?
        `)
        .get(
          startDate,
          endDate
        ).total;

    const purchases =
      sqlite
        .prepare(`
          SELECT
            COALESCE(
              SUM(total),
              0
            ) AS total

          FROM purchases

          WHERE purchase_date >= ?
            AND purchase_date < ?
        `)
        .get(
          startDate,
          endDate
        ).total;

    const expenses =
      sqlite
        .prepare(`
          SELECT
            COALESCE(
              SUM(amount),
              0
            ) AS total

          FROM expenses

          WHERE expense_date >= ?
            AND expense_date < ?
        `)
        .get(
          startDate,
          endDate
        ).total;

    return {
      sales: Number(sales || 0),

      purchases:
        Number(purchases || 0),

      expenses:
        Number(expenses || 0),

      cash:
        Number(sales || 0) -
        Number(purchases || 0) -
        Number(expenses || 0),
    };
  };

  // ==================================================
  // M-PESA
  // ==================================================

  const createMpesaPayment = ({
    checkoutRequestId,
    merchantRequestId,
    amount,
    phoneNumber
  }) => {

    const timestamp = now();

    sqlite
      .prepare(`
        INSERT INTO mpesa_payments (
          checkout_request_id,
          merchant_request_id,
          status,
          amount,
          phone_number,
          created_at,
          updated_at
        )
        VALUES (?, ?, 'pending', ?, ?, ?, ?)

        ON CONFLICT(checkout_request_id)
        DO UPDATE SET
          merchant_request_id =
            excluded.merchant_request_id,

          amount =
            excluded.amount,

          phone_number =
            excluded.phone_number,

          updated_at =
            excluded.updated_at
      `)
      .run(
        checkoutRequestId,
        merchantRequestId || null,
        Number(amount || 0),
        phoneNumber || null,
        timestamp,
        timestamp
      );

    return getMpesaPayment(
      checkoutRequestId
    );
  };

  const getMpesaPayment = (
    checkoutRequestId
  ) => {
    return sqlite
      .prepare(`
        SELECT *
        FROM mpesa_payments
        WHERE checkout_request_id = ?
      `)
      .get(checkoutRequestId);
  };

  const updateMpesaPayment = ({
    checkoutRequestId,
    ...fields
  }) => {

    const allowed = [
      "status",
      "transaction_id",
      "transaction_date",
      "result_code",
      "result_desc",
      "merchant_request_id",
      "amount",
      "phone_number"
    ];

    const updates = [];
    const values = [];

    for (const key of allowed) {

      if (
        Object.prototype.hasOwnProperty.call(
          fields,
          key
        )
      ) {
        updates.push(
          `${key} = ?`
        );

        values.push(
          fields[key]
        );
      }
    }

    if (!updates.length) {
      return getMpesaPayment(
        checkoutRequestId
      );
    }

    updates.push(
      "updated_at = ?"
    );

    values.push(now());

    values.push(
      checkoutRequestId
    );

    sqlite
      .prepare(`
        UPDATE mpesa_payments
        SET ${updates.join(", ")}
        WHERE checkout_request_id = ?
      `)
      .run(...values);

    return getMpesaPayment(
      checkoutRequestId
    );
  };

  // ==================================================
  // LEGACY DATA MIGRATION
  // ==================================================

  const migrateLegacyDocs = () => {

    const docs =
      sqlite
        .prepare(`
          SELECT
            id,
            type,
            body
          FROM docs
          ORDER BY id
        `)
        .all();

    const report = {
      products: 0,
      batches: 0,
      customers: 0,
      suppliers: 0,
      sales: 0,
      expenses: 0,
      skipped: 0
    };

    const transaction =
      sqlite.transaction(() => {

        for (const row of docs) {

          const doc =
            parseBody(row.body);

          if (!doc) {
            report.skipped++;
            continue;
          }

          try {

            if (
              row.type ===
              "product"
            ) {

              saveProduct(doc);

              report.products++;

            } else if (
              row.type ===
              "batch"
            ) {

              saveBatch(doc);

              report.batches++;

            } else if (
              row.type ===
              "customer"
            ) {

              saveCustomer(doc);

              report.customers++;

            } else if (
              row.type ===
              "supplier"
            ) {

              const id =
                doc._id ||
                row.id;

              sqlite
                .prepare(`
                  INSERT INTO suppliers (
                    id,
                    name,
                    phone,
                    email,
                    contact_person,
                    address,
                    created_at,
                    updated_at
                  )
                  VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?
                  )

                  ON CONFLICT(id)
                  DO UPDATE SET
                    name =
                      excluded.name,

                    phone =
                      excluded.phone,

                    email =
                      excluded.email,

                    contact_person =
                      excluded.contact_person,

                    address =
                      excluded.address,

                    updated_at =
                      excluded.updated_at
                `)
                .run(
                  id,
                  doc.name || "",
                  doc.phone || "",
                  doc.email || "",
                  doc.contactPerson || "",
                  doc.address || "",
                  doc.createdAt ||
                  now(),
                  doc.updatedAt ||
                  now()
                );

              report.suppliers++;

            } else if (
              row.type ===
              "expense"
            ) {

              sqlite
                .prepare(`
                  INSERT INTO expenses (
                    id,
                    expense_date,
                    category,
                    description,
                    amount,
                    created_by,
                    created_at,
                    updated_at
                  )
                  VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?
                  )

                  ON CONFLICT(id)
                  DO UPDATE SET
                    expense_date =
                      excluded.expense_date,

                    category =
                      excluded.category,

                    description =
                      excluded.description,

                    amount =
                      excluded.amount,

                    created_by =
                      excluded.created_by,

                    updated_at =
                      excluded.updated_at
                `)
                .run(
                  doc._id ||
                  row.id,

                  doc.date ||
                  doc.expenseDate ||
                  doc.createdAt ||
                  now(),

                  doc.category || "",

                  doc.description ||
                  doc.notes ||
                  "",

                  Number(
                    doc.amount || 0
                  ),

                  doc.createdBy ||
                  doc.recordedBy ||
                  null,

                  doc.createdAt ||
                  now(),

                  doc.updatedAt ||
                  now()
                );

              report.expenses++;

            } else {

              report.skipped++;

            }

          } catch (error) {

            console.error(
              "Legacy migration skipped",
              row.id,
              error
            );

            report.skipped++;
          }
        }
      });

    transaction();

    return report;
  };

  // ==================================================
  // RESET / DESTROY
  // ==================================================

  const destroy = () => {

    sqlite.close();

    if (
      fs.existsSync(filePath)
    ) {
      fs.unlinkSync(filePath);
    }

    return true;
  };

  const resetDb = () => {

    sqlite.exec(`
      DELETE FROM payments;
      DELETE FROM sale_items;
      DELETE FROM sales;

      DELETE FROM spoilage;

      DELETE FROM purchase_items;
      DELETE FROM purchases;

      DELETE FROM expenses;

      DELETE FROM batches;

      DELETE FROM customers;
      DELETE FROM suppliers;
      DELETE FROM products;

      DELETE FROM users;

      DELETE FROM mpesa_payments;

      DELETE FROM docs;
    `);

    return true;
  };

  // ==================================================
  // BACKUP MERGE
  // ==================================================

  const mergeBackup = (
    backupPath
  ) => {

    if (
      !fs.existsSync(
        backupPath
      )
    ) {
      throw new Error(
        "Backup file not found"
      );
    }

    const backupDb =
      new Database(
        backupPath,
        {
          readonly: true
        }
      );

    try {

      const table =
        backupDb
          .prepare(`
            SELECT
              name

            FROM sqlite_master

            WHERE type = 'table'
              AND name = 'docs'
          `)
          .get();

      if (!table) {
        throw new Error(
          "Invalid Boscos POS backup"
        );
      }

      const merge =
        sqlite.transaction(() => {

          const backupRows =
            backupDb
              .prepare(`
                SELECT
                  id,
                  type,
                  body,
                  createdAt,
                  updatedAt

                FROM docs
              `)
              .all();

          const getLocal =
            sqlite
              .prepare(`
                SELECT
                  updatedAt

                FROM docs

                WHERE id = ?
              `);

          const insertOrUpdate =
            sqlite
              .prepare(`
                INSERT INTO docs (
                  id,
                  type,
                  body,
                  createdAt,
                  updatedAt
                )

                VALUES (
                  @id,
                  @type,
                  @body,
                  @createdAt,
                  @updatedAt
                )

                ON CONFLICT(id)
                DO UPDATE SET

                  type =
                    excluded.type,

                  body =
                    excluded.body,

                  updatedAt =
                    excluded.updatedAt
              `);

          let inserted = 0;
          let updated = 0;
          let skipped = 0;

          for (
            const row
            of backupRows
          ) {

            const local =
              getLocal.get(
                row.id
              );

            if (!local) {

              insertOrUpdate.run(
                row
              );

              inserted++;

              continue;
            }

            const backupTime =
              new Date(
                row.updatedAt || 0
              ).getTime();

            const localTime =
              new Date(
                local.updatedAt || 0
              ).getTime();

            if (
              backupTime >
              localTime
            ) {

              insertOrUpdate.run(
                row
              );

              updated++;

            } else {

              skipped++;
            }
          }

          return {
            inserted,
            updated,
            skipped,
            total:
              backupRows.length
          };
        });

      const result =
        merge();

      let migration =
        null;

      try {

        migration =
          migrateLegacyDocs();

      } catch (error) {

        console.error(
          "Backup relational migration failed:",
          error
        );
      }

      return {
        ...result,
        migration
      };

    } finally {

      backupDb.close();
    }
  };

  // ==================================================
  // PUBLIC API
  // ==================================================

  return {

    sqlite,

    // Legacy
    allDocs,
    get,
    put,
    remove,

    // Products
    getProducts,
    getProduct,
    saveProduct,

    // Batches
    getBatches,
    getBatchesById,
    saveBatch,
    updateBatchQuantity,
    deductFromBatch,

    // Customers
    getCustomers,
    saveCustomer,

    // Sales
    getSales,
    createSale,

    // Payments
    addPayment,

    // Presales
    completePresale,

    // Purchases
    getPurchases,

    // Expenses
    getExpenses,

    // Cash
    getCashSummary,

    // M-Pesa
    createMpesaPayment,
    getMpesaPayment,
    updateMpesaPayment,

    // Migration
    migrateLegacyDatabase,

    // Database
    destroy,
    resetDb,
    mergeBackup
  };
}

module.exports = {
  createSqliteDbService
};

/*const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function createSqliteDbService(appPath) {
  const filePath = path.join(appPath, 'bosco.sqlite');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const sqlite = new Database(filePath);
  sqlite.pragma('journal_mode = WAL');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      id TEXT PRIMARY KEY,
      type TEXT,
      body TEXT NOT NULL,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS docs_type_idx ON docs(type)
  `);

  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS docs_updated_idx ON docs(updatedAt)
  `);

  const normalizeDoc = (doc) => {
    const normalized = { ...doc };
    normalized._id = normalized._id || `doc:${Date.now()}:${Math.floor(Math.random() * 100000)}`;
    normalized.createdAt = normalized.createdAt || new Date().toISOString();
    normalized.updatedAt = normalized.updatedAt || new Date().toISOString();
    return normalized;
  };

  const parseBody = (body) => {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  };

  const allDocs = (options = {}) => {
    const includeDocs = Boolean(options.include_docs);
    const startKey = typeof options.startkey === 'string' ? options.startkey : null;
    const endKey = typeof options.endkey === 'string' ? options.endkey : null;
    const limit = Number.isInteger(options.limit) ? options.limit : null;

    let query = 'SELECT id, type, body, createdAt, updatedAt FROM docs';
    const clauses = [];
    const params = [];

    if (startKey && endKey) {
      clauses.push('id >= ? AND id <= ?');
      params.push(startKey, endKey);
    } else if (startKey) {
      clauses.push('id >= ?');
      params.push(startKey);
    } else if (endKey) {
      clauses.push('id <= ?');
      params.push(endKey);
    }

    if (clauses.length) {
      query += ` WHERE ${clauses.join(' AND ')}`;
    }

    query += ' ORDER BY id ASC';

    if (limit !== null) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const rows = sqlite.prepare(query).all(...params);

    return {
      rows: rows.map((row) => {
        const doc = parseBody(row.body);
        return includeDocs
          ? { id: row.id, key: row.id, doc, value: { rev: doc?._rev || '1-restore' } }
          : { id: row.id, key: row.id, value: { rev: doc?._rev || '1-restore' } };
      }),
    };
  };

  const get = (id, options = {}) => {
    const row = sqlite.prepare('SELECT body FROM docs WHERE id = ?').get(id);
    if (!row) {
      const error = new Error('missing');
      error.status = 404;
      throw error;
    }

    const doc = parseBody(row.body);
    if (!doc) {
      const error = new Error('missing');
      error.status = 404;
      throw error;
    }

    return doc;
  };

  const put = (doc) => {
    const normalized = normalizeDoc(doc);
    const serialized = JSON.stringify(normalized);
    const record = {
      id: normalized._id,
      type: normalized.type || 'unknown',
      body: serialized,
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt,
    };

    sqlite.prepare(`
      INSERT INTO docs (id, type, body, createdAt, updatedAt)
      VALUES (@id, @type, @body, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        body = excluded.body,
        updatedAt = excluded.updatedAt
    `).run(record);

    return { ok: true, id: normalized._id, rev: normalized._rev || '1-restore' };
  };

  const remove = (doc) => {
    sqlite.prepare('DELETE FROM docs WHERE id = ?').run(doc._id);
    return { ok: true, id: doc._id, rev: doc._rev || '1-restore' };
  };

  const createMpesaPayment = (payment) => {
  const doc = {
    _id: `mpesa:${payment.checkoutRequestId}`,
    type: "mpesa_payment",

    status: payment.status || "pending",

    amount: Number(payment.amount),
    phoneNumber: payment.phoneNumber,

    merchantRequestId:
      payment.merchantRequestId || null,

    checkoutRequestId:
      payment.checkoutRequestId,

    transactionId:
      payment.transactionId || null,

    transactionDate:
      payment.transactionDate || null,

    resultCode:
      payment.resultCode ?? null,

    resultDesc:
      payment.resultDesc || null,

    createdAt:
      payment.createdAt || new Date().toISOString(),

    updatedAt:
      new Date().toISOString()
  };

  return put(doc);
};


const getMpesaPayment = (checkoutRequestId) => {
  return get(`mpesa:${checkoutRequestId}`);
};


const updateMpesaPayment = (
  checkoutRequestId,
  updates
) => {

  const doc = getMpesaPayment(checkoutRequestId);

  const updatedDoc = {
    ...doc,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  put(updatedDoc);

  return updatedDoc;
};

  const destroy = () => {
    sqlite.close();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  };

  const resetDb = () => {
    sqlite.exec('DELETE FROM docs');
    return true;
  };

  const mergeBackup = (backupPath) => {
  if (!fs.existsSync(backupPath)) {
    throw new Error("Backup file not found");
  }

  const backupDb = new Database(backupPath, { readonly: true });

  const table = backupDb.prepare(`
  SELECT name
  FROM sqlite_master
  WHERE type = 'table'
    AND name = 'docs'
`).get();

if (!table) {
  throw new Error("Invalid Boscos POS backup");
}

  try {
    const merge = sqlite.transaction(() => {
      const backupRows = backupDb
        .prepare(`
          SELECT id, type, body, createdAt, updatedAt
          FROM docs
        `)
        .all();

      const getLocal = sqlite.prepare(`
        SELECT updatedAt
        FROM docs
        WHERE id = ?
      `);

      const insertOrUpdate = sqlite.prepare(`
        INSERT INTO docs (
          id,
          type,
          body,
          createdAt,
          updatedAt
        )
        VALUES (
          @id,
          @type,
          @body,
          @createdAt,
          @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          type = excluded.type,
          body = excluded.body,
          updatedAt = excluded.updatedAt
      `);

      let inserted = 0;
      let updated = 0;
      let skipped = 0;

      for (const row of backupRows) {
        const local = getLocal.get(row.id);

        // Doesn't exist locally → import it
        if (!local) {
          insertOrUpdate.run(row);
          inserted++;
          continue;
        }

        // Both exist → only use backup if it is newer
        const backupTime = new Date(row.updatedAt || 0).getTime();
        const localTime = new Date(local.updatedAt || 0).getTime();

        if (backupTime > localTime) {
          insertOrUpdate.run(row);
          updated++;
        } else {
          skipped++;
        }
      }

      return {
        inserted,
        updated,
        skipped,
        total: backupRows.length
      };
    });

    return merge();

  } finally {
    backupDb.close();
  }
};

  return { allDocs, get, put, remove, destroy, resetDb, mergeBackup, sqlite, createMpesaPayment, getMpesaPayment, updateMpesaPayment };
}

module.exports = { createSqliteDbService };
*/