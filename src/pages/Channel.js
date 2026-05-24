import React, { useEffect, useState } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";

export default function Channel() {
  const { channelId } = useParams();
  const [messages, setMessages] = useState([]);
  const [channels, setChannels] = useState([]);
  const [text, setText] = useState("");
  const [view, setView] = useState("list");
  const [activeChannel, setActiveChannel] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const isAdmin = activeChannel?.adminId === user?.id;

  useEffect(() => {
    // Load channels from localStorage for now
    const saved = JSON.parse(localStorage.getItem("luciagram_channels") || "[]");
    setChannels(saved);
  }, []);

  const createChannel = () => {
    const name = prompt("Channel name:");
    if (!name) return;
    const channel = {
      id: Date.now().toString(),
      name,
      adminId: user?.id,
      adminUsername: user?.username,
      adminAvatar: user?.avatar,
      members: 1,
      messages: [],
      createdAt: new Date(),
    };
    const updated = [...channels, channel];
    setChannels(updated);
    localStorage.setItem("luciagram_channels", JSON.stringify(updated));
    setActiveChannel(channel);
    setView("channel");
  };

  const joinChannel = (channel) => {
    setActiveChannel(channel);
    setMessages(channel.messages || []);
    setView("channel");
  };

  const sendMessage = () => {
    if (!text.trim() || !isAdmin) return;
    const msg = {
      id: Date.now().toString(),
      text,
      adminUsername: user?.username,
      adminAvatar: user?.avatar,
      createdAt: new Date(),
      reactions: {},
    };
    const updatedMsgs = [...messages, msg];
    setMessages(updatedMsgs);
    const updatedChannels = channels.map(c =>
      c.id === activeChannel.id ? {...c, messages: updatedMsgs} : c
    );
    setChannels(updatedChannels);
    localStorage.setItem("luciagram_channels", JSON.stringify(updatedChannels));
    setText("");
  };

  const addReaction = (msgId, emoji) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const reactions = {...(m.reactions||{})};
      reactions[emoji] = (reactions[emoji]||0) + 1;
      return {...m, reactions};
    }));
  };

  const avatar = (name) => (name||"U").slice(0,1).toUpperCase();

  if (view === "channel" && activeChannel) return (
    <div style={{background:"#0a0a0f",height:"100vh",color:"white",display:"flex",flexDirection:"column"}}>
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",alignItems:"center",gap:"0.75rem",position:"sticky",top:0,zIndex:100}}>
        <span onClick={()=>setView("list")} style={{cursor:"pointer",fontSize:"1.3rem"}}>←</span>
        <div style={{width:"36px",height:"36px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold"}}>📢</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:"bold"}}>{activeChannel.name}</div>
          <div style={{fontSize:"0.75rem",color:"#888"}}>@{activeChannel.adminUsername} · {activeChannel.members} members</div>
        </div>
        {isAdmin && <span style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",padding:"0.2rem 0.6rem",borderRadius:"6px",fontSize:"0.75rem"}}>Admin</span>}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"1rem",display:"flex",flexDirection:"column",gap:"1rem"}}>
        {/* Channel Info */}
        <div style={{background:"#13131a",borderRadius:"16px",padding:"1rem",textAlign:"center",border:"1px solid #2a2a3a"}}>
          <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>📢</div>
          <div style={{fontWeight:"bold",fontSize:"1.1rem"}}>{activeChannel.name}</div>
          <div style={{color:"#888",fontSize:"0.85rem",marginTop:"0.3rem"}}>Channel by @{activeChannel.adminUsername}</div>
          <div style={{color:"#555",fontSize:"0.8rem",marginTop:"0.5rem"}}>Only admins can send messages. Members can react.</div>
        </div>

        {messages.length === 0 && (
          <div style={{textAlign:"center",color:"#888",padding:"2rem"}}>
            {isAdmin ? "Send your first message to the channel!" : "No messages yet. Stay tuned!"}
          </div>
        )}

        {messages.map((m,i) => (
          <div key={m.id||i} style={{background:"#13131a",borderRadius:"16px",padding:"1rem",border:"1px solid #1e1e2e"}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.5rem"}}>
              {activeChannel.adminAvatar ? (
                <img src={activeChannel.adminAvatar} alt="a" style={{width:"28px",height:"28px",borderRadius:"50%",objectFit:"cover"}} />
              ) : (
                <div style={{width:"28px",height:"28px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",fontWeight:"bold"}}>{avatar(m.adminUsername)}</div>
              )}
              <span style={{fontWeight:"bold",color:"#c084fc",fontSize:"0.85rem"}}>@{m.adminUsername}</span>
              <span style={{color:"#555",fontSize:"0.75rem",marginLeft:"auto"}}>{new Date(m.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
            </div>
            <p style={{margin:"0 0 0.75rem",lineHeight:1.5}}>{m.text}</p>
            <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
              {["❤️","🔥","👏","😮","😂"].map(emoji => (
                <button key={emoji} onClick={()=>addReaction(m.id,emoji)} style={{background:"#1e1e2e",border:"1px solid #2a2a3a",borderRadius:"20px",padding:"0.2rem 0.5rem",color:"white",cursor:"pointer",fontSize:"0.85rem"}}>
                  {emoji} {m.reactions?.[emoji]||""}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {isAdmin ? (
        <div style={{padding:"0.75rem 1rem",borderTop:"1px solid #1e1e2e",display:"flex",gap:"0.75rem",alignItems:"center",background:"#0a0a0f"}}>
          <input
            value={text}
            onChange={e=>setText(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&sendMessage()}
            placeholder="Send to channel..."
            style={{flex:1,background:"#1e1e2e",border:"none",borderRadius:"20px",padding:"0.6rem 1rem",color:"white",fontSize:"0.95rem",outline:"none"}}
          />
          <button onClick={sendMessage} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"50%",width:"36px",height:"36px",color:"white",cursor:"pointer",fontSize:"1rem"}}>➤</button>
        </div>
      ) : (
        <div style={{padding:"0.75rem 1rem",borderTop:"1px solid #1e1e2e",background:"#0a0a0f",textAlign:"center",color:"#888",fontSize:"0.85rem"}}>
          👁️ You are viewing this channel. Only admins can send messages.
        </div>
      )}
    </div>
  );

  return (
    <div style={{background:"#0a0a0f",minHeight:"100vh",color:"white",paddingBottom:"70px"}}>
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100}}>
        <span style={{fontWeight:"bold",fontSize:"1.1rem"}}>📢 Channels</span>
        <button onClick={createChannel} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"8px",color:"white",padding:"0.4rem 0.8rem",cursor:"pointer",fontSize:"0.85rem",fontWeight:"bold"}}>+ New Channel</button>
      </div>

      <div style={{padding:"1rem"}}>
        {channels.length === 0 ? (
          <div style={{textAlign:"center",color:"#888",padding:"3rem"}}>
            <div style={{fontSize:"3rem",marginBottom:"1rem"}}>📢</div>
            <p>No channels yet</p>
            <button onClick={createChannel} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"8px",color:"white",padding:"0.5rem 1rem",cursor:"pointer",fontWeight:"bold"}}>Create First Channel</button>
          </div>
        ) : channels.map((c,i) => (
          <div key={c.id||i} onClick={()=>joinChannel(c)} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.75rem",background:"#13131a",borderRadius:"12px",marginBottom:"0.75rem",cursor:"pointer",border:"1px solid #1e1e2e"}}>
            <div style={{width:"50px",height:"50px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem",flexShrink:0}}>📢</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:"bold"}}>{c.name}</div>
              <div style={{color:"#888",fontSize:"0.8rem"}}>@{c.adminUsername} · {c.members} members</div>
              <div style={{color:"#555",fontSize:"0.75rem",marginTop:"0.2rem"}}>{c.messages?.length||0} messages</div>
            </div>
            {c.adminId === user?.id && <span style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",padding:"0.2rem 0.5rem",borderRadius:"6px",fontSize:"0.7rem"}}>Admin</span>}
          </div>
        ))}
      </div>

      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0a0a0f",borderTop:"1px solid #1e1e2e",display:"flex",justifyContent:"space-around",padding:"0.75rem 0",zIndex:100}}>
        <span onClick={()=>navigate("/")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🏠</span>
        <span onClick={()=>navigate("/search")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🔍</span>
        <div onClick={()=>navigate("/upload")} style={{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1.2rem"}}>+</div>
        <span onClick={()=>navigate("/reels")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🎬</span>
        <div onClick={()=>navigate("/profile")} style={{width:"28px",height:"28px",borderRadius:"50%",overflow:"hidden",cursor:"pointer",border:"2px solid #7c3aed"}}>
          {user?.avatar?<img src={user.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="p"/>:<div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",fontWeight:"bold"}}>{(user?.username||"U").slice(0,1).toUpperCase()}</div>}
        </div>
      </div>
    </div>
  );
}
