import { useState, useCallback, useEffect } from "react";
import * as Y from "yjs";
import api from "../../services/api";
import { getTreeMap, getFilesMap } from "./project";

// ── base64 <-> Uint8Array (browser, no Buffer) ──────────────────────────────
function u8ToBase64(u8) {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK));
  }
  return btoa(s);
}
function base64ToU8(b64) {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

// Revert the live project (files + tree) to match a snapshot's state. Runs as one
// CRDT transaction, so the change propagates to every collaborator and persists.
// Chat is intentionally left untouched (it's a running log, not versioned content).
function revertTo(ydoc, snapshotBytes) {
  const tmp = new Y.Doc();
  Y.applyUpdate(tmp, snapshotBytes);
  const snapTree = tmp.getMap("tree");
  const snapFiles = tmp.getMap("files");
  const liveTree = getTreeMap(ydoc);
  const liveFiles = getFilesMap(ydoc);

  ydoc.transact(() => {
    // Tree: drop nodes not in the snapshot, then set snapshot nodes.
    const keep = new Set(Array.from(snapTree.keys()));
    Array.from(liveTree.keys()).forEach((id) => { if (!keep.has(id)) liveTree.delete(id); });
    snapTree.forEach((node, id) => liveTree.set(id, node));

    // Files: drop files not in the snapshot, then overwrite content to match.
    Array.from(liveFiles.keys()).forEach((id) => { if (!snapFiles.has(id)) liveFiles.delete(id); });
    snapFiles.forEach((snapText, id) => {
      let liveText = liveFiles.get(id);
      if (!liveText) { liveText = new Y.Text(); liveFiles.set(id, liveText); }
      if (liveText.length) liveText.delete(0, liveText.length);
      const content = snapText.toString();
      if (content) liveText.insert(0, content);
    });
  });
}

export function useSnapshots({ ydoc, roomId }) {
  const [snapshots, setSnapshots] = useState([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/room/${roomId}/snapshots`);
      setSnapshots(data);
    } catch (e) { /* ignore transient errors */ }
  }, [roomId]);

  useEffect(() => { refresh(); }, [refresh]);

  const saveVersion = useCallback(async (label) => {
    setBusy(true);
    try {
      const state = u8ToBase64(Y.encodeStateAsUpdate(ydoc));
      const { data } = await api.post(`/api/room/${roomId}/snapshots`, { label, state });
      await refresh();
      return data;
    } finally {
      setBusy(false);
    }
  }, [ydoc, roomId, refresh]);

  const restore = useCallback(async (snapshotId) => {
    setBusy(true);
    try {
      const { data } = await api.get(`/api/room/${roomId}/snapshots/${snapshotId}`);
      revertTo(ydoc, base64ToU8(data.state));
    } finally {
      setBusy(false);
    }
  }, [ydoc, roomId]);

  return { snapshots, busy, refresh, saveVersion, restore };
}
