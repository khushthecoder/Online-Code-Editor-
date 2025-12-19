const express = require("express");
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
router.post("/register", authController.register);
router.post("/login", authController.login);
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
        console.error("Google Auth Error:", err);
        return res.redirect(`${CLIENT_URL}/login?error=server_error`);
      }
      if (!user) {
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
    res.redirect(
      `${CLIENT_URL}/auth-callback?token=${token}&user=${encodeURIComponent(
        JSON.stringify(userDetails),
      )}`,
    );
  },
);

module.exports = router;