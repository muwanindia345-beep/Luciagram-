import React, { useEffect, useState, useRef } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  const [activeTab, setActiveTab] = useState("posts");
  const [selectedPost, setSelectedPost] = useState(null);
  const [activeStory, setActiveStory] = useState(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyDuration, setStoryDuration] = useState(5000);
  const [storyViews, setStoryViews] = useState({});
  const [savedPosts, setSavedPosts] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [isPrivate, setIsPrivate] = useState(user?.isPrivate || false);
  const [uploading, setUploading] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const storyTimer = useRef(null);
  const avatarRef = useRef();
  const navigate = useNavigate();
  const gradients = ["linear-gradient(135deg,#7c3aed,#db2777)","linear-gradient(135deg,#f59e0b,#ef4444)","linear-gradient(135deg,#10b981,#3b82f6)"];
  const avatar = (name) => (name||"U").slice(0,1).toUpperCase();

  useEffect(() => {
    if (!user?.id) return;
    API.get("/posts/user/" + user.username).then(r => setPosts(r.data)).catch(()=>{});
    API.get("/stories").then(r => setStories(r.data.filter(s => s.userId === user?.id))).catch(()=>{});
    API.get("/users/" + user.username + "/followers").then(r => setStats(r.data)).catch(()=>{});
    API.get("/posts/saved").then(r => setSavedPosts(r.data || [])).catch(()=>{});
    setIsPrivate(user?.isPrivate || false);
  }, [user?.id]);

  useEffect(() => {
    if (!activeStory) return;
    clearTimeout(storyTimer.current);
    const currentItem = stories[storyIndex];
    if (!currentItem) return;
    if (currentItem.mediaType !== "video") {
      storyTimer.current = setTimeout(() => {
        if (storyIndex < stories.length - 1) setStoryIndex(i => i+1);
        else { setActiveStory(null); setStoryIndex(0); }
      }, 5000);
    }
    return () => clearTimeout(storyTimer.current);
  }, [activeStory, storyIndex, stories]);

  const handleStoryVideoLoaded = (e) => {
    const duration = e.target.duration * 1000 || 10000;
    setStoryDuration(duration);
    clearTimeout(storyTimer.current);
    storyTimer.current = setTimeout(() => {
      if (storyIndex < stories.length - 1) setStoryIndex(i => i+1);
      else { setActiveStory(null); setStoryIndex(0); }
    }, duration);
  };

  const openFollowers = async () => {
    setShowFollowersModal(true);
    setLoadingList(true);
    try {
      const res = await API.get("/users/" + user.id + "/followers/list");
      setFollowersList(res.data || []);
    } catch {
      try {
        const res = await API.get("/users/" + user.username + "/followers");
        setFollowersList(res.data?.list || res.data?.followers || []);
      } catch {}
    }
    setLoadingList(false);
  };

