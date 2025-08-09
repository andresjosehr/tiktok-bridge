/**
 * Seeder: seed_tiktok_gifts
 * Created: 2025-08-09T15:09:07.728Z
 */

const path = require('path');
const fs = require('fs');

const up = async (db) => {
  const giftsFilePath = path.join(__dirname, 'json/tiktok-gifts.json');
  const giftsData = JSON.parse(fs.readFileSync(giftsFilePath, 'utf8'));
  
  const gifts = giftsData.gifts;
  
  console.log(`🎁 Seeding ${gifts.length} TikTok gifts...`);
  
  const batchSize = 100;
  for (let i = 0; i < gifts.length; i += batchSize) {
    const batch = gifts.slice(i, i + batchSize);
    
    for (const gift of batch) {
      await db.query(
        `INSERT INTO tiktok_gifts (name, value, image, alt, countries, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [gift.name, parseInt(gift.value) || 1, gift.image, gift.alt || gift.name, JSON.stringify(gift.countries)]
      );
    }
    
    console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(gifts.length / batchSize)}`);
  }
  
  console.log(`🎁 Successfully seeded ${gifts.length} TikTok gifts!`);
};

const down = async (db) => {
  console.log('🗑️ Removing all TikTok gifts...');
  await db.query('DELETE FROM tiktok_gifts');
  console.log('✅ All TikTok gifts removed successfully!');
};

module.exports = { up, down };
