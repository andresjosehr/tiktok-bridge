#!/usr/bin/env node

const migrationManager = require('../database/migrationManager');
const db = require('../database/connection');
const logger = require('../utils/logger');

const commands = {
  migrate: 'Run pending migrations',
  rollback: 'Rollback last migration batch',
  status: 'Show migration status',
  fresh: 'Drop all tables and run fresh migrations'
};

async function showHelp() {
  console.log('\nGarrys TikTok - Migration Manager\n');
  console.log('Usage: npm run migrate [options]\n');
  console.log('Options:');
  console.log('  --rollback    Rollback last migration batch');
  console.log('  --status      Show migration status');
  console.log('  --fresh       Drop all tables and run fresh migrations');
  console.log('  --help        Show this help message\n');
  
  console.log('Examples:');
  console.log('  npm run migrate                # Run pending migrations');
  console.log('  npm run migrate:rollback       # Rollback last batch');
  console.log('  npm run migrate:status         # Show status');
  console.log('  npm run migrate:fresh          # Fresh install');
}

async function runMigrations() {
  try {
    console.log('🔄 Initializing database connection...');
    await db.createDatabase();
    await db.initialize();
    
    console.log('🔄 Initializing migration manager...');
    await migrationManager.initialize();
    
    console.log('🔄 Running pending migrations...');
    const results = await migrationManager.runPendingMigrations();
    
    if (results.length === 0) {
      console.log('✅ No pending migrations to run');
    } else {
      console.log(`✅ Successfully ran ${results.length} migrations:`);
      results.forEach(result => {
        const status = result.status === 'success' ? '✅' : '❌';
        console.log(`  ${status} ${result.migration}`);
        if (result.status === 'failed') {
          console.log(`     Error: ${result.error}`);
        }
      });
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

async function rollbackMigrations() {
  try {
    console.log('🔄 Initializing database connection...');
    await db.initialize();
    await migrationManager.initialize();
    
    console.log('🔄 Rolling back last migration batch...');
    const results = await migrationManager.rollbackLastBatch();
    
    if (results.length === 0) {
      console.log('✅ No migrations to rollback');
    } else {
      console.log(`✅ Successfully rolled back ${results.length} migrations:`);
      results.forEach(result => {
        const status = result.status === 'success' ? '✅' : '❌';
        console.log(`  ${status} ${result.migration}`);
        if (result.status === 'failed') {
          console.log(`     Error: ${result.error}`);
        }
      });
    }
  } catch (error) {
    console.error('❌ Rollback failed:', error.message);
    process.exit(1);
  }
}

async function showMigrationStatus() {
  try {
    console.log('🔄 Initializing database connection...');
    await db.initialize();
    await migrationManager.initialize();
    
    console.log('🔄 Getting migration status...\n');
    const status = await migrationManager.getMigrationStatus();
    
    if (status.length === 0) {
      console.log('📝 No migrations found');
      return;
    }
    
    console.log('Migration Status:');
    console.log('================\n');
    
    status.forEach(migration => {
      const statusIcon = migration.status === 'executed' ? '✅' : '⏳';
      const statusText = migration.status === 'executed' ? 'EXECUTED' : 'PENDING';
      console.log(`${statusIcon} ${migration.migration.padEnd(50)} ${statusText}`);
    });
    
    const executedCount = status.filter(m => m.status === 'executed').length;
    const pendingCount = status.filter(m => m.status === 'pending').length;
    
    console.log('\nSummary:');
    console.log(`  Total migrations: ${status.length}`);
    console.log(`  Executed: ${executedCount}`);
    console.log(`  Pending: ${pendingCount}`);
  } catch (error) {
    console.error('❌ Failed to get migration status:', error.message);
    process.exit(1);
  }
}

async function freshMigrations() {
  try {
    console.log('⚠️  WARNING: This will drop all tables and run fresh migrations!');
    console.log('⚠️  All data will be lost!');
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      readline.question('Are you sure you want to continue? (yes/no): ', resolve);
    });
    
    readline.close();
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Operation cancelled');
      process.exit(0);
    }
    
    console.log('🔄 Initializing database connection...');
    await db.createDatabase();
    await db.initialize();
    
    console.log('🔄 Running fresh migrations...');
    const results = await migrationManager.freshMigrations();
    
    console.log(`✅ Successfully ran ${results.length} fresh migrations:`);
    results.forEach(result => {
      const status = result.status === 'success' ? '✅' : '❌';
      console.log(`  ${status} ${result.migration}`);
      if (result.status === 'failed') {
        console.log(`     Error: ${result.error}`);
      }
    });
  } catch (error) {
    console.error('❌ Fresh migration failed:', error.message);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  try {
    if (args.includes('--help') || args.includes('-h')) {
      await showHelp();
    } else if (args.includes('--rollback')) {
      await rollbackMigrations();
    } else if (args.includes('--status')) {
      await showMigrationStatus();
    } else if (args.includes('--fresh')) {
      await freshMigrations();
    } else {
      await runMigrations();
    }
  } finally {
    await db.close();
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = {
  runMigrations,
  rollbackMigrations,
  showMigrationStatus,
  freshMigrations
};