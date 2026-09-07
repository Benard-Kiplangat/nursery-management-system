export function buildCustomerCredits(outstandingCredits, fallbackDate) {
  const customerCreditMap = {};

  outstandingCredits.forEach(entry => {
    const name = entry.customerName || "Unknown";
    const date = entry.timestamp || entry.createdAt || fallbackDate;

    if (!customerCreditMap[name]) {
      customerCreditMap[name] = {
        name,
        date,
        entries: [],
        totalOwed: 0
      };
    }

    if (entry.isBulkGroup) {
      const bulkTotal = entry.items.reduce((sum, item) => sum + item.total, 0);
      const owed = bulkTotal - (entry.dwnPayment || 0);
      customerCreditMap[name].entries.push({
        owed,
        label: `Bulk (${entry.items.length} items)`,
        detail: entry.items.map(item => `${item.quantity}×${item.name}`).join(", ")
      });
      customerCreditMap[name].totalOwed += owed;
    } else {
      const owed = entry.total - (entry.dwnPayment || 0);
      customerCreditMap[name].entries.push({
        owed,
        label: `${entry.quantity} × ${entry.name}`,
        detail: null
      });
      customerCreditMap[name].totalOwed += owed;
    }
  });

  const customerCredits = Object.values(customerCreditMap).sort(
    (a, b) => b.totalOwed - a.totalOwed
  );
  const grandCreditTotal = customerCredits.reduce(
    (sum, customer) => sum + customer.totalOwed,
    0
  );

  return { customerCredits, grandCreditTotal };
}
