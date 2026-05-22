import React, { useEffect, useState } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { user, logout } = useAuth();
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    API.get("/posts/feed").then(r => setPosts(r.data.filter(p => p.userId === user?.id))).catch(()=>{});
    if (user?.id) API.get("/users/" + user.id + "/followers").then(r => setStats(r.data)).catch(()=>{});
  }, [user]);

  const handleLogout = () => { logout(); navigate("/login"); };
  const gradients = ["linear-gradient(135deg,#7c3aed,#db2777)","linear-gradient(135deg,#f59e0b,#ef4444)","linear-gradient(135deg,#10b981,#3b82f6)"];
  const avatar = (name) => (name||"U").slice(0,1).toUpperCase();

  return (
    <div style={{background:"#0a0a0f",minHeight:"100vh",color:"white",paddingBottom:"70px"}}>
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100}}>
        <span style={{fontWeight:"bold",fontSize:"1.1rem"}}>@{user?.username}</span>
        <span onClick={handleLogout} style={{cursor:"pointer",fontSize:"1.3rem"}}>⚙️</span>
      </div>

      <div style={{padding:"1.5rem 1rem"}}>
        <div style={{display:"flex",alignItems:"center",gap:"1.5rem",marginBottom:"1rem"}}>
          <div style={{flexShrink:0}}>
            {user?.avatar ? (
              <img src={user.avatar} alt="avatar" style={{width:"86px",height:"86px",borderRadius:"50%",objectFit:"cover",border:"3px solid #7c3aed"}} />
            ) : (
              <div style={{width:"86px",height:"86px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2rem",fontWeight:"bold"}}>{avatar(user?.username)}</div>
            )}
          </div>
          <div style={{display:"flex",gap:"1.5rem",flex:1,justifyContent:"space-around"}}>
            <div style={{textAlign:"center"}}><div style={{fontWeight:"bold",fontSize:"1.2rem"}}>{posts.length}</div><div style={{color:"#888",fontSize:"0.8rem"}}>Posts</div></div>
            <div style={{textAlign:"center"}}><div style={{fontWeight:"bold",fontSize:"1.2rem"}}>{stats.followers}</div><div style={{color:"#888",fontSize:"0.8rem"}}>Followers</div></div>
            <div style={{textAlign:"center"}}><div style={{fontWeight:"bold",fontSize:"1.2rem"}}>{stats.following}</div><div style={{color:"#888",fontSize:"0.8rem"}}>Following</div></div>
          </div>
        </div>

        <div style={{marginBottom:"1rem"}}>
          <div style={{fontWeight:"bold"}}>{user?.fullName}</div>
          {user?.bio && <div style={{color:"#ddd",fontSize:"0.85rem",marginTop:"0.2rem"}}>{user.bio}</div>}
          {user?.website && <div style={{color:"#c084fc",fontSize:"0.85rem",marginTop:"0.2rem"}}>{user.website}</div>}
        </div>

        <div style={{display:"flex",gap:"0.75rem"}}>
          <button onClick={()=>navigate("/edit-profile")} style={{flex:1,padding:"0.5rem",background:"#1e1e2e",border:"1px solid #2a2a3a",borderRadius:"8px",color:"white",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem"}}>Edit Profile</button>
          <button style={{flex:1,padding:"0.5rem",background:"#1e1e2e",border:"1px solid #2a2a3a",borderRadius:"8px",color:"white",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem"}}>Share Profile</button>
          <button style={{padding:"0.5rem 0.75rem",background:"#1e1e2e",border:"1px solid #2a2a3a",borderRadius:"8px",color:"white",cursor:"pointer"}}>👤+</button>
        </div>
      </div>

      {/* Highlights */}
      <div style={{overflowX:"auto",display:"flex",gap:"1rem",padding:"0 1rem 1rem",scrollbarWidth:"none",borderBottom:"1px solid #1e1e2e"}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.4rem",minWidth:"64px"}}>
          <div style={{width:"60px",height:"60px",borderRadius:"50%",border:"1px dashed #444",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem",cursor:"pointer"}}>+</div>
          <span style={{fontSize:"0.7rem",color:"#888"}}>New</span>
        </div>
        {["Travel","Coffee","Sunsets","Books"].map((h,i) => (
          <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.4rem",minWidth:"64px"}}>
            <div style={{width:"60px",height:"60px",borderRadius:"50%",background:gradients[i%3],display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.2rem",cursor:"pointer"}}>🦋</div>
            <span style={{fontSize:"0.7rem",color:"#ccc"}}>{h}</span>
          </div>
        ))}
      </div>

      {/* Posts Grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"2px",padding:"2px"}}>
        {posts.length === 0 ? (
          <div style={{gridColumn:"1/-1",textAlign:"center",color:"#888",padding:"3rem"}}>
            <div style={{fontSize:"2rem"}}>📸</div>
            <p>No posts yet</p>
            <button onClick={()=>navigate("/upload")} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"8px",color:"white",padding:"0.5rem 1rem",cursor:"pointer"}}>Create Post</button>
          </div>
        ) : posts.map((p,i) => (
          <div key={p.id||i} style={{aspectRatio:"1",overflow:"hidden",cursor:"pointer"}}>
            {p.mediaUrl ? (
              <img src={p.mediaUrl} alt="post" style={{width:"100%",height:"100%",objectFit:"cover"}} />
            ) : (
              <div style={{width:"100%",height:"100%",background:gradients[i%3],display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem"}}>🦋</div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0a0a0f",borderTop:"1px solid #1e1e2e",display:"flex",justifyContent:"space-around",padding:"0.75rem 0",zIndex:100}}>
        <span onClick={()=>navigate("/")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🏠</span>
        <span style={{fontSize:"1.5rem",cursor:"pointer"}}>🔍</span>
        <div onClick={()=>navigate("/upload")} style={{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1.2rem"}}>+</div>
        <span onClick={()=>navigate("/reels")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🎬</span>
        <div style={{width:"28px",height:"28px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",cursor:"pointer",border:"2px solid white"}}>{avatar(user?.username)}</div>
      </div>
    </div>
  );
}
