const { Server } = require('socket.io');
const prisma = require('./src/prismaClient');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');

const authRoutes = require('./src/routes/authRoutes');
const roomRoutes = require('./src/routes/roomRoutes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
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
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
    socket.on('code-change', async (newCode) => { 
      socket.to(roomId).emit('code-update', newCode);
      try {
        await prisma.room.update({
          where: {
            roomId: roomId, 
          },
          data: {
            code: {
              update: {
                javascript: newCode, 
              },
            },
          },
        });
      } catch (error) {
        console.error('Failed to save code:', error);
      }
    });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});