/**
 * 🔥 Fireworks AI Adapter
 * Ultra-fast inference with FireAttention engine and enterprise compliance
 * Features: HIPAA/SOC2, function calling, structured output, custom models
 */

import APILoader from '../APILoader.js';
import { Logger } from '../../utils/Logger.js';
import { AuthManager } from '../../utils/AuthManager.js';

const logger = new Logger('FireworksAdapter');

/**
 * Fireworks AI model configurations
 */
const FIREWORKS_MODELS = {
  // Llama models with FireAttention optimization
  'accounts/fireworks/models/llama-v3p1-70b-instruct': {
    name: 'Llama 3.1 70B Instruct',
    contextWindow: 131072, // 128K context
    maxOutput: 4096,
    cost: { input: 0.9, output: 0.9 },
    features: ['instruction_following', 'long_context', 'fire_attention'],
    category: 'instruct',
    finetuneable: true
  },
  'accounts/fireworks/models/llama-v3p1-8b-instruct': {
    name: 'Llama 3.1 8B Instruct',
    contextWindow: 131072,
    maxOutput: 4096,
    cost: { input: 0.2, output: 0.2 },
    features: ['efficient', 'instruction_following', 'long_context'],
    category: 'instruct',
    finetuneable: true
  },
  'accounts/fireworks/models/llama-v3-70b-instruct': {
    name: 'Llama 3 70B Instruct',
    contextWindow: 8192,
    maxOutput: 4096,
    cost: { input: 0.9, output: 0.9 },
    features: ['instruction_following', 'high_quality'],
    category: 'instruct',
    finetuneable: true
  },
  'accounts/fireworks/models/llama-v3-8b-instruct': {
    name: 'Llama 3 8B Instruct',
    contextWindow: 8192,
    maxOutput: 4096,
    cost: { input: 0.2, output: 0.2 },
    features: ['efficient', 'instruction_following'],
    category: 'instruct',
    finetuneable: true
  },

  // Code Llama models
  'accounts/fireworks/models/llama-v2-34b-code-instruct': {
    name: 'Code Llama 34B Instruct',
    contextWindow: 16384,
    maxOutput: 8192,
    cost: { input: 0.8, output: 0.8 },
    features: ['code_generation', 'instruction_following', 'long_context'],
    category: 'code',
    finetuneable: true
  },
  'accounts/fireworks/models/llama-v2-13b-code-instruct': {
    name: 'Code Llama 13B Instruct',
    contextWindow: 16384,
    maxOutput: 8192,
    cost: { input: 0.4, output: 0.4 },
    features: ['code_generation', 'efficient'],
    category: 'code',
    finetuneable: true
  },

  // Mixtral models
  'accounts/fireworks/models/mixtral-8x7b-instruct': {
    name: 'Mixtral 8x7B Instruct',
    contextWindow: 32768,
    maxOutput: 8192,
    cost: { input: 0.5, output: 0.5 },
    features: ['mixture_of_experts', 'multilingual', 'instruction_following'],
    category: 'instruct',
    finetuneable: true
  },
  'accounts/fireworks/models/mixtral-8x22b-instruct': {
    name: 'Mixtral 8x22B Instruct',
    contextWindow: 65536,
    maxOutput: 8192,
    cost: { input: 1.2, output: 1.2 },
    features: ['mixture_of_experts', 'large_context', 'high_quality'],
    category: 'instruct',
    finetuneable: true
  },

  // Gemma models
  'accounts/fireworks/models/gemma-2b-it': {
    name: 'Gemma 2B Instruct',
    contextWindow: 8192,
    maxOutput: 2048,
    cost: { input: 0.1, output: 0.1 },
    features: ['ultra_lightweight', 'instruction_following'],
    category: 'instruct',
    finetuneable: true
  },
  'accounts/fireworks/models/gemma-7b-it': {
    name: 'Gemma 7B Instruct',
    contextWindow: 8192,
    maxOutput: 2048,
    cost: { input: 0.2, output: 0.2 },
    features: ['lightweight', 'instruction_following'],
    category: 'instruct',
    finetuneable: true
  },

  // Function calling models
  'accounts/fireworks/models/firefunction-v1': {
    name: 'FireFunction v1',
    contextWindow: 32768,
    maxOutput: 8192,
    cost: { input: 0.9, output: 0.9 },
    features: ['function_calling', 'structured_output', 'json_mode'],
    category: 'function',
    finetuneable: false
  },
  'accounts/fireworks/models/firefunction-v2': {
    name: 'FireFunction v2',
    contextWindow: 32768,
    maxOutput: 8192,
    cost: { input: 0.9, output: 0.9 },
    features: ['advanced_function_calling', 'structured_output', 'parallel_calls'],
    category: 'function',
    finetuneable: false
  }
};

