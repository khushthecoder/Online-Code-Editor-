const { Server } = require("socket.io");
const { io: Client } = require("socket.io-client");
const http = require("http");

const httpServer = http.createServer();
const io = new Server(httpServer);

io.on("connection", (socket) => {
    socket.on("join-room", async ({ roomId, username }) => {
        socket.username = username; 
        socket.data.username = username; 
        socket.join(roomId);

        const clients = await io.in(roomId).fetchSockets();
        const mappedClients = clients.map(c => ({
            id: c.id,
            usernameProp: c.username, 
            dataUsername: c.data.username 
        }));

        io.in(roomId).emit("user-list", mappedClients);
    });
});

httpServer.listen(5002, () => {
    console.log("Test server running on 5002");


    const client1 = Client("http://localhost:5002");
    client1.on("connect", () => {
        console.log("Client 1 connected");
        client1.emit("join-room", { roomId: "room123", username: "UserA" });
    });

    client1.on("user-list", (users) => {
        console.log("Client 1 received users:", users);
    });


    setTimeout(() => {
        const client2 = Client("http://localhost:5002");
        client2.on("connect", () => {
            console.log("Client 2 connected");
            client2.emit("join-room", { roomId: "room123", username: "UserB" });
        });

        client2.on("user-list", (users) => {
            console.log("Client 2 received users:", users);

            setTimeout(() => {
                client1.close();
                client2.close();
                httpServer.close();
                process.exit(0);
            }, 500);
        });
    }, 500);
});
