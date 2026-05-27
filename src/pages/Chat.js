import React, { useEffect, useState, useRef } from "react";
import CallScreen from "./CallScreen";
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
  const typingTimerRef = useRef(null);
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
  const doubleTapRef = useRef({});
  const [pressTimer, setPressTimer] = useState(null);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [reactionPicker, setReactionPicker] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [showEmojiInput, setShowEmojiInput] = useState(false);
  const [customEmoji, setCustomEmoji] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [swipeX, setSwipeX] = useState({});
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [chatFont, setChatFont] = useState(() => localStorage.getItem("chat_font_"+userId) || "default");

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
        clearTimeout(socket._typingHideTimer);
        socket._typingHideTimer = setTimeout(() => setIsTyping(false), 3000);
      }
    });

    socket.on("dm_reaction", (data) => {
      setMessages(prev => prev.map(m => m.id === data.msgId ? { ...m, reactions: data.reactions } : m));
    });
    // Incoming call listener
    socket.on("call:incoming", (data) => {
      setIncomingCall({ ...data, isIncoming: true });
    });

    socket.on("dm_unsend", (data) => {
      setMessages(prev => prev.filter(m => m.id !== data.msgId));
    });
    socket.on("stop_typing", (data) => {
      if (data.senderId === userId) setIsTyping(false);
    });

    socket.on("call:incoming", (data) => {
      setIncomingCall({ ...data, isIncoming: true });
    });
    socketRef.current = socket;

  const endCall = () => { setActiveCall(null); setIncomingCall(null); };

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
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        if (socketRef.current) {
          socketRef.current.emit("stop_typing", { senderId: user?.id, receiverId: userId });
        }
      }, 2000);
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
        mediaType: mediaType || "",
        replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderUsername: replyTo.senderUsername, mediaType: replyTo.mediaType } : null,
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
      setReplyTo(null);
    } catch {}
    setSending(false);
  };

  const setThemeAndSave = (t) => {
    setTheme(t);
    localStorage.setItem("chat_theme_"+userId, t);
    setShowThemes(false);
  };

  const FONTS = [
    { id: "default", name: "Default", style: "inherit" },
    { id: "mono", name: "Mono", style: "monospace" },
    { id: "serif", name: "Serif", style: "Georgia, serif" },
    { id: "rounded", name: "Rounded", style: "'Trebuchet MS', sans-serif" },
    { id: "cursive", name: "Cursive", style: "cursive" },
    { id: "fantasy", name: "Fantasy", style: "fantasy" },
  ];
  const currentFont = FONTS.find(f => f.id === chatFont)?.style || "inherit";
  const applyFont = (id) => { setChatFont(id); localStorage.setItem("chat_font_"+userId, id); setShowFontPicker(false); };

  const URL_REGEX = /(https?:\/\/[^\s]+)/g;
  const renderText = (text) => {
    const parts = text.split(URL_REGEX);
    return parts.map((part, i) =>
      URL_REGEX.test(part)
        ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{color:"#a78bfa",textDecoration:"underline",wordBreak:"break-all"}}>{part}</a>
        : <span key={i}>{part}</span>
    );
  };

  const handleDoubleTap = (msg) => {
    const now = Date.now();
    const last = doubleTapRef.current[msg.id] || 0;
    if (now - last < 350) setReactionPicker(msg.id);
    doubleTapRef.current[msg.id] = now;
  };

  const sendReaction = async (msgId, emoji) => {
    setReactionPicker(null); setShowEmojiInput(false); setCustomEmoji("");
    try {
      const r = await API.post("/messages/" + msgId + "/react", { emoji });
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions: r.data.reactions } : m));
      socketRef.current?.emit("dm_reaction", { receiverId: userId, msgId, reactions: r.data.reactions });
    } catch {}
  };

  const handleTouchStart = (e, msgId) => setSwipeX(prev => ({ ...prev, [msgId]: e.touches[0].clientX }));
  const handleTouchEnd = (e, msg) => {
    const startX = swipeX[msg.id]; if (!startX) return;
    const diff = e.changedTouches[0].clientX - startX;
    const mine = msg.senderId === user?.id;
    if (mine && diff < -60) setReplyTo(msg);
    if (!mine && diff > 60) setReplyTo(msg);
    setSwipeX(prev => ({ ...prev, [msg.id]: null }));
  };
  const handlePressStart = (msg) => { const t = setTimeout(() => { if (msg.senderId === user?.id) setSelectedMsg(msg); }, 500); setPressTimer(t); };
  const handlePressEnd = () => clearTimeout(pressTimer);

  const unsendMessage = async (msgId) => {
    setSelectedMsg(null);
    try {
      await API.delete("/messages/" + msgId);
      setMessages(prev => prev.filter(m => m.id !== msgId));
      socketRef.current?.emit("dm_unsend", { receiverId: userId, msgId });
    } catch {}
  };

  const groupReactions = (reactions = []) => {
    const map = {};
    reactions.forEach(r => { map[r.emoji] = (map[r.emoji] || 0) + 1; });
    return Object.entries(map);
  };

  const avatar = (name) => (name||"U").slice(0,1).toUpperCase();
  const currentTheme = themes[theme] || themes.purple;

  return (
    <>
      {(activeCall || incomingCall) && (
        <CallScreen
          call={activeCall || incomingCall}
          socket={socketRef.current}
          user={user}
          onEnd={endCall}
        />
      )}
      <div style={{background:"#0a0a0f",height:"100vh",color:"white",display:"flex",flexDirection:"column",maxWidth:"100vw",overflow:"hidden"}}>
      
      {/* Header */}
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.6rem 1rem",display:"flex",alignItems:"center",gap:"0.75rem",position:"sticky",top:0,zIndex:100,flexShrink:0}}>
        <span onClick={()=>navigate("/messages")} style={{cursor:"pointer",fontSize:"1.3rem",flexShrink:0}}>←</span>
        
        {/* Avatar - tap to view profile */}
        <div style={{cursor:"pointer",flexShrink:0}} onClick={()=>otherUser?.avatar ? setAvatarPreview(otherUser.avatar) : navigate("/user/"+username)}>
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
          <span onClick={()=>setShowFontPicker(true)} style={{fontSize:"1.2rem",cursor:"pointer"}}>🔤</span>
          <span onClick={()=>setShowThemes(!showThemes)} style={{fontSize:"1.2rem",cursor:"pointer"}}>🎨</span>
          <span onClick={()=>setActiveCall({ receiverId: userId, receiverUsername: username, receiverAvatar: otherUser?.avatar||"", callType:"audio" })} style={{fontSize:"1.2rem",cursor:"pointer"}}>📞</span>
          <span onClick={()=>setActiveCall({ receiverId: userId, receiverUsername: username, receiverAvatar: otherUser?.avatar||"", callType:"video" })} style={{fontSize:"1.2rem",cursor:"pointer"}}>🎥</span>
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
            <div key={m.id||i}
              onTouchStart={e=>{handleTouchStart(e,m.id);handlePressStart(m);}}
              onTouchEnd={e=>{handleTouchEnd(e,m);handlePressEnd();}}
              onClick={()=>handleDoubleTap(m)}
              style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start",alignItems:"flex-end",gap:"0.4rem"}}>
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
                  <div style={{background:isMe?currentTheme:"#1e1e2e",padding:"0.55rem 0.9rem",borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px",fontSize:"0.95rem",wordBreak:"break-word",lineHeight:1.4,fontFamily:currentFont}}>
                    {m.replyTo && (
                      <div style={{background:"rgba(255,255,255,0.08)",borderLeft:"3px solid rgba(255,255,255,0.4)",borderRadius:"6px",padding:"0.25rem 0.5rem",marginBottom:"0.3rem",fontSize:"0.75rem",opacity:0.85}}>
                        <div style={{fontWeight:"bold",marginBottom:"1px"}}>@{m.replyTo.senderUsername}</div>
                        <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"180px"}}>{m.replyTo.mediaType?"📎 Media":m.replyTo.text}</div>
                      </div>
                    )}
                    {renderText(m.text)}
                  </div>
                )}
                {m.reactions?.length > 0 && (
                  <div style={{display:"flex",flexWrap:"wrap",gap:"3px",marginTop:"3px",justifyContent:isMe?"flex-end":"flex-start"}}>
                    {groupReactions(m.reactions).map(([emoji,count]) => (
                      <span key={emoji} onClick={()=>sendReaction(m.id,emoji)}
                        style={{background:"rgba(255,255,255,0.08)",borderRadius:"20px",padding:"2px 7px",fontSize:"0.78rem",cursor:"pointer"}}>
                        {emoji} {count}
                      </span>
                    ))}
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
            {otherUser?.avatar ? (
              <img src={otherUser.avatar} alt={username} style={{width:"28px",height:"28px",borderRadius:"50%",objectFit:"cover",flexShrink:0}} />
            ) : (
              <div style={{width:"28px",height:"28px",borderRadius:"50%",background:currentTheme,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",flexShrink:0}}>{avatar(username)}</div>
            )}
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

      {replyTo && (
        <div style={{padding:"0.5rem 1rem",background:"#13131a",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.75rem"}}>
          <div style={{flex:1,borderLeft:"3px solid #7c3aed",paddingLeft:"0.5rem"}}>
            <div style={{fontSize:"0.72rem",color:"#a78bfa"}}>@{replyTo.senderUsername}</div>
            <div style={{fontSize:"0.82rem",color:"#888",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"240px"}}>
              {replyTo.mediaType?"📎 Media":replyTo.text}
            </div>
          </div>
          <span onClick={()=>setReplyTo(null)} style={{color:"#f87171",cursor:"pointer",fontSize:"1.2rem"}}>✕</span>
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

      {avatarPreview && (
        <div onClick={()=>setAvatarPreview(null)} style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <img src={avatarPreview} alt="avatar" style={{width:"80vw",height:"80vw",borderRadius:"50%",objectFit:"cover",border:"3px solid #7c3aed"}} />
        </div>
      )}

      {selectedMsg && (
        <div onClick={()=>setSelectedMsg(null)} style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#1e1e2e",borderRadius:"16px",padding:"1rem",minWidth:"200px",boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
            <div style={{fontSize:"0.75rem",color:"#888",marginBottom:"0.75rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selectedMsg.text||"Media message"}</div>
            <button onClick={()=>unsendMessage(selectedMsg.id)}
              style={{width:"100%",background:"transparent",border:"1px solid #ef4444",borderRadius:"10px",color:"#ef4444",padding:"0.6rem",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem"}}>
              🗑 Unsend Message
            </button>
          </div>
        </div>
      )}

      {reactionPicker && (
        <div onClick={()=>{setReactionPicker(null);setShowEmojiInput(false);}} style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#1e1e2e",borderRadius:"30px",padding:"0.75rem 1rem",boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
            <div style={{display:"flex",gap:"0.5rem"}}>
              {["❤️","😂","😮","😢","😡","👍"].map(emoji => (
                <span key={emoji} onClick={()=>sendReaction(reactionPicker,emoji)} style={{fontSize:"1.6rem",cursor:"pointer",padding:"0.2rem"}}>{emoji}</span>
              ))}
              <span onClick={()=>setShowEmojiInput(true)} style={{fontSize:"1.4rem",cursor:"pointer",padding:"0.2rem",color:"#a78bfa",fontWeight:"bold"}}>+</span>
            </div>
            {showEmojiInput && (
              <div style={{marginTop:"0.5rem",display:"flex",gap:"0.5rem",alignItems:"center"}}>
                <input value={customEmoji} onChange={e=>setCustomEmoji(e.target.value)} placeholder="Any emoji..."
                  style={{background:"#2a2a3a",border:"none",borderRadius:"12px",padding:"0.4rem 0.75rem",color:"white",fontSize:"1rem",outline:"none",width:"120px"}} />
                <button onClick={()=>sendReaction(reactionPicker,customEmoji.trim())}
                  style={{background:currentTheme,border:"none",borderRadius:"12px",padding:"0.4rem 0.75rem",color:"white",cursor:"pointer",fontSize:"0.85rem"}}>Send</button>
              </div>
            )}
          </div>
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
                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#1e1e2e",borderRadius:"12px",padding:"0.75rem 1rem",cursor:"pointer",border:chatFont===f.id?"1px solid #7c3aed":"1px solid transparent"}}>
                  <span style={{fontFamily:f.style,fontSize:"1rem"}}>Hello! How are you?</span>
                  <span style={{fontSize:"0.75rem",color:chatFont===f.id?"#a78bfa":"#555"}}>{f.name} {chatFont===f.id?"✓":""}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
      `}</style>
    </div>
    </>
  );
}