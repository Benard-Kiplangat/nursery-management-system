import React, { useRef, useState } from "react";
import { db } from "../db";
import { generateETIMSReceipt } from "../utils/generateReceipt";
import { showToast } from "../utils/toast";

function getShopData(config = {}) {
  return {
    shopName: config.businessName || "",
    shopAddress: config.address || "",
    shopTradeName: config.tradeName || "",
    shopTel: config.businessTel || "",
    shopPin: config.kraPin || "",
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

  const total = items.reduce((sum, item) => item.total + sum, 0);
  const totalDiscount = items.reduce((sum, item) => item.discount + sum, 0);

  const customer = getSaleCustomer(items);
  generateETIMSReceipt({
    ...getShopData(config),
    items,
    totalDiscount,
    totalBeforeDiscount: total + totalDiscount,
    etims: false,
    invoiceNo,
    receiptNumber: invoiceNo,
    buyerName: customer.name,
    buyerPin: customer.pin,
    paymentMethod: items[0].paymentMethod || "Cash - Paid",
    timestamp: items[0].timestamp || items[0].createdAt || new Date().toISOString(),
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
    generateETIMSReceipt({
      ...getShopData(config),
      etims: true,
      ...storedReceipt.receiptPayload
    });
    return;
  }

  const customer = getSaleCustomer(items);
  const invoiceNo = await getNextInvoiceNumber("ETI");

  const invoiceData = {
  cuInvoiceNo: "001234567",
  date: "",
  time: "",
  taxSummary: [{label: "VAT", rate: "16%", taxableAmount: 0, taxAmount:0}, {label: "VAT", rate: "8%", taxableAmount: 0, taxAmount:0}, {label: "Zero Rated", rate: "0%", taxableAmount: 0, taxAmount:0}, {label: "Exempted", rate: "0%", taxableAmount: items[0]?.bulkTotal || items[0].total, taxAmount:0}],
  receiptType: "Training",
  qrBase64: "data:image/png;base64,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"
};

 /* const response = await fetch(`${ETIMS_API_URL}/api/etims/create-invoice`, {
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
  }*/

  const result = {};
  const sale = result.invoice || {};
  const total = items.reduce((sum, item) => sum + item.total, 0) || totalBeforeDiscount + totalTax - totalDiscount;
  const totalDiscount = items.reduce((sum, item) => sum + item.discount, 0) || result?.invoice?.item_list?.reduce((sum, item) => sum + item.discount_amount, 0);
  const totalTaxableAmount = total || result?.invoice?.item_list.reduce((sum, item) => sum + item.taxable_amount, 0);
  const totalTax = result?.invoice?.item_list?.reduce((sum, item) => sum + item.tax_amount, 0);
  const totalBeforeDiscount = (total + totalDiscount) || result?.invoice?.item_list.reduce((sum, item) => sum + item.total_amount, 0);
  const appendedNameitems = result?.invoice?.item_list.map((item, index) => ({
    ...item,
    name: `${items[index]?.name || "Unknown"}`,
  }));

  const receiptPayload = {
    buyerName: result?.invoice?.customer_name || items[0].customerName,
    buyerPin: result?.invoice?.customer_tin || items[0].customerPin,
    invoiceNo: sale?.trader_invoice_number || invoiceNo,
    cuInvoiceNo: result?.cuInvoiceNo || invoiceData.cuInvoiceNo,
    timestamp: items[0].timestamp || items[0].createdAt || new Date().toISOString(),
    totalBeforeDiscount,
    totalDiscount,
    totalTax,
    totalTaxableAmount,
    total,
    itemCode: result?.invoice?.item_list[0].etims_item_code || "",
    receiptNumber: sale?.receipt_number || invoiceNo,
    receiptSignature: sale?.receipt_signature,
    internalData: sale?.internal_data,
    qrBase64: result?.qrBase64 || invoiceData.qrBase64,
    items: appendedNameitems || items || [],
    kraInvoiceNumber: result?.digitaxPayload?.invoice_number || invoiceNo,
    taxSummary: result?.digitaxPayload?.sales_tax_summary || invoiceData.taxSummary,
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
  const customerName = group.items[0]?.customerName || "";
  const bulkDwnPayment = group.items[0]?.bulkDwnPayment || 0;
  const amountOwed = totalAmount - bulkDwnPayment;
  const isPaid = group.items[0]?.isCreditPaid || false;

  const borderClass = isCreditSale ? "border-red-400 bg-red-50" : "border-purple-400 bg-purple-50";

  return (
    <div className={`border-2 ${borderClass} rounded p-3`}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2 flex-wrap">
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
              <span className="text-xs text-gray-500 ml-2">@ Ksh {sale.sellingPrice} {sale.discount ? `with a discount of ${sale.discount})` : '' } = Ksh {sale.total}</span>
            </div>
            <div className="flex gap-2 text-xs">
              <button onClick={() => handleEditSale(sale)} className="text-green-600">Edit</button>
              <button onClick={() => handleDeleteSale(sale)} className="text-red-600">Delete</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 text-xs text-gray-500 flex justify-between">
        <span>{group.items.length} items, {totalQty} units total</span>

      <button
        onClick={() => onReceiptClick(group.items, `bulk-${group.bulkSaleId}`)}
        disabled={receiptDisabled}
        className="mt-2 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
      >
        {isGeneratingReceipt ? "Generating receipt..." : "Receipt"}
      </button>
      </div>
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
                        <div key={i} className="text-sm text-gray-700">{s.quantity} {s.name} — Ksh {s.total} {s.discount ? `(discount ${s.discount})` : '' }</div>
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
                  for {sale.total} {" shillings"} {sale.discount ? ` with a discount of ${sale.discount}` : ""} {(sale.isCreditSale || sale.isPresale) ? sale.dwnPayment ? " and a deposit of " + sale.dwnPayment : " with no down payment" : ""}
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
