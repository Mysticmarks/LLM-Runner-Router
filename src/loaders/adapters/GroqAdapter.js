/**
 * ⚡ Groq Adapter
 * Ultra-fast LLM inference with Groq's LPU technology
 * Echo AI Systems - Speed meets intelligence
 */

import APILoader from '../APILoader.js';
import { Logger } from '../../utils/Logger.js';

const logger = new Logger('GroqAdapter');

/**
 * Groq model configurations
 */
const GROQ_MODELS = {
  'mixtral-8x7b-32768': {
    contextWindow: 32768,
    maxOutput: 32768,
    cost: { input: 0.27, output: 0.27 },
    speed: 'ultra_fast',
    features: ['moe', 'code', 'reasoning'],
    description: 'Mixtral 8x7B with 32k context - Fast MoE model'
  },
  'llama3-70b-8192': {
    contextWindow: 8192,
    maxOutput: 8192,
    cost: { input: 0.59, output: 0.79 },
    speed: 'very_fast',
    features: ['general', 'code', 'creative'],
    description: 'Meta Llama 3 70B - Powerful and fast'
  },
  'llama3-8b-8192': {
    contextWindow: 8192,
    maxOutput: 8192,
    cost: { input: 0.05, output: 0.10 },
    speed: 'ultra_fast',
    features: ['general', 'efficient'],
    description: 'Meta Llama 3 8B - Efficient and fast'
  },
  'llama2-70b-4096': {
    contextWindow: 4096,
    maxOutput: 4096,
    cost: { input: 0.70, output: 0.80 },
    speed: 'very_fast',
    features: ['general', 'stable'],
    description: 'Meta Llama 2 70B - Stable and reliable'
  },
  'gemma-7b-it': {
    contextWindow: 8192,
    maxOutput: 8192,
    cost: { input: 0.10, output: 0.10 },
    speed: 'ultra_fast',
    features: ['instruction', 'efficient'],
    description: 'Google Gemma 7B Instruct - Efficient instruction following'
  },
  'gemma2-9b-it': {
    contextWindow: 8192,
    maxOutput: 8192,
    cost: { input: 0.20, output: 0.20 },
    speed: 'ultra_fast',
    features: ['instruction', 'improved'],
    description: 'Google Gemma 2 9B Instruct - Enhanced capabilities'
  }
};

/**
 * Groq ultra-fast inference adapter
 */
class GroqAdapter extends APILoader {
  constructor(config = {}) {
    super({
      ...config,
      provider: 'groq',
      baseURL: config.baseURL || 'https://api.groq.com/openai/v1',
      apiKey: config.apiKey || process.env.GROQ_API_KEY
    });
    
    // Groq-specific settings
    this.organizationId = config.organizationId || process.env.GROQ_ORG_ID;
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 30000;
    
    // Performance tracking
    this.performanceMetrics = {
      totalRequests: 0,
      totalTokens: 0,
      averageLatency: 0,
      tokensPerSecond: []
    };
    
    logger.info('⚡ Groq Adapter initialized - Ultra-fast inference ready');
  }

  /**
   * Build Groq-specific headers
   */
  getHeaders() {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
    
    if (this.organizationId) {
      headers['X-Organization-ID'] = this.organizationId;
    }
    
    return headers;
  }

  /**
   * Load Groq model with performance metadata
   */
  async load(modelId = 'mixtral-8x7b-32768', options = {}) {
    const modelConfig = GROQ_MODELS[modelId];
    
    if (!modelConfig) {
      logger.warn(`Unknown Groq model: ${modelId}. Using default config.`);
    }
    
    const model = await super.load(modelId, {
      ...options,
      metadata: {
        ...modelConfig,
        provider: 'groq',
        streaming: true,
        lpuOptimized: true,
        ...options.metadata
      }
    });
    
    // Test speed on load
    if (options.testSpeed !== false) {
      await this.benchmarkSpeed(model);
    }
    
    return model;
  }

