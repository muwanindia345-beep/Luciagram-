import React, { useEffect, useState, useRef } from "react";
import MusicPicker from "../components/MusicPicker";
import CallScreen from "./CallScreen";
import API from "../api";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import GboardInput from "../components/GboardInput";
import { useNavigate, useParams, useLocation } from "react-router-dom";

// Tenor v1 - completely free, no API key needed
const GIF_SEARCH_URL = "https://g.tenor.com/v1/search?limit=20&q=";
const GIF_TRENDING_URL = "https://g.tenor.com/v1/trending?limit=20";

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
  const inputDivRef = useRef();
  const cameraRef = useRef();
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
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [chatMusic, setChatMusic] = useState(null);
  const musicAudioRef = useRef(null);
  const [chatFont, setChatFont] = useState(() => localStorage.getItem("chat_font_"+userId) || "default");

  // Voice message
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef(null);

  // Wallpaper
  const [wallpaper, setWallpaper] = useState(() => localStorage.getItem("chat_wallpaper_"+userId) || "");
  useEffect(() => {
    if (!userId) return;
    const loadWallpaper = async () => {
      try {
        const db = await new Promise((res, rej) => {
          const req = indexedDB.open("luciagram_wallpapers", 1);
          req.onupgradeneeded = e => e.target.result.createObjectStore("wallpapers", { keyPath: "id" });
          req.onsuccess = e => res(e.target.result);
          req.onerror = rej;
        });
        const tx = db.transaction("wallpapers","readonly");
        const req = tx.objectStore("wallpapers").get("chat_wallpaper_"+userId);
        req.onsuccess = () => { if (req.result?.url) setWallpaper(req.result.url); };
      } catch { setWallpaper(localStorage.getItem("chat_wallpaper_"+userId) || ""); }
    };
    if (userId) loadWallpaper();
  }, [userId]);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const wallpaperInputRef = useRef();

  // Disappearing messages
  const [disappearTimer, setDisappearTimer] = useState(() => parseInt(localStorage.getItem("chat_disappear_"+userId) || "0"));
  const [showDisappearPicker, setShowDisappearPicker] = useState(false);

  // GIF/Sticker/Meme picker
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifs, setGifs] = useState([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const themes = {
    purple: "linear-gradient(135deg,#7c3aed,#db2777)",
    blue: "linear-gradient(135deg,#1d4ed8,#06b6d4)",
    green: "linear-gradient(135deg,#059669,#10b981)",
    orange: "linear-gradient(135deg,#d97706,#ef4444)",
    pink: "linear-gradient(135deg,#ec4899,#f43f5e)",
    gold: "linear-gradient(135deg,#d97706,#fbbf24)",
  };

  const WALLPAPERS = [
    { id: "none", label: "None", color: "#0a0a0f" },
    { id: "galaxy", label: "Galaxy", url: "https://images.unsplash.com/photo-1464802686167-b939a6910659?w=600&q=80" },
    { id: "aurora", label: "Aurora", url: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&q=80" },
    { id: "city", label: "City", url: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600&q=80" },
    { id: "forest", label: "Forest", url: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&q=80" },
    { id: "ocean", label: "Ocean", url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&q=80" },
    { id: "neon", label: "Neon", url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80" },
  ];

  const DISAPPEAR_OPTIONS = [
    { value: 0, label: "Off" },
    { value: 30, label: "30 seconds" },
    { value: 300, label: "5 minutes" },
    { value: 3600, label: "1 hour" },
    { value: 86400, label: "24 hours" },
    { value: 604800, label: "7 days" },
  ];

  // paste handled by div onPaste directly

  useEffect(() => {
    loadMessages();
    if (username) {
      API.get("/users/" + username).then(r => setOtherUser(r.data)).catch(()=>{});
    }
    const socket = io("https://luciagram-backend.onrender.com", { transports: ["websocket"] });
    socket.on("connect", () => socket.emit("join", user?.id));
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
    socket.on("dm_unsend", (data) => {
      setMessages(prev => prev.filter(m => m.id !== data.msgId));
    });
    socket.on("stop_typing", (data) => {
      if (data.senderId === userId) setIsTyping(false);
    });
    socketRef.current = socket;
    return () => socket.disconnect();
  }, [userId]);

  // Disappearing messages cleanup
  useEffect(() => {
    if (!disappearTimer) return;
    const interval = setInterval(() => {
      const cutoff = Date.now() - disappearTimer * 1000;
      setMessages(prev => prev.filter(m => new Date(m.createdAt).getTime() > cutoff));
    }, 5000);
    return () => clearInterval(interval);
  }, [disappearTimer]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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
        socketRef.current?.emit("stop_typing", { senderId: user?.id, receiverId: userId });
      }, 2000);
    }
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = e => audioChunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch { alert("Microphone access denied"); }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    clearInterval(recordingTimerRef.current);
    setRecording(false);
  };

  const cancelRecording = () => {
    mediaRecorderRef.current?.stop();
    clearInterval(recordingTimerRef.current);
    setRecording(false);
    setAudioBlob(null);
    setAudioUrl(null);
    audioChunksRef.current = [];
  };

  const sendVoiceMessage = async () => {
    if (!audioBlob) return;
    setSending(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result;
        const uploadRes = await API.post("/messages/upload", { mediaBase64: base64, mediaType: "audio" });
        const res = await API.post("/messages", {
          receiverId: userId, receiverUsername: username,
          text: "🎙️ Voice message",
          mediaUrl: uploadRes.data.url,
          mediaType: "audio",
          replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderUsername: replyTo.senderUsername, mediaType: replyTo.mediaType } : null,
        });
        setMessages(p => [...p, res.data]);
        socketRef.current?.emit("send_message", res.data);
        setAudioBlob(null);
        setAudioUrl(null);
        setReplyTo(null);
        setSending(false);
      };
      reader.readAsDataURL(audioBlob);
    } catch { setSending(false); }
  };

const sendMessage = async () => {
    if (audioBlob) return sendVoiceMessage();
    if ((!text.trim() && !mediaData) || sending) return;
    setSending(true);
    try {
      let mediaUrl = "";
      if (mediaData) {
        const res = await API.post("/messages/upload", { mediaBase64: mediaData, mediaType });
        mediaUrl = res.data.url;
      }
      const res = await API.post("/messages", {
        receiverId: userId, receiverUsername: username,
        text: text.trim(), mediaUrl, mediaType: mediaType || "",
        music: chatMusic || null,
        replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderUsername: replyTo.senderUsername, mediaType: replyTo.mediaType } : null,
      });
      setMessages(p => [...p, res.data]);
      socketRef.current?.emit("send_message", res.data);
      setText(""); setMediaPreview(null); setMediaData(null); setMediaType(null); setReplyTo(null); setChatMusic(null);
      if(inputDivRef.current){inputDivRef.current.textContent='';} setText('');
    } catch {}
    setSending(false);
  };

  const sendGif = async (gifUrl) => {
    if (sending) return;
    setShowGifPicker(false);
    setSending(true);
    try {
      const res = await API.post("/messages", {
        receiverId: userId, receiverUsername: username,
        text: "", mediaUrl: gifUrl, mediaType: "gif",
      });
      setMessages(p => [...p, res.data]);
      socketRef.current?.emit("send_message", res.data);
    } catch {}
    setSending(false);
  };

  const searchGifs = async (q) => {
    setGifSearch(q);
    if (!q.trim()) {
      loadTrendingGifs(); return;
    }
    setGifLoading(true);
    try {
        const TKEY = process.env.REACT_APP_TENOR_KEY || "LIVDSRZULELA";
      const res = await fetch(`https://g.tenor.com/v1/search?limit=20&key=${TKEY}&q=`+encodeURIComponent(q));
      const data = await res.json();
      setGifs(data.results || []);
    } catch {} finally { setGifLoading(false); }
  };

  const loadTrendingGifs = async () => {
    setGifLoading(true);
    try {
        const TKEY2 = process.env.REACT_APP_TENOR_KEY || "LIVDSRZULELA";
      const res = await fetch(`https://g.tenor.com/v1/trending?limit=20&key=${TKEY2}`);
      const data = await res.json();
      setGifs(data.results || []);
    } catch {} finally { setGifLoading(false); }
  };

  const openGifPicker = () => {
    setShowGifPicker(true);
    setShowAttachMenu(false);
    loadTrendingGifs();
  };

  const setWallpaperAndSave = async (url) => {
    setWallpaper(url);
    setShowWallpaperPicker(false);
    try {
      const db = await openWallpaperDB();
      const tx = db.transaction("wallpapers","readwrite");
      tx.objectStore("wallpapers").put({ id: "chat_wallpaper_"+userId, url });
    } catch { localStorage.setItem("chat_wallpaper_"+userId, url); }
  };

  const openWallpaperDB = () => new Promise((res, rej) => {
    const req = indexedDB.open("luciagram_wallpapers", 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore("wallpapers", { keyPath: "id" });
    req.onsuccess = e => res(e.target.result);
    req.onerror = rej;
  });

  const setDisappearAndSave = (val) => {
    setDisappearTimer(val);
    localStorage.setItem("chat_disappear_"+userId, val);
    setShowDisappearPicker(false);
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
  const handlePressStart = (msg) => { const t = setTimeout(() => { setSelectedMsg(msg); }, 500); setPressTimer(t); };
  const handlePressEnd = () => clearTimeout(pressTimer);

  const unsendMessage = async (msgId) => {
    setSelectedMsg(null);
    try {
      await API.delete("/messages/" + msgId);
      setMessages(prev => prev.filter(m => m.id !== msgId));
      socketRef.current?.emit("dm_unsend", { receiverId: userId, msgId });
    } catch {}
  };

  const copyMessage = (msg) => {
    navigator.clipboard.writeText(msg.text || "").catch(()=>{});
    setSelectedMsg(null);
  };

  const groupReactions = (reactions = []) => {
    const map = {};
    reactions.forEach(r => { map[r.emoji] = (map[r.emoji] || 0) + 1; });
    return Object.entries(map);
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let item of items) {
      if (item.type.startsWith("image/") || item.type === "image/gif") {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onloadend = () => {
          setMediaData(reader.result);
          setMediaPreview(reader.result);
          setMediaType(item.type === "image/gif" ? "gif" : "image");
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  };


  // Gboard GIF/Sticker handler
  const handleInputDiv = (e) => {
    const div = inputDivRef.current;
    if (!div) return;

    // Gboard <img> insert karta hai contenteditable mein
    const imgs = div.querySelectorAll('img');
    if (imgs.length > 0) {
      const img = imgs[0];
      const src = img.src;
      imgs.forEach(i => i.remove()); // div se img hatao
      div.textContent = '';
      setText('');

      // blob: ya data: url handle karo
      if (src.startsWith('data:')) {
        setMediaData(src);
        setMediaPreview(src);
        setMediaType(src.includes('image/gif') ? 'gif' : 'image');
      } else if (src.startsWith('blob:') || src.startsWith('http')) {
        // blob URL ko fetch karke base64 banao
        fetch(src)
          .then(r => r.blob())
          .then(blob => {
            const reader = new FileReader();
            reader.onloadend = () => {
              setMediaData(reader.result);
              setMediaPreview(reader.result);
              setMediaType(blob.type === 'image/gif' ? 'gif' : 'image');
            };
            reader.readAsDataURL(blob);
          }).catch(() => {
            // fallback: directly use src as mediaUrl
            setMediaData(src);
            setMediaPreview(src);
            setMediaType('gif');
          });
      }
      return;
    }

    // Normal text
    const val = div.textContent || '';
    setText(val);
    handleTyping();
  };

  const avatar = (name) => (name||"U").slice(0,1).toUpperCase();
  const currentTheme = themes[theme] || themes.purple;
  const endCall = () => { setActiveCall(null); setIncomingCall(null); };
  const fmtTime = (s) => Math.floor(s/60).toString().padStart(2,"0") + ":" + (s%60).toString().padStart(2,"0");

  return (
    <>
      {(activeCall || incomingCall) && (
        <CallScreen call={activeCall || incomingCall} socket={socketRef.current} user={user} onEnd={endCall} />
      )}
      <div style={{background:"#0a0a0f",height:"100vh",color:"white",display:"flex",flexDirection:"column",maxWidth:"100vw",overflow:"hidden",
        backgroundImage: wallpaper ? `url(${wallpaper})` : "none",
        backgroundSize:"cover", backgroundPosition:"center"}}>

      {/* Header */}
      <div style={{background:"rgba(10,10,15,0.92)",borderBottom:"1px solid #1e1e2e",padding:"0.6rem 1rem",display:"flex",alignItems:"center",gap:"0.75rem",position:"sticky",top:0,zIndex:100,flexShrink:0,backdropFilter:"blur(10px)"}}>
        <span onClick={()=>navigate("/messages")} style={{cursor:"pointer",fontSize:"1.3rem",flexShrink:0}}>←</span>
        <div style={{cursor:"pointer",flexShrink:0}} onClick={()=>otherUser?.avatar ? setAvatarPreview(otherUser.avatar) : navigate("/user/"+username)}>
          {otherUser?.avatar ? (
            <img src={otherUser.avatar} alt={username} style={{width:"40px",height:"40px",borderRadius:"50%",objectFit:"cover",border:"2px solid #7c3aed"}} />
          ) : (
            <div style={{width:"40px",height:"40px",borderRadius:"50%",background:currentTheme,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:"1rem"}}>{avatar(username)}</div>
          )}
        </div>
        <div onClick={()=>navigate("/user/"+username)} style={{flex:1,cursor:"pointer"}}>
          <div style={{fontWeight:"bold",fontSize:"1rem"}}>@{username}</div>
          <div style={{fontSize:"0.72rem",color:"#888"}}>
            {isTyping ? <span style={{color:"#7c3aed"}}>typing...</span> :
             disappearTimer ? <span style={{color:"#f59e0b"}}>⏳ {DISAPPEAR_OPTIONS.find(o=>o.value===disappearTimer)?.label}</span> :
             "Luciagram user"}
          </div>
        </div>
        <div style={{display:"flex",gap:"0.75rem",alignItems:"center"}}>
          <span onClick={()=>setShowDisappearPicker(true)} style={{fontSize:"1.1rem",cursor:"pointer"}}>⏳</span>
          <span onClick={()=>setShowWallpaperPicker(true)} style={{fontSize:"1.1rem",cursor:"pointer"}}>🖼️</span>
          <span onClick={()=>setShowFontPicker(true)} style={{fontSize:"1.1rem",cursor:"pointer"}}>🔤</span>
          <span onClick={()=>setShowThemes(!showThemes)} style={{fontSize:"1.1rem",cursor:"pointer"}}>🎨</span>
          <span onClick={()=>setActiveCall({ receiverId: userId, receiverUsername: username, receiverAvatar: otherUser?.avatar||"", callType:"audio" })} style={{fontSize:"1.1rem",cursor:"pointer"}}>📞</span>
          <span onClick={()=>setActiveCall({ receiverId: userId, receiverUsername: username, receiverAvatar: otherUser?.avatar||"", callType:"video" })} style={{fontSize:"1.1rem",cursor:"pointer"}}>🎥</span>
        </div>
      </div>

      {showThemes && (
        <div style={{background:"rgba(19,19,26,0.95)",padding:"0.75rem 1rem",borderBottom:"1px solid #1e1e2e",display:"flex",gap:"0.75rem",alignItems:"center",flexWrap:"wrap",backdropFilter:"blur(10px)"}}>
          <span style={{color:"#888",fontSize:"0.85rem"}}>Theme:</span>
          {Object.entries(themes).map(([name, grad]) => (
            <div key={name} onClick={()=>setThemeAndSave(name)} style={{width:"28px",height:"28px",borderRadius:"50%",background:grad,cursor:"pointer",border:theme===name?"3px solid white":"3px solid transparent"}} />
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"0.75rem 1rem",display:"flex",flexDirection:"column",gap:"0.5rem"}}>
        {messages.map((m,i) => {
          const isMe = m.senderId === user?.id;
          const isAudio = m.mediaType === "audio";
          const isGif = m.mediaType === "gif";
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
                {m.replyTo && (
                  <div style={{background:"rgba(255,255,255,0.06)",borderLeft:"3px solid rgba(255,255,255,0.4)",borderRadius:"6px",padding:"0.25rem 0.5rem",marginBottom:"0.3rem",fontSize:"0.75rem",opacity:0.85}}>
                    <div style={{fontWeight:"bold",marginBottom:"1px"}}>@{m.replyTo.senderUsername}</div>
                    <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"180px"}}>{m.replyTo.mediaType?"📎 Media":m.replyTo.text}</div>
                  </div>
                )}
                {isAudio && m.mediaUrl ? (
                  <div style={{background:isMe?currentTheme:"#1e1e2e",borderRadius:"18px",padding:"0.6rem 1rem",display:"flex",alignItems:"center",gap:"0.75rem",minWidth:"180px"}}>
                    <span style={{fontSize:"1.3rem",cursor:"pointer"}} onClick={()=>{const a=new Audio(m.mediaUrl);a.play();}}>▶️</span>
                    <div style={{flex:1}}>
                      <div style={{height:"3px",background:"rgba(255,255,255,0.25)",borderRadius:"2px"}}>
                        <div style={{width:"40%",height:"100%",background:"rgba(255,255,255,0.7)",borderRadius:"2px"}} />
                      </div>
                    </div>
                    <span style={{fontSize:"0.72rem",opacity:0.7}}>🎙️</span>
                  </div>
                ) : isGif && m.mediaUrl ? (
                  <img src={m.mediaUrl} alt="gif" style={{maxWidth:"240px",maxHeight:"200px",borderRadius:"12px",display:"block"}} />
                ) : m.mediaUrl ? (() => {
                  const url = m.mediaUrl || "";
                  const isVideo = url.includes(".mp4") || url.includes("video") || (m.mediaType === "video");
                  const isShared = m.text && (m.text.includes("Shared a Reel") || m.text.includes("Shared a Post") || m.text.includes("Shared a Story"));
                  return (
                    <div style={{borderRadius:"12px",overflow:"hidden",marginBottom:isShared?"0":"0.3rem"}}>
                      {isShared && (
                        <div style={{background:"rgba(124,58,237,0.15)",borderRadius:"12px 12px 0 0",padding:"0.4rem 0.75rem",fontSize:"0.78rem",color:"#a78bfa",fontWeight:"bold"}}>
                          {m.text.includes("Reel")?"🎬 Shared a Reel":m.text.includes("Story")?"📖 Shared a Story":"📸 Shared a Post"}
                        </div>
                      )}
                      {isVideo ? (
                        <video src={url} controls playsInline style={{width:"100%",maxWidth:"280px",borderRadius:isShared?"0 0 12px 12px":"12px",maxHeight:"320px",display:"block",background:"#000"}} />
                      ) : (
                        <img src={url} alt="media" style={{width:"100%",maxWidth:"280px",borderRadius:isShared?"0 0 12px 12px":"12px",maxHeight:"320px",objectFit:"cover",display:"block"}} />
                      )}
                    </div>
                  );
                })() : null}
                {m.music && (
                  <div onClick={()=>{if(musicAudioRef.current){musicAudioRef.current.src=m.music.previewUrl;musicAudioRef.current.play().catch(()=>{});}}}
                    style={{background:isMe?currentTheme:"#1e1e2e",borderRadius:"14px",padding:"0.6rem 0.75rem",width:"220px",cursor:"pointer",marginBottom:"0.2rem"}}>
                    <div style={{display:"flex",gap:"0.6rem",alignItems:"center"}}>
                      {m.music.albumArt && <img src={m.music.albumArt} alt={m.music.title} style={{width:"44px",height:"44px",borderRadius:"8px",objectFit:"cover",flexShrink:0}} />}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:"0.82rem",fontWeight:"bold",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.music.title}</div>
                        <div style={{fontSize:"0.72rem",opacity:0.7,marginTop:"2px"}}>{m.music.artist}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginTop:"0.4rem"}}>
                      <span style={{fontSize:"0.9rem"}}>🎷</span>
                      <div style={{flex:1,height:"3px",background:"rgba(255,255,255,0.2)",borderRadius:"2px"}}><div style={{width:"35%",height:"100%",background:"rgba(255,255,255,0.6)",borderRadius:"2px"}} /></div>
                      <span style={{fontSize:"0.68rem",opacity:0.6}}>0:30</span>
                    </div>
                  </div>
                )}
                {m.text && !isAudio && !(m.mediaUrl && (m.text.includes("Shared a Reel") || m.text.includes("Shared a Post") || m.text.includes("Shared a Story"))) && (
                  <div style={{background:isMe?currentTheme:"rgba(30,30,46,0.85)",padding:"0.55rem 0.9rem",borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px",fontSize:"0.95rem",wordBreak:"break-word",lineHeight:1.4,fontFamily:currentFont,backdropFilter:wallpaper?"blur(4px)":"none"}}>
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
<div style={{background:"rgba(30,30,46,0.85)",padding:"0.55rem 0.9rem",borderRadius:"18px 18px 18px 4px",backdropFilter:wallpaper?"blur(4px)":"none"}}>
              <div style={{display:"flex",gap:"3px",alignItems:"center"}}>
                {[0,1,2].map(i => <div key={i} style={{width:"6px",height:"6px",borderRadius:"50%",background:"#888",animation:`bounce 1s ${i*0.2}s infinite`}} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Recording UI */}
      {recording && (
        <div style={{padding:"0.75rem 1rem",background:"rgba(19,19,26,0.95)",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.75rem",backdropFilter:"blur(10px)"}}>
          <div style={{width:"10px",height:"10px",borderRadius:"50%",background:"#ef4444",animation:"pulse 1s infinite"}} />
          <span style={{color:"#ef4444",fontWeight:"bold",fontSize:"0.95rem"}}>Recording {fmtTime(recordingTime)}</span>
          <div style={{flex:1}} />
          <button onClick={cancelRecording} style={{background:"transparent",border:"1px solid #555",borderRadius:"20px",color:"#888",padding:"0.35rem 0.9rem",cursor:"pointer",fontSize:"0.85rem"}}>Cancel</button>
          <button onClick={stopRecording} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"20px",color:"white",padding:"0.35rem 0.9rem",cursor:"pointer",fontSize:"0.85rem",fontWeight:"bold"}}>Stop ■</button>
        </div>
      )}

      {audioUrl && !recording && (
        <div style={{padding:"0.75rem 1rem",background:"rgba(19,19,26,0.95)",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.75rem",backdropFilter:"blur(10px)"}}>
          <audio src={audioUrl} controls style={{flex:1,height:"36px"}} />
          <span onClick={cancelRecording} style={{color:"#f87171",cursor:"pointer",fontSize:"1.2rem"}}>✕</span>
        </div>
      )}

      {mediaPreview && !recording && (
        <div style={{padding:"0.5rem 1rem",background:"rgba(19,19,26,0.95)",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.75rem",backdropFilter:"blur(10px)"}}>
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
        <div style={{padding:"0.5rem 1rem",background:"rgba(19,19,26,0.95)",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.75rem",backdropFilter:"blur(10px)"}}>
          <div style={{flex:1,borderLeft:"3px solid #7c3aed",paddingLeft:"0.5rem"}}>
            <div style={{fontSize:"0.72rem",color:"#a78bfa"}}>@{replyTo.senderUsername}</div>
            <div style={{fontSize:"0.82rem",color:"#888",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"240px"}}>
              {replyTo.mediaType?"📎 Media":replyTo.text}
            </div>
          </div>
          <span onClick={()=>setReplyTo(null)} style={{color:"#f87171",cursor:"pointer",fontSize:"1.2rem"}}>✕</span>
        </div>
      )}

      {chatMusic && (
        <div style={{padding:"0.5rem 1rem",background:"rgba(19,19,26,0.95)",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.75rem",backdropFilter:"blur(10px)"}}>
          {chatMusic.albumArt && <img src={chatMusic.albumArt} alt={chatMusic.title} style={{width:"40px",height:"40px",borderRadius:"8px",objectFit:"cover",flexShrink:0}} />}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"0.82rem",fontWeight:"bold",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🎵 {chatMusic.title}</div>
            <div style={{fontSize:"0.72rem",color:"#888"}}>{chatMusic.artist}</div>
          </div>
          <span onClick={()=>setChatMusic(null)} style={{color:"#f87171",cursor:"pointer",fontSize:"1.2rem"}}>✕</span>
        </div>
      )}

      {/* Input Bar */}
      <div style={{padding:"0.6rem 0.75rem",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.5rem",background:"rgba(10,10,15,0.92)",flexShrink:0,backdropFilter:"blur(10px)"}}>
        <span onClick={()=>setShowAttachMenu(v=>!v)} style={{fontSize:"1.3rem",cursor:"pointer"}}>➕</span>
        <span onClick={()=>setShowMusicPicker(true)} style={{fontSize:"1.3rem",cursor:"pointer"}}>🎵</span>
        <div style={{flex:1,position:"relative",display:"flex",alignItems:"center"}}>
          <div
            ref={inputDivRef}
            contentEditable
            suppressContentEditableWarning
            onInput={e => {
              // Gboard GIF/sticker handling
              const event = e.nativeEvent;
              if (event.inputType === 'insertContent' || event.inputType === 'insertFromPaste') {
                const dt = event.dataTransfer;
                if (dt && dt.files && dt.files.length > 0) {
                  const file = dt.files[0];
                  if (file.type.startsWith('image/')) {
                    e.preventDefault();
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setMediaData(reader.result);
                      setMediaPreview(reader.result);
                      setMediaType(file.type === 'image/gif' ? 'gif' : 'image');
                    };
                    reader.readAsDataURL(file);
                    inputDivRef.current.textContent = '';
                    return;
                  }
                }
              }
              const val = e.currentTarget.textContent || '';
              setText(val);
              handleTyping();
            }}
            onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),sendMessage())}
            onPaste={handlePaste}
            data-placeholder="Message..."
            style={{flex:1,background:"#1e1e2e",border:"none",borderRadius:"20px",padding:"0.55rem 0.9rem",color:"white",fontSize:"0.95rem",outline:"none",minWidth:0,minHeight:"36px",maxHeight:"100px",overflowY:"auto",wordBreak:"break-word",display:"flex",alignItems:"center"}}
          />
          <style>{`[data-placeholder]:empty:before{content:attr(data-placeholder);color:#666;pointer-events:none;position:absolute;left:0.9rem}`}</style>
        </div>
        <span onClick={openGifPicker} style={{fontSize:"1.2rem",cursor:"pointer",flexShrink:0}} title="GIF">🎞️</span>
        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleMedia} style={{display:"none"}} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleMedia} style={{display:"none"}} />
        {text || mediaData || audioUrl ? (
          <button onClick={sendMessage} disabled={sending} style={{background:currentTheme,border:"none",borderRadius:"50%",width:"36px",height:"36px",color:"white",cursor:"pointer",fontSize:"1rem",flexShrink:0}}>➤</button>
        ) : recording ? null : (
          <span
            onTouchStart={startRecording}
            onMouseDown={startRecording}
            style={{fontSize:"1.4rem",cursor:"pointer",flexShrink:0,userSelect:"none"}}>🎙️</span>
        )}
      </div>

      {/* Attach Menu */}
      {showAttachMenu && (
        <div style={{position:"fixed",bottom:"70px",left:"0.75rem",zIndex:300,background:"#1a1a2e",borderRadius:"16px",padding:"0.75rem",display:"flex",gap:"0.75rem",flexWrap:"wrap",maxWidth:"280px",boxShadow:"0 8px 32px rgba(0,0,0,0.6)"}}>
          <div onClick={()=>{fileRef.current?.click();setShowAttachMenu(false);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.3rem",cursor:"pointer",minWidth:"56px"}}>
            <div style={{width:"48px",height:"48px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem"}}>📎</div>
            <span style={{fontSize:"0.65rem",color:"#888"}}>File</span>
          </div>
          <div onClick={()=>{cameraRef.current?.click();setShowAttachMenu(false);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.3rem",cursor:"pointer",minWidth:"56px"}}>
            <div style={{width:"48px",height:"48px",borderRadius:"12px",background:"linear-gradient(135deg,#1d4ed8,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem"}}>📸</div>
            <span style={{fontSize:"0.65rem",color:"#888"}}>Camera</span>
          </div>
          <div onClick={openGifPicker} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.3rem",cursor:"pointer",minWidth:"56px"}}>
            <div style={{width:"48px",height:"48px",borderRadius:"12px",background:"linear-gradient(135deg,#f59e0b,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem"}}>😂</div>
            <span style={{fontSize:"0.65rem",color:"#888"}}>GIF</span>
          </div>
          <div onClick={()=>{setShowMusicPicker(true);setShowAttachMenu(false);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.3rem",cursor:"pointer",minWidth:"56px"}}>
            <div style={{width:"48px",height:"48px",borderRadius:"12px",background:"linear-gradient(135deg,#10b981,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem"}}>🎵</div>
            <span style={{fontSize:"0.65rem",color:"#888"}}>Music</span>
          </div>
        </div>
      )}

      {/* GIF Picker */}
      {showGifPicker && (
        <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowGifPicker(false)} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
          <div style={{background:"#13131a",borderRadius:"20px 20px 0 0",padding:"1rem",maxHeight:"65vh",display:"flex",flexDirection:"column"}}>
            <div style={{width:"40px",height:"4px",background:"#333",borderRadius:"2px",margin:"0 auto 0.75rem"}} />
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem",background:"#1e1e2e",borderRadius:"12px",padding:"0.5rem 0.75rem",marginBottom:"0.75rem"}}>
              <span style={{color:"#888"}}>🔍</span>
              <input value={gifSearch} onChange={e=>searchGifs(e.target.value)} placeholder="Search GIFs, memes, stickers..."
                style={{flex:1,background:"transparent",border:"none",color:"white",fontSize:"0.95rem",outline:"none"}} autoFocus />
            </div>
            <div style={{display:"flex",gap:"0.5rem",marginBottom:"0.75rem",flexWrap:"wrap"}}>
              {["😂 Meme","💀 Skull","🤣 Funny","🎉 Party","❤️ Love","🔥 Fire","😭 Sad","🐱 Cat","🐶 Dog","💅 Slay"].map(tag => (
                <span key={tag} onClick={()=>searchGifs(tag.split(" ")[1])}
                  style={{background:"#1e1e2e",borderRadius:"20px",padding:"0.25rem 0.75rem",fontSize:"0.8rem",cursor:"pointer",color:"#a78bfa"}}>{tag}</span>
              ))}
            </div>
            {gifLoading ? (
              <div style={{textAlign:"center",padding:"2rem",color:"#888"}}>Loading...</div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"4px",overflowY:"auto",flex:1}}>
                {gifs.map((gif, i) => {
                  const url = gif.media?.[0]?.gif?.url || gif.media?.[0]?.tinygif?.url || "";
                  return url ? (
                    <img key={i} src={url} alt="gif" onClick={()=>sendGif(url)}
                      style={{width:"100%",height:"100px",objectFit:"cover",borderRadius:"8px",cursor:"pointer"}} />
                  ) : null;
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wallpaper Picker */}
      {showWallpaperPicker && (
        <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowWallpaperPicker(false)} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
          <div style={{background:"#13131a",borderRadius:"20px 20px 0 0",padding:"1.25rem 1rem"}}>
            <div style={{width:"40px",height:"4px",background:"#333",borderRadius:"2px",margin:"0 auto 1rem"}} />
            <div style={{fontWeight:"bold",fontSize:"1rem",marginBottom:"1rem"}}>🖼️ Chat Wallpaper</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"0.5rem",marginBottom:"1rem"}}>
              {WALLPAPERS.map(w => (
                <div key={w.id} onClick={()=>setWallpaperAndSave(w.url||"")}
                  style={{height:"70px",borderRadius:"10px",overflow:"hidden",cursor:"pointer",border:wallpaper===(w.url||"")?"2px solid #7c3aed":"2px solid transparent",
                    background:w.url?undefined:w.color,backgroundImage:w.url?`url(${w.url})`:"none",backgroundSize:"cover",backgroundPosition:"center",
                    display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:"4px"}}>
                  <span style={{fontSize:"0.6rem",color:"white",background:"rgba(0,0,0,0.5)",borderRadius:"4px",padding:"1px 4px"}}>{w.label}</span>
                </div>
              ))}
            </div>
            <input ref={wallpaperInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
              const file = e.target.files[0]; if(!file) return;
              const reader = new FileReader();
              reader.onloadend = () => setWallpaperAndSave(reader.result);
              reader.readAsDataURL(file);
            }} />
            <button onClick={()=>wallpaperInputRef.current?.click()}
              style={{width:"100%",background:"#1e1e2e",border:"1px solid #333",borderRadius:"12px",color:"white",padding:"0.75rem",cursor:"pointer",fontWeight:"bold"}}>
              📁 Choose from Gallery
            </button>
          </div>
        </div>
      )}

      {/* Disappear Picker */}
      {showDisappearPicker && (
        <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowDisappearPicker(false)} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
          <div style={{background:"#13131a",borderRadius:"20px 20px 0 0",padding:"1.25rem 1rem"}}>
            <div style={{width:"40px",height:"4px",background:"#333",borderRadius:"2px",margin:"0 auto 1rem"}} />
            <div style={{fontWeight:"bold",fontSize:"1rem",marginBottom:"0.5rem"}}>⏳ Disappearing Messages</div>
            <div style={{color:"#888",fontSize:"0.82rem",marginBottom:"1rem"}}>Messages disappear locally after selected time</div>
            {DISAPPEAR_OPTIONS.map(opt => (
              <div key={opt.value} onClick={()=>setDisappearAndSave(opt.value)}
                style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#1e1e2e",borderRadius:"12px",padding:"0.75rem 1rem",cursor:"pointer",marginBottom:"0.5rem",border:disappearTimer===opt.value?"1px solid #7c3aed":"1px solid transparent"}}>
                <span style={{fontSize:"0.95rem"}}>{opt.label}</span>
                {disappearTimer===opt.value && <span style={{color:"#7c3aed",fontWeight:"bold"}}>✓</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {avatarPreview && (
        <div onClick={()=>setAvatarPreview(null)} style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <img src={avatarPreview} alt="avatar" style={{width:"80vw",height:"80vw",borderRadius:"50%",objectFit:"cover",border:"3px solid #7c3aed"}} />
        </div>
      )}
{selectedMsg && (
        <div onClick={()=>setSelectedMsg(null)} style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#1e1e2e",borderRadius:"16px",padding:"1rem",minWidth:"200px",boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
            <div style={{fontSize:"0.75rem",color:"#888",marginBottom:"0.75rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selectedMsg.text||"Media message"}</div>
            {selectedMsg.text && (
              <button onClick={()=>copyMessage(selectedMsg)}
                style={{width:"100%",background:"transparent",border:"1px solid #444",borderRadius:"10px",color:"white",padding:"0.6rem",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem",marginBottom:"0.5rem"}}>
                📋 Copy Message
              </button>
            )}
            <button onClick={()=>setReplyTo(selectedMsg)}
              style={{width:"100%",background:"transparent",border:"1px solid #7c3aed",borderRadius:"10px",color:"#a78bfa",padding:"0.6rem",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem",marginBottom:"0.5rem"}}
              onClickCapture={()=>setSelectedMsg(null)}>
              ↩️ Reply
            </button>
            {selectedMsg.senderId === user?.id && (
              <button onClick={()=>unsendMessage(selectedMsg.id)}
                style={{width:"100%",background:"transparent",border:"1px solid #ef4444",borderRadius:"10px",color:"#ef4444",padding:"0.6rem",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem"}}>
                🗑 Unsend
              </button>
            )}
          </div>
        </div>
      )}

      {reactionPicker && (
        <div onClick={()=>{setReactionPicker(null);setShowEmojiInput(false);}} style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#1e1e2e",borderRadius:"30px",padding:"0.75rem 1rem",boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
            <div style={{display:"flex",gap:"0.5rem"}}>
              {["❤️","😂","😮","😢","😡","👍","🔥","🎉"].map(emoji => (
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

      <audio ref={musicAudioRef} />
      {showMusicPicker && <MusicPicker selectedMusic={chatMusic} onSelect={t=>{setChatMusic(t);setShowMusicPicker(false);}} onClose={()=>setShowMusicPicker(false)} />}
      <style>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #555;
          pointer-events: none;
        }
      `}</style>
      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
    </>
  );
}
