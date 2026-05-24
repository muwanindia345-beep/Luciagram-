import React, { useEffect, useState, useRef } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Reels() {
  const [posts, setPosts] = useState([]);
  const [current, setCurrent] = useState(0);
  const [liked, setLiked] = useState({});
  const [muted, setMuted] = useState(true);
  const [likes, setLikes] = useState({});
  const { user } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef();

  useEffect(() => {
    API.get("/posts/feed").then(r => setPosts(r.data)).catch(()=>{});
  }, []);

  const handleLike = async (postId) => {
    try {
      const res = await API.post("/posts/" + postId + "/like");
      setLiked(p => ({...p, [postId]: res.data.liked}));
      setLikes(p => ({...p, [postId]: (p[postId]||0) + (res.data.liked ? 1 : -1)}));
    } catch {}
  };

  const handleScroll = (e) => {
    const index = Math.round(e.target.scrollTop / window.innerHeight);
    setCurrent(index);
  };

  const avatar = (name) => (name||"U").slice(0,1).toUpperCase();
  const AvatarImg = ({ username, size=36 }) => {
    const u = username || user?.username;
    if (user?.avatar && u === user?.username) {
      return <img src={user.avatar} alt={u} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover"}} />;
    }
    const gradients = ["linear-gradient(135deg,#7c3aed,#db2777)","linear-gradient(135deg,#f59e0b,#ef4444)","linear-gradient(135deg,#10b981,#3b82f6)"];
    const g = gradients[(u||"").charCodeAt(0)%3];
    return <div style={{width:size,height:size,borderRadius:"50%",background:g,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:size*0.35}}>{avatar(u)}</div>;
  };
  const gradients = ["linear-gradient(135deg,#7c3aed,#db2777)","linear-gradient(135deg,#f59e0b,#ef4444)","linear-gradient(135deg,#10b981,#3b82f6)"];

  return (
    <div style={{background:"#000",height:"100vh",overflow:"hidden",position:"relative"}}>

      {/* Header */}
      <div style={{position:"fixed",top:0,left:0,right:0,zIndex:100,padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{color:"white",fontWeight:"bold",fontSize:"1.1rem"}}>Reels</span>
        <span style={{color:"white",fontSize:"1.3rem",cursor:"pointer"}}>📷</span>
      </div>

      {/* Scrollable Reels */}
      <div ref={containerRef} onScroll={handleScroll} style={{height:"100vh",overflowY:"scroll",scrollSnapType:"y mandatory",scrollbarWidth:"none"}}>
        {posts.length === 0 ? (
          <div style={{height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"white"}}>
            <img src="https://i.ibb.co/WWjtyhvX/file-00000000a5f0720bb84b412a53d8b399.png" alt="L" style={{width:"80px",borderRadius:"20px",opacity:0.4,marginBottom:"1rem"}} />
            <p style={{color:"#888"}}>No reels yet. Post something!</p>
          </div>
        ) : posts.map((p, i) => (
          <div key={p.id||i} style={{height:"100vh",scrollSnapAlign:"start",position:"relative",background:"#000",display:"flex",alignItems:"center",justifyContent:"center"}}>

            {/* Media */}
            {p.mediaUrl ? (
              p.mediaType === "video" || p.mediaUrl.startsWith("data:video") ? (
                <video
                  src={p.mediaUrl}
                  style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute"}}
                  autoPlay={i===current}
                  loop muted={muted} playsInline
                  ref={el=>{if(el&&i===current){el.play().catch(()=>{})}else if(el){el.pause();el.currentTime=0;}}}
                />
              ) : (
                <img src={p.mediaUrl} alt="reel" style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute"}} />
              )
            ) : (
              <div style={{width:"100%",height:"100%",background:gradients[i%3],position:"absolute",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"4rem"}}>🦋</div>
            )}

            {/* Gradient overlay */}
            <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 40%, rgba(0,0,0,0.8))"}} />

            {/* Right Actions */}
            <div style={{position:"absolute",right:"1rem",bottom:"8rem",display:"flex",flexDirection:"column",alignItems:"center",gap:"1.5rem",zIndex:10}}>
              <div onClick={()=>handleLike(p.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.3rem",cursor:"pointer"}}>
                <span style={{fontSize:"1.8rem"}}>{liked[p.id] ? "❤️" : "🤍"}</span>
                <span style={{color:"white",fontSize:"0.75rem"}}>{likes[p.id]||0}</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.3rem",cursor:"pointer"}}>
                <span style={{fontSize:"1.8rem"}}>💬</span>
                <span style={{color:"white",fontSize:"0.75rem"}}>0</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.3rem",cursor:"pointer"}}>
                <span style={{fontSize:"1.8rem"}}>➤</span>
                <span style={{color:"white",fontSize:"0.75rem"}}>Share</span>
              </div>
              <div style={{cursor:"pointer"}}>
                <span style={{fontSize:"1.8rem"}}>⋮</span>
              </div>
            </div>

            {/* Bottom Info */}
            <div style={{position:"absolute",bottom:"5rem",left:"1rem",right:"5rem",zIndex:10}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.5rem"}}>
                <div style={{width:"36px",height:"36px",borderRadius:"50%",background:gradients[i%3],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:"0.9rem",flexShrink:0}}>{avatar(p.username)}</div>
                <span style={{color:"white",fontWeight:"bold",fontSize:"0.95rem"}}>@{p.username||"user"}</span>
                <button style={{background:"transparent",border:"1px solid white",color:"white",borderRadius:"6px",padding:"0.2rem 0.6rem",fontSize:"0.8rem",cursor:"pointer",marginLeft:"0.5rem"}}>Follow</button>
              </div>
              {p.caption && <p style={{color:"white",fontSize:"0.9rem",margin:0,lineHeight:1.4}}>{p.caption}</p>}
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginTop:"0.5rem"}}>
                <span style={{fontSize:"0.9rem"}}>🎵</span>
                <span style={{color:"white",fontSize:"0.8rem",opacity:0.8}}>Original Audio</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(0,0,0,0.8)",borderTop:"1px solid #1e1e2e",display:"flex",justifyContent:"space-around",padding:"0.75rem 0",zIndex:100}}>
        <span onClick={()=>navigate("/")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🏠</span>
        <span style={{fontSize:"1.5rem",cursor:"pointer"}}>🔍</span>
        <div onClick={()=>navigate("/upload")} style={{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1.2rem"}}>+</div>
        <span style={{fontSize:"1.5rem",cursor:"pointer",borderBottom:"2px solid white",paddingBottom:"2px"}}>🎬</span>
        <div onClick={()=>navigate("/profile")} style={{width:"28px",height:"28px",borderRadius:"50%",overflow:"hidden",cursor:"pointer",border:"2px solid #7c3aed"}}>{user?.avatar ? <img src={user.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="p"/> : <div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",fontWeight:"bold"}}>{avatar(user?.username)}</div>}</div>
      </div>
    </div>
  );
}
