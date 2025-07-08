const logger = require('../utils/logger');

class ServiceBase {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this._isConnected = false;
    this.connectedAt = null;
    this.lastActivity = null;
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
}

module.exports = ServiceBase;