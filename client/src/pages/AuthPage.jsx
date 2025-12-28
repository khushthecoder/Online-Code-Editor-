import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { GoogleIcon } from "../components/Icons"; // Ensure this component handles the icon rendering
import toast from "react-hot-toast";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const AuthPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { login } = useAuth();
    const isLoginRoute = location.pathname === "/login";
    const [isLogin, setIsLogin] = useState(isLoginRoute);
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: ""
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setIsLogin(location.pathname === "/login");
    }, [location.pathname]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleGoogleLogin = () => {
        window.location.href = `${API_URL}/api/auth/google`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
        const payload = isLogin
            ? { email: formData.email, password: formData.password }
            : formData;
        try {
            const { data } = await axios.post(`${API_URL}${endpoint}`, payload);
            if (isLogin) {
                login(data.token, data.user);
                toast.success("Logged in successfully!");
            } else {
                toast.success("Account created! Please log in.");
                navigate("/login");
            }
        } catch (error) {
            console.error("Auth Error:", error);
            toast.error(error.response?.data?.message || "Authentication failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="authPageWrapper">
            {/* Ambient Background Glows */}
            <div className="ambient-glow glow-1"></div>
            <div className="ambient-glow glow-2"></div>

            <div className="authContent">
                <div className="brandHeader">
                    <h1 className="brandLogo">
                        Compile<span>X</span>
                    </h1>
                </div>

                <div className="authCard">
                    <div className="authTabs">
                        <button
                            className={`authTab ${isLogin ? "active" : ""}`}
                            onClick={() => navigate("/login")}
                        >
                            Sign In
                        </button>
                        <button
                            className={`authTab ${!isLogin ? "active" : ""}`}
                            onClick={() => navigate("/signup")}
                        >
                            Sign Up
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {!isLogin && (
                            <div className="inputGroup">
                                <div className="inputIconWrapper">
                                    <input
                                        type="text"
                                        name="username"
                                        className="customInput"
                                        placeholder="Username"
                                        value={formData.username}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>
                        )}
                        <div className="inputGroup">
                            <div className="inputIconWrapper">
                                <input
                                    type="email"
                                    name="email"
                                    className="customInput"
                                    placeholder="Email address"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>
                        <div className="inputGroup">
                            <div className="inputIconWrapper">
                                <input
                                    type="password"
                                    name="password"
                                    className="customInput"
                                    placeholder="Password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn primaryBtn"
                            disabled={loading}
                            style={{ marginTop: '1rem' }}
                        >
                            {loading ? "Processing..." : (isLogin ? "Sign In" : "Sign Up")}
                        </button>
                    </form>

                    <div className="orDivider">
                        <span>OR CONTINUE WITH</span>
                    </div>

                    <button onClick={handleGoogleLogin} className="btn googleBtn">
                        <GoogleIcon />
                        <span>Google</span>
                    </button>

                    <div className="formFooter">
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                        <button
                            className="linkBtn"
                            onClick={() => navigate(isLogin ? "/signup" : "/login")}
                        >
                            {isLogin ? "Create one" : "Sign in"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
