import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { socket } from "../socket";
import Editor from "../components/Editor";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import AIPromptBar from "../components/AIPromptBar";
import { toast } from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const ClientAvatar = ({ username }) => {
  const safeUsername = username || "Guest";
  const avatarLetter = safeUsername[0].toUpperCase();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px', margin: '5px' }} title={safeUsername}>
      <div style={{ width: '40px', height: '40px', borderRadius: '8px', border: '1px solid #4b5563', backgroundColor: '#21262d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb', fontWeight: 'bold', fontSize: '18px' }}>
        {avatarLetter}
      </div>
      <span style={{ fontSize: '10px', color: '#9ca3af', width: '100%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {safeUsername.split(" ")[0]}
      </span>
    </div>
  );
};

const EditorPage = () => {
  const { roomId } = useParams();
  const { user, token } = useAuth();

  const [clients, setClients] = useState([]);
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState("");
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [editorView, setEditorView] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [aiHistory, setAiHistory] = useState([]);
  const [isCopied, setIsCopied] = useState(false);

  const messagesEndRef = useRef(null);
  const historyEndRef = useRef(null);

  const fetchCode = useCallback(
    async (lang) => {
      if (!token || !roomId) return;
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const response = await axios.get(`${API_URL}/api/room/${roomId}`, config);
        setCode(response.data[lang] || `// Welcome to ${lang}`);
      } catch (error) {
        console.error("Failed to fetch code:", error);
      }
    },
    [roomId, token],
  );

  useEffect(() => {
    fetchCode(language);
  }, [language, fetchCode]);

  useEffect(() => {
    if (!user) return;
    socket.connect();
    socket.emit("join-room", { roomId, username: user?.username || "Guest" });

    const handleUserList = (userList) => setClients(userList);
    const handleNewMessage = (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    };

    socket.on("update-user-list", handleUserList);
    socket.on("new-message", handleNewMessage);

    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }

    return () => {
      socket.disconnect();
      socket.off("update-user-list", handleUserList);
      socket.off("new-message", handleNewMessage);
    };
  }, [roomId, user]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    const handleCodeUpdate = ({ language: incomingLang, newCode }) => {
      if (incomingLang === language) setCode(newCode);
    };
    socket.on("code-update", handleCodeUpdate);
    return () => socket.off("code-update", handleCodeUpdate);
  }, [language]);

  useEffect(() => {
    const handleLanguageUpdate = (newLanguage) => {
      setLanguage(newLanguage);
    };
    socket.on("language-update", handleLanguageUpdate);
    return () => socket.off("language-update", handleLanguageUpdate);
  }, []);

  const onCodeChange = useCallback(
    (value) => {
      setCode(value);
      socket.emit("code-change", { language, newCode: value });
    },
    [language],
  );

  const handleEditorMount = useCallback((view) => {
    setEditorView(view);
  }, []);

  const handleSendMessage = (message) => {
    socket.emit("send-message", { message });
  };

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

  const handleAIQuery = async (prompt) => {
    if (!editorView || !token) {
      toast.error("Editor not ready or not authenticated");
      return;
    }

    // Add User Prompt to History
    setAiHistory(prev => [...prev, { role: 'user', text: prompt }]);
    // Auto-scroll history
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

      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.post(`${API_URL}/api/ai/chat`, payload, config);
      let aiResponse = response.data.text;
      const codeBlockRegex = /```(?:[\w]*\n)?([\s\S]*?)```/;
      const match = aiResponse.match(codeBlockRegex);
      if (match) aiResponse = match[1];

      editorView.dispatch({
        changes: { from: targetRange.from, to: targetRange.to, insert: aiResponse }
      });
      // Add AI Success to History
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

  // Ref for abort controller
  const abortControllerRef = useRef(null);

  const handleRunCode = async () => {
    // If already running, treating this as a "STOP" command
    if (isRunning) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setIsRunning(false);
      setOutput("Execution stopped by user.");
      return;
    }

    if (!token) {
      toast.error("You must be logged in to run code");
      setOutput("Not authenticated");
      return;
    }

    setIsRunning(true);
    setOutput("Running code...");

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000, // 10s server timeout
        signal: abortControllerRef.current.signal // client-side abort capability
      };

      const response = await axios.post(
        `${API_URL}/api/run`,
        { language, code, stdin },
        config,
      );

      const data = response.data || {};

      if (data.stderr || data.error) {
        setOutput(data.stderr || data.error);
      } else if (data.stdout !== undefined) {
        setOutput(data.stdout || "No output\n(Did you print to stdout?)");
      } else if (data.output !== undefined) {
        setOutput(data.output || "No output\n(Did you print to stdout?)");
      } else if (typeof data === "string") {
        setOutput(data);
      } else {
        setOutput(JSON.stringify(data, null, 2));
      }

    } catch (error) {
      if (axios.isCancel(error)) {
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

  if (!user) return <div>Loading...</div>;

  // INLINE STYLES CONSTANTS
  const styles = {
    page: { display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#0d1117', color: '#d1d5db', fontFamily: 'sans-serif' },

    // LEFT COLUMN
    leftCol: { display: 'flex', flexDirection: 'column', width: '280px', minWidth: '240px', maxWidth: '500px', resize: 'horizontal', overflow: 'hidden', borderRight: '1px solid #30363d', backgroundColor: '#161b22', flexShrink: 0 },
    columnHeader: { height: '48px', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', padding: '0 16px', backgroundColor: '#161b22', flexShrink: 0 },
    headerTitle: { fontSize: '14px', fontWeight: 'bold', color: '#e5e7eb', textTransform: 'uppercase', letterSpacing: '0.05em' },

    usersBody: { padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #30363d', overflowY: 'auto', maxHeight: '30%', flexShrink: 0 },
    chatBody: { flexGrow: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#0d1117' },

    footer: { padding: '12px', borderTop: '1px solid #30363d', backgroundColor: '#161b22', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 },
    input: { width: '100%', backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '4px', padding: '6px 8px', fontSize: '12px', color: '#d1d5db', outline: 'none' },

    // CENTER COLUMN
    centerCol: { flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid #30363d' },
    centerHeader: { height: '48px', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', backgroundColor: '#161b22', flexShrink: 0 },
    editorContainer: { flexGrow: 1, position: 'relative', overflow: 'hidden' },

    bottomPanel: { height: '220px', borderTop: '1px solid #30363d', display: 'flex', flexShrink: 0, backgroundColor: '#0d1117' },
    splitCol: { width: '50%', display: 'flex', flexDirection: 'column', borderRight: '1px solid #30363d' },
    panelTitle: { padding: '6px 12px', borderBottom: '1px solid #30363d', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#6b7280', backgroundColor: '#161b22' },
    panelContent: { flexGrow: 1, backgroundColor: '#0d1117', color: '#d1d5db', padding: '12px', fontSize: '14px', fontFamily: 'monospace', resize: 'none', outline: 'none', border: 'none', overflow: 'auto' },

    // RIGHT COLUMN (AI)
    rightCol: { display: 'flex', flexDirection: 'column', backgroundColor: '#161b22', flexShrink: 0, transition: 'width 0.3s', overflow: 'hidden', borderLeft: '1px solid #30363d' }, // width handled dynamically

    // UTILS
    btnRun: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', border: 'none', cursor: 'pointer', backgroundColor: '#16a34a', color: 'white' },
    btnAI: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', border: '1px solid #30363d', cursor: 'pointer' },
  };

  return (
    <div style={styles.page}>

      {/* 1. LEFT SIDEBAR */}
      <div style={styles.leftCol}>
        <div style={styles.columnHeader}>
          <span style={styles.headerTitle}>Connected</span>
        </div>

        <div style={styles.usersBody}>
          {clients.map((client) => (
            <ClientAvatar key={client.socketId} username={client.username} />
          ))}
        </div>

        <div style={styles.chatBody}>
          {messages.length === 0 && <div style={{ textAlign: 'center', color: '#4b5563', fontSize: '12px', marginTop: '16px' }}>Start chatting...</div>}
          {messages.map((msg, index) => {
            const isMe = msg.username === user.username;
            return (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ padding: '6px 8px', borderRadius: '4px', maxWidth: '90%', fontSize: '12px', backgroundColor: isMe ? 'rgba(30, 64, 175, 0.4)' : '#21262d', color: isMe ? '#dbeafe' : '#d1d5db', border: isMe ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid #30363d' }}>
                  <span style={{ fontWeight: 'bold', marginRight: '4px', opacity: 0.6, fontSize: '10px' }}>{msg.username}:</span>
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div style={styles.footer}>
          <form onSubmit={(e) => { e.preventDefault(); if (chatInput.trim()) { handleSendMessage(chatInput); setChatInput(""); } }}>
            <input style={styles.input} placeholder="Type message..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
          </form>
          <div
            onClick={handleCopyRoomId}
            className="group"
            style={{
              ...styles.input,
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'background-color 0.2s',
              position: 'relative',
              overflow: 'hidden'
            }}
            title="Click to Copy Room ID"
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', overflow: 'hidden' }}>
              <span style={{ fontWeight: 'bold', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>ID:</span>
              <span style={{ fontFamily: 'monospace', color: isCopied ? '#4ade80' : '#60a5fa', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 'bold', fontSize: '12px' }}>
                {roomId}
              </span>
            </div>

            <div style={{
              color: isCopied ? '#4ade80' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isCopied ? 'rgba(74, 222, 128, 0.1)' : 'transparent',
              padding: '4px',
              borderRadius: '4px',
              transition: 'all 0.2s'
            }}>
              {isCopied ? (
                // Check Icon
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                // Copy Icon
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4px' }}><ThemeToggle /></div>
        </div>
      </div>

      {/* 2. CENTER COLUMN */}
      <div style={styles.centerCol}>
        <div style={styles.centerHeader}>
          {/* Left: Lang */}
          <div style={{ position: 'relative' }}>
            <select
              value={language}
              onChange={(e) => { setLanguage(e.target.value); socket.emit("language-change", { language: e.target.value }); }}
              style={{ appearance: 'none', backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#e5e7eb', fontSize: '12px', fontWeight: 'bold', borderRadius: '4px', padding: '6px 32px 6px 12px', outline: 'none', cursor: 'pointer' }}
            >
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="cpp">C++</option>
            </select>
            <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9ca3af', fontSize: '10px' }}>▼</div>
          </div>

          {/* Right: Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={handleRunCode} disabled={isRunning} style={{ ...styles.btnRun, backgroundColor: isRunning ? '#374151' : '#16a34a', color: isRunning ? '#9ca3af' : 'white', cursor: isRunning ? 'not-allowed' : 'pointer' }}>
              {isRunning ? 'Running' : 'Run'}
            </button>

            <button onClick={() => setIsAIPanelOpen(!isAIPanelOpen)} style={{ ...styles.btnAI, backgroundColor: isAIPanelOpen ? '#2563eb' : '#21262d', color: isAIPanelOpen ? 'white' : '#9ca3af', borderColor: isAIPanelOpen ? '#2563eb' : '#30363d' }}>
              AI
            </button>
          </div>
        </div>

        <div style={styles.editorContainer}>
          <Editor language={language} value={code} onChange={onCodeChange} onEditorMount={handleEditorMount} />
        </div>

        <div style={styles.bottomPanel}>
          <div style={styles.splitCol}>
            <div style={styles.panelTitle}>Input (Stdin)</div>
            <textarea style={styles.panelContent} placeholder="Type input..." value={stdin} onChange={(e) => setStdin(e.target.value)} />
          </div>
          <div style={{ ...styles.splitCol, borderRight: 'none' }}>
            <div style={styles.panelTitle}>Output</div>
            <pre style={{ ...styles.panelContent, whiteSpace: 'pre-wrap', color: output.startsWith('Error') ? '#f87171' : '#d1d5db' }}>
              {output || <span style={{ color: '#4b5563', fontStyle: 'italic' }}>Run code to see output...</span>}
            </pre>
          </div>
        </div>
      </div>

      {/* 3. RIGHT COLUMN (AI) */}
      <div style={{ ...styles.rightCol, width: isAIPanelOpen ? '320px' : '0px' }}>
        <div style={{ ...styles.columnHeader, justifyContent: 'space-between' }}>
          <span style={styles.headerTitle}>AI Copilot</span>
          <button onClick={() => setIsAIPanelOpen(false)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '16px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Instructions (only show if history is empty) */}
          {aiHistory.length === 0 && (
            <div style={{ backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '4px', padding: '12px', color: '#9ca3af', fontSize: '12px', lineHeight: '1.5' }}>
              <p style={{ marginBottom: '8px', color: '#e5e7eb', fontWeight: 'bold' }}>Instructions:</p>
              <ul style={{ paddingLeft: '16px', margin: 0 }}>
                <li>Select code to <strong>replace</strong> or <strong>refactor</strong>.</li>
                <li>Place cursor to <strong>insert</strong> new code.</li>
              </ul>
            </div>
          )}

          {/* History Feed */}
          {aiHistory.map((item, index) => (
            <div key={index} style={{
              alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
              backgroundColor: item.role === 'user' ? '#1f6feb' : '#21262d',
              color: '#e5e7eb',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              maxWidth: '90%',
              border: '1px solid #30363d',
              lineHeight: '1.4'
            }}>
              {item.role === 'user' ? (
                <span>{item.text}</span>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#3fb950' }}>✔</span> {item.text}
                </div>
              )}
            </div>
          ))}
          <div ref={historyEndRef} />
        </div>

        <div style={{ padding: '0', borderTop: '1px solid #30363d' }}>
          <AIPromptBar onSubmit={handleAIQuery} loading={isAiLoading} />
        </div>
      </div>

    </div>
  );
};

export default EditorPage;