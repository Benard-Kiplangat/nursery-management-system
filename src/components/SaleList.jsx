import React, { useRef, useState } from "react";
import { db } from "../db";
import { generateETIMSReceipt } from "../utils/generateReceipt";
import { showToast } from "../utils/toast";

function getShopData(config = {}) {
  return {
    shopName: config.businessName || "Yeli Farm and Nursery",
    shopAddress: config.address || "Bomet-Nairobi Highway",
    shopTradeName: config.tradeName || "Leading farm in Bomet & Beyond",
    shopTel: config.businessTel || "+254 711 555 888",
    shopPin: config.kraPin || "P051234567M",
  };
}

const ETIMS_API_URL = "https://yelivate-apis.onrender.com";

function getDigitaxItemId(item) {
  return item.digitaxItemId || item.itemId || item.product?.digitaxItemId;
}

function getSaleCustomer(items) {
  const firstItem = items[0] || {};
  const customer = firstItem.customer || {};
  const name = firstItem.customerName || customer.name || customer.customerName || "Walk-in Customer";
  const pin = firstItem.customerPin || customer.pin || customer.customerTin || undefined;
  const digitaxCustomerId = firstItem.digitaxCustomerId || customer.digitaxCustomerId || undefined;

  return { name: String(name).trim() || "Walk-in Customer", pin, digitaxCustomerId };
}

function getDigitaxPaymentType(paymentMethod) {
  if (/mpesa|m-pesa/i.test(String(paymentMethod || ""))) return "05";
  if (/card/i.test(String(paymentMethod || ""))) return "02";
  if (/credit/i.test(String(paymentMethod || ""))) return "04";
  return /^\d+$/.test(String(paymentMethod || "")) ? String(paymentMethod) : "01";
}

async function getNextInvoiceNumber(prefix) {
  const counterId = `meta:receipt-invoice-counter:${prefix}`;
  const legacyKey = `${prefix}receipt-invoice-counter`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let counter;
    try {
      counter = await db.get(counterId);
    } catch (error) {
      if (error.status !== 404) throw error;
      const legacyValue = Number.parseInt(localStorage.getItem(legacyKey) || "0", 10);
      counter = {
        _id: counterId,
        type: "receipt-invoice-counter",
        prefix,
        value: Number.isFinite(legacyValue) && legacyValue >= 0 ? legacyValue : 0,
      };
    }

    const next = Number(counter.value) + 1;
    try {
      await db.put({ ...counter, value: next, updatedAt: new Date().toISOString() });
      localStorage.setItem(legacyKey, String(next));
      return `${prefix}-${new Date().getFullYear()}-${String(next).padStart(6, "0")}`;
    } catch (error) {
      if (error.status !== 409 || attempt === 2) throw error;
    }
  }

  throw new Error(`Could not allocate the next ${prefix} invoice number.`);
}

function renderLocalReceipt(items, invoiceNo, config) {

  const customer = getSaleCustomer(items);
  generateETIMSReceipt({
    ...getShopData(config),
    items,
    etims: false,
    invoiceNo,
    receiptNumber: invoiceNo,
    buyerName: customer.name,
    buyerPin: customer.pin,
    paymentMethod: items[0].paymentMethod || "Cash - Paid",
    timestamp: items[0].createdAt || items[0].timestamp || new Date().toISOString(),
  });
}

async function getStoredETIMSReceipt(items) {
  if (!items?.length) return null;

  const savedSales = await Promise.all(
    items.map(async (item) => {
      if (!item?._id) return null;

      try {
        return await db.get(item._id);
      } catch (error) {
        return null;
      }
    })
  );

  const savedSale = savedSales.find((sale) => sale && sale.receiptPayload);
  if (!savedSale) return null;

  return savedSale
}

