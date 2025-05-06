const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

// JWT secret key - should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Authentication middleware to protect routes
 */
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }
    
    const token = authHeader.substring(7); // Remove "Bearer " prefix
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user exists in database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, user_type')
      .eq('id', decoded.id)
      .single();
      
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token, user not found' });
    }
    
    // Add user data to request
    req.user = {
      id: user.id,
      email: user.email,
      userType: user.user_type
    };
    
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    } else if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    res.status(401).json({ error: 'Authentication error' });
  }
};

/**
 * Role-based authorization middleware
 */
const authorize = (roles = []) => {
  // Convert string to array if only one role is provided
  if (typeof roles === 'string') {
    roles = [roles];
  }
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Check if user role is included in the allowed roles
    if (roles.length && !roles.includes(req.user.userType)) {
      return res.status(403).json({ error: 'Not authorized for this action' });
    }
    
    next();
  };
};

module.exports = { auth, authorize };