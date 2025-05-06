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

exports.createSession = async (req, res) => {
  try {
    logger.warn('Communication session creation is not implemented', { userId: req.user.id });
    res.status(501).json({ error: 'Communication sessions are not supported in this version' });
  } catch (err) {
    logger.error('Create communication session error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

exports.endSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    if (!sessionId || !sessionId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
      logger.warn('Invalid session ID', { sessionId, userId });
      return res.status(400).json({ error: 'Valid session ID (UUID) is required' });
    }

    const { data: participant, error: participantError } = await supabase
      .from('session_participants')
      .select('*, communication_sessions!inner(status)')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .eq('communication_sessions.status', 'active')
      .single();

    if (participantError || !participant) {
      logger.warn('Unauthorized attempt to end session or session not active', { sessionId, userId });
      return res.status(403).json({ error: 'Not authorized to end this session or session is not active' });
    }

    const { error } = await supabase
      .from('communication_sessions')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        ended_by: userId,
      })
      .eq('id', sessionId);

    if (error) {
      logger.error('Supabase error ending session', { sessionId, userId, error: error.message });
      return res.status(500).json({ error: 'Failed to end communication session: ' + error.message });
    }

    const { error: participantsError } = await supabase
      .from('session_participants')
      .update({
        status: 'inactive',
        left_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId);

    if (participantsError) {
      logger.error('Supabase error updating participants', { sessionId, userId, error: participantsError.message });
    }

    logger.info('Communication session ended successfully', { sessionId, userId });
    res.status(200).json({
      success: true,
      message: 'Communication session ended successfully',
    });
  } catch (err) {
    logger.error('End communication session error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error ending communication session: ' + err.message });
  }
};

exports.getSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status = 'active' } = req.query;

    if (!['active', 'ended'].includes(status)) {
      logger.warn('Invalid status query', { status, userId });
      return res.status(400).json({ error: 'Invalid status, must be "active" or "ended"' });
    }

    const { data: participantSessions, error: sessionsError } = await supabase
      .from('session_participants')
      .select(`
        communication_sessions!inner(
          id,
          session_type,
          created_at,
          created_by,
          status,
          emergency_id
        )
      `)
      .eq('user_id', userId)
      .eq('communication_sessions.status', status);

    if (sessionsError) {
      logger.error('Supabase error fetching sessions', { userId, error: sessionsError.message });
      return res.status(500).json({ error: 'Error fetching communication sessions: ' + sessionsError.message });
    }

    const sessions = (participantSessions || []).map(ps => ({
      id: ps.communication_sessions.id,
      type: ps.communication_sessions.session_type,
      createdAt: ps.communication_sessions.created_at,
      status: ps.communication_sessions.status,
      emergencyId: ps.communication_sessions.emergency_id,
    }));

    logger.info('Communication sessions fetched successfully', { userId, count: sessions.length });
    res.status(200).json({
      success: true,
      sessions,
    });
  } catch (err) {
    logger.error('Get communication sessions error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error getting communication sessions: ' + err.message });
  }
};

exports.joinSession = async (req, res) => {
  try {
    logger.warn('Communication session joining is not implemented', { userId: req.user.id });
    res.status(501).json({ error: 'Communication sessions are not supported in this version' });
  } catch (err) {
    logger.error('Join communication session error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

exports.leaveSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    if (!sessionId || !sessionId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
      logger.warn('Invalid session ID', { sessionId, userId });
      return res.status(400).json({ error: 'Valid session ID (UUID) is required' });
    }

    const { data, error } = await supabase
      .from('session_participants')
      .update({
        status: 'inactive',
        left_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Supabase error leaving session', { sessionId, userId, error: error.message });
      return res.status(500).json({ error: 'Failed to leave communication session: ' + error.message });
    }
    if (!data) {
      logger.warn('Session participant not found', { sessionId, userId });
      return res.status(404).json({ error: 'Session participant not found' });
    }

    logger.info('User left communication session successfully', { sessionId, userId });
    res.status(200).json({
      success: true,
      message: 'Successfully left communication session',
    });
  } catch (err) {
    logger.error('Leave communication session error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error leaving communication session: ' + err.message });
  }
};

exports.getSessionParticipants = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    if (!sessionId || !sessionId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
      logger.warn('Invalid session ID', { sessionId, userId });
      return res.status(400).json({ error: 'Valid session ID (UUID) is required' });
    }

    const { data: participant, error: participantError } = await supabase
      .from('session_participants')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (participantError) {
      logger.error('Supabase error checking participant', { sessionId, userId, error: participantError.message });
      return res.status(403).json({ error: 'Not authorized to view this session: ' + participantError.message });
    }
    if (!participant) {
      logger.warn('Not authorized to view session participants', { sessionId, userId });
      return res.status(403).json({ error: 'Not authorized to view this session' });
    }

    const { data: participants, error } = await supabase
      .from('session_participants')
      .select(`
        id,
        status,
        joined_at,
        users!inner(
          id,
          name,
          email,
          user_type
        )
      `)
      .eq('session_id', sessionId);

    if (error) {
      logger.error('Supabase error fetching participants', { sessionId, userId, error: error.message });
      return res.status(500).json({ error: 'Error fetching session participants: ' + error.message });
    }

    const formattedParticipants = (participants || []).map(p => ({
      id: p.users.id,
      name: p.users.name,
      email: p.users.email,
      userType: p.users.user_type,
      status: p.status,
      joinedAt: p.joined_at,
    }));

    logger.info('Session participants fetched successfully', { sessionId, userId, count: formattedParticipants.length });
    res.status(200).json({
      success: true,
      participants: formattedParticipants,
    });
  } catch (err) {
    logger.error('Get session participants error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error getting session participants: ' + err.message });
  }
};