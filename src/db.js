import PouchDB from "pouchdb-browser";

export const db = new PouchDB("posdb");

// ---- Batches ----
// A batch represents one planting of a crop (e.g. "300 Tomatoes planted Aug 1").
// It becomes sellable once its expectedReadyDate has passed, or earlier if a
// staff member marks it ready manually.

export async function getBatches() {
  const result = await db.allDocs({ include_docs: true });
  return result.rows.map(row => row.doc).filter(doc => doc && doc.type === "batch");
}

export async function addBatch({ crop, quantityPlanted, datePlanted, customBatchName }) {
  const now = new Date().toISOString();
  const plantedDate = datePlanted || now;
  const expectedReadyDate = new Date(plantedDate);
  expectedReadyDate.setDate(expectedReadyDate.getDate() + Number(crop.daysToReady || 0));

  const existingBatches = await getBatches();
  const cropBatches = existingBatches.filter(b => b.cropId === crop._id || b.cropName === crop.name);
  const sequenceNum = String(cropBatches.length + 1).padStart(3, "0");
  const autoBatchName = `${crop.name}-${sequenceNum}`;
  const finalBatchName = customBatchName?.trim() || autoBatchName;

  const batch = {
    _id: `batch:${crop.name.replace(/\s+/g, "_")}:${Date.now()}:${Math.floor(Math.random() * 10000)}`,
    type: "batch",
    cropId: crop._id,
    cropName: crop.name,
    batchName: finalBatchName,
    batchNumber: sequenceNum,
    quantityPlanted: Number(quantityPlanted),
    quantityRemaining: Number(quantityPlanted),
    quantityLost: 0,
    datePlanted: plantedDate,
    expectedReadyDate: expectedReadyDate.toISOString(),
    readyOverride: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.put(batch);
  return batch;
}

export function getBatchDisplayName(batch) {
  if (!batch) return "";
  if (batch.batchName) return batch.batchName;
  if (batch.batchNumber) return `${batch.cropName}-${batch.batchNumber}`;
  return `${batch.cropName} (${new Date(batch.datePlanted).toLocaleDateString()})`;
}


// A batch is sellable once today >= expectedReadyDate, or if staff marked it
// ready early via readyOverride.
export function isBatchReady(batch) {
  if (batch.readyOverride) return true;
  return new Date() >= new Date(batch.expectedReadyDate);
}

export function batchStatus(batch) {
  if (batch.quantityRemaining <= 0) return "sold out";
  if (isBatchReady(batch)) return "ready";
  return "growing";
}

export async function markBatchReady(batch) {
  const updated = { ...batch, readyOverride: true, updatedAt: new Date().toISOString() };
  await db.put(updated);
  return updated;
}

export async function deleteBatch(batch) {
  await db.remove(batch);
}

// Returns ready batches for a crop, oldest planting first (just for sensible
// default ordering in pickers) — the owner chooses which one to sell from.
export function readyBatchesForCrop(batches, cropId) {
  return batches
    .filter(b => b.cropId === cropId && isBatchReady(b) && b.quantityRemaining > 0)
    .sort((a, b) => new Date(a.datePlanted) - new Date(b.datePlanted));
}

// Total sellable quantity for a crop across all its ready batches.
export function availableQuantityForCrop(batches, cropId) {
  return readyBatchesForCrop(batches, cropId).reduce((sum, b) => sum + b.quantityRemaining, 0);
}

export async function getActivePresaleReservations() {
  const result = await db.allDocs({ include_docs: true });

  return result.rows
    .map(row => row.doc)
    .filter(
      doc =>
        doc &&
        doc.type === "sale" &&
        doc.isPresale === true &&
        doc.presaleStatus !== "completed" &&
        doc.presaleStatus !== "cancelled"
    );
}

export async function getReservedQuantityForBatch(batchId) {
  const presales = await getActivePresaleReservations();

  return presales
    .filter(sale => sale.batchId === batchId)
    .reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
}

export async function availableQuantityForBatch(batch) {
  if (!batch) return 0;

  const reserved = await getReservedQuantityForBatch(batch._id);

  return Math.max(
    0,
    Number(batch.quantityRemaining || 0) - reserved
  );
}

export async function availableQuantityForCropIncludingPresales(batches, cropId) {
  const presales = await getActivePresaleReservations();

  return batches
    .filter(b => b.cropId === cropId && Number(b.quantityRemaining || 0) > 0)
    .reduce((sum, batch) => {
      const reserved = presales
        .filter(sale => sale.batchId === batch._id)
        .reduce((s, sale) => s + Number(sale.quantity || 0), 0);

      return sum + Math.max(
        0,
        Number(batch.quantityRemaining || 0) - reserved
      );
    }, 0);
}

export async function getPresales() {
  const result = await db.allDocs({ include_docs: true });

  return result.rows
    .map(row => row.doc)
    .filter(
      doc =>
        doc &&
        doc.type === "sale" &&
        doc.isPresale === true
    )
    .sort(
      (a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
    );
}

export async function getAvailableBatchesForCrop(batches, cropId) {
  const presales = await getActivePresaleReservations();

  return batches
    .filter(
      b =>
        b.cropId === cropId &&
        Number(b.quantityRemaining || 0) > 0
    )
    .map(batch => {
      const reserved = presales
        .filter(sale => sale.batchId === batch._id)
        .reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);

      return {
        ...batch,
        availableForSale: Math.max(
          0,
          Number(batch.quantityRemaining || 0) - reserved
        ),
      };
    })
    .filter(batch => batch.availableForSale > 0)
    .sort((a, b) => new Date(a.datePlanted) - new Date(b.datePlanted));
}

// Deducts `qty` from one specific, explicitly chosen batch. Re-fetches the
// batch fresh right before writing so a stale in-memory copy can't cause an
// overdraw. Throws if the batch isn't ready or doesn't have enough left.
export async function deductFromBatch(batchId, qty) {
  const batch = await db.get(batchId);

  if (!isBatchReady(batch)) {
    throw new Error("BATCH_NOT_READY");
  }
  if (batch.quantityRemaining < qty) {
    throw new Error("NOT_ENOUGH_IN_BATCH");
  }

  const updated = {
    ...batch,
    quantityRemaining: batch.quantityRemaining - qty,
    updatedAt: new Date().toISOString(),
  };
  await db.put(updated);
  return updated;
}

// ---- Loss & Spoilage Recording ----
export async function recordSpoilage({ batchId, quantityLost, reason, notes, recordedBy }) {
  const qty = Number(quantityLost);
  if (!qty || qty <= 0) throw new Error("INVALID_QUANTITY");

  const batch = await db.get(batchId);
  if (batch.quantityRemaining < qty) {
    throw new Error("EXCEEDS_REMAINING_STOCK");
  }

  const now = new Date().toISOString();
  const spoilageDoc = {
    _id: `spoilage:${batch._id}:${Date.now()}:${Math.floor(Math.random() * 1000)}`,
    type: "spoilage",
    batchId: batch._id,
    cropId: batch.cropId,
    cropName: batch.cropName,
    quantityLost: qty,
    reason: reason || "Other / Unspecified",
    notes: notes || "",
    recordedBy: recordedBy || "Staff",
    date: now,
  };

  const updatedBatch = {
    ...batch,
    quantityRemaining: batch.quantityRemaining - qty,
    quantityLost: (batch.quantityLost || 0) + qty,
    updatedAt: now,
  };

  await db.put(spoilageDoc);
  await db.put(updatedBatch);

  return { spoilageDoc, updatedBatch };
}

export async function getSpoilageHistory() {
  const result = await db.allDocs({ include_docs: true });
  return result.rows
    .map(row => row.doc)
    .filter(doc => doc && doc.type === "spoilage")
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ---- Suppliers & Input Purchases ----
export async function getSuppliers() {
  const result = await db.allDocs({ include_docs: true });
  const suppliers = result.rows
    .map(row => row.doc)
    .filter(doc => doc && doc.type === "supplier");
  return suppliers;
}

export async function addSupplier(supplierData) {
  const now = new Date().toISOString();
  const doc = {
    _id: `supplier:${Date.now()}:${Math.floor(Math.random() * 10000)}`,
    type: "supplier",
    name: supplierData.name.trim(),
    phone: supplierData.phone?.trim() || "",
    email: supplierData.email?.trim() || "",
    contactPerson: supplierData.contactPerson?.trim() || "",
    address: supplierData.address?.trim() || "",
    createdAt: now,
    updatedAt: now,
  };
  await db.put(doc);
  return doc;
}

export async function deleteSupplier(supplier) {
  await db.remove(supplier);
}

// ---- Stock Level Helpers ----
export function getStockAlertStatus(crop, availableQty) {
  const threshold = crop.minStockThreshold !== undefined ? Number(crop.minStockThreshold) : 25;
  if (availableQty <= 0) return { status: "out_of_stock", label: "Out of Stock", level: 0 };
  if (availableQty <= threshold) return { status: "low_stock", label: `Low Stock (<= ${threshold})`, level: 1 };
  return { status: "ok", label: "Stock OK", level: 2 };
}

