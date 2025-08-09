#!/usr/bin/env node

const seederManager = require('../database/seederManager');
const db = require('../database/connection');
const logger = require('../utils/logger');

async function showHelp() {
  console.log('\nTikTok Bridge - Seeder Manager\n');
  console.log('Usage: npm run seed [options]\n');
  console.log('Options:');
  console.log('  --rollback    Rollback last seeder batch');
  console.log('  --rollback-all Rollback all seeders');
  console.log('  --status      Show seeder status');
  console.log('  --fresh       Run all seeders (ignores executed status)');
  console.log('  --help        Show this help message\n');
  
  console.log('Examples:');
  console.log('  npm run seed                # Run pending seeders');
  console.log('  npm run seed:rollback       # Rollback last batch');
  console.log('  npm run seed:rollback-all   # Rollback all seeders');
  console.log('  npm run seed:status         # Show status');
  console.log('  npm run seed:fresh          # Run all seeders');
}

async function runSeeders() {
  try {
    console.log('🌱 Initializing database connection...');
    await db.initialize();
    
    console.log('🌱 Initializing seeder manager...');
    await seederManager.initialize();
    
    console.log('🌱 Running pending seeders...');
    const results = await seederManager.runPendingSeeders();
    
    if (results.length === 0) {
      console.log('✅ No pending seeders to run');
    } else {
      console.log(`✅ Successfully ran ${results.length} seeders:`);
      results.forEach(result => {
        const status = result.status === 'success' ? '✅' : '❌';
        console.log(`  ${status} ${result.seeder}`);
        if (result.status === 'failed') {
          console.log(`     Error: ${result.error}`);
        }
      });
    }
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

async function rollbackSeeders() {
  try {
    console.log('🌱 Initializing database connection...');
    await db.initialize();
    await seederManager.initialize();
    
    console.log('🌱 Rolling back last seeder batch...');
    const results = await seederManager.rollbackLastBatch();
    
    if (results.length === 0) {
      console.log('✅ No seeders to rollback');
    } else {
      console.log(`✅ Successfully rolled back ${results.length} seeders:`);
      results.forEach(result => {
        const status = result.status === 'success' ? '✅' : '❌';
        console.log(`  ${status} ${result.seeder}`);
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

async function rollbackAllSeeders() {
  try {
    console.log('⚠️  WARNING: This will rollback ALL seeders!');
    console.log('⚠️  All seeded data will be removed!');
    
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

    console.log('🌱 Initializing database connection...');
    await db.initialize();
    await seederManager.initialize();
    
    console.log('🌱 Rolling back all seeders...');
    const results = await seederManager.rollbackAllSeeders();
    
    if (results.length === 0) {
      console.log('✅ No seeders to rollback');
    } else {
      console.log(`✅ Successfully rolled back ${results.length} seeders:`);
      results.forEach(result => {
        const status = result.status === 'success' ? '✅' : '❌';
        console.log(`  ${status} ${result.seeder}`);
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

async function showSeederStatus() {
  try {
    console.log('🌱 Initializing database connection...');
    await db.initialize();
    await seederManager.initialize();
    
    console.log('🌱 Getting seeder status...\n');
    const status = await seederManager.getSeederStatus();
    
    if (status.length === 0) {
      console.log('📝 No seeders found');
      return;
    }
    
    console.log('Seeder Status:');
    console.log('==============\n');
    
    status.forEach(seeder => {
      const statusIcon = seeder.status === 'executed' ? '✅' : '⏳';
      const statusText = seeder.status === 'executed' ? 'EXECUTED' : 'PENDING';
      console.log(`${statusIcon} ${seeder.seeder.padEnd(50)} ${statusText}`);
    });
    
    const executedCount = status.filter(s => s.status === 'executed').length;
    const pendingCount = status.filter(s => s.status === 'pending').length;
    
    console.log('\nSummary:');
    console.log(`  Total seeders: ${status.length}`);
    console.log(`  Executed: ${executedCount}`);
    console.log(`  Pending: ${pendingCount}`);
  } catch (error) {
    console.error('❌ Failed to get seeder status:', error.message);
    process.exit(1);
  }
}

async function freshSeeders() {
  try {
    console.log('🌱 Initializing database connection...');
    await db.initialize();
    
    console.log('🌱 Running all seeders...');
    const results = await seederManager.runAllSeeders();
    
    if (results.length === 0) {
      console.log('✅ No seeders found to run');
    } else {
      console.log(`✅ Successfully ran ${results.length} seeders:`);
      results.forEach(result => {
        const status = result.status === 'success' ? '✅' : '❌';
        console.log(`  ${status} ${result.seeder}`);
        if (result.status === 'failed') {
          console.log(`     Error: ${result.error}`);
        }
      });
    }
  } catch (error) {
    console.error('❌ Fresh seeding failed:', error.message);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  try {
    if (args.includes('--help') || args.includes('-h')) {
      await showHelp();
    } else if (args.includes('--rollback-all')) {
      await rollbackAllSeeders();
    } else if (args.includes('--rollback')) {
      await rollbackSeeders();
    } else if (args.includes('--status')) {
      await showSeederStatus();
    } else if (args.includes('--fresh')) {
      await freshSeeders();
    } else {
      await runSeeders();
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
  runSeeders,
  rollbackSeeders,
  rollbackAllSeeders,
  showSeederStatus,
  freshSeeders
};