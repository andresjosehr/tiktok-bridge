/**
 * Migration: add_service_id_to_event_logs
 * Created: 2025-08-09T15:50:32.091Z
 */

const up = async (db) => {
  await db.query(`
    ALTER TABLE event_logs 
    ADD COLUMN service_id VARCHAR(50) NULL 
    AFTER status
  `);
  
  await db.query(`
    CREATE INDEX idx_service_id ON event_logs (service_id)
  `);
};

const down = async (db) => {
  await db.query(`
    DROP INDEX idx_service_id ON event_logs
  `);
  
  await db.query(`
    ALTER TABLE event_logs 
    DROP COLUMN service_id
  `);
};

module.exports = { up, down };
