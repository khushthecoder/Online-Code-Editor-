import React, { useState, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { okaidia } from '@uiw/codemirror-theme-okaidia';
import { socket } from '../socket';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const Editor = () => {
  const [code, setCode] = useState(""); 
  const [loading, setLoading] = useState(true); 

  const { roomId } = useParams(); 
  const { token } = useAuth(); 

  useEffect(() => {
    const fetchCode = async () => {
      if (!token || !roomId) return;

      setLoading(true);
      try {
        const config = {
          headers: { Authorization: `Bearer ${token}` },
        };
        const response = await axios.get(
          `http://localhost:5001/api/room/${roomId}`, 
          config
        );

        setCode(response.data.javascript || "console.log('Welcome!');"); 
      } catch (error) {
        console.error('Failed to fetch code:', error);
        setCode("// Failed to load code. Start typing...");
      }
      setLoading(false);
    };

    fetchCode();
  }, [roomId, token]); 

  const onChange = useCallback((val, viewUpdate) => {
    setCode(val);
    socket.emit('code-change', val);
  }, []);

  useEffect(() => {
    socket.on('code-update', (newCode) => {
      setCode(newCode);
    });

    return () => {
      socket.off('code-update');
    };
  }, []);

  if (loading) {
    return <div>Loading Editor...</div>;
  }

  return (
    <CodeMirror
      value={code} 
      height="90vh"
      theme={okaidia}
      extensions={[javascript({ jsx: true })]}
      onChange={onChange}
    />
  );
};

export default Editor;