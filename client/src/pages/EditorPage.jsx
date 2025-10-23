// src/pages/EditorPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { socket } from '../socket';
import Editor from '../components/Editor';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const EditorPage = () => {
  const { roomId } = useParams();
  const { user, token } = useAuth();
  const [clients, setClients] = useState([]);

  // VS Code Layout State
  const [language, setLanguage] = useState('python'); // Default Python
  const [code, setCode] = useState('');
  const [stdin, setStdin] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const fetchCode = useCallback(async (lang) => {
    if (!token || !roomId) return;
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get(
        `http://localhost:5001/api/room/${roomId}`,
        config
      );
      setCode(response.data[lang] || `// Welcome to ${lang}`);
    } catch (error) {
      console.error('Failed to fetch code:', error);
    }
  }, [roomId, token]);

  useEffect(() => {
    fetchCode(language);
  }, [language, fetchCode]);

  useEffect(() => {
    if (!user) return;
    socket.connect();
    socket.emit('join-room', { roomId, username: user?.username || 'Guest' });

    socket.on('update-user-list', (userList) => {
      setClients(userList);
    });

    socket.on('code-update', ({ language: incomingLang, newCode }) => {
      if (incomingLang === language) {
        setCode(newCode);
      }
    });

    return () => {
      socket.disconnect();
      socket.off('update-user-list');
      socket.off('code-update');
    };
  }, [roomId, user, language]);

  const onCodeChange = useCallback((value) => {
    setCode(value);
    socket.emit('code-change', { language: language, newCode: value });
  }, [language]);

  const handleRunCode = async () => {
    if (!token) return;
    setIsRunning(true);
    setOutput('Running code...');
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.post(
        'http://localhost:5001/api/run',
        { language, code, stdin },
        config
      );

      if (response.data.stderr) {
        setOutput(response.data.stderr);
      } else {
        setOutput(response.data.stdout);
      }
    } catch (error) {
      console.error('Run Error:', error.response ? error.response.data : error.message);
      setOutput('Error running code. Check server console.');
    }
    setIsRunning(false);
  };

  // === Sidebar Avatar Component ===
  const ClientAvatar = ({ username }) => {
    const safeUsername = username || 'Guest';
    const avatarLetter = safeUsername[0].toUpperCase();
    return (
      <div style={{ marginRight: '10px' }} title={safeUsername}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#5A5A5A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
          {avatarLetter}
        </div>
        <span style={{ fontSize: '12px', wordBreak: 'break-all' }}>
          {safeUsername.split(' ')[0]}
        </span>
      </div>
    );
  };
  
  if (!user) { return <div>Loading...</div>; }

  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      
      {/* === YEH POORA SIDEBAR MISSING THA === */}
      <div
        style={{
          width: '20%',
          padding: '10px',
          borderRight: '1px solid #444',
          height: '100vh',
          backgroundColor: '#1c1c1c',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h3>Connected</h3>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '20px',
          }}
        >
          {clients.map((client) => (
            <ClientAvatar key={client.socketId} username={client.username} />
          ))}
        </div>
        <hr style={{ width: '100%', borderColor: '#444' }} />
        
        <div style={{ marginTop: 'auto' }}>
          <p 
            style={{ cursor: 'help', overflowWrap: 'break-word' }} 
            title={roomId}
          >
            Room ID: {roomId.substring(0, 8)}...
          </p>
          <button 
            onClick={() => navigator.clipboard.writeText(roomId)}
            style={{width: '100%', padding: '5px', borderRadius: '5px'}}
          >
            Copy Room ID
          </button>
        </div>
      </div>
      {/* ================================== */}

      {/* Main Area (Editor + Console) */}
      <div style={{ width: '80%', display: 'flex', flexDirection: 'column' }}>
        
        {/* Top Bar: Language Dropdown + Run Button */}
        <div style={{ padding: '10px', backgroundColor: '#222', display: 'flex', justifyContent: 'space-between' }}>
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            style={{ padding: '5px' }}
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
          </select>
          <button 
            onClick={handleRunCode} 
            disabled={isRunning}
            style={{ padding: '5px 10px', backgroundColor: isRunning ? '#555' : 'green', color: 'white', border: 'none' }}
          >
            {isRunning ? 'Running...' : 'Run'}
          </button>
        </div>

        {/* Editor */}
        <Editor language={language} value={code} onChange={onCodeChange} />
        
        {/* Console Area (Input + Output) */}
        <div style={{ display: 'flex', flexDirection: 'row', height: '30vh', backgroundColor: '#1e1e1e', color: 'white' }}>
          <div style={{ width: '50%', padding: '10px' }}>
            <h4 style={{ margin: 0 }}>Input (stdin)</h4>
            <textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              style={{ width: '100%', height: '80%', backgroundColor: '#252526', color: 'white', border: '1px solid #555' }}
            />
          </div>
          <div style={{ width: '50%', padding: '10px' }}>
            <h4 style={{ margin: 0 }}>Output</h4>
            <pre style={{ width: '100%', height: '80%', backgroundColor: '#252526', color: 'white', border: '1px solid #555', overflowY: 'auto' }}>
              {output}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;