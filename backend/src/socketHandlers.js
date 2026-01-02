const initSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);
    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      console.log(`User ${socket.id} joined room ${roomId}`);
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
};

module.exports = initSocket;
