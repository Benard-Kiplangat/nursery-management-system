import React from "react";
import ProductCard from "./ProductCard";

export default function ProductGrid({
  products,
  batches,
  availableBatchesByCrop,
  selectedBatches,
  quantities,
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
