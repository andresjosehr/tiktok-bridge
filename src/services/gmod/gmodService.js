const WebSocket = require('ws');
const axios = require('axios');
const Rcon = require('rcon');
const logger = require('../../utils/logger');
const config = require('../../config/config');
const ServiceBase = require('../ServiceBase');
const ttsService = require('../external/ttsService');
const fs = require('fs');
const path = require('path');

class GModService extends ServiceBase {
  constructor() {
    super('GMod');
    this.wsConnection = null;
    this.rconConnection = null;
    this.httpClient = axios.create({
      baseURL: `http://${config.gmod.host}:${config.gmod.httpPort}`,
      timeout: 5000
    });
    this.reconnectInterval = null;
    
    // Sistema de cola de bailes
    this.danceQueue = [];
    this.isDancing = false;
    this.targetPlayer = 'joseandreshernandezross';
    this.danceTimeout = 10000; // 10 segundos por baile
    this.currentDanceTimer = null;
    
    // Bailes disponibles por categoría
    this.danceCategories = {
      fortnite: [
        'amod_fortnite_nevergonna',
        'amod_fortnite_aloha',
        'amod_fortnite_dance_distraction',
        'amod_fortnite_behere',
        'amod_fortnite_littleegg',
        'amod_fortnite_lyrical',
        'amod_fortnite_ohana',
        'amod_fortnite_prance',
        'amod_fortnite_realm',
        'amod_fortnite_sleek',
        'amod_fortnite_spectacleweb',
        'amod_fortnite_tally',
        'amod_fortnite_tonal',
        'amod_fortnite_zest',
        'amod_fortnite_sunlit',
        'amod_fortnite_marionette1',
        'amod_fortnite_twistdaytona',
        'amod_fortnite_hotpink',
        'amod_fortnite_sunburstdance',
        'amod_fortnite_cyclone_headbang',
        'amod_fortnite_cyclone',
        'amod_fortnite_julybooks',
        'amod_fortnite_twistwasp',
        'amod_fortnite_stringdance',
        'amod_fortnite_gasstation',
        'amod_fortnite_comrade',
        'amod_fortnite_indigoapple',
        'amod_fortnite_zebrascramble',
        'amod_fortnite_heavyroardance',
        'amod_fortnite_cerealbox',
        'amod_fortnite_griddle',
        'amod_fortnite_walkywalk',
        'amod_fortnite_eerie',
        'amod_fortnite_jumpingjoy_static',
        'amod_fortnite_autumntea',
        'amod_fortnite_jiggle',
        'amod_fortnite_rememberme',
        'amod_fortnite_grooving',
        'amod_fortnite_devotion',
        'amod_fortnite_chew'
      ],
      mmd: [
        'amod_mmd_helltaker',
        'amod_mmd_dance_nostalogic',
        'amod_mmd_dance_specialist',
        'amod_mmd_dance_daisukeevolution',
        'amod_mmd_dance_caramelldansen',
        'amod_mmd_whistle',
        'amod_mmd_badbadwater',
        'amod_mmd_king_kanaria',
        'amod_mmd_dance_tuni-kun',
        'amod_mmd_fiery_sarilang',
        'amod_mmd_followtheleader',
        'amod_mmd_getdown',
        'amod_mmd_goodbyedeclaration',
        'amod_mmd_ponponpon',
        'amod_mmd_girls',
        'amod_mmd_mrsaxobeat',
        'amod_mmd_aoagoodluck',
        'amod_mmd_nyaarigato',
        'amod_mmd_ghostdance',
        'amod_mmd_blablabla',
        'amod_mmd_hiasobi',
        'amod_mmd_hiproll',
        'amod_mmd_chikichiki',
        'amod_mmd_caixukun',
        'amod_mmd_calisthenics',
        'amod_mmd_gfriendrough',
        'amod_mmd_massdestruction',
        'amod_mmd_mememe',
        'amod_mmd_senbonzakura',
        'amod_mmd_supermjopping',
        'amod_mmd_nahoha',
        'amod_mmd_ch4nge',
        'amod_mmd_conqueror',
        'amod_mmd_yoidore',
        'amod_mmd_dokuhebi',
        'amod_mmd_darling',
        'amod_mmd_dancin',
        'amod_mmd_adeepmentality',
        'amod_mmd_gimmexgimme',
        'amod_mmd_yaosobi-idol',
        'amod_mmd_kwlink',
        'amod_mmd_kemuthree'
      ],
      original: [
        'f_bbd',
        'f_chicken_moves',
        'f_crab_dance',
        'f_dance_off',
        'f_electroswing',
        'f_flossdance',
        'f_fresh',
        'f_glowstickdance',
        'f_jaywalk',
        'f_make_it_rain_v2',
        'f_mello',
        'f_mime',
        'f_og_runningman',
        'f_security_guard',
        'f_twist',
        'f_windmillfloss',
        'f_bendi',
        'f_crackshot',
        'f_dance_shoot',
        'f_dancing_girl',
        'f_kpop_02',
        'f_kpop_03',
        'f_kpop_04',
        'f_technozombie',
        'f_conga',
        'f_rock_guitar',
        'f_robotdance',
        'f_bandofthefort',
        'f_treadmilldance',
        'f_break_dance',
        'f_break_dance_v2',
        'f_dj_drop',
        'f_boogie_down',
        'f_cheerleader',
        'f_cowbell',
        'f_dance_swipeit',
        'f_groovejam',
        'f_hilowave',
        'f_hip_hop',
        'f_hip_hop_s7',
        'f_hiphop_01',
        'f_jammin',
        'f_mask_off',
        'f_runningv3',
        'f_thighslapper',
        'f_touchdown_dance',
        'f_trex',
        'f_eastern_bloc',
        'f_aerobicchamp',
        'f_afrohouse',
        'f_blow_kiss',
        'f_bring_it_on',
        'f_capoeira',
        'f_celebration',
        'f_charleston',
        'f_chicken',
        'f_chug',
        'f_confused',
        'f_crazyfeet',
        'f_cross_legs',
        'f_dance_disco_t3',
        'f_disagree',
        'f_dust_off_shoulders',
        'f_facepalm',
        'f_fancyfeet',
        'f_koreaneagle',
        'f_loser_dance',
        'f_flex',
        'f_heelclick',
        'f_flamenco',
        'f_hula',
        'f_flippnsexy',
        'f_headbanger',
        'f_infinidab',
        'f_golfclap',
        'f_i_break_you',
        'f_look_at_this',
        'f_livinglarge',
        'f_irishjig',
        'f_poplock',
        'f_pump_dance',
        'f_stagebow',
        'f_smooth_ride',
        'f_taichi',
        'f_tpose',
        'f_zippy_dance'
      ],
      pubg: [
        'amod_pubg_samsara',
        'amod_pubg_victorydance102',
        'amod_pubg_victorydance99',
        'amod_pubg_victorydance60',
        'amod_pubg_seetinh',
        'amod_pubg_2phuthon',
        'amod_pubg_bboombboom',
        'amod_pubg_tocatoca'
      ]
    };
    
    // Mapeo de eventos a categorías de bailes
    this.eventDanceMapping = {
      chat: 'original',
      gift: 'fortnite',
      follow: 'mmd',
      like: 'original',
      share: 'pubg'
    };

    // Cargar configuración de TTS
    this.loadTTSMessages();
    
    // Sistema de tracking de milestones
    this.lastLikeMilestone = 0;
    this.lastFollowMilestone = 0;
    this.likeMilestones = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    this.followMilestones = [1, 5, 10, 25, 50, 100, 250, 500, 1000];
  }

