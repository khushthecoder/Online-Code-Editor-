import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); 

  const API = axios.create({
    baseURL: 'http://localhost:5001/api', 
  });
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        localStorage.setItem('token', token);
        API.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        try {
          const response = await API.get('/auth/me'); 
          setUser(response.data); 
        } catch (error) {
          console.error("Failed to fetch user", error);
          setToken(null); 
          setUser(null);
        }
      } else {
        localStorage.removeItem('token');
        delete API.defaults.headers.common['Authorization'];
        setUser(null);
      }
      setLoading(false); 
    };
    loadUser();
  }, [token]);

  const login = async (email, password) => {
    const response = await API.post('/auth/login', { email, password });
    setToken(response.data.token); 
    setUser(response.data.user); 
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  if (loading) {
    return <div>Loading Application...</div>;
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