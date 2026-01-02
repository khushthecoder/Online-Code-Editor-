import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const storedToken = localStorage.getItem("token");
      if (storedToken) {
        try {
          axios.defaults.headers.common["Authorization"] =
            `Bearer ${storedToken}`;
          
          const response = await axios.get(`${API_URL}/api/auth/me`);
          
          setUser(response.data);
          setToken(storedToken);
        } catch (error) {
          console.error("Failed to fetch user", error);
          localStorage.removeItem("token");
          setToken(null);
          setUser(null);
          delete axios.defaults.headers.common["Authorization"];
        }
      }
      setLoading(false);
    };

    fetchUser();
  }, []);
  const login = (newToken, userData) => {
    localStorage.setItem("token", newToken);
    axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(userData);
    navigate("/");
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common["Authorization"];
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};