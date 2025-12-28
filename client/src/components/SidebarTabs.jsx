import React from 'react';

const SidebarTabs = ({ activeTab, setActiveTab }) => {
    return (
        <div className="flex items-center p-3 bg-[#0d1117] border-b border-[#30363d]">
            <div className="flex w-full bg-[#161b22] p-1 rounded-md border border-[#30363d]">
                <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-[4px] transition-all duration-200 ${activeTab === 'chat'
                        ? 'bg-[#21262d] text-gray-100 shadow-sm ring-1 ring-black/5'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#21262d]/50'
                        }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    Chat
                </button>
                <button
                    onClick={() => setActiveTab('ai')}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-[4px] transition-all duration-200 ${activeTab === 'ai'
                        ? 'bg-[#21262d] text-blue-400 shadow-sm ring-1 ring-black/5'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#21262d]/50'
                        }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 2a10 10 0 0 1 10 10H12V2z"></path><path d="M22 12h-2a8 8 0 0 0-8-8v2a6 6 0 0 1 6 6z"></path><path d="M22 12v2a8 8 0 0 1-8 8h-2a6 6 0 0 0 6-6z"></path></svg>
                    Copilot
                </button>
            </div>
        </div>
    );
};

export default SidebarTabs;
