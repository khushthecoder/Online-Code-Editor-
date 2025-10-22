const express = require('express');
const router = express.Router();
const { createRoom, getRoom } = require('../controllers/roomController'); 
const { authMiddleware } = require('../middleware/authMiddleware');
router.post('/create', authMiddleware, createRoom);
router.get('/:roomId', authMiddleware, getRoom);
module.exports = router;