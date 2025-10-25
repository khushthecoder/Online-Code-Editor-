import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import "./AuthPage.css";
import { GoogleIcon } from "../components/Icons";

const SignupPage = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        "http://localhost:5001/api/auth/register",
        {
          username,
          email,
          password,
        },
      );
      login(response.data.token, response.data.user);
      toast.success("Account created successfully!");
      navigate("/");
    } catch (error) {
      console.error("Signup failed", error);
      toast.error(error.response?.data?.message || "Signup failed");
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:5001/api/auth/google";
  };

  return (
    <div className="authPageWrapper">
      <h1 className="authPageTitle">CompileX</h1>
      <div className="authContainer">
        <div className="animationContainer">
          <div className="ring ring1"></div>
          <div className="ring ring2"></div>
          <div className="ring ring3"></div>
          <div className="core"></div>
        </div>

        <div className="formWrapper">
          <form onSubmit={handleSubmit} className="inputBox">
            <h2>Create a New Account</h2>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required
            />
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
              Sign Up
            </button>
          </form>
          <div className="orDivider">
            <span className="orText">OR</span>
          </div>
          <button onClick={handleGoogleLogin} className="btn googleBtn">
            <GoogleIcon />
            Sign up with Google
          </button>

          <div className="footerLink">
            Already have an account? <Link to="/login">Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