/**
 * Fireworks AI compliance features
 */
const COMPLIANCE_FEATURES = {
  'HIPAA': 'Health Insurance Portability and Accountability Act',
  'SOC2': 'Service Organization Control 2',
  'GDPR': 'General Data Protection Regulation',
  'ISO27001': 'Information Security Management System'
};

/**
 * Fireworks AI adapter with enterprise features
 */
class FireworksAdapter extends APILoader {
  constructor(config = {}) {
    super({
      ...config,
      provider: 'fireworks',
      baseURL: config.baseURL || 'https://api.fireworks.ai/inference/v1',
      apiKey: config.apiKey || process.env.FIREWORKS_API_KEY
    });

    // Fireworks-specific configuration
    this.accountId = config.accountId || process.env.FIREWORKS_ACCOUNT_ID;
    this.enableFireAttention = config.enableFireAttention !== false;
    this.enableStructuredOutput = config.enableStructuredOutput || false;
    this.enableFunctionCalling = config.enableFunctionCalling || false;

    // Enterprise compliance
    this.enableHIPAA = config.enableHIPAA || false;
    this.enableSOC2 = config.enableSOC2 || false;
    this.dataRetentionDays = config.dataRetentionDays || 30;
    this.enableAuditLogging = config.enableAuditLogging || false;

    // Performance optimization
    this.enableBatching = config.enableBatching || false;
    this.maxBatchSize = config.maxBatchSize || 8;
    this.enableCaching = config.enableCaching !== false;
    this.cacheTimeout = config.cacheTimeout || 3600000; // 1 hour

    this.authManager = new AuthManager();
    this.models = new Map();
    this.responseCache = new Map();
    this.batchQueue = [];

    // Validate configuration
    this.validateConfig();

    logger.info(`🔥 Fireworks AI Adapter initialized (FireAttention: ${this.enableFireAttention})`);
  }

  /**
   * Validate Fireworks AI configuration
   */
  validateConfig() {
    if (!this.apiKey) {
      throw new Error('Fireworks AI API key is required');
    }

    const validation = this.authManager.validateApiKey('fireworks', this.apiKey);
    if (!validation.valid) {
      logger.warn(`Fireworks AI API key format validation: ${validation.error || validation.warning}`);
    }

    if (this.enableHIPAA && !this.accountId) {
      logger.warn('HIPAA compliance enabled but no account ID provided');
    }
  }

  /**
   * Get Fireworks AI headers
   */
  getHeaders() {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'LLM-Runner-Router/2.0.0'
    };

    // Add compliance headers
    if (this.enableHIPAA) {
      headers['X-Fireworks-HIPAA'] = 'true';
    }

    if (this.enableSOC2) {
      headers['X-Fireworks-SOC2'] = 'true';
    }

    if (this.dataRetentionDays) {
      headers['X-Fireworks-Retention-Days'] = this.dataRetentionDays.toString();
    }

