const path = require('path');
const fs = require('fs').promises;
const logger = require('../../../utils/logger');
// ttsService will be injected via constructor to avoid circular dependency
const TTSCache = require('./ttsCache');
const MessageComposer = require('./messageComposer');

class ModularTTSService {
  constructor(options = {}) {
    // Inject ttsService to avoid circular dependency
    this.ttsService = options.ttsService;
    if (!this.ttsService) {
      throw new Error('ttsService must be provided via options.ttsService');
    }
    this.ttsCache = new TTSCache(options.cacheDirectory || './audio_cache');
    this.messageComposer = new MessageComposer(
      options.configPath || path.join(__dirname, 'gmod-tts-modular.json')
    );
    
    this.options = {
      enableCache: options.enableCache !== false,
      onlyUsernamesInTTS: options.onlyUsernamesInTTS !== false,
      audioFormat: options.audioFormat || 'wav',
      tempDirectory: options.tempDirectory || './temp_audio',
      maxConcurrentTTS: options.maxConcurrentTTS || 3,
      ...options
    };

    this.ttsQueue = [];
    this.currentTTSJobs = 0;
    
    this.init();
  }

  async init() {
    try {
      // Ensure temp directory exists
      await fs.mkdir(this.options.tempDirectory, { recursive: true });
      
      // Initialize components
      await this.ttsCache.init();
      await this.messageComposer.init();
      
      logger.info('Modular TTS Service initialized');
    } catch (error) {
      logger.error('Failed to initialize Modular TTS Service:', error);
    }
  }

  /**
   * Generate TTS audio for a specific text
   * @param {string} text - Text to convert to speech
   * @param {string} type - Type of audio (username or part)
   * @returns {Buffer} - Audio buffer
   */
  async generateTTSAudio(text, type = 'part') {
    try {
      // Check cache first
      if (this.options.enableCache) {
        const cachedPath = await this.ttsCache.getCachedAudio(text, type);
        if (cachedPath) {
          logger.debug(`Using cached audio for: ${text}`);
          return await fs.readFile(cachedPath);
        }
      }

      // Generate new audio
      logger.debug(`Generating TTS for: ${text}`);
      const audioResult = await this.ttsService.generateSpeech(text);
      
      // Cache the audio
      if (this.options.enableCache) {
        await this.ttsCache.saveAudio(text, audioResult.audioBuffer, type);
      }
      
      return audioResult.audioBuffer;
    } catch (error) {
      logger.error(`Failed to generate TTS for "${text}":`, error);
      throw error;
    }
  }

  /**
   * Generate audio for a message part
   * @param {Object} part - Message part object
   * @returns {Buffer|null} - Audio buffer or null if cached
   */
  async generatePartAudio(part) {
    if (part.isDynamic) {
      // Always generate TTS for dynamic parts (usernames)
      return await this.generateTTSAudio(part.text, 'username');
    } else {
      // Check if static part is cached
      if (this.options.enableCache) {
        const cachedPath = await this.ttsCache.getCachedAudio(part.text, 'part');
        if (cachedPath) {
          return await fs.readFile(cachedPath);
        }
      }
      
      // Generate and cache static part
      return await this.generateTTSAudio(part.text, 'part');
    }
  }

  /**
   * Create composed message for event
   * @param {string} eventType - Type of event (follow, gift, etc.)
   * @param {Object} variables - Variables for message composition
   * @returns {Object} - Composed message with audio paths
   */
  async composeMessage(eventType, variables = {}) {
    try {
      const message = this.messageComposer.composeMessage(eventType, variables);
      
      if (!message.parts || message.parts.length === 0) {
        throw new Error(`No message parts generated for event type: ${eventType}`);
      }

      return message;
    } catch (error) {
      logger.error(`Failed to compose message for ${eventType}:`, error);
      throw error;
    }
  }

