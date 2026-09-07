import React from "react";
import { getBatchDisplayName } from "../../db";

export default function UpcomingHarvests({ batches, onDismiss }) {
  return (
    <div className="bg-white border border-emerald-200 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-bold text-emerald-800">🌱 Upcoming Harvests</h2>
        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-700"
        >
          ✕
        </button>
      </div>
      <div className="divide-y">
        {batches.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">
            No batches becoming ready soon.
          </div>
        ) : (
          batches.map((batch, index) => (
            <div
              key={batch._id}
              className="flex justify-between items-center px-4 py-3"
            >
              <div className="text-sm">
                <span className="font-medium">
                  {" "}
                  {index + 1}. {batch.cropName}
                </span>{" "}
                <span>
                  in {getBatchDisplayName(batch)} will be ready
                  {batch.daysRemaining === 0
                    ? " Today"
                    : batch.daysRemaining === 1
                      ? " Tomorrow"
                      : `in ${batch.daysRemaining} days`}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
