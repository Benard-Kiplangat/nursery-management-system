import React from "react";

export default function EditSaleModal({ editingSale, handleEditChange, handleSaveEdit, handleCancelEdit }) {
  if (!editingSale) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded w-full max-w-lg">
        <h2 className="text-lg font-semibold mb-3">Edit Sale</h2>

        <div className="space-y-2">
          <label className="block">
            <div className="text-sm">Crop name</div>
            <input
              value={editingSale.name}
              onChange={(e) => handleEditChange("name", e.target.value)}
              className="w-full border p-2 rounded"
            />
          </label>

          <label className="block">
            <div className="text-sm">Quantity</div>
            <input
              type="number"
              value={editingSale.quantity}
              onChange={(e) => handleEditChange("quantity", Number(e.target.value))}
              className="w-full border p-2 rounded"
            />
          </label>

          <label className="block">
            <div className="text-sm">Total</div>
            <input
              type="number"
              value={editingSale.total}
              onChange={(e) => handleEditChange("total", Number(e.target.value))}
              className="w-full border p-2 rounded"
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!editingSale.isCreditSale}
              onChange={(e) => handleEditChange("isCreditSale", e.target.checked)}
            />
            <span className="text-sm">Is Credit Sale</span>
          </label>

          {editingSale.isCreditSale && (
            <>
              <label className="block">
                <div className="text-sm">Customer Name</div>
                <input
                  type="text"
                  value={editingSale.customerName || ""}
                  onChange={(e) => handleEditChange("customerName", e.target.value)}
                  placeholder="Enter customer name"
                  className="w-full border p-2 rounded"
                />
              </label>

              <label className="block">
                <div className="text-sm">Down Payment</div>
                <input
                  type="number"
                  value={editingSale.dwnPayment}
                  onChange={(e) => {
                    handleEditChange("dwnPayment", Number(e.target.value));
                    if (Number(e.target.value) === editingSale.total) {
                      handleEditChange("isCreditPaid", true);
                    }
                  }}
                  className="w-full border p-2 rounded"
                />
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!editingSale.isCreditPaid}
                  onChange={(e) => handleEditChange("isCreditPaid", e.target.checked)}
                />
                <span className="text-sm">Mark Credit as Paid</span>
              </label>
            </>
          )}

          <div className="flex justify-end gap-2 mt-3">
            <button onClick={handleCancelEdit} className="px-3 py-1 rounded bg-gray-200">Cancel</button>
            <button onClick={handleSaveEdit} className="px-3 py-1 rounded bg-blue-600 text-white">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
