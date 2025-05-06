const { supabase } = require('../config/supabase');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be defined in environment variables');
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

exports.register = async (req, res) => {
  try {
    const { name, email, password, userType } = req.body;

    if (!name || !email || !password || !userType) {
      logger.warn('Missing required fields for registration', { body: req.body });
      return res.status(400).json({ error: 'Name, email, password, and user type are required' });
    }

    if (!['patient', 'doctor', 'admin'].includes(userType)) {
      logger.warn('Invalid user type', { userType });
      return res.status(400).json({ error: 'User type must be "patient", "doctor", or "admin"' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      logger.warn('Invalid email format', { email });
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 8) {
      logger.warn('Password too short', { email });
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      logger.warn('User already exists', { email });
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    if (userError && userError.code !== 'PGRST116') {
      logger.error('Supabase error checking existing user', { email, error: userError.message });
      return res.status(500).json({ error: 'Failed to check existing user: ' + userError.message });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{
        id: uuidv4(),
        name,
        email,
        password: hashedPassword,
        user_type: userType,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (insertError) {
      logger.error('Supabase error creating user', { email, error: insertError.message });
      return res.status(500).json({ error: 'Failed to create user: ' + insertError.message });
    }

    let profileTable;
    if (userType === 'patient') profileTable = 'patients';
    else if (userType === 'doctor') profileTable = 'doctors';
    else if (userType === 'admin') profileTable = 'admins';

    const { error: profileError } = await supabase
      .from(profileTable)
      .insert([{
        user_id: newUser.id,
        created_at: new Date().toISOString(),
      }]);

    if (profileError) {
      logger.error('Supabase error creating profile', { userId: newUser.id, userType, error: profileError.message });
      return res.status(500).json({ error: 'Failed to create profile: ' + profileError.message });
    }

    const token = jwt.sign({ id: newUser.id, userType }, JWT_SECRET, { expiresIn: '1h' });

    logger.info('User registered successfully', { userId: newUser.id, userType });
    res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        userType: newUser.user_type,
      },
      token,
    });
  } catch (err) {
    logger.error('Register error', { error: err.message });
    res.status(500).json({ error: 'Server error during registration: ' + err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      logger.warn('Missing email or password for login', { body: req.body });
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      logger.warn('User not found during login', { email });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logger.warn('Invalid password during login', { email });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, userType: user.user_type }, JWT_SECRET, { expiresIn: '1h' });

    logger.info('User logged in successfully', { userId: user.id, userType: user.user_type });
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        userType: user.user_type,
      },
      token,
    });
  } catch (err) {
    logger.error('Login error', { error: err.message });
    res.status(500).json({ error: 'Server error during login: ' + err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, user_type')
      .eq('id', userId)
      .single();

    if (error || !user) {
      logger.warn('User not found', { userId });
      return res.status(404).json({ error: 'User not found' });
    }

    const supportedUserTypes = ['patient', 'doctor', 'admin'];
    if (!supportedUserTypes.includes(user.user_type)) {
      logger.warn('Unsupported user type', { userId, userType: user.user_type });
      return res.status(400).json({ error: `User type "${user.user_type}" is not supported` });
    }

    const baseProfile = {
      success: true,
      id: user.id,
      name: user.name,
      email: user.email,
      userType: user.user_type,
      phone: user.phone || '123-456-7890',
      dob: user.dob || (user.user_type === 'patient' ? '1990-01-01' : user.user_type === 'doctor' ? '1980-01-01' : '1975-01-01'),
      gender: user.gender || 'Not Specified',
      address: user.address || (user.user_type === 'patient' ? '123 Health St, City, Country' : user.user_type === 'doctor' ? '456 Medical Ave, City, Country' : '789 Admin Blvd, City, Country'),
      avatar: null,
    };

    if (user.user_type === 'patient') {
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('medical_history, allergies, emergency_contacts')
        .eq('user_id', userId)
        .single();

      if (patientError || !patient) {
        logger.warn('Patient profile not found', { userId });
        return res.status(404).json({ error: 'Patient profile not found' });
      }

      logger.info('Patient profile fetched successfully', { userId });
      res.status(200).json({
        ...baseProfile,
        bloodType: patient.blood_type || 'O+',
        height: patient.height || '170 cm',
        weight: patient.weight || '70 kg',
        allergies: patient.allergies || [],
        medicalHistory: patient.medical_history || [],
        emergencyContacts: patient.emergency_contacts || [],
      });
    } else if (user.user_type === 'doctor') {
      const { data: doctor, error: doctorError } = await supabase
        .from('doctors')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (doctorError || !doctor) {
        logger.warn('Doctor profile not found', { userId });
        return res.status(404).json({ error: 'Doctor profile not found' });
      }

      logger.info('Doctor profile fetched successfully', { userId });
      res.status(200).json({
        ...baseProfile,
        specialization: doctor.specialization || 'General Practitioner',
        licenseNumber: doctor.license_number || 'DOC123456',
        hospitalAffiliation: doctor.hospital_affiliation || 'City Hospital',
        yearsOfExperience: doctor.years_of_experience || '10 years',
      });
    } else if (user.user_type === 'admin') {
      const { data: admin, error: adminError } = await supabase
        .from('admins')
        .select('role, permissions')
        .eq('user_id', userId)
        .single();

      if (adminError || !admin) {
        logger.warn('Admin profile not found', { userId });
        return res.status(404).json({ error: 'Admin profile not found' });
      }

      logger.info('Admin profile fetched successfully', { userId });
      res.status(200).json({
        ...baseProfile,
        role: admin.role || 'Super Admin',
        permissions: admin.permissions || ['manage_users', 'view_reports'],
      });
    }
  } catch (err) {
    logger.error('Get profile error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error fetching profile: ' + err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email } = req.body;

    if (!name && !email) {
      logger.warn('No fields provided for profile update', { userId });
      return res.status(400).json({ error: 'At least one field (name or email) must be provided for update' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      logger.warn('Invalid email format during profile update', { email, userId });
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Supabase error updating profile', { userId, error: error.message });
      return res.status(500).json({ error: 'Failed to update profile: ' + error.message });
    }

    logger.info('Profile updated successfully', { userId });
    res.status(200).json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        userType: updatedUser.user_type,
      },
    });
  } catch (err) {
    logger.error('Update profile error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error updating profile: ' + err.message });
  }
};