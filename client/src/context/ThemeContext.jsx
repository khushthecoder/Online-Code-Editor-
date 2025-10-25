import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("app-theme") || "dark";
    } catch (e) {
      return "dark";
    }
  });

  useEffect(() => {
    try {
      document.documentElement.classList.remove("dark-theme", "light-theme");
      document.documentElement.classList.add(
        theme === "dark" ? "dark-theme" : "light-theme",
      );
      localStorage.setItem("app-theme", theme);
    } catch (e) {}
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const value = { theme, toggleTheme };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
