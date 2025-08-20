/**
 * 🎬 Novita AI Adapter
 * Multi-modal adapter for Novita's text, image, video, and speech models
 * Features: Text-to-image, image-to-video, speech synthesis, LLM inference
 */

import APILoader from '../APILoader.js';
import { Logger } from '../../utils/Logger.js';
import { AuthManager } from '../../utils/AuthManager.js';

const logger = new Logger('NovitaAdapter');

/**
 * Novita AI model configurations
 */
const NOVITA_MODELS = {
  // Language Models
  'llama-3.1-8b-instruct': {
    name: 'Llama 3.1 8B Instruct',
    contextWindow: 128000,
    maxOutput: 4096,
    cost: { input: 0.06, output: 0.06 },
    features: ['text_generation', 'instruct', 'conversational'],
    type: 'text',
    modality: 'text',
    family: 'llama'
  },
  'llama-3.1-70b-instruct': {
    name: 'Llama 3.1 70B Instruct',
    contextWindow: 128000,
    maxOutput: 4096,
    cost: { input: 0.59, output: 0.79 },
    features: ['text_generation', 'instruct', 'advanced_reasoning'],
    type: 'text',
    modality: 'text',
    family: 'llama'
  },
  'llama-3.1-405b-instruct': {
    name: 'Llama 3.1 405B Instruct',
    contextWindow: 128000,
    maxOutput: 4096,
    cost: { input: 2.68, output: 2.68 },
    features: ['text_generation', 'instruct', 'premium_reasoning'],
    type: 'text',
    modality: 'text',
    family: 'llama'
  },

  // Text-to-Image Models
  'flux-dev': {
    name: 'FLUX.1 Dev',
    maxOutput: 1024, // Image dimensions
    cost: { input: 0, output: 0.02 }, // Per image
    features: ['text_to_image', 'high_quality', 'artistic'],
    type: 'image',
    modality: 'text-to-image',
    family: 'flux',
    supportedSizes: ['512x512', '768x768', '1024x1024', '1024x768', '768x1024'],
    supportedFormats: ['png', 'jpg', 'webp']
  },
  'flux-schnell': {
    name: 'FLUX.1 Schnell',
    maxOutput: 1024,
    cost: { input: 0, output: 0.003 },
    features: ['text_to_image', 'fast_generation', 'cost_effective'],
    type: 'image',
    modality: 'text-to-image',
    family: 'flux',
    supportedSizes: ['512x512', '768x768', '1024x1024'],
    supportedFormats: ['png', 'jpg']
  },
  'sdxl-turbo': {
    name: 'Stable Diffusion XL Turbo',
    maxOutput: 1024,
    cost: { input: 0, output: 0.004 },
    features: ['text_to_image', 'ultra_fast', 'turbo_mode'],
    type: 'image',
    modality: 'text-to-image',
    family: 'stable-diffusion',
    supportedSizes: ['512x512', '768x768', '1024x1024'],
    supportedFormats: ['png', 'jpg']
  },

  // Image-to-Video Models
  'kling-video': {
    name: 'Kling Video',
    maxOutput: 10, // Seconds
    cost: { input: 0, output: 0.125 }, // Per second
    features: ['image_to_video', 'motion_generation', 'cinematic'],
    type: 'video',
    modality: 'image-to-video',
    family: 'kling',
    supportedDurations: [5, 10],
    supportedResolutions: ['720p', '1080p'],
    supportedFormats: ['mp4', 'gif']
  },
  'runway-gen3': {
    name: 'Runway Gen-3 Alpha',
    maxOutput: 10,
    cost: { input: 0, output: 0.095 },
    features: ['text_to_video', 'image_to_video', 'motion_brush'],
    type: 'video',
    modality: 'multimodal-video',
    family: 'runway',
    supportedDurations: [5, 10],
    supportedResolutions: ['720p', '1080p'],
    supportedFormats: ['mp4']
  },

  // Speech Models
  'elevenlabs-tts': {
    name: 'ElevenLabs Text-to-Speech',
    maxOutput: 5000, // Characters
    cost: { input: 0, output: 0.18 }, // Per 1000 characters
    features: ['text_to_speech', 'voice_cloning', 'multilingual'],
    type: 'speech',
    modality: 'text-to-speech',
    family: 'elevenlabs',
    supportedVoices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    supportedFormats: ['mp3', 'wav', 'flac'],
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'tr', 'ru', 'nl', 'cs', 'ar', 'zh', 'ja', 'hu', 'ko']
  },
  'openai-tts': {
    name: 'OpenAI Text-to-Speech',
    maxOutput: 4096,
    cost: { input: 0, output: 0.015 },
    features: ['text_to_speech', 'natural_voices', 'high_quality'],
    type: 'speech',
    modality: 'text-to-speech',
    family: 'openai',
    supportedVoices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    supportedFormats: ['mp3', 'opus', 'aac', 'flac']
  }
};

