const logger = require('../utils/logger');

class ServiceBase {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this._isConnected = false;
    this.connectedAt = null;
    this.lastActivity = null;
    this.processOnlyFinalGifts = false; // Por defecto procesar todos los gifts
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
      lastActivity: this.lastActivity
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
}

module.exports = ServiceBase;