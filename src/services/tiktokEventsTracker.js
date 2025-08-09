const orm = require('../database/orm');
const logger = require('../utils/logger');
const eventManager = require('./eventManager');

/**
 * Service para registrar todos los eventos de TikTok en la tabla tiktok_events
 * para análisis estadísticos y reportes
 */
class TikTokEventsTracker {
  constructor() {
    this.initialized = false;
    this.currentLiveSessionId = null;
  }

  /**
   * Inicializa el tracker de eventos
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Registrar listeners para todos los eventos de TikTok
      this.setupEventListeners();
      this.initialized = true;
      logger.info('TikTok Events Tracker initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize TikTok Events Tracker:', error);
      throw error;
    }
  }

  /**
   * Configura los listeners para todos los eventos de TikTok
   */
  setupEventListeners() {
    // Listeners para eventos de control
    eventManager.on('tiktok:connected', async (data) => {
      // Obtener la sesión activa del LiveSessionManager
      const tiktokService = require('./tiktok/tiktokService');
      const liveSessionManager = tiktokService.getLiveSessionManager();
      const currentSession = await liveSessionManager.getCurrentSession();
      
      if (currentSession) {
        this.setCurrentLiveSession(currentSession.id);
        logger.info(`TikTok Events Tracker - Session set from connected event: ${currentSession.id}`);
      } else {
        logger.warn('TikTok Events Tracker - No active session found on connected event');
      }
    });

    eventManager.on('tiktok:disconnected', () => {
      this.setCurrentLiveSession(null);
    });

    // Listeners para eventos de TikTok Live
    eventManager.on('tiktok:chat', async (data) => {
      await this.saveEvent('chat', data, {
        username: data.user,
        message: data.message
      });
    });

    eventManager.on('tiktok:gift', async (data) => {
      await this.saveEvent('gift', data, {
        username: data.user,
        gift_id: data.giftId,
        gift_name: data.giftName,
        gift_type: data.giftType,
        gift_value: data.cost,
        repeat_count: data.repeatCount,
        repeat_end: data.repeatEnd
      });
    });

    eventManager.on('tiktok:follow', async (data) => {
      await this.saveEvent('follow', data, {
        username: data.user,
        social_action: 'follow'
      });
    });

    eventManager.on('tiktok:share', async (data) => {
      await this.saveEvent('share', data, {
        username: data.user,
        social_action: 'share'
      });
    });

    eventManager.on('tiktok:like', async (data) => {
      await this.saveEvent('like', data, {
        username: data.user,
        like_count: data.likeCount,
        total_like_count: data.totalLikeCount
      });
    });

    eventManager.on('tiktok:viewerCount', async (data) => {
      await this.saveEvent('roomUser', data, {
        viewer_count: data.viewerCount
      });
    });

    // Listeners adicionales para otros eventos de TikTok Live
    eventManager.on('tiktok:member', async (data) => {
      await this.saveEvent('member', data, {
        username: data.user
      });
    });

    eventManager.on('tiktok:emote', async (data) => {
      await this.saveEvent('emote', data, {
        username: data.user
      });
    });

    eventManager.on('tiktok:envelope', async (data) => {
      await this.saveEvent('envelope', data, {
        username: data.user
      });
    });

    eventManager.on('tiktok:questionNew', async (data) => {
      await this.saveEvent('questionNew', data, {
        username: data.user,
        question_text: data.questionText
      });
    });

    eventManager.on('tiktok:linkMicBattle', async (data) => {
      await this.saveEvent('linkMicBattle', data, {
        battle_data: data.battleUsers
      });
    });

    eventManager.on('tiktok:subscribe', async (data) => {
      await this.saveEvent('subscribe', data, {
        username: data.user
      });
    });
  }

  /**
   * Establece la sesión de live actual
   * @param {number|null} liveSessionId 
   */
  setCurrentLiveSession(liveSessionId) {
    this.currentLiveSessionId = liveSessionId;
    logger.debug(`TikTok Events Tracker - Live session set to: ${liveSessionId}`);
  }

  /**
   * Intenta obtener la sesión activa si no está configurada
   */
  async ensureActiveSession() {
    if (!this.currentLiveSessionId) {
      try {
        const tiktokService = require('./tiktok/tiktokService');
        const liveSessionManager = tiktokService.getLiveSessionManager();
        const currentSession = await liveSessionManager.getCurrentSession();
        
        if (currentSession) {
          this.setCurrentLiveSession(currentSession.id);
          logger.info(`TikTok Events Tracker - Auto-recovered session: ${currentSession.id}`);
          return true;
        }
      } catch (error) {
        logger.debug('Could not auto-recover session:', error.message);
      }
    }
    return this.currentLiveSessionId !== null;
  }

