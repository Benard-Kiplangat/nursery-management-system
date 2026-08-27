import React, { useState } from "react";

export default function CustomerItemCard({ customer, onEdit, onDelete }) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="border border-slate-200 rounded-xl p-3.5 bg-white shadow-2xs space-y-2 hover:border-slate-300 transition-colors">
      <div className="flex justify-between items-start gap-2">
        <div>
          <h3 className="font-bold text-slate-900 text-sm leading-snug">
            {customer.name || "Unnamed Customer"}
          </h3>
          <div className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-0.5 flex-wrap">
            {customer.phone && (
              <span>📞 {customer.phone}</span>
            )}
            {customer.email && (
              <span>✉️ {customer.email}</span>
            )}
            {!customer.phone && !customer.email && (
              <span className="italic text-slate-400">No contact info</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!showConfirm ? (
            <>
              <button
                onClick={() => onEdit(customer)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                className="text-xs font-semibold text-rose-500 hover:text-rose-700 transition-colors"
              >
                Delete
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 p-1 rounded-lg">
              <span className="text-[11px] font-bold text-rose-700">Delete?</span>
              <button
                onClick={() => {
                  onDelete(customer);
                  setShowConfirm(false);
                }}
                className="text-[11px] font-bold bg-rose-600 text-white px-2 py-0.5 rounded hover:bg-rose-700"
              >
                Yes
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="text-[11px] text-slate-600 px-1 hover:text-slate-800"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {customer.notes && (
        <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
          <span className="font-semibold text-slate-500">Notes:</span> {customer.notes}
        </div>
      )}
    </div>
  );
}
