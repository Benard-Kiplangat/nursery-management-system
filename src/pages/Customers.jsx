import React from "react";
import { showToast } from "../utils/toast";
import { useCustomerData } from "../hooks/useCustomerData";
import CustomerFormCard from "../components/CustomerFormCard";
import CustomerItemCard from "../components/CustomerItemCard";

export default function Customers() {
  const {
    filteredCustomers,
    search,
    setSearch,
    editingCustomer,
    form,
    saving,
    handleFormChange,
    handleEdit,
    resetForm,
    saveCustomer,
    deleteCustomer,
  } = useCustomerData();

  const handleSave = async () => {
    try {
      const saved = await saveCustomer();
      showToast(
        editingCustomer
          ? `Updated customer ${saved.name}`
          : `Added new customer ${saved.name}`
      );
    } catch (err) {
      showToast(err.message || "Failed to save customer");
    }
  };

  const handleDelete = async (customer) => {
    try {
      await deleteCustomer(customer);
      showToast(`Deleted customer ${customer.name}`);
    } catch (err) {
      console.error("Failed to delete customer", err);
      showToast("Failed to delete customer");
    }
  };

  return (
    <div className="p-4 pb-12 max-w-5xl space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Customer Directory</h1>
        <p className="text-xs text-slate-500">
          Manage customer records, contact information, and purchase preferences.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer Form */}
        <div>
          <CustomerFormCard
            form={form}
            editingCustomer={editingCustomer}
            saving={saving}
            onChange={handleFormChange}
            onSave={handleSave}
            onCancel={resetForm}
          />
        </div>

        {/* Customer Directory List */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Customers List</h2>
            <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {filteredCustomers.length} records
            </span>
          </div>

          <input
            type="text"
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
            {filteredCustomers.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-10">
                No customers found matching &quot;{search}&quot;
              </div>
            ) : (
              filteredCustomers.map((customer) => (
                <CustomerItemCard
                  key={customer._id}
                  customer={customer}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