  /**
   * Guarda un evento de TikTok en la base de datos
   * @param {string} eventType - Tipo de evento (chat, gift, follow, etc.)
   * @param {Object} originalData - Datos originales del evento
   * @param {Object} parsedFields - Campos específicos parseados del evento
   */
  async saveEvent(eventType, originalData, parsedFields = {}) {
    // Intentar obtener la sesión si no está configurada
    const hasSession = await this.ensureActiveSession();
    
    if (!hasSession) {
      logger.warn(`Cannot save ${eventType} event - no active live session`);
      return;
    }

    try {
      // Preparar los datos del evento
      const eventData = {
        live_session_id: this.currentLiveSessionId,
        event_type: eventType,
        event_data: JSON.stringify(originalData),
        event_timestamp: new Date(originalData.timestamp || new Date().toISOString()),
        created_at: new Date()
      };

      // Añadir campos específicos del evento si están disponibles
      if (parsedFields.username) {
        eventData.username = parsedFields.username;
      }
      
      if (parsedFields.user_id) {
        eventData.user_id = parsedFields.user_id;
      }

      // Campos específicos para chat
      if (parsedFields.message) {
        eventData.message = parsedFields.message;
      }

      // Campos específicos para gifts
      if (parsedFields.gift_id !== undefined) {
        eventData.gift_id = parsedFields.gift_id;
      }
      if (parsedFields.gift_name) {
        eventData.gift_name = parsedFields.gift_name;
      }
      if (parsedFields.gift_type !== undefined) {
        eventData.gift_type = parsedFields.gift_type;
      }
      if (parsedFields.gift_value !== undefined) {
        eventData.gift_value = parsedFields.gift_value;
      }
      if (parsedFields.repeat_count !== undefined) {
        eventData.repeat_count = parsedFields.repeat_count;
      }
      if (parsedFields.repeat_end !== undefined) {
        eventData.repeat_end = parsedFields.repeat_end;
      }

      // Campos específicos para viewer/room stats
      if (parsedFields.viewer_count !== undefined) {
        eventData.viewer_count = parsedFields.viewer_count;
      }
      if (parsedFields.like_count !== undefined) {
        eventData.like_count = parsedFields.like_count;
      }
      if (parsedFields.total_like_count !== undefined) {
        eventData.total_like_count = parsedFields.total_like_count;
      }

      // Campos específicos para preguntas
      if (parsedFields.question_text) {
        eventData.question_text = parsedFields.question_text;
      }

      // Campos específicos para eventos sociales
      if (parsedFields.social_action) {
        eventData.social_action = parsedFields.social_action;
      }

      // Campos específicos para batallas
      if (parsedFields.battle_data) {
        eventData.battle_data = JSON.stringify(parsedFields.battle_data);
      }

      // Insertar en la base de datos usando Sequelize
      const sequelize = orm.getSequelize();
      const query = `
        INSERT INTO tiktok_events (${Object.keys(eventData).join(', ')})
        VALUES (${Object.keys(eventData).map(() => '?').join(', ')})
      `;
      
      const values = Object.values(eventData);
      
      await sequelize.query(query, {
        replacements: values,
        type: sequelize.QueryTypes.INSERT
      });
      
      logger.debug(`TikTok event saved: ${eventType} by ${parsedFields.username || 'unknown'}`);

    } catch (error) {
      logger.error(`Failed to save TikTok event (${eventType}):`, error);
      // No lanzar error para evitar interrumpir el flujo de eventos
    }
  }

