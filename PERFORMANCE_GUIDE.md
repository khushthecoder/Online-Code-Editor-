# Performance & Deployment Guide

## Why Your App Feels Slow

### 1. **Socket.IO + Vercel = Bad Fit**
Your app uses **Socket.IO** for real-time collaboration. Vercel runs your backend as **serverless functions** — they spin up per request and shut down quickly. Socket.IO needs **persistent WebSocket connections** and a long-running server. On Vercel:
- WebSocket connections get dropped when functions go idle
- Each new connection can hit a cold start
- Real-time sync becomes unreliable and laggy

### 2. **No Code Splitting**
All pages (HomePage, EditorPage with CodeMirror, etc.) load in one bundle. The first load pulls in:
- CodeMirror + multiple language packs (~200KB+)
- Socket.IO client
- Editor UI
- Auth logic

Even if the user only visits the login page, they download the entire editor.

### 3. **Cold Starts**
Vercel serverless functions have cold starts (typically 200ms–2s) when idle. API calls and Socket handshakes feel slow.

---

## Next.js: Would It Help?

**Short answer: Not enough.**

| What Next.js helps with        | Your situation                    |
|--------------------------------|-----------------------------------|
| SSR, SEO                       | Less relevant for an editor app   |
| Built-in code splitting        | Vite already supports this        |
| Image optimization             | You don't use many images         |

**Next.js does not fix:**
- Socket.IO on serverless (Next.js API routes are serverless too)
- Backend cold starts
- Need for a persistent WebSocket server

**Migration effort:** High (rewrite routing, config, env, deployment).

---

## Recommended Approach

### Option A: Hybrid Deployment (Best for Your Setup)

**1. Move backend off Vercel** → Deploy to a platform with persistent Node servers:

| Platform  | Free tier | Socket.IO support | Notes                        |
|-----------|-----------|-------------------|------------------------------|
| **Railway** | 500 hrs/mo | ✅ Full support   | Easy deploy, good DX         |
| **Render**  | Free tier  | ✅ Full support   | Sleeps after 15min inactivity |
| **Fly.io**  | Free tier  | ✅ Full support   | Global, low latency          |

**2. Keep frontend on Vercel** (or move it with the backend)
- Vercel is excellent for static frontends (CDN, fast)
- Update `VITE_API_URL` and `VITE_SOCKET_URL` to your new backend URL

**3. Add lazy loading** (see Implementation below)

---

### Option B: All-in-One on Railway/Render

Deploy both frontend and backend on the same service:
- One Node server serves the built React app + API + Socket.IO
- No CORS issues, simpler env vars
- Free tier on Railway/Render is usually enough for a small app

---

### Option C: Quick Wins (Without Changing Host)

If you must stay on Vercel for now:

1. **Add route-level code splitting** — Reduces initial bundle by 40–60%
2. **Lazy load CodeMirror** — Editor chunk loads only when user opens an editor
3. **Enable Vercel Fluid** — Project Settings → Functions → Fluid compute (reduces cold starts)
4. **Compress responses** — Ensure `compression` middleware is used (if not already)

**Note:** Socket.IO will still be unreliable on Vercel. For real-time collaboration to work properly, you need a persistent backend.

---

## Implementation: Lazy Loading (Quick Win)

Add this to `frontend/src/App.jsx`:

```jsx
import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthCallback from "./pages/AuthCallback";
import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster } from "react-hot-toast";
import "./App.css";

// Lazy load heavy pages
const HomePage = lazy(() => import("./pages/HomePage"));
const EditorPage = lazy(() => import("./pages/EditorPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', color: '#9ca3af' }}>
    Loading...
  </div>
);

function App() {
  return (
    <>
      <Toaster position="top-center" />
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route path="/signup" element={<AuthPage />} />
            <Route path="/auth-callback" element={<AuthCallback />} />
            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/editor/:roomId" element={<ProtectedRoute><EditorPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

export default App;
```

This will split HomePage, EditorPage, and AuthPage into separate chunks. The editor (with CodeMirror) only loads when the user navigates to `/editor/:roomId`.

---

## Summary

| Action                    | Impact                      | Effort  |
|---------------------------|-----------------------------|---------|
| Move backend to Railway   | Fixes Socket.IO, real-time  | Medium  |
| Add lazy loading          | Faster initial load         | Low     |
| Enable Vercel Fluid       | Fewer cold starts           | Low     |
| Migrate to Next.js        | Small gain, high effort     | High    |

**Recommended order:**  
1. Add lazy loading (immediate improvement)  
2. Move backend to Railway or Render (fixes real-time and API performance)  
3. Optionally keep frontend on Vercel or colocate it with the backend
