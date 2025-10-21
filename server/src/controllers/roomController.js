const prisma = require('../prismaClient'); 
const { v4: uuidv4 } = require('uuid');
const createRoom = async (req, res) => {
const userId = req.user.id;
  try {
    const newRoomId = uuidv4();
    const newCode = await prisma.code.create({
      data: {
        room: {
          create: {
            roomId: newRoomId,
            ownerId: userId,
          },
        },
      },
    });
    const room = await prisma.room.findUnique({
       where: { id: newCode.roomId }
    });
    res.status(201).json({ 
      message: 'Room created successfully', 
      roomId: room.roomId
    });
  } catch (error) {
    console.error('Create Room Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
module.exports = { createRoom };