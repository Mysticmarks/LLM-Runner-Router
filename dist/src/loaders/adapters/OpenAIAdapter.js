/**
 * 🤖 OpenAI Adapter
 * Specialized adapter for OpenAI GPT models
 * Echo AI Systems - Seamless GPT integration
 */

import APILoader from '../APILoader.js';
import { Logger } from '../../utils/Logger.js';

const logger = new Logger('OpenAIAdapter');

/**
 * OpenAI model configurations
 */
const OPENAI_MODELS = {
  'gpt-4-turbo-preview': {
    contextWindow: 128000,
    maxOutput: 4096,
    cost: { input: 10, output: 30 },
    features: ['vision', 'function_calling', 'json_mode'],
    description: 'Most capable GPT-4 Turbo model with vision'
  },
  'gpt-4-0125-preview': {
    contextWindow: 128000,
    maxOutput: 4096,
    cost: { input: 10, output: 30 },
    features: ['function_calling', 'json_mode'],
    description: 'Latest GPT-4 Turbo preview'
  },
  'gpt-4': {
    contextWindow: 8192,
    maxOutput: 4096,
    cost: { input: 30, output: 60 },
    features: ['function_calling'],
    description: 'Standard GPT-4 model'
  },
  'gpt-4-32k': {
    contextWindow: 32768,
    maxOutput: 4096,
    cost: { input: 60, output: 120 },
    features: ['function_calling'],
    description: 'GPT-4 with extended context'
  },
  'gpt-3.5-turbo': {
    contextWindow: 16385,
    maxOutput: 4096,
    cost: { input: 0.5, output: 1.5 },
    features: ['function_calling'],
    description: 'Fast and efficient GPT-3.5'
  },
  'gpt-3.5-turbo-16k': {
    contextWindow: 16385,
    maxOutput: 4096,
    cost: { input: 3, output: 4 },
    features: ['function_calling'],
    description: 'GPT-3.5 with 16k context'
  }
};

/**
 * OpenAI-specific adapter
 */
class OpenAIAdapter extends APILoader {
  constructor(config = {}) {
    super({
      ...config,
      provider: 'openai',
      baseURL: config.baseURL || 'https://api.openai.com/v1',
      apiKey: config.apiKey || process.env.OPENAI_API_KEY
    });
    
    this.organization = config.organization || process.env.OPENAI_ORG_ID;
    
    logger.info('🤖 OpenAI Adapter initialized');
  }

  /**
   * Build OpenAI-specific headers
   */
  getHeaders() {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
    
    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }
    
    return headers;
  }

  /**
   * Load OpenAI model with enhanced metadata
   */
  async load(modelId = 'gpt-3.5-turbo', options = {}) {
    const modelConfig = OPENAI_MODELS[modelId];
    
    if (!modelConfig) {
      logger.warn(`Unknown OpenAI model: ${modelId}. Using default config.`);
    }
    
    const model = await super.load(modelId, {
      ...options,
      metadata: {
        ...modelConfig,
        provider: 'openai',
        streaming: true,
        ...options.metadata
      }
    });
    
    return model;
  }

  /**
   * OpenAI-specific completion with function calling
   */
  async complete(prompt, options = {}) {
    const request = {
      model: options.model?.modelId || 'gpt-3.5-turbo',
      messages: options.messages || [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      top_p: options.topP ?? 1,
      frequency_penalty: options.frequencyPenalty ?? 0,
      presence_penalty: options.presencePenalty ?? 0,
      stream: options.stream ?? false
    };
    
    // Add function calling if specified
    if (options.functions) {
      request.functions = options.functions;
      if (options.functionCall) {
        request.function_call = options.functionCall;
      }
    }
    
    // Add response format for JSON mode
    if (options.responseFormat) {
      request.response_format = options.responseFormat;
    }
    
    // Add seed for reproducibility
    if (options.seed !== undefined) {
      request.seed = options.seed;
    }
    
    // Add tools (new function calling format)
    if (options.tools) {
      request.tools = options.tools;
      if (options.toolChoice) {
        request.tool_choice = options.toolChoice;
      }
    }
    
    return this.executeRequest(request, options);
  }

  /**
   * Execute OpenAI API request
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
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }
      
      if (request.stream) {
        return this.handleStream(response);
      } else {
        const data = await response.json();
        return this.formatResponse(data);
      }
      
    } catch (error) {
      logger.error('OpenAI request failed:', error);
      throw error;
    }
  }

  /**
   * Handle streaming response
   */
  async* handleStream(response) {
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
                yield { text: content, raw: parsed };
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
   * Format OpenAI response
   */
  formatResponse(data) {
    const choice = data.choices?.[0];
    
    return {
      text: choice?.message?.content || '',
      functionCall: choice?.message?.function_call,
      toolCalls: choice?.message?.tool_calls,
      finishReason: choice?.finish_reason,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens
      },
      model: data.model,
      id: data.id,
      created: data.created
    };
  }

  /**
   * Create embeddings
   */
  async createEmbedding(input, options = {}) {
    const request = {
      model: options.model || 'text-embedding-ada-002',
      input: input,
      encoding_format: options.encodingFormat || 'float'
    };
    
    const response = await fetch(`${this.baseURL}/embeddings`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Embedding error: ${error.error?.message}`);
    }
    
    const data = await response.json();
    return {
      embeddings: data.data.map(d => d.embedding),
      usage: data.usage,
      model: data.model
    };
  }

  /**
   * Moderate content
   */
  async moderate(input, options = {}) {
    const request = {
      model: options.model || 'text-moderation-latest',
      input: input
    };
    
    const response = await fetch(`${this.baseURL}/moderations`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Moderation error: ${error.error?.message}`);
    }
    
    const data = await response.json();
    return data.results;
  }

  /**
   * List available models
   */
  async listModels() {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }
      
      const data = await response.json();
      const gptModels = data.data
        .filter(m => m.id.includes('gpt'))
        .map(m => ({
          id: m.id,
          owned_by: m.owned_by,
          created: m.created,
          ...OPENAI_MODELS[m.id]
        }));
      
      return gptModels;
    } catch (error) {
      logger.warn('Failed to fetch live models, using defaults');
      return Object.keys(OPENAI_MODELS).map(id => ({
        id,
        ...OPENAI_MODELS[id]
      }));
    }
  }

  /**
   * Get model information
   */
  getModelInfo(modelId) {
    return OPENAI_MODELS[modelId] || {
      contextWindow: 4096,
      maxOutput: 4096,
      cost: { input: 0, output: 0 },
      features: [],
      description: 'Unknown model'
    };
  }

  /**
   * Calculate token cost
   */
  calculateCost(usage, modelId) {
    const modelInfo = this.getModelInfo(modelId);
    const inputCost = (usage.promptTokens / 1000) * modelInfo.cost.input;
    const outputCost = (usage.completionTokens / 1000) * modelInfo.cost.output;
    
    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: 'USD'
    };
  }
}

export default OpenAIAdapter;