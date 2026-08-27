import React from "react";

export default function UserFormCard({
  form,
  editingUser,
  saving,
  onChange,
  onSave,
  onCancel,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
      <h2 className="text-base font-bold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-2">
        <span>{editingUser ? "✏️ Edit User Account" : "👤 Add New User Account"}</span>
      </h2>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Username <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. cashier1"
            value={form.username}
            onChange={(e) => onChange("username", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Password {editingUser ? "(Optional)" : "*"}
          </label>
          <input
            type="password"
            className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={
              editingUser
                ? "Leave blank to keep current password"
                : "Enter account password"
            }
            value={form.password}
            onChange={(e) => onChange("password", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">System Role</label>
          <select
            className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={form.role}
            onChange={(e) => onChange("role", e.target.value)}
          >
            <option value="staff">Staff (Sales & POS)</option>
            <option value="admin">Admin (Full Access)</option>
          </select>
        </div>

        <div className="pt-1 space-y-2 border-t border-slate-100">
          <span className="block text-xs font-bold text-slate-700">Permissions</span>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.canViewProfit}
              onChange={(e) => onChange("canViewProfit", e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            Can view sales profit numbers
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.canViewStock}
              onChange={(e) => onChange("canViewStock", e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            Can view stock quantity counts
          </label>
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
              : editingUser
              ? "Update User Account"
              : "Create User Account"}
          </button>
          {editingUser && (
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
