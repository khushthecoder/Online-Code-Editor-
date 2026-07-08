import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import api, { setAuthToken } from "../services/api";
import { setSocketAuth } from "../socket";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Decode a minimal user from a (non-expired) JWT so the app can start OFFLINE
// without a server round-trip. No secrets are read — just the public payload.
function userFromToken(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null; // expired
    return { id: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Keep the socket handshake token in sync with the current auth token.
  useEffect(() => {
    setSocketAuth(token);
  }, [token]);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken) {
      setLoading(false);
      return;
    }
    // Offline-first: trust a valid token immediately so the app renders even with
    // no network, then validate/refresh against the server when reachable.
    const optimistic = userFromToken(storedToken);
    if (optimistic) {
      setUser(optimistic);
      setToken(storedToken);
    }
    (async () => {
      try {
        const { data } = await api.get("/api/auth/me");
        setUser(data);
        setToken(storedToken);
      } catch (error) {
        // Only log out when the SERVER rejects the token (invalid/expired).
        // Network errors / server down / offline keep the optimistic session.
        const status = error?.response?.status;
        if (status === 401 || status === 403 || !optimistic) {
          setAuthToken(null);
          setToken(null);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(
    (newToken, userData) => {
      setAuthToken(newToken);
      setSocketAuth(newToken);
      setToken(newToken);
      setUser(userData);
      navigate("/");
    },
    [navigate],
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    setSocketAuth(null);
    setToken(null);
    setUser(null);
    navigate("/login");
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