  /**
   * Obtiene estadísticas de eventos para una sesión
   * @param {number} liveSessionId 
   * @returns {Object} Estadísticas de la sesión
   */
  async getSessionStats(liveSessionId) {
    try {
      const sequelize = orm.getSequelize();
      const query = `
        SELECT 
          event_type,
          COUNT(*) as event_count,
          COUNT(DISTINCT username) as unique_users,
          MIN(event_timestamp) as first_event,
          MAX(event_timestamp) as last_event
        FROM tiktok_events 
        WHERE live_session_id = ?
        GROUP BY event_type
        ORDER BY event_count DESC
      `;
      
      const [results] = await sequelize.query(query, {
        replacements: [liveSessionId],
        type: sequelize.QueryTypes.SELECT
      });
      return results;
    } catch (error) {
      logger.error('Failed to get session stats:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas generales de gifts
   * @param {number} liveSessionId 
   * @returns {Object} Estadísticas de gifts
   */
  async getGiftStats(liveSessionId) {
    try {
      const query = `
        SELECT 
          gift_name,
          gift_value,
          COUNT(*) as gift_count,
          SUM(repeat_count) as total_gifts_sent,
          SUM(gift_value * repeat_count) as total_value,
          COUNT(DISTINCT username) as unique_gifters
        FROM tiktok_events 
        WHERE live_session_id = ? AND event_type = 'gift'
        GROUP BY gift_name, gift_value
        ORDER BY total_value DESC
      `;
      
      const sequelize = orm.getSequelize();
      const [results] = await sequelize.query(query, {
        replacements: [liveSessionId],
        type: sequelize.QueryTypes.SELECT
      });
      return results;
    } catch (error) {
      logger.error('Failed to get gift stats:', error);
      throw error;
    }
  }

  /**
   * Obtiene los usuarios más activos en una sesión
   * @param {number} liveSessionId 
   * @param {number} limit 
   * @returns {Array} Lista de usuarios más activos
   */
  async getTopUsers(liveSessionId, limit = 10) {
    try {
      const query = `
        SELECT 
          username,
          COUNT(*) as total_events,
          SUM(CASE WHEN event_type = 'chat' THEN 1 ELSE 0 END) as chat_count,
          SUM(CASE WHEN event_type = 'gift' THEN repeat_count ELSE 0 END) as gifts_sent,
          SUM(CASE WHEN event_type = 'gift' THEN gift_value * repeat_count ELSE 0 END) as total_gift_value,
          SUM(CASE WHEN event_type = 'like' THEN like_count ELSE 0 END) as likes_sent
        FROM tiktok_events 
        WHERE live_session_id = ? AND username IS NOT NULL
        GROUP BY username
        ORDER BY total_gift_value DESC, total_events DESC
        LIMIT ?
      `;
      
      const sequelize = orm.getSequelize();
      const [results] = await sequelize.query(query, {
        replacements: [liveSessionId, limit],
        type: sequelize.QueryTypes.SELECT
      });
      return results;
    } catch (error) {
      logger.error('Failed to get top users:', error);
      throw error;
    }
  }

  /**
   * Obtiene métricas de tiempo real de la sesión actual
   * @returns {Object} Métricas en tiempo real
   */
  async getCurrentSessionMetrics() {
    if (!this.currentLiveSessionId) {
      return null;
    }

    try {
      const query = `
        SELECT 
          COUNT(*) as total_events,
          COUNT(DISTINCT username) as unique_users,
          SUM(CASE WHEN event_type = 'gift' THEN gift_value * repeat_count ELSE 0 END) as total_gift_value,
          MAX(viewer_count) as peak_viewers,
          MIN(event_timestamp) as session_start,
          MAX(event_timestamp) as last_activity
        FROM tiktok_events 
        WHERE live_session_id = ?
      `;
      
      const sequelize = orm.getSequelize();
      const [results] = await sequelize.query(query, {
        replacements: [this.currentLiveSessionId],
        type: sequelize.QueryTypes.SELECT
      });
      const [metrics] = results;
      return metrics;
    } catch (error) {
      logger.error('Failed to get current session metrics:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas avanzadas de usuarios únicos para una sesión
   * @param {number} liveSessionId 
   * @returns {Object} Estadísticas de usuarios únicos
   */
  async getUniqueVisitorStats(liveSessionId) {
    try {
      const sequelize = orm.getSequelize();
      const query = `
        SELECT 
          COUNT(DISTINCT username) as total_unique_visitors,
          COUNT(DISTINCT CASE WHEN event_type = 'member' THEN username END) as users_who_joined,
          COUNT(DISTINCT CASE WHEN event_type = 'chat' THEN username END) as users_who_chatted,
          COUNT(DISTINCT CASE WHEN event_type = 'gift' THEN username END) as users_who_gifted,
          COUNT(DISTINCT CASE WHEN event_type = 'like' THEN username END) as users_who_liked,
          COUNT(DISTINCT CASE WHEN event_type = 'follow' THEN username END) as users_who_followed,
          COUNT(DISTINCT CASE WHEN event_type = 'share' THEN username END) as users_who_shared
        FROM tiktok_events 
        WHERE live_session_id = ? AND username IS NOT NULL
      `;
      
      const sequelize2 = orm.getSequelize();
      const [results] = await sequelize2.query(query, {
        replacements: [liveSessionId],
        type: sequelize2.QueryTypes.SELECT
      });
      const [stats] = results;
      return stats;
    } catch (error) {
      logger.error('Failed to get unique visitor stats:', error);
      throw error;
    }
  }

  /**
   * Obtiene el timeline de actividad de usuarios únicos
   * @param {number} liveSessionId 
   * @returns {Array} Timeline de actividad por hora
   */
  async getVisitorTimeline(liveSessionId) {
    try {
      const sequelize = orm.getSequelize();
      const query = `
        SELECT 
          HOUR(event_timestamp) as hour,
          COUNT(DISTINCT username) as unique_users,
          COUNT(*) as total_events,
          COUNT(DISTINCT CASE WHEN event_type = 'member' THEN username END) as new_joiners
        FROM tiktok_events 
        WHERE live_session_id = ? AND username IS NOT NULL
        GROUP BY HOUR(event_timestamp)
        ORDER BY hour ASC
      `;
      
      const sequelize2 = orm.getSequelize();
      const [results] = await sequelize2.query(query, {
        replacements: [liveSessionId],
        type: sequelize2.QueryTypes.SELECT
      });
      return results;
    } catch (error) {
      logger.error('Failed to get visitor timeline:', error);
      throw error;
    }
  }

  /**
   * Obtiene el análisis de retención de usuarios (usuarios que regresan)
   * @param {string} tiktokUsername 
   * @param {number} daysPeriod 
   * @returns {Object} Análisis de retención
   */
  async getUserRetentionAnalysis(tiktokUsername, daysPeriod = 7) {
    try {
      const sequelize = orm.getSequelize();
      const query = `
        SELECT 
          te.username,
          COUNT(DISTINCT ls.id) as sessions_participated,
          MIN(te.event_timestamp) as first_seen,
          MAX(te.event_timestamp) as last_seen,
          COUNT(te.id) as total_events,
          DATEDIFF(MAX(te.event_timestamp), MIN(te.event_timestamp)) as days_active
        FROM tiktok_events te
        JOIN live_sessions ls ON te.live_session_id = ls.id
        WHERE ls.tiktok_username = ? 
          AND te.event_timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
          AND te.username IS NOT NULL
        GROUP BY te.username
        HAVING sessions_participated >= 2
        ORDER BY sessions_participated DESC, total_events DESC
      `;
      
      const sequelize2 = orm.getSequelize();
      const [results] = await sequelize2.query(query, {
        replacements: [tiktokUsername, daysPeriod],
        type: sequelize2.QueryTypes.SELECT
      });
      return results;
    } catch (error) {
      logger.error('Failed to get user retention analysis:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de engagement por usuario
   * @param {number} liveSessionId 
   * @returns {Array} Estadísticas de engagement
   */
  async getUserEngagementStats(liveSessionId) {
    try {
      const sequelize = orm.getSequelize();
      const query = `
        SELECT 
          username,
          COUNT(*) as total_interactions,
          COUNT(CASE WHEN event_type = 'chat' THEN 1 END) as chat_count,
          COUNT(CASE WHEN event_type = 'gift' THEN 1 END) as gift_events,
          SUM(CASE WHEN event_type = 'gift' THEN repeat_count ELSE 0 END) as total_gifts,
          SUM(CASE WHEN event_type = 'gift' THEN gift_value * repeat_count ELSE 0 END) as total_gift_value,
          SUM(CASE WHEN event_type = 'like' THEN like_count ELSE 0 END) as total_likes,
          COUNT(CASE WHEN event_type = 'follow' THEN 1 END) as follow_count,
          COUNT(CASE WHEN event_type = 'share' THEN 1 END) as share_count,
          MIN(event_timestamp) as first_interaction,
          MAX(event_timestamp) as last_interaction,
          TIMESTAMPDIFF(MINUTE, MIN(event_timestamp), MAX(event_timestamp)) as session_duration_minutes
        FROM tiktok_events 
        WHERE live_session_id = ? AND username IS NOT NULL
        GROUP BY username
        HAVING total_interactions > 0
        ORDER BY total_gift_value DESC, total_interactions DESC
      `;
      
      const sequelize2 = orm.getSequelize();
      const [results] = await sequelize2.query(query, {
        replacements: [liveSessionId],
        type: sequelize2.QueryTypes.SELECT
      });
      return results;
    } catch (error) {
      logger.error('Failed to get user engagement stats:', error);
      throw error;
    }
  }

  /**
   * Verifica si el tracker está activo
   * @returns {boolean}
   */
  isActive() {
    return this.initialized && this.currentLiveSessionId !== null;
  }

  /**
   * Obtiene análisis de duración de sesión por usuario
   * @param {number} liveSessionId 
   * @returns {Object} Estadísticas de duración
   */
  async getSessionDurationAnalysis(liveSessionId) {
    try {
      const sequelize = orm.getSequelize();
      const query = `
        SELECT 
          AVG(TIMESTAMPDIFF(MINUTE, first_interaction, last_interaction)) as avg_session_duration_minutes,
          MAX(TIMESTAMPDIFF(MINUTE, first_interaction, last_interaction)) as max_session_duration_minutes,
          MIN(TIMESTAMPDIFF(MINUTE, first_interaction, last_interaction)) as min_session_duration_minutes,
          COUNT(CASE WHEN TIMESTAMPDIFF(MINUTE, first_interaction, last_interaction) >= 30 THEN 1 END) as users_over_30min,
          COUNT(CASE WHEN TIMESTAMPDIFF(MINUTE, first_interaction, last_interaction) >= 60 THEN 1 END) as users_over_1hour,
          COUNT(CASE WHEN TIMESTAMPDIFF(MINUTE, first_interaction, last_interaction) < 5 THEN 1 END) as users_under_5min
        FROM (
          SELECT 
            username,
            MIN(event_timestamp) as first_interaction,
            MAX(event_timestamp) as last_interaction
          FROM tiktok_events 
          WHERE live_session_id = ? AND username IS NOT NULL
          GROUP BY username
          HAVING COUNT(*) > 1
        ) user_sessions
      `;
      
      const sequelize2 = orm.getSequelize();
      const [results] = await sequelize2.query(query, {
        replacements: [liveSessionId],
        type: sequelize2.QueryTypes.SELECT
      });
      const [stats] = results;
      return stats;
    } catch (error) {
      logger.error('Failed to get session duration analysis:', error);
      throw error;
    }
  }

  /**
   * Obtiene el flujo de usuarios por tiempo (entradas/salidas estimadas)
   * @param {number} liveSessionId 
   * @returns {Array} Flujo de usuarios por intervalos de tiempo
   */
  async getUserFlowAnalysis(liveSessionId) {
    try {
      const sequelize = orm.getSequelize();
      const query = `
        SELECT 
          time_interval,
          new_users,
          active_users,
          last_seen_users,
          (new_users - last_seen_users) as net_user_change
        FROM (
          SELECT 
            CONCAT(HOUR(event_timestamp), ':00-', HOUR(event_timestamp), ':59') as time_interval,
            HOUR(event_timestamp) as hour_num,
            COUNT(DISTINCT CASE WHEN event_type = 'member' THEN username END) as new_users,
            COUNT(DISTINCT username) as active_users,
            COUNT(DISTINCT CASE WHEN is_last_activity = 1 THEN username END) as last_seen_users
          FROM (
            SELECT 
              *,
              ROW_NUMBER() OVER (PARTITION BY username ORDER BY event_timestamp DESC) = 1 as is_last_activity
            FROM tiktok_events 
            WHERE live_session_id = ? AND username IS NOT NULL
          ) ranked_events
          GROUP BY HOUR(event_timestamp)
          ORDER BY HOUR(event_timestamp)
        ) hourly_stats
      `;
      
      const sequelize2 = orm.getSequelize();
      const [results] = await sequelize2.query(query, {
        replacements: [liveSessionId],
        type: sequelize2.QueryTypes.SELECT
      });
      return results;
    } catch (error) {
      logger.error('Failed to get user flow analysis:', error);
      throw error;
    }
  }

  /**
   * Obtiene métricas avanzadas de la sesión actual
   * @returns {Object} Métricas avanzadas en tiempo real
   */
  async getAdvancedCurrentMetrics() {
    if (!this.currentLiveSessionId) {
      return null;
    }

    try {
      const [basicMetrics, uniqueStats, durationStats] = await Promise.all([
        this.getCurrentSessionMetrics(),
        this.getUniqueVisitorStats(this.currentLiveSessionId),
        this.getSessionDurationAnalysis(this.currentLiveSessionId)
      ]);

      return {
        basic: basicMetrics,
        unique_visitors: uniqueStats,
        duration_analysis: durationStats,
        session_id: this.currentLiveSessionId,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get advanced current metrics:', error);
      throw error;
    }
  }

  /**
   * Obtiene el estado del tracker
   * @returns {Object}
   */
  getStatus() {
    return {
      initialized: this.initialized,
      currentLiveSessionId: this.currentLiveSessionId,
      isActive: this.isActive()
    };
  }
}

module.exports = new TikTokEventsTracker();