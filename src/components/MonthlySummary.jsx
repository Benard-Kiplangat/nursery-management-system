import React from "react";

export default function MonthlySummary({ allSales = [], selectedDate }) {
  const refDate = selectedDate ? new Date(selectedDate) : new Date();

  // compute 12 months window ending at refDate's month (inclusive)
  const start = new Date(refDate.getFullYear(), refDate.getMonth() - 11, 1);
  const months = Array.from({ length: 12 }).map((_, i) => new Date(start.getFullYear(), start.getMonth() + i, 1));

  const rows = months.map(d => {
    const keyLabel = d.toLocaleString(undefined, { month: 'short', year: 'numeric' });
    const salesForMonth = allSales.filter(s => {
      const sd = new Date(s.timestamp);
      return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth();
    });

    const totalRevenue = salesForMonth.reduce((sum, s) => sum + (s.total || 0), 0);
    const creditGross = salesForMonth.filter(s => s.isCreditSale).reduce((sum, s) => sum + (s.total || 0), 0);
    const creditDown = salesForMonth.filter(s => s.isCreditSale).reduce((sum, s) => sum + (s.dwnPayment || 0), 0);
    const creditDue = creditGross - creditDown;
    return { label: keyLabel, totalRevenue, creditDue };
  });

  const totals = rows.reduce((acc, r) => ({
    totalRevenue: acc.totalRevenue + r.totalRevenue,
    totalCreditDue: acc.totalCreditDue + (r.creditDue || 0),
  }), { totalRevenue: 0, totalCreditDue: 0 });

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2 mt-4">Monthly Summary (previous 12 months ending {refDate.toLocaleString(undefined, { month: 'long', year: 'numeric' })})</h2>
      <div className="space-y-2">
        {[...rows].reverse().map((r, i) => (
          <div key={i} className="border p-3 rounded bg-gray-50 flex justify-between">
            <div>{r.label}</div>
            <div className="text-sm">
              Credit Due: KES {r.creditDue} | Revenue: KES {r.totalRevenue}
            </div>
          </div>
        ))}
        <div className="mt-3 p-3 border rounded bg-white">
          <div className="font-semibold">12-Month Totals</div>
          <div>Total Credit Due: KES {totals.totalCreditDue}</div>
          <div>Total Revenue: KES {totals.totalRevenue}</div>
        </div>
      </div>
    </div>
  );
}
