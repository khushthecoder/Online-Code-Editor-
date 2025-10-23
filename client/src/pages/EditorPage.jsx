import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { socket } from '../socket';
import Editor from '../components/Editor';
import { useAuth } from '../context/AuthContext';

const EditorPage = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const [clients, setClients] = useState([]);

  useEffect(() => {
    if (!user) {
      return;
    }
    socket.connect();
    socket.emit('join-room', { roomId, username: user?.username || 'Guest' });
    socket.on('update-user-list', (userList) => {
      setClients(userList);
    });

    return () => {
      socket.disconnect();
      socket.off('update-user-list');
    };
  }, [roomId, user]);
  const ClientAvatar = ({ username }) => {
    const safeUsername = username || 'Guest';
    const avatarLetter = safeUsername[0].toUpperCase();
    
    return (
      <div style={{ marginRight: '10px' }} title={safeUsername}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: '#5A5A5A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
          }}
        >
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
      <div style={{ width: '80%' }}>
        <Editor />
      </div>
    </div>
  );
};

export default EditorPage;