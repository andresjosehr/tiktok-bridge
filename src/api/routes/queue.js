const express = require('express');
const router = express.Router();
const queueManager = require('../../queue/queueManager');
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

module.exports = router;