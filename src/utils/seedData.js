import { db } from "../db";

const SEED_TYPES = ["crops", "suppliers", "customers", "batches", "sales", "purchases", "spoilage"];
const SEED_DATA_URL = `${import.meta.env.BASE_URL}config/seed-data.json`;

export async function seedTestData() {
  const response = await fetch(SEED_DATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Seed data request failed with status ${response.status}`);
  }
  const seedData = await response.json();
  if (!seedData || typeof seedData !== "object") {
    throw new Error("Seed data must be a JSON object");
  }

  const existing = await db.allDocs({ include_docs: false });
  const existingIds = new Set(existing.rows.map(row => row.id));
  const seedDocs = SEED_TYPES.flatMap(type => seedData[type] || []);
  const docs = seedDocs
    .filter(doc => !existingIds.has(doc._id))
    .map(doc => ({
      ...doc,
      seedData: true,
      createdAt: doc.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

  if (docs.length > 0) {
    await db.bulkDocs(docs);
  }

  return {
    inserted: docs.length,
    skipped: seedDocs.length - docs.length,
    byType: docs.reduce((counts, doc) => {
      counts[doc.type] = (counts[doc.type] || 0) + 1;
      return counts;
    }, {}),
  };
}
