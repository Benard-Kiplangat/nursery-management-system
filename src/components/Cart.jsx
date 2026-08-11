import React, { useState } from "react";

export default function Cart({ cart, onUpdateQty, onUpdatePrice, onRemoveItem, onClearCart, onMakeSale, customers = []}) {
  const [isCredit, setIsCredit] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [dwnPayment, setDwnPayment] = useState(0);

  const cartTotal = cart.reduce((sum, item) => sum + item.qty * (item.sellingPrice || item.product.price), 0);
  const isPresale = cart.some(item => item.isPresale);
  const amountOwed = cartTotal - dwnPayment;
const handleSale = () => {
  const hasPresale = cart.some(item => item.isPresale);
  const hasNormalSale = cart.some(item => !item.isPresale);

  if (hasPresale && hasNormalSale) {
    alert(
      "A sale cannot contain both normal-sale and presale items. Please separate them into different sales."
    );
    return;
  }

  if (hasPresale && !customerName.trim()) {
    alert("Please select a customer for a presale.");
    return;
  }

  if (isCredit && !customerName.trim()) {
    alert("Please select a customer for a credit sale.");
    return;
  }

  onMakeSale({
    isCreditSale: isCredit,
    isPresale: hasPresale,
    customerName: customerName.trim(),
    dwnPayment: Number(dwnPayment)
  });
};

  const handleClear = () => {
    setIsCredit(false);
    setCustomerName("");
    setDwnPayment(0);
    onClearCart();
  };

  return (
    <div className="p-4 border rounded bg-gray-50 w-full flex flex-col gap-2 self-start sticky top-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold flex items-center gap-2">
  Cart {cart.length > 0 && `(${cart.length})`}

  {isPresale && (
    <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
      PRESALE
    </span>
  )}
</h2>
        {cart.length > 0 && (
          <button onClick={handleClear} className="text-red-500 text-sm hover:text-red-700 font-medium">
            Clear All
          </button>
        )}
      </div>

      {cart.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">Cart is empty</p>
      ) : (
        <>
          <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
            {cart.map(item => (
              <div key={item.batch._id} className="border rounded p-2 bg-white">
                <div className="flex justify-between items-start mb-1">
                  <div className="leading-tight">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{item.product.name}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      Batch: {new Date(item.batch.datePlanted).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.batch._id)}
                    className="text-red-400 text-sm hover:text-red-600 ml-1 flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex gap-1 items-center flex-wrap">
                  <label className="text-xs text-gray-500">Qty</label>
                  <input
                    type="number"
                    min="1"
                    className="border p-1 w-12 rounded text-sm"
                    value={item.qty ?? 1}
                    onChange={e => onUpdateQty(item.batch._id, parseInt(e.target.value, 10) || 1)}
                  />
                  <label className="text-xs text-gray-500">@</label>
                  <input
                    type="number"
                    className="border p-1 w-16 rounded text-sm"
                    value={item.sellingPrice ?? item.product.price}
                    onChange={e => onUpdatePrice(item.batch._id, parseInt(e.target.value, 10) || 0)}
                  />
                  <span className="text-sm font-semibold">= {item.qty * item.sellingPrice}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-2 space-y-1">
            <div className="text-sm font-bold">Total: KES {cartTotal}</div>
          </div>

          <div className="border rounded p-2 bg-white space-y-2">
            <div className="space-y-2 pt-1 border-t">
                <select
                  className="w-full border p-1.5 rounded text-sm"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                >
                  <option value="">Select customer</option>
                  {customers.map(c => (
                    <option key={c._id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              )

              <input
                type="number"
                placeholder="Down payment"
                className="w-full border p-1.5 rounded text-sm"
                value={dwnPayment}
                min="0"
                onChange={e => setDwnPayment(Number(e.target.value) || 0)}
              />

              {dwnPayment > 0 && (
                <div className="text-xs text-red-600 font-medium">
                  Owes after payment: KES {Math.max(0, amountOwed)}
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCredit}
                  onChange={e => {
                    setIsCredit(e.target.checked);
                    if (!e.target.checked) { setCustomerName(""); setDwnPayment(0); }
                  }}
                />
                <span className="text-sm font-medium text-red-700">Credit Sale?</span>
              </label>
            </div>
          </div>

          <button
            onClick={handleSale}
            className={`text-white px-3 py-2 rounded font-semibold w-full ${isCredit ? "bg-red-600 hover:bg-red-700" : "bg-purple-600 hover:bg-purple-700"}`}
          >
            {isCredit ? "Make Bulk Credit Sale" : "Make Bulk Sale"} ({cart.length} items)
          </button>
        </>
      )}
    </div>
  );
}
