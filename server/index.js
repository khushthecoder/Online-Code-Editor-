// server/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const passport = require("passport"); // <-- 1. YEH ADD HUA HAI
require("./src/config/passport-setup"); // <-- 2. YEH ADD HUA HAI (Passport config ko run karne ke liye)
const prisma = require("./src/prismaClient");

const authRoutes = require("./src/routes/authRoutes");
const roomRoutes = require("./src/routes/roomRoutes");
const runRoutes = require("./src/routes/runRoutes");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // React App
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 5001;

const corsOptions = {
  origin: "http://localhost:5173", // React App ka address
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// --- YEH SECTION ADD HUA HAI ---
// Passport ko initialize karo (Session ki zaroorat nahi, hum JWT use karenge)
app.use(passport.initialize());
// ------------------------------

// Logger
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    console.log(`[API] ${req.method} ${req.path}`);
  }
  next();
});

// Health check for CORS + connectivity from the client
app.get("/api/ping", (req, res) => {
  res.status(200).json({ message: "pong" });
});

// API Routes
app.use("/api/auth", authRoutes); // Auth routes (Google waale bhi) yahaan hain
app.use("/api/room", roomRoutes);
app.use("/api/run", runRoutes);

// --- Socket.io Logic (Same as before) ---
// (Aapka socket.io code yahaan poora hai, no changes needed)
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
// --- End of Socket.io Logic ---

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
