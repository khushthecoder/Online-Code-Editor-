const crypto = require("crypto");
const { livekitEnabled, mintToken, LIVEKIT_URL } = require("../services/voice/livekit");

// Mesh size ceiling: above this, per-client upstream bandwidth + encode CPU make a
// full mesh painful. Beyond it you want the SFU (P2). Server-authoritative — see
// the voice:join handler in index.js.
const VOICE_MAX_PEERS = Number(process.env.VOICE_MAX_PEERS) || 6;

// ── ICE servers for WebRTC ──────────────────────────────────────────────────
// STUN (Google's free public servers) is always returned — enough for peers on the
// same network / open NATs. Restrictive or symmetric NATs (corporate, some mobile)
// need a TURN relay. When a self-hosted coturn is configured we mint EPHEMERAL,
// time-limited credentials using coturn's REST-API scheme (HMAC-SHA1 over
// "<expiry>:<user>") so the long-lived static secret never reaches the browser.
// With no TURN configured we degrade gracefully to STUN-only (dev still works).
function getIceServers(req, res) {
  const iceServers = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];

  const turnUrls = (process.env.TURN_URLS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const secret = process.env.TURN_SECRET;

  if (turnUrls.length && secret) {
    const ttl = Number(process.env.TURN_TTL_SECONDS) || 3600;
    const expiry = Math.floor(Date.now() / 1000) + ttl;
    // coturn `use-auth-secret`: username is "<unix-expiry>:<id>", password is the
    // base64 HMAC-SHA1 of that username keyed by the shared static-auth-secret.
    const username = `${expiry}:${req.user?.userId || "anon"}`;
    const credential = crypto.createHmac("sha1", secret).update(username).digest("base64");
    iceServers.push({ urls: turnUrls, username, credential });
  }

  res.json({
    iceServers,
    maxPeers: VOICE_MAX_PEERS,
    turn: turnUrls.length > 0 && Boolean(secret),
  });
}

// Which transport should the client use? LiveKit SFU when configured (scales to
// large rooms, server-side active-speaker), else the built-in WebRTC mesh. The
// client picks its useVoice implementation from this — the UI is identical either way.
function getVoiceConfig(req, res) {
  res.json({
    mode: livekitEnabled ? "livekit" : "mesh",
    url: livekitEnabled ? LIVEKIT_URL : null,
    maxPeers: VOICE_MAX_PEERS,
  });
}

// Mint a LiveKit room token from the JWT-authed identity. `identity` is the caller's
// Socket.IO id (so LiveKit participants map onto presence avatars); `room` is the
// editor roomId. 404 when LiveKit isn't configured (client should use mesh).
async function getToken(req, res) {
  if (!livekitEnabled) return res.status(404).json({ message: "LiveKit not configured" });
  const room = String(req.body?.room || req.query?.room || "").trim();
  const identity = String(req.body?.identity || "").trim();
  if (!room || !identity) return res.status(400).json({ message: "room and identity are required" });
  try {
    const token = await mintToken({ identity, name: req.user?.username || "Guest", room });
    res.json({ token, url: LIVEKIT_URL, identity });
  } catch (e) {
    console.error("[voice] token mint failed:", e.message);
    res.status(500).json({ message: "Could not mint voice token" });
  }
}

module.exports = { getIceServers, getVoiceConfig, getToken, VOICE_MAX_PEERS };
