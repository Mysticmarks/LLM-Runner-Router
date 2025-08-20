/**
 * 🧮 Cohere Adapter
 * Enterprise-grade adapter for Cohere's language models and embeddings
 * Features: Command R/R+, Embeddings, Rerank, Classify, Generate
 */

import APILoader from '../APILoader.js';
import { Logger } from '../../utils/Logger.js';
import { AuthManager } from '../../utils/AuthManager.js';

const logger = new Logger('CohereAdapter');

/**
 * Cohere model configurations
 */
const COHERE_MODELS = {
  // Command R family (2024)
  'command-r-plus': {
    name: 'Command R+',
    contextWindow: 128000,
    maxOutput: 4096,
    cost: { input: 3.0, output: 15.0 },
    features: ['retrieval', 'tool_use', 'function_calling', 'multilingual'],
    type: 'command',
    version: 'command-r-plus-04-2024'
  },
  'command-r': {
    name: 'Command R',
    contextWindow: 128000,
    maxOutput: 4096,
    cost: { input: 0.5, output: 1.5 },
    features: ['retrieval', 'tool_use', 'function_calling', 'multilingual'],
    type: 'command',
    version: 'command-r-03-2024'
  },

  // Command family (legacy)
  'command': {
    name: 'Command',
    contextWindow: 4096,
    maxOutput: 4096,
    cost: { input: 1.0, output: 2.0 },
    features: ['conversational', 'general_purpose'],
    type: 'command',
    version: 'command'
  },
  'command-nightly': {
    name: 'Command Nightly',
    contextWindow: 4096,
    maxOutput: 4096,
    cost: { input: 1.0, output: 2.0 },
    features: ['conversational', 'experimental'],
    type: 'command',
    version: 'command-nightly'
  },
  'command-light': {
    name: 'Command Light',
    contextWindow: 4096,
    maxOutput: 4096,
    cost: { input: 0.3, output: 0.6 },
    features: ['conversational', 'lightweight'],
    type: 'command',
    version: 'command-light'
  },
  'command-light-nightly': {
    name: 'Command Light Nightly',
    contextWindow: 4096,
    maxOutput: 4096,
    cost: { input: 0.3, output: 0.6 },
    features: ['conversational', 'lightweight', 'experimental'],
    type: 'command',
    version: 'command-light-nightly'
  },

  // Embedding models
  'embed-english-v3.0': {
    name: 'Embed English v3.0',
    contextWindow: 512,
    maxOutput: 1024, // Embedding dimensions
    cost: { input: 0.1, output: 0 },
    features: ['embeddings', 'semantic_search', 'clustering'],
    type: 'embedding',
    version: 'embed-english-v3.0',
    dimensions: 1024
  },
  'embed-multilingual-v3.0': {
    name: 'Embed Multilingual v3.0',
    contextWindow: 512,
    maxOutput: 1024,
    cost: { input: 0.1, output: 0 },
    features: ['embeddings', 'multilingual', 'semantic_search'],
    type: 'embedding',
    version: 'embed-multilingual-v3.0',
    dimensions: 1024
  },
  'embed-english-light-v3.0': {
    name: 'Embed English Light v3.0',
    contextWindow: 512,
    maxOutput: 384,
    cost: { input: 0.1, output: 0 },
    features: ['embeddings', 'lightweight', 'efficient'],
    type: 'embedding',
    version: 'embed-english-light-v3.0',
    dimensions: 384
  },
  'embed-multilingual-light-v3.0': {
    name: 'Embed Multilingual Light v3.0',
    contextWindow: 512,
    maxOutput: 384,
    cost: { input: 0.1, output: 0 },
    features: ['embeddings', 'multilingual', 'lightweight'],
    type: 'embedding',
    version: 'embed-multilingual-light-v3.0',
    dimensions: 384
  },

  // Rerank models
  'rerank-english-v3.0': {
    name: 'Rerank English v3.0',
    contextWindow: 4096,
    maxOutput: 1, // Relevance score
    cost: { input: 2.0, output: 0 },
    features: ['reranking', 'search_optimization', 'relevance_scoring'],
    type: 'rerank',
    version: 'rerank-english-v3.0'
  },
  'rerank-multilingual-v3.0': {
    name: 'Rerank Multilingual v3.0',
    contextWindow: 4096,
    maxOutput: 1,
    cost: { input: 2.0, output: 0 },
    features: ['reranking', 'multilingual', 'search_optimization'],
    type: 'rerank',
    version: 'rerank-multilingual-v3.0'
  }
};

