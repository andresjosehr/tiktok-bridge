/**
 * Migration: add_updated_at_to_event_logs
 * Created: 2025-07-06T22:21:24.036Z
 */

const up = async (db) => {
  await db.query(`
    ALTER TABLE event_logs 
    ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  `);
};

const down = async (db) => {
  await db.query(`
    ALTER TABLE event_logs 
    DROP COLUMN updated_at
  `);
};

module.exports = { up, down };
