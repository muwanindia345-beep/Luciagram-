import React, { useEffect, useState, useRef } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const THEME = "linear-gradient(135deg,#7c3aed,#db2777)";
const gradients = [
  "linear-gradient(135deg,#7c3aed,#db2777)",
  "linear-gradient(135deg,#f59e0b,#ef4444)",
  "linear-gradient(135deg,#10b981,#3b82f6)",
  "linear-gradient(135deg,#8b5cf6,#06b6d4)",
];
const EMOJIS = ["❤️","😂","😮","😢","😡","👍"];

function Avatar({ src, username, size=36 }) {
  if (src) return <img src={src} alt={username} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0}} />;
  return <div style={{width:size,height:size,borderRadius:"50%",background:gradients[(username||"U").charCodeAt(0)%4],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:size*0.38,color:"white",flexShrink:0}}>{(username||"U").slice(0,1).toUpperCase()}</div>;
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [groupAvatarBase64, setGroupAvatarBase64] = useState(null);
  const [groupAvatarPreview, setGroupAvatarPreview] = useState(null);
  const [searchUsers, setSearchUsers] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaBase64, setMediaBase64] = useState(null);
  const [longPressTarget, setLongPressTarget] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const bottomRef = useRef();
  const fileRef = useRef();
  const groupAvatarRef = useRef();
  const pollRef = useRef();
  const typingRef = useRef();
  const longPressTimer = useRef();

  useEffect(() => { loadGroups(); }, []);

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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const loadGroups = async () => {
    try { const res = await API.get("/groups"); setGroups(res.data); } catch {}
  };
  const loadMessages = async (groupId) => {
    try { const res = await API.get("/groups/" + groupId + "/messages"); setMessages(res.data); } catch {}
  };
  const loadTypers = async (groupId) => {
    try { const res = await API.get("/groups/" + groupId + "/typing"); setTypers(res.data.typers || []); } catch {}
  };
  const sendTyping = async () => {
    if (!activeGroup) return;
    try { await API.post("/groups/" + activeGroup.id + "/typing"); } catch {}
    clearTimeout(typingRef.current);
    typingRef.current = setTimeout(async () => {
      try { await API.post("/groups/" + activeGroup.id + "/typing/stop"); } catch {}
    }, 2000);
  };

  const createGroup = async () => {
    if (!groupName.trim()) return alert("Please enter a group name!");
    try {
      const res = await API.post("/groups", { name: groupName, avatarBase64: groupAvatarBase64 || null });
      setGroups(prev => [res.data, ...prev]);
      setGroupName(""); setGroupAvatarBase64(null); setGroupAvatarPreview(null);
      setShowCreate(false);
      openGroup(res.data);
    } catch(err) { alert(err?.response?.data?.message || "Failed to create group"); }
  };

  const openGroup = (group) => {
    setActiveGroup(group);
    setMessages([]);
    loadMessages(group.id);
  };

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
      let mediaUrl = "", mediaType = "";
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

  const reactToMessage = (msgId, emoji) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const reactions = { ...(m.reactions || {}) };
      reactions[emoji] = (reactions[emoji] || 0) + 1;
      return { ...m, reactions };
    }));
    setShowEmojiPicker(null);
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
    } catch(e) { alert(e?.response?.data?.message || "Cannot remove"); }
  };

  const toggleAdmin = async (memberId, isAdm) => {
    try {
      const res = isAdm
        ? await API.delete("/groups/" + activeGroup.id + "/admins/" + memberId)
        : await API.post("/groups/" + activeGroup.id + "/admins/" + memberId);
      setActiveGroup(res.data);
    } catch(e) { alert(e?.response?.data?.message || "Error"); }
  };

  const startLongPress = (memberId) => { longPressTimer.current = setTimeout(() => setLongPressTarget(memberId), 600); };
  const cancelLongPress = () => clearTimeout(longPressTimer.current);

  const isAdmin = activeGroup?.admins?.includes(user?.id);
  const isCreator = activeGroup?.createdById === user?.id;

  // ---- CHAT VIEW ----
  if (activeGroup) return (
    <div style={{background:"#0a0a0f",height:"100vh",color:"white",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}`}</style>
      <input ref={fileRef} type="file" accept="image/*,video/*" style={{display:"none"}} onChange={handleMediaChange} />

      {/* Header */}
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.6rem 1rem",display:"flex",alignItems:"center",gap:"0.75rem",flexShrink:0}}>
        <span onClick={()=>{setActiveGroup(null);clearInterval(pollRef.current);}} style={{cursor:"pointer",fontSize:"1.5rem"}}>←</span>
        <div onClick={()=>setShowInfo(true)} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:"0.6rem",flex:1}}>
          <div style={{position:"relative"}}>
            <Avatar src={activeGroup.avatar} username={activeGroup.name} size={42} />
            <div style={{position:"absolute",bottom:1,right:1,width:10,height:10,borderRadius:"50%",background:"#22c55e",border:"2px solid #0a0a0f"}} />
          </div>
          <div>
            <div style={{fontWeight:"bold",fontSize:"0.95rem"}}>{activeGroup.name}</div>
            <div style={{fontSize:"0.72rem",color:typers.length>0?"#c084fc":"#888"}}>
              {typers.length>0 ? typers.map(t=>t.username).join(", ")+" typing..." : activeGroup.members?.length+" members"}
            </div>
          </div>
        </div>
        <span style={{fontSize:"1.3rem",cursor:"pointer"}}>📞</span>
        <span style={{fontSize:"1.3rem",cursor:"pointer"}}>🎥</span>
        <span onClick={()=>setShowInfo(true)} style={{fontSize:"1.3rem",cursor:"pointer"}}>ℹ️</span>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"0.75rem 1rem",display:"flex",flexDirection:"column",gap:"0.75rem",background:"#0a0a0f"}}>
        <div style={{textAlign:"center",color:"#555",fontSize:"0.72rem",padding:"0.5rem",background:"#13131a",borderRadius:"8px"}}>
          🔒 Group created by @{activeGroup.createdBy}
        </div>

        {messages.map((m,i) => {
          const isMe = m.senderId === user?.id;
          const member = activeGroup.members?.find(mb=>mb.id===m.senderId);
          const showAvatar = !isMe && (i===0 || messages[i-1]?.senderId!==m.senderId);
          const showName = !isMe && (i===0 || messages[i-1]?.senderId!==m.senderId);
          return (
            <div key={m.id||i}>
              {showName && <div style={{fontSize:"0.72rem",color:"#c084fc",marginLeft:"44px",marginBottom:"2px"}}>@{m.senderUsername}</div>}
              <div style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start",alignItems:"flex-end",gap:"0.4rem"}}>
                {!isMe && (
                  <div style={{width:32,flexShrink:0}}>
                    {showAvatar && <Avatar src={member?.avatar||m.senderAvatar} username={m.senderUsername} size={32} />}
                  </div>
                )}
                <div style={{maxWidth:"72%",position:"relative"}}>
                  {m.mediaUrl && (
                    <div style={{borderRadius:"18px",overflow:"hidden",marginBottom:"0.2rem"}}>
                      {m.mediaType==="video"
                        ? <video src={m.mediaUrl} controls playsInline style={{width:"100%",maxWidth:"260px",borderRadius:"18px",maxHeight:"280px",display:"block"}} />
                        : <img src={m.mediaUrl} alt="media" style={{width:"100%",maxWidth:"260px",borderRadius:"18px",maxHeight:"280px",objectFit:"cover",display:"block"}} />
                      }
                    </div>
                  )}
                  {m.text && (
                    <div
                      onDoubleClick={()=>setShowEmojiPicker(showEmojiPicker===m.id?null:m.id)}
                      style={{background:isMe?THEME:"#1e1e2e",padding:"0.6rem 0.9rem",borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px",fontSize:"0.95rem",wordBreak:"break-word",lineHeight:1.4,display:"inline-block"}}
                    >
                      {m.text}
                    </div>
                  )}
                  {m.reactions && Object.keys(m.reactions).length>0 && (
                    <div style={{display:"flex",gap:"3px",marginTop:"3px",flexWrap:"wrap",justifyContent:isMe?"flex-end":"flex-start"}}>
                      {Object.entries(m.reactions).map(([emoji,count])=>(
                        <span key={emoji} onClick={()=>reactToMessage(m.id,emoji)} style={{background:"#1e1e2e",border:"1px solid #2a2a3a",borderRadius:"20px",padding:"1px 7px",fontSize:"0.8rem",cursor:"pointer"}}>
                          {emoji} {count}
                        </span>
                      ))}
                    </div>
                  )}
                  {showEmojiPicker===m.id && (
                    <div style={{position:"absolute",bottom:"100%",[isMe?"right":"left"]:0,background:"#13131a",borderRadius:"30px",padding:"6px 10px",display:"flex",gap:"8px",boxShadow:"0 2px 12px rgba(0,0,0,0.5)",zIndex:50,marginBottom:"4px",border:"1px solid #2a2a3a"}}>
                      {EMOJIS.map(e=>(
                        <span key={e} onClick={()=>reactToMessage(m.id,e)} style={{fontSize:"1.3rem",cursor:"pointer"}}>{e}</span>
                      ))}
                    </div>
                  )}
                  <div style={{fontSize:"0.65rem",color:"#555",marginTop:"2px",textAlign:isMe?"right":"left"}}>
                    {new Date(m.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {typers.length>0 && (
          <div style={{display:"flex",alignItems:"center",gap:"0.4rem"}}>
            <div style={{display:"flex"}}>{typers.slice(0,2).map((t,i)=><Avatar key={i} src={t.avatar} username={t.username} size={24} />)}</div>
            <div style={{background:"#1e1e2e",borderRadius:"18px",padding:"0.5rem 0.85rem",display:"flex",gap:"3px",alignItems:"center"}}>
              {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#888",animation:`bounce 1s ${i*0.2}s infinite`}} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {mediaPreview && (
        <div style={{padding:"0.5rem 1rem",background:"#13131a",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.75rem",flexShrink:0}}>
          {mediaFile?.type?.startsWith("video")
            ? <video src={mediaPreview} style={{height:60,borderRadius:8}} />
            : <img src={mediaPreview} alt="preview" style={{height:60,borderRadius:8,objectFit:"cover"}} />
          }
          <span style={{color:"#888",fontSize:"0.82rem",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{mediaFile?.name}</span>
          <span onClick={()=>{setMediaFile(null);setMediaPreview(null);setMediaBase64(null);}} style={{color:"#f87171",cursor:"pointer",fontSize:"1.2rem"}}>✕</span>
        </div>
      )}

      {/* Input */}
      <div style={{padding:"0.6rem 0.75rem",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.6rem",background:"#0a0a0f",flexShrink:0}}>
        <span onClick={()=>fileRef.current?.click()} style={{fontSize:"1.4rem",cursor:"pointer"}}>📎</span>
        <div style={{flex:1,background:"#1e1e2e",borderRadius:"22px",padding:"0.5rem 1rem",display:"flex",alignItems:"center",gap:"0.5rem"}}>
          <input
            value={text}
            onChange={e=>{setText(e.target.value);sendTyping();}}
            onKeyDown={e=>e.key==="Enter"&&sendMessage()}
            placeholder="Message..."
            style={{flex:1,background:"transparent",border:"none",color:"white",fontSize:"0.95rem",outline:"none"}}
          />
          <span style={{fontSize:"1.1rem",cursor:"pointer"}}>😊</span>
        </div>
        {(text||mediaBase64)
          ? <button onClick={sendMessage} disabled={sending} style={{background:THEME,border:"none",borderRadius:"50%",width:"36px",height:"36px",color:"white",cursor:"pointer",fontSize:"1rem",flexShrink:0}}>➤</button>
          : <span style={{fontSize:"1.4rem",cursor:"pointer"}}>❤️</span>
        }
      </div>

      {/* Group Info Sheet */}
      {showInfo && (
        <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>{setShowInfo(false);setLongPressTarget(null);}} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
          <div style={{background:"#13131a",borderRadius:"20px 20px 0 0",maxHeight:"85vh",display:"flex",flexDirection:"column",overflow:"hidden",border:"1px solid #1e1e2e"}}>
            <div style={{padding:"1rem",borderBottom:"1px solid #1e1e2e",flexShrink:0,textAlign:"center"}}>
              <div style={{width:40,height:4,background:"#2a2a3a",borderRadius:2,margin:"0 auto 1rem"}} />
              <Avatar src={activeGroup.avatar} username={activeGroup.name} size={72} />
              <div style={{fontWeight:"bold",fontSize:"1.1rem",marginTop:"0.5rem"}}>{activeGroup.name}</div>
              <div style={{color:"#888",fontSize:"0.82rem"}}>Created by @{activeGroup.createdBy} · {activeGroup.members?.length} members</div>
              <button onClick={()=>{setShowInfo(false);setShowAddMember(true);}} style={{marginTop:"0.75rem",background:THEME,border:"none",borderRadius:"8px",padding:"0.4rem 1rem",cursor:"pointer",fontWeight:"bold",fontSize:"0.85rem",color:"white"}}>➕ Add Members</button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"0.75rem 1rem"}}>
              <div style={{color:"#888",fontSize:"0.75rem",fontWeight:"bold",marginBottom:"0.75rem"}}>MEMBERS — hold to manage</div>
              {activeGroup.members?.map((m,i)=>{
                const isMemberAdmin = activeGroup.admins?.includes(m.id);
                const isMemberCreator = m.id===activeGroup.createdById;
                const isLongPressed = longPressTarget===m.id;
                return (
                  <div key={m.id||i}
                    onMouseDown={()=>startLongPress(m.id)} onMouseUp={cancelLongPress}
                    onTouchStart={()=>startLongPress(m.id)} onTouchEnd={cancelLongPress}
                    style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.6rem",borderBottom:"1px solid #1e1e2e",background:isLongPressed?"#1a0a2e":"transparent",borderRadius:8,transition:"background 0.2s"}}>
                    <Avatar src={m.avatar} username={m.username} size={44} />
                    <div style={{flex:1}}>
                      <div style={{fontWeight:"bold",fontSize:"0.9rem"}}>@{m.username}</div>
                      <div style={{fontSize:"0.72rem",color:isMemberCreator?"#f59e0b":isMemberAdmin?"#c084fc":"#888"}}>
                        {isMemberCreator?"👑 Creator":isMemberAdmin?"⚡ Admin":"Member"}
                      </div>
                    </div>
                    {isLongPressed && !isMemberCreator && m.id!==user?.id && (
                      <div style={{display:"flex",gap:"0.4rem"}}>
                        {isCreator && (
                          <button onClick={()=>{toggleAdmin(m.id,isMemberAdmin);setLongPressTarget(null);}}
                            style={{background:isMemberAdmin?"#1e1e2e":THEME,border:"none",borderRadius:"6px",color:"white",padding:"0.25rem 0.6rem",fontSize:"0.72rem",cursor:"pointer"}}>
                            {isMemberAdmin?"-Admin":"+Admin"}
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={()=>{removeMember(m.id);setLongPressTarget(null);}}
                            style={{background:"#2a0a0a",border:"none",borderRadius:"6px",color:"#f87171",padding:"0.25rem 0.6rem",fontSize:"0.72rem",cursor:"pointer"}}>
                            Remove
                          </button>
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
          <div style={{background:"#13131a",borderRadius:"20px 20px 0 0",maxHeight:"70vh",display:"flex",flexDirection:"column",border:"1px solid #1e1e2e"}}>
            <div style={{background:"#13131a",borderRadius:"20px 20px 0 0",padding:"1.5rem 1rem",border:"1px solid #1e1e2e"}}>
            <div style={{width:40,height:4,background:"#2a2a3a",borderRadius:2,margin:"0 auto 1.5rem"}} />
            <div style={{fontWeight:"bold",fontSize:"1.1rem",textAlign:"center",marginBottom:"1.25rem"}}>New Group</div>
            <div style={{display:"flex",justifyContent:"center",marginBottom:"1.25rem"}}>
              <div onClick={()=>groupAvatarRef.current?.click()} style={{position:"relative",cursor:"pointer"}}>
                {groupAvatarPreview
                  ? <img src={groupAvatarPreview} alt="g" style={{width:80,height:80,borderRadius:"50%",objectFit:"cover",border:"3px solid #7c3aed"}} />
                  : <div style={{width:80,height:80,borderRadius:"50%",background:"#1e1e2e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2rem",border:"2px dashed #7c3aed"}}>👥</div>
                }
                <div style={{position:"absolute",bottom:0,right:0,width:26,height:26,borderRadius:"50%",background:THEME,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.75rem",border:"2px solid #13131a"}}>📷</div>
              </div>
            </div>
            <input
              value={groupName}
              onChange={e=>setGroupName(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&createGroup()}
              placeholder="Group name..."
              style={{width:"100%",background:"#1e1e2e",border:"1px solid #2a2a3a",borderRadius:"12px",padding:"0.75rem 1rem",color:"white",fontSize:"1rem",outline:"none",boxSizing:"border-box",marginBottom:"1rem"}}
              autoFocus
            />
            <div style={{display:"flex",gap:"0.75rem"}}>
              <button onClick={createGroup} disabled={!groupName.trim()} style={{flex:1,background:THEME,border:"none",borderRadius:"12px",color:"white",padding:"0.75rem",cursor:"pointer",fontWeight:"bold",fontSize:"1rem",opacity:!groupName.trim()?0.5:1}}>
                Create Group
              </button>
              <button onClick={()=>setShowCreate(false)} style={{background:"#1e1e2e",border:"1px solid #2a2a3a",borderRadius:"12px",color:"#888",padding:"0.75rem 1rem",cursor:"pointer"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
