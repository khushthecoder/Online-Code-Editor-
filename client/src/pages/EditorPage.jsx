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

  const [html, setHtml] = useState('');
  const [css, setCss] = useState('');
  const [js, setJs] = useState('');
  const [srcDoc, setSrcDoc] = useState('');

  useEffect(() => {
    const fetchCode = async () => {
      if (!token || !roomId) return;
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const response = await axios.get(
          `http://localhost:5001/api/room/${roomId}`,
          config
        );
        setHtml(response.data.html || '');
        setCss(response.data.css || '');
        setJs(response.data.javascript || '');
      } catch (error) {
        console.error('Failed to fetch code:', error);
      }
    };
    fetchCode();
  }, [roomId, token]);

  useEffect(() => {
    if (!user) return;
    socket.connect();
    socket.emit('join-room', { roomId, username: user?.username || 'Guest' });

    socket.on('update-user-list', (userList) => {
      setClients(userList);
    });

    socket.on('code-update', ({ language, newCode }) => {
      switch (language) {
        case 'html':
          setHtml(newCode);
          break;
        case 'css':
          setCss(newCode);
          break;
        case 'javascript':
          setJs(newCode);
          break;
        default:
          break;
      }
    });

    return () => {
      socket.disconnect();
      socket.off('update-user-list');
      socket.off('code-update');
    };
  }, [roomId, user]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSrcDoc(`
        <html>
          <head>
            <style>${css}</style>
          </head>
          <body>
            ${html}
            <script>${js}</script>
          </body>
        </html>
      `);
    }, 250);

    return () => clearTimeout(timeout);
  }, [html, css, js]);

  const onHtmlChange = useCallback((value) => {
    setHtml(value);
    socket.emit('code-change', { language: 'html', newCode: value });
  }, []);

  const onCssChange = useCallback((value) => {
    setCss(value);
    socket.emit('code-change', { language: 'css', newCode: value });
  }, []);

  const onJsChange = useCallback((value) => {
    setJs(value);
    socket.emit('code-change', { language: 'javascript', newCode: value });
  }, []);

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

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
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
      
      <div style={{ width: '80%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'row', height: 'auto' }}>
          <div style={{ width: '33.3%' }}>
            <h4 style={{background: '#222', color: 'white', margin: 0, padding: '5px'}}>HTML</h4>
            <Editor language="html" value={html} onChange={onHtmlChange} />
          </div>
          <div style={{ width: '33.3%' }}>
            <h4 style={{background: '#222', color: 'white', margin: 0, padding: '5px'}}>CSS</h4>
            <Editor language="css" value={css} onChange={onCssChange} />
          </div>
          <div style={{ width: '33.3%' }}>
            <h4 style={{background: '#222', color: 'white', margin: 0, padding: '5px'}}>JavaScript</h4>
            <Editor language="javascript" value={js} onChange={onJsChange} />
          </div>
        </div>
        
        <div style={{ flex: 1, backgroundColor: 'white', height: '40vh' }}>
          <iframe
            srcDoc={srcDoc}
            title="output"
            sandbox="allow-scripts"
            frameBorder="0"
            width="100%"
            height="100%"
          />
        </div>
      </div>
    </div>
  );
};

export default EditorPage;