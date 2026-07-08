// Minimal, self-contained Yjs WebSocket server (sync + awareness protocol),
// modeled on the canonical y-websocket reference implementation, with:
//   • JWT-authenticated, room-scoped upgrades (mounted at /collab/<roomId>)
//   • PostgreSQL persistence (see persistence.js)
//   • OPTIONAL Redis pub/sub fan-out for horizontal scaling (see redisAdapter.js)
// It coexists with Socket.IO on the same HTTP server by handling ONLY /collab
// upgrade requests and leaving every other path to Socket.IO.

const Y = require("yjs");
const jwt = require("jsonwebtoken");
const { WebSocketServer } = require("ws");
const encoding = require("lib0/encoding");
const decoding = require("lib0/decoding");
const syncProtocol = require("y-protocols/sync");
const awarenessProtocol = require("y-protocols/awareness");
const { bindState, writeState } = require("./persistence");
const redisAdapter = require("./redisAdapter");

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const PING_TIMEOUT = 30000;

// Transaction origins used to prevent re-publishing updates that arrived FROM
// Redis (which would loop), and to mark server-side awareness pruning.
const REDIS_ORIGIN = "redis";
const PRUNE_ORIGIN = "prune";
const AWARENESS_STALE_MS = 30000;

const docs = new Map(); // docName -> WSSharedDoc

const send = (doc, conn, message) => {
  if (conn.readyState !== conn.OPEN) return closeConn(doc, conn);
  try {
    conn.send(message, (err) => err && closeConn(doc, conn));
  } catch (e) {
    closeConn(doc, conn);
  }
};

class WSSharedDoc extends Y.Doc {
  constructor(name) {
    super({ gc: true });
    this.name = name;
    this.conns = new Map(); // conn -> Set<clientID>
    this.awareness = new awarenessProtocol.Awareness(this);
    this.awareness.setLocalState(null);

    this.awareness.on("update", ({ added, updated, removed }, origin) => {
      const changed = added.concat(updated, removed);
      // Track which clientIDs each local connection controls.
      const controlled = this.conns.get(origin);
      if (controlled) {
        added.forEach((id) => controlled.add(id));
        removed.forEach((id) => controlled.delete(id));
      }
      const awUpdate = awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed);
      // Broadcast to local connections.
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(encoder, awUpdate);
      const buff = encoding.toUint8Array(encoder);
      this.conns.forEach((_, c) => send(this, c, buff));
      // Fan out to other instances (not for changes that came FROM Redis or pruning).
      if (origin !== REDIS_ORIGIN && origin !== PRUNE_ORIGIN) {
        redisAdapter.publishAwareness(this.name, awUpdate);
      }
    });

    this.on("update", (update, origin) => {
      // Broadcast to local connections.
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);
      this.conns.forEach((_, conn) => send(this, conn, message));
      // Fan out to other instances (not for updates that arrived FROM Redis).
      if (origin !== REDIS_ORIGIN) {
        redisAdapter.publishUpdate(this.name, update);
      }
    });
  }
}

function closeConn(doc, conn) {
  if (doc.conns.has(conn)) {
    const controlledIds = doc.conns.get(conn);
    doc.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null);

    if (doc.conns.size === 0) {
      // Last local client left — flush to Postgres, stop Redis fan-out, drop the doc.
      redisAdapter.unsubscribeRoom(doc.name);
      writeState(doc.name, doc).finally(() => {
        doc.destroy();
        docs.delete(doc.name);
      });
    }
  }
  try { conn.close(); } catch (e) { /* already closed */ }
}

function messageListener(conn, doc, message) {
  try {
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);
    switch (messageType) {
      case MESSAGE_SYNC:
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, doc, conn);
        if (encoding.length(encoder) > 1) send(doc, conn, encoding.toUint8Array(encoder));
        break;
      case MESSAGE_AWARENESS:
        awarenessProtocol.applyAwarenessUpdate(doc.awareness, decoding.readVarUint8Array(decoder), conn);
        break;
    }
  } catch (err) {
    console.error("[collab] message error:", err.message);
    doc.emit("error", [err]);
  }
}

