require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const prisma = require('./src/prismaClient');

const authRoutes = require('./src/routes/authRoutes');
const roomRoutes = require('./src/routes/roomRoutes');
const runRoutes = require('./src/routes/runRoutes');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/room', roomRoutes);
app.use('/api/run', runRoutes);

async function getAllConnectedClients(roomId, io) {
  const clients = await io.in(roomId).fetchSockets();
  return clients.map((client) => ({
    socketId: client.id,
    username: client.username,
  }));
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-room', async ({ roomId, username }) => {
    socket.username = username;
    socket.roomId = roomId;
    socket.join(roomId);
    console.log(`User ${socket.id} (${username}) joined room ${roomId}`);

    const clients = await getAllConnectedClients(roomId, io);
    io.in(roomId).emit('update-user-list', clients);
  });

  socket.on('code-change', async ({ language, newCode }) => {
    const roomId = socket.roomId;
    if (!roomId) return;

    socket.to(roomId).emit('code-update', { language, newCode });

    const dataToUpdate = { [language]: newCode };
    try {
      const room = await prisma.room.findUnique({
        where: { roomId },
        select: { code: { select: { id: true } } },
      });

      if (room && room.code) {
        await prisma.code.update({
          where: { id: room.code.id },
          data: dataToUpdate,
        });
      }
    } catch (dbError) {
      console.error('DB Save Error:', dbError);
    }
  });

  socket.on('disconnecting', async () => {
    console.log(`User disconnected: ${socket.id}`);
    const roomId = socket.roomId;
    if (roomId) {
      socket.leave(roomId);
      setTimeout(async () => {
        try {
          const clients = await getAllConnectedClients(roomId, io);
          io.in(roomId).emit('update-user-list', clients);
        } catch (e) {
          console.error('Error broadcasting user list on disconnect', e);
        }
      }, 100);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
