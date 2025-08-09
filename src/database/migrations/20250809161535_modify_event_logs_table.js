/**
 * Migration: modify_event_logs_table
 * Created: 2025-08-09T16:15:35.188Z
 */

const up = async (db) => {
  // Add session_id column to link with live_sessions table
  await db.query(`
    ALTER TABLE event_logs 
    ADD COLUMN session_id INT NULL AFTER id,
    ADD CONSTRAINT fk_event_logs_session_id 
    FOREIGN KEY (session_id) REFERENCES live_sessions(id) 
    ON DELETE SET NULL ON UPDATE CASCADE
  `);
  
  // First drop foreign key constraint for queue_id
  await db.query(`
    ALTER TABLE event_logs 
    DROP FOREIGN KEY event_logs_ibfk_1
  `);
  
  // Remove service_id and queue_id columns (service_id moved to live_sessions, queue_id not needed)
  await db.query(`
    ALTER TABLE event_logs 
    DROP COLUMN service_id,
    DROP COLUMN queue_id
  `);
  
  // Add index for better performance
  await db.query(`
    ALTER TABLE event_logs 
    ADD INDEX idx_session_id (session_id)
  `);
};

const down = async (db) => {
  // Remove index
  await db.query(`
    ALTER TABLE event_logs 
    DROP INDEX idx_session_id
  `);
  
  // Add back service_id and queue_id columns
  await db.query(`
    ALTER TABLE event_logs 
    ADD COLUMN service_id VARCHAR(100) NULL AFTER processed_at,
    ADD COLUMN queue_id VARCHAR(36) NULL AFTER service_id
  `);
  
  // Recreate foreign key for queue_id
  await db.query(`
    ALTER TABLE event_logs 
    ADD CONSTRAINT event_logs_ibfk_1
    FOREIGN KEY (queue_id) REFERENCES event_queue(id)
    ON DELETE SET NULL ON UPDATE CASCADE
  `);
  
  // Remove foreign key constraint and session_id column
  await db.query(`
    ALTER TABLE event_logs 
    DROP FOREIGN KEY fk_event_logs_session_id,
    DROP COLUMN session_id
  `);
};

module.exports = { up, down };
