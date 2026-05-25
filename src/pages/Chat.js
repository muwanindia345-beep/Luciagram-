import React, { useEffect, useState, useRef } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useParams, useLocation } from "react-router-dom";

export default function Chat() {
  const { userId } = useParams();
  const location = useLocation();
  const username = new URLSearchParams(location.search).get("username");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const bottomRef = useRef();

  useEffect(() => {
    API.get("/messages/" + userId).then(r => setMessages(r.data)).catch(()=>{});
    const interval = setInterval(() => {
      API.get("/messages/" + userId).then(r => setMessages(r.data)).catch(()=>{});
    }, 3000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await API.post("/messages", { receiverId: userId, receiverUsername: username, text });
      setMessages(p => [...p, res.data]);
      setText("");
    } catch {}
    setSending(false);
  };

  const avatar = (name) => (name||"U").slice(0,1).toUpperCase();

  return (
    <div style={{background:"#0a0a0f",height:"100dvh",color:"white",display:"flex",flexDirection:"column"}}>
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",alignItems:"center",gap:"0.75rem",position:"sticky",top:0,zIndex:100}}>
        <span onClick={()=>navigate("/messages")} style={{cursor:"pointer",fontSize:"1.3rem"}}>←</span>
        <div style={{width:"36px",height:"36px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold"}}>{avatar(username)}</div>
        <div>
          <div style={{fontWeight:"bold"}}>@{username}</div>
          <div style={{color:"#888",fontSize:"0.75rem"}}>Active now</div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:"1rem",fontSize:"1.3rem"}}>
          <span style={{cursor:"pointer"}}>📞</span>
          <span style={{cursor:"pointer"}}>🎥</span>
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"1rem",display:"flex",flexDirection:"column",gap:"0.5rem"}}>
        {messages.map((m,i) => {
          const isMe = m.senderId === user?.id;
          return (
            <div key={m.id||i} style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start",alignItems:"flex-end",gap:"0.5rem"}}>
              {!isMe && <div style={{width:"28px",height:"28px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",flexShrink:0}}>{avatar(username)}</div>}
              <div style={{maxWidth:"70%"}}>
                {m.mediaUrl && <img src={m.mediaUrl} alt="media" style={{width:"100%",borderRadius:"12px",marginBottom:"0.3rem"}} />}
                {m.text && <div style={{background:isMe?"linear-gradient(135deg,#7c3aed,#db2777)":"#1e1e2e",padding:"0.6rem 1rem",borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px",fontSize:"0.95rem",wordBreak:"break-word"}}>{m.text}</div>}
                <div style={{fontSize:"0.7rem",color:"#555",marginTop:"0.2rem",textAlign:isMe?"right":"left"}}>{new Date(m.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})} {isMe && (m.isRead ? "✓✓" : "✓")}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{padding:"0.75rem 1rem",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.75rem",background:"#0a0a0f"}}>
        <span style={{fontSize:"1.5rem",cursor:"pointer"}}>😊</span>
        <input
          value={text}
          onChange={e=>setText(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&sendMessage()}
          placeholder="Message..."
          style={{flex:1,background:"#1e1e2e",border:"none",borderRadius:"20px",padding:"0.6rem 1rem",color:"white",fontSize:"0.95rem",outline:"none"}}
        />
        <span style={{fontSize:"1.5rem",cursor:"pointer"}}>📎</span>
        {text ? (
          <button onClick={sendMessage} disabled={sending} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"50%",width:"36px",height:"36px",color:"white",cursor:"pointer",fontSize:"1rem"}}>➤</button>
        ) : (
          <span style={{fontSize:"1.5rem",cursor:"pointer"}}>❤️</span>
        )}
      </div>
    </div>
  );
}
