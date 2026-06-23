import React, { useEffect, useState, useRef } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function GroupChat() {
  const [groups, setGroups] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupAvatar, setGroupAvatar] = useState(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const avatarRef = useRef();

  useEffect(() => { loadGroups(); }, []);

  const loadGroups = async () => {
    try {
      const r = await API.get("/groups");
      setGroups(Array.isArray(r.data) ? r.data : []);
    } catch (e) { console.log("Groups load error:", e); }
  };

  const searchMembers = async (q) => {
    setMemberSearch(q);
    if (q.length < 2) return setMemberResults([]);
    try {
      const r = await API.get("/users/search?q=" + q);
      setMemberResults(r.data.filter(u =>
        u.id !== user?.id && !selectedMembers.find(m => m.id === u.id)
      ));
    } catch {}
  };

  const toggleMember = (u) => {
    setSelectedMembers(prev =>
      prev.find(m => m.id === u.id)
        ? prev.filter(m => m.id !== u.id)
        : [...prev, u]
    );
    setMemberSearch(""); setMemberResults([]);
  };

  const handleAvatarPick = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setGroupAvatar(reader.result);
    reader.readAsDataURL(file);
  };

  const createGroup = async () => {
    if (!groupName.trim() || creating) return;
    setCreating(true);
    try {
      const r = await API.post("/groups", { name: groupName.trim(), avatarBase64: groupAvatar || "" });
      const gid = r.data.id;
      for (const m of selectedMembers) {
        await API.post("/groups/" + gid + "/members", {
          userId: m.id, username: m.username, avatar: m.avatar || ""
        });
      }
      setShowCreate(false); setGroupName(""); setGroupAvatar(null); setSelectedMembers([]);
      await loadGroups();
      navigate("/group/" + gid);
    } catch {}
    setCreating(false);
  };

  const av = (n) => (n || "G").slice(0, 1).toUpperCase();
  const grads = [
    "linear-gradient(135deg,#7c3aed,#db2777)",
    "linear-gradient(135deg,#f59e0b,#ef4444)",
    "linear-gradient(135deg,#10b981,#3b82f6)",
    "linear-gradient(135deg,#8b5cf6,#06b6d4)"
  ];
  const fmtTime = (d) => {
    if (!d) return "";
    const diff = Date.now() - new Date(d);
    if (diff < 60000) return "now";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h";
    return new Date(d).toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="page">

      {/* Header */}
      <div className="page-header" style={{ padding: "0.75rem 1rem",
        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span onClick={() => navigate("/messages")}
            style={{ cursor: "pointer", fontSize: "1.3rem", padding: "0.25rem" }}>←</span>
          <span style={{ fontWeight: "bold", fontSize: "1.1rem" }}>🏢 Groups</span>
        </div>
        <span onClick={() => setShowCreate(true)}
          style={{ fontSize: "1.8rem", cursor: "pointer", color: "#c084fc",
            lineHeight: 1, padding: "0 0.25rem" }}>+</span>
      </div>

      {/* List */}
      <div className="page-scroll">
        {groups.length === 0 ? (
          <div style={{ textAlign: "center", color: "#555", marginTop: "5rem", padding: "0 2rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏢</div>
            <p style={{ fontWeight: "bold", color: "#888" }}>No groups yet</p>
            <p style={{ fontSize: "0.85rem", marginTop: "0.3rem" }}>Tap + to create your first group</p>
          </div>
        ) : (
          <div style={{ padding: "0 1rem" }}>
            {groups.map((g, i) => (
              <div key={g.id || i} onClick={() => navigate("/group/" + g.id)}
                style={{ display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.75rem 0", borderBottom: "1px solid #1e1e2e", cursor: "pointer" }}>
                {g.avatar
                  ? <img src={g.avatar} alt={g.name}
                      style={{ width: 52, height: 52, borderRadius: "50%",
                        objectFit: "cover", flexShrink: 0 }} />
                  : <div style={{ width: 52, height: 52, borderRadius: "50%",
                      background: grads[i % 4], display: "flex", alignItems: "center",
                      justifyContent: "center", fontWeight: "bold",
                      fontSize: "1.3rem", flexShrink: 0 }}>
                      {av(g.name)}
                    </div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginBottom: "0.2rem" }}>
                    <span style={{ fontWeight: "bold", fontSize: "0.95rem" }}>{g.name}</span>
                    <span style={{ color: "#555", fontSize: "0.72rem" }}>{fmtTime(g.updatedAt)}</span>
                  </div>
                  <div style={{ color: "#666", fontSize: "0.82rem" }}>
                    {g.members?.length || 0} members
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Group Sheet */}
      {showCreate && (
        <div className="sheet-overlay">
          <div className="sheet-backdrop" onClick={() => setShowCreate(false)} />
          <div className="sheet-content">
            <div className="sheet-handle" />
            <div style={{ fontWeight: "bold", fontSize: "1rem",
              textAlign: "center", marginBottom: "1.25rem" }}>New Group</div>

            {/* Avatar picker */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
              <div onClick={() => avatarRef.current?.click()}
                style={{ width: 72, height: 72, borderRadius: "50%",
                  background: groupAvatar ? "transparent" : "linear-gradient(135deg,#7c3aed,#db2777)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", overflow: "hidden", border: "2px dashed #7c3aed" }}>
                {groupAvatar
                  ? <img src={groupAvatar} alt="av" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: "1.8rem" }}>📷</span>
                }
              </div>
              <input ref={avatarRef} type="file" accept="image/*"
                onChange={handleAvatarPick} style={{ display: "none" }} />
            </div>

            {/* Group name */}
            <input value={groupName} onChange={e => setGroupName(e.target.value)}
              placeholder="Group name..." maxLength={40}
              style={{ width: "100%", background: "#1e1e2e", border: "1px solid #2a2a3a",
                borderRadius: "12px", padding: "0.75rem 1rem", color: "white",
                fontSize: "1rem", outline: "none", boxSizing: "border-box", marginBottom: "1rem" }} />

            {/* Member search */}
            <div style={{ background: "#1e1e2e", borderRadius: "12px",
              padding: "0.6rem 1rem", display: "flex", alignItems: "center",
              gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ color: "#888" }}>🔍</span>
              <input value={memberSearch} onChange={e => searchMembers(e.target.value)}
                placeholder="Add members..."
                style={{ flex: 1, background: "transparent", border: "none",
                  color: "white", fontSize: "0.95rem", outline: "none" }} />
            </div>

            {memberResults.map((u, i) => (
              <div key={u.id || i} onClick={() => toggleMember(u)}
                style={{ display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.6rem 0", borderBottom: "1px solid #1e1e2e", cursor: "pointer" }}>
                {u.avatar
                  ? <img src={u.avatar} alt={u.username}
                      style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }} />
                  : <div style={{ width: 38, height: 38, borderRadius: "50%",
                      background: grads[i % 4], display: "flex", alignItems: "center",
                      justifyContent: "center", fontWeight: "bold" }}>{av(u.username)}</div>
                }
                <span style={{ flex: 1 }}>@{u.username}</span>
                <span style={{ color: "#7c3aed", fontSize: "1.2rem" }}>+</span>
              </div>
            ))}

            {selectedMembers.length > 0 && (
              <div style={{ margin: "0.75rem 0" }}>
                <div style={{ color: "#888", fontSize: "0.75rem",
                  fontWeight: "bold", marginBottom: "0.5rem",
                  letterSpacing: "0.05em" }}>
                  SELECTED ({selectedMembers.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {selectedMembers.map((m, i) => (
                    <div key={m.id || i} onClick={() => toggleMember(m)}
                      style={{ display: "flex", alignItems: "center", gap: "0.4rem",
                        background: "#1e1e2e", borderRadius: "20px",
                        padding: "0.3rem 0.75rem", fontSize: "0.82rem", cursor: "pointer" }}>
                      <span>@{m.username}</span>
                      <span style={{ color: "#f87171" }}>✕</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={createGroup} disabled={!groupName.trim() || creating}
              style={{ width: "100%", border: "none", borderRadius: "12px",
                padding: "0.85rem", fontWeight: "bold", fontSize: "1rem",
                marginTop: "0.75rem", cursor: groupName.trim() ? "pointer" : "not-allowed",
                background: groupName.trim()
                  ? "linear-gradient(135deg,#7c3aed,#db2777)" : "#2a2a3a",
                color: groupName.trim() ? "white" : "#555" }}>
              {creating ? "Creating..." : "Create Group"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
