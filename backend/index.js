require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const passport = require("passport");
require("./src/config/passport-setup");
const prisma = require("./src/prismaClient");

const authRoutes = require("./src/routes/authRoutes");
const roomRoutes = require("./src/routes/roomRoutes");
const runRoutes = require("./src/routes/runRoutes");
const aiRoutes = require("./src/routes/aiRoutes");
const voiceRoutes = require("./src/routes/voiceRoutes");
const { VOICE_MAX_PEERS } = require("./src/controllers/voiceController");
const { livekitEnabled } = require("./src/services/voice/livekit");
const { apiLimiter } = require("./src/middleware/rateLimiters");
const { attachCollab, getStats, flushAllDocs } = require("./src/collab/wsServer");
const { redisEnabled, makeClient } = require("./src/lib/redis");
const { createAdapter } = require("@socket.io/redis-adapter");
const redisAdapter = require("./src/collab/redisAdapter");

// ── Fail fast on misconfiguration ──────────────────────────────────────────
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error(
    "FATAL: JWT_SECRET is missing or too weak (need >= 32 chars). " +
      "Generate one with `openssl rand -hex 32` and set it in the environment.",
  );
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is not set.");
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);

const IS_PROD = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT) || 5001; // numeric so the EADDRINUSE retry increments

// Behind a proxy (Vercel/Render) so rate-limiter & secure cookies see the real IP/proto.
app.set("trust proxy", 1);

