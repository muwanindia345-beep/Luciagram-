import { clearSettingsCache } from '../hooks/useSettings';
import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import API from "../api";

const AuthContext = createContext();
const MUWAN_AUTH_URL = "https://muwan-auth.onrender.com"\;

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((updater) => {
    setUserState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!next) return next;
      const { password, ...safe } = next;
      return safe;
    });
  }, []);

  // App open hone pe token se user restore karo
  useEffect(() => {
    const token = localStorage.getItem("muwan_token");
    if (!token) { setLoading(false); return; }
    fetch(`${MUWAN_AUTH_URL}/session/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setUserState({ ...data.user, token });
        } else {
          localStorage.removeItem("muwan_token");
        }
      })
      .catch(() => localStorage.removeItem("muwan_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = (userData, token) => {
    localStorage.setItem("muwan_token", token);
    setUserState({ ...userData, token });
  };

  const logout = () => {
    clearSettingsCache();
    localStorage.removeItem("muwan_token");
    setUserState(null);
    API.post("/auth/logout").catch(() => {});
  };

  // Global 401 handler
  useEffect(() => {
    const handler = () => {
      clearSettingsCache();
      localStorage.removeItem("muwan_token");
      setUserState(null);
    };
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await API.get("/users/me");
      if (res.data) setUserState(prev => ({ ...prev, ...res.data }));
    } catch {}
  }, []);

  if (loading) return (
    <div style={{background:"#0a0a0f",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"1rem"}}>
      <img src="https://i.ibb.co/WWjtyhvX/file-00000000a5f0720bb84b412a53d8b399.png" alt="L" style={{width:"80px",borderRadius:"20px",animation:"pulse 1.2s ease-in-out infinite"}} />
      <div style={{color:"#7c3aed",fontSize:"0.9rem",letterSpacing:"0.1em"}}>LUCIAGRAM</div>
      <style>{"@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(0.95)}}"}</style>
    </div>
  );

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export { MUWAN_AUTH_URL };
