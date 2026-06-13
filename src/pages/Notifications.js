import React, { useEffect, useState, useRef } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

export default function Notifications() {
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const loadNotifs = async () => {
    try {
      const res = await API.get("/notifications");
      setNotifs(res.data);
      const u = res.data.filter(n => !n.isRead).length;
      setUnread(u);
    } catch {}
  };

  useEffect(() => {
    loadNotifs();

    // Real-time socket
    const socket = io("https://luciagram-backend.onrender.com", {
      transports: ["websocket"],
    });
    socket.on("connect", () => socket.emit("join", user?.id));
    socket.on("new_notification", () => loadNotifs());
    socketRef.current = socket;
    return () => { socket.disconnect(); };
    return () => socket.disconnect();
  }, []);

  const markAllRead = async () => {
    try {
      await API.put("/notifications/read");
      setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnread(0);
    } catch {}
  };

  const handleTap = async (notif) => {
    try { await API.put("/notifications/" + notif.id + "/read"); } catch {}
    setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
    if (notif.postId) navigate("/comments/" + notif.postId);
    else if (notif.type === "follow") navigate("/user/" + notif.fromUsername);
    else if (notif.type === "message") navigate("/chat/" + notif.fromUserId + "?username=" + notif.fromUsername);
    else if (notif.type === "group_message") navigate("/groupchat");
  };

  const deleteNotif = async (e, id) => {
    e.stopPropagation();
    try { await API.delete("/notifications/" + id); } catch {}
    setNotifs(prev => prev.filter(n => n.id !== id));
  };

  const avatar = (name) => (name || "U").slice(0, 1).toUpperCase();
  const gradients = [
    "linear-gradient(135deg,#7c3aed,#db2777)",
    "linear-gradient(135deg,#f59e0b,#ef4444)",
    "linear-gradient(135deg,#10b981,#3b82f6)",
  ];

  const typeIcon = (type) => {
    if (type === "like") return "❤️";
    if (type === "comment") return "💬";
    if (type === "follow") return "👤";
    if (type === "mention") return "📣";
    if (type === "message") return "💌";
    if (type === "group_message") return "👥";
    if (type === "story_like") return "🌟";
    if (type === "story_view") return "👁️";
    return "🔔";
  };

  const typeColor = (type) => {
    if (type === "like") return "#ef4444";
    if (type === "comment") return "#3b82f6";
    if (type === "follow") return "#22c55e";
    if (type === "mention") return "#f59e0b";
    if (type === "message") return "#7c3aed";
    if (type === "group_message") return "#db2777";
    return "#888";
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const diff = Date.now() - d;
    if (diff < 60000) return "now";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", color: "white", paddingBottom: "70px" }}>

      {/* Header */}
      <div style={{ background: "#0a0a0f", borderBottom: "1px solid #1e1e2e", padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <span style={{ fontWeight: "bold", fontSize: "1.1rem" }}>
          Notifications {unread > 0 && <span style={{ background: "linear-gradient(135deg,#7c3aed,#db2777)", borderRadius: "10px", padding: "0.1rem 0.5rem", fontSize: "0.75rem", marginLeft: "0.4rem" }}>{unread}</span>}
        </span>
        {unread > 0 && (
          <span onClick={markAllRead} style={{ color: "#7c3aed", fontSize: "0.85rem", cursor: "pointer" }}>Mark all read</span>
        )}
      </div>

      {/* List */}
      <div>
        {notifs.length === 0 && (
          <div style={{ textAlign: "center", color: "#888", padding: "4rem 1rem" }}>
            <div style={{ fontSize: "3rem" }}>🔔</div>
            <p>No notifications yet</p>
          </div>
        )}

        {/* Group by Today */}
        {notifs.filter(n => Date.now() - new Date(n.createdAt) < 86400000).length > 0 && (
          <div style={{padding:"0.5rem 1rem",color:"#888",fontSize:"0.75rem",fontWeight:"bold",letterSpacing:"0.05em",borderBottom:"1px solid #1e1e2e"}}>TODAY</div>
        )}
        {notifs.map((n, i) => (
          <div key={n.id || i} onClick={() => handleTap(n)} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1rem", borderBottom: "1px solid #1e1e2e", cursor: "pointer", background: n.isRead ? "transparent" : "rgba(124,58,237,0.07)", transition: "background 0.2s" }}>

            {/* Avatar */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              {n.fromAvatar ? (
                <img src={n.fromAvatar} alt={n.fromUsername} style={{ width: "46px", height: "46px", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "46px", height: "46px", borderRadius: "50%", background: gradients[i % 3], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "1.1rem" }}>{avatar(n.fromUsername)}</div>
              )}
              <div style={{ position: "absolute", bottom: "-2px", right: "-2px", fontSize: "0.85rem" }}>{typeIcon(n.type)}</div>
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.9rem", lineHeight: 1.4 }}>
                <span style={{ fontWeight: "bold" }}>@{n.fromUsername}</span>{" "}
                <span style={{ color: "#ccc" }}>{n.text?.replace(n.fromUsername + " ", "")}</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#555", marginTop: "0.2rem" }}>{formatTime(n.createdAt)}</div>
            </div>

            {/* Post thumb */}
            {n.postThumb && (
              <img src={n.postThumb} alt="post" style={{ width: "44px", height: "44px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />
            )}

            {/* Unread dot */}
            {!n.isRead && (
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#7c3aed", flexShrink: 0 }} />
            )}

            {/* Delete */}
            <span onClick={(e) => deleteNotif(e, n.id)} style={{ color: "#444", fontSize: "1rem", cursor: "pointer", flexShrink: 0 }}>✕</span>
          </div>
        ))}
      </div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0a0a0f", borderTop: "1px solid #1e1e2e", display: "flex", justifyContent: "space-around", padding: "0.75rem 0", zIndex: 100 }}>
        <span onClick={() => navigate("/")} style={{ fontSize: "1.5rem", cursor: "pointer" }}>🏠</span>
        <span onClick={() => navigate("/search")} style={{ fontSize: "1.5rem", cursor: "pointer" }}>🔍</span>
        <div onClick={() => navigate("/upload")} style={{ width: "40px", height: "40px", borderRadius: "12px", background: "linear-gradient(135deg,#7c3aed,#db2777)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "1.2rem" }}>+</div>
        <span style={{ fontSize: "1.5rem", borderBottom: "2px solid white", paddingBottom: "2px" }}>🔔</span>
        <div onClick={() => navigate("/profile")} style={{ width: "28px", height: "28px", borderRadius: "50%", overflow: "hidden", cursor: "pointer", border: "2px solid #7c3aed" }}>
          {user?.avatar ? <img src={user.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="p" /> : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#7c3aed,#db2777)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: "bold" }}>{avatar(user?.username)}</div>}
        </div>
      </div>
    </div>
  );
}
