const { supabase } = require('../config/supabase');
const { CommunicationIdentityClient } = require('@azure/communication-identity');
const winston = require('winston');

const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
if (!connectionString) {
  throw new Error('AZURE_COMMUNICATION_CONNECTION_STRING is not defined in environment variables');
}

const identityClient = new CommunicationIdentityClient(connectionString);

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
    const userId = req.user.id;
    const { participantIds, sessionType, emergencyId } = req.body;

    if (!sessionType || !participantIds || !Array.isArray(participantIds)) {
      logger.warn('Missing or invalid required fields for session creation', { userId, body: req.body });
      return res.status(400).json({ error: 'Session type and participant IDs (array) are required' });
    }

    if (!['video', 'chat', 'voice'].includes(sessionType)) {
      logger.warn('Invalid session type', { sessionType, userId });
      return res.status(400).json({ error: 'Invalid session type, must be "video", "chat", or "voice"' });
    }

    if (participantIds.some(id => typeof id !== 'string' || !id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/))) {
      logger.warn('Invalid participant ID format', { participantIds, userId });
      return res.status(400).json({ error: 'All participant IDs must be valid UUIDs' });
    }

    if (emergencyId && !emergencyId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
      logger.warn('Invalid emergency ID format', { emergencyId, userId });
      return res.status(400).json({ error: 'Emergency ID must be a valid UUID' });
    }

    if (!participantIds.includes(userId)) {
      participantIds.push(userId);
    }

    const { data: session, error } = await supabase
      .from('communication_sessions')
      .insert([{
        session_type: sessionType,
        created_by: userId,
        created_at: new Date().toISOString(),
        status: 'active',
        emergency_id: emergencyId || null,
      }])
      .select()
      .single();

    if (error) {
      logger.error('Supabase error creating session', { userId, error: error.message });
      return res.status(500).json({ error: 'Failed to create communication session: ' + error.message });
    }

    const sessionParticipants = participantIds.map(participantId => ({
      session_id: session.id,
      user_id: participantId,
      joined_at: new Date().toISOString(),
      status: 'active',
    }));

    const { error: participantsError } = await supabase
      .from('session_participants')
      .insert(sessionParticipants);

    if (participantsError) {
      logger.error('Supabase error adding participants', { sessionId: session.id, userId, error: participantsError.message });
      return res.status(500).json({ error: 'Failed to add session participants: ' + participantsError.message });
    }

    const tokenResponse = await generateCommunicationToken(userId);

    logger.info('Communication session created successfully', { sessionId: session.id, userId });
    res.status(201).json({
      success: true,
      session: {
        id: session.id,
        type: session.session_type,
        token: tokenResponse.token,
        userId: tokenResponse.user.communicationUserId,
        expiresOn: tokenResponse.expiresOn,
      },
    });
  } catch (err) {
    logger.error('Create communication session error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error creating communication session: ' + err.message });
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
    const userId = req.user.id;
    const { sessionId } = req.params;

    if (!sessionId || !sessionId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
      logger.warn('Invalid session ID', { sessionId, userId });
      return res.status(400).json({ error: 'Valid session ID (UUID) is required' });
    }

    const { data: session, error: sessionError } = await supabase
      .from('communication_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('status', 'active')
      .single();

    if (sessionError) {
      logger.error('Supabase error fetching session', { sessionId, userId, error: sessionError.message });
      return res.status(404).json({ error: 'Active session not found: ' + sessionError.message });
    }
    if (!session) {
      logger.warn('Active session not found', { sessionId, userId });
      return res.status(404).json({ error: 'Active session not found' });
    }

    const { data: existingParticipant, error: participantError } = await supabase
      .from('session_participants')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (participantError && participantError.code !== 'PGRST116') {
      logger.error('Supabase error checking participant', { sessionId, userId, error: participantError.message });
      return res.status(500).json({ error: 'Error checking session participant: ' + participantError.message });
    }

    if (existingParticipant) {
      if (existingParticipant.status !== 'active') {
        const { error: updateError } = await supabase
          .from('session_participants')
          .update({
            status: 'active',
            joined_at: new Date().toISOString(),
            left_at: null,
          })
          .eq('id', existingParticipant.id);

        if (updateError) {
          logger.error('Supabase error updating participant', { sessionId, userId, error: updateError.message });
          return res.status(500).json({ error: 'Failed to update participant status: ' + updateError.message });
        }
      }
    } else {
      const { error } = await supabase
        .from('session_participants')
        .insert([{
          session_id: sessionId,
          user_id: userId,
          joined_at: new Date().toISOString(),
          status: 'active',
        }]);

      if (error) {
        logger.error('Supabase error joining session', { sessionId, userId, error: error.message });
        return res.status(500).json({ error: 'Failed to join communication session: ' + error.message });
      }
    }

    const tokenResponse = await generateCommunicationToken(userId);

    logger.info('User joined communication session successfully', { sessionId, userId });
    res.status(200).json({
      success: true,
      session: {
        id: session.id,
        type: session.session_type,
        token: tokenResponse.token,
        userId: tokenResponse.user.communicationUserId,
        expiresOn: tokenResponse.expiresOn,
      },
    });
  } catch (err) {
    logger.error('Join communication session error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'Server error joining communication session: ' + err.message });
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

async function generateCommunicationToken(userId) {
  try {
    const user = await identityClient.createUser();
    const tokenResponse = await identityClient.getToken(user, ['voip', 'chat']);
    logger.info('Azure Communication token generated successfully', { userId });
    return tokenResponse;
  } catch (err) {
    logger.error('Error generating Azure Communication token', { userId, error: err.message });
    throw new Error('Failed to generate communication token: ' + err.message );
  }
}