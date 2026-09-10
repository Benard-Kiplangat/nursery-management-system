import React, { useRef, useState, useEffect } from "react";
import { db } from "../db";
import SyncModal from "./SyncModal";
import { subscribeSyncStatus } from "../utils/syncService";

// Helpers
// --------------------------------------------------

const getDocTimestamp = (doc) => {
  const candidates = [
    "updatedAt",
    "timestamp",
    "createdAt",
    "modifiedAt",
    "lastModified",
  ];

  for (const key of candidates) {
    const value = doc?.[key];
    if (!value) continue;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
};

const isValidBackupDoc = (doc) =>
  !!doc && typeof doc === "object" && typeof doc._id === "string";

const sanitizeBackupDoc = (doc) => {
  const nextDoc = { ...doc };
  delete nextDoc._rev;
  return nextDoc;
};

export default function SyncButton() {
  const fileInputRef = useRef(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importMessage, setImportMessage] = useState("");
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ status: "idle" });

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus(setSyncStatus);
    return () => unsubscribe();
  }, []);

  const formatProgress = (value) =>
    Math.max(0, Math.min(100, Math.round(value)));

  // EXPORT / RESTORE ELECTRON DB
  const handleBackupDB = async () => {
    try {
      if (window.electronAPI?.createBackup) {
        await window.electronAPI.createBackup();
        alert("Backup created successfully.");
      } else {
        handleBackup();
      }
    } catch (err) {
      console.error("Backup failed:", err);
      alert(`Backup failed: ${err.message}`);
    }
  };

  const handleBackup = async () => {
    const all = await db.allDocs({ include_docs: false });
    const docs = await Promise.all(
      all.rows.map((row) =>
        db.get(row.id, { attachments: true }).catch(() => null)
      )
    );

    const filteredDocs = docs.filter(Boolean);
    const counts = filteredDocs.reduce((acc, doc) => {
      const type = doc.type || "unknown";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const payload = {
      exportedAt: new Date().toISOString(),
      version: 5,
      summary: { total: filteredDocs.length, byType: counts },
      docs: filteredDocs,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zippos-export-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreDB = async () => {
    try {
      if (window.electronAPI?.restoreBackup) {
        const result = await window.electronAPI.restoreBackup();
        if (result.canceled) return;
        alert(
          `Import complete.\n\nAdded: ${result.inserted}\nUpdated: ${result.updated}\nSkipped: ${result.skipped}`
        );
        window.location.reload();
      } else {
        fileInputRef.current?.click();
      }
    } catch (err) {
      console.error("Restore failed:", err);
      alert(`Restore failed: ${err.message}`);
    }
  };

  const handleRestore = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      let payload;
      try {
        payload = JSON.parse(e.target.result);
      } catch {
        alert("Invalid JSON file. Please select a valid export.");
        return;
      }

      const docs = Array.isArray(payload) ? payload : payload.docs;
      if (!Array.isArray(docs)) {
        alert("This file does not appear to be a valid backup.");
        return;
      }

      if (
        !window.confirm(
          "Import will merge this backup with your current data.\n\nNewer local records will be kept.\n\nContinue?"
        )
      ) {
        return;
      }

      try {
        setImportProgress(0);
        setImportMessage("Reading backup...");
        const validDocs = docs.filter(isValidBackupDoc);
        if (!validDocs.length) {
          alert("No valid documents found.");
          return;
        }

        const currentDocs = await db.allDocs({
          include_docs: true,
          attachments: true,
        });

        const currentById = new Map(
          currentDocs.rows.filter((r) => r.doc).map((r) => [r.id, r.doc])
        );

        const docsToImport = [];
        let skippedCount = 0;

        for (const [index, doc] of validDocs.entries()) {
          const currentDoc = currentById.get(doc._id);
          const incomingTimestamp = getDocTimestamp(doc);
          const currentTimestamp = getDocTimestamp(currentDoc);

          const localIsNewer =
            currentDoc &&
            incomingTimestamp !== null &&
            currentTimestamp !== null &&
            currentTimestamp > incomingTimestamp;

          if (localIsNewer) {
            skippedCount++;
          } else {
            const nextDoc = sanitizeBackupDoc(doc);
            if (currentDoc) nextDoc._rev = currentDoc._rev;
            docsToImport.push(nextDoc);
          }

          if (index % 20 === 0 || index === validDocs.length - 1) {
            setImportProgress(
              formatProgress(((index + 1) / validDocs.length) * 50)
            );
            setImportMessage(`Scanning ${index + 1} of ${validDocs.length}...`);
          }
        }

        setImportMessage(`Importing ${docsToImport.length} documents...`);

        let appliedCount = 0;
        let failedCount = 0;

        if (docsToImport.length > 0) {
          for (let index = 0; index < docsToImport.length; index++) {
            const doc = docsToImport[index];

            try {
              await db.put(doc);
              appliedCount++;
            } catch (err) {
              failedCount++;

              console.error(
                "Import failed:",
                doc._id,
                err
              );
            }

            if (
              index % 20 === 0 ||
              index === docsToImport.length - 1
            ) {
              setImportProgress(
                50 + ((index + 1) / docsToImport.length) * 50
              );
            }
          }
        }

        setImportProgress(100);
        setImportMessage(
          `Import complete. Applied ${appliedCount}, skipped ${skippedCount}, failed ${failedCount}.`
        );

        window.dispatchEvent(new CustomEvent("bosco:db-changed"));
        alert(
          `Import complete.\n\nApplied: ${appliedCount}\nSkipped: ${skippedCount}\nFailed: ${failedCount}`
        );
      } catch (err) {
        console.error(err);
        setImportMessage("Import failed.");
        alert("Import failed. Check the console.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsText(file);
  };

  const getStatusLabel = () => {
    switch (syncStatus.status) {
      case "online":
        return "📡 Online Sync";
      case "syncing":
        return "🔄 Syncing...";
      case "offline":
        return "⚪ Offline Sync";
      case "error":
        return "⚠️ Sync Error";
      default:
        return "📡 Online Sync";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">

      {/* Online Sync Button */}
      <button
        type="button"
        onClick={() => setIsSyncModalOpen(true)}
        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border shadow-2xs flex items-center gap-1.5 ${syncStatus.status === "online"
          ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
          : syncStatus.status === "syncing"
            ? "bg-blue-50 border-blue-300 text-blue-800 hover:bg-blue-100"
            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
          }`}
      >
        {getStatusLabel()}
      </button>

      {/* Export / Restore File Buttons */}
      <button
        onClick={handleBackupDB}
        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors"
      >
        Create Backup
      </button>

      <button
        onClick={handleRestoreDB}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors"
      >
        Restore Backup
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        hidden
        onChange={handleRestore}
      />

      {/* Sync Configuration Modal */}
      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
      />

      {(importMessage || importProgress > 0) && (
        <div className="w-full mt-2">
          <div className="w-full bg-slate-200 rounded-lg h-3 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${importProgress}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-slate-600">
            {importMessage || "Ready"}
          </div>
        </div>
      )}
    </div>
  );
}