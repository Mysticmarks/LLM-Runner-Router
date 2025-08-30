/**
 * 🌐 OpenRouter Adapter
 * Unified API access to multiple LLM providers
 * Echo AI Systems - One API, all models
 */

import APILoader from '../APILoader.js';
import { Logger } from '../../utils/Logger.js';

const logger = new Logger('OpenRouterAdapter');

/**
 * Popular OpenRouter models
 */
const POPULAR_MODELS = {
  'openai/gpt-4-turbo-preview': {
    contextWindow: 128000,
    provider: 'OpenAI',
    speed: 'medium',
    intelligence: 'very_high'
  },
  'anthropic/claude-3-opus': {
    contextWindow: 200000,
    provider: 'Anthropic',
    speed: 'medium',
    intelligence: 'very_high'
  },
  'google/gemini-pro': {
    contextWindow: 32000,
    provider: 'Google',
    speed: 'fast',
    intelligence: 'high'
  },
  'meta-llama/llama-3-70b-instruct': {
    contextWindow: 8192,
    provider: 'Meta',
    speed: 'medium',
    intelligence: 'high'
  },
  'mistralai/mixtral-8x7b-instruct': {
    contextWindow: 32000,
    provider: 'Mistral',
    speed: 'fast',
    intelligence: 'high'
  },
  'cohere/command-r-plus': {
    contextWindow: 128000,
    provider: 'Cohere',
    speed: 'medium',
    intelligence: 'high'
  },
  'perplexity/sonar-medium-online': {
    contextWindow: 16000,
    provider: 'Perplexity',
    speed: 'fast',
    intelligence: 'high',
    features: ['web_search']
  }
};

/**
 * OpenRouter unified adapter
 */
class OpenRouterAdapter extends APILoader {
  constructor(config = {}) {
    super({
      ...config,
      provider: 'openrouter',
      baseURL: config.baseURL || 'https://openrouter.ai/api/v1',
      apiKey: config.apiKey || process.env.OPENROUTER_API_KEY
    });
    
    this.appName = config.appName || 'LLM-Runner-Router';
    this.siteUrl = config.siteUrl || 'https://github.com/MCERQUA/LLM-Runner-Router';
    this.models = new Map();
    this.providers = new Set();
    
    logger.info('🌐 OpenRouter Adapter initialized');
  }

  /**
   * Build OpenRouter-specific headers
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': this.siteUrl,
      'X-Title': this.appName
    };
  }

  /**
   * Fetch and cache available models
   */
  async fetchAvailableModels() {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }
      
      const data = await response.json();
      
      // Cache models and providers
      this.models.clear();
      this.providers.clear();
      
      for (const model of data.data) {
        this.models.set(model.id, {
          id: model.id,
          name: model.name,
          description: model.description,
          contextLength: model.context_length,
          pricing: {
            prompt: model.pricing?.prompt || 0,
            completion: model.pricing?.completion || 0
          },
          topProvider: model.top_provider,
          perRequestLimits: model.per_request_limits
        });
        
        if (model.top_provider) {
          this.providers.add(model.top_provider);
        }
      }
      
