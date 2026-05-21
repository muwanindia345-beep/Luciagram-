import React, { useEffect, useState } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useNavigate as useNav } from "react-router-dom";

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

  const avatar = (name) => (name||"U").slice(0,1).toUpperCase();
  const gradients = ["linear-gradient(135deg,#7c3aed,#db2777)","linear-gradient(135deg,#f59e0b,#ef4444)","linear-gradient(135deg,#10b981,#3b82f6)","linear-gradient(135deg,#8b5cf6,#06b6d4)"];

  return (
    <div style={{background:"#0a0a0f",minHeight:"100vh",color:"white",paddingBottom:"70px"}}>

      {/* Header */}
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.4rem"}}>
          <img src="https://i.ibb.co/WWjtyhvX/file-00000000a5f0720bb84b412a53d8b399.png" alt="L" style={{width:"32px",height:"32px",borderRadius:"8px"}} />
          <span style={{color:"white",fontSize:"1.4rem",fontFamily:"serif",fontWeight:"bold"}}>Luciagram</span>
        </div>
        <div style={{display:"flex",gap:"1rem",fontSize:"1.3rem"}}>
          <span style={{cursor:"pointer"}}>💬</span>
        </div>
      </div>

      {/* Stories */}
      <div style={{overflowX:"auto",display:"flex",gap:"0.75rem",padding:"0.75rem 1rem",borderBottom:"1px solid #1e1e2e",scrollbarWidth:"none"}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.3rem",minWidth:"60px"}}>
          <div style={{width:"58px",height:"58px",borderRadius:"50%",background:"#1e1e2e",border:"2px dashed #7c3aed",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem",cursor:"pointer"}}>+</div>
          <span style={{fontSize:"0.65rem",color:"#888"}}>Your story</span>
        </div>
        {[{name:"Aanya"},{name:"Rohan"},{name:"Meera"},{name:"Ishaan"},{name:"Priya"}].map((s,i) => (
          <div key={i} onClick={()=>setActiveStory(s)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.3rem",minWidth:"60px",cursor:"pointer"}}>
            <div style={{padding:"2px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)"}}>
              <div style={{width:"54px",height:"54px",borderRadius:"50%",background:gradients[i%4],display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",fontWeight:"bold",border:"2px solid #0a0a0f"}}>{avatar(s.name)}</div>
            </div>
            <span style={{fontSize:"0.65rem",color:"#ccc",maxWidth:"60px",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</span>
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
          <div key={p.id} style={{borderBottom:"1px solid #1e1e2e",marginBottom:"0.5rem"}}>
            <div style={{padding:"0.6rem 1rem",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.6rem"}}>
                <div style={{width:"36px",height:"36px",borderRadius:"50%",background:gradients[i%4],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold"}}>{avatar(p.userId)}</div>
                <div><div style={{fontWeight:"bold",fontSize:"0.9rem"}}>@user</div><div style={{fontSize:"0.75rem",color:"#888"}}>{p.location||""}</div></div>
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
              {p.caption && <div style={{fontSize:"0.85rem",marginTop:"0.2rem"}}><span style={{fontWeight:"bold"}}>@user</span> {p.caption}</div>}
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
        <span style={{fontSize:"1.5rem",cursor:"pointer"}}>🤍</span>
        <div onClick={handleLogout} style={{width:"28px",height:"28px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",cursor:"pointer"}}>{avatar(user?.username)}</div>
      </div>

      {/* Story Viewer */}
      {activeStory && (
        <div onClick={()=>setActiveStory(null)} style={{position:"fixed",inset:0,background:"black",zIndex:200,display:"flex",flexDirection:"column"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:"3px",background:"#333",margin:"0.5rem"}}><div style={{height:"100%",width:"40%",background:"white",borderRadius:"2px"}}></div></div>
          <div style={{position:"absolute",top:"1rem",left:"1rem",display:"flex",alignItems:"center",gap:"0.5rem",zIndex:10}}>
            <div style={{width:"36px",height:"36px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold"}}>{avatar(activeStory.name)}</div>
            <div><div style={{fontWeight:"bold",fontSize:"0.9rem"}}>{activeStory.name}</div><div style={{fontSize:"0.75rem",color:"#aaa"}}>2h ago</div></div>
            <span style={{marginLeft:"auto",fontSize:"1.2rem",position:"absolute",right:"1rem"}}>✕</span>
          </div>
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#1a0533,#2d0a4e)"}}>
            <div style={{textAlign:"center",color:"white"}}><div style={{fontSize:"3rem",marginBottom:"1rem"}}>🦋</div><p style={{fontSize:"1.1rem"}}>Good vibes & sunset skies ✨</p></div>
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