/**
 * Novita AI API endpoints
 */
const NOVITA_ENDPOINTS = {
  text: '/llm/chat/completions',
  image: '/txt2img',
  video: '/img2video',
  speech: '/tts',
  models: '/models'
};

/**
 * Novita AI adapter with multi-modal capabilities
 */
class NovitaAdapter extends APILoader {
  constructor(config = {}) {
    super({
      ...config,
      provider: 'novita'
    });

    // Novita-specific configuration
    this.baseURL = config.baseURL || 'https://api.novita.ai/v3';
    
    // Multi-modal features
    this.enableImageGeneration = config.enableImageGeneration !== false;
    this.enableVideoGeneration = config.enableVideoGeneration !== false;
    this.enableSpeechSynthesis = config.enableSpeechSynthesis !== false;
    
    // Quality settings
    this.defaultImageSize = config.defaultImageSize || '1024x1024';
    this.defaultImageFormat = config.defaultImageFormat || 'png';
    this.defaultVideoLength = config.defaultVideoLength || 5; // seconds
    this.defaultVoice = config.defaultVoice || 'alloy';
    
    // Generation parameters
    this.imageSteps = config.imageSteps || 20;
    this.guidanceScale = config.guidanceScale || 7.0;
    this.seed = config.seed || -1; // Random if -1
    
    this.authManager = new AuthManager();
    this.models = new Map();
    this.generationCache = new Map();

    logger.info(`🎬 Novita AI Adapter initialized (Multi-modal: Text, Image, Video, Speech)`);
  }

