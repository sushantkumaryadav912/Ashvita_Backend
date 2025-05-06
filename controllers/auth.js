const supabase = require('../config/supabase');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// JWT secret key - should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Register a new user (patient or doctor)
 */
exports.register = async (req, res) => {
  try {
    const { email, password, name, userType, ...additionalInfo } = req.body;
    
    if (!email || !password || !name || !userType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
      
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user in Supabase
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{
        email,
        password: hashedPassword,
        name,
        user_type: userType,
        created_at: new Date()
      }])
      .select()
      .single();
      
    if (error) {
      console.error('Registration error:', error);
      return res.status(500).json({ error: 'Failed to register user' });
    }
    
    // Create additional profile info based on user type
    if (userType === 'patient') {
      const { error: patientError } = await supabase
        .from('patients')
        .insert([{
          user_id: newUser.id,
          medical_history: additionalInfo.medicalHistory || '',
          allergies: additionalInfo.allergies || [],
          emergency_contacts: additionalInfo.emergencyContacts || []
        }]);
        
      if (patientError) {
        console.error('Patient profile creation error:', patientError);
      }
    } else if (userType === 'doctor') {
      const { error: doctorError } = await supabase
        .from('doctors')
        .insert([{
          user_id: newUser.id,
          specialty: additionalInfo.specialty || '',
          hospital_id: additionalInfo.hospitalId || null,
          license_number: additionalInfo.licenseNumber || ''
        }]);
        
      if (doctorError) {
        console.error('Doctor profile creation error:', doctorError);
      }
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, userType },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        userType
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

/**
 * Login user
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user by email
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
      
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, userType: user.user_type },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        userType: user.user_type
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
};

/**
 * Get current user profile
 */
exports.getCurrentUser = async (req, res) => {
  try {
    // User data is attached from auth middleware
    const userId = req.user.id;
    
    // Get user details
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, user_type, created_at')
      .eq('id', userId)
      .single();
      
    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get additional profile info based on user type
    let profileData = {};
    
    if (user.user_type === 'patient') {
      const { data: patient } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (patient) profileData = patient;
    } else if (user.user_type === 'doctor') {
      const { data: doctor } = await supabase
        .from('doctors')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (doctor) profileData = doctor;
    }
    
    res.status(200).json({
      success: true,
      user: {
        ...user,
        profile: profileData
      }
    });
  } catch (err) {
    console.error('Get current user error:', err);
    res.status(500).json({ error: 'Server error getting user profile' });
  }
};

/**
 * Update user profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, ...profileData } = req.body;
    
    // Update basic user info
    const { error: userError } = await supabase
      .from('users')
      .update({ name, email })
      .eq('id', userId);
      
    if (userError) {
      return res.status(500).json({ error: 'Failed to update user information' });
    }
    
    // Update profile specific info
    if (req.user.userType === 'patient') {
      const { error: patientError } = await supabase
        .from('patients')
        .update({
          medical_history: profileData.medicalHistory,
          allergies: profileData.allergies,
          emergency_contacts: profileData.emergencyContacts
        })
        .eq('user_id', userId);
        
      if (patientError) {
        return res.status(500).json({ error: 'Failed to update patient profile' });
      }
    } else if (req.user.userType === 'doctor') {
      const { error: doctorError } = await supabase
        .from('doctors')
        .update({
          specialty: profileData.specialty,
          hospital_id: profileData.hospitalId,
          license_number: profileData.licenseNumber
        })
        .eq('user_id', userId);
        
      if (doctorError) {
        return res.status(500).json({ error: 'Failed to update doctor profile' });
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error updating profile' });
  }
};