const mysql = require('mysql2/promise');
const config = require('../config/config');
const logger = require('../utils/logger');

class DatabaseConnection {
  constructor() {
    this.pool = null;
    this.connection = null;
  }

  async initialize() {
    try {
      this.pool = mysql.createPool({
        host: config.database.host,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database,
        port: config.database.port,
        waitForConnections: true,
        connectionLimit: config.database.connectionLimit,
        queueLimit: 0,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true,
        ssl: config.database.ssl
      });

      await this.testConnection();
      logger.info('Database pool initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database pool:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      logger.info('Database connection test successful');
    } catch (error) {
      logger.error('Database connection test failed:', error);
      throw error;
    }
  }

  async query(sql, params = []) {
    try {
      const [results] = await this.pool.execute(sql, params);
      return results;
    } catch (error) {
      logger.error('Database query failed:', { sql, params, error: error.message });
      throw error;
    }
  }

  async transaction(callback) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      
      const result = await callback(connection);
      
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async createDatabase() {
    try {
      const tempPool = mysql.createPool({
        host: config.database.host,
        user: config.database.user,
        password: config.database.password,
        port: config.database.port,
        ssl: config.database.ssl
      });

      await tempPool.execute(
        `CREATE DATABASE IF NOT EXISTS \`${config.database.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );

      await tempPool.end();
      logger.info(`Database '${config.database.database}' created or already exists`);
    } catch (error) {
      logger.error('Failed to create database:', error);
      throw error;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      logger.info('Database pool closed');
    }
  }

  getPool() {
    return this.pool;
  }
}

module.exports = new DatabaseConnection();