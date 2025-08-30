/**
 * 🦙 Ollama Adapter
 * Specialized adapter for Ollama local models
 * Echo AI Systems - Local model orchestration
 */

import APILoader from '../APILoader.js';
import { Logger } from '../../utils/Logger.js';
import { EventEmitter } from 'events';

const logger = new Logger('OllamaAdapter');

/**
 * Ollama model configurations
 */
const OLLAMA_MODELS = {
  'qwen2.5:3b-instruct-q4_K_M': {
    contextWindow: 32768,
    maxOutput: 8192,
    cost: { input: 0, output: 0 }, // Local models are free
    features: ['chat', 'instruct', 'streaming'],
    description: 'Qwen2.5 3B instruct model, quantized Q4_K_M',
    parameters: '3B',
    architecture: 'Qwen2.5'
  },
  'phi3:mini': {
    contextWindow: 128000,
    maxOutput: 4096,
    cost: { input: 0, output: 0 }, // Local models are free
    features: ['chat', 'instruct', 'streaming'],
    description: 'Microsoft Phi-3 Mini 3.8B parameters',
    parameters: '3.8B',
    architecture: 'Phi-3'
  }
};

/**
 * Ollama-specific adapter
 */
class OllamaAdapter extends APILoader {
  constructor(config = {}) {
    super({
      ...config,
      provider: 'ollama',
      baseURL: config.baseURL || 'http://localhost:11434',
      apiKey: null // Ollama doesn't require API keys
    });
    
    logger.info('🦙 Ollama Adapter initialized');
  }

  /**
   * Build Ollama-specific headers
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Load Ollama model with enhanced metadata
   */
  async load(modelId, options = {}) {
    const modelConfig = OLLAMA_MODELS[modelId];
    
    if (!modelConfig) {
      logger.warn(`Unknown Ollama model: ${modelId}. Using default config.`);
    }

    const config = {
      id: modelId,
      name: modelId,
      provider: 'ollama',
      baseURL: this.baseURL,
      endpoint: '/api/generate',
      chatEndpoint: '/api/chat',
      streamEndpoint: '/api/generate',
      format: 'ollama',
      ...modelConfig,
      ...options
    };

    // Create model directly without calling super.load() since Ollama has different endpoints
    const model = {
      id: config.id,
      name: config.name,
      provider: config.provider,
      format: config.format,
      baseURL: config.baseURL,
      ...config
    };
    
    // Enhanced model with Ollama-specific methods
    model.generate = async (prompt, options = {}) => {
      return this.generate(model, prompt, options);
    };

    model.chat = async (messages, options = {}) => {
      return this.chat(model, messages, options);
    };

    model.stream = async function* (prompt, options = {}) {
      yield* this.streamGenerate(model, prompt, options);
    }.bind(this);

    // Add required methods for registry compatibility
    model.toJSON = () => {
      const { generate, chat, stream, updateMetrics, ...jsonData } = model;
      return jsonData;
    };

    model.updateMetrics = (metrics) => {
      if (model.metrics) {
        Object.assign(model.metrics, metrics);
      }
    };

    logger.info(`🦙 Loaded Ollama model: ${modelId}`);
    return model;
  }

  /**
   * Generate text using Ollama model
   */
  async generate(model, prompt, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}/api/generate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: model.id,
          prompt: prompt,
          stream: false,
          options: {
            temperature: options.temperature || 0.7,
            top_p: options.top_p || 0.9,
            top_k: options.top_k || 40,
            num_predict: options.maxTokens || options.max_tokens || 512
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        text: data.response,
        model: model.id,
        usage: {
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0,
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        },
        finish_reason: data.done ? 'stop' : 'length'
      };
    } catch (error) {
      logger.error(`Generation failed for ${model.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Chat completion using Ollama model
   */
  async chat(model, messages, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: model.id,
          messages: messages,
          stream: false,
          options: {
            temperature: options.temperature || 0.7,
            top_p: options.top_p || 0.9,
            top_k: options.top_k || 40,
            num_predict: options.maxTokens || options.max_tokens || 512
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama Chat API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        text: data.message.content,
        message: data.message,
        model: model.id,
        usage: {
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0,
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        },
        finish_reason: data.done ? 'stop' : 'length'
      };
    } catch (error) {
      logger.error(`Chat failed for ${model.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stream generation using Ollama model
   */
  async* streamGenerate(model, prompt, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}/api/generate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: model.id,
          prompt: prompt,
          stream: true,
          options: {
            temperature: options.temperature || 0.7,
            top_p: options.top_p || 0.9,
            top_k: options.top_k || 40,
            num_predict: options.maxTokens || options.max_tokens || 512
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama Stream API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              
              if (data.response) {
                yield {
                  text: data.response,
                  done: data.done || false,
                  model: model.id
                };
              }
              
              if (data.done) {
                return;
              }
            } catch (parseError) {
              // Skip invalid JSON lines
              continue;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      logger.error(`Stream generation failed for ${model.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if Ollama server is available
   */
  async isAvailable() {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available models from Ollama
   */
  async getAvailableModels() {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      logger.error(`Failed to get available models: ${error.message}`);
      return [];
    }
  }

  /**
   * Create model from data (for registry loading)
   */
  async fromData(data) {
    // Create a simple model object compatible with the registry
    const OllamaModel = class extends EventEmitter {
      constructor(config) {
        super();
        this.id = config.id;
        this.name = config.name;
        this.format = config.format;
        this.provider = config.provider;
        this.architecture = config.architecture || {};
        this.parameters = config.parameters || {};
        this.metadata = config.metadata || {};
        this.capabilities = config.capabilities || {};
        this.metrics = config.metrics || {};
        this.baseURL = config.metadata?.baseURL || 'http://localhost:11434';
        this.adapter = null; // Will be set by parent OllamaAdapter
      }

      async load() {
        logger.info(`Loading Ollama model: ${this.name}`);
        return this;
      }

      async unload() {
        logger.info(`Unloading Ollama model: ${this.name}`);
      }

      async generate(prompt, options = {}) {
        return this.adapter.generate(this, prompt, options);
      }

      async chat(messages, options = {}) {
        return this.adapter.chat(this, messages, options);
      }

      async *stream(prompt, options = {}) {
        yield* this.adapter.streamGenerate(this, prompt, options);
      }

      updateMetrics(metrics) {
        if (this.metrics) {
          Object.assign(this.metrics, metrics);
        }
      }

      toJSON() {
        return {
          id: this.id,
          name: this.name,
          format: this.format,
          provider: this.provider,
          architecture: this.architecture,
          parameters: this.parameters,
          metadata: this.metadata,
          capabilities: this.capabilities,
          metrics: this.metrics
        };
      }
    };

    logger.info('Creating Ollama model from data:', data);
    const modelConfig = {
      ...data,
      format: 'ollama',
      provider: 'ollama'
    };
    
    const model = new OllamaModel(modelConfig);
    // Set the adapter reference to the parent OllamaAdapter instance
    model.adapter = this;
    return model;
  }
}

export default OllamaAdapter;
export { OllamaAdapter };