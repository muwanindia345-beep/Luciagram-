import { clearSettingsCache } from '../hooks/useSettings';
import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import API from "../api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((updater) => {
    setUserState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return next;
    });
  }, []);

  // Refresh pe /users/me call karo — cookie valid hai to user milega
  useEffect(() => {
    API.get("/users/me")
      .then(res => {
        if (res.data) setUserState(res.data);
      })
      .catch(() => {
        setUserState(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = (userData) => {
    setUserState(userData);
    // Fresh profile fetch
    setTimeout(() => {
      API.get("/users/me").then(res => {
        if (res.data) setUserState(res.data);
      }).catch(() => {});
    }, 500);
  };

  const logout = () => {
    clearSettingsCache();
    setUserState(null);
    API.post("/auth/logout").catch(() => {});
  };

  const refreshUser = useCallback(async () => {
    try {
      const res = await API.get("/users/me");
      if (res.data) setUserState(res.data);
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
