<div align="center">

# CompileX

### A real‑time collaborative IDE — Google‑Docs‑grade editing, in‑browser code execution, AI assistance, and voice chat.

Multiple people write and run code together in the same room, talk over live voice, and get AI help — with conflict‑free editing that keeps working offline and syncs on reconnect.

</div>

---

## Overview

**CompileX** is a full‑stack, web‑based collaborative code editor. Several users can join a room and edit a multi‑file project simultaneously with live cursors, run the code, chat, and talk over real‑time voice — all in the browser.

Unlike a naive “broadcast every keystroke” editor, collaborative editing is built on **CRDTs (Yjs)**, so concurrent edits merge without conflicts, edits made **offline** are preserved and reconciled on reconnect, and the document survives page reloads and server restarts. The backend runs three real‑time protocols on a single HTTP server and can be **horizontally scaled** behind Redis with no sticky sessions.

This is a portfolio/production‑oriented project: it ships with health checks, graceful shutdown, rate limiting, CI, Docker, and one‑click deploy blueprints for Render and Vercel.

---

## Key Features

| Area | What it does |
|------|--------------|
| **Real‑time collaboration** | Conflict‑free multi‑user editing via **Yjs CRDT**, live remote cursors/selections, and shared undo/redo. |
| **Multi‑file IDE** | File/folder explorer, create/rename/move/delete, per‑file language detection — the whole project tree is a shared CRDT. |
| **Offline‑first** | Edits keep working with no network (IndexedDB persistence) and merge on reconnect; the app shell is precached (PWA) so it loads offline. |
| **In‑browser code execution** | Run Python, JavaScript, C++, and Java via **Judge0** (with a Piston fallback) — stdin, stdout, stderr, compile/runtime errors, and timeouts. |
| **AI copilot** | Inline generate / refactor / explain‑and‑fix, powered by **Google Gemini** with automatic failover to **OpenAI**. |
| **Real‑time voice** | Discord‑style room voice over **WebRTC** (mesh, $0) with mute, push‑to‑talk, live speaking indicators, and per‑user voice presence — with an optional **LiveKit SFU** path for large rooms. |
| **Version history** | Named snapshots of the full document state; restore any version. |
| **Presence & analytics** | Live participant list plus a collaboration dashboard (who’s active/idle/editing, most‑active file, activity timeline). |
| **Chat** | Per‑room chat that persists (stored in the shared CRDT doc). |
| **Authentication** | Email/password (bcrypt + JWT) and **Google OAuth 2.0**. |
| **Production‑ready** | Redis‑backed horizontal scaling, health/readiness/metrics endpoints, graceful shutdown (flushes CRDT state → zero data loss), rate limiting, CI, Docker. |

---

## Technologies Used

**Frontend**
- React 18 + Vite
- CodeMirror 6 (editor) + `y-codemirror.next` (collaborative binding)
- Yjs (CRDT), `y-websocket` (sync), `y-indexeddb` (offline persistence)
- Socket.IO client (presence, chat, voice signaling)
- `livekit-client` (optional SFU voice), WebRTC (mesh voice)
- React Router, Axios, `vite-plugin-pwa` (service worker)

**Backend**
- Node.js + Express
- Socket.IO + a custom Yjs WebSocket server (path‑routed, same HTTP server)
- Prisma ORM + PostgreSQL
- JWT (`jsonwebtoken`) + `bcryptjs`, Passport (Google OAuth)
- Redis via `ioredis` + `@socket.io/redis-adapter` (horizontal scaling)
- `@google/generative-ai` + `openai` (AI failover)
- Judge0 / Piston (code execution), `livekit-server-sdk` (voice tokens)

**Infrastructure & tooling**
- Docker, Docker Compose (multi‑instance + Redis + nginx load balancer)
- Render (backend) + Vercel (frontend) deploy blueprints
- coturn (TURN relay) / LiveKit (SFU) — optional voice scaling
- Jest + Supertest, GitHub Actions (CI)

---

## System Architecture

CompileX runs **three real‑time protocols on one HTTP server**, and scales horizontally through Redis.

```
                         ┌─────────────────────────────────────────────┐
   Browser (React SPA)   │                 Backend (Node)              │
 ┌───────────────────┐   │  ┌───────────────────────────────────────┐  │
 │ CodeMirror + Yjs  │◄──┼──┤ Yjs WebSocket server  (/collab/:room) │  │   CRDT sync
 │ IndexedDB (offline)│  │  └───────────────────────────────────────┘  │
 ├───────────────────┤   │  ┌───────────────────────────────────────┐  │
 │ Socket.IO client  │◄──┼──┤ Socket.IO (presence · chat · voice    │  │   signaling
 │                   │   │  │            signaling)                 │  │
 ├───────────────────┤   │  └───────────────────────────────────────┘  │
 │ Axios (REST)      │◄──┼──┤ Express REST (/api: auth·room·run·ai) │  │
 └─────────┬─────────┘   │  └──────────────────┬────────────────────┘  │
           │             └─────────────────────┼───────────────────────┘
           │ WebRTC (P2P audio, mesh)          │
           ▼                                   ▼
   ◄── other peers ──►                 PostgreSQL   +   Redis (pub/sub)
   (or LiveKit SFU)                  (Prisma)          fan‑out across N instances
```

