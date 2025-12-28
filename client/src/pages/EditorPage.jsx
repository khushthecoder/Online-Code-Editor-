import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { socket } from "../socket";
import Editor from "../components/Editor";
import Chat from "../components/Chat";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

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

  const fetchCode = useCallback(
    async (lang) => {
      if (!token || !roomId) return;
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };

        const response = await axios.get(
          `${API_URL}/api/room/${roomId}`,
          config,
        );
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

    return () => {
      socket.disconnect();
      socket.off("update-user-list", handleUserList);
      socket.off("new-message", handleNewMessage);
    };
  }, [roomId, user]);

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

  const handleSendMessage = (message) => {
    socket.emit("send-message", { message });
  };

  const handleRunCode = async () => {


    if (!token) {
      toast.error("You must be logged in to run code");
      setOutput("Not authenticated");
      return;
    }

    setIsRunning(true);
    setOutput("Running code...");
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const response = await axios.post(
        `${API_URL}/api/run`,
        { language, code, stdin },
        config,
      );
      const data = response.data || {};
      if (data.stderr) {
        setOutput(data.stderr);
      } else if (data.stdout) {
        setOutput(data.stdout);
      } else if (data.output) {
        setOutput(data.output);
      } else if (typeof data === "string") {
        setOutput(data);
      } else {
        setOutput(JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.error(
        "Run Error:",
        error.response ? error.response.data : error.message,
      );
      setOutput("Error running code. Check server console.");
    }
    setIsRunning(false);
  };

  const handleCopyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room ID Copied!");
    } catch (err) {
      toast.error("Failed to copy Room ID");
      console.error("Failed to copy: ", err);
    }
  };

  const ClientAvatar = ({ username }) => {
    const safeUsername = username || "Guest";
    const avatarLetter = safeUsername[0].toUpperCase();
    return (
      <div className="avatar" title={safeUsername}>
        <div className="avatarIcon">{avatarLetter}</div>
        <span className="avatarUsername">{safeUsername.split(" ")[0]}</span>
      </div>
    );
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div className="editorPageWrapper">
      <div className="sidebar flex flex-col h-full overflow-hidden bg-gray-900 border-r border-gray-800">


        <div className="userListWrapper p-4 border-b border-gray-800 flex-shrink-0">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Connected Users</h3>
          <div className="userList flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
            {clients.map((client) => (
              <ClientAvatar key={client.socketId} username={client.username} />
            ))}
          </div>
        </div>


        <div className="chatContainer flex-grow overflow-hidden flex flex-col relative min-h-0">

          <Chat messages={messages} />
        </div>


        <div className="bottomSection flex flex-col flex-shrink-0 z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.4)]" style={{ backgroundColor: '#161b22', borderTop: '1px solid #30363d' }}>


          <div className="chatInputWrapper px-4 pt-5 pb-3">
            <form onSubmit={(e) => {
              e.preventDefault();
              if (chatInput.trim()) {
                handleSendMessage(chatInput);
                setChatInput("");
              }
            }} className="chatForm relative flex items-center w-full">

              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                className="w-full text-gray-200 text-[15px] font-medium transition-all shadow-inner placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                style={{
                  backgroundColor: '#0d1117',
                  borderRadius: '16px',
                  padding: '14px 50px 14px 16px',
                  border: '1px solid #30363d',
                  color: '#ffffff',
                  height: '52px'
                }}
              />

              <button
                type="submit"
                className={`absolute rounded-full flex items-center justify-center transition-all ${chatInput.trim() ? 'bg-blue-600 shadow-lg hover:bg-blue-500 active:scale-95' : 'bg-transparent text-gray-600 cursor-not-allowed'}`}
                disabled={!chatInput.trim()}
                style={{
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '36px',
                  height: '36px',
                  color: chatInput.trim() ? '#fff' : '#484f58'
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={chatInput.trim() ? 'ml-0.5' : ''}><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </form>
          </div>


          <div className="roomInfo px-4 pb-3 flex justify-center">
            <div
              className="flex items-center justify-between w-full max-w-[280px] group cursor-pointer hover:bg-[#1c2128] transition-colors"
              onClick={handleCopyRoomId}
              title="Copy Room ID"
              style={{
                backgroundColor: '#0d1117',
                borderRadius: '12px',
                padding: '10px 14px',
                border: '1px solid #30363d'
              }}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Room</span>
                </div>
                <span className="text-[13px] font-mono text-blue-400 truncate select-none" style={{ fontFamily: 'monospace' }}>
                  {roomId}
                </span>
              </div>

              <div className="flex-shrink-0 text-gray-500 group-hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </div>
            </div>
          </div>


          <div className="roomActions flex justify-center pb-6">
            <ThemeToggle />
          </div>
        </div>

      </div>

      <div className="mainArea">
        <div className="topBar">
          <select
            value={language}
            onChange={(e) => {
              const newLanguage = e.target.value;
              setLanguage(newLanguage);
              socket.emit("language-change", { language: newLanguage });
            }}
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
          </select>

          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className="runBtn"
          >
            {isRunning ? "Running..." : "Run"}
          </button>
        </div>

        <Editor language={language} value={code} onChange={onCodeChange} />

        <div className="consoleArea">
          <div className="consoleBox">
            <h4>Input (stdin)</h4>
            <textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
            />
          </div>

          <div className="consoleBox">
            <h4>Output</h4>
            <pre>{output}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;