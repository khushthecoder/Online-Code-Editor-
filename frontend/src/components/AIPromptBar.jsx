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

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <div className="w-full bg-[#0d1117] border-t border-[#30363d] p-4">
            <form onSubmit={handleSubmit} className="relative flex flex-col gap-2">
                <div className="relative flex-grow">
                    <div className="absolute left-3.5 top-5 text-blue-400 pointer-events-none z-10">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                    </div>
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask AI to modify code (e.g., 'Fix the bug', 'Add comments')..."
                        rows={4}
                        autoComplete="off"
                        className="w-full min-h-[100px] max-h-[200px] resize-y bg-[#21262d] text-[#e6edf3] text-[15px] rounded-lg pl-10 pr-14 py-4 border border-[#30363d] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 transition-colors placeholder-[#7d8590] leading-relaxed placeholder:opacity-80"
                        disabled={loading}
                        style={{ colorScheme: 'dark' }}
                    />
                    <div className="absolute right-4 bottom-4 flex items-center gap-2 text-xs text-[#7d8590] font-mono">
                        {loading ? (
                            <span className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                            </span>
                        ) : (
                            <>⏎ Send</>
                        )}
                    </div>
                </div>
            </form>
        </div>
    );
};

export default AIPromptBar;
