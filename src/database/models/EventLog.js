const db = require('../connection');
const logger = require('../../utils/logger');

class EventLog {
  constructor() {
    this.tableName = 'event_logs';
  }

  async create(queueId, eventType, eventData, status, errorMessage = null, executionTimeMs = null) {
    try {
      const sql = `
        INSERT INTO ${this.tableName} 
        (queue_id, event_type, event_data, status, error_message, execution_time_ms) 
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      const result = await db.query(sql, [
        queueId,
        eventType,
        JSON.stringify(eventData),
        status,
        errorMessage,
        executionTimeMs
      ]);
      
      return result.insertId;
    } catch (error) {
      logger.error('Failed to create event log:', error);
      throw error;
    }
  }

  async getRecentLogs(limit = 100, eventType = null) {
    try {
      let sql = `
        SELECT * FROM ${this.tableName}
        WHERE 1=1
      `;
      const params = [];

      if (eventType) {
        sql += ' AND event_type = ?';
        params.push(eventType);
      }

      sql += ' ORDER BY processed_at DESC LIMIT ?';
      params.push(limit);
      
      const results = await db.query(sql, params);
      
      return results.map(log => ({
        ...log,
        event_data: JSON.parse(log.event_data)
      }));
    } catch (error) {
      logger.error('Failed to get recent logs:', error);
      throw error;
    }
  }

  async getLogsByDateRange(startDate, endDate, eventType = null) {
    try {
      let sql = `
        SELECT * FROM ${this.tableName}
        WHERE processed_at >= ? AND processed_at <= ?
      `;
      const params = [startDate, endDate];

      if (eventType) {
        sql += ' AND event_type = ?';
        params.push(eventType);
      }

      sql += ' ORDER BY processed_at DESC';
      
      const results = await db.query(sql, params);
      
      return results.map(log => ({
        ...log,
        event_data: JSON.parse(log.event_data)
      }));
    } catch (error) {
      logger.error('Failed to get logs by date range:', error);
      throw error;
    }
  }

  async getErrorLogs(limit = 50) {
    try {
      const sql = `
        SELECT * FROM ${this.tableName}
        WHERE status = 'failed'
        ORDER BY processed_at DESC
        LIMIT ?
      `;
      
      const results = await db.query(sql, [limit]);
      
      return results.map(log => ({
        ...log,
        event_data: JSON.parse(log.event_data)
      }));
    } catch (error) {
      logger.error('Failed to get error logs:', error);
      throw error;
    }
  }

  async getProcessingStats(hours = 24) {
    try {
      const sql = `
        SELECT 
          event_type,
          status,
          COUNT(*) as count,
          AVG(execution_time_ms) as avg_execution_time,
          MIN(execution_time_ms) as min_execution_time,
          MAX(execution_time_ms) as max_execution_time
        FROM ${this.tableName}
        WHERE processed_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        GROUP BY event_type, status
        ORDER BY event_type, status
      `;
      
      const results = await db.query(sql, [hours]);
      return results;
    } catch (error) {
      logger.error('Failed to get processing stats:', error);
      throw error;
    }
  }

  async getThroughputStats(hours = 24) {
    try {
      const sql = `
        SELECT 
          DATE_FORMAT(processed_at, '%Y-%m-%d %H:00:00') as hour,
          event_type,
          COUNT(*) as events_processed,
          AVG(execution_time_ms) as avg_execution_time
        FROM ${this.tableName}
        WHERE processed_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        GROUP BY hour, event_type
        ORDER BY hour DESC, event_type
      `;
      
      const results = await db.query(sql, [hours]);
      return results;
    } catch (error) {
      logger.error('Failed to get throughput stats:', error);
      throw error;
    }
  }

  async cleanupOldLogs(olderThanDays = 30) {
    try {
      const sql = `
        DELETE FROM ${this.tableName}
        WHERE processed_at < DATE_SUB(NOW(), INTERVAL ? DAY)
      `;
      
      const result = await db.query(sql, [olderThanDays]);
      return result.affectedRows;
    } catch (error) {
      logger.error('Failed to cleanup old logs:', error);
      throw error;
    }
  }

  async getSuccessRate(eventType = null, hours = 24) {
    try {
      let sql = `
        SELECT 
          COUNT(*) as total_events,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_events,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_events,
          SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped_events,
          ROUND(
            (SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2
          ) as success_rate
        FROM ${this.tableName}
        WHERE processed_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
      `;
      const params = [hours];

      if (eventType) {
        sql += ' AND event_type = ?';
        params.push(eventType);
      }
      
      const results = await db.query(sql, params);
      return results[0];
    } catch (error) {
      logger.error('Failed to get success rate:', error);
      throw error;
    }
  }

  async getTopErrors(limit = 10, hours = 24) {
    try {
      const sql = `
        SELECT 
          error_message,
          event_type,
          COUNT(*) as occurrences,
          MAX(processed_at) as last_occurrence
        FROM ${this.tableName}
        WHERE status = 'failed'
        AND processed_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        AND error_message IS NOT NULL
        GROUP BY error_message, event_type
        ORDER BY occurrences DESC
        LIMIT ?
      `;
      
      const results = await db.query(sql, [hours, limit]);
      return results;
    } catch (error) {
      logger.error('Failed to get top errors:', error);
      throw error;
    }
  }

  async getSlowestEvents(limit = 10, hours = 24) {
    try {
      const sql = `
        SELECT 
          event_type,
          execution_time_ms,
          processed_at,
          queue_id
        FROM ${this.tableName}
        WHERE processed_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        AND execution_time_ms IS NOT NULL
        ORDER BY execution_time_ms DESC
        LIMIT ?
      `;
      
      const results = await db.query(sql, [hours, limit]);
      return results;
    } catch (error) {
      logger.error('Failed to get slowest events:', error);
      throw error;
    }
  }
}

module.exports = new EventLog();