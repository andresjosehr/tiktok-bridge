const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EventLog = sequelize.define('EventLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    queue_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'event_queue',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    event_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 50]
      }
    },
    event_data: {
      type: DataTypes.JSON,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    status: {
      type: DataTypes.ENUM('success', 'failed', 'skipped'),
      allowNull: false
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    execution_time_ms: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0
      }
    },
    service_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [1, 50]
      }
    },
    processed_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    }
  }, {
    tableName: 'event_logs',
    indexes: [
      {
        name: 'idx_queue_id',
        fields: ['queue_id']
      },
      {
        name: 'idx_event_type',
        fields: ['event_type']
      },
      {
        name: 'idx_status',
        fields: ['status']
      },
      {
        name: 'idx_processed_at',
        fields: ['processed_at']
      },
      {
        name: 'idx_service_id',
        fields: ['service_id']
      }
    ],
    scopes: {
      success: {
        where: {
          status: 'success'
        }
      },
      failed: {
        where: {
          status: 'failed'
        }
      },
      skipped: {
        where: {
          status: 'skipped'
        }
      },
      recent: {
        order: [['processed_at', 'DESC']]
      },
      withErrors: {
        where: {
          status: 'failed',
          error_message: {
            [sequelize.Sequelize.Op.ne]: null
          }
        }
      }
    }
  });

  EventLog.createLog = async function(queueId, eventType, eventData, status, errorMessage = null, executionTimeMs = null, serviceId = null) {
    return await this.create({
      queue_id: queueId,
      event_type: eventType,
      event_data: eventData,
      status: status,
      error_message: errorMessage,
      execution_time_ms: executionTimeMs,
      service_id: serviceId
    });
  };

  EventLog.getRecentLogs = async function(limit = 100, eventType = null) {
    const whereClause = {};
    if (eventType) {
      whereClause.event_type = eventType;
    }

    return await this.scope('recent').findAll({
      where: whereClause,
      limit: limit
    });
  };

  EventLog.getLogsByDateRange = async function(startDate, endDate, eventType = null) {
    const whereClause = {
      processed_at: {
        [sequelize.Sequelize.Op.between]: [startDate, endDate]
      }
    };

    if (eventType) {
      whereClause.event_type = eventType;
    }

    return await this.scope('recent').findAll({
      where: whereClause
    });
  };

  EventLog.getErrorLogs = async function(limit = 50) {
    return await this.scope(['withErrors', 'recent']).findAll({
      limit: limit
    });
  };

  EventLog.getProcessingStats = async function(hours = 24) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    const stats = await this.findAll({
      attributes: [
        'event_type',
        'status',
        [sequelize.Sequelize.fn('COUNT', '*'), 'count'],
        [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('execution_time_ms')), 'avg_execution_time'],
        [sequelize.Sequelize.fn('MIN', sequelize.Sequelize.col('execution_time_ms')), 'min_execution_time'],
        [sequelize.Sequelize.fn('MAX', sequelize.Sequelize.col('execution_time_ms')), 'max_execution_time']
      ],
      where: {
        processed_at: {
          [sequelize.Sequelize.Op.gte]: cutoffDate
        }
      },
      group: ['event_type', 'status'],
      order: [['event_type', 'ASC'], ['status', 'ASC']]
    });

    return stats.map(stat => stat.get({ plain: true }));
  };

  EventLog.getThroughputStats = async function(hours = 24) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    const stats = await this.findAll({
      attributes: [
        [sequelize.Sequelize.fn('DATE_FORMAT', sequelize.Sequelize.col('processed_at'), '%Y-%m-%d %H:00:00'), 'hour'],
        'event_type',
        [sequelize.Sequelize.fn('COUNT', '*'), 'events_processed'],
        [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('execution_time_ms')), 'avg_execution_time']
      ],
      where: {
        processed_at: {
          [sequelize.Sequelize.Op.gte]: cutoffDate
        }
      },
      group: [
        sequelize.Sequelize.fn('DATE_FORMAT', sequelize.Sequelize.col('processed_at'), '%Y-%m-%d %H:00:00'),
        'event_type'
      ],
      order: [
        [sequelize.Sequelize.fn('DATE_FORMAT', sequelize.Sequelize.col('processed_at'), '%Y-%m-%d %H:00:00'), 'DESC'],
        ['event_type', 'ASC']
      ]
    });

    return stats.map(stat => stat.get({ plain: true }));
  };

  EventLog.cleanupOldLogs = async function(olderThanDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.destroy({
      where: {
        processed_at: {
          [sequelize.Sequelize.Op.lt]: cutoffDate
        }
      }
    });

    return result;
  };

  EventLog.getSuccessRate = async function(eventType = null, hours = 24) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    const whereClause = {
      processed_at: {
        [sequelize.Sequelize.Op.gte]: cutoffDate
      }
    };

    if (eventType) {
      whereClause.event_type = eventType;
    }

    const stats = await this.findOne({
      attributes: [
        [sequelize.Sequelize.fn('COUNT', '*'), 'total_events'],
        [sequelize.Sequelize.fn('SUM', 
          sequelize.Sequelize.literal("CASE WHEN status = 'success' THEN 1 ELSE 0 END")
        ), 'successful_events'],
        [sequelize.Sequelize.fn('SUM', 
          sequelize.Sequelize.literal("CASE WHEN status = 'failed' THEN 1 ELSE 0 END")
        ), 'failed_events'],
        [sequelize.Sequelize.fn('SUM', 
          sequelize.Sequelize.literal("CASE WHEN status = 'skipped' THEN 1 ELSE 0 END")
        ), 'skipped_events'],
        [sequelize.Sequelize.literal(
          "ROUND((SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2)"
        ), 'success_rate']
      ],
      where: whereClause
    });

    return stats ? stats.get({ plain: true }) : {
      total_events: 0,
      successful_events: 0,
      failed_events: 0,
      skipped_events: 0,
      success_rate: 0
    };
  };

  EventLog.getTopErrors = async function(limit = 10, hours = 24) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    const errors = await this.findAll({
      attributes: [
        'error_message',
        'event_type',
        [sequelize.Sequelize.fn('COUNT', '*'), 'occurrences'],
        [sequelize.Sequelize.fn('MAX', sequelize.Sequelize.col('processed_at')), 'last_occurrence']
      ],
      where: {
        status: 'failed',
        processed_at: {
          [sequelize.Sequelize.Op.gte]: cutoffDate
        },
        error_message: {
          [sequelize.Sequelize.Op.ne]: null
        }
      },
      group: ['error_message', 'event_type'],
      order: [[sequelize.Sequelize.literal('occurrences'), 'DESC']],
      limit: limit
    });

    return errors.map(error => error.get({ plain: true }));
  };

  EventLog.getSlowestEvents = async function(limit = 10, hours = 24) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    return await this.findAll({
      attributes: ['event_type', 'execution_time_ms', 'processed_at', 'queue_id'],
      where: {
        processed_at: {
          [sequelize.Sequelize.Op.gte]: cutoffDate
        },
        execution_time_ms: {
          [sequelize.Sequelize.Op.ne]: null
        }
      },
      order: [['execution_time_ms', 'DESC']],
      limit: limit
    });
  };

  return EventLog;
};