import React, { useEffect, useState, useRef } from "react";
import API from "../api";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useParams, useLocation } from "react-router-dom";

export default function Chat() {
  const { userId } = useParams();
  const location = useLocation();
  const username = new URLSearchParams(location.search).get("username");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimer, setTypingTimer] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaData, setMediaData] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("chat_theme_"+userId) || "purple");
  const [showThemes, setShowThemes] = useState(false);
  const [otherUser, setOtherUser] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const bottomRef = useRef();
  const fileRef = useRef();
  const socketRef = useRef(null);

  const themes = {
    purple: "linear-gradient(135deg,#7c3aed,#db2777)",
    blue: "linear-gradient(135deg,#1d4ed8,#06b6d4)",
    green: "linear-gradient(135deg,#059669,#10b981)",
    orange: "linear-gradient(135deg,#d97706,#ef4444)",
    pink: "linear-gradient(135deg,#ec4899,#f43f5e)",
    gold: "linear-gradient(135deg,#d97706,#fbbf24)",
  };

  useEffect(() => {
    loadMessages();
    if (username) {
      API.get("/users/" + username).then(r => setOtherUser(r.data)).catch(()=>{});
    }

    // Socket.io real-time connection
    const socket = io("https://luciagram-backend.onrender.com", {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      socket.emit("join", user?.id);
    });

    socket.on("new_message", (msg) => {
      if (msg.senderId === userId || msg.receiverId === userId) {
        setMessages(prev => {
          const exists = prev.find(m => m.id === msg.id);
          if (exists) return prev;
          return [...prev, msg];
        });
      }
    });

    socket.on("typing", (data) => {
      if (data.senderId === userId) {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 3000);
      }
    });

    socket.on("stop_typing", (data) => {
      if (data.senderId === userId) setIsTyping(false);
    });

    socketRef.current = socket;
    return () => socket.disconnect();
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async () => {
    try {
      const res = await API.get("/messages/" + userId);
      setMessages(res.data);
    } catch {}
  };

  const handleMedia = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    setMediaType(isVideo ? "video" : "image");
    const reader = new FileReader();
    reader.onloadend = () => { setMediaPreview(reader.result); setMediaData(reader.result); };
    reader.readAsDataURL(file);
  };

  const handleTyping = () => {
    if (socketRef.current) {
      socketRef.current.emit("typing", { senderId: user?.id, receiverId: userId });
      clearTimeout(typingTimer);
      const t = setTimeout(() => {
        if (socketRef.current) {
          socketRef.current.emit("stop_typing", { senderId: user?.id, receiverId: userId });
        }
      }, 2000);
      setTypingTimer(t);
    }
  };

  const sendMessage = async () => {
    if ((!text.trim() && !mediaData) || sending) return;
    setSending(true);
    try {
      let mediaUrl = "";
      if (mediaData) {
        // Upload to Supabase
        const res = await API.post("/messages/upload", { mediaBase64: mediaData, mediaType });
        mediaUrl = res.data.url;
      }
      const res = await API.post("/messages", {
        receiverId: userId,
        receiverUsername: username,
        text: text.trim(),
        mediaUrl,
      });
      setMessages(p => [...p, res.data]);
      // Emit to receiver via socket
      if (socketRef.current) {
        socketRef.current.emit("send_message", res.data);
      }
      setText("");
      setMediaPreview(null);
      setMediaData(null);
      setMediaType(null);
    } catch {}
    setSending(false);
  };

  const setThemeAndSave = (t) => {
    setTheme(t);
    localStorage.setItem("chat_theme_"+userId, t);
    setShowThemes(false);
  };

  const avatar = (name) => (name||"U").slice(0,1).toUpperCase();
  const currentTheme = themes[theme] || themes.purple;

  return (
    <div style={{background:"#0a0a0f",height:"100vh",color:"white",display:"flex",flexDirection:"column",maxWidth:"100vw",overflow:"hidden"}}>
      
      {/* Header */}
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.6rem 1rem",display:"flex",alignItems:"center",gap:"0.75rem",position:"sticky",top:0,zIndex:100,flexShrink:0}}>
        <span onClick={()=>navigate("/messages")} style={{cursor:"pointer",fontSize:"1.3rem",flexShrink:0}}>←</span>
        
        {/* Avatar - tap to view profile */}
        <div onClick={()=>navigate("/user/"+username)} style={{cursor:"pointer",flexShrink:0}}>
          {otherUser?.avatar ? (
            <img src={otherUser.avatar} alt={username} style={{width:"40px",height:"40px",borderRadius:"50%",objectFit:"cover",border:"2px solid #7c3aed"}} />
          ) : (
            <div style={{width:"40px",height:"40px",borderRadius:"50%",background:currentTheme,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:"1rem"}}>{avatar(username)}</div>
          )}
        </div>

        {/* Name - tap to view profile */}
        <div onClick={()=>navigate("/user/"+username)} style={{flex:1,cursor:"pointer"}}>
          <div style={{fontWeight:"bold",fontSize:"1rem"}}>@{username}</div>
          <div style={{fontSize:"0.72rem",color:"#888"}}>
            {isTyping ? <span style={{color:"#7c3aed"}}>typing...</span> : "Luciagram user"}
          </div>
        </div>

        <div style={{display:"flex",gap:"0.75rem",alignItems:"center"}}>
          <span onClick={()=>setShowThemes(!showThemes)} style={{fontSize:"1.2rem",cursor:"pointer"}}>🎨</span>
          <span style={{fontSize:"1.2rem",cursor:"pointer"}}>📞</span>
          <span style={{fontSize:"1.2rem",cursor:"pointer"}}>🎥</span>
        </div>
      </div>

      {/* Theme Picker */}
      {showThemes && (
        <div style={{background:"#13131a",padding:"0.75rem 1rem",borderBottom:"1px solid #1e1e2e",display:"flex",gap:"0.75rem",alignItems:"center",flexWrap:"wrap"}}>
          <span style={{color:"#888",fontSize:"0.85rem"}}>Chat theme:</span>
          {Object.entries(themes).map(([name, grad]) => (
            <div key={name} onClick={()=>setThemeAndSave(name)} style={{width:"28px",height:"28px",borderRadius:"50%",background:grad,cursor:"pointer",border:theme===name?"3px solid white":"3px solid transparent"}} />
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"0.75rem 1rem",display:"flex",flexDirection:"column",gap:"0.5rem"}}>
        {messages.map((m,i) => {
          const isMe = m.senderId === user?.id;
          return (
            <div key={m.id||i} style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start",alignItems:"flex-end",gap:"0.4rem"}}>
              {!isMe && (
                <div onClick={()=>navigate("/user/"+username)} style={{cursor:"pointer",flexShrink:0}}>
                  {otherUser?.avatar ? (
                    <img src={otherUser.avatar} alt={username} style={{width:"28px",height:"28px",borderRadius:"50%",objectFit:"cover"}} />
                  ) : (
                    <div style={{width:"28px",height:"28px",borderRadius:"50%",background:currentTheme,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",fontWeight:"bold"}}>{avatar(username)}</div>
                  )}
                </div>
              )}
              <div style={{maxWidth:"72%"}}>
                {m.mediaUrl && (() => {
                  const url = m.mediaUrl || "";
                  const isVideo = url.includes(".mp4") || url.includes("video") || (m.mediaType === "video");
                  const isSharedReel = m.text && (m.text.includes("Shared a Reel") || m.text.includes("Shared a Post"));
                  return (
                    <div style={{borderRadius:"12px",overflow:"hidden",marginBottom: isSharedReel ? "0" : "0.3rem"}}>
                      {isSharedReel && (
                        <div style={{background:"rgba(124,58,237,0.15)",borderRadius:"12px 12px 0 0",padding:"0.4rem 0.75rem",fontSize:"0.78rem",color:"#a78bfa",fontWeight:"bold"}}>
                          {m.text.includes("Reel") ? "🎬 Shared a Reel" : "📸 Shared a Post"}
                        </div>
                      )}
                      {isVideo ? (
                        <video src={url} controls playsInline style={{width:"100%",maxWidth:"280px",borderRadius: isSharedReel ? "0 0 12px 12px" : "12px",maxHeight:"320px",display:"block",background:"#000"}} />
                      ) : (
                        <img src={url} alt="media" style={{width:"100%",maxWidth:"280px",borderRadius: isSharedReel ? "0 0 12px 12px" : "12px",maxHeight:"320px",objectFit:"cover",display:"block"}} />
                      )}
                    </div>
                  );
                })()}
                {m.text && !(m.mediaUrl && (m.text.includes("Shared a Reel") || m.text.includes("Shared a Post"))) && (
                  <div style={{background:isMe?currentTheme:"#1e1e2e",padding:"0.55rem 0.9rem",borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px",fontSize:"0.95rem",wordBreak:"break-word",lineHeight:1.4}}>
                    {m.text}
                  </div>
                )}
                <div style={{fontSize:"0.68rem",color:"#555",marginTop:"0.2rem",textAlign:isMe?"right":"left"}}>
                  {new Date(m.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                  {isMe && <span style={{marginLeft:"4px",color:m.isRead?"#7c3aed":"#555"}}>{m.isRead?"✓✓":"✓"}</span>}
                </div>
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div style={{display:"flex",alignItems:"center",gap:"0.4rem"}}>
            <div style={{width:"28px",height:"28px",borderRadius:"50%",background:currentTheme,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem"}}>{avatar(username)}</div>
            <div style={{background:"#1e1e2e",padding:"0.55rem 0.9rem",borderRadius:"18px 18px 18px 4px"}}>
              <div style={{display:"flex",gap:"3px",alignItems:"center"}}>
                {[0,1,2].map(i => <div key={i} style={{width:"6px",height:"6px",borderRadius:"50%",background:"#888",animation:`bounce 1s ${i*0.2}s infinite`}} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Media Preview */}
      {mediaPreview && (
        <div style={{padding:"0.5rem 1rem",background:"#13131a",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.75rem"}}>
          {mediaType === "video" ? (
            <video src={mediaPreview} style={{width:"60px",height:"60px",objectFit:"cover",borderRadius:"8px"}} />
          ) : (
            <img src={mediaPreview} alt="preview" style={{width:"60px",height:"60px",objectFit:"cover",borderRadius:"8px"}} />
          )}
          <div style={{flex:1,fontSize:"0.85rem",color:"#888"}}>{mediaType === "video" ? "🎬 Video ready" : "📸 Photo ready"}</div>
          <span onClick={()=>{setMediaPreview(null);setMediaData(null);}} style={{color:"#f87171",cursor:"pointer",fontSize:"1.2rem"}}>✕</span>
        </div>
      )}

      {/* Input */}
      <div style={{padding:"0.6rem 0.75rem",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.5rem",background:"#0a0a0f",flexShrink:0}}>
        <span style={{fontSize:"1.3rem",cursor:"pointer"}}>😊</span>
        <input
          value={text}
          onChange={e=>{setText(e.target.value);handleTyping();}}
          onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage()}
          placeholder="Message..."
          style={{flex:1,background:"#1e1e2e",border:"none",borderRadius:"20px",padding:"0.55rem 0.9rem",color:"white",fontSize:"0.95rem",outline:"none",minWidth:0}}
        />
        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleMedia} style={{display:"none"}} />
        <span onClick={()=>fileRef.current?.click()} style={{fontSize:"1.3rem",cursor:"pointer"}}>📎</span>
        {text || mediaData ? (
          <button onClick={sendMessage} disabled={sending} style={{background:currentTheme,border:"none",borderRadius:"50%",width:"36px",height:"36px",color:"white",cursor:"pointer",fontSize:"1rem",flexShrink:0}}>➤</button>
        ) : (
          <span style={{fontSize:"1.3rem",cursor:"pointer"}}>❤️</span>
        )}
      </div>

      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
      `}</style>
    </div>
  );
}
