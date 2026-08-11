import React, { useState } from "react";

export default function StockPinLogin({ onSuccess }) {
  const [storedPin, setStoredPin] = useState(localStorage.getItem("stockPin") || "1234");
  const [pinInput, setPinInput] = useState("");
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (pinInput === storedPin) {
      onSuccess();
    } else {
      setError("Incorrect PIN");
    }
  };

  const handleChangePin = () => {
    if (oldPin !== storedPin) {
      setError("Old PIN is incorrect");
    } else if (newPin !== confirmPin) {
      setError("New PINs do not match");
    } else if (newPin.length < 4) {
      setError("PIN should be at least 4 digits");
    } else {
      localStorage.setItem("stockPin", newPin);
      setStoredPin(newPin);
      setError("");
      alert("PIN changed successfully");
      setShowChangeForm(false);
      setOldPin("");
      setNewPin("");
      setConfirmPin("");
    }
  };

  return (
    <div className="max-w-sm mt-10 p-4 border rounded shadow">
      {!showChangeForm ? (
        <>
          <h2 className="text-lg font-bold mb-2">Enter Stock PIN</h2>
          <input
            type="password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            className="w-full border px-2 py-1 mb-2 rounded"
            placeholder="Enter PIN"
          />
          {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
          <button onClick={handleLogin} className="bg-blue-600 text-white px-4 py-1 rounded mr-2">Login</button>
          <button onClick={() => setShowChangeForm(true)} className="text-sm text-blue-500 underline">Change PIN</button>
        </>
      ) : (
        <>
          <h2 className="text-lg font-bold mb-2">Change PIN</h2>
          <input
            type="password"
            value={oldPin}
            onChange={(e) => setOldPin(e.target.value)}
            className="w-full border px-2 py-1 mb-2 rounded"
            placeholder="Old PIN"
          />
          <input
            type="password"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            className="w-full border px-2 py-1 mb-2 rounded"
            placeholder="New PIN"
          />
          <input
            type="password"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            className="w-full border px-2 py-1 mb-2 rounded"
            placeholder="Confirm New PIN"
          />
          {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
          <button onClick={handleChangePin} className="bg-green-600 text-white px-4 py-1 rounded mr-2">Save</button>
          <button onClick={() => setShowChangeForm(false)} className="text-sm text-gray-500 underline">Cancel</button>
        </>
      )}
    </div>
  );
}

