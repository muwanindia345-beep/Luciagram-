import React, { useState } from "react";
import API from "../api";
import { useNavigate } from "react-router-dom";

export default function Upload() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
      setImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handlePost = async () => {
    if (!image) return alert("Please select a photo first!");
    setLoading(true);
    try {
      await API.post("/posts", { mediaBase64: image, mediaType: "image", caption, location });
      navigate("/");
    } catch(err) {
      alert(err.response?.data?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{background:"#0a0a0f",minHeight:"100vh",color:"white"}}>
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100}}>
        <span onClick={()=>navigate("/")} style={{color:"#c084fc",cursor:"pointer",fontSize:"1.5rem"}}>✕</span>
        <span style={{fontWeight:"bold",fontSize:"1.1rem"}}>New Post</span>
        <span onClick={handlePost} style={{color:"#c084fc",fontWeight:"bold",cursor:"pointer",opacity:loading?0.5:1}}>{loading?"Posting...":"Share"}</span>
      </div>

      <div style={{maxWidth:"600px",margin:"0 auto",padding:"1rem"}}>
        {!preview ? (
          <label style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"300px",border:"2px dashed #2a2a3a",borderRadius:"16px",cursor:"pointer",gap:"1rem"}}>
            <div style={{fontSize:"3rem"}}>📸</div>
            <p style={{color:"#888",margin:0}}>Tap to select photo or video</p>
            <input type="file" accept="image/*,video/*" onChange={handleFile} style={{display:"none"}} />
          </label>
        ) : (
          <div style={{position:"relative"}}>
            <img src={preview} alt="preview" style={{width:"100%",borderRadius:"16px",maxHeight:"400px",objectFit:"cover"}} />
            <button onClick={()=>{setPreview(null);setImage(null);}} style={{position:"absolute",top:"0.5rem",right:"0.5rem",background:"rgba(0,0,0,0.7)",border:"none",color:"white",borderRadius:"50%",width:"32px",height:"32px",cursor:"pointer",fontSize:"1rem"}}>✕</button>
          </div>
        )}

        <input
          placeholder="Write a caption..."
          value={caption}
          onChange={e=>setCaption(e.target.value)}
          style={{width:"100%",background:"#13131a",border:"1px solid #2a2a3a",borderRadius:"12px",padding:"0.75rem 1rem",color:"white",fontSize:"0.95rem",marginTop:"1rem",boxSizing:"border-box"}}
        />
        <input
          placeholder="Add location..."
          value={location}
          onChange={e=>setLocation(e.target.value)}
          style={{width:"100%",background:"#13131a",border:"1px solid #2a2a3a",borderRadius:"12px",padding:"0.75rem 1rem",color:"white",fontSize:"0.95rem",marginTop:"0.75rem",boxSizing:"border-box"}}
        />

        {preview && (
          <button onClick={handlePost} disabled={loading} style={{width:"100%",padding:"0.85rem",background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"12px",color:"white",fontSize:"1rem",fontWeight:"bold",cursor:"pointer",marginTop:"1.5rem",opacity:loading?0.7:1}}>
            {loading ? "⏳ Uploading to Cloudinary..." : "🚀 Share Post"}
          </button>
        )}
      </div>
    </div>
  );
}
