const express = require("express");
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const { authLimiter } = require("../middleware/rateLimiters");
const prisma = require("../prismaClient");

const CLIENT_URL = process.env.CLIENT_URL || process.env.VITE_CLIENT_URL || "http://localhost:5173";

router.post("/register", authLimiter, authController.register);
router.post("/login", authLimiter, authController.login);
router.get("/me", authMiddleware, authController.getMe);
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

router.get(
  "/google/callback",
  (req, res, next) => {
    passport.authenticate("google", { session: false }, (err, user, info) => {
      if (err) {
        console.error("🔥 [AuthRoute] Passport Callback Error:", err.message);
        return res.redirect(`${CLIENT_URL}/login?error=server_error`);
      }
      if (!user) {
        console.error("🔥 [AuthRoute] No user returned from passport");
        return res.redirect(`${CLIENT_URL}/login?error=auth_failed`);
      }
      req.user = user;
      next();
    })(req, res, next);
  },
  (req, res) => {
    const user = req.user;
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "3d" },
    );
    const userDetails = {
      id: user.id,
      email: user.email,
      username: user.username,
    };
    // Deliver the token in the URL *fragment* (#), not the query string. Fragments
    // are never sent to servers or written to access logs / Referer headers, which
    // sharply reduces token leakage. AuthCallback reads it from location.hash.
    res.redirect(
      `${CLIENT_URL}/auth-callback#token=${token}&user=${encodeURIComponent(
        JSON.stringify(userDetails),
      )}`,
    );
  },
);



if (process.env.NODE_ENV !== 'production') {
  router.get("/dev-token", async (req, res) => {
    try {
      const email = "devtest@example.com";
      const username = "DevTestUser";

      let user = await prisma.user.findFirst({ where: { email } });

      if (!user) {
        user = await prisma.user.create({
          data: {
            username,
            email,
            googleId: "dev-test-id",
          },
        });
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "1d" },
      );

      const userDetails = {
        id: user.id,
        email: user.email,
        username: user.username,
      };

      res.json({ token, user: userDetails });
    } catch (error) {
      console.error("Dev Token Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = router;