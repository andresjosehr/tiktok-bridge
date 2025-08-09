const logger = require('../utils/logger');
const orm = require('../database/orm');

class LiveSessionManager {
  constructor() {
    this.currentSession = null;
    this.sessionStats = {
      viewerCountPeak: 0,
      eventCounts: {
        gift: 0,
        follow: 0,
        chat: 0,
        like: 0,
        share: 0,
        viewer_count: 0
      }
    };
  }

  async startSession(tiktokUsername, serviceId, sessionNotes = null) {
    try {
      // End any existing active session for this user
      const LiveSession = orm.getModel('LiveSession');
      const existingSession = await LiveSession.getActiveSession(tiktokUsername);
      if (existingSession) {
        logger.warn(`Found existing active session ${existingSession.id} for ${tiktokUsername}, ending it`);
        await this.endSession(existingSession.id, 'Automatically ended due to new session start');
      }

      // Create new session
      this.currentSession = await LiveSession.startSession(tiktokUsername, serviceId, sessionNotes);
      
      // Reset stats
      this.sessionStats = {
        viewerCountPeak: 0,
        eventCounts: {
          gift: 0,
          follow: 0,
          chat: 0,
          like: 0,
          share: 0,
          viewer_count: 0
        }
      };

      logger.info(`Started new live session ${this.currentSession.id} for ${tiktokUsername} with service ${serviceId}`);
      return this.currentSession;
    } catch (error) {
      logger.error('Error starting live session:', error);
      throw error;
    }
  }

  async endSession(sessionId = null, sessionNotes = null) {
    try {
      const targetSessionId = sessionId || (this.currentSession ? this.currentSession.id : null);
      
      if (!targetSessionId) {
        logger.warn('No session to end');
        return null;
      }

      // Update final stats
      await this.updateSessionStats(targetSessionId);
      
      // End the session
      const LiveSession = orm.getModel('LiveSession');
      const endedSession = await LiveSession.endSession(targetSessionId, sessionNotes);
      
      if (this.currentSession && this.currentSession.id === targetSessionId) {
        this.currentSession = null;
      }

      logger.info(`Ended live session ${targetSessionId}`);
      return endedSession;
    } catch (error) {
      logger.error('Error ending live session:', error);
      throw error;
    }
  }

  async getCurrentSession() {
    return this.currentSession;
  }

  async getSessionId() {
    return this.currentSession ? this.currentSession.id : null;
  }

  async trackEvent(eventType, viewerCount = null) {
    if (!this.currentSession) {
      logger.warn('No active session to track event');
      return;
    }

    try {
      // Update local stats
      if (this.sessionStats.eventCounts[eventType] !== undefined) {
        this.sessionStats.eventCounts[eventType]++;
      }

      if (viewerCount && viewerCount > this.sessionStats.viewerCountPeak) {
        this.sessionStats.viewerCountPeak = viewerCount;
      }

      // Increment database counts (async, don't wait)
      const LiveSession = orm.getModel('LiveSession');
      LiveSession.incrementEventCount(this.currentSession.id, eventType)
        .catch(error => logger.error('Error incrementing event count:', error));

      // Update viewer count peak if needed
      if (viewerCount && viewerCount > this.sessionStats.viewerCountPeak) {
        const LiveSession = orm.getModel('LiveSession');
        LiveSession.updateStats(this.currentSession.id, { viewerCountPeak: viewerCount })
          .catch(error => logger.error('Error updating viewer count peak:', error));
      }
    } catch (error) {
      logger.error('Error tracking event in session:', error);
    }
  }

  async updateSessionStats(sessionId = null) {
    try {
      const targetSessionId = sessionId || (this.currentSession ? this.currentSession.id : null);
      
      if (!targetSessionId) {
        return;
      }

      const stats = {
        viewerCountPeak: this.sessionStats.viewerCountPeak,
        totalEvents: Object.values(this.sessionStats.eventCounts).reduce((sum, count) => sum + count, 0),
        totalGifts: this.sessionStats.eventCounts.gift,
        totalFollows: this.sessionStats.eventCounts.follow,
        totalChatMessages: this.sessionStats.eventCounts.chat
      };

      const LiveSession = orm.getModel('LiveSession');
      await LiveSession.updateStats(targetSessionId, stats);
    } catch (error) {
      logger.error('Error updating session stats:', error);
    }
  }

  async getSessionStats(sessionId = null) {
    try {
      const targetSessionId = sessionId || (this.currentSession ? this.currentSession.id : null);
      
      if (!targetSessionId) {
        return null;
      }

      const LiveSession = orm.getModel('LiveSession');
      return await LiveSession.getSessionStats(targetSessionId);
    } catch (error) {
      logger.error('Error getting session stats:', error);
      return null;
    }
  }

  async getRecentSessions(limit = 10, tiktokUsername = null) {
    try {
      const LiveSession = orm.getModel('LiveSession');
      return await LiveSession.getRecentSessions(limit, tiktokUsername);
    } catch (error) {
      logger.error('Error getting recent sessions:', error);
      return [];
    }
  }

  // Initialize from existing active session (for app restarts)
  async initializeFromExistingSession(tiktokUsername) {
    try {
      const LiveSession = orm.getModel('LiveSession');
      const activeSession = await LiveSession.getActiveSession(tiktokUsername);
      if (activeSession) {
        this.currentSession = activeSession;
        logger.info(`Resumed active session ${activeSession.id} for ${tiktokUsername}`);
        
        // Reset local stats (they'll be rebuilt as events come in)
        this.sessionStats = {
          viewerCountPeak: activeSession.viewer_count_peak,
          eventCounts: {
            gift: 0,
            follow: 0,
            chat: 0,
            like: 0,
            share: 0,
            viewer_count: 0
          }
        };
        
        return activeSession;
      }
      return null;
    } catch (error) {
      logger.error('Error initializing from existing session:', error);
      return null;
    }
  }
}

module.exports = LiveSessionManager;