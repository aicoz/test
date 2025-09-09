import React, { createContext, useContext, useEffect, useState } from "react";

const API = "/api/user"; // Backend endpoint'in, gerekirse değiştir

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [popup, setPopup] = useState(null);

  function getDeviceHash() {
    let hash = localStorage.getItem("device_hash");
    if (!hash) {
      hash = Math.random().toString(36).substring(2) + Date.now();
      localStorage.setItem("device_hash", hash);
    }
    return hash;
  }

  async function fetchUserStatus(email = null) {
    const device_hash = getDeviceHash();
    const res = await fetch(`${API}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_hash, email }),
    });
    const data = await res.json();
    setUser(data);

    // Otomatik popup
    if (data.status === "anonymous" && data.unlimited_until && data.days_left_unlimited === 0) {
      setPopup("first_limit");
    } else if (data.status === "trial" && data.unlimited_until && data.days_left_unlimited === 0) {
      setPopup("trial_limit");
    } else if (data.status === "expired" || (data.status === "anonymous" && !data.unlimited_until)) {
      setPopup("offer");
    } else {
      setPopup(null);
    }
  }

  async function registerEmail(email) {
    const device_hash = getDeviceHash();
    await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_hash, email }),
    });
    fetchUserStatus(email);
  }

  async function recordUsage(minute = 1) {
    if (!user || !user.user_id) return;
    await fetch(`${API}/usage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.user_id, usage_minutes: minute }),
    });
    fetchUserStatus(user.email);
  }

  useEffect(() => {
    fetchUserStatus();
    // eslint-disable-next-line
  }, []);

  return (
    <UserContext.Provider value={{ user, popup, setPopup, fetchUserStatus, registerEmail, recordUsage }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}