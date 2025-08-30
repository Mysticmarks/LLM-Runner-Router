/**
 * 🧠 Anthropic Adapter
 * Specialized adapter for Claude models
 * Echo AI Systems - Claude API integration
 */

import APILoader from '../APILoader.js';
import { Logger } from '../../utils/Logger.js';

const logger = new Logger('AnthropicAdapter');

/**
 * Claude model configurations
 */
const CLAUDE_MODELS = {
  'claude-3-opus-20240229': {
    contextWindow: 200000,
    maxOutput: 4096,
    cost: { input: 15, output: 75 },
    features: ['vision', 'long_context', 'advanced_reasoning'],
    description: 'Most capable Claude model for complex tasks'
  },
  'claude-3-sonnet-20240229': {
    contextWindow: 200000,
    maxOutput: 4096,
    cost: { input: 3, output: 15 },
    features: ['vision', 'long_context', 'balanced'],
    description: 'Balanced performance and cost'
  },
  'claude-3-haiku-20240307': {
    contextWindow: 200000,
    maxOutput: 4096,
    cost: { input: 0.25, output: 1.25 },
    features: ['vision', 'long_context', 'fast'],
    description: 'Fast and cost-effective'
  },
  'claude-2.1': {
    contextWindow: 200000,
    maxOutput: 4096,
    cost: { input: 8, output: 24 },
    features: ['long_context'],
    description: 'Previous generation with 200k context'
  },
  'claude-2.0': {
    contextWindow: 100000,
    maxOutput: 4096,
    cost: { input: 8, output: 24 },
    features: ['long_context'],
    description: 'Claude 2.0 with 100k context'
  },
  'claude-instant-1.2': {
    contextWindow: 100000,
    maxOutput: 4096,
    cost: { input: 0.8, output: 2.4 },
    features: ['fast', 'efficient'],
    description: 'Fast and affordable'
  }
};

/**
 * Anthropic Claude adapter
 */
class AnthropicAdapter extends APILoader {
  constructor(config = {}) {
    super({
      ...config,
      provider: 'anthropic',
      baseURL: config.baseURL || 'https://api.anthropic.com/v1',
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY
    });
    
    this.anthropicVersion = config.anthropicVersion || '2023-06-01';
    this.anthropicBeta = config.beta || [];
    
    logger.info('🧠 Anthropic Adapter initialized');
  }

  /**
   * Build Anthropic-specific headers
   */
  getHeaders() {
    const headers = {
      'x-api-key': this.apiKey,
      'anthropic-version': this.anthropicVersion,
      'Content-Type': 'application/json'
    };
    
    // Add beta features if specified
    if (this.anthropicBeta.length > 0) {
      headers['anthropic-beta'] = this.anthropicBeta.join(',');
    }
    
    return headers;
  }

  /**
   * Load Claude model with enhanced metadata
   */
  async load(modelId = 'claude-3-haiku-20240307', options = {}) {
    const modelConfig = CLAUDE_MODELS[modelId];
    
    if (!modelConfig) {
      logger.warn(`Unknown Claude model: ${modelId}. Using default config.`);
    }
    
    const model = await super.load(modelId, {
      ...options,
      metadata: {
        ...modelConfig,
        provider: 'anthropic',
        streaming: true,
        ...options.metadata
      }
    });
    
    return model;
  }

  /**
   * Claude-specific completion
   */
  async complete(prompt, options = {}) {
    // Build messages array
    let messages = options.messages;
    if (!messages) {
      messages = [{ role: 'user', content: prompt }];
    }
    
    // Ensure proper message format for Claude
    messages = this.formatMessages(messages);
    
    const request = {
      model: options.model?.modelId || 'claude-3-haiku-20240307',
      messages: messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP,
      top_k: options.topK,
      stream: options.stream ?? false
    };
    
    // Add system prompt if provided
    if (options.system) {
      request.system = options.system;
    }
    
    // Add metadata for tracking
    if (options.metadata) {
      request.metadata = options.metadata;
    }
    
    // Add stop sequences
    if (options.stopSequences) {
      request.stop_sequences = options.stopSequences;
    }
    
    return this.executeRequest(request, options);
  }

