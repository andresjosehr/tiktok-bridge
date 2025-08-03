const db = require('../connection');
const logger = require('../../utils/logger');

class EventQueue {
  constructor() {
    this.tableName = 'event_queue';
  }

  async create(eventType, eventData, priority = 0, maxAttempts = 3) {
    try {
      const sql = `
        INSERT INTO ${this.tableName} 
        (event_type, event_data, priority, max_attempts) 
        VALUES (?, ?, ?, ?)
      `;
      
      const result = await db.query(sql, [
        eventType,
        JSON.stringify(eventData),
        priority,
        maxAttempts
      ]);
      
      return result.insertId;
    } catch (error) {
      logger.error('Failed to create queue item:', error);
      throw error;
    }
  }

  async getNextJob() {
    try {
      const sql = `
        SELECT * FROM ${this.tableName} 
        WHERE status = 'pending' 
        AND available_at <= NOW()
        AND attempts < max_attempts
        ORDER BY priority DESC, available_at ASC 
        LIMIT 1
      `;
      
      const results = await db.query(sql);
      
      if (results.length === 0) {
        return null;
      }
      
      const job = results[0];
      job.event_data = JSON.parse(job.event_data);
      
      return job;
    } catch (error) {
      logger.error('Failed to get next job:', error);
      throw error;
    }
  }

  async markAsProcessing(id) {
    try {
      const sql = `
        UPDATE ${this.tableName} 
        SET status = 'processing', 
            attempts = attempts + 1,
            updated_at = NOW()
        WHERE id = ? AND status = 'pending'
      `;
      
      const result = await db.query(sql, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      logger.error('Failed to mark job as processing:', error);
      throw error;
    }
  }

  async markAsCompleted(id) {
    try {
      const sql = `
        UPDATE ${this.tableName} 
        SET status = 'completed', 
            processed_at = NOW(),
            updated_at = NOW()
        WHERE id = ?
      `;
      
      const result = await db.query(sql, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      logger.error('Failed to mark job as completed:', error);
      throw error;
    }
  }

  async markAsFailed(id, retryDelay = 0) {
    try {
      const sql = `
        UPDATE ${this.tableName} 
        SET status = CASE 
          WHEN attempts >= max_attempts THEN 'failed'
          ELSE 'pending'
        END,
        available_at = CASE 
          WHEN attempts >= max_attempts THEN available_at
          ELSE DATE_ADD(NOW(), INTERVAL ? SECOND)
        END,
        updated_at = NOW()
        WHERE id = ?
      `;
      
      const result = await db.query(sql, [retryDelay, id]);
      return result.affectedRows > 0;
    } catch (error) {
      logger.error('Failed to mark job as failed:', error);
      throw error;
    }
  }

  async getQueueStats() {
    try {
      const sql = `
        SELECT 
          status,
          priority,
          COUNT(*) as count,
          MIN(created_at) as oldest_job,
          MAX(created_at) as newest_job
        FROM ${this.tableName}
        WHERE status IN ('pending', 'processing')
        GROUP BY status, priority
        ORDER BY priority DESC, status
      `;
      
      const results = await db.query(sql);
      return results;
    } catch (error) {
      logger.error('Failed to get queue stats:', error);
      throw error;
    }
  }

  async getEventTypeStats() {
    try {
      const sql = `
        SELECT 
          event_type,
          status,
          COUNT(*) as count,
          AVG(attempts) as avg_attempts
        FROM ${this.tableName}
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
        GROUP BY event_type, status
        ORDER BY event_type, status
      `;
      
      const results = await db.query(sql);
      return results;
    } catch (error) {
      logger.error('Failed to get event type stats:', error);
      throw error;
    }
  }

  async clearCompleted(olderThanHours = 24) {
    try {
      const sql = `
        DELETE FROM ${this.tableName} 
        WHERE status = 'completed' 
        AND processed_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
      `;
      
      const result = await db.query(sql, [olderThanHours]);
      return result.affectedRows;
    } catch (error) {
      logger.error('Failed to clear completed jobs:', error);
      throw error;
    }
  }

  async clearFailed(olderThanHours = 168) {
    try {
      const sql = `
        DELETE FROM ${this.tableName} 
        WHERE status = 'failed' 
        AND updated_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
      `;
      
      const result = await db.query(sql, [olderThanHours]);
      return result.affectedRows;
    } catch (error) {
      logger.error('Failed to clear failed jobs:', error);
      throw error;
    }
  }

  async clearAll() {
    try {
      const sql = `DELETE FROM ${this.tableName}`;
      const result = await db.query(sql);
      return result.affectedRows;
    } catch (error) {
      logger.error('Failed to clear all jobs:', error);
      throw error;
    }
  }

  async getQueueSize() {
    try {
      const sql = `
        SELECT COUNT(*) as total_pending
        FROM ${this.tableName}
        WHERE status = 'pending'
      `;
      
      const results = await db.query(sql);
      return results[0].total_pending;
    } catch (error) {
      logger.error('Failed to get queue size:', error);
      throw error;
    }
  }

  async getQueueSizeByType(eventType) {
    try {
      const sql = `
        SELECT COUNT(*) as count
        FROM ${this.tableName}
        WHERE status = 'pending' AND event_type = ?
      `;
      
      const results = await db.query(sql, [eventType]);
      return results[0].count;
    } catch (error) {
      logger.error('Failed to get queue size by type:', error);
      throw error;
    }
  }

  async removeOldestNonGiftEvents(limit) {
    try {
      const sql = `
        DELETE FROM ${this.tableName}
        WHERE status = 'pending' 
        AND event_type NOT IN ('tiktok:gift', 'tiktok:donation')
        AND priority < 100
        ORDER BY created_at ASC
        LIMIT ?
      `;
      
      const result = await db.query(sql, [limit]);
      return result.affectedRows;
    } catch (error) {
      logger.error('Failed to remove oldest non-gift events:', error);
      throw error;
    }
  }

  async resetStuckJobs(timeoutMinutes = 10) {
    try {
      const sql = `
        UPDATE ${this.tableName}
        SET status = 'pending',
            available_at = NOW(),
            updated_at = NOW()
        WHERE status = 'processing'
        AND updated_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
      `;
      
      const result = await db.query(sql, [timeoutMinutes]);
      return result.affectedRows;
    } catch (error) {
      logger.error('Failed to reset stuck jobs:', error);
      throw error;
    }
  }
}

module.exports = new EventQueue();