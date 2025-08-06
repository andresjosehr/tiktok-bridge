const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/config');
const orm = require('./database/orm');
const tiktokService = require('./services/tiktok/tiktokService');
// GMod service se carga solo si está habilitado
const queueProcessor = require('./queue/queueProcessor');
const eventManager = require('./services/eventManager');
const logger = require('./utils/logger');

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"]
    }
  }
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets and overlay
app.use('/assets', express.static('public/assets'));
app.use('/overlay', express.static('public'));

// API Routes
const apiRoutes = require('./api/routes');
app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/status', async (req, res) => {
  try {
    const queueStatus = await queueProcessor.getProcessorStatus();
    res.json({
      tiktokConnected: tiktokService.isConnected(),
      activeService: queueStatus.activeServiceType,
      serviceConnected: queueStatus.activeService ? queueStatus.activeService.isConnected : false,
      enabledServices: queueStatus.enabledServices,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
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
    
    // Solo inicializar servicios que están habilitados
    const enabledServices = config.queue.enabledProcessors || ['gmod'];
    logger.info(`Enabled services: ${enabledServices.join(', ')}`);
    
    // Los servicios específicos se inicializan ahora en queueProcessor
    logger.info('Starting queue processor...');
    await queueProcessor.start();
    
    const server = app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(async () => {
        await tiktokService.disconnect();
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