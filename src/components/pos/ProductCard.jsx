import React from "react";
import { getBatchDisplayName, getStockAlertStatus, isBatchReady } from "../../db";
import { getEligibleBatches } from "../../utils/batchSelection";

export default function ProductCard({
  product,
  batches,
  availableBatches,
  selectedBatches,
  quantities,
  sellingPrices,
  creditSales,
  presales,
  customerNames,
  downPayment,
  customers,
  onBatchChange,
  onCustomerChange,
  onPriceChange,
  onQuantityChange,
  onPresaleToggle,
  onCreditToggle,
  onDownPaymentChange,
  onSell,
  onAddToCart
}) {
  const qty = quantities[product._id] || 1;
  const subtotal = qty * Number(sellingPrices[product._id] || product.price);
  const total = subtotal;
  const available = availableBatches.reduce(
    (sum, batch) => sum + Number(batch.availableForSale || 0),
    0
  );
  const isPresale = presales[product._id] || false;
  const selectableBatches = getEligibleBatches(availableBatches, isPresale);
  const alertInfo = getStockAlertStatus(product, available);
  const canSell = selectableBatches.length > 0;

  return (
    <div className="card-elevated p-2.5 space-y-2.5">
      {/* Product header */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span className="truncate">{product.name}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Ksh {Number(product.price || 0).toLocaleString()} each · Matures in{" "}
              {product.daysToReady} days
            </div>
          </div>
          <span
            className={`hidden sm:inline-flex ${
              alertInfo.status === "out_of_stock"
                ? "badge-danger"
                : alertInfo.status === "low_stock"
                  ? "badge-warning"
                  : "badge-success"
            }`}
          >
                          {available} in stock
          </span>
        </div>

        <div>
          <label className="text-xs text-slate-500 font-semibold">
            Batch
            <select
              value={
                selectableBatches.some(
                  batch => batch._id === selectedBatches[product._id]
                )
                  ? selectedBatches[product._id]
                  : selectableBatches[0]?._id || ""
              }
              onChange={e => onBatchChange(product._id, e.target.value)}
              disabled={!canSell}
              className="input-field mt-0.5 text-xs py-1.5"
            >
              {selectableBatches.length === 0 ? (
                <option value="">
                  {isPresale ? "No available batches" : "No ready batches"}
                </option>
              ) : (
                selectableBatches.map(batch => (
                  <option key={batch._id} value={batch._id}>
                    {getBatchDisplayName(batch)}:{" "}
                    {!isBatchReady(batch)
                      ? `${batch.availableForSale} available (Growing)`
                      : `${batch.availableForSale} available`}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
      </div>

      {/* Selling controls */}
      <div className="rounded-lg bg-slate-50 border border-slate-100 p-1.5 space-y-1.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 items-end">
          <label className="text-xs text-slate-500 font-semibold">
            Price (Ksh)
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Price"
              className="input-field mt-0.5 text-sm py-1.5"
              value={sellingPrices[product._id] ?? product.price}
              onChange={e => onPriceChange(product._id, e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-500 font-semibold">
            Quantity
            <input
              type="number"
              min="1"
              step="1"
              max={available}
              className="input-field mt-0.5 text-sm py-1.5"
              value={quantities[product._id] ?? 1}
              onChange={e => onQuantityChange(product._id, e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
            <label className="flex items-center gap-1 text-[11px] text-slate-600 bg-emerald-50 px-2 py-1 rounded-md cursor-pointer border border-slate-200">
              <input
                type="checkbox"
                checked={presales[product._id] || false}
                onChange={() => onPresaleToggle(product._id)}
                className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>Presale</span>
            </label>
            <label className="flex items-center gap-1 text-[11px] text-slate-600 bg-emerald-50 border border-slate-200 px-2 py-1 rounded-md cursor-pointer">
              <input
                type="checkbox"
                checked={creditSales[product._id] || false}
                onChange={() => onCreditToggle(product._id)}
                className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>Credit</span>
            </label>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-slate-500">Total</div>
            <div className="text-base font-bold text-emerald-700">
              Ksh {total.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Customer / credit details only when needed */}
      {(creditSales[product._id] || presales[product._id]) && (
        <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-100">
          <label className="text-xs text-slate-500 font-semibold">
            Customer
            {customers.length > 0 ? (
              <select
                className="input-field mt-0.5 text-xs py-1"
                value={customerNames[product._id] || ""}
                onChange={e => onCustomerChange(product._id, e.target.value)}
              >
                <option value="">Select customer</option>
                {customers.map(customer => (
                  <option key={customer._id} value={customer.name}>
                    {customer.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Walk-in customer"
                className="input-field mt-0.5 text-xs py-1"
                value={customerNames[product._id] || ""}
                onChange={e => onCustomerChange(product._id, e.target.value)}
              />
            )}
          </label>
          <label className="text-xs text-slate-500 font-semibold">
            Deposit
            <input
              type="number"
              min="0"
              placeholder="Down Payment"
              className="input-field mt-0.5 text-xs py-1 px-2"
              value={downPayment[product._id] ?? ""}
              onChange={e => onDownPaymentChange(product._id, e.target.value)}
            />
          </label>
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => onSell(product)}
          disabled={!canSell}
          className="btn-primary text-xs py-1 px-3"
        >
          Quick Sell
        </button>
        <button
          onClick={() => onAddToCart(product)}
          disabled={!canSell}
          className="btn-secondary text-xs py-1 px-3"
        >
          + Cart
        </button>
      </div>
    </div>
  );
}
