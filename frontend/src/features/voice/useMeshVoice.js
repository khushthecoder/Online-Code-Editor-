import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { socket } from "../../socket";
import api from "../../services/api";
import { useVoicePresence, computeVoiceStatuses } from "./useVoicePresence";
import { DEVICE_KEY, shouldTransmit, listMics, usePttKeyboard } from "./voiceShared";

// ── WebRTC mesh voice (P0–P2) ────────────────────────────────────────────────
// Media flows browser-to-browser (one RTCPeerConnection per peer); Socket.IO
// carries both the SDP/ICE handshake AND voice presence. Display state (who's in
// voice, muted, speaking) comes from the shared presence channel so it's visible
// to EVERY room member — this hook only overlays THIS client's own live state.
const FALLBACK_ICE = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];
const SPEAK_THRESHOLD = 0.02;
const SPEAK_RELEASE_MS = 350;
const NUDGE_RELEASE_MS = 900;

export function useMeshVoice({ roomId, enabled = true }) {
  const [inVoice, setInVoice] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [pttMode, setPttMode] = useState(false);
  const [error, setError] = useState(null);
  const [mutedTalking, setMutedTalking] = useState(false);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState(() => localStorage.getItem(DEVICE_KEY) || "");
  const [selfSpeaking, setSelfSpeaking] = useState(false);
  const [connectingIds, setConnectingIds] = useState(() => new Set()); // remote peers still connecting

  const presence = useVoicePresence({ enabled });

  const iceRef = useRef(FALLBACK_ICE);
  const rawStreamRef = useRef(null);
  const graphRef = useRef(null);
  const outTrackRef = useRef(null);
  const pcsRef = useRef(new Map());
  const remoteAudioRef = useRef(new Map());
  const meterRef = useRef(null);
  const inVoiceRef = useRef(false);
  const mutedRef = useRef(false);
  const pttModeRef = useRef(false);
  const pttHeldRef = useRef(false);
  const deviceIdRef = useRef(deviceId);
  deviceIdRef.current = deviceId;

  const markConnecting = useCallback((id, on) => {
    setConnectingIds((s) => {
      if (on === s.has(id)) return s;
      const n = new Set(s);
      if (on) n.add(id); else n.delete(id);
      return n;
    });
  }, []);

  const transmitting = useCallback(() => shouldTransmit({
    pttMode: pttModeRef.current, pttHeld: pttHeldRef.current, muted: mutedRef.current,
  }), []);

  const applyGain = useCallback(() => {
    const g = graphRef.current;
    if (!g) return;
    const on = transmitting();
    try { g.gain.gain.setTargetAtTime(on ? 1 : 0, g.ctx.currentTime, 0.01); } catch { /* noop */ }
    if (!on) { setSelfSpeaking(false); socket.emit("voice:speaking", { speaking: false }); }
  }, [transmitting]);

  const buildGraph = useCallback((rawStream) => {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const source = ctx.createMediaStreamSource(rawStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    const gain = ctx.createGain();
    const dest = ctx.createMediaStreamDestination();
    source.connect(analyser);
    source.connect(gain);
    gain.connect(dest);
    graphRef.current = { ctx, source, analyser, gain, dest };
    outTrackRef.current = dest.stream.getAudioTracks()[0];
    ctx.resume?.().catch(() => {});
  }, []);

  const startMeter = useCallback(() => {
    const g = graphRef.current;
    if (!g) return;
    const data = new Uint8Array(g.analyser.fftSize);
    let raf = 0, lastSpeak = false, speakUntil = 0, lastNudge = false, nudgeUntil = 0;
    const tick = () => {
      g.analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / data.length);
      const loud = rms > SPEAK_THRESHOLD;
      const now = performance.now();
      const on = transmitting();
      let isSpeak = false;
      if (on && loud) { isSpeak = true; speakUntil = now + SPEAK_RELEASE_MS; }
      else if (on && now < speakUntil) { isSpeak = true; }
      if (isSpeak !== lastSpeak) {
        lastSpeak = isSpeak;
        setSelfSpeaking(isSpeak);
        socket.emit("voice:speaking", { speaking: isSpeak });
      }
      let nudge = false;
      if (mutedRef.current && !pttModeRef.current && loud) { nudge = true; nudgeUntil = now + NUDGE_RELEASE_MS; }
      else if (mutedRef.current && !pttModeRef.current && now < nudgeUntil) { nudge = true; }
      if (nudge !== lastNudge) { lastNudge = nudge; setMutedTalking(nudge); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    meterRef.current = { stop: () => cancelAnimationFrame(raf) };
  }, [transmitting]);

  const listDevices = useCallback(async () => {
    const mics = await listMics();
    if (mics) setDevices(mics);
  }, []);

  const getMic = useCallback((id) => navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true, noiseSuppression: true, autoGainControl: true,
      ...(id ? { deviceId: { exact: id } } : {}),
    },
    video: false,
  }), []);

  const closePeer = useCallback((peerId) => {
    const pc = pcsRef.current.get(peerId);
    if (pc) { try { pc.close(); } catch { /* noop */ } pcsRef.current.delete(peerId); }
    const el = remoteAudioRef.current.get(peerId);
    if (el) { el.srcObject = null; remoteAudioRef.current.delete(peerId); }
    markConnecting(peerId, false);
  }, [markConnecting]);

  const closeAllPeers = useCallback(() => {
    pcsRef.current.forEach((pc) => { try { pc.close(); } catch { /* noop */ } });
    pcsRef.current.clear();
    remoteAudioRef.current.forEach((el) => { el.srcObject = null; });
    remoteAudioRef.current.clear();
    setConnectingIds(new Set());
  }, []);

  const cleanup = useCallback(() => {
    inVoiceRef.current = false;
    setInVoice(false);
    closeAllPeers();
    if (meterRef.current) { meterRef.current.stop(); meterRef.current = null; }
    if (graphRef.current) { graphRef.current.ctx.close().catch(() => {}); graphRef.current = null; }
    outTrackRef.current = null;
    if (rawStreamRef.current) { rawStreamRef.current.getTracks().forEach((t) => t.stop()); rawStreamRef.current = null; }
    setSelfSpeaking(false);
    setMutedTalking(false);
    mutedRef.current = false; setMuted(false);
    pttModeRef.current = false; setPttMode(false);
    pttHeldRef.current = false;
  }, [closeAllPeers]);

  const join = useCallback(async () => {
    if (!enabled || inVoiceRef.current || connecting) return;
    setConnecting(true);
    setError(null);
    try {
      try {
        const { data } = await api.get("/api/voice/ice-servers");
        if (Array.isArray(data?.iceServers) && data.iceServers.length) iceRef.current = data.iceServers;
      } catch { iceRef.current = FALLBACK_ICE; }

      const stream = await getMic(deviceIdRef.current);
      rawStreamRef.current = stream;
      buildGraph(stream);
      applyGain();
      startMeter();
      listDevices();

      inVoiceRef.current = true;
      setInVoice(true);
      socket.emit("voice:join"); // presence + WebRTC (server replies voice:peers / voice:full)
    } catch (e) {
      setError(e?.name === "NotAllowedError" ? "Microphone permission denied" : "Could not access microphone");
      if (rawStreamRef.current) { rawStreamRef.current.getTracks().forEach((t) => t.stop()); rawStreamRef.current = null; }
      if (graphRef.current) { graphRef.current.ctx.close().catch(() => {}); graphRef.current = null; }
    } finally {
      setConnecting(false);
    }
  }, [enabled, connecting, getMic, buildGraph, applyGain, startMeter, listDevices]);

  const leave = useCallback(() => {
    if (!inVoiceRef.current) return;
    socket.emit("voice:leave");
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    applyGain();
    socket.emit("voice:status", { muted: mutedRef.current }); // broadcast to whole room
  }, [applyGain]);

  const togglePtt = useCallback(() => {
    pttModeRef.current = !pttModeRef.current;
    setPttMode(pttModeRef.current);
    pttHeldRef.current = false;
    setMutedTalking(false);
    applyGain();
  }, [applyGain]);

  const pttDown = useCallback(() => {
    if (!pttModeRef.current || pttHeldRef.current) return;
    pttHeldRef.current = true;
    applyGain();
  }, [applyGain]);

  const pttUp = useCallback(() => {
    if (!pttModeRef.current || !pttHeldRef.current) return;
    pttHeldRef.current = false;
    applyGain();
  }, [applyGain]);

  const changeDevice = useCallback(async (id) => {
    setDeviceId(id);
    try { localStorage.setItem(DEVICE_KEY, id); } catch { /* noop */ }
    if (!inVoiceRef.current || !graphRef.current) return;
    try {
      const next = await getMic(id);
      const g = graphRef.current;
      try { g.source.disconnect(); } catch { /* noop */ }
      const newSource = g.ctx.createMediaStreamSource(next);
      newSource.connect(g.analyser);
      newSource.connect(g.gain);
      g.source = newSource;
      if (rawStreamRef.current) rawStreamRef.current.getTracks().forEach((t) => t.stop());
      rawStreamRef.current = next;
    } catch { setError("Could not switch microphone"); }
  }, [getMic]);

  // ── WebRTC signaling (media only; presence lives in useVoicePresence) ────────
  useEffect(() => {
    if (!enabled) return undefined;

    const attachRemote = (peerId, stream) => {
      let el = remoteAudioRef.current.get(peerId);
      if (!el) { el = new Audio(); el.autoplay = true; el.playsInline = true; remoteAudioRef.current.set(peerId, el); }
      el.srcObject = stream;
      el.play().catch(() => {});
    };

    const restartIce = async (peerId) => {
      const pc = pcsRef.current.get(peerId);
      if (!pc || !pc._initiator || pc._restarting) return;
      pc._restarting = true;
      try {
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        socket.emit("voice:offer", { to: peerId, sdp: pc.localDescription });
      } catch { /* noop */ } finally { pc._restarting = false; }
    };

    const createPeer = (peerId, initiator) => {
      let pc = pcsRef.current.get(peerId);
      if (pc) return pc;
      pc = new RTCPeerConnection({ iceServers: iceRef.current });
      pc._initiator = initiator;
      pc._pending = [];
      pc._flapTimer = null;
      pcsRef.current.set(peerId, pc);
      markConnecting(peerId, true);
      if (outTrackRef.current && graphRef.current) pc.addTrack(outTrackRef.current, graphRef.current.dest.stream);
      pc.onicecandidate = (e) => { if (e.candidate) socket.emit("voice:ice", { to: peerId, candidate: e.candidate }); };
      pc.ontrack = (e) => attachRemote(peerId, e.streams[0]);
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === "connected") { clearTimeout(pc._flapTimer); markConnecting(peerId, false); }
        else if (st === "failed") { clearTimeout(pc._flapTimer); markConnecting(peerId, true); restartIce(peerId); }
        else if (st === "disconnected") {
          markConnecting(peerId, true);
          clearTimeout(pc._flapTimer);
          pc._flapTimer = setTimeout(() => { if (pc.connectionState === "disconnected") restartIce(peerId); }, 2500);
        }
      };
      if (initiator) {
        (async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("voice:offer", { to: peerId, sdp: pc.localDescription });
          } catch { /* noop */ }
        })();
      }
      return pc;
    };

    const flushPending = async (pc) => {
      if (!pc._pending) return;
      for (const c of pc._pending) { try { await pc.addIceCandidate(c); } catch { /* noop */ } }
      pc._pending = [];
    };

    const onPeers = (peers) => { if (inVoiceRef.current) peers.forEach((p) => createPeer(p.socketId, true)); };
    const onOffer = async ({ from, sdp }) => {
      if (!inVoiceRef.current) return;
      const pc = createPeer(from, false);
      try {
        await pc.setRemoteDescription(sdp);
        await flushPending(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("voice:answer", { to: from, sdp: pc.localDescription });
      } catch { /* noop */ }
    };
    const onAnswer = async ({ from, sdp }) => {
      const pc = pcsRef.current.get(from);
      if (!pc) return;
      try { await pc.setRemoteDescription(sdp); await flushPending(pc); } catch { /* noop */ }
    };
    const onIce = async ({ from, candidate }) => {
      const pc = pcsRef.current.get(from);
      if (!pc || !candidate) return;
      if (pc.remoteDescription && pc.remoteDescription.type) { try { await pc.addIceCandidate(candidate); } catch { /* noop */ } }
      else pc._pending.push(candidate);
    };
    const onPeerLeft = ({ socketId }) => { if (pcsRef.current.has(socketId)) closePeer(socketId); };
    const onFull = ({ max }) => { setError(`Voice room is full (max ${max}). Try again when someone leaves.`); cleanup(); };
    const onReconnect = () => {
      if (!inVoiceRef.current) return;
      closeAllPeers();
      socket.emit("voice:join");
    };

    socket.on("voice:peers", onPeers);
    socket.on("voice:offer", onOffer);
    socket.on("voice:answer", onAnswer);
    socket.on("voice:ice", onIce);
    socket.on("voice:peer-left", onPeerLeft);
    socket.on("voice:full", onFull);
    socket.on("connect", onReconnect);
    return () => {
      socket.off("voice:peers", onPeers);
      socket.off("voice:offer", onOffer);
      socket.off("voice:answer", onAnswer);
      socket.off("voice:ice", onIce);
      socket.off("voice:peer-left", onPeerLeft);
      socket.off("voice:full", onFull);
      socket.off("connect", onReconnect);
    };
  }, [enabled, closePeer, closeAllPeers, cleanup, markConnecting]);

  // Keyboard push-to-talk (shared with the LiveKit hook).
  usePttKeyboard({ enabled, inVoice, pttMode, pttDown, pttUp });

  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return undefined;
    const onChange = () => { if (inVoiceRef.current) listDevices(); };
    md.addEventListener("devicechange", onChange);
    return () => md.removeEventListener("devicechange", onChange);
  }, [listDevices]);

  useEffect(() => () => { if (inVoiceRef.current) { socket.emit("voice:leave"); cleanup(); } }, [roomId, cleanup]);

  // Merge room presence with our own live state → one status per participant.
  const { statuses, participants } = useMemo(
    () => computeVoiceStatuses({
      presence, selfId: socket.id, inVoice, muted, selfSpeaking, connecting: connectingIds,
    }),
    [presence, inVoice, muted, selfSpeaking, connectingIds],
  );

  return {
    inVoice,
    connecting,
    muted,
    pttMode,
    error,
    statuses,        // Map<socketId, 'speaking'|'muted'|'connecting'|'on'>
    participants,    // Set<socketId> in voice (incl. self)
    mutedTalking,
    devices,
    deviceId,
    join,
    leave,
    toggleMute,
    togglePtt,
    pttDown,
    pttUp,
    changeDevice,
    dismissError: useCallback(() => setError(null), []),
  };
}
