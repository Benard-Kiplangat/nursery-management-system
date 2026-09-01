const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const express = require("express");
const backupService = require("./backupService");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const cors = require("cors");

const { createSqliteDbService } = require("./sqliteDb");

// -------------------------------------------------
// M-PESA DARAJA CONFIGURATION
//--------------------------------------------------

const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || "4B6aGFG9udpaAPUHxMIY6C5sYredYzQfaGwGtUy71XBT1Gmu";
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || "4csyH8ryXpzmBJO3pN6AVtawPopEyksoRIfyUD1NLdjH91bUDUCcva8wwWsGAj19";
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE || 174379;
const MPESA_PASSKEY = process.env.MPESA_PASSKEY || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL || "https://ee9f-196-96-57-134.ngrok-free.app/api/mpesa/callback";

const MPESA_BASE_URL = "https://sandbox.safaricom.co.ke";

async function getMpesaAccessToken() {
    const consumerKey = String(MPESA_CONSUMER_KEY).trim();
    const consumerSecret = String(MPESA_CONSUMER_SECRET).trim();

    const credentials = Buffer.from(
        `${consumerKey}:${consumerSecret}`,
        "utf8"
    ).toString("base64");

    const url =
        "https://sandbox.safaricom.co.ke/oauth/v1/generate" +
        "?grant_type=client_credentials";

    console.log("Daraja OAuth URL:", url);

    try {
        const response = await fetch(url, {
            method: "GET",

            headers: {
                "Authorization": `Basic ${credentials}`,
                "Accept": "application/json",
                "User-Agent": "xsfarmpos/1.0"
            }
        });

        const rawBody = await response.text();

        console.log(
            "Daraja OAuth status:",
            response.status
        );

        console.log(
            "Daraja OAuth headers:",
            Object.fromEntries(response.headers.entries())
        );

        console.log(
            "Daraja OAuth response:",
            JSON.stringify(rawBody)
        );

        if (!response.ok) {
            throw new Error(
                `Daraja OAuth failed (${response.status}): ${
                    rawBody || "Empty response"
                }`
            );
        }

        let data;

        try {
            data = JSON.parse(rawBody);
        } catch {
            throw new Error(
                `Daraja returned invalid JSON: ${rawBody}`
            );
        }

        if (!data.access_token) {
            throw new Error(
                data.errorMessage ||
                data.error_description ||
                "Daraja did not return an access token"
            );
        }

        return data.access_token;

    } catch (error) {

        console.error(
            "Daraja OAuth request error:",
            error
        );

        throw error;
    }
}

