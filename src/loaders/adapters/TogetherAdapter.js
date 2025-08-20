/**
 * 🚀 Together AI Adapter
 * High-performance inference platform with 200+ open-source models
 * Features: Production-ready scaling, model fine-tuning, batch inference
 */

import APILoader from '../APILoader.js';
import { Logger } from '../../utils/Logger.js';
import { AuthManager } from '../../utils/AuthManager.js';

const logger = new Logger('TogetherAdapter');

/**
 * Together AI model configurations
 */
const TOGETHER_MODELS = {
  // Meta Llama models
  'meta-llama/Llama-2-70b-chat-hf': {
    name: 'Llama 2 70B Chat',
    contextWindow: 4096,
    maxOutput: 2048,
    cost: { input: 0.9, output: 0.9 },
    features: ['conversational', 'open_source', 'apache_license'],
    provider_model: 'meta-llama/Llama-2-70b-chat-hf',
    category: 'chat'
  },
  'meta-llama/Llama-2-13b-chat-hf': {
    name: 'Llama 2 13B Chat',
    contextWindow: 4096,
    maxOutput: 2048,
    cost: { input: 0.225, output: 0.225 },
    features: ['conversational', 'efficient', 'open_source'],
    provider_model: 'meta-llama/Llama-2-13b-chat-hf',
    category: 'chat'
  },
  'meta-llama/Llama-2-7b-chat-hf': {
    name: 'Llama 2 7B Chat',
    contextWindow: 4096,
    maxOutput: 2048,
    cost: { input: 0.2, output: 0.2 },
    features: ['lightweight', 'fast', 'open_source'],
    provider_model: 'meta-llama/Llama-2-7b-chat-hf',
    category: 'chat'
  },
  'meta-llama/CodeLlama-34b-Instruct-hf': {
    name: 'Code Llama 34B Instruct',
    contextWindow: 16384,
    maxOutput: 8192,
    cost: { input: 0.776, output: 0.776 },
    features: ['code_generation', 'instruction_following', 'long_context'],
    provider_model: 'meta-llama/CodeLlama-34b-Instruct-hf',
    category: 'code'
  },

  // Mistral models
  'mistralai/Mixtral-8x7B-Instruct-v0.1': {
    name: 'Mixtral 8x7B Instruct',
    contextWindow: 32768,
    maxOutput: 8192,
    cost: { input: 0.6, output: 0.6 },
    features: ['mixture_of_experts', 'multilingual', 'instruction_following'],
    provider_model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    category: 'instruct'
  },
  'mistralai/Mistral-7B-Instruct-v0.1': {
    name: 'Mistral 7B Instruct',
    contextWindow: 8192,
    maxOutput: 4096,
    cost: { input: 0.2, output: 0.2 },
    features: ['instruction_following', 'efficient', 'multilingual'],
    provider_model: 'mistralai/Mistral-7B-Instruct-v0.1',
    category: 'instruct'
  },

  // Microsoft models
  'microsoft/DialoGPT-large': {
    name: 'DialoGPT Large',
    contextWindow: 1024,
    maxOutput: 1024,
    cost: { input: 0.1, output: 0.1 },
    features: ['conversational', 'dialogue'],
    provider_model: 'microsoft/DialoGPT-large',
    category: 'chat'
  },

  // EleutherAI models
  'EleutherAI/gpt-neox-20b': {
    name: 'GPT-NeoX 20B',
    contextWindow: 2048,
    maxOutput: 2048,
    cost: { input: 0.5, output: 0.5 },
    features: ['general_purpose', 'open_source'],
    provider_model: 'EleutherAI/gpt-neox-20b',
    category: 'completion'
  },

  // Salesforce models
  'Salesforce/codegen-16B-multi': {
    name: 'CodeGen 16B Multi',
    contextWindow: 2048,
    maxOutput: 2048,
    cost: { input: 0.4, output: 0.4 },
    features: ['code_generation', 'multilingual_code'],
    provider_model: 'Salesforce/codegen-16B-multi',
    category: 'code'
  },

  // BigScience models
  'bigscience/bloom': {
    name: 'BLOOM 176B',
    contextWindow: 2048,
    maxOutput: 2048,
    cost: { input: 5.0, output: 5.0 },
    features: ['multilingual', 'large_scale', 'open_source'],
    provider_model: 'bigscience/bloom',
    category: 'completion'
  },

  // Stability AI models
  'stabilityai/stablelm-tuned-alpha-7b': {
    name: 'StableLM Tuned Alpha 7B',
    contextWindow: 4096,
    maxOutput: 2048,
    cost: { input: 0.2, output: 0.2 },
    features: ['stable_ai', 'tuned', 'conversational'],
    provider_model: 'stabilityai/stablelm-tuned-alpha-7b',
    category: 'chat'
  }
};

