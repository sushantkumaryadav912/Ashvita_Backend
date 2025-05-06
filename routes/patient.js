const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const patientController = require('../controllers/patient');

// GET /api/patient/profile - Get the authenticated patient's profile
router.get('/profile', authenticateToken, patientController.getProfile);

// GET /api/patient/medical-records - Get the authenticated patient's medical records
router.get('/medical-records', authenticateToken, patientController.getMedicalRecords);

module.exports = router;