import React, { useEffect, useState } from "react";
import { loadMedia } from "../api";

export default function MediaLoader({ mediaId, mediaType, style, controls, autoPlay, loop, muted, playsInline, onClick }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mediaId) { setLoading(false); return; }
    loadMedia(mediaId, mediaType).then(u => {
      setUrl(u);
      setLoading(false);
    });
  }, [mediaId, mediaType]);

  if (loading) return (
    <div style={{...style, background:"#1e1e2e", display:"flex", alignItems:"center", justifyContent:"center"}}>
      <div style={{color:"#7c3aed", fontSize:"1.5rem"}}>🦋</div>
    </div>
  );

  if (!url) return null;

  if (mediaType === "video") {
    return <video src={url} style={style} controls={controls} autoPlay={autoPlay} loop={loop} muted={muted} playsInline={playsInline} onClick={onClick} />;
  }
  return <img src={url} alt="media" style={style} onClick={onClick} />;
}