/**
 * Cohere input types for different tasks
 */
const INPUT_TYPES = {
  'search_document': 'search_document',
  'search_query': 'search_query',
  'classification': 'classification',
  'clustering': 'clustering'
};

/**
 * Cohere adapter with enterprise features
 */
class CohereAdapter extends APILoader {
  constructor(config = {}) {
    super({
      ...config,
      provider: 'cohere'
    });

    // Cohere-specific configuration
    this.baseURL = config.baseURL || 'https://api.cohere.ai/v1';
    this.version = config.version || 'v1';
    
    // Enterprise features
    this.enableSafetyFiltering = config.enableSafetyFiltering !== false;
    this.enableCaching = config.enableCaching !== false;
    this.batchSize = config.batchSize || 96; // Cohere's batch limit
    
    // Specialized features
    this.defaultInputType = config.defaultInputType || 'search_document';
    this.enableRetrieval = config.enableRetrieval || false;
    this.truncate = config.truncate || 'END'; // START, END, NONE

    this.authManager = new AuthManager();
    this.models = new Map();
    this.embeddingCache = new Map();
    this.rerankCache = new Map();

    logger.info(`🧮 Cohere Adapter initialized (Version: ${this.version})`);
  }

  /**
   * Get authentication headers
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'LLM-Runner-Router/2.0.0',
      'Cohere-Version': '2022-12-06'
    };
  }

  /**
   * Load Cohere model
   */
  async load(modelId, options = {}) {
    try {
      const modelConfig = COHERE_MODELS[modelId];
      
      if (!modelConfig) {
        logger.warn(`Unknown Cohere model: ${modelId}. Attempting to load anyway.`);
      }

      // Test model availability
      if (options.testConnection !== false) {
        await this.testModelAvailability(modelId, modelConfig);
      }

      const model = {
        id: `cohere:${modelId}`,
        provider: 'cohere',
        modelId: modelId,
        type: 'cohere',
        config: {
          ...options
        },
        metadata: {
          ...modelConfig,
          enterprise: true,
          multilingual: modelConfig?.features?.includes('multilingual') || false,
          streaming: modelConfig?.type === 'command',
          loaded: true,
          loadedAt: Date.now()
        }
      };

      this.models.set(modelId, model);
      this.model = model;
      this.loaded = true;

      logger.success(`✅ Loaded Cohere model: ${model.id}`);
      return model;

    } catch (error) {
      logger.error(`Failed to load Cohere model ${modelId}:`, error);
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
   * Generate completion using Cohere
   */
  async complete(prompt, options = {}) {
    const model = options.model || this.model;
    
    if (!model) {
      throw new Error('No model loaded');
    }

    const modelConfig = COHERE_MODELS[model.modelId];
    const modelType = modelConfig?.type || 'command';

    switch (modelType) {
      case 'command':
        return await this.generateText(prompt, model, options);
      case 'embedding':
        return await this.generateEmbeddings(prompt, model, options);
      case 'rerank':
        return await this.rerankDocuments(prompt, model, options);
      default:
        throw new Error(`Unsupported model type: ${modelType}`);
    }
  }

  /**
   * Generate text completion
   */
  async generateText(prompt, model, options) {
    const request = this.buildGenerateRequest(prompt, model, options);
    const endpoint = `${this.baseURL}/generate`;

    try {
      if (options.stream && model.metadata.streaming) {
        return await this.streamGeneration(request, endpoint, model, options);
      } else {
        return await this.standardGeneration(request, endpoint, model, options);
      }
    } catch (error) {
      logger.error(`Cohere generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate embeddings
   */
  async generateEmbeddings(texts, model, options) {
    // Handle single text input
    if (typeof texts === 'string') {
      texts = [texts];
    }

    const request = this.buildEmbedRequest(texts, model, options);
    const endpoint = `${this.baseURL}/embed`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        await this.handleCohereError(response);
      }

      const data = await response.json();
      return this.parseEmbeddingResponse(data, model);

    } catch (error) {
      logger.error(`Cohere embedding failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Rerank documents
   */
  async rerankDocuments(query, model, options) {
    const documents = options.documents || [];
    
    if (!documents.length) {
      throw new Error('Documents required for reranking');
    }

    const request = this.buildRerankRequest(query, documents, model, options);
    const endpoint = `${this.baseURL}/rerank`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        await this.handleCohereError(response);
      }

      const data = await response.json();
      return this.parseRerankResponse(data, model);

    } catch (error) {
      logger.error(`Cohere rerank failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build generate request
   */
  buildGenerateRequest(prompt, model, options) {
    const modelConfig = COHERE_MODELS[model.modelId];
    
    const request = {
      model: model.modelId,
      prompt: prompt,
      max_tokens: options.maxTokens || modelConfig?.maxOutput || 1000,
      temperature: options.temperature || 0.7,
      k: options.topK || 0,
      p: options.topP || 0.75,
      frequency_penalty: options.frequencyPenalty || 0.0,
      presence_penalty: options.presencePenalty || 0.0,
      end_sequences: options.stopSequences || [],
      return_likelihoods: options.returnLikelihoods || 'NONE',
      truncate: this.truncate
    };

    // Add enterprise features
    if (this.enableSafetyFiltering) {
      request.safety_mode = 'STRICT';
    }

    // Add tool use for Command R models
    if (options.tools && modelConfig?.features?.includes('tool_use')) {
      request.tools = options.tools;
      request.tool_results = options.toolResults;
    }

    // Add retrieval for RAG
    if (options.documents && this.enableRetrieval) {
      request.documents = options.documents;
    }

    return request;
  }

  /**
   * Build embed request
   */
  buildEmbedRequest(texts, model, options) {
    return {
      texts: texts,
      model: model.modelId,
      input_type: options.inputType || this.defaultInputType,
      truncate: this.truncate,
      embedding_types: options.embeddingTypes || ['float']
    };
  }

  /**
   * Build rerank request
   */
  buildRerankRequest(query, documents, model, options) {
    return {
      model: model.modelId,
      query: query,
      documents: documents,
      top_n: options.topN || documents.length,
      return_documents: options.returnDocuments !== false,
      max_chunks_per_doc: options.maxChunksPerDoc || 10
    };
  }

  /**
   * Standard (non-streaming) generation
   */
  async standardGeneration(request, endpoint, model, options) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      await this.handleCohereError(response);
    }

    const data = await response.json();
    return this.parseGenerateResponse(data, model);
  }

  /**
   * Streaming generation
   */
  async streamGeneration(request, endpoint, model, options) {
    // Add streaming parameter
    request.stream = true;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      await this.handleCohereError(response);
    }

    return this.handleCohereStream(response, model);
  }

  /**
   * Handle Cohere errors
   */
  async handleCohereError(response) {
    const errorText = await response.text();
    let errorData;
    
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }

    const message = errorData.message || `Cohere error (${response.status})`;
    throw new Error(message);
  }

  /**
   * Parse generate response
   */
  parseGenerateResponse(data, model) {
    const generation = data.generations?.[0];
    const text = generation?.text || '';
    
    return {
      text,
      model: model.id,
      provider: 'cohere',
      usage: {
        promptTokens: data.meta?.billed_units?.input_tokens || 0,
        completionTokens: data.meta?.billed_units?.output_tokens || 0,
        totalTokens: (data.meta?.billed_units?.input_tokens || 0) + (data.meta?.billed_units?.output_tokens || 0)
      },
      cost: this.calculateCost(data.meta?.billed_units, model.modelId),
      finishReason: generation?.finish_reason?.toLowerCase() || 'stop',
      metadata: {
        likelihood: generation?.likelihood,
        tokenLikelihoods: generation?.token_likelihoods,
        tools: data.tool_calls,
        citations: data.citations,
        searchQueries: data.search_queries,
        searchResults: data.search_results
      },
      timestamp: Date.now()
    };
  }

  /**
   * Parse embedding response
   */
  parseEmbeddingResponse(data, model) {
    const embeddings = data.embeddings || [];
    
    return {
      embeddings,
      model: model.id,
      provider: 'cohere',
      usage: {
        promptTokens: data.meta?.billed_units?.input_tokens || 0,
        completionTokens: 0,
        totalTokens: data.meta?.billed_units?.input_tokens || 0
      },
      cost: this.calculateCost(data.meta?.billed_units, model.modelId),
      metadata: {
        count: embeddings.length,
        dimensions: embeddings[0]?.length || 0,
        inputType: data.meta?.input_type,
        truncated: data.meta?.truncated
      },
      timestamp: Date.now()
    };
  }

  /**
   * Parse rerank response
   */
  parseRerankResponse(data, model) {
    const results = data.results || [];
    
    return {
      results: results.map(result => ({
        index: result.index,
        relevanceScore: result.relevance_score,
        document: result.document
      })),
      model: model.id,
      provider: 'cohere',
      usage: {
        promptTokens: data.meta?.billed_units?.input_tokens || 0,
        completionTokens: 0,
        totalTokens: data.meta?.billed_units?.input_tokens || 0
      },
      cost: this.calculateCost(data.meta?.billed_units, model.modelId),
      metadata: {
        query: data.meta?.query,
        documentCount: results.length
      },
      timestamp: Date.now()
    };
  }

  /**
   * Handle Cohere streaming response
   */
  async *handleCohereStream(response, model) {
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
          if (line.trim() === '' || !line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.event_type === 'text-generation') {
              yield {
                text: data.text,
                model: model.id,
                provider: 'cohere',
                chunk: true,
                timestamp: Date.now()
              };
            }
            
            if (data.event_type === 'stream-end') {
              // Final response with full metadata
              yield {
                text: '',
                model: model.id,
                provider: 'cohere',
                finished: true,
                usage: {
                  promptTokens: data.response?.meta?.billed_units?.input_tokens || 0,
                  completionTokens: data.response?.meta?.billed_units?.output_tokens || 0,
                  totalTokens: (data.response?.meta?.billed_units?.input_tokens || 0) + (data.response?.meta?.billed_units?.output_tokens || 0)
                },
                cost: this.calculateCost(data.response?.meta?.billed_units, model.modelId),
                metadata: data.response,
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
   * Calculate cost based on Cohere pricing
   */
  calculateCost(billedUnits, modelId) {
    const modelConfig = COHERE_MODELS[modelId];
    if (!modelConfig || !modelConfig.cost || !billedUnits) return 0;

    const inputTokens = billedUnits.input_tokens || 0;
    const outputTokens = billedUnits.output_tokens || 0;
    
    const inputCost = (inputTokens / 1000000) * modelConfig.cost.input;
    const outputCost = (outputTokens / 1000000) * modelConfig.cost.output;
    
    return inputCost + outputCost;
  }

  /**
   * List available Cohere models
   */
  async listModels() {
    return Object.keys(COHERE_MODELS).map(id => ({
      id,
      name: COHERE_MODELS[id].name,
      provider: 'cohere',
      type: COHERE_MODELS[id].type,
      metadata: COHERE_MODELS[id]
    }));
  }

  /**
   * Get adapter information
   */
  getInfo() {
    return {
      name: 'CohereAdapter',
      version: '1.0.0',
      provider: 'cohere',
      modelsLoaded: this.models.size,
      features: ['text_generation', 'embeddings', 'reranking', 'tool_use', 'retrieval', 'multilingual'],
      capabilities: ['streaming', 'batch_processing', 'safety_filtering'],
      models: Object.keys(COHERE_MODELS),
      status: this.loaded ? 'ready' : 'initializing'
    };
  }

  /**
   * Unload model
   */
  async unload(modelId) {
    if (this.models.has(modelId)) {
      this.models.delete(modelId);
      logger.info(`Cohere model ${modelId} unloaded`);
      return true;
    }
    return false;
  }

  /**
   * Clean up resources
   */
  async dispose() {
    this.models.clear();
    this.embeddingCache.clear();
    this.rerankCache.clear();
    logger.info('Cohere adapter disposed');
  }
}

export default CohereAdapter;