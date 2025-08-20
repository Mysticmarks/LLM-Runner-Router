/**
 * 🌐 Perplexity AI Adapter
 * Web-aware adapter for Perplexity's real-time information models
 * Features: Real-time web search, citation support, factual accuracy
 */

import APILoader from '../APILoader.js';
import { Logger } from '../../utils/Logger.js';
import { AuthManager } from '../../utils/AuthManager.js';

const logger = new Logger('PerplexityAdapter');

/**
 * Perplexity model configurations
 */
const PERPLEXITY_MODELS = {
  // Sonar models (Web-aware)
  'llama-3.1-sonar-small-128k-online': {
    name: 'Llama 3.1 Sonar Small 128K Online',
    contextWindow: 127072,
    maxOutput: 4096,
    cost: { input: 0.2, output: 0.2 },
    features: ['web_search', 'real_time', 'citations', 'factual'],
    type: 'sonar',
    family: 'llama',
    version: '3.1',
    webEnabled: true
  },
  'llama-3.1-sonar-large-128k-online': {
    name: 'Llama 3.1 Sonar Large 128K Online',
    contextWindow: 127072,
    maxOutput: 4096,
    cost: { input: 1.0, output: 1.0 },
    features: ['web_search', 'real_time', 'citations', 'factual', 'advanced_reasoning'],
    type: 'sonar',
    family: 'llama',
    version: '3.1',
    webEnabled: true
  },
  'llama-3.1-sonar-huge-128k-online': {
    name: 'Llama 3.1 Sonar Huge 128K Online',
    contextWindow: 127072,
    maxOutput: 4096,
    cost: { input: 5.0, output: 5.0 },
    features: ['web_search', 'real_time', 'citations', 'factual', 'premium_reasoning'],
    type: 'sonar',
    family: 'llama',
    version: '3.1',
    webEnabled: true
  },

  // Chat models (Without web search)
  'llama-3.1-sonar-small-128k-chat': {
    name: 'Llama 3.1 Sonar Small 128K Chat',
    contextWindow: 131072,
    maxOutput: 4096,
    cost: { input: 0.2, output: 0.2 },
    features: ['conversational', 'reasoning', 'knowledge_cutoff'],
    type: 'chat',
    family: 'llama',
    version: '3.1',
    webEnabled: false
  },
  'llama-3.1-sonar-large-128k-chat': {
    name: 'Llama 3.1 Sonar Large 128K Chat',
    contextWindow: 131072,
    maxOutput: 4096,
    cost: { input: 1.0, output: 1.0 },
    features: ['conversational', 'advanced_reasoning', 'knowledge_cutoff'],
    type: 'chat',
    family: 'llama',
    version: '3.1',
    webEnabled: false
  },
  'llama-3.1-sonar-huge-128k-chat': {
    name: 'Llama 3.1 Sonar Huge 128K Chat',
    contextWindow: 131072,
    maxOutput: 4096,
    cost: { input: 5.0, output: 5.0 },
    features: ['conversational', 'premium_reasoning', 'knowledge_cutoff'],
    type: 'chat',
    family: 'llama',
    version: '3.1',
    webEnabled: false
  },

  // Legacy models
  'llama-3-sonar-small-32k-online': {
    name: 'Llama 3 Sonar Small 32K Online',
    contextWindow: 32768,
    maxOutput: 4096,
    cost: { input: 0.2, output: 0.2 },
    features: ['web_search', 'real_time', 'citations'],
    type: 'sonar',
    family: 'llama',
    version: '3.0',
    webEnabled: true
  },
  'llama-3-sonar-large-32k-online': {
    name: 'Llama 3 Sonar Large 32K Online',
    contextWindow: 32768,
    maxOutput: 4096,
    cost: { input: 1.0, output: 1.0 },
    features: ['web_search', 'real_time', 'citations', 'advanced_reasoning'],
    type: 'sonar',
    family: 'llama',
    version: '3.0',
    webEnabled: true
  },
  'llama-3-sonar-small-32k-chat': {
    name: 'Llama 3 Sonar Small 32K Chat',
    contextWindow: 32768,
    maxOutput: 4096,
    cost: { input: 0.2, output: 0.2 },
    features: ['conversational', 'reasoning'],
    type: 'chat',
    family: 'llama',
    version: '3.0',
    webEnabled: false
  },
  'llama-3-sonar-large-32k-chat': {
    name: 'Llama 3 Sonar Large 32K Chat',
    contextWindow: 32768,
    maxOutput: 4096,
    cost: { input: 1.0, output: 1.0 },
    features: ['conversational', 'advanced_reasoning'],
    type: 'chat',
    family: 'llama',
    version: '3.0',
    webEnabled: false
  },

  // Open-source models
  'llama-3.1-8b-instruct': {
    name: 'Llama 3.1 8B Instruct',
    contextWindow: 131072,
    maxOutput: 4096,
    cost: { input: 0.2, output: 0.2 },
    features: ['instruct', 'open_source', 'efficient'],
    type: 'instruct',
    family: 'llama',
    version: '3.1',
    webEnabled: false
  },
  'llama-3.1-70b-instruct': {
    name: 'Llama 3.1 70B Instruct',
    contextWindow: 131072,
    maxOutput: 4096,
    cost: { input: 1.0, output: 1.0 },
    features: ['instruct', 'open_source', 'high_performance'],
    type: 'instruct',
    family: 'llama',
    version: '3.1',
    webEnabled: false
  }
};

