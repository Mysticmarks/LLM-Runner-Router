/**
 * 🌐 API Model Loader
 * Universal loader for API-based LLM providers (OpenAI, Anthropic, OpenRouter, Groq)
 * Echo AI Systems - Bringing cloud AI to your local orchestration
 */

import BaseLoader from './BaseLoader.js';
import { Logger } from '../utils/Logger.js';
import { StreamProcessor } from '../runtime/StreamProcessor.js';

const logger = new Logger('APILoader');

/**
 * API Provider configurations
 */
const PROVIDER_CONFIGS = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k'],
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    streaming: true,
    costPerMillion: { input: 10, output: 30 } // Example pricing
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-2.1', 'claude-instant-1.2'],
    headers: (apiKey) => ({
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    }),
    streaming: true,
    costPerMillion: { input: 15, output: 75 }
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    models: ['auto'], // OpenRouter supports many models dynamically
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/MCERQUA/LLM-Runner-Router',
      'X-Title': 'LLM-Runner-Router'
    }),
    streaming: true,
    costPerMillion: { input: 0, output: 0 } // OpenRouter provides per-model pricing
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    models: ['mixtral-8x7b-32768', 'llama2-70b-4096', 'gemma-7b-it'],
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    streaming: true,
    costPerMillion: { input: 0.27, output: 0.27 } // Groq's fast inference pricing
  }
};

/**
 * API-based model loader for cloud LLM providers
 */
class APILoader extends BaseLoader {
  constructor(config = {}) {
    super(config);
    
    this.provider = config.provider || 'openai';
    this.apiKey = config.apiKey || process.env[`${this.provider.toUpperCase()}_API_KEY`];
    this.baseURL = config.baseURL || PROVIDER_CONFIGS[this.provider]?.baseURL;
    this.streamProcessor = new StreamProcessor();
    
    // Rate limiting
    this.rateLimiter = {
      requests: 0,
      resetTime: Date.now() + 60000,
      maxRequests: config.maxRequests || 100
    };
    
    // Response cache
    this.cache = new Map();
    this.cacheTimeout = config.cacheTimeout || 3600000; // 1 hour default
    
    // Cost tracking
    this.costs = {
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0
    };
    
    if (!this.apiKey) {
      logger.warn(`⚠️ No API key found for ${this.provider}. Set ${this.provider.toUpperCase()}_API_KEY environment variable.`);
    }
    
    logger.info(`🌐 API Loader initialized for ${this.provider}`);
  }

  /**
   * Load/register an API model
   */
  async load(modelId, options = {}) {
    try {
      const providerConfig = PROVIDER_CONFIGS[this.provider];
      
      if (!providerConfig) {
        throw new Error(`Unsupported provider: ${this.provider}`);
      }
      
      if (!this.apiKey) {
        throw new Error(`API key required for ${this.provider}`);
      }
      
      // Validate model is supported
      if (this.provider !== 'openrouter' && !providerConfig.models.includes(modelId)) {
        logger.warn(`Model ${modelId} may not be supported by ${this.provider}`);
      }
      
      // Create model wrapper
      const model = {
        id: `${this.provider}:${modelId}`,
        provider: this.provider,
        modelId: modelId,
        type: 'api',
        config: {
          ...providerConfig,
          ...options
        },
        metadata: {
          streaming: providerConfig.streaming,
          maxTokens: options.maxTokens || 4096,
          temperature: options.temperature || 0.7,
          costPerMillion: providerConfig.costPerMillion
        },
        loader: this
      };
      
      // Test connection
      if (options.testConnection !== false) {
        await this.testConnection(model);
      }
      
      this.model = model;
      this.loaded = true;
      
      logger.success(`✅ Loaded API model: ${model.id}`);
      return model;
      
    } catch (error) {
      logger.error(`Failed to load API model: ${error.message}`);
      throw error;
    }
  }

