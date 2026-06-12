import React, { useState } from "react";
import { useAuth, MUWAN_AUTH_URL } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Register() {
  const [form, setForm] = useState({ username: "", email: "", password: "", fullName: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handle = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    if (!form.username || !form.email || !form.password || !form.fullName) { setLoading(false); return setError("Please fill all fields"); }
    if (!form.email.includes("@"))           { setLoading(false); return setError("Invalid email address"); }
    if (form.password.length < 6)            { setLoading(false); return setError("Password must be at least 6 characters"); }
    if (form.username.length < 3)            { setLoading(false); return setError("Username must be at least 3 characters"); }
    if (!/^[a-zA-Z0-9_.]+$/.test(form.username)) { setLoading(false); return setError("Username: letters, numbers, _ and . only"); }
    try {
      const res = await fetch(`${MUWAN_AUTH_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          password: form.password,
          fullName: form.fullName
        })
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Register failed");
      login(data.user, data.token);
      navigate("/");
    } catch { setError("Network error — try again"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{minHeight:"100vh",background:"#0a0a0f",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#13131a",padding:"2rem",borderRadius:"16px",width:"340px",border:"1px solid #2a2a3a"}}>
        <div style={{textAlign:"center",marginBottom:"1.5rem"}}>
          <img src="https://i.ibb.co/WWjtyhvX/file-00000000a5f0720bb84b412a53d8b399.png" alt="Luciagram" style={{width:"90px",height:"90px",borderRadius:"20px"}} />
          <h1 style={{color:"#c084fc",fontSize:"1.8rem",margin:"0.5rem 0"}}>Luciagram</h1>
          <p style={{color:"#888",margin:0}}>Create your account</p>
        </div>
        {error && <p style={{color:"#f87171",textAlign:"center"}}>{error}</p>}
        <input placeholder="Full Name" value={form.fullName}
          onChange={e=>setForm({...form,fullName:e.target.value})}
          style={{width:"100%",padding:"0.75rem",marginBottom:"0.75rem",background:"#1e1e2e",border:"1px solid #2a2a3a",borderRadius:"8px",color:"white",boxSizing:"border-box"}} />
        <input placeholder="Username" value={form.username}
          onChange={e=>setForm({...form,username:e.target.value})}
          style={{width:"100%",padding:"0.75rem",marginBottom:"0.75rem",background:"#1e1e2e",border:"1px solid #2a2a3a",borderRadius:"8px",color:"white",boxSizing:"border-box"}} />
        <input placeholder="Email" type="email" value={form.email}
          onChange={e=>setForm({...form,email:e.target.value})}
          style={{width:"100%",padding:"0.75rem",marginBottom:"0.75rem",background:"#1e1e2e",border:"1px solid #2a2a3a",borderRadius:"8px",color:"white",boxSizing:"border-box"}} />
        <input placeholder="Password" type="password" value={form.password}
          onChange={e=>setForm({...form,password:e.target.value})}
          onKeyDown={e=>e.key==="Enter"&&handle()}
          style={{width:"100%",padding:"0.75rem",marginBottom:"1rem",background:"#1e1e2e",border:"1px solid #2a2a3a",borderRadius:"8px",color:"white",boxSizing:"border-box"}} />
        <button onClick={handle} disabled={loading}
          style={{width:"100%",padding:"0.75rem",background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"8px",color:"white",fontSize:"1rem",cursor:"pointer"}}>
          {loading ? "Creating..." : "Create Account"}
        </button>
        <p style={{color:"#888",textAlign:"center",marginTop:"1rem"}}>Have account? <Link to="/login" style={{color:"#c084fc"}}>Login</Link></p>
      </div>
    </div>
  );
}
