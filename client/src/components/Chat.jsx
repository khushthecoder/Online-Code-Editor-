import React, { useState, useEffect, useRef } from 'react';

const Chat = ({ messages, onSendMessage }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null); 

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input); 
      setInput('');
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: '#ccc' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ marginBottom: '10px', wordWrap: 'break-word' }}>
            <strong style={{ color: '#fff' }}>{msg.username}</strong>
            <span style={{ fontSize: '10px', marginLeft: '5px', color: '#888' }}>
              ({msg.time})
            </span>
            <p style={{ margin: '0', color: '#ddd' }}>{msg.text}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} style={{ display: 'flex', padding: '10px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: '8px',
            backgroundColor: '#252526',
            border: '1px solid #555',
            color: 'white',
            borderRadius: '5px',
          }}
        />
        <button
          type="submit"
          style={{
            marginLeft: '5px',
            padding: '8px 12px',
            backgroundColor: 'green',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;