  /**
   * Generate complete audio for a message
   * @param {string} eventType - Type of event
   * @param {Object} variables - Variables for message composition
   * @returns {Object} - Audio information and paths
   */
  async generateMessageAudio(eventType, variables = {}) {
    try {
      logger.debug(`Generating audio for event: ${eventType}`);
      logger.debug(`Variables:`, variables);
      
      const message = await this.composeMessage(eventType, variables);
      
      logger.debug(`Composed message:`, {
        fullText: message.fullText,
        structure: message.structure,
        partsCount: message.parts.length,
        onlyUsernamesInTTS: this.options.onlyUsernamesInTTS
      });
      
      // Log each part details
      message.parts.forEach((part, index) => {
        logger.debug(`Part ${index + 1}:`, {
          type: part.type,
          text: part.text,
          isDynamic: part.isDynamic,
          length: part.text.length
        });
      });
      
      if (this.options.onlyUsernamesInTTS) {
        logger.debug(`Using modular mode (only usernames in TTS)`);
        
        // Only generate TTS for usernames, return audio paths for parts
        const audioInfo = {
          message,
          audioFiles: [],
          dynamicAudio: null,
          staticAudioPaths: [],
          fullAudioPath: null,
          combinedAudioPath: null
        };

        // Process each part
        for (const part of message.parts) {
          logger.debug(`Processing part: ${part.type} - "${part.text}"`);
          
          if (part.isDynamic) {
            logger.debug(`Generating TTS for dynamic part (username): "${part.text}"`);
            
            // Generate TTS for username
            const audioBuffer = await this.generatePartAudio(part);
            const tempPath = path.join(
              this.options.tempDirectory, 
              `username_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${this.options.audioFormat}`
            );
            await fs.writeFile(tempPath, audioBuffer);
            audioInfo.dynamicAudio = tempPath;
            audioInfo.audioFiles.push({ part, audioPath: tempPath, isDynamic: true });
            
            logger.debug(`Generated dynamic audio: ${tempPath}`);
          } else {
            logger.debug(`Processing static part: "${part.text}"`);
            
            // Get cached path for static part
            const cachedPath = await this.ttsCache.getCachedAudio(part.text, 'part');
            if (cachedPath) {
              logger.debug(`Using cached audio for: "${part.text}" -> ${cachedPath}`);
              audioInfo.staticAudioPaths.push(cachedPath);
              audioInfo.audioFiles.push({ part, audioPath: cachedPath, isDynamic: false });
            } else {
              logger.debug(`Generating new audio for: "${part.text}"`);
              
              // Generate and cache static part
              const audioBuffer = await this.generatePartAudio(part);
              const cachedPath = await this.ttsCache.saveAudio(part.text, audioBuffer, 'part');
              audioInfo.staticAudioPaths.push(cachedPath);
              audioInfo.audioFiles.push({ part, audioPath: cachedPath, isDynamic: false });
              
              logger.debug(`Generated and cached: ${cachedPath}`);
            }
          }
        }

        // Combine all audio files into one
        if (audioInfo.audioFiles.length > 1) {
          logger.debug(`Combining ${audioInfo.audioFiles.length} audio files`);
          
          try {
            const combinedPath = await this.combineAudioFiles(audioInfo.audioFiles);
            audioInfo.combinedAudioPath = combinedPath;
            audioInfo.fullAudioPath = combinedPath;
            
            logger.debug(`Successfully combined audio: ${combinedPath}`);
          } catch (error) {
            logger.error(`Failed to combine audio files:`, error);
            // Fallback to dynamic audio only
            audioInfo.fullAudioPath = audioInfo.dynamicAudio;
          }
        } else if (audioInfo.audioFiles.length === 1) {
          logger.debug(`Only one audio file, using it directly`);
          audioInfo.fullAudioPath = audioInfo.audioFiles[0].audioPath;
        }

        logger.debug(`Final audio info:`, {
          totalFiles: audioInfo.audioFiles.length,
          dynamicAudio: audioInfo.dynamicAudio,
          staticAudioPaths: audioInfo.staticAudioPaths.length,
          combinedAudioPath: audioInfo.combinedAudioPath,
          fullAudioPath: audioInfo.fullAudioPath
        });

        return audioInfo;
      } else {
        logger.debug(`Using complete message mode`);
        
        // Generate TTS for complete message
        const audioBuffer = await this.generateTTSAudio(message.fullText, 'complete');
        const tempPath = path.join(
          this.options.tempDirectory, 
          `message_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${this.options.audioFormat}`
        );
        await fs.writeFile(tempPath, audioBuffer);
        
        logger.debug(`Generated complete message audio: ${tempPath}`);
        
        return {
          message,
          audioFiles: [{ part: { text: message.fullText, isDynamic: false }, audioPath: tempPath, isDynamic: false }],
          fullAudioPath: tempPath
        };
      }
    } catch (error) {
      logger.error(`Failed to generate message audio for ${eventType}:`, error);
      throw error;
    }
  }

