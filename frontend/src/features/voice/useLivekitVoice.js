import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { socket } from "../../socket";
import api from "../../services/api";
import { useVoicePresence, computeVoiceStatuses } from "./useVoicePresence";
import { DEVICE_KEY, shouldTransmit, listMics, usePttKeyboard } from "./voiceShared";

// ── LiveKit SFU voice (P2) ───────────────────────────────────────────────────
// Media flows through the LiveKit server (scales to large rooms, server-side
// active-speaker). Presence, however, rides the SAME Socket.IO channel as mesh
// mode: this hook MIRRORS its LiveKit state (join / leave / mute / speaking) onto
// Socket.IO so that EVERY room member — including those not in voice — sees the
// exact same avatar statuses. Identity = our socketId, so it all lines up.
//
// livekit-client is ~500KB; loaded lazily so mesh sessions never pay for it.
let livekitMod = null;
const loadLiveKit = async () => (livekitMod ||= await import("livekit-client"));

export function useLivekitVoice({ roomId, enabled = true }) {
  const [inVoice, setInVoice] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [pttMode, setPttMode] = useState(false);
  const [error, setError] = useState(null);
  const [selfSpeaking, setSelfSpeaking] = useState(false);
  const [selfConnecting, setSelfConnecting] = useState(false);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState(() => localStorage.getItem(DEVICE_KEY) || "");

  const presence = useVoicePresence({ enabled });

  const roomRef = useRef(null);
  const attachedRef = useRef(new Map());
  const inVoiceRef = useRef(false);
  const mutedRef = useRef(false);
  const pttModeRef = useRef(false);
  const pttHeldRef = useRef(false);
  const deviceIdRef = useRef(deviceId);
  deviceIdRef.current = deviceId;

  const transmitting = useCallback(() => shouldTransmit({
    pttMode: pttModeRef.current, pttHeld: pttHeldRef.current, muted: mutedRef.current,
  }), []);

  const applyMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try { await room.localParticipant.setMicrophoneEnabled(transmitting()); } catch { /* noop */ }
  }, [transmitting]);

  const listDevices = useCallback(async () => {
    const mics = await listMics();
    if (mics) setDevices(mics);
  }, []);

  const teardown = useCallback((notify) => {
    inVoiceRef.current = false;
    setInVoice(false);
    setSelfSpeaking(false);
    setSelfConnecting(false);
    attachedRef.current.forEach((el) => { try { el.remove(); } catch { /* noop */ } });
    attachedRef.current.clear();
    const room = roomRef.current;
    roomRef.current = null;
    if (room) { try { room.disconnect(); } catch { /* noop */ } }
    if (notify) socket.emit("voice:leave"); // presence: tell the room we left voice
    mutedRef.current = false; setMuted(false);
    pttModeRef.current = false; setPttMode(false);
    pttHeldRef.current = false;
  }, []);

  const join = useCallback(async () => {
    if (!enabled || inVoiceRef.current || connecting) return;
    if (!socket.id) { setError("Not connected — try again in a moment"); return; }
    setConnecting(true);
    setSelfConnecting(true);
    setError(null);
    try {
      const { Room, RoomEvent, Track } = await loadLiveKit();
      const { data } = await api.post("/api/voice/token", { room: roomId, identity: socket.id });
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      const selfId = socket.id;

      room
        .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          // Broadcast only OUR OWN speaking over Socket.IO; remote speaking arrives
          // via each remote peer's own presence emit (uniform with mesh mode).
          const meSpeaking = speakers.some((s) => s.identity === selfId);
          setSelfSpeaking(meSpeaking);
          socket.emit("voice:speaking", { speaking: meSpeaking });
        })
        .on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.style.display = "none";
            document.body.appendChild(el);
            attachedRef.current.set(track.sid, el);
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove());
          attachedRef.current.delete(track.sid);
        })
        .on(RoomEvent.Disconnected, () => { if (inVoiceRef.current) teardown(true); });

      await room.connect(data.url, data.token);
      await room.startAudio().catch(() => {});

      inVoiceRef.current = true;
      setInVoice(true);
      setSelfConnecting(false);
      if (deviceIdRef.current) { try { await room.switchActiveDevice("audioinput", deviceIdRef.current); } catch { /* noop */ } }
      await applyMic();
      listDevices();
      // Presence: announce over Socket.IO so the whole room (voice or not) sees us.
      socket.emit("voice:join");
    } catch (e) {
      setError(
        e?.response?.status === 404 ? "Voice server not configured"
          : e?.name === "NotAllowedError" ? "Microphone permission denied"
            : "Could not connect to voice",
      );
      teardown(false);
    } finally {
      setConnecting(false);
    }
  }, [enabled, connecting, roomId, applyMic, listDevices, teardown]);

  const leave = useCallback(() => { if (inVoiceRef.current) teardown(true); }, [teardown]);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    applyMic();
    socket.emit("voice:status", { muted: mutedRef.current }); // presence broadcast
  }, [applyMic]);

  const togglePtt = useCallback(() => {
    pttModeRef.current = !pttModeRef.current;
    setPttMode(pttModeRef.current);
    pttHeldRef.current = false;
    applyMic();
  }, [applyMic]);

  const pttDown = useCallback(() => { if (!pttModeRef.current || pttHeldRef.current) return; pttHeldRef.current = true; applyMic(); }, [applyMic]);
  const pttUp = useCallback(() => { if (!pttModeRef.current || !pttHeldRef.current) return; pttHeldRef.current = false; applyMic(); }, [applyMic]);

  const changeDevice = useCallback(async (id) => {
    setDeviceId(id);
    try { localStorage.setItem(DEVICE_KEY, id); } catch { /* noop */ }
    const room = roomRef.current;
    if (!room || !inVoiceRef.current) return;
    try { await room.switchActiveDevice("audioinput", id); } catch { setError("Could not switch microphone"); }
  }, []);

  // Keyboard push-to-talk (shared with the mesh hook).
  usePttKeyboard({ enabled, inVoice, pttMode, pttDown, pttUp });

  useEffect(() => () => { if (inVoiceRef.current) teardown(true); }, [roomId, teardown]);

  const connectingIds = useMemo(
    () => (selfConnecting && socket.id ? new Set([socket.id]) : new Set()),
    [selfConnecting],
  );
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
    statuses,
    participants,
    mutedTalking: false, // SFU manages the track when muted; no local nudge in P2
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