  /**
   * Format messages for Claude API
   */
  formatMessages(messages) {
    // Claude requires alternating user/assistant messages
    const formatted = [];
    let lastRole = null;
    
    for (const msg of messages) {
      // Handle different content types
      let content = msg.content;
      
      // Convert image data if present
      if (msg.image) {
        content = [
          { type: 'text', text: msg.content || '' },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: msg.image.media_type || 'image/jpeg',
              data: msg.image.data
            }
          }
        ];
      } else if (typeof content === 'string') {
        content = [{ type: 'text', text: content }];
      }
      
      // Ensure alternating roles
      if (msg.role === lastRole) {
        // Merge with previous message if same role
        if (formatted.length > 0) {
          const last = formatted[formatted.length - 1];
          if (Array.isArray(last.content) && Array.isArray(content)) {
            last.content.push(...content);
          }
        }
      } else {
        formatted.push({
          role: msg.role,
          content: content
        });
        lastRole = msg.role;
      }
    }
    
    // Ensure first message is from user
    if (formatted[0]?.role !== 'user') {
      formatted.unshift({
        role: 'user',
        content: [{ type: 'text', text: 'Continue' }]
      });
    }
    
    return formatted;
  }

  /**
   * Execute Anthropic API request
   */
  async executeRequest(request, options = {}) {
    const endpoint = `${this.baseURL}/messages`;
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
      }
      
      if (request.stream) {
        return this.handleStream(response);
      } else {
        const data = await response.json();
        return this.formatResponse(data);
      }
      
    } catch (error) {
      logger.error('Anthropic request failed:', error);
      
      // Handle rate limits
      if (error.message?.includes('rate_limit')) {
        const retryAfter = error.retry_after || 60;
        logger.warn(`Rate limited. Retry after ${retryAfter}s`);
        
        if (options.autoRetry) {
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          return this.executeRequest(request, options);
        }
      }
      
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
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'content_block_delta') {
                const text = parsed.delta?.text;
                if (text) {
                  yield { text, raw: parsed };
                }
              } else if (parsed.type === 'message_stop') {
                return;
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
   * Format Anthropic response
   */
  formatResponse(data) {
    const content = data.content?.[0];
    
    return {
      text: content?.text || '',
      type: content?.type,
      id: data.id,
      model: data.model,
      role: data.role,
      stopReason: data.stop_reason,
      stopSequence: data.stop_sequence,
      usage: {
        promptTokens: data.usage?.input_tokens,
        completionTokens: data.usage?.output_tokens,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      }
    };
  }

  /**
   * Count tokens (approximate)
   */
  async countTokens(text, modelId) {
    // Claude uses roughly 1 token per 4 characters
    // This is an approximation - Anthropic doesn't provide a token counting API
    const approxTokens = Math.ceil(text.length / 4);
    
    return {
      tokens: approxTokens,
      model: modelId,
      method: 'approximation',
      note: 'Anthropic does not provide exact token counting'
    };
  }

  /**
   * List available models
   */
  async listModels() {
    // Anthropic doesn't provide a models endpoint, return known models
    return Object.keys(CLAUDE_MODELS).map(id => ({
      id,
      ...CLAUDE_MODELS[id]
    }));
  }

  /**
   * Get model information
   */
  getModelInfo(modelId) {
    return CLAUDE_MODELS[modelId] || {
      contextWindow: 100000,
      maxOutput: 4096,
      cost: { input: 0, output: 0 },
      features: [],
      description: 'Unknown Claude model'
    };
  }

  /**
   * Calculate token cost
   */
  calculateCost(usage, modelId) {
    const modelInfo = this.getModelInfo(modelId);
    const inputCost = (usage.promptTokens / 1000000) * modelInfo.cost.input;
    const outputCost = (usage.completionTokens / 1000000) * modelInfo.cost.output;
    
    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: 'USD'
    };
  }

  /**
   * Create a vision-enabled message
   */
  createVisionMessage(text, imageData, mediaType = 'image/jpeg') {
    return {
      role: 'user',
      content: [
        { type: 'text', text },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: imageData
          }
        }
      ]
    };
  }

  /**
   * Check if model supports vision
   */
  supportsVision(modelId) {
    const modelInfo = this.getModelInfo(modelId);
    return modelInfo.features?.includes('vision') || false;
  }
}

export default AnthropicAdapter;