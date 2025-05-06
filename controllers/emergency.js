const { supabase } = require('../config/supabase');
const winston = require('winston');
const { findNearestEmergencyResources } = require('../services/azureML');

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

exports.triggerEmergency = async (req, res) => {
  try {
    const userId = req.user.id;
    const { location, notes, currentVitals } = req.body;

    if (!location || !location.latitude || !location.longitude) {
      logger.warn('Missing or invalid location data', { userId, body: req.body });
      return res.status(400).json({ error: 'Location with latitude and longitude is required' });
    }

    if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      logger.warn('Invalid location coordinates', { location, userId });
      return res.status(400).json({ error: 'Latitude and longitude must be numbers' });
    }

    if (notes && (typeof notes !== 'string' || notes.length > 500)) {
      logger.warn('Invalid notes length', { notesLength: notes.length, userId });
      return res.status(400).json({ error: 'Notes must be a string with max length of 500 characters' });
    }

    if (currentVitals && !Array.isArray(currentVitals)) {
      logger.warn('Invalid currentVitals format', { currentVitals, userId });
      return res.status(400).json({ error: 'currentVitals must be an array' });
    }

    if (currentVitals && currentVitals.some(v => !v.type || v.value === undefined || !v.unit || !v.timestamp)) {
      logger.warn('Invalid vital data', { currentVitals, userId });
      return res.status(400).json({ error: 'Each vital must have type, value, unit, and timestamp' });
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

    const resources = await findNearestEmergencyResources(location.latitude, location.longitude);

    const { data: emergency, error } = await supabase
      .from('emergencies')
      .insert([{
        patient_id: patient.id,
        location: `POINT(${location.longitude} ${location.latitude})`,
        status: 'active',
        notes: notes || null,
        triggered_at: new Date().toISOString(),
        triggered_by: userId,
        current_vitals: currentVitals || null,
        assigned_hospital_id: resources.hospitalId,
        assigned_ambulance_id: resources.ambulanceId,
      }])
      .select()
      .single();

    if (error) {
      logger.error('Supabase error triggering emergency', { userId, error: error.message });
      return res.status(500).json({ error: 'Failed to trigger emergency: ' + error.message });
    }

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert([{
        type: 'emergency',
        recipient_type: 'doctor',
        recipient_id: 'system', // Placeholder; in a real app, this would target specific doctors
        recipient_email: null,
        recipient_phone: null,
        title: 'Emergency Alert',
        message: `Emergency triggered for patient ${patient.id} at location (${location.latitude}, ${location.longitude})`,
        status: 'pending',
        created_at: new Date().toISOString(),
        data: { emergencyId: emergency.id },
      }]);

    if (notificationError) {
      logger.error('Supabase error creating notification', { emergencyId: emergency.id, userId, error: notificationError.message });
    }

    logger.info('Emergency triggered successfully', { emergencyId: emergency.id, userId });
    res.status(201).json({
      success: true,
      emergency: {
        id: emergency.id,
        patientId: emergency.patient_id,
        status: emergency.status,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        hospital: {
          id: resources.hospitalId,
          name: resources.hospitalName,
        },
        ambulance: {
          id: resources.ambulanceId,
          estimatedArrivalTime: resources.estimatedArrivalTime,
        },
      },
    });
  } catch (err) {
    logger.error('Trigger emergency error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error triggering emergency: ' + err.message });
  }
};

exports.triggerEmergencyByQR = async (req, res) => {
  try {
    const { patientId, location, notes } = req.body;

    if (!patientId || !patientId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
      logger.warn('Invalid patient ID', { patientId });
      return res.status(400).json({ error: 'Valid patient ID (UUID) is required' });
    }

    if (!location || !location.latitude || !location.longitude) {
      logger.warn('Missing or invalid location data', { body: req.body });
      return res.status(400).json({ error: 'Location with latitude and longitude is required' });
    }

    if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      logger.warn('Invalid location coordinates', { location });
      return res.status(400).json({ error: 'Latitude and longitude must be numbers' });
    }

    if (notes && (typeof notes !== 'string' || notes.length > 500)) {
      logger.warn('Invalid notes length', { notesLength: notes.length });
      return res.status(400).json({ error: 'Notes must be a string with max length of 500 characters' });
    }

    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, user_id')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      logger.warn('Patient not found', { patientId });
      return res.status(404).json({ error: 'Patient not found' });
    }

    const resources = await findNearestEmergencyResources(location.latitude, location.longitude);

    const { data: emergency, error } = await supabase
      .from('emergencies')
      .insert([{
        patient_id: patient.id,
        location: `POINT(${location.longitude} ${location.latitude})`,
        status: 'active',
        notes: notes || null,
        triggered_at: new Date().toISOString(),
        triggered_by: 'QR',
        assigned_hospital_id: resources.hospitalId,
        assigned_ambulance_id: resources.ambulanceId,
      }])
      .select()
      .single();

    if (error) {
      logger.error('Supabase error triggering emergency by QR', { patientId, error: error.message });
      return res.status(500).json({ error: 'Failed to trigger emergency: ' + error.message });
    }

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert([{
        type: 'emergency',
        recipient_type: 'doctor',
        recipient_id: 'system',
        recipient_email: null,
        recipient_phone: null,
        title: 'Emergency Alert (QR)',
        message: `Emergency triggered via QR for patient ${patient.id} at location (${location.latitude}, ${location.longitude})`,
        status: 'pending',
        created_at: new Date().toISOString(),
        data: { emergencyId: emergency.id },
      }]);

    if (notificationError) {
      logger.error('Supabase error creating notification for QR emergency', { emergencyId: emergency.id, patientId, error: notificationError.message });
    }

    logger.info('Emergency triggered by QR successfully', { emergencyId: emergency.id, patientId });
    res.status(201).json({
      success: true,
      emergency: {
        id: emergency.id,
        patientId: emergency.patient_id,
        status: emergency.status,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        hospital: {
          id: resources.hospitalId,
          name: resources.hospitalName,
        },
        ambulance: {
          id: resources.ambulanceId,
          estimatedArrivalTime: resources.estimatedArrivalTime,
        },
      },
    });
  } catch (err) {
    logger.error('Trigger emergency by QR error', { error: err.message });
    res.status(500).json({ error: 'Server error triggering emergency by QR: ' + err.message });
  }
};

