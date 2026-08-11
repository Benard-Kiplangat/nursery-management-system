import React, { useEffect, useState } from "react";
import { db } from "../db";

const emptyCustomer = { name: "", phone: "", email: "", notes: "" };

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState(emptyCustomer);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const result = await db.allDocs({ include_docs: true });
      const customerDocs = result.rows
        .map(row => row.doc)
        .filter(doc => doc && doc.type === "customer")
        .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
      setCustomers(customerDocs);
    } catch (err) {
      console.error("Failed to load customers", err);
    }
  };

  const resetForm = () => {
    setForm(emptyCustomer);
    setEditingCustomer(null);
  };

  const handleFormChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      return alert("Customer name is required.");
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const doc = editingCustomer
        ? {
            ...editingCustomer,
            ...form,
            updatedAt: now,
          }
        : {
            _id: `customer:${Date.now()}:${Math.floor(Math.random() * 10000)}`,
            type: "customer",
            ...form,
            createdAt: now,
            updatedAt: now,
          };

      await db.put(doc);
      await loadCustomers();
      resetForm();
    } catch (err) {
      console.error("Failed to save customer", err);
      alert("Unable to save customer. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setForm({ name: customer.name || "", phone: customer.phone || "", email: customer.email || "", notes: customer.notes || "" });
  };

  const handleDelete = async (customer) => {
    if (!window.confirm(`Delete customer ${customer.name}?`)) return;
    try {
      await db.remove(customer);
      await loadCustomers();
      if (editingCustomer && editingCustomer._id === customer._id) {
        resetForm();
      }
    } catch (err) {
      console.error("Failed to delete customer", err);
      alert("Failed to delete customer. See console for details.");
    }
  };

  const filteredCustomers = customers.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-4 pb-32 max-w-xl">
      <h1 className="text-xl font-bold mb-4">Customers</h1>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="border rounded p-4 bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-3">{editingCustomer ? "Edit Customer" : "Add Customer"}</h2>
          <div className="space-y-3">
            <label className="block">
              <div className="text-sm font-semibold mb-1">Name</div>
              <input
                className="w-full border rounded p-2"
                value={form.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold mb-1">Phone</div>
              <input
                className="w-full border rounded p-2"
                value={form.phone}
                onChange={(e) => handleFormChange("phone", e.target.value)}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold mb-1">Email</div>
              <input
                className="w-full border rounded p-2"
                value={form.email}
                onChange={(e) => handleFormChange("email", e.target.value)}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold mb-1">Notes</div>
              <textarea
                className="w-full border rounded p-2"
                value={form.notes}
                onChange={(e) => handleFormChange("notes", e.target.value)}
                rows={4}
              />
            </label>
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-60"
              >
                {editingCustomer ? "Update Customer" : "Save Customer"}
              </button>
              {editingCustomer && (
                <button onClick={resetForm} className="bg-gray-200 rounded px-4 py-2 hover:bg-gray-300">
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="border rounded p-4 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Customer list</h2>
            <span className="text-xs text-gray-500">{filteredCustomers.length} records</span>
          </div>
          <input
            type="text"
            placeholder="Search by name, phone, or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded p-2 mb-3"
          />
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {filteredCustomers.length === 0 ? (
              <div className="text-sm text-gray-500">No customers found.</div>
            ) : (
              filteredCustomers.map(customer => (
                <div key={customer._id} className="border rounded p-3 bg-gray-50">
                  <div className="flex justify-between gap-2 items-start">
                    <div>
                      <div className="font-semibold">{customer.name || "Unnamed customer"}</div>
                      <div className="text-sm text-gray-600">{customer.phone || "No phone"} {customer.email ? `• ${customer.email}` : ""}</div>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => handleEdit(customer)} className="text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => handleDelete(customer)} className="text-red-600 hover:underline">Delete</button>
                    </div>
                  </div>
                  {customer.notes && <div className="mt-2 text-sm text-gray-700">Notes: {customer.notes}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
