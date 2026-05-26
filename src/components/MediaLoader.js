import React, { useState, forwardRef } from "react";

const MediaLoader = forwardRef(function MediaLoader(
  { mediaUrl, mediaType, style, controls, autoPlay, loop, muted, playsInline, onClick },
  ref
) {
  const [error, setError] = useState(false);

  if (!mediaUrl || error) return (
    <div style={{...style, background:"#1e1e2e", display:"flex", alignItems:"center", justifyContent:"center", minHeight:"200px"}}>
      <div style={{textAlign:"center", color:"#555"}}>
        <div style={{fontSize:"2rem", marginBottom:"0.5rem"}}>🖼️</div>
        <div style={{fontSize:"0.8rem"}}>Media unavailable</div>
      </div>
    </div>
  );

  if (mediaType === "video") {
    return (
      <video
        ref={ref}
        src={mediaUrl}
        style={style}
        controls={controls}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        onClick={onClick}
        onError={()=>setError(true)}
      />
    );
  }
  return <img src={mediaUrl} alt="media" style={style} onClick={onClick} onError={()=>setError(true)} />;
});

export default MediaLoader;
