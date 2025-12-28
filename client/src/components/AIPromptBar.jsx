import React, { useState } from 'react';

const AIPromptBar = ({ onSubmit, loading }) => {
    const [input, setInput] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (input.trim() && !loading) {
            onSubmit(input);
            setInput('');
        }
    };

    return (
        <div className="w-full bg-[#0d1117] border-t border-gray-800 p-2">
            <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
                <div className="relative flex-grow">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                    </div>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask AI to modify code (e.g., 'Fix the bug', 'Add comments')..."
                        className="w-full bg-[#161b22] text-gray-200 text-sm rounded-md pl-9 pr-12 py-2 border border-gray-700 focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-600"
                        disabled={loading}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-mono">
                        ⏎
                    </div>
                </div>
                {loading && (
                    <div className="absolute right-12 top-1/2 -translate-y-1/2 flex gap-1">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                )}
            </form>
        </div>
    );
};

export default AIPromptBar;