      logger.info(`📚 Loaded ${this.models.size} models from ${this.providers.size} providers`);
      return Array.from(this.models.values());
      
    } catch (error) {
      logger.warn('Failed to fetch live models, using defaults');
      return Object.keys(POPULAR_MODELS).map(id => ({
        id,
        ...POPULAR_MODELS[id]
      }));
    }
  }

  /**
   * Load OpenRouter model
   */
  async load(modelId = 'auto', options = {}) {
    // Fetch available models if not cached
    if (this.models.size === 0) {
      await this.fetchAvailableModels();
    }
    
    // Special handling for 'auto' mode
    if (modelId === 'auto') {
      logger.info('Using OpenRouter auto mode for optimal model selection');
    } else if (!modelId.includes('/')) {
      // Try to find model by partial match
      const matches = Array.from(this.models.keys()).filter(id => 
        id.toLowerCase().includes(modelId.toLowerCase())
      );
      
      if (matches.length === 1) {
        modelId = matches[0];
      } else if (matches.length > 1) {
        logger.warn(`Multiple models match "${modelId}":`, matches);
        modelId = matches[0];
      }
    }
    
    const modelInfo = this.models.get(modelId) || POPULAR_MODELS[modelId];
    
    const model = await super.load(modelId, {
      ...options,
      metadata: {
        ...modelInfo,
        provider: 'openrouter',
        streaming: true,
        ...options.metadata
      }
    });
    
    return model;
  }

  /**
   * OpenRouter completion with provider preferences
   */
  async complete(prompt, options = {}) {
    const request = {
      model: options.model?.modelId || 'auto',
      messages: options.messages || [{ role: 'user', content: prompt }],
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      top_p: options.topP,
      top_k: options.topK,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      repetition_penalty: options.repetitionPenalty,
      stream: options.stream ?? false
    };
    
    // OpenRouter-specific options
    if (options.providers) {
      request.providers = options.providers;
    }
    
    if (options.route) {
      request.route = options.route; // 'fallback' or specific routing
    }
    
    if (options.transforms) {
      request.transforms = options.transforms; // ['middle-out'] for compression
    }
    
    return this.executeRequest(request, options);
  }

  /**
   * Execute OpenRouter API request
   */
  async executeRequest(request, options = {}) {
    const endpoint = `${this.baseURL}/chat/completions`;
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenRouter API error: ${error.error?.message || response.statusText}`);
      }
      
      // Get model used from headers
      const modelUsed = response.headers.get('X-Model') || request.model;
      
      if (request.stream) {
        return this.handleStream(response, modelUsed);
      } else {
        const data = await response.json();
        return this.formatResponse(data, modelUsed);
      }
      
    } catch (error) {
      logger.error('OpenRouter request failed:', error);
      throw error;
    }
  }

  /**
   * Handle streaming response
   */
  async* handleStream(response, modelUsed) {
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
                  model: modelUsed,
                  raw: parsed 
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
   * Format OpenRouter response
   */
  formatResponse(data, modelUsed) {
    const choice = data.choices?.[0];
    
    return {
      text: choice?.message?.content || '',
      model: modelUsed || data.model,
      provider: data.provider,
      finishReason: choice?.finish_reason,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens
      },
      id: data.id,
      created: data.created
    };
  }

  /**
   * Get provider-specific limits
   */
  async getLimits() {
    try {
      const response = await fetch(`${this.baseURL}/auth/key`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch limits');
      }
      
      const data = await response.json();
      
      return {
        limit: data.limit,
        usage: data.usage,
        isFreeTier: data.is_free_tier,
        limitRemaining: data.limit_remaining,
        rateLimit: data.rate_limit
      };
      
    } catch (error) {
      logger.warn('Failed to fetch limits:', error);
      return null;
    }
  }

  /**
   * List models by provider
   */
  async listModelsByProvider(provider) {
    if (this.models.size === 0) {
      await this.fetchAvailableModels();
    }
    
    const providerModels = [];
    for (const [id, model] of this.models) {
      if (model.topProvider === provider || id.startsWith(provider.toLowerCase())) {
        providerModels.push(model);
      }
    }
    
    return providerModels;
  }

  /**
   * Get cheapest model for requirements
   */
  async getCheapestModel(requirements = {}) {
    if (this.models.size === 0) {
      await this.fetchAvailableModels();
    }
    
    let cheapest = null;
    let lowestCost = Infinity;
    
    for (const model of this.models.values()) {
      // Check requirements
      if (requirements.minContext && model.contextLength < requirements.minContext) {
        continue;
      }
      
      const totalCost = (model.pricing?.prompt || 0) + (model.pricing?.completion || 0);
      if (totalCost < lowestCost) {
        lowestCost = totalCost;
        cheapest = model;
      }
    }
    
    return cheapest;
  }

  /**
   * Get fastest model
   */
  async getFastestModel(requirements = {}) {
    // OpenRouter doesn't provide speed metrics, use heuristics
    const fastModels = [
      'openrouter/auto',
      'google/gemini-flash',
      'mistralai/mistral-7b-instruct',
      'meta-llama/llama-3-8b-instruct'
    ];
    
    if (this.models.size === 0) {
      await this.fetchAvailableModels();
    }
    
    for (const modelId of fastModels) {
      if (this.models.has(modelId)) {
        return this.models.get(modelId);
      }
    }
    
    // Return first available model
    return this.models.values().next().value;
  }

  /**
   * Calculate generation cost
   */
  calculateCost(usage, modelId) {
    const model = this.models.get(modelId);
    if (!model?.pricing) {
      return {
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
        currency: 'USD',
        note: 'Pricing not available'
      };
    }
    
    const inputCost = (usage.promptTokens / 1000000) * (model.pricing.prompt || 0);
    const outputCost = (usage.completionTokens / 1000000) * (model.pricing.completion || 0);
    
    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: 'USD',
      model: modelId,
      provider: model.topProvider
    };
  }

  /**
   * Get model recommendations
   */
  async getRecommendations(useCase) {
    const recommendations = {
      'coding': ['anthropic/claude-3-opus', 'openai/gpt-4-turbo-preview'],
      'chat': ['anthropic/claude-3-haiku', 'openai/gpt-3.5-turbo'],
      'creative': ['anthropic/claude-3-opus', 'openai/gpt-4'],
      'analysis': ['anthropic/claude-3-sonnet', 'google/gemini-pro'],
      'translation': ['google/gemini-pro', 'anthropic/claude-3-haiku'],
      'summarization': ['mistralai/mixtral-8x7b-instruct', 'anthropic/claude-3-haiku'],
      'fast': ['mistralai/mistral-7b-instruct', 'meta-llama/llama-3-8b-instruct'],
      'cheap': ['meta-llama/llama-3-8b-instruct', 'mistralai/mistral-7b-instruct']
    };
    
    return recommendations[useCase] || ['openrouter/auto'];
  }
}

export default OpenRouterAdapter;