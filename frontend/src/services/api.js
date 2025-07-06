const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Queue API methods
  async getQueueStatus() {
    return this.request('/queue/status');
  }

  async getQueueHealth() {
    return this.request('/queue/health');
  }

  async getQueueStats(hours = 24) {
    return this.request(`/queue/stats?hours=${hours}`);
  }

  async getQueueDistribution() {
    return this.request('/queue/distribution');
  }

  async clearQueue() {
    return this.request('/queue/clear', { method: 'POST' });
  }

  async optimizeQueue() {
    return this.request('/queue/optimize', { method: 'POST' });
  }

  async clearCompletedJobs(olderThanHours = 24) {
    return this.request('/queue/clear-completed', {
      method: 'POST',
      body: { olderThanHours }
    });
  }

  async clearFailedJobs(olderThanHours = 168) {
    return this.request('/queue/clear-failed', {
      method: 'POST',
      body: { olderThanHours }
    });
  }

  async resetStuckJobs(timeoutMinutes = 10) {
    return this.request('/queue/reset-stuck', {
      method: 'POST',
      body: { timeoutMinutes }
    });
  }

  async simulateEvent(eventType, eventData) {
    return this.request(`/queue/simulate/${eventType}`, {
      method: 'POST',
      body: eventData
    });
  }

  // TikTok API methods
  async getTikTokStatus() {
    return this.request('/tiktok/status');
  }

  async getTikTokStats() {
    return this.request('/tiktok/stats');
  }

  async getTikTokEvents(limit = 50) {
    return this.request(`/tiktok/events/recent?limit=${limit}`);
  }

  async getTikTokMetrics(hours = 24) {
    return this.request(`/tiktok/metrics?hours=${hours}`);
  }

  async connectTikTok(username) {
    return this.request('/tiktok/connect', {
      method: 'POST',
      body: { username }
    });
  }

  async disconnectTikTok() {
    return this.request('/tiktok/disconnect', { method: 'POST' });
  }

  async reconnectTikTok() {
    return this.request('/tiktok/reconnect', { method: 'POST' });
  }

  async clearTikTokStats() {
    return this.request('/tiktok/stats/clear', { method: 'POST' });
  }

  // System API methods
  async getSystemOverview() {
    return this.request('/system/overview');
  }

  async getSystemStats(hours = 24) {
    return this.request(`/system/stats?hours=${hours}`);
  }

  async getSystemHealth() {
    return this.request('/system/health');
  }

  async getRecentEvents(limit = 100) {
    return this.request(`/system/events/recent?limit=${limit}`);
  }

  async getMetrics(timeRange = 'day') {
    return this.request(`/system/metrics/${timeRange}`);
  }

  async restartService(service) {
    return this.request(`/system/restart/${service}`, { method: 'POST' });
  }

  async clearSystemStats() {
    return this.request('/system/stats/clear', { method: 'POST' });
  }

  // Configuration API methods
  async getConfig() {
    return this.request('/config');
  }

  async updateConfig(config) {
    return this.request('/config', {
      method: 'POST',
      body: config
    });
  }

  async getQueueConfig() {
    return this.request('/config/queue');
  }

  async updateQueueConfig(config) {
    return this.request('/config/queue', {
      method: 'POST',
      body: config
    });
  }

  async getTikTokConfig() {
    return this.request('/config/tiktok');
  }

  async updateTikTokConfig(config) {
    return this.request('/config/tiktok', {
      method: 'POST',
      body: config
    });
  }

  async getGModConfig() {
    return this.request('/config/gmod');
  }

  async updateGModConfig(config) {
    return this.request('/config/gmod', {
      method: 'POST',
      body: config
    });
  }

  async getFeatureFlags() {
    return this.request('/config/features');
  }

  async updateFeatureFlags(features) {
    return this.request('/config/features', {
      method: 'POST',
      body: features
    });
  }

  async resetConfig() {
    return this.request('/config/reset', { method: 'POST' });
  }
}

export default new ApiService();