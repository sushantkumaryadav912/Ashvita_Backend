const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const commsController = require('../controllers/comms');

// POST /api/comms/sessions - Create a new communication session
router.post('/sessions', authenticateToken, commsController.createSession);

// PUT /api/comms/sessions/:sessionId/end - End a communication session
router.put('/sessions/:sessionId/end', authenticateToken, commsController.endSession);

// GET /api/comms/sessions - Get all sessions for the authenticated user
router.get('/sessions', authenticateToken, commsController.getSessions);

// POST /api/comms/sessions/:sessionId/join - Join a communication session
router.post('/sessions/:sessionId/join', authenticateToken, commsController.joinSession);

// POST /api/comms/sessions/:sessionId/leave - Leave a communication session
router.post('/sessions/:sessionId/leave', authenticateToken, commsController.leaveSession);

// GET /api/comms/sessions/:sessionId/participants - Get participants of a session
router.get('/sessions/:sessionId/participants', authenticateToken, commsController.getSessionParticipants);

module.exports = router;