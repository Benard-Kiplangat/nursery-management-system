import { useState, useEffect, useMemo } from "react";
import { db } from "../db";

const emptyCustomer = { name: "", phone: "", email: "", notes: "" };

export function useCustomerData() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState(emptyCustomer);
  const [saving, setSaving] = useState(false);

  const loadCustomers = async () => {
    try {
      const result = await db.allDocs({
        include_docs: true,
        startkey: "customer:",
        endkey: "customer:\uffff",
      });
      const customerDocs = result.rows
        .map((row) => row.doc)
        .filter((doc) => doc && doc.type === "customer")
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt).getTime() -
            new Date(a.updatedAt || a.createdAt).getTime()
        );
      setCustomers(customerDocs);
    } catch (err) {
      console.error("Failed to load customers", err);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    const handleDataRefresh = () => {
      loadCustomers();
    };

    window.addEventListener("bosco:db-changed", handleDataRefresh);
    return () => window.removeEventListener("bosco:db-changed", handleDataRefresh);
  }, []);

  const resetForm = () => {
    setForm(emptyCustomer);
    setEditingCustomer(null);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      notes: customer.notes || "",
    });
  };

  const saveCustomer = async () => {
    if (!form.name.trim()) {
      throw new Error("Customer name is required.");
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
      return doc;
    } finally {
      setSaving(false);
    }
  };

  const deleteCustomer = async (customer) => {
    await db.remove(customer);
    await loadCustomers();
    if (editingCustomer && editingCustomer._id === customer._id) {
      resetForm();
    }
  };

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(query) ||
        c.phone?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query)
    );
  }, [customers, search]);

  return {
    customers,
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
  };
}
