const orm = require('../database/orm');
const logger = require('../utils/logger');
const config = require('../config/config');

class QueueProcessorBase {
  constructor() {
    this.isProcessing = false;
    this.processingInterval = null;
    this.batchSize = config.queue.batchSize || 1;
    this.processingDelay = config.queue.processingDelay || 500;
    this.maxRetryDelay = config.queue.maxRetryDelay || 300;
    this.eventHandlers = new Map();
    this.name = this.constructor.name;
  }

  async setupEventHandlers() {
    throw new Error('setupEventHandlers must be implemented by subclass');
  }

  async start() {
    if (this.isProcessing) {
      logger.warn(`${this.name} processor is already running`);
      return;
    }

    this.isProcessing = true;
    await this.setupEventHandlers();
    logger.info(`${this.name} processor started with ${this.processingDelay}ms polling interval`);
    
    this.processingInterval = setInterval(async () => {
      try {
        await this.processBatch();
      } catch (error) {
        logger.error(`Error in ${this.name} processing cycle:`, error);
      }
    }, this.processingDelay);
    
    logger.info(`${this.name} continuous polling started - will check for new jobs every ${this.processingDelay}ms`);
  }

  async stop() {
    if (!this.isProcessing) {
      logger.warn(`${this.name} processor is not running`);
      return;
    }

    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    logger.info(`${this.name} processor stopped`);
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

      logger.info(`${this.name} processing batch of ${jobs.length} jobs`);
      
      for (const job of jobs) {
        await this.processJob(job);
      }
    } catch (error) {
      logger.error(`Error processing batch in ${this.name}:`, error);
    }
  }

  async getNextJobs() {
    const jobs = [];
    
    for (let i = 0; i < this.batchSize; i++) {
      const EventQueue = orm.getModel('EventQueue');
      const job = await EventQueue.findAndClaimNextJob();
      if (job) {
        jobs.push(job);
      } else {
        break;
      }
    }
    
    return jobs;
  }

  async processJob(job) {
    const startTime = Date.now();
    
    try {
      logger.debug(`${this.name} processing job ${job.id}: ${job.event_type}`);
      
      const handler = this.eventHandlers.get(job.event_type);
      
      if (!handler) {
        throw new Error(`No handler found for event type: ${job.event_type}`);
      }
      
      await handler(job.event_data);
      
      const executionTime = Date.now() - startTime;
      
      await job.markAsCompleted();
      
      const EventLog = orm.getModel('EventLog');
      await EventLog.createLog(job.id, job.event_type, job.event_data, 'success', null, executionTime);
      
      logger.debug(`${this.name} job ${job.id} completed successfully in ${executionTime}ms`);
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error(`${this.name} job ${job.id} failed:`, error);
      
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

  registerEventHandler(eventType, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    
    this.eventHandlers.set(eventType, handler);
    logger.info(`${this.name} event handler registered for: ${eventType}`);
  }

  unregisterEventHandler(eventType) {
    const removed = this.eventHandlers.delete(eventType);
    if (removed) {
      logger.info(`${this.name} event handler unregistered for: ${eventType}`);
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
        throw new Error(`Failed to mark job ${jobId} as processing - job may have been taken by another worker`);
      }
      
      await this.processJob(job);
      return true;
    } catch (error) {
      logger.error(`${this.name} failed to process job ${jobId}:`, error);
      throw error;
    }
  }

  async getProcessorStatus() {
    return {
      name: this.name,
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
    logger.info(`${this.name} batch size updated to: ${size}`);
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
          logger.error(`Error in ${this.name} processing cycle:`, error);
        }
      }, this.processingDelay);
    }
    
    logger.info(`${this.name} polling interval updated to: ${delay}ms`);
  }

  async gracefulShutdown() {
    logger.info(`Initiating graceful shutdown of ${this.name} processor...`);
    
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
        logger.info(`${this.name} all jobs completed, shutdown complete`);
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      waitTime += 1000;
    }
    
    logger.warn(`${this.name} graceful shutdown timed out, forcing shutdown`);
    const EventQueue = orm.getModel('EventQueue');
    await EventQueue.resetStuckJobs(1);
  }
}

module.exports = QueueProcessorBase;