import React from "react";
import { useTheme } from "../context/ThemeContext";


const ThemeToggle = () => {
  const themeContext = useTheme();
  if (!themeContext) {
    return null;
  }
  const { theme, toggleTheme } = themeContext;

  const isLight = theme === "light";

  return (
    <div
      onClick={toggleTheme}
      className="group flex items-center gap-3 cursor-pointer select-none p-1 rounded-lg transition-colors hover:bg-white/5"
      title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
    >
      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide group-hover:text-gray-300 transition-colors">
        Appearance
      </span>

      <div
        className="relative flex items-center transition-all bg-[#21262d] border border-[#30363d] rounded-full active:scale-95 group-hover:border-gray-500"
        style={{
          width: '52px',
          height: '26px',
          backgroundColor: isLight ? '#bae6fd' : '#21262d',
          position: 'relative',
          overflow: 'hidden'
        }}
      >

        <div className="absolute inset-0 flex justify-between items-center px-2">
          <span style={{ fontSize: '10px', opacity: isLight ? 0 : 1, transition: 'opacity 0.3s' }}>🌙</span>
          <span style={{ fontSize: '11px', opacity: isLight ? 1 : 0, transition: 'opacity 0.3s' }}>☀️</span>
        </div>


        <div
          className="shadow-sm"
          style={{
            width: '20px',
            height: '20px',
            backgroundColor: '#ffffff',
            borderRadius: '50%',
            position: 'absolute',
            top: '2px',
            left: '2px',
            transform: isLight ? 'translateX(26px)' : 'translateX(0)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }}
        >
        </div>
      </div>
    </div>
  );
};

export default ThemeToggle;
