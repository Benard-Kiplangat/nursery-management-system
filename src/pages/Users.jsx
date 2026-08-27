import React from "react";
import { showToast } from "../utils/toast";
import { useUserData } from "../hooks/useUserData";
import UserFormCard from "../components/UserFormCard";
import UserItemCard from "../components/UserItemCard";

export default function Users() {
  const {
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
  } = useUserData();

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-medium">
        Loading user accounts...
      </div>
    );
  }

  if (!currentUser?.role || currentUser.role !== "admin") {
    return (
      <div className="p-8 text-center text-rose-600 font-bold">
        ⚠️ You are not authorized to view User Management. Admin role required.
      </div>
    );
  }

  const handleSave = async () => {
    try {
      const saved = await saveUser();
      showToast(
        editingUser
          ? `Updated user account: ${saved.username}`
          : `Created new user account: ${saved.username}`
      );
    } catch (err) {
      showToast(err.message || "Failed to save user account");
    }
  };

  const handleDelete = async (user) => {
    try {
      await deleteUser(user);
      showToast(`Deleted user account: ${user.username}`);
    } catch (err) {
      showToast(err.message || "Failed to delete user account");
    }
  };

  return (
    <div className="p-4 pb-12 max-w-5xl space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">User Account Management</h1>
        <p className="text-xs text-slate-500">
          Create staff accounts, assign roles, and manage system permissions.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Form Card */}
        <div>
          <UserFormCard
            form={form}
            editingUser={editingUser}
            saving={saving}
            onChange={handleFormChange}
            onSave={handleSave}
            onCancel={resetForm}
          />
        </div>

        {/* User Accounts List */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Active User Accounts</h2>
            <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {users.length} accounts
            </span>
          </div>

          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
            {users.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-10">
                No user accounts available.
              </div>
            ) : (
              users.map((user) => (
                <UserItemCard
                  key={user._id}
                  user={user}
                  currentUser={currentUser}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
