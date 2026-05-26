import React, { useEffect, useState, useRef } from "react";
import API from "../api";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";

const SOCKET_URL = "https://luciagram-backend.onrender.com";

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const bottomRef = useRef();
  const fileRef = useRef();
  const socketRef = useRef(null);
  const typingTimerRef = useRef(null);

  useEffect(() => {
    loadGroup();
    loadMessages();
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socket.on("connect", () => {
      socket.emit("join", user?.id);
      socket.emit("join_group", groupId);
    });
    socket.on("group_message", (msg) => {
      if (msg.groupId === groupId) {
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
      }
    });
    socket.on("group_typing", (data) => {
      if (data.groupId === groupId && data.senderId !== user?.id) {
        setTypers(prev => prev.find(t => t.senderId === data.senderId) ? prev : [...prev, data]);
        setTimeout(() => setTypers(prev => prev.filter(t => t.senderId !== data.senderId)), 3000);
      }
    });
    socket.on("group_stop_typing", (data) => {
      if (data.groupId === groupId) setTypers(prev => prev.filter(t => t.senderId !== data.senderId));
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
      const r = await API.post("/groups/" + groupId + "/messages", { text: text.trim(), mediaUrl, mediaType: mediaType || "" });
      setMessages(prev => [...prev, r.data]);
      socketRef.current?.emit("group_message", r.data);
      setText(""); setMediaPreview(null); setMediaData(null); setMediaType(null);
    } catch {}
    setSending(false);
  };

  const av = (n) => (n || "U").slice(0, 1).toUpperCase();
  const grads = ["linear-gradient(135deg,#7c3aed,#db2777)","linear-gradient(135deg,#f59e0b,#ef4444)","linear-gradient(135deg,#10b981,#3b82f6)","linear-gradient(135deg,#8b5cf6,#06b6d4)"];

  return (
    <div style={{background:"#0a0a0f",height:"100vh",color:"white",display:"flex",flexDirection:"column",overflow:"hidden"}}>

      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.6rem 1rem",display:"flex",alignItems:"center",gap:"0.75rem",flexShrink:0}}>
        <span onClick={()=>navigate("/groupchat")} style={{cursor:"pointer",fontSize:"1.3rem",flexShrink:0}}>←</span>
        {group?.avatar
          ? <img src={group.avatar} alt={group?.name} style={{width:"40px",height:"40px",borderRadius:"50%",objectFit:"cover",flexShrink:0,border:"2px solid #7c3aed"}} />
          : <div style={{width:"40px",height:"40px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:"1rem",flexShrink:0}}>{av(group?.name)}</div>
        }
        <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>setShowInfo(true)}>
          <div style={{fontWeight:"bold",fontSize:"1rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{group?.name || "Group"}</div>
          <div style={{fontSize:"0.7rem"}}>
            {typers.length > 0
              ? <span style={{color:"#a78bfa"}}>{typers.map(t=>t.senderUsername).join(", ")} typing...</span>
              : <span style={{color:"#888"}}>{group?.members?.length || 0} members</span>}
          </div>
        </div>
        <span onClick={()=>setShowInfo(true)} style={{fontSize:"1.2rem",cursor:"pointer"}}>ℹ️</span>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"0.75rem 1rem",display:"flex",flexDirection:"column",gap:"0.3rem"}}>
        {messages.map((m, i) => {
          const mine = m.senderId === user?.id;
          const prev = messages[i-1];
          const showAv = !mine && (!prev || prev.senderId !== m.senderId);
          return (
            <div key={m.id||i}>
              {!mine && showAv && <div style={{fontSize:"0.72rem",color:"#a78bfa",marginLeft:"38px",marginBottom:"2px",marginTop:"6px"}}>@{m.senderUsername}</div>}
              <div style={{display:"flex",justifyContent:mine?"flex-end":"flex-start",alignItems:"flex-end",gap:"0.35rem"}}>
                {!mine && (
                  <div style={{width:"28px",height:"28px",flexShrink:0}}>
                    {showAv && (m.senderAvatar
                      ? <img src={m.senderAvatar} alt={m.senderUsername} style={{width:"28px",height:"28px",borderRadius:"50%",objectFit:"cover"}} />
                      : <div style={{width:"28px",height:"28px",borderRadius:"50%",background:grads[(m.senderUsername||"").charCodeAt(0)%4],display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",fontWeight:"bold"}}>{av(m.senderUsername)}</div>
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
                    <div style={{background:mine?"linear-gradient(135deg,#7c3aed,#db2777)":"#1e1e2e",padding:"0.55rem 0.9rem",borderRadius:mine?"18px 18px 4px 18px":"18px 18px 18px 4px",fontSize:"0.95rem",wordBreak:"break-word",lineHeight:1.4}}>
                      {m.text}
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

      <div style={{padding:"0.6rem 0.75rem",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.5rem",background:"#0a0a0f",flexShrink:0}}>
        <span style={{fontSize:"1.3rem",cursor:"pointer"}}>😊</span>
        <input value={text} onChange={e=>{setText(e.target.value);handleTyping();}} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage()}
          placeholder="Message..." style={{flex:1,background:"#1e1e2e",border:"none",borderRadius:"20px",padding:"0.55rem 0.9rem",color:"white",fontSize:"0.95rem",outline:"none",minWidth:0}} />
        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleMedia} style={{display:"none"}} />
        <span onClick={()=>fileRef.current?.click()} style={{fontSize:"1.3rem",cursor:"pointer"}}>📎</span>
        {(text||mediaData)
          ? <button onClick={sendMessage} disabled={sending} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"50%",width:"36px",height:"36px",color:"white",cursor:"pointer",fontSize:"1rem",flexShrink:0}}>➤</button>
          : <span style={{fontSize:"1.3rem",cursor:"pointer"}}>❤️</span>}
      </div>

      {showInfo && (
        <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowInfo(false)} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
          <div style={{background:"#13131a",borderRadius:"20px 20px 0 0",padding:"1.25rem 1rem",maxHeight:"70vh",overflowY:"auto"}}>
            <div style={{width:"40px",height:"4px",background:"#333",borderRadius:"2px",margin:"0 auto 1rem"}} />
            <div style={{textAlign:"center",marginBottom:"1rem"}}>
              {group?.avatar
                ? <img src={group.avatar} alt={group?.name} style={{width:"72px",height:"72px",borderRadius:"50%",objectFit:"cover",border:"3px solid #7c3aed"}} />
                : <div style={{width:"72px",height:"72px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:"2rem",margin:"0 auto"}}>{av(group?.name)}</div>}
              <div style={{fontWeight:"bold",fontSize:"1.1rem",marginTop:"0.75rem"}}>{group?.name}</div>
              <div style={{color:"#888",fontSize:"0.82rem",marginTop:"0.25rem"}}>Created by @{group?.createdBy}</div>
            </div>
            <div style={{color:"#888",fontSize:"0.75rem",fontWeight:"bold",letterSpacing:"0.05em",marginBottom:"0.5rem"}}>MEMBERS ({group?.members?.length || 0})</div>
            {(group?.members || []).map((m,i) => (
              <div key={m.id||i} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.6rem 0",borderBottom:"1px solid #1e1e2e"}}>
                {m.avatar
                  ? <img src={m.avatar} alt={m.username} style={{width:"38px",height:"38px",borderRadius:"50%",objectFit:"cover"}} />
                  : <div style={{width:"38px",height:"38px",borderRadius:"50%",background:grads[i%4],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold"}}>{av(m.username)}</div>}
                <span style={{flex:1}}>@{m.username}</span>
                {group?.admins?.includes(m.id) && <span style={{fontSize:"0.72rem",background:"linear-gradient(135deg,#7c3aed,#db2777)",borderRadius:"8px",padding:"2px 8px",color:"white"}}>Admin</span>}
                {m.id === group?.createdById && <span style={{fontSize:"0.72rem",background:"linear-gradient(135deg,#f59e0b,#ef4444)",borderRadius:"8px",padding:"2px 8px",color:"white"}}>Owner</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
