import { io } from "socket.io-client";
import { SOCKET_URL } from "./config";

// The server authenticates the handshake via a JWT (io.use middleware), so the
// token must be attached before connecting. Call setSocketAuth(token) first.
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  withCredentials: true,
});

export const setSocketAuth = (token) => {
  socket.auth = { token };
};
