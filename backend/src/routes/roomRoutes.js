const express = require("express");
const router = express.Router();
const roomController = require("../controllers/roomController");
const authMiddleware = require("../middleware/authMiddleware");
const { roomLimiter } = require("../middleware/rateLimiters");
router.post("/create", authMiddleware, roomLimiter, roomController.createRoom);
router.get("/:roomId", authMiddleware, roomController.getRoom);

// Version history
router.post("/:roomId/snapshots", authMiddleware, roomController.createSnapshot);
router.get("/:roomId/snapshots", authMiddleware, roomController.listSnapshots);
router.get("/:roomId/snapshots/:snapshotId", authMiddleware, roomController.getSnapshot);

module.exports = router;
