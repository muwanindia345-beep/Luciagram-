import React, { useEffect, useState, useRef } from "react";
import API from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import MediaLoader from "../components/MediaLoader";

export default function Reels() {
  const [posts, setPosts] = useState([]);
  const [current, setCurrent] = useState(0);
  const [liked, setLiked] = useState({});
  const [likes, setLikes] = useState({});
  const [muted, setMuted] = useState(false);
  const [showComments, setShowComments] = useState(null);
  const [comments, setComments] = useState({});
  const [commentText, setCommentText] = useState("");
  const [showShareMenu, setShowShareMenu] = useState(null);
  const [showProfileCard, setShowProfileCard] = useState(null);
  const [profileData, setProfileData] = useState({});
  const [profileStats, setProfileStats] = useState({});
  const [followingMap, setFollowingMap] = useState({});
  const [showDMSheet, setShowDMSheet] = useState(null);
  const [dmSearch, setDmSearch] = useState("");
  const [dmUsers, setDmUsers] = useState([]);
  const [sentTo, setSentTo] = useState({});
  const [commentLikes, setCommentLikes] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState({});
  const [progress, setProgress] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const progressRef = useRef(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRefs = useRef({});
  // Cleanup old refs
  React.useEffect(() => { const keys = Object.keys(videoRefs.current); keys.forEach(k => { if(parseInt(k) < current - 5) delete videoRefs.current[k]; }); }, [current]);

  // When muted toggles, apply to current video immediately
  React.useEffect(() => {
    const v = videoRefs.current[current];
    if (v) v.muted = muted;
  }, [muted]);

  useEffect(() => {
    // Pre-populate followingMap
    API.get("/posts/saved").then(r => {
      const map = {};
      (r.data || []).forEach(p => { map[p.id] = true; });
      setSaved(map);
    }).catch(()=>{});
    API.get("/users/my/following-ids").then(r => {
      const map = {};
      (r.data || []).forEach(id => { map[id] = true; });
      setFollowingMap(map);
    }).catch(()=>{});

    API.get("/posts/reels?page=1").then(r => {
      const all = r.data.posts || r.data;
      setLoading(false);
      setPosts(all);
      all.forEach(p => {
        API.get("/posts/" + p.id + "/likes").then(r => {
          setLikes(prev => ({...prev, [p.id]: r.data.count}));
          setLiked(prev => ({...prev, [p.id]: r.data.liked}));
        }).catch(()=>{});
      });
    }).catch(()=>{ setLoading(false); });
    // Load followed users for DM
    API.get("/messages/conversations").then(r => {
      const convs = r.data.conversations || r.data;
      const users = Array.isArray(convs) ? convs.map(c => ({ id: c.userId, username: c.username })) : [];
      setDmUsers(users);
    }).catch(()=>{});
  }, []);

  // Video progress bar
  useEffect(() => {
    const v = videoRefs.current[current];
    if (!v) return;
    const update = () => {
      if (v.duration) setProgress((v.currentTime / v.duration) * 100);
    };
    v.addEventListener("timeupdate", update);
    return () => v.removeEventListener("timeupdate", update);
  }, [current]);

  // Load more reels when near end
  useEffect(() => {
    if (current >= posts.length - 3 && hasMore) {
      const nextPage = page + 1;
      API.get("/posts/reels?page=" + nextPage).then(r => {
        const more = r.data.posts || r.data;
        setPosts(prev => [...prev, ...more]);
        setHasMore(r.data.hasMore !== false);
        setPage(nextPage);
        more.forEach(p => {
          API.get("/posts/" + p.id + "/likes").then(res => {
            setLikes(prev => ({...prev, [p.id]: res.data.count}));
            setLiked(prev => ({...prev, [p.id]: res.data.liked}));
          }).catch(()=>{});
        });
      }).catch(()=>{});
    }
  }, [current, hasMore, page, posts.length]);

  const scrollContainerRef = React.useRef(null);

  const pauseAllExcept = (activeIndex) => {
    Object.entries(videoRefs.current).forEach(([i, v]) => {
      if (!v) return;
      const idx = parseInt(i);
      if (idx === activeIndex) {
        v.muted = muted;
        v.play().catch(()=>{});
      } else {
        v.pause();
        v.currentTime = 0;
        v.muted = true;
      }
    });
  };

  const handleScroll = (e) => {
    const container = e.target;
    const index = Math.round(container.scrollTop / window.innerHeight);
    if (index !== current) {
      setCurrent(index);
      pauseAllExcept(index);
    }
  };

  const handleLike = async (postId) => {
    try {
      const res = await API.post("/posts/" + postId + "/like");
      setLiked(p => ({...p, [postId]: res.data.liked}));
      setLikes(p => ({...p, [postId]: (p[postId]||0) + (res.data.liked ? 1 : -1)}));
    } catch {}
  };

  const openProfileCard = async (username) => {
    if (profileData[username]) { setShowProfileCard(username); return; }
    try {
      const res = await API.get("/users/" + username);
      setProfileData(p => ({...p, [username]: res.data}));
      if (res.data.id) {
        const statsRes = await API.get("/users/" + res.data.id + "/followers");
        setProfileStats(p => ({...p, [username]: statsRes.data}));
        setFollowingMap(p => ({...p, [res.data.id]: statsRes.data.isFollowing}));
      }
      setShowProfileCard(username);
    } catch {}
  };

  const handleFollow = async (profile) => {
    try {
      const res = await API.post("/users/" + profile.id + "/follow-request");
      if (res.data.status === "following") {
        setFollowingMap(p => ({...p, [profile.id]: "following"}));
        setProfileStats(p => ({...p, [profile.username]: {...p[profile.username], followers: (p[profile.username]?.followers||0)+1}}));
      } else if (res.data.status === "unfollowed") {
        setFollowingMap(p => ({...p, [profile.id]: false}));
        setProfileStats(p => ({...p, [profile.username]: {...p[profile.username], followers: (p[profile.username]?.followers||0)-1}}));
      } else if (res.data.status === "requested") {
        setFollowingMap(p => ({...p, [profile.id]: "requested"}));
      } else if (res.data.status === "request_cancelled") {
        setFollowingMap(p => ({...p, [profile.id]: false}));
      }
    } catch {}
  };

  const handleSave = async (postId) => {
    setSaved(p => ({...p, [postId]: !p[postId]}));
    try { await API.post("/posts/" + postId + "/save"); } catch {
      setSaved(p => ({...p, [postId]: !p[postId]}));
    }
  };

  const loadComments = async (postId) => {
    setShowComments(postId);
    try {
      const res = await API.get("/comments/" + postId);
      setComments(p => ({...p, [postId]: res.data}));
      // Load avatars + likes for each comment
      res.data.forEach(c => {
        if (c.username && !profileData[c.username]) {
          API.get("/users/" + c.username).then(r => {
            setProfileData(prev => ({...prev, [c.username]: r.data}));
          }).catch(()=>{});
        }
        API.get("/comments/" + c.id + "/likes").then(r => {
          setCommentLikes(prev => ({...prev, [c.id]: r.data}));
        }).catch(()=>{});
      });
    } catch {}
  };

  const handleCommentLike = async (commentId) => {
    const prev = commentLikes[commentId] || { count: 0, liked: false };
    setCommentLikes(p => ({...p, [commentId]: { count: prev.count + (prev.liked ? -1 : 1), liked: !prev.liked }}));
    try {
      await API.post("/comments/" + commentId + "/like");
    } catch {
      setCommentLikes(p => ({...p, [commentId]: prev}));
    }
  };

  const sendComment = async (postId) => {
    if (!commentText.trim()) return;
    try {
      const fullText = replyTo ? "@" + replyTo + " " + commentText.trim() : commentText.trim();
      const res = await API.post("/comments/" + postId, { text: fullText });
      setComments(p => ({...p, [postId]: [...(p[postId]||[]), res.data]}));
      setCommentText("");
      setReplyTo(null);
    } catch {}
  };

  const openDMSheet = async (post) => {
    setShowDMSheet(post);
    setSentTo({});
    setDmSearch("");
    try {
      const res = await API.get("/messages/conversations");
      const users = res.data.map(c => ({ id: c.userId, username: c.username }));
      setDmUsers(users);
      // Load real avatars for each user
      users.forEach(u => {
        if (u.username && !profileData[u.username]) {
          API.get("/users/" + u.username).then(r => {
            setProfileData(prev => ({...prev, [u.username]: r.data}));
          }).catch(()=>{});
        }
      });
    } catch {}
  };

  const searchDMUsers = async (q) => {
    setDmSearch(q);
    if (q.length < 1) {
      const res = await API.get("/messages/conversations").catch(()=>({data:[]}));
      const users = res.data.map(c => ({ id: c.userId, username: c.username }));
      setDmUsers(users);
      users.forEach(u => {
        if (u.username && !profileData[u.username]) {
          API.get("/users/" + u.username).then(r => {
            setProfileData(prev => ({...prev, [u.username]: r.data}));
          }).catch(()=>{});
        }
      });
      return;
    }
    try {
      const res = await API.get("/users/search?q=" + q);
      const users = res.data.filter(u => u.id !== user?.id);
      setDmUsers(users.map(u => ({ id: u.id, username: u.username, avatar: u.avatar })));
      // Store avatars directly from search results
      users.forEach(u => {
        if (u.avatar) setProfileData(prev => ({...prev, [u.username]: u}));
      });
    } catch {}
  };

  const sendReelViaDM = async (post, toUser) => {
    try {
      await API.post("/messages", {
        receiverId: toUser.id,
        receiverUsername: toUser.username,
        text: (post.caption ? post.caption + "\n" : "") + "🎬 Shared a Reel",
        mediaUrl: post.mediaUrl || "",
      });
      setSentTo(p => ({...p, [toUser.id]: true}));
    } catch {}
  };

  const shareViaOption = async (post, option) => {
    setShowShareMenu(null);
    if (option === "story") {
      try {
        await API.post("/stories/share", { mediaUrl: post.mediaUrl, mediaType: post.mediaType || "video" });
        alert("✅ Reel shared to your story for 24h!");
      } catch { alert("Failed to share to story"); }
    } else if (option === "dm") {
      openDMSheet(post);
    } else if (option === "copy") {
      navigator.clipboard?.writeText(window.location.origin);
      alert("🔗 Link copied!");
    } else if (option === "native") {
      if (navigator.share) {
        try { await navigator.share({ title: "Luciagram Reel", text: post.caption||"", url: window.location.origin }); } catch {}
      }
    }
  };

  const avatar = (name) => (name||"U").slice(0,1).toUpperCase();
  const gradients = ["linear-gradient(135deg,#7c3aed,#db2777)","linear-gradient(135deg,#f59e0b,#ef4444)","linear-gradient(135deg,#10b981,#3b82f6)"];

  return (
    <div style={{background:"#000",height:"100vh",overflow:"hidden",position:"relative"}}>

      {/* Header */}
      <div style={{position:"fixed",top:0,left:0,right:0,zIndex:100,padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{color:"white",fontWeight:"bold",fontSize:"1.1rem"}}>Reels</span>
        <div style={{display:"flex",gap:"1rem"}}>
          <span onClick={()=>setMuted(m=>!m)} style={{color:"white",fontSize:"1.3rem",cursor:"pointer"}}>{muted?"🔇":"🔊"}</span>
          <span style={{color:"white",fontSize:"1.3rem",cursor:"pointer"}}>📷</span>
        </div>
      </div>

      {/* Scrollable Reels */}
      <div ref={scrollContainerRef} onScroll={handleScroll} style={{height:"100vh",overflowY:"scroll",scrollSnapType:"y mandatory",scrollbarWidth:"none",msOverflowStyle:"none"}}>
        {posts.length === 0 ? (
          <div style={{height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"white"}}>
            <div style={{fontSize:"3rem",marginBottom:"1rem"}}>🎬</div>
            <p style={{color:"#888"}}>No reels yet!</p>
            <button onClick={()=>navigate("/upload")} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"8px",color:"white",padding:"0.5rem 1rem",cursor:"pointer",marginTop:"1rem"}}>Upload Video</button>
          </div>
        ) : posts.map((p, i) => (
          <div key={p.id||i} style={{height:"100vh",scrollSnapAlign:"start",scrollSnapStop:"always",position:"relative",background:"#000",overflow:"hidden"}}>

            {/* Media */}
            {p.mediaUrl ? (
              <MediaLoader
                mediaUrl={p.mediaUrl}
                mediaType={p.mediaType}
                style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute"}}
                autoPlay={i===current}
                loop={true}
                muted={muted}
                playsInline={true}
                controls={false}
                onClick={()=>{ const v = videoRefs.current[i]; if(v) v.paused ? v.play() : v.pause(); }}
              />
            ) : (
              <div style={{width:"100%",height:"100%",background:gradients[i%3],position:"absolute",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"4rem"}}>🦋</div>
            )}

            {/* Gradient overlay - stronger at bottom for nav */}
            <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, transparent 25%, transparent 50%, rgba(0,0,0,0.6) 75%, rgba(0,0,0,0.92) 100%)",zIndex:1,pointerEvents:"none"}} />

            {/* Right Actions */}
            <div style={{position:"absolute",right:"1rem",bottom:"5.5rem",display:"flex",flexDirection:"column",alignItems:"center",gap:"1.5rem",zIndex:10}}>
              {/* Like */}
              <div onClick={()=>handleLike(p.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.3rem",cursor:"pointer"}}>
                <span style={{fontSize:"1.8rem",filter:liked[p.id]?"drop-shadow(0 0 6px red)":"none"}}>{liked[p.id]?"❤️":"🤍"}</span>
                <span style={{color:"white",fontSize:"0.75rem",fontWeight:"bold"}}>{likes[p.id]||0}</span>
              </div>
              {/* Comment */}
              <div onClick={()=>loadComments(p.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.3rem",cursor:"pointer"}}>
                <span style={{fontSize:"1.8rem"}}>💬</span>
                <span style={{color:"white",fontSize:"0.75rem",fontWeight:"bold"}}>{(comments[p.id]||[]).length}</span>
              </div>
              {/* Share */}
              <div onClick={()=>setShowShareMenu(p)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.3rem",cursor:"pointer"}}>
                <span style={{fontSize:"1.8rem"}}>📤</span>
                <span style={{color:"white",fontSize:"0.75rem"}}>Share</span>
              </div>
              {/* Mute */}
              <div onClick={()=>setMuted(m=>!m)} style={{cursor:"pointer"}}>
                <span style={{fontSize:"1.8rem"}}>{muted?"🔇":"🔊"}</span>
              </div>
            </div>

            {/* Bottom Info */}
            <div style={{position:"absolute",bottom:"4rem",left:"1rem",right:"5rem",zIndex:10}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.5rem"}}>
                {/* Tappable Avatar */}
                <div onClick={()=>openProfileCard(p.username)} style={{cursor:"pointer",flexShrink:0}}>
                  {user?.avatar && p.username===user?.username ? (
                    <img src={user.avatar} alt="a" style={{width:"38px",height:"38px",borderRadius:"50%",objectFit:"cover",border:"2px solid white"}} />
                  ) : profileData[p.username]?.avatar ? (
                    <img src={profileData[p.username].avatar} alt="a" style={{width:"38px",height:"38px",borderRadius:"50%",objectFit:"cover",border:"2px solid white"}} />
                  ) : (
                    <div style={{width:"38px",height:"38px",borderRadius:"50%",background:gradients[i%3],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",border:"2px solid white"}}>{avatar(p.username)}</div>
                  )}
                </div>
                {/* Tappable Username */}
                <span onClick={()=>openProfileCard(p.username)} style={{color:"white",fontWeight:"bold",fontSize:"0.95rem",cursor:"pointer"}}>@{p.username||"user"}</span>
                {p.username !== user?.username && (
                  <button
                    onClick={()=>{ if(profileData[p.username]) handleFollow(profileData[p.username]); else openProfileCard(p.username); }}
                    style={{background:"transparent",border:"1px solid white",color:"white",borderRadius:"6px",padding:"0.2rem 0.6rem",fontSize:"0.8rem",cursor:"pointer",marginLeft:"0.3rem"}}
                  >
                    {followingMap[profileData[p.username]?.id] ? "Following ✓" : "Follow"}
                  </button>
                )}
              </div>
              {p.caption && <p style={{color:"white",fontSize:"0.9rem",margin:"0 0 0.3rem",lineHeight:1.4}}>{p.caption}</p>}
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                <span style={{fontSize:"0.9rem"}}>🎵</span>
                <span style={{color:"white",fontSize:"0.8rem",opacity:0.8}}>Original Audio · @{p.username}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Profile Card Bottom Sheet */}
      {showProfileCard && profileData[showProfileCard] && (
        <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowProfileCard(null)} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
          <div style={{background:"#1a1a2e",borderRadius:"20px 20px 0 0",padding:"1.5rem 1rem"}}>
            {/* Drag handle */}
            <div style={{width:"40px",height:"4px",borderRadius:"2px",background:"#444",margin:"0 auto 1.2rem"}} />
            <div style={{display:"flex",alignItems:"center",gap:"1rem",marginBottom:"1.2rem"}}>
              {/* Profile Pic */}
              {profileData[showProfileCard].avatar ? (
                <img src={profileData[showProfileCard].avatar} alt="p" style={{width:"72px",height:"72px",borderRadius:"50%",objectFit:"cover",border:"3px solid #7c3aed"}} />
              ) : (
                <div style={{width:"72px",height:"72px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.8rem",fontWeight:"bold"}}>{avatar(showProfileCard)}</div>
              )}
              <div style={{flex:1}}>
                <div style={{fontWeight:"bold",fontSize:"1rem",color:"white"}}>@{profileData[showProfileCard].username}{profileData[showProfileCard].isVerified && <span style={{color:"#7c3aed",marginLeft:"4px"}}>✓</span>}</div>
                {profileData[showProfileCard].fullName && <div style={{color:"#ccc",fontSize:"0.85rem"}}>{profileData[showProfileCard].fullName}</div>}
                {profileData[showProfileCard].bio && <div style={{color:"#888",fontSize:"0.8rem",marginTop:"0.2rem"}}>{profileData[showProfileCard].bio}</div>}
              </div>
            </div>
            {/* Stats */}
            <div style={{display:"flex",justifyContent:"space-around",marginBottom:"1.2rem",padding:"0.75rem",background:"#13131a",borderRadius:"12px"}}>
              <div style={{textAlign:"center"}}>
                <div style={{fontWeight:"bold",color:"white",fontSize:"1.1rem"}}>{profileStats[showProfileCard]?.followers||0}</div>
                <div style={{color:"#888",fontSize:"0.75rem"}}>Followers</div>
              </div>
              <div style={{textAlign:"center"}}>
                <div style={{fontWeight:"bold",color:"white",fontSize:"1.1rem"}}>{profileStats[showProfileCard]?.following||0}</div>
                <div style={{color:"#888",fontSize:"0.75rem"}}>Following</div>
              </div>
            </div>
            {/* Action Buttons */}
            <div style={{display:"flex",gap:"0.75rem",marginBottom:"0.75rem"}}>
              <button
                onClick={()=>handleFollow(profileData[showProfileCard])}
                style={{flex:1,padding:"0.6rem",background:followingMap[profileData[showProfileCard].id]?"transparent":"linear-gradient(135deg,#7c3aed,#db2777)",border:followingMap[profileData[showProfileCard].id]?"1px solid #444":"none",borderRadius:"10px",color:"white",fontWeight:"bold",cursor:"pointer",fontSize:"0.95rem"}}
              >
                {followingMap[profileData[showProfileCard].id] ? "Following ✓" : "Follow"}
              </button>
              <button
                onClick={()=>{ setShowProfileCard(null); navigate("/chat/"+profileData[showProfileCard].id+"?username="+profileData[showProfileCard].username); }}
                style={{flex:1,padding:"0.6rem",background:"#1e1e2e",border:"1px solid #2a2a3a",borderRadius:"10px",color:"white",fontWeight:"bold",cursor:"pointer",fontSize:"0.95rem"}}
              >
                💬 Message
              </button>
              <button
                onClick={()=>{ setShowProfileCard(null); navigate("/user/"+showProfileCard); }}
                style={{padding:"0.6rem 0.9rem",background:"#1e1e2e",border:"1px solid #2a2a3a",borderRadius:"10px",color:"white",cursor:"pointer",fontSize:"0.95rem"}}
              >
                👤
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Menu */}
      {showShareMenu && (
        <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowShareMenu(null)} style={{flex:1,background:"rgba(0,0,0,0.5)"}} />
          <div style={{background:"#1a1a2e",borderRadius:"20px 20px 0 0",padding:"1rem"}}>
            <div style={{textAlign:"center",color:"#888",fontSize:"0.85rem",marginBottom:"1rem"}}>Share Reel</div>
            {[
              {icon:"📖",label:"Share to Story",action:"story"},
              {icon:"💬",label:"Send via DM",action:"dm"},
              {icon:"🔗",label:"Copy Link",action:"copy"},
              {icon:"📤",label:"Share",action:"native"},
            ].map(opt => (
              <div key={opt.action} onClick={()=>shareViaOption(showShareMenu,opt.action)} style={{display:"flex",alignItems:"center",gap:"1rem",padding:"0.85rem 1rem",borderRadius:"12px",cursor:"pointer",marginBottom:"0.5rem",background:"#13131a"}}>
                <span style={{fontSize:"1.5rem"}}>{opt.icon}</span>
                <span style={{color:"white",fontSize:"1rem"}}>{opt.label}</span>
              </div>
            ))}
            <div onClick={()=>setShowShareMenu(null)} style={{textAlign:"center",padding:"0.75rem",color:"#888",cursor:"pointer",marginTop:"0.5rem"}}>Cancel</div>
          </div>
        </div>
      )}

      {/* DM Sheet */}
      {showDMSheet && (
        <div style={{position:"fixed",inset:0,zIndex:450,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowDMSheet(null)} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
          <div style={{background:"#1a1a2e",borderRadius:"20px 20px 0 0",maxHeight:"75vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"1rem",borderBottom:"1px solid #2a2a3a"}}>
              <div style={{width:"40px",height:"4px",borderRadius:"2px",background:"#444",margin:"0 auto 1rem"}} />
              <div style={{fontWeight:"bold",color:"white",fontSize:"1rem",marginBottom:"0.75rem",textAlign:"center"}}>Send to...</div>
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
              {dmUsers.map((u,i) => {
                const uProfile = profileData[u.username];
                const uAvatar = u.avatar || uProfile?.avatar;
                return (
                <div key={u.id||i} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.75rem 0",borderBottom:"1px solid #1e1e2e"}}>
                  {uAvatar ? (
                    <img src={uAvatar} alt={u.username} style={{width:"44px",height:"44px",borderRadius:"50%",objectFit:"cover",flexShrink:0}} />
                  ) : (
                    <div style={{width:"44px",height:"44px",borderRadius:"50%",background:gradients[i%3],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",flexShrink:0}}>{avatar(u.username)}</div>
                  )}
                  <div style={{flex:1}}>
                    <div style={{fontWeight:"bold",color:"white",fontSize:"0.95rem"}}>@{u.username}</div>
                  </div>
                  <button
                    onClick={()=>sendReelViaDM(showDMSheet,u)}
                    disabled={sentTo[u.id]}
                    style={{padding:"0.4rem 1rem",background:sentTo[u.id]?"#2a2a3a":"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"20px",color:"white",cursor:sentTo[u.id]?"default":"pointer",fontSize:"0.85rem",fontWeight:"bold",flexShrink:0}}
                  >
                    {sentTo[u.id] ? "✓ Sent" : "Send"}
                  </button>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Comments Sheet */}
      {showComments && (
        <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowComments(null)} style={{flex:1,background:"rgba(0,0,0,0.5)"}} />
          <div style={{background:"#1a1a2e",borderRadius:"20px 20px 0 0",maxHeight:"70vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"1rem",borderBottom:"1px solid #2a2a3a",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontWeight:"bold",color:"white",fontSize:"1rem"}}>Comments</span>
              <span onClick={()=>setShowComments(null)} style={{color:"#888",cursor:"pointer",fontSize:"1.2rem"}}>✕</span>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"0.75rem 1rem"}}>
              {(comments[showComments]||[]).length === 0 ? (
                <div style={{textAlign:"center",color:"#888",padding:"2rem"}}>
                  <div style={{fontSize:"2rem"}}>💬</div>
                  <p>No comments yet. Be first!</p>
                </div>
              ) : (comments[showComments]||[]).map((c,i) => (
                <div key={c.id||i} style={{display:"flex",gap:"0.75rem",marginBottom:"1rem",alignItems:"flex-start"}}>
                  {/* Avatar */}
                  {profileData[c.username]?.avatar ? (
                    <img src={profileData[c.username].avatar} alt={c.username} onClick={()=>navigate("/user/"+c.username)} style={{width:"36px",height:"36px",borderRadius:"50%",objectFit:"cover",flexShrink:0,cursor:"pointer",border:"2px solid #2a2a3a"}} />
                  ) : (
                    <div onClick={()=>navigate("/user/"+c.username)} style={{width:"36px",height:"36px",borderRadius:"50%",background:gradients[i%3],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:"0.85rem",flexShrink:0,cursor:"pointer"}}>{avatar(c.username)}</div>
                  )}
                  <div style={{flex:1}}>
                    <div style={{background:"#1e1e2e",borderRadius:"14px",padding:"0.55rem 0.85rem"}}>
                      <span onClick={()=>navigate("/user/"+c.username)} style={{fontWeight:"bold",color:"#c084fc",fontSize:"0.83rem",cursor:"pointer"}}>@{c.username} </span>
                      <span style={{color:"white",fontSize:"0.9rem",lineHeight:1.4}}>{c.text}</span>
                    </div>
                    <div style={{display:"flex",gap:"1rem",marginTop:"0.3rem",paddingLeft:"0.5rem",alignItems:"center"}}>
                      <span style={{fontSize:"0.72rem",color:"#555"}}>{new Date(c.createdAt).toLocaleDateString()}</span>
                      <span onClick={()=>setReplyTo(c.username)} style={{fontSize:"0.75rem",color:"#888",cursor:"pointer",fontWeight:"bold"}}>Reply</span>
                      <span onClick={()=>handleCommentLike(c.id)} style={{fontSize:"0.75rem",color:commentLikes[c.id]?.liked?"#f87171":"#888",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.2rem"}}>
                        {commentLikes[c.id]?.liked ? "❤️" : "🤍"} {commentLikes[c.id]?.count > 0 ? commentLikes[c.id].count : ""}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {replyTo && (
              <div style={{padding:"0.4rem 1rem",background:"#13131a",borderTop:"1px solid #2a2a3a",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:"0.8rem",color:"#a78bfa"}}>↩ Replying to <strong>@{replyTo}</strong></span>
                <span onClick={()=>setReplyTo(null)} style={{color:"#888",cursor:"pointer"}}>✕</span>
              </div>
            )}
            <div style={{padding:"0.75rem 1rem",borderTop:"1px solid #2a2a3a",display:"flex",gap:"0.75rem",alignItems:"center"}}>
              <input
                value={commentText}
                onChange={e=>setCommentText(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&sendComment(showComments)}
                placeholder={replyTo ? "Reply to @"+replyTo+"..." : "Add a comment..."}
                style={{flex:1,background:"#2a2a3a",border:"none",borderRadius:"20px",padding:"0.6rem 1rem",color:"white",fontSize:"0.9rem",outline:"none"}}
              />
              <button onClick={()=>sendComment(showComments)} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"50%",width:"36px",height:"36px",color:"white",cursor:"pointer",fontSize:"1rem"}}>➤</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(0,0,0,0.8)",borderTop:"1px solid #1e1e2e",display:"flex",justifyContent:"space-around",padding:"0.75rem 0",zIndex:100}}>
        <span onClick={()=>navigate("/")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🏠</span>
        <span onClick={()=>navigate("/search")} style={{fontSize:"1.5rem",cursor:"pointer"}}>🔍</span>
        <div onClick={()=>navigate("/upload")} style={{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1.2rem"}}>+</div>
        <span style={{fontSize:"1.5rem",cursor:"pointer",borderBottom:"2px solid white",paddingBottom:"2px"}}>🎬</span>
        <div onClick={()=>navigate("/profile")} style={{width:"28px",height:"28px",borderRadius:"50%",overflow:"hidden",cursor:"pointer",border:"2px solid #7c3aed"}}>
          {user?.avatar?<img src={user.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="p"/>:<div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",fontWeight:"bold"}}>{avatar(user?.username)}</div>}
        </div>
      </div>
    </div>
  );
}
