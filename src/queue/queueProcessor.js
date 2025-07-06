const orm = require('../database/orm');
const gmodService = require('../services/gmod/gmodService');
const logger = require('../utils/logger');
const config = require('../config/config');

class QueueProcessor {
  constructor() {
    this.isProcessing = false;
    this.processingInterval = null;
    this.batchSize = config.queue.batchSize || 1;
    this.processingDelay = config.queue.processingDelay || 100;
    this.maxRetryDelay = config.queue.maxRetryDelay || 300;
    this.eventHandlers = new Map();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.eventHandlers.set('tiktok:chat', this.handleTikTokChat.bind(this));
    this.eventHandlers.set('tiktok:gift', this.handleTikTokGift.bind(this));
    this.eventHandlers.set('tiktok:donation', this.handleTikTokGift.bind(this));
    this.eventHandlers.set('tiktok:follow', this.handleTikTokFollow.bind(this));
    this.eventHandlers.set('tiktok:like', this.handleTikTokLike.bind(this));
    this.eventHandlers.set('tiktok:share', this.handleTikTokShare.bind(this));
    this.eventHandlers.set('tiktok:viewerCount', this.handleTikTokViewerCount.bind(this));
  }

  async start() {
    if (this.isProcessing) {
      logger.warn('Queue processor is already running');
      return;
    }

    this.isProcessing = true;
    logger.info('Queue processor started');
    
    this.processingInterval = setInterval(async () => {
      try {
        await this.processBatch();
      } catch (error) {
        logger.error('Error in queue processing cycle:', error);
      }
    }, this.processingDelay);
  }

  async stop() {
    if (!this.isProcessing) {
      logger.warn('Queue processor is not running');
      return;
    }

    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    logger.info('Queue processor stopped');
  }

  async processBatch() {
    if (!this.isProcessing) {
      return;
    }

    try {
      const jobs = await this.getNextJobs();
      
      if (jobs.length === 0) {
        return;
      }

      logger.debug(`Processing batch of ${jobs.length} jobs`);
      
      for (const job of jobs) {
        await this.processJob(job);
      }
    } catch (error) {
      logger.error('Error processing batch:', error);
    }
  }

  async getNextJobs() {
    const jobs = [];
    
    for (let i = 0; i < this.batchSize; i++) {
      const EventQueue = orm.getModel('EventQueue');
      const job = await EventQueue.findNextJob();
      if (job) {
        const marked = await job.markAsProcessing();
        if (marked) {
          jobs.push(job);
        }
      } else {
        break;
      }
    }
    
    return jobs;
  }

  async processJob(job) {
    const startTime = Date.now();
    
    try {
      logger.debug(`Processing job ${job.id}: ${job.event_type}`);
      
      const handler = this.eventHandlers.get(job.event_type);
      
      if (!handler) {
        throw new Error(`No handler found for event type: ${job.event_type}`);
      }
      
      await handler(job.event_data);
      
      const executionTime = Date.now() - startTime;
      
      await job.markAsCompleted();
      
      const EventLog = orm.getModel('EventLog');
      await EventLog.createLog(job.id, job.event_type, job.event_data, 'success', null, executionTime);
      
      logger.debug(`Job ${job.id} completed successfully in ${executionTime}ms`);
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error(`Job ${job.id} failed:`, error);
      
      const retryDelay = this.calculateRetryDelay(job.attempts);
      await job.markAsFailed(retryDelay);
      
      const EventLog = orm.getModel('EventLog');
      await EventLog.createLog(job.id, job.event_type, job.event_data, 'failed', error.message, executionTime);
    }
  }

