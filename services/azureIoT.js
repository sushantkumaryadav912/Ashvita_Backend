// services/azureIoT.js
const { Client } = require('azure-iot-device');
const { Mqtt } = require('azure-iot-device-mqtt');

const getIoTData = async (userId) => {
  try {
    const connectionString = process.env.AZURE_IOT_HUB_CONNECTION_STRING;
    const client = Client.fromConnectionString(connectionString, Mqtt);

    // Simulated IoT data (replace with actual device query)
    const vitals = [
      { type: 'HeartRate', value: 72, unit: 'bpm', timestamp: new Date().toISOString() },
      { type: 'BloodPressure', value: '120/80', unit: 'mmHg', timestamp: new Date().toISOString() },
      { type: 'Oxygen', value: 98, unit: '%', timestamp: new Date().toISOString() },
    ];

    return vitals;
  } catch (err) {
    console.error('Error fetching IoT data:', err);
    return [];
  }
};

module.exports = { getIoTData };

