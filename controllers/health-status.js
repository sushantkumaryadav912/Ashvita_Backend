const { supabase } = require('../config/supabase');
const winston = require('winston');
const { predictHealthStatus } = require('../services/azureML');

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

exports.getHealthStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { patientId } = req.query;

    if (patientId && !patientId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
      logger.warn('Invalid patient ID format', { patientId, userId });
      return res.status(400).json({ error: 'Patient ID must be a valid UUID' });
    }

    let patientQuery = supabase
      .from('patients')
      .select('id, medical_history, allergies')
      .eq('user_id', userId);

    if (patientId) {
      patientQuery = patientQuery.eq('id', patientId);
    }

    const { data: patient, error: patientError } = await patientQuery.single();

    if (patientError || !patient) {
      logger.warn('Patient not found', { userId, patientId });
      return res.status(404).json({ error: 'Patient not found' });
    }

    const { data: recentVitals, error: vitalsError } = await supabase
      .from('vitals')
      .select('*')
      .eq('patient_id', patient.id)
      .order('timestamp', { ascending: false })
      .limit(10);

    if (vitalsError) {
      logger.error('Supabase error fetching recent vitals', { patientId: patient.id, userId, error: vitalsError.message });
      return res.status(500).json({ error: 'Failed to fetch recent vitals: ' + vitalsError.message });
    }

    const { data: recentRecords, error: recordsError } = await supabase
      .from('medical_records')
      .select('record_type, description, date')
      .eq('patient_id', patient.id)
      .order('date', { ascending: false })
      .limit(5);

    if (recordsError) {
      logger.error('Supabase error fetching recent medical records', { patientId: patient.id, userId, error: recordsError.message });
      return res.status(500).json({ error: 'Failed to fetch recent medical records: ' + recordsError.message });
    }

    const healthData = {
      vitals: (recentVitals || []).map(vital => ({
        type: vital.title,
        value: vital.value,
        unit: vital.unit,
        timestamp: vital.timestamp,
      })),
      medicalHistory: patient.medical_history || [],
      allergies: patient.allergies || [],
      recentRecords: (recentRecords || []).map(record => ({
        type: record.record_type,
        description: record.description,
        date: record.date,
      })),
    };

    const healthStatus = await predictHealthStatus(healthData);

    logger.info('Health status evaluated successfully', { patientId: patient.id, userId });
    res.status(200).json({
      success: true,
      healthStatus: {
        status: healthStatus.status,
        riskLevel: healthStatus.riskLevel,
        recommendations: healthStatus.recommendations,
        lastEvaluated: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('Get health status error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error evaluating health status: ' + err.message });
  }
};