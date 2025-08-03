const express = require('express');
const router = express.Router();
const tiktokService = require('../../services/tiktok/tiktokService');
const queueProcessor = require('../../queue/queueProcessor');
const queueManager = require('../../queue/queueManager');
const eventManager = require('../../services/eventManager');
const logger = require('../../utils/logger');
const os = require('os');

// Get system overview
router.get('/overview', async (req, res) => {
  try {
    const overview = {
      system: {
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          system: os.totalmem(),
          free: os.freemem()
        },
        cpu: {
          cores: os.cpus().length,
          load: os.loadavg()
        }
      },
      services: {
        tiktok: {
          connected: tiktokService.isConnected(),
          uptime: tiktokService.getUptime()
        },
        activeService: await queueProcessor.getProcessorStatus()
      },
      queue: await queueManager.getQueueStatus(),
      timestamp: new Date().toISOString()
    };
    
    res.json(overview);
  } catch (error) {
    logger.error('Failed to get system overview:', error);
    res.status(500).json({ error: 'Failed to get system overview' });
  }
});

// Get system statistics
router.get('/stats', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    
    const stats = {
      events: eventManager.getEventStats(),
      processing: await queueManager.getProcessingStats(hours),
      distribution: await queueManager.getEventTypeDistribution(),
      health: await queueManager.getHealthStatus(),
      timestamp: new Date().toISOString()
    };
    
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get system stats:', error);
    res.status(500).json({ error: 'Failed to get system stats' });
  }
});

// Get service health
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      services: {
        tiktok: {
          status: tiktokService.isConnected() ? 'connected' : 'disconnected',
          healthy: tiktokService.isHealthy()
        },
        activeService: {
          status: 'see_processor_status',
          healthy: true
        },
        queue: await queueManager.getHealthStatus(),
        database: {
          status: 'connected',
          healthy: true
        }
      },
      timestamp: new Date().toISOString()
    };
    
    // Determine overall health
    const services = Object.values(health.services);
    const unhealthyServices = services.filter(service => 
      service.status === 'disconnected' || !service.healthy
    );
    
    if (unhealthyServices.length > 0) {
      health.status = unhealthyServices.length === services.length ? 'critical' : 'warning';
    }
    
    res.json(health);
  } catch (error) {
    logger.error('Failed to get service health:', error);
    res.status(500).json({ 
      status: 'error',
      error: 'Failed to get service health',
      timestamp: new Date().toISOString()
    });
  }
});

// Get recent events across all services
router.get('/events/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const orm = require('../../database/orm');
    const EventLog = orm.getModel('EventLog');
    
    const events = await EventLog.findAll({
      order: [['created_at', 'DESC']],
      limit: limit
    });
    
    res.json(events);
  } catch (error) {
    logger.error('Failed to get recent events:', error);
    res.status(500).json({ error: 'Failed to get recent events' });
  }
});

// Get event metrics by time range
router.get('/metrics/:timeRange', async (req, res) => {
  try {
    const { timeRange } = req.params;
    const orm = require('../../database/orm');
    const EventLog = orm.getModel('EventLog');
    
    let hours;
    switch (timeRange) {
      case 'hour':
        hours = 1;
        break;
      case 'day':
        hours = 24;
        break;
      case 'week':
        hours = 168;
        break;
      case 'month':
        hours = 720;
        break;
      default:
        hours = 24;
    }
    
    const metrics = await EventLog.getMetricsByTimeRange(hours);
    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// Restart services
router.post('/restart/:service', async (req, res) => {
  try {
    const { service } = req.params;
    
    switch (service) {
      case 'tiktok':
        await tiktokService.restart();
        res.json({ success: true, message: 'TikTok service restarted' });
        break;
      case 'gmod':
      case 'gtav':
      case 'dinochrome':
        const activeService = queueProcessor.getActiveService();
        if (activeService && activeService.restart) {
          await activeService.restart();
          res.json({ success: true, message: `${service} service restarted` });
        } else {
          res.json({ success: true, message: `${service} service does not support restart` });
        }
        break;
      default:
        res.status(400).json({ error: 'Invalid service name' });
    }
  } catch (error) {
    logger.error(`Failed to restart ${service}:`, error);
    res.status(500).json({ error: `Failed to restart ${service}` });
  }
});

// Clear all statistics
router.post('/stats/clear', async (req, res) => {
  try {
    eventManager.clearEventStats();
    res.json({ success: true, message: 'All statistics cleared' });
  } catch (error) {
    logger.error('Failed to clear statistics:', error);
    res.status(500).json({ error: 'Failed to clear statistics' });
  }
});

module.exports = router;