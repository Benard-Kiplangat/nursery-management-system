import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, getBatches, availableQuantityForCrop, getStockAlertStatus } from "../db";
import SyncButton from "../components/SyncButton";

export default function Crops() {
  const navigate = useNavigate();
  const [crops, setCrops] = useState([]);
  const [batches, setBatches] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", price: "", daysToReady: "", minStockThreshold: 25, active: true, id: null });

  useEffect(() => {
    loadCrops();
    loadBatches();
  }, []);

  const loadBatches = async () => {
    const items = await getBatches();
    setBatches(items);
  };

  const loadCrops = async () => {
    const result = await db.allDocs({ include_docs: true });
    const items = result.rows.map(row => row.doc).filter(doc => doc && doc.type === "crop");
    setCrops(items);
  };

  const filteredCrops = crops.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const handleSubmit = async () => {
    if (!form.name || !form.price || !form.daysToReady) return alert("Please fill out Crop Name, Price, and Days to Ready.");

    const now = new Date().toISOString();
    const threshold = Number(form.minStockThreshold) >= 0 ? Number(form.minStockThreshold) : 25;

    if (form.id) {
      const doc = {
        _id: form.id,
        _rev: form._rev,
        type: "crop",
        name: form.name,
        price: Number(form.price),
        daysToReady: Number(form.daysToReady),
        minStockThreshold: threshold,
        active: !!form.active,
        createdAt: form.createdAt,
        updatedAt: now,
      };
      await db.put(doc);
    } else {
      const doc = {
        _id: `crop:${form.name.replace(/\s+/g, "_")}:${Date.now()}`,
        type: "crop",
        name: form.name,
        price: Number(form.price),
        daysToReady: Number(form.daysToReady),
        minStockThreshold: threshold,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      await db.put(doc);
    }
    setForm({ name: "", price: "", daysToReady: "", minStockThreshold: 25, active: true, id: null });
    loadCrops();
  };

  const handleEdit = (crop) => {
    setForm({
      name: crop.name,
      price: crop.price,
      daysToReady: crop.daysToReady,
      minStockThreshold: crop.minStockThreshold !== undefined ? crop.minStockThreshold : 25,
      active: crop.active !== false,
      id: crop._id,
      _rev: crop._rev,
      createdAt: crop.createdAt,
    });
  };

  const handleDelete = async (crop) => {
    if (window.confirm(`Are you sure you want to delete crop "${crop.name}"?`)) {
      await db.remove(crop);
      loadCrops();
    }
  };

  const handleQuickReplant = (crop) => {
    navigate("/batches", { state: { preselectCropId: crop._id } });
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            🌱 Crop Catalog & Inventory Rules
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage crop varieties, retail seedling prices, growth duration, and automated low-stock re-plant alerts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SyncButton />
        </div>
      </div>

      {/* Add / Edit Form Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          {form.id ? "✏️ Edit Crop Variety" : "➕ Add New Crop Variety"}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Crop Name</label>
            <input
              name="name"
              placeholder="e.g. Tomato Money Maker"
              value={form.name}
              onChange={handleChange}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Price per Seedling (KES)</label>
            <input
              name="price"
              type="number"
              min="0"
              placeholder="e.g. 15"
              value={form.price}
              onChange={handleChange}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Days to Ready</label>
            <input
              name="daysToReady"
              type="number"
              min="1"
              placeholder="e.g. 30"
              value={form.daysToReady}
              onChange={handleChange}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Min. Stock Alert Threshold</label>
            <input
              name="minStockThreshold"
              type="number"
              min="0"
              placeholder="e.g. 25"
              value={form.minStockThreshold}
              onChange={handleChange}
              className="input-field"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              name="active"
              type="checkbox"
              checked={form.active}
              onChange={handleChange}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
            <span>Active for POS Selection</span>
          </label>
          <div className="flex gap-2">
            {form.id && (
              <button
                onClick={() => setForm({ name: "", price: "", daysToReady: "", minStockThreshold: 25, active: true, id: null })}
                className="btn-secondary"
              >
                Cancel
              </button>
            )}
            <button onClick={handleSubmit} className="btn-primary">
              {form.id ? "Update Crop" : "Save Crop Variety"}
            </button>
          </div>
        </div>
      </div>

      {/* Catalog List */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900">Crop Variety Catalog ({crops.length})</h2>
          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="🔍 Search crops..."
              className="input-field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCrops.map(crop => {
            const readyQty = availableQuantityForCrop(batches, crop._id);
            const alertInfo = getStockAlertStatus(crop, readyQty);

            return (
              <div key={crop._id} className="card-elevated p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-base text-slate-900 flex items-center gap-1.5">
                      <span>🌱</span> {crop.name}
                    </h3>
                    <span className={
                      alertInfo.status === "out_of_stock"
                        ? "badge-danger"
                        : alertInfo.status === "low_stock"
                        ? "badge-warning"
                        : "badge-success"
                    }>
                      {alertInfo.label}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Price / Unit:</span>
                      <span className="font-semibold text-slate-900">KES {crop.price}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Growth Duration:</span>
                      <span className="font-medium text-slate-800">{crop.daysToReady} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Ready Stock:</span>
                      <span className={`font-bold ${readyQty > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {readyQty} seedlings
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 pt-1">
                      <span>Alert Threshold: {crop.minStockThreshold ?? 25}</span>
                      {crop.active === false && <span className="text-amber-600 font-medium">(Inactive)</span>}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {(alertInfo.status === "low_stock" || alertInfo.status === "out_of_stock") && (
                    <button
                      onClick={() => handleQuickReplant(crop)}
                      className="btn-warning flex-1 justify-center"
                      title="Quick Re-plant a new batch for this crop"
                    >
                      <span>🔄</span> Quick Re-plant
                    </button>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <button onClick={() => handleEdit(crop)} className="btn-secondary text-xs px-2.5 py-1">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(crop)} className="btn-danger">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

