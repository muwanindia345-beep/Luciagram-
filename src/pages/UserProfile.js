import React, { useEffect, useState, useRef } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import MediaLoader from "../components/MediaLoader";

export default function UserProfile() {
  const { username } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  const [followStatus, setFollowStatus] = useState("none"); // none | following | requested
  const [stories, setStories] = useState([]);
  const [activeStory, setActiveStory] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyDuration, setStoryDuration] = useState(5000);
  const [selectedPost, setSelectedPost] = useState(null);
  const [activeTab, setActiveTab] = useState("posts");
  const [loading, setLoading] = useState(true);
  const [storyReply, setStoryReply] = useState("");
  const [storySent, setStorySent] = useState(false);
  const storyTimer = useRef(null);
  const gradients = ["linear-gradient(135deg,#7c3aed,#db2777)","linear-gradient(135deg,#f59e0b,#ef4444)","linear-gradient(135deg,#10b981,#3b82f6)"];
  const avatar = (name) => (name||"U").slice(0,1).toUpperCase();

  useEffect(() => { loadProfile(); }, [username]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await API.get("/users/" + username);
      setProfile(res.data);
      if (res.data.id) {
        const statsRes = await API.get("/users/" + res.data.id + "/followers");
        setStats(statsRes.data);
        setFollowStatus(statsRes.data.isFollowing ? "following" : "none");
      }
      const postsRes = await API.get("/posts/user/" + username);
      setPosts(postsRes.data);
      const storiesRes = await API.get("/stories/user/" + username);
      setStories(storiesRes.data || []);
    } catch (err) {
      console.error("Profile load error:", err?.response?.data || err.message);
      setProfile(null);
    } finally { setLoading(false); }
  };

  // Story auto advance
  useEffect(() => {
    if (!activeStory) return;
    clearTimeout(storyTimer.current);
    const item = stories[storyIndex];
    if (!item || item.mediaType === "video") return;
    storyTimer.current = setTimeout(() => {
      if (storyIndex < stories.length - 1) setStoryIndex(i => i+1);
      else setActiveStory(false);
    }, 5000);
    return () => clearTimeout(storyTimer.current);
  }, [activeStory, storyIndex, stories]);

  const handleStoryVideoLoaded = (e) => {
    const duration = e.target.duration * 1000 || 10000;
    setStoryDuration(duration);
    clearTimeout(storyTimer.current);
    storyTimer.current = setTimeout(() => {
      if (storyIndex < stories.length - 1) setStoryIndex(i => i+1);
      else setActiveStory(false);
    }, duration);
  };

  const handleFollow = async () => {
    try {
      if (profile.isPrivate && followStatus === "none") {
        const res = await API.post("/users/" + profile.id + "/follow-request");
        setFollowStatus(res.data.status === "following" ? "following" : res.data.status === "requested" ? "requested" : "none");
      } else {
        const res = await API.post("/users/" + profile.id + "/follow");
        setFollowStatus(res.data.following ? "following" : "none");
        setStats(s => ({...s, followers: s.followers + (res.data.following ? 1 : -1)}));
      }
    } catch {}
  };

  const sendStoryReply = async () => {
    if (!storyReply.trim()) return;
    const item = stories[storyIndex];
    try {
      await API.post("/messages", {
        receiverId: profile.id,
        receiverUsername: profile.username,
        text: "Replied to your story: " + storyReply,
        mediaUrl: "",
      });
      setStoryReply("");
      setStorySent(true);
      setTimeout(() => setStorySent(false), 2000);
    } catch {}
  };

  const followBtnLabel = () => {
    if (followStatus === "following") return "Following ✓";
    if (followStatus === "requested") return "Requested ⏳";
    return "Follow";
  };

  const followBtnStyle = () => {
    if (followStatus === "following") return {background:"transparent", border:"1px solid #444"};
    if (followStatus === "requested") return {background:"transparent", border:"1px solid #7c3aed"};
    return {background:"linear-gradient(135deg,#7c3aed,#db2777)", border:"none"};
  };

  const hasStory = stories.length > 0;
  const isPrivateLocked = profile?.isPrivate && followStatus !== "following" && profile.id !== user?.id;
  const currentStoryItem = stories[storyIndex];

  if (loading) return (
    <div style={{background:"#0a0a0f",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center",color:"white"}}>
        <div style={{fontSize:"2rem",marginBottom:"1rem"}}>🦋</div>
        <div style={{color:"#7c3aed"}}>Loading...</div>
      </div>
    </div>
  );

  if (!profile) return (
    <div style={{background:"#0a0a0f",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center",color:"white"}}>
        <div style={{fontSize:"2rem"}}>👤</div>
        <p>User not found</p>
        <button onClick={()=>navigate(-1)} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"8px",color:"white",padding:"0.5rem 1rem",cursor:"pointer"}}>Go Back</button>
      </div>
    </div>
  );

  return (
    <>
    <style>{`
      @keyframes storyRing { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
      @keyframes progress { from{width:0%} to{width:100%} }
    `}</style>
    <div style={{background:"#0a0a0f",minHeight:"100vh",color:"white",paddingBottom:"70px"}}>

      {/* Header */}
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",alignItems:"center",gap:"0.75rem",position:"sticky",top:0,zIndex:100}}>
        <span onClick={()=>navigate(-1)} style={{cursor:"pointer",fontSize:"1.3rem"}}>←</span>
        <span style={{fontWeight:"bold",fontSize:"1.1rem"}}>@{profile.username}</span>
        {profile.isVerified && <span style={{color:"#7c3aed",fontSize:"1rem"}}>✓</span>}
        {profile.isPrivate && <span style={{fontSize:"0.75rem",background:"#1e1e2e",borderRadius:"6px",padding:"0.1rem 0.4rem",color:"#888"}}>🔒</span>}
        {profile?.song && (
          <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginTop:"0.4rem",background:"#1e1e2e",borderRadius:"20px",padding:"0.35rem 0.85rem",cursor:"pointer"}}
            onClick={()=>{const a=new Audio(profile.song.previewUrl);a.play();}}>
            <span style={{fontSize:"0.85rem"}}>🎷</span>
            <div style={{minWidth:0}}>
              <div style={{fontSize:"0.75rem",fontWeight:"bold",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"150px"}}>{profile.song.title}</div>
              <div style={{fontSize:"0.67rem",color:"#888"}}>{profile.song.artist}</div>
            </div>
            <span style={{fontSize:"0.7rem",color:"#a78bfa"}}>▶</span>
          </div>
        )}
      </div>

      {/* Profile Info */}
      <div style={{padding:"1.5rem 1rem"}}>
        <div style={{display:"flex",alignItems:"center",gap:"1.5rem",marginBottom:"1rem"}}>

          {/* Animated avatar ring */}
          <div onClick={()=>hasStory && !isPrivateLocked && setActiveStory(true)} style={{flexShrink:0,cursor:hasStory&&!isPrivateLocked?"pointer":"default"}}>
            <div style={{
              padding:"3px", borderRadius:"50%",
              background: hasStory ? "linear-gradient(90deg,#7c3aed,#db2777,#f59e0b,#7c3aed)" : "transparent",
              backgroundSize: hasStory ? "300% 300%" : "auto",
              animation: hasStory ? "storyRing 3s ease infinite" : "none",
              border: hasStory ? "none" : "3px solid #333",
            }}>
              {profile.avatar ? (
                <img src={profile.avatar} alt={profile.username} style={{width:"86px",height:"86px",borderRadius:"50%",objectFit:"cover",border:"3px solid #0a0a0f",display:"block"}} />
              ) : (
                <div style={{width:"86px",height:"86px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2rem",fontWeight:"bold",border:"3px solid #0a0a0f"}}>{avatar(profile.username)}</div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{display:"flex",gap:"1.5rem",flex:1,justifyContent:"space-around"}}>
            <div style={{textAlign:"center"}}><div style={{fontWeight:"bold",fontSize:"1.2rem"}}>{isPrivateLocked ? "—" : posts.length}</div><div style={{color:"#888",fontSize:"0.8rem"}}>Posts</div></div>
            <div style={{textAlign:"center"}}><div style={{fontWeight:"bold",fontSize:"1.2rem"}}>{stats.followers}</div><div style={{color:"#888",fontSize:"0.8rem"}}>Followers</div></div>
            <div style={{textAlign:"center"}}><div style={{fontWeight:"bold",fontSize:"1.2rem"}}>{stats.following}</div><div style={{color:"#888",fontSize:"0.8rem"}}>Following</div></div>
          </div>
        </div>

        {/* Bio */}
        <div style={{marginBottom:"1rem"}}>
          <div style={{fontWeight:"bold"}}>{profile.fullName}</div>
          {profile.bio && <div style={{color:"#ddd",fontSize:"0.85rem",marginTop:"0.2rem",whiteSpace:"pre-line"}}>{profile.bio}</div>}
          {/* Hashtag tags */}
          {profile.bio && (
            <div style={{marginTop:"0.4rem",display:"flex",flexWrap:"wrap",gap:"0.3rem"}}>
              {profile.bio.match(/#\w+/g)?.map((tag,i) => (
                <span key={i} onClick={()=>navigate("/search?q="+tag)} style={{color:"#a78bfa",fontSize:"0.82rem",cursor:"pointer"}}>{tag}</span>
              ))}
            </div>
          )}
          {profile.website && <div style={{color:"#c084fc",fontSize:"0.85rem",marginTop:"0.3rem"}}>🔗 {profile.website}</div>}
        </div>

        {/* Action Buttons */}
        {profile.username !== user?.username && (
          <div style={{display:"flex",gap:"0.75rem"}}>
            <button onClick={handleFollow} style={{flex:1,padding:"0.5rem",borderRadius:"8px",color:"white",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem",...followBtnStyle()}}>
              {followBtnLabel()}
            </button>
            <button onClick={()=>navigate("/chat/"+profile.id+"?username="+profile.username)} style={{flex:1,padding:"0.5rem",background:"#1e1e2e",border:"1px solid #2a2a3a",borderRadius:"8px",color:"white",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem"}}>
              💬 Message
            </button>
          </div>
        )}
      </div>

      {/* PRIVATE LOCKED VIEW */}
      {isPrivateLocked ? (
        <div style={{textAlign:"center",padding:"3rem 1rem",borderTop:"1px solid #1e1e2e"}}>
          <div style={{fontSize:"3rem",marginBottom:"1rem"}}>🔒</div>
          <div style={{fontWeight:"bold",fontSize:"1.1rem",marginBottom:"0.5rem"}}>This Account is Private</div>
          <div style={{color:"#888",fontSize:"0.85rem",marginBottom:"1.5rem"}}>Follow @{profile.username} to see their photos and videos.</div>
          {followStatus === "requested" ? (
            <div style={{color:"#a78bfa",fontSize:"0.9rem"}}>⏳ Follow request sent</div>
          ) : (
            <button onClick={handleFollow} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"8px",color:"white",padding:"0.6rem 1.5rem",cursor:"pointer",fontWeight:"bold"}}>Follow to See Posts</button>
          )}
        </div>
      ) : (
        <>
          {/* Stories Row */}
          {stories.length > 0 && (
            <div style={{overflowX:"auto",display:"flex",gap:"1rem",padding:"0 1rem 1rem",scrollbarWidth:"none",borderBottom:"1px solid #1e1e2e"}}>
              {stories.map((s,i) => (
                <div key={s.id||i} onClick={()=>{setActiveStory(true);setStoryIndex(i);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.4rem",minWidth:"64px",cursor:"pointer"}}>
                  <div style={{padding:"2px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#f59e0b)"}}>
                    {s.mediaUrl ? (
                      s.mediaType === "video" ? <video src={s.mediaUrl} style={{width:"56px",height:"56px",borderRadius:"50%",objectFit:"cover",border:"2px solid #0a0a0f"}} muted /> : <img src={s.mediaUrl} alt="story" style={{width:"56px",height:"56px",borderRadius:"50%",objectFit:"cover",border:"2px solid #0a0a0f"}} />
                    ) : <div style={{width:"56px",height:"56px",borderRadius:"50%",background:gradients[i%3],display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #0a0a0f"}}>🦋</div>}
                  </div>
                  <span style={{fontSize:"0.65rem",color:"#ccc"}}>Story {i+1}</span>
                </div>
              ))}
            </div>
          )}
{/* Tabs */}
          <div style={{display:"flex",borderBottom:"1px solid #1e1e2e"}}>
            {[["posts","⊞"],["reels","🎬"]].map(([tab,icon]) => (
              <button key={tab} onClick={()=>setActiveTab(tab)} style={{flex:1,padding:"0.75rem",background:"transparent",border:"none",borderBottom:activeTab===tab?"2px solid white":"2px solid transparent",color:activeTab===tab?"white":"#888",cursor:"pointer",fontSize:"1.2rem"}}>{icon}</button>
            ))}
          </div>

          {/* Posts Grid */}
          {activeTab === "posts" && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"2px",padding:"2px"}}>
              {posts.length === 0 ? (
                <div style={{gridColumn:"1/-1",textAlign:"center",color:"#888",padding:"3rem"}}><div style={{fontSize:"2rem"}}>📸</div><p>No posts yet</p></div>
              ) : posts.map((p,i) => (
                <div key={p.id||i} onClick={()=>setSelectedPost(p)} style={{aspectRatio:"1",overflow:"hidden",cursor:"pointer",position:"relative"}}>
                  {p.mediaUrl ? (p.mediaType==="video" ? <video src={p.mediaUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} muted /> : <img src={p.mediaUrl} alt="post" style={{width:"100%",height:"100%",objectFit:"cover"}} />) : <div style={{width:"100%",height:"100%",background:gradients[i%3]}}>🦋</div>}
                  {p.mediaType === "video" && <div style={{position:"absolute",top:"0.3rem",right:"0.3rem",fontSize:"0.8rem"}}>🎬</div>}
                </div>
              ))}
            </div>
          )}

          {activeTab === "reels" && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"2px",padding:"2px"}}>
              {posts.filter(p=>p.mediaType==="video").length === 0 ? (
                <div style={{gridColumn:"1/-1",textAlign:"center",color:"#888",padding:"3rem"}}><div style={{fontSize:"2rem"}}>🎬</div><p>No reels yet</p></div>
              ) : posts.filter(p=>p.mediaType==="video").map((p,i) => (
                <div key={p.id||i} onClick={()=>setSelectedPost(p)} style={{aspectRatio:"1",overflow:"hidden",cursor:"pointer",position:"relative",background:"#000"}}>
                  <video src={p.mediaUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} muted />
                  <div style={{position:"absolute",bottom:"0.3rem",left:"0.3rem",fontSize:"0.75rem",color:"white"}}>🎬</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0a0a0f",borderTop:"1px solid #1e1e2e",display:"flex",justifyContent:"space-around",padding:"0.75rem 0",zIndex:100}}>
        <span onClick={()=>navigate("/")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🏠</span>
        <span onClick={()=>navigate("/search")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🔍</span>
        <div onClick={()=>navigate("/upload")} style={{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1.2rem"}}>+</div>
        <span onClick={()=>navigate("/reels")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🎬</span>
        <div onClick={()=>navigate("/profile")} style={{width:"28px",height:"28px",borderRadius:"50%",overflow:"hidden",cursor:"pointer",border:"2px solid #7c3aed"}}>
          {user?.avatar?<img src={user.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="p"/>:<div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",fontWeight:"bold"}}>{avatar(user?.username)}</div>}
        </div>
      </div>

      {/* Post Viewer */}
      {selectedPost && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.97)",zIndex:200,display:"flex",flexDirection:"column"}}>
          <div style={{padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span onClick={()=>setSelectedPost(null)} style={{cursor:"pointer",fontSize:"1.5rem"}}>✕</span>
            <span style={{fontWeight:"bold"}}>@{profile.username}</span>
            <span onClick={()=>navigate("/comments/"+selectedPost.id)} style={{color:"#c084fc",cursor:"pointer"}}>💬</span>
          </div>
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
            <MediaLoader mediaUrl={selectedPost.mediaUrl} mediaType={selectedPost.mediaType} style={{maxWidth:"100%",maxHeight:"80vh",borderRadius:"12px",objectFit:"contain"}} controls={selectedPost.mediaType==="video"} autoPlay={selectedPost.mediaType==="video"} />
          </div>
          {selectedPost.caption && <div style={{padding:"1rem",color:"white"}}><span style={{fontWeight:"bold"}}>@{profile.username}</span> {selectedPost.caption}</div>}
        </div>
      )}

      {/* Story Viewer */}
      {activeStory && currentStoryItem && (
        <div style={{position:"fixed",inset:0,background:"black",zIndex:300,display:"flex",flexDirection:"column"}}>
          {/* Progress */}
          <div style={{position:"absolute",top:0,left:0,right:0,padding:"0.5rem",display:"flex",gap:"3px",zIndex:10}}>
            {stories.map((_,idx) => (
              <div key={idx} style={{flex:1,height:"3px",background:"rgba(255,255,255,0.3)",borderRadius:"2px",overflow:"hidden"}}>
                <div style={{height:"100%",background:"white",borderRadius:"2px",width:idx<storyIndex?"100%":"0%",animation:idx===storyIndex&&storyDuration?`progress ${storyDuration/1000}s linear forwards`:"none"}} />
              </div>
            ))}
          </div>

          {/* Header */}
          <div style={{position:"absolute",top:"1.5rem",left:"1rem",right:"1rem",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:10}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
              {profile.avatar ? <img src={profile.avatar} alt="a" style={{width:"36px",height:"36px",borderRadius:"50%",objectFit:"cover"}} /> : <div style={{width:"36px",height:"36px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold"}}>{avatar(profile.username)}</div>}
              <div>
                <div style={{fontWeight:"bold",color:"white",fontSize:"0.9rem"}}>@{profile.username}</div>
                <div style={{color:"rgba(255,255,255,0.7)",fontSize:"0.75rem"}}>{storyIndex+1}/{stories.length}</div>
              </div>
            </div>
            <span onClick={()=>{setActiveStory(false);setStoryIndex(0);}} style={{color:"white",cursor:"pointer",fontSize:"1.5rem"}}>✕</span>
          </div>

          {/* Media */}
          <div style={{flex:1,position:"relative"}} onClick={(e)=>{
            const x=e.clientX,w=window.innerWidth;
            if(x<w/2){if(storyIndex>0)setStoryIndex(i=>i-1);else setActiveStory(false);}
            else{if(storyIndex<stories.length-1)setStoryIndex(i=>i+1);else setActiveStory(false);}
          }}>
            {currentStoryItem.mediaType==="video" ? (
              <video src={currentStoryItem.mediaUrl} autoPlay style={{width:"100%",height:"100%",objectFit:"contain",position:"absolute",background:"#000"}} playsInline onLoadedMetadata={handleStoryVideoLoaded} onEnded={()=>{if(storyIndex<stories.length-1)setStoryIndex(i=>i+1);else setActiveStory(false);}} />
            ) : currentStoryItem.mediaUrl ? (
              <img src={currentStoryItem.mediaUrl} alt="story" style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}} />
            ) : (
              <div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#1a0533,#2d0a4e)",position:"absolute",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{fontSize:"4rem"}}>🦋</div></div>
            )}
          </div>

          {/* Reply */}
          <div style={{padding:"1rem",display:"flex",alignItems:"center",gap:"0.75rem",zIndex:10}} onClick={e=>e.stopPropagation()}>
            {storySent ? (
              <div style={{flex:1,textAlign:"center",color:"#a78bfa",fontWeight:"bold"}}>✅ Reply sent!</div>
            ) : (
              <>
                <input value={storyReply} onChange={e=>setStoryReply(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendStoryReply()} placeholder={"Reply to @"+profile.username+"..."} style={{flex:1,background:"transparent",border:"1px solid rgba(255,255,255,0.4)",borderRadius:"20px",padding:"0.6rem 1rem",color:"white",fontSize:"0.9rem",outline:"none"}} />
                {storyReply.trim() ? (
                  <button onClick={sendStoryReply} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"50%",width:"36px",height:"36px",color:"white",cursor:"pointer",fontSize:"1rem",flexShrink:0}}>➤</button>
                ) : <span style={{fontSize:"1.3rem",cursor:"pointer"}}>❤️</span>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
