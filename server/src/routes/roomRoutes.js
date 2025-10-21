const express = require('express'); 
const router = express.Router(); 
const { createRoom } = require('../controllers/roomController'); 
const { authMiddleware } = require('../middleware/authMiddleware');
router.post('/create', authMiddleware, createRoom);
module.exports = router;