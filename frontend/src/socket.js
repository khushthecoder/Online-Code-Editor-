import { io } from "socket.io-client";

// In production, we connect to the same origin (Vercel routes /socket.io/ to backend)
// In local, we connect to 5001.
const URL = import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.PROD
    ? window.location.origin
    : `http://${window.location.hostname}:5001`);

export const socket = io(URL, {
  autoConnect: false,
  transports: ["polling", "websocket"], // Use polling first for Vercel stability
  withCredentials: true,
});