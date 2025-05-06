const axios = require('axios');
const winston = require('winston');

const AZURE_ML_HEALTH_ENDPOINT = process.env.AZURE_ML_HEALTH_ENDPOINT;
const AZURE_ML_RESOURCE_ENDPOINT = process.env.AZURE_ML_RESOURCE_ENDPOINT;
const AZURE_ML_API_KEY = process.env.AZURE_ML_API_KEY;

if (!AZURE_ML_HEALTH_ENDPOINT || !AZURE_ML_RESOURCE_ENDPOINT || !AZURE_ML_API_KEY) {
  throw new Error('AZURE_ML_HEALTH_ENDPOINT, AZURE_ML_RESOURCE_ENDPOINT, and AZURE_ML_API_KEY must be defined in environment variables');
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

const predictHealthStatus = async (healthData) => {
  try {
    const response = await axios.post(AZURE_ML_HEALTH_ENDPOINT, healthData, {
      headers: {
        'Authorization': `Bearer ${AZURE_ML_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const prediction = response.data;
    logger.info('Health status predicted successfully', { status: prediction.status });

    return {
      status: prediction.status || 'unknown',
      riskLevel: prediction.riskLevel || 'moderate',
      recommendations: prediction.recommendations || [],
    };
  } catch (err) {
    logger.error('Error predicting health status with Azure ML', { error: err.message });
    // Fallback mock response in case of failure
    return {
      status: 'unknown',
      riskLevel: 'moderate',
      recommendations: ['Consult a doctor for further evaluation'],
    };
  }
};

const findNearestEmergencyResources = async (latitude, longitude) => {
  try {
    const response = await axios.post(AZURE_ML_RESOURCE_ENDPOINT, {
      latitude,
      longitude,
    }, {
      headers: {
        'Authorization': `Bearer ${AZURE_ML_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const resources = response.data;
    logger.info('Emergency resources found successfully', { latitude, longitude });

    return {
      hospitalId: resources.hospitalId || 'mock-hospital-id',
      hospitalName: resources.hospitalName || 'General Hospital',
      ambulanceId: resources.ambulanceId || 'mock-ambulance-id',
      estimatedArrivalTime: resources.estimatedArrivalTime || '15 minutes',
    };
  } catch (err) {
    logger.error('Error finding nearest emergency resources with Azure ML', { latitude, longitude, error: err.message });
    // Fallback mock response in case of failure
    return {
      hospitalId: 'mock-hospital-id',
      hospitalName: 'General Hospital',
      ambulanceId: 'mock-ambulance-id',
      estimatedArrivalTime: '15 minutes',
    };
  }
};

module.exports = { predictHealthStatus, findNearestEmergencyResources };