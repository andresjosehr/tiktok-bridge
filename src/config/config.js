require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  tiktok: {
    username: process.env.TIKTOK_USERNAME || '',
    sessionId: process.env.TIKTOK_SESSION_ID || '',
    maxReconnectAttempts: parseInt(process.env.TIKTOK_MAX_RECONNECT_ATTEMPTS) || 5,
    reconnectDelay: parseInt(process.env.TIKTOK_RECONNECT_DELAY) || 5000
  },

  gmod: {
    host: process.env.GMOD_HOST || 'localhost',
    rconPort: parseInt(process.env.GMOD_RCON_PORT) || 27015,
    rconPassword: process.env.GMOD_RCON_PASSWORD || 'Paralelepipe2',
    wsPort: parseInt(process.env.GMOD_WS_PORT) || 27015,
    httpPort: parseInt(process.env.GMOD_HTTP_PORT) || 27016,
    reconnectInterval: parseInt(process.env.GMOD_RECONNECT_INTERVAL) || 30000,
    enabled: process.env.GMOD_ENABLED !== 'false',
    maxReconnectAttempts: parseInt(process.env.GMOD_MAX_RECONNECT_ATTEMPTS) || 5
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'garrys_tiktok',
    port: parseInt(process.env.DB_PORT) || 3306,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    ssl: process.env.DB_SSL === 'true' ? {} : false
  },

  queue: {
    enabled: process.env.QUEUE_ENABLED !== 'false',
    maxSize: parseInt(process.env.QUEUE_MAX_SIZE) || 1000,
    batchSize: parseInt(process.env.QUEUE_BATCH_SIZE) || 1,
    processingDelay: parseInt(process.env.QUEUE_PROCESSING_DELAY) || 100,
    maxAttempts: parseInt(process.env.QUEUE_MAX_ATTEMPTS) || 3,
    maxRetryDelay: parseInt(process.env.QUEUE_MAX_RETRY_DELAY) || 300,
    autoStart: process.env.QUEUE_AUTO_START !== 'false',
    cleanupInterval: parseInt(process.env.QUEUE_CLEANUP_INTERVAL) || 3600000,
    optimizationInterval: parseInt(process.env.QUEUE_OPTIMIZATION_INTERVAL) || 1800000
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
  },

  ai: {
    enabled: process.env.AI_ENABLED === 'true',
    defaultProvider: process.env.AI_DEFAULT_PROVIDER || 'openai',
    
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 150,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
      systemPrompt: process.env.OPENAI_SYSTEM_PROMPT || 'You are a helpful assistant for a TikTok live stream.'
    },

    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
      maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS) || 150
    },

    google: {
      apiKey: process.env.GOOGLE_AI_API_KEY,
      model: process.env.GOOGLE_AI_MODEL || 'gemini-pro',
      maxTokens: parseInt(process.env.GOOGLE_AI_MAX_TOKENS) || 150,
      temperature: parseFloat(process.env.GOOGLE_AI_TEMPERATURE) || 0.7
    },

    local: {
      endpoint: process.env.LOCAL_AI_ENDPOINT,
      apiKey: process.env.LOCAL_AI_API_KEY,
      model: process.env.LOCAL_AI_MODEL || 'llama2',
      maxTokens: parseInt(process.env.LOCAL_AI_MAX_TOKENS) || 150,
      temperature: parseFloat(process.env.LOCAL_AI_TEMPERATURE) || 0.7
    }
  },

  tts: {
    enabled: process.env.TTS_ENABLED === 'true',
    defaultProvider: process.env.TTS_DEFAULT_PROVIDER || 'elevenlabs',
    
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY,
      defaultVoiceId: process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
      stability: parseFloat(process.env.ELEVENLABS_STABILITY) || 0.5,
      similarityBoost: parseFloat(process.env.ELEVENLABS_SIMILARITY_BOOST) || 0.5
    },

    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      voice: process.env.OPENAI_TTS_VOICE || 'alloy',
      model: process.env.OPENAI_TTS_MODEL || 'tts-1'
    },

    azure: {
      apiKey: process.env.AZURE_TTS_API_KEY,
      region: process.env.AZURE_TTS_REGION,
      voice: process.env.AZURE_TTS_VOICE || 'en-US-JennyNeural',
      language: process.env.AZURE_TTS_LANGUAGE || 'en-US'
    },

    google: {
      apiKey: process.env.GOOGLE_TTS_API_KEY,
      languageCode: process.env.GOOGLE_TTS_LANGUAGE_CODE || 'en-US',
      voiceName: process.env.GOOGLE_TTS_VOICE_NAME || 'en-US-Standard-D',
      audioEncoding: process.env.GOOGLE_TTS_AUDIO_ENCODING || 'MP3'
    }
  },

  webhooks: {
    enabled: process.env.WEBHOOKS_ENABLED === 'true',
    retryAttempts: parseInt(process.env.WEBHOOKS_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.WEBHOOKS_RETRY_DELAY) || 1000,
    timeout: parseInt(process.env.WEBHOOKS_TIMEOUT) || 5000,
    
    endpoints: {
      discord: {
        url: process.env.DISCORD_WEBHOOK_URL,
        enabled: process.env.DISCORD_WEBHOOK_ENABLED === 'true',
        events: ['tiktok:chat', 'tiktok:gift', 'tiktok:follow'],
        secret: process.env.DISCORD_WEBHOOK_SECRET
      },
      
      custom: {
        url: process.env.CUSTOM_WEBHOOK_URL,
        enabled: process.env.CUSTOM_WEBHOOK_ENABLED === 'true',
        events: ['*'],
        secret: process.env.CUSTOM_WEBHOOK_SECRET,
        headers: {
          'X-Custom-Header': process.env.CUSTOM_WEBHOOK_HEADER
        }
      }
    }
  },

  features: {
    aiChatResponses: process.env.FEATURE_AI_CHAT_RESPONSES === 'true',
    ttsAnnouncements: process.env.FEATURE_TTS_ANNOUNCEMENTS === 'true',
    contentModeration: process.env.FEATURE_CONTENT_MODERATION === 'true',
    giftNotifications: process.env.FEATURE_GIFT_NOTIFICATIONS === 'true',
    viewerCountUpdates: process.env.FEATURE_VIEWER_COUNT_UPDATES === 'true',
    webhookIntegrations: process.env.FEATURE_WEBHOOK_INTEGRATIONS === 'true'
  },

  security: {
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    enableHelmet: process.env.ENABLE_HELMET !== 'false'
  }
};