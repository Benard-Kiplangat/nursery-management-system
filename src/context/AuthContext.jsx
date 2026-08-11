import React, { createContext, useContext, useEffect, useState } from "react";
import { db } from "../db";

const AuthContext = createContext(null);

const SESSION_KEY = "currentUserId";

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshUsers = async () => {
    const result = await db.allDocs({ include_docs: true });
    const userDocs = result.rows.map(row => row.doc).filter(doc => doc && doc.type === "user");
    setUsers(userDocs);
    return userDocs;
  };

  const ensureDefaultAdmin = async (userDocs) => {
    if (userDocs.length > 0) return userDocs;
    const now = new Date().toISOString();
    const admin = {
      _id: `user:admin:${Date.now()}`,
      type: "user",
      username: "admin",
      password: "admin",
      role: "admin",
      canViewProfit: true,
      canViewStock: true,
      createdAt: now,
      updatedAt: now,
    };
    await db.put(admin);
    return [admin];
  };

  useEffect(() => {
    (async () => {
      try {
        let userDocs = await refreshUsers();
        userDocs = await ensureDefaultAdmin(userDocs);
        setUsers(userDocs);

        const storedId = localStorage.getItem(SESSION_KEY);
        if (storedId) {
          const match = userDocs.find(u => u._id === storedId);
          if (match) setCurrentUser(match);
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
      u => u.username?.toLowerCase() === username.toLowerCase() && u.password === password
    );
    if (!match) return false;
    setCurrentUser(match);
    localStorage.setItem(SESSION_KEY, match._id);
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
