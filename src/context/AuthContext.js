import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import API from "../api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((updater) => {
    setUserState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (next) localStorage.setItem("user", JSON.stringify(next));
      return next;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await API.get("/users/me");
      if (res.data) {
        setUserState(prev => {
          const updated = { ...prev, ...res.data };
          localStorage.setItem("user", JSON.stringify(updated));
          return updated;
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (!token || !savedUser) {
      setLoading(false);
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setLoading(false);
        return;
      }
      const parsed = JSON.parse(savedUser);
      setUserState(parsed);
      // Always refresh from server on load to get latest avatar/data
      API.get("/users/me").then(res => {
        if (res.data) {
          const updated = { ...parsed, ...res.data };
          setUserState(updated);
          localStorage.setItem("user", JSON.stringify(updated));
        }
      }).catch(() => {});
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUserState(userData);
    // Fetch fresh profile after login
    setTimeout(() => {
      API.get("/users/me").then(res => {
        if (res.data) {
          const updated = { ...userData, ...res.data };
          setUserState(updated);
          localStorage.setItem("user", JSON.stringify(updated));
        }
      }).catch(() => {});
    }, 500);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUserState(null);
  };

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
