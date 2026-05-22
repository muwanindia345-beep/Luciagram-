import React, { useState } from "react";
import API from "../api";
import { useNavigate } from "react-router-dom";

export default function Upload() {
  const [media, setMedia] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mediaType, setMediaType] = useState("image");
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [type, setType] = useState("post");
  const navigate = useNavigate();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    setMediaType(isVideo ? "video" : "image");
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded/e.total)*100));
    };
    reader.onloadend = () => { setPreview(reader.result); setMedia(reader.result); setProgress(0); };
    reader.readAsDataURL(file);
  };

  const handlePost = async () => {
    if (!media) return alert("Please select a photo or video first!");
    setLoading(true);
    try {
      if (type === "post") {
        await API.post("/posts", { mediaBase64: media, mediaType, caption, location });
      } else {
        await API.post("/stories", { mediaBase64: media, mediaType });
      }
      navigate("/");
    } catch(err) {
      alert(err.response?.data?.message || "Upload failed");
    } finally { setLoading(false); }
  };

  return (
    <div style={{background:"#0a0a0f",minHeight:"100vh",color:"white"}}>
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100}}>
        <span onClick={()=>navigate("/")} style={{color:"#c084fc",cursor:"pointer",fontSize:"1.5rem"}}>✕</span>
        <span style={{fontWeight:"bold",fontSize:"1.1rem"}}>{type==="post"?"New Post":"New Story"}</span>
        <span onClick={handlePost} style={{color:"#c084fc",fontWeight:"bold",cursor:"pointer",opacity:loading?0.5:1}}>{loading?"Posting...":"Share"}</span>
      </div>

      {/* Type Selector */}
      <div style={{display:"flex",margin:"1rem",background:"#1e1e2e",borderRadius:"12px",padding:"4px"}}>
        <button onClick={()=>setType("post")} style={{flex:1,padding:"0.6rem",border:"none",borderRadius:"10px",background:type==="post"?"linear-gradient(135deg,#7c3aed,#db2777)":"transparent",color:"white",cursor:"pointer",fontWeight:"bold"}}>📸 Post</button>
        <button onClick={()=>setType("story")} style={{flex:1,padding:"0.6rem",border:"none",borderRadius:"10px",background:type==="story"?"linear-gradient(135deg,#7c3aed,#db2777)":"transparent",color:"white",cursor:"pointer",fontWeight:"bold"}}>⏱️ Story 24h</button>
      </div>

      <div style={{maxWidth:"600px",margin:"0 auto",padding:"0 1rem"}}>
        {!preview ? (
          <label style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"300px",border:"2px dashed #2a2a3a",borderRadius:"16px",cursor:"pointer",gap:"1rem"}}>
            <div style={{fontSize:"3rem"}}>📽️</div>
            <p style={{color:"#888",margin:0}}>Tap to select photo or video</p>
            <p style={{color:"#7c3aed",margin:0,fontSize:"0.85rem"}}>Supports JPG, PNG, MP4, MOV</p>
            {progress > 0 && <div style={{width:"80%",background:"#1e1e2e",borderRadius:"4px",height:"6px"}}><div style={{width:progress+"%",background:"linear-gradient(135deg,#7c3aed,#db2777)",height:"100%",borderRadius:"4px",transition:"width 0.3s"}}></div></div>}
            <input type="file" accept="image/*,video/*" onChange={handleFile} style={{display:"none"}} />
          </label>
        ) : (
          <div style={{position:"relative"}}>
            {mediaType === "video" ? (
              <video src={preview} controls style={{width:"100%",borderRadius:"16px",maxHeight:"400px"}} />
            ) : (
              <img src={preview} alt="preview" style={{width:"100%",borderRadius:"16px",maxHeight:"400px",objectFit:"cover"}} />
            )}
            <div style={{position:"absolute",top:"0.5rem",left:"0.5rem",background:"rgba(0,0,0,0.7)",borderRadius:"20px",padding:"0.3rem 0.75rem",fontSize:"0.8rem"}}>
              {mediaType === "video" ? "🎬 Video" : "📸 Photo"}
            </div>
            <button onClick={()=>{setPreview(null);setMedia(null);}} style={{position:"absolute",top:"0.5rem",right:"0.5rem",background:"rgba(0,0,0,0.7)",border:"none",color:"white",borderRadius:"50%",width:"32px",height:"32px",cursor:"pointer"}}>✕</button>
          </div>
        )}

        {type === "post" && (
          <>
            <input placeholder="Write a caption..." value={caption} onChange={e=>setCaption(e.target.value)} style={{width:"100%",background:"#13131a",border:"1px solid #2a2a3a",borderRadius:"12px",padding:"0.75rem 1rem",color:"white",fontSize:"0.95rem",marginTop:"1rem",boxSizing:"border-box"}} />
            <input placeholder="Add location..." value={location} onChange={e=>setLocation(e.target.value)} style={{width:"100%",background:"#13131a",border:"1px solid #2a2a3a",borderRadius:"12px",padding:"0.75rem 1rem",color:"white",fontSize:"0.95rem",marginTop:"0.75rem",boxSizing:"border-box"}} />
          </>
        )}

        {type === "story" && preview && (
          <div style={{background:"#13131a",borderRadius:"12px",padding:"1rem",marginTop:"1rem",display:"flex",alignItems:"center",gap:"0.75rem"}}>
            <span style={{fontSize:"1.5rem"}}>⏰</span>
            <div>
              <div style={{fontWeight:"bold",fontSize:"0.9rem"}}>24 Hour Story</div>
              <div style={{color:"#888",fontSize:"0.8rem"}}>Auto-deletes after 24 hours</div>
            </div>
          </div>
        )}

        {loading && (
          <div style={{background:"#13131a",borderRadius:"12px",padding:"1rem",marginTop:"1rem",textAlign:"center"}}>
            <div style={{color:"#c084fc",marginBottom:"0.5rem"}}>⏳ Uploading {mediaType === "video" ? "video" : "photo"}...</div>
            <div style={{background:"#1e1e2e",borderRadius:"4px",height:"6px"}}><div style={{width:"60%",background:"linear-gradient(135deg,#7c3aed,#db2777)",height:"100%",borderRadius:"4px",animation:"pulse 1s infinite"}}></div></div>
            <div style={{color:"#888",fontSize:"0.8rem",marginTop:"0.5rem"}}>Please wait, don't close the app</div>
          </div>
        )}

        {preview && !loading && (
          <button onClick={handlePost} style={{width:"100%",padding:"0.85rem",background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"12px",color:"white",fontSize:"1rem",fontWeight:"bold",cursor:"pointer",marginTop:"1.5rem"}}>
            {type==="story" ? "📖 Share Story" : mediaType==="video" ? "🎬 Share Video" : "🚀 Share Post"}
          </button>
        )}
      </div>
    </div>
  );
}
