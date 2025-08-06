const EventEmitter = require('events');
const logger = require('../utils/logger');
const queueManager = require('../queue/queueManager');
const queueProcessorManager = require('../queue/queueProcessor');

class EventManager extends EventEmitter {
  constructor() {
    super();
    this.eventHandlers = new Map();
    this.eventStats = new Map();
    this.setupDefaultHandlers();
  }

  setupDefaultHandlers() {
    this.on('tiktok:connected', this.handleTikTokConnected.bind(this));
    this.on('tiktok:disconnected', this.handleTikTokDisconnected.bind(this));
    this.on('tiktok:chat', this.handleTikTokChat.bind(this));
    this.on('tiktok:gift', this.handleTikTokGift.bind(this));
    this.on('tiktok:follow', this.handleTikTokFollow.bind(this));
    this.on('tiktok:like', this.handleTikTokLike.bind(this));
    this.on('tiktok:share', this.handleTikTokShare.bind(this));
    this.on('tiktok:viewerCount', this.handleTikTokViewerCount.bind(this));
  }

  emit(eventName, data) {
    this.updateEventStats(eventName);
    
    try {
      super.emit(eventName, data);
    } catch (error) {
      logger.error(`Error handling event ${eventName}:`, error);
    }
  }

  updateEventStats(eventName) {
    const current = this.eventStats.get(eventName) || { count: 0, lastTriggered: null };
    current.count++;
    current.lastTriggered = new Date().toISOString();
    this.eventStats.set(eventName, current);
  }

  handleTikTokConnected(data) {
    logger.info('TikTok connected event received', data);
    this.emit('gmod:notification', {
      type: 'tiktok_connected',
      message: 'TikTok Live stream connected',
      data: data
    });
  }

  handleTikTokDisconnected() {
    logger.info('TikTok disconnected event received');
    this.emit('gmod:notification', {
      type: 'tiktok_disconnected',
      message: 'TikTok Live stream disconnected'
    });
  }

  async handleTikTokChat(data) {
    try {
      const activeService = queueProcessorManager.getActiveService();
      const serviceId = activeService ? activeService.serviceName : null;
      
      await queueManager.addEvent('tiktok:chat', data, { serviceId });
    } catch (error) {
      if (error.isQueueFull) {
        // logger.info('Queue full, skipping chat event (priority too low)');
      } else {
        logger.error('Failed to add chat event to queue:', error);
      }
    }
    
    this.emit('external:webhook', {
      type: 'tiktok_chat',
      data: data
    });
  }

  async handleTikTokGift(data) {
    try {
      const activeService = queueProcessorManager.getActiveService();
      const serviceId = activeService ? activeService.serviceName : null;
      
      await queueManager.addEvent('tiktok:gift', data, { serviceId });
    } catch (error) {
      logger.error('Failed to add gift event to queue:', error);
    }
    
    this.emit('external:webhook', {
      type: 'tiktok_gift',
      data: data
    });
  }

  async handleTikTokFollow(data) {
    try {
      const activeService = queueProcessorManager.getActiveService();
      const serviceId = activeService ? activeService.serviceName : null;
      
      await queueManager.addEvent('tiktok:follow', data, { serviceId });
    } catch (error) {
      logger.error('Failed to add follow event to queue:', error);
    }
    
    this.emit('external:webhook', {
      type: 'tiktok_follow',
      data: data
    });
  }

  async handleTikTokLike(data) {
    try {
      const activeService = queueProcessorManager.getActiveService();
      const serviceId = activeService ? activeService.serviceName : null;
      
      await queueManager.addEvent('tiktok:like', data, { serviceId });
    } catch (error) {
      if (error.isQueueFull) {
        // logger.info('Queue full, skipping like event (priority too low)');
      } else {
        logger.error('Failed to add like event to queue:', error);
      }
    }
  }

  async handleTikTokShare(data) {
    try {
      const activeService = queueProcessorManager.getActiveService();
      const serviceId = activeService ? activeService.serviceName : null;
      
      await queueManager.addEvent('tiktok:share', data, { serviceId });
    } catch (error) {
      if (error.isQueueFull) {
        // logger.info('Queue full, skipping share event (priority too low)');
      } else {
        logger.error('Failed to add share event to queue:', error);
      }
    }
  }

  async handleTikTokViewerCount(data) {
    try {
      const activeService = queueProcessorManager.getActiveService();
      const serviceId = activeService ? activeService.serviceName : null;
      
      await queueManager.addEvent('tiktok:viewerCount', data, { serviceId });
    } catch (error) {
      if (error.isQueueFull) {
        // logger.info('Queue full, skipping viewer count event (priority too low)');
      } else {
        logger.error('Failed to add viewer count event to queue:', error);
      }
    }
  }

  registerHandler(eventName, handler) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    
    this.eventHandlers.get(eventName).push(handler);
    this.on(eventName, handler);
    
    logger.debug(`Registered handler for event: ${eventName}`);
  }

  unregisterHandler(eventName, handler) {
    if (this.eventHandlers.has(eventName)) {
      const handlers = this.eventHandlers.get(eventName);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
        this.removeListener(eventName, handler);
        logger.debug(`Unregistered handler for event: ${eventName}`);
      }
    }
  }

  getEventStats() {
    const stats = {};
    for (const [eventName, data] of this.eventStats) {
      stats[eventName] = data;
    }
    return stats;
  }

  getRegisteredEvents() {
    return Array.from(this.eventHandlers.keys());
  }

  clearEventStats() {
    this.eventStats.clear();
    logger.info('Event statistics cleared');
  }

  createCustomEvent(eventName, data) {
    if (!eventName || typeof eventName !== 'string') {
      throw new Error('Event name must be a non-empty string');
    }

    this.emit(eventName, {
      ...data,
      custom: true,
      timestamp: new Date().toISOString()
    });
  }

  setupEventChain(events) {
    if (!Array.isArray(events) || events.length < 2) {
      throw new Error('Event chain must be an array with at least 2 events');
    }

    for (let i = 0; i < events.length - 1; i++) {
      const currentEvent = events[i];
      const nextEvent = events[i + 1];

      this.on(currentEvent, (data) => {
        setTimeout(() => {
          this.emit(nextEvent, data);
        }, 100);
      });
    }

    logger.debug(`Event chain created: ${events.join(' -> ')}`);
  }
}

module.exports = new EventManager();