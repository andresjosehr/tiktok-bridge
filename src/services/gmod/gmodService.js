const WebSocket = require('ws');
const axios = require('axios');
const Rcon = require('rcon');
const logger = require('../../utils/logger');
const config = require('../../config/config');

class GModService {
  constructor() {
    this.wsConnection = null;
    this.rconConnection = null;
    this.httpClient = axios.create({
      baseURL: `http://${config.gmod.host}:${config.gmod.httpPort}`,
      timeout: 5000
    });
    this.reconnectInterval = null;
    this._isConnected = false;
    this.connectedAt = null;
  }

  async initialize() {
    if (!config.gmod.enabled) {
      logger.info('GMod service disabled by configuration');
      return;
    }
    
    logger.info('GMod service initialized with RCON support');
    await this.connectRCON();
  }

  async connectRCON() {
    return new Promise((resolve, reject) => {
      try {
        // Limpiar conexión anterior si existe
        if (this.rconConnection) {
          this.rconConnection.disconnect();
          this.rconConnection = null;
        }

        // Crear nueva conexión usando el patrón que funciona
        this.rconConnection = new Rcon(
          config.gmod.host,
          config.gmod.rconPort || 27015,
          config.gmod.rconPassword
        );

        let isAuthenticated = false;
        let isConnected = false;

        // Configurar timeout para la conexión
        const timeout = setTimeout(() => {
          if (this.rconConnection) {
            this.rconConnection.disconnect();
          }
          this._isConnected = false;
          this.connectedAt = null;
          this.scheduleReconnect();
          reject(new Error('RCON connection timeout'));
        }, 10000);

        // Evento: autenticación exitosa
        this.rconConnection.on('auth', () => {
          logger.info('✅ Connected to GMod server via RCON');
          isAuthenticated = true;
          this._isConnected = true;
          this.connectedAt = Date.now();
          this.clearReconnectInterval();
          
          clearTimeout(timeout);
          resolve();
        });

        // Evento: conexión establecida
        this.rconConnection.on('connect', () => {
          logger.debug('🔗 RCON TCP connection established');
          isConnected = true;
        });

        // Evento: respuesta (para comandos que se ejecuten)
        this.rconConnection.on('response', (str) => {
          logger.debug('📥 RCON response received:', str);
        });

        // Evento: error de conexión
        this.rconConnection.on('error', (error) => {
          logger.error('❌ RCON connection error:', error.message);
          clearTimeout(timeout);
          isAuthenticated = false;
          isConnected = false;
          this._isConnected = false;
          this.connectedAt = null;
          this.scheduleReconnect();
          reject(error);
        });

        // Evento: desconexión
        this.rconConnection.on('end', () => {
          logger.warn('🔌 RCON connection ended');
          isAuthenticated = false;
          isConnected = false;
          this._isConnected = false;
          this.connectedAt = null;
          this.scheduleReconnect();
        });

        // Evento: conexión cerrada
        this.rconConnection.on('close', () => {
          logger.warn('🔒 RCON connection closed');
          isAuthenticated = false;
          isConnected = false;
          this._isConnected = false;
          this.connectedAt = null;
        });

        // Iniciar conexión
        logger.info('🔄 Connecting to GMod RCON...');
        this.rconConnection.connect();

      } catch (error) {
        logger.error('Failed to initialize GMod RCON:', error);
        this._isConnected = false;
        this.scheduleReconnect();
        reject(error);
      }
    });
  }

