import React, { useEffect, useState } from "react";
import { db, getSuppliers, addSupplier } from "../db";
import { showToast } from "../utils/toast";


const CATEGORIES = ["Seeds", "Fertilizer & Soil", "Pots & Trays", "Pesticides & Chemicals", "Tools & Equipment", "Utilities & Overhead"];

const emptyForm = {
  item: "",
  category: "Seeds",
  supplierId: "",
  cropId: "",
  quantity: 1,
  cost: "",
  units: "",
  modeOfPayment: "Mpesa",
  paymentReference: "",
  purchaseDate: new Date().toISOString().slice(0, 10),
  notes: ""
};

const ETIMS_API_URL = "https://yelivate-apis.onrender.com";

export default function Purchase() {
  // Core state
  const [form, setForm] = useState(emptyForm);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [crops, setCrops] = useState([]);
  const [etimsPurchases, setEtimsPurchases] = useState([]);
  const [loadingEtimsPurchases, setLoadingEtimsPurchases] = useState(false);
  const [etimsError, setEtimsError] = useState("");
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", email: "", contactPerson: "", krapin: "" });
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  // Bulk purchase state
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [batchItems, setBatchItems] = useState([]);
  const [batchError, setBatchError] = useState("");
  // View toggle for grouped history
  const [isGroupedView, setIsGroupedView] = useState(true);
  // Duplicated state declarations removed

  useEffect(() => {
    loadPurchases();
    loadSuppliersData();
    loadCropsData();
  }, []);

  const loadPurchases = async () => {
    const res = await db.allDocs({ include_docs: true });
    const purchases = res.rows.map(r => r.doc).filter(d => d && d.type === "purchase");
    setPurchaseHistory(purchases.sort((a, b) => new Date(b.date) - new Date(a.date)));
  };

  const loadSuppliersData = async () => {
    const list = await getSuppliers();
    setSuppliers(list);
  };

  const loadCropsData = async () => {
    const res = await db.allDocs({ include_docs: true });
    const list = res.rows.map(r => r.doc).filter(d => d && d.type === "crop");
    setCrops(list);
  };

  const loadEtimsPurchases = async () => {
    setLoadingEtimsPurchases(true);
    setEtimsError("");
    try {
      const response = await fetch(`${ETIMS_API_URL}/api/etims/purchases?page_size=100`);
      const result = await response.json();
      if (!response.ok || result?.success === false) {
        throw new Error(result?.error?.message || result?.error || "Could not load eTIMS purchases.");
      }
      const payload = result?.data;
      setEtimsPurchases(Array.isArray(payload) ? payload : payload?.data || []);
    } catch (error) {
      console.error("Failed to load eTIMS purchases", error);
      setEtimsError(error.message);
    } finally {
      setLoadingEtimsPurchases(false);
    }
  };

  const saveEtimsPurchaseLocally = async (etimsPurchase) => {
    const etimsPurchaseId = etimsPurchase.id;
    if (!etimsPurchaseId) {
      return alert("This eTIMS purchase has no ID and cannot be saved locally.");
    }

    const existing = purchaseHistory.find((purchase) => purchase.etimsPurchaseId === etimsPurchaseId);
    if (existing) {
      return alert("This eTIMS purchase has already been saved locally.");
    }

    const items = etimsPurchase.item_list || etimsPurchase.items || [];
    const totalCost = Number(
      etimsPurchase.total_amount ??
      etimsPurchase.totalAmount ??
      items.reduce((sum, item) => sum + Number(item.total_amount || 0), 0)
    );
    const supplier = suppliers.find((item) =>
      item.digitaxSupplierId === etimsPurchase.supplier_id ||
      item.krapin === etimsPurchase.supplier_pin
    );
    const purchaseDate = etimsPurchase.purchase_date || new Date().toISOString().slice(0, 10);
    const itemNames = items.map((item) => item.item_name || item.itemName || item.name).filter(Boolean);
    const record = {
      _id: `purchase:etims:${etimsPurchaseId}`,
      type: "purchase",
      etimsPurchaseId,
      item: itemNames.join(", ") || "eTIMS purchase",
      category: "Other",
      supplierId: supplier?._id || null,
      supplierName: etimsPurchase.supplier_name || supplier?.name || "Unspecified Supplier",
      supplierPin: etimsPurchase.supplier_pin || supplier?.krapin || null,
      digitaxSupplierId: etimsPurchase.supplier_id || supplier?.digitaxSupplierId || null,
      cropId: null,
      cropName: "General Nursery Overhead",
      quantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 1,
      units: items.length > 1 ? `${items.length} items` : items[0]?.quantity_unit_code || "",
      modeOfPayment: etimsPurchase.payment_type_code || "Other",
      paymentReference: etimsPurchase.supplier_invoice_number || "",
      totalCost: Number.isFinite(totalCost) ? totalCost : 0,
      notes: `Imported from eTIMS invoice ${etimsPurchase.invoice_number || etimsPurchaseId}`,
      date: new Date(`${purchaseDate}T12:00:00`).toISOString(),
      etimsData: etimsPurchase,
    };

    try {
      await db.put(record);
      await loadPurchases();
      showToast("eTIMS purchase saved locally");
    } catch (error) {
      console.error("Failed to save eTIMS purchase locally", error);
      alert("Failed to save eTIMS purchase locally.");
    }
  };

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.item.trim()) return alert("Please enter the item name purchased.");
    const quantity = Number(form.quantity);
    const units = form.units;
    const cost = Number(form.cost);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return alert("Quantity must be greater than 0.");
    }

    if (!Number.isFinite(cost) || cost < 0) {
      return alert("Total cost must be 0 or greater.");
    }
    
    const supplierObj = suppliers.find(s => s._id === form.supplierId);
    const cropObj = crops.find(c => c._id === form.cropId);
    const record = {
      _id: `purchase:${Date.now()}:${Math.floor(Math.random() * 1000)}`,
      type: "purchase",
      item: form.item.trim(),
      category: form.category,
      supplierId: form.supplierId || null,
      supplierName: supplierObj ? supplierObj.name : "Unspecified Supplier",
      supplierPin: supplierObj ? supplierObj.krapin : null,
      digitaxSupplierId: supplierObj ? supplierObj.digitaxSupplierId : null,
      cropId: form.cropId || null,
      cropName: cropObj ? cropObj.name : "General Nursery Overhead",
      quantity,
      units,
      modeOfPayment: form.modeOfPayment,
      paymentReference: form.paymentReference,
      totalCost: cost,
      notes: form.notes.trim(),
      date: new Date(`${form.purchaseDate}T12:00:00`).toISOString(),
    };

    try {
      await db.put(record);
      setForm(emptyForm);
      await loadPurchases();
      showToast("Purchase saved");
    } catch (e) {
      console.error("Failed to save purchase", e);
      alert("Failed to save purchase.");
    }
  };

  const handleAddSupplier = async () => {
    if (!supplierForm.name.trim()) return alert("Supplier Name is required.");
    try {
      const newSupplier = await addSupplier(supplierForm);
      await loadSuppliersData();
      setForm(prev => ({ ...prev, supplierId: newSupplier._id }));
      setSupplierForm({ name: "", phone: "", email: "", contactPerson: "", krapin: "" });
      setShowSupplierModal(false);
    } catch (e) {
      alert("Failed to add supplier: " + e.message);
    }
  };

  const handleAddToBatch = () => {
    if (!form.item.trim()) return alert("Please enter the item name purchased.");
    const quantity = Number(form.quantity);
    const cost = Number(form.cost);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return alert("Quantity must be greater than 0.");
    }
    if (!Number.isFinite(cost) || cost < 0) {
      return alert("Total cost must be 0 or greater.");
    }

    const supplierObj = suppliers.find(s => s._id === form.supplierId);
    const cropObj = crops.find(c => c._id === form.cropId);

    const itemToAdd = {
      _tempId: `batch-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      item: form.item.trim(),
      category: form.category,
      supplierId: form.supplierId || null,
      supplierName: supplierObj ? supplierObj.name : "Unspecified Supplier",
      supplierPin: supplierObj ? supplierObj.krapin : null,
      digitaxSupplierId: supplierObj ? supplierObj.digitaxSupplierId : null,
      cropId: form.cropId || null,
      cropName: cropObj ? cropObj.name : "General Nursery Overhead",
      quantity,
      units: form.units,
      modeOfPayment: form.modeOfPayment,
      paymentReference: form.paymentReference,
      totalCost: cost,
      notes: form.notes.trim(),
      purchaseDate: form.purchaseDate,
    };

    setBatchItems(prev => [...prev, itemToAdd]);
    // Keep supplier and payment details to make logging multiple items from the same supplier effortless
    setForm(prev => ({
      ...emptyForm,
      supplierId: prev.supplierId,
      modeOfPayment: prev.modeOfPayment,
      paymentReference: prev.paymentReference,
      purchaseDate: prev.purchaseDate,
    }));
    showToast(`Added "${itemToAdd.item}" to bulk batch`);
  };

  const handleRemoveFromBatch = (tempId) => {
    setBatchItems(prev => prev.filter(it => it._tempId !== tempId));
  };

  const handleClearBatch = () => {
    if (batchItems.length === 0) return;
    if (window.confirm("Clear all items currently in this bulk batch?")) {
      setBatchItems([]);
      setBatchError("");
    }
  };

  const handleSaveBatch = async () => {
    if (batchItems.length === 0) {
      alert("Please add at least one item to the bulk batch before saving.");
      return;
    }

    const batchId = `batch:${Date.now()}:${Math.floor(Math.random() * 1000)}`;
    const records = batchItems.map((item, index) => ({
      _id: `purchase:${Date.now()}:${index}:${Math.floor(Math.random() * 1000)}`,
      type: "purchase",
      batchId,
      item: item.item,
      category: item.category,
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      supplierPin: item.supplierPin,
      digitaxSupplierId: item.digitaxSupplierId,
      cropId: item.cropId,
      cropName: item.cropName,
      quantity: item.quantity,
      units: item.units,
      modeOfPayment: item.modeOfPayment,
      paymentReference: item.paymentReference,
      totalCost: item.totalCost,
      notes: item.notes,
      date: new Date(`${item.purchaseDate}T12:00:00`).toISOString(),
    }));

    try {
      for (const rec of records) {
        await db.put(rec);
      }
      setBatchItems([]);
      setForm(emptyForm);
      await loadPurchases();
      showToast(`Saved bulk batch with ${records.length} items.`);
    } catch (e) {
      console.error("Failed to save bulk batch", e);
      alert("Failed to save bulk purchase batch: " + e.message);
    }
  };

  const handleDelete = async (purchase) => {
    if (!window.confirm(`Delete purchase "${purchase.item}"?`)) return;
    try {
      await db.remove(purchase);
      await loadPurchases();
    } catch (e) {
      console.error("Failed to delete purchase", e);
      alert("Failed to delete purchase.");
    }
  };

  const handleDeleteBatch = async (batchItemsToDelete) => {
    const count = batchItemsToDelete.length;
    if (!window.confirm(`Delete all ${count} items in this bulk purchase?`)) return;
    try {
      for (const p of batchItemsToDelete) {
        await db.remove(p);
      }
      await loadPurchases();
      showToast(`Deleted bulk purchase (${count} items).`);
    } catch (e) {
      console.error("Failed to delete bulk batch", e);
      alert("Failed to delete bulk purchase.");
    }
  };

  const filteredPurchases = purchaseHistory.filter(p => {
    const purchaseDate = new Date(p.date);
    const from = new Date(`${dateFrom}T00:00:00`);
    const to = new Date(`${dateTo}T23:59:59`);

    return purchaseDate >= from && purchaseDate <= to;
  });

  const formatCurrency = (amount) =>
    Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });

  const sortedPurchases = [...filteredPurchases].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  const totalSpend = sortedPurchases.reduce(
    (sum, item) => sum + (Number(item.totalCost) || 0),
    0
  );

  const purchaseCount = sortedPurchases.length;

  const averagePurchase = purchaseCount > 0 ? totalSpend / purchaseCount : 0;

  const categorySpend = {};

  sortedPurchases.forEach(purchase => {
    const category = purchase.category || "Other";

    categorySpend[category] =
      (categorySpend[category] || 0) +
      (Number(purchase.totalCost) || 0);
  });

  const categoryBreakdown = Object.entries(categorySpend)
    .sort((a, b) => b[1] - a[1]);

  const supplierSpend = {};

  sortedPurchases.forEach(purchase => {
    const supplier =
      purchase.supplierName || "Unspecified Supplier";

    supplierSpend[supplier] =
      (supplierSpend[supplier] || 0) +
      (Number(purchase.totalCost) || 0);
  });

  const supplierBreakdown = Object.entries(supplierSpend)
    .sort((a, b) => b[1] - a[1]);


  const cropSpend = {};

  sortedPurchases.forEach(purchase => {
    const crop =
      purchase.cropName || "General Nursery Overhead";

    cropSpend[crop] =
      (cropSpend[crop] || 0) +
      (Number(purchase.totalCost) || 0);
  });

  const cropBreakdown = Object.entries(cropSpend)
    .sort((a, b) => b[1] - a[1]);

  // Group purchases for display:
  // 1) Explicit batches (items having p.batchId) are grouped by batchId
  // 2) Single/legacy purchases can optionally be grouped by supplier & date if desired, or single purchases stand as individual entries
  const groupedPurchases = (() => {
    const groupsMap = new Map();
    for (const p of sortedPurchases) {
      // Group key: if item has batchId, group by batchId.
      // Otherwise each individual purchase is its own group key (preserving 100% backwards compatibility)
      const key = p.batchId ? `batch:${p.batchId}` : `single:${p._id}`;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          isBatch: Boolean(p.batchId),
          batchId: p.batchId || null,
          supplierName: p.supplierName || "Unspecified Supplier",
          date: p.date,
          modeOfPayment: p.modeOfPayment,
          paymentReference: p.paymentReference,
          notes: p.notes,
          items: [],
          totalCost: 0,
        });
      }
      const grp = groupsMap.get(key);
      grp.items.push(p);
      grp.totalCost += Number(p.totalCost) || 0;
      // Keep notes or references if missing on header
      if (!grp.notes && p.notes) grp.notes = p.notes;
      if (!grp.paymentReference && p.paymentReference) grp.paymentReference = p.paymentReference;
    }
    return Array.from(groupsMap.values());
  })();

  const handleHardRefresh = async () => {
    try {
      // Unregister all service workers
      if ("serviceWorker" in navigator) {
        const registrations =
          await navigator.serviceWorker.getRegistrations();

        await Promise.all(
          registrations.map(registration =>
            registration.unregister()
          )
        );
      }

      // Clear Cache Storage only.
      // This does NOT touch IndexedDB.
      if ("caches" in window) {
        const cacheNames = await caches.keys();

        await Promise.all(
          cacheNames.map(cacheName =>
            caches.delete(cacheName)
          )
        );
      }

      // Reload the application
      window.location.reload();
    } catch (error) {
      console.error("Hard refresh failed:", error);

      // Still reload if cleanup encounters an error
      window.location.reload();
    }
  };

  const deleteSupplier = async (supplier) => {
    const confirmed = window.confirm(
      `Delete supplier "${supplier.name}"?`
    );

    if (!confirmed) return;

    try {
      await db.remove(supplier);

      showToast(`${supplier.name} deleted`);

      await loadSuppliersData();
    } catch (error) {
      console.error("Failed to delete supplier:", error);
      alert(`Could not delete supplier: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <button
        type="button"
        onClick={handleHardRefresh}
        className="px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
        title="Clear cached files and service workers, then reload"
      >
        ↻ Hard Refresh
      </button>
      <div className="flex flex-col sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            🚚 Supplier Purchases & Input Expenses
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Log raw material purchases (seeds, pots, fertilizer), track supplier accounts, and attribute costs to crops.
          </p>
        </div>
        <button
          onClick={() => setShowSupplierModal(true)}
          className="px-4 py-2 sm:w-full md:max-w-[320px] md:min-w-[250px] bg-slate-900 text-white rounded-2xl md:m-auto hover:bg-slate-800 transition text-sm font-semibold"
        >
          ➕ Register New Supplier
        </button>
      </div>
      <div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid lg:grid-cols-3 gap-6 lg:col-span-3 sm:space-y-6">
            <div className="lg:mb-[300px] lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  📝 {isBulkMode ? "Log Bulk Purchase Batch" : "Log Input Purchase"}
                </h2>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition">
                    <input
                      type="checkbox"
                      checked={isBulkMode}
                      onChange={(e) => setIsBulkMode(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>📦 Bulk Purchase Mode</span>
                  </label>
                </div>
              </div>

              {isBulkMode && (
                <div className="mb-4 p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold">Bulk Purchase Mode Active:</span> Fill the details for each item and click <strong>&quot;Add Item to Batch&quot;</strong>. Once all items are queued, click <strong>&quot;Save Entire Batch&quot;</strong>.
                  </div>
                  {batchItems.length > 0 && (
                    <span className="bg-emerald-600 text-white font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
                      {batchItems.length} {batchItems.length === 1 ? "item" : "items"} queued
                    </span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Item Purchased</label>
                  <input
                    value={form.item}
                    onChange={(e) => handleChange("item", e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="e.g. F1 Hybrid Tomato Seeds"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => handleChange("category", e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Supplier</label>
                  <select
                    value={form.supplierId}
                    onChange={(e) => handleChange("supplierId", e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">Choose Supplier (Optional)...</option>
                    {suppliers.map(s => (
                      <option key={s._id} value={s._id}>{s.name} ({s.krapin || s.phone})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Attribute to Crop Variety</label>
                  <select
                    value={form.cropId}
                    onChange={(e) => handleChange("cropId", e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">General Nursery Overhead</option>
                    {crops.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Units</label>
                  <input
                    type="text"
                    value={form.units}
                    onChange={e => handleChange("units", e.target.value)}
                    placeholder="Unit e.g. 1kg, 2L, 250ml 5 sachets, etc..."
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) => handleChange("quantity", e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600">
                    Date of Purchase
                  </label>

                  <input
                    type="date"
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                    value={form.purchaseDate}
                    onChange={(e) =>
                      handleChange("purchaseDate", e.target.value)
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Purchase Cost (Ksh)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.cost}
                    onChange={e => handleChange("cost", e.target.value)}
                    placeholder="Total cost"
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div className="">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Mode of Payment</label>
                  <select
                    value={form.modeOfPayment}
                    onChange={(e) => handleChange("modeOfPayment", e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="Mpesa">Mpesa</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank</option>
                    <option value="Other">Others</option>
                  </select>
                </div>
                <div className="">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Reference Number</label>
                  <input
                    value={form.paymentReference ?? ""}
                    onChange={(e) => handleChange("paymentReference", e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                    placeholder={`${form.modeOfPayment === "Mpesa" ? "Enter Mpesa Code..." : "Enter payment reference..."}`}
                  />
                </div>
                <div className="">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Notes / Invoice Number</label>
                  <input
                    value={form.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="e.g. Inv #8892 - Delivery via G4S"
                  />
                </div>
                {isBulkMode ? (
                  <div className="col-span-1 md:col-span-2 mt-4 pt-4 border-t border-slate-200 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={handleAddToBatch}
                        className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold text-sm flex items-center gap-2 shadow-xs"
                      >
                        <span>➕</span>
                        <span>Add Item to Batch</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {batchItems.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearBatch}
                            className="px-3 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition text-xs font-semibold"
                          >
                            Clear Batch ({batchItems.length})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleSaveBatch}
                          disabled={batchItems.length === 0}
                          className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition font-semibold text-sm shadow-xs flex items-center gap-2"
                        >
                          <span>💾</span>
                          <span>Save Entire Batch ({batchItems.length})</span>
                        </button>
                      </div>
                    </div>

                    {/* Batch Items Queue Table */}
                    {batchItems.length > 0 && (
                      <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-2 border-b border-slate-200">
                          <span>Items Queued in this Bulk Purchase:</span>
                          <span className="text-emerald-800 font-bold">
                            Total: Ksh {formatCurrency(batchItems.reduce((acc, it) => acc + (Number(it.totalCost) || 0), 0))}
                          </span>
                        </div>
                        <div className="divide-y divide-slate-200/80 max-h-56 overflow-y-auto pr-1">
                          {batchItems.map((item, idx) => (
                            <div key={item._tempId} className="py-2 flex items-center justify-between gap-2 text-xs">
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-slate-800 truncate">
                                  {idx + 1}. {item.item} ({item.quantity} {item.units || "units"})
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {item.supplierName} · {item.cropName} · {item.category}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-slate-900">
                                  Ksh {formatCurrency(item.totalCost)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFromBatch(item._tempId)}
                                  className="text-red-500 hover:text-red-700 font-bold p-1 rounded hover:bg-red-50"
                                  title="Remove from batch"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="col-span-1 md:col-span-2 mt-5 flex justify-end">
                    <button onClick={handleSave} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-semibold text-sm shadow-xs">
                      Save Purchase Record
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-lg font-bold text-slate-900">
                    📊 Expense Analytics
                  </h2>
                </div>

                {/* Date filter */}
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-2">
                    Filter Date Range
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">
                        From
                      </label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">
                        To
                      </label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                      Total Spend
                    </div>
                    <div className="text-xl font-black text-emerald-900 mt-1">
                      Ksh {formatCurrency(totalSpend)}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Purchases
                    </div>
                    <div className="text-xl font-black text-slate-900 mt-1">
                      {purchaseCount}
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                      Average Purchase
                    </div>
                    <div className="text-xl font-black text-blue-900 mt-1">
                      Ksh {formatCurrency(averagePurchase)}
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                      Top Category
                    </div>
                    <div className="text-sm font-black text-amber-900 mt-1 truncate">
                      {categoryBreakdown[0]?.[0] || "—"}
                    </div>
                  </div>
                </div>

                {/* Category breakdown */}
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-3">
                    Spending by Category
                  </h3>

                  {categoryBreakdown.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No purchases in this period.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {categoryBreakdown.map(([category, amount]) => {
                        const percentage =
                          totalSpend > 0
                            ? (amount / totalSpend) * 100
                            : 0;

                        return (
                          <div key={category}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium text-slate-600">
                                {category}
                              </span>
                              <span className="font-semibold text-slate-800">
                                Ksh {formatCurrency(amount)}
                              </span>
                            </div>

                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Supplier breakdown */}
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-3">
                    Top Suppliers
                  </h3>

                  <div className="space-y-2">
                    {supplierBreakdown.slice(0, 5).map(([supplier, amount]) => (
                      <div
                        key={supplier}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-600 truncate pr-3">
                          {supplier}
                        </span>

                        <span className="font-bold text-slate-900 whitespace-nowrap">
                          Ksh {formatCurrency(amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Crop breakdown */}
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-3">
                    Spending by Crop
                  </h3>

                  <div className="space-y-2">
                    {cropBreakdown.slice(0, 5).map(([crop, amount]) => (
                      <div
                        key={crop}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-600 truncate pr-3">
                          🌱 {crop}
                        </span>

                        <span className="font-bold text-slate-900 whitespace-nowrap">
                          Ksh {formatCurrency(amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:mt-[-300px] lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    Purchase History {isGroupedView ? `(${groupedPurchases.length} groups · ${sortedPurchases.length} items)` : `(${sortedPurchases.length})`}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition">
                    <input
                      type="checkbox"
                      checked={isGroupedView}
                      onChange={(e) => setIsGroupedView(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>Group Bulk Purchases</span>
                  </label>
                </div>
              </div>

              {sortedPurchases.length === 0 ? (
                <div className="text-sm text-slate-400 py-4 text-center">No purchases recorded yet.</div>
              ) : isGroupedView ? (
                <div className="space-y-4">
                  {groupedPurchases.map((group, grpIdx) => {
                    const isMultiItem = group.isBatch && group.items.length > 1;

                    if (!group.isBatch) {
                      // Single item purchase record (rendered cleanly as standard card)
                      const p = group.items[0];
                      return (
                        <div key={p._id} className="p-4 border border-slate-100 bg-slate-50 rounded-xl flex flex-col justify-between gap-3 hover:border-slate-300 transition">
                          <div className="space-y-1">
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              <span>Purchased {p.units} {p.item} {`(${p.quantity})`}</span>
                              <span className="sm:hidden text-[10px] bg-slate-200 px-2 py-0.5 rounded-full uppercase">{p.category}</span>
                            </div>
                            <div className="text-xs text-slate-500 flex flex-col flex-wrap gap-x-3 gap-y-1">
                              <span>🏢 {p.supplierName}</span>
                              <span>🌱 {p.cropName}</span>
                              {p.modeOfPayment && (<span>💰 Paid through {p.modeOfPayment} {p.paymentReference && `(Payment Ref: ${p.paymentReference})`}</span>)}
                              <span>📅 {new Date(p.date).toLocaleDateString()}</span>
                            </div>
                            {p.notes && <div className="text-xs text-slate-400 italic">&quot;{p.notes}&quot;</div>}
                          </div>

                          <div className="flex items-center gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 justify-between">
                            <div className="text-right">
                              <div className="text-base font-bold text-emerald-800">Ksh {formatCurrency(p.totalCost)}</div>
                            </div>
                            <button onClick={() => handleDelete(p)} className="px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-xs font-semibold">
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // Bulk purchase batch record
                    return (
                      <div key={group.batchId || `grp-${grpIdx}`} className="border-2 border-emerald-200 bg-white rounded-xl shadow-xs overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 border-b border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="bg-emerald-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wide">
                                📦 Bulk Purchase
                              </span>
                              <h3 className="font-bold text-slate-900 text-base">
                                {group.supplierName}
                              </h3>
                              <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                                {group.items.length} items
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                              <span>📅 {new Date(group.date).toLocaleDateString()}</span>
                              {group.modeOfPayment && (
                                <span>💰 {group.modeOfPayment} {group.paymentReference && `(${group.paymentReference})`}</span>
                              )}
                              {group.notes && <span className="italic">&quot;{group.notes}&quot;</span>}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-emerald-100">
                            <div className="text-right">
                              <div className="text-[10px] uppercase font-bold text-slate-400">Batch Total</div>
                              <div className="text-lg font-black text-emerald-700">
                                Ksh {formatCurrency(group.totalCost)}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteBatch(group.items)}
                              className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition text-xs font-semibold"
                              title="Delete all items in this bulk purchase"
                            >
                              Delete Batch
                            </button>
                          </div>
                        </div>

                        {/* Items within this bulk batch */}
                        <details open className="group">
                          <summary className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-600 cursor-pointer flex items-center justify-between hover:bg-slate-100 select-none">
                            <span>View Batch Breakdown ({group.items.length} items)</span>
                            <span className="text-slate-400 text-[11px] group-open:rotate-180 transition-transform">▼</span>
                          </summary>
                          <div className="divide-y divide-slate-100 p-3 bg-white space-y-1">
                            {group.items.map((p, idx) => (
                              <div key={p._id} className="py-2.5 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 rounded-lg transition">
                                <div className="space-y-0.5 min-w-0">
                                  <div className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                                    <span className="text-xs text-slate-400">{idx + 1}.</span>
                                    <span className="truncate">{p.item}</span>
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                      {p.category}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5 pl-4">
                                    <span>Qty: <strong>{p.quantity}</strong> {p.units || ""}</span>
                                    <span>🌱 {p.cropName}</span>
                                    {p.notes && <span className="italic text-slate-400">&quot;{p.notes}&quot;</span>}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between sm:justify-end gap-3 pl-4 sm:pl-0">
                                  <span className="text-sm font-bold text-slate-900 whitespace-nowrap">
                                    Ksh {formatCurrency(p.totalCost)}
                                  </span>
                                  <button
                                    onClick={() => handleDelete(p)}
                                    className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 rounded hover:bg-red-50"
                                    title="Delete individual item from batch"
                                  >
                                    Delete Item
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedPurchases.map(p => (
                    <div key={p._id} className="p-4 border border-slate-100 bg-slate-50 rounded-xl flex flex-col justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>Purchased {p.units} {p.item} {`(${p.quantity})`}</span>
                          <span className="sm:hidden text-[10px] bg-slate-200 px-2 py-0.5 rounded-full uppercase">{p.category}</span>
                          {p.batchId && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                              📦 Bulk Item
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 flex flex-col flex-wrap gap-x-3 gap-y-1">
                          <span>🏢 {p.supplierName}</span>
                          <span>🌱 {p.cropName}</span>
                          {p.modeOfPayment && (<span>💰 Paid through {p.modeOfPayment} {p.paymentReference && `(Payment Ref: ${p.paymentReference})`}</span>)}
                          <span>📅 {new Date(p.date).toLocaleDateString()}</span>
                        </div>
                        {p.notes && <div className="text-xs text-slate-400 italic">&quot;{p.notes}&quot;</div>}
                      </div>

                      <div className="flex items-center gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 justify-between">
                        <div className="text-right">
                          <div className="text-base font-bold text-emerald-800">Ksh {formatCurrency(p.totalCost)}</div>
                        </div>
                        <button onClick={() => handleDelete(p)} className="px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-xs font-semibold">
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">eTIMS Purchases</h2>
                  <p className="text-xs text-slate-500">Purchases pulled from KRA through DigiTax. These do not change local expense totals.</p>
                </div>
                <button
                  type="button"
                  onClick={loadEtimsPurchases}
                  disabled={loadingEtimsPurchases}
                  className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {loadingEtimsPurchases ? "Loading..." : "Load eTIMS Purchases"}
                </button>
              </div>
              {etimsError && <p className="text-sm text-red-600">{etimsError}</p>}
              {etimsPurchases.length > 0 && (
                <div className="space-y-3">
                  {etimsPurchases.map((purchase) => (
                    <div key={purchase.id} className="p-4 border border-slate-100 bg-slate-50 rounded-xl flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{purchase.supplier_name || "Unknown supplier"}</div>
                        <div className="text-xs text-slate-500">
                          Invoice {purchase.invoice_number || purchase.trader_invoice_number || "—"} · {purchase.purchase_date || "—"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => saveEtimsPurchaseLocally(purchase)}
                        disabled={purchaseHistory.some((localPurchase) => localPurchase.etimsPurchaseId === purchase.id)}
                        className="shrink-0 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                      >
                        {purchaseHistory.some((localPurchase) => localPurchase.etimsPurchaseId === purchase.id) ? "Saved locally" : "Save locally"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {!loadingEtimsPurchases && !etimsError && etimsPurchases.length === 0 && (
                <p className="text-sm text-slate-400">Click “Load eTIMS Purchases” to fetch the latest records.</p>
              )}
            </div>

            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-lg font-bold text-slate-900">🏢 Approved Suppliers</h2>
                <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-full">{suppliers.length} Active</span>
              </div>

              <div className="space-y-3">
                {suppliers.map(s => (
                  <div
                    key={s._id}
                    className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold text-slate-900 text-sm">
                        {s.name}
                      </div>

                      <button
                        type="button"
                        onClick={() => deleteSupplier(s)}
                        className="shrink-0 text-slate-400 hover:text-red-600 transition"
                        title={`Delete ${s.name}`}
                        aria-label={`Delete ${s.name}`}
                      >
                        Delete
                      </button>
                    </div>
                    {s.name && <div className="text-slate-600">🏢 {s.name}</div>}
                    {s.contactPerson && <div className="text-slate-600">👤 {s.contactPerson}</div>}
                    {s.krapin && <div className="text-slate-600"> {s.krapin}</div>}
                    {s.phone && <div className="text-slate-600">📞 {s.phone}</div>}
                    {s.email && <div className="text-slate-500">✉️ {s.email}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSupplierModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                🏢 Add New Supplier Record
              </h3>
              <button onClick={() => setShowSupplierModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Company / Business Name *</label>
                <input
                  placeholder="e.g. Kenya Seed Company"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Contact Person</label>
                <input
                  placeholder="e.g. Jane Doe"
                  value={supplierForm.contactPerson}
                  onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">KRA PIN</label>
                <input
                  placeholder="e.g. P051234567A"
                  value={supplierForm.krapin}
                  onChange={(e) => setSupplierForm({ ...supplierForm, krapin: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number</label>
                <input
                  placeholder="e.g. +254 700 000 000"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address</label>
                <input
                  placeholder="e.g. sales@supplier.co.ke"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 justify-end">
              <button onClick={() => setShowSupplierModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold">Cancel</button>
              <button onClick={handleAddSupplier} className="px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition text-sm font-semibold">Save Supplier</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
