import React, { useState, useRef } from "react";
import MusicPicker from "../components/MusicPicker";
import API from "../api";
import { useSettings } from '../hooks/useSettings';
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function EditProfile() {
  const { user, setUser, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.fullName || "",
    username: user?.username || "",
    bio: user?.bio || "",
    website: user?.website || "",
    song: user?.song || null,
  });
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [loading, setLoading] = useState(false);

  const handleAvatar = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setAvatar(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await API.put("/users/profile", { ...form, avatar });
      // Update auth context and localStorage immediately
      const updated = { ...user, ...res.data };
      setUser(updated);
      localStorage.setItem("user", JSON.stringify(updated));
      // Also refresh from server to get latest data
      await refreshUser();
      navigate("/profile");
    } catch (err) {
      alert(err.response?.data?.message || "Update failed");
    } finally { setLoading(false); }
  };

  const avatarLetter = (user?.username||"U").slice(0,1).toUpperCase();
  const fields = [
    { label: "Name", key: "fullName", placeholder: "Full name" },
    { label: "Username", key: "username", placeholder: "Username" },
    { label: "Bio", key: "bio", placeholder: "Bio" },
    { label: "Website", key: "website", placeholder: "Website" },
  ];

  return (
    <div style={{background:"#0a0a0f",minHeight:"100vh",color:"white"}}>
      <div style={{background:"#0a0a0f",borderBottom:"1px solid #1e1e2e",padding:"0.75rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100}}>
        <span onClick={()=>navigate("/profile")} style={{color:"#c084fc",cursor:"pointer",fontSize:"1.5rem"}}>✕</span>
        <span style={{fontWeight:"bold"}}>Edit Profile</span>
        <span onClick={handleSave} style={{color:"#c084fc",fontWeight:"bold",cursor:"pointer",opacity:loading?0.5:1}}>{loading?"Saving...":"Save"}</span>
      </div>

      <div style={{maxWidth:"600px",margin:"0 auto",padding:"1.5rem 1rem"}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:"2rem"}}>
          <label style={{cursor:"pointer",position:"relative"}}>
            {avatar ? (
              <img src={avatar} alt="avatar" style={{width:"96px",height:"96px",borderRadius:"50%",objectFit:"cover",border:"3px solid #7c3aed"}} />
            ) : (
              <div style={{width:"96px",height:"96px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2.5rem",fontWeight:"bold"}}>{avatarLetter}</div>
            )}
            <div style={{position:"absolute",bottom:0,right:0,background:"#7c3aed",borderRadius:"50%",width:"28px",height:"28px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.8rem"}}>📷</div>
            <input type="file" accept="image/*,image/gif" onChange={handleAvatar} style={{display:"none"}} />
          </label>
          <span style={{color:"#c084fc",marginTop:"0.75rem",cursor:"pointer",fontSize:"0.95rem"}}>Change photo or GIF</span>
        </div>

        {fields.map(f => (
          <div key={f.key} style={{marginBottom:"1.25rem",borderBottom:"1px solid #1e1e2e",paddingBottom:"1.25rem"}}>
            <label style={{color:"#888",fontSize:"0.8rem",display:"block",marginBottom:"0.4rem"}}>{f.label}</label>
            <input
              value={form[f.key]}
              onChange={e=>setForm({...form,[f.key]:e.target.value})}
              placeholder={f.placeholder}
              style={{width:"100%",background:"transparent",border:"none",color:"white",fontSize:"1rem",outline:"none",boxSizing:"border-box"}}
            />
          </div>
        ))}

        <div style={{marginBottom:"1.25rem"}}>
          <div style={{fontSize:"0.82rem",color:"#888",marginBottom:"0.4rem",fontWeight:"bold"}}>🎷 Profile Song</div>
          <div onClick={()=>setShowMusicPicker(true)}
            style={{background:"#1e1e2e",border:"1px solid #2a2a3a",borderRadius:"12px",padding:"0.75rem 1rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.75rem"}}>
            {form.song ? (
              <>
                {form.song.albumArt && <img src={form.song.albumArt} alt={form.song.title} style={{width:"40px",height:"40px",borderRadius:"8px",objectFit:"cover",flexShrink:0}} />}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"0.9rem",fontWeight:"bold",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{form.song.title}</div>
                  <div style={{fontSize:"0.75rem",color:"#888"}}>{form.song.artist}</div>
                </div>
                <span onClick={e=>{e.stopPropagation();setForm(p=>({...p,song:null}));}} style={{color:"#f87171",fontSize:"1.1rem",cursor:"pointer"}}>✕</span>
              </>
            ) : (
              <>
                <span style={{fontSize:"1.3rem"}}>🎷</span>
                <span style={{color:"#555",fontSize:"0.9rem"}}>Add a song to your profile</span>
              </>
            )}
          </div>
        </div>

        <button onClick={handleSave} disabled={loading}
          style={{width:"100%",padding:"0.85rem",background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"12px",color:"white",fontSize:"1rem",fontWeight:"bold",cursor:"pointer",opacity:loading?0.7:1}}>
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {showMusicPicker && (
        <MusicPicker
          selectedMusic={form.song}
          onSelect={t=>{setForm(p=>({...p,song:t}));setShowMusicPicker(false);}}
          onClose={()=>setShowMusicPicker(false)}
        />
      )}
    </div>
  );
}
