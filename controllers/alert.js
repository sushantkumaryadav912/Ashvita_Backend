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

exports.getAlerts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, startDate, endDate } = req.query;

    if (type && !['anomaly', 'emergency', 'system'].includes(type)) {
      logger.warn('Invalid alert type provided', { type, userId });
      return res.status(400).json({ error: 'Invalid alert type, must be "anomaly", "emergency", or "system"' });
    }

    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      logger.warn('Invalid startDate format', { startDate, userId });
      return res.status(400).json({ error: 'startDate must be in YYYY-MM-DD format' });
    }

    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      logger.warn('Invalid endDate format', { endDate, userId });
      return res.status(400).json({ error: 'endDate must be in YYYY-MM-DD format' });
    }

    let query = supabase
      .from('alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00Z`);
    }

    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59Z`);
    }

    const { data: alerts, error } = await query;

    if (error) {
      logger.error('Supabase error fetching alerts', { userId, error: error.message });
      return res.status(500).json({ error: 'Failed to fetch alerts: ' + error.message });
    }

    logger.info('Alerts fetched successfully', { userId, count: alerts.length });
    res.status(200).json({
      success: true,
      alerts: alerts || [],
    });
  } catch (err) {
    logger.error('Get alerts error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error fetching alerts: ' + err.message });
  }
};

exports.createAlert = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, title, message } = req.body;

    if (!type || !title || !message) {
      logger.warn('Missing required fields for alert creation', { userId, body: req.body });
      return res.status(400).json({ error: 'Type, title, and message are required' });
    }

    if (!['anomaly', 'emergency', 'system'].includes(type)) {
      logger.warn('Invalid alert type provided', { type, userId });
      return res.status(400).json({ error: 'Invalid alert type, must be "anomaly", "emergency", or "system"' });
    }

    if (typeof title !== 'string' || title.length > 100) {
      logger.warn('Invalid title length', { title, userId });
      return res.status(400).json({ error: 'Title must be a string with max length of 100 characters' });
    }

    if (typeof message !== 'string' || message.length > 500) {
      logger.warn('Invalid message length', { message, userId });
      return res.status(400).json({ error: 'Message must be a string with max length of 500 characters' });
    }

    const { data: alert, error } = await supabase
      .from('alerts')
      .insert([{
        user_id: userId,
        type,
        title,
        message,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      logger.error('Supabase error creating alert', { userId, error: error.message });
      return res.status(500).json({ error: 'Failed to create alert: ' + error.message });
    }

    logger.info('Alert created successfully', { userId, alertId: alert.id });
    res.status(201).json({
      success: true,
      alert,
    });
  } catch (err) {
    logger.error('Create alert error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error creating alert: ' + err.message });
  }
};