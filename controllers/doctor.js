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

exports.getNotes = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { patientId } = req.query;

    if (patientId && !patientId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
      logger.warn('Invalid patient ID format', { patientId, doctorId });
      return res.status(400).json({ error: 'Patient ID must be a valid UUID' });
    }

    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('id')
      .eq('user_id', doctorId)
      .single();

    if (doctorError || !doctor) {
      logger.warn('Doctor not found', { doctorId });
      return res.status(404).json({ error: 'Doctor not found' });
    }

    let query = supabase
      .from('doctor_notes')
      .select(`
        id,
        note,
        created_at,
        patient_id,
        patients!inner(user_id, users!inner(name, email))
      `)
      .eq('doctor_id', doctor.id)
      .order('created_at', { ascending: false });

    if (patientId) {
      query = query.eq('patient_id', patientId);
    }

    const { data: notes, error } = await query;

    if (error) {
      logger.error('Supabase error fetching doctor notes', { doctorId, error: error.message });
      return res.status(500).json({ error: 'Failed to fetch doctor notes: ' + error.message });
    }

    const formattedNotes = (notes || []).map(note => ({
      id: note.id,
      note: note.note,
      createdAt: note.created_at,
      patient: {
        id: note.patient_id,
        userId: note.patients.user_id,
        name: note.patients.users.name,
        email: note.patients.users.email,
      },
    }));

    logger.info('Doctor notes fetched successfully', { doctorId, count: formattedNotes.length });
    res.status(200).json({
      success: true,
      notes: formattedNotes,
    });
  } catch (err) {
    logger.error('Get doctor notes error', { doctorId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error fetching doctor notes: ' + err.message });
  }
};

exports.createNote = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { patientId, note } = req.body;

    if (!patientId || !note) {
      logger.warn('Missing required fields for creating doctor note', { doctorId, body: req.body });
      return res.status(400).json({ error: 'Patient ID and note are required' });
    }

    if (!patientId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
      logger.warn('Invalid patient ID format', { patientId, doctorId });
      return res.status(400).json({ error: 'Patient ID must be a valid UUID' });
    }

    if (typeof note !== 'string' || note.length > 1000) {
      logger.warn('Invalid note length', { noteLength: note.length, doctorId });
      return res.status(400).json({ error: 'Note must be a string with max length of 1000 characters' });
    }

    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('id')
      .eq('user_id', doctorId)
      .single();

    if (doctorError || !doctor) {
      logger.warn('Doctor not found', { doctorId });
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      logger.warn('Patient not found', { patientId, doctorId });
      return res.status(404).json({ error: 'Patient not found' });
    }

    const { data: newNote, error } = await supabase
      .from('doctor_notes')
      .insert([{
        doctor_id: doctor.id,
        patient_id: patientId,
        note,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      logger.error('Supabase error creating doctor note', { doctorId, patientId, error: error.message });
      return res.status(500).json({ error: 'Failed to create doctor note: ' + error.message });
    }

    logger.info('Doctor note created successfully', { doctorId, patientId, noteId: newNote.id });
    res.status(201).json({
      success: true,
      note: {
        id: newNote.id,
        note: newNote.note,
        createdAt: newNote.created_at,
        patientId: newNote.patient_id,
      },
    });
  } catch (err) {
    logger.error('Create doctor note error', { doctorId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error creating doctor note: ' + err.message });
  }
};