// ── CORS: single, explicit allowlist (no blanket *.vercel.app) ──────────────
const allowedOrigins = [
  "http://localhost:5173",
  process.env.VITE_CLIENT_URL,
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
].filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true; // curl / server-to-server / same-origin
  if (allowedOrigins.includes(origin)) return true;
  // Any localhost port during development only.
  if (!IS_PROD && /^http:\/\/localhost:\d+$/.test(origin)) return true;
  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) return callback(null, true);
    console.warn(`Blocked by CORS: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "512kb" })); // bound payloads (code + prompts) to prevent memory DoS
app.use(passport.initialize());

const io = new Server(server, { cors: corsOptions });

// Cross-instance Socket.IO (presence) fan-out. No sticky sessions needed — any
// instance can serve any user. Dedicated pub/sub pair for the adapter.
if (redisEnabled) {
  const ioPub = makeClient("io-pub");
  const ioSub = makeClient("io-sub");
  if (ioPub && ioSub) {
    io.adapter(createAdapter(ioPub, ioSub));
    console.log("[socket.io] Redis adapter enabled");
  }
}

// CRDT collaborative editing (Yjs) — shares this HTTP server, handles /collab/* only.
attachCollab(server);

// ── Socket.IO authentication: identity comes from the JWT, never the client ──
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.userId = decoded.userId;
    socket.data.username = decoded.username;
    return next();
  } catch (err) {
    return next(new Error("Invalid or expired token"));
  }
});

if (!IS_PROD) {
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) console.log(`[API] ${req.method} ${req.path}`);
    next();
  });
}

app.get("/api/ping", (req, res) => res.status(200).json({ message: "pong" }));

// ── Observability ────────────────────────────────────────────────────────────
// Liveness: is the process up? (used by load balancers / orchestrators)
app.get("/healthz", (req, res) => res.status(200).json({ status: "ok", instance: redisAdapter.INSTANCE_ID }));

// Readiness: are dependencies reachable? (fail => LB stops routing new traffic)
app.get("/readyz", async (req, res) => {
  const checks = { db: false, redis: !redisEnabled ? "disabled" : false };
  try { await prisma.$queryRaw`SELECT 1`; checks.db = true; } catch (e) { /* down */ }
  if (redisEnabled) checks.redis = (await redisAdapter.pingLatencyMs()) !== null;
  const ready = checks.db && (checks.redis === true || checks.redis === "disabled");
  res.status(ready ? 200 : 503).json({ ready, checks });
});

// Metrics: connections, rooms, redis latency, memory — scrape or eyeball.
app.get("/metrics", async (req, res) => {
  const mem = process.memoryUsage();
  const stats = getStats();
  res.status(200).json({
    instance: redisAdapter.INSTANCE_ID,
    uptimeSec: Math.round(process.uptime()),
    collab: stats,
    socketioConnections: io.engine.clientsCount,
    redis: {
      enabled: redisEnabled,
      latencyMs: redisEnabled ? await redisAdapter.pingLatencyMs() : null,
    },
    memory: { rssMB: +(mem.rss / 1048576).toFixed(1), heapUsedMB: +(mem.heapUsed / 1048576).toFixed(1) },
    cpu: process.cpuUsage(),
  });
});

// General backstop limiter for the whole API surface.
app.use("/api", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/room", roomRoutes);
app.use("/api/run", runRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/voice", voiceRoutes);

// ── Real-time collaboration ─────────────────────────────────────────────────
async function getAllConnectedClients(roomId) {
  const clients = await io.in(roomId).fetchSockets();
  return clients.map((client) => ({
    socketId: client.id,
    username: client.data.username || "Guest",
  }));
}

// language per room (transient presence hint; source of truth stays in the DB)
const roomLanguages = {};
// Voice-channel membership per room: roomId -> Map<socketId, { username, muted }>.
// Transient, in-memory only — WebRTC media is peer-to-peer; the server relays
// signaling AND is the source of truth for voice PRESENCE (who's in voice + mic
// state), which every room member sees regardless of whether they've joined voice.
const roomVoice = new Map();

// The current voice roster for a room, as broadcast to clients for presence display.
function voiceRoster(roomId) {
  const members = roomVoice.get(roomId);
  if (!members) return [];
  return [...members].map(([socketId, s]) => ({
    socketId,
    username: s.username,
    muted: s.muted,
  }));
}
// debounce persistence per room+language so we don't write to the DB on every keystroke
const savers = new Map();
const SAVE_DEBOUNCE_MS = 600;

function schedulePersist(roomId, language, newCode) {
  const key = `${roomId}:${language}`;
  const existing = savers.get(key);
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(async () => {
    savers.delete(key);
    try {
      const room = await prisma.room.findUnique({
        where: { roomId },
        select: { code: { select: { id: true } } },
      });
      if (room?.code) {
        await prisma.code.update({
          where: { id: room.code.id },
          data: { [language]: newCode },
        });
      }
    } catch (dbError) {
      console.error("DB Save Error:", dbError.message);
    }
  }, SAVE_DEBOUNCE_MS);
  savers.set(key, { timer });
}

io.on("connection", (socket) => {
  socket.on("join-room", async ({ roomId }) => {
    if (!roomId) return;
    socket.roomId = roomId;
    socket.join(roomId);
    const clients = await getAllConnectedClients(roomId);
    io.in(roomId).emit("update-user-list", clients);
    if (roomLanguages[roomId]) socket.emit("language-update", roomLanguages[roomId]);
    // Send the current voice roster so a room member sees who's already in voice
    // (and their mic state) the moment they arrive — even before joining voice.
    const vm = roomVoice.get(roomId);
    if (vm && vm.size) socket.emit("voice:roster", voiceRoster(roomId));
  });

  socket.on("code-change", ({ language, newCode }) => {
    const roomId = socket.roomId;
    if (!roomId || !language) return;
    socket.to(roomId).emit("code-update", { language, newCode });
    schedulePersist(roomId, language, newCode);
  });

  socket.on("send-message", ({ message }) => {
    const roomId = socket.roomId;
    const username = socket.data.username; // trusted (from JWT), not client-supplied
    if (!roomId || !username || !message) return;

    const istTime = new Date().toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    io.in(roomId).emit("new-message", { username, text: message, time: istTime });
  });

  socket.on("language-change", ({ language }) => {
    const roomId = socket.roomId;
    if (!roomId || !language) return;
    roomLanguages[roomId] = language;
    socket.to(roomId).emit("language-update", language);
  });

  // ── Real-time voice (WebRTC mesh) ─────────────────────────────────────────
  // Signaling ONLY. Audio flows peer-to-peer between browsers; the server never
  // touches media. Identity (socket.id, username) is trusted from the JWT-authed
  // socket, never from the client payload.
  const leaveVoice = () => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const members = roomVoice.get(roomId);
    if (members && members.delete(socket.id)) {
      if (members.size === 0) roomVoice.delete(roomId);
      // io.to (not socket.to): on the `disconnect` event the socket has already
      // left its rooms, so a socket-scoped broadcast would reach no one. The
      // leaver's own client ignores the echo (it has already torn voice down).
      io.to(roomId).emit("voice:peer-left", { socketId: socket.id });
    }
  };

  // A new peer joins: reply with the peers ALREADY in voice (the joiner initiates
  // offers to them — one initiator per pair avoids WebRTC "glare"), then announce.
  socket.on("voice:join", () => {
    const roomId = socket.roomId;
    if (!roomId) return;
    let members = roomVoice.get(roomId);
    if (!members) { members = new Map(); roomVoice.set(roomId, members); }
    // Mesh guardrail: cap participants so a full mesh stays healthy. Idempotent for
    // a peer already in voice (e.g. re-announcing after a reconnect). The cap does
    // NOT apply in LiveKit (SFU) mode, which scales well past a mesh's limit.
    if (!livekitEnabled && !members.has(socket.id) && members.size >= VOICE_MAX_PEERS) {
      socket.emit("voice:full", { max: VOICE_MAX_PEERS });
      return;
    }
    const existing = [...members].map(([socketId, s]) => ({ socketId, username: s.username }));
    members.set(socket.id, { username: socket.data.username || "Guest", muted: false });
    socket.emit("voice:peers", existing); // for WebRTC handshake (existing peers)
    // Presence: tell the whole room this person joined voice (mic on, unmuted).
    socket.to(roomId).emit("voice:peer-joined", {
      socketId: socket.id,
      username: socket.data.username || "Guest",
      muted: false,
    });
  });

  socket.on("voice:leave", leaveVoice);

  // Presence: mic mute/unmute. Server holds the state (so late joiners get it via
  // the roster) and fans it out to the ENTIRE room, not just voice participants.
  socket.on("voice:status", ({ muted }) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const members = roomVoice.get(roomId);
    const member = members && members.get(socket.id);
    if (!member) return;
    member.muted = !!muted;
    socket.to(roomId).emit("voice:status", { socketId: socket.id, muted: member.muted });
  });

  // A room member (possibly not in voice) asks for the current voice roster —
  // used on (re)connect so presence is correct even if a broadcast was missed.
  socket.on("voice:sync", () => {
    if (socket.roomId) socket.emit("voice:roster", voiceRoster(socket.roomId));
  });

  // Targeted 1:1 relay of the SDP/ICE handshake. `to` is the destination socketId;
  // we stamp the trusted `from` so the receiver knows who it's negotiating with.
  // Both ends MUST be voice participants of the sender's own room — this prevents
  // a client from injecting signaling into arbitrary sockets or other rooms.
  const relay = (event) => ({ to, ...rest }) => {
    if (!to) return;
    const members = roomVoice.get(socket.roomId);
    if (!members || !members.has(socket.id) || !members.has(to)) return;
    io.to(to).emit(event, { from: socket.id, ...rest });
  };
  socket.on("voice:offer", relay("voice:offer"));
  socket.on("voice:answer", relay("voice:answer"));
  socket.on("voice:ice", relay("voice:ice"));

  // Speaking indicator: fan out this peer's talk state to the rest of the room.
  socket.on("voice:speaking", ({ speaking }) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    socket.to(roomId).emit("voice:speaking", { socketId: socket.id, speaking: !!speaking });
  });

  // Fires after the socket has left its rooms — the user list is already accurate.
  socket.on("disconnect", async () => {
    leaveVoice(); // drop from voice channel + notify peers before anything else
    const roomId = socket.roomId;
    if (!roomId) return;
    try {
      const clients = await getAllConnectedClients(roomId);
      io.in(roomId).emit("update-user-list", clients);
      if (clients.length === 0) delete roomLanguages[roomId];
    } catch (e) {
      console.error("Error on disconnect broadcast:", e.message);
    }
  });
});

// ── Global error handler: log details server-side, return a generic message ──
app.use((err, req, res, next) => {
  console.error("🔥 Global Error:", err.message);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ message: "Internal Server Error" });
});

const startServer = (port) => {
  const handleListenError = (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`Port ${port} is in use, trying ${port + 1}...`);
      server.close();
      startServer(port + 1);
    } else {
      console.error(err);
    }
  };

  server.once("error", handleListenError);
  server.listen(port, () => {
    server.removeListener("error", handleListenError);
    console.log(`Server listening on http://localhost:${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`Database URL: ${process.env.DATABASE_URL ? "Set" : "Missing"}`);
    console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
  });
};

// ── Process-level crash guards ───────────────────────────────────────────────
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

// ── Graceful shutdown: flush all in-memory docs to Postgres, then exit ───────
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} — flushing docs…`);
  const killTimer = setTimeout(() => process.exit(1), 10000);
  try {
    server.close();
    const flushed = await flushAllDocs(); // persist CRDT state → zero data loss
    console.log(`[shutdown] flushed ${flushed} doc(s)`);
    if (redisAdapter.pub) redisAdapter.pub.quit().catch(() => {});
    if (redisAdapter.sub) redisAdapter.sub.quit().catch(() => {});
    await prisma.$disconnect().catch(() => {});
  } catch (e) {
    console.error("[shutdown] error:", e.message);
  } finally {
    clearTimeout(killTimer);
    process.exit(0);
  }
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

if (require.main === module) {
  startServer(PORT);
}

// Export the Express app for serverless (REST). Socket.IO requires the persistent
// `server` (run via `node index.js`) on a stateful host like Render/Railway/Fly.
module.exports = app;
module.exports.server = server;
