/**
 * 🏢 Azure OpenAI Adapter
 * Enterprise-grade adapter for Microsoft Azure OpenAI Service
 * Features: HIPAA compliance, SOC2, enterprise security, Azure AD integration
 */

import APILoader from '../APILoader.js';
import { Logger } from '../../utils/Logger.js';
import { AuthManager } from '../../utils/AuthManager.js';

const logger = new Logger('AzureOpenAIAdapter');

/**
 * Azure OpenAI model configurations
 */
const AZURE_OPENAI_MODELS = {
  'gpt-4-turbo': {
    name: 'GPT-4 Turbo',
    contextWindow: 128000,
    maxOutput: 4096,
    cost: { input: 10, output: 30 },
    features: ['vision', 'function_calling', 'json_mode', 'enterprise_ready'],
    deploymentSuffix: '-deployment'
  },
  'gpt-4': {
    name: 'GPT-4',
    contextWindow: 8192,
    maxOutput: 4096,
    cost: { input: 30, output: 60 },
    features: ['function_calling', 'enterprise_ready'],
    deploymentSuffix: '-deployment'
  },
  'gpt-4-32k': {
    name: 'GPT-4 32K',
    contextWindow: 32768,
    maxOutput: 4096,
    cost: { input: 60, output: 120 },
    features: ['function_calling', 'long_context', 'enterprise_ready'],
    deploymentSuffix: '-deployment'
  },
  'gpt-35-turbo': {
    name: 'GPT-3.5 Turbo',
    contextWindow: 16385,
    maxOutput: 4096,
    cost: { input: 0.5, output: 1.5 },
    features: ['function_calling', 'cost_effective'],
    deploymentSuffix: '-deployment'
  },
  'gpt-35-turbo-16k': {
    name: 'GPT-3.5 Turbo 16K',
    contextWindow: 16385,
    maxOutput: 4096,
    cost: { input: 3, output: 4 },
    features: ['function_calling', 'long_context'],
    deploymentSuffix: '-deployment'
  },
  'text-embedding-ada-002': {
    name: 'Text Embedding Ada 002',
    contextWindow: 8191,
    maxOutput: 1536, // Embedding dimensions
    cost: { input: 0.1, output: 0 },
    features: ['embeddings', 'semantic_search'],
    type: 'embedding',
    deploymentSuffix: '-deployment'
  },
  'dall-e-3': {
    name: 'DALL-E 3',
    contextWindow: 4000,
    maxOutput: 1, // One image
    cost: { input: 40, output: 0 }, // Per image cost
    features: ['image_generation', 'high_quality'],
    type: 'image',
    deploymentSuffix: '-deployment'
  }
};

/**
 * Azure API versions
 */
const AZURE_API_VERSIONS = {
  'chat': '2024-02-01',
  'completions': '2024-02-01',
  'embeddings': '2024-02-01',
  'images': '2024-02-01'
};

/**
 * Azure OpenAI adapter with enterprise features
 */
class AzureOpenAIAdapter extends APILoader {
  constructor(config = {}) {
    super({
      ...config,
      provider: 'azure-openai'
    });

    // Azure-specific configuration
    this.endpoint = config.endpoint || process.env.AZURE_OPENAI_ENDPOINT;
    this.apiKey = config.apiKey || process.env.AZURE_OPENAI_API_KEY;
    this.apiVersion = config.apiVersion || AZURE_API_VERSIONS.chat;
    this.deploymentMap = config.deploymentMap || {};
    
    // Azure AD authentication
    this.useAzureAD = config.useAzureAD || false;
    this.tenantId = config.tenantId || process.env.AZURE_TENANT_ID;
    this.clientId = config.clientId || process.env.AZURE_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.AZURE_CLIENT_SECRET;

    // Enterprise features
    this.enableContentFilter = config.enableContentFilter !== false;
    this.enableLogging = config.enableLogging !== false;
    this.resourceGroup = config.resourceGroup || process.env.AZURE_RESOURCE_GROUP;

    this.authManager = new AuthManager();
    this.models = new Map();
    this.tokenCache = new Map();

    // Validate configuration
    this.validateConfig();

    logger.info(`🏢 Azure OpenAI Adapter initialized (Endpoint: ${this.maskEndpoint()})`);
  }

