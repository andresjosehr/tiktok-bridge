const axios = require('axios');
const logger = require('../../utils/logger');
const config = require('../../config/config');

class WebhookService {
  constructor() {
    this.webhooks = new Map();
    this.retryAttempts = config.webhooks?.retryAttempts || 3;
    this.retryDelay = config.webhooks?.retryDelay || 1000;
    this.timeout = config.webhooks?.timeout || 5000;
    this.loadWebhooks();
  }

  loadWebhooks() {
    if (config.webhooks?.endpoints) {
      for (const [name, webhook] of Object.entries(config.webhooks.endpoints)) {
        this.registerWebhook(name, webhook);
      }
    }
  }

  registerWebhook(name, webhook) {
    if (!name || !webhook.url) {
      throw new Error('Webhook name and URL are required');
    }

    this.webhooks.set(name, {
      url: webhook.url,
      method: webhook.method || 'POST',
      headers: webhook.headers || {},
      events: webhook.events || ['*'],
      enabled: webhook.enabled !== false,
      secret: webhook.secret,
      retryAttempts: webhook.retryAttempts || this.retryAttempts,
      retryDelay: webhook.retryDelay || this.retryDelay,
      timeout: webhook.timeout || this.timeout
    });

    logger.info(`Webhook registered: ${name} -> ${webhook.url}`);
  }

  unregisterWebhook(name) {
    if (this.webhooks.has(name)) {
      this.webhooks.delete(name);
      logger.info(`Webhook unregistered: ${name}`);
      return true;
    }
    return false;
  }

  async sendWebhook(eventType, data, webhookName = null) {
    const webhooksToSend = webhookName 
      ? [this.webhooks.get(webhookName)].filter(Boolean)
      : Array.from(this.webhooks.values());

    const results = [];

    for (const webhook of webhooksToSend) {
      if (!webhook.enabled) {
        continue;
      }

      if (!this.shouldSendToWebhook(webhook, eventType)) {
        continue;
      }

      try {
        const result = await this.sendSingleWebhook(webhook, eventType, data);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to send webhook ${webhookName || 'unknown'}:`, error);
        results.push({
          success: false,
          error: error.message,
          webhook: webhookName || 'unknown'
        });
      }
    }

    return results;
  }

  shouldSendToWebhook(webhook, eventType) {
    return webhook.events.includes('*') || webhook.events.includes(eventType);
  }

  async sendSingleWebhook(webhook, eventType, data, attempt = 1) {
    const payload = {
      event: eventType,
      data: data,
      timestamp: new Date().toISOString(),
      source: 'garrys-tiktok'
    };

    if (webhook.secret) {
      payload.signature = this.generateSignature(payload, webhook.secret);
    }

    try {
      const response = await axios({
        method: webhook.method,
        url: webhook.url,
        data: payload,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'garrys-tiktok-webhook/1.0',
          ...webhook.headers
        },
        timeout: webhook.timeout
      });

      logger.debug(`Webhook sent successfully: ${webhook.url} (${response.status})`);
      
      return {
        success: true,
        status: response.status,
        webhook: webhook.url,
        attempt: attempt
      };

    } catch (error) {
      logger.warn(`Webhook attempt ${attempt} failed: ${webhook.url}`, error.message);

      if (attempt < webhook.retryAttempts) {
        await this.delay(webhook.retryDelay * attempt);
        return this.sendSingleWebhook(webhook, eventType, data, attempt + 1);
      }

      throw error;
    }
  }

  generateSignature(payload, secret) {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async sendTikTokEvent(eventType, data) {
    return this.sendWebhook(`tiktok:${eventType}`, data);
  }

  async sendGModEvent(eventType, data) {
    return this.sendWebhook(`gmod:${eventType}`, data);
  }

  async sendCustomEvent(eventType, data) {
    return this.sendWebhook(`custom:${eventType}`, data);
  }

  async testWebhook(webhookName) {
    const webhook = this.webhooks.get(webhookName);
    if (!webhook) {
      throw new Error(`Webhook '${webhookName}' not found`);
    }

    const testData = {
      test: true,
      message: 'This is a test webhook from garrys-tiktok',
      timestamp: new Date().toISOString()
    };

    try {
      const result = await this.sendSingleWebhook(webhook, 'test', testData);
      logger.info(`Webhook test successful: ${webhookName}`);
      return result;
    } catch (error) {
      logger.error(`Webhook test failed: ${webhookName}`, error);
      throw error;
    }
  }

  async testAllWebhooks() {
    const results = [];
    
    for (const [name, webhook] of this.webhooks) {
      if (!webhook.enabled) {
        continue;
      }

      try {
        const result = await this.testWebhook(name);
        results.push({ name, success: true, result });
      } catch (error) {
        results.push({ name, success: false, error: error.message });
      }
    }

    return results;
  }

  getWebhookStats() {
    const stats = {};
    
    for (const [name, webhook] of this.webhooks) {
      stats[name] = {
        url: webhook.url,
        method: webhook.method,
        enabled: webhook.enabled,
        events: webhook.events,
        retryAttempts: webhook.retryAttempts,
        timeout: webhook.timeout
      };
    }

    return stats;
  }

  getRegisteredWebhooks() {
    return Array.from(this.webhooks.keys());
  }

  enableWebhook(name) {
    const webhook = this.webhooks.get(name);
    if (webhook) {
      webhook.enabled = true;
      logger.info(`Webhook enabled: ${name}`);
      return true;
    }
    return false;
  }

  disableWebhook(name) {
    const webhook = this.webhooks.get(name);
    if (webhook) {
      webhook.enabled = false;
      logger.info(`Webhook disabled: ${name}`);
      return true;
    }
    return false;
  }

  updateWebhookEvents(name, events) {
    const webhook = this.webhooks.get(name);
    if (webhook) {
      webhook.events = Array.isArray(events) ? events : [events];
      logger.info(`Webhook events updated: ${name} -> ${webhook.events.join(', ')}`);
      return true;
    }
    return false;
  }
}

module.exports = new WebhookService();