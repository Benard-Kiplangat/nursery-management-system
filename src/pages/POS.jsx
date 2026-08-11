import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  db,
  getBatches,
  deductFromBatch,
  availableQuantityForCrop,
  isBatchReady,
  readyBatchesForCrop,
  getStockAlertStatus,
  getBatchDisplayName,
  getAvailableBatchesForCrop
} from "../db";
import { showToast } from "../utils/toast";
import Cart from "../components/Cart";


export default function POS() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedBatches, setSelectedBatches] = useState({});
  const [availableBatchesByCrop, setAvailableBatchesByCrop] = useState({});
  const [fullLoaded, setFullLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [downPayment, setDownPayment] = useState({});
  const [quantities, setQuantities] = useState({});
  const [sellingPrices, setSellingPrices] = useState({});
  const [creditSales, setCreditSales] = useState({});
  const [presales, setPresales] = useState({});
  const [customerNames, setCustomerNames] = useState({});
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [outstandingCredits, setOutstandingCredits] = useState([]);
  const [showUpcoming, setShowUpcoming] = useState(true);

useEffect(() => {
  let cancelled = false;

  const loadAvailableBatches = async () => {
    const result = {};

    for (const product of products) {
      const availableBatches =
        await getAvailableBatchesForCrop(
          batches,
          product._id
        );

      result[product._id] = availableBatches;
    }

    if (!cancelled) {
      setAvailableBatchesByCrop(result);
    }
  };

  if (products.length && batches.length) {
    loadAvailableBatches();
  } else {
    setAvailableBatchesByCrop({});
  }

  return () => {
    cancelled = true;
  };
}, [products, batches, presales]);


useEffect(() => {
  setSelectedBatches(prev => {
    const next = { ...prev };
    let changed = false;

    products.forEach(product => {
      const selectedId = next[product._id];

      if (!selectedId) return;

      const isPresale = presales[product._id] || false;

      const validBatches = isPresale
        ? batches.filter(
            b =>
              b.cropId === product._id &&
              Number(b.quantityRemaining || 0) > 0
          )
        : batches.filter(
            b =>
              b.cropId === product._id &&
              isBatchReady(b) &&
              Number(b.quantityRemaining || 0) > 0
          );

      if (!validBatches.some(b => b._id === selectedId)) {
        delete next[product._id];
        changed = true;
      }
    });

    return changed ? next : prev;
  });
}, [presales, batches, products]);

  const loadBatches = async () => {
    try {
      const items = await getBatches();
      setBatches(items);
    } catch (e) {
      console.error("Failed to load batches", e);
    }
  };

  const loadCustomers = async () => {
    try {
      const result = await db.allDocs({ include_docs: true });
      const custs = result.rows.map(r => r.doc).filter(d => d && d.type === 'customer');
      setCustomers(custs);
    } catch (e) {
      console.error('failed to load customers', e);
    }
  };

  useEffect(() => {
    if (search && !fullLoaded) {
      loadFullProducts();
    }
  }, [search]);

  const loadOutstandingCredits = async () => {
    try {
      const result = await db.allDocs({ include_docs: true });
      const all = result.rows
        .map(r => r.doc)
        .filter(d => d && d.type === "sale" && d.isCreditSale && !d.isCreditPaid);

      const entries = [];
      const bulkMap = {};
      all.forEach(sale => {
        if (sale.isBulkSale && sale.bulkSaleId) {
          if (!bulkMap[sale.bulkSaleId]) {
            const group = {
              isBulkGroup: true,
              bulkSaleId: sale.bulkSaleId,
              customerName: sale.customerName,
              dwnPayment: sale.bulkDwnPayment || 0,
              timestamp: sale.timestamp,
              items: [],
            };
            bulkMap[sale.bulkSaleId] = group;
            entries.push(group);
          }
          bulkMap[sale.bulkSaleId].items.push(sale);
        } else {
          entries.push(sale);
        }
      });

      setOutstandingCredits(entries);
    } catch (e) {
      console.error("Failed to load credit sales", e);
    }
  };

  const loadProducts = async () => {
    try {
      const fast = await db.allDocs({ include_docs: true, startkey: 'crop', endkey: 'crop\uffff', limit: 12 });
      let fastProds = fast.rows.map(r => r.doc).filter(d => d && d.type === 'crop');

      const popular = getPopularIds();
      if (popular.length) {
        const missingIds = popular.filter(id => !fastProds.find(p => p._id === id));
        if (missingIds.length) {
          const got = await Promise.all(missingIds.map(id => db.get(id).catch(() => null)));
          got.forEach(g => { if (g && g.type === 'crop') fastProds.push(g); });
        }
      }

      if (fastProds.length) {
        setProducts(fastProds);
      }
    } catch (e) {
      console.warn('fast product load failed', e);
    }

    loadFullProducts();
  };

  const loadFullProducts = async () => {
    try {
      const result = await db.allDocs({ include_docs: true });
      const productDocs = result.rows.map(row => row.doc).filter(doc => doc && doc.type === "crop");
      setProducts(productDocs);
      setFullLoaded(true);
    } catch (e) {
      console.error('failed to load full products', e);
    }
  };

  const getPopularIds = () => {
    try {
      const raw = localStorage.getItem('popularCounts');
      if (!raw) return [];
      const map = JSON.parse(raw);
      return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id);
    } catch (e) { return []; }
  };

  const bumpPopular = (productId) => {
    try {
      const raw = localStorage.getItem('popularCounts');
      const map = raw ? JSON.parse(raw) : {};
      map[productId] = (map[productId] || 0) + 1;
      localStorage.setItem('popularCounts', JSON.stringify(map));
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
  loadProducts();
  loadBatches();
  loadCustomers();
  loadOutstandingCredits();
}, []);

  const handleSell = async (product) => {
    const qty = Math.max(
      1,
      parseInt(quantities[product._id], 10) || 1
    );

    const isPresale = presales[product._id] || false;

    const availableBatches = await getAvailableBatchesForCrop(
      batches,
      product._id
    );

    const eligibleBatches = isPresale
      ? availableBatches
      : availableBatches.filter(batch => isBatchReady(batch));

    if (eligibleBatches.length === 0) {
      alert(
        isPresale
          ? `No available batch for presale of ${product.name}.`
          : `No ready batch available for ${product.name}.`
      );
      return;
    }

    const chosenBatchId =
      selectedBatches[product._id] || eligibleBatches[0]._id;

    const batch = eligibleBatches.find(
      b => b._id === chosenBatchId
    );

    if (!batch) {
      alert(`Please select an available batch for ${product.name}.`);
      return;
    }

    if (batch.availableForSale < qty) {
      alert(
        `Only ${batch.availableForSale} available in that batch of ${product.name}.`
      );
      return;
    }

    const isCreditSale = creditSales[product._id] || false;
    if ((isCreditSale || isPresale) && !customerNames[product._id]) {
      alert("Please enter the customer's name for a credit/presale sale.");
      return;
    }

    const total = qty * (sellingPrices[product._id] || product.price);

    const now = new Date().toISOString();

const initialPayment = Number(
  downPayment[product._id] || 0
);


  const { currentUser } = localStorage.getItem("currentUserId").split(":")[1];

const sale = {
  _id: now,
  type: "sale",
  name: product.name,
  quantity: qty,
  total,
  sellingPrice:
    sellingPrices[product._id] || product.price,
  timestamp: now,
  isCreditSale,
  isPresale,
  presaleStatus: isPresale ? "pending" : null,

  dwnPayment: initialPayment,

  paymentHistory:
    isPresale && initialPayment > 0
      ? [
          {
            amount: initialPayment,
            date: now,
            recordedBy: currentUser || "Staff",
            method: "cash",
            note: "Initial deposit",
          },
        ]
      : [],

  customerName: (
    customerNames[product._id] || ""
  ).trim(),

  batchId: batch._id,
  batchDatePlanted: batch.datePlanted,
};

    try {
      if (!isPresale) {
        await deductFromBatch(batch._id, qty);
      }
    } catch (e) {
      alert(`That batch of ${product.name} changed before the sale went through. Check Batches and try again.`);
      loadBatches();
      return;
    }

    await db.put(sale);
    loadProducts();
    loadOutstandingCredits();
    loadBatches();
    showToast(`Sold ${qty} x ${product.name} — KES ${total}`);
    try { bumpPopular(product._id); } catch (e) { /* ignore */ }
    setQuantities(prev => ({ ...prev, [product._id]: 1 }));
    setCreditSales({});
    setPresales({});
    setCustomerNames({});
    setSellingPrices(prev => ({ ...prev, [product._id]: product.price }));
    setDownPayment({});
    setSelectedBatches({});
  };

  const handleAddToCart = async (product) => {
    const qty = Math.max(
      1,
      parseInt(quantities[product._id], 10) || 1
    );
    const price = sellingPrices[product._id] || product.price;

    const isPresale = presales[product._id] || false;

    // Don't allow mixing normal sales and presales in one cart
    if (cart.length > 0) {
      const cartIsPresale = cart[0].isPresale || false;

      if (cartIsPresale !== isPresale) {
        alert(
          cartIsPresale
            ? "This cart contains presale items. You cannot add a normal sale to the same cart."
            : "This cart contains normal sale items. You cannot add a presale to the same cart."
        );
        return;
      }
    }

    const availableBatches = await getAvailableBatchesForCrop(
      batches,
      product._id
    );

    const eligibleBatches = isPresale
      ? availableBatches
      : availableBatches.filter(batch => isBatchReady(batch));

    if (eligibleBatches.length === 0) {
      alert(
        isPresale
          ? `No available batch for presale of ${product.name}.`
          : `No ready batch available for ${product.name}.`
      );
      return;
    }

    const chosenBatchId =
      selectedBatches[product._id] || eligibleBatches[0]._id;

    const batch = eligibleBatches.find(
      b => b._id === chosenBatchId
    );

    if (!batch) {
      alert(`Please select an available batch for ${product.name}.`);
      return;
    }

    if (batch.availableForSale < qty) {
      alert(
        `Only ${batch.availableForSale} available in that batch of ${product.name}.`
      );
      return;
    }

    setCart(prev => {
      const existing = prev.find(
        item => item.batch._id === batch._id
      );

      if (existing) {
        return prev.map(item =>
          item.batch._id === batch._id
            ? {
              ...item,
              qty: item.qty + qty,
              sellingPrice: price,
              isPresale,
            }
            : item
        );
      }

      return [
        ...prev,
        {
          product,
          batch,
          qty,
          isPresale,
          sellingPrice: price
        }
      ];
    });

    if (isPresale) {
      setPresales(prev => ({
        ...prev,
        [product._id]: false
      }));
    }

    showToast(`${product.name} added to cart`);
  };

  const handleCartUpdateQty = (batchId, qty) => {
    setCart(prev =>
      prev.map(item =>
        item.batch._id === batchId ? { ...item, qty: Math.max(1, qty) } : item
      )
    );
  };

  const handleCartUpdatePrice = (batchId, price) => {
    setCart(prev =>
      prev.map(item =>
        item.batch._id === batchId ? { ...item, sellingPrice: price } : item
      )
    );
  };

  const handleCartRemoveItem = (batchId) => {
    setCart(prev => prev.filter(item => item.batch._id !== batchId));
  };

  const handleCartClear = () => setCart([]);

  const handleCartSale = async ({ isCreditSale = false, isPresale = false, customerName = "", dwnPayment = 0 } = {}) => {
    if (cart.length === 0) return;

    if ((isCreditSale || isPresale) && !customerName) {
      alert("Please enter the customer's name for a credit/presale sale.");
      return;
    }

    for (const item of cart) {
      const availableBatches = await getAvailableBatchesForCrop(
        batches,
        item.product._id
      );

      const currentBatch = availableBatches.find(
        b => b._id === item.batch._id
      );

      if (!currentBatch || currentBatch.availableForSale < item.qty) {
        alert(
          `Only ${currentBatch?.availableForSale || 0} available in the selected batch of ${item.product.name}. Adjust the cart before selling.`
        );
        return;
      }
    }

    const bulkSaleId = new Date().toISOString();

    for (let i = 0; i < cart.length; i++) {
      const item = cart[i];
      const product = products.find(p => p._id === item.product._id) || item.product;
      const total = item.qty * item.sellingPrice;

      const sale = {
        _id: `${bulkSaleId}-${i}`,
        type: "sale",
        name: product.name,
        quantity: item.qty,
        total,
        sellingPrice: item.sellingPrice,
        timestamp: bulkSaleId,
        isCreditSale,
        isPresale: item.isPresale,
        presaleStatus: item.isPresale ? "pending" : null,
        customerName: customerName.trim() || " ",
        dwnPayment: 0,
        bulkDwnPayment: isCreditSale ? Number(dwnPayment) : 0,
        isBulkSale: true,
        bulkSaleId,
        batchId: item.batch._id,
        batchDatePlanted: item.batch.datePlanted,
      };

      try {
        if (!item.isPresale) {
          await deductFromBatch(item.batch._id, item.qty);
        }
      } catch (e) {
        alert(`That batch of ${product.name} changed before the sale went through. Sale stopped partway — check Batches and Sales before retrying.`);
        loadBatches();
        return;
      }

      await db.put(sale);

      try { bumpPopular(product._id); } catch (e) { /* ignore */ }
    }

    const totalAmount = cart.reduce((sum, item) => sum + item.qty * item.sellingPrice, 0);
    setCart([]);
    loadProducts();
    loadOutstandingCredits();
    loadBatches();
    const creditNote = isCreditSale ? ` (Credit — ${customerName})` : "";
    showToast(`Bulk sale of ${cart.length} items — KES ${totalAmount} complete${creditNote}`);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockCrops = products.filter(p => {
    const ready = availableQuantityForCrop(batches, p._id);
    const alertInfo = getStockAlertStatus(p, ready);
    return alertInfo.status === "low_stock" || alertInfo.status === "out_of_stock";
  });


  const upcomingReadyBatches = batches
    .filter(batch => batch.status !== "ready")
    .map(batch => {
      const crop = products.find(p => p._id === batch.cropId);
      if (!crop) return null;

      const planted = new Date(batch.datePlanted);
      const readyDate = new Date(planted);
      readyDate.setDate(readyDate.getDate() + crop.daysToReady);

      const daysRemaining = Math.ceil(
        (readyDate - new Date()) / (1000 * 60 * 60 * 24)
      );

      return {
        ...batch,
        cropName: crop.name,
        daysRemaining,
        readyDate,
      };
    })
    .filter(
      batch =>
        batch &&
        batch.daysRemaining >= 0 &&
        batch.daysRemaining <= 7
    )
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const customerCreditMap = {};
  outstandingCredits.forEach(entry => {
    const name = entry.customerName || "Unknown";
    const date = entry.timestamp || entry.createdAt || new Date().toISOString();
    if (!customerCreditMap[name]) customerCreditMap[name] = { name, date, entries: [], totalOwed: 0 };
    if (entry.isBulkGroup) {
      const bulkTotal = entry.items.reduce((s, i) => s + i.total, 0);
      const owed = bulkTotal - (entry.dwnPayment || 0);
      customerCreditMap[name].entries.push({ owed, label: `Bulk (${entry.items.length} items)`, detail: entry.items.map(i => `${i.quantity}×${i.name}`).join(", ") });
      customerCreditMap[name].totalOwed += owed;
    } else {
      const owed = entry.total - (entry.dwnPayment || 0);
      customerCreditMap[name].entries.push({ owed, label: `${entry.quantity} × ${entry.name}`, detail: null });
      customerCreditMap[name].totalOwed += owed;
    }
  });
  const customerCredits = Object.values(customerCreditMap).sort((a, b) => b.totalOwed - a.totalOwed);
  const grandCreditTotal = customerCredits.reduce((s, c) => s + c.totalOwed, 0);

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner Alert if low stock crops exist */}
      <div>
        <div className="font-bold text-sm">
          Stock Level Alert ({lowStockCrops.length} Crops)
        </div>

        <div className="text-xs text-amber-800">
          {lowStockCrops.slice(0, 4).map(c => c.name).join(", ")}
          {lowStockCrops.length > 4
            ? ` and ${lowStockCrops.length - 4} others`
            : ""}{" "}
          are running low or out of ready stock!
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Col 1: POS Catalog (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <span className="text-slate-400">🔍</span>
            <input
              type="text"
              placeholder="Search ready seedling varieties..."
              className="w-full bg-transparent outline-none text-sm font-medium"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {filteredProducts.map(product => {

              const qty = quantities[product._id] || 1;
              const total = qty * (sellingPrices[product._id] || product.price);
              const profit = total - (product.costPrice * qty);
              const price = sellingPrices[product._id] || product.price;

              const availableBatches =
  availableBatchesByCrop[product._id] || [];

const available = availableBatches.reduce(
  (sum, batch) =>
    sum + Number(batch.availableForSale || 0),
  0
);

              const readyBatches = readyBatchesForCrop(
                batches,
                product._id
              );

              const isPresale = presales[product._id] || false;

              const selectableBatches = isPresale
  ? availableBatches
  : availableBatches.filter(batch =>
      isBatchReady(batch)
    );

              const chosenBatchId =
                selectedBatches[product._id] ||
                selectableBatches[0]?._id ||
                "";

              const alertInfo = getStockAlertStatus(
                product,
                available
              );

              const hasReadyBatch = readyBatches.length > 0;
              const canSell = selectableBatches.length > 0;

              return (
                <div
                  key={product._id}
                  className="card-elevated p-4 space-y-3"
                >
                  {/* Product header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-base flex items-center gap-2">
                        <span>🌱 {product.name}</span>

                        <span
                          className={
                            alertInfo.status === "out_of_stock"
                              ? "badge-danger"
                              : alertInfo.status === "low_stock"
                                ? "badge-warning"
                                : "badge-success"
                          }
                        >
                          {alertInfo.label}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 mt-0.5">
                        Base Price: KES {product.price} · Maturity:{" "}
                        {product.daysToReady} days
                      </div>
                    </div>

                    {/* Batch selector */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 w-full">
                        <label className="text-xs text-slate-500 font-semibold">
                          Batch:
                        </label>

                        <select
                          value={
  selectableBatches.some(
    batch => batch._id === selectedBatches[product._id]
  )
    ? selectedBatches[product._id]
    : selectableBatches[0]?._id || ""
                          }
                          onChange={e =>
                            setSelectedBatches(prev => ({
                              ...prev,
                              [product._id]: e.target.value,
                            }))
                          }
                          disabled={!canSell}
                          className="border rounded p-1 input-field text-xs min-w-[70px]"
                        >
                          {selectableBatches.length === 0 ? (
                            <option value="">
                              {isPresale
                                ? "No available batches"
                                : "No ready batches"}
                            </option>
                          ) : (
                            selectableBatches.map(batch => (
                              <option key={batch._id} value={batch._id}>
                                {getBatchDisplayName(batch)}
                                {" — "}
                                {!isBatchReady(batch) ? ` ${batch.availableForSale} available (Growing)` : `${batch.quantityRemaining} available`}
                              </option>
                            ))
                          )}
                        </select>

                        {/* customer selector */}
                        {customers.length > 0 && (
                          <select
                            className="border rounded p-1 input-field text-xs min-w-[70px]"
                            value={customerNames[product._id] || ""}
                            onChange={(e) =>
                              setCustomerNames(prev => ({
                                ...prev,
                                [product._id]: e.target.value
                              }))
                            }
                          >
                            <option value="">Select customer</option>

                            {customers.map(customer => (
                              <option
                                key={customer._id}
                                value={customer.name}
                              >
                                {customer.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {customers.length === 0 && (
                          <input
                            type="text"
                            placeholder="Enter Customer's name"
                            className="input-field text-xs flex-1 min-w-[120px]"
                            value={customerNames[product._id] || ""}
                            onChange={(e) =>
                              setCustomerNames(prev => ({
                                ...prev,
                                [product._id]: e.target.value
                              }))
                            }
                          />
                        )
                        }
                      </div>
                    </div>
                  </div>



                  {/* Selling controls */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">

                    <div className="flex items-center gap-2">

                      {/* Price */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">
                          Price:
                        </span>

                        <input
                          type="number"
                          min="0"
                          className="input-field text-xs border rounded p-1 min-w-[50px]"
                          value={sellingPrices[product._id] ?? product.price}
                          onChange={(e) =>
                            setSellingPrices(prev => ({
                              ...prev,
                              [product._id]: Number(e.target.value) || ""
                            }))
                          }
                        />
                      </div>

                      {/* Quantity */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">
                          Qty:
                        </span>

                        <input
                          type="number"
                          min="1"
                          step="1"
                          className="input-field text-xs border rounded p-1 min-w-[70px]"
                          value={
                            quantities[product._id] ?? 1
                          }
                          onChange={(e) =>
                            setQuantities(prev => ({
                              ...prev,
                              [product._id]: e.target.value
                            }))
                          }
                        />

                        {/* Presale */}

                        <label className="flex items-center gap-1 text-xs text-slate-600 bg-emerald-50 px-2 py-1.5 rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={presales[product._id] || false}
                            onChange={() =>
                              setPresales(prev => ({
                                ...prev,
                                [product._id]: !prev[product._id]
                              }))
                            }
                            className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Presale</span>
                        </label>

                        {/* Credit */}
                        <label className="flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-1.5 rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={creditSales[product._id] || false}
                            onChange={() =>
                              setCreditSales(prev => ({
                                ...prev,
                                [product._id]: !prev[product._id]
                              }))
                            }
                            className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                          />

                          <span>Credit?</span>
                        </label>

                      </div>
                    </div>
                  </div>
                  {/* Customer / credit details only when needed */}
                  {(creditSales[product._id] || presales[product._id]) && (
                    <div className="flex gap-2 flex-wrap pt-2 border-t border-slate-100">
                      <span className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-xs text-slate-500">
                          Deposit:
                        </span>
                        <input
                          type="number"
                          min="0"
                          placeholder="Down Payment"
                          className="input-field text-xs w-24 py-1 px-2 min-w-[120px]"
                          value={downPayment[product._id] ?? ""}
                          onChange={(e) =>
                            setDownPayment(prev => ({
                              ...prev,
                              [product._id]:
                                parseInt(e.target.value, 10) || 0
                            }))
                          }
                        />
                      </span>
                    </div>
                  )}
                  <div className="flex items-right">
                    {/* Actions */}
                    <div></div>
                    <div className="flex gap-2 ml-auto">

                      <button
                        onClick={() => handleSell(product)}
                        disabled={selectableBatches.length === 0}
                        className="btn-primary text-xs py-1.5 px-3"
                      >
                        Quick Sell (KES {total})
                      </button>

                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={selectableBatches.length === 0}
                        className="btn-secondary text-xs py-1.5 px-3"
                      >
                        + Cart
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Col 2: Cart Component (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Upcoming havests */}
          {showUpcoming && (
            <div className="bg-white border border-emerald-200 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="font-bold text-emerald-800">
                  🌱 Upcoming Harvests
                </h2>

                <button
                  onClick={() => setShowUpcoming(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>

              <div className="divide-y">

                {upcomingReadyBatches.length === 0 ? (

                  <div className="p-4 text-sm text-slate-500">
                    No batches becoming ready soon.
                  </div>

                ) : (

                  upcomingReadyBatches.map((batch, index) => (

                    <div
                      key={batch._id}
                      className="flex justify-between items-center px-4 py-3"
                    >

                      <div className="text-sm">
                        <span className="font-medium"> {index + 1}. {batch.cropName}</span>  <span>in {getBatchDisplayName(batch)} will be ready

                          {batch.daysRemaining === 0
                            ? " Today"
                            : batch.daysRemaining === 1
                              ? " Tomorrow"
                              : `in ${batch.daysRemaining} days`}
                        </span>
                      </div>
                    </div>

                  ))

                )}

              </div>
            </div>
          )}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <Cart
              cart={cart}
              onUpdateQty={handleCartUpdateQty}
              onUpdatePrice={handleCartUpdatePrice}
              onRemoveItem={handleCartRemoveItem}
              onClearCart={handleCartClear}
              onMakeSale={handleCartSale}
              customers={customers}
            />
          </div>

          {/* Outstanding Credits Summary */}
          {customerCredits.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl shadow-sm space-y-3">
              <h2 className="text-base font-bold text-amber-900 flex items-center justify-between">
                <span>📋 Customer Debts</span>
                <span className="badge-warning">KES {grandCreditTotal.toLocaleString()}</span>
              </h2>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {customerCredits.map(customer => (
                  <div key={customer.name} className="bg-white border border-amber-200 rounded-xl p-3 text-xs space-y-1">
                    <div className="font-bold text-slate-900 flex justify-between">
                      <span>{customer.name}</span>
                      <div className="text-xs text-slate-500">
                        <span className="text-gray-500">Date: {new Date(customer.date).toLocaleDateString() || "N/A"}</span>
                      </div>
                    </div>
                    {customer.entries.map((e, i) => (
                      <div key={i} className="text-slate-500">
                        {e.label}: KES {e.owed}
                      </div>
                    ))}
                    <hr/>
                    <div className="flex justify-between pt-2 text-rose-600 font-bold"><span className="pr-4">Total Owed:</span> <span>KES {customer.totalOwed}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