exports.getEmergencyStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { emergencyId } = req.query;

    if (emergencyId && !emergencyId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
      logger.warn('Invalid emergency ID', { emergencyId, userId });
      return res.status(400).json({ error: 'Emergency ID must be a valid UUID' });
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
      .from('emergencies')
      .select(`
        id,
        patient_id,
        location,
        status,
        notes,
        triggered_at,
        triggered_by,
        current_vitals,
        assigned_hospital_id,
        assigned_ambulance_id,
        cancelled_at,
        cancellation_reason,
        hospitals!assigned_hospital_id(name),
        ambulances!assigned_ambulance_id(name, estimated_arrival_time)
      `)
      .eq('patient_id', patient.id)
      .order('triggered_at', { ascending: false });

    if (emergencyId) {
      query = query.eq('id', emergencyId);
    }

    const { data: emergencies, error } = await query;

    if (error) {
      logger.error('Supabase error fetching emergency status', { userId, error: error.message });
      return res.status(500).json({ error: 'Failed to fetch emergency status: ' + error.message });
    }

    const formattedEmergencies = (emergencies || []).map(emergency => ({
      id: emergency.id,
      patientId: emergency.patient_id,
      location: {
        latitude: emergency.location.coordinates[1],
        longitude: emergency.location.coordinates[0],
      },
      status: emergency.status,
      notes: emergency.notes,
      triggeredAt: emergency.triggered_at,
      triggeredBy: emergency.triggered_by,
      currentVitals: emergency.current_vitals,
      hospital: emergency.hospitals ? {
        id: emergency.assigned_hospital_id,
        name: emergency.hospitals.name,
      } : null,
      ambulance: emergency.ambulances ? {
        id: emergency.assigned_ambulance_id,
        name: emergency.ambulances.name,
        estimatedArrivalTime: emergency.ambulances.estimated_arrival_time,
      } : null,
      cancelledAt: emergency.cancelled_at,
      cancellationReason: emergency.cancellation_reason,
    }));

    logger.info('Emergency status fetched successfully', { userId, count: formattedEmergencies.length });
    res.status(200).json({
      success: true,
      emergencies: formattedEmergencies,
    });
  } catch (err) {
    logger.error('Get emergency status error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error fetching emergency status: ' + err.message });
  }
};

exports.cancelEmergency = async (req, res) => {
  try {
    const userId = req.user.id;
    const { emergencyId, cancellationReason } = req.body;

    if (!emergencyId || !emergencyId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
      logger.warn('Invalid emergency ID', { emergencyId, userId });
      return res.status(400).json({ error: 'Valid emergency ID (UUID) is required' });
    }

    if (!cancellationReason || typeof cancellationReason !== 'string' || cancellationReason.length > 500) {
      logger.warn('Invalid cancellation reason', { cancellationReason, userId });
      return res.status(400).json({ error: 'Cancellation reason must be a string with max length of 500 characters' });
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

    const { data: emergency, error: emergencyError } = await supabase
      .from('emergencies')
      .select('id, status')
      .eq('id', emergencyId)
      .eq('patient_id', patient.id)
      .eq('status', 'active')
      .single();

    if (emergencyError || !emergency) {
      logger.warn('Active emergency not found or not authorized', { emergencyId, userId });
      return res.status(404).json({ error: 'Active emergency not found or not authorized' });
    }

    const { error } = await supabase
      .from('emergencies')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: cancellationReason,
      })
      .eq('id', emergencyId);

    if (error) {
      logger.error('Supabase error canceling emergency', { emergencyId, userId, error: error.message });
      return res.status(500).json({ error: 'Failed to cancel emergency: ' + error.message });
    }

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert([{
        type: 'emergency_cancel',
        recipient_type: 'doctor',
        recipient_id: 'system',
        recipient_email: null,
        recipient_phone: null,
        title: 'Emergency Cancelled',
        message: `Emergency ${emergencyId} for patient ${patient.id} has been cancelled: ${cancellationReason}`,
        status: 'pending',
        created_at: new Date().toISOString(),
        data: { emergencyId },
      }]);

    if (notificationError) {
      logger.error('Supabase error creating cancellation notification', { emergencyId, userId, error: notificationError.message });
    }

    logger.info('Emergency cancelled successfully', { emergencyId, userId });
    res.status(200).json({
      success: true,
      message: 'Emergency cancelled successfully',
    });
  } catch (err) {
    logger.error('Cancel emergency error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error canceling emergency: ' + err.message });
  }
};