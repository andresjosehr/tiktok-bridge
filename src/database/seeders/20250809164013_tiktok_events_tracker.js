/**
 * Seeder: tiktok_events_tracker
 * Created: 2025-08-09T16:40:13.965Z
 */

const up = async (db) => {
  // Write your seeder logic here
  // Example:
  // await db.query(`
  //   INSERT INTO users (name, email, created_at, updated_at) VALUES
  //   ('John Doe', 'john@example.com', NOW(), NOW()),
  //   ('Jane Smith', 'jane@example.com', NOW(), NOW())
  // `);
};

const down = async (db) => {
  // Write your rollback logic here
  // Example:
  // await db.query('DELETE FROM users WHERE email IN ("john@example.com", "jane@example.com")');
};

module.exports = { up, down };
