const axios = require('axios');
const logger = require('../../utils/logger');
const config = require('../../config/config');
const ModularTTSService = require('./tts/modularTTSService');

class TTSService {
  constructor() {
    this.providers = {
      elevenlabs: this.elevenLabsTTS.bind(this),
      openai: this.openAITTS.bind(this),
      azure: this.azureTTS.bind(this),
      google: this.googleTTS.bind(this)
    };
    this.defaultProvider = config.tts?.defaultProvider || 'elevenlabs';
  }

  async generateSpeech(text, options = {}) {
    const provider = options.provider || this.defaultProvider;
    
    if (!this.providers[provider]) {
      throw new Error(`TTS provider '${provider}' not supported`);
    }

    try {
      logger.debug(`Generating speech with ${provider}: "${text}"`);
      const result = await this.providers[provider](text, options);
      logger.debug(`Speech generated successfully with ${provider}`);
      return result;
    } catch (error) {
      logger.error(`TTS generation failed with ${provider}:`, error);
      throw error;
    }
  }

  async elevenLabsTTS(text, options = {}) {
    if (!config.tts?.elevenlabs?.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const voiceId = options.voiceId || config.tts.elevenlabs.defaultVoiceId;
    const model = options.model || config.tts.elevenlabs.model || 'eleven_multilingual_v2';
    const stability = options.stability || config.tts.elevenlabs.stability || 0.5;
    const similarityBoost = options.similarityBoost || config.tts.elevenlabs.similarityBoost || 0.5;
    const speed = options.speed || config.tts.elevenlabs.speed || 1.0;
    const outputFormat = options.outputFormat || config.tts.elevenlabs.outputFormat || 'mp3_44100_128';

    const requestBody = {
      text: text,
      model_id: model,
      voice_settings: {
        stability: stability,
        similarity_boost: similarityBoost,
        speed: 0.8
      },
    };

    // Add output_format to request body if specified
    if (outputFormat) {
      requestBody.output_format = outputFormat;
    }

    console.log(requestBody);
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      requestBody,
      {
        headers: {
          'xi-api-key': config.tts.elevenlabs.apiKey,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    return {
      audioBuffer: response.data,
      format: 'mp3',
      provider: 'elevenlabs'
    };
  }

  async openAITTS(text, options = {}) {
    if (!config.tts?.openai?.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const voice = options.voice || config.tts.openai.voice || 'alloy';
    const model = options.model || config.tts.openai.model || 'tts-1';

    const response = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: model,
        input: text,
        voice: voice
      },
      {
        headers: {
          'Authorization': `Bearer ${config.tts.openai.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    return {
      audioBuffer: response.data,
      format: 'mp3',
      provider: 'openai'
    };
  }

  async azureTTS(text, options = {}) {
    if (!config.tts?.azure?.apiKey || !config.tts?.azure?.region) {
      throw new Error('Azure TTS API key or region not configured');
    }

    const voice = options.voice || config.tts.azure.voice || 'en-US-JennyNeural';
    const language = options.language || config.tts.azure.language || 'en-US';

    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${language}">
        <voice name="${voice}">
          ${text}
        </voice>
      </speak>
    `;

    const response = await axios.post(
      `https://${config.tts.azure.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      ssml,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': config.tts.azure.apiKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
        },
        responseType: 'arraybuffer'
      }
    );

    return {
      audioBuffer: response.data,
      format: 'mp3',
      provider: 'azure'
    };
  }

  async googleTTS(text, options = {}) {
    if (!config.tts?.google?.apiKey) {
      throw new Error('Google TTS API key not configured');
    }

    const languageCode = options.languageCode || config.tts.google.languageCode || 'en-US';
    const voiceName = options.voiceName || config.tts.google.voiceName || 'en-US-Standard-D';
    const audioEncoding = options.audioEncoding || config.tts.google.audioEncoding || 'MP3';

    const response = await axios.post(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${config.tts.google.apiKey}`,
      {
        input: { text: text },
        voice: {
          languageCode: languageCode,
          name: voiceName
        },
        audioConfig: {
          audioEncoding: audioEncoding
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      audioBuffer: Buffer.from(response.data.audioContent, 'base64'),
      format: 'mp3',
      provider: 'google'
    };
  }

  async getAvailableVoices(provider = null) {
    const targetProvider = provider || this.defaultProvider;

    try {
      switch (targetProvider) {
        case 'elevenlabs':
          return await this.getElevenLabsVoices();
        case 'openai':
          return this.getOpenAIVoices();
        case 'azure':
          return await this.getAzureVoices();
        case 'google':
          return await this.getGoogleVoices();
        default:
          throw new Error(`Voice list not available for provider: ${targetProvider}`);
      }
    } catch (error) {
      logger.error(`Failed to get voices for ${targetProvider}:`, error);
      throw error;
    }
  }

  async getElevenLabsVoices() {
    if (!config.tts?.elevenlabs?.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': config.tts.elevenlabs.apiKey
      }
    });

    return response.data.voices.map(voice => ({
      id: voice.voice_id,
      name: voice.name,
      category: voice.category,
      provider: 'elevenlabs'
    }));
  }

  getOpenAIVoices() {
    return [
      { id: 'alloy', name: 'Alloy', provider: 'openai' },
      { id: 'echo', name: 'Echo', provider: 'openai' },
      { id: 'fable', name: 'Fable', provider: 'openai' },
      { id: 'onyx', name: 'Onyx', provider: 'openai' },
      { id: 'nova', name: 'Nova', provider: 'openai' },
      { id: 'shimmer', name: 'Shimmer', provider: 'openai' }
    ];
  }

  async getAzureVoices() {
    if (!config.tts?.azure?.apiKey || !config.tts?.azure?.region) {
      throw new Error('Azure TTS API key or region not configured');
    }

    const response = await axios.get(
      `https://${config.tts.azure.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': config.tts.azure.apiKey
        }
      }
    );

    return response.data.map(voice => ({
      id: voice.ShortName,
      name: voice.DisplayName,
      locale: voice.Locale,
      gender: voice.Gender,
      provider: 'azure'
    }));
  }

  async getGoogleVoices() {
    if (!config.tts?.google?.apiKey) {
      throw new Error('Google TTS API key not configured');
    }

    const response = await axios.get(
      `https://texttospeech.googleapis.com/v1/voices?key=${config.tts.google.apiKey}`
    );

    return response.data.voices.map(voice => ({
      id: voice.name,
      name: voice.name,
      languageCodes: voice.languageCodes,
      ssmlGender: voice.ssmlGender,
      provider: 'google'
    }));
  }

  isEnabled() {
    return config.tts?.enabled === true;
  }

  getSupportedProviders() {
    return Object.keys(this.providers);
  }

  /**
   * Create a new modular TTS service instance
   * @param {Object} options - Configuration options for the modular TTS service
   * @returns {ModularTTSService} - New modular TTS service instance
   */
  createModularService(options = {}) {
    // Inject this instance to avoid circular dependency
    options.ttsService = this;
    return new ModularTTSService(options);
  }

  /**
   * Validate TTS service configuration
   * @returns {Object} - Validation results
   */
  async validateConfiguration() {
    const issues = [];
    const warnings = [];

    try {
      // Check if TTS is enabled
      if (!this.isEnabled()) {
        warnings.push('TTS service is disabled');
      }

      // Check if at least one provider is configured
      const availableProviders = [];
      
      if (config.tts?.elevenlabs?.apiKey) {
        availableProviders.push('elevenlabs');
      }
      if (config.tts?.openai?.apiKey) {
        availableProviders.push('openai');
      }
      if (config.tts?.azure?.apiKey && config.tts?.azure?.region) {
        availableProviders.push('azure');
      }
      if (config.tts?.google?.apiKey) {
        availableProviders.push('google');
      }

      if (availableProviders.length === 0) {
        issues.push('No TTS providers are configured with valid API keys');
      } else {
        logger.debug(`Available TTS providers: ${availableProviders.join(', ')}`);
      }

      // Check if default provider is available
      const defaultProvider = config.tts?.defaultProvider || 'elevenlabs';
      if (!availableProviders.includes(defaultProvider)) {
        if (availableProviders.length > 0) {
          warnings.push(`Default provider '${defaultProvider}' is not configured, will use '${availableProviders[0]}'`);
        } else {
          issues.push(`Default provider '${defaultProvider}' is not configured and no alternatives available`);
        }
      }

      return {
        valid: issues.length === 0,
        issues,
        warnings,
        availableProviders,
        defaultProvider
      };
    } catch (error) {
      logger.error('Failed to validate TTS configuration:', error);
      return {
        valid: false,
        issues: ['Failed to validate TTS configuration'],
        warnings: [],
        availableProviders: [],
        defaultProvider: null
      };
    }
  }
}

module.exports = new TTSService();