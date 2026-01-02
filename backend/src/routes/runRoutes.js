const express = require("express");
const router = express.Router();
const { runCode } = require("../controllers/runController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, runCode);

module.exports = router;
