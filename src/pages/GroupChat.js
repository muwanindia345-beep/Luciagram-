import React, { useEffect, useState, useRef } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const FONTS = [
  { label: "Default", value: "inherit" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Mono", value: "monospace" },
  { label: "Cursive", value: "cursive" },
  { label: "Fantasy", value: "fantasy" },
  { label: "Rounded", value: "'Nunito', sans-serif" },
];

const gradients = ["linear-gradient(135deg,#7c3aed,#db2777)","linear-gradient(135deg,#f59e0b,#ef4444)","linear-gradient(135deg,#10b981,#3b82f6)","linear-gradient(135deg,#8b5cf6,#06b6d4)"];
const avatar = (name) => (name||"U").slice(0,1).toUpperCase();

function AvatarImg({ src, username, size=36 }) {
  if (src) return <img src={src} alt={username} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0}} />;
  return <div style={{width:size,height:size,borderRadius:"50%",background:gradients[(username||"U").charCodeAt(0)%4],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:size*0.38,color:"white",flexShrink:0}}>{avatar(username)}</div>;
}

export default function GroupChat() {
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [typers, setTypers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupFont, setGroupFont] = useState(FONTS[0].value);
  const [groupAvatarBase64, setGroupAvatarBase64] = useState(null);
  const [groupAvatarPreview, setGroupAvatarPreview] = useState(null);
  const [searchUsers, setSearchUsers] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaBase64, setMediaBase64] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const bottomRef = useRef();
  const fileRef = useRef();
  const groupAvatarRef = useRef();
  const pollRef = useRef();
  const typingRef = useRef();

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (activeGroup) {
      loadMessages(activeGroup.id);
      pollRef.current = setInterval(() => {
        loadMessages(activeGroup.id);
        loadTypers(activeGroup.id);
      }, 2500);
      return () => clearInterval(pollRef.current);
    }
  }, [activeGroup?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadGroups = async () => {
    try {
      const res = await API.get("/groups");
      setGroups(res.data);
    } catch {}
  };

  const loadMessages = async (groupId) => {
    try {
      const res = await API.get("/groups/" + groupId + "/messages");
      setMessages(res.data);
    } catch {}
  };

  const loadTypers = async (groupId) => {
    try {
      const res = await API.get("/groups/" + groupId + "/typing");
      setTypers(res.data.typers || []);
    } catch {}
  };

  const sendTyping = async () => {
    if (!activeGroup) return;
    try { await API.post("/groups/" + activeGroup.id + "/typing"); } catch {}
    clearTimeout(typingRef.current);
    typingRef.current = setTimeout(async () => {
      try { await API.post("/groups/" + activeGroup.id + "/typing/stop"); } catch {}
    }, 2000);
  };

  const pickGroupAvatar = () => groupAvatarRef.current?.click();

  const handleGroupAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setGroupAvatarPreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => setGroupAvatarBase64(reader.result.split(",")[1]);
    reader.readAsDataURL(file);
  };

  const createGroup = async () => {
    if (!groupName.trim()) return;
    try {
      const res = await API.post("/groups", { name: groupName, avatarBase64: groupAvatarBase64 || null });
      setGroups(prev => [res.data, ...prev]);
      setGroupName(""); setGroupAvatarBase64(null); setGroupAvatarPreview(null);
      setShowCreate(false);
      openGroup(res.data);
    } catch {}
  };

  const openGroup = (group) => {
    setActiveGroup(group);
    setMessages([]);
    loadMessages(group.id);
  };

  const pickMedia = () => fileRef.current?.click();

  const handleMediaChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => setMediaBase64(reader.result.split(",")[1]);
    reader.readAsDataURL(file);
  };

  const sendMessage = async () => {
    if ((!text.trim() && !mediaBase64) || sending) return;
    setSending(true);
    try {
      let mediaUrl = "";
      let mediaType = "";
      if (mediaBase64) {
        const isVideo = mediaFile?.type?.startsWith("video");
        const res = await API.post("/groups/upload", { mediaBase64, mediaType: isVideo ? "video" : "image" });
        mediaUrl = res.data.url;
        mediaType = isVideo ? "video" : "image";
      }
      await API.post("/groups/" + activeGroup.id + "/messages", { text: text.trim(), mediaUrl, mediaType });
      setText(""); setMediaFile(null); setMediaPreview(null); setMediaBase64(null);
      await loadMessages(activeGroup.id);
      try { await API.post("/groups/" + activeGroup.id + "/typing/stop"); } catch {}
    } catch {}
    setSending(false);
  };

  const searchForUsers = async (q) => {
    setSearchUsers(q);
    if (q.length < 2) return setSearchResults([]);
    try {
      const res = await API.get("/users/search?q=" + q);
      setSearchResults(res.data.filter(u => u.id !== user?.id && !activeGroup?.members?.find(m => m.id === u.id)));
    } catch {}
  };

  const addMember = async (u) => {
    try {
      const res = await API.post("/groups/" + activeGroup.id + "/members", { userId: u.id, username: u.username, avatar: u.avatar || "" });
      setActiveGroup(res.data);
      setGroups(prev => prev.map(g => g.id === res.data.id ? res.data : g));
      setSearchUsers(""); setSearchResults([]);
    } catch {}
  };

  const removeMember = async (memberId) => {
    if (!window.confirm("Remove this member?")) return;
    try {
      const res = await API.delete("/groups/" + activeGroup.id + "/members/" + memberId);
      setActiveGroup(res.data);
    } catch (e) { alert(e?.response?.data?.message || "Cannot remove"); }
  };

  const toggleAdmin = async (memberId, isAdmin) => {
    try {
      if (isAdmin) {
        const res = await API.delete("/groups/" + activeGroup.id + "/admins/" + memberId);
        setActiveGroup(res.data);
      } else {
        const res = await API.post("/groups/" + activeGroup.id + "/admins/" + memberId);
        setActiveGroup(res.data);
      }
    } catch (e) { alert(e?.response?.data?.message || "Error"); }
  };

  const isAdmin = activeGroup?.admins?.includes(user?.id);
  const isCreator = activeGroup?.createdById === user?.id;

  // ---- GROUP CHAT VIEW ----
  if (activeGroup) return (
    <div style={{background:"#0a0a0f",height:"100vh",color:"white",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <input ref={fileRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx" style={{display:"none"}} onChange={handleMediaChange} />

      {/* Header */}
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.6rem 1rem",display:"flex",alignItems:"center",gap:"0.75rem",flexShrink:0}}>
        <span onClick={()=>{setActiveGroup(null);clearInterval(pollRef.current);}} style={{cursor:"pointer",fontSize:"1.3rem"}}>←</span>
        <div onClick={()=>setShowInfo(true)} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:"0.6rem",flex:1}}>
          <AvatarImg src={activeGroup.avatar} username={activeGroup.name} size={38} />
          <div>
            <div style={{fontWeight:"bold",fontSize:"0.95rem",fontFamily:groupFont}}>{activeGroup.name}</div>
            <div style={{fontSize:"0.72rem",color:"#888"}}>{activeGroup.members?.length} members</div>
          </div>
        </div>
        <span onClick={()=>setShowAddMember(true)} style={{fontSize:"1.3rem",cursor:"pointer"}}>➕</span>
        <span onClick={()=>setShowInfo(true)} style={{fontSize:"1.3rem",cursor:"pointer"}}>ℹ️</span>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"0.75rem 1rem",display:"flex",flexDirection:"column",gap:"0.6rem"}}>
        <div style={{textAlign:"center",color:"#555",fontSize:"0.75rem",marginBottom:"0.5rem"}}>🔒 Group created by @{activeGroup.createdBy}</div>
        {messages.map((m,i) => {
          const isMe = m.senderId === user?.id;
          const member = activeGroup.members?.find(mb => mb.id === m.senderId);
          return (
            <div key={m.id||i} style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start",alignItems:"flex-end",gap:"0.5rem"}}>
              {!isMe && <AvatarImg src={member?.avatar||m.senderAvatar} username={m.senderUsername} size={28} />}
              <div style={{maxWidth:"72%"}}>
                {!isMe && <div style={{fontSize:"0.7rem",color:"#c084fc",marginBottom:"0.15rem",fontWeight:"bold"}}>@{m.senderUsername}</div>}
                {m.mediaUrl && (
                  <div style={{marginBottom:"0.3rem",borderRadius:"12px",overflow:"hidden"}}>
                    {m.mediaType==="video" ? (
                      <video src={m.mediaUrl} controls playsInline style={{width:"100%",maxWidth:"260px",borderRadius:"12px",maxHeight:"280px",display:"block"}} />
                    ) : (
                      <img src={m.mediaUrl} alt="media" style={{width:"100%",maxWidth:"260px",borderRadius:"12px",maxHeight:"280px",objectFit:"cover",display:"block"}} />
                    )}
                  </div>
                )}
                {m.text && (
                  <div style={{background:isMe?"linear-gradient(135deg,#7c3aed,#db2777)":"#1e1e2e",padding:"0.55rem 0.9rem",borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px",fontSize:"0.93rem",wordBreak:"break-word",lineHeight:1.4,fontFamily:groupFont}}>
                    {m.text}
                  </div>
                )}
                <div style={{fontSize:"0.68rem",color:"#555",marginTop:"0.15rem",textAlign:isMe?"right":"left"}}>{new Date(m.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
              </div>
            </div>
          );
        })}

        {/* Typing indicators with avatars */}
        {typers.length > 0 && (
          <div style={{display:"flex",alignItems:"center",gap:"0.4rem",paddingLeft:"0.5rem"}}>
            {typers.slice(0,3).map((t,i) => <AvatarImg key={i} src={t.avatar} username={t.username} size={22} />)}
            <div style={{background:"#1e1e2e",borderRadius:"18px",padding:"0.5rem 0.85rem",display:"flex",gap:"4px",alignItems:"center"}}>
              {[0,1,2].map(i=><div key={i} style={{width:"6px",height:"6px",borderRadius:"50%",background:"#888",animation:`bounce 1s ${i*0.2}s infinite`}} />)}
            </div>
            <span style={{fontSize:"0.72rem",color:"#888"}}>{typers.map(t=>t.username).join(", ")} typing...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Media Preview */}
      {mediaPreview && (
        <div style={{padding:"0.5rem 1rem",background:"#13131a",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.75rem",flexShrink:0}}>
          {mediaFile?.type?.startsWith("video") ? (
            <video src={mediaPreview} style={{height:"60px",borderRadius:"8px"}} />
          ) : (
            <img src={mediaPreview} alt="preview" style={{height:"60px",borderRadius:"8px",objectFit:"cover"}} />
          )}
          <span style={{color:"#ccc",fontSize:"0.82rem",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{mediaFile?.name}</span>
          <span onClick={()=>{setMediaFile(null);setMediaPreview(null);setMediaBase64(null);}} style={{color:"#888",cursor:"pointer",fontSize:"1.2rem"}}>✕</span>
        </div>
      )}

      {/* Input */}
      <div style={{padding:"0.6rem 1rem",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.6rem",background:"#0a0a0f",flexShrink:0}}>
        <span style={{fontSize:"1.3rem",cursor:"pointer"}}>😊</span>
        <input
          value={text}
          onChange={e=>{setText(e.target.value);sendTyping();}}
          onKeyDown={e=>e.key==="Enter"&&sendMessage()}
          placeholder="Message group..."
          style={{flex:1,background:"#1e1e2e",border:"none",borderRadius:"20px",padding:"0.6rem 1rem",color:"white",fontSize:"0.93rem",outline:"none",fontFamily:groupFont,minWidth:0}}
        />
        <span onClick={pickMedia} style={{fontSize:"1.3rem",cursor:"pointer"}}>📎</span>
        {(text || mediaBase64) ? (
          <button onClick={sendMessage} disabled={sending} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"50%",width:"36px",height:"36px",color:"white",cursor:"pointer",fontSize:"1rem",flexShrink:0}}>➤</button>
        ) : (
          <span style={{fontSize:"1.3rem",cursor:"pointer"}}>❤️</span>
        )}
      </div>

      {/* Group Info Sheet */}
      {showInfo && (
        <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowInfo(false)} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
          <div style={{background:"#1a1a2e",borderRadius:"20px 20px 0 0",maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"1rem",borderBottom:"1px solid #2a2a3a",flexShrink:0}}>
              <div style={{width:"40px",height:"4px",background:"#444",borderRadius:"2px",margin:"0 auto 1rem"}} />
              <div style={{display:"flex",alignItems:"center",gap:"1rem"}}>
                <AvatarImg src={activeGroup.avatar} username={activeGroup.name} size={56} />
                <div>
                  <div style={{fontWeight:"bold",fontSize:"1.1rem",fontFamily:groupFont}}>{activeGroup.name}</div>
                  <div style={{color:"#888",fontSize:"0.82rem"}}>Created by @{activeGroup.createdBy}</div>
                  <div style={{color:"#7c3aed",fontSize:"0.78rem",marginTop:"0.2rem"}}>{activeGroup.members?.length} members</div>
                </div>
              </div>
              {/* Font picker */}
              <div style={{marginTop:"1rem"}}>
                <div style={{color:"#888",fontSize:"0.75rem",marginBottom:"0.4rem"}}>Chat Font</div>
                <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
                  {FONTS.map(f=>(
                    <div key={f.value} onClick={()=>setGroupFont(f.value)} style={{padding:"0.3rem 0.7rem",borderRadius:"20px",background:groupFont===f.value?"linear-gradient(135deg,#7c3aed,#db2777)":"#2a2a3a",color:"white",fontSize:"0.8rem",cursor:"pointer",fontFamily:f.value}}>{f.label}</div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"0.75rem 1rem"}}>
              <div style={{color:"#888",fontSize:"0.75rem",fontWeight:"bold",marginBottom:"0.75rem",letterSpacing:"0.05em"}}>MEMBERS</div>
              {activeGroup.members?.map((m,i) => {
                const isMemberAdmin = activeGroup.admins?.includes(m.id);
                const isMemberCreator = m.id === activeGroup.createdById;
                return (
                  <div key={m.id||i} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.6rem 0",borderBottom:"1px solid #1e1e2e"}}>
                    <AvatarImg src={m.avatar} username={m.username} size={40} />
                    <div style={{flex:1}}>
                      <div style={{fontWeight:"bold",fontSize:"0.9rem"}}>@{m.username}</div>
                      <div style={{fontSize:"0.72rem",color:isMemberCreator?"#f59e0b":isMemberAdmin?"#7c3aed":"#555"}}>
                        {isMemberCreator?"👑 Creator":isMemberAdmin?"⚡ Admin":"Member"}
                      </div>
                    </div>
                    {/* Admin controls - creator can manage admins, admins can remove non-creators */}
                    {!isMemberCreator && m.id !== user?.id && (
                      <div style={{display:"flex",gap:"0.5rem"}}>
                        {isCreator && (
                          <button onClick={()=>toggleAdmin(m.id,isMemberAdmin)} style={{background:isMemberAdmin?"#2a2a3a":"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"6px",color:"white",padding:"0.25rem 0.6rem",fontSize:"0.72rem",cursor:"pointer"}}>
                            {isMemberAdmin?"−Admin":"+Admin"}
                          </button>
                        )}
                        {isAdmin && !isMemberCreator && (
                          <button onClick={()=>removeMember(m.id)} style={{background:"#3a1a1a",border:"none",borderRadius:"6px",color:"#f87171",padding:"0.25rem 0.6rem",fontSize:"0.72rem",cursor:"pointer"}}>Remove</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Member Sheet */}
      {showAddMember && (
        <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>{setShowAddMember(false);setSearchUsers("");setSearchResults([]);}} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
          <div style={{background:"#1a1a2e",borderRadius:"20px 20px 0 0",maxHeight:"70vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"1rem",borderBottom:"1px solid #2a2a3a",flexShrink:0}}>
              <div style={{width:"40px",height:"4px",background:"#444",borderRadius:"2px",margin:"0 auto 1rem"}} />
              <div style={{fontWeight:"bold",color:"white",textAlign:"center",marginBottom:"0.75rem"}}>Add Members</div>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",background:"#13131a",borderRadius:"12px",padding:"0.6rem 1rem"}}>
                <span style={{color:"#888"}}>🔍</span>
                <input value={searchUsers} onChange={e=>searchForUsers(e.target.value)} placeholder="Search users..." style={{flex:1,background:"transparent",border:"none",color:"white",fontSize:"0.95rem",outline:"none"}} autoFocus />
              </div>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"0.75rem 1rem"}}>
              {searchResults.map((u,i)=>(
                <div key={u.id||i} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.6rem 0",borderBottom:"1px solid #1e1e2e"}}>
                  <AvatarImg src={u.avatar} username={u.username} size={42} />
                  <div style={{flex:1}}>
                    <div style={{fontWeight:"bold"}}>@{u.username}</div>
                    {u.fullName && <div style={{color:"#888",fontSize:"0.8rem"}}>{u.fullName}</div>}
                  </div>
                  <button onClick={()=>addMember(u)} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"20px",color:"white",padding:"0.4rem 1rem",cursor:"pointer",fontSize:"0.85rem",fontWeight:"bold"}}>Add</button>
                </div>
              ))}
              {searchUsers.length > 1 && searchResults.length === 0 && (
                <div style={{textAlign:"center",color:"#888",padding:"2rem"}}>No users found</div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
      `}</style>
    </div>
  );

  // ---- GROUP LIST VIEW ----
  return (
    <div style={{background:"#0a0a0f",height:"100vh",color:"white",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <input ref={groupAvatarRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleGroupAvatarChange} />

      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <span onClick={()=>navigate("/messages")} style={{cursor:"pointer",fontSize:"1.3rem"}}>←</span>
        <span style={{fontWeight:"bold",fontSize:"1.1rem"}}>👥 Group Chats</span>
        <button onClick={()=>setShowCreate(true)} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"8px",color:"white",padding:"0.4rem 0.8rem",cursor:"pointer",fontSize:"0.85rem",fontWeight:"bold"}}>+ New</button>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"1rem"}}>
        {groups.length === 0 && !showCreate ? (
          <div style={{textAlign:"center",color:"#888",paddingTop:"4rem"}}>
            <div style={{fontSize:"3rem",marginBottom:"1rem"}}>👥</div>
            <p style={{fontWeight:"bold",color:"#ccc"}}>No group chats yet</p>
            <button onClick={()=>setShowCreate(true)} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"8px",color:"white",padding:"0.5rem 1.2rem",cursor:"pointer",fontWeight:"bold",marginTop:"0.5rem"}}>Create First Group</button>
          </div>
        ) : groups.map((g,i) => {
          const lastMsg = g.lastMessage;
          return (
            <div key={g.id||i} onClick={()=>openGroup(g)} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.75rem",background:"#13131a",borderRadius:"12px",marginBottom:"0.75rem",cursor:"pointer",border:"1px solid #1e1e2e"}}>
              <AvatarImg src={g.avatar} username={g.name} size={50} />
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:"bold",fontSize:"0.95rem"}}>{g.name}</div>
                <div style={{color:"#888",fontSize:"0.78rem",marginTop:"0.1rem"}}>{g.members?.length} members · @{g.createdBy}</div>
              </div>
              {g.admins?.includes(user?.id) && <span style={{fontSize:"0.7rem",color:"#7c3aed",background:"rgba(124,58,237,0.15)",padding:"0.15rem 0.4rem",borderRadius:"6px"}}>Admin</span>}
            </div>
          );
        })}
      </div>

      {/* Create Group Sheet */}
      {showCreate && (
        <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowCreate(false)} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
          <div style={{background:"#1a1a2e",borderRadius:"20px 20px 0 0",padding:"1.5rem 1rem"}}>
            <div style={{width:"40px",height:"4px",background:"#444",borderRadius:"2px",margin:"0 auto 1.5rem"}} />
            <div style={{fontWeight:"bold",fontSize:"1.1rem",textAlign:"center",marginBottom:"1.25rem"}}>New Group</div>

            {/* Group Avatar Picker */}
            <div style={{display:"flex",justifyContent:"center",marginBottom:"1.25rem"}}>
              <div onClick={pickGroupAvatar} style={{position:"relative",cursor:"pointer"}}>
                {groupAvatarPreview ? (
                  <img src={groupAvatarPreview} alt="g" style={{width:"80px",height:"80px",borderRadius:"50%",objectFit:"cover",border:"3px solid #7c3aed"}} />
                ) : (
                  <div style={{width:"80px",height:"80px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2rem"}}>👥</div>
                )}
                <div style={{position:"absolute",bottom:0,right:0,width:"26px",height:"26px",borderRadius:"50%",background:"#7c3aed",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.75rem",border:"2px solid #1a1a2e"}}>📷</div>
              </div>
            </div>

            {/* Group Name */}
            <input
              value={groupName}
              onChange={e=>setGroupName(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&createGroup()}
              placeholder="Group name..."
              style={{width:"100%",background:"#13131a",border:"1px solid #2a2a3a",borderRadius:"12px",padding:"0.75rem 1rem",color:"white",fontSize:"1rem",outline:"none",boxSizing:"border-box",marginBottom:"1rem"}}
              autoFocus
            />

            {/* Font Picker */}
            <div style={{marginBottom:"1.25rem"}}>
              <div style={{color:"#888",fontSize:"0.78rem",marginBottom:"0.5rem"}}>Group Name Font</div>
              <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
                {FONTS.map(f=>(
                  <div key={f.value} onClick={()=>setGroupFont(f.value)} style={{padding:"0.3rem 0.75rem",borderRadius:"20px",background:groupFont===f.value?"linear-gradient(135deg,#7c3aed,#db2777)":"#2a2a3a",color:"white",fontSize:"0.82rem",cursor:"pointer",fontFamily:f.value}}>{f.label}</div>
                ))}
              </div>
            </div>

            <div style={{display:"flex",gap:"0.75rem"}}>
              <button onClick={createGroup} disabled={!groupName.trim()} style={{flex:1,background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"12px",color:"white",padding:"0.75rem",cursor:"pointer",fontWeight:"bold",fontSize:"1rem",opacity:!groupName.trim()?0.5:1}}>Create Group</button>
              <button onClick={()=>setShowCreate(false)} style={{background:"#2a2a3a",border:"none",borderRadius:"12px",color:"#888",padding:"0.75rem 1rem",cursor:"pointer"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
