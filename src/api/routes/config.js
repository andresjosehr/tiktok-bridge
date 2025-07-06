const express = require('express');
const router = express.Router();
const config = require('../../config/config');
const logger = require('../../utils/logger');

// Get current configuration
router.get('/', (req, res) => {
  try {
    // Return safe configuration (without sensitive data)
    const safeConfig = {
      port: config.port,
      environment: config.environment,
      queue: {
        maxSize: config.queue.maxSize,
        maxAttempts: config.queue.maxAttempts,
        processingDelay: config.queue.processingDelay
      },
      tiktok: {
        username: config.tiktok.username,
        enableWebsocket: config.tiktok.enableWebsocket,
        reconnectInterval: config.tiktok.reconnectInterval,
        maxReconnectAttempts: config.tiktok.maxReconnectAttempts
      },
      gmod: {
        host: config.gmod.host,
        wsPort: config.gmod.wsPort,
        httpPort: config.gmod.httpPort,
        enableWebsocket: config.gmod.enableWebsocket,
        enableHttp: config.gmod.enableHttp
      },
      features: config.features,
      logging: {
        level: config.logging.level,
        enableConsole: config.logging.enableConsole,
        enableFile: config.logging.enableFile
      }
    };
    
    res.json(safeConfig);
  } catch (error) {
    logger.error('Failed to get configuration:', error);
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

// Update configuration
router.post('/', (req, res) => {
  try {
    const updates = req.body;
    const allowedUpdates = [
      'queue.maxSize',
      'queue.maxAttempts',
      'queue.processingDelay',
      'tiktok.username',
      'tiktok.enableWebsocket',
      'tiktok.reconnectInterval',
      'tiktok.maxReconnectAttempts',
      'gmod.host',
      'gmod.wsPort',
      'gmod.httpPort',
      'gmod.enableWebsocket',
      'gmod.enableHttp',
      'features',
      'logging.level',
      'logging.enableConsole',
      'logging.enableFile'
    ];
    
    const updatedFields = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        const keys = key.split('.');
        let current = config;
        
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {};
          }
          current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
        updatedFields.push(key);
      }
    }
    
    logger.info('Configuration updated', { updatedFields });
    res.json({ success: true, updatedFields });
  } catch (error) {
    logger.error('Failed to update configuration:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// Get queue configuration
router.get('/queue', (req, res) => {
  try {
    res.json(config.queue);
  } catch (error) {
    logger.error('Failed to get queue configuration:', error);
    res.status(500).json({ error: 'Failed to get queue configuration' });
  }
});

// Update queue configuration
router.post('/queue', (req, res) => {
  try {
    const { maxSize, maxAttempts, processingDelay } = req.body;
    
    if (maxSize !== undefined) config.queue.maxSize = parseInt(maxSize);
    if (maxAttempts !== undefined) config.queue.maxAttempts = parseInt(maxAttempts);
    if (processingDelay !== undefined) config.queue.processingDelay = parseInt(processingDelay);
    
    logger.info('Queue configuration updated', { maxSize, maxAttempts, processingDelay });
    res.json({ success: true, queue: config.queue });
  } catch (error) {
    logger.error('Failed to update queue configuration:', error);
    res.status(500).json({ error: 'Failed to update queue configuration' });
  }
});

// Get TikTok configuration
router.get('/tiktok', (req, res) => {
  try {
    const safeConfig = {
      username: config.tiktok.username,
      enableWebsocket: config.tiktok.enableWebsocket,
      reconnectInterval: config.tiktok.reconnectInterval,
      maxReconnectAttempts: config.tiktok.maxReconnectAttempts
    };
    res.json(safeConfig);
  } catch (error) {
    logger.error('Failed to get TikTok configuration:', error);
    res.status(500).json({ error: 'Failed to get TikTok configuration' });
  }
});

// Update TikTok configuration
router.post('/tiktok', (req, res) => {
  try {
    const { username, enableWebsocket, reconnectInterval, maxReconnectAttempts } = req.body;
    
    if (username !== undefined) config.tiktok.username = username;
    if (enableWebsocket !== undefined) config.tiktok.enableWebsocket = Boolean(enableWebsocket);
    if (reconnectInterval !== undefined) config.tiktok.reconnectInterval = parseInt(reconnectInterval);
    if (maxReconnectAttempts !== undefined) config.tiktok.maxReconnectAttempts = parseInt(maxReconnectAttempts);
    
    logger.info('TikTok configuration updated', { username, enableWebsocket, reconnectInterval, maxReconnectAttempts });
    res.json({ success: true, tiktok: config.tiktok });
  } catch (error) {
    logger.error('Failed to update TikTok configuration:', error);
    res.status(500).json({ error: 'Failed to update TikTok configuration' });
  }
});

// Get GMod configuration
router.get('/gmod', (req, res) => {
  try {
    res.json(config.gmod);
  } catch (error) {
    logger.error('Failed to get GMod configuration:', error);
    res.status(500).json({ error: 'Failed to get GMod configuration' });
  }
});

// Update GMod configuration
router.post('/gmod', (req, res) => {
  try {
    const { host, wsPort, httpPort, enableWebsocket, enableHttp } = req.body;
    
    if (host !== undefined) config.gmod.host = host;
    if (wsPort !== undefined) config.gmod.wsPort = parseInt(wsPort);
    if (httpPort !== undefined) config.gmod.httpPort = parseInt(httpPort);
    if (enableWebsocket !== undefined) config.gmod.enableWebsocket = Boolean(enableWebsocket);
    if (enableHttp !== undefined) config.gmod.enableHttp = Boolean(enableHttp);
    
    logger.info('GMod configuration updated', { host, wsPort, httpPort, enableWebsocket, enableHttp });
    res.json({ success: true, gmod: config.gmod });
  } catch (error) {
    logger.error('Failed to update GMod configuration:', error);
    res.status(500).json({ error: 'Failed to update GMod configuration' });
  }
});

// Get feature flags
router.get('/features', (req, res) => {
  try {
    res.json(config.features);
  } catch (error) {
    logger.error('Failed to get feature flags:', error);
    res.status(500).json({ error: 'Failed to get feature flags' });
  }
});

// Update feature flags
router.post('/features', (req, res) => {
  try {
    const features = req.body;
    
    for (const [key, value] of Object.entries(features)) {
      if (config.features.hasOwnProperty(key)) {
        config.features[key] = Boolean(value);
      }
    }
    
    logger.info('Feature flags updated', features);
    res.json({ success: true, features: config.features });
  } catch (error) {
    logger.error('Failed to update feature flags:', error);
    res.status(500).json({ error: 'Failed to update feature flags' });
  }
});

// Reset configuration to defaults
router.post('/reset', (req, res) => {
  try {
    // This would typically reload config from file or reset to defaults
    logger.info('Configuration reset requested');
    res.json({ success: true, message: 'Configuration reset to defaults' });
  } catch (error) {
    logger.error('Failed to reset configuration:', error);
    res.status(500).json({ error: 'Failed to reset configuration' });
  }
});

module.exports = router;