import React, { useState } from "react";
import { seedTestData } from "../utils/seedData";

export default function SeedDataButton({ onComplete }) {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if (!window.confirm("Add sample crops, stock, customers, sales, purchases, and spoilage records? Existing records will not be changed.")) {
      return;
    }

    setLoading(true);
    try {
      const result = await seedTestData();
      alert(`Test data added: ${result.inserted} records.\nAlready present: ${result.skipped} records.`);
      onComplete?.();
    } catch (error) {
      console.error("Failed to add test data", error);
      alert(`Could not add test data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSeed}
      disabled={loading}
      className="px-3 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition text-xs font-semibold disabled:opacity-50"
    >
      {loading ? "Adding test data..." : "Add seed test data"}
    </button>
  );
}
