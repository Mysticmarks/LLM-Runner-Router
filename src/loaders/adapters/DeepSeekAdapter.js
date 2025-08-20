/**
 * 🧠 DeepSeek Adapter
 * Cost-effective adapter for DeepSeek's reasoning and coding models
 * Features: Ultra-low pricing, strong reasoning, code generation
 */

import APILoader from '../APILoader.js';
import { Logger } from '../../utils/Logger.js';
import { AuthManager } from '../../utils/AuthManager.js';

const logger = new Logger('DeepSeekAdapter');

/**
 * DeepSeek model configurations
 */
const DEEPSEEK_MODELS = {
  // DeepSeek V2 series (Latest)
  'deepseek-chat': {
    name: 'DeepSeek Chat',
    contextWindow: 128000,
    maxOutput: 4096,
    cost: { input: 0.14, output: 0.28 }, // Extremely cost-effective
    features: ['reasoning', 'conversational', 'multilingual', 'general_purpose'],
    type: 'chat',
    family: 'deepseek-v2',
    version: 'v2.5'
  },
  'deepseek-coder': {
    name: 'DeepSeek Coder',
    contextWindow: 128000,
    maxOutput: 4096,
    cost: { input: 0.14, output: 0.28 },
    features: ['coding', 'programming', 'debugging', 'code_explanation', 'multi_language'],
    type: 'code',
    family: 'deepseek-coder',
    version: 'v2.0',
    programmingLanguages: [
      'python', 'javascript', 'typescript', 'java', 'cpp', 'c', 'csharp',
      'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'sql',
      'html', 'css', 'bash', 'powershell', 'dockerfile', 'yaml', 'json'
    ]
  },

  // Reasoning models
  'deepseek-reasoner': {
    name: 'DeepSeek Reasoner',
    contextWindow: 64000,
    maxOutput: 4096,
    cost: { input: 0.55, output: 2.19 }, // Higher cost but advanced reasoning
    features: ['advanced_reasoning', 'chain_of_thought', 'logical_analysis', 'problem_solving'],
    type: 'reasoning',
    family: 'deepseek-r1',
    version: 'r1'
  },

  // Math and science models
  'deepseek-math': {
    name: 'DeepSeek Math',
    contextWindow: 32768,
    maxOutput: 4096,
    cost: { input: 0.14, output: 0.28 },
    features: ['mathematics', 'scientific_computation', 'problem_solving', 'step_by_step'],
    type: 'math',
    family: 'deepseek-math',
    version: 'v1.0'
  }
};

/**
 * DeepSeek API endpoints
 */
const DEEPSEEK_ENDPOINTS = {
  chat: '/chat/completions',
  completions: '/completions',
  embeddings: '/embeddings',
  models: '/models'
};

/**
 * DeepSeek adapter with cost optimization
 */
