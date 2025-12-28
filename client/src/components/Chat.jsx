import React, { useState, useEffect, useRef } from "react";


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
    <div className="chatWrapper flex flex-col h-full overflow-hidden bg-transparent">
      {/* Messages Area - Scrollable */}
      <div className="messageArea flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {messages.map((msg, index) => (
          <div key={index} className="message flex flex-col group animate-fadeIn">
            <div className="flex items-baseline justify-between mb-1.5 px-1">
              <span className="font-bold text-sm text-blue-400 drop-shadow-sm">{msg.username}</span>
              <span className="text-[10px] text-gray-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">{msg.time}</span>
            </div>
            <div className="bg-[#161b22] p-3.5 rounded-2xl rounded-tl-sm border border-[#30363d] text-[15px] text-gray-200 leading-relaxed shadow-sm hover:border-gray-600 transition-colors">
              <p className="break-words">{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} className="messageEnd h-2" />
      </div>

    </div>
  );
};

export default Chat;
