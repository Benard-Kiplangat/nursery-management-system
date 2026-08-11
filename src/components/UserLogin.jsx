import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function UserLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate("/");
    }
  }, [currentUser, navigate]);

  const handleSubmit = async () => {
    const success = await login(username.trim(), password);
    if (!success) {
      setError("Invalid username or password.");
      return;
    }
    navigate("/");
  };

  return (
    <div className="max-w-sm mx-auto mt-16 p-6 border rounded shadow bg-white">
      <h1 className="text-xl font-bold mb-4">User Login</h1>
      <div className="space-y-3">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="w-full border rounded p-2"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full border rounded p-2"
        />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button onClick={handleSubmit} className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700">
          Login
        </button>
      </div>
    </div>
  );
}