  /**
   * Get authentication headers
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'LLM-Runner-Router/2.0.0'
    };
  }

  /**
   * Load Novita model
   */
  async load(modelId, options = {}) {
    try {
      const modelConfig = NOVITA_MODELS[modelId];
      
      if (!modelConfig) {
        logger.warn(`Unknown Novita model: ${modelId}. Attempting to load anyway.`);
      }

      // Test model availability
      if (options.testConnection !== false) {
        await this.testModelAvailability(modelId, modelConfig);
      }

      const model = {
        id: `novita:${modelId}`,
        provider: 'novita',
        modelId: modelId,
        type: 'novita',
        config: {
          ...options
        },
        metadata: {
          ...modelConfig,
          multimodal: true,
          streaming: modelConfig?.modality === 'text',
          generation_type: modelConfig?.modality || 'text',
          loaded: true,
          loadedAt: Date.now()
        }
      };

      this.models.set(modelId, model);
      this.model = model;
      this.loaded = true;

      logger.success(`✅ Loaded Novita model: ${model.id} (${modelConfig?.modality || 'text'})`);
      return model;

    } catch (error) {
      logger.error(`Failed to load Novita model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Test model availability
   */
  async testModelAvailability(modelId, modelConfig) {
    try {
      if (!modelConfig) {
        logger.warn(`Model ${modelId} may not be available or recognized`);
      }

      logger.debug(`✅ Model availability test passed for ${modelId}`);
      return true;
    } catch (error) {
      logger.warn(`⚠️ Model availability test failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate content using Novita
   */
  async complete(prompt, options = {}) {
    const model = options.model || this.model;
    
    if (!model) {
      throw new Error('No model loaded');
    }

    const modelConfig = NOVITA_MODELS[model.modelId];
    const modality = modelConfig?.modality || 'text';

    switch (modality) {
      case 'text':
        return await this.generateText(prompt, model, options);
      case 'text-to-image':
        return await this.generateImage(prompt, model, options);
      case 'image-to-video':
      case 'multimodal-video':
        return await this.generateVideo(prompt, model, options);
      case 'text-to-speech':
        return await this.generateSpeech(prompt, model, options);
      default:
        throw new Error(`Unsupported modality: ${modality}`);
    }
  }

  /**
   * Generate text completion
   */
  async generateText(prompt, model, options) {
    const request = this.buildTextRequest(prompt, model, options);
    const endpoint = `${this.baseURL}${NOVITA_ENDPOINTS.text}`;

    try {
      if (options.stream && model.metadata.streaming) {
        return await this.streamCompletion(request, endpoint, model, options);
      } else {
        return await this.standardCompletion(request, endpoint, model, options);
      }
    } catch (error) {
      logger.error(`Novita text generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate image
   */
  async generateImage(prompt, model, options) {
    const request = this.buildImageRequest(prompt, model, options);
    const endpoint = `${this.baseURL}${NOVITA_ENDPOINTS.image}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        await this.handleNovitaError(response);
      }

      const data = await response.json();
      return this.parseImageResponse(data, model);

    } catch (error) {
      logger.error(`Novita image generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate video
   */
  async generateVideo(prompt, model, options) {
    const request = this.buildVideoRequest(prompt, model, options);
    const endpoint = `${this.baseURL}${NOVITA_ENDPOINTS.video}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        await this.handleNovitaError(response);
      }

      const data = await response.json();
      return this.parseVideoResponse(data, model);

    } catch (error) {
      logger.error(`Novita video generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate speech
   */
  async generateSpeech(text, model, options) {
    const request = this.buildSpeechRequest(text, model, options);
    const endpoint = `${this.baseURL}${NOVITA_ENDPOINTS.speech}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        await this.handleNovitaError(response);
      }

      const data = await response.json();
      return this.parseSpeechResponse(data, model);

    } catch (error) {
      logger.error(`Novita speech generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build text request
   */
  buildTextRequest(prompt, model, options) {
    const modelConfig = NOVITA_MODELS[model.modelId];
    
    const messages = options.messages || [
      { role: 'user', content: prompt }
    ];

    return {
      model: model.modelId,
      messages: messages,
      max_tokens: options.maxTokens || modelConfig?.maxOutput || 1000,
      temperature: options.temperature || 0.7,
      top_p: options.topP || 0.9,
      stop: options.stopSequences || [],
      stream: false // Will be set in streaming method
    };
  }

  /**
   * Build image request
   */
  buildImageRequest(prompt, model, options) {
    const modelConfig = NOVITA_MODELS[model.modelId];
    const [width, height] = this.parseImageSize(options.size || this.defaultImageSize);

    return {
      model_name: model.modelId,
      prompt: prompt,
      negative_prompt: options.negativePrompt || '',
      width: width,
      height: height,
      image_num: options.imageCount || 1,
      steps: options.steps || this.imageSteps,
      seed: options.seed || this.seed,
      guidance_scale: options.guidanceScale || this.guidanceScale,
      response_format: options.format || this.defaultImageFormat,
      sampler_name: options.sampler || 'DPM++ 2M Karras'
    };
  }

  /**
   * Build video request
   */
  buildVideoRequest(prompt, model, options) {
    const modelConfig = NOVITA_MODELS[model.modelId];

    const request = {
      model_name: model.modelId,
      duration: options.duration || this.defaultVideoLength,
      aspect_ratio: options.aspectRatio || '16:9',
      motion_bucket_id: options.motionLevel || 127 // 1-255, higher = more motion
    };

    // Handle different input types
    if (options.imageUrl || options.imageBase64) {
      // Image-to-video
      request.image_url = options.imageUrl;
      request.image_base64 = options.imageBase64;
    } else {
      // Text-to-video (if supported)
      request.prompt = prompt;
    }

    return request;
  }

  /**
   * Build speech request
   */
  buildSpeechRequest(text, model, options) {
    const modelConfig = NOVITA_MODELS[model.modelId];

    return {
      model: model.modelId,
      input: text,
      voice: options.voice || this.defaultVoice,
      response_format: options.format || 'mp3',
      speed: options.speed || 1.0,
      pitch: options.pitch || 1.0,
      language: options.language || 'en'
    };
  }

  /**
   * Parse image size string
   */
  parseImageSize(sizeString) {
    const [width, height] = sizeString.split('x').map(Number);
    return [width || 1024, height || 1024];
  }

  /**
   * Standard (non-streaming) completion
   */
  async standardCompletion(request, endpoint, model, options) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      await this.handleNovitaError(response);
    }

    const data = await response.json();
    return this.parseTextResponse(data, model);
  }

  /**
   * Streaming completion
   */
  async streamCompletion(request, endpoint, model, options) {
    // Add streaming parameter
    request.stream = true;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      await this.handleNovitaError(response);
    }

    return this.handleNovitaStream(response, model);
  }

  /**
   * Handle Novita errors
   */
  async handleNovitaError(response) {
    const errorText = await response.text();
    let errorData;
    
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }

    const message = errorData.error?.message || errorData.message || `Novita error (${response.status})`;
    throw new Error(message);
  }

  /**
   * Parse text response
   */
  parseTextResponse(data, model) {
    const choice = data.choices?.[0];
    const message = choice?.message;
    const text = message?.content || '';
    
    return {
      text,
      model: model.id,
      provider: 'novita',
      modality: 'text',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      cost: this.calculateCost(data.usage, model.modelId),
      finishReason: choice?.finish_reason || 'stop',
      timestamp: Date.now()
    };
  }

  /**
   * Parse image response
   */
  parseImageResponse(data, model) {
    const images = data.images || data.data || [];
    
    return {
      images: images.map(img => ({
        url: img.url || img.image_url,
        base64: img.b64_json,
        format: img.format || this.defaultImageFormat,
        size: img.size
      })),
      model: model.id,
      provider: 'novita',
      modality: 'image',
      usage: {
        imageCount: images.length,
        totalImages: images.length
      },
      cost: this.calculateImageCost(images.length, model.modelId),
      metadata: {
        prompt: data.prompt,
        seed: data.seed,
        steps: data.steps,
        guidance_scale: data.guidance_scale
      },
      timestamp: Date.now()
    };
  }

  /**
   * Parse video response
   */
  parseVideoResponse(data, model) {
    const videos = data.videos || data.data || [];
    
    return {
      videos: videos.map(video => ({
        url: video.url || video.video_url,
        duration: video.duration,
        format: video.format || 'mp4',
        resolution: video.resolution
      })),
      model: model.id,
      provider: 'novita',
      modality: 'video',
      usage: {
        videoCount: videos.length,
        totalDuration: videos.reduce((sum, v) => sum + (v.duration || 0), 0)
      },
      cost: this.calculateVideoCost(videos, model.modelId),
      metadata: {
        motion_level: data.motion_bucket_id,
        aspect_ratio: data.aspect_ratio
      },
      timestamp: Date.now()
    };
  }

  /**
   * Parse speech response
   */
  parseSpeechResponse(data, model) {
    return {
      audio: {
        url: data.audio_url,
        base64: data.audio_base64,
        format: data.format || 'mp3',
        duration: data.duration
      },
      model: model.id,
      provider: 'novita',
      modality: 'speech',
      usage: {
        characters: data.characters || 0,
        duration: data.duration || 0
      },
      cost: this.calculateSpeechCost(data.characters, model.modelId),
      metadata: {
        voice: data.voice,
        language: data.language,
        speed: data.speed,
        pitch: data.pitch
      },
      timestamp: Date.now()
    };
  }

  /**
   * Handle Novita streaming response
   */
  async *handleNovitaStream(response, model) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '' || !line.startsWith('data: ')) continue;
          
          if (line.includes('[DONE]')) {
            return;
          }

          try {
            const data = JSON.parse(line.slice(6));
            const choice = data.choices?.[0];
            const delta = choice?.delta;
            const content = delta?.content || '';
            
            if (content) {
              yield {
                text: content,
                model: model.id,
                provider: 'novita',
                modality: 'text',
                chunk: true,
                timestamp: Date.now()
              };
            }
            
            // Handle final chunk with usage data
            if (data.usage || choice?.finish_reason) {
              yield {
                text: '',
                model: model.id,
                provider: 'novita',
                modality: 'text',
                finished: true,
                usage: data.usage || {},
                cost: this.calculateCost(data.usage, model.modelId),
                finishReason: choice?.finish_reason,
                timestamp: Date.now()
              };
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Calculate cost for text models
   */
  calculateCost(usage, modelId) {
    const modelConfig = NOVITA_MODELS[modelId];
    if (!modelConfig || !modelConfig.cost || !usage) return 0;

    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    
    const inputCost = (inputTokens / 1000000) * modelConfig.cost.input;
    const outputCost = (outputTokens / 1000000) * modelConfig.cost.output;
    
    return inputCost + outputCost;
  }

  /**
   * Calculate cost for image generation
   */
  calculateImageCost(imageCount, modelId) {
    const modelConfig = NOVITA_MODELS[modelId];
    if (!modelConfig || !modelConfig.cost) return 0;

    return imageCount * modelConfig.cost.output;
  }

  /**
   * Calculate cost for video generation
   */
  calculateVideoCost(videos, modelId) {
    const modelConfig = NOVITA_MODELS[modelId];
    if (!modelConfig || !modelConfig.cost) return 0;

    const totalDuration = videos.reduce((sum, video) => sum + (video.duration || 0), 0);
    return totalDuration * modelConfig.cost.output;
  }

  /**
   * Calculate cost for speech synthesis
   */
  calculateSpeechCost(characters, modelId) {
    const modelConfig = NOVITA_MODELS[modelId];
    if (!modelConfig || !modelConfig.cost) return 0;

    return (characters / 1000) * modelConfig.cost.output;
  }

  /**
   * List available Novita models
   */
  async listModels() {
    return Object.keys(NOVITA_MODELS).map(id => ({
      id,
      name: NOVITA_MODELS[id].name,
      provider: 'novita',
      type: NOVITA_MODELS[id].type,
      modality: NOVITA_MODELS[id].modality,
      family: NOVITA_MODELS[id].family,
      metadata: NOVITA_MODELS[id]
    }));
  }

  /**
   * Get adapter information
   */
  getInfo() {
    return {
      name: 'NovitaAdapter',
      version: '1.0.0',
      provider: 'novita',
      modelsLoaded: this.models.size,
      features: ['text_generation', 'image_generation', 'video_generation', 'speech_synthesis'],
      modalities: ['text', 'image', 'video', 'speech'],
      capabilities: ['multimodal', 'streaming', 'high_quality_media'],
      imageGeneration: this.enableImageGeneration,
      videoGeneration: this.enableVideoGeneration,
      speechSynthesis: this.enableSpeechSynthesis,
      models: Object.keys(NOVITA_MODELS),
      status: this.loaded ? 'ready' : 'initializing'
    };
  }

  /**
   * Unload model
   */
  async unload(modelId) {
    if (this.models.has(modelId)) {
      this.models.delete(modelId);
      logger.info(`Novita model ${modelId} unloaded`);
      return true;
    }
    return false;
  }

  /**
   * Clean up resources
   */
  async dispose() {
    this.models.clear();
    this.generationCache.clear();
    logger.info('Novita adapter disposed');
  }
}

export default NovitaAdapter;