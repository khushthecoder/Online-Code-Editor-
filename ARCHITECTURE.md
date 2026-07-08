# CompileX — Architecture

CompileX is a real-time collaborative code editor: multiple authenticated users
share a room, edit code live, chat, run code against a sandboxed executor, and
use an AI copilot. This document is the 60-second mental model for the codebase.

## Tech stack

| Layer        | Technology                                                        |
|--------------|-------------------------------------------------------------------|
| Frontend     | React 18, Vite, React Router 6, CodeMirror 6, socket.io-client    |
| Backend      | Node, Express 4, Passport (Google OAuth), JWT, bcrypt             |
| Realtime     | Socket.IO 4 (JWT-authenticated handshake)                         |
| Data         | Prisma 5 → PostgreSQL (`User`, `Room`, `Code`)                    |
| Execution    | Judge0 CE via RapidAPI (provider-switch to Piston)               |
| AI           | Gemini (multi-key failover) → OpenAI; pluggable provider          |
| Tests / CI   | Jest + supertest · GitHub Actions                                 |

## Repository layout

```
Online_code_editor/
├─ backend/
│  ├─ index.js                 # app wiring, CORS, Socket.IO, crash guards, env fail-fast
│  ├─ src/
│  │  ├─ routes/               # thin HTTP routing (+ rate limiters)
│  │  ├─ controllers/          # request/response orchestration only
│  │  ├─ services/
│  │  │  ├─ execution/         # languages map · judge0 · piston · run() dispatcher
│  │  │  └─ ai/                # aiClient (failover) · prompts · aiService
│  │  ├─ middleware/           # auth, rate limiters
│  │  ├─ config/               # passport (Google OAuth)
│  │  └─ prismaClient.js       # singleton PrismaClient
│  ├─ prisma/schema.prisma
│  └─ __tests__ (co-located)   # *.test.js next to the code
├─ frontend/
│  └─ src/
│     ├─ pages/                # AuthPage, HomePage, EditorPage, AuthCallback
│     ├─ components/           # Editor, AIPromptBar, ThemeToggle, ErrorBoundary…
│     ├─ hooks/useRoomSocket   # socket lifecycle + throttled collab emits
│     ├─ context/              # AuthContext, ThemeContext
│     ├─ services/api.js       # axios instance + token interceptor
│     └─ config.js             # API/socket URL resolution
├─ docker-compose.yml          # Postgres + backend
└─ .github/workflows/ci.yml    # backend tests + frontend build
```

## Design patterns

- **Layered backend** — `routes → controllers → services`. Controllers orchestrate;
  all business logic (execution, AI failover, prompts) lives in `services/` and is unit-tested.
- **Provider strategy** — `EXEC_PROVIDER` switches Judge0 ⇄ Piston behind one normalized
  `{ ran, output, error }` contract; the AI client fails over Gemini → OpenAI.
- **Singletons** — Prisma client and the socket instance are guarded against
  hot-reload / serverless duplication.
- **Config isolation & fail-fast** — URL resolution in `config.js`; the server refuses to
  boot without a strong `JWT_SECRET` and a `DATABASE_URL`.

## Auth flow

```
POST /api/auth/register│login  → bcrypt → JWT (3d) → client (localStorage)
Bearer JWT → authMiddleware.verify → req.user{ userId, username }
GET /api/auth/google → Passport → Google → /callback → redirect  #token (URL fragment)
Rate limiters: auth 20/15m · ai│run 15/min · api 120/min
```

## Realtime collaboration flow

```
socket.auth={token} → io.use() verifies JWT → socket.data.{userId,username}
join-room{roomId}          → presence broadcast (update-user-list)
code-change{lang,newCode}  → throttle(120ms) → socket.to(room) + debounced DB save(600ms)
send-message{message}      → username taken from JWT (not client) → room broadcast
disconnect                 → recompute + broadcast user list
```

Consistency is **last-writer-wins** (no OT/CRDT yet). Presence + per-room language are
in-memory per instance — add the Socket.IO Redis adapter before running >1 instance.

## AI copilot & execution flow

```
Editor selection/cursor → POST /api/ai/chat        → aiService.complete()      → editor.dispatch()
Run error (stderr)      → POST /api/ai/explain-error → aiService.explainError() → { diagnosis, fix, correctedCode }
Run                     → POST /api/run             → execution.run() → Judge0 submit(wait=true)+poll → { ran, output, error }
```

## Deployment

Frontend is static (Vercel/any CDN). The backend must run as a **persistent** process
(Render/Railway/Fly/VM) because Socket.IO holds long-lived connections and in-memory
room state — it cannot run on stateless serverless. Point `VITE_API_URL` / `VITE_SOCKET_URL`
at the backend origin. See `backend/.env.example` for all required variables.

## Local development

```bash
# Option A — Docker (Postgres + backend)
docker compose up --build
cd frontend && npm run dev

# Option B — manual
cd backend  && cp .env.example .env && npm install && npx prisma migrate deploy && npm run dev
cd frontend && npm install && npm run dev        # http://localhost:5173
```

Run the backend test suite with `cd backend && npm test`.