- **Editing** flows through the Yjs CRDT WebSocket (`/collab/*`); every other upgrade is left to Socket.IO. Document state is debounced‑persisted to Postgres and **flushed on shutdown** so a redeploy never loses edits.
- **Presence, chat, and voice signaling** ride Socket.IO. Voice **media** is peer‑to‑peer (WebRTC mesh, $0) or routed through a LiveKit SFU when configured.
- **Horizontal scaling:** set `REDIS_URL` and every instance shares room state (Yjs updates + awareness + Socket.IO presence) via Redis pub/sub — no sticky sessions.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for a deeper dive.

---

## Project Structure

```
Online_code_editor/
├── backend/
│   ├── index.js                 # Express + Socket.IO + Yjs WS server entry point
│   ├── prisma/
│   │   ├── schema.prisma         # User, Room, Code, CollabDoc, Snapshot
│   │   └── migrations/
│   ├── src/
│   │   ├── controllers/          # auth, room, run, ai, voice
│   │   ├── routes/               # REST route definitions
│   │   ├── middleware/           # authMiddleware, rateLimiters
│   │   ├── services/
│   │   │   ├── ai/               # Gemini → OpenAI failover, prompts
│   │   │   ├── execution/        # Judge0 / Piston providers
│   │   │   └── voice/            # LiveKit token minting
│   │   ├── collab/               # Yjs WS server, persistence, Redis adapter
│   │   ├── config/               # Passport / Google OAuth setup
│   │   └── lib/                  # Redis client
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/                # EditorPage, HomePage, AuthPage, AuthCallback
│   │   ├── components/           # Editor, FileTree, History/Analytics/AI panels
│   │   ├── features/
│   │   │   ├── collab/           # Yjs provider, project tree, snapshots, analytics
│   │   │   └── voice/            # mesh + LiveKit hooks, presence, shared helpers
│   │   ├── hooks/                # useRoomSocket
│   │   ├── context/              # Auth, Theme
│   │   ├── services/             # Axios instance
│   │   └── styles/
│   ├── vite.config.js
│   └── .env.example
├── docker-compose.yml            # Postgres + Redis + 2 backends + nginx LB
├── render.yaml                   # Render blueprint (backend)
├── vercel.json                   # Vercel config (frontend only)
├── nginx.conf · redis.conf       # load balancer + Redis config
├── turnserver.conf · livekit.yaml# optional voice scaling (coturn / LiveKit)
└── ARCHITECTURE.md
```

---

## Getting Started (Local Development)

### Prerequisites

- **Node.js** v18+ and npm
- **PostgreSQL** (local install, Docker, or a free cloud instance)
- **Git**
- *(Optional)* **Docker** — for the one‑command Postgres below, or the full scaled stack

### 1. Clone & install

```bash
git clone https://github.com/khushthecoder/Online-Code-Editor-.git
cd Online-Code-Editor-

# Backend deps
cd backend && npm install

# Frontend deps
cd ../frontend && npm install
```

### 2. Start a PostgreSQL database

The quickest option is Docker:

```bash
docker run -d --name compilex-postgres \
  -e POSTGRES_USER=compilex -e POSTGRES_PASSWORD=compilex -e POSTGRES_DB=compilex \
  -p 5434:5432 postgres:16-alpine
```

This gives you `postgresql://compilex:compilex@localhost:5434/compilex?schema=public`.

### 3. Configure environment variables

**Backend** — copy the template and fill it in:

```bash
cd backend
cp .env.example .env
```

Minimum to boot locally:

```env
DATABASE_URL="postgresql://compilex:compilex@localhost:5434/compilex?schema=public"
DIRECT_URL="postgresql://compilex:compilex@localhost:5434/compilex?schema=public"
JWT_SECRET="<generate: openssl rand -hex 32>"   # server refuses to boot if < 32 chars
CLIENT_ORIGINS="http://localhost:5173"
CLIENT_URL="http://localhost:5173"
```

Optional (enable the corresponding feature): `RAPIDAPI_KEY` (code execution), `GEMINI_API_KEY` / `OPENAI_API_KEY` (AI), `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (Google login), `REDIS_URL` (scaling), `TURN_*` / `LIVEKIT_*` (voice at scale). See `backend/.env.example` for the fully documented list.

**Frontend** — for local dev the defaults already point at `http://localhost:5001`:

