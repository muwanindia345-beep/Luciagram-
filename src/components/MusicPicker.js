import React, { useEffect, useState, useRef } from "react";
import API from "../api";

const MOODS = [
  { id: "happy", label: "😊 Happy" },
  { id: "sad", label: "😢 Sad" },
  { id: "romantic", label: "💕 Romantic" },
  { id: "party", label: "🎉 Party" },
  { id: "chill", label: "😌 Chill" },
  { id: "devotional", label: "🙏 Devotional" },
  { id: "workout", label: "💪 Workout" },
  { id: "sleep", label: "😴 Sleep" },
];

export default function MusicPicker({ onSelect, onClose, selectedMusic }) {
  const [tab, setTab] = useState("suggested");
  const [tracks, setTracks] = useState([]);
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(null);
  const [selectedMood, setSelectedMood] = useState("happy");
  const audioRef = useRef(null);
  const searchTimer = useRef(null);

  useEffect(() => { loadSuggested(); }, []);

  const loadSuggested = async () => {
    setLoading(true);
    try { const r = await API.get("/music/suggested"); setTracks(r.data); } catch {}
    setLoading(false);
  };

  const loadMood = async (mood) => {
    setSelectedMood(mood); setLoading(true);
    try { const r = await API.get("/music/mood?mood=" + mood); setTracks(r.data); } catch {}
    setLoading(false);
  };

  const loadGenres = async () => {
    try { const r = await API.get("/music/genres"); setGenres(r.data); } catch {}
  };

  const loadGenreTracks = async (id) => {
    setSelectedGenre(id); setLoading(true);
    try { const r = await API.get("/music/genre/" + id); setTracks(r.data); } catch {}
    setLoading(false);
  };

  const handleSearch = (q) => {
    setSearchQ(q);
    clearTimeout(searchTimer.current);
    if (!q.trim()) { loadSuggested(); return; }
    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      try { const r = await API.get("/music/search?q=" + encodeURIComponent(q)); setTracks(r.data); } catch {}
      setLoading(false);
    }, 500);
  };

  const switchTab = (t) => {
    setTab(t); setSearchQ(""); setTracks([]); setSelectedGenre(null);
    if (t === "suggested") loadSuggested();
    if (t === "mood") loadMood(selectedMood);
    if (t === "genre") { setTracks([]); loadGenres(); }
  };

  const togglePlay = (track) => {
    if (!track.previewUrl) return;
    if (playing === track.id) {
      audioRef.current?.pause(); setPlaying(null);
    } else {
      if (audioRef.current) { audioRef.current.src = track.previewUrl; audioRef.current.play().catch(()=>{}); }
      setPlaying(track.id);
    }
  };

  const fmtDur = (s) => Math.floor(s/60) + ":" + String(s%60).padStart(2,"0");

  const closeAndStop = () => { audioRef.current?.pause(); onClose(); };

  const showTracks = searchQ || tab !== "genre" || selectedGenre;

  return (
    <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <audio ref={audioRef} onEnded={()=>setPlaying(null)} />
      <div onClick={closeAndStop} style={{flex:1,background:"rgba(0,0,0,0.6)"}} />
      <div style={{background:"#13131a",borderRadius:"20px 20px 0 0",maxHeight:"85vh",display:"flex",flexDirection:"column"}}>

        <div style={{width:"40px",height:"4px",background:"#333",borderRadius:"2px",margin:"0.75rem auto 0",flexShrink:0}} />

        <div style={{padding:"0.75rem 1rem 0",display:"flex",alignItems:"center",gap:"0.75rem",flexShrink:0}}>
          <span style={{fontSize:"1.4rem"}}>🎷</span>
          <div style={{flex:1,background:"#1e1e2e",borderRadius:"12px",display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.55rem 0.9rem"}}>
            <span style={{color:"#666"}}>🔍</span>
            <input value={searchQ} onChange={e=>handleSearch(e.target.value)} placeholder="Search music..."
              style={{flex:1,background:"transparent",border:"none",color:"white",fontSize:"0.95rem",outline:"none"}} />
            {searchQ && <span onClick={()=>handleSearch("")} style={{color:"#666",cursor:"pointer"}}>✕</span>}
          </div>
          <span onClick={closeAndStop} style={{color:"#888",cursor:"pointer",fontSize:"1.2rem"}}>✕</span>
        </div>

        {!searchQ && (
          <div style={{display:"flex",gap:"0.5rem",padding:"0.6rem 1rem 0",overflowX:"auto",flexShrink:0}}>
            {["suggested","mood","genre"].map(t => (
              <button key={t} onClick={()=>switchTab(t)}
                style={{background:tab===t?"linear-gradient(135deg,#7c3aed,#db2777)":"#1e1e2e",border:"none",borderRadius:"20px",padding:"0.4rem 1rem",color:"white",cursor:"pointer",fontWeight:tab===t?"bold":"normal",fontSize:"0.85rem",whiteSpace:"nowrap",flexShrink:0}}>
                {t==="suggested"?"Suggested":t==="mood"?"Mood":"Genre"}
              </button>
            ))}
          </div>
        )}

        {tab==="mood" && !searchQ && (
          <div style={{display:"flex",gap:"0.5rem",padding:"0.5rem 1rem",overflowX:"auto",flexShrink:0}}>
            {MOODS.map(m => (
              <button key={m.id} onClick={()=>loadMood(m.id)}
                style={{background:selectedMood===m.id?"#7c3aed":"#1e1e2e",border:"none",borderRadius:"20px",padding:"0.35rem 0.85rem",color:"white",cursor:"pointer",fontSize:"0.8rem",whiteSpace:"nowrap",flexShrink:0}}>
                {m.label}
              </button>
            ))}
          </div>
        )}

        {tab==="genre" && !searchQ && !selectedGenre && genres.length > 0 && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"0.5rem",padding:"0.75rem 1rem",overflowY:"auto",flex:1}}>
            {genres.map(g => (
              <div key={g.id} onClick={()=>loadGenreTracks(g.id)}
                style={{borderRadius:"12px",overflow:"hidden",cursor:"pointer",position:"relative",height:"70px",background:"#1e1e2e"}}>
                {g.picture && <img src={g.picture} alt={g.name} style={{width:"100%",height:"100%",objectFit:"cover",opacity:0.45}} />}
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.75rem",fontWeight:"bold",textAlign:"center",padding:"0.3rem"}}>{g.name}</div>
              </div>
            ))}
          </div>
        )}

        {showTracks && (
          <div style={{overflowY:"auto",flex:1}}>
            {loading ? (
              <div style={{textAlign:"center",padding:"2rem",color:"#666",fontSize:"0.9rem"}}>Loading... 🎵</div>
            ) : tracks.map((t,i) => {
              const isSel = selectedMusic?.id === t.id;
              const isPlay = playing === t.id;
              return (
                <div key={t.id||i} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.6rem 1rem",background:isSel?"rgba(124,58,237,0.12)":"transparent",borderLeft:isSel?"3px solid #7c3aed":"3px solid transparent"}}>
                  <div onClick={()=>togglePlay(t)} style={{width:"52px",height:"52px",borderRadius:"10px",overflow:"hidden",flexShrink:0,position:"relative",cursor:"pointer"}}>
                    {t.albumArt
                      ? <img src={t.albumArt} alt={t.title} style={{width:"100%",height:"100%",objectFit:"cover"}} />
                      : <div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem"}}>🎷</div>
                    }
                    <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.35)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1rem"}}>
                      {isPlay?"⏸":"▶"}
                    </div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"0.9rem",fontWeight:"bold",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
                    <div style={{fontSize:"0.75rem",color:"#888",marginTop:"2px"}}>{t.artist} · {fmtDur(t.duration)}</div>
                  </div>
                  <div onClick={()=>{ audioRef.current?.pause(); onSelect(t); }}
                    style={{width:"36px",height:"36px",borderRadius:"50%",background:isSel?"linear-gradient(135deg,#7c3aed,#db2777)":"#2a2a3a",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,fontSize:"1rem"}}>
                    {isSel?"✓":"→"}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedMusic && (
          <div style={{padding:"0.75rem 1rem",borderTop:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:"0.75rem",flexShrink:0,background:"#13131a"}}>
            {selectedMusic.albumArt && <img src={selectedMusic.albumArt} alt={selectedMusic.title} style={{width:"40px",height:"40px",borderRadius:"8px",objectFit:"cover",flexShrink:0}} />}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:"0.85rem",fontWeight:"bold",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🎷 {selectedMusic.title}</div>
              <div style={{fontSize:"0.72rem",color:"#888"}}>{selectedMusic.artist}</div>
            </div>
            <button onClick={closeAndStop}
              style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",border:"none",borderRadius:"20px",padding:"0.5rem 1.25rem",color:"white",cursor:"pointer",fontWeight:"bold",fontSize:"0.9rem",flexShrink:0}}>
              Done ✓
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
