import React, { useState } from "react";
import { useCustomerData } from "../hooks/useCustomerData";
import { useBusinessConfig } from "../config";
import AddCustomerModal from "./AddCustomerModal";

export default function Cart({
  cart,
  onUpdateQty,
  onUpdateDiscount,
  onRemoveItem,
  onClearCart,
  onMakeSale,
  customers = [],
  loadCustomers
}) {
  const { config } = useBusinessConfig();
  const [isCredit, setIsCredit] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [dwnPayment, setDwnPayment] = useState("");
  const [mpesaProcessing, setMpesaProcessing] = useState(false); 
  const [mpesaStatus, setMpesaStatus] = useState(null);
  const [mpesaFailureReason, setMpesaFailureReason] = useState("");
  const [showManualMpesa, setShowManualMpesa] = useState(false);
  const [activeMpesaPayment, setActiveMpesaPayment] = useState(null);
  const [mpesaRefreshing, setMpesaRefreshing] = useState(false);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [mpesaPayment, setMpesaPayment] = useState(null);

  // M-PESA modal
  const [showMpesaModal, setShowMpesaModal] = useState(false);
  const [mpesaDraft, setMpesaDraft] = useState({
    transactionId: "",
    phone: "",
    amount: "",
    mpesaSaleStatus: "idle"
  });

const {
  form: customerForm,
  saving: savingCustomer,
  handleFormChange,
  resetForm,
  saveCustomer,
} = useCustomerData();

const [showAddCustomer, setShowAddCustomer] = useState(false);

const initiateMpesaPayment = async () => {
  const phone = mpesaDraft.phone.trim();
  const amount = Number(mpesaDraft.amount);

  if (!phone) {
    alert("Enter the customer's M-PESA number.");
    return;
  }

  if (!amount || amount <= 0) {
    alert("Enter a valid payment amount.");
    return;
  }

  try {
    setMpesaProcessing(true);
    setMpesaStatus("pending");
    setMpesaFailureReason("");

    let phoneNumber = "254708374149" // phone.replace(/\D/g, "");

    if (phoneNumber.startsWith("0")) {
      phoneNumber = "254" + phoneNumber.substring(1);
    }

    if (!phoneNumber.startsWith("254")) {
      throw new Error(
        "Enter a valid Kenyan M-PESA number."
      );
    }

    const response = await fetch(
      `https://yelivate-apis.onrender.com/api/mpesa/stkpush?business=${config.businessCode}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phoneNumber,
          amount,
          accountReference: `SALE-${Date.now()}`,
          transactionDesc: config.transactionDescription
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
        data.errorMessage ||
        "Failed to initiate M-PESA payment."
      );
    }
const checkoutRequestId =
  data.CheckoutRequestID ||
  data.checkoutRequestId;

if (!checkoutRequestId) {
  throw new Error(
    "M-PESA did not return a CheckoutRequestID."
  );
}

setActiveMpesaPayment({
  checkoutRequestId,
  merchantRequestId:
    data.MerchantRequestID ||
    data.merchantRequestId ||
    null
});

setMpesaDraft(prev => ({
  ...prev,
  phone: phoneNumber,
  checkoutRequestId,
  merchantRequestId:
    data.MerchantRequestID ||
    data.merchantRequestId ||
    null,
  mpesaSaleStatus: "pending"
}));

    console.log(
      "STK Push initiated:",
      checkoutRequestId
    );

    // Start checking the persistent payment status
    pollMpesaPayment(
      checkoutRequestId
    );

  } catch (error) {

    console.error(
      "M-PESA payment error:",
      error
    );

    setMpesaStatus("failed");
    setMpesaFailureReason(
      error?.message ||
      "Payment request was rejected or timed out. Please retry."
    );

    alert(
      error.message ||
      "Unable to initiate M-PESA payment."
    );

  } finally {
    setMpesaProcessing(false);
  }
};

const checkMpesaPaymentStatus = async (checkoutRequestId) => {
  try {
    const response = await fetch(
      `https://yelivate-apis.onrender.com/api/mpesa/status/${checkoutRequestId}?business=${config.businessCode}`,
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Unable to check M-PESA status."
      );
    }

    const payment = data.payment;

    if (payment.status === "completed") {
      setMpesaStatus("success");

      setMpesaDraft(prev => ({
        ...prev,
        transactionId:
          payment.transactionId || prev.transactionId,
        checkoutRequestId:
          payment.checkoutRequestId,
        merchantRequestId:
          payment.merchantRequestId,
        mpesaSaleStatus: 
          payment.status
      }));

      return "completed";
    }

    if (payment.status === "failed") {
      const failureReason =
        payment.resultDesc ||
        payment.resultDescription ||
        "Payment request was rejected or timed out. Please retry.";

      setMpesaStatus("failed");
      setMpesaFailureReason(failureReason);

      setMpesaDraft(prev => ({
        ...prev,
        mpesaSaleStatus: 
          "failed"
      }));

      return "failed";
    }

    setMpesaDraft(prev => ({
        ...prev,
        mpesaSaleStatus: 
          "pending"
      }));
    
    return "pending";

  } catch (error) {
    console.error(
      "M-PESA status check failed:",
      error
    );

    return "pending";
  }
};

