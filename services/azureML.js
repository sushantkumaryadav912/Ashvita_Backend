// services/azureML.js
const axios = require('axios');

const detectAnomalies = async (vitals) => {
  try {
    const mlEndpoint = process.env.AZURE_ML_ANOMALY_ENDPOINT;
    const response = await axios.post(
      mlEndpoint,
      { vitals },
      {
        headers: { Authorization: `Bearer ${process.env.AZURE_ML_KEY}` },
      }
    );

    // Simulated response (replace with actual ML model output)
    return response.data.anomalies || [];
  } catch (err) {
    console.error('Error detecting anomalies:', err);
    return [];
  }
};

const predictHealthRisks = async (data) => {
  try {
    const mlEndpoint = process.env.AZURE_ML_RISK_ENDPOINT;
    const response = await axios.post(
      mlEndpoint,
      data,
      {
        headers: { Authorization: `Bearer ${process.env.AZURE_ML_KEY}` },
      }
    );

    // Simulated response (replace with actual ML model output)
    return response.data || { riskLevel: 'Stable', summary: 'No immediate concerns' };
  } catch (err) {
    console.error('Error predicting health risks:', err);
    return { riskLevel: 'Unknown', summary: 'Failed to predict health risks' };
  }
};

module.exports = { detectAnomalies, predictHealthRisks };