// src/components/Editor.jsx
import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { okaidia } from '@uiw/codemirror-theme-okaidia';
import { socket } from '../socket'; // <-- Socket ko import karein

const Editor = () => {
  const [code, setCode] = useState("console.log('Hello, World!');");

  // Jab code badle (Task 1)
  const onChange = React.useCallback((val, viewUpdate) => {
    setCode(val); // Pehle apna state update karo
    socket.emit('code-change', val); // Fir server ko naya code bhejo
  }, []);

  // Jab naya code aaye (Task 3)
  useEffect(() => {
    socket.on('code-update', (newCode) => {
      setCode(newCode); // Server se aaye code se state update karo
    });

    // Cleanup listener
    return () => {
      socket.off('code-update');
    };
  }, []);

  return (
    <CodeMirror
      value={code} // Value ab state se aa rahi hai
      height="90vh"
      theme={okaidia}
      extensions={[javascript({ jsx: true })]}
      onChange={onChange}
    />
  );
};

export default Editor;