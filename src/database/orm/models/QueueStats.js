const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const QueueStats = sequelize.define('QueueStats', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    hour: {
      type: DataTypes.TINYINT,
      allowNull: false,
      validate: {
        min: 0,
        max: 23
      }
    },
    event_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 50]
      }
    },
    total_events: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    processed_events: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    failed_events: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    skipped_events: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    avg_processing_time_ms: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    }
  }, {
    tableName: 'queue_stats',
    indexes: [
      {
        name: 'unique_date_hour_type',
        unique: true,
        fields: ['date', 'hour', 'event_type']
      },
      {
        name: 'idx_date',
        fields: ['date']
      },
      {
        name: 'idx_event_type',
        fields: ['event_type']
      }
    ],
    scopes: {
      recent: {
        order: [['date', 'DESC'], ['hour', 'DESC']]
      },
      byEventType: (eventType) => ({
        where: {
          event_type: eventType
        }
      }),
      byDateRange: (startDate, endDate) => ({
        where: {
          date: {
            [sequelize.Sequelize.Op.between]: [startDate, endDate]
          }
        }
      })
    }
  });

  QueueStats.recordHourlyStats = async function(eventType, stats) {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const hour = now.getHours();

    const [record, created] = await this.findOrCreate({
      where: {
        date: date,
        hour: hour,
        event_type: eventType
      },
      defaults: {
        total_events: stats.total || 0,
        processed_events: stats.processed || 0,
        failed_events: stats.failed || 0,
        skipped_events: stats.skipped || 0,
        avg_processing_time_ms: stats.avgProcessingTime || 0
      }
    });

    if (!created) {
      await record.update({
        total_events: record.total_events + (stats.total || 0),
        processed_events: record.processed_events + (stats.processed || 0),
        failed_events: record.failed_events + (stats.failed || 0),
        skipped_events: record.skipped_events + (stats.skipped || 0),
        avg_processing_time_ms: Math.round(
          (record.avg_processing_time_ms + (stats.avgProcessingTime || 0)) / 2
        )
      });
    }

    return record;
  };

  QueueStats.getStatsForDateRange = async function(startDate, endDate, eventType = null) {
    const whereClause = {
      date: {
        [sequelize.Sequelize.Op.between]: [startDate, endDate]
      }
    };

    if (eventType) {
      whereClause.event_type = eventType;
    }

    return await this.findAll({
      where: whereClause,
      order: [['date', 'ASC'], ['hour', 'ASC'], ['event_type', 'ASC']]
    });
  };

  QueueStats.getDailyAggregates = async function(days = 7, eventType = null) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const whereClause = {
      date: {
        [sequelize.Sequelize.Op.gte]: startDate.toISOString().split('T')[0]
      }
    };

    if (eventType) {
      whereClause.event_type = eventType;
    }

    const stats = await this.findAll({
      attributes: [
        'date',
        'event_type',
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('total_events')), 'daily_total'],
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('processed_events')), 'daily_processed'],
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('failed_events')), 'daily_failed'],
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('skipped_events')), 'daily_skipped'],
        [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('avg_processing_time_ms')), 'daily_avg_time']
      ],
      where: whereClause,
      group: ['date', 'event_type'],
      order: [['date', 'DESC'], ['event_type', 'ASC']]
    });

    return stats.map(stat => stat.get({ plain: true }));
  };

  QueueStats.getEventTypeStats = async function(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await this.findAll({
      attributes: [
        'event_type',
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('total_events')), 'total_events'],
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('processed_events')), 'processed_events'],
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('failed_events')), 'failed_events'],
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('skipped_events')), 'skipped_events'],
        [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('avg_processing_time_ms')), 'avg_processing_time'],
        [sequelize.Sequelize.literal(
          'ROUND((SUM(processed_events) / SUM(total_events)) * 100, 2)'
        ), 'success_rate']
      ],
      where: {
        date: {
          [sequelize.Sequelize.Op.gte]: startDate.toISOString().split('T')[0]
        }
      },
      group: ['event_type'],
      order: [[sequelize.Sequelize.literal('total_events'), 'DESC']]
    });

    return stats.map(stat => stat.get({ plain: true }));
  };

  QueueStats.getHourlyPatterns = async function(days = 7, eventType = null) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const whereClause = {
      date: {
        [sequelize.Sequelize.Op.gte]: startDate.toISOString().split('T')[0]
      }
    };

    if (eventType) {
      whereClause.event_type = eventType;
    }

    const stats = await this.findAll({
      attributes: [
        'hour',
        [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('total_events')), 'avg_hourly_total'],
        [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('processed_events')), 'avg_hourly_processed'],
        [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('avg_processing_time_ms')), 'avg_processing_time']
      ],
      where: whereClause,
      group: ['hour'],
      order: [['hour', 'ASC']]
    });

    return stats.map(stat => stat.get({ plain: true }));
  };

  QueueStats.cleanupOldStats = async function(olderThanDays = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.destroy({
      where: {
        date: {
          [sequelize.Sequelize.Op.lt]: cutoffDate.toISOString().split('T')[0]
        }
      }
    });

    return result;
  };

  QueueStats.getTopEventTypes = async function(days = 7, limit = 10) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await this.findAll({
      attributes: [
        'event_type',
        [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.col('total_events')), 'total_events']
      ],
      where: {
        date: {
          [sequelize.Sequelize.Op.gte]: startDate.toISOString().split('T')[0]
        }
      },
      group: ['event_type'],
      order: [[sequelize.Sequelize.literal('total_events'), 'DESC']],
      limit: limit
    });

    return stats.map(stat => stat.get({ plain: true }));
  };

  QueueStats.getCurrentHourStats = async function() {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const hour = now.getHours();

    return await this.findAll({
      where: {
        date: date,
        hour: hour
      },
      order: [['event_type', 'ASC']]
    });
  };

  return QueueStats;
};