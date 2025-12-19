import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { GoogleIcon } from "../components/Icons";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const AuthPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { login } = useAuth();

    // Determine mode based on URL
    const isLoginRoute = location.pathname === "/login";
    const [isLogin, setIsLogin] = useState(isLoginRoute);

    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: ""
    });
    const [isLoading, setIsLoading] = useState(false);

    // Sync state with URL
    useEffect(() => {
        setIsLogin(location.pathname === "/login");
        setFormData(prev => ({ ...prev, password: "" })); // Clear password on switch
    }, [location.pathname]);

    const toggleMode = () => {
        navigate(isLogin ? "/signup" : "/login");
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isLoading) return;
        setIsLoading(true);

        const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
        const payload = isLogin
            ? { email: formData.email, password: formData.password }
            : formData;

        try {
            const response = await axios.post(`${API_URL}${endpoint}`, payload);
            login(response.data.token, response.data.user);
            toast.success(isLogin ? "Login successful!" : "Account created successfully!");
            if (!isLogin) navigate("/");
        } catch (error) {
            console.error(error);
            toast.dismiss(); // Clear previous toasts
            toast.error(error.response?.data?.message || "Authentication failed");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        window.location.href = `${API_URL}/api/auth/google`;
    };

    return (
        <div className="authPageWrapper">
            <h1 className="authPageTitle">Compile<span>X</span></h1>

            <div className="authContainer">
                <div className="animationContainer">
                    <div className="ring ring1"></div>
                    <div className="ring ring2"></div>
                    <div className="ring ring3"></div>
                    <div className="core"></div>
                </div>

                <div className="authBox">
                    <h2>{isLogin ? "Login to CompileX" : "Create Account"}</h2>
                    <form onSubmit={handleSubmit} className="inputBox">
                        {!isLogin && (
                            <input
                                type="text"
                                name="username"
                                placeholder="Username"
                                value={formData.username}
                                onChange={handleChange}
                                required
                            />
                        )}
                        <input
                            type="email"
                            name="email"
                            placeholder="Email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                        <input
                            type="password"
                            name="password"
                            placeholder="Password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                        <button type="submit" className="btn" style={{ background: 'var(--accent-primary)', color: 'black' }} disabled={isLoading}>
                            {isLoading ? "Please wait..." : (isLogin ? "Login" : "Sign Up")}
                        </button>
                    </form>

                    <div className="orDivider"><span className="orText">OR</span></div>

                    <button onClick={handleGoogleLogin} className="btn googleBtn">
                        <GoogleIcon />
                        {isLogin ? "Sign in with Google" : "Sign up with Google"}
                    </button>

                    <div className="footerLink">
                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                        <button onClick={toggleMode}>
                            {isLogin ? "Sign Up" : "Login"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
