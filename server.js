// server.js
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const vitalsRoutes = require('./routes/vitals');
const alertsRoutes = require('./routes/alerts');
const healthStatusRoutes = require('./routes/health-status');
const patientRoutes = require('./routes/patient');
const doctorRoutes = require('./routes/doctor');
const emergencyRoutes = require('./routes/emergency');
const commsRoutes = require('./routes/comms');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/vitals', vitalsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/health-status', healthStatusRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/comms', commsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});