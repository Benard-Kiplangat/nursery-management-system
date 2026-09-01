import React from "react";

export default function AddCustomerModal({
  open,
  form,
  saving,
  onChange,
  onSave,
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div>
            <h2 className="font-bold text-slate-900">
              Add New Customer
            </h2>
            <p className="text-xs text-slate-500">
              Enter customer details
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100
                       text-slate-500 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-3">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Customer Name <span className="text-rose-500">*</span>
            </label>

            <input
              autoFocus
              type="text"
              value={form.name}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5
                         text-sm focus:outline-none focus:ring-2
                         focus:ring-blue-500"
            />
          </div>

          {/* KRA PIN */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Company KRA PIN
            </label>

            <input
              type="text"
              value={form.krapin}
              onChange={(e) => onChange("krapin", e.target.value)}
              placeholder="e.g. P051234567A"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5
                         text-sm uppercase focus:outline-none focus:ring-2
                         focus:ring-blue-500"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Phone Number
            </label>

            <input
              type="tel"
              value={form.phone}
              onChange={(e) => onChange("phone", e.target.value)}
              placeholder="e.g. 0712345678"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5
                         text-sm focus:outline-none focus:ring-2
                         focus:ring-blue-500"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Email
            </label>

            <input
              type="email"
              value={form.email}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="john@example.com"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5
                         text-sm focus:outline-none focus:ring-2
                         focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Notes / Address
            </label>

            <textarea
              value={form.notes}
              onChange={(e) => onChange("notes", e.target.value)}
              placeholder="Farm location, address, etc..."
              rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5
                         text-sm resize-none focus:outline-none focus:ring-2
                         focus:ring-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 bg-slate-100 hover:bg-slate-200
                         text-slate-700 font-semibold text-sm
                         py-2.5 rounded-xl transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={saving || !form.name.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700
                         disabled:opacity-50 disabled:cursor-not-allowed
                         text-white font-bold text-sm
                         py-2.5 rounded-xl transition-colors"
            >
              {saving ? "Saving..." : "Save Customer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}