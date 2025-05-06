const Client = require('azure-iot-device').Client;
const Message = require('azure-iot-device').Message;
const Protocol = require('azure-iot-device-mqtt').Mqtt;
const winston = require('winston');

const connectionString = process.env.AZURE_IOT_DEVICE_CONNECTION_STRING;

if (!connectionString) {
  throw new Error('AZURE_IOT_DEVICE_CONNECTION_STRING is not defined in environment variables');
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

const client = Client.fromConnectionString(connectionString, Protocol);

const fetchVitalsFromDevice = async (deviceId) => {
  try {
    await client.open();
    logger.info('Connected to Azure IoT Hub', { deviceId });

    const message = new Message(JSON.stringify({ command: 'fetchVitals' }));
    await client.sendEvent(message);
    logger.info('Fetch vitals command sent to device', { deviceId });

    // Mock response for demonstration; in a real app, this would listen for a response
    const mockVitals = [
      {
        type: 'heart_rate',
        value: 72,
        unit: 'bpm',
        timestamp: new Date().toISOString(),
      },
      {
        type: 'blood_pressure',
        value: '120/80',
        unit: 'mmHg',
        timestamp: new Date().toISOString(),
      },
      {
        type: 'temperature',
        value: 36.6,
        unit: '°C',
        timestamp: new Date().toISOString(),
      },
      {
        type: 'oxygen_level',
        value: 98,
        unit: '%',
        timestamp: new Date().toISOString(),
      },
    ];

    logger.info('Vitals fetched from device', { deviceId, vitalsCount: mockVitals.length });
    await client.close();
    return mockVitals;
  } catch (err) {
    logger.error('Error fetching vitals from Azure IoT device', { deviceId, error: err.message });
    await client.close();
    throw new Error('Failed to fetch vitals from device: ' + err.message);
  }
};

module.exports = { fetchVitalsFromDevice };