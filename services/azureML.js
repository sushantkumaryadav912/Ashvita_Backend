const axios = require('axios');

const ML_ANOMALY_ENDPOINT = process.env.AZURE_ML_ANOMALY_ENDPOINT;
const ML_RISK_ENDPOINT = process.env.AZURE_ML_RISK_ENDPOINT;
const ML_RESOURCE_ENDPOINT = process.env.AZURE_ML_RESOURCE_ENDPOINT;
const ML_KEY = process.env.AZURE_ML_KEY;

if (!ML_ANOMALY_ENDPOINT || !ML_RISK_ENDPOINT || !ML_RESOURCE_ENDPOINT || !ML_KEY) {
  throw new Error('Azure ML environment variables (AZURE_ML_ANOMALY_ENDPOINT, AZURE_ML_RISK_ENDPOINT, AZURE_ML_RESOURCE_ENDPOINT, AZURE_ML_KEY) are not defined');
}

const detectAnomalies = async (vitals) => {
  try {
    if (!Array.isArray(vitals)) {
      throw new Error('Vitals must be an array');
    }
    if (vitals.some(v => !v.type || v.value === undefined || !v.unit || !v.timestamp)) {
      throw new Error('Each vital must have type, value, unit, and timestamp');
    }

    const response = await axios.post(
      ML_ANOMALY_ENDPOINT,
      { vitals },
      {
        headers: { Authorization: `Bearer ${ML_KEY}` },
      }
    );

    const anomalies = response.data.anomalies;
    if (!Array.isArray(anomalies)) {
      throw new Error('Invalid response from ML model: anomalies must be an array');
    }

    return anomalies.map(a => ({
      type: a.type || 'Unknown',
      value: a.value,
      unit: a.unit || '',
      timestamp: a.timestamp || new Date().toISOString(),
      severity: a.severity || 'info',
    }));
  } catch (err) {
    console.error('Error detecting anomalies:', err.message);
    return [];
  }
};

const predictHealthRisks = async (data) => {
  try {
    if (!data || typeof data !== 'object') {
      throw new Error('Data must be a non-empty object');
    }

    const response = await axios.post(
      ML_RISK_ENDPOINT,
      data,
      {
        headers: { Authorization: `Bearer ${ML_KEY}` },
      }
    );

    const result = response.data;
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid response from ML model: response must be an object');
    }

    return {
      riskLevel: result.riskLevel || 'Unknown',
      summary: result.summary || 'No summary available',
    };
  } catch (err) {
    console.error('Error predicting health risks:', err.message);
    return { riskLevel: 'Unknown', summary: 'Failed to predict health risks: ' + err.message };
  }
};

const findNearestEmergencyResources = async (latitude, longitude) => {
  try {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Latitude and longitude must be numbers');
    }

    const response = await axios.post(
      ML_RESOURCE_ENDPOINT,
      { location: { latitude, longitude } },
      {
        headers: { Authorization: `Bearer ${ML_KEY}` },
      }
    );

    const resources = response.data;
    if (!resources || typeof resources !== 'object') {
      throw new Error('Invalid response from ML model: resources must be an object');
    }

    return {
      hospitalId: resources.hospitalId || null,
      hospitalName: resources.hospitalName || 'Unknown Hospital',
      ambulanceId: resources.ambulanceId || null,
      estimatedArrivalTime: resources.estimatedArrivalTime || 'Unknown',
    };
  } catch (err) {
    console.error('Error finding nearest emergency resources:', err.message);
    return {
      hospitalId: null,
      hospitalName: 'Unknown Hospital',
      ambulanceId: null,
      estimatedArrivalTime: 'Unknown',
    };
  }
};

module.exports = { detectAnomalies, predictHealthRisks, findNearestEmergencyResources };