import React, { useEffect, useState } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";

export default function Comments() {
  const { postId } = useParams();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    API.get("/comments/" + postId).then(r => setComments(r.data)).catch(()=>{});
  }, [postId]);

  const sendComment = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await API.post("/comments/" + postId, { text });
      setComments(p => [...p, res.data]);
      setText("");
    } catch {}
    setSending(false);
  };

  const deleteComment = async (id) => {
    try {
      await API.delete("/comments/" + id);
      setComments(p => p.filter(c => c.id !== id));
    } catch {}
  };

  const avatar = (name) => (name||"U").slice(0,1).toUpperCase();
  const gradients = ["linear-gradient(135deg,#7c3aed,#db2777)","linear-gradient(135deg,#f59e0b,#ef4444)","linear-gradient(135deg,#10b981,#3b82f6)"];

  return (
    <div style={{background:"#0a0a0f",height:"100vh",color:"white",display:"flex",flexDirection:"column"}}>
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",alignItems:"center",gap:"0.75rem",position:"sticky",top:0,zIndex:100}}>
        <span onClick={()=>navigate(-1)} style={{cursor:"pointer",fontSize:"1.3rem"}}>←</span>
        <span style={{fontWeight:"bold",fontSize:"1.1rem"}}>Comments</span>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"1rem"}}>
        {comments.length === 0 ? (
          <div style={{textAlign:"center",color:"#888",marginTop:"3rem"}}>
            <div style={{fontSize:"2rem"}}>💬</div>
            <p>No comments yet. Be first!</p>
          </div>
        ) : comments.map((c,i) => (
          <div key={c.id||i} style={{display:"flex",gap:"0.75rem",marginBottom:"1rem",alignItems:"flex-start"}}>
            <div style={{width:"36px",height:"36px",borderRadius:"50%",background:gradients[i%3],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",flexShrink:0}}>{avatar(c.username)}</div>
            <div style={{flex:1,background:"#13131a",borderRadius:"12px",padding:"0.6rem 0.75rem"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontWeight:"bold",fontSize:"0.85rem",color:"#c084fc"}}>@{c.username}</span>
                {c.userId === user?.id && (
                  <span onClick={()=>deleteComment(c.id)} style={{color:"#f87171",cursor:"pointer",fontSize:"0.8rem"}}>🗑️</span>
                )}
              </div>
              <p style={{margin:"0.3rem 0 0",fontSize:"0.95rem"}}>{c.text}</p>
              <div style={{fontSize:"0.7rem",color:"#555",marginTop:"0.3rem"}}>{new Date(c.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{padding:"0.75rem 1rem",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.75rem",background:"#0a0a0f"}}>
        <div style={{width:"32px",height:"32px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:"0.8rem",flexShrink:0}}>{avatar(user?.username)}</div>
        <input
          value={text}
          onChange={e=>setText(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&sendComment()}
          placeholder="Add a comment..."
          style={{flex:1,background:"#1e1e2e",border:"none",borderRadius:"20px",padding:"0.6rem 1rem",color:"white",fontSize:"0.95rem",outline:"none"}}
        />
        <button onClick={sendComment} disabled={sending||!text.trim()} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"50%",width:"36px",height:"36px",color:"white",cursor:"pointer",fontSize:"1rem",opacity:!text.trim()?0.5:1}}>➤</button>
      </div>
    </div>
  );
}
