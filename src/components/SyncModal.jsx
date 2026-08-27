import React, { useState, useEffect } from "react";
import {
  getStoredSyncConfig,
  saveSyncConfig,
  subscribeSyncStatus,
  testConnection,
  startSync,
} from "../utils/syncService";
import { showToast } from "../utils/toast";

export default function SyncModal({ isOpen, onClose }) {
  const [url, setUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [statusObj, setStatusObj] = useState({
    status: "idle",
    lastSyncTime: null,
    errorMessage: "",
  });
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const config = getStoredSyncConfig();
    setUrl(config.url);
    setEnabled(config.enabled);
  }, [isOpen]);

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus(setStatusObj);
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  const handleSave = () => {
    saveSyncConfig(url, enabled);
    showToast(
      enabled
        ? "Multi-device online sync enabled!"
        : "Online sync disabled"
    );
    onClose();
  };

  const handleTest = async () => {
    if (!url.trim()) {
      showToast("Please enter a remote server URL first.");
      return;
    }
    setTesting(true);
    try {
      const info = await testConnection(url);
      showToast(`Connection Successful! Server database: ${info.db_name || "Online DB"}`);
    } catch (e) {
      showToast(`Connection Failed: ${e.message}`);
    } finally {
      setTesting(false);
    }
  };

  const renderBadge = () => {
    switch (statusObj.status) {
      case "online":
        return (
          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Online & Connected
          </span>
        );
      case "syncing":
        return (
          <span className="bg-blue-100 text-blue-800 border border-blue-300 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-spin" />
            Syncing Data...
          </span>
        );
      case "offline":
        return (
          <span className="bg-amber-100 text-amber-800 border border-amber-300 text-xs px-2.5 py-1 rounded-full font-bold">
            ⚪ Offline (Retrying)
          </span>
        );
      case "error":
        return (
          <span className="bg-rose-100 text-rose-800 border border-rose-300 text-xs px-2.5 py-1 rounded-full font-bold">
            ⚠️ Connection Error
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-600 border border-slate-200 text-xs px-2.5 py-1 rounded-full font-bold">
            Sync Idle
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <span>📡 Multi-Device Online Sync</span>
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold p-1 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-xs font-bold text-slate-700">Sync Health</span>
            {renderBadge()}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Online Sync Server URL
            </label>
            <input
              type="url"
              className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. https://Imara-pos-sync.onrender.com/db"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Enter your remote Express Node.js or PouchDB server URL.
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-3 rounded-xl border border-slate-100">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <div>
              <div className="text-xs font-bold text-slate-900">Enable Live 2-Way Sync</div>
              <div className="text-[11px] text-slate-500">
                Automatically sync sales and stock across all devices in real-time.
              </div>
            </div>
          </label>

          {statusObj.lastSyncTime && (
            <div className="text-[11px] text-slate-400 text-center">
              Last synced: {new Date(statusObj.lastSyncTime).toLocaleString()}
            </div>
          )}

          {statusObj.errorMessage && (
            <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              {statusObj.errorMessage}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-3 rounded-xl transition-colors"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-colors shadow-2xs"
            >
              Save & Apply Sync
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
