const IORedis = require("ioredis");

// Horizontal scaling is opt-in via REDIS_URL. When unset the app runs exactly as
// before (single instance) — every Redis helper below becomes a no-op.
const REDIS_URL = process.env.REDIS_URL || "";
const redisEnabled = Boolean(REDIS_URL);

// ioredis auto-reconnects with backoff (handles Redis restarts / network blips),
// which is exactly the failover behavior we want.
function makeClient(role) {
  if (!redisEnabled) return null;
  const client = new IORedis(REDIS_URL, {
    // pub/sub + adapters need commands to keep retrying across reconnects.
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 200, 3000),
  });
  client.on("error", (e) => console.error(`[redis:${role}] ${e.message}`));
  client.on("ready", () => console.log(`[redis:${role}] connected`));
  client.on("reconnecting", () => console.warn(`[redis:${role}] reconnecting…`));
  return client;
}

module.exports = { redisEnabled, makeClient, REDIS_URL };
