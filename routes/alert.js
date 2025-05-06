// routes/alerts.js
const express = require('express');
const { getAlerts } = require('../controllers/alerts');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.get('/', authenticate, getAlerts);

module.exports = router;