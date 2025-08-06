/**
 * Migration: add_service_id_to_event_queue
 * Created: 2025-08-06T18:18:33.867Z
 */

const up = async (db) => {
  // Add service_id column to event_queue table to track which service the event is destined for
  await db.query(`
    ALTER TABLE event_queue 
    ADD COLUMN service_id VARCHAR(50) NULL AFTER priority,
    ADD INDEX idx_service_id (service_id)
  `);
};

const down = async (db) => {
  // Remove service_id column and its index
  await db.query(`
    ALTER TABLE event_queue 
    DROP INDEX idx_service_id,
    DROP COLUMN service_id
  `);
};

module.exports = { up, down };
