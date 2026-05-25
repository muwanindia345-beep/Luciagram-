import React, { useEffect, useState } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import MediaLoader from "../components/MediaLoader";

export default function Profile() {
  const { user, logout } = useAuth();
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  const [activeTab, setActiveTab] = useState("posts");
  const [selectedPost, setSelectedPost] = useState(null);
  const [activeStory, setActiveStory] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    API.get("/posts/user/" + user.id).then(r => setPosts(r.data)).catch(()=>{});
    API.get("/stories").then(r => setStories(r.data.filter(s => s.userId === user?.id))).catch(()=>{});
    if (user?.id) API.get("/users/" + user.id + "/followers").then(r => setStats(r.data)).catch(()=>{});
  }, [user]);

  const handleLogout = () => { logout(); navigate("/login"); };
  const gradients = ["linear-gradient(135deg,#7c3aed,#db2777)","linear-gradient(135deg,#f59e0b,#ef4444)","linear-gradient(135deg,#10b981,#3b82f6)"];
  const avatar = (name) => (name||"U").slice(0,1).toUpperCase();

  const deletePost = async (id) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await API.delete("/posts/" + id);
      setPosts(p => p.filter(x => x.id !== id));
      setSelectedPost(null);
    } catch {}
  };

  const deleteStory = async (id) => {
    if (!window.confirm("Delete this story?")) return;
    try {
      await API.delete("/stories/" + id);
      setStories(s => s.filter(x => x.id !== id));
      setActiveStory(null);
    } catch {}
  };

  const hasStory = stories.length > 0;

  return (
    <div style={{background:"#0a0a0f",minHeight:"100vh",color:"white",paddingBottom:"70px"}}>

      {/* Header */}
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100}}>
        <span style={{fontWeight:"bold",fontSize:"1.1rem"}}>@{user?.username}</span>
        <span onClick={handleLogout} style={{cursor:"pointer",fontSize:"1.3rem"}}>⚙️</span>
      </div>

      {/* Profile Info */}
      <div style={{padding:"1.5rem 1rem"}}>
        <div style={{display:"flex",alignItems:"center",gap:"1.5rem",marginBottom:"1rem"}}>

          {/* Avatar with story ring */}
          <div style={{flexShrink:0,position:"relative"}} onClick={()=>hasStory && setActiveStory(stories[0])}>
            <div style={{padding:"3px",borderRadius:"50%",background:hasStory?"linear-gradient(135deg,#7c3aed,#db2777)":"transparent",border:hasStory?"none":"3px solid #333",cursor:hasStory?"pointer":"default"}}>
              {user?.avatar ? (
                <img src={user.avatar} alt="avatar" style={{width:"86px",height:"86px",borderRadius:"50%",objectFit:"cover",border:"3px solid #0a0a0f",display:"block"}} />
              ) : (
                <div style={{width:"86px",height:"86px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2rem",fontWeight:"bold",border:"3px solid #0a0a0f"}}>{avatar(user?.username)}</div>
              )}
            </div>
            {hasStory && <div style={{position:"absolute",bottom:2,right:2,width:"22px",height:"22px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"2px solid #0a0a0f",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem"}}>▶</div>}
          </div>

          {/* Stats */}
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
        </div>
      </div>

      {/* Highlights - Real Stories */}
      <div style={{overflowX:"auto",display:"flex",gap:"1rem",padding:"0 1rem 1rem",scrollbarWidth:"none",borderBottom:"1px solid #1e1e2e"}}>
        {/* Add new story */}
        <div onClick={()=>navigate("/upload")} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.4rem",minWidth:"64px",cursor:"pointer"}}>
          <div style={{width:"60px",height:"60px",borderRadius:"50%",border:"1px dashed #7c3aed",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem"}}>+</div>
          <span style={{fontSize:"0.7rem",color:"#888"}}>New</span>
        </div>
        {/* Real stories */}
        {stories.map((s,i) => (
          <div key={s.id||i} onClick={()=>setActiveStory(s)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.4rem",minWidth:"64px",cursor:"pointer"}}>
            <div style={{padding:"2px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)"}}>
              {s.mediaUrl ? (
                s.mediaType === "video" ? (
                  <video src={s.mediaUrl} style={{width:"56px",height:"56px",borderRadius:"50%",objectFit:"cover",border:"2px solid #0a0a0f"}} />
                ) : (
                  <img src={s.mediaUrl} alt="story" style={{width:"56px",height:"56px",borderRadius:"50%",objectFit:"cover",border:"2px solid #0a0a0f"}} />
                )
              ) : (
                <div style={{width:"56px",height:"56px",borderRadius:"50%",background:gradients[i%3],display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #0a0a0f"}}>🦋</div>
              )}
            </div>
            <span style={{fontSize:"0.65rem",color:"#ccc",maxWidth:"64px",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>My story</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:"1px solid #1e1e2e"}}>
        {[["posts","⊞"],["reels","🎬"],["saved","🔖"]].map(([tab,icon]) => (
          <button key={tab} onClick={()=>setActiveTab(tab)} style={{flex:1,padding:"0.75rem",background:"transparent",border:"none",borderBottom:activeTab===tab?"2px solid white":"2px solid transparent",color:activeTab===tab?"white":"#888",cursor:"pointer",fontSize:"1.2rem"}}>
            {icon}
          </button>
        ))}
      </div>

      {/* Posts Grid */}
      {activeTab === "posts" && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"2px",padding:"2px"}}>
          {posts.length === 0 ? (
            <div style={{gridColumn:"1/-1",textAlign:"center",color:"#888",padding:"3rem"}}>
              <div style={{fontSize:"2rem"}}>📸</div>
              <p>No posts yet</p>
              <button onClick={()=>navigate("/upload")} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"8px",color:"white",padding:"0.5rem 1rem",cursor:"pointer"}}>Create Post</button>
            </div>
          ) : posts.map((p,i) => (
            <div key={p.id||i} onClick={()=>setSelectedPost(p)} style={{aspectRatio:"1",overflow:"hidden",cursor:"pointer",position:"relative"}}>
              {p.mediaType === "video" ? (
                <video src={p.mediaUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} />
              ) : p.mediaUrl ? (
                <img src={p.mediaUrl} alt="post" style={{width:"100%",height:"100%",objectFit:"cover"}} />
              ) : (
                <div style={{width:"100%",height:"100%",background:gradients[i%3],display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem"}}>🦋</div>
              )}
              {p.mediaType === "video" && <div style={{position:"absolute",top:"0.3rem",right:"0.3rem",fontSize:"0.8rem"}}>🎬</div>}
            </div>
          ))}
        </div>
      )}

      {activeTab === "reels" && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"2px",padding:"2px"}}>
          {posts.filter(p=>p.mediaType==="video").length === 0 ? (
            <div style={{gridColumn:"1/-1",textAlign:"center",color:"#888",padding:"3rem"}}>
              <div style={{fontSize:"2rem"}}>🎬</div>
              <p>No reels yet</p>
              <button onClick={()=>navigate("/upload")} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"8px",color:"white",padding:"0.5rem 1rem",cursor:"pointer"}}>Upload Video</button>
            </div>
          ) : posts.filter(p=>p.mediaType==="video").map((p,i) => (
            <div key={p.id||i} onClick={()=>setSelectedPost(p)} style={{aspectRatio:"1",overflow:"hidden",cursor:"pointer",position:"relative",background:"#000"}}>
              <video src={p.mediaUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} />
              <div style={{position:"absolute",bottom:"0.3rem",left:"0.3rem",fontSize:"0.75rem",color:"white"}}>🎬</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "saved" && (
        <div style={{textAlign:"center",color:"#888",padding:"3rem"}}>
          <div style={{fontSize:"2rem"}}>🔖</div>
          <p>Saved posts coming soon</p>
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0a0a0f",borderTop:"1px solid #1e1e2e",display:"flex",justifyContent:"space-around",padding:"0.75rem 0",zIndex:100}}>
        <span onClick={()=>navigate("/")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🏠</span>
        <span onClick={()=>navigate("/search")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🔍</span>
        <div onClick={()=>navigate("/upload")} style={{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1.2rem"}}>+</div>
        <span onClick={()=>navigate("/reels")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🎬</span>
        <div style={{width:"28px",height:"28px",borderRadius:"50%",overflow:"hidden",border:"2px solid #7c3aed"}}>
          {user?.avatar ? <img src={user.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="p"/> : <div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",fontWeight:"bold"}}>{avatar(user?.username)}</div>}
        </div>
      </div>

      {/* Full Screen Post Viewer */}
      {selectedPost && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",zIndex:200,display:"flex",flexDirection:"column"}}>
          <div style={{padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span onClick={()=>setSelectedPost(null)} style={{cursor:"pointer",fontSize:"1.5rem"}}>✕</span>
            <span style={{fontWeight:"bold"}}>Post</span>
            <span onClick={()=>deletePost(selectedPost.id)} style={{color:"#f87171",cursor:"pointer"}}>🗑️</span>
          </div>
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
            {selectedPost.mediaType === "video" ? (
              <video src={selectedPost.mediaUrl} controls autoPlay style={{maxWidth:"100%",maxHeight:"80vh",borderRadius:"12px"}} />
            ) : (
              <img src={selectedPost.mediaUrl} alt="post" style={{maxWidth:"100%",maxHeight:"80vh",borderRadius:"12px",objectFit:"contain"}} />
            )}
          </div>
          {selectedPost.caption && <div style={{padding:"1rem",color:"white"}}><span style={{fontWeight:"bold"}}>@{user?.username}</span> {selectedPost.caption}</div>}
        </div>
      )}

      {/* Story Viewer */}
      {activeStory && (
        <div style={{position:"fixed",inset:0,background:"black",zIndex:200,display:"flex",flexDirection:"column"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:"3px",background:"#333",margin:"0.5rem"}}>
            <div style={{height:"100%",width:"100%",background:"white",borderRadius:"2px",animation:"progress 5s linear forwards"}}></div>
          </div>
          <div style={{position:"absolute",top:"1rem",left:"1rem",right:"1rem",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:10}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
              {user?.avatar ? <img src={user.avatar} alt="a" style={{width:"36px",height:"36px",borderRadius:"50%",objectFit:"cover"}} /> : <div style={{width:"36px",height:"36px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold"}}>{avatar(user?.username)}</div>}
              <div>
                <div style={{fontWeight:"bold",fontSize:"0.9rem"}}>@{user?.username}</div>
                <div style={{fontSize:"0.75rem",color:"#aaa"}}>My Story</div>
              </div>
            </div>
            <div style={{display:"flex",gap:"1rem"}}>
              <span onClick={()=>deleteStory(activeStory.id)} style={{cursor:"pointer",fontSize:"1.2rem"}}>🗑️</span>
              <span onClick={()=>setActiveStory(null)} style={{cursor:"pointer",fontSize:"1.2rem"}}>✕</span>
            </div>
          </div>
          <div style={{flex:1,position:"relative"}}>
            {activeStory.mediaType === "video" ? (
              <video src={activeStory.mediaUrl} autoPlay loop style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute"}} />
            ) : activeStory.mediaUrl ? (
              <img src={activeStory.mediaUrl} alt="story" style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute"}} />
            ) : (
              <div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#1a0533,#2d0a4e)",position:"absolute",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{fontSize:"3rem"}}>🦋</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
