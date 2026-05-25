import React, { useEffect, useState } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Messages() {
  const [conversations, setConversations] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    API.get("/messages/conversations").then(r => setConversations(r.data)).catch(()=>{});
  }, []);

  const handleSearch = async (q) => {
    setSearch(q);
    if (q.length < 2) return setSearchResults([]);
    try {
      const res = await API.get("/users/search?q=" + q);
      setSearchResults(res.data);
    } catch {}
  };

  const avatar = (name) => (name||"U").slice(0,1).toUpperCase();
  const gradients = ["linear-gradient(135deg,#7c3aed,#db2777)","linear-gradient(135deg,#f59e0b,#ef4444)","linear-gradient(135deg,#10b981,#3b82f6)"];

  return (
    <div style={{background:"#0a0a0f",minHeight:"100vh",color:"white",paddingBottom:"70px"}}>
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100}}>
        <span style={{fontWeight:"bold",fontSize:"1.1rem"}}>@{user?.username}</span>
        <span onClick={()=>setShowNew(!showNew)} style={{color:"#c084fc",cursor:"pointer",fontSize:"1.3rem"}}>✏️</span>
      </div>

      {showNew && (
        <div style={{padding:"0.75rem 1rem",background:"#13131a",borderBottom:"1px solid #1e1e2e"}}>
          <p style={{color:"#888",fontSize:"0.85rem",margin:"0 0 0.5rem"}}>Search to start a new chat:</p>
        </div>
      )}
      <div style={{padding:"0.75rem 1rem"}}>
        <input
          placeholder="🔍 Search people..."
          value={search}
          onChange={e=>handleSearch(e.target.value)}
          style={{width:"100%",background:"#1e1e2e",border:"none",borderRadius:"12px",padding:"0.75rem 1rem",color:"white",fontSize:"0.95rem",boxSizing:"border-box"}}
        />
      </div>

      {searchResults.length > 0 && (
        <div style={{padding:"0 1rem",marginBottom:"1rem"}}>
          <div style={{color:"#888",fontSize:"0.8rem",marginBottom:"0.5rem"}}>Search Results</div>
          {searchResults.map((u,i) => (
            <div key={u.id||i} onClick={()=>navigate("/chat/"+u.id+"?username="+u.username)} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.75rem 0",borderBottom:"1px solid #1e1e2e",cursor:"pointer"}}>
              <div style={{width:"46px",height:"46px",borderRadius:"50%",background:gradients[i%3],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",flexShrink:0}}>{avatar(u.username)}</div>
              <div><div style={{fontWeight:"bold"}}>@{u.username}</div><div style={{color:"#888",fontSize:"0.85rem"}}>{u.fullName}</div></div>
            </div>
          ))}
        </div>
      )}

      <div style={{padding:"0 1rem"}}>
        <div style={{color:"#888",fontSize:"0.8rem",marginBottom:"0.5rem"}}>Messages</div>
        {conversations.length === 0 ? (
          <div style={{textAlign:"center",color:"#888",marginTop:"3rem"}}>
            <div style={{fontSize:"3rem"}}>💬</div>
            <p>No messages yet</p>
            <p style={{fontSize:"0.85rem"}}>Search for people to start chatting!</p>
          </div>
        ) : conversations.map((c,i) => (
          <div key={c.userId||i} onClick={()=>navigate("/chat/"+c.userId+"?username="+c.username)} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.75rem 0",borderBottom:"1px solid #1e1e2e",cursor:"pointer"}}>
            <div style={{width:"50px",height:"50px",borderRadius:"50%",background:gradients[i%3],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",flexShrink:0,fontSize:"1.2rem"}}>{avatar(c.username)}</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontWeight:"bold"}}>@{c.username}</span>
                <span style={{color:"#555",fontSize:"0.75rem"}}>{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
              <div style={{color:"#888",fontSize:"0.85rem",marginTop:"0.2rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.lastMessage||"📷 Photo"}</div>
            </div>
            {c.unread > 0 && <div style={{width:"20px",height:"20px",borderRadius:"50%",background:"#7c3aed",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem"}}>{c.unread}</div>}
          </div>
        ))}
      </div>

      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0a0a0f",borderTop:"1px solid #1e1e2e",display:"flex",justifyContent:"space-around",padding:"0.75rem 0",zIndex:100}}>
        <span onClick={()=>navigate("/")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🏠</span>
        <span onClick={()=>navigate("/search")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🔍</span>
        <div onClick={()=>navigate("/upload")} style={{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1.2rem"}}>+</div>
        <span onClick={()=>navigate("/reels")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🎬</span>
        <div onClick={()=>navigate("/profile")} style={{width:"28px",height:"28px",borderRadius:"50%",overflow:"hidden",cursor:"pointer",border:"2px solid #7c3aed"}}>
          {user?.avatar ? <img src={user.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="p"/> : <div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",fontWeight:"bold"}}>{avatar(user?.username)}</div>}
        </div>
      </div>
    </div>
  );
}
