const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LiveSession = sequelize.define('LiveSession', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    tiktok_username: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    },
    service_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100]
      }
    },
    start_time: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'ended', 'error'),
      defaultValue: 'active',
      allowNull: false
    },
    viewer_count_peak: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0
      }
    },
    total_events: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0
      }
    },
    total_gifts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0
      }
    },
    total_follows: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0
      }
    },
    total_chat_messages: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0
      }
    },
    session_notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'live_sessions',
    indexes: [
      {
        name: 'idx_tiktok_username',
        fields: ['tiktok_username']
      },
      {
        name: 'idx_service_id',
        fields: ['service_id']
      },
      {
        name: 'idx_start_time',
        fields: ['start_time']
      },
      {
        name: 'idx_status',
        fields: ['status']
      }
    ],
    scopes: {
      active: {
        where: {
          status: 'active'
        }
      },
      ended: {
        where: {
          status: 'ended'
        }
      },
      recent: {
        order: [['start_time', 'DESC']]
      }
    }
  });

  // Static methods
  LiveSession.startSession = async function(tiktokUsername, serviceId, sessionNotes = null) {
    return await this.create({
      tiktok_username: tiktokUsername,
      service_id: serviceId,
      session_notes: sessionNotes,
      status: 'active'
    });
  };

  LiveSession.endSession = async function(sessionId, sessionNotes = null) {
    const session = await this.findByPk(sessionId);
    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    return await session.update({
      end_time: new Date(),
      status: 'ended',
      session_notes: sessionNotes || session.session_notes
    });
  };

  LiveSession.updateStats = async function(sessionId, stats = {}) {
    const session = await this.findByPk(sessionId);
    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    const updateData = {};
    if (stats.viewerCountPeak !== undefined) updateData.viewer_count_peak = Math.max(session.viewer_count_peak, stats.viewerCountPeak);
    if (stats.totalEvents !== undefined) updateData.total_events = stats.totalEvents;
    if (stats.totalGifts !== undefined) updateData.total_gifts = stats.totalGifts;
    if (stats.totalFollows !== undefined) updateData.total_follows = stats.totalFollows;
    if (stats.totalChatMessages !== undefined) updateData.total_chat_messages = stats.totalChatMessages;

    return await session.update(updateData);
  };

  LiveSession.incrementEventCount = async function(sessionId, eventType) {
    const session = await this.findByPk(sessionId);
    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    const updateData = {
      total_events: session.total_events + 1
    };

    switch (eventType) {
      case 'gift':
        updateData.total_gifts = session.total_gifts + 1;
        break;
      case 'follow':
        updateData.total_follows = session.total_follows + 1;
        break;
      case 'chat':
        updateData.total_chat_messages = session.total_chat_messages + 1;
        break;
    }

    return await session.update(updateData);
  };

  LiveSession.getActiveSession = async function(tiktokUsername) {
    return await this.scope('active').findOne({
      where: {
        tiktok_username: tiktokUsername
      },
      order: [['start_time', 'DESC']]
    });
  };

  LiveSession.getSessionStats = async function(sessionId) {
    const session = await this.findByPk(sessionId, {
      include: [{
        association: 'EventLogs',
        attributes: [
          'event_type',
          'status',
          [sequelize.Sequelize.fn('COUNT', '*'), 'count']
        ],
        group: ['event_type', 'status']
      }]
    });

    return session;
  };

  LiveSession.getRecentSessions = async function(limit = 10, tiktokUsername = null) {
    const whereClause = {};
    if (tiktokUsername) {
      whereClause.tiktok_username = tiktokUsername;
    }

    return await this.scope('recent').findAll({
      where: whereClause,
      limit: limit
    });
  };

  return LiveSession;
};