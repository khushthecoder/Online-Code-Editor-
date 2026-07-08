import { useEffect, useRef, useState, useCallback } from "react";

const IDLE_MS = 45000;   // no activity for this long → idle
const ACTIVE_MS = 8000;  // active within this window → "currently editing"
const PUBLISH_MS = 1500; // throttle awareness stat updates
const TIMELINE_MAX = 25;

// Lightweight collaboration analytics riding on the Awareness protocol (already
// distributed across instances via Redis in P2). Each client publishes its own
// stats; the dashboard aggregates everyone. No server load, works offline.
//
// The hook is split into two halves so the frequent aggregation re-renders never
// touch the editor's tree:
//   • usePresenceRecorder — WRITE side. Ref-based, holds no React state, so
//     calling record() never re-renders the caller. Lives in EditorPage (the
//     editor calls it on every local edit / cursor move).
//   • usePresenceAnalytics — READ side. Holds the analytics + timeline state and
//     recomputes on every awareness change + a 3s tick, so it must live INSIDE the
//     AnalyticsPanel component to keep those re-renders out of EditorPage.

// ── WRITE side ───────────────────────────────────────────────────────────────
export function usePresenceRecorder({ awareness, activeName }) {
  const local = useRef({
    joinedAt: Date.now(), edits: 0, cursorMoves: 0,
    editsByFile: {}, filesOpened: new Set(), filesEdited: new Set(),
    lastActivity: Date.now(),
  });
  const activeNameRef = useRef(activeName);
  const pubTimer = useRef(null);

  const publishNow = useCallback(() => {
    if (!awareness) return;
    const l = local.current;
    awareness.setLocalStateField("stats", {
      joinedAt: l.joinedAt,
      edits: l.edits,
      cursorMoves: l.cursorMoves,
      editsByFile: l.editsByFile,
      filesOpened: l.filesOpened.size,
      filesEdited: l.filesEdited.size,
      activeFile: activeNameRef.current || null,
      lastActivity: l.lastActivity,
      idle: Date.now() - l.lastActivity > IDLE_MS,
    });
  }, [awareness]);

  const schedulePublish = useCallback(() => {
    if (pubTimer.current) return;
    pubTimer.current = setTimeout(() => { pubTimer.current = null; publishNow(); }, PUBLISH_MS);
  }, [publishNow]);

  // Called by the editor on local edit / cursor move.
  const record = useCallback(({ docChanged, cursorMoved }) => {
    const l = local.current;
    l.lastActivity = Date.now();
    const f = activeNameRef.current;
    if (docChanged) {
      l.edits += 1;
      if (f) { l.editsByFile[f] = (l.editsByFile[f] || 0) + 1; l.filesEdited.add(f); }
    }
    if (cursorMoved) l.cursorMoves += 1;
    schedulePublish();
  }, [schedulePublish]);

  // Track opened files + publish on file switch.
  useEffect(() => {
    activeNameRef.current = activeName;
    if (activeName) local.current.filesOpened.add(activeName);
    schedulePublish();
  }, [activeName, schedulePublish]);

  // Heartbeat: refresh idle/session even without edits.
  useEffect(() => {
    const iv = setInterval(schedulePublish, 5000);
    return () => clearInterval(iv);
  }, [schedulePublish]);

  return record;
}

// ── READ side ────────────────────────────────────────────────────────────────
export function usePresenceAnalytics({ awareness }) {
  const [analytics, setAnalytics] = useState({
    users: [], onlineCount: 0, idleCount: 0, activeEditors: [],
    totalEdits: 0, mostActiveFile: null, recentFiles: [],
  });
  const [timeline, setTimeline] = useState([]);

  const pushTimeline = useCallback((event) => {
    setTimeline((prev) => [{ id: `${event.ts}-${prev.length}-${event.type}`, ...event }, ...prev].slice(0, TIMELINE_MAX));
  }, []);

  // Aggregate everyone's stats from Awareness.
  useEffect(() => {
    if (!awareness) return undefined;
    const prev = new Map(); // clientId -> { name, activeFile }

    const compute = () => {
      const states = awareness.getStates();
      const now = Date.now();
      const users = [];
      const fileEdits = {};
      let totalEdits = 0;

      states.forEach((s, clientId) => {
        const st = s.stats || {};
        const name = s.user?.name || "Guest";
        const color = s.user?.color || "#8888a0";
        const sessionSec = st.joinedAt ? Math.floor((now - st.joinedAt) / 1000) : 0;
        const idle = st.idle || (st.lastActivity ? now - st.lastActivity > IDLE_MS : false);
        const active = st.lastActivity ? now - st.lastActivity < ACTIVE_MS : false;
        users.push({ clientId, name, color, edits: st.edits || 0, cursorMoves: st.cursorMoves || 0, activeFile: st.activeFile || null, idle, active, sessionSec });
        totalEdits += st.edits || 0;
        Object.entries(st.editsByFile || {}).forEach(([f, c]) => { fileEdits[f] = (fileEdits[f] || 0) + c; });

        // timeline: joins + file switches
        const p = prev.get(clientId);
        if (!p) pushTimeline({ type: "join", name, ts: now });
        else if (p.activeFile !== (st.activeFile || null) && st.activeFile) pushTimeline({ type: "open", name, file: st.activeFile, ts: now });
        prev.set(clientId, { name, activeFile: st.activeFile || null });
      });

      // leaves
      Array.from(prev.keys()).forEach((clientId) => {
        if (!states.has(clientId)) { pushTimeline({ type: "leave", name: prev.get(clientId).name, ts: now }); prev.delete(clientId); }
      });

      const sortedFiles = Object.entries(fileEdits).sort((a, b) => b[1] - a[1]);
      setAnalytics({
        users,
        onlineCount: users.length,
        idleCount: users.filter((u) => u.idle).length,
        activeEditors: users.filter((u) => u.active && !u.idle),
        totalEdits,
        mostActiveFile: sortedFiles[0]?.[0] || null,
        recentFiles: sortedFiles.slice(0, 5).map(([file, edits]) => ({ file, edits })),
      });
    };

    compute();
    awareness.on("change", compute);
    const iv = setInterval(compute, 3000); // keep session/idle fresh
    return () => { awareness.off("change", compute); clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awareness]);

  return { analytics, timeline };
}
