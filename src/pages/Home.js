import React, { useEffect, useState, useRef, useCallback } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import MediaLoader from "../components/MediaLoader";

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const feedBottomRef = useRef(null);
  const [stories, setStories] = useState([]);
  const [activeStory, setActiveStory] = useState(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [liked, setLiked] = useState({});
  const [likeCounts, setLikeCounts] = useState({});
  const [saved, setSaved] = useState(() => JSON.parse(localStorage.getItem("luciagram_saved") || "{}"));
  const [userProfiles, setUserProfiles] = useState({});
  const [followingMap, setFollowingMap] = useState({});
  const [inlineComments, setInlineComments] = useState({});
  const [showShareSheet, setShowShareSheet] = useState(null);
  const [dmSearch, setDmSearch] = useState("");
  const [dmUsers, setDmUsers] = useState([]);
  const [sentTo, setSentTo] = useState({});
  const [storyReplyText, setStoryReplyText] = useState("");
  const [storySent, setStorySent] = useState(false);
  const [doubleTapTimer, setDoubleTapTimer] = useState({});
  const { user } = useAuth();
  const navigate = useNavigate();
  const storyTimer = useRef(null);
  const storyVideoRef = useRef(null);
  const [storyDuration, setStoryDuration] = useState(5000);
  const [storyViews, setStoryViews] = useState({});

  useEffect(() => {
    API.get("/posts/feed?page=1").then(r => {
      const newPosts = r.data.posts || r.data;
      setHasMore(r.data.hasMore !== false);
      setLoadingFeed(false);
      setPosts(Array.isArray(newPosts) ? newPosts : []);
      (Array.isArray(newPosts) ? newPosts : []).forEach(p => {
        API.get("/posts/" + p.id + "/likes").then(res => {
          setLikeCounts(prev => ({...prev, [p.id]: res.data.count}));
          setLiked(prev => ({...prev, [p.id]: res.data.liked}));
        }).catch(()=>{});
        // Load first 2 comments per post
        API.get("/comments/" + p.id).then(res => {
          setInlineComments(prev => ({...prev, [p.id]: res.data.slice(0,2)}));
        }).catch(()=>{});
      });
    }).catch(()=>{ setLoadingFeed(false); });
    API.get("/stories").then(r => setStories(r.data)).catch(()=>{});
    API.get("/messages/conversations").then(r => {
      setDmUsers(r.data.map(c => ({ id: c.userId, username: c.username })));
    }).catch(()=>{});
  }, []);

  // Fetch real profile for each unique username
  useEffect(() => {
    const usernames = [...new Set([
      ...posts.map(p => p.username),
      ...stories.map(s => s.username),
    ])].filter(u => u && !userProfiles[u] && u !== user?.username);
    usernames.forEach(username => {
      API.get("/users/" + username).then(res => {
        setUserProfiles(prev => ({...prev, [username]: res.data}));
      }).catch(()=>{});
    });
  }, [posts, stories]);

  // Story auto-advance — dynamic duration based on media type
  useEffect(() => {
    if (!activeStory) return;
    clearTimeout(storyTimer.current);

    const items = activeStory.items || [];
    const currentItem = items[storyIndex];
    const isVideo = currentItem?.mediaType === "video";

    const advance = () => {
      if (storyIndex < items.length - 1) {
        setStoryIndex(i => i + 1);
      } else {
        setActiveStory(null);
        setStoryIndex(0);
      }
    };

    if (isVideo) {
      // Wait for video to report duration, then use it
      // Timer will be set by onLoadedMetadata on video element
      setStoryDuration(null); // null = waiting for video
    } else {
      setStoryDuration(5000);
      storyTimer.current = setTimeout(advance, 5000);
    }

    return () => clearTimeout(storyTimer.current);
  }, [activeStory, storyIndex]);

  const handleStoryVideoLoaded = (e) => {
    const video = e.target;
    const duration = video.duration * 1000 || 10000;
    setStoryDuration(duration);
    clearTimeout(storyTimer.current);
    const items = activeStory?.items || [];
    storyTimer.current = setTimeout(() => {
      if (storyIndex < items.length - 1) {
        setStoryIndex(i => i + 1);
      } else {
        setActiveStory(null);
        setStoryIndex(0);
      }
    }, duration);
  };

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

  const handleDoubleTap = (postId) => {
    const now = Date.now();
    const last = doubleTapTimer[postId] || 0;
    if (now - last < 350) {
      if (!liked[postId]) handleLike(postId);
      setDoubleTapTimer(p => ({...p, [postId]: 0}));
    } else {
      setDoubleTapTimer(p => ({...p, [postId]: now}));
    }
  };

  const handleSave = (postId) => {
    const newSaved = {...saved, [postId]: !saved[postId]};
    setSaved(newSaved);
    localStorage.setItem("luciagram_saved", JSON.stringify(newSaved));
  };

  const handleFollow = async (userId, username) => {
    try {
      const res = await API.post("/users/" + userId + "/follow");
      setFollowingMap(p => ({...p, [userId]: res.data.following}));
    } catch {}
  };

  const openShareSheet = async (post) => {
    setShowShareSheet(post);
    setSentTo({});
    setDmSearch("");
    try {
      const res = await API.get("/messages/conversations");
      setDmUsers(res.data.map(c => ({ id: c.userId, username: c.username })));
    } catch {}
  };

  const searchDMUsers = async (q) => {
    setDmSearch(q);
    if (q.length < 1) {
      API.get("/messages/conversations").then(r => setDmUsers(r.data.map(c => ({ id: c.userId, username: c.username })))).catch(()=>{});
      return;
    }
    try {
      const res = await API.get("/users/search?q=" + q);
      setDmUsers(res.data.filter(u => u.id !== user?.id).map(u => ({ id: u.id, username: u.username, avatar: u.avatar })));
    } catch {}
  };

  const sendPostViaDM = async (post, toUser) => {
    try {
      await API.post("/messages", {
        receiverId: toUser.id,
        receiverUsername: toUser.username,
        text: (post.caption ? post.caption + "\n" : "") + "📸 Shared a Post",
        mediaUrl: post.mediaUrl || "",
      });
      setSentTo(p => ({...p, [toUser.id]: true}));
    } catch {}
  };

  const sendStoryReply = async () => {
    if (!storyReplyText.trim() || !activeStory) return;
    const items = activeStory.items || [];
    const currentItem = items[storyIndex];
    if (!currentItem) return;
    try {
      const profile = userProfiles[activeStory.username] || {};
      await API.post("/messages", {
        receiverId: currentItem.userId || profile.id,
        receiverUsername: activeStory.username,
        text: "Replied to your story: " + storyReplyText,
        mediaUrl: "",
      });
      setStoryReplyText("");
      setStorySent(true);
      setTimeout(() => setStorySent(false), 2000);
    } catch {}
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
    const profile = username === user?.username ? user : userProfiles[username];
    if (profile?.avatar) {
      return <img src={profile.avatar} alt={username} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover"}} />;
    }
    return <div style={{width:size,height:size,borderRadius:"50%",background:gradients[(username||"").charCodeAt(0)%4],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:size*0.35,color:"white",flexShrink:0}}>{avatar(username)}</div>;
  };

  const groupedStories = stories.reduce((acc, s) => {
    if (!acc[s.userId]) acc[s.userId] = { userId: s.userId, username: s.username, items: [] };
    acc[s.userId].items.push(s);
    return acc;
  }, {});
  const storyGroups = Object.values(groupedStories);
  const currentStoryItems = activeStory ? (activeStory.items || []) : [];
  const currentStoryItem = currentStoryItems[storyIndex];

  return (
    <div style={{background:"#0a0a0f",minHeight:"100vh",color:"white",paddingBottom:"70px"}}>
      <style>{`
        @keyframes progress { from { width: 0% } to { width: 100% } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
        @keyframes heartPop { 0% { transform:scale(1) } 50% { transform:scale(1.5) } 100% { transform:scale(1) } }
        @keyframes fadeIn { from { opacity:0;transform:scale(0.8) } to { opacity:1;transform:scale(1) } }
      `}</style>

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

        {storyGroups.map((group, i) => (
          <div key={group.userId||i} onClick={()=>{
            setActiveStory(group);
            setStoryIndex(0);
            setStorySent(false);
            setStoryReplyText("");
            // Record view for first story item
            if(group.items?.[0]?.id) {
              API.post("/stories/"+group.items[0].id+"/view").catch(()=>{});
            }
            // Load views if my story
            if(group.userId === user?.id) {
              group.items.forEach(item => {
                API.get("/stories/"+item.id+"/views").then(r => {
                  setStoryViews(prev => ({...prev, [item.id]: r.data}));
                }).catch(()=>{});
              });
            }
          }} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.3rem",minWidth:"64px",cursor:"pointer"}}>
            <div style={{padding:"2px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#f59e0b)"}}>
              <div style={{width:"56px",height:"56px",borderRadius:"50%",overflow:"hidden",border:"2px solid #0a0a0f"}}>
                <AvatarImg username={group.username} size={56} />
              </div>
            </div>
            <span style={{fontSize:"0.65rem",color:"#ccc",maxWidth:"64px",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>@{group.username}</span>
          </div>
        ))}
      </div>
{/* Feed */}
      <div style={{maxWidth:"600px",margin:"0 auto"}}>
        {posts.length === 0 ? (
          <div style={{textAlign:"center",color:"#888",marginTop:"4rem"}}>
            <img src="https://i.ibb.co/WWjtyhvX/file-00000000a5f0720bb84b412a53d8b399.png" alt="L" style={{width:"80px",borderRadius:"20px",opacity:0.4}} />
            <p>No posts yet!</p>
            <button onClick={()=>navigate("/upload")} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"8px",color:"white",padding:"0.5rem 1rem",cursor:"pointer"}}>Create Post</button>
          </div>
        ) : posts.map((p,i) => (
          <div key={p.id||i} style={{borderBottom:"1px solid #1e1e2e"}}>
            {/* Post Header */}
            <div style={{padding:"0.6rem 1rem",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div onClick={()=>navigate("/user/"+p.username)} style={{display:"flex",alignItems:"center",gap:"0.6rem",cursor:"pointer"}}>
                <AvatarImg username={p.username} size={36} />
                <div>
                  <div style={{fontWeight:"bold",fontSize:"0.9rem"}}>@{p.username||"user"}</div>
                  {p.location && <div style={{fontSize:"0.75rem",color:"#888"}}>📍{p.location}</div>}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"0.75rem"}}>
                {/* Follow button for other users */}
                {p.userId !== user?.id && (
                  <button
                    onClick={()=>{ const profile = userProfiles[p.username]; if(profile?.id) handleFollow(profile.id, p.username); }}
                    style={{background:followingMap[userProfiles[p.username]?.id]?"transparent":"linear-gradient(135deg,#7c3aed,#db2777)",border:followingMap[userProfiles[p.username]?.id]?"1px solid #444":"none",borderRadius:"6px",color:"white",padding:"0.25rem 0.65rem",fontSize:"0.78rem",cursor:"pointer",fontWeight:"bold"}}
                  >
                    {followingMap[userProfiles[p.username]?.id] ? "Following" : "Follow"}
                  </button>
                )}
                {p.userId === user?.id && (
                  <span style={{color:"#888",cursor:"pointer",fontSize:"1.2rem"}} onClick={()=>{
                    if(window.confirm("Delete this post?")) {
                      API.delete("/posts/"+p.id).then(()=>setPosts(prev=>prev.filter(x=>x.id!==p.id))).catch(()=>{});
                    }
                  }}>🗑️</span>
                )}
              </div>
            </div>

            {/* Media — double tap to like */}
            {(p.mediaUrl || p.mediaId) && (
              <div style={{position:"relative",background:"#000"}} onClick={()=>handleDoubleTap(p.id)}>
                <MediaLoader
                  mediaUrl={p.mediaUrl}
                  mediaType={p.mediaType}
                  style={{width:"100%",maxHeight:"600px",minHeight:"200px",objectFit:p.mediaType==="video"?"cover":"contain",display:"block",background:"#000"}}
                  controls={p.mediaType==="video"}
                  loop={p.mediaType==="video"}
                  muted={p.mediaType==="video"}
                  playsInline={p.mediaType==="video"}
                />
                {p.mediaType==="video" && (<span style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.6)",borderRadius:"6px",padding:"2px 6px",fontSize:"0.7rem",color:"white"}}>🎬 Reel</span>)}{p.mediaType==="video" && (
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
                    style={{cursor:"pointer",fontSize:"1.6rem",display:"inline-block",animation:liked[p.id]?"heartPop 0.3s ease":"none"}}
                  >
                    {liked[p.id]?"❤️":"🤍"}
                  </span>
                  <span onClick={()=>navigate("/comments/"+p.id)} style={{cursor:"pointer",fontSize:"1.5rem"}}>💬</span>
                  <span onClick={()=>openShareSheet(p)} style={{cursor:"pointer",fontSize:"1.5rem"}}>📤</span>
                </div>
                <span onClick={()=>handleSave(p.id)} style={{cursor:"pointer",fontSize:"1.5rem",color:saved[p.id]?"#7c3aed":"white"}}>
                  {saved[p.id]?"🔖":"🔖"}
                </span>
              </div>
              <div style={{fontSize:"0.9rem",fontWeight:"bold",marginBottom:"0.2rem"}}>{likeCounts[p.id]||0} likes</div>
              {p.caption && <div style={{fontSize:"0.9rem"}}><span onClick={()=>navigate("/user/"+p.username)} style={{fontWeight:"bold",cursor:"pointer"}}>@{p.username}</span> {p.caption}</div>}

              {/* Inline comments preview with avatars */}
              {(inlineComments[p.id]||[]).length > 0 && (
                <div style={{marginTop:"0.4rem"}}>
                  {(inlineComments[p.id]||[]).map((c,ci) => (
                    <div key={c.id||ci} style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.2rem"}}>
                      <AvatarImg username={c.username} size={20} />
                      <span style={{fontSize:"0.82rem"}}><span style={{fontWeight:"bold",color:"#c084fc"}}>@{c.username}</span> {c.text}</span>
                    </div>
                  ))}
                </div>
              )}

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

      {/* Share DM Sheet */}
      {showShareSheet && (
        <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowShareSheet(null)} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
          <div style={{background:"#1a1a2e",borderRadius:"20px 20px 0 0",maxHeight:"75vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"1rem",borderBottom:"1px solid #2a2a3a"}}>
              <div style={{width:"40px",height:"4px",borderRadius:"2px",background:"#444",margin:"0 auto 1rem"}} />
              <div style={{fontWeight:"bold",color:"white",fontSize:"1rem",textAlign:"center",marginBottom:"0.75rem"}}>Send to...</div>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",background:"#13131a",borderRadius:"12px",padding:"0.6rem 1rem"}}>
                <span style={{color:"#888"}}>🔍</span>
                <input
                  value={dmSearch}
                  onChange={e=>searchDMUsers(e.target.value)}
                  placeholder="Search people..."
                  style={{flex:1,background:"transparent",border:"none",color:"white",fontSize:"0.95rem",outline:"none"}}
                  autoFocus
                />
              </div>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"0.75rem 1rem"}}>
              {dmUsers.length === 0 && (
                <div style={{textAlign:"center",color:"#888",padding:"2rem"}}>
                  <div style={{fontSize:"2rem"}}>💬</div>
                  <p style={{fontSize:"0.9rem"}}>Search for people to send to</p>
                </div>
              )}
              {dmUsers.map((u,i) => (
                <div key={u.id||i} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.75rem 0",borderBottom:"1px solid #1e1e2e"}}>
                  <AvatarImg username={u.username} size={44} />
                  <div style={{flex:1}}>
                    <div style={{fontWeight:"bold",color:"white",fontSize:"0.95rem"}}>@{u.username}</div>
                  </div>
                  <button
                    onClick={()=>sendPostViaDM(showShareSheet,u)}
                    disabled={sentTo[u.id]}
                    style={{padding:"0.4rem 1rem",background:sentTo[u.id]?"#2a2a3a":"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"20px",color:"white",cursor:sentTo[u.id]?"default":"pointer",fontSize:"0.85rem",fontWeight:"bold",flexShrink:0}}
                  >
                    {sentTo[u.id] ? "✓ Sent" : "Send"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Story Viewer */}
      {activeStory && currentStoryItem && (
        <div style={{position:"fixed",inset:0,background:"black",zIndex:200,display:"flex",flexDirection:"column"}}>
          {/* Per-item progress bars */}
          <div style={{position:"absolute",top:0,left:0,right:0,padding:"0.5rem",display:"flex",gap:"3px",zIndex:10}}>
            {currentStoryItems.map((_,idx) => (
              <div key={idx} style={{flex:1,height:"3px",background:"rgba(255,255,255,0.3)",borderRadius:"2px",overflow:"hidden"}}>
                <div style={{
                  height:"100%",
                  background:"white",
                  borderRadius:"2px",
                  width: idx < storyIndex ? "100%" : "0%",
                  animation: idx === storyIndex && storyDuration ? `progress ${storyDuration/1000}s linear forwards` : "none"
                }} />
              </div>
            ))}
          </div>

          {/* Story Header */}
          <div style={{position:"absolute",top:"1.5rem",left:"1rem",right:"1rem",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:10}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
              <AvatarImg username={activeStory.username} size={36} />
              <div>
                <div style={{fontWeight:"bold",fontSize:"0.9rem",color:"white"}}>@{activeStory.username}</div>
                <div style={{color:"rgba(255,255,255,0.7)",fontSize:"0.75rem"}}>
                  {currentStoryItem.expiresAt ? getTimeLeft(currentStoryItem.expiresAt)+" left" : "24h"} · {storyIndex+1}/{currentStoryItems.length}
                  {activeStory.userId === user?.id && storyViews[currentStoryItem?.id] && (
                    <span style={{marginLeft:"0.5rem",color:"rgba(255,255,255,0.9)"}}>
                      · 👁 {storyViews[currentStoryItem.id].count}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <span onClick={()=>{setActiveStory(null);setStoryIndex(0);}} style={{color:"white",cursor:"pointer",fontSize:"1.5rem"}}>✕</span>
          </div>

          {/* Story Media — tap left/right */}
          <div style={{flex:1,position:"relative"}} onClick={(e)=>{
            const x = e.clientX;
            const w = window.innerWidth;
            if(x < w/2) { if(storyIndex>0) setStoryIndex(i=>i-1); else {setActiveStory(null);setStoryIndex(0);} }
            else {
              const nextIdx = storyIndex+1;
              if(nextIdx<currentStoryItems.length) {
                setStoryIndex(nextIdx);
                const nextItem = currentStoryItems[nextIdx];
                if(nextItem?.id) API.post("/stories/"+nextItem.id+"/view").catch(()=>{});
              } else { setActiveStory(null); setStoryIndex(0); }
            }
          }}>
            {currentStoryItem.mediaType==="video" ? (
              <video
                src={currentStoryItem.mediaUrl}
                autoPlay
                style={{width:"100%",height:"100%",objectFit:"contain",position:"absolute",background:"#000"}}
                playsInline
                onLoadedMetadata={handleStoryVideoLoaded}
                onEnded={()=>{
                  const items = activeStory?.items||[];
                  if(storyIndex < items.length-1) setStoryIndex(i=>i+1);
                  else { setActiveStory(null); setStoryIndex(0); }
                }}
              />
            ) : currentStoryItem.mediaUrl ? (
              <img src={currentStoryItem.mediaUrl} alt="story" style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}} />
            ) : (
              <div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#1a0533,#2d0a4e)",position:"absolute",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{fontSize:"4rem"}}>🦋</div></div>
            )}
          </div>

          {/* Views list for owner */}
          {activeStory.userId === user?.id && storyViews[currentStoryItem?.id]?.viewers?.length > 0 && (
            <div style={{position:"absolute",bottom:"5rem",left:"1rem",right:"1rem",zIndex:10}} onClick={e=>e.stopPropagation()}>
              <div style={{background:"rgba(0,0,0,0.6)",borderRadius:"12px",padding:"0.5rem 0.75rem",display:"flex",alignItems:"center",gap:"0.5rem",overflowX:"auto",scrollbarWidth:"none"}}>
                <span style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.7)",flexShrink:0}}>👁 Seen by:</span>
                {storyViews[currentStoryItem.id].viewers.slice(0,5).map((v,i) => (
                  <span key={i} style={{fontSize:"0.75rem",color:"white",background:"rgba(124,58,237,0.4)",borderRadius:"20px",padding:"0.15rem 0.5rem",flexShrink:0}}>@{v.username}</span>
                ))}
                {storyViews[currentStoryItem.id].count > 5 && (
                  <span style={{fontSize:"0.75rem",color:"#a78bfa",flexShrink:0}}>+{storyViews[currentStoryItem.id].count - 5} more</span>
                )}
              </div>
            </div>
          )}

          {/* Story Reply — sends real DM */}
          <div style={{padding:"1rem",display:"flex",alignItems:"center",gap:"0.75rem",zIndex:10}} onClick={e=>e.stopPropagation()}>
            {storySent ? (
              <div style={{flex:1,textAlign:"center",color:"#a78bfa",fontWeight:"bold",animation:"fadeIn 0.3s ease"}}>✅ Reply sent!</div>
            ) : (
              <>
                <input
                  value={storyReplyText}
                  onChange={e=>setStoryReplyText(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&sendStoryReply()}
                  placeholder={"Reply to @"+activeStory.username+"..."}
                  style={{flex:1,background:"transparent",border:"1px solid rgba(255,255,255,0.4)",borderRadius:"20px",padding:"0.6rem 1rem",color:"white",fontSize:"0.9rem",outline:"none"}}
                />
                {storyReplyText.trim() ? (
                  <button onClick={sendStoryReply} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"50%",width:"36px",height:"36px",color:"white",cursor:"pointer",fontSize:"1rem",flexShrink:0}}>➤</button>
                ) : (
                  <span style={{fontSize:"1.3rem",cursor:"pointer"}}>❤️</span>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