/**
 * Perplexity AI adapter with web search capabilities
 */
class PerplexityAdapter extends APILoader {
  constructor(config = {}) {
    super({
      ...config,
      provider: 'perplexity'
    });

    // Perplexity-specific configuration
    this.baseURL = config.baseURL || 'https://api.perplexity.ai';
    
    // Web search features
    this.enableWebSearch = config.enableWebSearch !== false;
    this.enableCitations = config.enableCitations !== false;
    this.maxSearchResults = config.maxSearchResults || 10;
    this.searchTimeout = config.searchTimeout || 30000; // 30 seconds
    
    // Quality settings
    this.factualAccuracy = config.factualAccuracy || 'high'; // low, medium, high
    this.recentness = config.recentness || 'auto'; // auto, recent, any
    this.domainFilter = config.domainFilter || []; // Filter to specific domains
    
    this.authManager = new AuthManager();
    this.models = new Map();
    this.searchCache = new Map();

    logger.info(`🌐 Perplexity AI Adapter initialized (Web Search: ${this.enableWebSearch})`);
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
   * Load Perplexity model
   */
  async load(modelId, options = {}) {
    try {
      const modelConfig = PERPLEXITY_MODELS[modelId];
      
      if (!modelConfig) {
        logger.warn(`Unknown Perplexity model: ${modelId}. Attempting to load anyway.`);
      }

      // Test model availability
      if (options.testConnection !== false) {
        await this.testModelAvailability(modelId, modelConfig);
      }

      const model = {
        id: `perplexity:${modelId}`,
        provider: 'perplexity',
        modelId: modelId,
        type: 'perplexity',
        config: {
          ...options
        },
        metadata: {
          ...modelConfig,
          streaming: true,
          web_aware: modelConfig?.webEnabled || false,
          real_time: modelConfig?.features?.includes('real_time') || false,
          citations: modelConfig?.features?.includes('citations') || false,
          loaded: true,
          loadedAt: Date.now()
        }
      };

      this.models.set(modelId, model);
      this.model = model;
      this.loaded = true;

      logger.success(`✅ Loaded Perplexity model: ${model.id}`);
      return model;

    } catch (error) {
      logger.error(`Failed to load Perplexity model ${modelId}:`, error);
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
   * Generate completion using Perplexity
   */
  async complete(prompt, options = {}) {
    const model = options.model || this.model;
    
    if (!model) {
      throw new Error('No model loaded');
    }

    // Build Perplexity request
    const request = this.buildPerplexityRequest(prompt, model, options);
    const endpoint = `${this.baseURL}/chat/completions`;

    try {
      if (options.stream && model.metadata.streaming) {
        return await this.streamCompletion(request, endpoint, model, options);
      } else {
        return await this.standardCompletion(request, endpoint, model, options);
      }
    } catch (error) {
      logger.error(`Perplexity request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build Perplexity request
   */
  buildPerplexityRequest(prompt, model, options) {
    const modelConfig = PERPLEXITY_MODELS[model.modelId];
    
    const messages = options.messages || [
      { role: 'user', content: prompt }
    ];

    const request = {
      model: model.modelId,
      messages: messages,
      max_tokens: options.maxTokens || modelConfig?.maxOutput || 1000,
      temperature: options.temperature || 0.2, // Lower for factual accuracy
      top_p: options.topP || 0.9,
      top_k: options.topK,
      presence_penalty: options.presencePenalty || 0,
      frequency_penalty: options.frequencyPenalty || 1
    };

    // Add web search parameters for Sonar models
    if (modelConfig?.webEnabled && this.enableWebSearch) {
      request.search_domain_filter = this.domainFilter;
      request.search_recency_filter = this.recentness;
      request.return_citations = this.enableCitations;
      request.return_images = options.returnImages || false;
      request.return_related_questions = options.returnRelatedQuestions || false;
    }

    // Stop sequences
    if (options.stopSequences && options.stopSequences.length > 0) {
      request.stop = options.stopSequences;
    }

    return request;
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
      await this.handlePerplexityError(response);
    }

    const data = await response.json();
    return this.parsePerplexityResponse(data, model);
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
      await this.handlePerplexityError(response);
    }

    return this.handlePerplexityStream(response, model);
  }

  /**
   * Handle Perplexity errors
   */
  async handlePerplexityError(response) {
    const errorText = await response.text();
    let errorData;
    
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }

    let message = errorData.error?.message || errorData.message || `Perplexity error (${response.status})`;
    
    // Handle specific Perplexity errors
    if (response.status === 429) {
      message = 'Perplexity rate limit exceeded. Please wait before making another request.';
    } else if (response.status === 401) {
      message = 'Invalid Perplexity API key. Please check your credentials.';
    } else if (response.status === 400 && message.includes('model')) {
      message = `Model not available or invalid. Please check the model ID.`;
    }

    throw new Error(message);
  }

  /**
   * Parse Perplexity response
   */
  parsePerplexityResponse(data, model) {
    const choice = data.choices?.[0];
    const message = choice?.message;
    const text = message?.content || '';
    
    return {
      text,
      model: model.id,
      provider: 'perplexity',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      cost: this.calculateCost(data.usage, model.modelId),
      finishReason: choice?.finish_reason || 'stop',
      metadata: {
        citations: data.citations || [],
        webSearched: model.metadata.web_aware && this.enableWebSearch,
        searchResults: data.web_extra?.searched_results || [],
        relatedQuestions: data.web_extra?.related_questions || [],
        factualScore: this.calculateFactualScore(data),
        recency: this.recentness,
        searchDomains: this.domainFilter
      },
      timestamp: Date.now()
    };
  }

  /**
   * Handle Perplexity streaming response
   */
  async *handlePerplexityStream(response, model) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalText = '';

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
              totalText += content;
              yield {
                text: content,
                model: model.id,
                provider: 'perplexity',
                chunk: true,
                totalText,
                timestamp: Date.now()
              };
            }
            
            // Handle final chunk with metadata
            if (choice?.finish_reason) {
              yield {
                text: '',
                model: model.id,
                provider: 'perplexity',
                finished: true,
                usage: data.usage || {},
                cost: this.calculateCost(data.usage, model.modelId),
                metadata: {
                  citations: data.citations || [],
                  webSearched: model.metadata.web_aware && this.enableWebSearch,
                  finishReason: choice.finish_reason
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
   * Calculate factual score based on citations and web search
   */
  calculateFactualScore(data) {
    if (!data.citations || !data.citations.length) {
      return 0.5; // No citations available
    }

    // Simple scoring based on number and quality of citations
    const citationCount = data.citations.length;
    const maxCitations = 10;
    const baseScore = Math.min(citationCount / maxCitations, 1.0);
    
    // Bonus for recent information
    const hasRecentInfo = data.web_extra?.searched_results?.some(result => 
      new Date(result.published_date || 0) > new Date(Date.now() - 86400000) // 24 hours
    );
    
    return hasRecentInfo ? Math.min(baseScore + 0.1, 1.0) : baseScore;
  }

  /**
   * Calculate cost based on Perplexity pricing
   */
  calculateCost(usage, modelId) {
    const modelConfig = PERPLEXITY_MODELS[modelId];
    if (!modelConfig || !modelConfig.cost || !usage) return 0;

    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    
    const inputCost = (inputTokens / 1000000) * modelConfig.cost.input;
    const outputCost = (outputTokens / 1000000) * modelConfig.cost.output;
    
    return inputCost + outputCost;
  }

  /**
   * List available Perplexity models
   */
  async listModels() {
    return Object.keys(PERPLEXITY_MODELS).map(id => ({
      id,
      name: PERPLEXITY_MODELS[id].name,
      provider: 'perplexity',
      type: PERPLEXITY_MODELS[id].type,
      webEnabled: PERPLEXITY_MODELS[id].webEnabled,
      metadata: PERPLEXITY_MODELS[id]
    }));
  }

  /**
   * Get adapter information
   */
  getInfo() {
    return {
      name: 'PerplexityAdapter',
      version: '1.0.0',
      provider: 'perplexity',
      modelsLoaded: this.models.size,
      features: ['web_search', 'real_time_info', 'citations', 'factual_accuracy', 'streaming'],
      capabilities: ['sonar_models', 'chat_models', 'instruct_models'],
      webSearchEnabled: this.enableWebSearch,
      citationsEnabled: this.enableCitations,
      models: Object.keys(PERPLEXITY_MODELS),
      status: this.loaded ? 'ready' : 'initializing'
    };
  }

  /**
   * Unload model
   */
  async unload(modelId) {
    if (this.models.has(modelId)) {
      this.models.delete(modelId);
      logger.info(`Perplexity model ${modelId} unloaded`);
      return true;
    }
    return false;
  }

  /**
   * Clean up resources
   */
  async dispose() {
    this.models.clear();
    this.searchCache.clear();
    logger.info('Perplexity adapter disposed');
  }
}

export default PerplexityAdapter;