  loadTTSMessages() {
    try {
      const ttsPath = path.join(__dirname, 'gmod-tts.json');
      this.ttsMessages = JSON.parse(fs.readFileSync(ttsPath, 'utf8'));
      logger.info('TTS messages loaded successfully');
    } catch (error) {
      logger.error('Failed to load TTS messages:', error);
      this.ttsMessages = {};
    }
  }

  getRandomMessage(messageType, data = {}) {
    const messages = this.ttsMessages[messageType];
    if (!messages || messages.length === 0) {
      return null;
    }
    
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    // Reemplazar variables en el mensaje
    let processedMessage = randomMessage;
    for (const [key, value] of Object.entries(data)) {
      processedMessage = processedMessage.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    
    return processedMessage;
  }

  async generateAndSendTTS(messageType, data = {}) {
    if (!config.tts?.enabled || !ttsService.isEnabled()) {
      logger.debug('TTS is disabled, skipping audio generation');
      return;
    }

    const message = this.getRandomMessage(messageType, data);
    if (!message) {
      logger.warn(`No TTS message found for type: ${messageType}`);
      return;
    }

    try {
      logger.debug(`Generating TTS for: ${message}`);
      const ttsResult = await ttsService.generateSpeech(message);
      
      if (ttsResult && ttsResult.audioBuffer) {
        // TODO: Aquí puedes enviar el audio al servidor de GMod
        // Por ahora solo registramos que se generó exitosamente
        logger.info(`TTS generated successfully for message: ${message.substring(0, 50)}...`);
        
        // Opcionalmente, puedes guardar el archivo de audio temporalmente
        // o enviarlo directamente al servidor de GMod según tus necesidades
        
        return ttsResult;
      }
    } catch (error) {
      logger.error('Failed to generate TTS:', error);
    }
  }

  checkLikeMilestone(totalLikes) {
    for (const milestone of this.likeMilestones) {
      if (totalLikes >= milestone && this.lastLikeMilestone < milestone) {
        this.lastLikeMilestone = milestone;
        this.generateAndSendTTS('like_count_hit', {
          count: milestone
        }).catch(error => {
          logger.error('Failed to generate TTS for like milestone:', error);
        });
        return milestone;
      }
    }
    return null;
  }

  checkFollowMilestone(totalFollows) {
    for (const milestone of this.followMilestones) {
      if (totalFollows >= milestone && this.lastFollowMilestone < milestone) {
        this.lastFollowMilestone = milestone;
        this.generateAndSendTTS('follow_count_hit', {
          count: milestone
        }).catch(error => {
          logger.error('Failed to generate TTS for follow milestone:', error);
        });
        return milestone;
      }
    }
    return null;
  }

  async initialize() {
    if (!config.gmod.enabled) {
      logger.info('GMod service disabled by configuration');
      return;
    }
    
    logger.info('GMod service initialized with RCON support and dance queue system');
    await this.connectRCON();
    this.startDanceQueueProcessor();
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

    // Procesar un baile inmediatamente y esperar a que termine
    return await this.processSingleDance('chat', data);
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

    // Generar TTS para regalo
    this.generateAndSendTTS('gift', {
      user: data.user,
      giftName: data.giftName,
      cost: data.cost
    }).catch(error => {
      logger.error('Failed to generate TTS for gift:', error);
    });

    // Procesar un baile inmediatamente y esperar a que termine
    return await this.processSingleDance('gift', data);
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

    // Generar TTS para seguidor
    this.generateAndSendTTS('follow', {
      user: data.user
    }).catch(error => {
      logger.error('Failed to generate TTS for follow:', error);
    });

    // Procesar un baile inmediatamente y esperar a que termine
    return await this.processSingleDance('follow', data);
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

    // Verificar milestone de likes
    if (data.totalLikeCount) {
      this.checkLikeMilestone(data.totalLikeCount);
    }

    // Procesar un baile inmediatamente y esperar a que termine
    return await this.processSingleDance('like', data);
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

    // Procesar un baile inmediatamente y esperar a que termine
    return await this.processSingleDance('share', data);
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
      httpPort: config.gmod.httpPort,
      danceQueue: this.getDanceQueueStatus()
    };
  }

