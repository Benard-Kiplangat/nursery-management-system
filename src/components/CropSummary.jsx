import React, { useState, useMemo } from "react";

function buildCropHistory(allSales, cropName) {
  const relevant = allSales.filter(s => s.name === cropName);
  const byDate = {};

  relevant.forEach(sale => {
    const dateKey = new Date(sale.timestamp).toLocaleDateString();
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(sale);
  });

  return Object.entries(byDate)
    .map(([date, sales]) => {
      const totalQty = sales.reduce((s, x) => s + (x.quantity || 0), 0);
      const totalRevenue = sales.reduce((s, x) => s + (x.total || 0), 0);
      const latestTs = Math.max(...sales.map(s => new Date(s.timestamp).getTime()));
      return { date, sales: sales.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)), totalQty, totalRevenue, latestTs };
    })
    .sort((a, b) => b.latestTs - a.latestTs);
}

function CropHistoryPanel({ cropName, allSales, onClose }) {
  const history = useMemo(() => buildCropHistory(allSales, cropName), [allSales, cropName]);
  const grandQty = history.reduce((s, d) => s + (d.totalQty || 0), 0);
  const grandRevenue = history.reduce((s, d) => s + (d.totalRevenue || 0), 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-start justify-center z-50 pt-10 px-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl">
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h2 className="text-lg font-bold">{cropName}</h2>
            <p className="text-sm text-gray-500">
              All-time: {grandQty} units · KES {grandRevenue} revenue
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-xl font-bold px-2">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {history.length === 0 && (
            <p className="text-gray-500 text-sm">No sales recorded for this crop.</p>
          )}
          {history.map(({ date, sales, totalQty, totalRevenue }) => (
            <div key={date}>
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-gray-700">{date}</span>
                <span className="text-xs text-gray-500 bg-gray-100 rounded px-2 py-0.5">
                  {totalQty} units · KES {totalRevenue}
                </span>
              </div>
              <div className="space-y-1 pl-2 border-l-2 border-gray-200">
                {sales.map((sale, idx) => {
                  const time = new Date(sale.timestamp).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                  const tags = [];
                  if (sale.isBulkSale) tags.push({ label: "BULK", color: "bg-purple-100 text-purple-700" });
                  if (sale.isCreditSale) tags.push({ label: "CREDIT", color: "bg-red-100 text-red-700" });
                  const amountOwed = sale.isCreditSale ? sale.total - (sale.bulkDwnPayment || sale.dwnPayment || 0) : 0;

                  return (
                    <div key={idx} className="flex justify-between items-start py-1 text-sm">
                      <div>
                        <span className="text-gray-400 text-xs mr-2">{time}</span>
                        <span className="font-medium">{sale.quantity} × KES {sale.sellingPrice}</span>
                        {tags.map((t, ti) => (
                          <span key={ti} className={`ml-1 text-xs px-1.5 py-0.5 rounded font-medium ${t.color}`}>{t.label}</span>
                        ))}
                        {sale.isCreditSale && sale.customerName && (
                          <span className="ml-1 text-xs text-yellow-700">({sale.customerName})</span>
                        )}
                        {sale.isCreditSale && !sale.isCreditPaid && (
                          <span className="ml-1 text-xs text-red-500">owes KES {amountOwed}</span>
                        )}
                        {sale.isCreditSale && sale.isCreditPaid && (
                          <span className="ml-1 text-xs text-green-600">paid</span>
                        )}
                      </div>
                      <span className="text-gray-700 font-semibold ml-2 flex-shrink-0">KES {sale.total}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CropSummary({ allSales = [] }) {
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [cropSearch, setCropSearch] = useState("");
  const [cropRange, setCropRange] = useState("week");

  const summaries = useMemo(() => {
    let cutoff = 0;
    if (cropRange === "week") cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    else if (cropRange === "month") cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const q = cropSearch.trim().toLowerCase();
    const map = {};

    allSales.forEach(s => {
      if (new Date(s.timestamp).getTime() < cutoff) return;
      if (q && !s.name?.toLowerCase().includes(q)) return;
      if (!map[s.name]) map[s.name] = { quantity: 0, revenue: 0 };
      map[s.name].quantity += s.quantity;
      map[s.name].revenue += s.total;
    });

    return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [allSales, cropRange, cropSearch]);

  const rangeLabel = cropRange === "week" ? "past 7 days" : cropRange === "month" ? "past 30 days" : "all time";

  return (
    <>
      <h2 className="text-lg font-semibold mb-2 mt-4">Sales Summary by Crop</h2>
      <p className="text-xs text-gray-400 mb-3">Click a crop to see its full sales history.</p>

      <div className="flex gap-2 mb-2">
        <input
          type="text"
          placeholder="Search crop name..."
          className="flex-1 p-2 border rounded text-sm"
          value={cropSearch}
          onChange={e => setCropSearch(e.target.value)}
        />
        <select
          value={cropRange}
          onChange={e => setCropRange(e.target.value)}
          className="border rounded p-2 text-sm bg-white"
        >
          <option value="week">Past 7 days</option>
          <option value="month">Past 30 days</option>
          <option value="all">All time</option>
        </select>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Showing {summaries.length} crop{summaries.length !== 1 ? "s" : ""} · {rangeLabel}
      </p>

      <div className="space-y-3">
        {summaries.length === 0 && (
          <div className="text-sm text-gray-600">No sales found for this period.</div>
        )}
        {summaries.map(([name, s]) => (
          <button
            key={name}
            onClick={() => setSelectedCrop(name)}
            className="w-full text-left border p-3 rounded bg-gray-50 hover:bg-blue-50 hover:border-blue-300 transition-colors"
          >
            <div className="flex justify-between items-center">
              <strong className="text-blue-700">{name}</strong>
              <span className="text-xs text-gray-400">View history →</span>
            </div>
            <div className="text-sm text-gray-600 mt-1 flex gap-4">
              <span>Sold: {s.quantity}</span>
              <span>Revenue: KES {s.revenue}</span>
            </div>
          </button>
        ))}
      </div>

      {selectedCrop && (
        <CropHistoryPanel
          cropName={selectedCrop}
          allSales={allSales}
          onClose={() => setSelectedCrop(null)}
        />
      )}
    </>
  );
}
