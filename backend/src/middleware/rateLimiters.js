const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

const message = (msg) => ({ message: msg });

// Key expensive endpoints by authenticated user id (not IP), so collaborators
// behind one NAT don't share a bucket and one user can't fan out across IPs to
// dodge the cap. Falls back to the (IPv6-safe) IP for any unauthenticated hit.
const byUser = (req) => req.user?.userId || ipKeyGenerator(req.ip);

// Strict limiter for auth endpoints — blunts password brute-force / credential stuffing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: message("Too many attempts. Please try again in a few minutes."),
});

// Moderate limiter for expensive AI / code-execution endpoints — caps runaway cost.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byUser, // per authenticated user (auth runs before this limiter)
  message: message("You're doing that too fast. Please slow down."),
});

// Caps room creation per user — blunts squatting / spam of the Room table without
// hindering normal use (creating a handful of rooms is fine).
const roomLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byUser, // per authenticated user (auth runs before this limiter)
  message: message("Too many rooms created. Please wait a few minutes."),
});

// General limiter applied to the whole API as a backstop.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: message("Too many requests. Please slow down."),
});

module.exports = { authLimiter, aiLimiter, roomLimiter, apiLimiter };
