import React from "react";
import { Link } from "react-router-dom";
import { useBusinessConfig } from "../config";

const sections = [
  {
    title: "Getting started",
    icon: "🌿",
    steps: [
      "Sign in with the user account provided by your administrator.",
      "Complete Business Settings first: business name, contact details, currency, and KRA information.",
      "Use the sidebar to move between the POS, stock, sales, purchases, customers, and settings areas.",
    ],
  },
  {
    title: "Making a sale",
    icon: "🛒",
    steps: [
      "Open POS Terminal and add products to the cart.",
      "Adjust quantities, select a customer when needed, and choose the payment method.",
      "Review the total, complete payment, and save or print the receipt.",
      "Open Sales History to review, edit, or reprint completed sales.",
    ],
  },
  {
    title: "Managing crops and stock",
    icon: "🌱",
    steps: [
      "Add crop varieties from Crops Catalog, including prices and growing information.",
      "Create a planted batch when you start a new production cycle.",
      "Update batch quantities as stock is lost or sold. Only ready batches are available for sale.",
      "For a safe demo dataset, select Add seed test data beside the sync controls. Existing records are never overwritten.",
    ],
  },
  {
    title: "Recording purchases",
    icon: "📦",
    steps: [
      "Open Purchases & Expenses and complete the item, supplier, quantity, date, and total cost fields.",
      "Save the purchase to include it in local expense history and analytics.",
      "Use Load eTIMS Purchases to retrieve purchases already received from eTIMS.",
      "Use Save locally on an eTIMS record to import it into local purchase history. Imported records are protected from duplicate saves.",
    ],
  },
  {
    title: "Customers and suppliers",
    icon: "👥",
    steps: [
      "Use Customer Directory to create and maintain customer contact details.",
      "Register suppliers from Purchases & Expenses before assigning them to purchase records.",
      "Keep KRA PINs and contact information accurate for reporting and reconciliation.",
    ],
  },
  {
    title: "Administration and safety",
    icon: "🔐",
    steps: [
      "Administrators can create staff accounts and manage permissions from User Management.",
      "Use Business Settings to update company details and integrations.",
      "Keep user passwords private and sign out when leaving a shared computer.",
      "The POS stores operational data locally in the browser. Back up or synchronize data according to your organization’s process.",
    ],
  },
];

export default function UserGuide() {
  const { config } = useBusinessConfig();
  const appName = config.businessDisplayName || config.appName || "Farm & Nursery POS";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-emerald-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <Link to="/" className="text-sm text-emerald-200 hover:text-white">← Back to POS</Link>
          <div className="mt-8 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">User guide</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight">Custom POS</h1>
            <p className="mt-4 text-lg leading-8 text-emerald-100">
              A practical guide to recording sales, managing nursery stock, tracking expenses, and keeping your team organized.
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid gap-5 md:grid-cols-2">
          {sections.map((section) => (
            <section key={section.title} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h2 className="flex items-center gap-3 text-xl font-bold text-slate-900">
                <span aria-hidden="true">{section.icon}</span>
                {section.title}
              </h2>
              <ol className="mt-5 space-y-3 list-decimal list-inside text-sm leading-6 text-slate-600">
                {section.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </section>
          ))}
        </div>

        <section className="mt-8 rounded-2xl bg-amber-50 border border-amber-200 p-6">
          <h2 className="text-lg font-bold text-amber-900">Need help?</h2>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Contact the owner for account access, permissions, backups, or business configuration changes.
          </p>
        </section>
      </main>
    </div>
  );
}
