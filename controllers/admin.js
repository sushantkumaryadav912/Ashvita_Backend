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

exports.getAllUsers = async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('auth.users')
      .select('id, email, user_metadata')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Supabase error fetching users', { userId: req.user.id, error: error.message });
      return res.status(500).json({ error: 'Failed to fetch users: ' + error.message });
    }

    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.user_metadata.name || 'Unknown',
      email: user.email,
      userType: user.user_metadata.userType || 'unknown',
      createdAt: user.created_at || new Date().toISOString(),
    }));

    logger.info('Users fetched successfully by admin', { userId: req.user.id, count: formattedUsers.length });
    res.status(200).json(formattedUsers);
  } catch (err) {
    logger.error('Get users error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error fetching users: ' + err.message });
  }
};

exports.getAllPatients = async (req, res) => {
  try {
    const { data: patients, error } = await supabase
      .from('patients')
      .select('id, name, email, userType, medical_history, allergies, emergency_contacts, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Supabase error fetching patients', { userId: req.user.id, error: error.message });
      return res.status(500).json({ error: 'Failed to fetch patients: ' + error.message });
    }

    const formattedPatients = patients.map(patient => ({
      id: patient.id,
      name: patient.name,
      email: patient.email,
      userType: patient.userType,
      medicalHistory: patient.medical_history || [],
      allergies: patient.allergies || [],
      emergencyContacts: patient.emergency_contacts || [],
      createdAt: patient.created_at,
    }));

    logger.info('Patients fetched successfully by admin', { userId: req.user.id, count: formattedPatients.length });
    res.status(200).json(formattedPatients);
  } catch (err) {
    logger.error('Get patients error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error fetching patients: ' + err.message });
  }
};

exports.getAllDoctors = async (req, res) => {
  try {
    const { data: doctors, error } = await supabase
      .from('doctors')
      .select('id, name, email, userType, specialization, licenseNumber, hospitalAffiliation, yearsOfExperience, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Supabase error fetching doctors', { userId: req.user.id, error: error.message });
      return res.status(500).json({ error: 'Failed to fetch doctors: ' + error.message });
    }

    const formattedDoctors = doctors.map(doctor => ({
      id: doctor.id,
      name: doctor.name,
      email: doctor.email,
      userType: doctor.userType,
      specialization: doctor.specialization || 'Not Provided',
      licenseNumber: doctor.licenseNumber || 'Not Provided',
      hospitalAffiliation: doctor.hospitalAffiliation || 'Not Provided',
      yearsOfExperience: doctor.yearsOfExperience || 'Not Provided',
      createdAt: doctor.created_at,
    }));

    logger.info('Doctors fetched successfully by admin', { userId: req.user.id, count: formattedDoctors.length });
    res.status(200).json(formattedDoctors);
  } catch (err) {
    logger.error('Get doctors error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error fetching doctors: ' + err.message });
  }
};