import { useState } from "react";
import { db, deductFromBatch, getAvailableBatchesForCrop } from "../db";
import { showToast } from "../utils/toast";
import { getEligibleBatches, selectBatch } from "../utils/batchSelection";

export function usePOSCart({
  products,
  batches,
  customers,
  currentUser,
  selectedBatches,
  quantities,
  discounts = {},
  creditSales,
  presales,
  customerNames,
  downPayment,
  setQuantities,
  setCreditSales,
  setPresales,
  setCustomerNames,
  setDiscounts,
  setDownPayment,
  setSelectedBatches,
  findCustomerByName,
  loadProducts,
  loadOutstandingCredits,
  loadBatches,
}) {
  const [cart, setCart] = useState([]);

  const bumpPopular = (productId) => {
    try {
      const raw = localStorage.getItem("popularCounts");
      const map = raw ? JSON.parse(raw) : {};
      map[productId] = (map[productId] || 0) + 1;
      localStorage.setItem("popularCounts", JSON.stringify(map));
    } catch (e) {
      // Ignore local popularity tracking failures.
    }
  };

  const handleSell = async (product) => {
    const qty = Math.max(1, parseInt(quantities[product._id], 10) || 1);
    const isPresale = presales[product._id] || false;
    const availableBatches = await getAvailableBatchesForCrop(batches, product._id);
    const eligibleBatches = getEligibleBatches(availableBatches, isPresale);

    if (eligibleBatches.length === 0) {
      alert(isPresale
        ? `No available batch for presale of ${product.name}.`
        : `No ready batch available for ${product.name}.`);
      return;
    }

    const batch = selectBatch(eligibleBatches, selectedBatches[product._id]);
    if (!batch) {
      alert(`Please select an available batch for ${product.name}.`);
      return;
    }

    if (batch.availableForSale < qty) {
      alert(`Only ${batch.availableForSale} available in that batch of ${product.name}.`);
      return;
    }

    const isCreditSale = creditSales[product._id] || false;
    if ((isCreditSale || isPresale) && !customerNames[product._id]) {
      alert("Please enter the customer's name for a credit/presale sale.");
      return;
    }

    const subtotal = qty * Number(product.price || 0);
    const discount = Math.min(subtotal, Math.max(0, Number(discounts[product._id] || 0)));
    const total = subtotal - discount;
    const now = new Date().toISOString();
    const initialPayment = Number(downPayment[product._id] || 0);
    const selectedCustomer = findCustomerByName(customerNames[product._id]);
    const sale = {
      _id: now,
      type: "sale",
      name: product.name,
      digitaxItemId: product.digitaxItemId || product.itemId || null,
      quantity: qty,
      total,
      sellingPrice: product.price,
      discount,
      discountRate: subtotal > 0 ? (discount / subtotal) * 100 : 0,
      timestamp: now,
      isCreditSale,
      isPresale,
      presaleStatus: isPresale ? "pending" : null,
      dwnPayment: initialPayment,
      paymentHistory: isPresale && initialPayment > 0
        ? [{
          amount: initialPayment,
          date: now,
          recordedBy: currentUser?.username || currentUser?.name || "Staff",
          method: "cash",
          note: "Initial deposit",
        }]
        : [],
      customerName: (customerNames[product._id] || "").trim(),
      digitaxCustomerId: selectedCustomer?.digitaxCustomerId || null,
      batchId: batch._id,
      batchDatePlanted: batch.datePlanted,
    };

    try {
      if (!isPresale) await deductFromBatch(batch._id, qty);
    } catch (e) {
      alert(`That batch of ${product.name} changed before the sale went through. Check Batches and try again.`);
      loadBatches();
      return;
    }

    await db.put(sale);
    loadProducts();
    loadOutstandingCredits();
    loadBatches();
    showToast(`Sold ${qty} x ${product.name} — Ksh ${total}`);
    try {
      bumpPopular(product._id);
    } catch (e) {
      // Ignore local popularity tracking failures.
    }
    setQuantities(prev => ({ ...prev, [product._id]: 1 }));
    setCreditSales({});
    setPresales({});
    setCustomerNames({});
    setDiscounts(prev => ({ ...prev, [product._id]: 0 }));
    setDownPayment({});
    setSelectedBatches({});
  };

  const handleAddToCart = async (product) => {
    const qty = Math.max(1, parseInt(quantities[product._id], 10) || 1);
    const price = product.price;
    const subtotal = qty * Number(price || 0);
    const discount = Math.min(subtotal, Math.max(0, Number(discounts[product._id] || 0)));
    const isPresale = presales[product._id] || false;

    if (cart.length > 0) {
      const cartIsPresale = cart[0].isPresale || false;
      if (cartIsPresale !== isPresale) {
        alert(cartIsPresale
          ? "This cart contains presale items. You cannot add a normal sale to the same cart."
          : "This cart contains normal sale items. You cannot add a presale to the same cart.");
        return;
      }
    }

    const availableBatches = await getAvailableBatchesForCrop(batches, product._id);
    const eligibleBatches = getEligibleBatches(availableBatches, isPresale);
    if (eligibleBatches.length === 0) {
      alert(isPresale
        ? `No available batch for presale of ${product.name}.`
        : `No ready batch available for ${product.name}.`);
      return;
    }

    const batch = selectBatch(eligibleBatches, selectedBatches[product._id]);
    if (!batch) {
      alert(`Please select an available batch for ${product.name}.`);
      return;
    }

    if (batch.availableForSale < qty) {
      alert(`Only ${batch.availableForSale} available in that batch of ${product.name}.`);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.batch._id === batch._id);
      if (existing) {
        return prev.map(item => item.batch._id === batch._id
          ? {
              ...item,
              qty: item.qty + qty,
              sellingPrice: price,
              isPresale,
              discount: Number(item.discount || 0) + discount,
            }
          : item);
      }
      return [...prev, { product, batch, qty, isPresale, sellingPrice: price, discount }];
    });

    if (isPresale) {
      setPresales(prev => ({ ...prev, [product._id]: false }));
    }
    showToast(`${product.name} added to cart`);
  };

  const handleCartUpdateQty = (batchId, qty) => {
    setCart(prev => prev.map(item => (
      item.batch._id === batchId ? { ...item, qty: Math.max(1, qty) } : item
    )));
  };

  const handleCartUpdateDiscount = (batchId, discount) => {
    setCart(prev => prev.map(item => {
      if (item.batch._id !== batchId) return item;

      const subtotal = item.qty * Number(item.sellingPrice || item.product.price || 0);
      return {
        ...item,
        discount: Math.min(subtotal, Math.max(0, Number(discount) || 0)),
      };
    }));
  };

  const handleCartRemoveItem = batchId => {
    setCart(prev => prev.filter(item => item.batch._id !== batchId));
  };

  const handleCartClear = () => setCart([]);

  const handleCartSale = async ({
    isCreditSale = false,
    isPresale = false,
    customerName = "",
    dwnPayment = 0,
    paymentMethod = "cash",
    mpesaPayment = null,
  } = {}) => {
    if (cart.length === 0) return;

    if ((isCreditSale || isPresale) && !customerName) {
      alert("Please enter the customer's name for a credit/presale sale.");
      return;
    }

    for (const item of cart) {
      const availableBatches = await getAvailableBatchesForCrop(batches, item.product._id);
      const currentBatch = availableBatches.find(b => b._id === item.batch._id);
      if (!currentBatch || currentBatch.availableForSale < item.qty) {
        alert(`Only ${currentBatch?.availableForSale || 0} available in the selected batch of ${item.product.name}. Adjust the cart before selling.`);
        return;
      }
    }

    const bulkSaleId = new Date().toISOString();
    const isMpesa = paymentMethod === "mpesa";
    const salesToPut = [];

    for (let i = 0; i < cart.length; i++) {
      const item = cart[i];
      const product = products.find(p => p._id === item.product._id) || item.product;
      const subtotal = item.qty * item.sellingPrice;
      const discount = Math.min(subtotal, Math.max(0, Number(item.discount || 0)));
      const total = subtotal - discount;
      const selectedCustomer = findCustomerByName(customerName);
      const sale = {
        _id: `${bulkSaleId}-${i}`,
        type: "sale",
        name: product.name,
        digitaxItemId: product.digitaxItemId || product.itemId || null,
        quantity: item.qty,
        total,
        sellingPrice: item.sellingPrice,
        discount,
        discountRate: subtotal > 0 ? (discount / subtotal) * 100 : 0,
        timestamp: bulkSaleId,
        isCreditSale,
        isPresale: item.isPresale,
        presaleStatus: item.isPresale ? "pending" : null,
        customerName: customerName.trim() || "Walk-in Customer",
        digitaxCustomerId: selectedCustomer?.digitaxCustomerId || null,
        dwnPayment: 0,
        bulkDwnPayment: isCreditSale
          ? Number(dwnPayment) + (isMpesa ? Number(mpesaPayment.amount) : 0)
          : 0,
        isBulkSale: true,
        bulkSaleId,
        batchId: item.batch._id,
        batchDatePlanted: item.batch.datePlanted,
        paymentMethod,
        mpesaAmountPaid: isMpesa ? Number(mpesaPayment.amount) : 0,
        mpesaPhone: isMpesa ? mpesaPayment.phone : null,
        mpesaTransactionId: isMpesa ? mpesaPayment.transactionId : null,
        mpesaCheckoutRequestId: isMpesa ? mpesaPayment.checkoutRequestId : "",
        mpesaMerchantRequestId: isMpesa ? mpesaPayment.merchantRequestId : "",
        mpesaSaleStatus: Boolean(isMpesa && mpesaPayment.transactionId) ? "completed" : "pending",
        createdAt: new Date().toISOString(),
      };

      try {
        if (!item.isPresale) await deductFromBatch(item.batch._id, item.qty);
      } catch (e) {
        alert(`That batch of ${product.name} changed before the sale went through. Sale stopped partway — check Batches and Sales before retrying.`);
        loadBatches();
        return;
      }

      salesToPut.push(sale);
      try {
        bumpPopular(product._id);
      } catch (e) {
        // Ignore local popularity tracking failures.
      }
    }

    const bulkTotal = salesToPut.reduce((sum, item) => sum + item.total, 0);
    for (let i = 0; i < salesToPut.length; i++) {
      salesToPut[i].bulkTotal = bulkTotal;
      await db.put(salesToPut[i]);
    }

    const totalAmount = cart.reduce(
      (sum, item) => sum + item.qty * item.sellingPrice - Number(item.discount || 0),
      0
    );
    setCart([]);
    loadProducts();
    loadOutstandingCredits();
    loadBatches();
    const creditNote = isCreditSale ? ` (Credit — ${customerName})` : "";
    showToast(`Bulk sale of ${cart.length} items — Ksh ${totalAmount} complete${creditNote}`);
  };

  return {
    cart,
    handleSell,
    handleAddToCart,
    handleCartUpdateQty,
    handleCartUpdateDiscount,
    handleCartRemoveItem,
    handleCartClear,
    handleCartSale,
  };
}
