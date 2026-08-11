import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  db,
  getBatches,
  getBatchDisplayName,
  isBatchReady,
  deductFromBatch,
} from "../db";

export default function Presale() {
  const [presales, setPresales] = useState([]);
  const [batches, setBatches] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const { currentUser } = useAuth();
  const loadData = async () => {
    try {
      setLoading(true);

      const [salesResult, batchData] = await Promise.all([
        db.allDocs({ include_docs: true }),
        getBatches(),
      ]);

      const sales = salesResult.rows
        .map(row => row.doc)
        .filter(
          doc =>
            doc &&
            doc.type === "sale" &&
            doc.isPresale === true
        )
        .sort(
          (a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
        );

      setPresales(sales);
      setBatches(batchData);
    } catch (err) {
      console.error("Failed to load presales:", err);
      alert("Failed to load presales.");
    } finally {
      setLoading(false);
    }
  };

  const getBatch = sale => {
    return batches.find(batch => batch._id === sale.batchId);
  };

const getPaymentInfo = sale => {
  const total = Number(sale.total || 0);

  const paymentHistory = Array.isArray(sale.paymentHistory)
    ? sale.paymentHistory
    : [];

  const paid = paymentHistory.length > 0
  ? paymentHistory.reduce(
      (sum, payment) =>
        sum + Number(payment.amount || 0),
      0
    )
  : Number(sale.dwnPayment || 0);

  return {
    total,
    paid,
    balance: Math.max(0, total - paid),
    paymentHistory,
  };
};

const handleAddPayment = async (
  sale,
  amount,
  method = "cash",
  note = ""
) => {
  const paymentAmount = Number(amount);

  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    alert("Please enter a valid payment amount.");
    return;
  }

  const paymentInfo = getPaymentInfo(sale);

  if (paymentAmount > paymentInfo.balance) {
    alert(
      `Payment cannot exceed the outstanding balance of KES ${paymentInfo.balance}.`
    );
    return;
  }

  const now = new Date().toISOString();

  const paymentEntry = {
    amount: paymentAmount,
    date: now,
    recordedBy:
      currentUser?.name ||
      currentUser?.email ||
      "Staff",
    method,
    note: note || "Additional payment",
  };

  const existingHistory = Array.isArray(sale.paymentHistory)
    ? sale.paymentHistory
    : [];

  const newPaidAmount =
    paymentInfo.paid + paymentAmount;

  const updatedSale = {
    ...sale,
    paymentHistory: [
      ...existingHistory,
      paymentEntry,
    ],
    dwnPayment: newPaidAmount,
    isCreditPaid:
      newPaidAmount >= paymentInfo.total,
    updatedAt: now,
  };

  try {
    await db.put(updatedSale);
    await loadData();
  } catch (error) {
    console.error("Failed to record payment:", error);
    alert("Failed to record payment.");
  }
};
  const filteredPresales = useMemo(() => {
    const query = search.trim().toLowerCase();

    return presales.filter(sale => {
      // Status filter
      if (filter === "pending" && sale.presaleStatus !== "pending") {
        return false;
      }

      if (filter === "completed" && sale.presaleStatus !== "completed") {
        return false;
      }

      if (filter === "cancelled" && sale.presaleStatus !== "cancelled") {
        return false;
      }

      // Payment filter
      const payment = getPaymentInfo(sale);

      if (
        paymentFilter === "paid" &&
        payment.balance > 0
      ) {
        return false;
      }

      if (
        paymentFilter === "partial" &&
        !(payment.paid > 0 && payment.balance > 0)
      ) {
        return false;
      }

      if (
        paymentFilter === "unpaid" &&
        payment.paid > 0
      ) {
        return false;
      }

      // Search
      if (query) {
        const customer = String(
          sale.customerName || ""
        ).toLowerCase();

        const product = String(
          sale.name || ""
        ).toLowerCase();

const batch = String(
  sale.batchName ||
  getBatch(sale)?.batchName ||
  ""
).toLowerCase();

        if (
          !customer.includes(query) &&
          !product.includes(query) &&
          !batch.includes(query)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [presales, batches, filter, paymentFilter, search]);

  const summary = useMemo(() => {
    const pending = presales.filter(
      sale => sale.presaleStatus === "pending"
    );

    const completed = presales.filter(
      sale => sale.presaleStatus === "completed"
    );

    const pendingQuantity = pending.reduce(
      (sum, sale) => sum + Number(sale.quantity || 0),
      0
    );

    const outstanding = pending.reduce(
      (sum, sale) =>
        sum + getPaymentInfo(sale).balance,
      0
    );

    const ready = pending.filter(sale => {
      const batch = getBatch(sale);
      return batch && isBatchReady(batch);
    }).length;

    return {
      pending: pending.length,
      completed: completed.length,
      pendingQuantity,
      outstanding,
      ready,
    };
  }, [presales, batches]);

  const handleComplete = async sale => {
    if (sale.presaleStatus !== "pending") {
      return;
    }
    

    const batch = getBatch(sale);

    if (!batch) {
      alert(
        "The batch associated with this presale could not be found."
      );
      return;
    }

    const quantity = Number(sale.quantity || 0);

    if (!quantity || quantity <= 0) {
      alert("This presale has an invalid quantity.");
      return;
    }

    if (batch.quantityRemaining < quantity) {
      alert(
        `Only ${batch.quantityRemaining} seedlings remain in ${getBatchDisplayName(
          batch
        )}. This presale requires ${quantity}.`
      );
      return;
    }

    if (!isBatchReady(batch)) {
      const proceed = window.confirm(
        "This batch is not marked as ready yet. Are you sure the customer is collecting the seedlings now?"
      );

      if (!proceed) {
        return;
      }
    }

   const payment = getPaymentInfo(sale);

if (payment.balance > 0) {
  const collectPayment = window.confirm(
    `Outstanding balance: KES ${payment.balance}\n\n` +
    `Has the customer paid the remaining balance?\n\n` +
    `OK = Mark balance as paid and complete\n` +
    `Cancel = Do not complete`
  );

  if (!collectPayment) {
    return;
  }
}

const confirmed = window.confirm(
  "Complete this presale and mark the seedlings as collected?"
);

if (!confirmed) {
  return;
}

    try {
      setCompletingId(sale._id);

      // This is the ONLY point where a pending presale
      // removes physical stock.
      await deductFromBatch(batch._id, quantity);

      const now = new Date().toISOString();

      const updatedSale = {
        ...sale,
        presaleStatus: "completed",
        completedAt: now,
        completedBy: "Staff",
      };

      await db.put(updatedSale);

      alert("Presale completed and stock updated.");

      await loadData();
    } catch (err) {
      console.error("Failed to complete presale:", err);

      if (err.message === "NOT_ENOUGH_IN_BATCH") {
        alert(
          "There is not enough stock remaining in this batch to complete the presale."
        );
      } else if (err.message === "BATCH_NOT_READY") {
        alert(
          "This batch is not ready. The collection could not be completed."
        );
      } else {
        alert(
          "Failed to complete presale. Please try again."
        );
      }
    } finally {
      setCompletingId(null);
    }
  };

  const handleCancel = async sale => {
    if (sale.presaleStatus !== "pending") {
      return;
    }

    const confirmed = window.confirm(
      "Cancel this presale? The reserved quantity will become available for other sales."
    );

    if (!confirmed) {
      return;
    }

    try {
      await db.put({
        ...sale,
        presaleStatus: "cancelled",
        cancelledAt: new Date().toISOString(),
        cancelledBy: "Staff",
      });

      await loadData();
    } catch (err) {
      console.error("Failed to cancel presale:", err);
      alert("Failed to cancel presale.");
    }
  };

  const formatDate = date => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString();
  };

  const formatDateTime = date => {
    if (!date) return "-";

    return new Date(date).toLocaleString();
  };

  const getStatusInfo = sale => {
    if (sale.presaleStatus === "completed") {
      return {
        label: "COMPLETED",
        className:
          "bg-gray-100 text-gray-700",
      };
    }

    if (sale.presaleStatus === "cancelled") {
      return {
        label: "CANCELLED",
        className:
          "bg-red-100 text-red-700",
      };
    }

    const batch = getBatch(sale);

    if (batch && isBatchReady(batch)) {
      return {
        label: "READY FOR COLLECTION",
        className:
          "bg-green-100 text-green-700",
      };
    }

    return {
      label: "WAITING FOR SEEDLINGS",
      className:
        "bg-yellow-100 text-yellow-700",
    };
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">
          Presales
        </h1>

        <p className="text-sm text-gray-500">
          Manage reserved seedlings and customer collections.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="border rounded-lg p-3 bg-white">
          <div className="text-xs text-gray-500">
            Pending
          </div>
          <div className="text-xl font-bold">
            {summary.pending}
          </div>
        </div>

        <div className="border rounded-lg p-3 bg-white">
          <div className="text-xs text-gray-500">
            Ready
          </div>
          <div className="text-xl font-bold text-green-600">
            {summary.ready}
          </div>
        </div>

        <div className="border rounded-lg p-3 bg-white">
          <div className="text-xs text-gray-500">
            Reserved Seedlings
          </div>
          <div className="text-xl font-bold">
            {summary.pendingQuantity}
          </div>
        </div>

        <div className="border rounded-lg p-3 bg-white">
          <div className="text-xs text-gray-500">
            Outstanding
          </div>
          <div className="text-xl font-bold text-red-600">
            KES {summary.outstanding}
          </div>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {[
          ["pending", "Pending"],
          ["completed", "Completed"],
          ["cancelled", "Cancelled"],
          ["all", "All"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-3 py-1.5 rounded text-sm ${
              filter === value
                ? "bg-green-600 text-white"
                : "bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search + payment filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Search customer, crop or batch..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border rounded p-2 text-sm"
        />

        <select
          value={paymentFilter}
          onChange={e =>
            setPaymentFilter(e.target.value)
          }
          className="border rounded p-2 text-sm bg-white"
        >
          <option value="all">
            All payment statuses
          </option>
          <option value="paid">
            Fully Paid
          </option>
          <option value="partial">
            Partial Payment
          </option>
          <option value="unpaid">
            Unpaid
          </option>
        </select>
      </div>

      {/* Presales */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">
          Loading presales...
        </div>
      ) : filteredPresales.length === 0 ? (
        <div className="border rounded-lg bg-white p-8 text-center text-gray-500">
          No presales found.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPresales.map(sale => {
            const batch = getBatch(sale);
            const payment = getPaymentInfo(sale);
            const status = getStatusInfo(sale);
            const pending =
              sale.presaleStatus === "pending";

            return (
              <div
                key={sale._id}
                className="border rounded-lg bg-white p-4 shadow-sm"
              >
                {/* Header */}
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-bold text-base">
                        {sale.name}
                      </h2>

                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                        PRESALE
                      </span>

                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div className="text-sm text-gray-600 mt-1">
                      Customer:{" "}
                      <span className="font-medium">
                        {sale.customerName || "No customer name"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right text-sm">
                    <div className="font-bold">
                      KES {Number(sale.total || 0)}
                    </div>

                    <div className="text-xs text-gray-500">
                      {formatDateTime(sale.timestamp)}
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
                  <div>
                    <div className="text-xs text-gray-500">
                      Quantity
                    </div>
                    <div className="font-semibold">
                      {sale.quantity}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">
                      Batch
                    </div>
                    <div className="font-semibold">
                      {batch
                        ? getBatchDisplayName(batch)
                        : sale.batchName || "Unknown batch"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">
                      Planted
                    </div>
                    <div className="font-semibold">
                      {batch
                        ? formatDate(batch.datePlanted)
                        : "-"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">
                      Expected Ready
                    </div>
                    <div className="font-semibold">
                      {batch
                        ? formatDate(batch.expectedReadyDate)
                        : "-"}
                    </div>
                  </div>
                </div>

                {/* Payment */}
                <div className="border-t mt-4 pt-3">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">
                        Total
                      </div>
                      <div className="font-semibold">
                        KES {payment.total}
                      </div>
                    </div>

                    <div>
                      <div>
  <div className="text-xs text-gray-500">
    Paid
  </div>
   <div className="font-semibold text-green-600">
      KES {payment.paid}
    </div>
</div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500">
                        Balance
                      </div>
                      <div
                        className={`font-semibold ${
                          payment.balance > 0
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        KES {payment.balance}
                      </div>
                    </div>
                  </div>

                  {payment.paymentHistory.length > 0 && (
  <div className="mt-3 border-t pt-3">
    <div className="text-sm font-semibold mb-2">
      Payment History
    </div>

    <div className="space-y-1">
  {payment.paymentHistory.map((entry, index) => (
    <div
      key={`${sale._id}-payment-${index}`}
      className="text-xs flex items-center justify-between gap-2"
    >
      <span>
        [
        {" "}
        {new Date(entry.date).toLocaleDateString()}
        {" · "}
        {entry.method || "cash"}
        {" "}
        ]
      </span>

      <span className="font-semibold text-green-600">
        KES {Number(entry.amount || 0).toLocaleString()}
      </span>
    </div>
  ))}
</div>
  </div>
)}

{pending && payment.balance > 0 && (
  <div className="mt-3 border-t pt-3">
    <div className="flex justify-center gap-2">
     <input
        type="number"
        min="1"
        max={payment.balance}
        placeholder={`Add payment (max ksh. ${payment.balance})`}
        className="border rounded p-2 flex-1"
        id={`payment-${sale._id}`}
      />

      <button
        onClick={() => {
          const input = document.getElementById(
            `payment-${sale._id}`
          );

          const amount = Number(input?.value || 0);

          handleAddPayment(
            sale,
            amount,
            "cash",
            "Additional payment"
          );

          if (input) {
            input.value = "";
          }
        }}
        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded font-semibold"
      >
        Add
      </button>
    </div>
  </div>
)}
                  <div className="text-xs text-gray-500 mt-2">
                    Payment status:{" "}
                    <span className="font-medium">
                      {payment.balance <= 0 ? (
  <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded">
    PAID
  </span>
) : payment.paid > 0 ? (
  <span className="text-xs font-bold bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
    PARTIALLY PAID
  </span>
) : (
  <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded">
    UNPAID
  </span>
)}
                    </span>
                  </div>
                </div>

                {/* Collection */}
                {pending && (
                  <div className="border-t mt-4 pt-3 flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() =>
                        handleComplete(sale)
                      }
                      disabled={
                        completingId === sale._id
                      }
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-2 rounded font-semibold"
                    >
                      {completingId === sale._id
                        ? "Completing..."
                        : "Complete / Customer Collected"}
                    </button>

                    <button
                      onClick={() =>
                        handleCancel(sale)
                      }
                      disabled={
                        completingId === sale._id
                      }
                      className="px-3 py-2 rounded font-semibold bg-gray-100 hover:bg-gray-200 text-red-600"
                    >
                      Cancel Presale
                    </button>
                  </div>
                )}

                {/* Completed information */}
                {sale.presaleStatus ===
                  "completed" && (
                  <div className="border-t mt-4 pt-3 text-xs text-gray-500">
                    Collected:{" "}
                    {formatDateTime(
                      sale.completedAt
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}