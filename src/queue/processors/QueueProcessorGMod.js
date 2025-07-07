const QueueProcessorBase = require('../QueueProcessorBase');
const gmodService = require('../../services/gmod/gmodService');
const logger = require('../../utils/logger');

class QueueProcessorGMod extends QueueProcessorBase {
  constructor() {
    super();
    this.name = 'QueueProcessorGMod';
  }

  async setupEventHandlers() {
    this.eventHandlers.set('tiktok:chat', this.handleTikTokChat.bind(this));
    this.eventHandlers.set('tiktok:gift', this.handleTikTokGift.bind(this));
    this.eventHandlers.set('tiktok:donation', this.handleTikTokGift.bind(this));
    this.eventHandlers.set('tiktok:follow', this.handleTikTokFollow.bind(this));
    this.eventHandlers.set('tiktok:like', this.handleTikTokLike.bind(this));
    this.eventHandlers.set('tiktok:share', this.handleTikTokShare.bind(this));
    this.eventHandlers.set('tiktok:viewerCount', this.handleTikTokViewerCount.bind(this));
  }

  async handleTikTokChat(data) {
    try {
      await gmodService.handleTikTokChat(data);
      logger.debug('GMod TikTok chat event processed successfully');
    } catch (error) {
      logger.error('GMod failed to handle TikTok chat event:', error);
      throw error;
    }
  }

  async handleTikTokGift(data) {
    try {
      await gmodService.handleTikTokGift(data);
      logger.debug('GMod TikTok gift event processed successfully');
    } catch (error) {
      logger.error('GMod failed to handle TikTok gift event:', error);
      throw error;
    }
  }

  async handleTikTokFollow(data) {
    try {
      await gmodService.handleTikTokFollow(data);
      logger.debug('GMod TikTok follow event processed successfully');
    } catch (error) {
      logger.error('GMod failed to handle TikTok follow event:', error);
      throw error;
    }
  }

  async handleTikTokLike(data) {
    try {
      await gmodService.handleTikTokLike(data);
      logger.debug('GMod TikTok like event processed successfully');
    } catch (error) {
      logger.error('GMod failed to handle TikTok like event:', error);
      throw error;
    }
  }

  async handleTikTokShare(data) {
    try {
      await gmodService.handleTikTokShare(data);
      logger.debug('GMod TikTok share event processed successfully');
    } catch (error) {
      logger.error('GMod failed to handle TikTok share event:', error);
      throw error;
    }
  }

  async handleTikTokViewerCount(data) {
    try {
      await gmodService.handleViewerCount(data);
      logger.debug('GMod TikTok viewer count event processed successfully');
    } catch (error) {
      logger.error('GMod failed to handle TikTok viewer count event:', error);
      throw error;
    }
  }

  async getProcessorStatus() {
    const baseStatus = await super.getProcessorStatus();
    return {
      ...baseStatus,
      gmodService: {
        isConnected: gmodService.isConnected(),
        lastActivity: gmodService.getLastActivity()
      }
    };
  }
}

module.exports = QueueProcessorGMod;