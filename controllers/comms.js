const supabase = require('../config/supabase');

/**
 * Create a new communication session
 */
exports.createSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { participantIds, sessionType, emergencyId } = req.body;
    
    if (!sessionType || !participantIds || !Array.isArray(participantIds)) {
      return res.status(400).json({ error: 'Session type and participants are required' });
    }
    
    // Add current user to participants if not already included
    if (!participantIds.includes(userId)) {
      participantIds.push(userId);
    }
    
    // Create communication session
    const { data: session, error } = await supabase
      .from('communication_sessions')
      .insert([{
        session_type: sessionType,
        created_by: userId,
        created_at: new Date().toISOString(),
        status: 'active',
        emergency_id: emergencyId || null
      }])
      .select()
      .single();
      
    if (error) {
      console.error('Error creating communication session:', error);
      return res.status(500).json({ error: 'Failed to create communication session' });
    }
    
    // Add participants to session
    const sessionParticipants = participantIds.map(participantId => ({
      session_id: session.id,
      user_id: participantId,
      joined_at: new Date().toISOString(),
      status: 'active'
    }));
    
    const { error: participantsError } = await supabase
      .from('session_participants')
      .insert(sessionParticipants);
      
    if (participantsError) {
      console.error('Error adding session participants:', participantsError);
      return res.status(500).json({ error: 'Failed to add session participants' });
    }
    
    // Generate communication token for client-side SDK
    const token = generateCommunicationToken(session.id, userId);
    
    res.status(201).json({
      success: true,
      session: {
        id: session.id,
        type: session.session_type,
        token
      }
    });
  } catch (err) {
    console.error('Create communication session error:', err);
    res.status(500).json({ error: 'Server error creating communication session' });
  }
};

/**
 * End a communication session
 */
exports.endSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Verify user is a participant in this session
    const { data: participant, error: participantError } = await supabase
      .from('session_participants')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();
      
    if (participantError || !participant) {
      return res.status(403).json({ error: 'Not authorized to end this session' });
    }
    
    // Update session status
    const { error } = await supabase
      .from('communication_sessions')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        ended_by: userId
      })
      .eq('id', sessionId);
      
    if (error) {
      console.error('Error ending communication session:', error);
      return res.status(500).json({ error: 'Failed to end communication session' });
    }
    
    // Update all participants' status
    const { error: participantsError } = await supabase
      .from('session_participants')
      .update({
        status: 'inactive',
        left_at: new Date().toISOString()
      })
      .eq('session_id', sessionId);
      
    if (participantsError) {
      console.error('Error updating session participants:', participantsError);
    }
    
    res.status(200).json({
      success: true,
      message: 'Communication session ended successfully'
    });
  } catch (err) {
    console.error('End communication session error:', err);
    res.status(500).json({ error: 'Server error ending communication session' });
  }
};

/**
 * Get active/recent communication sessions for the user
 */
exports.getSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status = 'active' } = req.query;
    
    // Get sessions where user is a participant
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
      console.error('Error fetching communication sessions:', sessionsError);
      return res.status(500).json({ error: 'Error fetching communication sessions' });
    }
    
    // Format response data
    const sessions = participantSessions.map(ps => ({
      id: ps.communication_sessions.id,
      type: ps.communication_sessions.session_type,
      createdAt: ps.communication_sessions.created_at,
      status: ps.communication_sessions.status,
      emergencyId: ps.communication_sessions.emergency_id
    }));
    
    res.status(200).json({
      success: true,
      sessions
    });
  } catch (err) {
    console.error('Get communication sessions error:', err);
    res.status(500).json({ error: 'Server error getting communication sessions' });
  }
};

/**
 * Join an existing communication session
 */
exports.joinSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Check if the session exists and is active
    const { data: session, error: sessionError } = await supabase
      .from('communication_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('status', 'active')
      .single();
      
    if (sessionError || !session) {
      return res.status(404).json({ error: 'Active session not found' });
    }
    
    // Check if user is already a participant
    const { data: existingParticipant, error: participantError } = await supabase
      .from('session_participants')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();
      
    if (existingParticipant) {
      // If already a participant, just update status if needed
      if (existingParticipant.status !== 'active') {
        await supabase
          .from('session_participants')
          .update({
            status: 'active',
            joined_at: new Date().toISOString(),
            left_at: null
          })
          .eq('id', existingParticipant.id);
      }
    } else {
      // Add as new participant
      const { error } = await supabase
        .from('session_participants')
        .insert([{
          session_id: sessionId,
          user_id: userId,
          joined_at: new Date().toISOString(),
          status: 'active'
        }]);
        
      if (error) {
        console.error('Error joining session:', error);
        return res.status(500).json({ error: 'Failed to join communication session' });
      }
    }
    
    // Generate communication token for client-side SDK
    const token = generateCommunicationToken(sessionId, userId);
    
    res.status(200).json({
      success: true,
      session: {
        id: session.id,
        type: session.session_type,
        token
      }
    });
  } catch (err) {
    console.error('Join communication session error:', err);
    res.status(500).json({ error: 'Server error joining communication session' });
  }
};

/**
 * Leave a communication session
 */
exports.leaveSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Update participant status
    const { error } = await supabase
      .from('session_participants')
      .update({
        status: 'inactive',
        left_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)
      .eq('user_id', userId);
      
    if (error) {
      console.error('Error leaving session:', error);
      return res.status(500).json({ error: 'Failed to leave communication session' });
    }
    
    res.status(200).json({
      success: true,
      message: 'Successfully left communication session'
    });
  } catch (err) {
    console.error('Leave communication session error:', err);
    res.status(500).json({ error: 'Server error leaving communication session' });
  }
};

/**
 * Get session participants
 */
exports.getSessionParticipants = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Verify user is a participant in this session
    const { data: participant, error: participantError } = await supabase
      .from('session_participants')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();
      
    if (participantError || !participant) {
      return res.status(403).json({ error: 'Not authorized to view this session' });
    }
    
    // Get all participants with user details
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
      console.error('Error fetching session participants:', error);
      return res.status(500).json({ error: 'Error fetching session participants' });
    }
    
    // Format participant data
    const formattedParticipants = participants.map(p => ({
      id: p.users.id,
      name: p.users.name,
      email: p.users.email,
      userType: p.users.user_type,
      status: p.status,
      joinedAt: p.joined_at
    }));
    
    res.status(200).json({
      success: true,
      participants: formattedParticipants
    });
  } catch (err) {
    console.error('Get session participants error:', err);
    res.status(500).json({ error: 'Server error getting session participants' });
  }
};

/**
 * Helper function to generate communication token
 * In production, this would use Azure Communication Services
 */
function generateCommunicationToken(sessionId, userId) {
  // For now, we'll generate a mock token
  // In production, this would generate a token from Azure Communication Services
  const mockToken = Buffer.from(`${sessionId}:${userId}:${Date.now()}`).toString('base64');
  return mockToken;
}