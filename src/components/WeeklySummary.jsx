import React from "react";

function getMondayOfWeek(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

export default function WeeklySummary({ allSales = [], selectedDate }) {
  const monday = getMondayOfWeek(selectedDate);

  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const sunday = days[6];

  const rows = days.map(d => {
    const key = d.toLocaleDateString();
    const salesForDay = allSales.filter(s => new Date(s.timestamp).toLocaleDateString() === key);
    const totalSales = salesForDay.reduce((sum, s) => sum + (s.quantity || 0), 0);
    const totalRevenue = salesForDay.reduce((sum, s) => sum + (s.total || 0), 0);
    const creditGross = salesForDay.filter(s => s.isCreditSale).reduce((sum, s) => sum + (s.total || 0), 0);
    const creditDown = salesForDay.filter(s => s.isCreditSale).reduce((sum, s) => sum + (s.dwnPayment || 0), 0);
    const creditDue = creditGross - creditDown;
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    return { date: key, dayName, totalSales, totalRevenue, creditDue };
  });

  const totals = rows.reduce((acc, r) => ({
    totalSales: acc.totalSales + r.totalSales,
    totalRevenue: acc.totalRevenue + r.totalRevenue,
    totalCreditDue: acc.totalCreditDue + (r.creditDue || 0),
  }), { totalSales: 0, totalRevenue: 0, totalCreditDue: 0 });

  const fmt = d => d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1 mt-4">Weekly Summary</h2>
      <p className="text-sm text-gray-500 mb-3">
        Mon {fmt(monday)} — Sun {fmt(sunday)}
      </p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className={`border p-3 rounded flex justify-between ${r.totalSales === 0 ? 'bg-gray-50 text-gray-400' : 'bg-white'}`}>
            <div className="font-medium w-24">{r.dayName} <span className="text-xs font-normal">{r.date}</span></div>
            <div className="text-sm text-right">
              {r.totalSales === 0
                ? <span className="italic">No sales</span>
                : <>Credit Due: KES {r.creditDue} | Revenue: KES {r.totalRevenue}</>
              }
            </div>
          </div>
        ))}
        <div className="mt-3 p-3 border rounded bg-yellow-50">
          <div className="font-semibold mb-1">Week Totals</div>
          <div>Total Credit Due: KES {totals.totalCreditDue}</div>
          <div>Total Revenue: KES {totals.totalRevenue}</div>
        </div>
      </div>
    </div>
  );
}
