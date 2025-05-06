const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const doctorController = require('../controllers/doctor');

// GET /api/doctor/notes - Get doctor notes (optionally filtered by patientId)
router.get('/notes', authenticateToken, doctorController.getNotes);

// POST /api/doctor/notes - Create a new doctor note for a patient
router.post('/notes', authenticateToken, doctorController.createNote);

module.exports = router;