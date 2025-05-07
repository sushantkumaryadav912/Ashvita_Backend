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
    const userType = req.user.userType;

    // Fetch user metadata from auth.users
    const { data: user, error: userError } = await supabase
      .from('auth.users')
      .select('email, user_metadata')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      logger.warn('User not found in auth.users', { userId });
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch profile from the appropriate table
    const table = userType === 'patient' ? 'patients' : userType === 'doctor' ? 'doctors' : 'admins';
    const { data: profile, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      logger.warn('Profile not found', { userId, userType });
      return res.status(404).json({ error: 'Profile not found' });
    }

    logger.info('Profile fetched successfully', { userId, userType });

    const response = {
      success: true,
      id: profile.id,
      userId: userId,
      name: profile.name || user.user_metadata.name || 'Unknown',
      email: profile.email || user.email,
      userType: profile.userType,
      phone: profile.phone || 'Not Provided',
      dob: profile.dob || 'Not Provided',
      gender: profile.gender || 'Not Provided',
      address: profile.address || 'Not Provided',
      bloodType: profile.bloodType || 'Not Provided',
      height: profile.height || 'Not Provided',
      weight: profile.weight || 'Not Provided',
      allergies: profile.allergies || [],
      avatar: profile.avatar || null,
      medicalHistory: profile.medical_history || [],
      emergencyContacts: profile.emergency_contacts || [],
      createdAt: profile.created_at || new Date().toISOString(),
    };

    if (userType === 'doctor') {
      response.specialization = profile.specialization || 'Not Provided';
      response.licenseNumber = profile.licenseNumber || 'Not Provided';
      response.hospitalAffiliation = profile.hospitalAffiliation || 'Not Provided';
      response.yearsOfExperience = profile.yearsOfExperience || 'Not Provided';
    } else if (userType === 'admin') {
      response.role = profile.role || 'Not Provided';
      response.permissions = profile.permissions || [];
    }

    res.status(200).json(response);
  } catch (err) {
    logger.error('Get profile error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error fetching profile: ' + err.message });
  }
};

exports.getEmergencyContacts = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;

    if (userType === 'admin') {
      const { data: patients, error } = await supabase
        .from('patients')
        .select('id, emergency_contacts, name')
        .order('id');

      if (error) {
        logger.error('Supabase error fetching emergency contacts for admin', { userId, error: error.message });
        return res.status(500).json({ error: 'Failed to fetch emergency contacts: ' + error.message });
      }

      const allContacts = patients.flatMap(patient =>
        (patient.emergency_contacts || []).map((contact, index) => ({
          id: `contact-${patient.id}-${index}`,
          name: contact.name || 'Unknown Contact',
          relationship: contact.relationship || 'Not Specified',
          phone: contact.phone || 'Not Provided',
          email: contact.email || 'Not Provided',
          image: contact.image || null,
          isPrimary: contact.isPrimary || false,
          patientName: patient.name,
        }))
      );

      logger.info('Emergency contacts fetched for admin', { userId, count: allContacts.length });
      return res.status(200).json(allContacts);
    }

    if (userType !== 'patient') {
      logger.info('Emergency contacts not applicable for user type', { userId, userType });
      return res.status(200).json([]);
    }

    const { data: patient, error } = await supabase
      .from('patients')
      .select('emergency_contacts')
      .eq('id', userId)
      .single();

    if (error || !patient) {
      logger.warn('Patient not found', { userId });
      return res.status(404).json({ error: 'Patient not found' });
    }

    const contacts = (patient.emergency_contacts || []).map((contact, index) => ({
      id: `contact-${index}`,
      name: contact.name || 'Unknown Contact',
      relationship: contact.relationship || 'Not Specified',
      phone: contact.phone || 'Not Provided',
      email: contact.email || 'Not Provided',
      image: contact.image || null,
      isPrimary: contact.isPrimary || false,
    }));

    logger.info('Emergency contacts fetched successfully', { userId, count: contacts.length });
    res.status(200).json(contacts);
  } catch (err) {
    logger.error('Get emergency contacts error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error fetching emergency contacts: ' + err.message });
  }
};

exports.getMedicalRecords = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;
    const { startDate, endDate } = req.query;

    if (userType === 'admin') {
      let query = supabase
        .from('medical_records')
        .select(`
          id,
          record_type,
          description,
          date,
          patient_id,
          doctor_id,
          patients!inner(name),
          doctors!inner(name)
        `)
        .order('date', { ascending: false });

      if (startDate) {
        query = query.gte('date', `${startDate}T00:00:00Z`);
      }

      if (endDate) {
        query = query.lte('date', `${endDate}T23:59:59Z`);
      }

      const { data: records, error } = await query;

      if (error) {
        logger.error('Supabase error fetching medical records for admin', { userId, error: error.message });
        return res.status(500).json({ error: 'Failed to fetch medical records: ' + error.message });
      }

      const formattedRecords = (records || []).map(record => ({
        id: record.id,
        title: record.record_type ? `${record.record_type} - ${record.date.split('T')[0]}` : 'Record',
        date: record.date,
        patientName: record.patients.name,
        provider: record.doctors ? record.doctors.name : 'Unknown Provider',
        type: record.record_type || 'Other',
        description: record.description || 'No description provided',
        fileType: record.file_type || 'pdf',
        fileSize: record.file_size || 'Unknown',
      }));

      logger.info('Medical records fetched for admin', { userId, count: formattedRecords.length });
      return res.status(200).json(formattedRecords);
    }

    if (userType !== 'patient') {
      logger.info('Medical records not applicable for user type', { userId, userType });
      return res.status(200).json([]);
    }

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
      .eq('id', userId)
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
        doctors!inner(name)
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
      title: record.record_type ? `${record.record_type} - ${record.date.split('T')[0]}` : 'Record',
      date: record.date,
      provider: record.doctors ? record.doctors.name : 'Unknown Provider',
      type: record.record_type || 'Other',
      description: record.description || 'No description provided',
      fileType: record.file_type || 'pdf',
      fileSize: record.file_size || 'Unknown',
    }));

    logger.info('Medical records fetched successfully', { userId, count: formattedRecords.length });
    res.status(200).json(formattedRecords);
  } catch (err) {
    logger.error('Get medical records error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error fetching medical records: ' + err.message });
  }
};