  async disconnect() {
    this.clearReconnectInterval();
    this.clearDanceQueue();
    
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

  // Sistema de cola de bailes
  getRandomDance(category) {
    const dances = this.danceCategories[category];
    if (!dances || dances.length === 0) {
      return null;
    }
    return dances[Math.floor(Math.random() * dances.length)];
  }

  // Procesar un solo baile inmediatamente y esperar a que termine
  async processSingleDance(eventType, data) {
    // Verificar si ya estamos bailando
    if (this.isDancing) {
      logger.info(`⏸️ Skipping ${eventType} event - already dancing`);
      // Crear una excepción especial para eventos omitidos
      const skipError = new Error('Event skipped - already dancing');
      skipError.isSkipped = true;
      throw skipError;
    }

    const category = this.eventDanceMapping[eventType];
    if (!category) {
      logger.warn(`No dance category mapped for event type: ${eventType}`);
      return false;
    }

    const dance = this.getRandomDance(category);
    if (!dance) {
      logger.warn(`No dances available for category: ${category}`);
      return false;
    }

    const danceItem = {
      dance,
      eventType,
      data,
      timestamp: Date.now()
    };

    logger.info(`Starting dance: ${dance} for event: ${eventType}`);
    
    // Marcar como bailando
    this.isDancing = true;
    
    try {
      // Ejecutar el baile
      const success = await this.executeDance(danceItem);
      
      if (success) {
        // Esperar la duración del baile
        await new Promise(resolve => {
          this.currentDanceTimer = setTimeout(() => {
            this.isDancing = false;
            this.currentDanceTimer = null;
            logger.info(`Dance completed: ${dance}`);
            resolve();
          }, this.danceTimeout);
        });
        return true;
      } else {
        this.isDancing = false;
        return false;
      }
    } catch (error) {
      logger.error(`Error executing dance ${dance}:`, error);
      this.isDancing = false;
      return false;
    }
  }

  addDanceToQueue(eventType, data) {
    const category = this.eventDanceMapping[eventType];
    if (!category) {
      logger.warn(`No dance category mapped for event type: ${eventType}`);
      return;
    }

    const dance = this.getRandomDance(category);
    if (!dance) {
      logger.warn(`No dances available for category: ${category}`);
      return;
    }

    const queueItem = {
      dance,
      eventType,
      data,
      timestamp: Date.now()
    };

    this.danceQueue.push(queueItem);
    logger.info(`Added dance to queue: ${dance} for event: ${eventType} (Queue size: ${this.danceQueue.length})`);
  }

  async executeDance(danceItem) {
    if (!danceItem || !danceItem.dance) {
      logger.error('Invalid dance item provided');
      return;
    }

    logger.info(`Executing dance: ${danceItem.dance} for event: ${danceItem.eventType}`);
    
    // Método 1: Usar comando de consola del jugador (método original de ActMod)
    const command1 = `lua_run for k,v in pairs(player.GetAll()) do if v:Nick() == "${this.targetPlayer}" then v:ConCommand("actmod_wts wts ${danceItem.dance} 1 1 1") break end end`;
    
    try {
      let success = await this.sendRCONCommand(command1);
      if (success) {
        logger.info(`✅ Dance command executed successfully (method 1): ${danceItem.dance}`);
        return true;
      }
      
      // Método 2: Usar el sistema interno de ActMod directamente
      logger.warn(`Method 1 failed, trying alternative approach for: ${danceItem.dance}`);
      const command2 = `lua_run for k,v in pairs(player.GetAll()) do if v:Nick() == "${this.targetPlayer}" then if A_AM and A_AM.ActMod and A_AM.ActMod.ActMod_SSTr then A_AM.ActMod:ActMod_SSTr(v, "${danceItem.dance}") else v:ConCommand("say Dance system not loaded") end break end end`;
      
      success = await this.sendRCONCommand(command2);
      if (success) {
        logger.info(`✅ Dance command executed successfully (method 2): ${danceItem.dance}`);
        return true;
      }
      
      // Método 3: Usar hook de ActMod si existe
      logger.warn(`Method 2 failed, trying hook approach for: ${danceItem.dance}`);
      const command3 = `lua_run for k,v in pairs(player.GetAll()) do if v:Nick() == "${this.targetPlayer}" then hook.Call("ActMod_CStart", nil, {"Player", v}, {"${danceItem.dance}"}) break end end`;
      
      success = await this.sendRCONCommand(command3);
      if (success) {
        logger.info(`✅ Dance command executed successfully (method 3): ${danceItem.dance}`);
        return true;
      }
      
      logger.warn(`❌ All methods failed for dance command: ${danceItem.dance}`);
      return false;
      
    } catch (error) {
      logger.error(`Error executing dance: ${danceItem.dance}`, error);
      return false;
    }
  }

  startDanceQueueProcessor() {
    setInterval(() => {
      this.processDanceQueue();
    }, 1000); // Revisar la cola cada segundo
  }

  async processDanceQueue() {
    // Si ya está bailando o no hay bailes en cola, no hacer nada
    if (this.isDancing || this.danceQueue.length === 0) {
      return;
    }

    // Obtener el siguiente baile de la cola
    const nextDance = this.danceQueue.shift();
    if (!nextDance) {
      return;
    }

    // Marcar como bailando
    this.isDancing = true;
    logger.info(`Starting dance: ${nextDance.dance} (${this.danceQueue.length} remaining in queue)`);

    // Ejecutar el baile
    const success = await this.executeDance(nextDance);
    
    // Configurar timer para cuando termine el baile
    this.currentDanceTimer = setTimeout(() => {
      this.isDancing = false;
      this.currentDanceTimer = null;
      logger.info(`Dance completed: ${nextDance.dance}`);
      
      // Si no tuvo éxito, intentar detener cualquier animación activa
      if (!success) {
        this.stopCurrentDance();
      }
    }, this.danceTimeout);
  }

  async stopCurrentDance() {
    logger.info('Stopping current dance');
    const stopCommand = `lua_run for k,v in pairs(player.GetAll()) do if v:Nick() == "${this.targetPlayer}" then v:ConCommand("actmod_wts wts_End") break end end`;
    
    try {
      await this.sendRCONCommand(stopCommand);
      logger.info('Dance stop command sent');
    } catch (error) {
      logger.error('Error stopping dance:', error);
    }
  }

  clearDanceQueue() {
    this.danceQueue = [];
    this.isDancing = false;
    if (this.currentDanceTimer) {
      clearTimeout(this.currentDanceTimer);
      this.currentDanceTimer = null;
    }
    logger.info('Dance queue cleared');
  }

  getDanceQueueStatus() {
    return {
      queueLength: this.danceQueue.length,
      isDancing: this.isDancing,
      targetPlayer: this.targetPlayer,
      currentDance: this.isDancing ? 'Unknown' : null
    };
  }

  // Métodos adicionales para gestión manual
  setTargetPlayer(playerName) {
    this.targetPlayer = playerName;
    logger.info(`Target player changed to: ${playerName}`);
  }

  async executeManualDance(danceName) {
    if (!danceName) {
      logger.error('Dance name is required for manual execution');
      return false;
    }

    const manualDanceItem = {
      dance: danceName,
      eventType: 'manual',
      data: { user: 'admin', timestamp: Date.now() },
      timestamp: Date.now()
    };

    return await this.executeDance(manualDanceItem);
  }

  addManualDanceToQueue(danceName, eventType = 'manual') {
    if (!danceName) {
      logger.error('Dance name is required');
      return false;
    }

    const queueItem = {
      dance: danceName,
      eventType,
      data: { user: 'admin', timestamp: Date.now() },
      timestamp: Date.now()
    };

    this.danceQueue.push(queueItem);
    logger.info(`Added manual dance to queue: ${danceName} (Queue size: ${this.danceQueue.length})`);
    return true;
  }

  getDanceCategories() {
    const categoriesInfo = {};
    for (const [category, dances] of Object.entries(this.danceCategories)) {
      categoriesInfo[category] = {
        count: dances.length,
        eventMapping: Object.keys(this.eventDanceMapping).filter(event => this.eventDanceMapping[event] === category),
        dances: dances
      };
    }
    return categoriesInfo;
  }

  getAvailableDances() {
    const allDances = [];
    for (const [category, dances] of Object.entries(this.danceCategories)) {
      for (const dance of dances) {
        allDances.push({ dance, category });
      }
    }
    return allDances;
  }

  // Método de diagnóstico
  async checkSystemStatus() {
    logger.info('Running system diagnostics...');
    
    // Verificar si el jugador objetivo existe
    const playerCheckCommand = `lua_run local found = false; for k,v in pairs(player.GetAll()) do if v:Nick() == "${this.targetPlayer}" then found = true print("Player ${this.targetPlayer} found: " .. tostring(v)) break end end; if not found then print("Player ${this.targetPlayer} not found!") end`;
    
    try {
      await this.sendRCONCommand(playerCheckCommand);
      
      // Verificar si ActMod está cargado
      const actmodCheckCommand = `lua_run if A_AM and A_AM.ActMod then print("ActMod is loaded successfully") else print("ActMod is NOT loaded!") end`;
      await this.sendRCONCommand(actmodCheckCommand);
      
      // Listar todos los jugadores conectados
      const listPlayersCommand = `lua_run print("Connected players:"); for k,v in pairs(player.GetAll()) do print("  " .. k .. ": " .. v:Nick()) end`;
      await this.sendRCONCommand(listPlayersCommand);
      
      logger.info('System diagnostics completed - check server console for results');
      return true;
    } catch (error) {
      logger.error('Error running diagnostics:', error);
      return false;
    }
  }

  // Método simple para hacer bailar al jugador manualmente (solo para testing)
  async testDance(danceName = 'f_twist') {
    logger.info(`Testing dance: ${danceName}`);
    
    // Comando simple de prueba
    const testCommand = `lua_run for k,v in pairs(player.GetAll()) do if v:Nick() == "${this.targetPlayer}" then print("Attempting to make " .. v:Nick() .. " dance: ${danceName}") v:ConCommand("actmod_wts wts ${danceName} 1 1 1") break end end`;
    
    try {
      const success = await this.sendRCONCommand(testCommand);
      if (success) {
        logger.info(`✅ Test dance command sent: ${danceName}`);
        return true;
      } else {
        logger.warn(`❌ Test dance command failed: ${danceName}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error in test dance: ${danceName}`, error);
      return false;
    }
  }
}

module.exports = GModService;