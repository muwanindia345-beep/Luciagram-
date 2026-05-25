import React, { useEffect, useState, useRef } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import MediaLoader from "../components/MediaLoader";

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [activeStory, setActiveStory] = useState(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [liked, setLiked] = useState({});
  const [likeCounts, setLikeCounts] = useState({});
  const [saved, setSaved] = useState({});
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const videoRefs = useRef({});
  const storyTimer = useRef(null);

  useEffect(() => {
    API.get("/posts/feed").then(r => {
      setPosts(r.data);
      r.data.forEach(p => {
        API.get("/posts/" + p.id + "/likes").then(res => {
          setLikeCounts(prev => ({...prev, [p.id]: res.data.count}));
          setLiked(prev => ({...prev, [p.id]: res.data.liked}));
        }).catch(()=>{});
      });
    }).catch(()=>{});
    API.get("/stories").then(r => setStories(r.data)).catch(()=>{});
  }, []);

  // Story auto-advance timer
  useEffect(() => {
    if (activeStory) {
      storyTimer.current = setTimeout(() => {
        const items = activeStory.items || [activeStory];
        if (storyIndex < items.length - 1) {
          setStoryIndex(i => i + 1);
        } else {
          setActiveStory(null);
          setStoryIndex(0);
        }
      }, 5000);
    }
    return () => clearTimeout(storyTimer.current);
  }, [activeStory, storyIndex]);

  const handleLike = async (postId) => {
    const wasLiked = liked[postId];
    setLiked(p => ({...p, [postId]: !wasLiked}));
    setLikeCounts(p => ({...p, [postId]: (p[postId]||0) + (wasLiked ? -1 : 1)}));
    try {
      await API.post("/posts/" + postId + "/like");
    } catch {
      setLiked(p => ({...p, [postId]: wasLiked}));
      setLikeCounts(p => ({...p, [postId]: (p[postId]||0) + (wasLiked ? 1 : -1)}));
    }
  };

  const handleShare = async (post) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Luciagram Post by @" + post.username,
          text: post.caption || "Check this post on Luciagram!",
          url: window.location.origin,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(window.location.origin);
      alert("Link copied!");
    }
  };

  const handleSave = (postId) => {
    setSaved(p => ({...p, [postId]: !p[postId]}));
  };

  const getTimeLeft = (expiresAt) => {
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? hours + "h" : mins + "m";
  };

  const avatar = (name) => (name||"U").slice(0,1).toUpperCase();
  const gradients = ["linear-gradient(135deg,#7c3aed,#db2777)","linear-gradient(135deg,#f59e0b,#ef4444)","linear-gradient(135deg,#10b981,#3b82f6)","linear-gradient(135deg,#8b5cf6,#06b6d4)"];

  const AvatarImg = ({ username, size=36 }) => {
    if (user?.avatar && username === user?.username) {
      return <img src={user.avatar} alt={username} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover"}} />;
    }
    return <div style={{width:size,height:size,borderRadius:"50%",background:gradients[(username||"").charCodeAt(0)%4],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:size*0.35,color:"white"}}>{avatar(username)}</div>;
  };

  // Group stories by user
  const groupedStories = stories.reduce((acc, s) => {
    if (!acc[s.userId]) acc[s.userId] = { userId: s.userId, username: s.username, items: [] };
    acc[s.userId].items.push(s);
    return acc;
  }, {});
  const storyGroups = Object.values(groupedStories);

  const currentStoryItems = activeStory ? (activeStory.items || [activeStory]) : [];
  const currentStoryItem = currentStoryItems[storyIndex];

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

      {/* Stories Bar */}
      <div style={{overflowX:"auto",display:"flex",gap:"0.75rem",padding:"0.75rem 1rem",borderBottom:"1px solid #1e1e2e",scrollbarWidth:"none"}}>
        {/* Your story */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.3rem",minWidth:"64px"}}>
          <div onClick={()=>navigate("/upload")} style={{position:"relative",cursor:"pointer"}}>
            <div style={{width:"60px",height:"60px",borderRadius:"50%",overflow:"hidden",border:"2px solid #1e1e2e"}}>
              {user?.avatar ? <img src={user.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="you"/> : <div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem",fontWeight:"bold"}}>{avatar(user?.username)}</div>}
            </div>
            <div style={{position:"absolute",bottom:0,right:0,width:"20px",height:"20px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.8rem",border:"2px solid #0a0a0f"}}>+</div>
          </div>
          <span style={{fontSize:"0.65rem",color:"#888"}}>Your story</span>
        </div>

        {/* Other stories */}
        {storyGroups.map((group, i) => (
          <div key={group.userId||i} onClick={()=>{setActiveStory(group);setStoryIndex(0);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.3rem",minWidth:"64px",cursor:"pointer"}}>
            <div style={{padding:"2px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#f59e0b)"}}>
              <div style={{width:"56px",height:"56px",borderRadius:"50%",overflow:"hidden",border:"2px solid #0a0a0f"}}>
                {group.items[0]?.mediaId ? (
                  <MediaLoader
                    mediaId={group.items[0].mediaId}
                    mediaType={group.items[0].mediaType}
                    style={{width:"100%",height:"100%",objectFit:"cover"}}
                    muted={true}
                  />
                ) : (
                  <AvatarImg username={group.username} size={56} />
                )}
              </div>
            </div>
            <span style={{fontSize:"0.65rem",color:"#ccc",maxWidth:"64px",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>@{group.username}</span>
          </div>
        ))}
      </div>

      {/* Posts Feed */}
      <div style={{maxWidth:"600px",margin:"0 auto"}}>
        {posts.length === 0 ? (
          <div style={{textAlign:"center",color:"#888",marginTop:"4rem"}}>
            <img src="https://i.ibb.co/WWjtyhvX/file-00000000a5f0720bb84b412a53d8b399.png" alt="L" style={{width:"80px",borderRadius:"20px",opacity:0.4}} />
            <p>No posts yet. Be the first to post!</p>
            <button onClick={()=>navigate("/upload")} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"8px",color:"white",padding:"0.5rem 1rem",cursor:"pointer"}}>Create Post</button>
          </div>
        ) : posts.map((p,i) => (
          <div key={p.id||i} style={{borderBottom:"1px solid #1e1e2e",marginBottom:"0.5rem"}}>
            {/* Post Header */}
            <div style={{padding:"0.6rem 1rem",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.6rem"}}>
                <div style={{padding:"2px",borderRadius:"50%",background:p.userId===user?.id?"linear-gradient(135deg,#7c3aed,#db2777)":"transparent"}}>
                  <AvatarImg username={p.username} size={36} />
                </div>
                <div>
                  <div style={{fontWeight:"bold",fontSize:"0.9rem"}}>@{p.username||"user"}</div>
                  {p.location && <div style={{fontSize:"0.75rem",color:"#888"}}>📍{p.location}</div>}
                </div>
              </div>
              <span style={{color:"#888",cursor:"pointer",fontSize:"1.2rem"}} onClick={()=>{
                if(p.userId===user?.id && window.confirm("Delete this post?")) {
                  API.delete("/posts/"+p.id).then(()=>setPosts(prev=>prev.filter(x=>x.id!==p.id))).catch(()=>{});
                }
              }}>•••</span>
            </div>

            {/* Post Media */}
            {p.mediaId && (
              <div style={{position:"relative",background:"#000"}}>
                <MediaLoader
                  mediaId={p.mediaId}
                  mediaType={p.mediaType}
                  style={{width:"100%",maxHeight:"500px",objectFit:"cover",display:"block"}}
                  controls={p.mediaType==="video"}
                  loop={p.mediaType==="video"}
                  muted={p.mediaType==="video"}
                  playsInline={p.mediaType==="video"}
                  onClick={p.mediaType==="video"?()=>navigate("/reels"):undefined}
                />
                {p.mediaType==="video" && (
                  <div style={{position:"absolute",top:"0.5rem",right:"0.5rem",background:"rgba(0,0,0,0.6)",borderRadius:"20px",padding:"0.2rem 0.6rem",display:"flex",alignItems:"center",gap:"0.3rem"}}>
                    <span style={{fontSize:"0.8rem"}}>🎬</span>
                    <span style={{color:"white",fontSize:"0.8rem",fontWeight:"bold"}}>Reel</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{padding:"0.6rem 1rem"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"0.4rem"}}>
                <div style={{display:"flex",gap:"1rem",alignItems:"center"}}>
                  <span
                    onClick={()=>handleLike(p.id)}
                    style={{cursor:"pointer",fontSize:"1.6rem",transition:"transform 0.15s",display:"inline-block",transform:liked[p.id]?"scale(1.3)":"scale(1)"}}
                  >
                    {liked[p.id]?"❤️":"🤍"}
                  </span>
                  <span onClick={()=>navigate("/comments/"+p.id)} style={{cursor:"pointer",fontSize:"1.5rem"}}>💬</span>
                  <span onClick={()=>handleShare(p)} style={{cursor:"pointer",fontSize:"1.5rem"}}>➤</span>
                </div>
                <span onClick={()=>handleSave(p.id)} style={{cursor:"pointer",fontSize:"1.5rem"}}>{saved[p.id]?"🔖":"🔖"}</span>
              </div>
              <div style={{fontSize:"0.9rem",fontWeight:"bold",marginBottom:"0.2rem"}}>{likeCounts[p.id]||0} likes</div>
              {p.caption && <div style={{fontSize:"0.9rem"}}><span style={{fontWeight:"bold"}}>@{p.username||"user"}</span> {p.caption}</div>}
              <div onClick={()=>navigate("/comments/"+p.id)} style={{fontSize:"0.8rem",color:"#888",marginTop:"0.3rem",cursor:"pointer"}}>View all comments</div>
              <div style={{fontSize:"0.75rem",color:"#555",marginTop:"0.2rem"}}>{new Date(p.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0a0a0f",borderTop:"1px solid #1e1e2e",display:"flex",justifyContent:"space-around",padding:"0.75rem 0",zIndex:100}}>
        <span style={{fontSize:"1.5rem",cursor:"pointer",borderBottom:"2px solid white",paddingBottom:"2px"}}>🏠</span>
        <span onClick={()=>navigate("/search")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🔍</span>
        <div onClick={()=>navigate("/upload")} style={{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1.2rem"}}>+</div>
        <span onClick={()=>navigate("/reels")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🎬</span>
        <div onClick={()=>navigate("/profile")} style={{width:"28px",height:"28px",borderRadius:"50%",overflow:"hidden",cursor:"pointer",border:"2px solid #7c3aed"}}>
          {user?.avatar?<img src={user.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="p"/>:<div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",fontWeight:"bold"}}>{avatar(user?.username)}</div>}
        </div>
      </div>

      {/* Story Viewer */}
      {activeStory && currentStoryItem && (
        <div style={{position:"fixed",inset:0,background:"black",zIndex:200,display:"flex",flexDirection:"column"}}>
          {/* Progress bars */}
          <div style={{position:"absolute",top:0,left:0,right:0,padding:"0.5rem",display:"flex",gap:"3px",zIndex:10}}>
            {currentStoryItems.map((_,idx) => (
              <div key={idx} style={{flex:1,height:"3px",background:"rgba(255,255,255,0.3)",borderRadius:"2px",overflow:"hidden"}}>
                <div style={{height:"100%",background:"white",borderRadius:"2px",width:idx<storyIndex?"100%":idx===storyIndex?"100%":"0%",transition:idx===storyIndex?"width 5s linear":"none"}} />
              </div>
            ))}
          </div>

          {/* Story Header */}
          <div style={{position:"absolute",top:"1.5rem",left:"1rem",right:"1rem",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:10}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
              <AvatarImg username={activeStory.username} size={36} />
              <div>
                <div style={{fontWeight:"bold",fontSize:"0.9rem",color:"white"}}>@{activeStory.username}</div>
                <div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.7)"}}>{currentStoryItem.expiresAt ? getTimeLeft(currentStoryItem.expiresAt)+" left" : "24h"}</div>
              </div>
            </div>
            <span onClick={()=>{setActiveStory(null);setStoryIndex(0);}} style={{color:"white",cursor:"pointer",fontSize:"1.5rem"}}>✕</span>
          </div>

          {/* Story Media */}
          <div style={{flex:1,position:"relative"}} onClick={(e)=>{
            const x = e.clientX;
            const w = window.innerWidth;
            if (x < w/2) {
              if (storyIndex > 0) setStoryIndex(i=>i-1);
            } else {
              if (storyIndex < currentStoryItems.length-1) setStoryIndex(i=>i+1);
              else { setActiveStory(null); setStoryIndex(0); }
            }
          }}>
            {currentStoryItem.mediaId ? (
              <MediaLoader
                mediaId={currentStoryItem.mediaId}
                mediaType={currentStoryItem.mediaType}
                style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute"}}
                autoPlay={currentStoryItem.mediaType==="video"}
                loop={currentStoryItem.mediaType==="video"}
                playsInline={currentStoryItem.mediaType==="video"}
              />
            ) : (
              <div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#1a0533,#2d0a4e)",display:"flex",alignItems:"center",justifyContent:"center",position:"absolute"}}>
                <div style={{fontSize:"4rem"}}>🦋</div>
              </div>
            )}
            {/* Tap hints */}
            <div style={{position:"absolute",inset:0,display:"flex"}}>
              <div style={{flex:1}} />
              <div style={{flex:1}} />
            </div>
          </div>

          {/* Story Footer */}
          <div style={{padding:"1rem",display:"flex",alignItems:"center",gap:"0.75rem",zIndex:10}}>
            <input placeholder="Reply to story..." style={{flex:1,background:"transparent",border:"1px solid rgba(255,255,255,0.4)",borderRadius:"20px",padding:"0.6rem 1rem",color:"white",fontSize:"0.9rem",outline:"none"}} onClick={e=>e.stopPropagation()} />
            <span style={{fontSize:"1.3rem",cursor:"pointer"}}>❤️</span>
            <span onClick={()=>handleShare({username:activeStory.username,caption:""})} style={{fontSize:"1.3rem",cursor:"pointer"}}>➤</span>
          </div>
        </div>
      )}
    </div>
  );
}
