import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../api";

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [privateAccount, setPrivateAccount] = useState(user?.isPrivate || false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const togglePrivate = async () => {
    const newVal = !privateAccount;
    setPrivateAccount(newVal);
    setSaving(true);
    try {
      await API.put("/users/profile", {
        fullName: user?.fullName,
        username: user?.username,
        bio: user?.bio,
        website: user?.website,
        avatar: user?.avatar,
        isPrivate: newVal,
      });
      setMsg("Saved!");
      setTimeout(() => setMsg(""), 2000);
    } catch { setMsg("Error!"); setPrivateAccount(!newVal); }
    setSaving(false);
  };

  const Switch = ({ value, onChange }) => (
    <div onClick={onChange} style={{width:"48px",height:"26px",borderRadius:"13px",background:value?"linear-gradient(135deg,#7c3aed,#db2777)":"#2a2a3a",cursor:"pointer",position:"relative",transition:"all 0.3s"}}>
      <div style={{position:"absolute",top:"3px",left:value?"25px":"3px",width:"20px",height:"20px",borderRadius:"50%",background:"white",transition:"left 0.3s"}} />
    </div>
  );

  const Section = ({ title }) => (
    <div style={{padding:"1rem 1rem 0.5rem",color:"#888",fontSize:"0.8rem",fontWeight:"bold",letterSpacing:"0.05em"}}>{title}</div>
  );

  const Row = ({ icon, label, desc, right, onClick }) => (
    <div onClick={onClick} style={{display:"flex",alignItems:"center",gap:"1rem",padding:"0.9rem 1rem",borderBottom:"1px solid #1a1a2e",cursor:onClick?"pointer":"default"}}>
      <span style={{fontSize:"1.3rem"}}>{icon}</span>
      <div style={{flex:1}}>
        <div style={{color:"white",fontSize:"0.95rem"}}>{label}</div>
        {desc && <div style={{color:"#888",fontSize:"0.75rem",marginTop:"2px"}}>{desc}</div>}
      </div>
      {right}
    </div>
  );

  const [loginHistory, setLoginHistory] = React.useState([]);
  const [showSecurity, setShowSecurity] = React.useState(false);

  const loadLoginHistory = async () => {
    try {
      const res = await API.get('/auth/login-history');
      setLoginHistory(res.data.loginHistory || []);
      setShowSecurity(true);
    } catch {}
  };

  return (
    <div style={{background:"#0a0a0f",minHeight:"100dvh",color:"white",paddingBottom:"5rem"}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:"1rem",padding:"1rem",borderBottom:"1px solid #1a1a2e",position:"sticky",top:0,background:"#0a0a0f",zIndex:10}}>
        <span onClick={()=>navigate(-1)} style={{fontSize:"1.4rem",cursor:"pointer"}}>←</span>
        <span style={{fontWeight:"bold",fontSize:"1.1rem"}}>Settings</span>
        {saving && <span style={{marginLeft:"auto",color:"#7c3aed",fontSize:"0.85rem"}}>Saving...</span>}
        {msg && <span style={{marginLeft:"auto",color:"#22c55e",fontSize:"0.85rem"}}>{msg}</span>}
      </div>

      {/* Profile Preview */}
      <div style={{display:"flex",alignItems:"center",gap:"1rem",padding:"1rem",borderBottom:"1px solid #1a1a2e"}}>
        {user?.avatar ? (
          <img src={user.avatar} alt="avatar" style={{width:"52px",height:"52px",borderRadius:"50%",objectFit:"cover"}} />
        ) : (
          <div style={{width:"52px",height:"52px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",fontSize:"1.2rem"}}>
            {(user?.username||"U")[0].toUpperCase()}
          </div>
        )}
        <div>
          <div style={{fontWeight:"bold"}}>@{user?.username}</div>
          <div style={{color:"#888",fontSize:"0.85rem"}}>{user?.email}</div>
        </div>
        <button onClick={()=>navigate("/edit-profile")} style={{marginLeft:"auto",background:"#1e1e2e",border:"1px solid #2a2a3a",borderRadius:"8px",color:"white",padding:"0.4rem 0.8rem",cursor:"pointer",fontSize:"0.85rem"}}>Edit</button>
      </div>

      {/* Privacy */}
      <Section title="PRIVACY" />
      <Row icon="🔒" label="Private Account" desc="Only followers can see your posts"
        right={<Switch value={privateAccount} onChange={togglePrivate} />}
      />

      {/* Account */}
      <Section title="ACCOUNT" />
      <Row icon="📧" label="Email" desc={user?.email} right={<span style={{color:"#888"}}>›</span>} />
      <Row icon="🗑️" label="Delete Account" desc="Permanently delete your account"
        onClick={()=>{ if(window.confirm("Are you sure? This cannot be undone!")) alert("Contact support to delete your account."); }}
        right={<span style={{color:"#f87171"}}>›</span>}
      />

      {/* About */}
      <Section title="ABOUT" />
      <Row icon="ℹ️" label="App Version" desc="Luciagram v1.0.0" right={<span style={{color:"#888",fontSize:"0.85rem"}}>1.0.0</span>} />

      {/* Logout */}
      <div style={{padding:"1.5rem 1rem"}}>
        <button onClick={()=>{ logout(); navigate("/login"); }} style={{width:"100%",padding:"0.9rem",background:"transparent",border:"1px solid #f87171",borderRadius:"12px",color:"#f87171",cursor:"pointer",fontSize:"1rem",fontWeight:"bold"}}>🚪 Log Out</button>
      </div>
    </div>
  );
}