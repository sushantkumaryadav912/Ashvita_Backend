const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const vitalsController = require('../controllers/vitals');

// GET /api/vitals - Get vital signs for a patient
router.get('/', authenticateToken, vitalsController.getVitals);

module.exports = router;