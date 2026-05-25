import React, { useEffect, useState } from "react";
import API from "../api";

const mediaCache = {};

export default function MediaLoader({ mediaId, mediaUrl, mediaType, style, controls, autoPlay, loop, muted, playsInline, onClick }) {
  const [url, setUrl] = useState(mediaUrl || null);
  const [loading, setLoading] = useState(!mediaUrl && !!mediaId);

  useEffect(() => {
    // If has mediaUrl directly use it
    if (mediaUrl) { setUrl(mediaUrl); setLoading(false); return; }
    // If has mediaId load from LuciaStore
    if (!mediaId) { setLoading(false); return; }
    if (mediaCache[mediaId]) { setUrl(mediaCache[mediaId]); setLoading(false); return; }
    
    API.get("/media/" + mediaId).then(res => {
      mediaCache[mediaId] = res.data.url;
      setUrl(res.data.url);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [mediaId, mediaUrl]);

  if (loading) return (
    <div style={{...style, background:"#1e1e2e", display:"flex", alignItems:"center", justifyContent:"center", minHeight:"200px"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:"1.5rem", marginBottom:"0.5rem"}}>🦋</div>
        <div style={{color:"#7c3aed", fontSize:"0.8rem"}}>Loading...</div>
      </div>
    </div>
  );

  if (!url) return null;

  if (mediaType === "video") {
    return <video src={url} style={style} controls={controls} autoPlay={autoPlay} loop={loop} muted={muted} playsInline={playsInline} onClick={onClick} />;
  }
  return <img src={url} alt="media" style={style} onClick={onClick} />;
}
