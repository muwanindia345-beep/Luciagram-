import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

const TABS = [
  {
    path: "/",
    label: "Home",
    icon: (active) => (
      <svg viewBox="0 0 24 24" width="26" height="26" fill={active ? "white" : "none"} stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
        <path d="M9 21V12h6v9"/>
      </svg>
    )
  },
  {
    path: "/search",
    label: "Search",
    icon: (active) => (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="white" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round">
        <circle cx="11" cy="11" r="7"/>
        <line x1="16.5" y1="16.5" x2="22" y2="22"/>
      </svg>
    )
  },
  {
    path: "/upload",
    label: "Upload",
    icon: () => (
      <div style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",borderRadius:"10px",width:"36px",height:"36px",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
    )
  },
  {
    path: "/reels",
    label: "Reels",
    icon: (active) => (
      <svg viewBox="0 0 24 24" width="26" height="26" fill={active ? "white" : "none"} stroke="white" strokeWidth="2" strokeLinecap="round">
        <rect x="2" y="2" width="20" height="20" rx="3"/>
        <circle cx="12" cy="12" r="3"/>
        <line x1="2" y1="7" x2="22" y2="7"/>
        <line x1="2" y1="17" x2="22" y2="17"/>
        <line x1="7" y1="2" x2="7" y2="7"/>
        <line x1="17" y1="2" x2="17" y2="7"/>
      </svg>
    )
  },
  {
    path: "/profile",
    label: "Profile",
    icon: (active) => (
      <svg viewBox="0 0 24 24" width="26" height="26" fill={active ? "white" : "none"} stroke="white" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    )
  }
];

const HIDDEN_PATHS = ["/login", "/register", "/chat/", "/group/", "/comments/"];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const isHidden = HIDDEN_PATHS.some(p => path.startsWith(p));
  if (isHidden) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      height: "60px",
      background: "rgba(10,10,15,0.92)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderTop: "1px solid rgba(255,255,255,0.06)",
      display: "flex",
      justifyContent: "space-around",
      alignItems: "center",
      zIndex: 1000,
      paddingBottom: "env(safe-area-inset-bottom)"
    }}>
      {TABS.map(tab => {
        const active = path === tab.path;
        return (
          <div
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              cursor: "pointer",
              opacity: active ? 1 : 0.45,
              transition: "opacity 0.15s ease, transform 0.15s ease",
              transform: active ? "scale(1.08)" : "scale(1)",
              gap: "3px",
              paddingTop: "6px",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {tab.icon(active)}
            {active && tab.path !== "/upload" && (
              <div style={{
                width:"4px",
                height:"4px",
                borderRadius:"50%",
                background:"white",
                transition:"all 0.2s ease"
              }}/>
            )}
          </div>
        );
      })}
    </div>
  );
}
