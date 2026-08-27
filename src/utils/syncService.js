import PouchDB from "pouchdb-browser";
import { db } from "../db";

const SYNC_URL_KEY = "bosco_remote_sync_url";
const SYNC_ENABLED_KEY = "bosco_remote_sync_enabled";

let syncHandler = null;
let statusListeners = new Set();
let currentStatus = {
  status: "idle", // 'idle' | 'syncing' | 'online' | 'offline' | 'error'
  lastSyncTime: null,
  errorMessage: "",
};

export function getStoredSyncConfig() {
  try {
    const url = localStorage.getItem(SYNC_URL_KEY) || "";
    const enabled = localStorage.getItem(SYNC_ENABLED_KEY) === "true";
    return { url, enabled };
  } catch {
    return { url: "", enabled: false };
  }
}

export function saveSyncConfig(url, enabled) {
  try {
    localStorage.setItem(SYNC_URL_KEY, url.trim());
    localStorage.setItem(SYNC_ENABLED_KEY, enabled ? "true" : "false");
  } catch (e) {
    console.error("Failed to save sync config", e);
  }

  // Restart sync with new config
  if (enabled && url.trim()) {
    startSync(url.trim());
  } else {
    stopSync();
  }
}

function updateStatus(newStatusObj) {
  currentStatus = { ...currentStatus, ...newStatusObj };
  statusListeners.forEach((listener) => listener(currentStatus));
}

export function subscribeSyncStatus(listener) {
  statusListeners.add(listener);
  listener(currentStatus);
  return () => statusListeners.delete(listener);
}

export function stopSync() {
  if (syncHandler) {
    syncHandler.cancel();
    syncHandler = null;
  }
  updateStatus({ status: "idle", errorMessage: "" });
}

export function startSync(remoteUrlOverride) {
  stopSync();

  const { url, enabled } = getStoredSyncConfig();
  const targetUrl = (remoteUrlOverride || url || "").trim();

  if (!targetUrl) {
    updateStatus({ status: "idle", errorMessage: "No remote server URL configured." });
    return;
  }

  try {
    const remoteDb = new PouchDB(targetUrl, {
      skip_setup: false,
    });

    updateStatus({ status: "syncing", errorMessage: "" });

    syncHandler = PouchDB.sync(db, remoteDb, {
      live: true,
      retry: true,
      back_off_function: (delay) => (delay === 0 ? 1000 : Math.min(delay * 2, 60000)),
    })
      .on("change", (info) => {
        updateStatus({
          status: "online",
          lastSyncTime: new Date().toISOString(),
          errorMessage: "",
        });
        // Dispatch global db-changed event to trigger page refreshes
        window.dispatchEvent(new CustomEvent("bosco:db-changed"));
      })
      .on("paused", (err) => {
        if (err) {
          console.warn("Sync paused with warning:", err);
          updateStatus({
            status: "offline",
            errorMessage: "Connection paused. Retrying...",
          });
        } else {
          updateStatus({
            status: "online",
            lastSyncTime: new Date().toISOString(),
            errorMessage: "",
          });
        }
      })
      .on("active", () => {
        updateStatus({ status: "syncing", errorMessage: "" });
      })
      .on("denied", (err) => {
        console.error("Sync denied:", err);
        updateStatus({
          status: "error",
          errorMessage: "Access denied by remote server.",
        });
      })
      .on("error", (err) => {
        console.error("Sync error:", err);
        updateStatus({
          status: "error",
          errorMessage: err.message || "Failed to connect to remote sync server.",
        });
      });
  } catch (err) {
    console.error("Failed to initialize sync:", err);
    updateStatus({
      status: "error",
      errorMessage: err.message || "Invalid remote URL format.",
    });
  }
}

export async function testConnection(remoteUrl) {
  const target = remoteUrl.trim();
  if (!target) throw new Error("Please enter a valid remote server URL.");

  const tempDb = new PouchDB(target);
  try {
    const info = await tempDb.info();
    return info;
  } catch (err) {
    throw new Error(err.message || "Unable to reach remote server.");
  }
}

// Auto-start sync on load if enabled
const initialConfig = getStoredSyncConfig();
if (initialConfig.enabled && initialConfig.url) {
  startSync(initialConfig.url);
}
