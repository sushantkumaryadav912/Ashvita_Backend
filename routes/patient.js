const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const patientController = require('../controllers/patient');

// GET /api/patient/profile - Fetch user profile (patient, doctor, or admin)
router.get('/profile', authenticateToken, patientController.getProfile);

// GET /api/patient/emergency-contacts - Fetch emergency contacts (patient or admin)
router.get('/emergency-contacts', authenticateToken, patientController.getEmergencyContacts);

// GET /api/patient/medical-records - Fetch medical records (patient or admin)
router.get('/medical-records', authenticateToken, patientController.getMedicalRecords);

module.exports = router;