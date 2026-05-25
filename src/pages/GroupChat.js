import React, { useEffect, useState, useRef } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useParams, useLocation } from "react-router-dom";

export default function GroupChat() {
  const { groupId } = useParams();
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [view, setView] = useState("list");
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [sending, setSending] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const bottomRef = useRef();

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("luciagram_groups") || "[]");
    setGroups(saved);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (activeGroup) {
      const interval = setInterval(() => {
        const saved = JSON.parse(localStorage.getItem("luciagram_groups") || "[]");
        const g = saved.find(g => g.id === activeGroup.id);
        if (g) setMessages(g.messages || []);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [activeGroup]);

  const createGroup = () => {
    if (!groupName.trim()) return;
    const group = {
      id: Date.now().toString(),
      name: groupName,
      createdBy: user?.username,
      createdById: user?.id,
      members: [{ id: user?.id, username: user?.username, avatar: user?.avatar }],
      messages: [],
      createdAt: new Date(),
    };
    const updated = [...groups, group];
    setGroups(updated);
    localStorage.setItem("luciagram_groups", JSON.stringify(updated));
    setGroupName("");
    setShowCreate(false);
    openGroup(group);
  };

  const openGroup = (group) => {
    setActiveGroup(group);
    setMessages(group.messages || []);
    setView("chat");
  };

  const sendMessage = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const msg = {
      id: Date.now().toString(),
      senderId: user?.id,
      senderUsername: user?.username,
      senderAvatar: user?.avatar,
      text,
      createdAt: new Date(),
    };
    const updatedMsgs = [...messages, msg];
    setMessages(updatedMsgs);
    setText("");

    const saved = JSON.parse(localStorage.getItem("luciagram_groups") || "[]");
    const updated = saved.map(g =>
      g.id === activeGroup.id ? { ...g, messages: updatedMsgs } : g
    );
    setGroups(updated);
    localStorage.setItem("luciagram_groups", JSON.stringify(updated));
    setSending(false);
  };

  const avatar = (name) => (name||"U").slice(0,1).toUpperCase();
  const gradients = ["linear-gradient(135deg,#7c3aed,#db2777)","linear-gradient(135deg,#f59e0b,#ef4444)","linear-gradient(135deg,#10b981,#3b82f6)"];

  if (view === "chat" && activeGroup) return (
    <div style={{background:"#0a0a0f",height:"100vh",color:"white",display:"flex",flexDirection:"column"}}>
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",alignItems:"center",gap:"0.75rem",position:"sticky",top:0,zIndex:100}}>
        <span onClick={()=>setView("list")} style={{cursor:"pointer",fontSize:"1.3rem"}}>←</span>
        <div style={{width:"36px",height:"36px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem"}}>👥</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:"bold"}}>{activeGroup.name}</div>
          <div style={{fontSize:"0.75rem",color:"#888"}}>{activeGroup.members?.length||1} members · Created by @{activeGroup.createdBy}</div>
        </div>
        <span style={{fontSize:"1.2rem",cursor:"pointer"}}>ℹ️</span>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"1rem",display:"flex",flexDirection:"column",gap:"0.75rem"}}>
        {/* Welcome message */}
        <div style={{textAlign:"center",color:"#555",fontSize:"0.8rem",padding:"0.5rem"}}>
          🔒 Group created by @{activeGroup.createdBy}
        </div>

        {messages.map((m,i) => {
          const isMe = m.senderId === user?.id;
          return (
            <div key={m.id||i} style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start",alignItems:"flex-end",gap:"0.5rem"}}>
              {!isMe && (
                <div style={{width:"28px",height:"28px",borderRadius:"50%",background:gradients[i%3],display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",flexShrink:0,fontWeight:"bold"}}>
                  {m.senderAvatar ? <img src={m.senderAvatar} style={{width:"100%",height:"100%",borderRadius:"50%",objectFit:"cover"}} alt="a"/> : avatar(m.senderUsername)}
                </div>
              )}
              <div style={{maxWidth:"70%"}}>
                {!isMe && <div style={{fontSize:"0.7rem",color:"#c084fc",marginBottom:"0.2rem"}}>@{m.senderUsername}</div>}
                <div style={{background:isMe?"linear-gradient(135deg,#7c3aed,#db2777)":"#1e1e2e",padding:"0.6rem 1rem",borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px",fontSize:"0.95rem",wordBreak:"break-word"}}>{m.text}</div>
                <div style={{fontSize:"0.7rem",color:"#555",marginTop:"0.2rem",textAlign:isMe?"right":"left"}}>{new Date(m.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{padding:"0.75rem 1rem",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.75rem",background:"#0a0a0f"}}>
        <span style={{fontSize:"1.4rem",cursor:"pointer"}}>😊</span>
        <input
          value={text}
          onChange={e=>setText(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&sendMessage()}
          placeholder="Message group..."
          style={{flex:1,background:"#1e1e2e",border:"none",borderRadius:"20px",padding:"0.6rem 1rem",color:"white",fontSize:"0.95rem",outline:"none"}}
        />
        <span style={{fontSize:"1.4rem",cursor:"pointer"}}>📎</span>
        {text ? (
          <button onClick={sendMessage} disabled={sending} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"50%",width:"36px",height:"36px",color:"white",cursor:"pointer",fontSize:"1rem"}}>➤</button>
        ) : (
          <span style={{fontSize:"1.4rem",cursor:"pointer"}}>❤️</span>
        )}
      </div>
    </div>
  );

  return (
    <div style={{background:"#0a0a0f",minHeight:"100vh",color:"white",paddingBottom:"70px"}}>
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100}}>
        <span onClick={()=>navigate("/messages")} style={{cursor:"pointer",fontSize:"1.3rem"}}>←</span>
        <span style={{fontWeight:"bold",fontSize:"1.1rem"}}>👥 Group Chats</span>
        <button onClick={()=>setShowCreate(true)} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"8px",color:"white",padding:"0.4rem 0.8rem",cursor:"pointer",fontSize:"0.85rem",fontWeight:"bold"}}>+ New</button>
      </div>

      {showCreate && (
        <div style={{padding:"1rem",background:"#13131a",borderBottom:"1px solid #1e1e2e"}}>
          <p style={{color:"#888",fontSize:"0.85rem",margin:"0 0 0.75rem"}}>Create new group:</p>
          <div style={{display:"flex",gap:"0.75rem"}}>
            <input
              value={groupName}
              onChange={e=>setGroupName(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&createGroup()}
              placeholder="Group name..."
              style={{flex:1,background:"#1e1e2e",border:"none",borderRadius:"8px",padding:"0.6rem 1rem",color:"white",fontSize:"0.9rem",outline:"none"}}
              autoFocus
            />
            <button onClick={createGroup} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"8px",color:"white",padding:"0.6rem 1rem",cursor:"pointer",fontWeight:"bold"}}>Create</button>
            <button onClick={()=>setShowCreate(false)} style={{background:"#1e1e2e",border:"none",borderRadius:"8px",color:"#888",padding:"0.6rem 1rem",cursor:"pointer"}}>✕</button>
          </div>
        </div>
      )}

      <div style={{padding:"1rem"}}>
        {groups.length === 0 ? (
          <div style={{textAlign:"center",color:"#888",padding:"3rem"}}>
            <div style={{fontSize:"3rem",marginBottom:"1rem"}}>👥</div>
            <p>No group chats yet</p>
            <button onClick={()=>setShowCreate(true)} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"8px",color:"white",padding:"0.5rem 1rem",cursor:"pointer",fontWeight:"bold"}}>Create First Group</button>
          </div>
        ) : groups.map((g,i) => (
          <div key={g.id||i} onClick={()=>openGroup(g)} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.75rem",background:"#13131a",borderRadius:"12px",marginBottom:"0.75rem",cursor:"pointer",border:"1px solid #1e1e2e"}}>
            <div style={{width:"50px",height:"50px",borderRadius:"50%",background:gradients[i%3],display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem",flexShrink:0}}>👥</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:"bold"}}>{g.name}</div>
              <div style={{color:"#888",fontSize:"0.8rem"}}>Created by @{g.createdBy}</div>
              <div style={{color:"#555",fontSize:"0.75rem",marginTop:"0.2rem"}}>{g.messages?.length||0} messages</div>
            </div>
            {g.messages?.length > 0 && (
              <div style={{color:"#888",fontSize:"0.8rem",maxWidth:"100px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {g.messages[g.messages.length-1]?.text}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0a0a0f",borderTop:"1px solid #1e1e2e",display:"flex",justifyContent:"space-around",padding:"0.75rem 0",zIndex:100}}>
        <span onClick={()=>navigate("/")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🏠</span>
        <span onClick={()=>navigate("/search")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🔍</span>
        <div onClick={()=>navigate("/upload")} style={{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1.2rem"}}>+</div>
        <span onClick={()=>navigate("/reels")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🎬</span>
        <div onClick={()=>navigate("/profile")} style={{width:"28px",height:"28px",borderRadius:"50%",overflow:"hidden",cursor:"pointer",border:"2px solid #7c3aed"}}>
          {user?.avatar?<img src={user.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="p"/>:<div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",fontWeight:"bold"}}>{avatar(user?.username)}</div>}
        </div>
      </div>
    </div>
  );
}
