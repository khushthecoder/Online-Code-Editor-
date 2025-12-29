import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import ReactMarkdown from "react-markdown";

const MarkdownContent = ({ content }) => {
    return (
        <div className="prose prose-invert prose-sm max-w-none text-gray-300">
            <ReactMarkdown
                components={{
                    code({ node, inline, className, children, ...props }) {
                        return !inline ? (
                            <div className="bg-[#161b22] rounded-lg border border-gray-700 p-3 my-2 overflow-x-auto text-xs font-mono">
                                <code className={className} {...props}>
                                    {children}
                                </code>
                            </div>
                        ) : (
                            <code className="bg-[#21262d] text-blue-300 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                                {children}
                            </code>
                        );
                    }
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

const AIChat = ({ code, language, onCodeChange }) => {
    const { token } = useAuth();
    const [messages, setMessages] = useState([
        { role: 'assistant', text: "Hi! I'm your AI Pair Programmer. Ask me anything about your code!" }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [isNearBottom, setIsNearBottom] = useState(true);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const bottomThreshold = 100;
        const isBottom = scrollHeight - scrollTop - clientHeight <= bottomThreshold;
        setIsNearBottom(isBottom);
    };

    useEffect(() => {
        if (isNearBottom) {
            scrollToBottom();
        }
    }, [messages, isNearBottom]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setLoading(true);
        setIsNearBottom(true);
        setTimeout(scrollToBottom, 100);

        try {
            const payload = {
                prompt: userMessage.text,
                code: code,
                language: language
            };

            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

            const response = await axios.post(`${API_URL}/api/ai/chat`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const reply = response.data.text;

            if (onCodeChange) {
                let codeToUpdate = reply;

                const codeBlockRegex = /```(?:[\w]*\n)?([\s\S]*?)```/;
                const match = reply.match(codeBlockRegex);
                if (match) {
                    codeToUpdate = match[1];
                }

                onCodeChange(codeToUpdate);
                setMessages(prev => [...prev, { role: 'assistant', text: "✅ Code updated in editor." }]);
            } else {
                const aiMessage = { role: 'assistant', text: reply };
                setMessages(prev => [...prev, aiMessage]);
            }

        } catch (error) {
            console.error("AI Chat Error:", error);
            setMessages(prev => [...prev, { role: 'assistant', text: `⚠️ ${error.response?.data?.error || "Failed to get response from AI. Please try again."}` }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-gray-900 border-r border-gray-800 relative">
            <div
                className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-4 pb-24"
                onScroll={handleScroll}
            >
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                        <div
                            className={`max-w-[90%] rounded-2xl p-3 text-[14px] leading-relaxed shadow-sm ${msg.role === 'user'
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-[#161b22] text-gray-300 border border-gray-800 rounded-bl-none'
                                }`}
                        >
                            {msg.role === 'assistant' ? (
                                <MarkdownContent content={msg.text} />
                            ) : (
                                msg.text
                            )}
                        </div>
                        <span className="text-[10px] text-gray-600 mt-1 px-1">
                            {msg.role === 'user' ? 'You' : 'AI Assistant'}
                        </span>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-[#161b22] rounded-2xl p-3 border border-gray-800 flex items-center gap-2">
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800 bg-[#0d1117] z-10">
                <form onSubmit={handleSend} className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={loading ? "Thinking..." : "Ask AI..."}
                        disabled={loading}
                        className="w-full bg-[#161b22] text-gray-200 text-[14px] rounded-xl pl-4 pr-12 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-600"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || loading}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${input.trim() && !loading
                            ? 'text-blue-400 hover:bg-blue-500/10'
                            : 'text-gray-600 cursor-not-allowed'
                            }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AIChat;
