const crypto = require("crypto");
const { redisEnabled, makeClient } = require("../lib/redis");

// Unique per-process id so an instance can skip messages it published itself.
const INSTANCE_ID = crypto.randomBytes(8);
const ID_LEN = 8;

const pub = makeClient("pub");
const sub = makeClient("sub");

// room -> { onUpdate, onAwareness, getState, onState }
const rooms = new Map();

const chU = (r) => `y:u:${r}`;
const chA = (r) => `y:a:${r}`;
const chS = (r) => `y:s:${r}`;
const roomOf = (channel) => channel.slice(4); // strip "y:x:"

const SYNC_REQUEST = 0;
const SYNC_STATE = 1;

if (sub) {
  // Binary payloads arrive on the 'messageBuffer' event.
  sub.on("messageBuffer", (channelBuf, msgBuf) => {
    const channel = channelBuf.toString();
    if (msgBuf.length < ID_LEN) return;
    if (msgBuf.subarray(0, ID_LEN).equals(INSTANCE_ID)) return; // ignore our own
    const room = roomOf(channel);
    const h = rooms.get(room);
    if (!h) return;
    const payload = msgBuf.subarray(ID_LEN);

    try {
      if (channel[2] === "u") {
        h.onUpdate(new Uint8Array(payload));
      } else if (channel[2] === "a") {
        h.onAwareness(new Uint8Array(payload));
      } else if (channel[2] === "s") {
        const type = payload[0];
        if (type === SYNC_REQUEST) {
          // A peer just (re)joined this room — reply with our full state.
          const state = h.getState();
          if (state && state.length) {
            pub.publish(
              chS(room),
              Buffer.concat([INSTANCE_ID, Buffer.from([SYNC_STATE]), Buffer.from(state)]),
            );
          }
        } else if (type === SYNC_STATE) {
          h.onState(new Uint8Array(payload.subarray(1)));
        }
      }
    } catch (e) {
      console.error(`[redis-adapter] apply error (${channel}):`, e.message);
    }
  });
}

function subscribeRoom(room, handlers) {
  rooms.set(room, handlers);
  if (!sub || !pub) return;
  Promise.all([sub.subscribe(chU(room)), sub.subscribe(chA(room)), sub.subscribe(chS(room))])
    .then(() => {
      // Ask peers for the current state so a newly-created local doc is up to date.
      pub.publish(chS(room), Buffer.concat([INSTANCE_ID, Buffer.from([SYNC_REQUEST])]));
    })
    .catch((e) => console.error("[redis-adapter] subscribe error:", e.message));
}

function unsubscribeRoom(room) {
  rooms.delete(room);
  if (!sub) return;
  sub.unsubscribe(chU(room), chA(room), chS(room)).catch(() => {});
}

function publishUpdate(room, update) {
  if (pub) pub.publish(chU(room), Buffer.concat([INSTANCE_ID, Buffer.from(update)]));
}

function publishAwareness(room, awarenessUpdate) {
  if (pub) pub.publish(chA(room), Buffer.concat([INSTANCE_ID, Buffer.from(awarenessUpdate)]));
}

async function pingLatencyMs() {
  if (!pub) return null;
  const start = Date.now();
  try {
    await pub.ping();
    return Date.now() - start;
  } catch {
    return null;
  }
}

module.exports = {
  redisEnabled,
  subscribeRoom,
  unsubscribeRoom,
  publishUpdate,
  publishAwareness,
  pingLatencyMs,
  pub,
  sub,
  INSTANCE_ID: INSTANCE_ID.toString("hex"),
};
