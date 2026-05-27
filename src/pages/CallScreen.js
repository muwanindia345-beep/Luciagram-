import React, { useEffect, useRef, useState } from "react";

export default function CallScreen({ call, socket, user, onEnd }) {
  const [status, setStatus] = useState(call.isIncoming ? "incoming" : "calling");
  const [duration, setDuration] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [frontCam, setFrontCam] = useState(true);
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const pcRef = useRef();
  const localStreamRef = useRef();
  const timerRef = useRef();
  const isVideo = call.callType === "video";
  const otherUsername = call.callerUsername || call.receiverUsername;
  const otherAvatar = call.callerAvatar || call.receiverAvatar;

  const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };

  useEffect(() => {
    setupListeners();
    if (!call.isIncoming) initiateCall();
    return () => cleanup();
  }, []);

  const setupListeners = () => {
    socket.on("call:accepted", async () => {
      setStatus("connected");
      startTimer();
      await createAndSendOffer();
    });
    socket.on("call:rejected", () => { setStatus("rejected"); setTimeout(onEnd, 2000); });
    socket.on("call:ended", () => { setStatus("ended"); setTimeout(onEnd, 1500); });
    socket.on("call:offer", async ({ offer, callerId }) => {
      await setupPC();
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      socket.emit("call:answer", { callerId, answer });
      setStatus("connected");
      startTimer();
    });
    socket.on("call:answer", async ({ answer }) => {
      await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
    });
    socket.on("call:ice", async ({ candidate }) => {
      try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    });
  };

  const getMedia = async (facingMode = "user") => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: isVideo ? { facingMode } : false,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  };

  const setupPC = async () => {
    const stream = await getMedia(frontCam ? "user" : "environment");
    const pc = new RTCPeerConnection(ICE);
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    pc.ontrack = (e) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]; };
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const receiverId = call.isIncoming ? call.callerId : call.receiverId;
        socket.emit("call:ice", { receiverId, candidate: e.candidate });
      }
    };
    return pc;
  };

  const initiateCall = () => {
    socket.emit("call:initiate", {
      callerId: user.id,
      callerUsername: user.username,
      callerAvatar: user.avatar || "",
      receiverId: call.receiverId,
      receiverUsername: call.receiverUsername,
      callType: call.callType,
    });
  };

  const createAndSendOffer = async () => {
    await setupPC();
    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);
    socket.emit("call:offer", { receiverId: call.receiverId, callerId: user.id, offer });
  };

  const acceptCall = () => {
    setStatus("connecting");
    socket.emit("call:accept", { callerId: call.callerId });
  };

  const rejectCall = () => {
    socket.emit("call:reject", { callerId: call.callerId });
    onEnd();
  };

  const endCall = () => {
    const otherId = call.isIncoming ? call.callerId : call.receiverId;
    socket.emit("call:end", { receiverId: otherId });
    setStatus("ended");
    setTimeout(onEnd, 1000);
  };

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMicOn(m => !m); }
  };

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setCamOn(c => !c); }
  };

  const flipCamera = async () => {
    const newFacing = !frontCam;
    setFrontCam(newFacing);
    const oldTrack = localStreamRef.current?.getVideoTracks()[0];
    if (oldTrack) oldTrack.stop();
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: true, video: { facingMode: newFacing ? "user" : "environment" }
    });
    const newTrack = newStream.getVideoTracks()[0];
    pcRef.current?.getSenders().find(s => s.track?.kind === "video")?.replaceTrack(newTrack);
    if (localVideoRef.current) localVideoRef.current.srcObject = newStream;
    localStreamRef.current = newStream;
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  };

  const cleanup = () => {
    clearInterval(timerRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    ["call:accepted","call:rejected","call:ended","call:offer","call:answer","call:ice"].forEach(e => socket.off(e));
  };

  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const AvatarBig = () => (
    <div style={{width:100,height:100,borderRadius:"50%",overflow:"hidden",border:"3px solid #7c3aed",boxShadow:"0 0 30px #7c3aed66",margin:"0 auto"}}>
      {otherAvatar
        ? <img src={otherAvatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt={otherUsername}/>
        : <div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2.5rem",fontWeight:"bold",color:"white"}}>{(otherUsername||"U")[0].toUpperCase()}</div>
      }
    </div>
  );

  // INCOMING CALL
  if (status === "incoming") return (
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"linear-gradient(160deg,#0a0a0f 0%,#1a0a2e 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between",padding:"5rem 2rem 4rem"}}>
      <div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:"1rem"}}>
        <div style={{color:"#c084fc",fontSize:"0.9rem",letterSpacing:"0.1em",animation:"pulse 1.5s infinite"}}>
          {isVideo ? "📹 Incoming Video Call" : "📞 Incoming Voice Call"}
        </div>
        <AvatarBig />
        <div style={{color:"white",fontSize:"1.6rem",fontWeight:"bold"}}>@{otherUsername}</div>
        <div style={{color:"#666",fontSize:"0.85rem"}}>Luciagram</div>
      </div>
      <div style={{display:"flex",gap:"4rem"}}>
        <div style={{textAlign:"center"}}>
          <button onClick={rejectCall} style={{width:72,height:72,borderRadius:"50%",background:"#ef4444",border:"none",fontSize:"2rem",cursor:"pointer",boxShadow:"0 0 25px #ef444466"}}>📵</button>
          <div style={{color:"#888",fontSize:"0.75rem",marginTop:"0.5rem"}}>Decline</div>
        </div>
        <div style={{textAlign:"center"}}>
          <button onClick={acceptCall} style={{width:72,height:72,borderRadius:"50%",background:"#22c55e",border:"none",fontSize:"2rem",cursor:"pointer",boxShadow:"0 0 25px #22c55e66"}}>
            {isVideo ? "📹" : "📞"}
          </button>
          <div style={{color:"#888",fontSize:"0.75rem",marginTop:"0.5rem"}}>Accept</div>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );

  // CALLING / CONNECTING
  if (status === "calling" || status === "connecting") return (
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"linear-gradient(160deg,#0a0a0f 0%,#1a0a2e 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between",padding:"5rem 2rem 4rem"}}>
      <div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:"1rem"}}>
        <AvatarBig />
        <div style={{color:"white",fontSize:"1.6rem",fontWeight:"bold"}}>@{otherUsername}</div>
        <div style={{color:"#888",animation:"pulse 1.5s infinite"}}>{status === "calling" ? "Calling..." : "Connecting..."}</div>
      </div>
      <button onClick={endCall} style={{width:72,height:72,borderRadius:"50%",background:"#ef4444",border:"none",fontSize:"2rem",cursor:"pointer",boxShadow:"0 0 25px #ef444466"}}>📵</button>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );

  // REJECTED / ENDED
  if (status === "rejected" || status === "ended") return (
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"#0a0a0f",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"1rem"}}>
      <div style={{fontSize:"3rem"}}>{status === "rejected" ? "📵" : "📞"}</div>
      <div style={{color:"white",fontSize:"1.2rem",fontWeight:"bold"}}>{status === "rejected" ? "Call Declined" : "Call Ended"}</div>
      {duration > 0 && <div style={{color:"#888"}}>Duration: {fmt(duration)}</div>}
    </div>
  );

  // ACTIVE VOICE CALL
  if (!isVideo) return (
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"linear-gradient(160deg,#0a0a0f 0%,#1a0a2e 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between",padding:"5rem 2rem 4rem"}}>
      <div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:"1rem"}}>
        <AvatarBig />
        <div style={{color:"white",fontSize:"1.6rem",fontWeight:"bold"}}>@{otherUsername}</div>
        <div style={{color:"#22c55e",fontSize:"1rem",fontWeight:"bold"}}>{fmt(duration)}</div>
      </div>
      <div style={{display:"flex",gap:"2rem",alignItems:"center"}}>
        <div style={{textAlign:"center"}}>
          <button onClick={toggleMic} style={{width:60,height:60,borderRadius:"50%",background:micOn?"#2a2a3a":"#ef4444",border:"none",fontSize:"1.5rem",cursor:"pointer"}}>
            {micOn ? "🎤" : "🔇"}
          </button>
          <div style={{color:"#888",fontSize:"0.72rem",marginTop:"0.4rem"}}>{micOn?"Mute":"Unmute"}</div>
        </div>
        <div style={{textAlign:"center"}}>
          <button onClick={endCall} style={{width:72,height:72,borderRadius:"50%",background:"#ef4444",border:"none",fontSize:"2rem",cursor:"pointer",boxShadow:"0 0 25px #ef444466"}}>📵</button>
          <div style={{color:"#888",fontSize:"0.72rem",marginTop:"0.4rem"}}>End</div>
        </div>
        <div style={{textAlign:"center"}}>
          <button onClick={toggleMic} style={{width:60,height:60,borderRadius:"50%",background:"#2a2a3a",border:"none",fontSize:"1.5rem",cursor:"pointer"}}>🔊</button>
          <div style={{color:"#888",fontSize:"0.72rem",marginTop:"0.4rem"}}>Speaker</div>
        </div>
      </div>
    </div>
  );

  // ACTIVE VIDEO CALL
  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"#000"}}>
      {/* Remote video full screen */}
      <video ref={remoteVideoRef} autoPlay playsInline style={{width:"100%",height:"100%",objectFit:"cover"}} />

      {/* Local video PiP */}
      <div style={{position:"absolute",top:16,right:16,width:100,height:140,borderRadius:12,overflow:"hidden",border:"2px solid #7c3aed",boxShadow:"0 4px 20px rgba(0,0,0,0.5)"}}>
        <video ref={localVideoRef} autoPlay playsInline muted style={{width:"100%",height:"100%",objectFit:"cover"}} />
      </div>

      {/* Top bar */}
      <div style={{position:"absolute",top:0,left:0,right:0,padding:"1rem",background:"linear-gradient(to bottom,rgba(0,0,0,0.7),transparent)",display:"flex",alignItems:"center",gap:"0.75rem"}}>
        <div style={{width:36,height:36,borderRadius:"50%",overflow:"hidden"}}>
          {otherAvatar ? <img src={otherAvatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt={otherUsername}/> : <div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#7c3aed,#db2777)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",color:"white"}}>{(otherUsername||"U")[0].toUpperCase()}</div>}
        </div>
        <div>
          <div style={{color:"white",fontWeight:"bold",fontSize:"0.9rem"}}>@{otherUsername}</div>
          <div style={{color:"#22c55e",fontSize:"0.75rem"}}>{fmt(duration)}</div>
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"2rem 1rem",background:"linear-gradient(to top,rgba(0,0,0,0.8),transparent)",display:"flex",justifyContent:"center",gap:"1.5rem"}}>
        <div style={{textAlign:"center"}}>
          <button onClick={toggleMic} style={{width:56,height:56,borderRadius:"50%",background:micOn?"rgba(255,255,255,0.2)":"#ef4444",border:"none",fontSize:"1.4rem",cursor:"pointer",backdropFilter:"blur(10px)"}}>
            {micOn?"🎤":"🔇"}
          </button>
          <div style={{color:"#ccc",fontSize:"0.65rem",marginTop:"0.3rem"}}>{micOn?"Mute":"Unmute"}</div>
        </div>
        <div style={{textAlign:"center"}}>
          <button onClick={endCall} style={{width:64,height:64,borderRadius:"50%",background:"#ef4444",border:"none",fontSize:"1.8rem",cursor:"pointer",boxShadow:"0 0 25px #ef444466"}}>📵</button>
          <div style={{color:"#ccc",fontSize:"0.65rem",marginTop:"0.3rem"}}>End</div>
        </div>
        <div style={{textAlign:"center"}}>
          <button onClick={toggleCam} style={{width:56,height:56,borderRadius:"50%",background:camOn?"rgba(255,255,255,0.2)":"#ef4444",border:"none",fontSize:"1.4rem",cursor:"pointer",backdropFilter:"blur(10px)"}}>
            {camOn?"📹":"🚫"}
          </button>
          <div style={{color:"#ccc",fontSize:"0.65rem",marginTop:"0.3rem"}}>{camOn?"Hide":"Show"}</div>
        </div>
        <div style={{textAlign:"center"}}>
          <button onClick={flipCamera} style={{width:56,height:56,borderRadius:"50%",background:"rgba(255,255,255,0.2)",border:"none",fontSize:"1.4rem",cursor:"pointer",backdropFilter:"blur(10px)"}}>🔄</button>
          <div style={{color:"#ccc",fontSize:"0.65rem",marginTop:"0.3rem"}}>Flip</div>
        </div>
      </div>
    </div>
  );
}
