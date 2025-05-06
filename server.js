const express = require('express');
const { Client } = require('azure-iot-device'); // Test azure-iot-device
const { Mqtt } = require('azure-iot-device-mqtt');
const dotenv = require('dotenv');

dotenv.config();
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Ashvita Backend is running!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));