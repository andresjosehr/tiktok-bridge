const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');

class MessageComposer {
  constructor(configPath = './gmod-tts-modular.json') {
    this.configPath = configPath;
    this.config = null;
    this.init();
  }

  async init() {
    try {
      await this.loadConfig();
      logger.info('Message composer initialized');
    } catch (error) {
      logger.error('Failed to initialize message composer:', error);
    }
  }

  /**
   * Load configuration from JSON file
   */
  async loadConfig() {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(configData);
      logger.info('Message configuration loaded');
    } catch (error) {
      logger.error('Failed to load message configuration:', error);
      throw error;
    }
  }

  /**
   * Reload configuration (useful for hot-reloading)
   */
  async reloadConfig() {
    await this.loadConfig();
  }

  /**
   * Get random item from array with optional weights
   * @param {Array} items - Array of items to choose from
   * @param {Array} weights - Optional weights for weighted selection
   * @returns {*} - Random item from array
   */
  getRandomItem(items, weights = null) {
    if (!items || items.length === 0) {
      return null;
    }

    if (!weights || weights.length !== items.length) {
      // Simple random selection
      return items[Math.floor(Math.random() * items.length)];
    }

    // Weighted random selection
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return items[i];
      }
    }
    
    return items[items.length - 1];
  }

  /**
   * Select random structure for event type (handles gift-specific logic)
   * @param {string} eventType - The event type (follow, gift, etc.)
   * @param {Object} variables - Variables that may include giftType
   * @returns {Array} - Array representing the structure
   */
  getRandomStructure(eventType, variables = {}) {
    const eventConfig = this.config[eventType];
    if (!eventConfig) {
      return ['username', 'action'];
    }

    // Handle gift-specific logic
    if (eventType === 'gift' && eventConfig.gifts) {
      const giftType = this.getGiftType(variables.giftName || variables.giftId);
      const giftConfig = eventConfig.gifts[giftType] || eventConfig.gifts.default;
      
      if (giftConfig && giftConfig.structures) {
        const structures = giftConfig.structures;
        const weights = giftConfig.weights?.structures || null;
        return this.getRandomItem(structures, weights);
      }
    }

    // Default behavior for non-gift events
    if (!eventConfig.structures) {
      return ['username', 'action'];
    }

    const structures = eventConfig.structures;
    const weights = eventConfig.weights?.structures || null;
    
    return this.getRandomItem(structures, weights);
  }

  /**
   * Get random part for specific type (handles gift-specific logic)
   * @param {string} eventType - The event type
   * @param {string} partType - The part type (opener, action, etc.)
   * @param {Object} variables - Variables that may include giftType
   * @returns {string} - Random part text
   */
  /**
   * Map singular part type to plural (for configuration lookup)
   * @param {string} partType - Singular part type
   * @returns {string} - Plural part type
   */
  getPartTypeKey(partType) {
    const mapping = {
      'opener': 'openers',
      'connector': 'connectors', 
      'action': 'actions',
      'closing': 'closings'
    };
    return mapping[partType] || partType;
  }

  getRandomPart(eventType, partType, variables = {}) {
    const eventConfig = this.config[eventType];
    if (!eventConfig) {
      logger.debug(`No event config found for: ${eventType}`);
      return '';
    }

    // Handle gift-specific logic
    if (eventType === 'gift' && eventConfig.gifts) {
      const giftType = this.getGiftType(variables.giftName || variables.giftId);
      const giftConfig = eventConfig.gifts[giftType] || eventConfig.gifts.default;
      
      // Map singular to plural for lookup
      const partTypeKey = this.getPartTypeKey(partType);
      
      logger.debug(`Gift logic - giftType: ${giftType}, partType: ${partType} -> ${partTypeKey}`);
      logger.debug(`GiftConfig exists: ${!!giftConfig}, has parts: ${!!(giftConfig && giftConfig.parts)}`);
      
      if (giftConfig && giftConfig.parts && giftConfig.parts[partTypeKey]) {
        const parts = giftConfig.parts[partTypeKey];
        logger.debug(`Found ${parts.length} parts for ${partTypeKey}`);
        return this.getRandomItem(parts);
      } else {
        logger.debug(`No parts found for gift ${giftType}, partType ${partTypeKey}`);
        return '';
      }
    }

    // Default behavior for non-gift events - also use plural mapping
    const partTypeKey = this.getPartTypeKey(partType);
    if (!eventConfig.parts || !eventConfig.parts[partTypeKey]) {
      logger.debug(`No parts found for event ${eventType}, partType ${partTypeKey}`);
      return '';
    }

    const parts = eventConfig.parts[partTypeKey];
    return this.getRandomItem(parts);
  }

  /**
   * Map gift names/IDs to gift types
   * @param {string|number} giftIdentifier - Gift name or ID
   * @returns {string} - Gift type (rosa, corazon_coreano, default)
   */
  getGiftType(giftIdentifier) {
    if (!giftIdentifier) return 'default';
    
    const identifier = giftIdentifier.toString().toLowerCase();
    
    // Map TikTok gift names to our categories
    const giftMapping = {
      'rose': 'rosa',
      'rosa': 'rosa',
      'flower': 'rosa',
      'korean heart': 'corazon_coreano',
      'corazon coreano': 'corazon_coreano',
      'corazón coreano': 'corazon_coreano',
      'heart': 'corazon_coreano',
      'korean_heart': 'corazon_coreano',
      'corazon': 'corazon_coreano',
      'kpop': 'corazon_coreano'
    };

    return giftMapping[identifier] || 'default';
  }

  /**
   * Replace placeholders in text
   * @param {string} text - Text with placeholders
   * @param {Object} variables - Variables to replace
   * @returns {string} - Text with replacements
   */
  replacePlaceholders(text, variables) {
    if (!text || !variables) {
      return text;
    }

    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }
    
    return result;
  }

  /**
   * Compose message for specific event
   * @param {string} eventType - The event type
   * @param {Object} variables - Variables for replacement (username, count, etc.)
   * @returns {Object} - Composed message with parts and full text
   */
  composeMessage(eventType, variables = {}) {
    try {
      
      if (!this.config || !this.config[eventType]) {
        return {
          parts: [],
          fullText: '',
          structure: [],
          eventType,
          variables
        };
      }

      const structure = this.getRandomStructure(eventType, variables);
      const parts = [];
      const textParts = [];

      for (const partType of structure) {
 
        let partText = '';
        
        if (partType === 'username') {
          // Username is always dynamic (TTS)
          partText = variables.username || variables.user || 'Usuario';
        } else {
          // Get random part text (with gift-specific logic)
          partText = this.getRandomPart(eventType, partType, variables);
          
          // Replace any placeholders in the part
          partText = this.replacePlaceholders(partText, variables);
          
        }

        if (partText) {
          parts.push({
            type: partType,
            text: partText,
            isDynamic: partType === 'username'
          });
          textParts.push(partText);
        } else {
        }
      }

      const fullText = textParts.join(' ');
      
      return {
        parts,
        fullText,
        structure,
        eventType,
        variables,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        parts: [],
        fullText: '',
        structure: [],
        eventType,
        variables,
        error: error.message
      };
    }
  }

  /**
   * Compose multiple messages (useful for testing)
   * @param {string} eventType - The event type
   * @param {Object} variables - Variables for replacement
   * @param {number} count - Number of messages to generate
   * @returns {Array} - Array of composed messages
   */
  composeMultipleMessages(eventType, variables = {}, count = 5) {
    const messages = [];
    
    for (let i = 0; i < count; i++) {
      messages.push(this.composeMessage(eventType, variables));
    }
    
    return messages;
  }

  /**
   * Get available event types
   * @returns {Array} - Array of event types
   */
  getEventTypes() {
    if (!this.config) {
      return [];
    }

    return Object.keys(this.config).filter(key => 
      key !== 'metadata' && typeof this.config[key] === 'object'
    );
  }

  /**
   * Get statistics about configuration
   * @returns {Object} - Configuration statistics
   */
  getConfigStats() {
    if (!this.config) {
      return {};
    }

    const stats = {
      eventTypes: this.getEventTypes().length,
      totalParts: 0,
      totalStructures: 0,
      eventDetails: {}
    };

    for (const eventType of this.getEventTypes()) {
      const eventConfig = this.config[eventType];
      const partCounts = {};
      let totalEventParts = 0;

      if (eventConfig.parts) {
        for (const [partType, parts] of Object.entries(eventConfig.parts)) {
          partCounts[partType] = parts.length;
          totalEventParts += parts.length;
        }
      }

      stats.eventDetails[eventType] = {
        partTypes: Object.keys(partCounts).length,
        totalParts: totalEventParts,
        structures: eventConfig.structures ? eventConfig.structures.length : 0,
        partCounts
      };

      stats.totalParts += totalEventParts;
      stats.totalStructures += eventConfig.structures ? eventConfig.structures.length : 0;
    }

    return stats;
  }

  /**
   * Validate configuration
   * @returns {Object} - Validation results
   */
  validateConfig() {
    const issues = [];
    const warnings = [];

    if (!this.config) {
      issues.push('Configuration not loaded');
      return { valid: false, issues, warnings };
    }

    for (const eventType of this.getEventTypes()) {
      const eventConfig = this.config[eventType];
      
      if (!eventConfig.parts) {
        issues.push(`Event type '${eventType}' has no parts defined`);
        continue;
      }

      if (!eventConfig.structures) {
        warnings.push(`Event type '${eventType}' has no structures defined`);
        continue;
      }

      // Check that all structure references have corresponding parts
      for (const structure of eventConfig.structures) {
        for (const partType of structure) {
          if (partType !== 'username' && !eventConfig.parts[partType]) {
            issues.push(`Event type '${eventType}' structure references missing part type '${partType}'`);
          }
        }
      }

      // Check weights match structures
      if (eventConfig.weights?.structures) {
        if (eventConfig.weights.structures.length !== eventConfig.structures.length) {
          warnings.push(`Event type '${eventType}' has mismatched structure weights`);
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings
    };
  }
}

module.exports = MessageComposer;