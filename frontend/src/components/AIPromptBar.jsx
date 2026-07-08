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
    <div className="ed-prompt">
      <form onSubmit={handleSubmit}>
        <span className="ico">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
        </span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI to modify code…"
          disabled={loading}
          aria-label="AI prompt"
        />
        {loading ? (
          <span className="dots"><i /><i /><i /></span>
        ) : (
          <span className="enter">⏎</span>
        )}
      </form>
    </div>
  );
};

export default AIPromptBar;
