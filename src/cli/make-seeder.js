#!/usr/bin/env node

const seederManager = require('../database/seederManager');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('\nTikTok Bridge - Seeder Generator\n');
    console.log('Usage: npm run make:seeder <seeder_name>\n');
    console.log('Examples:');
    console.log('  npm run make:seeder users_table');
    console.log('  npm run make:seeder sample_data');
    console.log('  npm run make:seeder test_events\n');
    process.exit(0);
  }
  
  const seederName = args[0];
  
  if (!seederName) {
    console.error('❌ Error: Seeder name is required');
    console.log('Usage: npm run make:seeder <seeder_name>');
    process.exit(1);
  }
  
  // Validate seeder name (only letters, numbers, and underscores)
  if (!/^[a-zA-Z0-9_]+$/.test(seederName)) {
    console.error('❌ Error: Seeder name can only contain letters, numbers, and underscores');
    process.exit(1);
  }
  
  try {
    const filename = await seederManager.createSeederFile(seederName);
    console.log(`✅ Seeder created successfully: ${filename}`);
    console.log(`📁 Location: src/database/seeders/${filename}`);
  } catch (error) {
    console.error('❌ Failed to create seeder:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}