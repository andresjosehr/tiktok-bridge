#!/usr/bin/env node

const migrationManager = require('../database/migrationManager');

async function showHelp() {
  console.log('\nGarrys TikTok - Make Migration\n');
  console.log('Usage: npm run make:migration <migration_name>\n');
  console.log('Examples:');
  console.log('  npm run make:migration create_users_table');
  console.log('  npm run make:migration add_index_to_events');
  console.log('  npm run make:migration update_queue_priorities\n');
}

async function makeMigration(name) {
  try {
    if (!name) {
      console.error('❌ Migration name is required');
      await showHelp();
      process.exit(1);
    }

    // Validate migration name
    if (!/^[a-z0-9_]+$/i.test(name)) {
      console.error('❌ Migration name can only contain letters, numbers, and underscores');
      process.exit(1);
    }

    console.log(`🔄 Creating migration: ${name}...`);
    
    const filename = await migrationManager.createMigrationFile(name);
    
    console.log(`✅ Migration created successfully!`);
    console.log(`📁 File: src/database/migrations/${filename}`);
    console.log('\n📝 Next steps:');
    console.log('1. Edit the migration file to add your schema changes');
    console.log('2. Run "npm run migrate" to execute the migration');
    
  } catch (error) {
    console.error('❌ Failed to create migration:', error.message);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    await showHelp();
    process.exit(0);
  }
  
  const migrationName = args[0];
  await makeMigration(migrationName);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { makeMigration };