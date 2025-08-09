/**
 * Migration: create_tiktok_events_table
 * Created: 2025-08-09T16:38:48.521Z
 */

const up = async (db) => {
  await db.query(`
    CREATE TABLE tiktok_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      live_session_id INT NOT NULL,
      event_type VARCHAR(50) NOT NULL COMMENT 'chat, gift, member, follow, share, like, roomUser, emote, envelope, questionNew, linkMicBattle, subscribe, etc.',
      username VARCHAR(100) NULL COMMENT 'TikTok username that triggered the event (uniqueId)',
      user_id VARCHAR(100) NULL COMMENT 'TikTok internal user ID',
      
      -- Chat-specific fields
      message TEXT NULL COMMENT 'Chat message content for chat events',
      
      -- Gift-specific fields
      gift_id INT NULL COMMENT 'Gift ID from TikTok',
      gift_name VARCHAR(100) NULL COMMENT 'Gift display name',
      gift_type INT NULL COMMENT 'Gift type (1=streakable, others=non-streakable)',
      gift_value INT NULL COMMENT 'Gift diamond/coin value',
      repeat_count INT DEFAULT 1 COMMENT 'Number of times gift was sent in streak',
      repeat_end BOOLEAN NULL COMMENT 'true if final gift in streak, false if intermediate, null if not a streak',
      
      -- Viewer/Room statistics
      viewer_count INT NULL COMMENT 'Current viewer count for roomUser events',
      like_count INT NULL COMMENT 'Number of likes sent in like events',
      total_like_count BIGINT NULL COMMENT 'Total accumulated likes',
      
      -- Question/Social fields
      question_text TEXT NULL COMMENT 'Question content for questionNew events',
      social_action VARCHAR(50) NULL COMMENT 'follow, share for social events',
      
      -- Battle/Link Mic fields
      battle_data JSON NULL COMMENT 'Battle information for linkMicBattle events',
      
      -- Raw event data and metadata
      event_data JSON NOT NULL COMMENT 'Complete raw event data from TikTok',
      event_timestamp TIMESTAMP NOT NULL COMMENT 'When the event occurred on TikTok',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (live_session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
      INDEX idx_live_session_id (live_session_id),
      INDEX idx_event_type (event_type),
      INDEX idx_username (username),
      INDEX idx_user_id (user_id),
      INDEX idx_event_timestamp (event_timestamp),
      INDEX idx_gift_id (gift_id),
      INDEX idx_gift_name (gift_name),
      INDEX idx_gift_value (gift_value),
      INDEX idx_social_action (social_action),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='Stores all TikTok events permanently for statistical analysis and reports'
  `);
};

const down = async (db) => {
  await db.query('DROP TABLE IF EXISTS tiktok_events');
};

module.exports = { up, down };
