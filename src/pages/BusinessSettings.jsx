import React, { useEffect, useState } from "react";
import { DEFAULT_APP_CONFIG, useBusinessConfig } from "../config";
import { useAuth } from "../context/AuthContext";
import { showToast } from "../utils/toast";
import { db } from "../db";

const fieldDefinitions = [
  { name: "businessName", label: "Business Name", placeholder: "XS Farm" },
  { name: "businessCode", label: "Business Code", placeholder: "XS" },
  { name: "businessTel", label: "Business Contact", placeholder: "+254700000000" },
  { name: "kraPin", label: "KRA PIN", placeholder: "A123456789B" },
  { name: "address", label: "Business Address", placeholder: "Bomet-Nairobi Highway" },
  { name: "businessDisplayName", label: "Display Name", placeholder: "XS Farm Nursery" },
  { name: "appName", label: "App Name", placeholder: "XS Farm & Nursery POS" },
  { name: "systemName", label: "System Name", placeholder: "XS Nursery Management System" },
  { name: "transactionDescription", label: "M-Pesa Transaction Description", placeholder: "XS Farm" },
  { name: "currency", label: "Currency", placeholder: "KES" },
];

const ETIMS_API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const SEEDLING_DEFAULTS = {
  itemClassCode: "99020000",
  itemTypeCode: "3",
  originNationCode: "KE",
  packageUnitCode: "NT",
  quantityUnitCode: "U",
  taxTypeCode: "D",
};

