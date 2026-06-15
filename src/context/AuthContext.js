import { clearSettingsCache } from '../hooks/useSettings';
import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import API from "../api";

export const MUWAN_AUTH_URL = "https://luciagram-7s5b.onrender.com/api";

const AuthContext = createContext();

const TOKEN_KEY = "lucia_token";
const USER_KEY  = "lucia_user";

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

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser  = localStorage.getItem(USER_KEY);

    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUserState(parsedUser);
        API.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
      } catch {}
    }

    if (!savedToken) {
      setLoading(false);
      return;
    }

    API.get("/users/me")
      .then(res => {
        if (res.data) {
          setUserState(res.data);
          localStorage.setItem(USER_KEY, JSON.stringify(res.data));
        }
      })
      .catch((err) => {
        // Sirf 401 pe logout karo — network error pe nahi
        if (err.response?.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setUserState(null);
        }
        // Network error / timeout / 500 → localStorage wala user rehne do
      })
      .finally(() => setLoading(false));
  }, []);

  const login = (userData, token) => {
    const { password, ...safe } = userData || {};
    setUserState(safe);
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(safe));
      API.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
  };

  const logout = () => {
    clearSettingsCache();
    setUserState(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    delete API.defaults.headers.common["Authorization"];
    API.post("/auth/logout").catch(() => {});
  };

  useEffect(() => {
    const handler = () => {
      clearSettingsCache();
      setUserState(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      delete API.defaults.headers.common["Authorization"];
      API.post("/auth/logout").catch(() => {});
    };
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await API.get("/users/me");
      if (res.data) {
        setUserState(res.data);
        localStorage.setItem(USER_KEY, JSON.stringify(res.data));
      }
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
