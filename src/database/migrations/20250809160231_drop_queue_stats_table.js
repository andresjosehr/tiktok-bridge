/**
 * Migration: drop_queue_stats_table
 * Created: 2025-08-09T16:02:31.865Z
 */

const up = async (db) => {
  // Drop the queue_stats table as it's no longer needed
  await db.query('DROP TABLE IF EXISTS queue_stats');
};

const down = async (db) => {
  // Recreate the queue_stats table if needed for rollback
  await db.query(`
    CREATE TABLE queue_stats (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date DATE NOT NULL,
      hour TINYINT NOT NULL,
      event_type VARCHAR(50) NOT NULL,
      total_events INT DEFAULT 0,
      processed_events INT DEFAULT 0,
      failed_events INT DEFAULT 0,
      skipped_events INT DEFAULT 0,
      avg_processing_time_ms INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_date_hour_type (date, hour, event_type),
      INDEX idx_date (date),
      INDEX idx_event_type (event_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

module.exports = { up, down };
