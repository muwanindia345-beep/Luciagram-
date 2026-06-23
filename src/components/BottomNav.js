import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();

  const handleTap = (e, to) => {
    const btn = e.currentTarget;
    const circle = document.createElement("span");
    const d = Math.max(btn.clientWidth, btn.clientHeight);
    circle.style.cssText = `
      width:${d}px;height:${d}px;position:absolute;border-radius:50%;
      background:rgba(124,58,237,0.25);transform:scale(0);
      animation:ripple 0.4s ease-out;
      top:50%;left:50%;margin-top:-${d/2}px;margin-left:-${d/2}px;
      pointer-events:none;
    `;
    btn.appendChild(circle);
    setTimeout(() => circle.remove(), 400);
    navigate(to);
  };

  const isActive = (path) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  const tabs = [
    {
      path: "/",
      label: "Home",
      icon: (active) => (
        <svg viewBox="0 0 24 24" width="24" height="24" fill={active ? "white" : "none"} stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
          <path d="M9 21V12h6v9" stroke={active ? "rgba(0,0,0,0.4)" : "white"} fill="none" strokeWidth="1.8" />
        </svg>
      )
    },
    {
      path: "/search",
      label: "Search",
      icon: (active) => (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="white" strokeWidth={active ? "2.2" : "1.8"} strokeLinecap="round">
          <circle cx="11" cy="11" r="7" fill={active ? "rgba(255,255,255,0.15)" : "none"} />
          <line x1="16.5" y1="16.5" x2="22" y2="22" />
        </svg>
      )
    },
    {
      path: "/upload",
      label: "Post",
      icon: () => (
        <div style={{
          width: 44, height: 32,
          background: "linear-gradient(135deg,#7c3aed,#db2777)",
          borderRadius: 10, display: "flex",
          alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 12px rgba(124,58,237,0.5)"
        }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
      )
    },
    {
      path: "/reels",
      label: "Reels",
      icon: (active) => (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="white" strokeWidth={active ? "2.2" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="4" fill={active ? "rgba(255,255,255,0.15)" : "none"} />
          <circle cx="12" cy="12" r="3" fill={active ? "white" : "none"} stroke={active ? "none" : "white"} />
          <line x1="2" y1="7" x2="22" y2="7" />
          <line x1="2" y1="17" x2="22" y2="17" />
          <line x1="7" y1="2" x2="7" y2="7" />
          <line x1="17" y1="2" x2="17" y2="7" />
        </svg>
      )
    },
    {
      path: "/profile",
      label: "Profile",
      icon: (active) => user?.avatar ? (
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          border: `2px solid ${active ? "#7c3aed" : "rgba(255,255,255,0.4)"}`,
          overflow: "hidden",
          boxShadow: active ? "0 0 0 1px #db2777" : "none"
        }}>
          <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ) : (
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          background: active ? "linear-gradient(135deg,#7c3aed,#db2777)" : "rgba(255,255,255,0.2)",
          border: `2px solid ${active ? "#7c3aed" : "rgba(255,255,255,0.3)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.75rem", fontWeight: "bold", color: "white"
        }}>
          {(user?.username || "U")[0].toUpperCase()}
        </div>
      )
    }
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map(tab => {
        const active = isActive(tab.path);
        return (
          <div
            key={tab.path}
            onClick={(e) => handleTap(e, tab.path)}
            className={active ? "tab-active" : ""}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              height: "100%", cursor: "pointer",
              position: "relative", overflow: "hidden",
              opacity: active ? 1 : 0.5,
              transition: "opacity 0.15s",
              userSelect: "none",
            }}
          >
            {tab.icon(active)}
            {active && tab.path !== "/upload" && tab.path !== "/profile" && (
              <div style={{
                position: "absolute", bottom: 4,
                width: 3, height: 3, borderRadius: "50%",
                background: "linear-gradient(135deg,#7c3aed,#db2777)",
                boxShadow: "0 0 4px #7c3aed"
              }} />
            )}
          </div>
        );
      })}
    </nav>
  );
}
