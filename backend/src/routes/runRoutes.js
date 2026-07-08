const express = require("express");
const router = express.Router();
const { runCode } = require("../controllers/runController");
const authMiddleware = require("../middleware/authMiddleware");
const { aiLimiter } = require("../middleware/rateLimiters");

router.post("/", authMiddleware, aiLimiter, runCode);

module.exports = router;
