const express = require("express");
const { getAICompletion, explainError } = require("../controllers/aiController");
const authMiddleware = require("../middleware/authMiddleware");
const { aiLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

router.post("/chat", authMiddleware, aiLimiter, getAICompletion);
router.post("/explain-error", authMiddleware, aiLimiter, explainError);

module.exports = router;
