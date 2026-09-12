import React, { useState } from "react";
import Cart from "../components/Cart";
import ProductGrid from "../components/pos/ProductGrid";
import UpcomingHarvests from "../components/pos/UpcomingHarvests";
import CreditSummary from "../components/pos/CreditSummary";
import StockAlerts, { StockAlertPreview } from "../components/pos/StockAlerts";
import { buildCustomerCredits } from "../components/pos/helpers";
import { useAuth } from "../context/AuthContext";
import { usePOSData } from "../hooks/usePOSData";
import { usePOSCart } from "../hooks/usePOSCart";

export default function POS() {
  const { currentUser } = useAuth();
  const [selectedBatches, setSelectedBatches] = useState({});
  const [search, setSearch] = useState("");
  const [downPayment, setDownPayment] = useState({});
  const [sellingPrices, setSellingPrices] = useState({});
  const [quantities, setQuantities] = useState({});
  const [creditSales, setCreditSales] = useState({});
  const [presales, setPresales] = useState({});
  const [customerNames, setCustomerNames] = useState({});
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [showLowStockModal, setShowLowStockModal] = useState(false);

  const {
    products,
    batches,
    availableBatchesByCrop,
    customers,
    outstandingCredits,
    lowStockProducts,
    loadBatches,
    loadCustomers,
    loadProducts,
    loadOutstandingCredits,
    findCustomerByName,
  } = usePOSData({ presales, search, setSelectedBatches });

  const {
    cart,
    handleSell,
    handleAddToCart,
    handleCartUpdateQty,
    handleCartUpdatePrice,
    handleCartRemoveItem,
    handleCartClear,
    handleCartSale,
  } = usePOSCart({
    products,
    batches,
    customers,
    currentUser,
    selectedBatches,
    quantities,
    creditSales,
    presales,
    customerNames,
    downPayment,
    sellingPrices,
    setQuantities,
    setCreditSales,
    setPresales,
    setCustomerNames,
    setDownPayment,
    setSellingPrices,
    setSelectedBatches,
    findCustomerByName,
    loadProducts,
    loadOutstandingCredits,
    loadBatches,
  });

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase())
  );

  const upcomingReadyBatches = batches
    .filter(batch => batch.status !== "ready")
    .map(batch => {
      const crop = products.find(product => product._id === batch.cropId);
      if (!crop) return null;

      const planted = new Date(batch.datePlanted);
      const readyDate = new Date(planted);
      readyDate.setDate(readyDate.getDate() + crop.daysToReady);
      const daysRemaining = Math.ceil(
        (readyDate - new Date()) / (1000 * 60 * 60 * 24)
      );

      return { ...batch, cropName: crop.name, daysRemaining, readyDate };
    })
    .filter(batch => batch && batch.daysRemaining >= 0 && batch.daysRemaining <= 7)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const { customerCredits, grandCreditTotal } =
    buildCustomerCredits(outstandingCredits, new Date().toISOString());

  const handleBatchChange = (productId, batchId) => {
    setSelectedBatches(prev => ({ ...prev, [productId]: batchId }));
  };

  const handleCustomerChange = (productId, customerName) => {
    setCustomerNames(prev => ({ ...prev, [productId]: customerName }));
  };

  const handleQuantityChange = (productId, quantity) => {
    setQuantities(prev => ({ ...prev, [productId]: quantity }));
  };

  const handlePriceChange = (productId, sellingPrice) => {
    setSellingPrices(prev => ({ ...prev, [productId]: sellingPrice }));
  };

  const handlePresaleToggle = productId => {
    setPresales(prev => ({ ...prev, [productId]: !prev[productId] }));
  };

  const handleCreditToggle = productId => {
    setCreditSales(prev => ({ ...prev, [productId]: !prev[productId] }));
  };

  const handleDownPaymentChange = (productId, value) => {
    setDownPayment(prev => ({ ...prev, [productId]: parseInt(value, 10) || 0 }));
  };

  return (
    <div className="space-y-6 pb-20">
      <button
        type="button"
        onClick={() => {
          document
            .getElementById("pos-cart")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        className="lg:hidden fixed bottom-4 right-4 z-50 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-bold"
      >
        Cart
        {cart.length > 0 && (
          <span className="bg-white text-blue-600 min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold">
            {cart.reduce((total, item) => total + (Number(item.qty) || 0), 0)}
          </span>
        )}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4 max-w-xl">
          {lowStockProducts.length > 0 && (
            <StockAlertPreview
              count={lowStockProducts.length}
              onOpen={() => setShowLowStockModal(true)}
            />
          )}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <span className="text-slate-400">🔍</span>
            <input
              type="text"
              placeholder="Search ready seedling varieties..."
              className="w-full bg-transparent outline-none text-sm font-medium"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <ProductGrid
            products={filteredProducts}
            batches={batches}
            availableBatchesByCrop={availableBatchesByCrop}
            selectedBatches={selectedBatches}
            quantities={quantities}
            creditSales={creditSales}
            presales={presales}
            customerNames={customerNames}
            sellingPrices={sellingPrices}
            downPayment={downPayment}
            customers={customers}
            onBatchChange={handleBatchChange}
            onCustomerChange={handleCustomerChange}
            onQuantityChange={handleQuantityChange}
            onPresaleToggle={handlePresaleToggle}
            onCreditToggle={handleCreditToggle}
            onPriceChange={handlePriceChange}
            onDownPaymentChange={handleDownPaymentChange}
            onSell={handleSell}
            onAddToCart={handleAddToCart}
          />
        </div>

        <div className="lg:col-span-5 space-y-6">
          {showUpcoming && (
            <UpcomingHarvests
              batches={upcomingReadyBatches}
              onDismiss={() => setShowUpcoming(false)}
            />
          )}
          <div id="pos-cart" className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm max-w-xl">
            <Cart
              cart={cart}
              onUpdateQty={handleCartUpdateQty}
              onUpdatePrice={handleCartUpdatePrice}
              onRemoveItem={handleCartRemoveItem}
              onClearCart={handleCartClear}
              onMakeSale={handleCartSale}
              customers={customers}
              loadCustomers={loadCustomers}
            />
          </div>

          {customerCredits.length > 0 && (
            <CreditSummary
              customerCredits={customerCredits}
              grandCreditTotal={grandCreditTotal}
            />
          )}
        </div>
      </div>
      {showLowStockModal && (
        <StockAlerts
          products={lowStockProducts}
          onClose={() => setShowLowStockModal(false)}
        />
      )}
    </div>
  );
}
