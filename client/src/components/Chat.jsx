import React, { useState, useEffect, useRef } from "react";
import "./Chat.css";

const Chat = ({ messages, onSendMessage }) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput("");
    }
  };

  return (
    <div className="chatWrapper">
      <div className="messageArea">
        {messages.map((msg, index) => (
          <div key={index} className="message">
            <strong>{msg.username}</strong>
            <span>({msg.time})</span>
            <p>{msg.text}</p>
          </div>
        ))}
        <div ref={messagesEndRef} className="messageEnd" />
      </div>

      <form onSubmit={handleSend} className="chatForm">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="chatInput"
        />
        <button type="submit" className="sendBtn">
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;
