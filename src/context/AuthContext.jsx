import React, { createContext, useContext, useEffect, useState } from "react";
import { db } from "../db";
import {
  applyPasswordHash,
  hasLegacyPlainTextPassword,
  stripPasswordField,
  verifyPassword,
  hashPassword,
} from "../utils/password";

const AuthContext = createContext(null);

const SESSION_KEY = "currentUserId";

const toSafeUser = (user) => {
  if (!user) return user;
  return stripPasswordField(user);
};

async function persistHashedPassword(user, plainPassword) {
  const updated = await applyPasswordHash(user, plainPassword);
  await db.put(updated);
  return updated;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(localStorage.getItem(SESSION_KEY));
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshUsers = async () => {
    const result = await db.allDocs({ include_docs: true });
    const userDocs = result.rows
      .map((row) => row.doc)
      .filter((doc) => doc && doc.type === "user");

    setUsers(userDocs.map((user) => toSafeUser(user)));
    return userDocs;
  };

  const ensureDefaultAdmin = async (userDocs) => {
    if (userDocs.some((user) => user.role === "admin")) return userDocs;

    const now = new Date().toISOString();
    const adminPassword = await hashPassword("admin");
    const admin = {
      _id: `user:admin:${Date.now()}`,
      type: "user",
      username: "admin",
      role: "admin",
      canViewProfit: true,
      canViewStock: true,
      createdAt: now,
      updatedAt: now,
      ...adminPassword,
    };

    await db.put(admin);
    return [...userDocs, admin];
  };

  useEffect(() => {
    (async () => {
      try {
        let userDocs = await refreshUsers();
        userDocs = await ensureDefaultAdmin(userDocs);
        setUsers(userDocs.map((user) => toSafeUser(user)));

        const storedId = localStorage.getItem(SESSION_KEY);
        if (storedId) {
          localStorage.setItem(SESSION_KEY, storedId);
          const match = userDocs.find((user) => user._id === storedId);
          if (match) setCurrentUser(toSafeUser(match));
        }
      } catch (err) {
        console.error("Failed to initialize auth", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (username, password) => {
    const latestUsers = await refreshUsers();
    const match = latestUsers.find(
      (user) => user.username?.toLowerCase() === String(username || "").trim().toLowerCase()
    );

    if (!match) return false;

    const isValid = await verifyPassword(password, match);
    if (!isValid) return false;

    const migratedUser = hasLegacyPlainTextPassword(match)
      ? await persistHashedPassword(match, password)
      : match;

    const safeUser = toSafeUser(migratedUser);
    setCurrentUser(safeUser);
    localStorage.setItem(SESSION_KEY, migratedUser._id);
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const isAdmin = currentUser?.role === "admin";
  const canViewProfit = isAdmin || !!currentUser?.canViewProfit;
  const canViewStock = isAdmin || !!currentUser?.canViewStock;

  const value = {
    currentUser,
    users,
    loading,
    login,
    logout,
    refreshUsers,
    isAdmin,
    canViewProfit,
    canViewStock,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