export default function BusinessSettings() {
  const { currentUser, isAdmin } = useAuth();
  const { config, updateConfig, resetConfig } = useBusinessConfig();
  const [form, setForm] = useState(config);
  const [saving, setSaving] = useState(false);
  const [crops, setCrops] = useState([]);
  const [registeringCropId, setRegisteringCropId] = useState(null);
  const [registeringAll, setRegisteringAll] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [registeringSupplierId, setRegisteringSupplierId] = useState(null);
  const [registeringAllSuppliers, setRegisteringAllSuppliers] = useState(false);
  const [registeringCustomerId, setRegisteringCustomerId] = useState(null);
  const [registeringAllCustomers, setRegisteringAllCustomers] = useState(false);
  const [updatingCropId, setUpdatingCropId] = useState(null);
  const [updatingCustomerId, setUpdatingCustomerId] = useState(null);
  const [updatingSupplierId, setUpdatingSupplierId] = useState(null);

  useEffect(() => {
    setForm(config);
  }, [config]);

  useEffect(() => {
    loadCrops();
    loadCustomers();
    loadSuppliers();
  }, []);

  const loadCrops = async () => {
    const result = await db.allDocs({ include_docs: true });
    setCrops(result.rows.map((row) => row.doc).filter((doc) => doc?.type === "crop"));
  };

  const loadCustomers = async () => {
    const result = await db.allDocs({ include_docs: true, startkey: "customer:", endkey: "customer:\uffff" });
    setCustomers(result.rows.map((row) => row.doc).filter((doc) => doc?.type === "customer"));
  };

  const loadSuppliers = async () => {
    const result = await db.allDocs({ include_docs: true, startkey: "supplier:", endkey: "supplier:\uffff" });
    setSuppliers(result.rows.map((row) => row.doc).filter((doc) => doc?.type === "supplier"));
  };

  if (!currentUser || !isAdmin) {
    return (
      <div className="p-8 text-center text-rose-600 font-bold">
        
      </div>
    );
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = (event) => {
    event.preventDefault();
    setSaving(true);

    const normalized = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [
        key,
        typeof value === "string" && value.trim() ? value.trim() : DEFAULT_APP_CONFIG[key],
      ])
    );

    const next = updateConfig(normalized);
    if (next) {
      showToast("Business settings updated successfully.");
    }

    setSaving(false);
  };

  const handleReset = () => {
    const resetValue = resetConfig();
    setForm(resetValue);
    showToast("Business settings reset to default values.");
  };

  const registerCrop = async (crop) => {
    setRegisteringCropId(crop._id);
    try {
      const response = await fetch(`${ETIMS_API_URL}/api/etims/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: crop.name,
          sellingPrice: Number(crop.price || 0),
          stockQuantity: 0,
          ...SEEDLING_DEFAULTS,
          itemCode: crop._id,
        }),
      });
      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(`DigiTax service returned an unexpected response (${response.status}). Restart the server and try again.`);
      }
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || result.error || "DigiTax rejected the item.");
      }

      const digitaxItem = result.item || result.digitaxPayload?.data || result.digitaxPayload;
      if (!digitaxItem?.id) {
        throw new Error("DigiTax did not return an item ID.");
      }

      await db.put({
        ...crop,
        digitaxItemId: digitaxItem.id,
        digitaxItemCode: digitaxItem.etims_item_code || null,
        digitaxRegisteredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setCrops((current) => current.map((item) => (
        item._id === crop._id
          ? { ...item, digitaxItemId: digitaxItem.id, digitaxItemCode: digitaxItem.etims_item_code || null }
          : item
      )));
      showToast(`${crop.name} registered in DigiTax.`);
    } catch (error) {
      showToast(`Could not register ${crop.name}: ${error.message}`);
      console.log(error);
    } finally {
      setRegisteringCropId(null);
    }
  };

  const registerAllCrops = async () => {
    const unregistered = crops.filter((crop) => !crop.digitaxItemId && crop.active !== false);
    setRegisteringAll(true);
    try {
      for (const crop of unregistered) {
        await registerCrop(crop);
      }
      if (!unregistered.length) showToast("All active crops are already registered in DigiTax.");
    } finally {
      setRegisteringAll(false);
    }
  };

  const updateCrop = async (crop) => {
    setUpdatingCropId(crop._id);
    try {
      const response = await fetch(`${ETIMS_API_URL}/api/etims/crops/${encodeURIComponent(crop.digitaxItemId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: crop.name, sellingPrice: Number(crop.price || 0), taxTypeCode: crop.taxTypeCode || "D" }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || result.error || "DigiTax rejected the crop update.");
      const updatedCrop = { ...crop, updatedAt: new Date().toISOString() };
      await db.put(updatedCrop);
      setCrops((current) => current.map((item) => item._id === crop._id ? updatedCrop : item));
      showToast(`${crop.name} updated in DigiTax.`);
    } catch (error) {
      showToast(`Could not update ${crop.name}: ${error.message}`);
    } finally {
      setUpdatingCropId(null);
    }
  };

  const registerCustomer = async (customer) => {
    setRegisteringCustomerId(customer._id);
    try {
      const response = await fetch(`${ETIMS_API_URL}/api/etims/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customer),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || result.error || "DigiTax rejected the customer.");
      }

      const digitaxCustomer = result.customer || result.digitaxPayload?.data || result.digitaxPayload;
      if (!digitaxCustomer?.id) throw new Error("DigiTax did not return a customer ID.");

      const updatedCustomer = {
        ...customer,
        digitaxCustomerId: digitaxCustomer.id,
        digitaxRegisteredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.put(updatedCustomer);
      setCustomers((current) => current.map((item) => item._id === customer._id ? updatedCustomer : item));
      showToast(`${customer.name} registered in DigiTax.`);
    } catch (error) {
      showToast(`Could not register ${customer.name}: ${error.message}`);
      console.log(customer.name, error);
    } finally {
      setRegisteringCustomerId(null);
    }
  };

  const registerAllCustomers = async () => {
    const unregistered = customers.filter((customer) => !customer.digitaxCustomerId && customer.krapin);
    setRegisteringAllCustomers(true);
    try {
      for (const customer of unregistered) await registerCustomer(customer);
      if (!unregistered.length) showToast("No unregistered customers with a KRA PIN were found.");
    } finally {
      setRegisteringAllCustomers(false);
    }
  };

  const updateCustomer = async (customer) => {
    setUpdatingCustomerId(customer._id);
    try {
      const response = await fetch(`${ETIMS_API_URL}/api/etims/customers/${encodeURIComponent(customer.digitaxCustomerId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customer),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || result.error || "DigiTax rejected the customer update.");
      showToast(`${customer.name} updated in DigiTax.`);
    } catch (error) {
      showToast(`Could not update ${customer.name}: ${error.message}`);
    } finally {
      setUpdatingCustomerId(null);
    }
  };

  const registerSupplier = async (supplier) => {
    setRegisteringSupplierId(supplier._id);
    try {
      const response = await fetch(`${ETIMS_API_URL}/api/etims/suppliers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplier),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || result.error || "DigiTax rejected the supplier.");
      }

      const digitaxSupplier = result.supplier || result.digitaxPayload?.data || result.digitaxPayload;
      if (!digitaxSupplier?.id) throw new Error("DigiTax did not return a supplier ID.");

      const updatedSupplier = {
        ...supplier,
        digitaxSupplierId: digitaxSupplier.id,
        digitaxRegisteredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.put(updatedSupplier);
      setSuppliers((current) => current.map((item) => item._id === supplier._id ? updatedSupplier : item));
      showToast(`${supplier.name} registered in DigiTax.`);
    } catch (error) {
      showToast(`Could not register ${supplier.name}: ${error.message}`);
      console.log(supplier.name, error);
    } finally {
      setRegisteringSupplierId(null);
    }
  };

  const registerAllSuppliers = async () => {
    const unregistered = suppliers.filter((supplier) => !supplier.digitaxSupplierId && supplier.krapin);
    setRegisteringAllSuppliers(true);
    try {
      for (const supplier of unregistered) await registerSupplier(supplier);
      if (!unregistered.length) showToast("No unregistered suppliers with a KRA PIN were found.");
    } finally {
      setRegisteringAllSuppliers(false);
    }
  };

  const updateSupplier = async (supplier) => {
    setUpdatingSupplierId(supplier._id);
    try {
      const response = await fetch(`${ETIMS_API_URL}/api/etims/suppliers/${encodeURIComponent(supplier.digitaxSupplierId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplier),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || result.error || "DigiTax rejected the supplier update.");
      showToast(`${supplier.name} updated in DigiTax.`);
    } catch (error) {
      showToast(`Could not update ${supplier.name}: ${error.message}`);
    } finally {
      setUpdatingSupplierId(null);
    }
  };

  return (
    <div className="p-4 pb-12 mb-4 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Business Settings</h1>
        <p className="text-sm text-slate-500">
          Update the business details used across the app. Any value left blank will remain at the default configuration.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          {fieldDefinitions.map((field) => (
            <label key={field.name} className="block text-sm font-medium text-slate-700">
              <span className="mb-1 block">{field.label}</span>
              <input
                type="text"
                name={field.name}
                value={form[field.name] ?? ""}
                onChange={handleChange}
                placeholder={field.placeholder}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
              />
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200">
          <button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save business settings"}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="border border-slate-300 text-slate-700 px-4 py-2.5 rounded-xl font-medium hover:bg-slate-100"
          >
            Reset to default
          </button>

          <span className="text-xs text-slate-500">
            Default values come from {DEFAULT_APP_CONFIG.businessName || "the app config"}.
          </span>
        </div>
      </form>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 mt-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Register seedlings in DigiTax</h2>
            <p className="text-sm text-slate-500 mt-1">
              Register crop varieties as DigiTax items before creating eTIMS invoices. Seedling item defaults are applied automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={registerAllCrops}
            disabled={registeringAll || crops.every((crop) => crop.digitaxItemId || crop.active === false)}
            className="bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {registeringAll ? "Registering..." : "Register all active crops"}
          </button>
        </div>

        {!crops.length ? (
          <p className="text-sm text-slate-500">No crops have been added yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl mt-4">
            {crops.map((crop) => (
              <div key={crop._id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-medium text-slate-800">{crop.name}</p>
                  <p className="text-xs text-slate-500">
                    KSh {Number(crop.price || 0).toFixed(2)} · {crop.digitaxItemId ? `DigiTax ID: ${crop.digitaxItemId}` : "Not registered"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => registerCrop(crop)} disabled={registeringCropId === crop._id || crop.active === false} className="border border-blue-300 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-60">
                    {registeringCropId === crop._id ? "Registering..." : crop.digitaxItemId ? "Register again" : "Register"}
                  </button>
                  {crop.digitaxItemId && <button type="button" onClick={() => updateCrop(crop)} disabled={updatingCropId === crop._id} className="border border-emerald-300 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-50 disabled:opacity-60">
                    {updatingCropId === crop._id ? "Updating..." : "Update"}
                  </button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 mt-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Register customers in DigiTax</h2>
            <p className="text-sm text-slate-500 mt-1">
              Customers must have a KRA PIN because DigiTax requires a tax identification number for registration.
            </p>
          </div>
          <button
            type="button"
            onClick={registerAllCustomers}
            disabled={registeringAllCustomers || customers.every((customer) => customer.digitaxCustomerId || !customer.krapin)}
            className="bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {registeringAllCustomers ? "Registering..." : "Register all customers"}
          </button>
        </div>

        {!customers.length ? (
          <p className="text-sm text-slate-500">No customers have been added yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {customers.map((customer) => (
              <div key={customer._id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-medium text-slate-800">{customer.name}</p>
                  <p className="text-xs text-slate-500">
                    {customer.krapin || "KRA PIN missing"} · {customer.digitaxCustomerId ? `DigiTax ID: ${customer.digitaxCustomerId}` : "Not registered"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => registerCustomer(customer)} disabled={registeringCustomerId === customer._id || !customer.krapin} className="border border-blue-300 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-60">
                    {registeringCustomerId === customer._id ? "Registering..." : customer.digitaxCustomerId ? "Register again" : "Register"}
                  </button>
                  {customer.digitaxCustomerId && <button type="button" onClick={() => updateCustomer(customer)} disabled={updatingCustomerId === customer._id} className="border border-emerald-300 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-50 disabled:opacity-60">
                    {updatingCustomerId === customer._id ? "Updating..." : "Update"}
                  </button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 mt-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Register suppliers in DigiTax</h2>
            <p className="text-sm text-slate-500 mt-1">
              Suppliers must have a KRA PIN because DigiTax requires a tax identification number for registration.
            </p>
          </div>
          <button
            type="button"
            onClick={registerAllSuppliers}
            disabled={registeringAllSuppliers || suppliers.every((supplier) => supplier.digitaxSupplierId || !supplier.krapin)}
            className="bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {registeringAllSuppliers ? "Registering..." : "Register all suppliers"}
          </button>
        </div>

        {!suppliers.length ? (
          <p className="text-sm text-slate-500">No suppliers have been added yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {suppliers.map((supplier) => (
              <div key={supplier._id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-medium text-slate-800">{supplier.name}</p>
                  <p className="text-xs text-slate-500">
                    {supplier.krapin || "KRA PIN missing"} · {supplier.digitaxSupplierId ? `DigiTax ID: ${supplier.digitaxSupplierId}` : "Not registered"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => registerSupplier(supplier)} disabled={registeringSupplierId === supplier._id || !supplier.krapin} className="border border-blue-300 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-60">
                    {registeringSupplierId === supplier._id ? "Registering..." : supplier.digitaxSupplierId ? "Register again" : "Register"}
                  </button>
                  {supplier.digitaxSupplierId && <button type="button" onClick={() => updateSupplier(supplier)} disabled={updatingSupplierId === supplier._id} className="border border-emerald-300 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-50 disabled:opacity-60">
                    {updatingSupplierId === supplier._id ? "Updating..." : "Update"}
                  </button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
