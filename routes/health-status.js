// routes/health-status.js
const express = require('express');
const { getHealthStatus } = require('../controllers/health-status');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.get('/', authenticate, getHealthStatus);

module.exports = router;