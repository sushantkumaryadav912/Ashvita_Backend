const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const doctorController = require('../controllers/doctor');

// Middleware to ensure the user is a doctor
const ensureDoctor = (req, res, next) => {
  if (req.user.userType !== 'doctor') {
    return res.status(403).json({ error: 'Access denied: Doctor privileges required' });
  }
  next();
};

// GET /api/doctor/notes - Get doctor notes (optionally filtered by patientId)
router.get('/notes', authenticateToken, ensureDoctor, doctorController.getNotes);

// POST /api/doctor/notes - Create a new doctor note for a patient
router.post('/notes', authenticateToken, ensureDoctor, doctorController.createNote);

module.exports = router;