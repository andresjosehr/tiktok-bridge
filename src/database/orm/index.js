const { Sequelize } = require('sequelize');
const config = require('../../config/config');
const logger = require('../../utils/logger');

class DatabaseORM {
  constructor() {
    this.sequelize = null;
    this.models = {};
  }

  async initialize() {
    try {
      this.sequelize = new Sequelize(
        config.database.database,
        config.database.user,
        config.database.password,
        {
          host: config.database.host,
          port: config.database.port,
          dialect: 'mysql',
          pool: {
            max: config.database.connectionLimit,
            min: 0,
            acquire: 30000,
            idle: 10000
          },
          logging: (sql) => {
            if (config.nodeEnv === 'development') {
              logger.debug('SQL Query:', sql);
            }
          },
          define: {
            timestamps: true,
            underscored: true,
            freezeTableName: true
          }
        }
      );

      await this.sequelize.authenticate();
      logger.info('Database ORM connection established successfully');

      this.initializeModels();
      this.setupAssociations();

      if (config.nodeEnv === 'development') {
        await this.sequelize.sync({ alter: false });
      }

    } catch (error) {
      logger.error('Failed to initialize database ORM:', error);
      throw error;
    }
  }

  initializeModels() {
    const EventQueueModel = require('./models/EventQueue');
    const EventLogModel = require('./models/EventLog');
    const QueueStatsModel = require('./models/QueueStats');

    this.models.EventQueue = EventQueueModel(this.sequelize);
    this.models.EventLog = EventLogModel(this.sequelize);
    this.models.QueueStats = QueueStatsModel(this.sequelize);

    logger.info('ORM models initialized successfully');
  }

  setupAssociations() {
    const { EventQueue, EventLog } = this.models;

    EventQueue.hasMany(EventLog, {
      foreignKey: 'queue_id',
      as: 'logs',
      onDelete: 'SET NULL'
    });

    EventLog.belongsTo(EventQueue, {
      foreignKey: 'queue_id',
      as: 'queueItem'
    });

    logger.info('ORM associations setup successfully');
  }

  async close() {
    if (this.sequelize) {
      await this.sequelize.close();
      logger.info('Database ORM connection closed');
    }
  }

  async transaction(callback) {
    return await this.sequelize.transaction(callback);
  }

  getModel(modelName) {
    if (!this.models[modelName]) {
      throw new Error(`Model '${modelName}' not found`);
    }
    return this.models[modelName];
  }

  getSequelize() {
    return this.sequelize;
  }

  getAllModels() {
    return this.models;
  }

  async testConnection() {
    try {
      await this.sequelize.authenticate();
      return true;
    } catch (error) {
      logger.error('ORM connection test failed:', error);
      return false;
    }
  }

  async getConnectionInfo() {
    const dialect = this.sequelize.getDialect();
    const config = this.sequelize.config;
    
    return {
      dialect,
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      poolMax: config.pool?.max,
      poolMin: config.pool?.min
    };
  }
}

module.exports = new DatabaseORM();