async function initiateMpesaSTK({
    phoneNumber,
    amount,
    accountReference,
    transactionDesc
}) {
    const accessToken = await getMpesaAccessToken();

    const timestamp = getMpesaTimestamp();

    const password = Buffer.from(
        `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    const response = await fetch(
        `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
        {
            method: "POST",

            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                BusinessShortCode: MPESA_SHORTCODE,
                Password: password,
                Timestamp: timestamp,
                TransactionType: "CustomerPayBillOnline",

                Amount: Math.round(Number(amount)),

                PartyA: phoneNumber,
                PartyB: MPESA_SHORTCODE,

                PhoneNumber: phoneNumber,

                CallBackURL: MPESA_CALLBACK_URL,

                AccountReference:
                    accountReference || "XSFARM",

                TransactionDesc:
                    transactionDesc || "Nursery POS payment"
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error("Daraja STK error:", data);

        throw new Error(
            data.errorMessage ||
            data.ResponseDescription ||
            "STK Push failed"
        );
    }

    return data;
}

function getMpesaTimestamp() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

// --------------------------------------------------
// Paths
// --------------------------------------------------

const documentsPath = app.getPath("documents");
const appRoot = process.env.BOSCO_APP_ROOT || path.join(documentsPath, "xsfarmpos");
const appDataPath = path.join(appRoot, "AppData");
const assetsPath = path.join(appRoot, "assets");
const backupDir = path.join(documentsPath, "Backups");

fs.mkdirSync(appRoot, { recursive: true });
fs.mkdirSync(appDataPath, { recursive: true });

app.setPath("userData", appDataPath);


// --------------------------------------------------
// SQLite
// --------------------------------------------------

const sqliteService = createSqliteDbService(appDataPath);

// --------------------------------------------------
// Express Server
// --------------------------------------------------

let expressServer;
let mainWindow;
let webUrl;

function startServer() {
    return new Promise((resolve, reject) => {

        const server = express();

        server.use(cors({
    origin: [
        "http://localhost:5003",
        "http://127.0.0.1:5003"
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

        server.use(express.json());

        server.use(express.static(appRoot));

        // ==========================================
        // M-PESA STK PUSH
        // ==========================================

        server.post("/api/mpesa/stkpush", async (req, res) => {

            try {

                const {
                    phoneNumber,
                    amount,
                    accountReference,
                    transactionDesc
                } = req.body;

                if (!phoneNumber) {
                    return res.status(400).json({
                        success: false,
                        message: "Phone number is required"
                    });
                }

                if (!amount || Number(amount) <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Valid amount is required"
                    });
                }

                console.log(
                    `Starting M-Pesa STK Push: ${phoneNumber} / KES ${amount}`
                );

                const result = await initiateMpesaSTK({
                    phoneNumber,
                    amount,
                    accountReference,
                    transactionDesc
                });

                if (result.CheckoutRequestID) {

  const payment =
    sqliteService.createMpesaPayment({
      status: "pending",

      amount: Number(amount),

      phoneNumber,

      merchantRequestId:
        result.MerchantRequestID || null,

      checkoutRequestId:
        result.CheckoutRequestID,

      transactionId: null
    });

  console.log(
    "M-PESA PAYMENT STORED:",
    payment
  );
}

                console.log(
                    "STK Push response:",
                    JSON.stringify(result, null, 2)
                );

                res.json({
                    success: true,
                    ...result
                });

            } catch (error) {

                console.error(
                    "M-Pesa STK Push failed:",
                    error
                );

                res.status(500).json({
                    success: false,
                    message: error.message
                });
            }
        });

server.get("/api/mpesa/stk-test", async (req, res) => {
  try {
    console.log("\n========== M-PESA STK TEST ==========");

    const phoneNumber = "254708374149";
    const amount = 10;

    const result = await initiateMpesaSTK({
      phoneNumber,
      amount,
      accountReference: "TEST-001",
      transactionDesc: "XS Farm POS test"
    });

    console.log(
      "STK TEST RESULT:",
      JSON.stringify(result, null, 2)
    );

    // ------------------------------------------
    // Make sure Daraja returned a CheckoutRequestID
    // ------------------------------------------

    if (!result.CheckoutRequestID) {
      console.error(
        "No CheckoutRequestID returned by Daraja."
      );

      return res.status(500).json({
        success: false,
        message:
          "STK Push succeeded but no CheckoutRequestID was returned.",
        result
      });
    }

    // ------------------------------------------
    // Persist the pending payment in SQLite
    // ------------------------------------------

    const payment =
      sqliteService.createMpesaPayment({
        status: "pending",

        amount,

        phoneNumber,

        merchantRequestId:
          result.MerchantRequestID || null,

        checkoutRequestId:
          result.CheckoutRequestID,

        transactionId: null,

        source: "stk"
      });

    console.log(
      "M-PESA PAYMENT SAVED TO SQLITE:"
    );

    console.log(
      JSON.stringify(payment, null, 2)
    );

    // ------------------------------------------
    // Verify that we can immediately read it
    // ------------------------------------------

    const savedPayment =
      sqliteService.getMpesaPayment(
        result.CheckoutRequestID
      );

    console.log(
      "M-PESA PAYMENT READ BACK FROM SQLITE:"
    );

    console.log(
      JSON.stringify(savedPayment, null, 2)
    );

    console.log(
      "====================================\n"
    );

    res.json({
      success: true,

      message:
        "STK Push initiated and payment persisted.",

      checkoutRequestId:
        result.CheckoutRequestID,

      merchantRequestId:
        result.MerchantRequestID,

      payment: savedPayment
    });

  } catch (error) {

    console.error(
      "STK TEST ERROR:",
      error
    );

    console.log(
      "====================================\n"
    );

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

server.get("/api/mpesa/auth-test", async (req, res) => {
    console.log("\n========== DARAJA AUTH TEST ==========");

    console.log("Consumer Key present:", !!MPESA_CONSUMER_KEY);
    console.log("Consumer Secret present:", !!MPESA_CONSUMER_SECRET);
    console.log("Shortcode present:", !!MPESA_SHORTCODE);
    console.log("Passkey present:", !!MPESA_PASSKEY);

    try {
        const token = await getMpesaAccessToken();

        console.log("Token received:", !!token);

        return res.status(200).json({
            success: true,
            message: "Daraja authentication successful",
            tokenReceived: !!token
        });

    } catch (error) {

        console.error("AUTH TEST ERROR:", error);

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

        // ==========================================
        // M-PESA CALLBACK
        // ==========================================

        server.post("/api/mpesa/callback", (req, res) => {

    console.log(
        "\n========== M-PESA CALLBACK =========="
    );

    console.log(
        JSON.stringify(req.body, null, 2)
    );

    try {
        const callback =
            req.body?.Body?.stkCallback;

        if (!callback) {
            console.warn(
                "Invalid M-PESA callback structure"
            );

            return res.json({
                ResultCode: 0,
                ResultDesc: "Accepted"
            });
        }

        const {
            MerchantRequestID,
            CheckoutRequestID,
            ResultCode,
            ResultDesc,
            CallbackMetadata
        } = callback;

        let payment;

try {
  payment =
    sqliteService.getMpesaPayment(
      CheckoutRequestID
    );
} catch (error) {

  if (error.status === 404) {

    console.warn(
      "M-PESA payment not found:",
      CheckoutRequestID
    );

    return res.json({
      ResultCode: 0,
      ResultDesc: "Accepted"
    });
  }

  throw error;
}

        // Payment successful
       if (Number(ResultCode) === 0) {

  const metadata =
    CallbackMetadata?.Item || [];

  const getMetadata = (name) =>
    metadata.find(
      item => item.Name === name
    )?.Value;

  const transactionId =
    getMetadata("MpesaReceiptNumber");

  const amount =
    getMetadata("Amount");

  const transactionDate =
    getMetadata("TransactionDate");

  const phoneNumber =
    getMetadata("PhoneNumber");

  const updatedPayment =
    sqliteService.updateMpesaPayment(
      CheckoutRequestID,
      {
        status: "completed",

        transactionId:
          transactionId || null,

        amount:
          amount ?? payment.amount,

        phoneNumber:
          phoneNumber || payment.phoneNumber,

        transactionDate:
          transactionDate || null,

        resultCode:
          Number(ResultCode),

        resultDesc:
          ResultDesc,

        merchantRequestId:
          MerchantRequestID
      }
    );

  console.log(
    "M-PESA PAYMENT COMPLETED:",
    updatedPayment
  );

        } else {

  const updatedPayment =
    sqliteService.updateMpesaPayment(
      CheckoutRequestID,
      {
        status: "failed",
        
        source: "stk",

        resultCode:
          Number(ResultCode),

        resultDesc:
          ResultDesc,

        merchantRequestId:
          MerchantRequestID
      }
    );

  console.log(
    "M-PESA PAYMENT FAILED:",
    updatedPayment
  );
}

    } catch (error) {

        console.error(
            "Error processing M-PESA callback:",
            error
        );
    }

    console.log(
        "====================================\n"
    );

    // Always acknowledge the callback
    res.json({
        ResultCode: 0,
        ResultDesc: "Accepted"
    });
});


        // ==========================================
        // M-PESA TEST
        // ==========================================

        server.get("/api/mpesa/test", (req, res) => {

            res.json({
                success: true,
                message: "M-Pesa API is running",
                sandbox: true
            });

        });

server.get(
  "/api/mpesa/status/:checkoutRequestId",
  (req, res) => {

    const {
      checkoutRequestId
    } = req.params;

    try {

      const payment =
        sqliteService.getMpesaPayment(
          checkoutRequestId
        );

      res.json({
        success: true,
        payment
      });

    } catch (error) {

      if (error.status === 404) {
        return res.status(404).json({
          success: false,
          message: "M-PESA payment not found"
        });
      }

      console.error(
        "M-PESA status error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Failed to retrieve M-PESA payment"
      });
    }
  }
);


        // ==========================================
        // START SERVER
        // ==========================================

        expressServer = server.listen(
            8080,
            "127.0.0.1",
            () => {

                webUrl = "http://127.0.0.1:8080";

                console.log(
                    "Server started:",
                    webUrl
                );

                console.log(
                    "M-Pesa test:",
                    `${webUrl}/api/mpesa/test`
                );

                resolve();

            }
        );

        expressServer.on("error", reject);
    });
}

// --------------------------------------------------
// Browser Window
// --------------------------------------------------

function createWindow() {

    mainWindow = new BrowserWindow({

        width: 1400,
        height: 900,
        autoHideMenuBar: true,
        icon: path.join(assetsPath, "icon.ico"),
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false
        }

    });

    mainWindow.webContents.on(
        "did-fail-load",
        (_, errorCode, errorDescription) => {

            console.error(
                "Failed to load:",
                errorCode,
                errorDescription
            );

        }
    );

    mainWindow.loadURL(webUrl);

}

// --------------------------------------------------
// Hard Refresh
// --------------------------------------------------

async function hardRefreshApp() {

    if (!mainWindow || mainWindow.isDestroyed()) {
        console.log("Cannot refresh: main window does not exist.");
        return;
    }

    try {

        const session = mainWindow.webContents.session;

        await session.clearStorageData({
            storages: [
                "serviceworkers",
                "cachestorage"
            ]
        });

        await session.clearCache();

        mainWindow.webContents.reloadIgnoringCache();

    } catch (err) {

        console.error("Hard refresh failed:", err);

        mainWindow.webContents.reload();

    }
}

// --------------------------------------------------
// Electron Startup
// --------------------------------------------------

app.whenReady().then(async () => {

    try {

        if (!checkAppFiles()) {

            const errorWindow = new BrowserWindow({

                width: 700,
                height: 450,
                autoHideMenuBar: true,
                icon: path.join(assetsPath, "icon.ico")

            });

            errorWindow.loadURL(
                "data:text/html," +
                encodeURIComponent(`
        <html>
        <body style="
            font-family:Segoe UI;
            padding:40px;
            background:#fafafa;
        ">
            <h2>POS files not found</h2>

            <p>
                Expected to find:
            </p>

            <pre>${indexFile}</pre>

            <p>
                Copy your POS website into the
                <strong>Documents\\xsfarmpos</strong>
                folder.
            </p>

        </body>
        </html>
        `)
            );

            return;

        }

        await startServer();

        createWindow();

        //--------------------------------------------------------
        // Automated file backup
        //--------------------------------------------------------

        setInterval(() => {
            backupService.hourlyCheck(sqliteService.sqlite, backupDir);
        }, 60 * 1000); // check every minute

    } catch (err) {

        console.error(err);

        app.quit();

    }

    app.on("activate", () => {

        if (BrowserWindow.getAllWindows().length === 0)
            createWindow();

    });

});

app.on("before-quit", async () => {

    if (expressServer) {
        expressServer.close();
    }

    await backupService.performBackup(sqliteService.sqlite, backupDir);

});

app.on("window-all-closed", async () => {
    
    await backupService.performBackup(sqliteService.sqlite, backupDir);

    if (process.platform !== "darwin")
        app.quit();

});

// --------------------------------------------------
// Ensure the POS files exist
// --------------------------------------------------

const indexFile = path.join(appRoot, "index.html");

function checkAppFiles() {

    if (!fs.existsSync(indexFile)) {

        console.error("index.html not found.");
        console.error("Expected:", indexFile);

        return false;

    }

    return true;

}

// --------------------------------------------------
// IPC - SQLite
// --------------------------------------------------

ipcMain.handle("bosco:db:allDocs", async (_event, options = {}) => {
    return sqliteService.allDocs(options);
});

ipcMain.handle("bosco:db:get", async (_event, id, options = {}) => {
    return sqliteService.get(id, options);
});

ipcMain.handle("bosco:db:put", async (_event, doc) => {
    return sqliteService.put(doc);
});

ipcMain.handle("bosco:db:remove", async (_event, doc) => {
    return sqliteService.remove(doc);
});

ipcMain.handle("bosco:db:destroy", async () => {
    return sqliteService.destroy();
});

ipcMain.handle("bosco:db:resetDb", async () => {
    return sqliteService.resetDb();
});

ipcMain.handle("bosco:app:hardRefresh", async () => {
    await hardRefreshApp();
    return true;
});

ipcMain.handle("bosco:backup:create", async () => {
    await backupService.performBackup(
        sqliteService.sqlite,
        backupDir
    );

    return true;
});

ipcMain.handle("bosco:backup:restore", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: "Select Backup",
        properties: ["openFile"],
        filters: [
            {
                name: "SQLite Backup",
                extensions: ["sqlite", "db"]
            }
        ]
    });

    if (result.canceled || !result.filePaths.length) {
        return { canceled: true };
    }

    const backupPath = result.filePaths[0];

    console.log("Restoring from:", backupPath);

    const mergeResult = sqliteService.mergeBackup(backupPath);

    return {
        canceled: false,
        ...mergeResult
    };
});