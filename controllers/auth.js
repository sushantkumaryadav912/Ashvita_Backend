const { supabase } = require('../config/supabase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const winston = require('winston');

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
    const { email, password, name, userType } = req.body;

    if (!email || !password || !name || !userType) {
      logger.warn('Missing required fields for registration', { body: req.body });
      return res.status(400).json({ error: 'Email, password, name, and userType are required' });
    }

    if (!['patient', 'doctor'].includes(userType)) {
      logger.warn('Invalid userType provided', { userType });
      return res.status(400).json({ error: 'userType must be "patient" or "doctor"' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      logger.warn('Invalid email format', { email });
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 8) {
      logger.warn('Password too short', { email });
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    if (typeof name !== 'string' || name.length > 100) {
      logger.warn('Invalid name length', { name });
      return res.status(400).json({ error: 'Name must be a string with max length of 100 characters' });
    }

    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      logger.error('Supabase error checking existing user', { email, error: fetchError.message });
      return res.status(500).json({ error: 'Error checking existing user: ' + fetchError.message });
    }

    if (existingUser) {
      logger.warn('User already exists', { email });
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: user, error } = await supabase
      .from('users')
      .insert([{
        email,
        password: hashedPassword,
        name,
        user_type: userType,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      logger.error('Supabase error creating user', { email, error: error.message });
      return res.status(500).json({ error: 'Failed to register user: ' + error.message });
    }

    const table = userType === 'patient' ? 'patients' : 'doctors';
    const { error: profileError } = await supabase
      .from(table)
      .insert([{
        user_id: user.id,
        created_at: new Date().toISOString(),
      }]);

    if (profileError) {
      logger.error('Supabase error creating user profile', { userId: user.id, error: profileError.message });
      return res.status(500).json({ error: 'Failed to create user profile: ' + profileError.message });
    }

    const token = jwt.sign({ id: user.id, userType }, JWT_SECRET, { expiresIn: '1h' });

    logger.info('User registered successfully', { userId: user.id, email });
    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        userType: user.user_type,
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
      logger.warn('Missing required fields for login', { body: req.body });
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      logger.warn('Invalid email format', { email });
      return res.status(400).json({ error: 'Invalid email format' });
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
      logger.warn('Invalid password attempt', { email });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, userType: user.user_type }, JWT_SECRET, { expiresIn: '1h' });

    logger.info('User logged in successfully', { userId: user.id, email });
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
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
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !user) {
      logger.warn('User not found during profile fetch', { userId });
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('User profile fetched successfully', { userId });
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        userType: user.user_type,
        createdAt: user.created_at,
      },
    });
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
      return res.status(400).json({ error: 'At least one field (name or email) must be provided' });
    }

    if (name && (typeof name !== 'string' || name.length > 100)) {
      logger.warn('Invalid name length', { name, userId });
      return res.status(400).json({ error: 'Name must be a string with max length of 100 characters' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      logger.warn('Invalid email format', { email, userId });
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (email) {
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        logger.error('Supabase error checking email availability', { email, userId, error: fetchError.message });
        return res.status(500).json({ error: 'Error checking email availability: ' + fetchError.message });
      }

      if (existingUser) {
        logger.warn('Email already in use', { email, userId });
        return res.status(400).json({ error: 'Email is already in use' });
      }
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

    logger.info('User profile updated successfully', { userId });
    res.status(200).json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        userType: updatedUser.user_type,
        createdAt: updatedUser.created_at,
      },
    });
  } catch (err) {
    logger.error('Update profile error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error updating profile: ' + err.message });
  }
};