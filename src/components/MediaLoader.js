import React from "react";

export default function MediaLoader({ mediaUrl, mediaType, style, controls, autoPlay, loop, muted, playsInline, onClick }) {
  if (!mediaUrl) return null;

  if (mediaType === "video") {
    return <video src={mediaUrl} style={style} controls={controls} autoPlay={autoPlay} loop={loop} muted={muted} playsInline={playsInline} onClick={onClick} />;
  }
  return <img src={mediaUrl} alt="media" style={style} onClick={onClick} />;
}
