import React, { useEffect, useState, useRef } from "react";
import API from "../api";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";

const SOCKET_URL = "https://luciagram-backend.onrender.com";

const THEMES = [
  { id: "cosmic", name: "Cosmic", emoji: "🌌", mine: "linear-gradient(135deg,#7c3aed,#db2777)", bg: "#0a0a0f", bubble: "#1e1e2e" },
  { id: "ocean", name: "Ocean", emoji: "🌊", mine: "linear-gradient(135deg,#0ea5e9,#6366f1)", bg: "#050d1a", bubble: "#0f172a" },
  { id: "forest", name: "Forest", emoji: "🌿", mine: "linear-gradient(135deg,#10b981,#059669)", bg: "#050f0a", bubble: "#0d1f17" },
  { id: "sunset", name: "Sunset", emoji: "🌅", mine: "linear-gradient(135deg,#f59e0b,#ef4444)", bg: "#0f0a05", bubble: "#1f1207" },
  { id: "cherry", name: "Cherry", emoji: "🍒", mine: "linear-gradient(135deg,#f43f5e,#ec4899)", bg: "#0f0508", bubble: "#1f0d14" },
  { id: "midnight", name: "Midnight", emoji: "🌙", mine: "linear-gradient(135deg,#6366f1,#8b5cf6)", bg: "#07070f", bubble: "#111128" },
];

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function MessageText({ text }) {
  const parts = text.split(URL_REGEX);
  return (
    <span>
      {parts.map((part, i) =>
        URL_REGEX.test(part)
          ? <a key={i} href={part} target="_blank" rel="noopener noreferrer"
              style={{color:"#a78bfa",textDecoration:"underline",wordBreak:"break-all"}}>{part}</a>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

export default function GroupChatRoom() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [typers, setTypers] = useState([]);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaData, setMediaData] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState([]);
  const [addStatus, setAddStatus] = useState({});
  const [toast, setToast] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [reactionPicker, setReactionPicker] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [swipeX, setSwipeX] = useState({});
  const doubleTapRef = useRef({});
  const [pressTimer, setPressTimer] = useState(null);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [showEmojiInput, setShowEmojiInput] = useState(false);
  const [customEmoji, setCustomEmoji] = useState("");
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [groupFont, setGroupFont] = useState(() => localStorage.getItem("lg_font_" + groupId) || "default");
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("lg_theme_" + groupId);
    return THEMES.find(t => t.id === saved) || THEMES[0];
  });
  const { user } = useAuth();
  const navigate = useNavigate();
  const bottomRef = useRef();
  const fileRef = useRef();
  const socketRef = useRef(null);
  const typingTimerRef = useRef(null);

  const isAdmin = group?.admins?.includes(user?.id);
  const isCreator = group?.createdById === user?.id;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    loadGroup();
    loadMessages();
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socket.on("connect", () => {
      socket.emit("join", user?.id);
      socket.emit("join_group", groupId);
    });
    socket.on("group_message", (msg) => {
      if (msg.groupId === groupId)
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
    });
    socket.on("group_unsend", (data) => {
      setMessages(prev => prev.filter(m => m.id !== data.msgId));
    });
    socket.on("group_reaction", (data) => {
      setMessages(prev => prev.map(m => m.id === data.msgId ? { ...m, reactions: data.reactions } : m));
    });
    socket.on("group_typing", (data) => {
      if (data.groupId === groupId && data.senderId !== user?.id) {
        setTypers(prev => prev.find(t => t.senderId === data.senderId) ? prev : [...prev, data]);
        setTimeout(() => setTypers(prev => prev.filter(t => t.senderId !== data.senderId)), 3000);
      }
    });
    socket.on("group_stop_typing", (data) => {
      if (data.groupId === groupId)
        setTypers(prev => prev.filter(t => t.senderId !== data.senderId));
    });
    socketRef.current = socket;
    return () => socket.disconnect();
  }, [groupId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const loadGroup = async () => {
    try { const r = await API.get("/groups"); setGroup(r.data.find(g => g.id === groupId) || null); } catch {}
  };

  const loadMessages = async () => {
    try { const r = await API.get("/groups/" + groupId + "/messages"); setMessages(r.data); } catch {}
  };

  const loadPending = async () => {
    try { const r = await API.get("/groups/" + groupId + "/pending"); setPendingMembers(r.data); } catch {}
  };

  const handleTyping = () => {
    socketRef.current?.emit("group_typing", { groupId, senderId: user?.id, senderUsername: user?.username, senderAvatar: user?.avatar || "" });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => socketRef.current?.emit("group_stop_typing", { groupId, senderId: user?.id }), 2000);
  };

  const handleMedia = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const isVideo = file.type.startsWith("video/");
    setMediaType(isVideo ? "video" : "image");
    const reader = new FileReader();
    reader.onloadend = () => { setMediaPreview(reader.result); setMediaData(reader.result); };
    reader.readAsDataURL(file);
  };

  const sendMessage = async () => {
    if ((!text.trim() && !mediaData) || sending) return;
    setSending(true);
    try {
      let mediaUrl = "";
      if (mediaData) {
        const r = await API.post("/groups/upload", { mediaBase64: mediaData, mediaType });
        mediaUrl = r.data.url;
      }
      const r = await API.post("/groups/" + groupId + "/messages", {
        text: text.trim(), mediaUrl, mediaType: mediaType || "",
        replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderUsername: replyTo.senderUsername, mediaType: replyTo.mediaType } : null,
      });
      setMessages(prev => [...prev, r.data]);
      socketRef.current?.emit("group_message", r.data);
      setText(""); setMediaPreview(null); setMediaData(null); setMediaType(null); setReplyTo(null);
    } catch {}
    setSending(false);
  };

  const searchMembers = async (q) => {
    setMemberSearch(q);
    if (q.length < 2) return setMemberResults([]);
    try {
      const r = await API.get("/users/search?q=" + q);
      setMemberResults(r.data.filter(u => u.id !== user?.id && !group?.members?.find(m => m.id === u.id)));
    } catch {}
  };

  const addMember = async (u) => {
    setAddStatus(prev => ({ ...prev, [u.id]: "checking" }));
    try {
      if (u.isPrivate) {
        const r = await API.get("/users/" + u.id + "/followers");
        if (!r.data.isFollowing) {
          setAddStatus(prev => ({ ...prev, [u.id]: "blocked" }));
          showToast("@" + u.username + " is private — follow first");
          return;
        }
      }
      if (group?.requireApproval) {
        await API.post("/groups/" + groupId + "/members", { userId: u.id, username: u.username, avatar: u.avatar || "", pending: true });
        setAddStatus(prev => ({ ...prev, [u.id]: "pending" }));
        showToast("@" + u.username + " added to pending ⏳");
      } else {
        await API.post("/groups/" + groupId + "/members", { userId: u.id, username: u.username, avatar: u.avatar || "" });
        setAddStatus(prev => ({ ...prev, [u.id]: "added" }));
        showToast("@" + u.username + " added ✅");
      }
      await loadGroup();
    } catch {
      setAddStatus(prev => ({ ...prev, [u.id]: "error" }));
    }
  };

  const removeMember = async (memberId) => {
    if (!window.confirm("Remove this member?")) return;
    try {
      await API.delete("/groups/" + groupId + "/members/" + memberId);
      showToast("Member removed");
      await loadGroup();
    } catch (e) { showToast(e?.response?.data?.message || "Error"); }
  };

  const toggleAdmin = async (memberId, isCurrentlyAdmin) => {
    try {
      if (isCurrentlyAdmin) {
        await API.delete("/groups/" + groupId + "/admins/" + memberId);
        showToast("Admin removed");
      } else {
        await API.post("/groups/" + groupId + "/admins/" + memberId);
        showToast("Admin granted ✅");
      }
      await loadGroup();
    } catch (e) { showToast(e?.response?.data?.message || "Error"); }
  };

  const toggleApproval = async () => {
    try {
      const r = await API.patch("/groups/" + groupId + "/approval");
      showToast("Approval " + (r.data.requireApproval ? "ON 🔐" : "OFF 🔓"));
      await loadGroup();
    } catch {}
  };

  const deleteGroup = async () => {
    if (!window.confirm("Delete this group? This cannot be undone.")) return;
    try {
      await API.delete("/groups/" + groupId);
      navigate("/groupchat");
    } catch (e) { showToast(e?.response?.data?.message || "Error"); }
  };

  const approvePending = async (memberId) => {
    try {
      await API.post("/groups/" + groupId + "/pending/" + memberId + "/approve");
      showToast("Member approved ✅");
      await loadPending();
      await loadGroup();
    } catch {}
  };

  const rejectPending = async (memberId) => {
    try {
      await API.post("/groups/" + groupId + "/pending/" + memberId + "/reject");
      showToast("Member rejected");
      await loadPending();
    } catch {}
  };

  const applyTheme = (t) => {
    setTheme(t);
    localStorage.setItem("lg_theme_" + groupId, t.id);
    setShowTheme(false);
  };

  const handleDoubleTap = (msg) => {
    const now = Date.now();
    const last = doubleTapRef.current[msg.id] || 0;
    if (now - last < 350) {
      setReactionPicker(msg.id);
    }
    doubleTapRef.current[msg.id] = now;
  };

  const sendReaction = async (msgId, emoji) => {
    setReactionPicker(null);
    try {
      const r = await API.post("/groups/" + groupId + "/messages/" + msgId + "/react", { emoji });
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions: r.data.reactions } : m));
      socketRef.current?.emit("group_reaction", { groupId, msgId, reactions: r.data.reactions });
    } catch {}
  };

  const handleTouchStart = (e, msgId) => {
    setSwipeX(prev => ({ ...prev, [msgId]: e.touches[0].clientX }));
  };

  const handleTouchEnd = (e, msg) => {
    const startX = swipeX[msg.id];
    if (!startX) return;
    const diff = e.changedTouches[0].clientX - startX;
    const mine = msg.senderId === user?.id;
    if (mine && diff < -60) setReplyTo(msg);
    if (!mine && diff > 60) setReplyTo(msg);
    setSwipeX(prev => ({ ...prev, [msg.id]: null }));
  };

  const groupReactions = (reactions = []) => {
    const map = {};
    reactions.forEach(r => { map[r.emoji] = (map[r.emoji] || 0) + 1; });
    return Object.entries(map);
  };

  const FONTS = [
    { id: "default", name: "Default", style: "inherit" },
    { id: "mono", name: "Mono", style: "monospace" },
    { id: "serif", name: "Serif", style: "Georgia, serif" },
    { id: "rounded", name: "Rounded", style: "'Trebuchet MS', sans-serif" },
    { id: "cursive", name: "Cursive", style: "cursive" },
    { id: "fantasy", name: "Fantasy", style: "fantasy" },
  ];

  const currentFont = FONTS.find(f => f.id === groupFont)?.style || "inherit";

  const applyFont = (fontId) => {
    setGroupFont(fontId);
    localStorage.setItem("lg_font_" + groupId, fontId);
    setShowFontPicker(false);
  };

  const handleLongPress = (msg) => {
    if (msg.senderId !== user?.id) return;
    setSelectedMsg(msg);
  };

  const handlePressStart = (msg) => {
    const t = setTimeout(() => handleLongPress(msg), 500);
    setPressTimer(t);
  };

  const handlePressEnd = () => {
    clearTimeout(pressTimer);
  };

  const unsendMessage = async (msgId) => {
    setSelectedMsg(null);
    try {
      await API.delete("/groups/" + groupId + "/messages/" + msgId);
      setMessages(prev => prev.filter(m => m.id !== msgId));
      socketRef.current?.emit("group_unsend", { groupId, msgId });
    } catch {}
  };

  const sendCustomReaction = async () => {
    if (!customEmoji.trim()) return;
    await sendReaction(reactionPicker, customEmoji.trim());
    setCustomEmoji("");
    setShowEmojiInput(false);
  };

  const av = (n) => (n || "U").slice(0, 1).toUpperCase();
  const grads = ["linear-gradient(135deg,#7c3aed,#db2777)","linear-gradient(135deg,#f59e0b,#ef4444)","linear-gradient(135deg,#10b981,#3b82f6)","linear-gradient(135deg,#8b5cf6,#06b6d4)"];

  return (
    <div style={{background:theme.bg,height:"100vh",color:"white",display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {toast && (
        <div style={{position:"fixed",top:"1rem",left:"50%",transform:"translateX(-50%)",background:"#1e1e2e",border:"1px solid #7c3aed",borderRadius:"20px",padding:"0.5rem 1.25rem",fontSize:"0.85rem",zIndex:999,whiteSpace:"nowrap"}}>
          {toast}
        </div>
      )}

      {avatarPreview && (
        <div onClick={()=>setAvatarPreview(null)} style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <img src={avatarPreview} alt="preview" style={{width:"80vw",height:"80vw",borderRadius:"50%",objectFit:"cover",border:"3px solid #7c3aed"}} />
        </div>
      )}
<div style={{background:theme.bg,borderBottom:"1px solid #1e1e2e",padding:"0.6rem 1rem",display:"flex",alignItems:"center",gap:"0.75rem",flexShrink:0}}>
        <span onClick={()=>navigate("/groupchat")} style={{cursor:"pointer",fontSize:"1.3rem",flexShrink:0}}>←</span>
        <div onClick={()=>group?.avatar && setAvatarPreview(group.avatar)} style={{cursor:group?.avatar?"pointer":"default",flexShrink:0}}>
          {group?.avatar
            ? <img src={group.avatar} alt={group?.name} style={{width:"40px",height:"40px",borderRadius:"50%",objectFit:"cover",border:"2px solid #7c3aed"}} />
            : <div style={{width:"40px",height:"40px",borderRadius:"50%",background:theme.mine,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:"1rem"}}>{av(group?.name)}</div>
          }
        </div>
        <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>setShowInfo(true)}>
          <div style={{fontWeight:"bold",fontSize:"1rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:currentFont}}>{group?.name || "Group"}</div>
          <div style={{fontSize:"0.7rem"}}>
            {typers.length > 0
              ? <span style={{color:"#a78bfa"}}>{typers.map(t=>t.senderUsername).join(", ")} typing...</span>
              : <span style={{color:"#888"}}>{group?.members?.length || 0} members</span>}
          </div>
        </div>
        <span onClick={()=>setShowFontPicker(true)} style={{fontSize:"1.2rem",cursor:"pointer"}}>🔤</span>
        <span onClick={()=>setShowTheme(true)} style={{fontSize:"1.2rem",cursor:"pointer"}}>🎨</span>
        <span onClick={()=>setShowInfo(true)} style={{fontSize:"1.2rem",cursor:"pointer"}}>ℹ️</span>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"0.75rem 1rem",display:"flex",flexDirection:"column",gap:"0.3rem"}}>
        {messages.map((m, i) => {
          const mine = m.senderId === user?.id;
          const prev = messages[i-1];
          const showAv = !mine && (!prev || prev.senderId !== m.senderId);
          return (
            <div key={m.id||i}>
              {!mine && showAv && (
                <div style={{fontSize:"0.72rem",color:"#a78bfa",marginLeft:"38px",marginBottom:"2px",marginTop:"6px",cursor:"pointer"}}
                  onClick={()=>navigate("/user/"+m.senderUsername)}>
                  @{m.senderUsername}
                </div>
              )}
              <div
                onTouchStart={e=>{handleTouchStart(e,m.id);handlePressStart(m);}}
                onTouchEnd={e=>{handleTouchEnd(e,m);handlePressEnd();}}
                onClick={()=>handleDoubleTap(m)}
                style={{display:"flex",justifyContent:mine?"flex-end":"flex-start",alignItems:"flex-end",gap:"0.35rem"}}>
                {!mine && (
                  <div style={{width:"28px",height:"28px",flexShrink:0}}>
                    {showAv && (
                      <div onClick={()=>navigate("/user/"+m.senderUsername)} style={{cursor:"pointer"}}>
                        {m.senderAvatar
                          ? <img src={m.senderAvatar} alt={m.senderUsername} style={{width:"28px",height:"28px",borderRadius:"50%",objectFit:"cover"}} />
                          : <div style={{width:"28px",height:"28px",borderRadius:"50%",background:grads[(m.senderUsername||"").charCodeAt(0)%4],display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",fontWeight:"bold"}}>{av(m.senderUsername)}</div>
                        }
                      </div>
                    )}
                  </div>
                )}
                <div style={{maxWidth:"72%"}}>
                  {m.mediaUrl && (
                    <div style={{borderRadius:"12px",overflow:"hidden",marginBottom:"0.2rem"}}>
                      {m.mediaType==="video"
                        ? <video src={m.mediaUrl} controls playsInline style={{width:"100%",maxWidth:"260px",maxHeight:"300px",borderRadius:"12px",background:"#000"}} />
                        : <img src={m.mediaUrl} alt="media" style={{width:"100%",maxWidth:"260px",maxHeight:"300px",objectFit:"cover",borderRadius:"12px"}} />
                      }
                    </div>
                  )}
                  {m.text && (
                    <div style={{background:mine?theme.mine:theme.bubble,padding:"0.55rem 0.9rem",borderRadius:mine?"18px 18px 4px 18px":"18px 18px 18px 4px",fontSize:"0.95rem",wordBreak:"break-word",lineHeight:1.4,fontFamily:currentFont}}>
                      <MessageText text={m.text} />
                    </div>
                  )}
                  {m.replyTo && (
                    <div style={{background:"rgba(255,255,255,0.05)",borderLeft:"3px solid #7c3aed",borderRadius:"8px",padding:"0.3rem 0.6rem",marginBottom:"0.25rem",fontSize:"0.75rem",color:"#888"}}>
                      <span style={{color:"#a78bfa"}}>@{m.replyTo.senderUsername}</span>
                      <div style={{marginTop:"2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"200px"}}>
                        {m.replyTo.mediaType ? "📎 Media" : m.replyTo.text}
                      </div>
                    </div>
                  )}
                  {m.reactions?.length > 0 && (
                    <div style={{display:"flex",flexWrap:"wrap",gap:"3px",marginTop:"4px",justifyContent:mine?"flex-end":"flex-start"}}>
                      {groupReactions(m.reactions).map(([emoji, count]) => (
                        <span key={emoji} onClick={()=>sendReaction(m.id,emoji)}
                          style={{background:"rgba(255,255,255,0.08)",borderRadius:"20px",padding:"2px 7px",fontSize:"0.78rem",cursor:"pointer"}}>
                          {emoji} {count}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{fontSize:"0.68rem",color:"#555",marginTop:"2px",textAlign:mine?"right":"left"}}>
                    {new Date(m.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {mediaPreview && (
        <div style={{padding:"0.5rem 1rem",background:"#13131a",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.75rem"}}>
          {mediaType==="video"
            ? <video src={mediaPreview} style={{width:"60px",height:"60px",objectFit:"cover",borderRadius:"8px"}} />
            : <img src={mediaPreview} alt="prev" style={{width:"60px",height:"60px",objectFit:"cover",borderRadius:"8px"}} />}
          <div style={{flex:1,fontSize:"0.85rem",color:"#888"}}>{mediaType==="video"?"🎬 Video ready":"📸 Photo ready"}</div>
          <span onClick={()=>{setMediaPreview(null);setMediaData(null);}} style={{color:"#f87171",cursor:"pointer",fontSize:"1.2rem"}}>✕</span>
        </div>
      )}

      {replyTo && (
        <div style={{padding:"0.5rem 1rem",background:"#13131a",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.75rem"}}>
          <div style={{flex:1,borderLeft:"3px solid #7c3aed",paddingLeft:"0.5rem"}}>
            <div style={{fontSize:"0.72rem",color:"#a78bfa"}}>@{replyTo.senderUsername}</div>
            <div style={{fontSize:"0.82rem",color:"#888",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"240px"}}>
              {replyTo.mediaType ? "📎 Media" : replyTo.text}
            </div>
          </div>
          <span onClick={()=>setReplyTo(null)} style={{color:"#f87171",cursor:"pointer",fontSize:"1.2rem"}}>✕</span>
        </div>
      )}
      <div style={{padding:"0.6rem 0.75rem",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.5rem",background:theme.bg,flexShrink:0}}>
        <span style={{fontSize:"1.3rem",cursor:"pointer"}}>😊</span>
        <input value={text} onChange={e=>{setText(e.target.value);handleTyping();}} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage()}
          placeholder="Message..." style={{flex:1,background:theme.bubble,border:"none",borderRadius:"20px",padding:"0.55rem 0.9rem",color:"white",fontSize:"0.95rem",outline:"none",minWidth:0}} />
        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleMedia} style={{display:"none"}} />
        <span onClick={()=>fileRef.current?.click()} style={{fontSize:"1.3rem",cursor:"pointer"}}>📎</span>
        {(text||mediaData)
          ? <button onClick={sendMessage} disabled={sending} style={{background:theme.mine,border:"none",borderRadius:"50%",width:"36px",height:"36px",color:"white",cursor:"pointer",fontSize:"1rem",flexShrink:0}}>➤</button>
          : <span style={{fontSize:"1.3rem",cursor:"pointer"}}>❤️</span>}
      </div>

      {selectedMsg && (
        <div onClick={()=>setSelectedMsg(null)} style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#1e1e2e",borderRadius:"16px",padding:"1rem",minWidth:"200px",boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
            <div style={{fontSize:"0.75rem",color:"#888",marginBottom:"0.75rem",textOverflow:"ellipsis",overflow:"hidden",whiteSpace:"nowrap"}}>
              {selectedMsg.text || "Media message"}
            </div>
            <button onClick={()=>unsendMessage(selectedMsg.id)}
              style={{width:"100%",background:"transparent",border:"1px solid #ef4444",borderRadius:"10px",color:"#ef4444",padding:"0.6rem",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem"}}>
              🗑 Unsend Message
            </button>
          </div>
        </div>
      )}
      {reactionPicker && (
        <div onClick={()=>setReactionPicker(null)} style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#1e1e2e",borderRadius:"30px",padding:"0.6rem 1rem",display:"flex",gap:"0.5rem",boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
            {["❤️","😂","😮","😢","😡","👍"].map(emoji => (
              <span key={emoji} onClick={()=>sendReaction(reactionPicker,emoji)}
                style={{fontSize:"1.6rem",cursor:"pointer",padding:"0.2rem"}}>
                {emoji}
              </span>
            ))}
            <span onClick={()=>setShowEmojiInput(true)}
              style={{fontSize:"1.4rem",cursor:"pointer",padding:"0.2rem",color:"#a78bfa",fontWeight:"bold"}}>+</span>
          </div>
          {showEmojiInput && (
            <div style={{marginTop:"0.5rem",display:"flex",gap:"0.5rem",alignItems:"center"}}>
              <input value={customEmoji} onChange={e=>setCustomEmoji(e.target.value)} placeholder="Any emoji..."
                style={{background:"#2a2a3a",border:"none",borderRadius:"12px",padding:"0.4rem 0.75rem",color:"white",fontSize:"1rem",outline:"none",width:"120px"}} />
              <button onClick={sendCustomReaction}
                style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"12px",padding:"0.4rem 0.75rem",color:"white",cursor:"pointer",fontSize:"0.85rem"}}>Send</button>
            </div>
          )}
        </div>
      )}
      {showFontPicker && (
        <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowFontPicker(false)} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
          <div style={{background:"#13131a",borderRadius:"20px 20px 0 0",padding:"1.25rem 1rem"}}>
            <div style={{width:"40px",height:"4px",background:"#333",borderRadius:"2px",margin:"0 auto 1rem"}} />
            <div style={{fontWeight:"bold",fontSize:"1rem",marginBottom:"1rem"}}>🔤 Chat Font</div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
              {FONTS.map(f => (
                <div key={f.id} onClick={()=>applyFont(f.id)}
                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#1e1e2e",borderRadius:"12px",padding:"0.75rem 1rem",cursor:"pointer",border:groupFont===f.id?"1px solid #7c3aed":"1px solid transparent"}}>
                  <span style={{fontFamily:f.style,fontSize:"1rem"}}>{group?.name || "Group Chat"}</span>
                  <span style={{fontSize:"0.75rem",color:groupFont===f.id?"#a78bfa":"#555"}}>{f.name} {groupFont===f.id?"✓":""}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showTheme && (
        <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowTheme(false)} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
          <div style={{background:"#13131a",borderRadius:"20px 20px 0 0",padding:"1.25rem 1rem"}}>
            <div style={{width:"40px",height:"4px",background:"#333",borderRadius:"2px",margin:"0 auto 1rem"}} />
            <div style={{fontWeight:"bold",fontSize:"1rem",marginBottom:"1rem"}}>🎨 Chat Theme</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"0.75rem"}}>
              {THEMES.map(t => (
                <div key={t.id} onClick={()=>applyTheme(t)} style={{borderRadius:"14px",overflow:"hidden",border:theme.id===t.id?"2px solid #fff":"2px solid transparent",cursor:"pointer"}}>
                  <div style={{background:t.bg,padding:"0.75rem",display:"flex",flexDirection:"column",gap:"0.4rem"}}>
                    <div style={{background:t.mine,borderRadius:"10px 10px 2px 10px",padding:"0.3rem 0.6rem",fontSize:"0.7rem",alignSelf:"flex-end"}}>Hello</div>
                    <div style={{background:t.bubble,borderRadius:"10px 10px 10px 2px",padding:"0.3rem 0.6rem",fontSize:"0.7rem",alignSelf:"flex-start"}}>Hi!</div>
                  </div>
                  <div style={{background:"#1e1e2e",padding:"0.3rem",textAlign:"center",fontSize:"0.72rem"}}>{t.emoji} {t.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAddMember && (
        <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>{setShowAddMember(false);setMemberSearch("");setMemberResults([]);}} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
          <div style={{background:"#13131a",borderRadius:"20px 20px 0 0",padding:"1.25rem 1rem",maxHeight:"70vh",overflowY:"auto"}}>
            <div style={{width:"40px",height:"4px",background:"#333",borderRadius:"2px",margin:"0 auto 1rem"}} />
            <div style={{fontWeight:"bold",fontSize:"1rem",marginBottom:"1rem"}}>➕ Add Member</div>
            <div style={{background:"#1e1e2e",borderRadius:"12px",padding:"0.6rem 1rem",display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.75rem"}}>
              <span style={{color:"#888"}}>🔍</span>
              <input value={memberSearch} onChange={e=>searchMembers(e.target.value)} placeholder="Search users..."
                style={{flex:1,background:"transparent",border:"none",color:"white",fontSize:"0.95rem",outline:"none"}} />
            </div>
            {memberResults.length===0 && memberSearch.length>=2 && (
              <div style={{textAlign:"center",color:"#555",padding:"1rem",fontSize:"0.85rem"}}>No users found</div>
            )}
            {memberResults.map((u,i) => {
              const status = addStatus[u.id];
              return (
                <div key={u.id||i} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.6rem 0",borderBottom:"1px solid #1e1e2e"}}>
                  {u.avatar
                    ? <img src={u.avatar} alt={u.username} style={{width:"42px",height:"42px",borderRadius:"50%",objectFit:"cover"}} />
                    : <div style={{width:"42px",height:"42px",borderRadius:"50%",background:grads[i%4],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold"}}>{av(u.username)}</div>}
                  <div style={{flex:1}}>
                    <div style={{fontSize:"0.9rem",fontWeight:"bold"}}>@{u.username}</div>
                    {u.isPrivate && <div style={{fontSize:"0.72rem",color:"#f59e0b"}}>🔒 Private</div>}
                  </div>
                  {status==="added" ? <span style={{fontSize:"0.8rem",color:"#10b981"}}>Added ✅</span>
                  : status==="pending" ? <span style={{fontSize:"0.8rem",color:"#f59e0b"}}>Pending ⏳</span>
                  : status==="blocked" ? <span style={{fontSize:"0.8rem",color:"#f87171"}}>Follow first</span>
                  : <button onClick={()=>addMember(u)} disabled={status==="checking"}
                      style={{background:theme.mine,border:"none",borderRadius:"20px",padding:"0.35rem 0.9rem",color:"white",cursor:"pointer",fontSize:"0.82rem",fontWeight:"bold"}}>
                      {status==="checking"?"...":"+ Add"}
                    </button>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showPending && (
        <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowPending(false)} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
          <div style={{background:"#13131a",borderRadius:"20px 20px 0 0",padding:"1.25rem 1rem",maxHeight:"70vh",overflowY:"auto"}}>
            <div style={{width:"40px",height:"4px",background:"#333",borderRadius:"2px",margin:"0 auto 1rem"}} />
            <div style={{fontWeight:"bold",fontSize:"1rem",marginBottom:"1rem"}}>⏳ Pending Approvals ({pendingMembers.length})</div>
            {pendingMembers.length===0
              ? <div style={{textAlign:"center",color:"#555",padding:"2rem",fontSize:"0.85rem"}}>No pending members</div>
              : pendingMembers.map((m,i) => (
                <div key={m.id||i} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.6rem 0",borderBottom:"1px solid #1e1e2e"}}>
                  {m.avatar
                    ? <img src={m.avatar} alt={m.username} style={{width:"42px",height:"42px",borderRadius:"50%",objectFit:"cover"}} />
                    : <div style={{width:"42px",height:"42px",borderRadius:"50%",background:grads[i%4],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold"}}>{av(m.username)}</div>}
                  <div style={{flex:1,fontSize:"0.9rem"}}>@{m.username}</div>
                  <button onClick={()=>approvePending(m.id)}
                    style={{background:"linear-gradient(135deg,#10b981,#059669)",border:"none",borderRadius:"10px",padding:"0.3rem 0.7rem",color:"white",cursor:"pointer",fontSize:"0.8rem",marginRight:"0.4rem"}}>✓</button>
                  <button onClick={()=>rejectPending(m.id)}
                    style={{background:"#2a2a3a",border:"none",borderRadius:"10px",padding:"0.3rem 0.7rem",color:"#f87171",cursor:"pointer",fontSize:"0.8rem"}}>✕</button>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {showInfo && (
        <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowInfo(false)} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
          <div style={{background:"#13131a",borderRadius:"20px 20px 0 0",padding:"1.25rem 1rem",maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{width:"40px",height:"4px",background:"#333",borderRadius:"2px",margin:"0 auto 1rem"}} />
            <div style={{textAlign:"center",marginBottom:"1rem"}}>
              <div onClick={()=>group?.avatar&&setAvatarPreview(group.avatar)} style={{cursor:group?.avatar?"pointer":"default",display:"inline-block"}}>
                {group?.avatar
                  ? <img src={group.avatar} alt={group?.name} style={{width:"72px",height:"72px",borderRadius:"50%",objectFit:"cover",border:"3px solid #7c3aed"}} />
                  : <div style={{width:"72px",height:"72px",borderRadius:"50%",background:theme.mine,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:"2rem",margin:"0 auto"}}>{av(group?.name)}</div>}
              </div>
              <div style={{fontWeight:"bold",fontSize:"1.1rem",marginTop:"0.75rem"}}>{group?.name}</div>
              <div style={{color:"#888",fontSize:"0.82rem",marginTop:"0.25rem"}}>Created by @{group?.createdBy}</div>
            </div>

            {isAdmin && (
              <div style={{display:"flex",gap:"0.5rem",marginBottom:"1rem"}}>
                <button onClick={()=>{setShowInfo(false);setShowAddMember(true);}}
                  style={{flex:1,background:theme.mine,border:"none",borderRadius:"12px",color:"white",padding:"0.7rem",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem"}}>
                  ➕ Add Members
                </button>
                <button onClick={()=>{loadPending();setShowPending(true);}}
                  style={{flex:1,background:"#1e1e2e",border:"1px solid #333",borderRadius:"12px",color:"white",padding:"0.7rem",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem"}}>
                  ⏳ Pending
                </button>
              </div>
            )}

            {isAdmin && (
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#1e1e2e",borderRadius:"12px",padding:"0.75rem 1rem",marginBottom:"1rem"}}>
                <div>
                  <div style={{fontSize:"0.9rem",fontWeight:"bold"}}>🔐 Admin Approval</div>
                  <div style={{fontSize:"0.72rem",color:"#888",marginTop:"2px"}}>New members need approval</div>
                </div>
                <div onClick={toggleApproval} style={{width:"44px",height:"24px",borderRadius:"12px",background:group?.requireApproval?"#7c3aed":"#333",cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
                  <div style={{position:"absolute",top:"2px",left:group?.requireApproval?"22px":"2px",width:"20px",height:"20px",borderRadius:"50%",background:"white",transition:"left 0.2s"}} />
                </div>
              </div>
            )}

            <div style={{color:"#888",fontSize:"0.75rem",fontWeight:"bold",letterSpacing:"0.05em",marginBottom:"0.5rem"}}>MEMBERS ({group?.members?.length || 0})</div>
            {(group?.members || []).map((m,i) => {
              const memberIsAdmin = group?.admins?.includes(m.id);
              const memberIsCreator = m.id === group?.createdById;
              return (
                <div key={m.id||i} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.6rem 0",borderBottom:"1px solid #1e1e2e"}}>
                  <div onClick={()=>navigate("/user/"+m.username)} style={{cursor:"pointer",flexShrink:0}}>
                    {m.avatar
                      ? <img src={m.avatar} alt={m.username} style={{width:"38px",height:"38px",borderRadius:"50%",objectFit:"cover"}} />
                      : <div style={{width:"38px",height:"38px",borderRadius:"50%",background:grads[i%4],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold"}}>{av(m.username)}</div>}
                  </div>
                  <div style={{flex:1,cursor:"pointer"}} onClick={()=>navigate("/user/"+m.username)}>
                    <div style={{fontSize:"0.9rem"}}>@{m.username}</div>
                  </div>
                  <div style={{display:"flex",gap:"0.4rem",alignItems:"center"}}>
                    {memberIsAdmin && <span style={{fontSize:"0.72rem",background:"linear-gradient(135deg,#7c3aed,#db2777)",borderRadius:"8px",padding:"2px 8px",color:"white"}}>Admin</span>}
                    {memberIsCreator && <span style={{fontSize:"0.72rem",background:"linear-gradient(135deg,#f59e0b,#ef4444)",borderRadius:"8px",padding:"2px 8px",color:"white"}}>Owner</span>}
                    {isCreator && !memberIsCreator && (
                      <button onClick={()=>toggleAdmin(m.id,memberIsAdmin)}
                        style={{background:memberIsAdmin?"#2a2a3a":"#1e1e2e",border:"1px solid #333",borderRadius:"8px",color:memberIsAdmin?"#f87171":"#a78bfa",padding:"2px 8px",cursor:"pointer",fontSize:"0.72rem"}}>
                        {memberIsAdmin?"−Admin":"+Admin"}
                      </button>
                    )}
                    {isAdmin && !memberIsCreator && m.id!==user?.id && (
                      <button onClick={()=>removeMember(m.id)}
                        style={{background:"transparent",border:"none",color:"#555",cursor:"pointer",fontSize:"1rem",padding:"0 2px"}}>
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {isCreator && (
              <button onClick={deleteGroup}
                style={{width:"100%",background:"transparent",border:"1px solid #ef4444",borderRadius:"12px",color:"#ef4444",padding:"0.75rem",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem",marginTop:"1.25rem"}}>
                🗑 Delete Group
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
