#!/usr/bin/env node

const queueProcessor = require('../queue/queueProcessor');
const queueManager = require('../queue/queueManager');
const db = require('../database/connection');
const orm = require('../database/orm');
// Services are loaded dynamically by queueProcessor
const logger = require('../utils/logger');
const config = require('../config/config');
const cron = require('node-cron');

let isShuttingDown = false;

async function showHelp() {
  console.log('\nGarrys TikTok - Queue Worker\n');
  console.log('Usage: npm run queue:work [options]\n');
  console.log('Options:');
  console.log('  --batch-size <number>     Set batch size (default: 1)');
  console.log('  --delay <number>          Set processing delay in ms (default: 100)');
  console.log('  --status                  Show queue status');
  console.log('  --health                  Show queue health status');
  console.log('  --optimize                Run queue optimization');
  console.log('  --help                    Show this help message\n');
  
  console.log('Examples:');
  console.log('  npm run queue:work                    # Start queue worker');
  console.log('  npm run queue:work --batch-size 5     # Start with batch size 5');
  console.log('  npm run queue:work --delay 200        # Start with 200ms delay');
  console.log('  npm run queue:work --status           # Show queue status');
}

async function showQueueStatus() {
  try {
    console.log('🔄 Getting queue status...\n');
    
    // Initialize database and ORM
    await db.initialize();
    await orm.initialize();
    
    const status = await queueManager.getQueueStatus();
    const processorStatus = await queueProcessor.getProcessorStatus();
    const processingStats = await queueManager.getProcessingStats(24);
    
    console.log('Queue Status:');
    console.log('=============');
    console.log(`Current size: ${status.currentSize}/${status.maxSize} (${status.utilizationPercent}%)`);
    console.log(`Processing: ${processorStatus.isProcessing ? '✅ Running' : '❌ Stopped'}`);
    console.log(`Active Service: ${processorStatus.activeServiceType}`);
    console.log(`Batch size: ${processorStatus.batchSize}`);
    console.log(`Max retry delay: ${processorStatus.maxRetryDelay}s\n`);
    
    if (status.stats.length > 0) {
      console.log('Queue Statistics:');
      console.log('================');
      status.stats.forEach(stat => {
        console.log(`${stat.status.toUpperCase()} (Priority ${stat.priority}): ${stat.count} jobs`);
        if (stat.oldest_job) {
          console.log(`  Oldest: ${new Date(stat.oldest_job).toLocaleString()}`);
        }
      });
      console.log();
    }
    
    if (processingStats.successRate) {
      const sr = processingStats.successRate;
      console.log('Processing Statistics (24h):');
      console.log('============================');
      console.log(`Total events: ${sr.total_events}`);
      console.log(`Successful: ${sr.successful_events} (${sr.success_rate}%)`);
      console.log(`Failed: ${sr.failed_events}`);
      console.log(`Skipped: ${sr.skipped_events}\n`);
    }
    
    console.log('Registered Event Handlers:');
    console.log('==========================');
    processorStatus.registeredHandlers.forEach(handler => {
      console.log(`✅ ${handler}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to get queue status:', error.message);
    process.exit(1);
  }
}

async function showHealthStatus() {
  try {
    console.log('🔄 Checking queue health...\n');
    
    // Initialize database and ORM
    await db.initialize();
    await orm.initialize();
    
    const health = await queueManager.getHealthStatus();
    
    const statusIcon = {
      'healthy': '✅',
      'warning': '⚠️',
      'critical': '🚨',
      'error': '❌'
    }[health.status] || '❓';
    
    console.log(`Health Status: ${statusIcon} ${health.status.toUpperCase()}\n`);
    
    if (health.queueSize !== undefined) {
      console.log(`Queue Size: ${health.queueSize}`);
      console.log(`Utilization: ${health.utilization}%`);
      console.log(`Success Rate: ${health.successRate}%\n`);
    }
    
    if (health.issues && health.issues.length > 0) {
      console.log('Issues:');
      health.issues.forEach(issue => {
        console.log(`  ⚠️  ${issue}`);
      });
      console.log();
    }
    
    if (health.status === 'healthy') {
      console.log('🎉 All systems operating normally!');
    } else if (health.error) {
      console.log(`❌ Error: ${health.error}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to check health status:', error.message);
    process.exit(1);
  }
}

async function optimizeQueue() {
  try {
    console.log('🔄 Running queue optimization...\n');
    
    // Initialize database and ORM
    await db.initialize();
    await orm.initialize();
    
    const optimizations = await queueManager.optimizeQueue();
    
    if (optimizations.length === 0) {
      console.log('✅ Queue is already optimized, no changes needed');
    } else {
      console.log('✅ Queue optimization completed:');
      optimizations.forEach(optimization => {
        console.log(`  🔧 ${optimization}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Queue optimization failed:', error.message);
    process.exit(1);
  }
}

async function startWorker(options = {}) {
  try {
    console.log('🚀 Starting Garrys TikTok Queue Worker...\n');
    
    // Initialize database
    console.log('🔄 Initializing database...');
    await db.createDatabase();
    await db.initialize();
    
    // Initialize ORM
    console.log('🔄 Initializing ORM...');
    await orm.initialize();
    
    // Services are initialized automatically by queueProcessor
    console.log('📋 Services will be loaded based on configuration...');
    
    // Configure processor
    if (options.batchSize) {
      queueProcessor.setBatchSize(options.batchSize);
      console.log(`📦 Batch size set to: ${options.batchSize}`);
    }
    
    
    // Start queue processor
    console.log('🔄 Starting queue processor...');
    await queueProcessor.start();
    
    // Setup periodic tasks
    console.log('🔄 Setting up periodic tasks...');
    
    // Cleanup task every hour
    cron.schedule('0 * * * *', async () => {
      if (!isShuttingDown) {
        logger.info('Running periodic queue cleanup...');
        try {
          await queueManager.clearCompletedJobs(24);
          await queueManager.clearFailedJobs(168);
        } catch (error) {
          logger.error('Periodic cleanup failed:', error);
        }
      }
    });
    
    // Optimization task every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      if (!isShuttingDown) {
        logger.info('Running periodic queue optimization...');
        try {
          await queueManager.optimizeQueue();
        } catch (error) {
          logger.error('Periodic optimization failed:', error);
        }
      }
    });
    
    console.log('✅ Queue worker started successfully!');
    console.log('📊 Use Ctrl+C to stop gracefully\n');
    
    // Show initial status
    const status = await queueManager.getQueueStatus();
    console.log(`📈 Queue status: ${status.currentSize}/${status.maxSize} jobs (${status.utilizationPercent}% full)`);
    
    // Keep the process alive
    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);
    
  } catch (error) {
    console.error('❌ Failed to start queue worker:', error.message);
    process.exit(1);
  }
}

async function handleShutdown() {
  if (isShuttingDown) return;
  
  isShuttingDown = true;
  console.log('\n🛑 Shutting down queue worker...');
  
  try {
    await queueProcessor.gracefulShutdown();
    await orm.close();
    await db.close();
    console.log('✅ Queue worker stopped gracefully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    await showHelp();
    process.exit(0);
  }
  
  if (args.includes('--status')) {
    await showQueueStatus();
    await orm.close();
    await db.close();
    process.exit(0);
  }
  
  if (args.includes('--health')) {
    await showHealthStatus();
    await orm.close();
    await db.close();
    process.exit(0);
  }
  
  if (args.includes('--optimize')) {
    await optimizeQueue();
    await orm.close();
    await db.close();
    process.exit(0);
  }
  
  const options = {};
  
  const batchSizeIndex = args.indexOf('--batch-size');
  if (batchSizeIndex !== -1 && args[batchSizeIndex + 1]) {
    options.batchSize = parseInt(args[batchSizeIndex + 1]);
    if (isNaN(options.batchSize) || options.batchSize < 1 || options.batchSize > 100) {
      console.error('❌ Batch size must be a number between 1 and 100');
      process.exit(1);
    }
  }
  
  const delayIndex = args.indexOf('--delay');
  if (delayIndex !== -1 && args[delayIndex + 1]) {
    options.delay = parseInt(args[delayIndex + 1]);
    if (isNaN(options.delay) || options.delay < 10 || options.delay > 10000) {
      console.error('❌ Delay must be a number between 10 and 10000ms');
      process.exit(1);
    }
  }
  
  await startWorker(options);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}