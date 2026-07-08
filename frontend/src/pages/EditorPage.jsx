import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import Editor from "../components/Editor";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import AIPromptBar from "../components/AIPromptBar";
import { toast } from "react-hot-toast";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { useYProvider } from "../features/collab/useYProvider";
import { useProject } from "../features/collab/useProject";
import { cmLanguageFor, runLanguageFor, pathOf } from "../features/collab/project";
import FileTree from "../components/FileTree";
import HistoryPanel from "../components/HistoryPanel";
import AnalyticsPanel from "../components/AnalyticsPanel";
import { useSnapshots } from "../features/collab/useSnapshots";
import { usePresenceRecorder } from "../features/collab/usePresenceAnalytics";
import { useVoice } from "../features/voice/useVoice";
import { undoManagerFor } from "../features/collab/undo";
import "../styles/editor.css";

// Small crisp icons for the voice-state badge (stroke = currentColor, colored per status).
const MicIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><line x1="12" y1="18" x2="12" y2="22" />
  </svg>
);
const MicOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="3" x2="21" y2="21" /><path d="M9 9v3a3 3 0 0 0 5 2.1M15 11V5a3 3 0 0 0-5.6-1.5" /><path d="M5 11a7 7 0 0 0 10.7 6" /><line x1="12" y1="18" x2="12" y2="22" />
  </svg>
);
const SpinnerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);

const VOICE_LABEL = { speaking: "speaking", on: "mic on", muted: "muted", connecting: "connecting…" };

const ClientAvatar = ({ username, status }) => {
  const safe = username || "Guest";
  const inVoice = Boolean(status);
  const cls = `ed-avatar${inVoice ? " in-voice" : ""}${status === "speaking" ? " speaking" : ""}`;
  const badge =
    status === "muted" ? <MicOffIcon />
      : status === "connecting" ? <SpinnerIcon />
        : status ? <MicIcon /> : null; // speaking | on
  return (
    <div className={cls} title={inVoice ? `${safe} · ${VOICE_LABEL[status]}` : safe}>
      <div className="ring">
        {safe[0].toUpperCase()}
        {inVoice && <span className={`voice-badge ${status}`} aria-label={VOICE_LABEL[status]}>{badge}</span>}
      </div>
      <span className="who">{safe.split(" ")[0]}</span>
    </div>
  );
};

