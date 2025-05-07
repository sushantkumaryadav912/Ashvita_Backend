const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const adminController = require('../controllers/admin');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Middleware to ensure the user is an admin
const ensureAdmin = (req, res, next) => {
  if (req.user.userType !== 'admin') {
    logger.warn('Unauthorized access attempt by non-admin', { userId: req.user.id, userType: req.user.userType });
    return res.status(403).json({ error: 'Access denied: Admin privileges required' });
  }
  next();
};

// GET /api/admin/users - Get all users from auth.users
router.get('/users', authenticateToken, ensureAdmin, adminController.getAllUsers);

// GET /api/admin/patients - Get all patients
router.get('/patients', authenticateToken, ensureAdmin, adminController.getAllPatients);

// GET /api/admin/doctors - Get all doctors
router.get('/doctors', authenticateToken, ensureAdmin, adminController.getAllDoctors);

module.exports = router;