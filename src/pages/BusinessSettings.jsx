import React, { useEffect, useState } from "react";
import { DEFAULT_APP_CONFIG, useBusinessConfig } from "../config";
import { useAuth } from "../context/AuthContext";
import { showToast } from "../utils/toast";
//import { db } from "../db";

const fieldDefinitions = [
  { name: "businessName", label: "Business Name", placeholder: "" },
  /*{ name: "businessCode", label: "Business Code", placeholder: "XS" },*/
  { name: "businessTel", label: "Business Contact", placeholder: "" },
  /*{ name: "kraPin", label: "KRA PIN", placeholder: "A123456789B" },*/
  { name: "address", label: "Business Location/Postal Address", placeholder: "Located in..." },
  /*{ name: "businessDisplayName", label: "Display Name", placeholder: "XS Farm Nursery" },
  { name: "transactionDescription", label: "M-Pesa Transaction Description", placeholder: "XS Farm" }*/
];
/*
const ETIMS_API_URL = "https://yelivate-apis.onrender.com";
const SEEDLING_DEFAULTS = {
  itemClassCode: "99020000",
  itemTypeCode: "3",
  originNationCode: "KE",
  packageUnitCode: "NT",
  quantityUnitCode: "U",
  taxTypeCode: "D",
};*/

