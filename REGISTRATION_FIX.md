# Fix: "Server error during registration" (500 Error)

## Root cause

The registration API returns 500 because the **database connection fails** with:

```
FATAL: Tenant or user not found
```

This typically means your **Supabase project is paused** (common on the free tier after ~7 days of inactivity).

---

## Resolution steps

### 1. Restore your Supabase project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sign in and locate the project whose reference is in your `DATABASE_URL` (e.g. `jjmtnutlyprenzlgxuaw`)
3. If it shows **"Paused"** or similar, click **Restore project**
4. Wait for it to become active (may take a few minutes)

### 2. Refresh database credentials (if needed)

After restoring, credentials may have changed:

1. In the Supabase project: **Settings** → **Database**
2. Copy the **Connection string** (URI) under "Connection string"
3. Update `DATABASE_URL` in `backend/.env` and in Vercel (see below)

Use the **Session pooler** (port 5432) or **Transaction pooler** (port 6543) URL for serverless/Vercel.

### 3. Run Prisma migrations locally

From the project root:

```bash
npm run deploy-server
```

This applies migrations and creates the required tables (User, Room, Code, etc.).

### 4. Set environment variables in Vercel

Vercel does not use `.env` files from the repo. You must configure variables in the dashboard:

1. Open your project on [vercel.com](https://vercel.com)
2. Go to **Settings** → **Environment Variables**
3. Add (or update) at least:
   - `DATABASE_URL` – your Supabase connection string
   - `JWT_SECRET` – same value as in `backend/.env`

For production, you can also add:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `VITE_CLIENT_URL` / `CLIENT_URL`
- `VITE_API_URL` (for OAuth callbacks)

### 5. Redeploy

Trigger a new deployment (push a commit or use **Redeploy** in the Vercel dashboard) so the new environment variables are applied.

---

## Optional: Reduce connection issues on serverless

If you still see occasional 500s, add this to your Supabase connection string in Vercel:

```
?connection_limit=1
```

For example:

```
postgresql://postgres.[ref]:[pass]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?connection_limit=1
```

Using the **Transaction pooler** (port 6543) with `?pgbouncer=true&connection_limit=1` can also improve reliability for serverless.
