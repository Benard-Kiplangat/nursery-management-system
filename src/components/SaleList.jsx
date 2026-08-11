import React from "react";
import { generateReceipt } from "../utils/generateReceipt";

function groupSales(sales) {
  const reversed = [...sales].reverse();
  const result = [];
  const bulkMap = {};

  reversed.forEach(sale => {
    if (sale.isBulkSale && sale.bulkSaleId) {
      if (!bulkMap[sale.bulkSaleId]) {
        const group = {
          isBulkGroup: true,
          bulkSaleId: sale.bulkSaleId,
          timestamp: sale.timestamp,
          items: [],
        };
        bulkMap[sale.bulkSaleId] = group;
        result.push(group);
      }
      bulkMap[sale.bulkSaleId].items.push(sale);
    } else {
      result.push(sale);
    }
  });

  return result;
}

function BulkSaleGroup({ group, handleEditSale, handleDeleteSale, handleDeleteSaleWithStockRestore, handleMarkBulkPaid }) {
  const totalAmount = group.items.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalQty = group.items.reduce((sum, s) => sum + (s.quantity || 0), 0);
  const isCreditSale = group.items[0]?.isCreditSale || false;
  const isPreSale = group.items[0]?.isPresale || false;
  const customerName = group.items[0]?.customerName || "";
  const bulkDwnPayment = group.items[0]?.bulkDwnPayment || 0;
  const amountOwed = totalAmount - bulkDwnPayment;
  const isPaid = group.items[0]?.isCreditPaid || false;

  const borderClass = isCreditSale ? "border-red-400 bg-red-50" : "border-purple-400 bg-purple-50";
  const badgeBg = isCreditSale ? "bg-red-600" : "bg-purple-600";

  return (
    <div className={`border-2 ${borderClass} rounded p-3`}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`${badgeBg} text-white text-xs font-bold px-2 py-0.5 rounded`}>
            {isCreditSale ? (isPreSale ? "BULK PRESALE CREDIT" : "BULK CREDIT") : (isPreSale ? "BULK PRESALE" : "BULK SALE")}
          </span>
          <span className="text-sm text-gray-500">
            {new Date(group.timestamp).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </span>
          {customerName && (
            <span className="text-sm font-semibold text-yellow-700">Customer: {customerName}</span>
          )}
        </div>
         <div className="text-sm font-bold text-right">
           <div>KES {totalAmount}</div>
         </div>
      </div>

      {isCreditSale && (
        <div className="mb-2 text-sm bg-white rounded p-2 border border-red-200 flex justify-between items-center gap-2">
          <div>
            {isPaid
              ? <span className="text-green-600 font-bold">PAID</span>
              : bulkDwnPayment > 0
                ? <><span className="text-gray-600">Down: KES {bulkDwnPayment} | </span><span className="text-red-600 font-medium">Owes: KES {amountOwed}</span></>
                : <span className="text-red-600 font-medium">Owes full: KES {totalAmount} (no down payment)</span>
            }
          </div>
          {isCreditSale && !isPaid && (
            <button
              onClick={() => handleMarkBulkPaid(group.items)}
              className="bg-green-600 text-white text-xs px-2 py-1 rounded hover:bg-green-700 whitespace-nowrap flex-shrink-0"
            >
              Mark All Paid
            </button>
          )}
        </div>
      )}

      <div className="space-y-1">
        {group.items.map((sale, idx) => (
          <div key={idx} className="bg-white rounded p-2 flex justify-between items-center">
            <div>
              <span className="font-medium text-sm">{sale.quantity} × {sale.name}</span>
              <span className="text-xs text-gray-500 ml-2">@ KES {sale.sellingPrice} = KES {sale.total}</span>
            </div>
            <div className="flex gap-2 text-xs">
              <button onClick={() => handleEditSale(sale)} className="text-green-600">Edit</button>
              <button onClick={() => handleDeleteSale(sale)} className="text-red-600">Delete</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 text-xs text-gray-500">{group.items.length} items — {totalQty} units total</div>

      <button
        onClick={() => generateReceipt(group.items)}
        className="mt-2 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
      >
        Receipt
      </button>
    </div>
  );
}

export default function SaleList({
  sales = [],
  showCreditList,
  setShowCreditList,
  selectedSales,
  toggleSaleSelection,
  isSelected,
  handleEditSale,
  handleDeleteSale,
  handleDeleteSaleWithStockRestore,
  handleMarkBulkPaid,
}) {
  const grouped = groupSales(sales);

  return (
    <div className="flex flex-col gap-2 mt-2">
      {showCreditList && (
        <div className="mt-3 space-y-2 mb-4">
          <h3 className="font-semibold">Credit Sales (selected date)</h3>
          {sales.filter(s => s.isCreditSale).length === 0 && <div className="text-sm text-gray-600">No credit sales.</div>}
          {groupSales(sales.filter(s => s.isCreditSale)).map((entry, idx) => {
            if (entry.isBulkGroup) {
                          const bulkTotal = entry.items.reduce((s, i) => s + (i.total || 0), 0);
              const bulkDwnPayment = entry.items[0]?.bulkDwnPayment || 0;
              const amountOwed = bulkTotal - bulkDwnPayment;
              const isPaid = entry.items[0]?.isCreditPaid || false;
              return (
                <div key={`credit-bulk-${entry.bulkSaleId}`} className="max-w-xl px-3 pt-2 pb-2 rounded border bg-red-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded">BULK CREDIT</span>
                        <span className="font-semibold">{entry.items[0]?.customerName || <span className="italic text-gray-400">No name</span>}</span>
                      </div>
                      {entry.items.map((s, i) => (
                        <div key={i} className="text-sm text-gray-700">{s.quantity} × {s.name} — KES {s.total}</div>
                      ))}
                      <div className="text-sm text-gray-600 mt-1">
                        Total: KES {bulkTotal}
                        {bulkDwnPayment > 0 && ` | Paid: KES ${bulkDwnPayment} | Owes: KES ${amountOwed}`}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                      {isPaid
                        ? <span className="text-green-600 font-semibold text-sm">PAID</span>
                        : <>
                            <span className="text-red-600 font-semibold text-sm">UNPAID</span>
                            <button
                              onClick={() => handleMarkBulkPaid(entry.items)}
                              className="bg-green-600 text-white text-xs px-2 py-1 rounded hover:bg-green-700 whitespace-nowrap"
                            >
                              Mark Paid
                            </button>
                          </>
                      }
                    </div>
                  </div>
                </div>
              );
            }

            const sale = entry;
            return (
              <div key={`credit-${idx}`} className="max-w-xl px-3 pt-2 pb-2 rounded flex justify-between border bg-red-50">
                <div>
                  <div className="font-medium">{sale.quantity} × {sale.name}</div>
                  {sale.customerName && (
                    <div className="text-sm text-yellow-700 font-medium">Customer: {sale.customerName}</div>
                  )}
                  <div className="text-sm text-gray-600">
                    Total: KES {sale.total}
                    {sale.dwnPayment > 0 && ` | Paid: KES ${sale.dwnPayment} | Owes: KES ${sale.total - sale.dwnPayment}`}
                  </div>
                  <div className="mt-1 flex gap-2">
                    <button onClick={() => handleEditSale(sale)} className="text-green-600 text-sm">Edit</button>
                    <button onClick={() => handleDeleteSaleWithStockRestore(sale)} className="text-blue-600 text-sm">Delete</button>
                  </div>
                </div>
                <div className="text-sm flex-shrink-0 ml-2">
                  {sale.isCreditPaid
                    ? <span className="text-green-600 font-semibold">PAID</span>
                    : <span className="text-red-600 font-semibold">UNPAID</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedSales.length > 0 && (
        <button
          onClick={() => generateReceipt(selectedSales)}
          className="bg-blue-600 text-white px-4 py-2 rounded mt-4"
        >
          Download Group Receipt ({selectedSales.length} items)
        </button>
      )}

      {grouped.map((entry, index) => {
        if (entry.isBulkGroup) {
          return (
            <BulkSaleGroup
              key={`bulk-${entry.bulkSaleId}`}
              group={entry}
              handleEditSale={handleEditSale}
              handleDeleteSale={handleDeleteSale}
              handleDeleteSaleWithStockRestore={handleDeleteSaleWithStockRestore}
              handleMarkBulkPaid={handleMarkBulkPaid}
            />
          );
        }

        const sale = entry;
        return (
          <div key={index} className="border p-3 rounded">
            <div className="flex justify-between items-center">
              <div className="flex flex-col justify-between">
                <div className="font-semibold">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={isSelected(sale) || false}
                    onChange={() => toggleSaleSelection(sale)}
                  />
                  {sale.quantity} {sale.name}
                  <span className="text-sm text-red-600 px-1">
                    {sale.isPresale && (
  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
    PRESALE
  </span>
)}
                    {sale.isCreditSale ? "Credit Sale" : ""}
                  </span>
                  {sale.isCreditSale && sale.isCreditPaid && (
                    <span className="text-sm text-green-600 px-1"> (PAID)</span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  Sold at
                  <span className="px-1">
                    {new Date(sale.timestamp).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                  for Ksh. {sale.total}{sale.isCreditSale ? sale.dwnPayment ? " with a down payment of " + sale.dwnPayment : " with no down payment" : ""}
                </div>
                {sale.customerName && (
                  <div className="text-sm text-yellow-700 font-medium mt-0.5">
                    Customer: {sale.customerName}
                  </div>
                )}
                <div className="flex gap-3 mt-1">
                  <button onClick={() => handleEditSale(sale)} className="text-green-600 text-sm">Edit</button>
                  <button onClick={() => handleDeleteSale(sale)} className="text-red-600 text-sm">Delete</button>
                </div>
              </div>
              <button
                onClick={() => generateReceipt([sale])}
                className="mt-1 ml-4 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                Receipt
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
