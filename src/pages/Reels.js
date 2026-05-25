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
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRefs = useRef({});

  useEffect(() => {
    API.get("/posts/feed").then(r => {
      const all = r.data;
      setPosts(all);
      all.forEach(p => {
        API.get("/posts/" + p.id + "/likes").then(r => {
          setLikes(prev => ({...prev, [p.id]: r.data.count}));
          setLiked(prev => ({...prev, [p.id]: r.data.liked}));
        }).catch(()=>{});
      });
    }).catch(()=>{});
  }, []);

  const handleScroll = (e) => {
    const index = Math.round(e.target.scrollTop / window.innerHeight);
    if (index !== current) {
      setCurrent(index);
      Object.entries(videoRefs.current).forEach(([i, v]) => {
        if (v) { if (parseInt(i) === index) { v.play().catch(()=>{}); } else { v.pause(); v.currentTime = 0; } }
      });
    }
  };

  const handleLike = async (postId) => {
    try {
      const res = await API.post("/posts/" + postId + "/like");
      setLiked(p => ({...p, [postId]: res.data.liked}));
      setLikes(p => ({...p, [postId]: (p[postId]||0) + (res.data.liked ? 1 : -1)}));
    } catch {}
  };

  const shareToStory = async (post) => {
    try {
      await API.post("/stories", {
        mediaBase64: post.mediaUrl,
        mediaType: post.mediaType || "video",
      });
      alert("✅ Reel shared to your story for 24h!");
    } catch { alert("Failed to share to story"); }
  };

  const handleShare = async (post) => {
    const choice = window.confirm(
      "Share options:\n\nOK = Share to Story (24h)\nCancel = Copy Link"
    );
    if (choice) {
      await shareToStory(post);
    } else {
      if (navigator.share) {
        try {
          await navigator.share({
            title: "Luciagram Reel by @" + post.username,
            text: post.caption || "Check this reel!",
            url: window.location.origin,
          });
        } catch {}
      } else {
        navigator.clipboard?.writeText(window.location.origin);
        alert("🔗 Link copied!");
      }
    }
  };

  const loadComments = async (postId) => {
    setShowComments(postId);
    try {
      const res = await API.get("/comments/" + postId);
      setComments(p => ({...p, [postId]: res.data}));
    } catch {}
  };

  const sendComment = async (postId) => {
    if (!commentText.trim()) return;
    try {
      const res = await API.post("/comments/" + postId, { text: commentText });
      setComments(p => ({...p, [postId]: [...(p[postId]||[]), res.data]}));
      setCommentText("");
    } catch {}
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
      <div onScroll={handleScroll} style={{height:"100vh",overflowY:"scroll",scrollSnapType:"y mandatory",scrollbarWidth:"none"}}>
        {posts.length === 0 ? (
          <div style={{height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"white"}}>
            <div style={{fontSize:"3rem",marginBottom:"1rem"}}>🎬</div>
            <p style={{color:"#888"}}>No reels yet!</p>
            <button onClick={()=>navigate("/upload")} style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"8px",color:"white",padding:"0.5rem 1rem",cursor:"pointer",marginTop:"1rem"}}>Upload Video</button>
          </div>
        ) : posts.map((p, i) => (
          <div key={p.id||i} style={{height:"100vh",scrollSnapAlign:"start",position:"relative",background:"#000",display:"flex",alignItems:"center",justifyContent:"center"}}>

            {/* Media */}
            {(p.mediaId || p.mediaUrl) ? (
              <MediaLoader
                mediaId={p.mediaId}
                mediaUrl={p.mediaUrl}
                mediaType={p.mediaType}
                style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute"}}
                autoPlay={i===current}
                loop={true}
                muted={muted}
                playsInline={true}
                controls={false}
                onClick={()=>{
                  const v = videoRefs.current[i];
                  if(v) v.paused ? v.play() : v.pause();
                }}
              />
            ) : (
              <div style={{width:"100%",height:"100%",background:gradients[i%3],position:"absolute",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"4rem"}}>🦋</div>
            )}

            {/* Gradient overlay */}
            <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 30%, rgba(0,0,0,0.85))"}} />

            {/* Right Actions */}
            <div style={{position:"absolute",right:"1rem",bottom:"7rem",display:"flex",flexDirection:"column",alignItems:"center",gap:"1.5rem",zIndex:10}}>
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
              <div onClick={()=>handleShare(p)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.3rem",cursor:"pointer"}}>
                <span style={{fontSize:"1.8rem"}}>📤</span>
                <span style={{color:"white",fontSize:"0.75rem"}}>Share</span>
              </div>

              {/* Mute toggle */}
              <div onClick={()=>setMuted(m=>!m)} style={{cursor:"pointer"}}>
                <span style={{fontSize:"1.8rem"}}>{muted?"🔇":"🔊"}</span>
              </div>
            </div>

            {/* Bottom Info */}
            <div style={{position:"absolute",bottom:"4.5rem",left:"1rem",right:"5rem",zIndex:10}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.5rem"}}>
                {user?.avatar && p.username===user?.username ? (
                  <img src={user.avatar} alt="a" style={{width:"36px",height:"36px",borderRadius:"50%",objectFit:"cover",border:"2px solid white"}} />
                ) : (
                  <div style={{width:"36px",height:"36px",borderRadius:"50%",background:gradients[i%3],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",border:"2px solid white"}}>{avatar(p.username)}</div>
                )}
                <span style={{color:"white",fontWeight:"bold",fontSize:"0.95rem"}}>@{p.username||"user"}</span>
                {p.username !== user?.username && (
                  <button style={{background:"transparent",border:"1px solid white",color:"white",borderRadius:"6px",padding:"0.2rem 0.6rem",fontSize:"0.8rem",cursor:"pointer",marginLeft:"0.3rem"}}>Follow</button>
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

      {/* Comments Sheet */}
      {showComments && (
        <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowComments(null)} style={{flex:1,background:"rgba(0,0,0,0.5)"}} />
          <div style={{background:"#1a1a2e",borderRadius:"20px 20px 0 0",maxHeight:"70vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"1rem",borderBottom:"1px solid #2a2a3a",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontWeight:"bold",color:"white",fontSize:"1rem"}}>Comments</span>
              <span onClick={()=>setShowComments(null)} style={{color:"#888",cursor:"pointer",fontSize:"1.2rem"}}>✕</span>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"1rem",display:"flex",flexDirection:"column",gap:"1rem"}}>
              {(comments[showComments]||[]).length === 0 ? (
                <div style={{textAlign:"center",color:"#888",padding:"2rem"}}>
                  <div style={{fontSize:"2rem"}}>💬</div>
                  <p>No comments yet. Be first!</p>
                </div>
              ) : (comments[showComments]||[]).map((c,i) => (
                <div key={c.id||i} style={{display:"flex",gap:"0.75rem",alignItems:"flex-start"}}>
                  <div style={{width:"32px",height:"32px",borderRadius:"50%",background:gradients[i%3],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:"0.8rem",flexShrink:0}}>{avatar(c.username)}</div>
                  <div>
                    <span style={{fontWeight:"bold",color:"#c084fc",fontSize:"0.85rem"}}>@{c.username} </span>
                    <span style={{color:"white",fontSize:"0.9rem"}}>{c.text}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{padding:"0.75rem 1rem",borderTop:"1px solid #2a2a3a",display:"flex",gap:"0.75rem",alignItems:"center"}}>
              <input
                value={commentText}
                onChange={e=>setCommentText(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&sendComment(showComments)}
                placeholder="Add a comment..."
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
        <span style={{fontSize:"1.5rem",cursor:"pointer"}}>🔍</span>
        <div onClick={()=>navigate("/upload")} style={{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1.2rem"}}>+</div>
        <span style={{fontSize:"1.5rem",cursor:"pointer",borderBottom:"2px solid white",paddingBottom:"2px"}}>🎬</span>
        <div onClick={()=>navigate("/profile")} style={{width:"28px",height:"28px",borderRadius:"50%",overflow:"hidden",cursor:"pointer",border:"2px solid #7c3aed"}}>
          {user?.avatar?<img src={user.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="p"/>:<div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",fontWeight:"bold"}}>{avatar(user?.username)}</div>}
        </div>
      </div>
    </div>
  );
}
