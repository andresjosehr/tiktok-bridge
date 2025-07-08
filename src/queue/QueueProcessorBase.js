const orm = require('../database/orm');
const logger = require('../utils/logger');
const config = require('../config/config');
const EventEmitter = require('events');
const queueManager = require('./queueManager');

class QueueProcessorBase {
  constructor() {
    this.isProcessing = false;
    this.currentJobInProgress = false;
    this.batchSize = 1; // Siempre procesar de uno en uno
    this.maxRetryDelay = config.queue.maxRetryDelay || 300;
    this.eventHandlers = new Map();
    this.name = this.constructor.name;
    this.pendingProcessPromise = null;
    this.jobNotifier = new EventEmitter();
    this.waitingForJob = false;
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
    
    // Registrar este procesador para notificaciones
    queueManager.registerProcessor(this);
    
    logger.info(`${this.name} processor started with promise-based processing`);
    
    // Iniciar el procesamiento inmediatamente
    this.startProcessing();
  }

  async stop() {
    if (!this.isProcessing) {
      logger.warn(`${this.name} processor is not running`);
      return;
    }

    this.isProcessing = false;
    
    // Desregistrar de las notificaciones
    queueManager.unregisterProcessor(this);
    
    // Esperar a que termine el trabajo actual si existe
    if (this.pendingProcessPromise) {
      await this.pendingProcessPromise;
    }
    
    logger.info(`${this.name} processor stopped`);
  }

  async startProcessing() {
    while (this.isProcessing) {
      try {
        // Si ya hay un trabajo en progreso, esperar
        if (this.currentJobInProgress) {
          await new Promise(resolve => setTimeout(resolve, 10));
          continue;
        }

        // Obtener solo UN trabajo
        const job = await this.getNextJob();
        
        if (!job) {
          // No hay trabajos, esperar notificación de nuevos trabajos
          logger.debug(`${this.name} waiting for new jobs...`);
          this.waitingForJob = true;
          await new Promise(resolve => {
            const timeout = setTimeout(() => {
              this.waitingForJob = false;
              resolve();
            }, 5000); // Timeout de 5 segundos para verificar periódicamente
            
            this.jobNotifier.once('newJob', () => {
              clearTimeout(timeout);
              this.waitingForJob = false;
              resolve();
            });
          });
          continue;
        }

        logger.info(`${this.name} processing job ${job.id}: ${job.event_type}`);
        
        // Marcar que hay un trabajo en progreso
        this.currentJobInProgress = true;
        
        // Procesar el trabajo y esperar a que termine completamente
        this.pendingProcessPromise = this.processJob(job);
        await this.pendingProcessPromise;
        
        // Marcar que el trabajo terminó
        this.currentJobInProgress = false;
        this.pendingProcessPromise = null;
        
      } catch (error) {
        logger.error(`Error in ${this.name} processing cycle:`, error);
        this.currentJobInProgress = false;
        this.pendingProcessPromise = null;
        this.waitingForJob = false;
        
        // Esperar un poco antes de continuar en caso de error
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async getNextJob() {
    const EventQueue = orm.getModel('EventQueue');
    return await EventQueue.findAndClaimNextJob();
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
      
      // Si el error es de tipo "skipped", marcar como completado en lugar de fallido
      if (error.isSkipped) {
        logger.debug(`${this.name} job ${job.id} skipped: ${error.message}`);
        
        await job.markAsCompleted();
        
        const EventLog = orm.getModel('EventLog');
        await EventLog.createLog(job.id, job.event_type, job.event_data, 'skipped', error.message, executionTime);
      } else {
        logger.error(`${this.name} job ${job.id} failed:`, error);
        
        const retryDelay = this.calculateRetryDelay(job.attempts);
        await job.markAsFailed(retryDelay);
        
        const EventLog = orm.getModel('EventLog');
        await EventLog.createLog(job.id, job.event_type, job.event_data, 'failed', error.message, executionTime);
      }
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
      currentJobInProgress: this.currentJobInProgress,
      batchSize: this.batchSize,
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

  // Método deprecated - ya no se usa processingDelay
  setProcessingDelay() {
    logger.warn(`${this.name} setProcessingDelay is deprecated - processor now uses promise-based processing`);
  }

  // Notificar al procesador que hay un nuevo trabajo disponible
  notifyNewJob() {
    if (this.waitingForJob) {
      this.jobNotifier.emit('newJob');
    }
  }

  async gracefulShutdown() {
    logger.info(`Initiating graceful shutdown of ${this.name} processor...`);
    
    this.isProcessing = false;
    
    // Esperar a que termine el trabajo actual
    if (this.pendingProcessPromise) {
      logger.info(`${this.name} waiting for current job to complete...`);
      await this.pendingProcessPromise;
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