async function persistETIMSReceipt(items, receiptPayload) {
  if (!items?.length || !receiptPayload) return;

  await Promise.all(
    items.map(async (item) => {
      if (!item?._id) return;

      try {
        const savedSale = await db.get(item._id);
        await db.put({
          ...savedSale,
          receiptPayload,
          etimsLastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        console.warn("Could not persist eTIMS receipt data for sale", item?._id, error);
      }
    })
  );
}

async function generateSaleReceipt(items, etimsMode, config) {
  if (!items?.length) return;

  if (!etimsMode) {
    const invoiceNo = await getNextInvoiceNumber("RCT");
    renderLocalReceipt(items, invoiceNo, config);
    return;
  }

  const storedReceipt = await getStoredETIMSReceipt(items);

  if (storedReceipt) {
    console.log(storedReceipt)
    generateETIMSReceipt({
      ...getShopData(config),
      etims: true,
      ...storedReceipt.receiptPayload
    });
    return;
  }

  const customer = getSaleCustomer(items);
  const invoiceNo = await getNextInvoiceNumber("ETI");
  const response = await fetch(`${ETIMS_API_URL}/api/etims/create-invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      invoiceNo,
      customerId: customer.digitaxCustomerId,
      items: items.map((item) => ({
        ...item,
        digitaxItemId: getDigitaxItemId(item),
      })),
      paymentType: getDigitaxPaymentType(items[0].paymentMethod),
    }),
  });

  const result = await response.json();
  if (!response.ok || !result?.success) {
    throw new Error(result?.error?.message || result?.error || "DigiTax could not create the invoice.");
  }

  const sale = result.invoice || {};
  const totalDiscount = result.invoice.item_list.reduce((sum, item) => sum + item.discount_amount, 0);
  const totalTaxableAmount = result.invoice.item_list.reduce((sum, item) => sum + item.taxable_amount, 0);
  const totalTax = result.invoice.item_list.reduce((sum, item) => sum + item.tax_amount, 0);
  const subtotal = result.invoice.item_list.reduce((sum, item) => sum + item.total_amount, 0) - totalDiscount;
  const total = subtotal + totalTax;
  const totalBeforeDiscount = subtotal + totalDiscount;
  const appendedNameitems = result.invoice.item_list.map((item, index) => ({
    ...item,
    name: `${items[index]?.name || "Unknown"}`,
  }));

  const receiptPayload = {
    buyerName: result.invoice.customer_name,
    buyerPin: result.invoice.customer_tin,
    invoiceNo: sale.trader_invoice_number || invoiceNo,
    cuInvoiceNo: result.cuInvoiceNo,
    timestamp: items[0].createdAt || items[0].timestamp || new Date().toISOString(),
    cuDate: sale.date,
    cuTime: sale.time,
    totalBeforeDiscount,
    totalDiscount,
    subtotal,
    totalTax,
    totalTaxableAmount,
    total,
    itemCode: result.invoice.item_list[0].etims_item_code,
    receiptNumber: sale.receipt_number,
    receiptSignature: sale.receipt_signature,
    internalData: sale.internal_data,
    qrBase64: result.qrBase64,
    items: appendedNameitems || [],
    kraInvoiceNumber: result.digitaxPayload.invoice_number,
    taxSummary: result.digitaxPayload.sales_tax_summary,
    paymentMethod: items[0].paymentMethod || "Cash - Paid",
  };

  await persistETIMSReceipt(items, receiptPayload);

  generateETIMSReceipt({
    ...getShopData(config),
    items,
    etims: true,
    ...receiptPayload,
  });
}

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

function BulkSaleGroup({
  group,
  handleEditSale,
  handleDeleteSale,
  handleMarkBulkPaid,
  onReceiptClick,
  receiptDisabled,
  isGeneratingReceipt,
}) {
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
          <div>Ksh {totalAmount}</div>
        </div>
      </div>

      {isCreditSale && (
        <div className="mb-2 text-sm bg-white rounded p-2 border border-red-200 flex justify-between items-center gap-2">
          <div>
            {isPaid
              ? <span className="text-green-600 font-bold">PAID</span>
              : bulkDwnPayment > 0
                ? <><span className="text-gray-600">Down: Ksh {bulkDwnPayment} | </span><span className="text-red-600 font-medium">Owes: Ksh {amountOwed}</span></>
                : <span className="text-red-600 font-medium">Owes full: Ksh {totalAmount} (no down payment)</span>
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
              <span className="font-medium text-sm">{sale.quantity} {sale.name}</span>
              <span className="text-xs text-gray-500 ml-2">@ Ksh {sale.sellingPrice} = Ksh {sale.total}</span>
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
        onClick={() => onReceiptClick(group.items, `bulk-${group.bulkSaleId}`)}
        disabled={receiptDisabled}
        className="mt-2 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
      >
        {isGeneratingReceipt ? "Generating receipt..." : "Receipt"}
      </button>
    </div>
  );
}

export default function SaleList({
  sales = [],
  showCreditList,
  selectedSales,
  toggleSaleSelection,
  isSelected,
  handleEditSale,
  handleDeleteSale,
  handleDeleteSaleWithStockRestore,
  handleMarkBulkPaid,
  etimsMode,
  config,
}) {
  const [generatingReceiptKey, setGeneratingReceiptKey] = useState(null);
  const receiptInProgressRef = useRef(false);
  const grouped = groupSales(sales);

  const handleReceiptClick = async (items, key) => {
    if (receiptInProgressRef.current) return;
    receiptInProgressRef.current = true;
    setGeneratingReceiptKey(key);
    try {
      await generateSaleReceipt(items, etimsMode, config);
    } catch (error) {
      console.error("DigiTax receipt error", error);
      showToast(`Could not create receipt: ${error.message}`);
    } finally {
      receiptInProgressRef.current = false;
      setGeneratingReceiptKey(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 mt-2">
      {showCreditList && (
        <div className="mt-3 space-y-2 mb-4">
          <h3 className="font-semibold">Credit Sales for the selected date.</h3>
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
                        <div key={i} className="text-sm text-gray-700">{s.quantity} {s.name} — Ksh {s.total}</div>
                      ))}
                      <div className="text-sm text-gray-600 mt-1">
                        Total: Ksh {bulkTotal}
                        {bulkDwnPayment > 0 && ` | Paid: Ksh ${bulkDwnPayment} | Owes: Ksh ${amountOwed}`}
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
                    Total: Ksh {sale.total}
                    {sale.dwnPayment > 0 && ` | Paid: Ksh ${sale.dwnPayment} | Owes: Ksh ${sale.total - sale.dwnPayment}`}
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
          onClick={() => handleReceiptClick(selectedSales, "selected")}
          disabled={Boolean(generatingReceiptKey)}
          className="bg-blue-600 text-white px-4 py-2 rounded mt-4"
        >
          {generatingReceiptKey === "selected"
            ? "Generating receipt..."
            : `Download Group Receipt (${selectedSales.length} items)`}
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
              onReceiptClick={handleReceiptClick}
              receiptDisabled={Boolean(generatingReceiptKey)}
              isGeneratingReceipt={generatingReceiptKey === `bulk-${entry.bulkSaleId}`}
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
                  {sale.isPresale ? "Ordered at" : "Sold at"}
                  <span className="px-1">
                    {new Date(sale.timestamp).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                  for {sale.total}{(sale.isCreditSale || sale.isPresale) ? sale.dwnPayment ? " shillings with a deposit of Ksh." + sale.dwnPayment : " shillings with no down payment" : "shillings"}
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
                onClick={() => handleReceiptClick([sale], `sale-${sale._id || index}`)}
                disabled={Boolean(generatingReceiptKey)}
                className="mt-1 ml-4 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                {generatingReceiptKey === `sale-${sale._id || index}`
                  ? "Generating receipt..."
                  : "Receipt"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
