const express = require('express');
const router = express.Router();
const tiktokService = require('../../services/tiktok/tiktokService');
const logger = require('../../utils/logger');

// Get current active session
router.get('/current', async (req, res) => {
  try {
    const sessionManager = tiktokService.getLiveSessionManager();
    const currentSession = await sessionManager.getCurrentSession();
    
    if (!currentSession) {
      return res.json({ session: null, message: 'No active session' });
    }
    
    res.json({ session: currentSession });
  } catch (error) {
    logger.error('Failed to get current session:', error);
    res.status(500).json({ error: 'Failed to get current session' });
  }
});

// Get session statistics
router.get('/current/stats', async (req, res) => {
  try {
    const sessionManager = tiktokService.getLiveSessionManager();
    const sessionStats = await sessionManager.getSessionStats();
    
    if (!sessionStats) {
      return res.json({ stats: null, message: 'No active session' });
    }
    
    res.json({ stats: sessionStats });
  } catch (error) {
    logger.error('Failed to get session stats:', error);
    res.status(500).json({ error: 'Failed to get session stats' });
  }
});

// Get recent sessions
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const username = req.query.username || null;
    
    const sessionManager = tiktokService.getLiveSessionManager();
    const recentSessions = await sessionManager.getRecentSessions(limit, username);
    
    res.json({ sessions: recentSessions });
  } catch (error) {
    logger.error('Failed to get recent sessions:', error);
    res.status(500).json({ error: 'Failed to get recent sessions' });
  }
});

// End current session manually
router.post('/current/end', async (req, res) => {
  try {
    const sessionNotes = req.body.notes || 'Manually ended via API';
    
    const sessionManager = tiktokService.getLiveSessionManager();
    const endedSession = await sessionManager.endSession(null, sessionNotes);
    
    if (!endedSession) {
      return res.json({ success: false, message: 'No active session to end' });
    }
    
    res.json({ 
      success: true, 
      message: 'Session ended successfully',
      session: endedSession 
    });
  } catch (error) {
    logger.error('Failed to end session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Get session by ID
router.get('/:sessionId', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    
    const sessionManager = tiktokService.getLiveSessionManager();
    const sessionStats = await sessionManager.getSessionStats(sessionId);
    
    if (!sessionStats) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({ session: sessionStats });
  } catch (error) {
    logger.error('Failed to get session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

module.exports = router;