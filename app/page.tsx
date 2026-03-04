"use client";

import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";

type SignalData = {
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidate;
};

export default function Home() {
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const [connected, setConnected] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [volume, setVolume] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const roomId = "radio-room";

  const addLog = (msg: string) => {
    console.log(msg);
    setLogs((prev) => [msg, ...prev.slice(0, 10)]);
  };

  useEffect(() => {
    fetch("/api/socket");

    socketRef.current = io("http://localhost:3001");

    socketRef.current.on("connect", () => {
      setConnected(true);
      addLog("🟢 Socket connected");
    });

    socketRef.current.emit("join-room", roomId);

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peerRef.current = peer;

    peer.onconnectionstatechange = () => {
      addLog("🔗 Peer state: " + peer.connectionState);
    };

    peer.ontrack = (event) => {
      addLog("🔊 Receiving audio");
      const audio = new Audio();
      audio.srcObject = event.streams[0];
      audio.play();
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("signal", {
          roomId,
          data: { candidate: event.candidate },
        });
      }
    };

    socketRef.current.on("signal", async (data: SignalData) => {
      if (data.sdp) {
        await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));

        if (data.sdp.type === "offer") {
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);

          socketRef.current?.emit("signal", {
            roomId,
            data: { sdp: answer },
          });
        }
      }

      if (data.candidate) {
        await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    async function initAudio(peer: RTCPeerConnection) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
  
      addLog("🎤 Microphone granted");
  
      stream.getAudioTracks()[0].enabled = false;
  
      streamRef.current = stream;
  
      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });
  
      // 🔥 Volume detection
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
  
      source.connect(analyser);
      analyser.fftSize = 256;
  
      analyserRef.current = analyser;
  
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
  
      function detectVolume() {
        analyser.getByteFrequencyData(dataArray);
        const avg =
          dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setVolume(Math.round(avg));
        requestAnimationFrame(detectVolume);
      }
  
      detectVolume();
    }
    initAudio(peer);
  }, []);


  async function startTalking() {
    const peer = peerRef.current!;
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socketRef.current?.emit("signal", {
      roomId,
      data: { sdp: offer },
    });

    addLog("📡 Sent offer");
  }



  function toggleMic() {
  if (!streamRef.current) return;

  const track = streamRef.current.getAudioTracks()[0];
  const newState = !track.enabled;

  track.enabled = newState;
  setMicActive(newState);

  if (newState) {
    addLog("🎙 Mic enabled");
  } else {
    addLog("🔇 Mic muted");
  }
}

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>📻 Simple Radio App</h1>

      <p>
        Socket: {connected ? "🟢 Connected" : "🔴 Disconnected"}
      </p>

      <p>
        Mic: {micActive ? "🎙 Active" : "🔇 Muted"}
      </p>

      <p>
        Volume: {volume}
        <div
          style={{
            height: 10,
            width: 200,
            background: "#ddd",
            marginTop: 4,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${volume}%`,
              background: micActive ? "green" : "gray",
            }}
          />
        </div>
      </p>

      <button onClick={startTalking}>
        Connect
      </button>

      <br /><br />

      <button
       onClick={toggleMic}
        style={{
          padding: 20,
          fontSize: 18,
          background: micActive ? "red" : "black",
          color: "white",
        }}
      >
        {micActive ? "🔴 Mic ON (Click to mute)" : "⚫ Mic OFF (Click to speak)"}
      </button>

      <hr style={{ margin: "30px 0" }} />

      {/* <h3>Logs</h3>
      <div
        style={{
          background: "#111",
          color: "#0f0",
          padding: 10,
          height: 200,
          overflow: "auto",
          fontSize: 12,
        }}
      >
        {logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div> */}
    </div>
  );
}