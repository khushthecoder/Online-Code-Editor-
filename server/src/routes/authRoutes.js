const express = require("express");
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const CLIENT_URL = process.env.VITE_CLIENT_URL || "http://localhost:5173";
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
  passport.authenticate("google", {
    session: false,
    failureRedirect: "http://localhost:5173/login",
  }),
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
      `http://localhost:5173/auth-callback?token=${token}&user=${encodeURIComponent(
        JSON.stringify(userDetails),
      )}`,
    );
  },
);

module.exports = router;