  /**
   * Groq completion with performance optimization
   */
  async complete(prompt, options = {}) {
    const startTime = Date.now();
    
    const request = {
      model: options.model?.modelId || 'mixtral-8x7b-32768',
      messages: options.messages || [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      top_p: options.topP ?? 1,
      stream: options.stream ?? false,
      stop: options.stop,
      seed: options.seed
    };
    
    // Groq-specific optimizations
    if (options.speedMode) {
      request.temperature = Math.min(request.temperature, 0.5);
      request.top_p = 1;
    }
    
    try {
      const result = await this.executeRequest(request, options);
      
      // Track performance metrics
      const latency = Date.now() - startTime;
      this.updateMetrics(result, latency);
      
      return result;
    } catch (error) {
      // Groq-specific error handling
      if (error.message?.includes('rate_limit')) {
        logger.warn('Groq rate limit hit, implementing backoff...');
        await this.handleRateLimit(error);
        return this.complete(prompt, options);
      }
      
      throw error;
    }
  }

  /**
   * Execute Groq API request with retry logic
   */
  async executeRequest(request, options = {}, retryCount = 0) {
    const endpoint = `${this.baseURL}/chat/completions`;
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Groq API error: ${error.error?.message || response.statusText}`);
      }
      
      if (request.stream) {
        return this.handleStream(response);
      } else {
        const data = await response.json();
        return this.formatResponse(data);
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.error('Groq request timeout');
        throw new Error('Request timeout - Groq may be experiencing high load');
      }
      
      // Retry logic for transient errors
      if (retryCount < this.maxRetries && this.shouldRetry(error)) {
        const delay = Math.pow(2, retryCount) * 1000;
        logger.info(`Retrying Groq request in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeRequest(request, options, retryCount + 1);
      }
      
      throw error;
    }
  }

  /**
   * Handle streaming response with performance tracking
   */
  async* handleStream(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let tokenCount = 0;
    const startTime = Date.now();
    
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
            if (data === '[DONE]') {
              const elapsed = Date.now() - startTime;
              const tps = (tokenCount / elapsed) * 1000;
              logger.debug(`Stream complete: ${tokenCount} tokens in ${elapsed}ms (${tps.toFixed(1)} tokens/sec)`);
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                tokenCount++;
                yield { 
                  text: content,
                  tokenCount,
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
   * Format Groq response with performance data
   */
  formatResponse(data) {
    const choice = data.choices?.[0];
    
    return {
      text: choice?.message?.content || '',
      finishReason: choice?.finish_reason,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
        promptTime: data.usage?.prompt_time,
        completionTime: data.usage?.completion_time,
        totalTime: data.usage?.total_time
      },
      model: data.model,
      id: data.id,
      systemFingerprint: data.system_fingerprint,
      xGroq: data.x_groq // Groq-specific metadata
    };
  }

  /**
   * Benchmark model speed
   */
  async benchmarkSpeed(model) {
    try {
      const testPrompt = 'Write a haiku about speed.';
      const startTime = Date.now();
      
      const response = await this.complete(testPrompt, {
        model,
        maxTokens: 50,
        stream: false
      });
      
      const elapsed = Date.now() - startTime;
      const tokensGenerated = response.usage?.completionTokens || 0;
      const tokensPerSecond = (tokensGenerated / elapsed) * 1000;
      
      logger.info(`⚡ Speed benchmark: ${tokensPerSecond.toFixed(1)} tokens/sec, ${elapsed}ms total`);
      
      model.metadata.benchmarkSpeed = tokensPerSecond;
      model.metadata.benchmarkLatency = elapsed;
      
      return {
        tokensPerSecond,
        latency: elapsed,
        tokensGenerated
      };
      
    } catch (error) {
      logger.warn('Speed benchmark failed:', error);
      return null;
    }
  }

  /**
   * Update performance metrics
   */
  updateMetrics(result, latency) {
    this.performanceMetrics.totalRequests++;
    
    if (result.usage) {
      this.performanceMetrics.totalTokens += result.usage.totalTokens || 0;
      
      if (result.usage.completionTokens && latency) {
        const tps = (result.usage.completionTokens / latency) * 1000;
        this.performanceMetrics.tokensPerSecond.push(tps);
        
        // Keep last 100 measurements
        if (this.performanceMetrics.tokensPerSecond.length > 100) {
          this.performanceMetrics.tokensPerSecond.shift();
        }
      }
    }
    
    // Update average latency
    const currentAvg = this.performanceMetrics.averageLatency;
    const count = this.performanceMetrics.totalRequests;
    this.performanceMetrics.averageLatency = ((currentAvg * (count - 1)) + latency) / count;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const tpsArray = this.performanceMetrics.tokensPerSecond;
    const avgTps = tpsArray.length > 0
      ? tpsArray.reduce((a, b) => a + b, 0) / tpsArray.length
      : 0;
    
    return {
      totalRequests: this.performanceMetrics.totalRequests,
      totalTokens: this.performanceMetrics.totalTokens,
      averageLatency: this.performanceMetrics.averageLatency.toFixed(0),
      averageTokensPerSecond: avgTps.toFixed(1),
      peakTokensPerSecond: Math.max(...tpsArray, 0).toFixed(1)
    };
  }

  /**
   * Handle rate limiting with exponential backoff
   */
  async handleRateLimit(error) {
    const retryAfter = parseInt(error.headers?.['retry-after']) || 5;
    const jitter = Math.random() * 1000;
    const delay = (retryAfter * 1000) + jitter;
    
    logger.info(`Rate limited. Waiting ${(delay / 1000).toFixed(1)}s before retry...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Check if error should trigger retry
   */
  shouldRetry(error) {
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'rate_limit',
      '503',
      '502',
      '429'
    ];
    
    return retryableErrors.some(e => 
      error.message?.toLowerCase().includes(e.toLowerCase()) ||
      error.code === e
    );
  }

  /**
   * List available Groq models
   */
  async listModels() {
    return Object.keys(GROQ_MODELS).map(id => ({
      id,
      ...GROQ_MODELS[id],
      performance: this.performanceMetrics.totalRequests > 0
        ? this.getPerformanceStats()
        : null
    }));
  }

  /**
   * Get model information
   */
  getModelInfo(modelId) {
    return GROQ_MODELS[modelId] || {
      contextWindow: 4096,
      maxOutput: 4096,
      cost: { input: 0, output: 0 },
      speed: 'unknown',
      features: [],
      description: 'Unknown Groq model'
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
      currency: 'USD',
      costPerToken: ((inputCost + outputCost) / usage.totalTokens).toFixed(6)
    };
  }

  /**
   * Get fastest model for requirements
   */
  getFastestModel(requirements = {}) {
    const models = Object.entries(GROQ_MODELS);
    
    // Filter by requirements
    const eligible = models.filter(([id, config]) => {
      if (requirements.minContext && config.contextWindow < requirements.minContext) {
        return false;
      }
      if (requirements.maxCost && config.cost.output > requirements.maxCost) {
        return false;
      }
      return true;
    });
    
    // Sort by speed (all Groq models are fast, but some are faster)
    const speedOrder = ['ultra_fast', 'very_fast', 'fast'];
    eligible.sort((a, b) => {
      const aSpeed = speedOrder.indexOf(a[1].speed);
      const bSpeed = speedOrder.indexOf(b[1].speed);
      return aSpeed - bSpeed;
    });
    
    return eligible[0]?.[0] || 'mixtral-8x7b-32768';
  }
}

export default GroqAdapter;