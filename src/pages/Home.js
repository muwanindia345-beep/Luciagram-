import React, { useEffect, useState } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [activeStory, setActiveStory] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    API.get("/posts/feed").then(r => setPosts(r.data)).catch(()=>{});
    API.get("/stories").then(r => setStories(r.data)).catch(()=>{});
  }, []);

  const handleLogout = () => { logout(); navigate("/login"); };

  const getTimeLeft = (expiresAt) => {
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? hours + "h left" : mins + "m left";
  };

  const avatar = (name) => (name||"U").slice(0,1).toUpperCase();
  const gradients = ["linear-gradient(135deg,#7c3aed,#db2777)","linear-gradient(135deg,#f59e0b,#ef4444)","linear-gradient(135deg,#10b981,#3b82f6)","linear-gradient(135deg,#8b5cf6,#06b6d4)"];

  const AvatarImg = ({ username, size=36 }) => {
    if (user?.avatar && username === user?.username) {
      return <img src={user.avatar} alt={username} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover"}} />;
    }
    const g = gradients[(username||"").charCodeAt(0)%4];
    return <div style={{width:size,height:size,borderRadius:"50%",background:g,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:size*0.35}}>{avatar(username)}</div>;
  };

  return (
    <div style={{background:"#0a0a0f",minHeight:"100vh",color:"white",paddingBottom:"70px"}}>

      {/* Header */}
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.4rem"}}>
          <img src="https://i.ibb.co/WWjtyhvX/file-00000000a5f0720bb84b412a53d8b399.png" alt="L" style={{width:"32px",height:"32px",borderRadius:"8px"}} />
          <span style={{color:"white",fontSize:"1.4rem",fontFamily:"serif",fontWeight:"bold"}}>Luciagram</span>
        </div>
        <span onClick={()=>navigate("/messages")} style={{fontSize:"1.3rem",cursor:"pointer"}}>💬</span>
      </div>

      {/* Stories */}
      <div style={{overflowX:"auto",display:"flex",gap:"0.75rem",padding:"0.75rem 1rem",borderBottom:"1px solid #1e1e2e",scrollbarWidth:"none"}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.3rem",minWidth:"60px"}}>
          <div onClick={()=>navigate("/upload")} style={{width:"58px",height:"58px",borderRadius:"50%",background:"#1e1e2e",border:"2px dashed #7c3aed",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem",cursor:"pointer"}}>+</div>
          <span style={{fontSize:"0.65rem",color:"#888"}}>Your story</span>
        </div>
        {stories.map((s,i) => (
          <div key={s.id||i} onClick={()=>setActiveStory(s)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.3rem",minWidth:"60px",cursor:"pointer"}}>
            <div style={{padding:"2px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)"}}>
              {s.mediaUrl ? (
                <img src={s.mediaUrl} alt={s.username} style={{width:"54px",height:"54px",borderRadius:"50%",objectFit:"cover",border:"2px solid #0a0a0f"}} />
              ) : (
                <div style={{width:"54px",height:"54px",borderRadius:"50%",background:gradients[i%4],display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",fontWeight:"bold",border:"2px solid #0a0a0f"}}>{avatar(s.username)}</div>
              )}
            </div>
            <span style={{fontSize:"0.65rem",color:"#ccc",maxWidth:"60px",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>@{s.username}</span>
          </div>
        ))}
      </div>

      {/* Posts Feed */}
      <div style={{maxWidth:"600px",margin:"0 auto"}}>
        {posts.length === 0 ? (
          <div style={{textAlign:"center",color:"#888",marginTop:"4rem"}}>
            <img src="https://i.ibb.co/WWjtyhvX/file-00000000a5f0720bb84b412a53d8b399.png" alt="L" style={{width:"80px",borderRadius:"20px",opacity:0.4}} />
            <p>No posts yet. Be the first to post!</p>
          </div>
        ) : posts.map((p,i) => (
          <div key={p.id||i} style={{borderBottom:"1px solid #1e1e2e",marginBottom:"0.5rem"}}>
            <div style={{padding:"0.6rem 1rem",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.6rem"}}>
                <AvatarImg username={p.username} size={36} />
                <div>
                  <div style={{fontWeight:"bold",fontSize:"0.9rem"}}>@{p.username||"user"}</div>
                  <div style={{fontSize:"0.75rem",color:"#888"}}>{p.location||""}</div>
                </div>
              </div>
              <span style={{color:"#888",cursor:"pointer"}}>•••</span>
            </div>
            {p.mediaUrl && <img src={p.mediaUrl} alt="post" style={{width:"100%",maxHeight:"500px",objectFit:"cover"}} />}
            <div style={{padding:"0.6rem 1rem"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"0.5rem"}}>
                <div style={{display:"flex",gap:"1rem",fontSize:"1.4rem"}}>
                  <span style={{cursor:"pointer"}}>🤍</span>
                  <span style={{cursor:"pointer"}}>💬</span>
                  <span style={{cursor:"pointer"}}>➤</span>
                </div>
                <span style={{fontSize:"1.4rem",cursor:"pointer"}}>🔖</span>
              </div>
              <div style={{fontSize:"0.85rem",fontWeight:"bold"}}>0 likes</div>
              {p.caption && <div style={{fontSize:"0.85rem",marginTop:"0.2rem"}}><span style={{fontWeight:"bold"}}>@{p.username||"user"}</span> {p.caption}</div>}
              <div style={{fontSize:"0.75rem",color:"#555",marginTop:"0.3rem"}}>{new Date(p.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0a0a0f",borderTop:"1px solid #1e1e2e",display:"flex",justifyContent:"space-around",padding:"0.75rem 0",zIndex:100}}>
        <span style={{fontSize:"1.5rem",cursor:"pointer"}}>🏠</span>
        <span style={{fontSize:"1.5rem",cursor:"pointer"}}>🔍</span>
        <div onClick={()=>navigate("/upload")} style={{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1.2rem"}}>+</div>
        <span onClick={()=>navigate("/reels")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🎬</span>
        <div onClick={()=>navigate("/profile")} style={{width:"28px",height:"28px",borderRadius:"50%",overflow:"hidden",cursor:"pointer",border:"2px solid #7c3aed"}}>
          {user?.avatar ? <img src={user.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="p"/> : <div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",fontWeight:"bold"}}>{avatar(user?.username)}</div>}
        </div>
      </div>

      {/* Story Viewer */}
      {activeStory && (
        <div onClick={()=>setActiveStory(null)} style={{position:"fixed",inset:0,background:"black",zIndex:200,display:"flex",flexDirection:"column"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:"3px",background:"#333",margin:"0.5rem"}}>
            <div style={{height:"100%",width:"40%",background:"white",borderRadius:"2px"}}></div>
          </div>
          <div style={{position:"absolute",top:"1rem",left:"1rem",display:"flex",alignItems:"center",gap:"0.5rem",zIndex:10}}>
            <AvatarImg username={activeStory.username} size={36} />
            <div>
              <div style={{fontWeight:"bold",fontSize:"0.9rem"}}>@{activeStory.username}</div>
              <div style={{fontSize:"0.75rem",color:"#aaa"}}>{activeStory.expiresAt ? getTimeLeft(activeStory.expiresAt) : "24h"}</div>
            </div>
            <span style={{position:"absolute",right:"-200px",fontSize:"1.2rem"}}>✕</span>
          </div>
          <div style={{flex:1,position:"relative",overflow:"hidden"}}>
            {activeStory.mediaUrl ? (
              <img src={activeStory.mediaUrl} alt="story" style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute"}} />
            ) : (
              <div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#1a0533,#2d0a4e)",display:"flex",alignItems:"center",justifyContent:"center",position:"absolute"}}>
                <div style={{fontSize:"3rem"}}>🦋</div>
              </div>
            )}
          </div>
          <div style={{padding:"1rem",display:"flex",alignItems:"center",gap:"0.75rem"}}>
            <input placeholder="Send message..." style={{flex:1,background:"transparent",border:"1px solid #444",borderRadius:"20px",padding:"0.6rem 1rem",color:"white",fontSize:"0.9rem"}} onClick={e=>e.stopPropagation()} />
            <span style={{fontSize:"1.3rem"}}>🤍</span>
          </div>
        </div>
      )}
    </div>
  );
}