// Get (or create) the shared doc for a room. Creation is synchronous so message
// listeners can attach immediately; Postgres hydration runs in the background.
function getYDoc(docName) {
  let doc = docs.get(docName);
  if (doc) return doc;
  doc = new WSSharedDoc(docName);
  docs.set(docName, doc);

  bindState(docName, doc).catch((e) =>
    console.error(`[collab] bind failed for ${docName}:`, e.message),
  );

  // Join the Redis fan-out for this room and pull current state from peers.
  redisAdapter.subscribeRoom(docName, {
    onUpdate: (u) => Y.applyUpdate(doc, u, REDIS_ORIGIN),
    onAwareness: (a) => awarenessProtocol.applyAwarenessUpdate(doc.awareness, a, REDIS_ORIGIN),
    getState: () => Y.encodeStateAsUpdate(doc),
    onState: (s) => Y.applyUpdate(doc, s, REDIS_ORIGIN),
  });

  return doc;
}

function setupConnection(conn, docName) {
  conn.binaryType = "arraybuffer";
  const doc = getYDoc(docName);
  doc.conns.set(conn, new Set());

  conn.on("message", (message) => messageListener(conn, doc, new Uint8Array(message)));

  let alive = true;
  const interval = setInterval(() => {
    if (!alive) { clearInterval(interval); closeConn(doc, conn); return; }
    alive = false;
    try { conn.ping(); } catch (e) { closeConn(doc, conn); }
  }, PING_TIMEOUT);
  conn.on("pong", () => { alive = true; });
  conn.on("close", () => { clearInterval(interval); closeConn(doc, conn); });

  // Step 1: send our state vector so the client can compute the diff it needs.
  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, doc);
    send(doc, conn, encoding.toUint8Array(encoder));
  }
  const states = doc.awareness.getStates();
  if (states.size > 0) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(states.keys())),
    );
    send(doc, conn, encoding.toUint8Array(encoder));
  }
}

// Heartbeat + prune (only meaningful across instances): re-publish local cursors
// so peers keep them fresh, and drop remote cursors from crashed/gone instances.
if (redisAdapter.redisEnabled) {
  const timer = setInterval(() => {
    const now = Date.now();
    docs.forEach((doc) => {
      const localIds = [];
      doc.conns.forEach((set) => set.forEach((id) => localIds.push(id)));
      if (localIds.length) {
        redisAdapter.publishAwareness(
          doc.name,
          awarenessProtocol.encodeAwarenessUpdate(doc.awareness, localIds),
        );
      }
      const stale = [];
      doc.awareness.meta.forEach((meta, clientId) => {
        if (!localIds.includes(clientId) && now - meta.lastUpdated > AWARENESS_STALE_MS) {
          stale.push(clientId);
        }
      });
      if (stale.length) awarenessProtocol.removeAwarenessStates(doc.awareness, stale, PRUNE_ORIGIN);
    });
  }, 10000);
  timer.unref();
}

function attachCollab(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    let url;
    try { url = new URL(req.url, "http://localhost"); } catch { return; }
    if (!url.pathname.startsWith("/collab/")) return; // leave Socket.IO's upgrades alone

    const token = url.searchParams.get("token");
    const roomId = decodeURIComponent(url.pathname.slice("/collab/".length));
    if (!roomId) { socket.destroy(); return; }

    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      try {
        setupConnection(ws, roomId);
      } catch (e) {
        console.error("[collab] setup failed:", e.message);
        try { ws.close(); } catch (err) { /* noop */ }
      }
    });
  });

  console.log(
    `[collab] Yjs WebSocket server attached at /collab/:roomId` +
      (redisAdapter.redisEnabled ? " (Redis fan-out ON)" : " (single-instance)"),
  );
}

// ── Observability + graceful shutdown ───────────────────────────────────────
function getStats() {
  let connections = 0;
  docs.forEach((d) => { connections += d.conns.size; });
  return { rooms: docs.size, collabConnections: connections };
}

// Flush every in-memory doc to Postgres — call on graceful shutdown for zero data loss.
async function flushAllDocs() {
  const tasks = [];
  docs.forEach((doc, name) => tasks.push(writeState(name, doc).catch(() => {})));
  await Promise.all(tasks);
  return tasks.length;
}

module.exports = { attachCollab, getStats, flushAllDocs };
