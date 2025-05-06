const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const emergencyController = require('../controllers/emergency');

// POST /api/emergency/trigger - Trigger an emergency for the authenticated user
router.post('/trigger', authenticateToken, emergencyController.triggerEmergency);

// POST /api/emergency/trigger-by-qr - Trigger an emergency via QR code (no auth required)
router.post('/trigger-by-qr', emergencyController.triggerEmergencyByQR);

// GET /api/emergency/status - Get emergency status for the authenticated user
router.get('/status', authenticateToken, emergencyController.getEmergencyStatus);

// POST /api/emergency/cancel - Cancel an active emergency
router.post('/cancel', authenticateToken, emergencyController.cancelEmergency);

module.exports = router;