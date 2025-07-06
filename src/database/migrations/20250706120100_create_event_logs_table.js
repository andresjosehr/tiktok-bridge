/**
 * Migration: create_event_logs_table
 * Created: 2025-07-06T12:01:00.000Z
 */

const up = async (db) => {
  await db.query(`
    CREATE TABLE event_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      queue_id INT,
      event_type VARCHAR(50) NOT NULL,
      event_data JSON NOT NULL,
      status ENUM('success', 'failed', 'skipped') NOT NULL,
      error_message TEXT NULL,
      execution_time_ms INT NULL,
      processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_queue_id (queue_id),
      INDEX idx_event_type (event_type),
      INDEX idx_status (status),
      INDEX idx_processed_at (processed_at),
      FOREIGN KEY (queue_id) REFERENCES event_queue(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const down = async (db) => {
  await db.query('DROP TABLE IF EXISTS event_logs');
};

module.exports = { up, down };