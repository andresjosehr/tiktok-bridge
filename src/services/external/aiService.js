const axios = require('axios');
const logger = require('../../utils/logger');
const config = require('../../config/config');

class AIService {
  constructor() {
    this.providers = {
      openai: this.openAIChat.bind(this),
      anthropic: this.anthropicChat.bind(this),
      google: this.googleChat.bind(this),
      local: this.localChat.bind(this)
    };
    this.defaultProvider = config.ai?.defaultProvider || 'openai';
  }

  async generateResponse(prompt, options = {}) {
    const provider = options.provider || this.defaultProvider;
    
    if (!this.providers[provider]) {
      throw new Error(`AI provider '${provider}' not supported`);
    }

    try {
      logger.debug(`Generating AI response with ${provider}`);
      const result = await this.providers[provider](prompt, options);
      logger.debug(`AI response generated successfully with ${provider}`);
      return result;
    } catch (error) {
      logger.error(`AI generation failed with ${provider}:`, error);
      throw error;
    }
  }

  async openAIChat(prompt, options = {}) {
    if (!config.ai?.openai?.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const model = options.model || config.ai.openai.model || 'gpt-3.5-turbo';
    const maxTokens = options.maxTokens || config.ai.openai.maxTokens || 150;
    const temperature = options.temperature || config.ai.openai.temperature || 0.7;

    const messages = [
      {
        role: 'system',
        content: options.systemPrompt || config.ai.openai.systemPrompt || 'You are a helpful assistant for a TikTok live stream.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: model,
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature
      },
      {
        headers: {
          'Authorization': `Bearer ${config.ai.openai.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      response: response.data.choices[0].message.content,
      provider: 'openai',
      model: model,
      tokensUsed: response.data.usage.total_tokens
    };
  }

  async anthropicChat(prompt, options = {}) {
    if (!config.ai?.anthropic?.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const model = options.model || config.ai.anthropic.model || 'claude-3-haiku-20240307';
    const maxTokens = options.maxTokens || config.ai.anthropic.maxTokens || 150;

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: model,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'x-api-key': config.ai.anthropic.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      response: response.data.content[0].text,
      provider: 'anthropic',
      model: model,
      tokensUsed: response.data.usage.input_tokens + response.data.usage.output_tokens
    };
  }

  async googleChat(prompt, options = {}) {
    if (!config.ai?.google?.apiKey) {
      throw new Error('Google AI API key not configured');
    }

    const model = options.model || config.ai.google.model || 'gemini-pro';
    const maxTokens = options.maxTokens || config.ai.google.maxTokens || 150;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${config.ai.google.apiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: options.temperature || config.ai.google.temperature || 0.7
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      response: response.data.candidates[0].content.parts[0].text,
      provider: 'google',
      model: model,
      tokensUsed: response.data.usageMetadata?.totalTokenCount || 0
    };
  }

  async localChat(prompt, options = {}) {
    if (!config.ai?.local?.endpoint) {
      throw new Error('Local AI endpoint not configured');
    }

    const endpoint = config.ai.local.endpoint;
    const model = options.model || config.ai.local.model || 'llama2';
    const maxTokens = options.maxTokens || config.ai.local.maxTokens || 150;

    const response = await axios.post(
      `${endpoint}/v1/chat/completions`,
      {
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: options.temperature || config.ai.local.temperature || 0.7
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(config.ai.local.apiKey && { 'Authorization': `Bearer ${config.ai.local.apiKey}` })
        }
      }
    );

    return {
      response: response.data.choices[0].message.content,
      provider: 'local',
      model: model,
      tokensUsed: response.data.usage?.total_tokens || 0
    };
  }

  async processChat(chatMessage, username, options = {}) {
    const context = options.context || `User ${username} said: "${chatMessage}"`;
    const systemPrompt = options.systemPrompt || 
      'You are an AI assistant for a TikTok live stream. Respond to chat messages in a friendly, engaging way. Keep responses short and entertaining.';

    try {
      const result = await this.generateResponse(context, {
        ...options,
        systemPrompt: systemPrompt
      });

      return {
        originalMessage: chatMessage,
        username: username,
        aiResponse: result.response,
        provider: result.provider,
        model: result.model,
        tokensUsed: result.tokensUsed,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to process chat with AI:', error);
      throw error;
    }
  }

  async moderateContent(content, options = {}) {
    const provider = options.provider || this.defaultProvider;
    
    const moderationPrompt = `Please analyze this content for inappropriate material and respond with only "SAFE" or "UNSAFE": "${content}"`;

    try {
      const result = await this.generateResponse(moderationPrompt, {
        ...options,
        provider: provider,
        maxTokens: 10
      });

      return {
        content: content,
        result: result.response.includes('SAFE') ? 'safe' : 'unsafe',
        provider: result.provider,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Content moderation failed:', error);
      return {
        content: content,
        result: 'unknown',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async generateStreamTitle(options = {}) {
    const prompt = options.prompt || 'Generate a creative, engaging title for a TikTok live stream. Keep it under 50 characters.';
    
    try {
      const result = await this.generateResponse(prompt, {
        ...options,
        maxTokens: 50
      });

      return {
        title: result.response.trim(),
        provider: result.provider,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to generate stream title:', error);
      throw error;
    }
  }

  async generateCommands(userInput, options = {}) {
    const prompt = `Based on this user input: "${userInput}", generate appropriate game commands or actions. Respond with a JSON array of commands.`;
    
    try {
      const result = await this.generateResponse(prompt, {
        ...options,
        maxTokens: 200
      });

      let commands;
      try {
        commands = JSON.parse(result.response);
      } catch (parseError) {
        commands = [result.response];
      }

      return {
        userInput: userInput,
        commands: commands,
        provider: result.provider,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to generate commands:', error);
      throw error;
    }
  }

  isEnabled() {
    return config.ai?.enabled === true;
  }

  getSupportedProviders() {
    return Object.keys(this.providers);
  }

  getProviderStatus() {
    const status = {};
    
    for (const provider of this.getSupportedProviders()) {
      status[provider] = this.isProviderConfigured(provider);
    }
    
    return status;
  }

  isProviderConfigured(provider) {
    switch (provider) {
      case 'openai':
        return !!(config.ai?.openai?.apiKey);
      case 'anthropic':
        return !!(config.ai?.anthropic?.apiKey);
      case 'google':
        return !!(config.ai?.google?.apiKey);
      case 'local':
        return !!(config.ai?.local?.endpoint);
      default:
        return false;
    }
  }
}

module.exports = new AIService();