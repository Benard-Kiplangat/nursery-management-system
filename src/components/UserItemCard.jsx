import React, { useState } from "react";

export default function UserItemCard({ user, currentUser, onEdit, onDelete }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const isCurrentLoggedInUser = user._id === currentUser?._id;
  const isAdmin = user.role === "admin";

  return (
    <div className="border border-slate-200 rounded-xl p-3.5 bg-white shadow-2xs space-y-2 hover:border-slate-300 transition-colors">
      <div className="flex justify-between items-start gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-sm leading-snug">
              {user.username}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isAdmin
                  ? "bg-purple-100 text-purple-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {isAdmin ? "Admin" : "Staff"}
            </span>
            {isCurrentLoggedInUser && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                You
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-medium text-slate-500">
            <span
              className={`px-2 py-0.5 rounded ${
                user.canViewProfit
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              Profit: {user.canViewProfit ? "Visible" : "Hidden"}
            </span>
            <span
              className={`px-2 py-0.5 rounded ${
                user.canViewStock
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              Stock: {user.canViewStock ? "Visible" : "Hidden"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!showConfirm ? (
            <>
              <button
                onClick={() => onEdit(user)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Edit
              </button>
              {!isCurrentLoggedInUser && (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="text-xs font-semibold text-rose-500 hover:text-rose-700 transition-colors"
                >
                  Delete
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 p-1 rounded-lg">
              <span className="text-[11px] font-bold text-rose-700">Delete?</span>
              <button
                onClick={() => {
                  onDelete(user);
                  setShowConfirm(false);
                }}
                className="text-[11px] font-bold bg-rose-600 text-white px-2 py-0.5 rounded hover:bg-rose-700"
              >
                Yes
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="text-[11px] text-slate-600 px-1 hover:text-slate-800"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
