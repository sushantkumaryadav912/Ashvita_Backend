const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const healthStatusController = require('../controllers/health-status');

// GET /api/health-status - Get the health status of a patient
router.get('/', authenticateToken, healthStatusController.getHealthStatus);

module.exports = router;