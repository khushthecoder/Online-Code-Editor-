const express = require("express");
const { getAICompletion } = require("../controllers/aiController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/chat", authMiddleware, getAICompletion);

module.exports = router;
