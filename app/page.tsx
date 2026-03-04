"use client";

import { useEffect, useRef } from "react";
import io from "socket.io-client";

export default function Home() {
  const socketRef = useRef<any>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const roomId = "radio-room";

  useEffect(() => {
    fetch("/api/socket"); // initialize socket server

    socketRef.current = io("http://localhost:3001");

    socketRef.current.emit("join-room", roomId);

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peerRef.current = peer;

    peer.ontrack = (event) => {
      const audio = new Audio();
      audio.srcObject = event.streams[0];
      audio.play();
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("signal", {
          roomId,
          data: { candidate: event.candidate },
        });
      }
    };

    socketRef.current.on("signal", async (data: any) => {
      if (data.sdp) {
        await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));

        if (data.sdp.type === "offer") {
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);

          socketRef.current.emit("signal", {
            roomId,
            data: { sdp: answer },
          });
        }
      }

      if (data.candidate) {
        await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    async function initAudio() {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      stream.getAudioTracks()[0].enabled = false;

      streamRef.current = stream;

      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });
    }

    initAudio();
  }, []);

  async function startTalking() {
    const peer = peerRef.current!;
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socketRef.current.emit("signal", {
      roomId,
      data: { sdp: offer },
    });
  }

  function handleMouseDown() {
    if (streamRef.current) {
      streamRef.current.getAudioTracks()[0].enabled = true;
    }
  }

  function handleMouseUp() {
    if (streamRef.current) {
      streamRef.current.getAudioTracks()[0].enabled = false;
    }
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>📻 Simple Radio App</h1>

      <button onClick={startTalking}>
        Connect
      </button>

      <br /><br />

      <button
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        style={{
          padding: 20,
          fontSize: 18,
        }}
      >
        🎙 Hold to Talk
      </button>
    </div>
  );
}