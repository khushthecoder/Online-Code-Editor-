const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getIceServers, getVoiceConfig, getToken } = require("../controllers/voiceController");

// Which voice transport to use (livekit | mesh) + the LiveKit URL when applicable.
router.get("/config", authMiddleware, getVoiceConfig);

// Ephemeral ICE/TURN credentials for the WebRTC voice mesh. Authed: only a logged-in
// user can obtain relay credentials, and they expire (TURN_TTL_SECONDS).
router.get("/ice-servers", authMiddleware, getIceServers);

// LiveKit room token minted from the authed identity (SFU mode).
router.post("/token", authMiddleware, getToken);

module.exports = router;
