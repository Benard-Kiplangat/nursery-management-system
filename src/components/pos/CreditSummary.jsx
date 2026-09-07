import React from "react";

export default function CreditSummary({ customerCredits, grandCreditTotal }) {
  return (
    <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl shadow-sm space-y-3">
      <h2 className="text-base font-bold text-amber-900 flex items-center justify-between">
        <span>📋 Customer Debts</span>
        <span className="badge-warning">Ksh {grandCreditTotal.toLocaleString()}</span>
      </h2>
      <div className="space-y-2 max-h-[350px] overflow-y-auto">
        {customerCredits.map(customer => (
          <div
            key={customer.name}
            className="bg-white border border-amber-200 rounded-xl p-3 text-xs space-y-1"
          >
            <div className="font-bold text-slate-900 flex justify-between">
              <span>{customer.name}</span>
              <div className="text-xs text-slate-500">
                <span className="text-gray-500">
                  Date: {new Date(customer.date).toLocaleDateString() || "N/A"}
                </span>
              </div>
            </div>
            {customer.entries.map((entry, index) => (
              <div key={index} className="text-slate-500">
                {entry.label}: Ksh {entry.owed}
              </div>
            ))}
            <hr />
            <div className="flex justify-between pt-2 text-rose-600 font-bold">
              <span className="pr-4">Total Owed:</span>
              <span>Ksh {customer.totalOwed}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
