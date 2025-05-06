const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const authController = require('../controllers/auth');

// POST /api/auth/register - Register a new user (patient or doctor)
router.post('/register', authController.register);

// POST /api/auth/login - Login a user and return a JWT
router.post('/login', authController.login);

// GET /api/auth/profile - Get the authenticated user's profile
router.get('/profile', authenticateToken, authController.getProfile);

// PUT /api/auth/profile - Update the authenticated user's profile
router.put('/profile', authenticateToken, authController.updateProfile);

module.exports = router;