  /**
   * Combine multiple audio files into one
   * @param {Array} audioFiles - Array of audio file objects with audioPath
   * @returns {string} - Path to combined audio file
   */
  async combineAudioFiles(audioFiles) {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    try {
      logger.debug(`Starting audio combination for ${audioFiles.length} files`);
      
      // Create a file list for ffmpeg with absolute paths
      const fileListPath = path.join(this.options.tempDirectory, `filelist_${Date.now()}.txt`);
      const fileListContent = audioFiles.map(file => {
        const absolutePath = path.isAbsolute(file.audioPath) ? file.audioPath : path.resolve(file.audioPath);
        return `file '${absolutePath}'`;
      }).join('\n');
      await fs.writeFile(fileListPath, fileListContent);
      
      logger.debug(`Created file list: ${fileListPath}`);
      logger.debug(`File list content:`, fileListContent);
      
      // Generate output path
      const outputPath = path.join(
        this.options.tempDirectory, 
        `combined_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${this.options.audioFormat}`
      );
      
      // Use ffmpeg to concatenate audio files
      const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy "${outputPath}"`;
      
      logger.debug(`Executing ffmpeg command: ${ffmpegCommand}`);
      
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      
      if (stderr) {
        logger.debug(`FFmpeg stderr:`, stderr);
      }
      
      // Clean up file list
      await fs.unlink(fileListPath);
      
      logger.debug(`Successfully combined audio: ${outputPath}`);
      
      return outputPath;
    } catch (error) {
      logger.error(`Failed to combine audio files:`, error);
      throw error;
    }
  }

  /**
   * Pre-generate and cache common message parts
   * @param {string} eventType - Optional event type to pre-generate
   * @returns {Object} - Pre-generation statistics
   */
  async preGenerateAudioParts(eventType = null) {
    const stats = {
      generated: 0,
      cached: 0,
      failed: 0,
      eventTypes: []
    };

    try {
      const eventTypes = eventType ? [eventType] : this.messageComposer.getEventTypes();
      
      for (const type of eventTypes) {
        logger.info(`Pre-generating audio parts for event type: ${type}`);
        stats.eventTypes.push(type);
        
        const eventConfig = this.messageComposer.config[type];
        if (!eventConfig || !eventConfig.parts) {
          continue;
        }

        // Pre-generate all static parts
        for (const [partType, parts] of Object.entries(eventConfig.parts)) {
          for (const partText of parts) {
            try {
              const exists = await this.ttsCache.exists(partText, 'part');
              if (!exists) {
                await this.generateTTSAudio(partText, 'part');
                stats.generated++;
                logger.debug(`Generated audio for part: ${partText}`);
              } else {
                stats.cached++;
              }
            } catch (error) {
              logger.error(`Failed to generate audio for part "${partText}":`, error);
              stats.failed++;
            }
          }
        }
      }

      logger.info(`Pre-generation complete:`, stats);
      return stats;
    } catch (error) {
      logger.error('Failed to pre-generate audio parts:', error);
      throw error;
    }
  }

  /**
   * Clean up temporary audio files
   * @param {number} olderThanMinutes - Clean files older than X minutes
   */
  async cleanupTempFiles(olderThanMinutes = 60) {
    try {
      const files = await fs.readdir(this.options.tempDirectory);
      const now = Date.now();
      const threshold = olderThanMinutes * 60 * 1000;
      
      let cleaned = 0;
      for (const file of files) {
        const filePath = path.join(this.options.tempDirectory, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > threshold) {
          await fs.unlink(filePath);
          cleaned++;
        }
      }
      
      logger.info(`Cleaned up ${cleaned} temporary audio files`);
      return cleaned;
    } catch (error) {
      logger.error('Failed to cleanup temporary files:', error);
      return 0;
    }
  }

  /**
   * Get service statistics
   * @returns {Object} - Service statistics
   */
  async getStats() {
    try {
      const [cacheStats, configStats] = await Promise.all([
        this.ttsCache.getStats(),
        Promise.resolve(this.messageComposer.getConfigStats())
      ]);

      return {
        cache: cacheStats,
        config: configStats,
        options: this.options,
        ttsQueue: this.ttsQueue.length,
        currentTTSJobs: this.currentTTSJobs
      };
    } catch (error) {
      logger.error('Failed to get service stats:', error);
      return {};
    }
  }

  /**
   * Validate service configuration
   * @returns {Object} - Validation results
   */
  async validateConfiguration() {
    try {
      const messageValidation = this.messageComposer.validateConfig();
      const ttsValidation = await this.ttsService.validateConfiguration();
      
      return {
        messageComposer: messageValidation,
        ttsService: ttsValidation,
        overall: messageValidation.valid && ttsValidation.valid
      };
    } catch (error) {
      logger.error('Failed to validate configuration:', error);
      return {
        messageComposer: { valid: false, issues: ['Failed to validate'], warnings: [] },
        ttsService: { valid: false, issues: ['Failed to validate'], warnings: [] },
        overall: false
      };
    }
  }

  /**
   * Reload configuration
   */
  async reloadConfiguration() {
    try {
      await this.messageComposer.reloadConfig();
      logger.info('Configuration reloaded');
    } catch (error) {
      logger.error('Failed to reload configuration:', error);
      throw error;
    }
  }
}

module.exports = ModularTTSService;