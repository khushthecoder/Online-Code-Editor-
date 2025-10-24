// server/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const prisma = require('./src/prismaClient');

// Routes
const authRoutes = require('./src/routes/authRoutes');
const roomRoutes = require('./src/routes/roomRoutes');
const runRoutes = require('./src/routes/runRoutes'); // Run route

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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/room', roomRoutes);
app.use('/api/run', runRoutes); // Run route use karein

// Helper function
async function getAllConnectedClients(roomId, io) {
  const clients = await io.in(roomId).fetchSockets();
  return clients.map((client) => {
    return {
      socketId: client.id,
      username: client.username,
    };
  });
}

// === FINAL SOCKET LOGIC (Chat + User List Fix) ===
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // 1. JOIN ROOM
  socket.on('join-room', async ({ roomId, username }) => {
    socket.username = username;
    socket.roomId = roomId; // Save details to socket
    
    socket.join(roomId);
    console.log(`User ${socket.id} (${username}) joined room ${roomId}`);

    // Broadcast updated user list
    const clients = await getAllConnectedClients(roomId, io);
    io.in(roomId).emit('update-user-list', clients);
  });

  // 2. CODE CHANGE
  socket.on('code-change', async ({ language, newCode }) => {
    const roomId = socket.roomId;
    if (!roomId) return;

    // Broadcast to others
    socket.to(roomId).emit('code-update', { language, newCode });

    // Save to DB
    const dataToUpdate = { [language]: newCode };
    try {
      const room = await prisma.room.findUnique({
        where: { roomId: roomId },
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

  // 3. CHAT MESSAGE (Yeh missing tha)
  socket.on('send-message', ({ message }) => {
    const roomId = socket.roomId;
    const username = socket.username;
    if (!roomId || !username) return;

    // Broadcast to everyone (including sender)
    io.in(roomId).emit('new-message', {
      username: username,
      text: message,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  });

  // 4. DISCONNECTING
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
          console.error('Error on disconnect broadcast', e);
        }
      }, 100);
    }
  });
});
// ===================================

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});