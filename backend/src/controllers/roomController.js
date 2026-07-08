const prisma = require("../prismaClient");

// A room ID is a capability: anyone who has it can join. So a CREATED id must be
// long, random, and unguessable (the client sends a uuid v4). Enforce that shape
// server-side to reject weak/guessable or oversized ids — without affecting how
// existing rooms are joined (join by pasting an id is not format-restricted).
const ROOM_ID_RE = /^[A-Za-z0-9_-]{20,128}$/;

const createRoom = async (req, res) => {
  const { roomId } = req.body;
  const userId = req.user.userId;

  if (!roomId || !userId) {
    return res
      .status(400)
      .json({ message: "Room ID and User ID are required" });
  }

  if (!ROOM_ID_RE.test(roomId)) {
    return res.status(400).json({ message: "Invalid room ID." });
  }

  try {
    const existingRoom = await prisma.room.findUnique({
      where: { roomId },
    });
    if (existingRoom) {
      console.warn(`Room ${roomId} already exists.`);
      return res
        .status(200)
        .json({
          message: "Room already exists, joining allowed.",
          room: existingRoom,
        });
    }

    const newRoom = await prisma.room.create({
      data: {
        roomId: roomId,
        ownerId: userId,
        code: {
          create: {
            html: `\n<h1>Welcome!</h1>`,
            css: `body {\n  font-family: sans-serif;\n}`,
            javascript: `console.log('Hello from room ${roomId}');`,
          },
        },
      },
      include: {
        code: true,
      },
    });

    console.log(`Room created successfully: ${roomId} by user ${userId}`);
    res
      .status(201)
      .json({
        message: "Room created successfully",
        roomId: newRoom.roomId,
        room: newRoom,
      });
  } catch (error) {
    console.error(`[createRoom] Failed to create room ${roomId}:`, error);
    res.status(500).json({ message: "Server error creating room" });
  }
};

const getRoom = async (req, res) => {
  const { roomId } = req.params;
  try {
    const room = await prisma.room.findUnique({
      where: { roomId },
      include: {
        code: true,
      },
    });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }
    res.json(room);
  } catch (error) {
    console.error(`[getRoom] Failed to fetch room ${roomId}:`, error);
    res.status(500).json({ message: "Server error fetching room" });
  }
};

// ── Version history ──────────────────────────────────────────────────────────
// Save the client's current CRDT state as a named checkpoint (base64-encoded).
const createSnapshot = async (req, res) => {
  const { roomId } = req.params;
  const { label, state } = req.body;
  if (!state || typeof state !== "string") {
    return res.status(400).json({ message: "Snapshot state is required" });
  }
  try {
    const buf = Buffer.from(state, "base64");
    if (buf.length === 0) return res.status(400).json({ message: "Empty snapshot" });
    const snap = await prisma.snapshot.create({
      data: {
        roomId,
        label: (label || "").toString().slice(0, 100) || null,
        author: req.user?.username || null,
        state: buf,
      },
      select: { id: true, label: true, author: true, createdAt: true },
    });
    res.status(201).json(snap);
  } catch (error) {
    console.error("[createSnapshot]", error.message);
    res.status(500).json({ message: "Failed to save version" });
  }
};

// Metadata list (newest first) — never returns the heavy state blob.
const listSnapshots = async (req, res) => {
  const { roomId } = req.params;
  try {
    const snaps = await prisma.snapshot.findMany({
      where: { roomId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, label: true, author: true, createdAt: true },
    });
    res.json(snaps);
  } catch (error) {
    console.error("[listSnapshots]", error.message);
    res.status(500).json({ message: "Failed to list versions" });
  }
};

// Full state of one snapshot (base64) — used to restore/preview a version.
const getSnapshot = async (req, res) => {
  const { roomId, snapshotId } = req.params;
  try {
    const snap = await prisma.snapshot.findFirst({
      where: { id: snapshotId, roomId },
      select: { id: true, state: true },
    });
    if (!snap) return res.status(404).json({ message: "Version not found" });
    res.json({ id: snap.id, state: Buffer.from(snap.state).toString("base64") });
  } catch (error) {
    console.error("[getSnapshot]", error.message);
    res.status(500).json({ message: "Failed to load version" });
  }
};

module.exports = {
  createRoom,
  getRoom,
  createSnapshot,
  listSnapshots,
  getSnapshot,
};