    return headers;
  }

  /**
   * Load Fireworks AI model
   */
  async load(modelId, options = {}) {
    try {
      const modelConfig = FIREWORKS_MODELS[modelId];
      
      if (!modelConfig) {
        // Try to fetch from Fireworks API
        const availableModels = await this.fetchAvailableModels();
        const foundModel = availableModels.find(m => m.id === modelId);
        
        if (!foundModel) {
          logger.warn(`Unknown Fireworks AI model: ${modelId}. Using default config.`);
        }
      }

      // Test model availability
      if (options.testConnection !== false) {
        await this.testModelAvailability(modelId);
      }

      const model = {
        id: `fireworks:${modelId}`,
        provider: 'fireworks',
        modelId: modelId,
        type: 'fireworks',
        config: {
          enableFireAttention: this.enableFireAttention,
          enableStructuredOutput: this.enableStructuredOutput,
          compliance: {
            HIPAA: this.enableHIPAA,
            SOC2: this.enableSOC2
          },
          ...options
        },
        metadata: {
          ...modelConfig,
          streaming: true,
          enterprise: true,
          fire_attention: this.enableFireAttention,
          compliance: Object.keys(COMPLIANCE_FEATURES).filter(feature => 
            this[`enable${feature}`] || false
          ),
          loaded: true,
          loadedAt: Date.now()
        }
      };

      this.models.set(modelId, model);
      this.model = model;
      this.loaded = true;

      logger.success(`✅ Loaded Fireworks AI model: ${model.id}`);
      return model;

    } catch (error) {
      logger.error(`Failed to load Fireworks AI model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Test Fireworks AI model availability
   */
  async testModelAvailability(modelId) {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Model availability check failed: ${response.status}`);
      }

      const data = await response.json();
      const availableModels = data.data?.map(m => m.id) || [];

      if (!availableModels.includes(modelId)) {
        logger.warn(`Model ${modelId} may not be available`);
      }

      logger.debug(`✅ Model availability test passed for ${modelId}`);
      return true;
    } catch (error) {
      logger.warn(`⚠️ Model availability test failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch available models from Fireworks AI
   */
  async fetchAvailableModels() {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: this.getHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
    } catch (error) {
      logger.warn('Failed to fetch available models:', error);
    }

    return [];
  }

  /**
   * Generate completion using Fireworks AI
   */
  async complete(prompt, options = {}) {
    const model = options.model || this.model;
    
    if (!model) {
      throw new Error('No model loaded');
    }

    // Check cache
    if (this.enableCaching) {
      const cacheKey = this.generateCacheKey(prompt, model, options);
      const cached = this.responseCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        logger.debug('Cache hit for Fireworks request');
        return { ...cached.response, cached: true };
      }
    }

    // Handle batch mode
    if (this.enableBatching && options.batch) {
      return this.addToBatch(prompt, model, options);
    }

    // Build Fireworks AI request
    const request = this.buildFireworksRequest(prompt, model, options);
    const endpoint = this.getFireworksEndpoint(model);

    try {
      let response;
      if (options.stream && model.metadata.streaming) {
        response = await this.streamCompletion(request, endpoint, model, options);
      } else {
        response = await this.standardCompletion(request, endpoint, model, options);
      }

      // Cache response
      if (this.enableCaching && !options.stream) {
        const cacheKey = this.generateCacheKey(prompt, model, options);
        this.responseCache.set(cacheKey, {
          response,
          timestamp: Date.now()
        });
      }

      return response;
    } catch (error) {
      logger.error(`Fireworks AI request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build Fireworks AI request
   */
  buildFireworksRequest(prompt, model, options) {
    const request = {
      model: model.modelId,
      max_tokens: options.maxTokens || model.metadata.maxOutput || 1000,
      temperature: options.temperature || 0.7,
      top_p: options.topP || 1.0,
      stream: options.stream || false
    };

    // Format based on model category
    const category = model.metadata?.category || 'instruct';
    
    if (category === 'function' && this.enableFunctionCalling) {
      // Function calling models
      request.messages = options.messages || [
        { role: 'user', content: prompt }
      ];
      
      if (options.functions) {
        request.functions = options.functions;
        request.function_call = options.functionCall || 'auto';
      }
    } else if (category === 'instruct' || category === 'chat') {
      // Chat/instruct models
      request.messages = options.messages || [
        { role: 'user', content: prompt }
      ];
    } else {
      // Completion models
      request.prompt = prompt;
      request.stop = options.stop || [];
    }

    // Add Fireworks-specific features
    if (this.enableFireAttention) {
      request.use_fire_attention = true;
    }

    if (this.enableStructuredOutput && options.responseFormat) {
      request.response_format = options.responseFormat;
    }

    // Add safety settings
    if (options.safetySettings) {
      request.safety_settings = options.safetySettings;
    }

    return request;
  }

  /**
   * Get Fireworks AI endpoint
   */
  getFireworksEndpoint(model) {
    const category = model.metadata?.category || 'instruct';
    
    switch (category) {
      case 'function':
      case 'instruct':
      case 'chat':
        return `${this.baseURL}/chat/completions`;
      
      default:
        return `${this.baseURL}/completions`;
    }
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
      await this.handleFireworksError(response);
    }

    const data = await response.json();
    return this.parseFireworksResponse(data, model);
  }

  /**
   * Streaming completion
   */
  async streamCompletion(request, endpoint, model, options) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ...request, stream: true })
    });

    if (!response.ok) {
      await this.handleFireworksError(response);
    }

    return this.handleFireworksStream(response, model);
  }

  /**
   * Handle Fireworks AI errors
   */
  async handleFireworksError(response) {
    const errorText = await response.text();
    let errorData;
    
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }

    // Fireworks-specific error handling
    if (response.status === 401) {
      throw new Error('Fireworks AI authentication failed. Check API key.');
    } else if (response.status === 402) {
      throw new Error('Fireworks AI quota exceeded. Check billing.');
    } else if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      throw new Error(`Fireworks AI rate limit exceeded. Retry after ${retryAfter} seconds.`);
    } else if (response.status === 503) {
      throw new Error('Fireworks AI service temporarily unavailable. Try again later.');
    }

    const message = errorData.error?.message || errorData.message || `Fireworks AI error (${response.status})`;
    throw new Error(message);
  }

  /**
   * Parse Fireworks AI response
   */
  parseFireworksResponse(data, model) {
    const choice = data.choices?.[0];
    let text, functionCall;

    if (choice?.message) {
      // Chat completion format
      text = choice.message.content || '';
      functionCall = choice.message.function_call;
    } else {
      // Text completion format
      text = choice?.text || '';
    }

    const usage = data.usage || {};

    return {
      text,
      model: model.id,
      provider: 'fireworks',
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      },
      cost: this.calculateCost(usage, model.modelId),
      finishReason: choice?.finish_reason || 'unknown',
      metadata: {
        fireAttention: this.enableFireAttention,
        compliance: model.metadata.compliance,
        functionCall,
        category: model.metadata?.category
      },
      timestamp: Date.now()
    };
  }

  /**
   * Handle Fireworks AI streaming response
   */
  async *handleFireworksStream(response, model) {
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
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              let content = '';

              if (parsed.choices?.[0]?.delta?.content) {
                content = parsed.choices[0].delta.content;
              } else if (parsed.choices?.[0]?.text) {
                content = parsed.choices[0].text;
              }
              
              if (content) {
                yield {
                  text: content,
                  model: model.id,
                  provider: 'fireworks',
                  chunk: true,
                  metadata: {
                    fireAttention: this.enableFireAttention,
                    category: model.metadata?.category
                  },
                  timestamp: Date.now()
                };
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Generate cache key
   */
  generateCacheKey(prompt, model, options) {
    const key = {
      prompt,
      model: model.id,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      topP: options.topP
    };
    return JSON.stringify(key);
  }

  /**
   * Add request to batch queue
   */
  addToBatch(prompt, model, options) {
    const batchItem = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      prompt,
      model,
      options,
      timestamp: Date.now()
    };

    this.batchQueue.push(batchItem);

    // Process batch if queue is full
    if (this.batchQueue.length >= this.maxBatchSize) {
      return this.processBatch();
    }

    return Promise.resolve({
      batchId: batchItem.id,
      queued: true,
      queueSize: this.batchQueue.length
    });
  }

  /**
   * Process batch queue
   */
  async processBatch() {
    if (this.batchQueue.length === 0) {
      return [];
    }

    const batch = this.batchQueue.splice(0, this.maxBatchSize);
    logger.info(`Processing Fireworks batch of ${batch.length} requests`);

    try {
      const results = await Promise.all(
        batch.map(item => this.complete(item.prompt, {
          ...item.options,
          model: item.model,
          batch: false // Prevent recursion
        }))
      );

      return batch.map((item, index) => ({
        id: item.id,
        result: results[index],
        success: true
      }));
    } catch (error) {
      logger.error('Fireworks batch processing failed:', error);
      return batch.map(item => ({
        id: item.id,
        error: error.message,
        success: false
      }));
    }
  }

  /**
   * Calculate cost based on Fireworks AI pricing
   */
  calculateCost(usage, modelId) {
    const modelConfig = FIREWORKS_MODELS[modelId];
    if (!modelConfig || !modelConfig.cost) return 0;

    const inputCost = (usage.prompt_tokens / 1000000) * modelConfig.cost.input;
    const outputCost = (usage.completion_tokens / 1000000) * modelConfig.cost.output;
    
    return inputCost + outputCost;
  }

  /**
   * List available Fireworks AI models
   */
  async listModels() {
    try {
      const apiModels = await this.fetchAvailableModels();
      
      // Combine API models with known configurations
      const models = apiModels.map(apiModel => ({
        id: apiModel.id,
        name: apiModel.name || apiModel.id,
        provider: 'fireworks',
        context_length: apiModel.context_length,
        metadata: FIREWORKS_MODELS[apiModel.id] || {
          name: apiModel.name || apiModel.id,
          contextWindow: apiModel.context_length || 2048,
          category: 'instruct'
        }
      }));

      return models;
    } catch (error) {
      logger.warn('Failed to fetch Fireworks models, using defaults');
      
      // Return default models
      return Object.keys(FIREWORKS_MODELS).map(id => ({
        id,
        name: FIREWORKS_MODELS[id].name,
        provider: 'fireworks',
        metadata: FIREWORKS_MODELS[id]
      }));
    }
  }

  /**
   * Get adapter information
   */
  getInfo() {
    return {
      name: 'FireworksAdapter',
      version: '1.0.0',
      provider: 'fireworks',
      baseURL: this.baseURL,
      fireAttention: this.enableFireAttention,
      structuredOutput: this.enableStructuredOutput,
      functionCalling: this.enableFunctionCalling,
      compliance: {
        HIPAA: this.enableHIPAA,
        SOC2: this.enableSOC2,
        dataRetention: `${this.dataRetentionDays} days`
      },
      cacheSize: this.responseCache.size,
      batchQueueSize: this.batchQueue.length,
      modelsLoaded: this.models.size,
      features: ['streaming', 'function_calling', 'structured_output', 'fire_attention', 'enterprise_compliance'],
      categories: ['instruct', 'code', 'function'],
      models: Object.keys(FIREWORKS_MODELS),
      status: 'ready'
    };
  }

  /**
   * Unload model
   */
  async unload(modelId) {
    if (this.models.has(modelId)) {
      this.models.delete(modelId);
      logger.info(`Fireworks AI model ${modelId} unloaded`);
      return true;
    }
    return false;
  }

  /**
   * Clean up resources
   */
  async dispose() {
    // Process remaining batch items
    if (this.batchQueue.length > 0) {
      logger.info(`Processing remaining ${this.batchQueue.length} Fireworks batch items`);
      await this.processBatch();
    }

    this.models.clear();
    this.responseCache.clear();
    this.batchQueue = [];
    logger.info('Fireworks AI adapter disposed');
  }
}

export default FireworksAdapter;