/**
 * Together AI model categories
 */
const MODEL_CATEGORIES = {
  'chat': 'Conversational models',
  'instruct': 'Instruction-following models', 
  'code': 'Code generation models',
  'completion': 'Text completion models',
  'embedding': 'Embedding models'
};

/**
 * Together AI adapter with high-performance features
 */
class TogetherAdapter extends APILoader {
  constructor(config = {}) {
    super({
      ...config,
      provider: 'together',
      baseURL: config.baseURL || 'https://api.together.xyz/v1',
      apiKey: config.apiKey || process.env.TOGETHER_API_KEY
    });

    // Together-specific configuration
    this.enableBatchMode = config.enableBatchMode || false;
    this.maxBatchSize = config.maxBatchSize || 10;
    this.enableCaching = config.enableCaching !== false;
    this.cacheDirectory = config.cacheDirectory || './together_cache';

    // Performance optimization
    this.enableGPUOptimization = config.enableGPUOptimization !== false;
    this.preferredRegion = config.preferredRegion || 'us-west-2';
    this.enableLoadBalancing = config.enableLoadBalancing !== false;

    this.authManager = new AuthManager();
    this.models = new Map();
    this.batchQueue = [];
    this.modelCache = new Map();

    // Validate configuration
    this.validateConfig();

    logger.info(`🚀 Together AI Adapter initialized (Region: ${this.preferredRegion})`);
  }

  /**
   * Validate Together AI configuration
   */
  validateConfig() {
    if (!this.apiKey) {
      throw new Error('Together AI API key is required');
    }

    const validation = this.authManager.validateApiKey('together', this.apiKey);
    if (!validation.valid) {
      logger.warn(`Together AI API key format validation: ${validation.error || validation.warning}`);
    }
  }

