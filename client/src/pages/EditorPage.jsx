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
  console.debug("[EditorPage] mount", {
    roomId,
    user: user && { id: user.id, username: user.username },
    tokenPresent: !!token,
  });

  const [clients, setClients] = useState([]);
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState("");
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState([]);

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
    console.debug("[EditorPage] handleRunCode clicked", {
      roomId,
      language,
      tokenPresent: !!token,
    });

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
      <div className="sidebar">
        <h3>Connected</h3>
        <div className="userList">
          {clients.map((client) => (
            <ClientAvatar key={client.socketId} username={client.username} />
          ))}
        </div>

        <hr />

        <div className="chatContainer">
          <h4>Chat Room</h4>
          <Chat messages={messages} onSendMessage={handleSendMessage} />
        </div>

        <hr />

        <div className="roomInfo">
          <div className="roomIdContainer">
            <p className="roomIdText" title={roomId}>
              Room ID: {roomId.substring(0, 8)}...
            </p>
            <button onClick={handleCopyRoomId} className="copyBtn">
              📋
            </button>
          </div>

          <div className="roomActions">
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