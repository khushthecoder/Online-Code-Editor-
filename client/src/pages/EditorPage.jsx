import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { socket } from '../socket'; 
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
    <div>
      <h2>Editor Page</h2>
      <p>You are in room: {roomId}</p>
    </div>
  );
};

export default EditorPage;