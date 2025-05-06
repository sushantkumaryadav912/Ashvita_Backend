const supabase = require('../config/supabase');
const azureML = require('../services/azureML');

/**
 * Trigger an emergency from patient app
 */
exports.triggerEmergency = async (req, res) => {
  try {
    const userId = req.user.id;
    const { location, notes } = req.body;
    
    if (!location || !location.latitude || !location.longitude) {
      return res.status(400).json({ error: 'Location is required' });
    }
    
    // Get patient details
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select(`
        id, 
        user_id,
        users!inner(name, email),
        medical_history,
        allergies,
        emergency_contacts
      `)
      .eq('user_id', userId)
      .single();
      
    if (patientError || !patient) {
      console.error('Patient not found:', patientError);
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    // Get latest vitals for context
    const { data: latestVitals } = await supabase
      .from('vitals')
      .select('*')
      .eq('patient_id', patient.id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
      
    // Create emergency record
    const { data: emergency, error } = await supabase
      .from('emergencies')
      .insert([{
        patient_id: patient.id,
        location: `POINT(${location.longitude} ${location.latitude})`, // PostgreSQL point format
        status: 'active',
        notes: notes || '',
        triggered_at: new Date().toISOString(),
        triggered_by: 'patient',
        current_vitals: latestVitals || null
      }])
      .select()
      .single();
      
    if (error) {
      console.error('Error creating emergency:', error);
      return res.status(500).json({ error: 'Failed to trigger emergency' });
    }
    
    // Find nearest hospital and ambulance (using Azure ML service)
    const nearestResources = await azureML.findNearestEmergencyResources(
      location.latitude,
      location.longitude
    );
    
    // Update emergency with assigned resources
    const { error: updateError } = await supabase
      .from('emergencies')
      .update({
        assigned_hospital_id: nearestResources.hospitalId,
        assigned_ambulance_id: nearestResources.ambulanceId
      })
      .eq('id', emergency.id);
      
    if (updateError) {
      console.error('Error updating emergency with resources:', updateError);
    }
    
    // Create notifications for emergency contacts
    await notifyEmergencyContacts(patient, emergency, location);
    
    // Create notification for assigned ambulance
    await notifyAmbulance(nearestResources.ambulanceId, emergency, patient, location);
    
    res.status(200).json({
      success: true,
      emergency: {
        id: emergency.id,
        status: emergency.status,
        hospitalName: nearestResources.hospitalName,
        estimatedAmbulanceArrival: nearestResources.estimatedArrivalTime
      }
    });
  } catch (err) {
    console.error('Emergency trigger error:', err);
    res.status(500).json({ error: 'Server error triggering emergency' });
  }
};

/**
 * Trigger emergency from QR code scan (for unconscious patients)
 */
exports.triggerEmergencyFromQR = async (req, res) => {
  try {
    const { patientCode, location } = req.body;
    
    if (!patientCode) {
      return res.status(400).json({ error: 'Patient code is required' });
    }
    
    if (!location || !location.latitude || !location.longitude) {
      return res.status(400).json({ error: 'Location is required' });
    }
    
    // Decode patient code to get patient ID
    // In production, this would be a secure token or encrypted code
    const patientId = patientCode;
    
    // Get patient details
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select(`
        id, 
        user_id,
        users!inner(name, email),
        medical_history,
        allergies,
        emergency_contacts
      `)
      .eq('id', patientId)
      .single();
      
    if (patientError || !patient) {
      console.error('Patient not found from QR code:', patientError);
      return res.status(404).json({ error: 'Invalid patient code' });
    }
    
    // Get latest vitals for context
    const { data: latestVitals } = await supabase
      .from('vitals')
      .select('*')
      .eq('patient_id', patient.id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
      
    // Create emergency record
    const { data: emergency, error } = await supabase
      .from('emergencies')
      .insert([{
        patient_id: patient.id,
        location: `POINT(${location.longitude} ${location.latitude})`, // PostgreSQL point format
        status: 'active',
        notes: 'Triggered via QR code - patient may be unconscious',
        triggered_at: new Date().toISOString(),
        triggered_by: 'qr_code',
        current_vitals: latestVitals || null
      }])
      .select()
      .single();
      
    if (error) {
      console.error('Error creating emergency from QR:', error);
      return res.status(500).json({ error: 'Failed to trigger emergency' });
    }
    
    // Find nearest hospital and ambulance
    const nearestResources = await azureML.findNearestEmergencyResources(
      location.latitude,
      location.longitude
    );
    
    // Update emergency with assigned resources
    await supabase
      .from('emergencies')
      .update({
        assigned_hospital_id: nearestResources.hospitalId,
        assigned_ambulance_id: nearestResources.ambulanceId
      })
      .eq('id', emergency.id);
      
    // Create notifications for emergency contacts
    await notifyEmergencyContacts(patient, emergency, location);
    
    // Create notification for assigned ambulance
    await notifyAmbulance(nearestResources.ambulanceId, emergency, patient, location);
    
    res.status(200).json({
      success: true,
      emergency: {
        id: emergency.id,
        status: emergency.status,
        patientName: patient.users.name,
        hospitalName: nearestResources.hospitalName,
        estimatedAmbulanceArrival: nearestResources.estimatedArrivalTime
      }
    });
  } catch (err) {
    console.error('Emergency QR trigger error:', err);
    res.status(500).json({ error: 'Server error triggering emergency from QR' });
  }
};

/**
 * Get current emergency status
 */
exports.getEmergencyStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get patient ID
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .eq('user_id', userId)
      .single();
      
    if (patientError || !patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    // Get active emergency for this patient
    const { data: emergency, error } = await supabase
      .from('emergencies')
      .select(`
        id,
        status,
        triggered_at,
        assigned_hospital_id,
        assigned_ambulance_id,
        ambulances!inner(name, current_location, estimated_arrival_time),
        hospitals!inner(name, address)
      `)
      .eq('patient_id', patient.id)
      .eq('status', 'active')
      .order('triggered_at', { ascending: false })
      .limit(1)
      .single();
      
    if (error) {
      console.error('Error fetching emergency status:', error);
      return res.status(500).json({ error: 'Error fetching emergency status' });
    }
    
    if (!emergency) {
      return res.status(200).json({
        success: true,
        active: false,
        message: 'No active emergency'
      });
    }
    
    res.status(200).json({
      success: true,
      active: true,
      emergency: {
        id: emergency.id,
        status: emergency.status,
        triggeredAt: emergency.triggered_at,
        hospital: {
          id: emergency.assigned_hospital_id,
          name: emergency.hospitals.name,
          address: emergency.hospitals.address
        },
        ambulance: {
          id: emergency.assigned_ambulance_id,
          name: emergency.ambulances.name,
          currentLocation: emergency.ambulances.current_location,
          estimatedArrival: emergency.ambulances.estimated_arrival_time
        }
      }
    });
  } catch (err) {
    console.error('Get emergency status error:', err);
    res.status(500).json({ error: 'Server error getting emergency status' });
  }
};

/**
 * Cancel an active emergency
 */
exports.cancelEmergency = async (req, res) => {
  try {
    const userId = req.user.id;
    const { emergencyId, reason } = req.body;
    
    if (!emergencyId) {
      return res.status(400).json({ error: 'Emergency ID is required' });
    }
    
    // Get patient ID
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .eq('user_id', userId)
      .single();
      
    if (patientError || !patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    // Verify emergency belongs to this patient and is active
    const { data: emergency, error: emergencyError } = await supabase
      .from('emergencies')
      .select('id, assigned_ambulance_id')
      .eq('id', emergencyId)
      .eq('patient_id', patient.id)
      .eq('status', 'active')
      .single();
      
    if (emergencyError || !emergency) {
      return res.status(404).json({ error: 'Active emergency not found' });
    }
    
    // Update emergency status to cancelled
    const { error } = await supabase
      .from('emergencies')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || 'Cancelled by patient'
      })
      .eq('id', emergencyId);
      
    if (error) {
      console.error('Error cancelling emergency:', error);
      return res.status(500).json({ error: 'Failed to cancel emergency' });
    }
    
    // Notify ambulance of cancellation
    if (emergency.assigned_ambulance_id) {
      // TODO: Implement notification to ambulance service
    }
    
    res.status(200).json({
      success: true,
      message: 'Emergency cancelled successfully'
    });
  } catch (err) {
    console.error('Cancel emergency error:', err);
    res.status(500).json({ error: 'Server error cancelling emergency' });
  }
};

/**
 * Helper function to notify emergency contacts
 */
async function notifyEmergencyContacts(patient, emergency, location) {
  try {
    if (!patient.emergency_contacts || patient.emergency_contacts.length === 0) {
      console.log('No emergency contacts to notify');
      return;
    }
    
    // Create notifications for each contact
    const notifications = patient.emergency_contacts.map(contact => ({
      type: 'emergency',
      recipient_type: 'emergency_contact',
      recipient_id: contact.id,
      recipient_email: contact.email,
      recipient_phone: contact.phone,
      title: 'Emergency Alert',
      message: `${patient.users.name} has triggered an emergency alert.`,
      status: 'pending',
      created_at: new Date().toISOString(),
      data: {
        patientId: patient.id,
        patientName: patient.users.name,
        emergencyId: emergency.id,
        location: {
          latitude: location.latitude,
          longitude: location.longitude
        }
      }
    }));
    
    // Insert notifications to database
    const { error } = await supabase
      .from('notifications')
      .insert(notifications);
      
    if (error) {
      console.error('Error creating emergency contact notifications:', error);
    }
    
    // TODO: Send SMS and push notifications to contacts
    
  } catch (err) {
    console.error('Error in notifyEmergencyContacts:', err);
  }
}

/**
 * Helper function to notify ambulance service
 */
async function notifyAmbulance(ambulanceId, emergency, patient, location) {
  try {
    if (!ambulanceId) {
      console.log('No ambulance assigned to notify');
      return;
    }
    
    // Create notification for ambulance service
    const { error } = await supabase
      .from('notifications')
      .insert([{
        type: 'emergency_dispatch',
        recipient_type: 'ambulance',
        recipient_id: ambulanceId,
        title: 'Emergency Dispatch',
        message: `New emergency dispatch for patient ${patient.users.name}`,
        status: 'pending',
        created_at: new Date().toISOString(),
        data: {
          patientId: patient.id,
          patientName: patient.users.name,
          emergencyId: emergency.id,
          medicalHistory: patient.medical_history,
          allergies: patient.allergies,
          location: {
            latitude: location.latitude,
            longitude: location.longitude
          }
        }
      }]);
      
    if (error) {
      console.error('Error creating ambulance notification:', error);
    }
    
    // TODO: Integration with ambulance dispatch system
    
  } catch (err) {
    console.error('Error in notifyAmbulance:', err);
  }
}