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

exports.getVitals = async (req, res) => {
  try {
    const userId = req.user.id;
    const { patientId, type, startDate, endDate } = req.query;

    if (patientId && !patientId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
      logger.warn('Invalid patient ID format', { patientId, userId });
      return res.status(400).json({ error: 'Patient ID must be a valid UUID' });
    }

    if (type && !['heart_rate', 'blood_pressure', 'temperature', 'oxygen_level'].includes(type)) {
      logger.warn('Invalid vital type', { type, userId });
      return res.status(400).json({ error: 'Invalid vital type, must be "heart_rate", "blood_pressure", "temperature", or "oxygen_level"' });
    }

    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      logger.warn('Invalid startDate format', { startDate, userId });
      return res.status(400).json({ error: 'startDate must be in YYYY-MM-DD format' });
    }

    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      logger.warn('Invalid endDate format', { endDate, userId });
      return res.status(400).json({ error: 'endDate must be in YYYY-MM-DD format' });
    }

    let patientQuery = supabase
      .from('patients')
      .select('id')
      .eq('user_id', userId);

    if (patientId) {
      patientQuery = patientQuery.eq('id', patientId);
    }

    const { data: patient, error: patientError } = await patientQuery.single();

    if (patientError || !patient) {
      logger.warn('Patient not found', { userId, patientId });
      return res.status(404).json({ error: 'Patient not found' });
    }

    let query = supabase
      .from('vitals')
      .select('*')
      .eq('patient_id', patient.id)
      .order('timestamp', { ascending: false });

    if (type) {
      query = query.eq('title', type);
    }

    if (startDate) {
      query = query.gte('timestamp', `${startDate}T00:00:00Z`);
    }

    if (endDate) {
      query = query.lte('timestamp', `${endDate}T23:59:59Z`);
    }

    const { data: vitals, error } = await query;

    if (error) {
      logger.error('Supabase error fetching vitals', { userId, patientId, error: error.message });
      return res.status(500).json({ error: 'Failed to fetch vitals: ' + error.message });
    }

    const formattedVitals = (vitals || []).map(vital => ({
      id: vital.id,
      type: vital.title,
      value: vital.value,
      unit: vital.unit,
      icon: vital.icon,
      color: vital.color,
      trend: vital.trend,
      timestamp: vital.timestamp,
    }));

    logger.info('Vitals fetched successfully', { userId, patientId, count: formattedVitals.length });
    res.status(200).json({
      success: true,
      vitals: formattedVitals,
    });
  } catch (err) {
    logger.error('Get vitals error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error fetching vitals: ' + err.message });
  }
};