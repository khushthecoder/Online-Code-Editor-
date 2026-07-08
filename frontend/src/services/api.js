import axios from "axios";
import { API_URL } from "../config";

// Dedicated axios instance — avoids mutating axios global defaults and attaches
// the auth token per-request via an interceptor (single source of truth).
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export const setAuthToken = (token) => {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
