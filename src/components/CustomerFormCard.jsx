import React from "react";

export default function CustomerFormCard({
  form,
  editingCustomer,
  saving,
  onChange,
  onSave,
  onCancel,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
      <h2 className="text-base font-bold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-2">
        <span>{editingCustomer ? "✏️ Edit Customer" : "👤 Add New Customer"}</span>
      </h2>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Customer Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. John Doe"
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
          />
        </div>
        <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
            Company KRA Pin
        </label>
        <input
            type="text"
            className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. John Doe"
            value={form.krapin}
            onChange={(e) => onChange("krapin", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
          <input
            type="text"
            className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. 0712345678"
            value={form.phone}
            onChange={(e) => onChange("phone", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
          <input
            type="email"
            className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. john@example.com"
            value={form.email}
            onChange={(e) => onChange("email", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Address</label>
          <textarea
            className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Additional details, farm location, address, etc..."
            value={form.notes}
            onChange={(e) => onChange("notes", e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-colors shadow-2xs"
          >
            {saving
              ? "Saving..."
              : editingCustomer
              ? "Update Customer"
              : "Save Customer"}
          </button>
          {editingCustomer && (
            <button
              type="button"
              onClick={onCancel}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-2.5 px-4 rounded-xl transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
