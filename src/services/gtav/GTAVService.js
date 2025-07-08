const ServiceBase = require('../ServiceBase');
const logger = require('../../utils/logger');
const config = require('../../config/config');

class GTAVService extends ServiceBase {
  constructor() {
    super('GTAV');
  }

  async handleTikTokChat(data) {
    try {
      this.updateLastActivity();
      logger.debug(`GTAV TikTok chat event processed: ${data.comment} from ${data.nickname}`);
    } catch (error) {
      logger.error('GTAV failed to handle TikTok chat event:', error);
      throw error;
    }
  }

  async handleTikTokGift(data) {
    try {
      this.updateLastActivity();
      logger.debug(`GTAV TikTok gift event processed: ${data.giftName} from ${data.nickname}`);
    } catch (error) {
      logger.error('GTAV failed to handle TikTok gift event:', error);
      throw error;
    }
  }

  async handleTikTokFollow(data) {
    try {
      this.updateLastActivity();
      logger.debug(`GTAV TikTok follow event processed: ${data.nickname} followed`);
    } catch (error) {
      logger.error('GTAV failed to handle TikTok follow event:', error);
      throw error;
    }
  }

  async handleTikTokLike(data) {
    try {
      this.updateLastActivity();
      logger.debug(`GTAV TikTok like event processed: ${data.likeCount} likes`);
    } catch (error) {
      logger.error('GTAV failed to handle TikTok like event:', error);
      throw error;
    }
  }

  async handleTikTokShare(data) {
    try {
      this.updateLastActivity();
      logger.debug(`GTAV TikTok share event processed: ${data.nickname} shared`);
    } catch (error) {
      logger.error('GTAV failed to handle TikTok share event:', error);
      throw error;
    }
  }

  async handleViewerCount(data) {
    try {
      this.updateLastActivity();
      logger.debug(`GTAV TikTok viewer count event processed: ${data.viewerCount} viewers`);
    } catch (error) {
      logger.error('GTAV failed to handle TikTok viewer count event:', error);
      throw error;
    }
  }

  getServiceStatus() {
    return {
      ...super.getServiceStatus(),
      gtavSpecific: {
        // Aquí se pueden agregar métricas específicas de GTAV en el futuro
      }
    };
  }
}

module.exports = GTAVService;