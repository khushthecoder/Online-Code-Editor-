// Central resolution of backend URLs. NEVER default to localhost in production —
// a prod build with no VITE_API_URL should call the SAME origin (empty base = relative),
// because the deployment serves the API and the SPA from one origin.
const isProd = import.meta.env.PROD;

// API base for axios. '' => same-origin relative requests (e.g. /api/auth/login).
export const API_URL =
  import.meta.env.VITE_API_URL ?? (isProd ? "" : "http://localhost:5001");

// Socket.IO endpoint. In prod, default to same-origin; in dev, the local backend.
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (isProd ? window.location.origin : `http://${window.location.hostname}:5001`);
