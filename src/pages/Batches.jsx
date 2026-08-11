import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { db, getBatches, addBatch, markBatchReady, deleteBatch, batchStatus, isBatchReady, recordSpoilage, getSpoilageHistory, getBatchDisplayName } from "../db";
import { useAuth } from "../context/AuthContext";

const SPOILAGE_REASONS = [
  "Pest Infestation",
  "Disease / Fungus",
  "Over / Under-Watering",
  "Bad Weather",
  "Mechanical / Handling Damage",
  "Other / Natural Mortality",
];

export default function Batches() {
  const location = useLocation();
  const { currentUser } = useAuth();

  const [crops, setCrops] = useState([]);
  const [batches, setBatches] = useState([]);
  const [spoilageLogs, setSpoilageLogs] = useState([]);
  const [form, setForm] = useState({
    cropId: location.state?.preselectCropId || "",
    batchName: "",
    quantityPlanted: "",
    datePlanted: new Date().toISOString().slice(0, 10),
  });
  const [filter, setFilter] = useState("all");

  // Spoilage Modal state
  const [activeLossBatch, setActiveLossBatch] = useState(null);
  const [lossForm, setLossForm] = useState({ quantityLost: "", reason: SPOILAGE_REASONS[0], notes: "" });

  useEffect(() => {
    loadCrops();
    loadBatches();
    loadSpoilageLogs();
  }, []);

  useEffect(() => {
    if (location.state?.preselectCropId) {
      handleCropSelect(location.state.preselectCropId);
    }
  }, [location.state, crops, batches]);

  const loadCrops = async () => {
    const result = await db.allDocs({ include_docs: true });
    const items = result.rows.map(row => row.doc).filter(doc => doc && doc.type === "crop");
    setCrops(items);
  };

  const loadBatches = async () => {
    const items = await getBatches();
    setBatches(items.sort((a, b) => new Date(b.datePlanted) - new Date(a.datePlanted)));
  };

  const loadSpoilageLogs = async () => {
    const history = await getSpoilageHistory();
    setSpoilageLogs(history);
  };

  const handleCropSelect = (selectedCropId) => {
    const crop = crops.find(c => c._id === selectedCropId);
    let defaultCode = "";
    if (crop) {
      const cropBatches = batches.filter(b => b.cropId === crop._id || b.cropName === crop.name);
      const seq = String(cropBatches.length + 1).padStart(3, "0");
      defaultCode = `Bed-${seq}`;
    }
    setForm(prev => ({
      ...prev,
      cropId: selectedCropId,
      batchName: defaultCode,
    }));
  };

  const handleChange = e => {
    const { name, value } = e.target;
    if (name === "cropId") {
      handleCropSelect(value);
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleSubmit = async () => {
    const crop = crops.find(c => c._id === form.cropId);
    if (!crop) return alert("Please select a crop.");
    if (!form.quantityPlanted || Number(form.quantityPlanted) <= 0) return alert("Please enter a valid quantity.");

    await addBatch({
      crop,
      customBatchName: form.batchName,
      quantityPlanted: form.quantityPlanted,
      datePlanted: new Date(form.datePlanted).toISOString(),
    });
    setForm({ cropId: "", batchName: "", quantityPlanted: "", datePlanted: new Date().toISOString().slice(0, 10) });
    loadBatches();
  };

  const handleMarkReady = async (batch) => {
    await markBatchReady(batch);
    loadBatches();
  };

  const handleDelete = async (batch) => {
    if (window.confirm(`Delete batch "${getBatchDisplayName(batch)}"?`)) {
      await deleteBatch(batch);
      loadBatches();
    }
  };

  const handleOpenLossModal = (batch) => {
    setActiveLossBatch(batch);
    setLossForm({ quantityLost: "", reason: SPOILAGE_REASONS[0], notes: "" });
  };

  const handleSaveSpoilage = async () => {
    if (!lossForm.quantityLost || Number(lossForm.quantityLost) <= 0) {
      return alert("Please enter a valid loss quantity.");
    }
    if (Number(lossForm.quantityLost) > activeLossBatch.quantityRemaining) {
      return alert(`Cannot record loss greater than remaining stock (${activeLossBatch.quantityRemaining}).`);
    }

    try {
      await recordSpoilage({
        batchId: activeLossBatch._id,
        quantityLost: lossForm.quantityLost,
        reason: lossForm.reason,
        notes: lossForm.notes,
        recordedBy: currentUser?.username || "Staff",
      });
      setActiveLossBatch(null);
      await loadBatches();
      await loadSpoilageLogs();
    } catch (err) {
      alert("Failed to record loss: " + err.message);
    }
  };

  const filteredBatches = batches.filter(b => {
    if (filter === "all") return true;
    return batchStatus(b) === filter;
  });

  const statusBadge = (batch) => {
    const status = batchStatus(batch);
    if (status === "ready") return <span className="badge-success">Ready</span>;
    if (status === "growing") return <span className="badge-warning">Growing</span>;
    return <span className="badge-info">Sold Out</span>;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          📦 Planted Batches & Loss Tracking
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Track seedling plantings with unique batch identifiers (e.g. Tomato-001), growth maturity dates, and record batch losses.
        </p>
      </div>

      {/* Add Batch Form Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          ➕ Register New Planting Batch
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Select Crop Variety</label>
            <select
              name="cropId"
              value={form.cropId}
              onChange={handleChange}
              className="input-field"
            >
              <option value="">Choose crop...</option>
              {crops.map(c => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.daysToReady} days)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Batch Code / Name</label>
            <input
              name="batchName"
              placeholder="e.g. Tomato-001"
              value={form.batchName}
              onChange={handleChange}
              className="input-field font-semibold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Quantity Planted</label>
            <input
              name="quantityPlanted"
              type="number"
              min="1"
              placeholder="e.g. 500"
              value={form.quantityPlanted}
              onChange={handleChange}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Date Planted</label>
            <input
              name="datePlanted"
              type="date"
              value={form.datePlanted}
              onChange={handleChange}
              className="input-field"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={handleSubmit} className="btn-primary">
            <span>🌱</span> Plant Batch
          </button>
        </div>
      </div>

      {/* Batches List */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900">Batches Registry ({batches.length})</h2>
          <div className="flex flex-wrap gap-2">
            {["all", "growing", "ready", "sold out"].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f === "all" ? "All Batches" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {filteredBatches.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">No batches found for selected filter.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBatches.map(batch => {
              const ready = isBatchReady(batch);
              const displayName = getBatchDisplayName(batch);
              return (
                <div key={batch._id} className="card-elevated p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                          {batch.batchName || `${batch.cropName}-#`}
                        </span>
                        <h3 className="font-bold text-slate-900 text-base">{batch.cropName}</h3>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Planted: {new Date(batch.datePlanted).toLocaleDateString()} · Expected: {new Date(batch.expectedReadyDate).toLocaleDateString()}
                      </div>
                    </div>
                    {statusBadge(batch)}
                  </div>

                  {/* Quantities bar */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Remaining Stock:</span>
                      <span className="font-bold text-slate-900">{batch.quantityRemaining} / {batch.quantityPlanted}</span>
                    </div>
                    {batch.quantityLost > 0 && (
                      <div className="flex justify-between text-rose-600 font-medium">
                        <span>Recorded Loss/Spoilage:</span>
                        <span>{batch.quantityLost} units</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 gap-2">
                    {batch.quantityRemaining > 0 && (
                      <button
                        onClick={() => handleOpenLossModal(batch)}
                        className="btn-secondary text-xs px-2.5 py-1.5 text-rose-700 hover:bg-rose-50"
                      >
                        ⚠️ Record Spoilage
                      </button>
                    )}
                    <div className="flex gap-2 ml-auto">
                      {!ready && batch.quantityRemaining > 0 && (
                        <button
                          onClick={() => handleMarkReady(batch)}
                          className="btn-warning text-xs px-2.5 py-1.5"
                        >
                          Mark Ready Early
                        </button>
                      )}
                      <button onClick={() => handleDelete(batch)} className="btn-danger">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>


      {/* Loss & Spoilage Audit Log */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          📋 Spoilage & Loss Audit Log ({spoilageLogs.length})
        </h2>
        {spoilageLogs.length === 0 ? (
          <div className="text-sm text-slate-400 py-4">No loss or spoilage events recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Crop Variety</th>
                  <th className="p-3">Qty Lost</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Notes</th>
                  <th className="p-3">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {spoilageLogs.map(log => (
                  <tr key={log._id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-500 text-xs">{new Date(log.date).toLocaleString()}</td>
                    <td className="p-3 font-semibold text-slate-900">{log.cropName}</td>
                    <td className="p-3 font-bold text-rose-600">-{log.quantityLost} units</td>
                    <td className="p-3">
                      <span className="badge-warning">{log.reason}</span>
                    </td>
                    <td className="p-3 text-slate-600 text-xs">{log.notes || "—"}</td>
                    <td className="p-3 text-slate-500 text-xs">{log.recordedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Spoilage Modal */}
      {activeLossBatch && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                ⚠️ Record Loss for {activeLossBatch.cropName}
              </h3>
              <button
                onClick={() => setActiveLossBatch(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
              Current Available Stock: <strong className="text-slate-900">{activeLossBatch.quantityRemaining} seedlings</strong>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Quantity Lost / Damaged</label>
                <input
                  type="number"
                  min="1"
                  max={activeLossBatch.quantityRemaining}
                  placeholder="e.g. 20"
                  value={lossForm.quantityLost}
                  onChange={(e) => setLossForm({ ...lossForm, quantityLost: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Primary Reason</label>
                <select
                  value={lossForm.reason}
                  onChange={(e) => setLossForm({ ...lossForm, reason: e.target.value })}
                  className="input-field"
                >
                  {SPOILAGE_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Additional Notes</label>
                <textarea
                  rows="3"
                  placeholder="Describe cause or location in green house..."
                  value={lossForm.notes}
                  onChange={(e) => setLossForm({ ...lossForm, notes: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 justify-end">
              <button
                onClick={() => setActiveLossBatch(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSpoilage}
                className="btn-primary bg-rose-600 hover:bg-rose-700 text-white"
              >
                Confirm Spoilage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

