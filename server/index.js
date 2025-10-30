require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const passport = require("passport"); 
const path = require('path'); 
require("./src/config/passport-setup"); 
const prisma = require("./src/prismaClient");

const authRoutes = require("./src/routes/authRoutes");
const roomRoutes = require("./src/routes/roomRoutes");
const runRoutes = require("./src/routes/runRoutes");

const app = express();
const server = http.createServer(app);

const IS_PROD = process.env.NODE_ENV === 'production';
const CLIENT_URL = IS_PROD ? process.env.VITE_CLIENT_URL : 'http://localhost:5173';
const PORT = process.env.PORT || 5001;

const corsOptions = {
  origin: CLIENT_URL,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(passport.initialize());

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    console.log(`[API] ${req.method} ${req.path}`);
  }
  next();
});
app.get("/api/ping", (req, res) => {
  res.status(200).json({ message: "pong" });
});
app.use("/api/auth", authRoutes); 
app.use("/api/room", roomRoutes);
app.use("/api/run", runRoutes);
if (IS_PROD) {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/dist', 'index.html'));
  });
}
async function getAllConnectedClients(roomId, io) {
  const clients = await io.in(roomId).fetchSockets();
  return clients.map((client) => ({
    socketId: client.id,
    username: client.username,
  }));
}
const roomLanguages = {};
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  socket.on("join-room", async ({ roomId, username }) => {
    socket.username = username;
    socket.roomId = roomId;
    socket.join(roomId);
    console.log(`User ${socket.id} (${username}) joined room ${roomId}`);
    const clients = await getAllConnectedClients(roomId, io);
    io.in(roomId).emit("update-user-list", clients);
    if (roomLanguages[roomId]) {
      socket.emit("language-update", roomLanguages[roomId]);
    }
  });
  socket.on("code-change", async ({ language, newCode }) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    socket.to(roomId).emit("code-update", { language, newCode });
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
      console.error("DB Save Error:", dbError);
    }
  });
  socket.on("send-message", ({ message }) => {
    const roomId = socket.roomId;
    const username = socket.username;
    if (!roomId || !username) return;
    io.in(roomId).emit("new-message", {
      username: username,
      text: message,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  });
  socket.on("language-change", ({ language }) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    roomLanguages[roomId] = language;
    socket.to(roomId).emit("language-update", language);
  });
  socket.on("disconnecting", async () => {
    console.log(`User disconnected: ${socket.id}`);
    const roomId = socket.roomId;
    if (roomId) {
      socket.leave(roomId);
      setTimeout(async () => {
        try {
          const clients = await getAllConnectedClients(roomId, io);
          io.in(roomId).emit("update-user-list", clients);
          if (clients.length === 0) {
            delete roomLanguages[roomId];
          }
        } catch (e) {
          console.error("Error on disconnect broadcast", e);
        }
      }, 100);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});