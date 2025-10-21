// src/pages/EditorPage.jsx
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { socket } from '../socket';
import Editor from '../components/Editor'; // <-- Editor ko import kiya

const EditorPage = () => {
  const { roomId } = useParams();

  useEffect(() => {
    socket.connect();
    socket.emit('join-room', roomId);

    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      <div
        style={{
          width: '20%',
          padding: '10px',
          borderRight: '1px solid #444',
          height: '100vh',
          backgroundColor: '#1c1c1c', // Thoda dark background
          color: 'white',
        }}
      >
        {/* Sidebar (Ise hum baad mein user list se bharenge) */}
        <h3>Connected Users</h3>
        <p>Room ID: {roomId}</p>
        <button onClick={() => navigator.clipboard.writeText(roomId)}>
          Copy Room ID
        </button>
      </div>
      <div style={{ width: '80%' }}>
        <Editor /> {/* <-- Yahaan hamara Editor component aa gaya */}
      </div>
    </div>
  );
};

export default EditorPage;