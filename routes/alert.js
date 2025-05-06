const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const alertController = require('../controllers/alert');

// GET /api/alerts - Fetch alerts for the authenticated user
router.get('/', authenticateToken, alertController.getAlerts);

// POST /api/alerts - Create a new alert
router.post('/', authenticateToken, alertController.createAlert);

module.exports = router;