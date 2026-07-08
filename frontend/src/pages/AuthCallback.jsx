import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const AuthCallback = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const handled = useRef(false); // StrictMode double-invoke guard

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    // Token arrives in the URL fragment (#), which never reaches servers/logs.
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const token = params.get("token");
    const userParam = params.get("user");

    if (token && userParam) {
      try {
        const user = JSON.parse(decodeURIComponent(userParam));
        // Strip the token from the address bar immediately.
        window.history.replaceState(null, "", "/auth-callback");
        login(token, user);
        toast.success(`Welcome, ${user.username}!`);
      } catch (error) {
        toast.error("Google login failed. Please try again.");
        navigate("/login", { replace: true });
      }
    } else {
      toast.error("Google authentication failed.");
      navigate("/login", { replace: true });
    }
  }, [login, navigate]);

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h2>Loading...</h2>
      <p>Finalizing your Google login...</p>
    </div>
  );
};

export default AuthCallback;
