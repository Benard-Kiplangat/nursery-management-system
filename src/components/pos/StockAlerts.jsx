import React from "react";

export function StockAlertPreview({ count, onOpen }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between shadow-sm max-w-xl">
      <div className="flex items-center gap-2">
        <span className="text-lg">⚠️</span>
        <div>
          <div className="font-bold text-xs text-amber-900">Low Stock Alert</div>
          <div className="text-[11px] text-amber-700">
            {count} crops running low
          </div>
        </div>
      </div>
      <button onClick={onOpen} className="btn-warning text-xs px-2.5 py-1">
        View List
      </button>
    </div>
  );
}

export default function StockAlerts({ products, onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <span>⚠️ Low Stock Crops</span>
            <span className="badge-warning">{products.length} items</span>
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold"
          >
            ✕
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-2">Crop Name</th>
                <th className="p-2">Available for Sale</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map(product => {
                const threshold =
                  product.minStockThreshold != null
                    ? Number(product.minStockThreshold)
                    : 25;
                const isOut = product.availableForSale <= 0;

                return (
                  <tr key={product._id} className="hover:bg-slate-50 pt-1">
                    <td className="font-semibold text-slate-900">{product.name}</td>
                    <td
                      className={`font-bold ${product.availableForSale <= 0
                          ? "text-rose-600"
                          : "text-amber-600"
                        }`}
                    >
                      {product.availableForSale} units
                    </td>
                    <td className="py-0.5">
                      <span className={isOut ? "badge-danger" : "badge-warning"}>
                        {isOut ? "Out of Stock" : "Low Stock"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
