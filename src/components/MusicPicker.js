import React, { useState } from "react";

export default function MusicPicker({ onSelect, onClose, selectedMusic }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const PRESETS = [
    { id: "1", title: "Blinding Lights", artist: "The Weeknd", albumArt: "https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36", previewUrl: "", duration: 30 },
    { id: "2", title: "Starboy", artist: "The Weeknd", albumArt: "https://i.scdn.co/image/ab67616d0000b273a048415db06a5b6fa7ec4e1a", previewUrl: "", duration: 30 },
    { id: "3", title: "Levitating", artist: "Dua Lipa", albumArt: "https://i.scdn.co/image/ab67616d0000b2734bc66095f8a70bc4e6593f4f", previewUrl: "", duration: 30 },
    { id: "4", title: "As It Was", artist: "Harry Styles", albumArt: "https://i.scdn.co/image/ab67616d0000b2732e8ed79e177ff6011076f5f0", previewUrl: "", duration: 30 },
    { id: "5", title: "Heat Waves", artist: "Glass Animals", albumArt: "https://i.scdn.co/image/ab67616d0000b273eba10e06dd63a716f4567bcd", previewUrl: "", duration: 30 },
    { id: "6", title: "Stay", artist: "The Kid LAROI", albumArt: "https://i.scdn.co/image/ab67616d0000b273da5d5aeeabacacc1263c0f4b", previewUrl: "", duration: 30 },
  ];

  const filtered = query.length > 1
    ? PRESETS.filter(s => s.title.toLowerCase().includes(query.toLowerCase()) || s.artist.toLowerCase().includes(query.toLowerCase()))
    : PRESETS;

  return (
    <div style={{position:"fixed",inset:0,zIndex:600,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div onClick={onClose} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
      <div style={{background:"#13131a",borderRadius:"20px 20px 0 0",padding:"1.25rem 1rem",maxHeight:"70vh",overflowY:"auto"}}>
        <div style={{width:"40px",height:"4px",background:"#333",borderRadius:"2px",margin:"0 auto 1rem"}} />
        <div style={{fontWeight:"bold",fontSize:"1rem",marginBottom:"1rem"}}>🎷 Pick a Song</div>
        <div style={{background:"#1e1e2e",borderRadius:"12px",padding:"0.6rem 1rem",display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.75rem"}}>
          <span style={{color:"#888"}}>🔍</span>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search song or artist..."
            style={{flex:1,background:"transparent",border:"none",color:"white",fontSize:"0.95rem",outline:"none"}} />
        </div>
        {filtered.map(song => (
          <div key={song.id} onClick={()=>onSelect(song)}
            style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.6rem 0",borderBottom:"1px solid #1e1e2e",cursor:"pointer",
              background:selectedMusic?.id===song.id?"rgba(124,58,237,0.1)":"transparent",borderRadius:"8px"}}>
            <img src={song.albumArt} alt={song.title} style={{width:"46px",height:"46px",borderRadius:"8px",objectFit:"cover",flexShrink:0}}
              onError={e=>e.target.style.display="none"} />
            <div style={{flex:1}}>
              <div style={{fontSize:"0.9rem",fontWeight:"bold"}}>{song.title}</div>
              <div style={{fontSize:"0.75rem",color:"#888",marginTop:"2px"}}>{song.artist}</div>
            </div>
            {selectedMusic?.id===song.id && <span style={{color:"#a78bfa",fontSize:"1rem"}}>✓</span>}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{textAlign:"center",color:"#555",padding:"2rem",fontSize:"0.85rem"}}>No songs found</div>
        )}
      </div>
    </div>
  );
}
