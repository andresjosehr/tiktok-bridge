const express = require('express');
const router = express.Router();
const tiktokService = require('../../services/tiktok/tiktokService');
const eventManager = require('../../services/eventManager');
const logger = require('../../utils/logger');

// Get TikTok service status
router.get('/status', async (req, res) => {
  try {
    const status = {
      isConnected: tiktokService.isConnected(),
      connectionState: tiktokService.getConnectionState(),
      currentStream: tiktokService.getCurrentStream(),
      lastConnectedAt: tiktokService.getLastConnectedAt(),
      connectionAttempts: tiktokService.getConnectionAttempts(),
      uptime: tiktokService.getUptime()
    };
    res.json(status);
  } catch (error) {
    logger.error('Failed to get TikTok status:', error);
    res.status(500).json({ error: 'Failed to get TikTok status' });
  }
});

// Get TikTok connection statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = eventManager.getEventStats();
    const tiktokStats = {};
    
    for (const [eventName, data] of Object.entries(stats)) {
      if (eventName.startsWith('tiktok:')) {
        tiktokStats[eventName] = data;
      }
    }
    
    res.json(tiktokStats);
  } catch (error) {
    logger.error('Failed to get TikTok stats:', error);
    res.status(500).json({ error: 'Failed to get TikTok stats' });
  }
});

// Connect to TikTok
router.post('/connect', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    const result = await tiktokService.connect(username);
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Failed to connect to TikTok:', error);
    res.status(500).json({ error: 'Failed to connect to TikTok' });
  }
});

// Disconnect from TikTok
router.post('/disconnect', async (req, res) => {
  try {
    await tiktokService.disconnect();
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to disconnect from TikTok:', error);
    res.status(500).json({ error: 'Failed to disconnect from TikTok' });
  }
});

// Reconnect to TikTok
router.post('/reconnect', async (req, res) => {
  try {
    await tiktokService.reconnect();
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to reconnect to TikTok:', error);
    res.status(500).json({ error: 'Failed to reconnect to TikTok' });
  }
});

// Get recent TikTok events
router.get('/events/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const orm = require('../../database/orm');
    const EventLog = orm.getModel('EventLog');
    
    const events = await EventLog.findAll({
      where: {
        event_type: {
          [orm.Op.like]: 'tiktok:%'
        }
      },
      order: [['created_at', 'DESC']],
      limit: limit
    });
    
    res.json(events);
  } catch (error) {
    logger.error('Failed to get recent TikTok events:', error);
    res.status(500).json({ error: 'Failed to get recent TikTok events' });
  }
});

// Get TikTok event metrics
router.get('/metrics', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const orm = require('../../database/orm');
    const EventLog = orm.getModel('EventLog');
    
    const metrics = await EventLog.getTikTokMetrics(hours);
    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get TikTok metrics:', error);
    res.status(500).json({ error: 'Failed to get TikTok metrics' });
  }
});

// Clear TikTok event statistics
router.post('/stats/clear', async (req, res) => {
  try {
    eventManager.clearEventStats();
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to clear TikTok stats:', error);
    res.status(500).json({ error: 'Failed to clear TikTok stats' });
  }
});

module.exports = router;