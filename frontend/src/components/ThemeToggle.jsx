import React from 'react';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  const label = isLight ? "Switch to Dark Mode" : "Switch to Light Mode";

  return (
    <div
      onClick={toggleTheme}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleTheme();
        }
      }}
      role="switch"
      aria-checked={isLight}
      aria-label={label}
      tabIndex={0}
      className="flex items-center gap-3 cursor-pointer group select-none transition-opacity hover:opacity-100 opacity-80"
      title={label}
      style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
    >

      <div
        style={{
          position: 'relative',
          width: '44px',
          height: '24px',
          backgroundColor: isLight ? '#e5e7eb' : '#21262d',
          border: isLight ? '1px solid #d1d5db' : '1px solid #30363d',
          borderRadius: '999px',
          transition: 'background-color 0.3s, border-color 0.3s',
          display: 'flex',
          alignItems: 'center',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)'
        }}
      >

        <div
          style={{
            width: '18px',
            height: '18px',
            backgroundColor: isLight ? '#1f2937' : '#f3f4f6',
            borderRadius: '50%',
            position: 'absolute',
            left: '2px',
            transform: isLight ? 'translateX(20px)' : 'translateX(0)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
          }}
        />
      </div>


      <div style={{ fontSize: '12px', fontWeight: 'bold', color: isLight ? '#374151' : '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px', minWidth: '60px' }}>
        {isLight ? (
          <>
            <span>☀️</span> Light
          </>
        ) : (
          <>
            <span>🌙</span> Dark
          </>
        )}
      </div>
    </div>
  );
};

export default ThemeToggle;
