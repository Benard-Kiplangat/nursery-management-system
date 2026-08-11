import React, { useRef, useState } from "react";
import { db } from "../db";

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const getDocTimestamp = (doc) => {

    const candidates = [
        "updatedAt",
        "timestamp",
        "createdAt",
        "modifiedAt",
        "lastModified"
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
    !!doc &&
    typeof doc === "object" &&
    typeof doc._id === "string";

const sanitizeBackupDoc = (doc) => {

    const nextDoc = { ...doc };

    delete nextDoc._rev;

    return nextDoc;

};

export default function SyncButton() {

    const fileInputRef = useRef(null);

    const [importProgress, setImportProgress] = useState(0);

    const [importMessage, setImportMessage] = useState("");

    const formatProgress = (value) =>
        Math.max(
            0,
            Math.min(
                100,
                Math.round(value)
            )
        );

    // --------------------------------------------------
    // EXPORT
    // --------------------------------------------------

    const handleBackupDB = async () => {
    try {
        await window.electronAPI.createBackup();

        alert("Backup created successfully.");
    } catch (err) {
        console.error("Backup failed:", err);
        alert(`Backup failed: ${err.message}`);
    }
};


    const handleBackup = async () => {

        const all = await db.allDocs({
            include_docs: false
        });

        const docs = await Promise.all(

            all.rows.map((row) =>
                db.get(row.id, {
                    attachments: true
                }).catch(() => null)
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

            summary: {

                total: filteredDocs.length,

                byType: counts

            },

            docs: filteredDocs

        };

        const blob = new Blob(

            [
                JSON.stringify(
                    payload,
                    null,
                    2
                )
            ],

            {
                type: "application/json"
            }

        );

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");

        a.href = url;

        a.download =
            `zippos-export-${new Date().toISOString()}.json`;

        a.click();

        URL.revokeObjectURL(url);

    };

// --------------------------------------------------
// IMPORT
// --------------------------------------------------

const handleRestoreDB = async () => {
    try {
        const result = await window.electronAPI.restoreBackup();

        if (result.canceled) {
            return;
        }

        alert(
            `Import complete.\n\n` +
            `Added: ${result.inserted}\n` +
            `Updated: ${result.updated}\n` +
            `Skipped: ${result.skipped}`
        );

        window.location.reload();

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

        }
        catch {

            alert(
                "Invalid JSON file. Please select a valid export."
            );

            return;

        }

        const docs =
            Array.isArray(payload)
                ? payload
                : payload.docs;

        if (!Array.isArray(docs)) {

            alert(
                "This file does not appear to be a valid backup."
            );

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

            setImportMessage(
                "Reading backup..."
            );

            const validDocs =
                docs.filter(isValidBackupDoc);

            if (!validDocs.length) {

                alert(
                    "No valid documents found."
                );

                return;

            }

            const currentDocs =
                await db.allDocs({

                    include_docs: true,

                    attachments: true

                });

            const currentById =
                new Map(

                    currentDocs.rows

                        .filter(r => r.doc)

                        .map(r => [

                            r.id,

                            r.doc

                        ])

                );

            const docsToImport = [];

            let skippedCount = 0;

            for (

                const [index, doc]

                of validDocs.entries()

            ) {

                const currentDoc =
                    currentById.get(doc._id);

                const incomingTimestamp =
                    getDocTimestamp(doc);

                const currentTimestamp =
                    getDocTimestamp(currentDoc);

                const localIsNewer =

                    currentDoc &&

                    incomingTimestamp !== null &&

                    currentTimestamp !== null &&

                    currentTimestamp > incomingTimestamp;

                if (localIsNewer) {

                    skippedCount++;

                }
                else {

                    const nextDoc =
                        sanitizeBackupDoc(doc);

                    if (currentDoc) {

                        nextDoc._rev =
                            currentDoc._rev;

                    }

                    docsToImport.push(nextDoc);

                }

                if (

                    index % 20 === 0 ||

                    index === validDocs.length - 1

                ) {

                    setImportProgress(

                        formatProgress(

                            ((index + 1) /

                                validDocs.length) *

                                50

                        )

                    );

                    setImportMessage(

                        `Scanning ${index + 1} of ${validDocs.length}...`

                    );

                }

            }

            setImportMessage(

                `Importing ${docsToImport.length} documents...`

            );

            const results =
                await db.bulkDocs(docsToImport);

            let appliedCount = 0;

            let failedCount = 0;

            results.forEach((result, index) => {

                if (result.error) {

                    failedCount++;

                    console.error(

                        "Import failed:",

                        docsToImport[index]._id,

                        result

                    );

                }
                else {

                    appliedCount++;

                }

                if (

                    index % 20 === 0 ||

                    index === results.length - 1

                ) {

                    setImportProgress(

                        50 +

                        formatProgress(

                            ((index + 1) /

                                results.length) *

                                50

                        )

                    );

                }

            });

            setImportProgress(100);

            setImportMessage(

                `Import complete. Applied ${appliedCount}, skipped ${skippedCount}, failed ${failedCount}.`

            );

            window.dispatchEvent(

                new CustomEvent("bosco:db-changed")

            );

            alert(

                `Import complete.\n\n` +

                `Applied: ${appliedCount}\n` +

                `Skipped: ${skippedCount}\n` +

                `Failed: ${failedCount}`

            );

        }
        catch (err) {

            console.error(err);

            setImportMessage(

                "Import failed."

            );

            alert(

                "Import failed. Check the console."

            );

        }
        finally {

            if (fileInputRef.current) {

                fileInputRef.current.value = "";

            }

        }

    };

    reader.readAsText(file);

};

    return (

        <>
            <button
                onClick={handleBackupDB}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
                Export DB
            </button>

            <button
                onClick={handleRestoreDB}
                className="ml-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
                Import DB
            </button>
            
            <div>
            <button
                onClick={handleBackup}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
                File Export
            </button>

            <button
                onClick={() => fileInputRef.current?.click()}
                className="ml-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
                File Import
            </button>

            <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                hidden
                onChange={handleRestore}
            />
            </div>

            {(importMessage || importProgress > 0) && (

                <div className="mt-4">

                    <div className="w-full bg-gray-200 rounded h-4 overflow-hidden">

                        <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{
                                width: `${importProgress}%`
                            }}
                        />

                    </div>

                    <div className="mt-2 text-sm text-gray-700">

                        {importMessage || "Ready"}

                    </div>

                </div>

            )}

        </>

    );

}