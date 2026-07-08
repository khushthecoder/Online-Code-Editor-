const { AccessToken } = require("livekit-server-sdk");

// LiveKit SFU integration (P2). Enabled only when all three vars are present;
// otherwise the app runs the WebRTC mesh (P0/P1) with zero config. LIVEKIT_URL is
// the client-facing ws(s):// signaling URL; the API key/secret sign room tokens.
const LIVEKIT_URL = process.env.LIVEKIT_URL || "";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";

const livekitEnabled = Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);

// Mint a short-lived room token. Identity = the caller's Socket.IO id so LiveKit
// participants line up 1:1 with the presence avatars (which are keyed by socketId),
// keeping the UI identical to mesh mode. `name` is the display username.
async function mintToken({ identity, name, room }) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name,
    ttl: "1h",
  });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,      // publish own mic
    canSubscribe: true,    // hear others
    canPublishData: false, // audio only — data/chat stays on Yjs/Socket.IO
  });
  return at.toJwt(); // async in livekit-server-sdk v2
}

module.exports = { livekitEnabled, mintToken, LIVEKIT_URL };