export default function BusinessSettings() {
  const { currentUser, isAdmin } = useAuth();
  const { config, updateConfig } = useBusinessConfig();
  const [form, setForm] = useState(config);
  const [saving, setSaving] = useState(false);
  //const [crops, setCrops] = useState([]);
  // const [registeringCropId, setRegisteringCropId] = useState(null);
  // const [registeringAll, setRegisteringAll] = useState(false);
  //const [customers, setCustomers] = useState([]);
  //const [suppliers, setSuppliers] = useState([]);
  // const [registeringSupplierId, setRegisteringSupplierId] = useState(null);
  // const [registeringAllSuppliers, setRegisteringAllSuppliers] = useState(false);
  // const [registeringCustomerId, setRegisteringCustomerId] = useState(null);
  // const [registeringAllCustomers, setRegisteringAllCustomers] = useState(false);
  // const [updatingCropId, setUpdatingCropId] = useState(null);
  // const [updatingCustomerId, setUpdatingCustomerId] = useState(null);
  // const [updatingSupplierId, setUpdatingSupplierId] = useState(null);
  // const [loadingItemsFromDigitax, setLoadingItemsFromDigitax] = useState(false);
  // const [loadingCustomersFromDigitax, setLoadingCustomersFromDigitax] = useState(false);
  // const [loadingSuppliersFromDigitax, setLoadingSuppliersFromDigitax] = useState(false);
  // const [loadingAllFromDigitax, setLoadingAllFromDigitax] = useState(false);

  //useEffect(() => {
  //  setForm(config);
  //}, [config]);

  // useEffect(() => {
  //   loadCrops();
  //   loadCustomers();
  //   loadSuppliers();
  // }, []);

/*  const loadCrops = async () => {
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
*/
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
/*
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

  const loadItemsFromDigitax = async ({ silent = false } = {}) => {
    setLoadingItemsFromDigitax(true);
    try {
      const response = await fetch(`${ETIMS_API_URL}/api/etims/items?page_size=100`);
      const result = await response.json();
      if (!response.ok || result?.success === false) {
        throw new Error(result?.error?.message || result?.error || "Failed to load items from DigiTax.");
      }
      const rawList = Array.isArray(result?.data)
        ? result.data
        : result?.data?.data || result?.item || [];

      if (!rawList.length) {
        if (!silent) showToast("No items found in DigiTax.");
        return 0;
      }

      const existingRes = await db.allDocs({ include_docs: true });
      const currentCrops = existingRes.rows.map((r) => r.doc).filter((d) => d && d.type === "crop");

      let addedCount = 0;
      let updatedCount = 0;
      const now = new Date().toISOString();

      for (const dItem of rawList) {
        const itemId = String(dItem.id || dItem._id || "").trim();
        const itemName = String(dItem.name || dItem.item_name || dItem.itemName || "").trim();
        if (!itemId || !itemName) continue;

        const price = Number(dItem.default_unit_price ?? dItem.sellingPrice ?? dItem.price ?? 0);
        const itemCode = dItem.item_bar_code || dItem.etims_item_code || null;

        // Match existing crop by digitaxItemId, or case-insensitive name
        const match = currentCrops.find(
          (c) => c.digitaxItemId === itemId || c.name.toLowerCase() === itemName.toLowerCase()
        );

        if (match) {
          const updated = {
            ...match,
            digitaxItemId: itemId,
            digitaxItemCode: itemCode || match.digitaxItemCode || null,
            name: match.name || itemName,
            price: match.price || price,
            taxTypeCode: dItem.tax_type_code || match.taxTypeCode || "D",
            updatedAt: now,
          };
          await db.put(updated);
          updatedCount++;
        } else {/*
          const newCrop = {
            _id: `crop:${itemName.replace(/\s+/g, "_")}:${Date.now()}:${Math.floor(Math.random() * 1000)}`,
            type: "crop",
            name: itemName,
            price,
            daysToReady: 0,
            minStockThreshold: 25,
            active: true,
            digitaxItemId: itemId,
            digitaxItemCode: itemCode,
            digitaxRegisteredAt: now,
            createdAt: now,
            updatedAt: now,
          };
          await db.put(newCrop);
          currentCrops.push(newCrop);
          addedCount++;
        }
      }

      await loadCrops();
      if (!silent) {
        showToast(`DigiTax Items: ${addedCount} imported, ${updatedCount} matched/updated.`);
      }
      return addedCount + updatedCount;
    } catch (error) {
      console.error("Error loading items from DigiTax:", error);
      if (!silent) showToast(`Could not load items from DigiTax: ${error.message}`);
      throw error;
    } finally {
      setLoadingItemsFromDigitax(false);
    }
  };

  const loadCustomersFromDigitax = async ({ silent = false } = {}) => {
    setLoadingCustomersFromDigitax(true);
    try {
      const response = await fetch(`${ETIMS_API_URL}/api/etims/customers?page_size=100`);
      const result = await response.json();
      if (!response.ok || result?.success === false) {
        throw new Error(result?.error?.message || result?.error || "Failed to load customers from DigiTax.");
      }
      const rawList = Array.isArray(result?.data)
        ? result.data
        : result?.data?.data || result?.customer || [];

      if (!rawList.length) {
        if (!silent) showToast("No customers found in DigiTax.");
        return 0;
      }

      const existingRes = await db.allDocs({ include_docs: true, startkey: "customer:", endkey: "customer:\uffff" });
      const currentCustomers = existingRes.rows.map((r) => r.doc).filter((d) => d && d.type === "customer");

      let addedCount = 0;
      let updatedCount = 0;
      const now = new Date().toISOString();

      for (const dCust of rawList) {
        const custId = String(dCust.id || dCust._id || "").trim();
        const custName = String(dCust.customer_name || dCust.name || "").trim();
        const custTin = String(dCust.customer_tin || dCust.krapin || dCust.pin || "").trim();
        if (!custId || (!custName && !custTin)) continue;

        const match = currentCustomers.find(
          (c) =>
            c.digitaxCustomerId === custId ||
            (custTin && c.krapin && c.krapin.toUpperCase() === custTin.toUpperCase()) ||
            (custName && c.name.toLowerCase() === custName.toLowerCase())
        );

        if (match) {
          const updated = {
            ...match,
            digitaxCustomerId: custId,
            name: match.name || custName,
            krapin: match.krapin || custTin,
            email: match.email || dCust.email || "",
            phone: match.phone || dCust.phone || "",
            updatedAt: now,
          };
          await db.put(updated);
          updatedCount++;
        } else {
          const newCustomer = {
            _id: `customer:${Date.now()}:${Math.floor(Math.random() * 10000)}`,
            type: "customer",
            name: custName || "DigiTax Customer",
            krapin: custTin,
            phone: dCust.phone || "",
            email: dCust.email || "",
            notes: "Imported from DigiTax",
            digitaxCustomerId: custId,
            digitaxRegisteredAt: now,
            createdAt: now,
            updatedAt: now,
          };
          await db.put(newCustomer);
          currentCustomers.push(newCustomer);
          addedCount++;
        }
      }

      await loadCustomers();
      if (!silent) {
        showToast(`DigiTax Customers: ${addedCount} imported, ${updatedCount} matched/updated.`);
      }
      return addedCount + updatedCount;
    } catch (error) {
      console.error("Error loading customers from DigiTax:", error);
      if (!silent) showToast(`Could not load customers from DigiTax: ${error.message}`);
      throw error;
    } finally {
      setLoadingCustomersFromDigitax(false);
    }
  };

  const loadSuppliersFromDigitax = async ({ silent = false } = {}) => {
    setLoadingSuppliersFromDigitax(true);
    try {
      const response = await fetch(`${ETIMS_API_URL}/api/etims/suppliers?page_size=100`);
      const result = await response.json();
      if (!response.ok || result?.success === false) {
        throw new Error(result?.error?.message || result?.error || "Failed to load suppliers from DigiTax.");
      }
      const rawList = Array.isArray(result?.data)
        ? result.data
        : result?.data?.data || result?.supplier || [];

      if (!rawList.length) {
        if (!silent) showToast("No suppliers found in DigiTax.");
        return 0;
      }

      const existingRes = await db.allDocs({ include_docs: true, startkey: "supplier:", endkey: "supplier:\uffff" });
      const currentSuppliers = existingRes.rows.map((r) => r.doc).filter((d) => d && d.type === "supplier");

      let addedCount = 0;
      let updatedCount = 0;
      const now = new Date().toISOString();

      for (const dSupp of rawList) {
        const suppId = String(dSupp.id || dSupp._id || "").trim();
        const suppName = String(dSupp.supplier_name || dSupp.name || "").trim();
        const suppTin = String(dSupp.supplier_tin || dSupp.krapin || dSupp.pin || "").trim();
        if (!suppId || (!suppName && !suppTin)) continue;

        const match = currentSuppliers.find(
          (s) =>
            s.digitaxSupplierId === suppId ||
            (suppTin && s.krapin && s.krapin.toUpperCase() === suppTin.toUpperCase()) ||
            (suppName && s.name.toLowerCase() === suppName.toLowerCase())
        );

        if (match) {
          const updated = {
            ...match,
            digitaxSupplierId: suppId,
            name: match.name || suppName,
            krapin: match.krapin || suppTin,
            email: match.email || dSupp.email || "",
            phone: match.phone || dSupp.phone || "",
            updatedAt: now,
          };
          await db.put(updated);
          updatedCount++;
        } else {
          const newSupplier = {
            _id: `supplier:${Date.now()}:${Math.floor(Math.random() * 10000)}`,
            type: "supplier",
            name: suppName || "Supplier",
            krapin: suppTin,
            phone: dSupp.phone || "",
            email: dSupp.email || "",
            contactPerson: dSupp.contact_person || "",
            address: dSupp.address || "",
            digitaxSupplierId: suppId,
            digitaxRegisteredAt: now,
            createdAt: now,
            updatedAt: now,
          };
          await db.put(newSupplier);
          currentSuppliers.push(newSupplier);
          addedCount++;
        }
      }

      await loadSuppliers();
      if (!silent) {
        showToast(`DigiTax Suppliers: ${addedCount} imported, ${updatedCount} matched/updated.`);
      }
      return addedCount + updatedCount;
    } catch (error) {
      console.error("Error loading suppliers from DigiTax:", error);
      if (!silent) showToast(`Could not load suppliers from DigiTax: ${error.message}`);
      throw error;
    } finally {
      setLoadingSuppliersFromDigitax(false);
    }
  };

  const loadAllFromDigitax = async () => {
    setLoadingAllFromDigitax(true);
    try {
      const results = await Promise.allSettled([
        loadItemsFromDigitax({ silent: true }),
        loadCustomersFromDigitax({ silent: true }),
        loadSuppliersFromDigitax({ silent: true }),
      ]);

      const itemsSuccess = results[0].status === "fulfilled";
      const customersSuccess = results[1].status === "fulfilled";
      const suppliersSuccess = results[2].status === "fulfilled";

      if (itemsSuccess && customersSuccess && suppliersSuccess) {
        showToast("Successfully loaded and synced items, customers, and suppliers from DigiTax.");
      } else {
        const errors = results
          .filter((r) => r.status === "rejected")
          .map((r) => r.reason?.message || "Error")
          .join("; ");
        showToast(`DigiTax sync completed with notices: ${errors}`);
      }
    } finally {
      setLoadingAllFromDigitax(false);
    }
  };
  */

  return (
    <div className="p-4 pb-12 mb-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Business Settings</h1>
        <p className="text-sm text-slate-500">
          Update your business details used in receipt & across the app.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
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

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-200">
          <button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save business settings"}
          </button>
          </div>
      </form>

      {/* DigiTax Import & Sync Card 
      <section className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl shadow-sm p-5 mt-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-blue-950 flex items-center gap-2">
              <span>📥</span> Import Data from DigiTax
            </h2>
            <p className="text-sm text-blue-800 mt-1 max-w-xl">
              Fetch existing items (crops/seedlings), registered customers, and suppliers directly from your DigiTax account and sync them locally.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAllFromDigitax}
            disabled={loadingAllFromDigitax || loadingItemsFromDigitax || loadingCustomersFromDigitax || loadingSuppliersFromDigitax}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-700 shadow-sm disabled:opacity-60 transition shrink-0"
          >
            {loadingAllFromDigitax ? (
              <>
                <span className="inline-block animate-spin">⏳</span>
                <span>Importing All...</span>
              </>
            ) : (
              <>
                <span>🔄</span>
                <span>Import All from DigiTax</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-blue-200/60">
          <button
            type="button"
            onClick={() => loadItemsFromDigitax()}
            disabled={loadingItemsFromDigitax || loadingAllFromDigitax}
            className="flex items-center justify-center gap-2 bg-white border border-blue-200 hover:bg-blue-50 text-blue-900 px-3 py-2 rounded-xl text-sm font-medium transition disabled:opacity-60 shadow-2xs"
          >
            {loadingItemsFromDigitax ? "Loading Items..." : "📦 Load Items Only"}
          </button>

          <button
            type="button"
            onClick={() => loadCustomersFromDigitax()}
            disabled={loadingCustomersFromDigitax || loadingAllFromDigitax}
            className="flex items-center justify-center gap-2 bg-white border border-blue-200 hover:bg-blue-50 text-blue-900 px-3 py-2 rounded-xl text-sm font-medium transition disabled:opacity-60 shadow-2xs"
          >
            {loadingCustomersFromDigitax ? "Loading Customers..." : "👥 Load Customers Only"}
          </button>

          <button
            type="button"
            onClick={() => loadSuppliersFromDigitax()}
            disabled={loadingSuppliersFromDigitax || loadingAllFromDigitax}
            className="flex items-center justify-center gap-2 bg-white border border-blue-200 hover:bg-blue-50 text-blue-900 px-3 py-2 rounded-xl text-sm font-medium transition disabled:opacity-60 shadow-2xs"
          >
            {loadingSuppliersFromDigitax ? "Loading Suppliers..." : "🚚 Load Suppliers Only"}
          </button>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 mt-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Register seedlings in DigiTax</h2>
            <p className="text-sm text-slate-500 mt-1">
              Register crop varieties as DigiTax items before creating eTIMS invoices. Seedling item defaults are applied automatically.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadItemsFromDigitax()}
              disabled={loadingItemsFromDigitax || loadingAllFromDigitax}
              className="border border-blue-300 text-blue-700 bg-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-blue-50 disabled:opacity-60"
            >
              {loadingItemsFromDigitax ? "Loading..." : "Load items from DigiTax"}
            </button>
            <button
              type="button"
              onClick={registerAllCrops}
              disabled={registeringAll || crops.every((crop) => crop.digitaxItemId || crop.active === false)}
              className="bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {registeringAll ? "Registering..." : "Register all active crops"}
            </button>
          </div>
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadCustomersFromDigitax()}
              disabled={loadingCustomersFromDigitax || loadingAllFromDigitax}
              className="border border-blue-300 text-blue-700 bg-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-blue-50 disabled:opacity-60"
            >
              {loadingCustomersFromDigitax ? "Loading..." : "Load customers from DigiTax"}
            </button>
            <button
              type="button"
              onClick={registerAllCustomers}
              disabled={registeringAllCustomers || customers.every((customer) => customer.digitaxCustomerId || !customer.krapin)}
              className="bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {registeringAllCustomers ? "Registering..." : "Register all customers"}
            </button>
          </div>
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadSuppliersFromDigitax()}
              disabled={loadingSuppliersFromDigitax || loadingAllFromDigitax}
              className="border border-blue-300 text-blue-700 bg-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-blue-50 disabled:opacity-60"
            >
              {loadingSuppliersFromDigitax ? "Loading..." : "Load suppliers from DigiTax"}
            </button>
            <button
              type="button"
              onClick={registerAllSuppliers}
              disabled={registeringAllSuppliers || suppliers.every((supplier) => supplier.digitaxSupplierId || !supplier.krapin)}
              className="bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {registeringAllSuppliers ? "Registering..." : "Register all suppliers"}
            </button>
          </div>
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
*/}

    </div>
  );
}
