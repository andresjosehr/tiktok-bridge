const express = require('express');
const router = express.Router();
const queueManager = require('../../queue/queueManager');
const queueProcessor = require('../../queue/queueProcessor');
const eventManager = require('../../services/eventManager');
const logger = require('../../utils/logger');

// Get queue status
router.get('/status', async (req, res) => {
  try {
    const status = await queueManager.getQueueStatus();
    res.json(status);
  } catch (error) {
    logger.error('Failed to get queue status:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

// Get queue health status
router.get('/health', async (req, res) => {
  try {
    const health = await queueManager.getHealthStatus();
    res.json(health);
  } catch (error) {
    logger.error('Failed to get queue health:', error);
    res.status(500).json({ error: 'Failed to get queue health' });
  }
});

// Get processing statistics
router.get('/stats', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const stats = await queueManager.getProcessingStats(hours);
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get processing stats:', error);
    res.status(500).json({ error: 'Failed to get processing stats' });
  }
});

// Get event type distribution
router.get('/distribution', async (req, res) => {
  try {
    const distribution = await queueManager.getEventTypeDistribution();
    res.json(distribution);
  } catch (error) {
    logger.error('Failed to get event type distribution:', error);
    res.status(500).json({ error: 'Failed to get event type distribution' });
  }
});

// Clear queue
router.post('/clear', async (req, res) => {
  try {
    const removedCount = await queueManager.clearQueue();
    res.json({ success: true, removedCount });
  } catch (error) {
    logger.error('Failed to clear queue:', error);
    res.status(500).json({ error: 'Failed to clear queue' });
  }
});

// Optimize queue
router.post('/optimize', async (req, res) => {
  try {
    const optimizations = await queueManager.optimizeQueue();
    res.json({ success: true, optimizations });
  } catch (error) {
    logger.error('Failed to optimize queue:', error);
    res.status(500).json({ error: 'Failed to optimize queue' });
  }
});

// Clear completed jobs
router.post('/clear-completed', async (req, res) => {
  try {
    const olderThanHours = parseInt(req.body.olderThanHours) || 24;
    const removedCount = await queueManager.clearCompletedJobs(olderThanHours);
    res.json({ success: true, removedCount });
  } catch (error) {
    logger.error('Failed to clear completed jobs:', error);
    res.status(500).json({ error: 'Failed to clear completed jobs' });
  }
});

// Clear failed jobs
router.post('/clear-failed', async (req, res) => {
  try {
    const olderThanHours = parseInt(req.body.olderThanHours) || 168;
    const removedCount = await queueManager.clearFailedJobs(olderThanHours);
    res.json({ success: true, removedCount });
  } catch (error) {
    logger.error('Failed to clear failed jobs:', error);
    res.status(500).json({ error: 'Failed to clear failed jobs' });
  }
});

// Reset stuck jobs
router.post('/reset-stuck', async (req, res) => {
  try {
    const timeoutMinutes = parseInt(req.body.timeoutMinutes) || 10;
    const resetCount = await queueManager.resetStuckJobs(timeoutMinutes);
    res.json({ success: true, resetCount });
  } catch (error) {
    logger.error('Failed to reset stuck jobs:', error);
    res.status(500).json({ error: 'Failed to reset stuck jobs' });
  }
});

// Simulate TikTok events
router.post('/simulate/:eventType', async (req, res) => {
  try {
    const { eventType } = req.params;
    const eventData = req.body;
    
    const validEventTypes = ['chat', 'gift', 'follow', 'like', 'share', 'viewerCount'];
    if (!validEventTypes.includes(eventType)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }
    
    const fullEventType = `tiktok:${eventType}`;
    eventManager.emit(fullEventType, eventData);
    
    res.json({ success: true, eventType: fullEventType, data: eventData });
  } catch (error) {
    logger.error('Failed to simulate event:', error);
    res.status(500).json({ error: 'Failed to simulate event' });
  }
});

// Get available services
router.get('/services', async (req, res) => {
  try {
    const availableServices = queueProcessor.getAvailableServices();
    const enabledServices = queueProcessor.getEnabledServices();
    const activeService = queueProcessor.getActiveServiceType();
    
    res.json({
      available: availableServices,
      enabled: enabledServices,
      active: activeService
    });
  } catch (error) {
    logger.error('Failed to get services info:', error);
    res.status(500).json({ error: 'Failed to get services info' });
  }
});

// Get active service status
router.get('/services/active', async (req, res) => {
  try {
    const activeService = queueProcessor.getActiveService();
    const activeServiceType = queueProcessor.getActiveServiceType();
    
    let serviceStatus = null;
    if (activeService && typeof activeService.getServiceStatus === 'function') {
      serviceStatus = await activeService.getServiceStatus();
    }
    
    res.json({
      type: activeServiceType,
      status: serviceStatus
    });
  } catch (error) {
    logger.error('Failed to get active service status:', error);
    res.status(500).json({ error: 'Failed to get active service status' });
  }
});

// Switch active service
router.post('/services/switch', async (req, res) => {
  try {
    const { serviceType } = req.body;
    
    if (!serviceType) {
      return res.status(400).json({ error: 'serviceType is required' });
    }
    
    const availableServices = queueProcessor.getAvailableServices();
    if (!availableServices.includes(serviceType)) {
      return res.status(400).json({ 
        error: `Invalid service type. Available: ${availableServices.join(', ')}` 
      });
    }
    
    await queueProcessor.changeActiveService(serviceType);
    
    res.json({ 
      success: true, 
      message: `Active service switched to: ${serviceType}`,
      activeService: serviceType
    });
  } catch (error) {
    logger.error('Failed to switch active service:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get event logs with service filtering
router.get('/logs', async (req, res) => {
  try {
    const { serviceId, eventType, limit = 100, hours = 24 } = req.query;
    const orm = require('../../database/orm');
    const EventLog = orm.getModel('EventLog');
    
    const whereClause = {};
    
    // Filter by service_id if provided
    if (serviceId) {
      whereClause.service_id = serviceId;
    }
    
    // Filter by event_type if provided
    if (eventType) {
      whereClause.event_type = eventType;
    }
    
    // Filter by time range
    if (hours) {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - parseInt(hours));
      const { Op } = require('sequelize');
      whereClause.processed_at = {
        [Op.gte]: cutoffDate
      };
    }
    
    const logs = await EventLog.findAll({
      where: whereClause,
      order: [['processed_at', 'DESC']],
      limit: parseInt(limit)
    });
    
    res.json({ logs });
  } catch (error) {
    logger.error('Failed to get event logs:', error);
    res.status(500).json({ error: 'Failed to get event logs' });
  }
});

// Get service statistics
router.get('/services/stats', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const orm = require('../../database/orm');
    const EventLog = orm.getModel('EventLog');
    
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - parseInt(hours));
    
    const { fn, col, Op } = require('sequelize');
    const stats = await EventLog.findAll({
      attributes: [
        'service_id',
        'status',
        [fn('COUNT', '*'), 'count'],
        [fn('AVG', col('execution_time_ms')), 'avg_execution_time']
      ],
      where: {
        processed_at: {
          [Op.gte]: cutoffDate
        },
        service_id: {
          [Op.ne]: null
        }
      },
      group: ['service_id', 'status'],
      order: [['service_id', 'ASC'], ['status', 'ASC']]
    });
    
    const formattedStats = stats.map(stat => stat.get({ plain: true }));
    res.json({ stats: formattedStats });
  } catch (error) {
    logger.error('Failed to get service stats:', error);
    res.status(500).json({ error: 'Failed to get service stats' });
  }
});

module.exports = router;