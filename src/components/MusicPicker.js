import React, { useState, useRef } from "react";

export default function MusicPicker({ onSelect, onClose, selectedMusic }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(null);
  const audioRef = useRef(null);

  const search = async (q) => {
    setQuery(q);
    if (q.length < 2) return setResults([]);
    setLoading(true);
    try {
      const res = await fetch(
        "https://itunes.apple.com/search?term=" + encodeURIComponent(q) + "&media=music&limit=20&entity=song"
      );
      const data = await res.json();
      setResults(data.results || []);
    } catch {}
    setLoading(false);
  };

  const playPreview = (song) => {
    if (!song.previewUrl) return;
    if (playing === song.trackId) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.src = song.previewUrl;
      audioRef.current.play().catch(() => {});
    }
    setPlaying(song.trackId);
  };

  const handleSelect = (song) => {
    audioRef.current?.pause();
    setPlaying(null);
    onSelect({
      id: String(song.trackId),
      title: song.trackName,
      artist: song.artistName,
      albumArt: song.artworkUrl100,
      previewUrl: song.previewUrl,
      duration: 30,
    });
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:600,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div onClick={()=>{audioRef.current?.pause();onClose();}} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
      <div style={{background:"#13131a",borderRadius:"20px 20px 0 0",padding:"1.25rem 1rem",maxHeight:"75vh",display:"flex",flexDirection:"column"}}>
        <div style={{width:"40px",height:"4px",background:"#333",borderRadius:"2px",margin:"0 auto 1rem"}} />
        <div style={{fontWeight:"bold",fontSize:"1rem",marginBottom:"1rem"}}>🎵 Pick a Song</div>

        <div style={{background:"#1e1e2e",borderRadius:"12px",padding:"0.6rem 1rem",display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.75rem",flexShrink:0}}>
          <span style={{color:"#888"}}>🔍</span>
          <input
            value={query}
            onChange={e=>search(e.target.value)}
            placeholder="Search songs, artists..."
            style={{flex:1,background:"transparent",border:"none",color:"white",fontSize:"0.95rem",outline:"none"}}
            autoFocus
          />
          {loading && <span style={{color:"#888",fontSize:"0.8rem"}}>...</span>}
        </div>

        <div style={{overflowY:"auto",flex:1}}>
          {results.length === 0 && query.length < 2 && (
            <div style={{textAlign:"center",color:"#555",padding:"2rem",fontSize:"0.85rem"}}>
              🎵 Search for any song
            </div>
          )}
          {results.length === 0 && query.length >= 2 && !loading && (
            <div style={{textAlign:"center",color:"#555",padding:"2rem",fontSize:"0.85rem"}}>No results found</div>
          )}
          {results.map(song => (
            <div key={song.trackId}
              style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.6rem 0",borderBottom:"1px solid #1a1a2e",
                background:selectedMusic?.id===String(song.trackId)?"rgba(124,58,237,0.1)":"transparent",borderRadius:"8px"}}>
              <div style={{position:"relative",flexShrink:0,cursor:"pointer"}} onClick={()=>playPreview(song)}>
                <img src={song.artworkUrl100} alt={song.trackName}
                  style={{width:"48px",height:"48px",borderRadius:"8px",objectFit:"cover",display:"block"}} />
                <div style={{position:"absolute",inset:0,borderRadius:"8px",background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem"}}>
                  {playing===song.trackId ? "⏸" : "▶"}
                </div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:"0.9rem",fontWeight:"bold",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{song.trackName}</div>
                <div style={{fontSize:"0.75rem",color:"#888",marginTop:"2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{song.artistName}</div>
                <div style={{fontSize:"0.68rem",color:"#555",marginTop:"1px"}}>{song.collectionName}</div>
              </div>
              <button onClick={()=>handleSelect(song)}
                style={{background:selectedMusic?.id===String(song.trackId)?"#10b981":"linear-gradient(135deg,#7c3aed,#db2777)",
                  border:"none",borderRadius:"20px",padding:"0.35rem 0.9rem",color:"white",cursor:"pointer",fontSize:"0.82rem",fontWeight:"bold",flexShrink:0}}>
                {selectedMusic?.id===String(song.trackId) ? "✓" : "Add"}
              </button>
            </div>
          ))}
        </div>
      </div>
      <audio ref={audioRef} onEnded={()=>setPlaying(null)} />
    </div>
  );
}
