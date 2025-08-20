/**
 * 🇪🇺 Mistral AI Adapter
 * Direct integration with Mistral AI API for European data residency
 * Features: Competitive pricing, instruction following, European compliance
 */

import APILoader from '../APILoader.js';
import { Logger } from '../../utils/Logger.js';
import { AuthManager } from '../../utils/AuthManager.js';

const logger = new Logger('MistralAdapter');

/**
 * Mistral AI model configurations
 */
const MISTRAL_MODELS = {
  'mistral-large-latest': {
    name: 'Mistral Large',
    contextWindow: 32768,
    maxOutput: 8192,
    cost: { input: 8, output: 24 },
    features: ['reasoning', 'coding', 'multilingual', 'function_calling'],
    strengths: ['complex_reasoning', 'mathematics', 'code_generation'],
    languages: ['en', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'zh', 'ja', 'ko']
  },
  'mistral-medium-latest': {
    name: 'Mistral Medium',
    contextWindow: 32768,
    maxOutput: 8192,
    cost: { input: 2.7, output: 8.1 },
    features: ['balanced', 'coding', 'reasoning'],
    strengths: ['general_purpose', 'cost_effective'],
    languages: ['en', 'fr', 'de', 'es', 'it']
  },
  'mistral-small-latest': {
    name: 'Mistral Small',
    contextWindow: 32768,
    maxOutput: 8192,
    cost: { input: 2, output: 6 },
    features: ['lightweight', 'fast', 'cost_effective'],
    strengths: ['simple_tasks', 'classification', 'summarization'],
    languages: ['en', 'fr', 'de', 'es', 'it']
  },
  'mistral-tiny': {
    name: 'Mistral Tiny',
    contextWindow: 32768,
    maxOutput: 8192,
    cost: { input: 0.25, output: 0.25 },
    features: ['ultra_fast', 'lightweight', 'cost_effective'],
    strengths: ['simple_queries', 'classification', 'basic_chat'],
    languages: ['en', 'fr', 'de', 'es', 'it']
  },
  'open-mistral-7b': {
    name: 'Open Mistral 7B',
    contextWindow: 32768,
    maxOutput: 8192,
    cost: { input: 0.25, output: 0.25 },
    features: ['open_source', 'cost_effective', 'apache_license'],
    strengths: ['general_purpose', 'fine_tuning'],
    languages: ['en', 'fr', 'de', 'es', 'it'],
    openSource: true
  },
  'open-mixtral-8x7b': {
    name: 'Open Mixtral 8x7B',
    contextWindow: 32768,
    maxOutput: 8192,
    cost: { input: 0.7, output: 0.7 },
    features: ['mixture_of_experts', 'open_source', 'multilingual'],
    strengths: ['complex_reasoning', 'code_generation', 'multilingual'],
    languages: ['en', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'zh', 'ja'],
    openSource: true
  },
  'open-mixtral-8x22b': {
    name: 'Open Mixtral 8x22B',
    contextWindow: 64000,
    maxOutput: 8192,
    cost: { input: 2, output: 6 },
    features: ['mixture_of_experts', 'large_context', 'open_source'],
    strengths: ['complex_reasoning', 'long_context', 'multilingual'],
    languages: ['en', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'],
    openSource: true
  },
  'mistral-embed': {
    name: 'Mistral Embed',
    contextWindow: 8192,
    maxOutput: 1024, // Embedding dimensions
    cost: { input: 0.1, output: 0 },
    features: ['embeddings', 'semantic_search', 'multilingual'],
    strengths: ['retrieval', 'similarity', 'clustering'],
    languages: ['en', 'fr', 'de', 'es', 'it'],
    type: 'embedding'
  }
};

/**
 * Mistral AI safety levels
 */
const SAFETY_LEVELS = {
  'none': 'No content filtering',
  'low': 'Minimal content filtering',
  'medium': 'Balanced content filtering', 
  'high': 'Strict content filtering'
};

/**
 * Mistral AI adapter with European compliance features
 */
class MistralAdapter extends APILoader {
  constructor(config = {}) {
    super({
      ...config,
      provider: 'mistral',
      baseURL: config.baseURL || 'https://api.mistral.ai/v1',
      apiKey: config.apiKey || process.env.MISTRAL_API_KEY
    });

    // Mistral-specific configuration
    this.safetyLevel = config.safetyLevel || 'medium';
    this.randomSeed = config.randomSeed;
    this.enableJsonMode = config.enableJsonMode || false;
    
    // European compliance features
    this.dataResidency = config.dataResidency || 'eu';
    this.enableGDPR = config.enableGDPR !== false;
    this.organizationId = config.organizationId;

    this.authManager = new AuthManager();
    this.models = new Map();

    // Validate configuration
    this.validateConfig();

    logger.info(`🇪🇺 Mistral AI Adapter initialized (Data residency: ${this.dataResidency})`);
  }

  /**
   * Validate Mistral AI configuration
   */
  validateConfig() {
    if (!this.apiKey) {
      throw new Error('Mistral AI API key is required');
    }

    const validation = this.authManager.validateApiKey('mistral', this.apiKey);
    if (!validation.valid) {
      throw new Error(`Invalid Mistral AI API key: ${validation.error}`);
    }

    if (!SAFETY_LEVELS[this.safetyLevel]) {
      logger.warn(`Unknown safety level: ${this.safetyLevel}. Using 'medium'.`);
      this.safetyLevel = 'medium';
    }
  }

  /**
   * Get Mistral AI headers
   */
  getHeaders() {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'LLM-Runner-Router/2.0.0'
    };

    if (this.organizationId) {
      headers['Mistral-Organization'] = this.organizationId;
    }

    return headers;
  }

  /**
   * Load Mistral AI model
   */
  async load(modelId = 'mistral-small-latest', options = {}) {
    try {
      const modelConfig = MISTRAL_MODELS[modelId];
      
      if (!modelConfig) {
        logger.warn(`Unknown Mistral model: ${modelId}. Using default config.`);
      }

      // Test model availability
      if (options.testConnection !== false) {
        await this.testModelAvailability(modelId);
      }

      const model = {
        id: `mistral:${modelId}`,
        provider: 'mistral',
        modelId: modelId,
        type: 'mistral',
        config: {
          safetyLevel: this.safetyLevel,
          dataResidency: this.dataResidency,
          ...options
        },
        metadata: {
          ...modelConfig,
          streaming: true,
          european: true,
          gdpr_compliant: this.enableGDPR,
          open_source: modelConfig?.openSource || false,
          loaded: true,
          loadedAt: Date.now()
        }
      };

      this.models.set(modelId, model);
      this.model = model;
      this.loaded = true;

      logger.success(`✅ Loaded Mistral model: ${model.id}`);
      return model;

    } catch (error) {
      logger.error(`Failed to load Mistral model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Test Mistral model availability
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
   * Generate completion using Mistral AI
   */
  async complete(prompt, options = {}) {
    const model = options.model || this.model;
    
    if (!model) {
      throw new Error('No model loaded');
    }

    // Build Mistral-specific request
    const request = this.buildMistralRequest(prompt, model, options);
    const endpoint = this.getMistralEndpoint(model);

    try {
      if (options.stream && model.metadata.streaming) {
        return await this.streamCompletion(request, endpoint, model, options);
      } else {
        return await this.standardCompletion(request, endpoint, model, options);
      }
    } catch (error) {
      logger.error(`Mistral AI request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build Mistral AI request
   */
  buildMistralRequest(prompt, model, options) {
    const modelType = model.metadata?.type || 'chat';
    
    if (modelType === 'embedding') {
      return {
        model: model.modelId,
        input: Array.isArray(prompt) ? prompt : [prompt],
        encoding_format: options.encodingFormat || 'float'
      };
    }

    // Chat completion request
    const request = {
      model: model.modelId,
      messages: options.messages || [
        { role: 'user', content: prompt }
      ],
      max_tokens: options.maxTokens || model.metadata.maxOutput || 1000,
      temperature: options.temperature || 0.7,
      top_p: options.topP || 1.0,
      stream: options.stream || false,
      safe_prompt: this.safetyLevel !== 'none'
    };

    // Add optional parameters
    if (this.randomSeed !== undefined) {
      request.random_seed = this.randomSeed;
    }

    if (options.stop) {
      request.stop = Array.isArray(options.stop) ? options.stop : [options.stop];
    }

    // Function calling support for compatible models
    if (options.functions && model.metadata.features?.includes('function_calling')) {
      request.functions = options.functions;
      request.function_call = options.functionCall || 'auto';
    }

    // JSON mode for compatible models
    if (this.enableJsonMode && options.responseFormat === 'json_object') {
      request.response_format = { type: 'json_object' };
    }

    return request;
  }

  /**
   * Get Mistral AI endpoint
   */
  getMistralEndpoint(model) {
    const modelType = model.metadata?.type || 'chat';
    
    switch (modelType) {
      case 'embedding':
        return `${this.baseURL}/embeddings`;
      
      default:
        return `${this.baseURL}/chat/completions`;
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
      await this.handleMistralError(response);
    }

    const data = await response.json();
    return this.parseMistralResponse(data, model);
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
      await this.handleMistralError(response);
    }

    return this.handleMistralStream(response, model);
  }

  /**
   * Handle Mistral AI errors
   */
  async handleMistralError(response) {
    const errorText = await response.text();
    let errorData;
    
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }

    // Mistral-specific error handling
    if (response.status === 401) {
      throw new Error('Mistral AI authentication failed. Check API key.');
    } else if (response.status === 402) {
      throw new Error('Mistral AI quota exceeded. Check billing.');
    } else if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      throw new Error(`Mistral AI rate limit exceeded. Retry after ${retryAfter} seconds.`);
    }

    const message = errorData.message || `Mistral AI error (${response.status})`;
    throw new Error(message);
  }

  /**
   * Parse Mistral AI response
   */
  parseMistralResponse(data, model) {
    const modelType = model.metadata?.type || 'chat';
    
    if (modelType === 'embedding') {
      return this.parseEmbeddingResponse(data, model);
    }

    // Chat completion response
    const choice = data.choices?.[0];
    const text = choice?.message?.content || '';
    const usage = data.usage || {};

    return {
      text,
      model: model.id,
      provider: 'mistral',
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      },
      cost: this.calculateCost(usage, model.modelId),
      finishReason: choice?.finish_reason || 'unknown',
      metadata: {
        safetyLevel: this.safetyLevel,
        dataResidency: this.dataResidency,
        functionCall: choice?.message?.function_call
      },
      timestamp: Date.now()
    };
  }

  /**
   * Parse embedding response
   */
  parseEmbeddingResponse(data, model) {
    const embeddings = data.data?.map(item => item.embedding) || [];
    const usage = data.usage || {};

    return {
      embeddings,
      model: model.id,
      provider: 'mistral',
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: 0,
        totalTokens: usage.total_tokens || 0
      },
      cost: this.calculateCost(usage, model.modelId),
      metadata: {
        count: embeddings.length,
        dimensions: embeddings[0]?.length || 0
      },
      timestamp: Date.now()
    };
  }

  /**
   * Handle Mistral AI streaming response
   */
  async *handleMistralStream(response, model) {
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
              const content = parsed.choices?.[0]?.delta?.content;
              
              if (content) {
                yield {
                  text: content,
                  model: model.id,
                  provider: 'mistral',
                  chunk: true,
                  metadata: {
                    safetyLevel: this.safetyLevel
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
   * Calculate cost based on Mistral AI pricing
   */
  calculateCost(usage, modelId) {
    const modelConfig = MISTRAL_MODELS[modelId];
    if (!modelConfig || !modelConfig.cost) return 0;

    const inputCost = (usage.prompt_tokens / 1000000) * modelConfig.cost.input;
    const outputCost = (usage.completion_tokens / 1000000) * modelConfig.cost.output;
    
    return inputCost + outputCost;
  }

  /**
   * List available Mistral AI models
   */
  async listModels() {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: this.getHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        return data.data?.map(model => ({
          id: model.id,
          name: model.id,
          provider: 'mistral',
          created: model.created,
          metadata: MISTRAL_MODELS[model.id] || {}
        })) || [];
      }
    } catch (error) {
      logger.warn('Failed to fetch Mistral models, using defaults');
    }

    // Return default models
    return Object.keys(MISTRAL_MODELS).map(id => ({
      id,
      name: MISTRAL_MODELS[id].name,
      provider: 'mistral',
      metadata: MISTRAL_MODELS[id]
    }));
  }

  /**
   * Get adapter information
   */
  getInfo() {
    return {
      name: 'MistralAdapter',
      version: '1.0.0',
      provider: 'mistral',
      baseURL: this.baseURL,
      safetyLevel: this.safetyLevel,
      dataResidency: this.dataResidency,
      gdprCompliant: this.enableGDPR,
      modelsLoaded: this.models.size,
      features: ['streaming', 'function_calling', 'multilingual', 'european_compliance'],
      languages: ['en', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'],
      models: Object.keys(MISTRAL_MODELS),
      openSourceModels: Object.keys(MISTRAL_MODELS).filter(id => MISTRAL_MODELS[id].openSource),
      status: 'ready'
    };
  }

  /**
   * Unload model
   */
  async unload(modelId) {
    if (this.models.has(modelId)) {
      this.models.delete(modelId);
      logger.info(`Mistral model ${modelId} unloaded`);
      return true;
    }
    return false;
  }

  /**
   * Clean up resources
   */
  async dispose() {
    this.models.clear();
    logger.info('Mistral AI adapter disposed');
  }
}

export default MistralAdapter;