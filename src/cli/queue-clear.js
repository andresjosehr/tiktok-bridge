#!/usr/bin/env node

const queueManager = require('../queue/queueManager');
const db = require('../database/connection');

async function showHelp() {
  console.log('\nGarrys TikTok - Queue Clear\n');
  console.log('Usage: npm run queue:clear [options]\n');
  console.log('Options:');
  console.log('  --all              Clear all jobs from queue');
  console.log('  --completed        Clear completed jobs (default: older than 24h)');
  console.log('  --failed           Clear failed jobs (default: older than 7 days)');
  console.log('  --hours <number>   Specify hours for --completed or --failed');
  console.log('  --help             Show this help message\n');
  
  console.log('Examples:');
  console.log('  npm run queue:clear --all                    # Clear all jobs');
  console.log('  npm run queue:clear --completed              # Clear completed jobs (24h+)');
  console.log('  npm run queue:clear --failed                 # Clear failed jobs (7d+)');
  console.log('  npm run queue:clear --completed --hours 48   # Clear completed jobs (48h+)');
  console.log('  npm run queue:clear --failed --hours 24      # Clear failed jobs (24h+)');
}

async function clearAll() {
  try {
    console.log('⚠️  WARNING: This will clear ALL jobs from the queue!');
    console.log('⚠️  This includes pending, processing, completed, and failed jobs!');
    
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
      return;
    }
    
    console.log('🔄 Clearing all jobs from queue...');
    const removedCount = await queueManager.clearQueue();
    console.log(`✅ Successfully cleared ${removedCount} jobs from queue`);
    
  } catch (error) {
    console.error('❌ Failed to clear queue:', error.message);
    process.exit(1);
  }
}

async function clearCompleted(hours = 24) {
  try {
    console.log(`🔄 Clearing completed jobs older than ${hours} hours...`);
    const removedCount = await queueManager.clearCompletedJobs(hours);
    
    if (removedCount === 0) {
      console.log('✅ No completed jobs to clear');
    } else {
      console.log(`✅ Successfully cleared ${removedCount} completed jobs`);
    }
    
  } catch (error) {
    console.error('❌ Failed to clear completed jobs:', error.message);
    process.exit(1);
  }
}

async function clearFailed(hours = 168) {
  try {
    console.log(`🔄 Clearing failed jobs older than ${hours} hours...`);
    const removedCount = await queueManager.clearFailedJobs(hours);
    
    if (removedCount === 0) {
      console.log('✅ No failed jobs to clear');
    } else {
      console.log(`✅ Successfully cleared ${removedCount} failed jobs`);
    }
    
  } catch (error) {
    console.error('❌ Failed to clear failed jobs:', error.message);
    process.exit(1);
  }
}

async function showQueueStats() {
  try {
    const status = await queueManager.getQueueStatus();
    
    console.log('Current Queue Status:');
    console.log('====================');
    console.log(`Total size: ${status.currentSize}/${status.maxSize} (${status.utilizationPercent}%)`);
    
    if (status.stats.length > 0) {
      console.log('\nJob Status Distribution:');
      status.stats.forEach(stat => {
        console.log(`  ${stat.status.toUpperCase()}: ${stat.count} jobs`);
      });
    }
    
    console.log();
    
  } catch (error) {
    console.error('❌ Failed to get queue stats:', error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    await showHelp();
    process.exit(0);
  }
  
  try {
    console.log('🔄 Initializing database connection...');
    await db.initialize();
    
    // Show current stats before operation
    await showQueueStats();
    
    // Parse hours option
    let hours;
    const hoursIndex = args.indexOf('--hours');
    if (hoursIndex !== -1 && args[hoursIndex + 1]) {
      hours = parseInt(args[hoursIndex + 1]);
      if (isNaN(hours) || hours < 1) {
        console.error('❌ Hours must be a positive number');
        process.exit(1);
      }
    }
    
    // Execute appropriate command
    if (args.includes('--all')) {
      await clearAll();
    } else if (args.includes('--completed')) {
      await clearCompleted(hours);
    } else if (args.includes('--failed')) {
      await clearFailed(hours);
    } else {
      console.error('❌ Please specify a clear operation (--all, --completed, or --failed)');
      await showHelp();
      process.exit(1);
    }
    
    // Show stats after operation
    console.log();
    await showQueueStats();
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = {
  clearAll,
  clearCompleted,
  clearFailed
};