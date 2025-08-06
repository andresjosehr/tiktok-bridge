const orm = require('../database/orm');
const logger = require('../utils/logger');
const config = require('../config/config');

class QueueManager {
  constructor() {
    this.defaultEventPriorities = {
      'tiktok:gift': 100,
      'tiktok:donation': 100,
      'tiktok:follow': 50,
      'tiktok:chat': 10,
      'tiktok:like': 5,
      'tiktok:share': 15,
      'tiktok:viewerCount': 1,
      'default': 0
    };
    
    // Prioridades actuales (pueden ser sobrescritas por servicios)
    this.eventPriorities = { ...this.defaultEventPriorities };
    
    // Cache de prioridades por servicio
    this.servicePriorities = new Map();
    
    // Cache de prioridades específicas por regalo por servicio
    this.serviceGiftPriorities = new Map();
    
    this.maxQueueSize = config.queue.maxSize || 1000;
    this.giftEventTypes = ['tiktok:gift', 'tiktok:donation'];
    this.processors = []; // Lista de procesadores registrados
  }

  async addEvent(eventType, eventData, options = {}) {
    try {
      const serviceId = options.serviceId || null;
      const priority = this.getEventPriority(eventType, serviceId, eventData);
      const maxAttempts = options.maxAttempts || config.queue.maxAttempts || 3;
      
      // Debug logging para prioridades de regalo
      if ((eventType === 'tiktok:gift' || eventType === 'tiktok:donation') && serviceId) {
        const giftName = eventData.giftName || eventData.gift_name || 'unknown';
        const giftCost = eventData.cost || eventData.gift_cost || 0;
        logger.info(`🎯 Gift priority calculation: ${giftName} (cost: ${giftCost}) -> Priority: ${priority} for service ${serviceId}`);
      }
      
      await this.enforceQueueLimits(eventType, priority);
      
      // Determinar repeat_end basado en el tipo de evento y datos
      let repeatEnd = null; // Por defecto NULL para eventos que no son gifts
      if (eventType === 'tiktok:gift' && eventData.repeatEnd !== undefined) {
        repeatEnd = eventData.repeatEnd;
      }
      
      const EventQueue = orm.getModel('EventQueue');
      const queueItem = await EventQueue.create({
        event_type: eventType,
        event_data: eventData,
        priority: priority,
        max_attempts: maxAttempts,
        repeat_end: repeatEnd,
        service_id: serviceId
      });
      
      const queueId = queueItem.id;
      
      const repeatEndMsg = repeatEnd !== null ? `, repeat_end: ${repeatEnd}` : '';
      const serviceMsg = serviceId ? `, service: ${serviceId}` : '';
      logger.debug(`Event added to queue: ${eventType} (ID: ${queueId}, Priority: ${priority}${repeatEndMsg}${serviceMsg})`);
      
      // Notificar a todos los procesadores que hay un nuevo trabajo
      this.notifyProcessors();
      
      return queueId;
    } catch (error) {
      if (error.isQueueFull) {
        // logger.info(`Queue full, skipping ${eventType} event (priority too low)`);
      } else {
        logger.error(`Failed to add event to queue: ${eventType}`, error);
      }
      throw error;
    }
  }

  async enforceQueueLimits(eventType, priority) {
    const EventQueue = orm.getModel('EventQueue');
    const currentQueueSize = await EventQueue.getQueueSize();
    
    if (currentQueueSize >= this.maxQueueSize) {
      if (this.isGiftEvent(eventType)) {
        const removedCount = await this.makeRoomForGiftEvent();
        // logger.info(`Queue full, removed ${removedCount} non-gift events to make room for gift`);
      } else {
        if (priority < 50) {
          const error = new Error(`Queue is full (${currentQueueSize}/${this.maxQueueSize}) and event priority is too low`);
          error.isQueueFull = true;
          throw error;
        }
        
        const EventQueue = orm.getModel('EventQueue');
        const removedCount = await EventQueue.removeOldestNonGiftEvents(1);
        // logger.info(`Queue full, removed ${removedCount} low-priority events`);
      }
    }
  }

  async makeRoomForGiftEvent() {
    const eventsToRemove = Math.ceil(this.maxQueueSize * 0.1);
    const EventQueue = orm.getModel('EventQueue');
    return await EventQueue.removeOldestNonGiftEvents(eventsToRemove);
  }

