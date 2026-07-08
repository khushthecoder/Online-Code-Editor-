// Cross-instance Redis fan-out test. Uses ioredis-mock (in-process pub/sub shared
// across all clients) so the REAL redisAdapter.js code (instance A) interoperates
// with a hand-rolled peer (instance B) over the same bus — proving the wire
// protocol, self-echo skip, state handshake, and CRDT convergence WITHOUT needing
// a Redis server / Docker.
jest.mock("ioredis", () => require("ioredis-mock"));
process.env.REDIS_URL = "redis://localhost:6379";

const Y = require("yjs");
const IORedisMock = require("ioredis-mock");
const crypto = require("crypto");
const adapter = require("../redisAdapter"); // instance A (real code)

const ID_LEN = 8;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A minimal "instance B" peer sharing the same mock bus.
function makePeer(room, docB) {
  const id = crypto.randomBytes(ID_LEN);
  const pub = new IORedisMock("redis://localhost:6379");
  const sub = new IORedisMock("redis://localhost:6379");
  sub.subscribe(`y:u:${room}`, `y:a:${room}`, `y:s:${room}`);
  sub.on("messageBuffer", (chBuf, msg) => {
    const channel = chBuf.toString();
    if (msg.subarray(0, ID_LEN).equals(id)) return; // skip our own
    const payload = msg.subarray(ID_LEN);
    if (channel[2] === "u") {
      Y.applyUpdate(docB, new Uint8Array(payload), "redis");
    } else if (channel[2] === "s") {
      if (payload[0] === 1) Y.applyUpdate(docB, new Uint8Array(payload.subarray(1)), "redis");
      // (peer B doesn't answer state requests in this test)
    }
  });
  const publishUpdate = (u) => pub.publish(`y:u:${room}`, Buffer.concat([id, Buffer.from(u)]));
  docB.on("update", (u, origin) => { if (origin !== "redis") publishUpdate(u); });
  return { id, pub };
}

describe("redisAdapter — cross-instance fan-out (real adapter code)", () => {
  test("A↔B: updates propagate both directions and converge", async () => {
    const room = "conv";
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    // Instance A = real adapter wired to docA.
    adapter.subscribeRoom(room, {
      onUpdate: (u) => Y.applyUpdate(docA, u, "redis"),
      onAwareness: () => {},
      getState: () => Y.encodeStateAsUpdate(docA),
      onState: (s) => Y.applyUpdate(docA, s, "redis"),
    });
    docA.on("update", (u, origin) => { if (origin !== "redis") adapter.publishUpdate(room, u); });

    makePeer(room, docB);
    await wait(60);

    // A types → B receives
    docA.getText("code:python").insert(0, 'print("from A")\n');
    await wait(80);
    expect(docB.getText("code:python").toString()).toContain("from A");

    // B types → A receives
    docB.getText("code:python").insert(docB.getText("code:python").length, "# from B\n");
    await wait(80);
    expect(docA.getText("code:python").toString()).toContain("from B");
    expect(docA.getText("code:python").toString()).toBe(docB.getText("code:python").toString());
  });

  test("no self-echo: adapter ignores messages tagged with its own instance id", async () => {
    const room = "echo";
    let got = 0;
    adapter.subscribeRoom(room, {
      onUpdate: () => { got += 1; },
      onAwareness: () => {},
      getState: () => new Uint8Array(),
      onState: () => {},
    });
    await wait(40);
    adapter.publishUpdate(room, new Uint8Array([9, 9, 9])); // tagged with adapter's own id
    await wait(80);
    expect(got).toBe(0);
  });

  test("state handshake: adapter answers a peer's state request with full state", async () => {
    const room = "handshake";
    const docA = new Y.Doc();
    docA.getText("code:python").insert(0, "seeded_on_A = 1\n");

    adapter.subscribeRoom(room, {
      onUpdate: (u) => Y.applyUpdate(docA, u, "redis"),
      onAwareness: () => {},
      getState: () => Y.encodeStateAsUpdate(docA),
      onState: (s) => Y.applyUpdate(docA, s, "redis"),
    });
    await wait(40);

    // Peer B joins with an empty doc and requests state.
    const docB = new Y.Doc();
    const peerId = crypto.randomBytes(ID_LEN);
    const pub = new IORedisMock("redis://localhost:6379");
    const sub = new IORedisMock("redis://localhost:6379");
    sub.subscribe(`y:s:${room}`);
    sub.on("messageBuffer", (chBuf, msg) => {
      if (msg.subarray(0, ID_LEN).equals(peerId)) return;
      const payload = msg.subarray(ID_LEN);
      if (payload[0] === 1) Y.applyUpdate(docB, new Uint8Array(payload.subarray(1)), "redis");
    });
    await wait(30);
    pub.publish(`y:s:${room}`, Buffer.concat([peerId, Buffer.from([0])])); // REQUEST
    await wait(120);

    expect(docB.getText("code:python").toString()).toContain("seeded_on_A");
  });
});
