/**
 * Migration: add_repeat_end_to_event_queue
 * Created: 2025-08-03T14:37:37.413Z
 */

const up = async (db) => {
  await db.query(`
    ALTER TABLE event_queue 
    ADD COLUMN repeat_end BOOLEAN DEFAULT NULL COMMENT 'Indica si este evento es el final de una racha de regalos (true), parte de una racha (false), o no aplica (NULL para eventos que no son gifts)'
  `);
  
  await db.query(`
    ALTER TABLE event_queue 
    ADD INDEX idx_repeat_end (repeat_end)
  `);
};

const down = async (db) => {
  await db.query(`
    ALTER TABLE event_queue 
    DROP INDEX idx_repeat_end
  `);
  
  await db.query(`
    ALTER TABLE event_queue 
    DROP COLUMN repeat_end
  `);
};

module.exports = { up, down };
