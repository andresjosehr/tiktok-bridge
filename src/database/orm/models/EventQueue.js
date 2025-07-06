const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EventQueue = sequelize.define('EventQueue', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
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
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 1000
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
      defaultValue: 'pending',
      allowNull: false
    },
    attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 100
      }
    },
    max_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 3,
      validate: {
        min: 1,
        max: 20
      }
    },
    available_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'event_queue',
    indexes: [
      {
        name: 'idx_status_priority_available',
        fields: ['status', { name: 'priority', order: 'DESC' }, 'available_at']
      },
      {
        name: 'idx_event_type',
        fields: ['event_type']
      },
      {
        name: 'idx_created_at',
        fields: ['created_at']
      }
    ],
    scopes: {
      pending: {
        where: {
          status: 'pending'
        }
      },
      processing: {
        where: {
          status: 'processing'
        }
      },
      completed: {
        where: {
          status: 'completed'
        }
      },
      failed: {
        where: {
          status: 'failed'
        }
      },
      available: {
        where: {
          status: 'pending',
          available_at: {
            [sequelize.Sequelize.Op.lte]: new Date()
          }
        }
      },
      canRetry: {
        where: {
          attempts: {
            [sequelize.Sequelize.Op.lt]: sequelize.Sequelize.col('max_attempts')
          }
        }
      },
      byPriority: {
        order: [['priority', 'DESC'], ['available_at', 'ASC']]
      }
    }
  });

  EventQueue.prototype.markAsProcessing = async function() {
    this.status = 'processing';
    this.attempts += 1;
    this.updated_at = new Date();
    return await this.save();
  };

  EventQueue.prototype.markAsCompleted = async function() {
    this.status = 'completed';
    this.processed_at = new Date();
    this.updated_at = new Date();
    return await this.save();
  };

  EventQueue.prototype.markAsFailed = async function(retryDelay = 0) {
    if (this.attempts >= this.max_attempts) {
      this.status = 'failed';
    } else {
      this.status = 'pending';
      if (retryDelay > 0) {
        const retryDate = new Date();
        retryDate.setSeconds(retryDate.getSeconds() + retryDelay);
        this.available_at = retryDate;
      }
    }
    this.updated_at = new Date();
    return await this.save();
  };

  EventQueue.prototype.isRetryable = function() {
    return this.attempts < this.max_attempts;
  };

  EventQueue.prototype.getRemainingAttempts = function() {
    return Math.max(0, this.max_attempts - this.attempts);
  };

  EventQueue.findNextJob = async function() {
    return await this.scope(['available', 'canRetry', 'byPriority']).findOne();
  };

  EventQueue.getQueueSize = async function(status = 'pending') {
    return await this.count({
      where: { status }
    });
  };

  EventQueue.getQueueSizeByType = async function(eventType, status = 'pending') {
    return await this.count({
      where: { 
        event_type: eventType,
        status 
      }
    });
  };

  EventQueue.clearCompleted = async function(olderThanHours = 24) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

    const result = await this.destroy({
      where: {
        status: 'completed',
        processed_at: {
          [sequelize.Sequelize.Op.lt]: cutoffDate
        }
      }
    });

    return result;
  };

  EventQueue.clearFailed = async function(olderThanHours = 168) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

    const result = await this.destroy({
      where: {
        status: 'failed',
        updated_at: {
          [sequelize.Sequelize.Op.lt]: cutoffDate
        }
      }
    });

    return result;
  };

  EventQueue.removeOldestNonGiftEvents = async function(limit) {
    const events = await this.findAll({
      where: {
        status: 'pending',
        event_type: {
          [sequelize.Sequelize.Op.notIn]: ['tiktok:gift', 'tiktok:donation']
        },
        priority: {
          [sequelize.Sequelize.Op.lt]: 100
        }
      },
      order: [['created_at', 'ASC']],
      limit: limit
    });

    if (events.length === 0) {
      return 0;
    }

    const ids = events.map(event => event.id);
    const result = await this.destroy({
      where: {
        id: {
          [sequelize.Sequelize.Op.in]: ids
        }
      }
    });

    return result;
  };

  EventQueue.resetStuckJobs = async function(timeoutMinutes = 10) {
    const cutoffDate = new Date();
    cutoffDate.setMinutes(cutoffDate.getMinutes() - timeoutMinutes);

    const result = await this.update(
      {
        status: 'pending',
        available_at: new Date(),
        updated_at: new Date()
      },
      {
        where: {
          status: 'processing',
          updated_at: {
            [sequelize.Sequelize.Op.lt]: cutoffDate
          }
        }
      }
    );

    return result[0];
  };

  EventQueue.getStats = async function() {
    const stats = await this.findAll({
      attributes: [
        'status',
        'priority',
        [sequelize.Sequelize.fn('COUNT', '*'), 'count'],
        [sequelize.Sequelize.fn('MIN', sequelize.Sequelize.col('created_at')), 'oldest_job'],
        [sequelize.Sequelize.fn('MAX', sequelize.Sequelize.col('created_at')), 'newest_job']
      ],
      where: {
        status: {
          [sequelize.Sequelize.Op.in]: ['pending', 'processing']
        }
      },
      group: ['status', 'priority'],
      order: [['priority', 'DESC'], ['status', 'ASC']]
    });

    return stats.map(stat => stat.get({ plain: true }));
  };

  EventQueue.getEventTypeStats = async function() {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const stats = await this.findAll({
      attributes: [
        'event_type',
        'status',
        [sequelize.Sequelize.fn('COUNT', '*'), 'count'],
        [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('attempts')), 'avg_attempts']
      ],
      where: {
        created_at: {
          [sequelize.Sequelize.Op.gte]: oneDayAgo
        }
      },
      group: ['event_type', 'status'],
      order: [['event_type', 'ASC'], ['status', 'ASC']]
    });

    return stats.map(stat => stat.get({ plain: true }));
  };

  return EventQueue;
};