  async connectWebSocket() {
    try {
      // Limpiar conexión anterior si existe
      if (this.wsConnection) {
        this.wsConnection.removeAllListeners();
        this.wsConnection.close();
        this.wsConnection = null;
      }

      const wsUrl = `ws://${config.gmod.host}:${config.gmod.wsPort}`;
      this.wsConnection = new WebSocket(wsUrl, {
        handshakeTimeout: 5000,
        perMessageDeflate: false
      });

      this.wsConnection.on('open', () => {
        logger.info('Connected to GMod WebSocket server');
        this._isConnected = true;
        this.connectedAt = Date.now();
        this.clearReconnectInterval();
      });

      this.wsConnection.on('close', (code, reason) => {
        logger.warn(`GMod WebSocket connection closed - Code: ${code}, Reason: ${reason}`);
        this._isConnected = false;
        this.connectedAt = null;
        this.scheduleReconnect();
      });

      this.wsConnection.on('error', (error) => {
        if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
          logger.warn(`GMod WebSocket connection failed: ${error.code} - Server may be offline`);
        } else {
          logger.error('GMod WebSocket error:', error);
        }
        
        this._isConnected = false;
        this.connectedAt = null;
        
        // Solo programar reconexión si no hay una ya programada
        if (!this.reconnectInterval) {
          this.scheduleReconnect();
        }
      });

      this.wsConnection.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          logger.debug('Received from GMod:', message);
        } catch (error) {
          logger.error('Failed to parse GMod message:', error);
        }
      });

    } catch (error) {
      logger.error('Failed to connect to GMod WebSocket:', error);
      throw error;
    }
  }

  scheduleReconnect() {
    if (this.reconnectInterval) return;

    this.reconnectInterval = setInterval(async () => {
      logger.info('Attempting to reconnect to GMod via RCON...');
      try {
        await this.connectRCON();
      } catch (error) {
        logger.error('RCON reconnection attempt failed:', error);
      }
    }, config.gmod.reconnectInterval || 10000);
  }

  clearReconnectInterval() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  async sendWebSocketMessage(eventType, data) {
    if (!this._isConnected || !this.wsConnection) {
      logger.warn('WebSocket not connected, falling back to HTTP');
      return false;
    }

    try {
      const message = {
        type: eventType,
        data: data,
        timestamp: new Date().toISOString()
      };

      this.wsConnection.send(JSON.stringify(message));
      logger.debug(`Sent WebSocket message to GMod: ${eventType}`);
      return true;
    } catch (error) {
      logger.error('Failed to send WebSocket message to GMod:', error);
      return false;
    }
  }

  async sendHttpRequest(endpoint, data) {
    try {
      const response = await this.httpClient.post(endpoint, {
        data: data,
        timestamp: new Date().toISOString()
      });

      logger.debug(`HTTP request to GMod successful: ${endpoint}`);
      return response.data;
    } catch (error) {
      logger.error(`HTTP request to GMod failed: ${endpoint}`, error.message);
      throw error;
    }
  }

  async sendRCONCommand(command) {
    if (!this._isConnected || !this.rconConnection) {
      logger.warn('RCON not connected, cannot send command');
      return false;
    }

    return new Promise((resolve, reject) => {
      try {
        let responseReceived = false;
        
        // Configurar timeout para el comando
        const timeout = setTimeout(() => {
          if (!responseReceived) {
            logger.warn(`RCON command timeout: ${command}`);
            resolve(false);
          }
        }, 5000);

        // Configurar listener único para esta respuesta
        const responseHandler = (response) => {
          if (!responseReceived) {
            responseReceived = true;
            clearTimeout(timeout);
            logger.debug(`✅ RCON command sent: ${command}`);
            resolve(response || true);
          }
        };

        // Agregar listener temporal
        this.rconConnection.once('response', responseHandler);

        // Enviar comando
        this.rconConnection.send(command);

      } catch (error) {
        logger.error('Failed to send RCON command:', error);
        resolve(false);
      }
    });
  }

  async handleTikTokChat(data) {
    const command = `lua_run hook.Run("TikTokChat", "${data.user}", "${data.message.replace(/"/g, '\\"')}")`;
    const success = await this.sendRCONCommand(command);

    if (!success) {
      logger.warn('Failed to send chat message via RCON, trying WebSocket fallback');
      const wsSuccess = await this.sendWebSocketMessage('tiktok_chat', {
        user: data.user,
        message: data.message,
        timestamp: data.timestamp
      });

      if (!wsSuccess) {
        logger.warn('Failed to send chat message via WebSocket, trying HTTP fallback');
        try {
          await this.sendHttpRequest('/tiktok/chat', data);
        } catch (error) {
          logger.error('All communication methods failed for chat message');
        }
      }
    }
  }

  async handleTikTokGift(data) {
    const command = `lua_run hook.Run("TikTokGift", "${data.user}", "${data.giftName}", ${data.giftId}, ${data.repeatCount}, ${data.cost})`;
    const success = await this.sendRCONCommand(command);

    if (!success) {
      logger.warn('Failed to send gift message via RCON, trying WebSocket fallback');
      const wsSuccess = await this.sendWebSocketMessage('tiktok_gift', {
        user: data.user,
        giftName: data.giftName,
        giftId: data.giftId,
        repeatCount: data.repeatCount,
        cost: data.cost,
        timestamp: data.timestamp
      });

      if (!wsSuccess) {
        logger.warn('Failed to send gift message via WebSocket, trying HTTP fallback');
        try {
          await this.sendHttpRequest('/tiktok/gift', data);
        } catch (error) {
          logger.error('All communication methods failed for gift message');
        }
      }
    }
  }

  async handleTikTokFollow(data) {
    const command = `lua_run hook.Run("TikTokFollow", "${data.user}")`;
    const success = await this.sendRCONCommand(command);

    if (!success) {
      await this.sendWebSocketMessage('tiktok_follow', {
        user: data.user,
        timestamp: data.timestamp
      });
    }
  }

  async handleTikTokLike(data) {
    const command = `lua_run hook.Run("TikTokLike", "${data.user}", ${data.likeCount}, ${data.totalLikeCount})`;
    const success = await this.sendRCONCommand(command);

    if (!success) {
      await this.sendWebSocketMessage('tiktok_like', {
        user: data.user,
        likeCount: data.likeCount,
        totalLikeCount: data.totalLikeCount,
        timestamp: data.timestamp
      });
    }
  }

  async handleTikTokShare(data) {
    const command = `lua_run hook.Run("TikTokShare", "${data.user}")`;
    const success = await this.sendRCONCommand(command);

    if (!success) {
      await this.sendWebSocketMessage('tiktok_share', {
        user: data.user,
        timestamp: data.timestamp
      });
    }
  }

  async handleViewerCount(data) {
    const command = `lua_run hook.Run("TikTokViewers", ${data.viewerCount})`;
    const success = await this.sendRCONCommand(command);

    if (!success) {
      await this.sendWebSocketMessage('tiktok_viewers', {
        viewerCount: data.viewerCount,
        timestamp: data.timestamp
      });
    }
  }

  async executeCommand(command, params = {}) {
    try {
      const response = await this.sendRCONCommand(command);
      if (response !== false) {
        return response;
      }
      
      // Fallback to HTTP if RCON fails
      const httpResponse = await this.sendHttpRequest('/command', {
        command: command,
        params: params
      });
      return httpResponse;
    } catch (error) {
      logger.error(`Failed to execute GMod command: ${command}`, error);
      throw error;
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this._isConnected,
      rconConnected: this._isConnected && this.rconConnection !== null,
      wsConnected: this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN,
      host: config.gmod.host,
      rconPort: config.gmod.rconPort || 27015,
      wsPort: config.gmod.wsPort,
      httpPort: config.gmod.httpPort
    };
  }

  async disconnect() {
    this.clearReconnectInterval();
    
    if (this.rconConnection) {
      this.rconConnection.disconnect();
      this.rconConnection = null;
    }
    
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
    
    this._isConnected = false;
    this.connectedAt = null;
    logger.info('GMod service disconnected');
  }

  isConnected() {
    return this._isConnected;
  }

  getUptime() {
    return this.connectedAt ? Date.now() - this.connectedAt : 0;
  }

  isHealthy() {
    return this._isConnected && this.rconConnection !== null;
  }

  async restart() {
    logger.info('Restarting GMod service...');
    await this.disconnect();
    await this.initialize();
  }
}

module.exports = new GModService();