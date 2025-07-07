const logger = require('../utils/logger');
const config = require('../config/config');

class QueueProcessor {
  constructor() {
    this.processors = new Map();
    this.isProcessing = false;
    this.enabledProcessors = config.queue.enabledProcessors || ['gmod'];
    this.initializeProcessors();
  }

  initializeProcessors() {
    this.enabledProcessors.forEach(processorType => {
      try {
        const ProcessorClass = this.getProcessorClass(processorType);
        const processor = new ProcessorClass();
        this.processors.set(processorType, processor);
        logger.info(`Initialized ${processorType} processor`);
      } catch (error) {
        logger.error(`Failed to initialize ${processorType} processor:`, error);
      }
    });
  }

  getProcessorClass(processorType) {
    const processorMap = {
      'gmod': require('./processors/QueueProcessorGMod'),
      'gtav': require('./processors/QueueProcessorGTAV')
    };

    const ProcessorClass = processorMap[processorType];
    if (!ProcessorClass) {
      throw new Error(`Unknown processor type: ${processorType}`);
    }

    return ProcessorClass;
  }

  async start() {
    if (this.isProcessing) {
      logger.warn('Queue processor manager is already running');
      return;
    }

    this.isProcessing = true;
    logger.info('Starting all queue processors');
    
    for (const [type, processor] of this.processors) {
      try {
        await processor.start();
        logger.info(`Started ${type} processor`);
      } catch (error) {
        logger.error(`Failed to start ${type} processor:`, error);
      }
    }
  }

  async stop() {
    if (!this.isProcessing) {
      logger.warn('Queue processor manager is not running');
      return;
    }

    this.isProcessing = false;
    logger.info('Stopping all queue processors');
    
    for (const [type, processor] of this.processors) {
      try {
        await processor.stop();
        logger.info(`Stopped ${type} processor`);
      } catch (error) {
        logger.error(`Failed to stop ${type} processor:`, error);
      }
    }
  }

  addProcessor(type, processor) {
    if (!processor) {
      throw new Error('Processor instance is required');
    }
    
    this.processors.set(type, processor);
    logger.info(`Added ${type} processor`);
    
    if (this.isProcessing) {
      processor.start().catch(error => {
        logger.error(`Failed to start ${type} processor:`, error);
      });
    }
  }

  removeProcessor(type) {
    const processor = this.processors.get(type);
    if (!processor) {
      logger.warn(`Processor ${type} not found`);
      return false;
    }
    
    if (this.isProcessing) {
      processor.stop().catch(error => {
        logger.error(`Failed to stop ${type} processor:`, error);
      });
    }
    
    this.processors.delete(type);
    logger.info(`Removed ${type} processor`);
    return true;
  }

  getProcessor(type) {
    return this.processors.get(type);
  }

  getProcessors() {
    return Array.from(this.processors.keys());
  }

  registerEventHandler(processorType, eventType, handler) {
    const processor = this.processors.get(processorType);
    if (!processor) {
      throw new Error(`Processor ${processorType} not found`);
    }
    
    processor.registerEventHandler(eventType, handler);
  }

  unregisterEventHandler(processorType, eventType) {
    const processor = this.processors.get(processorType);
    if (!processor) {
      throw new Error(`Processor ${processorType} not found`);
    }
    
    return processor.unregisterEventHandler(eventType);
  }

  getRegisteredHandlers(processorType) {
    const processor = this.processors.get(processorType);
    if (!processor) {
      return [];
    }
    
    return processor.getRegisteredHandlers();
  }

  async processJobById(jobId, processorType) {
    const processor = this.processors.get(processorType);
    if (!processor) {
      throw new Error(`Processor ${processorType} not found`);
    }
    
    return processor.processJobById(jobId);
  }

  async getProcessorStatus() {
    const status = {
      isProcessing: this.isProcessing,
      enabledProcessors: this.enabledProcessors,
      processors: {}
    };
    
    for (const [type, processor] of this.processors) {
      try {
        status.processors[type] = await processor.getProcessorStatus();
      } catch (error) {
        status.processors[type] = { error: error.message };
      }
    }
    
    return status;
  }

  setBatchSize(size, processorType) {
    if (processorType) {
      const processor = this.processors.get(processorType);
      if (!processor) {
        throw new Error(`Processor ${processorType} not found`);
      }
      processor.setBatchSize(size);
    } else {
      for (const processor of this.processors.values()) {
        processor.setBatchSize(size);
      }
    }
  }

  setProcessingDelay(delay, processorType) {
    if (processorType) {
      const processor = this.processors.get(processorType);
      if (!processor) {
        throw new Error(`Processor ${processorType} not found`);
      }
      processor.setProcessingDelay(delay);
    } else {
      for (const processor of this.processors.values()) {
        processor.setProcessingDelay(delay);
      }
    }
  }

  async gracefulShutdown() {
    logger.info('Initiating graceful shutdown of queue processor manager...');
    
    this.isProcessing = false;
    
    const shutdownPromises = [];
    for (const [type, processor] of this.processors) {
      shutdownPromises.push(
        processor.gracefulShutdown().catch(error => {
          logger.error(`Failed to gracefully shutdown ${type} processor:`, error);
        })
      );
    }
    
    await Promise.all(shutdownPromises);
    logger.info('Queue processor manager shutdown complete');
  }
}

module.exports = new QueueProcessor();