  /**
   * Test API connection
   */
  async testConnection(model) {
    try {
      const testPrompt = 'Say "hello" in one word.';
      const response = await this.complete(testPrompt, {
        model: model,
        maxTokens: 10,
        stream: false
      });
      
      if (response) {
        logger.info(`✅ API connection test successful for ${model.id}`);
        return true;
      }
    } catch (error) {
      logger.warn(`⚠️ API connection test failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate completion from API
   */
  async generate(prompt, options = {}) {
    if (!this.loaded || !this.model) {
      throw new Error('No model loaded');
    }
    
    return this.complete(prompt, { ...options, model: this.model });
  }

  /**
   * Complete prompt using API
   */
  async complete(prompt, options = {}) {
    const model = options.model || this.model;
    
    // Check cache
    const cacheKey = `${model.id}:${prompt}:${JSON.stringify(options)}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        logger.debug('Cache hit for prompt');
        return cached.response;
      }
    }
    
    // Rate limiting
    await this.checkRateLimit();
    
    // Build request based on provider
    const request = this.buildRequest(prompt, model, options);
    
    try {
      if (options.stream && model.metadata.streaming) {
        return await this.streamCompletion(request, model, options);
      } else {
        return await this.standardCompletion(request, model, options);
      }
    } catch (error) {
      logger.error(`API request failed: ${error.message}`);
      
      // Retry logic
      if (options.retries > 0) {
        logger.info(`Retrying... (${options.retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.complete(prompt, { ...options, retries: options.retries - 1 });
      }
      
      throw error;
    }
  }

  /**
   * Build provider-specific request
   */
  buildRequest(prompt, model, options) {
    const baseRequest = {
      model: model.modelId,
      max_tokens: options.maxTokens || model.metadata.maxTokens,
      temperature: options.temperature || model.metadata.temperature,
      stream: options.stream || false
    };
    
    switch (this.provider) {
      case 'openai':
      case 'groq':
      case 'openrouter':
        return {
          ...baseRequest,
          messages: options.messages || [
            { role: 'user', content: prompt }
          ]
        };
        
      case 'anthropic':
        return {
          ...baseRequest,
          messages: options.messages || [
            { role: 'user', content: prompt }
          ],
          max_tokens: baseRequest.max_tokens
        };
        
      default:
        return baseRequest;
    }
  }

  /**
   * Standard (non-streaming) completion
   */
  async standardCompletion(request, model, options) {
    const endpoint = this.getEndpoint(model);
    const headers = PROVIDER_CONFIGS[this.provider].headers(this.apiKey);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error (${response.status}): ${error}`);
    }
    
    const data = await response.json();
    const result = this.parseResponse(data, model);
    
    // Update costs
    this.updateCosts(result.usage);
    
    // Cache response
    this.cache.set(request.cacheKey, {
      response: result,
      timestamp: Date.now()
    });
    
    return result;
  }

  /**
   * Streaming completion
   */
  async streamCompletion(request, model, options) {
    const endpoint = this.getEndpoint(model);
    const headers = PROVIDER_CONFIGS[this.provider].headers(this.apiKey);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...request, stream: true })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error (${response.status}): ${error}`);
    }
    
    // Return async generator for streaming
    return this.streamProcessor.processStream(response.body, (chunk) => {
      return this.parseStreamChunk(chunk, model);
    });
  }

  /**
   * Parse provider-specific response
   */
  parseResponse(data, model) {
    let text, usage;
    
    switch (this.provider) {
      case 'openai':
      case 'groq':
      case 'openrouter':
        text = data.choices?.[0]?.message?.content || '';
        usage = data.usage;
        break;
        
      case 'anthropic':
        text = data.content?.[0]?.text || '';
        usage = {
          prompt_tokens: data.usage?.input_tokens,
          completion_tokens: data.usage?.output_tokens,
          total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
        };
        break;
        
      default:
        text = data.text || data.response || '';
        usage = data.usage || {};
    }
    
    return {
      text,
      usage,
      model: model.id,
      provider: this.provider,
      timestamp: Date.now()
    };
  }

  /**
   * Parse streaming chunk
   */
  parseStreamChunk(chunk, model) {
    try {
      const lines = chunk.toString().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return null;
          
          const parsed = JSON.parse(data);
          
          switch (this.provider) {
            case 'openai':
            case 'groq':
            case 'openrouter':
              return parsed.choices?.[0]?.delta?.content || '';
              
            case 'anthropic':
              if (parsed.type === 'content_block_delta') {
                return parsed.delta?.text || '';
              }
              break;
          }
        }
      }
    } catch (error) {
      logger.debug('Error parsing stream chunk:', error);
    }
    
    return '';
  }

  /**
   * Get API endpoint for model
   */
  getEndpoint(model) {
    const base = this.baseURL || model.config.baseURL;
    
    switch (this.provider) {
      case 'openai':
      case 'groq':
      case 'openrouter':
        return `${base}/chat/completions`;
        
      case 'anthropic':
        return `${base}/messages`;
        
      default:
        return `${base}/completions`;
    }
  }

  /**
   * Check and update rate limits
   */
  async checkRateLimit() {
    if (Date.now() > this.rateLimiter.resetTime) {
      this.rateLimiter.requests = 0;
      this.rateLimiter.resetTime = Date.now() + 60000;
    }
    
    if (this.rateLimiter.requests >= this.rateLimiter.maxRequests) {
      const waitTime = this.rateLimiter.resetTime - Date.now();
      logger.warn(`Rate limit reached. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.rateLimiter.requests++;
  }

  /**
   * Update cost tracking
   */
  updateCosts(usage) {
    if (!usage) return;
    
    const inputTokens = usage.prompt_tokens || usage.input_tokens || 0;
    const outputTokens = usage.completion_tokens || usage.output_tokens || 0;
    
    this.costs.inputTokens += inputTokens;
    this.costs.outputTokens += outputTokens;
    
    const costConfig = this.model.metadata.costPerMillion;
    if (costConfig) {
      const inputCost = (inputTokens / 1000000) * costConfig.input;
      const outputCost = (outputTokens / 1000000) * costConfig.output;
      this.costs.totalCost += inputCost + outputCost;
    }
  }

  /**
   * Get cost statistics
   */
  getCosts() {
    return {
      ...this.costs,
      provider: this.provider,
      model: this.model?.id
    };
  }

  /**
   * List available models for provider
   */
  async listModels() {
    const config = PROVIDER_CONFIGS[this.provider];
    
    if (this.provider === 'openrouter' && this.apiKey) {
      // OpenRouter provides dynamic model list
      try {
        const response = await fetch(`${config.baseURL}/models`, {
          headers: config.headers(this.apiKey)
        });
        
        if (response.ok) {
          const data = await response.json();
          return data.data?.map(m => m.id) || config.models;
        }
      } catch (error) {
        logger.warn('Failed to fetch OpenRouter models:', error);
      }
    }
    
    return config?.models || [];
  }

  /**
   * Validate model configuration
   */
  validateModel(modelConfig) {
    if (!modelConfig.provider) {
      throw new Error('Provider is required for API models');
    }
    
    if (!PROVIDER_CONFIGS[modelConfig.provider]) {
      throw new Error(`Unsupported provider: ${modelConfig.provider}`);
    }
    
    return true;
  }

  /**
   * Unload model
   */
  async unload() {
    this.model = null;
    this.loaded = false;
    this.cache.clear();
    logger.info('API model unloaded');
  }

  /**
   * Get loader info
   */
  getInfo() {
    return {
      name: 'APILoader',
      version: '1.0.0',
      provider: this.provider,
      supportedProviders: Object.keys(PROVIDER_CONFIGS),
      hasApiKey: !!this.apiKey,
      costs: this.getCosts(),
      cacheSize: this.cache.size,
      rateLimitStatus: {
        requests: this.rateLimiter.requests,
        maxRequests: this.rateLimiter.maxRequests,
        resetIn: Math.max(0, this.rateLimiter.resetTime - Date.now())
      }
    };
  }
}

export default APILoader;