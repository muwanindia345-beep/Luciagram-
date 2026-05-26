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
  const [notes, setNotes] = useState([]);
  const [myNote, setMyNote] = useState("");
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [showNoteSheet, setShowNoteSheet] = useState(null);
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
    API.get("/notes").then(r => setNotes(r.data)).catch(()=>{});
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
        <div style={{display:"flex",gap:"0.75rem",alignItems:"center"}}>
          <span onClick={()=>navigate("/channels")} style={{fontSize:"1.3rem",cursor:"pointer"}}>👥</span>
          <div style={{display:"flex",gap:"0.75rem",alignItems:"center"}}>
          <span onClick={()=>navigate("/groupchat")} title="Group Chats" style={{fontSize:"1.3rem",cursor:"pointer"}}>👥</span>
          <span onClick={()=>navigate("/channels")} title="Channels" style={{fontSize:"1.3rem",cursor:"pointer"}}>📢</span>
          <div style={{display:"flex",gap:"0.75rem",alignItems:"center"}}>
          <span onClick={()=>navigate("/groupchat")} style={{fontSize:"1.3rem",cursor:"pointer"}}>👥</span>
          <span onClick={()=>setSearch(s=>s===""?" ":"")} style={{color:"#c084fc",cursor:"pointer",fontSize:"1.3rem"}}>✏️</span>
        </div>
        </div>
        </div>
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

        {/* Notes Bar */}
        <div style={{padding:"0 1rem 0.75rem",borderBottom:"1px solid #1e1e2e",marginBottom:"0.75rem"}}>
          <div style={{overflowX:"auto",display:"flex",gap:"1rem",paddingBottom:"0.25rem",scrollbarWidth:"none"}}>
            {/* Your Note */}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.4rem",minWidth:"70px",cursor:"pointer"}} onClick={()=>setShowNoteEditor(true)}>
              <div style={{width:"70px",height:"70px",borderRadius:"50%",overflow:"hidden",border:"2.5px solid #7c3aed",flexShrink:0}}>
                {user?.avatar?<img src={user.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="you"/>:<div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:"1.5rem"}}>{(user?.username||"U").slice(0,1).toUpperCase()}</div>}
              </div>
              <div style={{background:"#1a1a2e",border:"1px solid #7c3aed",borderRadius:"8px",padding:"2px 7px",maxWidth:"70px",textAlign:"center"}}>
                {notes.find(n=>n.userId===user?.id) ? <span style={{fontSize:"0.62rem",color:"#c084fc"}}>{notes.find(n=>n.userId===user?.id).text.slice(0,12)}{notes.find(n=>n.userId===user?.id).text.length>12?"...":""}</span> : <span style={{fontSize:"0.65rem",color:"#888"}}>+ Note</span>}
              </div>
              <span style={{fontSize:"0.62rem",color:"#888"}}>Your note</span>
            </div>
            {/* Others notes */}
            {notes.filter(n=>n.userId!==user?.id).map((n,i)=>(
              <div key={n.id||i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.4rem",minWidth:"70px",cursor:"pointer"}} onClick={()=>setShowNoteSheet(n)}>
                <div style={{width:"70px",height:"70px",borderRadius:"50%",overflow:"hidden",border:"2.5px solid #7c3aed",flexShrink:0}}>
                  {n.avatar?<img src={n.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt={n.username}/>:<div style={{width:"100%",height:"100%",background:["linear-gradient(135deg,#7c3aed,#db2777)","linear-gradient(135deg,#f59e0b,#ef4444)","linear-gradient(135deg,#10b981,#3b82f6)"][i%3],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:"1.5rem"}}>{(n.username||"U").slice(0,1).toUpperCase()}</div>}
                </div>
                <div style={{background:"#1a1a2e",border:"1px solid #2a2a3a",borderRadius:"8px",padding:"2px 7px",maxWidth:"70px",textAlign:"center"}}>
                  <span style={{fontSize:"0.62rem",color:"#ccc"}}>{n.text.slice(0,12)}{n.text.length>12?"...":""}</span>
                </div>
                <span style={{fontSize:"0.62rem",color:"#888",maxWidth:"70px",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>@{n.username}</span>
              </div>
            ))}
          </div>
        </div>

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

      {/* Note Editor */}
      {showNoteEditor && (
        <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowNoteEditor(false)} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
          <div style={{background:"#1a1a2e",borderRadius:"20px 20px 0 0",padding:"1.5rem 1rem"}}>
            <div style={{width:"40px",height:"4px",background:"#444",borderRadius:"2px",margin:"0 auto 1rem"}} />
            <div style={{fontWeight:"bold",fontSize:"1rem",textAlign:"center",marginBottom:"1rem"}}>Your Note <span style={{color:"#888",fontSize:"0.78rem"}}>(24h)</span></div>
            <textarea
              value={myNote}
              onChange={e=>setMyNote(e.target.value)}
              maxLength={60}
              placeholder="Share a thought..."
              style={{width:"100%",background:"#13131a",border:"1px solid #2a2a3a",borderRadius:"12px",padding:"0.75rem 1rem",color:"white",fontSize:"1rem",outline:"none",resize:"none",height:"80px",boxSizing:"border-box",fontFamily:"inherit"}}
              autoFocus
            />
            <div style={{textAlign:"right",color:"#555",fontSize:"0.75rem",marginBottom:"1rem"}}>{myNote.length}/60</div>
            <div style={{display:"flex",gap:"0.75rem"}}>
              <button onClick={async()=>{await API.post("/notes",{text:myNote}).catch(()=>{});const r=await API.get("/notes").catch(()=>({data:[]}));setNotes(r.data);setShowNoteEditor(false);}} style={{flex:1,background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"12px",color:"white",padding:"0.75rem",cursor:"pointer",fontWeight:"bold"}}>Share Note</button>
              {notes.find(n=>n.userId===user?.id) && <button onClick={async()=>{await API.delete("/notes").catch(()=>{});const r=await API.get("/notes").catch(()=>({data:[]}));setNotes(r.data);setMyNote("");setShowNoteEditor(false);}} style={{background:"#3a1a1a",border:"none",borderRadius:"12px",color:"#f87171",padding:"0.75rem 1rem",cursor:"pointer",fontWeight:"bold"}}>Delete</button>}
              <button onClick={()=>setShowNoteEditor(false)} style={{background:"#2a2a3a",border:"none",borderRadius:"12px",color:"#888",padding:"0.75rem 1rem",cursor:"pointer"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Note View Sheet */}
      {showNoteSheet && (
        <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowNoteSheet(null)}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)"}} />
          <div style={{background:"#1a1a2e",borderRadius:"20px",padding:"1.5rem",maxWidth:"280px",width:"90%",zIndex:10,position:"relative",textAlign:"center"}} onClick={e=>e.stopPropagation()}>
            <div style={{width:"64px",height:"64px",borderRadius:"50%",overflow:"hidden",margin:"0 auto 0.75rem",border:"3px solid #7c3aed"}}>
              {showNoteSheet.avatar?<img src={showNoteSheet.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="n"/>:<div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:"1.5rem"}}>{(showNoteSheet.username||"U").slice(0,1).toUpperCase()}</div>}
            </div>
            <div style={{fontWeight:"bold",color:"#c084fc",marginBottom:"0.5rem"}}>@{showNoteSheet.username}</div>
            <div style={{background:"#13131a",borderRadius:"12px",padding:"1rem",fontSize:"1rem",color:"white",lineHeight:1.5,marginBottom:"1rem"}}>"{showNoteSheet.text}"</div>
            <div style={{color:"#555",fontSize:"0.75rem",marginBottom:"1rem"}}>Expires in {Math.max(0,Math.floor((new Date(showNoteSheet.expiresAt)-Date.now())/3600000))}h</div>
            <button onClick={()=>{setShowNoteSheet(null);navigate("/chat/"+showNoteSheet.userId+"?username="+showNoteSheet.username);}} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"12px",color:"white",padding:"0.6rem 1.5rem",cursor:"pointer",fontWeight:"bold"}}>💬 Reply</button>
          </div>
        </div>
      )}
    </div>
  );
}
