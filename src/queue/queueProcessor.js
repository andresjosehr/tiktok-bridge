const orm = require('../database/orm');
const logger = require('../utils/logger');
const config = require('../config/config');
const EventEmitter = require('events');
const queueManager = require('./queueManager');
// Lazy loading de servicios para evitar inicialización automática
const DinoChrome = require('../services/dinochrome/DinoChrome');

class QueueProcessor {
  constructor(activeService) {
    this.isProcessing = false;
    this.currentJobInProgress = false;
    this.batchSize = 1;
    this.maxRetryDelay = config.queue.maxRetryDelay || 300;
    this.name = 'QueueProcessor';
    this.pendingProcessPromise = null;
    this.jobNotifier = new EventEmitter();
    this.waitingForJob = false;
    this.activeService = activeService;
    this.liveSessionManager = null; // Will be set externally
    this.setupEventHandlers();
    this.setupServicePriorities();
  }

  setupEventHandlers() {
    this.eventHandlers = new Map();
    this.eventHandlers.set('tiktok:chat', this.activeService.handleTikTokChat.bind(this.activeService));
    this.eventHandlers.set('tiktok:gift', this.activeService.handleTikTokGift.bind(this.activeService));
    this.eventHandlers.set('tiktok:donation', this.activeService.handleTikTokGift.bind(this.activeService));
    this.eventHandlers.set('tiktok:follow', this.activeService.handleTikTokFollow.bind(this.activeService));
    this.eventHandlers.set('tiktok:like', this.activeService.handleTikTokLike.bind(this.activeService));
    this.eventHandlers.set('tiktok:share', this.activeService.handleTikTokShare.bind(this.activeService));
    this.eventHandlers.set('tiktok:viewerCount', this.activeService.handleViewerCount.bind(this.activeService));
  }
  
  setupServicePriorities() {
    const serviceId = this.activeService.serviceName;
    
    // Si el servicio tiene prioridades personalizadas de eventos, registrarlas en el QueueManager
    if (this.activeService && typeof this.activeService.getEventPriorities === 'function') {
      const customPriorities = this.activeService.getEventPriorities();
      if (customPriorities) {
        queueManager.setServiceEventPriorities(serviceId, customPriorities);
        logger.info(`${this.name} registered custom event priorities for service ${serviceId}`);
      }
    }
    
    // Si el servicio tiene prioridades personalizadas de regalos, registrarlas en el QueueManager
    if (this.activeService && typeof this.activeService.getGiftPriorities === 'function') {
      const giftPriorities = this.activeService.getGiftPriorities();
      if (giftPriorities) {
        queueManager.setServiceGiftPriorities(serviceId, giftPriorities);
        logger.info(`${this.name} registered gift-specific priorities for service ${serviceId}`);
      }
    }
  }

  setLiveSessionManager(sessionManager) {
    this.liveSessionManager = sessionManager;
  }

  async getActiveSessionId() {
    if (this.liveSessionManager) {
      return await this.liveSessionManager.getSessionId();
    }
    return null;
  }

