import React, { useState, useEffect } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Search() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("explore"); // explore | people | hashtag
  const [userResults, setUserResults] = useState([]);
  const [postResults, setPostResults] = useState([]);
  const [explorePosts, setExplorePosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState({});
  const debounceRef = React.useRef(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Load explore grid on mount
  useEffect(() => {
    API.get("/posts/explore").then(r => setExplorePosts(r.data)).catch(() => {});
  }, []);

  const handleSearch = (q) => {
    setQuery(q);
    if (q.length < 1) {
      setUserResults([]);
      setPostResults([]);
      setTab("explore");
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        if (q.startsWith("#")) {
          // Hashtag search
          setTab("hashtag");
          const tag = q.slice(1);
          if (tag.length > 0) {
            const res = await API.get("/posts/hashtag/" + tag);
            setPostResults(res.data);
          }
        } else {
          // People search
          setTab("people");
          const res = await API.get("/users/search?q=" + q);
          setUserResults(res.data.filter(u => u.id !== user?.id));
        }
      } catch {}
      setLoading(false);
    }, 400);
  };

  const handleFollow = async (userId) => {
    try {
      const res = await API.post("/users/" + userId + "/follow");
      setFollowing(p => ({ ...p, [userId]: res.data.following }));
    } catch {}
  };

  const avatar = (name) => (name || "U").slice(0, 1).toUpperCase();
  const gradients = [
    "linear-gradient(135deg,#7c3aed,#db2777)",
    "linear-gradient(135deg,#f59e0b,#ef4444)",
    "linear-gradient(135deg,#10b981,#3b82f6)",
  ];

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", color: "white", paddingBottom: "70px" }}>

      {/* Header */}
      <div style={{ background: "#0a0a0f", borderBottom: "1px solid #1e1e2e", padding: "0.75rem 1rem", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "#1e1e2e", borderRadius: "12px", padding: "0.6rem 1rem" }}>
          <span style={{ fontSize: "1.1rem" }}>🔍</span>
          <input
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search people or #hashtags..."
            style={{ flex: 1, background: "transparent", border: "none", color: "white", fontSize: "1rem", outline: "none" }}
            autoFocus
          />
          {query && <span onClick={() => { setQuery(""); setUserResults([]); setPostResults([]); setTab("explore"); }} style={{ color: "#888", cursor: "pointer" }}>✕</span>}
        </div>

        {/* Hashtag hint */}
        {!query && (
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem", overflowX: "auto", scrollbarWidth: "none" }}>
            {["#photography", "#art", "#music", "#travel", "#food"].map(tag => (
              <span key={tag} onClick={() => handleSearch(tag)} style={{ background: "#1e1e2e", borderRadius: "20px", padding: "0.3rem 0.75rem", fontSize: "0.8rem", color: "#a78bfa", cursor: "pointer", whiteSpace: "nowrap" }}>{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Explore Grid */}
      {tab === "explore" && (
        <div>
          <div style={{ padding: "0.75rem 1rem 0.3rem", color: "#888", fontSize: "0.85rem", fontWeight: "bold" }}>EXPLORE</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px" }}>
            {explorePosts.map((p, i) => (
              <div key={p.id || i} onClick={() => navigate("/comments/" + p.id)} style={{ position: "relative", aspectRatio: "1", overflow: "hidden", cursor: "pointer", background: "#111" }}>
                {p.mediaType === "video" ? (
                  <video src={p.mediaUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
                ) : (
                  <img src={p.mediaUrl} alt="post" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                {p.mediaType === "video" && (
                  <div style={{ position: "absolute", top: "4px", right: "4px", fontSize: "0.75rem" }}>🎬</div>
                )}
              </div>
            ))}
            {explorePosts.length === 0 && (
              <div style={{ gridColumn: "span 3", textAlign: "center", color: "#888", padding: "4rem 1rem" }}>
                <div style={{ fontSize: "3rem" }}>📷</div>
                <p>No posts yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hashtag Results */}
      {tab === "hashtag" && (
        <div style={{ padding: "0.75rem 1rem 0.3rem" }}>
          <div style={{ color: "#a78bfa", fontSize: "0.9rem", fontWeight: "bold", marginBottom: "0.5rem" }}>{query} — {postResults.length} posts</div>
          {loading && <div style={{ textAlign: "center", color: "#888", padding: "2rem" }}>🔍 Searching...</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px" }}>
            {postResults.map((p, i) => (
              <div key={p.id || i} onClick={() => navigate("/comments/" + p.id)} style={{ position: "relative", aspectRatio: "1", overflow: "hidden", cursor: "pointer", background: "#111" }}>
                {p.mediaType === "video" ? (
                  <video src={p.mediaUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
                ) : (
                  <img src={p.mediaUrl} alt="post" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                {p.mediaType === "video" && (
                  <div style={{ position: "absolute", top: "4px", right: "4px", fontSize: "0.75rem" }}>🎬</div>
                )}
                {/* Caption preview on hover */}
                {p.caption && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent,rgba(0,0,0,0.7))", padding: "0.5rem 0.3rem 0.3rem", fontSize: "0.65rem", color: "white", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.caption}
                  </div>
                )}
              </div>
            ))}
            {!loading && postResults.length === 0 && (
              <div style={{ gridColumn: "span 3", textAlign: "center", color: "#888", padding: "3rem" }}>
                <div style={{ fontSize: "2rem" }}>🏷️</div>
                <p>No posts with {query}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* People Results */}
      {tab === "people" && (
        <div style={{ padding: "1rem" }}>
          {loading && <div style={{ textAlign: "center", color: "#888", padding: "2rem" }}>🔍 Searching...</div>}
          {!loading && userResults.length === 0 && (
            <div style={{ textAlign: "center", color: "#888", padding: "3rem" }}>
              <div style={{ fontSize: "2rem" }}>👤</div>
              <p>No users found for "{query}"</p>
            </div>
          )}
          {userResults.map((u, i) => (
            <div key={u.id || i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 0", borderBottom: "1px solid #1e1e2e" }}>
              <div onClick={() => navigate("/user/" + u.username)} style={{ cursor: "pointer" }}>
                {u.avatar ? (
                  <img src={u.avatar} alt={u.username} style={{ width: "52px", height: "52px", borderRadius: "50%", objectFit: "cover", border: "2px solid #7c3aed" }} />
                ) : (
                  <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: gradients[i % 3], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "1.2rem" }}>{avatar(u.username)}</div>
                )}
              </div>
              <div style={{ flex: 1 }} onClick={() => navigate("/user/" + u.username)}>
                <div style={{ fontWeight: "bold", cursor: "pointer" }}>@{u.username}</div>
                <div style={{ color: "#888", fontSize: "0.85rem" }}>{u.fullName}</div>
                {u.bio && <div style={{ color: "#555", fontSize: "0.8rem", marginTop: "0.2rem" }}>{u.bio}</div>}
              </div>
              <button onClick={() => handleFollow(u.id)} style={{
                padding: "0.4rem 1rem",
                background: following[u.id] ? "transparent" : "linear-gradient(135deg,#7c3aed,#db2777)",
                border: following[u.id] ? "1px solid #444" : "none",
                borderRadius: "8px",
                color: "white",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "0.85rem",
                flexShrink: 0
              }}>
                {following[u.id] ? "Following" : "Follow"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0a0a0f", borderTop: "1px solid #1e1e2e", display: "flex", justifyContent: "space-around", padding: "0.75rem 0", zIndex: 100 }}>
        <span onClick={() => navigate("/")} style={{ fontSize: "1.5rem", cursor: "pointer" }}>🏠</span>
        <span style={{ fontSize: "1.5rem", borderBottom: "2px solid white", paddingBottom: "2px" }}>🔍</span>
        <div onClick={() => navigate("/upload")} style={{ width: "40px", height: "40px", borderRadius: "12px", background: "linear-gradient(135deg,#7c3aed,#db2777)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "1.2rem" }}>+</div>
        <span onClick={() => navigate("/reels")} style={{ fontSize: "1.5rem", cursor: "pointer" }}>🎬</span>
        <div onClick={() => navigate("/profile")} style={{ width: "28px", height: "28px", borderRadius: "50%", overflow: "hidden", cursor: "pointer", border: "2px solid #7c3aed" }}>
          {user?.avatar ? <img src={user.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="p" /> : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#7c3aed,#db2777)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: "bold" }}>{avatar(user?.username)}</div>}
        </div>
      </div>
    </div>
  );
}
