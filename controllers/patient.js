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

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: patient, error } = await supabase
      .from('patients')
      .select(`
        id,
        user_id,
        medical_history,
        allergies,
        emergency_contacts,
        created_at,
        users!inner(name, email, user_type)
      `)
      .eq('user_id', userId)
      .single();

    if (error || !patient) {
      logger.warn('Patient not found', { userId });
      return res.status(404).json({ error: 'Patient not found' });
    }

    logger.info('Patient profile fetched successfully', { userId });
    res.status(200).json({
      success: true,
      profile: {
        id: patient.id,
        userId: patient.user_id,
        name: patient.users.name,
        email: patient.users.email,
        userType: patient.users.user_type,
        medicalHistory: patient.medical_history,
        allergies: patient.allergies,
        emergencyContacts: patient.emergency_contacts,
        createdAt: patient.created_at,
      },
    });
  } catch (err) {
    logger.error('Get patient profile error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error fetching patient profile: ' + err.message });
  }
};

exports.getMedicalRecords = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      logger.warn('Invalid startDate format', { startDate, userId });
      return res.status(400).json({ error: 'startDate must be in YYYY-MM-DD format' });
    }

    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      logger.warn('Invalid endDate format', { endDate, userId });
      return res.status(400).json({ error: 'endDate must be in YYYY-MM-DD format' });
    }

    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (patientError || !patient) {
      logger.warn('Patient not found', { userId });
      return res.status(404).json({ error: 'Patient not found' });
    }

    let query = supabase
      .from('medical_records')
      .select(`
        id,
        record_type,
        description,
        date,
        doctor_id,
        doctors!inner(user_id, users!inner(name, email))
      `)
      .eq('patient_id', patient.id)
      .order('date', { ascending: false });

    if (startDate) {
      query = query.gte('date', `${startDate}T00:00:00Z`);
    }

    if (endDate) {
      query = query.lte('date', `${endDate}T23:59:59Z`);
    }

    const { data: records, error } = await query;

    if (error) {
      logger.error('Supabase error fetching medical records', { userId, error: error.message });
      return res.status(500).json({ error: 'Failed to fetch medical records: ' + error.message });
    }

    const formattedRecords = (records || []).map(record => ({
      id: record.id,
      recordType: record.record_type,
      description: record.description,
      date: record.date,
      doctor: record.doctors ? {
        id: record.doctor_id,
        userId: record.doctors.user_id,
        name: record.doctors.users.name,
        email: record.doctors.users.email,
      } : null,
    }));

    logger.info('Medical records fetched successfully', { userId, count: formattedRecords.length });
    res.status(200).json({
      success: true,
      records: formattedRecords,
    });
  } catch (err) {
    logger.error('Get medical records error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error fetching medical records: ' + err.message });
  }
};