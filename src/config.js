import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const PUBLIC_APP_CONFIG_URL = `${import.meta.env.BASE_URL}config/app-config.json`;
const fallbackConfig = {
  businessCode: "XS",
  businessName: "XS Farm",
  businessTel: "+254700000000",
  businessDisplayName: "XS Farm Nursery",
  appName: "XS Farm & Nursery POS",
  systemName: "XS Nursery Management System",
  kraPin: "A123456789B",
  address: "Located 300M from Chebirbelek town",
  transactionDescription: "XS Farm POS payment",
  currency: "KES",
};
export const DEFAULT_APP_CONFIG = Object.freeze(fallbackConfig);
const STORAGE_KEY = "business-config";

function readStoredBusinessConfig() {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("Failed to read saved business config", error);
    return {};
  }
}

export function getEffectiveAppConfig() {
  return {
    ...DEFAULT_APP_CONFIG,
    ...readStoredBusinessConfig(),
  };
}

export function saveBusinessConfig(nextValues) {
  if (typeof window === "undefined") return { ...DEFAULT_APP_CONFIG };

  const merged = {
    ...DEFAULT_APP_CONFIG,
    ...readStoredBusinessConfig(),
    ...nextValues,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

export function resetBusinessConfig() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return { ...DEFAULT_APP_CONFIG };
}

const BusinessConfigContext = createContext(null);

export function BusinessConfigProvider({ children }) {
  const [config, setConfig] = useState(() => getEffectiveAppConfig());

  useEffect(() => {
    let active = true;
    fetch(PUBLIC_APP_CONFIG_URL, { cache: "no-store" })
      .then(response => {
        if (!response.ok) throw new Error(`Config request failed with status ${response.status}`);
        return response.json();
      })
      .then(publicConfig => {
        if (!publicConfig || typeof publicConfig !== "object") {
          throw new Error("Public app config must be a JSON object");
        }
        if (active) {
          setConfig({ ...DEFAULT_APP_CONFIG, ...publicConfig, ...readStoredBusinessConfig() });
        }
      })
      .catch(error => console.warn("Using fallback app config", error));

    return () => {
      active = false;
    };
  }, []);

  const updateConfig = useCallback((nextValues) => {
    const merged = saveBusinessConfig(nextValues);
    setConfig(merged);
    return merged;
  }, []);

  const resetConfig = useCallback(() => {
    const merged = resetBusinessConfig();
    setConfig(merged);
    return merged;
  }, []);

  const value = useMemo(
    () => ({
      config,
      defaultConfig: DEFAULT_APP_CONFIG,
      updateConfig,
      resetConfig,
    }),
    [config, updateConfig, resetConfig]
  );

  return React.createElement(
    BusinessConfigContext.Provider,
    { value },
    children
  );
}

export function useBusinessConfig() {
  const context = useContext(BusinessConfigContext);

  if (context) return context;

  const fallback = getEffectiveAppConfig();
  return {
    config: fallback,
    defaultConfig: DEFAULT_APP_CONFIG,
    updateConfig: saveBusinessConfig,
    resetConfig: resetBusinessConfig,
  };
}

export const APP_CONFIG = DEFAULT_APP_CONFIG;
export default APP_CONFIG;
