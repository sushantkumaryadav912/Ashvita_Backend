const jwt = require('jsonwebtoken');
const winston = require('winston');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be defined in environment variables');
}

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

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.warn('No token provided in request', { path: req.path });
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      logger.error('Token verification failed', { token, error: err.message });
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    if (!user.id || !user.userType) {
      logger.warn('Invalid token payload', { user });
      return res.status(403).json({ error: 'Invalid token payload' });
    }

    req.user = user;
    logger.info('Token verified successfully', { userId: user.id, userType: user.userType });
    next();
  });
};

module.exports = authenticateToken;