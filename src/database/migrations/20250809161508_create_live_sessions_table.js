/**
 * Migration: create_live_sessions_table
 * Created: 2025-08-09T16:15:08.567Z
 */

const up = async (db) => {
  await db.query(`
    CREATE TABLE live_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tiktok_username VARCHAR(255) NOT NULL,
      service_id VARCHAR(100) NOT NULL COMMENT 'Active service during this live session (gmod, gtav, dinochrome, etc)',
      start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      end_time TIMESTAMP NULL,
      status ENUM('active', 'ended', 'error') DEFAULT 'active',
      viewer_count_peak INT DEFAULT 0,
      total_events INT DEFAULT 0,
      total_gifts INT DEFAULT 0,
      total_follows INT DEFAULT 0,
      total_chat_messages INT DEFAULT 0,
      session_notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tiktok_username (tiktok_username),
      INDEX idx_service_id (service_id),
      INDEX idx_start_time (start_time),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const down = async (db) => {
  await db.query('DROP TABLE IF EXISTS live_sessions');
};

module.exports = { up, down };
