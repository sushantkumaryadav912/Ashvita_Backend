const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { getVitals } = require('../controllers/vitals');

router.get('/', authenticate, getVitals);

module.exports = router;

