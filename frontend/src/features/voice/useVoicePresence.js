import { useEffect, useState } from "react";
import { socket } from "../../socket";

// ── Voice presence (transport-agnostic) ──────────────────────────────────────
// The SINGLE source of truth for what every avatar shows: who is in the voice
// channel, who is muted, and who is speaking — driven entirely by Socket.IO so it
// reaches EVERY room member, whether or not they've joined voice themselves.
//
// Both the mesh and LiveKit hooks feed this same presence channel (each emits its
// OWN join/leave/mute/speaking), and both read from it. `enabled` is the active
// transport flag — presence stays live for the whole session, independent of
// whether *this* user has joined voice. Note: the server broadcasts with socket.to
// (excludes self), so a client's OWN state is overlaid locally by the media hook.
export function useVoicePresence({ enabled }) {
  const [participants, setParticipants] = useState(() => new Set()); // socketIds in voice
  const [mutedIds, setMutedIds] = useState(() => new Set());         // muted socketIds
  const [speakingIds, setSpeakingIds] = useState(() => new Set());   // currently speaking

  useEffect(() => {
    if (!enabled) return undefined;

    const addTo = (set, id) => { if (set.has(id)) return set; const n = new Set(set); n.add(id); return n; };
    const delFrom = (set, id) => { if (!set.has(id)) return set; const n = new Set(set); n.delete(id); return n; };

    const onRoster = (list) => {
      setParticipants(new Set(list.map((p) => p.socketId)));
      setMutedIds(new Set(list.filter((p) => p.muted).map((p) => p.socketId)));
      // speaking is transient — leave as-is; live events will repopulate
    };
    const onPeerJoined = ({ socketId, muted }) => {
      setParticipants((s) => addTo(s, socketId));
      setMutedIds((s) => (muted ? addTo(s, socketId) : delFrom(s, socketId)));
    };
    const onPeerLeft = ({ socketId }) => {
      setParticipants((s) => delFrom(s, socketId));
      setMutedIds((s) => delFrom(s, socketId));
      setSpeakingIds((s) => delFrom(s, socketId));
    };
    const onStatus = ({ socketId, muted }) => {
      setMutedIds((s) => (muted ? addTo(s, socketId) : delFrom(s, socketId)));
    };
    const onSpeaking = ({ socketId, speaking }) => {
      setSpeakingIds((s) => (speaking ? addTo(s, socketId) : delFrom(s, socketId)));
    };
    // On (re)connect, ask for a fresh roster so presence self-heals after a drop.
    const onConnect = () => socket.emit("voice:sync");

    socket.on("voice:roster", onRoster);
    socket.on("voice:peer-joined", onPeerJoined);
    socket.on("voice:peer-left", onPeerLeft);
    socket.on("voice:status", onStatus);
    socket.on("voice:speaking", onSpeaking);
    socket.on("connect", onConnect);
    // Ask immediately in case we mounted after the room was already joined.
    if (socket.connected) socket.emit("voice:sync");

    return () => {
      socket.off("voice:roster", onRoster);
      socket.off("voice:peer-joined", onPeerJoined);
      socket.off("voice:peer-left", onPeerLeft);
      socket.off("voice:status", onStatus);
      socket.off("voice:speaking", onSpeaking);
      socket.off("connect", onConnect);
    };
  }, [enabled]);

  return { participants, mutedIds, speakingIds };
}

// Merge room-wide presence with THIS client's own local state (the server's
// broadcasts exclude self) and collapse it into a single status per participant.
// Priority: speaking > muted > connecting > mic-on. Returns { statuses, participants }.
export function computeVoiceStatuses({ presence, selfId, inVoice, muted, selfSpeaking, connecting }) {
  const participants = new Set(presence.participants);
  const speaking = new Set(presence.speakingIds);
  const mutedSet = new Set(presence.mutedIds);
  if (inVoice && selfId) {
    participants.add(selfId);
    if (selfSpeaking) speaking.add(selfId); else speaking.delete(selfId);
    if (muted) mutedSet.add(selfId); else mutedSet.delete(selfId);
  }
  const statuses = new Map();
  participants.forEach((id) => {
    let s;
    if (speaking.has(id)) s = "speaking";
    else if (mutedSet.has(id)) s = "muted";
    else if (connecting && connecting.has(id)) s = "connecting";
    else s = "on";
    statuses.set(id, s);
  });
  return { statuses, participants };
}
