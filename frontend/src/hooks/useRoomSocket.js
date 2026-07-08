import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { socket } from "../socket";

// Socket.IO room channel — presence ONLY (the live user list for a room).
// Collaborative code editing, chat, and per-file language are all handled by Yjs
// (see features/collab), not here.
export function useRoomSocket({ roomId, user }) {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    if (!user || !roomId) return;

    const handleConnect = () => socket.emit("join-room", { roomId });
    const handleConnectError = () => toast.error("Connection failed. Retrying...");
    const handleUserList = (list) => setClients(list);

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on("update-user-list", handleUserList);

    if (!socket.connected) socket.connect();
    else handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off("update-user-list", handleUserList);
      socket.disconnect();
    };
    // Depend on the STABLE user id, not the user object — AuthContext sets `user`
    // twice at startup (optimistic JWT, then /me) with the same id, and depending
    // on the object identity would spuriously drop & reconnect the socket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id]);

  return { clients };
}
