const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const adminController = require('../controllers/admin');

// Middleware to ensure the user is an admin
const ensureAdmin = (req, res, next) => {
  if (req.user.userType !== 'admin') {
    return res.status(403).json({ error: 'Access denied: Admin privileges required' });
  }
  next();
};

// GET /api/admin/users - Get all users
router.get('/users', authenticateToken, ensureAdmin, adminController.getAllUsers);

// GET /api/admin/patients - Get all patients
router.get('/patients', authenticateToken, ensureAdmin, adminController.getAllPatients);

// GET /api/admin/doctors - Get all doctors
router.get('/doctors', authenticateToken, ensureAdmin, adminController.getAllDoctors);

module.exports = router;