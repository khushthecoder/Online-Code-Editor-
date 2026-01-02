import { io } from "socket.io-client";

const URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5001`;

export const socket = io(URL, {
  autoConnect: false,
  transports: ["polling", "websocket"], // Critical for Vercel
  withCredentials: true,
});