const openFollowing = async () => {
    setShowFollowingModal(true);
    setLoadingList(true);
    try {
      const res = await API.get("/users/" + user.id + "/following/list");
      setFollowingList(res.data || []);
    } catch {
      try {
        const res = await API.get("/users/" + user.username + "/following");
        setFollowingList(res.data?.list || res.data?.following || []);
      } catch {}
    }
    setLoadingList(false);
  };

  const deletePost = async (id) => {
    if (!window.confirm("Delete this post?")) return;
    try { await API.delete("/posts/" + id); setPosts(p => p.filter(x => x.id !== id)); setSelectedPost(null); } catch {}
  };

  const deleteStory = async (id) => {
    if (!window.confirm("Delete this story?")) return;
    try { await API.delete("/stories/" + id); setStories(s => s.filter(x => x.id !== id)); setActiveStory(null); } catch {}
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const res = await API.put("/users/profile", { fullName: user.fullName, username: user.username, bio: user.bio, website: user.website, avatar: reader.result });
        const newAvatar = res.data.avatar || reader.result;
        if (setUser) setUser(prev => ({...prev, avatar: newAvatar}));
        localStorage.setItem("user", JSON.stringify({...user, avatar: newAvatar}));
      } catch {}
      setUploading(false);
      setShowAvatarMenu(false);
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = async () => {
    try { await API.put("/users/remove-avatar"); if (setUser) setUser(prev => ({...prev, avatar: ""})); } catch {}
    setShowAvatarMenu(false);
  };

  const togglePrivacy = async () => {
    const newVal = !isPrivate;
    setIsPrivate(newVal);
    if (setUser) setUser(prev => ({...prev, isPrivate: newVal}));
    try { await API.put("/users/privacy"); } catch { setIsPrivate(!newVal); }
  };

  const shareProfile = () => {
    const url = window.location.origin + "/user/" + user?.username;
    if (navigator.share) { navigator.share({ title: "@" + user?.username + " on Luciagram", url }); }
    else { navigator.clipboard?.writeText(url); alert("Profile link copied! 🔗"); }
  };

  const hasStory = stories.length > 0;
  const currentStoryItem = stories[storyIndex];

  const UserListModal = ({ title, list, loading, onClose }) => (
    <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div onClick={onClose} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
      <div style={{background:"#1a1a2e",borderRadius:"20px 20px 0 0",maxHeight:"75vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"1rem",borderBottom:"1px solid #2a2a3a",textAlign:"center"}}>
          <div style={{width:"40px",height:"4px",background:"#444",borderRadius:"2px",margin:"0 auto 0.75rem"}} />
          <div style={{fontWeight:"bold",fontSize:"1rem"}}>{title}</div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"0.5rem 1rem"}}>
          {loading ? (
            <div style={{textAlign:"center",padding:"2rem",color:"#888"}}>Loading...</div>
          ) : list.length === 0 ? (
            <div style={{textAlign:"center",padding:"2rem",color:"#888"}}>No users yet</div>
          ) : list.map((u, i) => (
            <div key={u.id||u._id||i} onClick={()=>{onClose();navigate("/user/"+(u.username));}} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.75rem 0",borderBottom:"1px solid #1e1e2e",cursor:"pointer"}}>
              <div style={{width:"44px",height:"44px",borderRadius:"50%",overflow:"hidden",flexShrink:0}}>
                {u.avatar ? <img src={u.avatar} alt={u.username} style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <div style={{width:"100%",height:"100%",background:gradients[i%3],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",color:"white"}}>{avatar(u.username)}</div>}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:"bold",fontSize:"0.95rem"}}>@{u.username}</div>
                {u.fullName && <div style={{color:"#888",fontSize:"0.8rem"}}>{u.fullName}</div>}
              </div>
              {u.isVerified && <span style={{color:"#60a5fa",fontSize:"0.85rem"}}>✓</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
    <style>{`
      @keyframes progress { from { width:0% } to { width:100% } }
      @keyframes storyRing { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
      @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
    `}</style>

    <input ref={avatarRef} type="file" accept="image/*,image/gif" style={{display:"none"}} onChange={handleAvatarUpload} />

    <div style={{background:"#0a0a0f",minHeight:"100vh",color:"white",paddingBottom:"70px"}}>

      {/* Header */}
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
          <span style={{fontWeight:"bold",fontSize:"1.1rem"}}>@{user?.username}</span>
          {isPrivate && <span style={{fontSize:"0.75rem",background:"#1e1e2e",borderRadius:"6px",padding:"0.1rem 0.4rem",color:"#a78bfa"}}>🔒 Private</span>}
        </div>
        <div style={{display:"flex",gap:"0.75rem",alignItems:"center"}}>
          <span onClick={()=>navigate("/notifications")} style={{fontSize:"1.3rem",cursor:"pointer"}}>🔔</span>
          <span onClick={()=>setShowSettings(true)} style={{fontSize:"1.3rem",cursor:"pointer"}}>☰</span>
        </div>
      </div>

      {/* Profile Info */}
      <div style={{padding:"1.5rem 1rem"}}>
        <div style={{display:"flex",alignItems:"center",gap:"1.5rem",marginBottom:"1rem"}}>

          {/* Avatar */}
          <div style={{flexShrink:0,position:"relative"}} onClick={()=> hasStory ? setActiveStory(stories[0]) : setShowAvatarMenu(true)}>
            <div style={{padding:"3px",borderRadius:"50%",background:hasStory?"linear-gradient(90deg,#7c3aed,#db2777,#f59e0b,#7c3aed)":"transparent",backgroundSize:hasStory?"300% 300%":"auto",animation:hasStory?"storyRing 3s ease infinite":"none",border:hasStory?"none":"3px solid #333",cursor:"pointer"}}>
              {uploading ? (
                <div style={{width:"86px",height:"86px",borderRadius:"50%",background:"#1e1e2e",border:"3px solid #0a0a0f",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem"}}>⏳</div>
              ) : user?.avatar ? (
                <img src={user.avatar} alt="avatar" style={{width:"86px",height:"86px",borderRadius:"50%",objectFit:"cover",border:"3px solid #0a0a0f",display:"block"}} onError={e=>{e.target.style.display="none";}} />
              ) : (
                <div style={{width:"86px",height:"86px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2rem",fontWeight:"bold",border:"3px solid #0a0a0f"}}>{avatar(user?.username)}</div>
              )}
            </div>
            {!hasStory && (
              <div onClick={e=>{e.stopPropagation();setShowAvatarMenu(true);}} style={{position:"absolute",bottom:2,right:2,width:"24px",height:"24px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"2px solid #0a0a0f",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",cursor:"pointer"}}>📷</div>
            )}
          </div>

{/* Stats */}
          <div style={{display:"flex",gap:"1rem",flex:1,justifyContent:"space-around"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontWeight:"bold",fontSize:"1.2rem"}}>{posts.length}</div>
              <div style={{color:"#888",fontSize:"0.8rem"}}>Posts</div>
            </div>
            <div onClick={openFollowers} style={{textAlign:"center",cursor:"pointer"}}>
              <div style={{fontWeight:"bold",fontSize:"1.2rem"}}>{stats.followers || 0}</div>
              <div style={{color:"#888",fontSize:"0.8rem"}}>Followers</div>
            </div>
            <div onClick={openFollowing} style={{textAlign:"center",cursor:"pointer"}}>
              <div style={{fontWeight:"bold",fontSize:"1.2rem"}}>{stats.following || 0}</div>
              <div style={{color:"#888",fontSize:"0.8rem"}}>Following</div>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div style={{marginBottom:"1rem"}}>
          <div style={{fontWeight:"bold"}}>{user?.fullName}</div>
          {user?.bio && <div style={{color:"#ddd",fontSize:"0.85rem",marginTop:"0.2rem",whiteSpace:"pre-line"}}>{user.bio}</div>}
          {user?.song && (
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginTop:"0.5rem",background:"#1e1e2e",borderRadius:"20px",padding:"0.4rem 0.85rem",cursor:"pointer",width:"fit-content"}} onClick={()=>{const a=new Audio(user.song.previewUrl);a.play();}}>
              <span style={{fontSize:"0.9rem"}}>🎷</span>
              <div style={{minWidth:0}}>
                <div style={{fontSize:"0.78rem",fontWeight:"bold",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"160px"}}>{user.song.title}</div>
                <div style={{fontSize:"0.68rem",color:"#888"}}>{user.song.artist}</div>
              </div>
              <span style={{fontSize:"0.7rem",color:"#a78bfa"}}>▶</span>
            </div>
          )}
          {user?.website && <div style={{color:"#c084fc",fontSize:"0.85rem",marginTop:"0.2rem"}}>{user.website}</div>}
          {user?.bio && (
            <div style={{marginTop:"0.4rem",display:"flex",flexWrap:"wrap",gap:"0.3rem"}}>
              {(user.bio || "").match(/#[a-zA-Z0-9_]+/g)?.map((tag,i) => (
                <span key={i} onClick={()=>navigate("/search?q="+tag)} style={{color:"#a78bfa",fontSize:"0.82rem",cursor:"pointer"}}>{tag}</span>
              ))}
            </div>
          )}
        </div>

        {/* Private account banner */}
        {isPrivate && (
          <div style={{background:"linear-gradient(135deg,rgba(124,58,237,0.15),rgba(219,39,119,0.15))",border:"1px solid rgba(124,58,237,0.3)",borderRadius:"12px",padding:"0.6rem 0.9rem",marginBottom:"0.75rem",display:"flex",alignItems:"center",gap:"0.5rem"}}>
            <span>🔒</span>
            <div>
              <div style={{fontSize:"0.85rem",fontWeight:"bold",color:"#a78bfa"}}>Private Account</div>
              <div style={{fontSize:"0.75rem",color:"#888"}}>Only followers can see your posts</div>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{display:"flex",gap:"0.75rem"}}>
          <button onClick={()=>navigate("/edit-profile")} style={{flex:1,padding:"0.5rem",background:"#1e1e2e",border:"1px solid #2a2a3a",borderRadius:"8px",color:"white",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem"}}>Edit Profile</button>
          <button onClick={shareProfile} style={{flex:1,padding:"0.5rem",background:"#1e1e2e",border:"1px solid #2a2a3a",borderRadius:"8px",color:"white",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem"}}>🔗 Share</button>
        </div>
      </div>

      {/* Stories Row */}
      <div style={{overflowX:"auto",display:"flex",gap:"1rem",padding:"0 1rem 1rem",scrollbarWidth:"none",borderBottom:"1px solid #1e1e2e"}}>
        <div onClick={()=>navigate("/upload")} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.4rem",minWidth:"64px",cursor:"pointer"}}>
          <div style={{width:"60px",height:"60px",borderRadius:"50%",border:"1px dashed #7c3aed",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem"}}>+</div>
          <span style={{fontSize:"0.7rem",color:"#888"}}>New</span>
        </div>
        {stories.map((s,i) => (
          <div key={s.id||i} onClick={()=>{setActiveStory(s);setStoryIndex(i);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.4rem",minWidth:"64px",cursor:"pointer"}}>
            <div style={{padding:"2px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)"}}>
              {s.mediaUrl ? (
                s.mediaType === "video" ? <video src={s.mediaUrl} style={{width:"56px",height:"56px",borderRadius:"50%",objectFit:"cover",border:"2px solid #0a0a0f"}} /> : <img src={s.mediaUrl} alt="story" style={{width:"56px",height:"56px",borderRadius:"50%",objectFit:"cover",border:"2px solid #0a0a0f"}} />
              ) : (
                <div style={{width:"56px",height:"56px",borderRadius:"50%",background:gradients[i%3],display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #0a0a0f"}}>🦋</div>
              )}
            </div>
            <span style={{fontSize:"0.65rem",color:"#ccc"}}>Story {i+1}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:"1px solid #1e1e2e"}}>
        {[["posts","⊞"],["reels","🎬"],["saved","🔖"]].map(([tab,icon]) => (
          <button key={tab} onClick={()=>setActiveTab(tab)} style={{flex:1,padding:"0.75rem",background:"transparent",border:"none",borderBottom:activeTab===tab?"2px solid white":"2px solid transparent",color:activeTab===tab?"white":"#888",cursor:"pointer",fontSize:"1.2rem"}}>{icon}</button>
        ))}
      </div>

      {activeTab === "posts" && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"2px",padding:"2px"}}>
          {posts.length === 0 ? (
            <div style={{gridColumn:"1/-1",textAlign:"center",color:"#888",padding:"3rem"}}>
              <div style={{fontSize:"2rem"}}>📸</div><p>No posts yet</p>
              <button onClick={()=>navigate("/upload")} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"8px",color:"white",padding:"0.5rem 1rem",cursor:"pointer"}}>Create Post</button>
            </div>
          ) : posts.map((p,i) => (
            <div key={p.id||i} onClick={()=>setSelectedPost(p)} style={{aspectRatio:"1",overflow:"hidden",cursor:"pointer",position:"relative"}}>
              {p.mediaType === "video" ? <video src={p.mediaUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} /> : p.mediaUrl ? <img src={p.mediaUrl} alt="post" style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <div style={{width:"100%",height:"100%",background:gradients[i%3],display:"flex",alignItems:"center",justifyContent:"center"}}>🦋</div>}
              {p.mediaType === "video" && <div style={{position:"absolute",top:"0.3rem",right:"0.3rem",fontSize:"0.8rem"}}>🎬</div>}
            </div>
          ))}
        </div>
      )}

      {activeTab === "reels" && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"2px",padding:"2px"}}>
          {posts.filter(p=>p.mediaType==="video").length === 0 ? (
            <div style={{gridColumn:"1/-1",textAlign:"center",color:"#888",padding:"3rem"}}>
              <div style={{fontSize:"2rem"}}>🎬</div><p>No reels yet</p>
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
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"2px",padding:"2px"}}>
          {savedPosts.length === 0 ? (
            <div style={{gridColumn:"1/-1",textAlign:"center",color:"#888",padding:"3rem"}}>
              <div style={{fontSize:"2rem"}}>🔖</div><p>No saved posts yet</p>
            </div>
          ) : savedPosts.map((p,i) => (
            <div key={p.id||i} onClick={()=>setSelectedPost(p)} style={{aspectRatio:"1",overflow:"hidden",cursor:"pointer",position:"relative"}}>
              {p.mediaType === "video" ? <video src={p.mediaUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <img src={p.mediaUrl} alt="post" style={{width:"100%",height:"100%",objectFit:"cover"}} />}
            </div>
          ))}
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0a0a0f",borderTop:"1px solid #1e1e2e",display:"flex",justifyContent:"space-around",padding:"0.75rem 0",paddingBottom:"calc(0.75rem + env(safe-area-inset-bottom, 0px))",zIndex:100}}>
        <span onClick={()=>navigate("/")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🏠</span>
        <span onClick={()=>navigate("/search")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🔍</span>
        <div onClick={()=>navigate("/upload")} style={{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1.2rem"}}>+</div>
        <span onClick={()=>navigate("/reels")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🎬</span>
        <div style={{width:"28px",height:"28px",borderRadius:"50%",overflow:"hidden",border:"2px solid #7c3aed",animation:"pulse 2s infinite"}}>
          {user?.avatar ? <img src={user.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="p" onError={e=>{e.target.style.display="none";}}/> : <div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",fontWeight:"bold"}}>{avatar(user?.username)}</div>}
        </div>
      </div>

      {/* Post Viewer */}
      {selectedPost && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",zIndex:200,display:"flex",flexDirection:"column"}}>
          <div style={{padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span onClick={()=>setSelectedPost(null)} style={{cursor:"pointer",fontSize:"1.5rem"}}>✕</span>
            <span style={{fontWeight:"bold"}}>Post</span>
            <span onClick={()=>deletePost(selectedPost.id)} style={{color:"#f87171",cursor:"pointer"}}>🗑️</span>
          </div>
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
            {selectedPost.mediaType === "video" ? <video src={selectedPost.mediaUrl} controls autoPlay style={{maxWidth:"100%",maxHeight:"80vh",borderRadius:"12px"}} /> : <img src={selectedPost.mediaUrl} alt="post" style={{maxWidth:"100%",maxHeight:"80vh",borderRadius:"12px",objectFit:"contain"}} />}
          </div>
          {selectedPost.caption && <div style={{padding:"1rem",color:"white"}}><span style={{fontWeight:"bold"}}>@{user?.username}</span> {selectedPost.caption}</div>}
        </div>
      )}

      {/* Story Viewer */}
      {activeStory && currentStoryItem && (
        <div style={{position:"fixed",inset:0,background:"black",zIndex:200,display:"flex",flexDirection:"column"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,padding:"0.5rem",display:"flex",gap:"3px",zIndex:10}}>
            {stories.map((_,idx) => (
              <div key={idx} style={{flex:1,height:"3px",background:"rgba(255,255,255,0.3)",borderRadius:"2px",overflow:"hidden"}}>
                <div style={{height:"100%",background:"white",borderRadius:"2px",width:idx<storyIndex?"100%":"0%",animation:idx===storyIndex&&storyDuration?`progress ${storyDuration/1000}s linear forwards`:"none"}} />
              </div>
            ))}
          </div>
          <div style={{position:"absolute",top:"1.5rem",left:"1rem",right:"1rem",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:10}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
              {user?.avatar ? <img src={user.avatar} alt="a" style={{width:"36px",height:"36px",borderRadius:"50%",objectFit:"cover"}} onError={e=>{e.target.style.display="none";}} /> : <div style={{width:"36px",height:"36px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold"}}>{avatar(user?.username)}</div>}
              <div>
                <div style={{fontWeight:"bold",fontSize:"0.9rem",color:"white"}}>@{user?.username}</div>
                <div style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.7)"}}>{storyIndex+1}/{stories.length}{storyViews[currentStoryItem?.id]&&<span style={{marginLeft:"0.4rem"}}>· 👁 {storyViews[currentStoryItem.id].count}</span>}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:"1rem"}}>
              <span onClick={()=>deleteStory(currentStoryItem.id)} style={{cursor:"pointer",fontSize:"1.2rem"}}>🗑️</span>
              <span onClick={()=>{setActiveStory(null);setStoryIndex(0);}} style={{cursor:"pointer",fontSize:"1.2rem",color:"white"}}>✕</span>
            </div>
          </div>
          <div style={{flex:1,position:"relative"}} onClick={e=>{ const x=e.clientX,w=window.innerWidth; if(x<w/2){if(storyIndex>0)setStoryIndex(i=>i-1);else{setActiveStory(null);setStoryIndex(0);}}else{if(storyIndex<stories.length-1)setStoryIndex(i=>i+1);else{setActiveStory(null);setStoryIndex(0);}}}}>
            {currentStoryItem.mediaType==="video" ? <video src={currentStoryItem.mediaUrl} autoPlay style={{width:"100%",height:"100%",objectFit:"contain",position:"absolute",background:"#000"}} playsInline onLoadedMetadata={handleStoryVideoLoaded} onEnded={()=>{if(storyIndex<stories.length-1)setStoryIndex(i=>i+1);else{setActiveStory(null);setStoryIndex(0);}}} /> : currentStoryItem.mediaUrl ? <img src={currentStoryItem.mediaUrl} alt="story" style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}} /> : <div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#1a0533,#2d0a4e)",position:"absolute",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{fontSize:"4rem"}}>🦋</div></div>}
          </div>
        </div>
      )}

      {/* Followers Modal */}
      {showFollowersModal && <UserListModal title={`Followers (${stats.followers||0})`} list={followersList} loading={loadingList} onClose={()=>setShowFollowersModal(false)} />}

      {/* Following Modal */}
      {showFollowingModal && <UserListModal title={`Following (${stats.following||0})`} list={followingList} loading={loadingList} onClose={()=>setShowFollowingModal(false)} />}

      {/* Avatar Menu */}
      {showAvatarMenu && (
        <div style={{position:"fixed",inset:0,zIndex:1100,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowAvatarMenu(false)} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
          <div style={{background:"#1a1a2e",borderRadius:"20px 20px 0 0",padding:"1.5rem 1rem"}}>
            <div style={{width:"40px",height:"4px",background:"#444",borderRadius:"2px",margin:"0 auto 1.5rem"}} />
            <div style={{fontWeight:"bold",textAlign:"center",marginBottom:"1.25rem"}}>Profile Photo</div>
            {[
              {icon:"📷", label:"Upload Photo / GIF", action:()=>{avatarRef.current?.click();}},
              ...(user?.avatar ? [{icon:"🗑️", label:"Remove Photo", action:removeAvatar, danger:true}] : []),
              {icon:"✕", label:"Cancel", action:()=>setShowAvatarMenu(false)},
            ].map((opt,i) => (
              <div key={i} onClick={opt.action} style={{display:"flex",alignItems:"center",gap:"1rem",padding:"0.85rem 0.5rem",borderBottom:"1px solid #2a2a3a",cursor:"pointer"}}>
                <span style={{fontSize:"1.3rem"}}>{opt.icon}</span>
                <span style={{fontSize:"1rem",color:opt.danger?"#f87171":"white"}}>{opt.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Sheet */}
      {showSettings && (
        <div style={{position:"fixed",inset:0,zIndex:1100,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowSettings(false)} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
          <div style={{background:"#1a1a2e",borderRadius:"20px 20px 0 0",padding:"1.5rem 1rem",maxHeight:"80vh",overflowY:"auto"}}>
            <div style={{width:"40px",height:"4px",background:"#444",borderRadius:"2px",margin:"0 auto 1.5rem"}} />
            <div style={{fontWeight:"bold",fontSize:"1.1rem",textAlign:"center",marginBottom:"1.25rem"}}>Settings</div>
            {[
              {icon:"✏️", label:"Edit Profile", action:()=>{setShowSettings(false);navigate("/edit-profile");}},
              {icon:"🔔", label:"Notifications", action:()=>{setShowSettings(false);navigate("/notifications");}},
              {icon:isPrivate?"🌐":"🔒", label:isPrivate?"Switch to Public Account":"Switch to Private Account", action:()=>{togglePrivacy();setShowSettings(false);}},
              {icon:"📷", label:"Change Profile Photo", action:()=>{setShowSettings(false);setShowAvatarMenu(true);}},
              {icon:"🔗", label:"Share Profile", action:()=>{setShowSettings(false);shareProfile();}},
              {icon:"⚙️", label:"Account Settings", action:()=>{setShowSettings(false);navigate("/settings");}},
              {icon:"🚪", label:"Log Out", action:()=>{ logout(); navigate("/login"); }, danger:true},
            ].map((opt,i) => (
              <div key={i} onClick={opt.action} style={{display:"flex",alignItems:"center",gap:"1rem",padding:"0.85rem 0.5rem",borderBottom:"1px solid #2a2a3a",cursor:"pointer"}}>
                <span style={{fontSize:"1.3rem"}}>{opt.icon}</span>
                <span style={{fontSize:"1rem",color:opt.danger?"#f87171":"white"}}>{opt.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
    </>
  );
}
