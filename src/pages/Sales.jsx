import React, { useEffect, useState } from "react";
import { db } from "../db";
import { formatWhole } from "../utils/format";
import WeeklySummary from "../components/WeeklySummary";
import MonthlySummary from "../components/MonthlySummary";
import SaleList from "../components/SaleList";
import EditSaleModal from "../components/EditSaleModal";
import CropSummary from "../components/CropSummary";
import CustomerSummary from "../components/CustomerSummary";
import Presale from "./Presale";
import { useAuth } from "../context/AuthContext";
import { useBusinessConfig } from "../config";

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [editingSale, setEditingSale] = useState(null);
  const [showCreditList, setShowCreditList] = useState(false);
  const [cropSummaries, setCropSummaries] = useState({});
  const [summary, setSummary] = useState({ cashReceived: 0, totalRevenue: 0, totalCreditSales: 0 });
  const [viewMode, setViewMode] = useState("todaySales");
  const [selectedSales, setSelectedSales] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [salesSearch, setSalesSearch] = useState("");
  const [searchRange, setSearchRange] = useState("week");
  const [purchases, setPurchases] = useState([]);
  const [etimsMode, setEtimsMode] = useState(() => {
    return localStorage.getItem("etimsMode") === "true";
  });

  const { config } = useBusinessConfig();

  useEffect(() => {
    loadSales();
    loadPurchases();
  }, []);

  useEffect(() => {
    calculateSummary(sales);
  }, [sales, purchases, selectedDate]);

  const loadPurchases = async () => {
    try {
      const result = await db.allDocs({
        include_docs: true,
      });

      const purchaseDocs = result.rows
        .map(row => row.doc)
        .filter(
          doc =>
            doc &&
            doc.type === "purchase"
        );

      setPurchases(purchaseDocs);
    } catch (error) {
      console.error(
        "Failed to load purchases:",
        error
      );
    }
  };

  const loadSales = async (dateStr) => {
    const result = await db.allDocs({ include_docs: true });
    const salesDocs = result.rows.map(row => row.doc).filter(doc => doc.type === "sale");
    setAllSales(salesDocs);
    const usedDate = dateStr || selectedDate;
    const [y, m, d] = usedDate.split('-').map(Number);
    const today = new Date(y, m - 1, d).toLocaleDateString();

    const todaySales = salesDocs.filter(sale =>
      new Date(sale.timestamp).toLocaleDateString() === today
    );

    setSales(todaySales);

    const grouped = {};
    salesDocs.forEach(sale => {
      const dateKey = new Date(sale.timestamp).toLocaleDateString();
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(sale);
    });

    const cropSummary = {};
    todaySales.forEach(sale => {
      if (!cropSummary[sale.name]) {
        cropSummary[sale.name] = { quantity: 0, revenue: 0 };
      }
      cropSummary[sale.name].quantity += sale.quantity;
      cropSummary[sale.name].revenue += sale.total;
    });
    setCropSummaries(cropSummary);

    const summaryByDate = {};
    for (let date in grouped) {
      const totalCreditSales = handleTotalCreditSales(grouped[date]);
      const total = grouped[date].reduce((acc, sale) => ({
        totalSales: acc.totalSales + sale.quantity,
        totalRevenue: acc.totalRevenue + sale.total,
        creditSales: totalCreditSales,
      }), { totalSales: 0, totalRevenue: 0, creditSales: 0 });
      summaryByDate[date] = total;
    }
  };

  const calculateSummary = (salesList) => {
    const cashReceived = salesList.reduce(
      (sum, sale) => {
        // Presale: use actual payment history
        if (
          sale.isPresale &&
          Array.isArray(sale.paymentHistory)
        ) {
          return (
            sum +
            sale.paymentHistory.reduce(
              (paymentSum, payment) =>
                paymentSum +
                Number(payment.amount || 0),
              0
            )
          );
        }

        // Credit sale: only amount actually paid
        if (sale.isCreditSale) {
          return (
            sum +
            Number(sale.dwnPayment || 0)
          );
        }

        // Normal sale: full amount is received
        return sum + Number(sale.total || 0);
      },
      0
    );
    const totalCreditSales = salesList.filter((x) => (x.isCreditSale)).reduce((sum, s) => sum + s.total, 0) - (salesList.filter((x) => x.isCreditSale).reduce((sum, s) => sum + (s.dwnPayment || 0), 0));
    const totalRevenue = (salesList.filter((x) => x).reduce((sum, s) => sum + s.total, 0));

    const [y, m, d] = selectedDate.split('-').map(Number);
    const today = new Date(y, m - 1, d).toLocaleDateString();

    setSummary({ cashReceived, totalRevenue, totalCreditSales });
  };

  const handleDeleteSale = async (sale) => {
    if (window.confirm("Are you sure you want to delete this sale?")) {
      await db.remove(sale);
      loadSales();
    }
  };

  const handleEditSale = async (sale) => {
    setEditingSale({
      ...sale,
      quantity: Number(sale.quantity) || 0,
      total: Number(sale.total) || 0,
      isCreditSale: !!sale.isCreditSale,
      isCreditPaid: !!sale.isCreditPaid,
    });
  };

  const handleEditChange = (field, value) => {
    setEditingSale(prev => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  };

  const handleSaveEdit = async () => {
    if (!editingSale) return;
    if (!editingSale.name) { alert('Crop name is required'); return; }
    const toSave = {
      ...editingSale,
      quantity: Number(editingSale.quantity),
      total: Number(editingSale.total),
      isCreditSale: !!editingSale.isCreditSale,
      isCreditPaid: !!editingSale.isCreditPaid,
      dwnPayment: editingSale.isCreditPaid ? editingSale.total : editingSale.dwnPayment,
    };
    try {
      await db.put(toSave);
      setEditingSale(null);
      loadSales();
    } catch (err) {
      console.error('Failed to save sale', err);
      alert('Failed to save sale. See console for details.');
    }
  };

  const handleCancelEdit = () => setEditingSale(null);

  const handleTotalCreditSales = (salesList) => {
    const creditSales = salesList.filter((x) => x.isCreditSale);
    const total = creditSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const down = creditSales.reduce((sum, s) => sum + (s.dwnPayment || 0), 0);
    return total - down;
  };

  const handleMarkBulkPaid = async (items) => {
    if (!window.confirm(`Mark all ${items.length} items in this bulk credit as paid?`)) return;
    const bulkTotal = items.reduce((sum, s) => sum + s.total, 0);
    try {
      for (const item of items) {
        await db.put({
          ...item,
          isCreditPaid: true,
          dwnPayment: item.total,
          bulkDwnPayment: bulkTotal,
        });
      }
      loadSales();
    } catch (err) {
      console.error('Failed to mark bulk as paid', err);
      alert('Something went wrong. Please try again.');
    }
  };

  const handleDeleteSaleWithStockRestore = async (sale) => {
    const confirmed = window.confirm("Delete this sale?");
    if (!confirmed) return;
    await db.remove(sale);
    loadSales();
  };

  const toggleSaleSelection = (sale) => {
    setSelectedSales(prev =>
      prev.find(s => s._id === sale._id)
        ? prev.filter(s => s._id !== sale._id)
        : [...prev, sale]
    );
  };

  const isSelected = (sale) => selectedSales.find(s => s._id === sale._id);

  const filteredSales = (() => {
    const q = salesSearch.trim().toLowerCase();
    if (!q) return sales;
    let cutoff = 0;
    if (searchRange === "week") cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    else if (searchRange === "month") cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return allSales.filter(s =>
      new Date(s.timestamp).getTime() >= cutoff &&
      (s.name?.toLowerCase().includes(q) || s.customerName?.toLowerCase().includes(q))
    ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  })();

  const todayUnits = sales.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
  const averageSale = sales.length ? summary.totalRevenue / sales.length : 0;
  const discountTotal = sales.reduce((sum, sale) => sum + Number(sale.discountAmount || 0), 0);
  const grossSales = summary.totalRevenue + discountTotal;
  const presaleSales = sales.filter(sale => sale.isPresale);
  const pendingPresales = presaleSales.filter(sale => sale.presaleStatus !== "completed" && sale.presaleStatus !== "cancelled");
  const presaleValue = presaleSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const presaleDeposits = presaleSales.reduce((sum, sale) => (
    sum + (Array.isArray(sale.paymentHistory)
      ? sale.paymentHistory.reduce((payments, payment) => payments + Number(payment.amount || 0), 0)
      : Number(sale.dwnPayment || 0))
  ), 0);
  const averageUnitsPerOrder = sales.length ? todayUnits / sales.length : 0;
  const normalSalesCount = sales.length - presaleSales.length;
  const discountRate = grossSales ? (discountTotal / grossSales) * 100 : 0;
  const paymentMethods = sales.reduce((methods, sale) => {
    const method = sale.paymentMethod || (sale.isCreditSale ? "Credit" : "Cash");
    methods[method] = (methods[method] || 0) + Number(sale.total || 0);
    return methods;
  }, {});
  const topPaymentMethod = Object.entries(paymentMethods).sort(([, first], [, second]) => second - first)[0];
  const collectionRate = summary.totalRevenue
    ? Math.round((summary.cashReceived / summary.totalRevenue) * 100)
    : 0;
  const topProducts = Object.entries(cropSummaries)
    .sort(([, first], [, second]) => second.revenue - first.revenue)
    .slice(0, 3);

  return (
    <div className="p-4 pb-32 max-w-7xl">
      <div className="flex w-full items-center justify-between text-2xl font-bold text-slate-900 pb-1 max-w-xl">
<h1 className="pb-2">Sales History</h1>
      </div>
      <div className="mb-2 max-w-xl rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <div className="flex gap-1 overflow-x-auto items-center justify-around no-wrap">
          {[
            ["todaySales", "Daily Sales"],
            ["presales", "Presales"],
            ["weekly", "Weekly"],
            ["monthly", "Monthly"],
            ["cropSummary", "By Crops"],
            ["customerSummary", "By Customers"],
          ].map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`whitespace-nowrap rounded-xl sm:border border-slate-100 border-w-6 px-3 py-2 text-sm font-medium transition-all duration-200 ${viewMode === mode
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 sm:shadow-sm"
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "todaySales" && (
        <div className="flex gap-4 sm:flex-col">
          <div className="max-w-xl w-full flex-shrink-0">
            <div className="flex flex-col mb-2">
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Search by product or customer..."
                  className="min-w-[75px] flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  value={salesSearch}
                  onChange={e => setSalesSearch(e.target.value)}
                />
                <select
                  value={searchRange}
                  onChange={e => setSearchRange(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                >
                  <option value="week">Past 7 days</option>
                  <option value="month">Past 30 days</option>
                  <option value="all">All time</option>
                </select>
              </div>
              <div className="flex items-center justify-between gap-4 shadow-sm pb-2 pl-2">
                <div className="flex items-center gap-4">
                <span
                  className="flex items-center gap-1 cursor-pointer text-sm text-slate-700 pl-2"
                  onClick={() => setShowCreditList(prev => !prev)}
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={showCreditList}
                    className=""
                  />
                  {showCreditList ? "Hide" : "Show"} Credit Sales
                </span>
                <div className="max-w-xl flex sm:flex-col items-center gap-1">
                  <label className="flex items-center gap-1 cursor-pointer text-sm text-slate-700 pl-2">
                    <input
                      type="checkbox"
                      checked={etimsMode}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setEtimsMode(enabled);
                        localStorage.setItem("etimsMode", String(enabled));
                      }}
                    />

                    eTIMS (Test)
                  </label>
                </div>
                </div>
                <input
          className="rounded-lg mx-1 py-1.5 border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          type="date"
          name="datePick"
          id="datePick"
          value={selectedDate}
          onChange={(e) => { setSelectedDate(e.target.value); loadSales(e.target.value); }}
        />
              </div>
            </div>

            {salesSearch.trim() && (
              <div className="text-xs text-gray-500 mb-2">
                {filteredSales.length} result{filteredSales.length !== 1 ? "s" : ""} found
              </div>
            )}

            <SaleList
              sales={filteredSales}
              showCreditList={showCreditList}
              setShowCreditList={setShowCreditList}
              selectedSales={selectedSales}
              toggleSaleSelection={toggleSaleSelection}
              isSelected={isSelected}
              handleEditSale={handleEditSale}
              handleDeleteSale={handleDeleteSale}
              handleDeleteSaleWithStockRestore={handleDeleteSaleWithStockRestore}
              handleMarkBulkPaid={handleMarkBulkPaid}
              etimsMode={etimsMode}
              config={config}
            />

            <EditSaleModal
              editingSale={editingSale}
              handleEditChange={handleEditChange}
              handleSaveEdit={handleSaveEdit}
              handleCancelEdit={handleCancelEdit}
            />
          </div>

          <aside className="space-y-3 md:sticky md:mt-[-57px] max-w-xl md:min-w-[300px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sales analytics</p>
                  <p className="mt-1 text-sm font-medium text-slate-700">{selectedDate}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                  {collectionRate}% collected
                </span>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Net sales</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    Ksh {formatWhole(summary.totalRevenue).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{sales.length} transactions</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-100 p-3">
                    <p className="text-xs text-slate-500">Units sold</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{todayUnits.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 p-3">
                    <p className="text-xs text-slate-500">Avg. sale</p>
                    <p className="mt-1 truncate text-lg font-bold text-slate-900">
                      Ksh {formatWhole(averageSale).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 p-3">
                    <p className="text-xs text-slate-500">Gross sales</p>
                    <p className="mt-1 truncate text-lg font-bold text-slate-900">
                      Ksh {formatWhole(grossSales).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 p-3">
                    <p className="text-xs text-slate-500">Avg. Units / order</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{averageUnitsPerOrder.toFixed(1)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                  <span className="text-slate-500">Presales</span>
                  <span className="font-bold text-sky-700">
                    {presaleSales.length} orders · Ksh {formatWhole(presaleValue).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Pending presales</span>
                  <span className="font-semibold text-slate-800">{pendingPresales.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Discounts given</span>
                  <span className="font-semibold text-slate-800">
                    Ksh {formatWhole(discountTotal).toLocaleString()} ({discountRate.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Presale deposits</span>
                  <span className="font-semibold text-emerald-700">
                    Ksh {formatWhole(presaleDeposits).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Regular orders</span>
                  <span className="font-semibold text-slate-800">{normalSalesCount}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Top products</p>
                {topPaymentMethod && (
                  <span className="text-xs text-slate-500">
                    Main payment: <strong className="text-slate-700">{topPaymentMethod[0]}</strong>
                  </span>
                )}
              </div>
              {topProducts.length ? (
                <div className="mt-3 space-y-3">
                  {topProducts.map(([name, product], index) => (
                    <div key={name} className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                          <p className="text-xs text-slate-500">{product.quantity.toLocaleString()} units</p>
                        </div>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-emerald-700">
                        Ksh {formatWhole(product.revenue).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No sales recorded for this date.</p>
              )}
            </div>
          </aside>
        </div>
      )}

      {viewMode === "weekly" && (
        <WeeklySummary allSales={allSales} selectedDate={selectedDate} />
      )}

      {viewMode === "monthly" && (
        <MonthlySummary allSales={allSales} selectedDate={selectedDate} />
      )}
      {viewMode === "presales" && (
        <Presale />
      )}

      {viewMode === "cropSummary" && (
        <CropSummary cropSummaries={cropSummaries} allSales={allSales} />
      )}

      {viewMode === "customerSummary" && (
        <CustomerSummary
          allSales={allSales}
        />
      )}
    </div>
  );
}
