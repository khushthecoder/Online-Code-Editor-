const express = require("express");
const router = express.Router();
const roomController = require("../controllers/roomController");
const authMiddleware = require("../middleware/authMiddleware");
router.post("/create", authMiddleware, roomController.createRoom);
router.get("/:roomId", authMiddleware, roomController.getRoom);

module.exports = router;
