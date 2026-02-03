# Environment Variables Guide

## Vercel (Frontend)

Set these in **Vercel Dashboard → Your Project → Settings → Environment Variables**.

Frontend env vars are **baked in at build time** (Vite). Redeploy after changing them.

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_API_URL` | `https://online-code-editor-m9js.onrender.com` | ✅ Yes |
| `VITE_SOCKET_URL` | `https://online-code-editor-m9js.onrender.com` | ✅ Yes |

> **Note:** Use your actual Vercel app URL for the frontend. The frontend only needs to know where the backend (Render) is.

---

## Render (Backend)

Set these in **Render Dashboard → Your Web Service → Environment**.

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | `postgresql://...` (from Supabase) | ✅ Yes |
| `JWT_SECRET` | Your secret key (e.g. `hellothisisparth`) | ✅ Yes |
| `VITE_CLIENT_URL` | `https://online-code-editor-sepia-one.vercel.app` | ✅ Yes (CORS + OAuth redirect) |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console | ✅ Yes (for Google login) |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console | ✅ Yes (for Google login) |
| `GEMINI_API_KEY` | From Google AI Studio | ✅ Yes (for AI Copilot) |
| `GEMINI_API_KEY_2` | Backup/fallback key | Optional |
| `GEMINI_API_KEY_3` | Backup/fallback key | Optional |
| `GEMINI_API_KEY_4` | Backup/fallback key | Optional |
| `OPENAI_API_KEY` | From OpenAI | Optional (AI fallback) |
| `PISTON_API_KEY` | From RapidAPI (if using Piston) | Optional |
| `NODE_ENV` | `production` | Auto-set by Render |

### Auto-set by Render (no action needed)

| Variable | Description |
|----------|-------------|
| `PORT` | Port the server listens on |
| `RENDER_EXTERNAL_URL` | Your Render URL (e.g. `https://online-code-editor-m9js.onrender.com`) – used for self-ping and Google OAuth callback |

---

## Google OAuth Setup

In [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials:

1. **Authorized JavaScript origins:**
   - `https://online-code-editor-sepia-one.vercel.app`
   - `http://localhost:5173` (for local dev)

2. **Authorized redirect URIs:**
   - `https://online-code-editor-m9js.onrender.com/api/auth/google/callback`
   - `http://localhost:5001/api/auth/google/callback` (for local dev)

---

## Google OAuth "Unauthorized" fix

If you see `?error=server_error&details=Unauthorized` after clicking the Google button:

1. **Google Cloud Console** → APIs & Services → Credentials → Your OAuth 2.0 Client
2. Under **Authorized redirect URIs**, add exactly:
   ```
   https://online-code-editor-m9js.onrender.com/api/auth/google/callback
   ```
3. Under **Authorized JavaScript origins**, add:
   ```
   https://online-code-editor-sepia-one.vercel.app
   ```
4. **Render** → Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct (no extra spaces).
5. `RENDER_EXTERNAL_URL` is auto-set by Render and used for the callback URL.

---

## Quick checklist

### Vercel (Frontend)
- [ ] `VITE_API_URL` = `https://online-code-editor-m9js.onrender.com`
- [ ] `VITE_SOCKET_URL` = `https://online-code-editor-m9js.onrender.com`
- [ ] Redeploy after changes

### Render (Backend)
- [ ] `DATABASE_URL` (Supabase)
- [ ] `JWT_SECRET`
- [ ] `VITE_CLIENT_URL` (your Vercel frontend URL)
- [ ] `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`
- [ ] `GEMINI_API_KEY` (at least one)
