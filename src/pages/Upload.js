import React, { useState, useRef, useCallback } from "react";
import MusicPicker from "../components/MusicPicker";
import API from "../api";
import { useNavigate } from "react-router-dom";

export default function Upload() {
  const [media, setMedia] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mediaType, setMediaType] = useState("image");
  const [showCrop, setShowCrop] = useState(false);
  const [cropMode, setCropMode] = useState("square"); // square | original | portrait | landscape
  const [rawPreview, setRawPreview] = useState(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [showFilters, setShowFilters] = useState(false);
  const canvasRef = useRef(null);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [music, setMusic] = useState(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    setMediaType(isVideo ? "video" : "image");
    const reader = new FileReader();
    reader.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded/ev.total)*100));
    };
    reader.onloadend = () => {
      setRawPreview(reader.result);
      setProgress(0);
      if (!isVideo) {
        setShowCrop(true); // show adjust screen for images
      } else {
        setPreview(reader.result);
        setMedia(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const applyCrop = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      let sx = 0, sy = 0, sw = w, sh = h;
      if (cropMode === "square") {
        const size = Math.min(w, h);
        sx = (w - size) / 2; sy = (h - size) / 2;
        sw = size; sh = size;
        canvas.width = 1080; canvas.height = 1080;
      } else if (cropMode === "portrait") {
        sh = Math.min(h, w * 1.25);
        sy = (h - sh) / 2;
        canvas.width = 1080; canvas.height = 1350;
      } else if (cropMode === "landscape") {
        sw = Math.min(w, h * 1.91);
        sx = (w - sw) / 2;
        canvas.width = 1080; canvas.height = 566;
      } else {
        canvas.width = w; canvas.height = h;
      }
      const ctx = canvas.getContext("2d");
      ctx.filter = "brightness(" + brightness + "%) contrast(" + contrast + "%) saturate(" + saturation + "%)";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL("image/jpeg", 0.92);
      setPreview(result);
      setMedia(result);
      setShowCrop(false);
    };
    img.src = rawPreview;
  };

  const handlePost = async () => {
    if (!media) return alert("Please select a photo or video first!");
    setLoading(true);
    try {
      await API.post("/posts", { mediaBase64: media, mediaType, caption, location, music: music || null });
      navigate("/");
    } catch(err) {
      alert(err.response?.data?.message || "Upload failed");
    } finally { setLoading(false); }
  };

  const filterStyle = "brightness(" + brightness + "%) contrast(" + contrast + "%) saturate(" + saturation + "%)";

  if (showCrop) return (
    <div style={{background:"#0a0a0f",minHeight:"100vh",color:"white",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #1e1e2e",position:"sticky",top:0,background:"#0a0a0f",zIndex:10}}>
        <span onClick={()=>{setShowCrop(false);setRawPreview(null);}} style={{color:"#c084fc",cursor:"pointer",fontSize:"1.5rem"}}>✕</span>
        <span style={{fontWeight:"bold",fontSize:"1.1rem"}}>Adjust</span>
        <span onClick={applyCrop} style={{color:"#c084fc",fontWeight:"bold",cursor:"pointer"}}>Next →</span>
      </div>
      {/* Image preview with filters */}
      <div style={{width:"100%",aspectRatio: cropMode==="square"?"1/1":cropMode==="portrait"?"4/5":cropMode==="landscape"?"1.91/1":"auto",overflow:"hidden",background:"#000",display:"flex",alignItems:"center",justifyContent:"center",maxHeight:"60vw"}}>
        <img src={rawPreview} alt="adjust" style={{width:"100%",height:"100%",objectFit:"cover",filter:filterStyle,transition:"filter 0.2s"}} />
      </div>
      {/* Crop ratio buttons */}
      <div style={{display:"flex",gap:"0.5rem",padding:"0.75rem 1rem",overflowX:"auto",borderBottom:"1px solid #1e1e2e"}}>
        {[["square","⬛ 1:1"],["original","📐 Original"],["portrait","📱 4:5"],["landscape","🖼️ 1.91:1"]].map(([mode,label])=>(
          <button key={mode} onClick={()=>setCropMode(mode)}
            style={{padding:"0.4rem 0.85rem",borderRadius:"20px",border:"none",background:cropMode===mode?"linear-gradient(135deg,#7c3aed,#db2777)":"#1e1e2e",color:"white",cursor:"pointer",fontSize:"0.8rem",whiteSpace:"nowrap",fontWeight:cropMode===mode?"bold":"normal"}}>
            {label}
          </button>
        ))}
      </div>
      {/* Filter/Adjust toggles */}
      <div style={{display:"flex",gap:"0.5rem",padding:"0.5rem 1rem"}}>
        <button onClick={()=>setShowFilters(false)} style={{flex:1,padding:"0.4rem",borderRadius:"8px",border:"none",background:!showFilters?"#2a2a3a":"transparent",color:"white",cursor:"pointer",fontSize:"0.85rem"}}>✂️ Crop</button>
        <button onClick={()=>setShowFilters(true)} style={{flex:1,padding:"0.4rem",borderRadius:"8px",border:"none",background:showFilters?"#2a2a3a":"transparent",color:"white",cursor:"pointer",fontSize:"0.85rem"}}>🎨 Adjust</button>
      </div>
      {showFilters && (
        <div style={{padding:"0.75rem 1rem",display:"flex",flexDirection:"column",gap:"0.75rem"}}>
          {[["☀️ Brightness",brightness,setBrightness,50,150],["🔲 Contrast",contrast,setContrast,50,150],["🎨 Saturation",saturation,setSaturation,0,200]].map(([label,val,set,min,max])=>(
            <div key={label}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.82rem",color:"#aaa",marginBottom:"0.3rem"}}><span>{label}</span><span>{val}%</span></div>
              <input type="range" min={min} max={max} value={val} onChange={e=>set(Number(e.target.value))}
                style={{width:"100%",accentColor:"#7c3aed"}} />
            </div>
          ))}
          <button onClick={()=>{setBrightness(100);setContrast(100);setSaturation(100);}} style={{alignSelf:"center",background:"transparent",border:"1px solid #444",borderRadius:"8px",color:"#888",padding:"0.3rem 1rem",cursor:"pointer",fontSize:"0.8rem"}}>Reset</button>
        </div>
      )}
    </div>
  );

  return (
    <>
    {showMusicPicker && <MusicPicker selectedMusic={music} onSelect={t=>{setMusic(t);setShowMusicPicker(false);}} onClose={()=>setShowMusicPicker(false)} />}
    <div style={{background:"#0a0a0f",minHeight:"100vh",color:"white"}}>
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100}}>
        <span onClick={()=>navigate("/")} style={{color:"#c084fc",cursor:"pointer",fontSize:"1.5rem"}}>✕</span>
        <span style={{fontWeight:"bold",fontSize:"1.1rem"}}>New Post</span>
        <span onClick={handlePost} style={{color:"#c084fc",fontWeight:"bold",cursor:"pointer",opacity:loading?0.5:1}}>{loading?"Posting...":"Share"}</span>
      </div>

      <div style={{maxWidth:"600px",margin:"0 auto",padding:"0 1rem",paddingTop:"1rem"}}>
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
            <button onClick={()=>{setPreview(null);setMedia(null);}} style={{position:"absolute",top:"0.5rem",right:"0.5rem",background:"rgba(0,0,0,0.7)",border:"none",color:"white",borderRadius:"50%",width:"32px",height:"32px",cursor:"pointer"}}>✕</button>
          </div>
        )}

        <input placeholder="Write a caption..." value={caption} onChange={e=>setCaption(e.target.value)} style={{width:"100%",background:"#13131a",border:"1px solid #2a2a3a",borderRadius:"12px",padding:"0.75rem 1rem",color:"white",fontSize:"0.95rem",marginTop:"1rem",boxSizing:"border-box"}} />
        <input placeholder="Add location..." value={location} onChange={e=>setLocation(e.target.value)} style={{width:"100%",background:"#13131a",border:"1px solid #2a2a3a",borderRadius:"12px",padding:"0.75rem 1rem",color:"white",fontSize:"0.95rem",marginTop:"0.75rem",boxSizing:"border-box"}} />

        <div onClick={()=>setShowMusicPicker(true)}
          style={{background:"#13131a",border:"1px solid #2a2a3a",borderRadius:"12px",padding:"0.75rem 1rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.75rem",marginTop:"0.75rem"}}>
          {music ? (
            <>
              {music.albumArt && <img src={music.albumArt} alt={music.title} style={{width:"40px",height:"40px",borderRadius:"8px",objectFit:"cover",flexShrink:0}} />}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:"0.88rem",fontWeight:"bold",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🎵 {music.title}</div>
                <div style={{fontSize:"0.75rem",color:"#888"}}>{music.artist}</div>
              </div>
              <span onClick={e=>{e.stopPropagation();setMusic(null);}} style={{color:"#f87171",cursor:"pointer",fontSize:"1.1rem"}}>✕</span>
            </>
          ) : (
            <><span style={{fontSize:"1.3rem"}}>🎵</span><span style={{color:"#555",fontSize:"0.9rem"}}>Add music to your post</span></>
          )}
        </div>

        {loading && (
          <div style={{background:"#13131a",borderRadius:"12px",padding:"1rem",marginTop:"1rem",textAlign:"center"}}>
            <div style={{color:"#c084fc",marginBottom:"0.5rem",fontSize:"1rem"}}>⏳ Uploading {mediaType === "video" ? "video" : "photo"}...</div>
            <div style={{background:"#1e1e2e",borderRadius:"4px",height:"8px",overflow:"hidden"}}>
              <div style={{height:"100%",background:"linear-gradient(135deg,#7c3aed,#db2777)",borderRadius:"4px",animation:"uploadProgress 2s ease-in-out infinite alternate",width:"100%"}}></div>
            </div>
            <style>{"@keyframes uploadProgress { from { transform: translateX(-100%) } to { transform: translateX(100%) } }"}</style>
          </div>
        )}

        {preview && !loading && (
          <button onClick={handlePost} style={{width:"100%",padding:"0.85rem",background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"12px",color:"white",fontSize:"1rem",fontWeight:"bold",cursor:"pointer",marginTop:"1.5rem"}}>
            {mediaType === "video" ? "🎬 Share Video" : "🚀 Share Post"}
          </button>
        )}
      </div>
    </div>
    </>
  );
}
