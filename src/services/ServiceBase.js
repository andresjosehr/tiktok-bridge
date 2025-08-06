const logger = require('../utils/logger');

class ServiceBase {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this._isConnected = false;
    this.connectedAt = null;
    this.lastActivity = null;
    this.processOnlyFinalGifts = false; // Por defecto procesar todos los gifts
    this.customEventPriorities = null; // Prioridades personalizadas del servicio
    this.customGiftPriorities = null; // Prioridades específicas por tipo de regalo
  }

  async handleTikTokChat(data) {
    throw new Error(`${this.serviceName}: handleTikTokChat must be implemented`);
  }

  async handleTikTokGift(data) {
    throw new Error(`${this.serviceName}: handleTikTokGift must be implemented`);
  }

  async handleTikTokFollow(data) {
    throw new Error(`${this.serviceName}: handleTikTokFollow must be implemented`);
  }

  async handleTikTokLike(data) {
    throw new Error(`${this.serviceName}: handleTikTokLike must be implemented`);
  }

  async handleTikTokShare(data) {
    throw new Error(`${this.serviceName}: handleTikTokShare must be implemented`);
  }

  async handleViewerCount(data) {
    throw new Error(`${this.serviceName}: handleViewerCount must be implemented`);
  }

  isConnected() {
    return this._isConnected;
  }

  getLastActivity() {
    return this.lastActivity;
  }

  getServiceStatus() {
    return {
      serviceName: this.serviceName,
      isConnected: this._isConnected,
      connectedAt: this.connectedAt,
      lastActivity: this.lastActivity,
      hasCustomPriorities: this.customEventPriorities !== null,
      hasCustomGiftPriorities: this.customGiftPriorities !== null
    };
  }

  updateLastActivity() {
    this.lastActivity = new Date();
  }

  setConnected(connected) {
    this._isConnected = connected;
    if (connected) {
      this.connectedAt = new Date();
    } else {
      this.connectedAt = null;
    }
  }

  // Método para configurar si el servicio solo procesa eventos finales de rachas de gifts
  setProcessOnlyFinalGifts(onlyFinal) {
    this.processOnlyFinalGifts = onlyFinal;
    logger.info(`${this.serviceName}: Process only final gifts set to ${onlyFinal}`);
  }

  // Método para verificar si el servicio debe procesar un evento de gift
  shouldProcessGift(eventData, queueData) {
    const repeatEnd = queueData?.repeat_end;
    
    if (this.processOnlyFinalGifts) {
      // Si está configurado para solo finales, verificar repeat_end
      // Si repeat_end es null (evento no-streakable), procesar
      // Si repeat_end es true (final de racha), procesar
      // Si repeat_end es false (parte de racha en progreso), NO procesar
      return repeatEnd !== false;
    } else {
      // Si NO está configurado para solo finales, procesar solo intermedios
      // Si repeat_end es null (evento no-streakable), procesar
      // Si repeat_end es false (parte de racha en progreso), procesar
      // Si repeat_end es true (final de racha), NO procesar
      return repeatEnd !== true;
    }
  }
  
  // Método para establecer prioridades personalizadas de eventos
  setEventPriorities(customPriorities) {
    if (!customPriorities || typeof customPriorities !== 'object') {
      logger.warn(`${this.serviceName}: Invalid custom priorities provided`);
      return false;
    }
    
    // Validar que las prioridades sean números válidos
    const validatedPriorities = {};
    let hasValidPriorities = false;
    
    for (const [eventType, priority] of Object.entries(customPriorities)) {
      if (typeof priority === 'number' && priority >= 0) {
        validatedPriorities[eventType] = priority;
        hasValidPriorities = true;
      } else {
        logger.warn(`${this.serviceName}: Invalid priority for ${eventType}: ${priority} (must be a number >= 0)`);
      }
    }
    
    if (hasValidPriorities) {
      this.customEventPriorities = validatedPriorities;
      logger.info(`${this.serviceName}: Custom event priorities set:`, validatedPriorities);
      return true;
    } else {
      logger.warn(`${this.serviceName}: No valid priorities provided`);
      return false;
    }
  }
  
  // Método para obtener las prioridades personalizadas
  getEventPriorities() {
    return this.customEventPriorities ? { ...this.customEventPriorities } : null;
  }
  
  // Método para limpiar las prioridades personalizadas
  clearEventPriorities() {
    let cleared = false;
    
    if (this.customEventPriorities) {
      this.customEventPriorities = null;
      cleared = true;
    }
    
    if (this.customGiftPriorities) {
      this.customGiftPriorities = null;
      cleared = true;
    }
    
    if (cleared) {
      logger.info(`${this.serviceName}: Custom priorities cleared`);
      return true;
    }
    return false;
  }
  
  // Método para establecer prioridades específicas por tipo de regalo
  setGiftPriorities(giftPriorities) {
    if (!giftPriorities || typeof giftPriorities !== 'object') {
      logger.warn(`${this.serviceName}: Invalid gift priorities provided`);
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
          logger.warn(`${this.serviceName}: Invalid priority for gift name '${giftName}': ${priority} (must be a number >= 0)`);
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
          logger.warn(`${this.serviceName}: Invalid priority for gift ID '${giftId}': ${priority} (must be a number >= 0)`);
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
            priority: range.priority,
            description: range.description || `Rango ${range.minCost}-${range.maxCost} monedas`
          });
          hasValidPriorities = true;
        } else {
          logger.warn(`${this.serviceName}: Invalid cost range configuration:`, range);
        }
      }
      
      // Ordenar rangos de costo por minCost para búsqueda eficiente
      validatedGiftPriorities.byCostRange.sort((a, b) => a.minCost - b.minCost);
    }
    
    if (hasValidPriorities) {
      this.customGiftPriorities = validatedGiftPriorities;
      logger.info(`${this.serviceName}: Gift-specific priorities set:`, validatedGiftPriorities);
      return true;
    } else {
      logger.warn(`${this.serviceName}: No valid gift priorities provided`);
      return false;
    }
  }
  
  // Método para obtener las prioridades de regalos
  getGiftPriorities() {
    return this.customGiftPriorities ? { ...this.customGiftPriorities } : null;
  }
  
  // Método para limpiar solo las prioridades de regalos
  clearGiftPriorities() {
    if (this.customGiftPriorities) {
      this.customGiftPriorities = null;
      logger.info(`${this.serviceName}: Gift priorities cleared`);
      return true;
    }
    return false;
  }
  
  // Método helper para definir prioridades de manera más conveniente
  definePriorities(priorities) {
    return this.setEventPriorities(priorities);
  }
  
  // Método helper para definir prioridades de regalos de manera más conveniente
  defineGiftPriorities(giftPriorities) {
    return this.setGiftPriorities(giftPriorities);
  }
}

module.exports = ServiceBase;