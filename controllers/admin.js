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

// Middleware to ensure the user is an admin
const ensureAdmin = (req, res, next) => {
  if (req.user.userType !== 'admin') {
    logger.warn('Unauthorized access attempt by non-admin', { userId: req.user.id, userType: req.user.userType });
    return res.status(403).json({ error: 'Access denied: Admin privileges required' });
  }
  next();
};

// GET /api/admin/users - Fetch all users (patients, doctors, admins)
exports.getAllUsers = async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email, user_type, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Supabase error fetching users', { userId: req.user.id, error: error.message });
      return res.status(500).json({ error: 'Failed to fetch users: ' + error.message });
    }

    logger.info('Users fetched successfully by admin', { userId: req.user.id, count: users.length });
    res.status(200).json(users);
  } catch (err) {
    logger.error('Get users error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error fetching users: ' + err.message });
  }
};

// GET /api/admin/patients - Fetch all patients with their profiles
exports.getAllPatients = async (req, res) => {
  try {
    const { data: patients, error } = await supabase
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
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Supabase error fetching patients', { userId: req.user.id, error: error.message });
      return res.status(500).json({ error: 'Failed to fetch patients: ' + error.message });
    }

    const formattedPatients = patients.map(patient => ({
      id: patient.id,
      userId: patient.user_id,
      name: patient.users.name,
      email: patient.users.email,
      userType: patient.users.user_type,
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

// GET /api/admin/doctors - Fetch all doctors with their profiles
exports.getAllDoctors = async (req, res) => {
  try {
    const { data: doctors, error } = await supabase
      .from('doctors')
      .select(`
        id,
        user_id,
        specialization,
        license_number,
        hospital_affiliation,
        years_of_experience,
        created_at,
        users!inner(name, email, user_type)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Supabase error fetching doctors', { userId: req.user.id, error: error.message });
      return res.status(500).json({ error: 'Failed to fetch doctors: ' + error.message });
    }

    const formattedDoctors = doctors.map(doctor => ({
      id: doctor.id,
      userId: doctor.user_id,
      name: doctor.users.name,
      email: doctor.users.email,
      userType: doctor.users.user_type,
      specialization: doctor.specialization || 'General Practitioner',
      licenseNumber: doctor.license_number || 'DOC123456',
      hospitalAffiliation: doctor.hospital_affiliation || 'City Hospital',
      yearsOfExperience: doctor.years_of_experience || '10 years',
      createdAt: doctor.created_at,
    }));

    logger.info('Doctors fetched successfully by admin', { userId: req.user.id, count: formattedDoctors.length });
    res.status(200).json(formattedDoctors);
  } catch (err) {
    logger.error('Get doctors error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error fetching doctors: ' + err.message });
  }
};