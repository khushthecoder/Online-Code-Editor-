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
const aiRoutes = require("./src/routes/aiRoutes");

const app = express();
const server = http.createServer(app);

const IS_PROD = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5001;

const allowedOrigins = [
  'http://localhost:5173',
  'https://online-code-editor-orpin.vercel.app',
  process.env.VITE_CLIENT_URL
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.includes(origin) ||
      /^http:\/\/localhost:\d+$/.test(origin) ||
      /\.vercel\.app$/.test(origin);

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  credentials: true,
  optionsSuccessStatus: 204
};

// 1. Unified CORS middleware
app.use(cors(corsOptions));

// 2. Body parsing and other middleware

app.use(express.json());
app.use(passport.initialize());

const io = new Server(server, {
  cors: corsOptions, // Use the exact same CORS options as Express
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
app.use("/api/ai", aiRoutes);

async function getAllConnectedClients(roomId, io) {
  const clients = await io.in(roomId).fetchSockets();
  return clients.map((client) => ({
    socketId: client.id,
    username: client.data.username || "Guest",
  }));
}
const roomLanguages = {};
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  socket.on("join-room", async ({ roomId, username }) => {
    socket.data.username = username;
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
    const username = socket.data.username;
    if (!roomId) {
      console.warn(`[Socket Warning] User ${socket.id} tried to send message without roomId.`);
      return;
    }
    if (!username) {
      console.warn(`[Socket Warning] User ${socket.id} tried to send message without username.`);
      return;
    }

    const istTime = new Date().toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    console.log(`[Message] ${username} in Room ${roomId}: ${message}`);
    io.in(roomId).emit("new-message", {
      username: username,
      text: message,
      time: istTime,
    });
  });

  socket.on("language-change", ({ language }) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    roomLanguages[roomId] = language;
    socket.to(roomId).emit("language-update", language);
  });

  socket.on("disconnecting", async () => {
    const rooms = [...socket.rooms];
    console.log(`User disconnecting: ${socket.id}, Rooms: ${rooms}`);

    rooms.forEach((roomId) => {
      if (roomId === socket.id) return;

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
    });
  });
});

app.use((err, req, res, next) => {
  console.error("🔥 Global Error Caught:", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ message: "Internal Server Error", error: err.message });
});

const startServer = (port) => {
  const handleListenError = (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is in use, trying ${port + 1}...`);
      server.close();
      startServer(port + 1);
    } else {
      console.error(err);
    }
  };

  server.once('error', handleListenError);

  server.listen(port, () => {
    server.removeListener('error', handleListenError);
    console.log(`Server listening on http://localhost:${port}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Database URL: ${process.env.DATABASE_URL ? "Set" : "Missing"}`);
    console.log(`Client URL: ${process.env.VITE_CLIENT_URL || "Default"}`);
  });
};

if (require.main === module) {
  startServer(PORT);
}

// Export server for production Socket.io support on Vercel
module.exports = server;