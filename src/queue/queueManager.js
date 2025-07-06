const orm = require('../database/orm');
const logger = require('../utils/logger');
const config = require('../config/config');

class QueueManager {
  constructor() {
    this.eventPriorities = {
      'tiktok:gift': 100,
      'tiktok:donation': 100,
      'tiktok:follow': 50,
      'tiktok:chat': 10,
      'tiktok:like': 5,
      'tiktok:share': 15,
      'tiktok:viewerCount': 1,
      'default': 0
    };
    
    this.maxQueueSize = config.queue.maxSize || 1000;
    this.giftEventTypes = ['tiktok:gift', 'tiktok:donation'];
  }

  async addEvent(eventType, eventData, options = {}) {
    try {
      const priority = this.getEventPriority(eventType);
      const maxAttempts = options.maxAttempts || config.queue.maxAttempts || 3;
      
      await this.enforceQueueLimits(eventType, priority);
      
      const EventQueue = orm.getModel('EventQueue');
      const queueItem = await EventQueue.create({
        event_type: eventType,
        event_data: eventData,
        priority: priority,
        max_attempts: maxAttempts
      });
      
      const queueId = queueItem.id;
      
      logger.debug(`Event added to queue: ${eventType} (ID: ${queueId}, Priority: ${priority})`);
      
      return queueId;
    } catch (error) {
      logger.error(`Failed to add event to queue: ${eventType}`, error);
      throw error;
    }
  }

  async enforceQueueLimits(eventType, priority) {
    const EventQueue = orm.getModel('EventQueue');
    const currentQueueSize = await EventQueue.getQueueSize();
    
    if (currentQueueSize >= this.maxQueueSize) {
      if (this.isGiftEvent(eventType)) {
        const removedCount = await this.makeRoomForGiftEvent();
        logger.info(`Queue full, removed ${removedCount} non-gift events to make room for gift`);
      } else {
        if (priority < 50) {
          throw new Error(`Queue is full (${currentQueueSize}/${this.maxQueueSize}) and event priority is too low`);
        }
        
        const EventQueue = orm.getModel('EventQueue');
        const removedCount = await EventQueue.removeOldestNonGiftEvents(1);
        logger.info(`Queue full, removed ${removedCount} low-priority events`);
      }
    }
  }

  async makeRoomForGiftEvent() {
    const eventsToRemove = Math.ceil(this.maxQueueSize * 0.1);
    const EventQueue = orm.getModel('EventQueue');
    return await EventQueue.removeOldestNonGiftEvents(eventsToRemove);
  }

  getEventPriority(eventType) {
    return this.eventPriorities[eventType] || this.eventPriorities.default;
  }

  isGiftEvent(eventType) {
    return this.giftEventTypes.includes(eventType);
  }

  async getQueueStatus() {
    try {
      const EventQueue = orm.getModel('EventQueue');
      const stats = await EventQueue.getStats();
      const eventTypeStats = await EventQueue.getEventTypeStats();
      const currentSize = await EventQueue.getQueueSize();
      
      return {
        currentSize,
        maxSize: this.maxQueueSize,
        utilizationPercent: Math.round((currentSize / this.maxQueueSize) * 100),
        stats,
        eventTypeStats
      };
    } catch (error) {
      logger.error('Failed to get queue status:', error);
      throw error;
    }
  }

  async clearQueue() {
    try {
      const EventQueue = orm.getModel('EventQueue');
      const removedCount = await EventQueue.destroy({ where: {} });
      logger.info(`Cleared ${removedCount} events from queue`);
      return removedCount;
    } catch (error) {
      logger.error('Failed to clear queue:', error);
      throw error;
    }
  }

  async clearCompletedJobs(olderThanHours = 24) {
    try {
      const EventQueue = orm.getModel('EventQueue');
      const removedCount = await EventQueue.clearCompleted(olderThanHours);
      logger.info(`Cleared ${removedCount} completed jobs older than ${olderThanHours} hours`);
      return removedCount;
    } catch (error) {
      logger.error('Failed to clear completed jobs:', error);
      throw error;
    }
  }