```bash
cd ../frontend
cp .env.example .env   # VITE_API_URL / VITE_SOCKET_URL
```

### 4. Apply database migrations

```bash
cd ../backend
npx prisma migrate deploy
```

### 5. Run it

Open two terminals:

```bash
# Terminal 1 — backend (http://localhost:5001)
cd backend && npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd frontend && npm run dev
```

Open **http://localhost:5173**, create an account (or use Google), create a room, and share the Room ID with a second browser to collaborate.

### Running the scaled stack (optional)

To run two load‑balanced backend instances with Redis + Postgres behind nginx:

```bash
docker compose up --build   # then open http://localhost:8080
```

### Environment Variables

| Variable | Side | Required | Secret | Notes |
|----------|:----:|:--------:|:------:|-------|
| `DATABASE_URL` | Backend | ✅ | ✅ | Postgres connection (pooled URL in prod). |
| `DIRECT_URL` | Backend | ✅ | ✅ | Direct (session) URL for migrations; = `DATABASE_URL` on non‑pooled DBs. |
| `JWT_SECRET` | Backend | ✅ | ✅ | ≥ 32 chars (`openssl rand -hex 32`). |
| `CLIENT_URL` | Backend | ✅ | ❌ | Frontend origin (OAuth redirect target). |
| `CLIENT_ORIGINS` | Backend | ✅ | ❌ | CORS allowlist (comma‑separated). |
| `RAPIDAPI_KEY` | Backend | ⛅ | ✅ | Judge0 code execution (RapidAPI). |
| `GEMINI_API_KEY` | Backend | ⛅ | ✅ | AI (primary). Supports `_2`/`_3`/`_4` for failover. |
| `OPENAI_API_KEY` | Backend | ⛅ | ✅ | AI (fallback). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Backend | ⛅ | ✅ | Google OAuth. |
| `REDIS_URL` | Backend | ⛅ | ✅ | Enables horizontal scaling. |
| `TURN_*` / `LIVEKIT_*` | Backend | ⛅ | ✅ | Voice at scale (NAT traversal / SFU). |
| `VITE_API_URL` | Frontend | ✅ | ❌ | Backend REST base URL. |
| `VITE_SOCKET_URL` | Frontend | ✅ | ❌ | Backend Socket.IO / WS URL. |

✅ required · ⛅ optional (feature‑gated) · Secrets must **never** be committed — `.env` is gitignored; only `.env.example` is tracked.

---

## Deployment

The repo includes ready‑to‑use blueprints for a **100% free‑tier** deployment:

- **Frontend → [Vercel](https://vercel.com/):** static build (`vercel.json`); set `VITE_API_URL` / `VITE_SOCKET_URL` to the backend URL.
- **Backend → [Render](https://render.com/):** persistent Docker web service (`render.yaml`) — required because Socket.IO and the Yjs WebSocket need a long‑lived process (they cannot run on serverless).
- **Database → [Render PostgreSQL](https://render.com/) or [Supabase](https://supabase.com/):** set `DATABASE_URL` + `DIRECT_URL`.
- **Redis (optional) →** Render Key Value / any managed Redis, via `REDIS_URL`.

> ℹ️ Migrations run automatically on deploy (`prisma migrate deploy`), and the server flushes all in‑memory CRDT documents to Postgres on shutdown, so redeploys don’t lose edits.

---

## Tech Highlights (for reviewers)

- **CRDT‑based collaboration** (Yjs) rather than last‑write‑wins broadcasting — correct concurrent merges, offline editing, and reload/restart durability.
- **Three protocols, one server** — REST, Socket.IO, and a hand‑rolled Yjs WebSocket server coexist via path‑routed upgrades.
- **Horizontal scalability** — Redis pub/sub fan‑out for both Yjs and Socket.IO; stateless instances, no sticky sessions.
- **Layered voice architecture** — a provider seam lets the same UI run over a WebRTC mesh (zero infra cost) or a LiveKit SFU, with presence unified over Socket.IO.
- **Operability** — `/healthz`, `/readyz`, `/metrics`, graceful shutdown, rate limiting, CI, and Docker.

---

## Contributing

Contributions are welcome.

1. Fork the repository and create a feature branch: `git checkout -b feat/your-feature`.
2. Make your changes; run `npm test` in `backend/` and `npm run build` in `frontend/` to verify.
3. Use clear, conventional commit messages (e.g. `feat:`, `fix:`, `refactor:`).
4. Open a pull request describing the change and its rationale.

---

## Contact

Built and maintained by **[@khushthecoder](https://github.com/khushthecoder)**.

For questions, feedback, or collaboration, please open an issue on the [GitHub repository](https://github.com/khushthecoder/Online-Code-Editor-).
