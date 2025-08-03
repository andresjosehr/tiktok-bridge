const { WebcastPushConnection } = require('tiktok-live-connector');
const eventManager = require('../eventManager');
const logger = require('../../utils/logger');
const config = require('../../config/config');

class TikTokService {
  constructor() {
    this.connection = null;
    this._isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.tiktok.maxReconnectAttempts || 5;
    this.connectedAt = null;
    this.lastConnectedAt = null;
  }

  async initialize() {
    try {
      await this.connect(config.tiktok.username);
      logger.info('TikTok service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize TikTok service:', error);
      throw error;
    }
  }

  async connect(username) {
    if (!username) {
      throw new Error('TikTok username is required');
    }

    try {
      const connectionOptions = {
        processInitialData: true,
        enableExtendedGiftInfo: true,
        requestPollingIntervalMs: 1000,
        webClientParams: {
          'aid': 1988,
          'app_language': 'en-US',
          'app_name': 'musical_ly',
          'channel': 'googleplay',
          'device_platform': 'android'
        }
      };

      if (config.tiktok.sessionId) {
        connectionOptions.sessionId = config.tiktok.sessionId;
        logger.info('Using TikTok session ID for connection');
      } else {
        logger.warn('No TikTok session ID provided. You may need to set TIKTOK_SESSION_ID environment variable for stable connections');
      }

      this.connection = new WebcastPushConnection(username, connectionOptions);

      this.setupEventHandlers();
      
      await this.connection.connect();
      this._isConnected = true;
      this.reconnectAttempts = 0;
      this.connectedAt = Date.now();
      this.lastConnectedAt = Date.now();
      
      logger.info(`Connected to TikTok live stream: ${username}`);
      
    } catch (error) {
      logger.error('Failed to connect to TikTok:', error);
      await this.handleReconnect(username);
    }
  }

  setupEventHandlers() {
    this.connection.on('connected', (state) => {
      logger.info(`Connected to TikTok live stream. Room ID: ${state.roomId}`);
      eventManager.emit('tiktok:connected', { roomId: state.roomId });
    });

    this.connection.on('disconnected', () => {
      logger.warn('Disconnected from TikTok live stream');
      this._isConnected = false;
      this.connectedAt = null;
      eventManager.emit('tiktok:disconnected');
    });

    this.connection.on('error', (error) => {
      logger.error('TikTok connection error:', error);
      eventManager.emit('tiktok:error', { error: error.message });
    });

    this.connection.on('chat', (data) => {
      logger.debug(`Chat message: ${data.comment} by ${data.uniqueId}`);
      eventManager.emit('tiktok:chat', {
        user: data.uniqueId,
        message: data.comment,
        timestamp: new Date().toISOString()
      });
    });

    this.connection.on('gift', (data) => {
      logger.debug(`Gift: ${data.giftName} x${data.repeatCount} by ${data.uniqueId}`);
      eventManager.emit('tiktok:gift', {
        user: data.uniqueId,
        giftName: data.giftName,
        giftId: data.giftId,
        repeatCount: data.repeatCount,
        cost: data.diamondCount,
        timestamp: new Date().toISOString()
      });
    });

    this.connection.on('follow', (data) => {
      logger.debug(`New follower: ${data.uniqueId}`);
      eventManager.emit('tiktok:follow', {
        user: data.uniqueId,
        timestamp: new Date().toISOString()
      });
    });

    this.connection.on('like', (data) => {
      logger.debug(`${data.likeCount} likes by ${data.uniqueId}`);
      eventManager.emit('tiktok:like', {
        user: data.uniqueId,
        likeCount: data.likeCount,
        totalLikeCount: data.totalLikeCount,
        timestamp: new Date().toISOString()
      });
    });

    this.connection.on('share', (data) => {
      logger.debug(`Stream shared by ${data.uniqueId}`);
      eventManager.emit('tiktok:share', {
        user: data.uniqueId,
        timestamp: new Date().toISOString()
      });
    });

    this.connection.on('roomUser', (data) => {
      logger.debug(`Room user update: ${data.viewerCount} viewers`);
      eventManager.emit('tiktok:viewerCount', {
        viewerCount: data.viewerCount,
        timestamp: new Date().toISOString()
      });
    });
  }

  async handleReconnect(username) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      eventManager.emit('tiktok:maxReconnectReached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    logger.info(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connect(username);
    }, delay);
  }

  disconnect() {
    if (this.connection) {
      this.connection.disconnect();
      this.connection = null;
      this._isConnected = false;
      this.connectedAt = null;
      logger.info('TikTok service disconnected');
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this._isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    };
  }

  isConnected() {
    return this._isConnected;
  }

  getConnectionState() {
    return this.connection ? this.connection.state : null;
  }

  getCurrentStream() {
    return this.connection ? this.connection.roomId : null;
  }

  getLastConnectedAt() {
    return this.lastConnectedAt || null;
  }

  getConnectionAttempts() {
    return this.reconnectAttempts;
  }

  getUptime() {
    return this.connectedAt ? Date.now() - this.connectedAt : 0;
  }

  isHealthy() {
    return this._isConnected && this.reconnectAttempts < this.maxReconnectAttempts;
  }

  async restart() {
    logger.info('Restarting TikTok service...');
    this.disconnect();
    await this.initialize();
  }

  async reconnect() {
    logger.info('Reconnecting TikTok service...');
    if (this.connection) {
      this.disconnect();
    }
    await this.connect(config.tiktok.username);
  }
}

module.exports = new TikTokService();