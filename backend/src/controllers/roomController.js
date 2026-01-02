const prisma = require("../prismaClient");

const createRoom = async (req, res) => {
  const { roomId } = req.body;
  const userId = req.user.userId;

  if (!roomId || !userId) {
    return res
      .status(400)
      .json({ message: "Room ID and User ID are required" });
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

module.exports = {
  createRoom,
  getRoom,
};