  /**
   * Get Together AI headers
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'LLM-Runner-Router/2.0.0'
    };
  }

  /**
   * Load Together AI model
   */
  async load(modelId, options = {}) {
    try {
      const modelConfig = TOGETHER_MODELS[modelId];
      
      if (!modelConfig) {
        // Try to fetch from Together AI API
        const availableModels = await this.fetchAvailableModels();
        const foundModel = availableModels.find(m => m.id === modelId || m.display_name === modelId);
        
        if (!foundModel) {
          logger.warn(`Unknown Together AI model: ${modelId}. Using default config.`);
        }
      }

      // Test model availability
      if (options.testConnection !== false) {
        await this.testModelAvailability(modelId);
      }

      const model = {
        id: `together:${modelId}`,
        provider: 'together',
        modelId: modelId,
        providerModel: modelConfig?.provider_model || modelId,
        type: 'together',
        config: {
          enableCaching: this.enableCaching,
          preferredRegion: this.preferredRegion,
          ...options
        },
        metadata: {
          ...modelConfig,
          streaming: true,
          high_performance: true,
          open_source: true,
          batch_support: this.enableBatchMode,
          loaded: true,
          loadedAt: Date.now()
        }
      };

      this.models.set(modelId, model);
      this.model = model;
      this.loaded = true;

      logger.success(`✅ Loaded Together AI model: ${model.id}`);
      return model;

    } catch (error) {
      logger.error(`Failed to load Together AI model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Test Together AI model availability
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

      const providerModel = TOGETHER_MODELS[modelId]?.provider_model || modelId;
      if (!availableModels.includes(providerModel)) {
        logger.warn(`Model ${modelId} (${providerModel}) may not be available`);
      }

      logger.debug(`✅ Model availability test passed for ${modelId}`);
      return true;
    } catch (error) {
      logger.warn(`⚠️ Model availability test failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch available models from Together AI
   */
  async fetchAvailableModels() {
    if (this.modelCache.has('available_models')) {
      const cached = this.modelCache.get('available_models');
      if (Date.now() - cached.timestamp < 3600000) { // 1 hour cache
        return cached.models;
      }
    }

    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: this.getHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        const models = data.data || [];
        
        this.modelCache.set('available_models', {
          models,
          timestamp: Date.now()
        });

        return models;
      }
    } catch (error) {
      logger.warn('Failed to fetch available models:', error);
    }

    return [];
  }

  /**
   * Generate completion using Together AI
   */
  async complete(prompt, options = {}) {
    const model = options.model || this.model;
    
    if (!model) {
      throw new Error('No model loaded');
    }

    // Handle batch mode
    if (this.enableBatchMode && options.batch) {
      return this.addToBatch(prompt, model, options);
    }

    // Build Together AI request
    const request = this.buildTogetherRequest(prompt, model, options);
    const endpoint = this.getTogetherEndpoint(model);

    try {
      if (options.stream && model.metadata.streaming) {
        return await this.streamCompletion(request, endpoint, model, options);
      } else {
        return await this.standardCompletion(request, endpoint, model, options);
      }
    } catch (error) {
      logger.error(`Together AI request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build Together AI request
   */
  buildTogetherRequest(prompt, model, options) {
    const modelCategory = model.metadata?.category || 'completion';
    const providerModel = model.providerModel || model.modelId;

    const baseRequest = {
      model: providerModel,
      max_tokens: options.maxTokens || model.metadata.maxOutput || 1000,
      temperature: options.temperature || 0.7,
      top_p: options.topP || 1.0,
      top_k: options.topK || 50,
      repetition_penalty: options.repetitionPenalty || 1.0,
      stream: options.stream || false
    };

    // Format request based on model category
    switch (modelCategory) {
      case 'chat':
      case 'instruct':
        return {
          ...baseRequest,
          messages: options.messages || [
            { role: 'user', content: prompt }
          ]
        };

      case 'completion':
      case 'code':
      default:
        return {
          ...baseRequest,
          prompt: prompt,
          stop: options.stop || []
        };
    }
  }

  /**
   * Get Together AI endpoint
   */
  getTogetherEndpoint(model) {
    const modelCategory = model.metadata?.category || 'completion';
    
    switch (modelCategory) {
      case 'chat':
      case 'instruct':
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
      await this.handleTogetherError(response);
    }

    const data = await response.json();
    return this.parseTogetherResponse(data, model);
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
      await this.handleTogetherError(response);
    }

    return this.handleTogetherStream(response, model);
  }

  /**
   * Handle Together AI errors
   */
  async handleTogetherError(response) {
    const errorText = await response.text();
    let errorData;
    
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }

    // Together-specific error handling
    if (response.status === 401) {
      throw new Error('Together AI authentication failed. Check API key.');
    } else if (response.status === 402) {
      throw new Error('Together AI quota exceeded. Check billing.');
    } else if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      throw new Error(`Together AI rate limit exceeded. Retry after ${retryAfter} seconds.`);
    } else if (response.status === 503) {
      throw new Error('Together AI service temporarily unavailable. Try again later.');
    }

    const message = errorData.error?.message || errorData.message || `Together AI error (${response.status})`;
    throw new Error(message);
  }

  /**
   * Parse Together AI response
   */
  parseTogetherResponse(data, model) {
    const modelCategory = model.metadata?.category || 'completion';
    let text, usage, finishReason;

    if (modelCategory === 'chat' || modelCategory === 'instruct') {
      // Chat completion format
      const choice = data.choices?.[0];
      text = choice?.message?.content || '';
      finishReason = choice?.finish_reason || 'unknown';
      usage = data.usage || {};
    } else {
      // Text completion format
      const choice = data.choices?.[0];
      text = choice?.text || '';
      finishReason = choice?.finish_reason || 'unknown';
      usage = data.usage || {};
    }

    return {
      text,
      model: model.id,
      provider: 'together',
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      },
      cost: this.calculateCost(usage, model.modelId),
      finishReason,
      metadata: {
        category: model.metadata?.category,
        openSource: true,
        highPerformance: true
      },
      timestamp: Date.now()
    };
  }

  /**
   * Handle Together AI streaming response
   */
  async *handleTogetherStream(response, model) {
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

              // Handle different response formats
              if (parsed.choices?.[0]?.delta?.content) {
                content = parsed.choices[0].delta.content;
              } else if (parsed.choices?.[0]?.text) {
                content = parsed.choices[0].text;
              }
              
              if (content) {
                yield {
                  text: content,
                  model: model.id,
                  provider: 'together',
                  chunk: true,
                  metadata: {
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
    logger.info(`Processing batch of ${batch.length} requests`);

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
      logger.error('Batch processing failed:', error);
      return batch.map(item => ({
        id: item.id,
        error: error.message,
        success: false
      }));
    }
  }

  /**
   * Calculate cost based on Together AI pricing
   */
  calculateCost(usage, modelId) {
    const modelConfig = TOGETHER_MODELS[modelId];
    if (!modelConfig || !modelConfig.cost) return 0;

    const inputCost = (usage.prompt_tokens / 1000000) * modelConfig.cost.input;
    const outputCost = (usage.completion_tokens / 1000000) * modelConfig.cost.output;
    
    return inputCost + outputCost;
  }

  /**
   * List available Together AI models
   */
  async listModels() {
    try {
      const apiModels = await this.fetchAvailableModels();
      
      // Combine API models with known configurations
      const models = apiModels.map(apiModel => ({
        id: apiModel.id,
        name: apiModel.display_name || apiModel.id,
        provider: 'together',
        description: apiModel.description,
        context_length: apiModel.context_length,
        metadata: TOGETHER_MODELS[apiModel.id] || {
          name: apiModel.display_name || apiModel.id,
          contextWindow: apiModel.context_length || 2048,
          category: 'completion'
        }
      }));

      return models;
    } catch (error) {
      logger.warn('Failed to fetch Together models, using defaults');
      
      // Return default models
      return Object.keys(TOGETHER_MODELS).map(id => ({
        id,
        name: TOGETHER_MODELS[id].name,
        provider: 'together',
        metadata: TOGETHER_MODELS[id]
      }));
    }
  }

  /**
   * Get adapter information
   */
  getInfo() {
    return {
      name: 'TogetherAdapter',
      version: '1.0.0',
      provider: 'together',
      baseURL: this.baseURL,
      preferredRegion: this.preferredRegion,
      enableBatchMode: this.enableBatchMode,
      maxBatchSize: this.maxBatchSize,
      queueSize: this.batchQueue.length,
      modelsLoaded: this.models.size,
      features: ['streaming', 'batch_processing', 'high_performance', 'open_source', 'model_variety'],
      categories: Object.keys(MODEL_CATEGORIES),
      models: Object.keys(TOGETHER_MODELS),
      status: 'ready'
    };
  }

  /**
   * Unload model
   */
  async unload(modelId) {
    if (this.models.has(modelId)) {
      this.models.delete(modelId);
      logger.info(`Together AI model ${modelId} unloaded`);
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
      logger.info(`Processing remaining ${this.batchQueue.length} batch items`);
      await this.processBatch();
    }

    this.models.clear();
    this.modelCache.clear();
    this.batchQueue = [];
    logger.info('Together AI adapter disposed');
  }
}

export default TogetherAdapter;