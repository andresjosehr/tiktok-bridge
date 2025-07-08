const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('../../utils/logger');

class AudioCache {
  constructor(cacheDirectory = './audio_cache') {
    this.cacheDirectory = cacheDirectory;
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.cacheDirectory, { recursive: true });
      
      // Create subdirectories for different types of audio
      await fs.mkdir(path.join(this.cacheDirectory, 'parts'), { recursive: true });
      await fs.mkdir(path.join(this.cacheDirectory, 'usernames'), { recursive: true });
      
      logger.info(`Audio cache initialized at: ${this.cacheDirectory}`);
    } catch (error) {
      logger.error('Failed to initialize audio cache:', error);
    }
  }

  /**
   * Generate a unique hash for audio content
   * @param {string} text - The text to hash
   * @param {string} type - The type of audio (part or username)
   * @returns {string} - The hash
   */
  generateHash(text, type = 'part') {
    return crypto.createHash('sha256')
      .update(`${type}_${text.toLowerCase().trim()}`)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Get the file path for cached audio
   * @param {string} text - The text content
   * @param {string} type - The type of audio (part or username)
   * @returns {string} - The file path
   */
  getAudioPath(text, type = 'part') {
    const hash = this.generateHash(text, type);
    const subdir = type === 'username' ? 'usernames' : 'parts';
    return path.join(this.cacheDirectory, subdir, `${hash}.wav`);
  }

  /**
   * Check if audio file exists in cache
   * @param {string} text - The text content
   * @param {string} type - The type of audio (part or username)
   * @returns {boolean} - Whether the file exists
   */
  async exists(text, type = 'part') {
    const audioPath = this.getAudioPath(text, type);
    try {
      await fs.access(audioPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get cached audio file path if it exists
   * @param {string} text - The text content
   * @param {string} type - The type of audio (part or username)
   * @returns {string|null} - The file path or null if not cached
   */
  async getCachedAudio(text, type = 'part') {
    const audioPath = this.getAudioPath(text, type);
    const exists = await this.exists(text, type);
    return exists ? audioPath : null;
  }

  /**
   * Save audio buffer to cache
   * @param {string} text - The text content
   * @param {Buffer} audioBuffer - The audio data
   * @param {string} type - The type of audio (part or username)
   * @returns {string} - The saved file path
   */
  async saveAudio(text, audioBuffer, type = 'part') {
    const audioPath = this.getAudioPath(text, type);
    
    try {
      await fs.writeFile(audioPath, audioBuffer);
      logger.info(`Audio cached: ${text} -> ${audioPath}`);
      return audioPath;
    } catch (error) {
      logger.error(`Failed to cache audio for "${text}":`, error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  async getStats() {
    try {
      const partsDir = path.join(this.cacheDirectory, 'parts');
      const usernamesDir = path.join(this.cacheDirectory, 'usernames');
      
      const [partFiles, usernameFiles] = await Promise.all([
        fs.readdir(partsDir).catch(() => []),
        fs.readdir(usernamesDir).catch(() => [])
      ]);

      const partStats = await Promise.all(
        partFiles.map(async (file) => {
          const filePath = path.join(partsDir, file);
          const stats = await fs.stat(filePath);
          return stats.size;
        })
      );

      const usernameStats = await Promise.all(
        usernameFiles.map(async (file) => {
          const filePath = path.join(usernamesDir, file);
          const stats = await fs.stat(filePath);
          return stats.size;
        })
      );

      const totalPartsSize = partStats.reduce((sum, size) => sum + size, 0);
      const totalUsernamesSize = usernameStats.reduce((sum, size) => sum + size, 0);

      return {
        parts: {
          count: partFiles.length,
          totalSize: totalPartsSize,
          averageSize: partFiles.length > 0 ? Math.round(totalPartsSize / partFiles.length) : 0
        },
        usernames: {
          count: usernameFiles.length,
          totalSize: totalUsernamesSize,
          averageSize: usernameFiles.length > 0 ? Math.round(totalUsernamesSize / usernameFiles.length) : 0
        },
        total: {
          count: partFiles.length + usernameFiles.length,
          totalSize: totalPartsSize + totalUsernamesSize
        }
      };
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      return {
        parts: { count: 0, totalSize: 0, averageSize: 0 },
        usernames: { count: 0, totalSize: 0, averageSize: 0 },
        total: { count: 0, totalSize: 0 }
      };
    }
  }

  /**
   * Clear cache (optionally by type)
   * @param {string} type - Optional type to clear (part or username)
   */
  async clearCache(type = null) {
    try {
      if (type) {
        const subdir = type === 'username' ? 'usernames' : 'parts';
        const dirPath = path.join(this.cacheDirectory, subdir);
        const files = await fs.readdir(dirPath);
        
        await Promise.all(
          files.map(file => fs.unlink(path.join(dirPath, file)))
        );
        
        logger.info(`Cleared ${type} cache: ${files.length} files removed`);
      } else {
        // Clear all cache
        await fs.rmdir(this.cacheDirectory, { recursive: true });
        await this.init();
        logger.info('Cleared all audio cache');
      }
    } catch (error) {
      logger.error('Failed to clear cache:', error);
    }
  }
}

module.exports = AudioCache;