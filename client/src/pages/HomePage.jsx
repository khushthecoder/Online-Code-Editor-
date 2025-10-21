import React, { useState } from 'react'; 
import { useAuth } from '../context/AuthContext'; 
import { useNavigate } from 'react-router-dom'; 
import axios from 'axios';

const HomePage = () => {
  const { logout, token } = useAuth();
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  const handleCreateRoom = async () => {
    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };
      const response = await axios.post('http://localhost:5001/api/room/create', {}, config);
      const newRoomId = response.data.roomId;
      navigate(`/room/${newRoomId}`);
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Failed to create room.');
    }
  };

  const handleJoinRoom = () => {
    if (roomId) {
      navigate(`/room/${roomId}`);
    } else {
      alert('Please enter a Room ID');
    }
  };

  return (
    <div>
      <h2>Welcome to the Code Editor</h2>
      <button onClick={logout}>Logout</button>
      <hr style={{ margin: '20px 0' }} />
      <div>
        <h3>Join a Room</h3>
        <input
          type="text"
          placeholder="Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <button onClick={handleJoinRoom}>Join</button>
      </div>
      <div style={{ marginTop: '20px' }}>
        <h3>Create a New Room</h3>
        <button onClick={handleCreateRoom}>Create Room</button>
      </div>
    </div>
  );
};
export default HomePage;