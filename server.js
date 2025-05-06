require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patient');
const doctorRoutes = require('./routes/doctor');
const emergencyRoutes = require('./routes/emergency');
const commsRoutes = require('./routes/comms');
const vitalsRoutes = require('./routes/vitals');
const alertsRoutes = require('./routes/alert');
const healthStatusRoutes = require('./routes/health-status');

const requiredEnvVars = [
  'PORT',
  'SUPABASE_URL',
  'SUPABASE_KEY',
  'JWT_SECRET',
  'FRONTEND_URL',
];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
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

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

app.get('/', (req, res) => {
  logger.info('Root route accessed');
  res.send('Welcome to Smart Health Chain server');
});

app.get('/health', (req, res) => {
  logger.info('Health check accessed');
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/comms', commsRoutes);
app.use('/api/vitals', vitalsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/health-status', healthStatusRoutes);

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const statusCode = err.statusCode || 500;
  const errorMessage = statusCode === 500 ? 'Internal server error' : err.message;

  res.status(statusCode).json({
    error: errorMessage,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Performing graceful shutdown...');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', {
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', {
    promise,
    reason: reason instanceof Error ? reason.message : reason,
  });
});