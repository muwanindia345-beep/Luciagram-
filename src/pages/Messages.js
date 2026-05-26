import React, { useEffect, useState, useRef } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Messages() {
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [userProfiles, setUserProfiles] = useState({});
  const [totalUnread, setTotalUnread] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();
  const pollRef = useRef(null);

  const loadConversations = async () => {
    try {
      const r = await API.get("/messages/conversations");
      setConversations(r.data);
      // Count total unread
      const unread = r.data.reduce((sum, c) => sum + (c.unread || 0), 0);
      setTotalUnread(unread);
      // Update page title with notification count
      document.title = unread > 0 ? "(" + unread + ") Luciagram" : "Luciagram";
      // Fetch avatars for all conversation users
      r.data.forEach(c => {
        if (c.username && !userProfiles[c.username]) {
          API.get("/users/" + c.username).then(res => {
            setUserProfiles(prev => ({...prev, [c.username]: res.data}));
          }).catch(()=>{});
        }
      });
    } catch {}
  };

  useEffect(() => {
    loadConversations();
    // Poll every 5s for new messages / notifications
    pollRef.current = setInterval(loadConversations, 5000);
    return () => clearInterval(pollRef.current);
  }, []);

  const handleSearch = async (q) => {
    setSearch(q);
    if (q.length < 2) return setSearchResults([]);
    try {
      const res = await API.get("/users/search?q=" + q);
      setSearchResults(res.data.filter(u => u.id !== user?.id));
    } catch {}
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return "now";
    if (diff < 3600000) return Math.floor(diff/60000) + "m";
    if (diff < 86400000) return Math.floor(diff/3600000) + "h";
    return d.toLocaleDateString([], {month:"short", day:"numeric"});
  };

  const formatLastMsg = (c) => {
    if (!c.lastMessage && c.lastMedia) return "📷 Photo";
    if (!c.lastMessage) return "";
    const msg = c.lastMessage;
    // Clean up shared reel/post labels for preview
    if (msg.includes("Shared a Reel")) return "🎬 Shared a Reel";
    if (msg.includes("Shared a Post")) return "📸 Shared a Post";
    if (msg.includes("Replied to your story")) return "💬 Replied to story";
    return msg.length > 35 ? msg.slice(0, 35) + "..." : msg;
  };

  const avatar = (name) => (name||"U").slice(0,1).toUpperCase();
  const gradients = ["linear-gradient(135deg,#7c3aed,#db2777)","linear-gradient(135deg,#f59e0b,#ef4444)","linear-gradient(135deg,#10b981,#3b82f6)","linear-gradient(135deg,#8b5cf6,#06b6d4)"];

  const AvatarImg = ({ username, size=50 }) => {
    const profile = userProfiles[username];
    if (profile?.avatar) {
      return <img src={profile.avatar} alt={username} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0}} />;
    }
    return <div style={{width:size,height:size,borderRadius:"50%",background:gradients[(username||"").charCodeAt(0)%4],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:size*0.38,color:"white",flexShrink:0}}>{avatar(username)}</div>;
  };

  return (
    <div style={{background:"#0a0a0f",height:"100vh",color:"white",display:"flex",flexDirection:"column",overflow:"hidden",maxWidth:"100vw",boxSizing:"border-box"}}>

      {/* Header */}
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
          <span style={{fontWeight:"bold",fontSize:"1.1rem"}}>@{user?.username}</span>
          {totalUnread > 0 && (
            <div style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",borderRadius:"12px",padding:"0.1rem 0.5rem",fontSize:"0.75rem",fontWeight:"bold",minWidth:"20px",textAlign:"center"}}>
              {totalUnread}
            </div>
          )}
        </div>
        <span onClick={()=>setSearch(s=>s===""?" ":"")} style={{color:"#c084fc",cursor:"pointer",fontSize:"1.3rem"}}>✏️</span>
      </div>

      {/* Search Bar */}
      <div style={{padding:"0.75rem 1rem",flexShrink:0,background:"#0a0a0f"}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.5rem",background:"#1e1e2e",borderRadius:"12px",padding:"0.6rem 1rem"}}>
          <span style={{color:"#888",fontSize:"1rem"}}>🔍</span>
          <input
            placeholder="Search people..."
            value={search}
            onChange={e=>handleSearch(e.target.value)}
            style={{flex:1,background:"transparent",border:"none",color:"white",fontSize:"0.95rem",outline:"none",minWidth:0}}
          />
          {search && <span onClick={()=>{setSearch("");setSearchResults([]);}} style={{color:"#888",cursor:"pointer",fontSize:"1rem"}}>✕</span>}
        </div>
      </div>

      {/* Scrollable Content */}
      <div style={{flex:1,overflowY:"auto",paddingBottom:"70px"}}>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div style={{padding:"0 1rem",marginBottom:"0.5rem"}}>
            <div style={{color:"#888",fontSize:"0.78rem",marginBottom:"0.5rem",fontWeight:"bold",letterSpacing:"0.05em"}}>PEOPLE</div>
            {searchResults.map((u,i) => (
              <div key={u.id||i} onClick={()=>navigate("/chat/"+u.id+"?username="+u.username)} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.75rem 0",borderBottom:"1px solid #1e1e2e",cursor:"pointer"}}>
                {u.avatar ? (
                  <img src={u.avatar} alt={u.username} style={{width:"46px",height:"46px",borderRadius:"50%",objectFit:"cover",flexShrink:0}} />
                ) : (
                  <div style={{width:"46px",height:"46px",borderRadius:"50%",background:gradients[i%4],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",flexShrink:0}}>{avatar(u.username)}</div>
                )}
                <div>
                  <div style={{fontWeight:"bold",fontSize:"0.95rem"}}>@{u.username}</div>
                  {u.fullName && <div style={{color:"#888",fontSize:"0.82rem"}}>{u.fullName}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Conversations */}
        <div style={{padding:"0 1rem"}}>
          {!search && <div style={{color:"#888",fontSize:"0.78rem",marginBottom:"0.5rem",fontWeight:"bold",letterSpacing:"0.05em"}}>MESSAGES</div>}
          {conversations.length === 0 && !search ? (
            <div style={{textAlign:"center",color:"#888",marginTop:"4rem"}}>
              <div style={{fontSize:"3rem",marginBottom:"1rem"}}>💬</div>
              <p style={{fontWeight:"bold",color:"#ccc"}}>No messages yet</p>
              <p style={{fontSize:"0.85rem"}}>Search for people above to start chatting!</p>
            </div>
          ) : conversations.map((c,i) => (
            <div key={c.userId||i} onClick={()=>navigate("/chat/"+c.userId+"?username="+c.username)} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.75rem 0",borderBottom:"1px solid #1e1e2e",cursor:"pointer"}}>
              {/* Avatar with online-style ring for unread */}
              <div style={{position:"relative",flexShrink:0}}>
                <div style={{padding:"2px",borderRadius:"50%",background:c.unread>0?"linear-gradient(135deg,#7c3aed,#db2777)":"transparent"}}>
                  <AvatarImg username={c.username} size={48} />
                </div>
                {c.unread > 0 && (
                  <div style={{position:"absolute",top:-2,right:-2,width:"18px",height:"18px",borderRadius:"50%",background:"#7c3aed",border:"2px solid #0a0a0f",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.65rem",fontWeight:"bold"}}>
                    {c.unread}
                  </div>
                )}
              </div>

              {/* Content */}
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.2rem"}}>
                  <span style={{fontWeight:c.unread>0?"bold":"normal",fontSize:"0.95rem",color:c.unread>0?"white":"#ccc"}}>@{c.username}</span>
                  <span style={{color:"#555",fontSize:"0.72rem",flexShrink:0,marginLeft:"0.5rem"}}>{formatTime(c.createdAt)}</span>
                </div>
                <div style={{color:c.unread>0?"#a78bfa":"#666",fontSize:"0.83rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:c.unread>0?"500":"normal"}}>
                  {formatLastMsg(c)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0a0a0f",borderTop:"1px solid #1e1e2e",display:"flex",justifyContent:"space-around",padding:"0.75rem 0",zIndex:100}}>
        <span onClick={()=>navigate("/")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🏠</span>
        <span onClick={()=>navigate("/search")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🔍</span>
        <div onClick={()=>navigate("/upload")} style={{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1.2rem"}}>+</div>
        <span onClick={()=>navigate("/reels")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🎬</span>
        <div onClick={()=>navigate("/profile")} style={{width:"28px",height:"28px",borderRadius:"50%",overflow:"hidden",cursor:"pointer",border:"2px solid #7c3aed"}}>
          {user?.avatar?<img src={user.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="p"/>:<div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",fontWeight:"bold"}}>{avatar(user?.username)}</div>}
        </div>
      </div>
    </div>
  );
}
