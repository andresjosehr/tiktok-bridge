/**
 * Migration: create_event_queue_table
 * Created: 2025-07-06T12:00:00.000Z
 */

const up = async (db) => {
  await db.query(`
    CREATE TABLE event_queue (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_type VARCHAR(50) NOT NULL,
      event_data JSON NOT NULL,
      priority INT NOT NULL DEFAULT 0,
      status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
      attempts INT DEFAULT 0,
      max_attempts INT DEFAULT 3,
      available_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      processed_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status_priority_available (status, priority DESC, available_at ASC),
      INDEX idx_event_type (event_type),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const down = async (db) => {
  await db.query('DROP TABLE IF EXISTS event_queue');
};

module.exports = { up, down };