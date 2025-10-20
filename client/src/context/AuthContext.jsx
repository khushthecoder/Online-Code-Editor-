// src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); 

  // API base URL
  const API = axios.create({
    baseURL: 'http://localhost:5000/api',
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser({ tempUser: true }); 
      setLoading(false);
    } else {
      localStorage.removeItem('token');
      delete API.defaults.headers.common['Authorization'];
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  // Login function
  const login = async (email, password) => {
    const response = await API.post('/auth/login', { email, password });
    setToken(response.data.token);
    setUser(response.data.user);
  };

  // Logout function
  const logout = () => {
    setToken(null);
  };

  if (loading) {
    return <div>Loading...</div>; 
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};


export const useAuth = () => {
  return useContext(AuthContext);
};