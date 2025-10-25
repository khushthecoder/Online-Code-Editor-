import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const AuthCallback = () => {
  const { login } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const userParam = params.get("user");

    if (token && userParam) {
      try {
        const user = JSON.parse(decodeURIComponent(userParam));
        login(token, user);

        toast.success(`Welcome, ${user.username}!`);
      } catch (error) {
        console.error("Failed to parse user data from URL", error);
        toast.error("Google login failed. Please try again.");
      }
    } else {
      toast.error("Google authentication failed.");
    }
  }, [login, location]);

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h2>Loading...</h2>
      <p>Finalizing your Google login...</p>
    </div>
  );
};

export default AuthCallback;
