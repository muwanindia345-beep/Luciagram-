import React, { useState, useEffect, forwardRef } from "react";
import API from "../api";

// muwandb:// URLs ko backend se fetch karke base64 mein convert karta hai
function useMuwanMedia(mediaUrl) {
  const [resolvedUrl, setResolvedUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mediaUrl) return;

    if (mediaUrl.startsWith("muwandb://")) {
      const mediaId = mediaUrl.replace("muwandb://", "");
      setLoading(true);
      API.get("/media/" + mediaId)
        .then(res => {
          if (res.data?.url) setResolvedUrl(res.data.url);
          else setResolvedUrl(null);
        })
        .catch(() => setResolvedUrl(null))
        .finally(() => setLoading(false));
    } else {
      // Normal URL — seedha use karo
      setResolvedUrl(mediaUrl);
    }
  }, [mediaUrl]);

  return { resolvedUrl, loading };
}

const MediaLoader = forwardRef(function MediaLoader(
  { mediaUrl, mediaType, style, controls, autoPlay, loop, muted, playsInline, onClick },
  ref
) {
  const { resolvedUrl, loading } = useMuwanMedia(mediaUrl);
  const [error, setError] = useState(false);

  // Loading state
  if (loading) return (
    <div style={{ ...style, background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px" }}>
      <div style={{ textAlign: "center", color: "#7c3aed" }}>
        <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⏳</div>
        <div style={{ fontSize: "0.75rem" }}>Loading...</div>
      </div>
    </div>
  );

  // Error or no URL
  if (!resolvedUrl || error) return (
    <div style={{ ...style, background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px" }}>
      <div style={{ textAlign: "center", color: "#555" }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🖼️</div>
        <div style={{ fontSize: "0.8rem" }}>Media unavailable</div>
      </div>
    </div>
  );

  if (mediaType === "video") {
    return (
      <video
        ref={ref}
        src={resolvedUrl}
        style={style}
        controls={controls}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        onClick={onClick}
        onError={() => setError(true)}
      />
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt="media"
      style={style}
      onClick={onClick}
      onError={() => setError(true)}
    />
  );
});

export default MediaLoader;
