import React, { useEffect, useState, useRef } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";

export default function Comments() {
  const { postId } = useParams();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [userProfiles, setUserProfiles] = useState({});
  const [replyTo, setReplyTo] = useState(null); // { id, username }
  const [pinnedId, setPinnedId] = useState(null);
  const [holdMenu, setHoldMenu] = useState(null); // comment being long-pressed
  const [holdTimer, setHoldTimer] = useState(null);
  const [commentLikes, setCommentLikes] = useState({}); // { commentId: { count, liked } }
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef();

  useEffect(() => {
    API.get("/comments/" + postId).then(r => {
      setComments(r.data);
      // Load profile pics for all unique usernames
      const usernames = [...new Set(r.data.map(c => c.username))];
      usernames.forEach(username => {
        if (username && username !== user?.username) {
          API.get("/users/" + username).then(res => {
            setUserProfiles(prev => ({...prev, [username]: res.data}));
          }).catch(()=>{});
        }
      });
      // Load comment likes
      r.data.forEach(c => {
        API.get("/comments/" + c.id + "/likes").then(res => {
          setCommentLikes(prev => ({...prev, [c.id]: res.data}));
        }).catch(()=>{});
      });
    }).catch(()=>{});
  }, [postId]);

  const sendComment = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const fullText = replyTo ? "@" + replyTo.username + " " + text.trim() : text.trim();
      const res = await API.post("/comments/" + postId, { text: fullText });
      setComments(p => [...p, res.data]);
      setText("");
      setReplyTo(null);
    } catch {}
    setSending(false);
  };

  const deleteComment = async (id) => {
    try {
      await API.delete("/comments/" + id);
      setComments(p => p.filter(c => c.id !== id));
      if (pinnedId === id) setPinnedId(null);
    } catch {}
  };

  const handleHoldStart = (comment) => {
    const t = setTimeout(() => {
      setHoldMenu(comment);
    }, 500);
    setHoldTimer(t);
  };

  const handleHoldEnd = () => {
    clearTimeout(holdTimer);
    setHoldTimer(null);
  };

  const handleReply = (comment) => {
    setReplyTo({ id: comment.id, username: comment.username });
    setHoldMenu(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handlePin = (comment) => {
    setPinnedId(prev => prev === comment.id ? null : comment.id);
    setHoldMenu(null);
  };

  const handleCommentLike = async (commentId) => {
    const prev = commentLikes[commentId] || { count: 0, liked: false };
    setCommentLikes(p => ({...p, [commentId]: { count: prev.count + (prev.liked ? -1 : 1), liked: !prev.liked }}));
    try {
      await API.post("/comments/" + commentId + "/like");
    } catch {
      setCommentLikes(p => ({...p, [commentId]: prev}));
    }
  };

  const avatar = (name) => (name||"U").slice(0,1).toUpperCase();
  const gradients = ["linear-gradient(135deg,#7c3aed,#db2777)","linear-gradient(135deg,#f59e0b,#ef4444)","linear-gradient(135deg,#10b981,#3b82f6)","linear-gradient(135deg,#8b5cf6,#06b6d4)"];

  const AvatarImg = ({ username, size=36 }) => {
    const profile = username === user?.username ? user : userProfiles[username];
    if (profile?.avatar) {
      return <img src={profile.avatar} alt={username} onClick={()=>username!==user?.username&&navigate("/user/"+username)} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0,cursor:"pointer",border:"2px solid #2a2a3a"}} />;
    }
    return <div onClick={()=>username!==user?.username&&navigate("/user/"+username)} style={{width:size,height:size,borderRadius:"50%",background:gradients[username?.charCodeAt(0)%4||0],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:size*0.38,color:"white",flexShrink:0,cursor:"pointer"}}>{avatar(username)}</div>;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr);
    if (diff < 60000) return "just now";
    if (diff < 3600000) return Math.floor(diff/60000) + "m";
    if (diff < 86400000) return Math.floor(diff/3600000) + "h";
    return Math.floor(diff/86400000) + "d";
  };

  // Pinned comment first
  const sortedComments = pinnedId
    ? [...comments].sort((a,b) => a.id===pinnedId ? -1 : b.id===pinnedId ? 1 : 0)
    : comments;

  return (
    <div style={{background:"#0a0a0f",height:"100vh",color:"white",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <style>{`@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

      {/* Header */}
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",alignItems:"center",gap:"0.75rem",flexShrink:0}}>
        <span onClick={()=>navigate(-1)} style={{cursor:"pointer",fontSize:"1.3rem"}}>←</span>
        <span style={{fontWeight:"bold",fontSize:"1.1rem"}}>Comments</span>
        <span style={{color:"#888",fontSize:"0.85rem",marginLeft:"auto"}}>{comments.length} comments</span>
      </div>

      {/* Comments List */}
      <div style={{flex:1,overflowY:"auto",padding:"0.75rem 1rem"}}>
        {comments.length === 0 ? (
          <div style={{textAlign:"center",color:"#888",marginTop:"4rem"}}>
            <div style={{fontSize:"2.5rem",marginBottom:"0.75rem"}}>💬</div>
            <p style={{fontWeight:"bold",color:"#ccc"}}>No comments yet</p>
            <p style={{fontSize:"0.85rem"}}>Be the first to comment!</p>
          </div>
        ) : sortedComments.map((c,i) => {
          const isPinned = pinnedId === c.id;
          const isMe = c.userId === user?.id;
          return (
            <div
              key={c.id||i}
              style={{display:"flex",gap:"0.75rem",marginBottom:"1rem",alignItems:"flex-start",animation:"slideUp 0.2s ease",position:"relative"}}
              onTouchStart={()=>handleHoldStart(c)}
              onTouchEnd={handleHoldEnd}
              onMouseDown={()=>handleHoldStart(c)}
              onMouseUp={handleHoldEnd}
              onMouseLeave={handleHoldEnd}
            >
              <AvatarImg username={c.username} size={38} />

              <div style={{flex:1}}>
                {isPinned && (
                  <div style={{fontSize:"0.7rem",color:"#7c3aed",marginBottom:"0.25rem",display:"flex",alignItems:"center",gap:"0.3rem"}}>
                    📌 Pinned comment
                  </div>
                )}
                <div style={{background:isPinned?"#1a1040":"#13131a",borderRadius:"14px",padding:"0.6rem 0.85rem",border:isPinned?"1px solid #7c3aed":"1px solid transparent"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.2rem"}}>
                    <span
                      onClick={()=>c.username!==user?.username&&navigate("/user/"+c.username)}
                      style={{fontWeight:"bold",fontSize:"0.85rem",color:"#c084fc",cursor:"pointer"}}
                    >
                      @{c.username}
                    </span>
                    <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                      <span style={{fontSize:"0.7rem",color:"#555"}}>{formatTime(c.createdAt)}</span>
                      {isMe && (
                        <span onClick={()=>deleteComment(c.id)} style={{color:"#f87171",cursor:"pointer",fontSize:"0.85rem"}}>🗑️</span>
                      )}
                    </div>
                  </div>
                  <p style={{margin:0,fontSize:"0.93rem",lineHeight:1.4,wordBreak:"break-word"}}>{c.text}</p>
                </div>

                {/* Reply button */}
                <div style={{display:"flex",gap:"1rem",marginTop:"0.3rem",paddingLeft:"0.5rem"}}>
                  <span
                    onClick={()=>handleReply(c)}
                    style={{fontSize:"0.75rem",color:"#888",cursor:"pointer",fontWeight:"bold"}}
                  >
                    Reply
                  </span>
                  <span
                    onClick={()=>handleCommentLike(c.id)}
                    style={{fontSize:"0.75rem",color:commentLikes[c.id]?.liked?"#f87171":"#888",cursor:"pointer",fontWeight:"bold",display:"flex",alignItems:"center",gap:"0.2rem"}}
                  >
                    {commentLikes[c.id]?.liked ? "❤️" : "🤍"} {commentLikes[c.id]?.count > 0 ? commentLikes[c.id].count : ""}
                  </span>
                  {isPinned && (
                    <span onClick={()=>setPinnedId(null)} style={{fontSize:"0.75rem",color:"#7c3aed",cursor:"pointer",fontWeight:"bold"}}>Unpin</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply Banner */}
      {replyTo && (
        <div style={{padding:"0.5rem 1rem",background:"#13131a",borderTop:"1px solid #1e1e2e",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <span style={{fontSize:"0.82rem",color:"#a78bfa"}}>↩ Replying to <strong>@{replyTo.username}</strong></span>
          <span onClick={()=>setReplyTo(null)} style={{color:"#888",cursor:"pointer",fontSize:"1rem"}}>✕</span>
        </div>
      )}

      {/* Input Bar */}
      <div style={{padding:"0.6rem 1rem",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.75rem",background:"#0a0a0f",flexShrink:0}}>
        <AvatarImg username={user?.username} size={34} />
        <input
          ref={inputRef}
          value={text}
          onChange={e=>setText(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&sendComment()}
          placeholder={replyTo ? "Reply to @"+replyTo.username+"..." : "Add a comment..."}
          style={{flex:1,background:"#1e1e2e",border:"none",borderRadius:"20px",padding:"0.6rem 1rem",color:"white",fontSize:"0.93rem",outline:"none",minWidth:0}}
        />
        <button
          onClick={sendComment}
          disabled={sending||!text.trim()}
          style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"50%",width:"36px",height:"36px",color:"white",cursor:"pointer",fontSize:"1rem",opacity:!text.trim()?0.5:1,flexShrink:0}}
        >➤</button>
      </div>

      {/* Long Press Context Menu */}
      {holdMenu && (
        <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"flex-end"}} onClick={()=>setHoldMenu(null)}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.5)"}} />
          <div style={{width:"100%",background:"#1a1a2e",borderRadius:"20px 20px 0 0",padding:"1rem",zIndex:10,position:"relative"}} onClick={e=>e.stopPropagation()}>
            <div style={{width:"40px",height:"4px",background:"#444",borderRadius:"2px",margin:"0 auto 1rem"}} />
            {/* Comment preview */}
            <div style={{background:"#13131a",borderRadius:"12px",padding:"0.6rem 0.85rem",marginBottom:"1rem"}}>
              <span style={{color:"#c084fc",fontWeight:"bold",fontSize:"0.82rem"}}>@{holdMenu.username} </span>
              <span style={{fontSize:"0.9rem",color:"#ddd"}}>{holdMenu.text}</span>
            </div>
            {[
              { icon:"↩️", label:"Reply", action:()=>handleReply(holdMenu) },
              { icon: pinnedId===holdMenu.id ? "📌":"📌", label: pinnedId===holdMenu.id ? "Unpin comment" : "Pin comment", action:()=>handlePin(holdMenu) },
              ...(holdMenu.userId===user?.id ? [{ icon:"🗑️", label:"Delete comment", action:()=>{ deleteComment(holdMenu.id); setHoldMenu(null); }, danger:true }] : []),
              { icon:"👤", label:"View profile", action:()=>{ navigate("/user/"+holdMenu.username); setHoldMenu(null); } },
            ].map((opt,i) => (
              <div key={i} onClick={opt.action} style={{display:"flex",alignItems:"center",gap:"1rem",padding:"0.85rem 0.5rem",borderBottom:"1px solid #2a2a3a",cursor:"pointer"}}>
                <span style={{fontSize:"1.3rem"}}>{opt.icon}</span>
                <span style={{fontSize:"1rem",color:opt.danger?"#f87171":"white",fontWeight:"500"}}>{opt.label}</span>
              </div>
            ))}
            <div onClick={()=>setHoldMenu(null)} style={{textAlign:"center",padding:"0.85rem",color:"#888",cursor:"pointer",fontWeight:"bold",marginTop:"0.25rem"}}>Cancel</div>
          </div>
        </div>
      )}
    </div>
  );
}