  getEventPriority(eventType, serviceId = null, eventData = null) {
    // Si es un regalo y hay datos del evento, verificar prioridades específicas de regalo
    if ((eventType === 'tiktok:gift' || eventType === 'tiktok:donation') && serviceId && eventData) {
      const giftPriorities = this.serviceGiftPriorities.get(serviceId);
      if (giftPriorities) {
        const giftName = eventData.giftName || eventData.gift_name;
        const giftId = eventData.giftId || eventData.gift_id;
        const giftCost = eventData.cost || eventData.gift_cost || 0;
        
        logger.debug(`🔍 Gift priority lookup for service ${serviceId}: name="${giftName}", id="${giftId}", cost=${giftCost}`);
        
        // Buscar por nombre específico del regalo
        if (giftName && giftPriorities.byName && giftPriorities.byName[giftName.toLowerCase()]) {
          const priority = giftPriorities.byName[giftName.toLowerCase()];
          logger.debug(`✅ Found gift priority by name: ${giftName.toLowerCase()} -> ${priority}`);
          return priority;
        }
        
        // Buscar por ID del regalo
        if (giftId && giftPriorities.byId && giftPriorities.byId[giftId]) {
          const priority = giftPriorities.byId[giftId];
          logger.debug(`✅ Found gift priority by ID: ${giftId} -> ${priority}`);
          return priority;
        }
        
        // Buscar por rango de costo
        if (giftCost > 0 && giftPriorities.byCostRange) {
          for (const range of giftPriorities.byCostRange) {
            if (giftCost >= range.minCost && giftCost <= range.maxCost) {
              logger.debug(`✅ Found gift priority by cost range: ${giftCost} in [${range.minCost}-${range.maxCost}] -> ${range.priority}`);
              return range.priority;
            }
          }
        }
        
        logger.debug(`❌ No specific gift priority found, falling back to service event priority`);
      } else {
        logger.debug(`❌ No gift priorities configured for service ${serviceId}`);
      }
    }
    
    // Si hay un servicio específico y tiene prioridades personalizadas
    if (serviceId && this.servicePriorities.has(serviceId)) {
      const servicePriorities = this.servicePriorities.get(serviceId);
      if (servicePriorities[eventType] !== undefined) {
        const priority = servicePriorities[eventType];
        logger.debug(`✅ Found service event priority: ${eventType} for ${serviceId} -> ${priority}`);
        return priority;
      }
    }
    
    // Usar prioridades por defecto
    const defaultPriority = this.eventPriorities[eventType] || this.eventPriorities.default;
    logger.debug(`🔄 Using default priority: ${eventType} -> ${defaultPriority}`);
    return defaultPriority;
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

  // Registrar un procesador para notificaciones
  registerProcessor(processor) {
    if (!this.processors.includes(processor)) {
      this.processors.push(processor);
      logger.debug(`Processor ${processor.name} registered for notifications`);
    }
  }

  // Desregistrar un procesador
  unregisterProcessor(processor) {
    const index = this.processors.indexOf(processor);
    if (index > -1) {
      this.processors.splice(index, 1);
      logger.debug(`Processor ${processor.name} unregistered from notifications`);
    }
  }

  // Método para establecer prioridades personalizadas para un servicio
  setServiceEventPriorities(serviceId, customPriorities) {
    if (!serviceId) {
      logger.warn('Cannot set service priorities without serviceId');
      return false;
    }
    
    // Validar que las prioridades sean números
    const validatedPriorities = {};
    let hasValidPriorities = false;
    
    for (const [eventType, priority] of Object.entries(customPriorities)) {
      if (typeof priority === 'number' && priority >= 0) {
        validatedPriorities[eventType] = priority;
        hasValidPriorities = true;
      } else {
        logger.warn(`Invalid priority for ${eventType}: ${priority} (must be a number >= 0)`);
      }
    }
    
    if (hasValidPriorities) {
      this.servicePriorities.set(serviceId, validatedPriorities);
      logger.info(`Custom event priorities set for service ${serviceId}:`, validatedPriorities);
      return true;
    } else {
      logger.warn(`No valid priorities provided for service ${serviceId}`);
      return false;
    }
  }
  
  // Método para establecer prioridades específicas por tipo de regalo
  setServiceGiftPriorities(serviceId, giftPriorities) {
    if (!serviceId) {
      logger.warn('Cannot set gift priorities without serviceId');
      return false;
    }
    
    if (!giftPriorities || typeof giftPriorities !== 'object') {
      logger.warn(`Invalid gift priorities provided for service ${serviceId}`);
      return false;
    }
    
    const validatedGiftPriorities = {
      byName: {},
      byId: {},
      byCostRange: []
    };
    
    let hasValidPriorities = false;
    
    // Validar prioridades por nombre de regalo
    if (giftPriorities.byName && typeof giftPriorities.byName === 'object') {
      for (const [giftName, priority] of Object.entries(giftPriorities.byName)) {
        if (typeof priority === 'number' && priority >= 0) {
          validatedGiftPriorities.byName[giftName.toLowerCase()] = priority;
          hasValidPriorities = true;
        } else {
          logger.warn(`Invalid priority for gift name '${giftName}': ${priority} (must be a number >= 0)`);
        }
      }
    }
    
    // Validar prioridades por ID de regalo
    if (giftPriorities.byId && typeof giftPriorities.byId === 'object') {
      for (const [giftId, priority] of Object.entries(giftPriorities.byId)) {
        if (typeof priority === 'number' && priority >= 0) {
          validatedGiftPriorities.byId[giftId] = priority;
          hasValidPriorities = true;
        } else {
          logger.warn(`Invalid priority for gift ID '${giftId}': ${priority} (must be a number >= 0)`);
        }
      }
    }
    
    // Validar prioridades por rango de costo
    if (giftPriorities.byCostRange && Array.isArray(giftPriorities.byCostRange)) {
      for (const range of giftPriorities.byCostRange) {
        if (range && 
            typeof range.minCost === 'number' && range.minCost >= 0 &&
            typeof range.maxCost === 'number' && range.maxCost >= range.minCost &&
            typeof range.priority === 'number' && range.priority >= 0) {
          validatedGiftPriorities.byCostRange.push({
            minCost: range.minCost,
            maxCost: range.maxCost,
            priority: range.priority
          });
          hasValidPriorities = true;
        } else {
          logger.warn(`Invalid cost range configuration:`, range);
        }
      }
      
      // Ordenar rangos de costo por minCost para búsqueda eficiente
      validatedGiftPriorities.byCostRange.sort((a, b) => a.minCost - b.minCost);
    }
    
    if (hasValidPriorities) {
      this.serviceGiftPriorities.set(serviceId, validatedGiftPriorities);
      logger.info(`Gift-specific priorities set for service ${serviceId}:`, validatedGiftPriorities);
      return true;
    } else {
      logger.warn(`No valid gift priorities provided for service ${serviceId}`);
      return false;
    }
  }
  
  // Método para obtener las prioridades de un servicio específico
  getServiceEventPriorities(serviceId) {
    if (!serviceId) {
      return { ...this.defaultEventPriorities };
    }
    
    const servicePriorities = this.servicePriorities.get(serviceId);
    if (servicePriorities) {
      // Combinar prioridades por defecto con las del servicio
      return { ...this.defaultEventPriorities, ...servicePriorities };
    }
    
    return { ...this.defaultEventPriorities };
  }
  
  // Método para limpiar las prioridades de un servicio
  clearServiceEventPriorities(serviceId) {
    let cleared = false;
    
    if (serviceId && this.servicePriorities.has(serviceId)) {
      this.servicePriorities.delete(serviceId);
      cleared = true;
    }
    
    if (serviceId && this.serviceGiftPriorities.has(serviceId)) {
      this.serviceGiftPriorities.delete(serviceId);
      cleared = true;
    }
    
    if (cleared) {
      logger.info(`Custom priorities cleared for service ${serviceId}`);
      return true;
    }
    return false;
  }
  
  // Método para limpiar solo las prioridades de regalos de un servicio
  clearServiceGiftPriorities(serviceId) {
    if (serviceId && this.serviceGiftPriorities.has(serviceId)) {
      this.serviceGiftPriorities.delete(serviceId);
      logger.info(`Gift priorities cleared for service ${serviceId}`);
      return true;
    }
    return false;
  }
  
  // Método para obtener todas las prioridades de servicios registrados
  getAllServicePriorities() {
    const result = {
      default: this.defaultEventPriorities,
      services: {}
    };
    
    for (const [serviceId, priorities] of this.servicePriorities.entries()) {
      result.services[serviceId] = { 
        eventPriorities: { ...this.defaultEventPriorities, ...priorities },
        giftPriorities: this.serviceGiftPriorities.get(serviceId) || null
      };
    }
    
    // Agregar servicios que solo tienen prioridades de regalos
    for (const [serviceId, giftPriorities] of this.serviceGiftPriorities.entries()) {
      if (!result.services[serviceId]) {
        result.services[serviceId] = {
          eventPriorities: { ...this.defaultEventPriorities },
          giftPriorities: giftPriorities
        };
      }
    }
    
    return result;
  }
  
  // Método para obtener las prioridades de regalos de un servicio específico
  getServiceGiftPriorities(serviceId) {
    if (!serviceId) return null;
    return this.serviceGiftPriorities.get(serviceId) || null;
  }

  // Notificar a todos los procesadores que hay nuevos trabajos
  notifyProcessors() {
    this.processors.forEach(processor => {
      try {
        processor.notifyNewJob();
      } catch (error) {
        logger.error(`Failed to notify processor ${processor.name}:`, error);
      }
    });
  }
}

module.exports = new QueueManager();