  calculateRetryDelay(attempts) {
    const baseDelay = 5;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempts - 1), this.maxRetryDelay);
    return exponentialDelay;
  }

  async handleTikTokChat(data) {
    try {
      await gmodService.handleTikTokChat(data);
      logger.debug('TikTok chat event processed successfully');
    } catch (error) {
      logger.error('Failed to handle TikTok chat event:', error);
      throw error;
    }
  }

  async handleTikTokGift(data) {
    try {
      await gmodService.handleTikTokGift(data);
      logger.debug('TikTok gift event processed successfully');
    } catch (error) {
      logger.error('Failed to handle TikTok gift event:', error);
      throw error;
    }
  }

  async handleTikTokFollow(data) {
    try {
      await gmodService.handleTikTokFollow(data);
      logger.debug('TikTok follow event processed successfully');
    } catch (error) {
      logger.error('Failed to handle TikTok follow event:', error);
      throw error;
    }
  }

  async handleTikTokLike(data) {
    try {
      await gmodService.handleTikTokLike(data);
      logger.debug('TikTok like event processed successfully');
    } catch (error) {
      logger.error('Failed to handle TikTok like event:', error);
      throw error;
    }
  }

  async handleTikTokShare(data) {
    try {
      await gmodService.handleTikTokShare(data);
      logger.debug('TikTok share event processed successfully');
    } catch (error) {
      logger.error('Failed to handle TikTok share event:', error);
      throw error;
    }
  }

  async handleTikTokViewerCount(data) {
    try {
      await gmodService.handleViewerCount(data);
      logger.debug('TikTok viewer count event processed successfully');
    } catch (error) {
      logger.error('Failed to handle TikTok viewer count event:', error);
      throw error;
    }
  }

  registerEventHandler(eventType, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    
    this.eventHandlers.set(eventType, handler);
    logger.info(`Event handler registered for: ${eventType}`);
  }

  unregisterEventHandler(eventType) {
    const removed = this.eventHandlers.delete(eventType);
    if (removed) {
      logger.info(`Event handler unregistered for: ${eventType}`);
    }
    return removed;
  }

  getRegisteredHandlers() {
    return Array.from(this.eventHandlers.keys());
  }

  async processJobById(jobId) {
    try {
      const EventQueue = orm.getModel('EventQueue');
      const job = await EventQueue.findByPk(jobId);
      if (!job || job.status !== 'pending') {
        throw new Error(`Job ${jobId} not found or not available for processing`);
      }
      
      const marked = await job.markAsProcessing();
      if (!marked) {
        throw new Error(`Failed to mark job ${jobId} as processing`);
      }
      
      await this.processJob(job);
      return true;
    } catch (error) {
      logger.error(`Failed to process job ${jobId}:`, error);
      throw error;
    }
  }

  async getProcessorStatus() {
    return {
      isProcessing: this.isProcessing,
      batchSize: this.batchSize,
      processingDelay: this.processingDelay,
      maxRetryDelay: this.maxRetryDelay,
      registeredHandlers: this.getRegisteredHandlers()
    };
  }

  setBatchSize(size) {
    if (size < 1 || size > 100) {
      throw new Error('Batch size must be between 1 and 100');
    }
    this.batchSize = size;
    logger.info(`Batch size updated to: ${size}`);
  }

  setProcessingDelay(delay) {
    if (delay < 10 || delay > 10000) {
      throw new Error('Processing delay must be between 10 and 10000ms');
    }
    this.processingDelay = delay;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = setInterval(async () => {
        try {
          await this.processBatch();
        } catch (error) {
          logger.error('Error in queue processing cycle:', error);
        }
      }, this.processingDelay);
    }
    
    logger.info(`Processing delay updated to: ${delay}ms`);
  }

  async gracefulShutdown() {
    logger.info('Initiating graceful shutdown of queue processor...');
    
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    let waitTime = 0;
    const maxWaitTime = 30000;
    
    while (waitTime < maxWaitTime) {
      const EventQueue = orm.getModel('EventQueue');
      const processingJobsCount = await EventQueue.count({
        where: { status: 'processing' }
      });
      
      if (processingJobsCount === 0) {
        logger.info('All jobs completed, shutdown complete');
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      waitTime += 1000;
    }
    
    logger.warn('Graceful shutdown timed out, forcing shutdown');
    const EventQueue = orm.getModel('EventQueue');
    await EventQueue.resetStuckJobs(1);
  }
}

module.exports = new QueueProcessor();