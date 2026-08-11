import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../db";

const initialForm = { username: "", password: "", role: "staff", canViewProfit: false, canViewStock: false };

export default function Users() {
  const { currentUser, users, refreshUsers, loading } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initialForm);
    setEditingUser(null);
  }, [users]);

  if (loading) return <div className="p-4">Loading users...</div>;
  if (!currentUser?.role || currentUser.role !== "admin") {
    return <div className="p-4 text-red-600">You are not authorized to view this page.</div>;
  }

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.username.trim()) return alert("Username is required.");
    if (!editingUser && !form.password.trim()) return alert("Password is required for new users.");

    const now = new Date().toISOString();
    const userDoc = editingUser
      ? {
          ...editingUser,
          username: form.username,
          updatedAt: now,
          role: form.role,
          canViewProfit: form.canViewProfit,
          canViewStock: form.canViewStock,
          ...(form.password ? { password: form.password } : {}),
        }
      : {
          _id: `user:${form.username}:${Date.now()}`,
          type: "user",
          username: form.username,
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
      setForm(initialForm);
      setEditingUser(null);
    } catch (err) {
      console.error("Failed to save user", err);
      alert("Unable to save user. See console for details.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setForm({ username: user.username, password: "", role: user.role, canViewProfit: !!user.canViewProfit, canViewStock: !!user.canViewStock });
  };

  const handleDelete = async (user) => {
    if (user._id === currentUser._id) return alert("You cannot delete the current logged-in user.");
    if (!window.confirm(`Delete user ${user.username}?`)) return;
    try {
      await db.remove(user);
      await refreshUsers();
    } catch (err) {
      console.error("Failed to delete user", err);
      alert("Unable to delete user. See console for details.");
    }
  };

  return (
    <div className="px-4 pb-32 max-w-xl">
      <h1 className="text-xl font-bold mb-4">User Management</h1>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="border rounded p-4 bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-3">{editingUser ? "Edit User" : "Add User"}</h2>
          <div className="space-y-3">
            <label className="block">
              <div className="text-sm font-semibold mb-1">Username</div>
              <input className="w-full border rounded p-2" value={form.username} onChange={(e) => handleChange("username", e.target.value)} />
            </label>
            <label className="block">
              <div className="text-sm font-semibold mb-1">Password</div>
              <input type="password" className="w-full border rounded p-2" value={form.password} onChange={(e) => handleChange("password", e.target.value)} placeholder={editingUser ? "Leave blank to keep current password" : "Enter password"} />
            </label>
            <label className="block">
              <div className="text-sm font-semibold mb-1">Role</div>
              <select className="w-full border rounded p-2" value={form.role} onChange={(e) => handleChange("role", e.target.value)}>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.canViewProfit} onChange={(e) => handleChange("canViewProfit", e.target.checked)} />
              <span className="text-sm">Can view profit</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.canViewStock} onChange={(e) => handleChange("canViewStock", e.target.checked)} />
              <span className="text-sm">Can view stock</span>
            </label>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-60">
                {editingUser ? "Update User" : "Create User"}
              </button>
              {editingUser && (
                <button onClick={() => { setEditingUser(null); setForm(initialForm); }} className="bg-gray-200 rounded px-4 py-2 hover:bg-gray-300">
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="border rounded p-4 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">User List</h2>
            <span className="text-xs text-gray-500">{users.length} users</span>
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {users.length === 0 ? (
              <div className="text-sm text-gray-500">No users available.</div>
            ) : users.map(user => (
              <div key={user._id} className="border rounded p-3 bg-gray-50">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div className="font-semibold">{user.username}</div>
                    <div className="text-sm text-gray-600">
                      {user.role} {user.canViewProfit ? "• profit visible" : "• profit hidden"}
                      {user.canViewStock ? " • stock visible" : " • stock hidden"}
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => handleEdit(user)} className="text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(user)} className="text-red-600 hover:underline">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