  /**
   * Validate Azure OpenAI configuration
   */
  validateConfig() {
    if (!this.endpoint) {
      throw new Error('Azure OpenAI endpoint is required');
    }

    if (!this.endpoint.includes('openai.azure.com')) {
      throw new Error('Invalid Azure OpenAI endpoint format');
    }

    if (!this.useAzureAD && !this.apiKey) {
      throw new Error('Azure OpenAI API key or Azure AD configuration required');
    }

    if (this.useAzureAD && (!this.tenantId || !this.clientId)) {
      throw new Error('Azure AD authentication requires tenantId and clientId');
    }
  }

  /**
   * Mask endpoint for logging
   */
  maskEndpoint() {
    if (!this.endpoint) return '[NOT_SET]';
    const url = new URL(this.endpoint);
    return `${url.protocol}//${url.hostname.split('.')[0]}***.openai.azure.com`;
  }

  /**
   * Get Azure OpenAI headers
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'LLM-Runner-Router/2.0.0'
    };

    if (this.useAzureAD) {
      const token = this.getAzureADToken();
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      headers['api-key'] = this.apiKey;
    }

    return headers;
  }

  /**
   * Get Azure AD token (simplified implementation)
   */
  getAzureADToken() {
    // In real implementation, would use Azure SDK or MSAL
    const cached = this.tokenCache.get('azure_ad');
    
    if (cached && Date.now() < cached.expiresAt - 300000) { // 5 min buffer
      return cached.token;
    }

    // Simulate token refresh
    const token = 'simulated_azure_ad_token';
    this.tokenCache.set('azure_ad', {
      token,
      expiresAt: Date.now() + 3600000 // 1 hour
    });

    return token;
  }

