import React from 'react';
import { useState } from "react";
import { Routes, Route, Navigate } from 'react-router-dom';
import POS from './pages/POS';
import Crops from './pages/Crops';
import Batches from './pages/Batches';
import Sales from './pages/Sales';
import Purchase from './pages/Purchase';
import Customers from './pages/Customers';
import Users from './pages/Users';
import UserLogin from './components/UserLogin';
import Navbar from './components/Navbar';
import { useAuth } from './context/AuthContext';
import './index.css';


function RequireAuth({ children }) {
  const { currentUser, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-500 font-medium">
        <div className="animate-spin mr-2">🌿</div> Loading XS Nursery Management System...
      </div>
    );
  }
  return currentUser ? children : <Navigate to="/login" replace />;
}

function CropsRoute({ children }) {
  const { currentUser, loading, canViewStock } = useAuth();
  if (loading) return null;
  return currentUser && canViewStock ? children : <Navigate to="/" replace />;
}

function AdminRoute({ children }) {
  const { currentUser, loading, isAdmin } = useAuth();
  if (loading) return null;
  return currentUser && isAdmin ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { currentUser } = useAuth();

  const [initialized, setInitialized] = useState(
      localStorage.getItem("initialized") === "true"
    );

    const [license, setLicense] = useState("");

if (!initialized) {
  // Ask for license
}

if (license === getLicenseCode()) {
  localStorage.setItem("initialized", "true");
}

  function getLicenseCode() {
    const date = new Date();

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear());

    const dateNumber = Number(`${month}${day}${year}`);

    return String(dateNumber * 7);
  }
    function initialize() {
      if (license.trim() === getLicenseCode()) {
        console.log(getLicenseCode())
        localStorage.setItem("initialized", "true");
        setInitialized(true);
      }
    }

    if (!initialized) {
      return (
<div
  style={{
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f5f7fa",
    padding: "20px",
    boxSizing: "border-box",
  }}
>
  <div
    style={{
      width: "100%",
      maxWidth: "420px",
      background: "#ffffff",
      borderRadius: "16px",
      padding: "40px",
      boxSizing: "border-box",
      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
      textAlign: "center",
    }}
  >
    <div
      style={{
        width: "56px",
        height: "56px",
        margin: "0 auto 20px",
        borderRadius: "50%",
        background: "#fff3cd",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "26px",
      }}
    >
      🔐
    </div>

    <h2
      style={{
        margin: "0 0 10px",
        fontSize: "24px",
        color: "#1f2937",
      }}
    >
      Database Not Initialized
    </h2>

    <p
      style={{
        margin: "0 0 25px",
        color: "#6b7280",
        fontSize: "14px",
        lineHeight: "1.6",
      }}
    >
      Enter your license key below to initialize the database and continue.
    </p>

    <input
      type="password"
      value={license}
      onChange={(e) => setLicense(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          initialize();
        }
      }}
      placeholder="Enter license key"
      style={{
        width: "100%",
        padding: "13px 14px",
        border: "1px solid #d1d5db",
        borderRadius: "8px",
        outline: "none",
        fontSize: "15px",
        boxSizing: "border-box",
        marginBottom: "12px",
      }}
    />

    <button
      onClick={initialize}
      style={{
        width: "100%",
        padding: "13px",
        border: "none",
        borderRadius: "8px",
        background: "#2563eb",
        color: "#ffffff",
        fontSize: "15px",
        fontWeight: "600",
        cursor: "pointer",
      }}
    >
      Initialize Database
    </button>

    <p
      style={{
        margin: "18px 0 0",
        fontSize: "12px",
        color: "#9ca3af",
      }}
    >
      A valid license key is required to continue.
    </p>
  </div>
</div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 min-w-[420px] text-slate-800 flex flex-col lg:flex-row">
        {currentUser && <Navbar />}
        <main className="flex-1 min-w-0 p-4 lg:p-8 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/login" element={<UserLogin />} />
            <Route path="/" element={<RequireAuth><POS /></RequireAuth>} />
            <Route path="/crops" element={<CropsRoute><Crops /></CropsRoute>} />
            <Route path="/batches" element={<CropsRoute><Batches /></CropsRoute>} />
            <Route path="/purchase" element={<RequireAuth><Purchase /></RequireAuth>} />
            <Route path="/customers" element={<RequireAuth><Customers /></RequireAuth>} />
            <Route path="/sales" element={<RequireAuth><Sales /></RequireAuth>} />
            <Route path="/users" element={<AdminRoute><Users /></AdminRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    );
  }