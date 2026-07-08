import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";
import { SOCKET_URL } from "../../config";
import { colorFor } from "./colors";

// Root Y.Text name for a language buffer (must match the backend seed naming).
export const codeTextName = (lang) => `code:${lang}`;

// Owns the Yjs document + WebSocket provider (server sync) + IndexedDB provider
// (offline-first local cache) for a room. Both providers sync the SAME Y.Doc, so
// the CRDT merges cleanly on reconnect — offline edits are never lost.
export function useYProvider({ roomId, token, user }) {
  const [ydoc] = useState(() => new Y.Doc());
  const [awareness, setAwareness] = useState(null);
  const [connected, setConnected] = useState(false);
  const [synced, setSynced] = useState(false);
  const [idbSynced, setIdbSynced] = useState(false); // local cache loaded
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [pending, setPending] = useState(false); // edited while offline, not yet server-synced

  const connectedRef = useRef(false);

  // ── Offline-first: IndexedDB persistence (loads local state on startup, then
  //    persists every update asynchronously — never blocks the UI). ──
  useEffect(() => {
    if (!roomId) return undefined;
    const idb = new IndexeddbPersistence(`compilex:${roomId}`, ydoc);
    const onIdb = () => setIdbSynced(true);
    idb.on("synced", onIdb);
    return () => {
      idb.off("synced", onIdb);
      idb.destroy();
      setIdbSynced(false);
    };
  }, [roomId, ydoc]);

  // ── Browser online/offline signal ──
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // ── Server sync (WebSocket) ──
  useEffect(() => {
    if (!roomId || !token) return undefined;

    const wsBase = SOCKET_URL.replace(/^http/, "ws") + "/collab";
    const provider = new WebsocketProvider(wsBase, roomId, ydoc, { params: { token } });

    provider.awareness.setLocalStateField("user", {
      name: user?.username || "Guest",
      color: colorFor(user?.id || user?.username),
    });

    const onStatus = (e) => {
      const isConn = e.status === "connected";
      connectedRef.current = isConn;
      setConnected(isConn);
      if (!isConn) setSynced(false);
    };
    const onSync = (isSynced) => {
      setSynced(isSynced);
      if (isSynced) setPending(false); // everything is now on the server
    };
    provider.on("status", onStatus);
    provider.on("sync", onSync);
    setAwareness(provider.awareness);

    return () => {
      provider.off("status", onStatus);
      provider.off("sync", onSync);
      provider.awareness.setLocalState(null);
      provider.destroy();
      connectedRef.current = false;
      setAwareness(null);
      setConnected(false);
      setSynced(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, token]);

  // Called by the editor on a local edit. If we're not connected, those changes
  // are queued locally (in IndexedDB) → surface a "pending" indicator.
  const markLocalEdit = useCallback(() => {
    if (!connectedRef.current) setPending(true);
  }, []);

  return { ydoc, awareness, connected, synced, idbSynced, online, pending, markLocalEdit };
}
