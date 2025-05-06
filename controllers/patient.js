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
      id: patient.id,
      userId: patient.user_id,
      name: patient.users.name,
      email: patient.users.email,
      userType: patient.users.user_type,
      phone: patient.users.phone || '123-456-7890',
      dob: patient.users.dob || '1990-01-01',
      gender: patient.users.gender || 'Not Specified',
      address: patient.users.address || '123 Health St, City, Country',
      bloodType: patient.blood_type || 'O+',
      height: patient.height || '170 cm',
      weight: patient.weight || '70 kg',
      allergies: patient.allergies || [],
      medicalHistory: patient.medical_history || [],
      createdAt: patient.created_at,
    });
  } catch (err) {
    logger.error('Get patient profile error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error fetching patient profile: ' + err.message });
  }
};

exports.getEmergencyContacts = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;

    if (userType === 'admin') {
      const { data: patients, error } = await supabase
        .from('patients')
        .select('emergency_contacts, user_id, users!inner(name)')
        .order('user_id');

      if (error) {
        logger.error('Supabase error fetching emergency contacts for admin', { userId, error: error.message });
        return res.status(500).json({ error: 'Failed to fetch emergency contacts: ' + error.message });
      }

      const allContacts = patients.flatMap(patient => 
        (patient.emergency_contacts || []).map((contact, index) => ({
          id: `contact-${patient.user_id}-${index}`,
          name: contact.name || 'Unknown Contact',
          relationship: contact.relationship || 'Not Specified',
          phone: contact.phone || 'Not Provided',
          email: contact.email || 'Not Provided',
          image: contact.image || null,
          isPrimary: contact.isPrimary || false,
          patientName: patient.users.name,
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
      .eq('user_id', userId)
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
          patients!inner(user_id, users!inner(name)),
          doctor_id,
          doctors!inner(user_id, users!inner(name))
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
        title: record.title || `${record.record_type} - ${record.date.split('T')[0]}`,
        date: record.date,
        patientName: record.patients.users.name,
        provider: record.doctors ? record.doctors.users.name : 'Unknown Provider',
        type: record.record_type || 'Other',
        description: record.description || 'No description provided',
        fileType: record.file_type || 'pdf',
        fileSize: record.file_size || '1.2 MB',
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
      title: record.title || `${record.record_type} - ${record.date.split('T')[0]}`,
      date: record.date,
      provider: record.doctors ? record.doctors.users.name : 'Unknown Provider',
      type: record.record_type || 'Other',
      description: record.description || 'No description provided',
      fileType: record.file_type || 'pdf',
      fileSize: record.file_size || '1.2 MB',
    }));

    logger.info('Medical records fetched successfully', { userId, count: formattedRecords.length });
    res.status(200).json(formattedRecords);
  } catch (err) {
    logger.error('Get medical records error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error fetching medical records: ' + err.message });
  }
};