  async start() {
    if (this.isProcessing) {
      logger.warn(`${this.name} processor is already running`);
      return;
    }

    this.isProcessing = true;
    
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

        // logger.info(`${this.name} processing job ${job.id}: ${job.event_type}`);
        
        // Marcar que hay un trabajo en progreso
        this.currentJobInProgress = true;
        
        // Procesar el trabajo y esperar a que termine completamente
        this.pendingProcessPromise = this.processJob(job);
        await this.pendingProcessPromise;
        
        // Marcar que el trabajo terminó
        this.currentJobInProgress = false;
        this.pendingProcessPromise = null;
        
        // Aplicar el delay de procesamiento configurado
        if (config.queue.processingDelay > 0) {
          logger.debug(`${this.name} applying processing delay: ${config.queue.processingDelay}ms`);
          await new Promise(resolve => setTimeout(resolve, config.queue.processingDelay));
        }
        
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
      // logger.debug(`${this.name} processing job ${job.id}: ${job.event_type}`);
      
      const handler = this.eventHandlers.get(job.event_type);
      
      if (!handler) {
        throw new Error(`No handler found for event type: ${job.event_type}`);
      }
      
      // Verificar si el servicio debe procesar este evento de gift
      if (job.event_type === 'tiktok:gift' && typeof this.activeService.shouldProcessGift === 'function') {
        if (!this.activeService.shouldProcessGift(job.event_data, job)) {
          const error = new Error(`Gift event skipped: repeat_end=${job.repeat_end} (service only processes final gifts)`);
          error.isSkipped = true;
          throw error;
        }
      }
      
      await handler(job.event_data);
      
      const executionTime = Date.now() - startTime;
      
      await job.markAsCompleted();
      
      const EventLog = orm.getModel('EventLog');
      const sessionId = await this.getActiveSessionId();
      await EventLog.createLog(sessionId, job.event_type, job.event_data, 'success', null, executionTime);
      
      logger.debug(`${this.name} job ${job.id} completed successfully in ${executionTime}ms`);
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Si el error es de tipo "skipped", marcar como completado en lugar de fallido
      if (error.isSkipped) {
        logger.debug(`${this.name} job ${job.id} skipped: ${error.message}`);
        
        await job.markAsCompleted();
        
        const EventLog = orm.getModel('EventLog');
        const sessionId = await this.getActiveSessionId();
        await EventLog.createLog(sessionId, job.event_type, job.event_data, 'skipped', error.message, executionTime);
      } else {
        logger.error(`${this.name} job ${job.id} failed:`, error);
        
        const retryDelay = this.calculateRetryDelay(job.attempts);
        await job.markAsFailed(retryDelay);
        
        const EventLog = orm.getModel('EventLog');
        const sessionId = await this.getActiveSessionId();
        await EventLog.createLog(sessionId, job.event_type, job.event_data, 'failed', error.message, executionTime);
      }
    }
  }

  calculateRetryDelay(attempts) {
    const baseDelay = 5;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempts - 1), this.maxRetryDelay);
    return exponentialDelay;
  }

  changeActiveService(newService) {
    // Limpiar las prioridades del servicio anterior si existen
    if (this.activeService && this.activeService.serviceName) {
      queueManager.clearServiceEventPriorities(this.activeService.serviceName);
    }
    
    this.activeService = newService;
    this.setupEventHandlers();
    this.setupServicePriorities();
    logger.info(`${this.name} switched to service: ${newService.serviceName}`);
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
      activeService: this.activeService.getServiceStatus(),
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

class QueueProcessorManager {
  constructor() {
    this.queueProcessor = null;
    this.isProcessing = false;
    this.enabledProcessors = config.queue.enabledProcessors || ['gmod'];
    // MODIFICADO: Solo permitir un servicio activo por vez
    this.activeServiceType = this.enabledProcessors[0]; // Usar el primer servicio habilitado como único activo
    this.services = new Map();
    this.initializeServices();
  }

  initializeServices() {
    // Solo inicializar servicios que están habilitados para evitar conexiones innecesarias
    logger.info(`Initializing only enabled services: ${this.enabledProcessors.join(', ')}`);
    
    this.enabledProcessors.forEach(serviceType => {
      try {
        switch(serviceType) {
          case 'gmod':
            const gmodServiceInstance = require('../services/gmod/gmodServiceInstance');
            this.services.set('gmod', gmodServiceInstance);
            logger.info('✅ GMod service loaded');
            break;
            
          case 'gtav':
            const GTAVService = require('../services/gtav/GTAVService');
            this.services.set('gtav', new GTAVService());
            logger.info('✅ GTAV service loaded');
            break;
            
          case 'dinochrome':
            this.services.set('dinochrome', new DinoChrome());
            logger.info('✅ DinoChrome service loaded');
            break;
            
          default:
            logger.warn(`❌ Unknown service type: ${serviceType}`);
        }
      } catch (error) {
        logger.error(`❌ Failed to load service ${serviceType}:`, error);
      }
    });
    
    // Solo activar los servicios que están habilitados en la configuración
    logger.info(`Enabled processors from config: ${this.enabledProcessors.join(', ')}`);
    
    // Verificar que el servicio activo esté habilitado
    if (!this.enabledProcessors.includes(this.activeServiceType)) {
      logger.warn(`Active service ${this.activeServiceType} is not enabled. Using first enabled: ${this.enabledProcessors[0]}`);
      this.activeServiceType = this.enabledProcessors[0];
    }
    
    const activeService = this.services.get(this.activeServiceType);
    if (!activeService) {
      throw new Error(`Unknown service type: ${this.activeServiceType}`);
    }
    
    this.queueProcessor = new QueueProcessor(activeService);
    logger.info(`Queue processor initialized with ${this.activeServiceType} service`);
  }

  async start() {
    if (this.isProcessing) {
      logger.warn('Queue processor manager is already running');
      return;
    }

    this.isProcessing = true;
    logger.info(`Starting queue processor with ${this.activeServiceType} service`);
    
    try {
      // Conectar el servicio activo antes de iniciar el procesamiento
      const activeService = this.services.get(this.activeServiceType);
      if (activeService && typeof activeService.connect === 'function') {
        logger.info(`Connecting ${this.activeServiceType} service...`);
        await activeService.connect();
        logger.info(`${this.activeServiceType} service connected successfully`);
      }
      
      await this.queueProcessor.start();
      logger.info('Queue processor started successfully');
    } catch (error) {
      logger.error('Failed to start queue processor:', error);
      this.isProcessing = false;
      throw error;
    }
  }

  async stop() {
    if (!this.isProcessing) {
      logger.warn('Queue processor manager is not running');
      return;
    }

    this.isProcessing = false;
    logger.info('Stopping queue processor');
    
    try {
      await this.queueProcessor.stop();
      
      // Desconectar el servicio activo
      const activeService = this.services.get(this.activeServiceType);
      if (activeService && typeof activeService.disconnect === 'function') {
        logger.info(`Disconnecting ${this.activeServiceType} service...`);
        await activeService.disconnect();
        logger.info(`${this.activeServiceType} service disconnected successfully`);
      }
      
      logger.info('Queue processor stopped successfully');
    } catch (error) {
      logger.error('Failed to stop queue processor:', error);
      throw error;
    }
  }

  async changeActiveService(serviceType) {
    const service = this.services.get(serviceType);
    if (!service) {
      throw new Error(`Unknown service type: ${serviceType}`);
    }
    
    // Verificar que el servicio esté habilitado
    if (!this.enabledProcessors.includes(serviceType)) {
      throw new Error(`Service ${serviceType} is not enabled in configuration`);
    }
    
    // MODIFICADO: Desconectar el servicio anterior antes de cambiar
    const previousService = this.services.get(this.activeServiceType);
    if (previousService && typeof previousService.disconnect === 'function' && this.isProcessing) {
      logger.info(`Disconnecting previous service: ${this.activeServiceType}`);
      await previousService.disconnect();
    }
    
    this.activeServiceType = serviceType;
    
    // Conectar el nuevo servicio si el procesador está corriendo
    if (this.isProcessing && typeof service.connect === 'function') {
      logger.info(`Connecting new service: ${serviceType}`);
      await service.connect();
    }
    
    if (this.queueProcessor) {
      this.queueProcessor.changeActiveService(service);
    }
    
    logger.info(`Active service changed to: ${serviceType}`);
  }

  getActiveService() {
    return this.services.get(this.activeServiceType);
  }

  getActiveServiceType() {
    return this.activeServiceType;
  }

  getAvailableServices() {
    return Array.from(this.services.keys());
  }

  getEnabledServices() {
    return this.enabledProcessors;
  }

  async processJobById(jobId) {
    if (!this.queueProcessor) {
      throw new Error('Queue processor not initialized');
    }
    
    return this.queueProcessor.processJobById(jobId);
  }

  async getProcessorStatus() {
    if (!this.queueProcessor) {
      return {
        isProcessing: false,
        activeService: null,
        error: 'Queue processor not initialized'
      };
    }
    
    const status = await this.queueProcessor.getProcessorStatus();
    return {
      ...status,
      activeServiceType: this.activeServiceType,
      availableServices: this.getAvailableServices(),
      enabledServices: this.getEnabledServices()
    };
  }

  setBatchSize(size) {
    if (!this.queueProcessor) {
      throw new Error('Queue processor not initialized');
    }
    
    this.queueProcessor.setBatchSize(size);
  }

  async gracefulShutdown() {
    logger.info('Initiating graceful shutdown of queue processor manager...');
    
    this.isProcessing = false;
    
    if (this.queueProcessor) {
      await this.queueProcessor.gracefulShutdown();
    }
    
    logger.info('Queue processor manager shutdown complete');
  }

  notifyNewJob() {
    if (this.queueProcessor) {
      this.queueProcessor.notifyNewJob();
    }
  }
}

module.exports = new QueueProcessorManager();