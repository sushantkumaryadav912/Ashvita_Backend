const { supabase } = require('../config/supabase');
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

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.warn('No token provided in request', { path: req.path });
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) {
      logger.error('Token verification failed', { token, error: error.message });
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    if (!user.id || !user.user_metadata?.userType) {
      logger.warn('Invalid token payload', { user });
      return res.status(403).json({ error: 'Invalid token payload' });
    }

    req.user = {
      id: user.id,
      userType: user.user_metadata.userType,
      email: user.email,
      name: user.user_metadata.name,
    };
    logger.info('Token verified successfully', { userId: user.id, userType: user.user_metadata.userType });
    next();
  } catch (err) {
    logger.error('Authentication error', { error: err.message });
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authenticateToken;