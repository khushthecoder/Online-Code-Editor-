import React from 'react';
import { useAuth } from '../context/AuthContext'; 

const HomePage = () => {
  const { logout } = useAuth(); 

  return (
    <div>
      <h2>Welcome to the Code Editor Homepage!</h2>
      <p>You are logged in.</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

export default HomePage;