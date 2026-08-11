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
  purchaseDate: new Date().toISOString().slice(0, 10),
  notes: ""
};

export default function Purchase() {
  const [form, setForm] = useState(emptyForm);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [crops, setCrops] = useState([]);

  // Quick Supplier Modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", email: "", contactPerson: "" });

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

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

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const liveTotal =
    (Number(form.quantity) || 0) *
    (Number(form.cost) || 0);

  const handleSave = async () => {
    if (!form.item.trim()) return alert("Please enter the item name purchased.");
    const quantity = Number(form.quantity);
    const cost = Number(form.cost);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return alert("Quantity must be greater than 0.");
    }

    if (!Number.isFinite(cost) || cost < 0) {
      return alert("Cost must be 0 or greater.");
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
      cropId: form.cropId || null,
      cropName: cropObj ? cropObj.name : "General Nursery Overhead",
      quantity,
      cost,
      totalCost: quantity * cost,
      notes: form.notes.trim(),
      date: new Date(`${form.purchaseDate}T12:00:00`).toISOString(),
    };

    try {
      await db.put(record);
      setForm(emptyForm);
      await loadPurchases();
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
      setSupplierForm({ name: "", phone: "", email: "", contactPerson: "" });
      setShowSupplierModal(false);
    } catch (e) {
      alert("Failed to add supplier: " + e.message);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
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
          className="px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition text-sm font-semibold"
        >
          ➕ Register New Supplier
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              📝 Log Input Purchase
            </h2>

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
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
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
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Choose Supplier (Optional)...</option>
                  {suppliers.map(s => (
                    <option key={s._id} value={s._id}>{s.name} ({s.contactPerson || s.phone})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Attribute to Crop Variety</label>
                <select
                  value={form.cropId}
                  onChange={(e) => handleChange("cropId", e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="">General Nursery Overhead</option>
                  {crops.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
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

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cost per Unit (KES)</label>
                <input
                  type="number"
                  min="0"
                  value={form.cost}
                  onChange={(e) => handleChange("cost", e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="e.g. 450"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">
                  Date of Purchase
                </label>

                <input
                  type="date"
                  className="input-field"
                  value={form.purchaseDate}
                  onChange={(e) =>
                    handleChange("purchaseDate", e.target.value)
                  }
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
            </div>

            <div className="flex text-sm font-bold align-right pt-4 w-full text-emerald-700">
              <span className="min-w-[84%]"></span> Total: KES {formatCurrency(liveTotal)}
            </div>

            <div className="mt-5 flex justify-end">
              <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-semibold text-sm">
                Save Purchase Record
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Purchase History ({sortedPurchases.length})</h2>
            {sortedPurchases.length === 0 ? (
              <div className="text-sm text-slate-400 py-4 text-center">No purchases recorded yet.</div>
            ) : (
              <div className="space-y-3">
                {sortedPurchases.map(p => (
                  <div key={p._id} className="p-4 border border-slate-100 bg-slate-50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{p.item}</span>
                        <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full uppercase">{p.category}</span>
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                        <span>🏢 {p.supplierName}</span>
                        <span>🌱 {p.cropName}</span>
                        <span>📅 {new Date(p.date).toLocaleDateString()}</span>
                      </div>
                      {p.notes && <div className="text-xs text-slate-400 italic">"{p.notes}"</div>}
                    </div>

                    <div className="flex items-center gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 justify-between">
                      <div className="text-right">
                        <div className="text-xs text-slate-500">{p.quantity} @ KES {formatCurrency(p.cost)}</div>
                        <div className="text-base font-bold text-emerald-800">KES {formatCurrency(p.totalCost)}</div>
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
                  KES {formatCurrency(totalSpend)}
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
                  KES {formatCurrency(averagePurchase)}
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
                            KES {formatCurrency(amount)}
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
                      KES {formatCurrency(amount)}
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
                      KES {formatCurrency(amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
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
        🗑️
      </button>
    </div>
                  {s.contactPerson && <div className="text-slate-600">👤 {s.contactPerson}</div>}
                  {s.phone && <div className="text-slate-600">📞 {s.phone}</div>}
                  {s.email && <div className="text-slate-500">✉️ {s.email}</div>}
                </div>
              ))}
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