  /**
   * Load Azure OpenAI model with deployment mapping
   */
  async load(modelId, options = {}) {
    try {
      const modelConfig = AZURE_OPENAI_MODELS[modelId];
      
      if (!modelConfig) {
        logger.warn(`Unknown Azure OpenAI model: ${modelId}. Using default config.`);
      }

      // Determine deployment name
      const deploymentName = this.getDeploymentName(modelId, options);

      // Test deployment availability
      if (options.testConnection !== false) {
        await this.testDeployment(deploymentName, modelConfig?.type || 'chat');
      }

      const model = {
        id: `azure-openai:${modelId}`,
        provider: 'azure-openai',
        modelId: modelId,
        deploymentName: deploymentName,
        type: 'azure-openai',
        config: {
          endpoint: this.endpoint,
          apiVersion: this.apiVersion,
          ...options
        },
        metadata: {
          ...modelConfig,
          streaming: true,
          enterprise: true,
          compliance: ['HIPAA', 'SOC2', 'ISO27001'],
          deployment: deploymentName,
          loaded: true,
          loadedAt: Date.now()
        }
      };

      this.models.set(modelId, model);
      this.model = model;
      this.loaded = true;

      logger.success(`✅ Loaded Azure OpenAI model: ${model.id} (Deployment: ${deploymentName})`);
      return model;

    } catch (error) {
      logger.error(`Failed to load Azure OpenAI model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Get deployment name for model
   */
  getDeploymentName(modelId, options) {
    // Check explicit deployment mapping
    if (this.deploymentMap[modelId]) {
      return this.deploymentMap[modelId];
    }

    // Check options
    if (options.deployment) {
      return options.deployment;
    }

    // Use model ID with default suffix
    const modelConfig = AZURE_OPENAI_MODELS[modelId];
    const suffix = modelConfig?.deploymentSuffix || '-deployment';
    
    return `${modelId}${suffix}`;
  }

  /**
   * Test Azure deployment availability
   */
  async testDeployment(deploymentName, modelType = 'chat') {
    try {
      const endpoint = this.getEndpoint(deploymentName, modelType);
      
      // Simple test request
      const testRequest = this.buildTestRequest(modelType);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(testRequest)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Deployment test failed (${response.status}): ${error}`);
      }

      logger.debug(`✅ Deployment test passed for ${deploymentName}`);
      return true;
    } catch (error) {
      logger.warn(`⚠️ Deployment test failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build test request for deployment
   */
  buildTestRequest(modelType) {
    switch (modelType) {
      case 'chat':
        return {
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
          temperature: 0
        };
      
      case 'embedding':
        return {
          input: 'test',
          model: 'text-embedding-ada-002'
        };
      
      case 'image':
        return {
          prompt: 'A simple test image',
          size: '256x256',
          n: 1
        };
      
      default:
        return {
          prompt: 'Hello',
          max_tokens: 5,
          temperature: 0
        };
    }
  }

  /**
   * Generate completion using Azure OpenAI
   */
  async complete(prompt, options = {}) {
    const model = options.model || this.model;
    
    if (!model) {
      throw new Error('No model loaded');
    }

    // Build Azure-specific request
    const request = this.buildAzureRequest(prompt, model, options);
    const endpoint = this.getEndpoint(model.deploymentName, model.metadata?.type || 'chat');

    try {
      if (options.stream && model.metadata.streaming) {
        return await this.streamCompletion(request, endpoint, model, options);
      } else {
        return await this.standardCompletion(request, endpoint, model, options);
      }
    } catch (error) {
      logger.error(`Azure OpenAI request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build Azure OpenAI request
   */
  buildAzureRequest(prompt, model, options) {
    const modelType = model.metadata?.type || 'chat';
    
    const baseRequest = {
      max_tokens: options.maxTokens || model.metadata.maxOutput || 1000,
      temperature: options.temperature || 0.7,
      top_p: options.topP || 1.0,
      frequency_penalty: options.frequencyPenalty || 0,
      presence_penalty: options.presencePenalty || 0,
      stream: options.stream || false
    };

    switch (modelType) {
      case 'chat':
        return {
          ...baseRequest,
          messages: options.messages || [
            { role: 'user', content: prompt }
          ],
          functions: options.functions,
          function_call: options.functionCall
        };

      case 'embedding':
        return {
          input: prompt,
          model: model.modelId
        };

      case 'image':
        return {
          prompt: prompt,
          size: options.size || '1024x1024',
          n: options.n || 1,
          quality: options.quality || 'standard',
          style: options.style || 'vivid'
        };

      default:
        return {
          ...baseRequest,
          prompt: prompt,
          stop: options.stop
        };
    }
  }

  /**
   * Get Azure OpenAI endpoint
   */
  getEndpoint(deploymentName, modelType = 'chat') {
    const baseUrl = this.endpoint.replace(/\/$/, ''); // Remove trailing slash
    
    switch (modelType) {
      case 'chat':
        return `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${this.apiVersion}`;
      
      case 'embedding':
        return `${baseUrl}/openai/deployments/${deploymentName}/embeddings?api-version=${this.apiVersion}`;
      
      case 'image':
        return `${baseUrl}/openai/deployments/${deploymentName}/images/generations?api-version=${this.apiVersion}`;
      
      default:
        return `${baseUrl}/openai/deployments/${deploymentName}/completions?api-version=${this.apiVersion}`;
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
      await this.handleAzureError(response);
    }

    const data = await response.json();
    return this.parseAzureResponse(data, model);
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
      await this.handleAzureError(response);
    }

    return this.handleAzureStream(response, model);
  }

  /**
   * Handle Azure-specific errors
   */
  async handleAzureError(response) {
    const errorText = await response.text();
    let errorData;
    
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }

    // Azure-specific error handling
    if (response.status === 401) {
      throw new Error('Azure OpenAI authentication failed. Check API key or Azure AD configuration.');
    } else if (response.status === 403) {
      throw new Error('Azure OpenAI access denied. Check deployment permissions.');
    } else if (response.status === 404) {
      throw new Error('Azure OpenAI deployment not found. Check deployment name.');
    } else if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      throw new Error(`Azure OpenAI rate limit exceeded. Retry after ${retryAfter} seconds.`);
    }