const pollMpesaPayment = async (checkoutRequestId) => {
  const maxAttempts = 30;
  const interval = 3000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {

    const status =
      await checkMpesaPaymentStatus(
        checkoutRequestId
      );

    if (
      status === "completed" ||
      status === "failed"
    ) {
      return;
    }

    await new Promise(resolve =>
      setTimeout(resolve, interval)
    );
  }

  // We stopped waiting, but don't mark it failed.
  // The customer may still complete the payment.
  setMpesaStatus("timeout");

  console.log(
    "M-PESA polling timed out. Payment may still complete."
  );
};

const refreshMpesaStatus = async () => {
  const checkoutRequestId =
    activeMpesaPayment?.checkoutRequestId;

  if (
    !checkoutRequestId ||
    mpesaRefreshing
  ) {
    return;
  }

  try {
    setMpesaRefreshing(true);

    await checkMpesaPaymentStatus(
      checkoutRequestId
    );

  } catch (error) {

    console.error(
      "Manual M-PESA status refresh failed:",
      error
    );

  } finally {
    setMpesaRefreshing(false);
  }
};

  const cartTotal = cart.reduce(
    (sum, item) =>
      sum +
      item.qty *
      (item.sellingPrice || item.product.price) -
      Number(item.discountAmount || 0),
    0
  );

  const isPresale = cart.some(
    item => item.isPresale
  );

  const amountOwed = Math.max(
    0,
    cartTotal - dwnPayment
  );

  /*
   * Open M-PESA payment details modal.
   *
   * This does not create or modify a sale.
   * It only prepares the modal with the current
   * payment information.
   */
  const openMpesaModal = () => {
    const customerPhone =
      customers.find(
        c => c.name === customerName
      )?.phone || "";

    setMpesaDraft({
      transactionId:
        mpesaPayment?.transactionId || "",
      
  checkoutRequestId: mpesaPayment?.checkoutRequestId || "",

  merchantRequestId: mpesaPayment?.merchantRequestId || "",

  mpesaSaleStatus: mpesaPayment?.mpesaSaleStatus || "idle",

      phone:
        mpesaPayment?.phone ||
        customerPhone,

      amount:
        mpesaPayment?.amount ??
        cartTotal
    });

    setShowMpesaModal(true);
  };

  /*
   * Save M-PESA details to local React state only.
   *
   * IMPORTANT:
   * No db.put() here.
   * No sale is created here.
   * The parent handleCartSale() will receive
   * this information when the sale is completed.
   */
  const saveMpesaPayment = () => {
    const transactionId =
      mpesaDraft.transactionId
        .trim()
        .toUpperCase();

    const phone =
      mpesaDraft.phone.trim();

    const amount =
      Number(mpesaDraft.amount);

    const mpesaSaleStatus = 
      mpesaDraft.mpesaSaleStatus

    if (!transactionId) {
      alert(
        "Please enter the M-PESA transaction ID."
      );
      return;
    }

    if (!amount || amount <= 0) {
      alert(
        "Please enter a valid M-PESA payment amount."
      );
      return;
    }

    if (amount > cartTotal) {
      alert(
        `M-PESA payment cannot exceed the sale total of Ksh ${cartTotal.toLocaleString()}.`
      );
      return;
    }

    setMpesaPayment({
      method: "mpesa",
      customerName,
      transactionId,
      phone,
      amount,
      mpesaSaleStatus,
    });

    setShowMpesaModal(false);
  };

  const handleClear = () => {
    setIsCredit(false);
    setCustomerName("");
    setDwnPayment(0);

    setPaymentMethod("cash");
    setMpesaPayment(null);

    setShowMpesaModal(false);
    setMpesaStatus(null);

    setMpesaDraft({
  phone: "",
  amount: "",
  transactionId: "",
  checkoutRequestId: "",
  merchantRequestId: "",
  mpesaSaleStatus: "idle"
    });

    onClearCart();
  };

  const handlePaymentMethodChange = (
    method
  ) => {
    setPaymentMethod(method);

    if (method === "cash") {
      setMpesaPayment(null);
      setShowMpesaModal(false);
    }
  };

  const handleSale = () => {
    const hasPresale = cart.some(
      item => item.isPresale
    );

    const hasNormalSale = cart.some(
      item => !item.isPresale
    );

    if (hasPresale && hasNormalSale) {
      alert(
        "A sale cannot contain both normal-sale and presale items. Please separate them into different sales."
      );
      return;
    }

    if (
      hasPresale &&
      !customerName.trim()
    ) {
      alert(
        "Please select a customer for a presale."
      );
      return;
    }

    if (
      isCredit &&
      !customerName.trim()
    ) {
      alert(
        "Please select a customer for a credit sale."
      );
      return;
    }

    if (
      paymentMethod === "mpesa" &&
      !mpesaPayment
    ) {
      alert(
        "Please enter the M-PESA payment details."
      );
      return;
    }

    onMakeSale({
      isCreditSale: isCredit,
      isPresale: hasPresale,

      customerName:
        customerName.trim(),

      dwnPayment:
        Number(dwnPayment),

      paymentMethod,

      mpesaPayment
    });
    handleClear();
  };

  return (
    <div className="p-4 border rounded bg-gray-50 w-full flex flex-col gap-2 self-start sticky top-4">

      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold flex items-center gap-2">
          Cart {cart.length > 0 && `(${cart.length})`}

          {isPresale && (
            <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
              PRESALE
            </span>
          )}
        </h2>

        {cart.length > 0 && (
          <button
            onClick={handleClear}
            className="text-red-500 text-sm hover:text-red-700 font-medium"
          >
            Clear All
          </button>
        )}
      </div>

      {cart.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">
          Cart is empty
        </p>
      ) : (
        <>
          {/* Cart items */}
          <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
            {cart.map(item => (
              <div
                key={item.batch._id}
                className="border rounded p-2 bg-white"
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="leading-tight">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {item.product.name}
                      </span>
                    </div>

                    <div className="text-xs text-gray-400">
                      Batch:{" "}
                      {new Date(
                        item.batch.datePlanted
                      ).toLocaleDateString()}
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      onRemoveItem(item.batch._id)
                    }
                    className="text-red-400 text-sm hover:text-red-600 ml-1 flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex gap-1 items-center flex-wrap">
                  <label className="text-xs text-gray-500">
                    Qty
                  </label>

                  <input
                    type="number"
                    min="1"
                    className="border p-1 w-12 rounded text-sm"
                    value={item.qty ?? 1}
                    onChange={e =>
                      onUpdateQty(
                        item.batch._id,
                        parseInt(
                          e.target.value,
                          10
                        ) || 1
                      )
                    }
                  />

                  <span className="text-xs text-gray-500">
                    Ksh {Number(item.sellingPrice ?? item.product.price).toLocaleString()}
                  </span>

                  <label className="text-xs text-gray-500">
                    Discount
                  </label>

                  <input
                    type="number"
                    min="0"
                    max={item.qty * Number(item.sellingPrice ?? item.product.price)}
                    className="border p-1 w-16 rounded text-sm"
                    value={item.discountAmount ?? ""}
                    placeholder="0"
                    onChange={e =>
                      onUpdateDiscount(
                        item.batch._id,
                        e.target.value
                      )
                    }
                  />

                  <span className="text-sm font-semibold">
                    ={" "}
                    {(
                      item.qty * (item.sellingPrice || item.product.price) -
                      Number(item.discountAmount || 0)
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="border-t pt-2 space-y-1">
            <div className="text-sm font-bold">
              Total: Ksh{" "}
              {cartTotal.toLocaleString()}
            </div>
          </div>

          {/* Checkout details */}
          <div className="border rounded p-2 bg-white space-y-2">

            {/* Payment method */}
            <div>
              <label className="text-xs font-semibold text-slate-600">
                Payment Method
              </label>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() =>
                    handlePaymentMethodChange(
                      "cash"
                    )
                  }
                  className={`border rounded p-2 text-sm font-medium ${paymentMethod === "cash"
                      ? "bg-green-100 border-green-500 text-green-700"
                      : "bg-white text-slate-600"
                    }`}
                >
                  💵 Cash
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handlePaymentMethodChange(
                      "mpesa"
                    )
                  }
                  className={`border rounded p-2 text-sm font-medium ${paymentMethod === "mpesa"
                      ? "bg-green-100 border-green-500 text-green-700"
                      : "bg-white text-slate-600"
                    }`}
                >
                  📱 M-PESA
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handlePaymentMethodChange(
                      "bank"
                    )
                  }
                  className={`border rounded p-2 text-sm font-medium ${paymentMethod === "bank"
                      ? "bg-green-100 border-green-500 text-green-700"
                      : "bg-white text-slate-600"
                    }`}
                >
                  🏦 Bank
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handlePaymentMethodChange(
                      "other"
                    )
                  }
                  className={`border rounded p-2 text-sm font-medium ${paymentMethod === "other"
                      ? "bg-green-100 border-green-500 text-green-700"
                      : "bg-white text-slate-600"
                    }`}
                >
                 💷 Other
                </button>
              </div>
            </div>

            {/* Customer */}
            <div className="flex gap-2 w-full">
              <select
                className="w-full border p-1.5 rounded text-sm"
                value={customerName}
                onChange={e =>
                  setCustomerName(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Select customer
                </option>

                {customers.map(c => (
                  <option
                    key={c._id}
                    value={c.name}
                  >
                    {c.name}
                  </option>
                ))}
              </select>
<button
  type="button"
  onClick={() => {
    resetForm();
    setShowAddCustomer(true);
  }}
  className="flex items-center gap-1.5 px-3 py-2 rounded
             bg-slate-100 text-slate-700 hover:bg-slate-300
             text-sm font-semibold transition-colors no-wrap min-w-[75px]"
>
  <span className="text-lg leading-none">+</span>
  Add
</button>
            </div>

            {/* M-PESA payment */}
            {paymentMethod === "mpesa" && (
              <div className="border rounded-lg p-2 bg-slate-50">

                {mpesaPayment ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-green-700">
                        ✓ M-PESA payment entered
                      </div>

                      <div className="text-[11px] text-slate-500 truncate">
                        {mpesaPayment.transactionId}
                        {" • "}
                        Ksh{" "}
                        {Number(
                          mpesaPayment.amount
                        ).toLocaleString()}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={
                        openMpesaModal
                      }
                      className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">
                      Record the customer's
                      M-PESA payment before
                      completing the sale.
                    </div>

                    <button
                      type="button"
                      onClick={
                        openMpesaModal
                      }
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2 text-sm font-semibold"
                    >
                      Enter M-PESA Payment
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Credit */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isCredit}
                onChange={e => {
                  setIsCredit(
                    e.target.checked
                  );

                  if (!e.target.checked) {
                    setCustomerName("");
                    setDwnPayment("");
                  }
                }}
              />

              <span className="text-sm font-medium text-red-700">
                Credit Sale?
              </span>
            </label>
          </div>

          {/* Deposit */}
          {(isCredit || isPresale) && (
            <input
              type="number"
              placeholder="Down payment"
              className="border p-1.5 w-full rounded text-sm"
              value={dwnPayment ?? ""}
              min="0"
              onChange={e =>
                setDwnPayment(
                  Number(e.target.value) || 0
                )
              }
            />)
          }

          {dwnPayment > 0 && (
            <div className="text-xs text-red-600 font-medium">
              Owes after payment: Ksh{" "}
              {amountOwed.toLocaleString()}
            </div>
          )}

          {/* Complete sale */}
          <button
            onClick={handleSale}
            disabled={
              paymentMethod === "mpesa" &&
              !mpesaPayment
            }
            className={`text-white px-3 py-2 rounded font-semibold w-full ${isCredit
                ? "bg-red-600 hover:bg-red-700"
                : "bg-purple-600 hover:bg-purple-700"
              } disabled:bg-slate-300 disabled:cursor-not-allowed`}
          >
            {`Complete the Sale
            (${cart.length} items)`}
          </button>
        </>
      )}

{/* M-PESA Payment Modal */}
{showMpesaModal && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    onClick={() => {
      if (!mpesaProcessing) {
        setShowMpesaModal(false);
      }
    }}
  >
    <div
      className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5"
      onClick={e => e.stopPropagation()}
    >

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            M-PESA Payment
          </h2>

          <p className="text-xs text-slate-500">
            Pay using STK Push or enter a manual M-PESA receipt
          </p>
        </div>
        

        <button
          type="button"
          disabled={mpesaProcessing}
          onClick={() => setShowMpesaModal(false)}
          className="text-slate-400 hover:text-slate-700 text-xl disabled:opacity-40"
        >
          ×
        </button>
      </div>

        {/* Amount due */}
      <div className="bg-slate-50 border rounded-lg p-3 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500">
            Sale total
          </span>

          <span className="font-bold text-lg">
            Ksh {cartTotal.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ============================= */}
      {/* STK PAYMENT SECTION */}
      {/* ============================= */}

      <div className="border rounded-xl p-4 mb-4">
      
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-slate-800">
              M-Pesa Prompt
            </h3>

            <p className="text-xs text-slate-500">
              Send a payment request to the customer's phone.
            </p>
          </div>

          {mpesaStatus === "pending" && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              Waiting
            </span>
          )}

          {mpesaStatus === "success" && (
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
              Paid
            </span>
          )}

          {mpesaStatus === "failed" && (
            <div className="flex flex-col items-end gap-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                Failed
              </span>
              <p className="max-w-[180px] text-right text-[10px] leading-snug text-red-600/90">
                {mpesaFailureReason || "Payment request was rejected or timed out. Please retry."}
              </p>
            </div>
          )}
        </div>

        {/* Phone */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Customer M-PESA Number
          </label>

          <input
            type="tel"
            inputMode="numeric"
            placeholder="0712345678"
            value={mpesaDraft.phone}
            disabled={mpesaProcessing || mpesaStatus === "success"}
            onChange={e =>
              setMpesaDraft(prev => ({
                ...prev,
                phone: e.target.value
              }))
            }
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100"
          />
        </div>

        {/* Amount */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Amount
          </label>

          <input
            type="number"
            min="1"
            value={mpesaDraft.amount}
            disabled={mpesaProcessing || mpesaStatus === "success"}
            onChange={e =>
              setMpesaDraft(prev => ({
                ...prev,
                amount: e.target.value
              }))
            }
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100"
          />
        </div>

        {/* Pending message */}
        {mpesaStatus === "pending" && (
  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">

    <div className="flex items-center gap-2">
      <span className="animate-pulse">
        ⏳
      </span>

      <span className="text-sm font-medium text-amber-800">
        Waiting for payment...
      </span>
    </div>

    <p className="text-xs text-amber-700 mt-1">
      Ask the customer to check their phone and
      enter their M-PESA PIN.
    </p>

    <button
      type="button"
      onClick={refreshMpesaStatus}
      disabled={
        mpesaRefreshing ||
        !mpesaDraft.checkoutRequestId
      }
      className="w-full mt-3 border border-amber-300 bg-white hover:bg-amber-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-amber-800 rounded-lg py-2 text-sm font-medium"
    >
      {mpesaRefreshing
        ? "Checking Payment..."
        : "↻ Refresh Payment Status"}
    </button>

  </div>
)}

        {/* Successful payment */}
        {mpesaStatus === "success" && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">

            <div className="flex items-center gap-2 mb-1">
              <span>✓</span>

              <span className="text-sm font-semibold text-green-800">
                Payment received
              </span>
            </div>

            {mpesaDraft.transactionId && (
              <div className="text-xs text-green-700 mt-2">
                <span className="font-medium">
                  M-PESA Receipt:
                </span>{" "}
                <span className="font-mono">
                  {mpesaDraft.transactionId}
                </span>
              </div>
            )}

          </div>
        )}

        {/* STK Push button */}
        {mpesaStatus !== "success" && (
          <button
            type="button"
            onClick={initiateMpesaPayment}
            disabled={
              mpesaProcessing ||
              mpesaStatus === "pending" ||
              !mpesaDraft.phone.trim() ||
              !Number(mpesaDraft.amount)
            }
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg py-2.5 font-semibold text-sm"
          >
            {mpesaProcessing
              ? "Sending STK Push..."
              : mpesaStatus === "pending"
                ? "Waiting for Payment..."
                : "Send STK Push"}
          </button>
        )}

      </div>

      {/* ============================= */}
      {/* MANUAL PAYMENT */}
      {/* ============================= */}

      {mpesaStatus !== "success" && (
        <div className="mt-4">
          {!showManualMpesa ? (
            <button
              type="button"
              onClick={() => setShowManualMpesa(true)}
              className="w-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg py-2.5 text-sm font-medium transition"
            >
              + Add manual M-PESA receipt
            </button>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-slate-200" />

                <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-medium">
                  Manual payment
                </span>

                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <div className="border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-800">
                    Manual M-PESA Payment
                  </h3>

                  <button
                    type="button"
                    onClick={() => setShowManualMpesa(false)}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Hide
                  </button>
                </div>

                <p className="text-xs text-slate-500 mb-3">
                  Use this if the customer already paid or
                  the STK Push failed.
                </p>

                <label className="block text-xs font-medium text-slate-600 mb-1">
                  M-PESA Transaction ID
                </label>

                <input
                  type="text"
                  placeholder="e.g. SH12ABC34D"
                  value={mpesaDraft.transactionId}
                  disabled={mpesaProcessing}
                  onChange={e =>
                    setMpesaDraft(prev => ({
                      ...prev,
                      transactionId:
                        e.target.value.toUpperCase()
                    }))
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100"
                />

                <p className="text-[11px] text-slate-400 mt-1">
                  Enter the receipt number from the customer's
                  M-PESA confirmation message.
                </p>

                <button
                  type="button"
                  disabled={
                    mpesaProcessing ||
                    !mpesaDraft.transactionId.trim() ||
                    !Number(mpesaDraft.amount)
                  }
                  onClick={() => {
                    saveMpesaPayment({
                      source: "manual"
                    });
                  }}
                  className="w-full mt-3 border border-green-600 text-green-700 hover:bg-green-50 disabled:border-slate-300 disabled:text-slate-400 disabled:cursor-not-allowed rounded-lg py-2.5 font-semibold text-sm"
                >
                  Save Manual Payment
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex gap-2 mt-4">

        <button
          type="button"
          disabled={mpesaProcessing}
          onClick={() => setShowMpesaModal(false)}
          className="flex-1 border border-slate-300 hover:bg-slate-50 disabled:bg-slate-100 rounded-lg py-2.5 text-sm font-medium"
        >
          Cancel
        </button>

        {mpesaStatus === "success" && (
          <button
            type="button"
            onClick={() => {
              saveMpesaPayment({
                source: "stk"
              });
            }}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg py-2.5 font-semibold text-sm"
          >
            ✓ Save Payment
          </button>
        )}

      </div>

    </div>
  </div>
)}

<AddCustomerModal
  open={showAddCustomer}
  form={customerForm}
  saving={savingCustomer}
  onChange={handleFormChange}
  onClose={() => {
    resetForm();
    setShowAddCustomer(false);
  }}
  onSave={async () => {
    try {
      await saveCustomer();
      loadCustomers();
      setCustomerName(customerForm.name);
      setShowAddCustomer(false);
    } catch (error) {
      alert(error.message);
    }
  }}
/>
    </div>
  );
}