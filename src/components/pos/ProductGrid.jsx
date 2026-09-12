import React from "react";
import ProductCard from "./ProductCard";

export default function ProductGrid({
  products,
  batches,
  availableBatchesByCrop,
  selectedBatches,
  quantities,
  sellingPrices,
  discounts,
  creditSales,
  presales,
  customerNames,
  downPayment,
  customers,
  onBatchChange,
  onCustomerChange,
  onDiscountChange,
  onQuantityChange,
  onPriceChange,
  onPresaleToggle,
  onCreditToggle,
  onDownPaymentChange,
  onSell,
  onAddToCart
}) {
  return (
    <div className="space-y-3">
      {products.map(product => (
        <ProductCard
          key={product._id}
          product={product}
          batches={batches}
          availableBatches={availableBatchesByCrop[product._id] || []}
          selectedBatches={selectedBatches}
          quantities={quantities}
          sellingPrices={sellingPrices}
          discounts={discounts}
          creditSales={creditSales}
          presales={presales}
          customerNames={customerNames}
          downPayment={downPayment}
          customers={customers}
          onBatchChange={onBatchChange}
          onCustomerChange={onCustomerChange}
          onDiscountChange={onDiscountChange}
          onQuantityChange={onQuantityChange}
          onPriceChange={onPriceChange}
          onPresaleToggle={onPresaleToggle}
          onCreditToggle={onCreditToggle}
          onDownPaymentChange={onDownPaymentChange}
          onSell={onSell}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  );
}
