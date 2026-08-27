import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../db";

const initialForm = {
  username: "",
  password: "",
  role: "staff",
  canViewProfit: false,
  canViewStock: false,
};

export function useUserData() {
  const { currentUser, users, refreshUsers, loading } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initialForm);
    setEditingUser(null);
  }, [users]);

  useEffect(() => {
    const handleDataRefresh = () => {
      refreshUsers();
    };

    window.addEventListener("bosco:db-changed", handleDataRefresh);
    return () => window.removeEventListener("bosco:db-changed", handleDataRefresh);
  }, [refreshUsers]);

  const resetForm = () => {
    setEditingUser(null);
    setForm(initialForm);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      password: "",
      role: user.role,
      canViewProfit: !!user.canViewProfit,
      canViewStock: !!user.canViewStock,
    });
  };

  const saveUser = async () => {
    if (!form.username.trim()) {
      throw new Error("Username is required.");
    }
    if (!editingUser && !form.password.trim()) {
      throw new Error("Password is required for new users.");
    }

    const now = new Date().toISOString();
    const userDoc = editingUser
      ? {
          ...editingUser,
          username: form.username.trim(),
          updatedAt: now,
          role: form.role,
          canViewProfit: form.canViewProfit,
          canViewStock: form.canViewStock,
          ...(form.password ? { password: form.password } : {}),
        }
      : {
          _id: `user:${form.username.trim()}:${Date.now()}`,
          type: "user",
          username: form.username.trim(),
          password: form.password,
          role: form.role,
          canViewProfit: form.canViewProfit,
          canViewStock: form.canViewStock,
          createdAt: now,
          updatedAt: now,
        };

    setSaving(true);
    try {
      await db.put(userDoc);
      await refreshUsers();
      resetForm();
      return userDoc;
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (user) => {
    if (user._id === currentUser?._id) {
      throw new Error("You cannot delete your own active account.");
    }
    await db.remove(user);
    await refreshUsers();
  };

  return {
    currentUser,
    users,
    loading,
    form,
    editingUser,
    saving,
    handleFormChange,
    handleEdit,
    resetForm,
    saveUser,
    deleteUser,
  };
}
