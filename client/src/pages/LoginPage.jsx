import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import "./AuthPage.css";
import { GoogleIcon } from "../components/Icons";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        "http://localhost:5001/api/auth/login",
        { email, password },
      );
      login(response.data.token, response.data.user);
      toast.success("Login successful!");
    } catch (error) {
      console.error("Login failed", error);
      toast.error(error.response?.data?.message || "Login failed");
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:5001/api/auth/google";
  };

  return (
    <div className="authPageWrapper">
      <h1 className="authPageTitle">
        Compile<span>X</span>
      </h1>

      <div className="authContainer">
        <div className="animationContainer">
          <div className="ring ring1"></div>
          <div className="ring ring2"></div>
          <div className="ring ring3"></div>
          <div className="core"></div>
        </div>
        <div className="formWrapper">
          <form onSubmit={handleSubmit} className="inputBox">
            <h2>Login to CompileX</h2>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
            />
            <button type="submit" className="btn submitBtn">
              Login
            </button>
          </form>
          <div className="orDivider">
            <span className="orText">OR</span>
          </div>
          <button onClick={handleGoogleLogin} className="btn googleBtn">
            <GoogleIcon />
            Sign in with Google
          </button>
          <div className="footerLink">
            Don't have an account? <Link to="/signup">Sign Up</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
