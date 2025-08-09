const express = require('express');
const router = express.Router();

// Import route modules
const queueRoutes = require('./queue');
const tiktokRoutes = require('./tiktok');
const systemRoutes = require('./system');
const configRoutes = require('./config');
const assetsRoutes = require('./assets');
const overlayRoutes = require('./overlay');
const sessionsRoutes = require('./sessions');
const eventsRoutes = require('./events');

// Mount routes
router.use('/queue', queueRoutes);
router.use('/tiktok', tiktokRoutes);
router.use('/system', systemRoutes);
router.use('/config', configRoutes);
router.use('/assets', assetsRoutes);
router.use('/overlay', overlayRoutes);
router.use('/sessions', sessionsRoutes);
router.use('/events', eventsRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'TikTok Live GMod Bridge API',
    version: '1.0.0',
    endpoints: {
      queue: '/api/queue',
      tiktok: '/api/tiktok',
      system: '/api/system',
      config: '/api/config',
      assets: '/api/assets',
      overlay: '/api/overlay',
      sessions: '/api/sessions',
      events: '/api/events'
    },
    documentation: {
      queue: [
        'GET /api/queue/status - Get queue status',
        'GET /api/queue/health - Get queue health',
        'GET /api/queue/stats - Get processing statistics',
        'GET /api/queue/distribution - Get event type distribution',
        'POST /api/queue/clear - Clear queue',
        'POST /api/queue/optimize - Optimize queue',
        'POST /api/queue/simulate/:eventType - Simulate TikTok event'
      ],
      tiktok: [
        'GET /api/tiktok/status - Get TikTok service status',
        'GET /api/tiktok/stats - Get TikTok statistics',
        'GET /api/tiktok/events/recent - Get recent TikTok events',
        'GET /api/tiktok/metrics - Get TikTok metrics',
        'POST /api/tiktok/connect - Connect to TikTok',
        'POST /api/tiktok/disconnect - Disconnect from TikTok',
        'POST /api/tiktok/reconnect - Reconnect to TikTok'
      ],
      system: [
        'GET /api/system/overview - Get system overview',
        'GET /api/system/stats - Get system statistics',
        'GET /api/system/health - Get service health',
        'GET /api/system/events/recent - Get recent events',
        'GET /api/system/metrics/:timeRange - Get metrics by time range',
        'POST /api/system/restart/:service - Restart service'
      ],
      config: [
        'GET /api/config - Get current configuration',
        'POST /api/config - Update configuration',
        'GET /api/config/queue - Get queue configuration',
        'POST /api/config/queue - Update queue configuration',
        'GET /api/config/tiktok - Get TikTok configuration',
        'POST /api/config/tiktok - Update TikTok configuration',
        'GET /api/config/gmod - Get GMod configuration',
        'POST /api/config/gmod - Update GMod configuration',
        'GET /api/config/features - Get feature flags',
        'POST /api/config/features - Update feature flags'
      ],
      assets: [
        'GET /api/assets - List all assets',
        'GET /api/assets/:filename - Get asset info'
      ],
      overlay: [
        'GET /api/overlay/status - Get overlay visibility status',
        'POST /api/overlay/show - Show overlay',
        'POST /api/overlay/hide - Hide overlay',
        'POST /api/overlay/toggle - Toggle overlay visibility'
      ],
      sessions: [
        'GET /api/sessions/current - Get current active session',
        'GET /api/sessions/current/stats - Get current session statistics',
        'GET /api/sessions/recent - Get recent sessions',
        'POST /api/sessions/current/end - End current session',
        'GET /api/sessions/:sessionId - Get session by ID'
      ],
      events: [
        'GET /api/events/stats/session/:sessionId - Get session event statistics',
        'GET /api/events/stats/gifts/:sessionId - Get session gift statistics',
        'GET /api/events/stats/users/:sessionId - Get top users for session',
        'GET /api/events/current/metrics - Get real-time session metrics',
        'GET /api/events/current/advanced - Get advanced real-time metrics',
        'GET /api/events/tracker/status - Get events tracker status',
        'GET /api/events/visitors/unique/:sessionId - Get unique visitor statistics',
        'GET /api/events/visitors/timeline/:sessionId - Get visitor activity timeline',
        'GET /api/events/retention/:username?days=7 - Get user retention analysis',
        'GET /api/events/engagement/:sessionId - Get user engagement statistics',
        'GET /api/events/duration/:sessionId - Get session duration analysis',
        'GET /api/events/flow/:sessionId - Get user flow analysis (entries/exits)'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;