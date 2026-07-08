# ── CompileX backend (Express + Socket.IO + Prisma) ─────────────────────────
FROM node:20-alpine

# Prisma needs OpenSSL at runtime.
RUN apk add --no-cache openssl

WORKDIR /app

# Install deps first for better layer caching. postinstall runs `prisma generate`,
# so the schema must be present before `npm ci`.
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 5001

# Apply migrations, then start the persistent server (REST + Socket.IO).
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