// Detect the enclosing function/block around the cursor for AI replace operations.
const detectFunctionRange = (view) => {
  const state = view.state;
  const cursor = state.selection.main.head;
  const doc = state.doc;
  const currentLine = doc.lineAt(cursor);

  let startLine = currentLine.number;
  let startIndent = null;
  let foundStart = false;

  const defRegex = /^\s*(async\s+)?(function|def|class|const\s+\w+\s*=\s*(\(.*\)|async\s*\(.*\))\s*=>|const\s+\w+\s*=\s*(\(.*\)|async\s*\(.*\))\s*{)/;

  for (let i = startLine; i >= 1; i--) {
    const lineText = doc.line(i).text;
    if (defRegex.test(lineText)) {
      startLine = i;
      const match = lineText.match(/^\s*/);
      startIndent = match ? match[0].length : 0;
      foundStart = true;
      break;
    }
  }

  if (!foundStart) return null;

  let endLine = startLine;
  const lineCount = doc.lines;

  for (let i = startLine + 1; i <= lineCount; i++) {
    const lineText = doc.line(i).text;
    if (lineText.trim() === '') continue;
    const match = lineText.match(/^\s*/);
    const currentIndent = match ? match[0].length : 0;
    if (currentIndent <= startIndent) {
      if (currentIndent === startIndent && lineText.trim().startsWith('}')) {
        endLine = i;
      } else {
        endLine = i - 1;
      }
      break;
    }
    endLine = i;
  }
  return { from: doc.line(startLine).from, to: doc.line(endLine).to };
};

const EditorPage = () => {
  const { roomId } = useParams();
  const { user, token } = useAuth();

  const [activeId, setActiveId] = useState(null);
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [editorView, setEditorView] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [aiHistory, setAiHistory] = useState([]);
  const [isCopied, setIsCopied] = useState(false);
  const [lastError, setLastError] = useState("");

  const messagesEndRef = useRef(null);
  const historyEndRef = useRef(null);

  // Presence (Socket.IO). Language is now per-file, not a shared dropdown.
  const { clients } = useRoomSocket({ roomId, user });

  // Real-time voice (WebRTC mesh) — rides the same JWT-authed socket. Speaking /
  // participant state is keyed by socketId, matching the presence `clients` above.
  const voice = useVoice({ roomId });

  // Collaborative editing (Yjs CRDT) + the shared multi-file project.
  // idbSynced/online/pending drive the offline-first sync status; markLocalEdit
  // flags edits made while disconnected.
  const { ydoc, awareness, connected, synced, idbSynced, online, pending, markLocalEdit } =
    useYProvider({ roomId, token, user });
  const project = useProject(ydoc);
  const { tree, nodes, treeMap, filesMap } = project;

  // Resolve the active file: keep the user's last file (persisted per room), and
  // fall back to the first file if it was deleted or none is selected yet.
  const activeStorageKey = `active-file:${roomId}`;
  useEffect(() => {
    const valid = activeId && nodes.some((n) => n.id === activeId && n.type === "file");
    if (valid) return;
    const stored = localStorage.getItem(activeStorageKey);
    const storedOk = stored && nodes.some((n) => n.id === stored && n.type === "file");
    const firstFile = nodes.find((n) => n.type === "file");
    const next = storedOk ? stored : firstFile ? firstFile.id : null;
    if (next !== activeId) setActiveId(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, activeId]);

  const openFile = useCallback((id) => {
    setActiveId(id);
    try { localStorage.setItem(`active-file:${roomId}`, id); } catch (e) { /* ignore */ }
  }, [roomId]);

  const activeNode = activeId ? treeMap.get(activeId) : null;
  const activeName = activeNode?.name || "";
  // Ready when the doc is loaded from EITHER the server (synced) or the local
  // IndexedDB cache (idbSynced) — so editing works offline.
  const docReady = synced || idbSynced;
  const yText = activeId && docReady ? filesMap.get(activeId) || null : null;
  const language = activeNode ? cmLanguageFor(activeName) : "javascript";
  const runLang = activeNode ? runLanguageFor(activeName) : null;
  const activePath = activeId ? pathOf(treeMap, activeId) : "";

  // ── Version history (snapshots) ──
  const { snapshots, busy: snapBusy, saveVersion, restore } = useSnapshots({ ydoc, roomId });
  // ── Presence analytics (rides on the Awareness protocol) ──
  // Only the WRITE side lives here (ref-based, no re-renders). The dashboard's
  // aggregation state lives inside AnalyticsPanel so its frequent updates don't
  // re-render the whole editor.
  const record = usePresenceRecorder({ awareness, activeName });
  const handleActivity = useCallback((a) => {
    record(a);
    if (a.docChanged) markLocalEdit(); // offline "pending" flag
  }, [record, markLocalEdit]);

  // Right-side panels are mutually exclusive.
  const openHistory = useCallback(() => { setIsHistoryOpen(true); setIsAIPanelOpen(false); setIsAnalyticsOpen(false); }, []);
  const openAnalytics = useCallback(() => { setIsAnalyticsOpen(true); setIsAIPanelOpen(false); setIsHistoryOpen(false); }, []);
  const toggleAI = useCallback(() => {
    setIsAIPanelOpen((o) => { if (!o) { setIsHistoryOpen(false); setIsAnalyticsOpen(false); } return !o; });
  }, []);

  // ── Offline-first sync status ──
  let syncClass = "on";
  let syncText = "Online";
  if (!idbSynced && !synced) { syncClass = "mid"; syncText = "Loading…"; }
  else if (!online) { syncClass = "off"; syncText = pending ? "Offline · unsynced" : "Offline"; }
  else if (!connected) { syncClass = "off"; syncText = "Reconnecting…"; }
  else if (!synced) { syncClass = "mid"; syncText = "Syncing…"; }
  else if (pending) { syncClass = "mid"; syncText = "Saving…"; }

  // ── Undo / Redo (Yjs, per active file) ──
  const undoManager = useMemo(() => (yText ? undoManagerFor(yText) : null), [yText]);
  const doUndo = useCallback(() => undoManager && undoManager.undo(), [undoManager]);
  const doRedo = useCallback(() => undoManager && undoManager.redo(), [undoManager]);

  // ── Auto-snapshot: every 5 min if edited & no recent version (limits dupes) ──
  const dirtyRef = useRef(false);
  const snapshotsRef = useRef(snapshots);
  snapshotsRef.current = snapshots;
  useEffect(() => {
    const onUpdate = (_u, origin) => { if (origin !== "redis") dirtyRef.current = true; };
    ydoc.on("update", onUpdate);
    const iv = setInterval(() => {
      if (!dirtyRef.current) return;
      const newest = snapshotsRef.current[0];
      if (newest && Date.now() - new Date(newest.createdAt).getTime() < 4 * 60 * 1000) return;
      dirtyRef.current = false;
      saveVersion("Auto-save").catch(() => {});
    }, 5 * 60 * 1000);
    return () => { ydoc.off("update", onUpdate); clearInterval(iv); };
  }, [ydoc, saveVersion]);

  // Chat now lives in the shared Y.Doc → it persists (survives reload) and syncs.
  const chatArray = useMemo(() => ydoc.getArray("chat"), [ydoc]);
  const [messages, setMessages] = useState([]);
  useEffect(() => {
    const update = () => setMessages(chatArray.toArray());
    update();
    chatArray.observe(update);
    return () => chatArray.unobserve(update);
  }, [chatArray]);
  const sendMessage = useCallback(
    (text) => {
      if (!text?.trim() || !user) return;
      const time = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", hour12: true,
      });
      chatArray.push([{ username: user.username, text, time }]);
    },
    [chatArray, user],
  );

  // Read the current buffer from the live editor (falls back to the CRDT text).
  const getCode = useCallback(
    () => (editorView ? editorView.state.doc.toString() : yText ? yText.toString() : ""),
    [editorView, yText],
  );

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleEditorMount = useCallback((view) => setEditorView(view), []);
  const handleSendMessage = useCallback((message) => sendMessage(message), [sendMessage]);

  const handleAIQuery = async (prompt) => {
    if (!editorView || !token) {
      toast.error("Editor not ready or not authenticated");
      return;
    }

    setAiHistory(prev => [...prev, { role: 'user', text: prompt }]);
    setTimeout(() => historyEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    setIsAiLoading(true);
    try {
      const state = editorView.state;
      const selection = state.selection.main;
      const cursor = selection.head;
      const codeContent = state.doc.toString();
      let targetRange = null;
      let selectedText = "";
      let contextInstruction = "";

      if (!selection.empty) {
        selectedText = state.sliceDoc(selection.from, selection.to);
        targetRange = { from: selection.from, to: selection.to };
        contextInstruction = "TASK: REPLACE the selected code strictly.";
      } else {
        const detectedRange = detectFunctionRange(editorView);
        if (detectedRange) {
          targetRange = detectedRange;
          selectedText = state.sliceDoc(targetRange.from, targetRange.to);
          contextInstruction = "TASK: REPLACE the entire existing function/block provided in 'SELECTED CODE'.";
        } else {
          targetRange = { from: cursor, to: cursor };
          contextInstruction = "TASK: INSERT code at the cursor position.";
        }
      }

      const payload = {
        prompt,
        code: codeContent,
        language,
        cursor: {},
        selection: selectedText ? { text: selectedText } : null,
        contextInstruction
      };

      const response = await api.post(`/api/ai/chat`, payload);
      let aiResponse = response.data.text;
      const codeBlockRegex = /```(?:[\w]*\n)?([\s\S]*?)```/;
      const match = aiResponse.match(codeBlockRegex);
      if (match) aiResponse = match[1];

      editorView.dispatch({
        changes: { from: targetRange.from, to: targetRange.to, insert: aiResponse }
      });
      setAiHistory(prev => [...prev, { role: 'ai', text: 'Changes applied successfully.' }]);
      toast.success("AI changes applied!");
    } catch (error) {
      console.error("AI Error", error);
      const errorMessage = error.response?.data?.error || error.message || "Failed to process request.";
      setAiHistory(prev => [...prev, { role: 'ai', text: `Error: ${errorMessage}` }]);
      toast.error(`AI Failed: ${errorMessage}`);
    } finally {
      setIsAiLoading(false);
      setTimeout(() => historyEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  const abortControllerRef = useRef(null);

  const handleRunCode = async () => {
    if (isRunning) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setIsRunning(false);
      setOutput("Execution stopped by user.");
      return;
    }
    if (!token) {
      toast.error("You must be logged in to run code");
      setOutput("Not authenticated");
      return;
    }
    if (!runLang) {
      setOutput(`${activeName || "This file"} is not executable. Open a .py, .js or .cpp file to Run.`);
      return;
    }

    setIsRunning(true);
    setOutput("Running code...");
    abortControllerRef.current = new AbortController();

    try {
      const response = await api.post(
        `/api/run`,
        { language: runLang, code: getCode(), stdin },
        { timeout: 20000, signal: abortControllerRef.current.signal },
      );
      const data = response.data || {};

      if (data.stderr || data.error) {
        const errText = data.stderr || data.error;
        setOutput(errText);
        setLastError(errText);
      } else if (data.stdout !== undefined) {
        setOutput(data.stdout || "No output\n(Did you print to stdout?)");
        setLastError("");
      } else if (data.output !== undefined) {
        setOutput(data.output || "No output\n(Did you print to stdout?)");
        setLastError("");
      } else if (typeof data === "string") {
        setOutput(data);
        setLastError("");
      } else {
        setOutput(JSON.stringify(data, null, 2));
        setLastError("");
      }
    } catch (error) {
      if (api.isCancel?.(error) || error.name === "CanceledError") {
        setOutput("Execution stopped by user.");
      } else {
        console.error("Run Error:", error);
        if (error.code === 'ECONNABORTED') {
          setOutput("Error: Request timed out. Code took too long to execute.");
        } else if (error.response) {
          setOutput(`Error: Server responded with status ${error.response.status}`);
        } else {
          setOutput("Error: Failed to connect to execution server.");
        }
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const applyFix = useCallback((correctedCode) => {
    // Write through the editor so the CRDT captures it (or the CRDT text directly).
    if (editorView) {
      editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: correctedCode },
      });
    } else if (yText) {
      ydoc.transact(() => {
        yText.delete(0, yText.length);
        yText.insert(0, correctedCode);
      });
    }
    setLastError("");
    toast.success("Fix applied!");
  }, [editorView, ydoc, yText]);

  const handleExplainError = async () => {
    if (!lastError || !token) return;
    setIsAIPanelOpen(true);
    setAiHistory(prev => [...prev, { role: 'user', text: 'Explain & fix this error' }]);
    setIsAiLoading(true);
    setTimeout(() => historyEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    try {
      const { data } = await api.post('/api/ai/explain-error', {
        code: getCode(),
        language,
        error: lastError,
      });
      setAiHistory(prev => [...prev, {
        role: 'ai',
        text: `${data.diagnosis}\n\nFix: ${data.fix}`,
        fix: data.correctedCode,
      }]);
    } catch (error) {
      const msg = error.response?.data?.error || "Could not explain the error.";
      setAiHistory(prev => [...prev, { role: 'ai', text: `Error: ${msg}` }]);
      toast.error("AI explain failed");
    } finally {
      setIsAiLoading(false);
      setTimeout(() => historyEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  const handleCopyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setIsCopied(true);
      toast.success("Room ID Copied!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy Room ID");
    }
  };

  if (!user) return <div className="ed-page" style={{ alignItems: 'center', justifyContent: 'center' }}>Loading…</div>;

  const outputIsError = Boolean(lastError) || output.startsWith('Error');

  return (
    <div className="ed-page">

      {/* ── Sidebar ── */}
      <aside className="ed-sidebar">
        <div className="ed-col-header">
          <span className={`ed-status ${syncClass}`} title="Sync status">
            <span className="dot" />
            {syncText}
          </span>
        </div>

        <div className="ed-voice-bar">
          {!voice.inVoice ? (
            <button
              className="ed-voice-join"
              onClick={voice.join}
              disabled={voice.connecting}
              title="Talk with everyone in this room"
            >
              🎙 {voice.connecting ? "Joining…" : "Join Voice"}
            </button>
          ) : (
            <>
              <button
                className={`ed-voice-ctl ${voice.muted ? "muted" : ""} ${voice.pttMode ? "ptt" : ""}`}
                onClick={() => { if (!voice.pttMode) voice.toggleMute(); }}
                onPointerDown={voice.pttDown}
                onPointerUp={voice.pttUp}
                onPointerLeave={voice.pttUp}
                title={voice.pttMode ? "Hold to talk" : voice.muted ? "Unmute" : "Mute"}
              >
                {voice.muted ? "🔇" : "🎙"}
              </button>
              <button
                className={`ed-voice-ctl ${voice.pttMode ? "on" : ""}`}
                onClick={voice.togglePtt}
                title="Push-to-talk — hold ` or the mic button to speak"
              >
                PTT
              </button>
              {voice.devices.length > 1 && (
                <select
                  className="ed-voice-dev"
                  value={voice.deviceId}
                  onChange={(e) => voice.changeDevice(e.target.value)}
                  title="Microphone"
                >
                  <option value="">Default mic</option>
                  {voice.devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                  ))}
                </select>
              )}
              <span className="ed-voice-count">{voice.participants.size} in voice</span>
              <button className="ed-voice-leave" onClick={voice.leave} title="Leave voice">
                Leave
              </button>
            </>
          )}
          {voice.mutedTalking && (
            <span className="ed-voice-nudge">🔇 You're muted — click the mic to talk</span>
          )}
          {voice.error && (
            <span className="ed-voice-err" onClick={voice.dismissError} role="button" title="Dismiss">
              {voice.error}
            </span>
          )}
        </div>

        <div className="ed-users">
          {clients.map((client) => (
            <ClientAvatar
              key={client.socketId}
              username={client.username}
              status={voice.statuses.get(client.socketId) || null}
            />
          ))}
        </div>

        <div className="ed-chat">
          {messages.length === 0 && <div className="ed-chat-empty">No messages yet — say hi 👋</div>}
          {messages.map((msg, index) => {
            const isMe = msg.username === user.username;
            return (
              <div key={index} className={`ed-msg ${isMe ? 'mine' : ''}`}>
                <div className="ed-bubble">
                  <span className="from">{msg.username}</span>{msg.text}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="ed-footer">
          <form onSubmit={(e) => { e.preventDefault(); if (chatInput.trim()) { handleSendMessage(chatInput); setChatInput(""); } }}>
            <input className="ed-input" placeholder="Type a message…" value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
          </form>

          <div
            className={`ed-roomid ${isCopied ? 'copied' : ''}`}
            onClick={handleCopyRoomId}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCopyRoomId(); } }}
            title="Click to copy Room ID"
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', overflow: 'hidden' }}>
              <span className="lbl">Room</span>
              <span className="val">{roomId}</span>
            </div>
            <span className="copy-ico">
              {isCopied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              )}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '2px' }}><ThemeToggle /></div>
        </div>
      </aside>

      {/* ── File explorer ── */}
      <aside className="ed-explorer">
        <FileTree
          tree={tree}
          activeId={activeId}
          onOpen={openFile}
          onCreateFile={(parentId, name) => project.createFile(parentId, name)}
          onCreateFolder={(parentId, name) => project.createFolder(parentId, name)}
          onRename={(id, name) => project.rename(id, name)}
          onMove={(id, parentId) => project.move(id, parentId)}
          onDelete={(id) => project.remove(id)}
        />
      </aside>

      {/* ── Center: toolbar + editor + console ── */}
      <main className="ed-center">
        <div className="ed-toolbar">
          <div className="ed-breadcrumb" title={activePath}>
            {activeName ? activePath : <span className="ed-breadcrumb-empty">No file open</span>}
          </div>

          <div className="ed-toolbar-actions">
            <button className="ed-icon-btn" onClick={doUndo} disabled={!yText} title="Undo (⌘/Ctrl+Z)">↶</button>
            <button className="ed-icon-btn" onClick={doRedo} disabled={!yText} title="Redo (⌘/Ctrl+Y)">↷</button>
            <button
              className={`ed-btn ed-btn-run ${isRunning ? 'running' : ''}`}
              onClick={handleRunCode}
              disabled={isRunning || !runLang}
              title={runLang ? "Run" : "This file type can't be executed"}
            >
              {isRunning ? 'Running…' : '▶ Run'}
            </button>
            <button
              className={`ed-btn ed-btn-ai ${isHistoryOpen ? 'on' : ''}`}
              onClick={() => (isHistoryOpen ? setIsHistoryOpen(false) : openHistory())}
              title="Version history"
            >
              🕘
            </button>
            <button
              className={`ed-btn ed-btn-ai ${isAnalyticsOpen ? 'on' : ''}`}
              onClick={() => (isAnalyticsOpen ? setIsAnalyticsOpen(false) : openAnalytics())}
              title="Collaboration analytics"
            >
              📊
            </button>
            <button className={`ed-btn ed-btn-ai ${isAIPanelOpen ? 'on' : ''}`} onClick={toggleAI}>
              ✦ AI
            </button>
          </div>
        </div>

        <div className="ed-editor-wrap">
          {docReady && awareness && yText ? (
            <Editor
              key={activeId}
              language={language}
              yText={yText}
              awareness={awareness}
              onEditorMount={handleEditorMount}
              onActivity={handleActivity}
            />
          ) : (
            <div className="ed-editor-empty">
              {!docReady
                ? connected
                  ? "Syncing project…"
                  : "Loading local copy…"
                : "No file open — create or select a file in the Explorer."}
            </div>
          )}
        </div>

        <div className="ed-console">
          <div className="ed-console-col">
            <div className="ed-panel-head"><span>Input · stdin</span></div>
            <textarea className="ed-panel-body" placeholder="Type input for your program…" value={stdin} onChange={(e) => setStdin(e.target.value)} />
          </div>
          <div className="ed-console-col">
            <div className="ed-panel-head">
              <span>Output</span>
              {lastError && (
                <button className="ed-fix-btn" onClick={handleExplainError} disabled={isAiLoading}>
                  ✦ Explain &amp; Fix
                </button>
              )}
            </div>
            <pre className={`ed-panel-body ${outputIsError ? 'is-error' : ''}`}>
              {output || <span className="ed-output-empty">Run your code to see output…</span>}
            </pre>
          </div>
        </div>
      </main>

      {/* ── AI panel ── */}
      <aside className="ed-ai-panel" style={{ width: isAIPanelOpen ? '340px' : '0px' }}>
        <div className="ed-col-header between">
          <span className="ed-col-title">✦ AI Copilot</span>
          <button className="ed-ai-close" onClick={() => setIsAIPanelOpen(false)} aria-label="Close AI panel">✕</button>
        </div>

        <div className="ed-ai-body">
          {aiHistory.length === 0 && (
            <div className="ed-ai-hint">
              <b>How to use</b>
              <ul>
                <li>Select code to <strong>replace</strong> or <strong>refactor</strong>.</li>
                <li>Place your cursor to <strong>insert</strong> new code.</li>
                <li>Hit a run error → <strong>Explain &amp; Fix</strong>.</li>
              </ul>
            </div>
          )}

          {aiHistory.map((item, index) => (
            <div key={index} className={`ed-ai-msg ${item.role === 'user' ? 'user' : 'ai'}`}>
              {item.role === 'user' ? (
                <span>{item.text}</span>
              ) : item.fix !== undefined ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{item.text}</span>
                  <button className="ed-ai-apply" onClick={() => applyFix(item.fix)}>✓ Apply Fix</button>
                </div>
              ) : (
                <span><span className="ok">✔</span> {item.text}</span>
              )}
            </div>
          ))}
          <div ref={historyEndRef} />
        </div>

        <div style={{ borderTop: '1px solid var(--ed-border)' }}>
          <AIPromptBar onSubmit={handleAIQuery} loading={isAiLoading} />
        </div>
      </aside>

      {/* ── Version history panel ── */}
      <HistoryPanel
        open={isHistoryOpen}
        snapshots={snapshots}
        busy={snapBusy}
        onSave={(label) => saveVersion(label)}
        onRestore={(id) => restore(id)}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* ── Collaboration analytics panel ── */}
      {/* Always mounted (width toggles with `open`) so timeline history persists and
          its aggregation re-renders stay isolated to this subtree. */}
      <AnalyticsPanel
        open={isAnalyticsOpen}
        awareness={awareness}
        onClose={() => setIsAnalyticsOpen(false)}
      />

    </div>
  );
};

export default EditorPage;
