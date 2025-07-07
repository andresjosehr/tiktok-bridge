const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/config');
const orm = require('./database/orm');
const tiktokService = require('./services/tiktok/tiktokService');
const gmodService = require('./services/gmod/gmodService');
const queueProcessor = require('./queue/queueProcessor');
const eventManager = require('./services/eventManager');
const logger = require('./utils/logger');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
const apiRoutes = require('./api/routes');
app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/status', (req, res) => {
  res.json({
    tiktokConnected: tiktokService.isConnected(),
    gmodConnected: gmodService.isConnected(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

const startServer = async () => {
  try {
    logger.info('Initializing ORM...');
    await orm.initialize();
    
    // Clear any existing events in the queue on startup
    logger.info('Clearing event queue on startup...');
    const EventQueue = orm.getModel('EventQueue');
    const clearedCount = await EventQueue.destroy({
      where: {}
    });
    logger.info(`Cleared ${clearedCount} events from queue`);
    
    logger.info('Initializing TikTok service...');
    await tiktokService.initialize();
    
    logger.info('Initializing GMod service...');
    await gmodService.initialize();
    
    // Always start the queue processor after all services are initialized
    logger.info('Starting queue processor...');
    await queueProcessor.start();
    
    const server = app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(async () => {
        await tiktokService.disconnect();
        await gmodService.disconnect();
        await queueProcessor.gracefulShutdown();
        await orm.close();
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;