class DeepSeekAdapter extends APILoader {
  constructor(config = {}) {
    super({
      ...config,
      provider: 'deepseek'
    });

    // DeepSeek-specific configuration
    this.baseURL = config.baseURL || 'https://api.deepseek.com/v1';
    
    // Cost optimization features
    this.enableCostOptimization = config.enableCostOptimization !== false;
    this.maxCostPerRequest = config.maxCostPerRequest || 0.01; // $0.01 default limit
    this.enableTokenLimit = config.enableTokenLimit !== false;
    
    // Reasoning features
    this.enableChainOfThought = config.enableChainOfThought || false;
    this.reasoningDepth = config.reasoningDepth || 'medium'; // shallow, medium, deep
    this.enableStepByStep = config.enableStepByStep || false;
    
    // Coding features
    this.codeOutputFormat = config.codeOutputFormat || 'markdown'; // markdown, plain, annotated
    this.enableCodeExplanation = config.enableCodeExplanation || false;
    this.enableDebugging = config.enableDebugging || false;
    
    this.authManager = new AuthManager();
    this.models = new Map();
    this.costTracker = new Map();

    logger.info(`🧠 DeepSeek Adapter initialized (Cost Optimization: ${this.enableCostOptimization})`);
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
   * Load DeepSeek model
   */
  async load(modelId, options = {}) {
    try {
      const modelConfig = DEEPSEEK_MODELS[modelId];
      
      if (!modelConfig) {
        logger.warn(`Unknown DeepSeek model: ${modelId}. Attempting to load anyway.`);
      }

      // Test model availability
      if (options.testConnection !== false) {
        await this.testModelAvailability(modelId, modelConfig);
      }

      const model = {
        id: `deepseek:${modelId}`,
        provider: 'deepseek',
        modelId: modelId,
        type: 'deepseek',
        config: {
          ...options
        },
        metadata: {
          ...modelConfig,
          streaming: true,
          cost_effective: true,
          reasoning_capable: modelConfig?.features?.includes('reasoning') || false,
          coding_capable: modelConfig?.features?.includes('coding') || false,
          loaded: true,
          loadedAt: Date.now()
        }
      };

      this.models.set(modelId, model);
      this.model = model;
      this.loaded = true;

      // Initialize cost tracking
      this.costTracker.set(modelId, {
        totalCost: 0,
        requestCount: 0,
        averageCost: 0
      });

      logger.success(`✅ Loaded DeepSeek model: ${model.id}`);
      return model;

    } catch (error) {
      logger.error(`Failed to load DeepSeek model ${modelId}:`, error);
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
   * Generate completion using DeepSeek
   */
  async complete(prompt, options = {}) {
    const model = options.model || this.model;
    
    if (!model) {
      throw new Error('No model loaded');
    }

    // Cost pre-check
    if (this.enableCostOptimization) {
      const estimatedCost = this.estimateRequestCost(prompt, model, options);
      if (estimatedCost > this.maxCostPerRequest) {
        throw new Error(`Estimated cost ($${estimatedCost.toFixed(4)}) exceeds limit ($${this.maxCostPerRequest})`);
      }
    }

    // Build DeepSeek request
    const request = this.buildDeepSeekRequest(prompt, model, options);
    const endpoint = this.getDeepSeekEndpoint(model);

    try {
      if (options.stream && model.metadata.streaming) {
        return await this.streamCompletion(request, endpoint, model, options);
      } else {
        return await this.standardCompletion(request, endpoint, model, options);
      }
    } catch (error) {
      logger.error(`DeepSeek request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build DeepSeek request
   */
  buildDeepSeekRequest(prompt, model, options) {
    const modelConfig = DEEPSEEK_MODELS[model.modelId];
    
    // Prepare messages based on model type
    let messages = options.messages || [];
    
    if (!messages.length) {
      // Add system prompt based on model type
      const systemPrompt = this.getSystemPrompt(modelConfig, options);
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });
    }

    const request = {
      model: model.modelId,
      messages: messages,
      max_tokens: this.getOptimalMaxTokens(options.maxTokens, modelConfig),
      temperature: this.getOptimalTemperature(options.temperature, modelConfig),
      top_p: options.topP || 0.95,
      frequency_penalty: options.frequencyPenalty || 0,
      presence_penalty: options.presencePenalty || 0
    };

    // Add stop sequences
    if (options.stopSequences && options.stopSequences.length > 0) {
      request.stop = options.stopSequences;
    }

    // Add reasoning parameters for reasoning models
    if (modelConfig?.type === 'reasoning' && this.enableChainOfThought) {
      request.reasoning_depth = this.reasoningDepth;
      request.step_by_step = this.enableStepByStep;
    }

    // Add coding parameters for coding models
    if (modelConfig?.type === 'code') {
      request.code_format = this.codeOutputFormat;
      request.include_explanation = this.enableCodeExplanation;
      request.enable_debugging = this.enableDebugging;
    }

    return request;
  }

  /**
   * Get system prompt based on model type
   */
  getSystemPrompt(modelConfig, options) {
    if (options.systemPrompt) {
      return options.systemPrompt;
    }

    switch (modelConfig?.type) {
      case 'reasoning':
        return this.enableChainOfThought 
          ? 'Think step by step and show your reasoning process clearly.'
          : null;
      
      case 'code':
        return `You are an expert programmer. ${this.enableCodeExplanation ? 'Provide clear explanations for your code.' : ''} ${this.enableDebugging ? 'Help debug issues when encountered.' : ''}`.trim();
      
      case 'math':
        return this.enableStepByStep 
          ? 'Solve mathematical problems step by step, showing all work clearly.'
          : null;
      
      default:
        return null;
    }
  }

  /**
   * Get optimal max tokens based on cost optimization
   */
  getOptimalMaxTokens(requestedTokens, modelConfig) {
    const defaultTokens = requestedTokens || modelConfig?.maxOutput || 1000;
    
    if (!this.enableCostOptimization) {
      return defaultTokens;
    }

    // Reduce tokens for cost optimization while maintaining quality
    const costOptimizedTokens = Math.min(defaultTokens, 2048);
    return costOptimizedTokens;
  }

  /**
   * Get optimal temperature based on model type
   */
  getOptimalTemperature(requestedTemp, modelConfig) {
    if (requestedTemp !== undefined) {
      return requestedTemp;
    }

    switch (modelConfig?.type) {
      case 'reasoning':
      case 'math':
        return 0.1; // Low temperature for logical tasks
      case 'code':
        return 0.2; // Slightly higher for coding creativity
      default:
        return 0.7; // Standard for general chat
    }
  }

  /**
   * Get DeepSeek endpoint
   */
  getDeepSeekEndpoint(model) {
    const modelConfig = DEEPSEEK_MODELS[model.modelId];
    
    // Most models use chat completions
    return `${this.baseURL}${DEEPSEEK_ENDPOINTS.chat}`;
  }

  /**
   * Estimate request cost
   */
  estimateRequestCost(prompt, model, options) {
    const modelConfig = DEEPSEEK_MODELS[model.modelId];
    if (!modelConfig || !modelConfig.cost) return 0;

    // Rough token estimation (4 chars per token average)
    const estimatedInputTokens = Math.ceil(prompt.length / 4);
    const estimatedOutputTokens = options.maxTokens || modelConfig.maxOutput || 1000;
    
    const inputCost = (estimatedInputTokens / 1000000) * modelConfig.cost.input;
    const outputCost = (estimatedOutputTokens / 1000000) * modelConfig.cost.output;
    
    return inputCost + outputCost;
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
      await this.handleDeepSeekError(response);
    }

    const data = await response.json();
    const result = this.parseDeepSeekResponse(data, model);
    
    // Update cost tracking
    this.updateCostTracking(model.modelId, result.cost);
    
    return result;
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
      await this.handleDeepSeekError(response);
    }

    return this.handleDeepSeekStream(response, model);
  }

  /**
   * Handle DeepSeek errors
   */
  async handleDeepSeekError(response) {
    const errorText = await response.text();
    let errorData;
    
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }

    let message = errorData.error?.message || errorData.message || `DeepSeek error (${response.status})`;
    
    // Handle specific DeepSeek errors
    if (response.status === 429) {
      message = 'DeepSeek rate limit exceeded. Please wait before making another request.';
    } else if (response.status === 401) {
      message = 'Invalid DeepSeek API key. Please check your credentials.';
    } else if (response.status === 400 && message.includes('model')) {
      message = `DeepSeek model not available. Please check the model ID.`;
    }

    throw new Error(message);
  }

  /**
   * Parse DeepSeek response
   */
  parseDeepSeekResponse(data, model) {
    const choice = data.choices?.[0];
    const message = choice?.message;
    const text = message?.content || '';
    
    return {
      text,
      model: model.id,
      provider: 'deepseek',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      cost: this.calculateCost(data.usage, model.modelId),
      finishReason: choice?.finish_reason || 'stop',
      metadata: {
        costEffective: true,
        reasoning: model.metadata.reasoning_capable,
        coding: model.metadata.coding_capable,
        family: DEEPSEEK_MODELS[model.modelId]?.family,
        optimized: this.enableCostOptimization
      },
      timestamp: Date.now()
    };
  }

  /**
   * Handle DeepSeek streaming response
   */
  async *handleDeepSeekStream(response, model) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalCost = 0;

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
            // Update cost tracking with final cost
            this.updateCostTracking(model.modelId, totalCost);
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
                provider: 'deepseek',
                chunk: true,
                timestamp: Date.now()
              };
            }
            
            // Handle final chunk with usage data
            if (data.usage) {
              totalCost = this.calculateCost(data.usage, model.modelId);
              yield {
                text: '',
                model: model.id,
                provider: 'deepseek',
                finished: true,
                usage: data.usage,
                cost: totalCost,
                metadata: {
                  costEffective: true,
                  finishReason: choice?.finish_reason
                },
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
   * Calculate cost based on DeepSeek pricing
   */
  calculateCost(usage, modelId) {
    const modelConfig = DEEPSEEK_MODELS[modelId];
    if (!modelConfig || !modelConfig.cost || !usage) return 0;

    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    
    const inputCost = (inputTokens / 1000000) * modelConfig.cost.input;
    const outputCost = (outputTokens / 1000000) * modelConfig.cost.output;
    
    return inputCost + outputCost;
  }

  /**
   * Update cost tracking
   */
  updateCostTracking(modelId, cost) {
    if (!this.costTracker.has(modelId)) return;
    
    const tracker = this.costTracker.get(modelId);
    tracker.totalCost += cost;
    tracker.requestCount += 1;
    tracker.averageCost = tracker.totalCost / tracker.requestCount;
    
    this.costTracker.set(modelId, tracker);
  }

  /**
   * Get cost statistics
   */
  getCostStats(modelId = null) {
    if (modelId) {
      return this.costTracker.get(modelId) || null;
    }
    
    const stats = {};
    for (const [id, tracker] of this.costTracker.entries()) {
      stats[id] = tracker;
    }
    return stats;
  }

  /**
   * List available DeepSeek models
   */
  async listModels() {
    return Object.keys(DEEPSEEK_MODELS).map(id => ({
      id,
      name: DEEPSEEK_MODELS[id].name,
      provider: 'deepseek',
      type: DEEPSEEK_MODELS[id].type,
      family: DEEPSEEK_MODELS[id].family,
      costEffective: true,
      metadata: DEEPSEEK_MODELS[id]
    }));
  }

  /**
   * Get adapter information
   */
  getInfo() {
    return {
      name: 'DeepSeekAdapter',
      version: '1.0.0',
      provider: 'deepseek',
      modelsLoaded: this.models.size,
      features: ['cost_optimization', 'reasoning', 'coding', 'mathematics', 'streaming'],
      capabilities: ['ultra_low_cost', 'chain_of_thought', 'step_by_step_reasoning'],
      costOptimization: this.enableCostOptimization,
      maxCostPerRequest: this.maxCostPerRequest,
      models: Object.keys(DEEPSEEK_MODELS),
      status: this.loaded ? 'ready' : 'initializing'
    };
  }

  /**
   * Unload model
   */
  async unload(modelId) {
    if (this.models.has(modelId)) {
      this.models.delete(modelId);
      this.costTracker.delete(modelId);
      logger.info(`DeepSeek model ${modelId} unloaded`);
      return true;
    }
    return false;
  }

  /**
   * Clean up resources
   */
  async dispose() {
    this.models.clear();
    this.costTracker.clear();
    logger.info('DeepSeek adapter disposed');
  }
}

export default DeepSeekAdapter;