  async clearFailedJobs(olderThanHours = 168) {
    try {
      const EventQueue = orm.getModel('EventQueue');
      const removedCount = await EventQueue.clearFailed(olderThanHours);
      logger.info(`Cleared ${removedCount} failed jobs older than ${olderThanHours} hours`);
      return removedCount;
    } catch (error) {
      logger.error('Failed to clear failed jobs:', error);
      throw error;
    }
  }

  async resetStuckJobs(timeoutMinutes = 10) {
    try {
      const EventQueue = orm.getModel('EventQueue');
      const resetCount = await EventQueue.resetStuckJobs(timeoutMinutes);
      if (resetCount > 0) {
        logger.warn(`Reset ${resetCount} stuck jobs that were processing for more than ${timeoutMinutes} minutes`);
      }
      return resetCount;
    } catch (error) {
      logger.error('Failed to reset stuck jobs:', error);
      throw error;
    }
  }

  async getProcessingStats(hours = 24) {
    try {
      const EventLog = orm.getModel('EventLog');
      const stats = await EventLog.getProcessingStats(hours);
      const successRate = await EventLog.getSuccessRate(null, hours);
      const throughput = await EventLog.getThroughputStats(hours);
      
      return {
        processingStats: stats,
        successRate,
        throughput
      };
    } catch (error) {
      logger.error('Failed to get processing stats:', error);
      throw error;
    }
  }

  async getEventTypeDistribution() {
    try {
      const distribution = {};
      
      for (const [eventType, priority] of Object.entries(this.eventPriorities)) {
        if (eventType !== 'default') {
          const EventQueue = orm.getModel('EventQueue');
          const count = await EventQueue.getQueueSizeByType(eventType);
          distribution[eventType] = {
            count,
            priority,
            isGiftEvent: this.isGiftEvent(eventType)
          };
        }
      }
      
      return distribution;
    } catch (error) {
      logger.error('Failed to get event type distribution:', error);
      throw error;
    }
  }

  async optimizeQueue() {
    try {
      const optimizations = [];
      
      const resetCount = await this.resetStuckJobs();
      if (resetCount > 0) {
        optimizations.push(`Reset ${resetCount} stuck jobs`);
      }
      
      const completedCount = await this.clearCompletedJobs();
      if (completedCount > 0) {
        optimizations.push(`Cleared ${completedCount} completed jobs`);
      }
      
      const failedCount = await this.clearFailedJobs();
      if (failedCount > 0) {
        optimizations.push(`Cleared ${failedCount} old failed jobs`);
      }
      
      const EventQueue = orm.getModel('EventQueue');
      const currentSize = await EventQueue.getQueueSize();
      if (currentSize > this.maxQueueSize * 0.9) {
        const removed = await EventQueue.removeOldestNonGiftEvents(
          Math.ceil(this.maxQueueSize * 0.1)
        );
        if (removed > 0) {
          optimizations.push(`Removed ${removed} low-priority events to prevent overflow`);
        }
      }
      
      logger.info('Queue optimization completed', { optimizations });
      return optimizations;
    } catch (error) {
      logger.error('Failed to optimize queue:', error);
      throw error;
    }
  }

  async getHealthStatus() {
    try {
      const queueStatus = await this.getQueueStatus();
      const processingStats = await this.getProcessingStats(1);
      
      const health = {
        status: 'healthy',
        issues: [],
        queueSize: queueStatus.currentSize,
        utilization: queueStatus.utilizationPercent,
        successRate: processingStats.successRate.success_rate
      };
      
      if (queueStatus.utilizationPercent > 90) {
        health.status = 'warning';
        health.issues.push('Queue utilization is high (>90%)');
      }
      
      if (processingStats.successRate.success_rate < 95) {
        health.status = 'warning';
        health.issues.push('Success rate is below 95%');
      }
      
      if (queueStatus.utilizationPercent > 95 || processingStats.successRate.success_rate < 90) {
        health.status = 'critical';
      }
      
      return health;
    } catch (error) {
      logger.error('Failed to get health status:', error);
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

module.exports = new QueueManager();