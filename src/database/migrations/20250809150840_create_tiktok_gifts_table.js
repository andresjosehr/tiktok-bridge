/**
 * Migration: create_tiktok_gifts_table
 * Created: 2025-08-09T15:08:40.954Z
 */

const up = async (db) => {
  await db.query(`
    CREATE TABLE tiktok_gifts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      value INT NOT NULL DEFAULT 1,
      image VARCHAR(255) NOT NULL,
      alt VARCHAR(255) NULL,
      countries JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_name (name),
      INDEX idx_value (value)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const down = async (db) => {
  await db.query('DROP TABLE IF EXISTS tiktok_gifts');
};

module.exports = { up, down };
