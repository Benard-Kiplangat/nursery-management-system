import { useCallback, useEffect, useState } from "react";
import {
  db,
  getBatches,
  getAvailableBatchesForCrop,
  getStockAlertStatus,
} from "../db";
import { getEligibleBatches } from "../utils/batchSelection";

export function usePOSData({
  presales = {},
  search = "",
  setSelectedBatches,
} = {}) {
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [availableBatchesByCrop, setAvailableBatchesByCrop] = useState({});
  const [fullLoaded, setFullLoaded] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [outstandingCredits, setOutstandingCredits] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);

  const getPopularIds = useCallback(() => {
    try {
      const raw = localStorage.getItem("popularCounts");
      if (!raw) return [];
      const map = JSON.parse(raw);
      return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([id]) => id);
    } catch (e) {
      return [];
    }
  }, []);

  const loadBatches = useCallback(async () => {
    try {
      const items = await getBatches();
      setBatches(items);
    } catch (e) {
      console.error("Failed to load batches", e);
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    try {
      const result = await db.allDocs({ include_docs: true });
      const custs = result.rows
        .map(r => r.doc)
        .filter(d => d && d.type === "customer");
      setCustomers(custs);
    } catch (e) {
      console.error("failed to load customers", e);
    }
  }, []);

  const loadOutstandingCredits = useCallback(async () => {
    try {
      const result = await db.allDocs({ include_docs: true });
      const all = result.rows
        .map(r => r.doc)
        .filter(d => d && d.type === "sale" && d.isCreditSale && !d.isCreditPaid);

      const entries = [];
      const bulkMap = {};
      all.forEach(sale => {
        if (sale.isBulkSale && sale.bulkSaleId) {
          if (!bulkMap[sale.bulkSaleId]) {
            const group = {
              isBulkGroup: true,
              bulkSaleId: sale.bulkSaleId,
              customerName: sale.customerName,
              dwnPayment: sale.bulkDwnPayment || 0,
              timestamp: sale.timestamp,
              items: [],
            };
            bulkMap[sale.bulkSaleId] = group;
            entries.push(group);
          }
          bulkMap[sale.bulkSaleId].items.push(sale);
        } else {
          entries.push(sale);
        }
      });

      setOutstandingCredits(entries);
    } catch (e) {
      console.error("Failed to load credit sales", e);
    }
  }, []);

  const loadFullProducts = useCallback(async () => {
    try {
      const result = await db.allDocs({ include_docs: true });
      const productDocs = result.rows
        .map(row => row.doc)
        .filter(doc => doc && doc.type === "crop");
      setProducts(productDocs);
      setFullLoaded(true);
    } catch (e) {
      console.error("failed to load full products", e);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const fast = await db.allDocs({
        include_docs: true,
        startkey: "crop",
        endkey: "crop\uffff",
        limit: 12,
      });
      const fastProds = fast.rows
        .map(r => r.doc)
        .filter(d => d && d.type === "crop");

      const popular = getPopularIds();
      if (popular.length) {
        const missingIds = popular.filter(id => !fastProds.find(p => p._id === id));
        if (missingIds.length) {
          const got = await Promise.all(missingIds.map(id => db.get(id).catch(() => null)));
          got.forEach(g => {
            if (g && g.type === "crop") fastProds.push(g);
          });
        }
      }

      if (fastProds.length) {
        setProducts(fastProds);
      }
    } catch (e) {
      console.warn("fast product load failed", e);
    }

    loadFullProducts();
  }, [getPopularIds, loadFullProducts]);

  const findCustomerByName = useCallback((name) => {
    const normalizedName = String(name || "").trim().toLowerCase();
    return customers.find(customer => (
      String(customer.name || "").trim().toLowerCase() === normalizedName
    ));
  }, [customers]);

  useEffect(() => {
    if (!setSelectedBatches) return;

    setSelectedBatches(prev => {
      const next = { ...prev };
      let changed = false;

      products.forEach(product => {
        const selectedId = next[product._id];
        if (!selectedId) return;

        const available = batches.filter(batch => (
          batch.cropId === product._id && Number(batch.quantityRemaining || 0) > 0
        ));
        const validBatches = getEligibleBatches(available, presales[product._id] || false);

        if (!validBatches.some(batch => batch._id === selectedId)) {
          delete next[product._id];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [presales, batches, products, setSelectedBatches]);

  useEffect(() => {
    let cancelled = false;

    const loadAvailableBatches = async () => {
      const result = {};
      for (const product of products) {
        result[product._id] = await getAvailableBatchesForCrop(batches, product._id);
      }
      if (!cancelled) setAvailableBatchesByCrop(result);
    };

    if (products.length && batches.length) {
      loadAvailableBatches();
    } else {
      setAvailableBatchesByCrop({});
    }

    return () => {
      cancelled = true;
    };
  }, [products, batches, presales]);

  useEffect(() => {
    let cancelled = false;

    const calculateLowStock = async () => {
      if (!products.length || !batches.length) {
        setLowStockProducts([]);
        return;
      }

      const results = [];
      for (const product of products) {
        const availableBatches = await getAvailableBatchesForCrop(batches, product._id);
        const available = availableBatches.reduce(
          (sum, batch) => sum + Number(batch.availableForSale || 0),
          0
        );
        const alertInfo = getStockAlertStatus(product, available);

        if (alertInfo.status === "low_stock" || alertInfo.status === "out_of_stock") {
          results.push({ ...product, availableForSale: available });
        }
      }

      if (!cancelled) setLowStockProducts(results);
    };

    calculateLowStock();
    return () => {
      cancelled = true;
    };
  }, [products, batches]);

  useEffect(() => {
    loadProducts();
    loadBatches();
    loadCustomers();
    loadOutstandingCredits();
  }, [loadProducts, loadBatches, loadCustomers, loadOutstandingCredits]);

  useEffect(() => {
    if (search && !fullLoaded) loadFullProducts();
  }, [search, fullLoaded, loadFullProducts]);

  return {
    products,
    setProducts,
    batches,
    availableBatchesByCrop,
    fullLoaded,
    customers,
    outstandingCredits,
    lowStockProducts,
    loadBatches,
    loadCustomers,
    loadProducts,
    loadFullProducts,
    loadOutstandingCredits,
    findCustomerByName,
  };
}
