const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const express = require("express");
const backupService = require("./backupService");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const { createSqliteDbService } = require("./sqliteDb");

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
        "http://127.0.0.1:5003",
        "https://yelivate.top"
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

        server.use(express.json());

        server.use(express.static(appRoot));

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

// --------------------------------------------------
// IPC - SQLite: Legacy document API
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


// --------------------------------------------------
// IPC - SQLite: Products
// --------------------------------------------------

ipcMain.handle("bosco:products:getAll", async (_event, options = {}) => {
    return sqliteService.getProducts(options);
});

ipcMain.handle("bosco:products:get", async (_event, id) => {
    return sqliteService.getProduct(id);
});

ipcMain.handle("bosco:products:save", async (_event, product) => {
    return sqliteService.saveProduct(product);
});


// --------------------------------------------------
// IPC - SQLite: Batches
// --------------------------------------------------

ipcMain.handle("bosco:batches:getAll", async (_event, options = {}) => {
    return sqliteService.getBatches(options);
});

ipcMain.handle("bosco:batches:get", async (_event, id) => {
    return sqliteService.getBatchesById(id);
});

ipcMain.handle("bosco:batches:save", async (_event, batch) => {
    return sqliteService.saveBatch(batch);
});

ipcMain.handle(
    "bosco:batches:updateQuantity",
    async (_event, batchId, quantityRemaining) => {
        return sqliteService.updateBatchQuantity(
            batchId,
            quantityRemaining
        );
    }
);

ipcMain.handle(
    "bosco:batches:deduct",
    async (_event, batchId, quantity) => {
        return sqliteService.deductFromBatch(
            batchId,
            quantity
        );
    }
);


// --------------------------------------------------
// IPC - SQLite: Customers
// --------------------------------------------------

ipcMain.handle("bosco:customers:getAll", async () => {
    return sqliteService.getCustomers();
});

ipcMain.handle("bosco:customers:save", async (_event, customer) => {
    return sqliteService.saveCustomer(customer);
});


// --------------------------------------------------
// IPC - SQLite: Sales / Presales
// --------------------------------------------------

ipcMain.handle(
    "bosco:sales:getAll",
    async (_event, options = {}) => {
        return sqliteService.getSales(options);
    }
);

ipcMain.handle(
    "bosco:sales:create",
    async (_event, sale) => {
        return sqliteService.createSale(sale);
    }
);

ipcMain.handle(
    "bosco:sales:addPayment",
    async (_event, payment) => {
        return sqliteService.addPayment(payment);
    }
);

ipcMain.handle(
    "bosco:sales:updateDownPayment",
    async (_event, data) => {
        return sqliteService.updateSaleDownPayment(data);
    }
);

ipcMain.handle(
    "bosco:presales:complete",
    async (_event, data) => {
        return sqliteService.completePresale(data);
    }
);


// --------------------------------------------------
// IPC - SQLite: Purchases
// --------------------------------------------------

ipcMain.handle(
    "bosco:purchases:getAll",
    async (_event, options = {}) => {
        return sqliteService.getPurchases(options);
    }
);


// --------------------------------------------------
// IPC - SQLite: Expenses
// --------------------------------------------------

ipcMain.handle(
    "bosco:expenses:getAll",
    async (_event, options = {}) => {
        return sqliteService.getExpenses(options);
    }
);


// --------------------------------------------------
// IPC - SQLite: Cash
// --------------------------------------------------

ipcMain.handle(
    "bosco:cash:getSummary",
    async (_event, options = {}) => {
        return sqliteService.getCashSummary(options);
    }
);


// --------------------------------------------------
// IPC - SQLite: Migration
// --------------------------------------------------

ipcMain.handle(
  "bosco:db:migrateLegacy",
  async (_event, legacyDbPath) => {
    return sqliteService.migrateLegacyDatabase(
      legacyDbPath
    );
  }
);


// --------------------------------------------------
// IPC - SQLite: Database management
// --------------------------------------------------

ipcMain.handle("bosco:db:destroy", async () => {
    return sqliteService.destroy();
});

ipcMain.handle("bosco:db:resetDb", async () => {
    return sqliteService.resetDb();
});


// --------------------------------------------------
// IPC - App
// --------------------------------------------------

ipcMain.handle("bosco:app:hardRefresh", async () => {
    await hardRefreshApp();
    return true;
});


// --------------------------------------------------
// IPC - Backup
// --------------------------------------------------

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