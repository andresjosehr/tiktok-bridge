const { DataTypes, Op } = require('sequelize');

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
            [Op.lte]: new Date()
          }
        }
      },
      canRetry: {
        where: {
          attempts: {
            [Op.lt]: sequelize.col('max_attempts')
          }
        }
      },
      byPriority: {
        order: [['priority', 'DESC'], ['available_at', 'ASC']]
      }
    }
  });

  EventQueue.prototype.markAsProcessing = async function() {
    const EventQueue = this.constructor;
    const [affectedCount] = await EventQueue.update(
      {
        status: 'processing',
        attempts: this.attempts + 1,
        updated_at: new Date()
      },
      {
        where: {
          id: this.id,
          status: 'pending' // Only update if still pending
        }
      }
    );
    
    if (affectedCount === 0) {
      return false; // Job was already taken by another worker
    }
    
    // Update the instance to reflect the changes
    this.status = 'processing';
    this.attempts += 1;
    this.updated_at = new Date();
    return true;
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

  EventQueue.findAndClaimNextJob = async function() {
    const transaction = await this.sequelize.transaction();
    
    try {
      // Use a more permissive time filter to account for timing differences
      const now = new Date();
      now.setSeconds(now.getSeconds() + 1); // Add 1 second buffer
      
      const job = await this.findOne({
        where: {
          status: 'pending',
          available_at: {
            [Op.lte]: now
          },
          attempts: {
            [Op.lt]: this.sequelize.col('max_attempts')
          }
        },
        order: [['priority', 'DESC'], ['available_at', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      
      if (!job) {
        await transaction.commit();
        return null;
      }
      
      const [affectedCount] = await this.update(
        {
          status: 'processing',
          attempts: job.attempts + 1,
          updated_at: new Date()
        },
        {
          where: {
            id: job.id,
            status: 'pending'
          },
          transaction
        }
      );
      
      if (affectedCount === 0) {
        await transaction.commit();
        return null; // Job was already taken
      }
      
      await transaction.commit();
      
      // Update the instance to reflect the changes
      job.status = 'processing';
      job.attempts += 1;
      job.updated_at = new Date();
      
      return job;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
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
          [Op.lt]: cutoffDate
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
          [Op.lt]: cutoffDate
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
          [Op.notIn]: ['tiktok:gift', 'tiktok:donation']
        },
        priority: {
          [Op.lt]: 100
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
          [Op.in]: ids
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
            [Op.lt]: cutoffDate
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
          [Op.in]: ['pending', 'processing']
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
          [Op.gte]: oneDayAgo
        }
      },
      group: ['event_type', 'status'],
      order: [['event_type', 'ASC'], ['status', 'ASC']]
    });

    return stats.map(stat => stat.get({ plain: true }));
  };

  return EventQueue;
};