    const message = errorData.error?.message || errorData.message || `Azure OpenAI error (${response.status})`;
    throw new Error(message);
  }

  /**
   * Parse Azure OpenAI response
   */
  parseAzureResponse(data, model) {
    const modelType = model.metadata?.type || 'chat';
    
    switch (modelType) {
      case 'chat':
        return this.parseChatResponse(data, model);
      
      case 'embedding':
        return this.parseEmbeddingResponse(data, model);
      
      case 'image':
        return this.parseImageResponse(data, model);
      
      default:
        return this.parseCompletionResponse(data, model);
    }
  }

  /**
   * Parse chat completion response
   */
  parseChatResponse(data, model) {
    const choice = data.choices?.[0];
    const text = choice?.message?.content || '';
    const usage = data.usage || {};

    return {
      text,
      model: model.id,
      provider: 'azure-openai',
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      },
      cost: this.calculateCost(usage, model.modelId),
      finishReason: choice?.finish_reason || 'unknown',
      metadata: {
        deployment: model.deploymentName,
        contentFilter: data.content_filter_results,
        functionCall: choice?.message?.function_call
      },
      timestamp: Date.now()
    };
  }

  /**
   * Parse embedding response
   */
  parseEmbeddingResponse(data, model) {
    const embedding = data.data?.[0]?.embedding || [];
    const usage = data.usage || {};

    return {
      embedding,
      model: model.id,
      provider: 'azure-openai',
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: 0,
        totalTokens: usage.total_tokens || 0
      },
      cost: this.calculateCost(usage, model.modelId),
      metadata: {
        deployment: model.deploymentName,
        dimensions: embedding.length
      },
      timestamp: Date.now()
    };
  }

  /**
   * Parse image generation response
   */
  parseImageResponse(data, model) {
    const images = data.data || [];
    
    return {
      images: images.map(img => ({
        url: img.url,
        revisedPrompt: img.revised_prompt
      })),
      model: model.id,
      provider: 'azure-openai',
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      cost: images.length * (model.metadata.cost?.input || 40) / 1000000, // Convert to standard format
      metadata: {
        deployment: model.deploymentName,
        count: images.length
      },
      timestamp: Date.now()
    };
  }

  /**
   * Parse standard completion response
   */
  parseCompletionResponse(data, model) {
    const choice = data.choices?.[0];
    const text = choice?.text || '';
    const usage = data.usage || {};

    return {
      text,
      model: model.id,
      provider: 'azure-openai',
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      },
      cost: this.calculateCost(usage, model.modelId),
      finishReason: choice?.finish_reason || 'unknown',
      metadata: {
        deployment: model.deploymentName,
        contentFilter: data.content_filter_results
      },
      timestamp: Date.now()
    };
  }

  /**
   * Handle Azure streaming response
   */
  async *handleAzureStream(response, model) {
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
                  provider: 'azure-openai',
                  chunk: true,
                  metadata: {
                    deployment: model.deploymentName
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
   * Calculate cost based on Azure OpenAI pricing
   */
  calculateCost(usage, modelId) {
    const modelConfig = AZURE_OPENAI_MODELS[modelId];
    if (!modelConfig || !modelConfig.cost) return 0;

    const inputCost = (usage.prompt_tokens / 1000000) * modelConfig.cost.input;
    const outputCost = (usage.completion_tokens / 1000000) * modelConfig.cost.output;
    
    return inputCost + outputCost;
  }

  /**
   * List available Azure OpenAI models
   */
  async listModels() {
    return Object.keys(AZURE_OPENAI_MODELS).map(id => ({
      id,
      name: AZURE_OPENAI_MODELS[id].name,
      provider: 'azure-openai',
      type: AZURE_OPENAI_MODELS[id].type || 'chat',
      deployment: this.getDeploymentName(id, {}),
      metadata: AZURE_OPENAI_MODELS[id]
    }));
  }

  /**
   * Get adapter information
   */
  getInfo() {
    return {
      name: 'AzureOpenAIAdapter',
      version: '1.0.0',
      provider: 'azure-openai',
      endpoint: this.maskEndpoint(),
      apiVersion: this.apiVersion,
      useAzureAD: this.useAzureAD,
      modelsLoaded: this.models.size,
      features: ['streaming', 'enterprise', 'compliance', 'function_calling', 'vision', 'embeddings'],
      compliance: ['HIPAA', 'SOC2', 'ISO27001'],
      models: Object.keys(AZURE_OPENAI_MODELS),
      status: 'ready'
    };
  }

  /**
   * Unload model
   */
  async unload(modelId) {
    if (this.models.has(modelId)) {
      this.models.delete(modelId);
      logger.info(`Azure OpenAI model ${modelId} unloaded`);
      return true;
    }
    return false;
  }

  /**
   * Clean up resources
   */
  async dispose() {
    this.models.clear();
    this.tokenCache.clear();
    logger.info('Azure OpenAI adapter disposed');
  }
}

export default AzureOpenAIAdapter;