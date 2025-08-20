# 🏗️ Provider Adapter Architecture Guide

*Comprehensive technical documentation for implementing new LLM provider adapters*

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Adapter Design Patterns](#adapter-design-patterns)
3. [Implementation Standards](#implementation-standards)
4. [Authentication Patterns](#authentication-patterns)
5. [Request/Response Handling](#requestresponse-handling)
6. [Error Handling & Resilience](#error-handling--resilience)
7. [Testing Framework](#testing-framework)
8. [Performance Guidelines](#performance-guidelines)
9. [Security Best Practices](#security-best-practices)
10. [Examples & Code Templates](#examples--code-templates)

## 🔧 Architecture Overview

### Core Components Hierarchy

```
LLMRouter (Entry Point)
    ↓
APILoader (Base Provider Class)
    ↓
{Provider}Adapter (Specific Implementation)
    ↓
HTTP Client / SDK Integration
    ↓
External Provider API
```

### File Structure Convention

```
src/
├── loaders/
│   ├── APILoader.js                 # Base class for all API providers
│   ├── adapters/                    # Provider-specific implementations
│   │   ├── OpenAIAdapter.js         # ✅ Reference implementation
│   │   ├── AnthropicAdapter.js      # ✅ Reference implementation
│   │   ├── OpenRouterAdapter.js     # ✅ Reference implementation
│   │   ├── GroqAdapter.js           # ✅ Reference implementation
│   │   ├── {NewProvider}Adapter.js  # 🔄 New provider template
│   │   └── index.js                 # Adapter registry
│   └── HFLoader.js                  # Special case: HuggingFace
├── utils/
│   ├── Logger.js                    # Centralized logging
│   └── ModelError.js                # Error types
└── tests/
    └── adapters/                    # Provider-specific tests
        └── {provider}.test.js
```

## 🎯 Adapter Design Patterns

### 1. Standard Adapter Pattern

All provider adapters follow a consistent interface:

```javascript
class ProviderAdapter extends APILoader {
  // 🔧 Configuration & Setup
  constructor(config)
  getHeaders()
  initialize()

  // 🎯 Core Operations
  async load(modelId, options)
  async complete(prompt, options)
  async stream(prompt, options)

  // 📊 Utility Methods
  parseResponse(data)
  calculateCost(usage)
  listModels()
  validate(config)

  // 🧹 Lifecycle Management
  async unload(modelId)
  getInfo()
}
```

### 2. Provider Configuration Schema

```javascript
// PROVIDER_CONFIGS entry in APILoader.js
{
  baseURL: 'https://api.provider.com/v1',
  models: ['model-1', 'model-2', 'auto'],
  headers: (apiKey) => ({
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }),
  streaming: true,
  rateLimit: {
    requestsPerMinute: 60,
    requestsPerSecond: 2
  },
  costPerMillion: {
    input: 10.00,  // USD per million input tokens
    output: 30.00  // USD per million output tokens
  },
  features: {
    functionCalling: false,
    vision: false,
    multiModal: false,
    embeddings: false
  }
}
```

### 3. Unified Response Format

All adapters must return responses in this standard format:

```javascript
{
  text: string,           // Generated text content
  model: string,          // Model ID used
  provider: string,       // Provider name
  usage: {
    promptTokens: number,
    completionTokens: number,
    totalTokens: number
  },
  cost: number,           // Cost in USD
  finishReason: string,   // 'stop', 'length', 'content_filter', etc.
  metadata: {             // Provider-specific metadata
    ...additionalFields
  },
  timestamp: number       // Unix timestamp
}
```

## 🔐 Authentication Patterns

### 1. API Key Authentication (Most Common)

```javascript
class ProviderAdapter extends APILoader {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.PROVIDER_API_KEY;
    
    if (!this.apiKey) {
      throw new Error(`API key required for ${this.provider}`);
    }
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }
}
```

### 2. SDK-Based Authentication (AWS, GCP, Azure)

```javascript
class CloudProviderAdapter extends APILoader {
  constructor(config = {}) {
    super(config);
    this.region = config.region || 'us-east-1';
    this.credentials = config.credentials;
  }

  async initialize() {
    // Initialize cloud SDK
    this.client = await this.createClient();
  }

  async createClient() {
    // Cloud-specific SDK initialization
    // AWS: new BedrockClient({region, credentials})
    // GCP: new VertexAI({projectId, keyFilename})
    // Azure: new OpenAIClient({endpoint, credentials})
  }
}
```

### 3. OAuth2 Authentication

```javascript
class OAuthProviderAdapter extends APILoader {
  constructor(config = {}) {
    super(config);
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.accessToken = null;
    this.refreshToken = config.refreshToken;
  }

  async authenticate() {
    if (!this.accessToken || this.isTokenExpired()) {
      await this.refreshAccessToken();
    }
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }
}
```

## 🔄 Request/Response Handling

### 1. Request Building Pattern

```javascript
buildRequest(prompt, model, options) {
  const baseRequest = {
    model: model.modelId,
    max_tokens: options.maxTokens || 1000,
    temperature: options.temperature || 0.7,
    stream: options.stream || false
  };

  // Provider-specific formatting
  switch (this.provider) {
    case 'openai-compatible':
      return {
        ...baseRequest,
        messages: this.formatMessages(prompt, options)
      };
      
    case 'anthropic-format':
      return {
        ...baseRequest,
        messages: this.formatAnthropicMessages(prompt, options),
        system: options.systemPrompt
      };
      
    case 'custom-format':
      return this.formatCustomRequest(prompt, baseRequest, options);
      
    default:
      return baseRequest;
  }
}
```

### 2. Response Parsing Pattern

```javascript
parseResponse(data, model) {
  let text, usage, finishReason;

  // Handle different response formats
  if (this.isOpenAIFormat(data)) {
    const choice = data.choices?.[0];
    text = choice?.message?.content || '';
    finishReason = choice?.finish_reason;
    usage = data.usage;
  } else if (this.isAnthropicFormat(data)) {
    text = data.content?.[0]?.text || '';
    finishReason = data.stop_reason;
    usage = {
      prompt_tokens: data.usage?.input_tokens,
      completion_tokens: data.usage?.output_tokens,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    };
  } else {
    // Custom parsing logic
    ({ text, usage, finishReason } = this.parseCustomFormat(data));
  }

  return {
    text,
    model: model.id,
    provider: this.provider,
    usage: this.normalizeUsage(usage),
    cost: this.calculateCost(usage, model.modelId),
    finishReason,
    metadata: this.extractMetadata(data),
    timestamp: Date.now()
  };
}
```

### 3. Streaming Response Handling

```javascript
async *handleStream(response, model) {
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
            const chunk = this.parseStreamChunk(parsed, model);
            if (chunk) yield chunk;
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
```

## ⚠️ Error Handling & Resilience

### 1. Error Classification

```javascript
class ProviderError extends Error {
  constructor(message, type, status, provider, retryable = false) {
    super(message);
    this.name = 'ProviderError';
    this.type = type;           // 'auth', 'rate_limit', 'invalid_request', etc.
    this.status = status;       // HTTP status code
    this.provider = provider;   // Provider name
    this.retryable = retryable; // Whether this error can be retried
  }
}

// Error type mapping
const ERROR_TYPES = {
  400: { type: 'invalid_request', retryable: false },
  401: { type: 'authentication_error', retryable: false },
  403: { type: 'permission_denied', retryable: false },
  429: { type: 'rate_limit_error', retryable: true },
  500: { type: 'server_error', retryable: true },
  502: { type: 'bad_gateway', retryable: true },
  503: { type: 'service_unavailable', retryable: true },
  504: { type: 'timeout', retryable: true }
};
```

### 2. Retry Logic with Exponential Backoff

```javascript
async robustRequest(requestFn, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const baseDelay = options.baseDelay || 1000;
  const maxDelay = options.maxDelay || 30000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      if (attempt === maxRetries || !this.shouldRetry(error)) {
        throw error;
      }

      const delay = Math.min(
        baseDelay * Math.pow(2, attempt),
        maxDelay
      );

      logger.warn(`Request failed, retrying in ${delay}ms...`, {
        attempt: attempt + 1,
        maxRetries,
        error: error.message
      });

      await this.sleep(delay);
    }
  }
}

shouldRetry(error) {
  return error.retryable || 
         error.status >= 500 || 
         error.status === 429 ||
         error.code === 'ECONNRESET' ||
         error.code === 'ETIMEDOUT';
}
```

### 3. Circuit Breaker Pattern

```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureThreshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}
```

## 🧪 Testing Framework

### 1. Unit Test Template

```javascript
import { jest } from '@jest/globals';
import ProviderAdapter from '../src/loaders/adapters/ProviderAdapter.js';

describe('ProviderAdapter', () => {
  let adapter;
  
  beforeEach(() => {
    adapter = new ProviderAdapter({
      apiKey: 'test-key',
      baseURL: 'https://api.test.com'
    });
  });

  describe('initialization', () => {
    test('should initialize with correct config', () => {
      expect(adapter.provider).toBe('provider-name');
      expect(adapter.apiKey).toBe('test-key');
    });

    test('should throw error without API key', () => {
      expect(() => new ProviderAdapter({})).toThrow('API key required');
    });
  });

  describe('load', () => {
    test('should load model successfully', async () => {
      const model = await adapter.load('test-model');
      expect(model.id).toContain('test-model');
      expect(model.loaded).toBe(true);
    });
  });

  describe('complete', () => {
    beforeEach(async () => {
      await adapter.load('test-model');
    });

    test('should generate completion', async () => {
      // Mock API response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Test response' } }],
          usage: { total_tokens: 50 }
        })
      });

      const result = await adapter.complete('Test prompt');
      
      expect(result.text).toBe('Test response');
      expect(result.provider).toBe('provider-name');
      expect(result.usage.totalTokens).toBe(50);
    });

    test('should handle API errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limit exceeded')
      });

      await expect(adapter.complete('Test')).rejects.toThrow('Rate limit');
    });
  });

  describe('streaming', () => {
    test('should handle streaming responses', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n');
          controller.enqueue('data: {"choices":[{"delta":{"content":" world"}}]}\n\n');
          controller.enqueue('data: [DONE]\n\n');
          controller.close();
        }
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: mockStream
      });

      const chunks = [];
      for await (const chunk of adapter.stream('Test prompt')) {
        chunks.push(chunk.text);
      }

      expect(chunks).toEqual(['Hello', ' world']);
    });
  });
});
```

### 2. Integration Test Template

```javascript
describe('ProviderAdapter Integration', () => {
  let adapter;

  beforeAll(() => {
    if (!process.env.PROVIDER_API_KEY) {
      console.warn('Skipping integration tests - no API key');
      return;
    }
    
    adapter = new ProviderAdapter({
      apiKey: process.env.PROVIDER_API_KEY
    });
  });

  test('should perform end-to-end completion', async () => {
    if (!adapter) return;

    await adapter.load('available-model');
    const result = await adapter.complete('Hello, world!', {
      maxTokens: 10
    });

    expect(result.text).toBeTruthy();
    expect(result.usage.totalTokens).toBeGreaterThan(0);
    expect(result.cost).toBeGreaterThan(0);
  }, 30000);
});
```

## 🚀 Performance Guidelines

### 1. Caching Strategy

```javascript
class CachedAdapter extends ProviderAdapter {
  constructor(config) {
    super(config);
    this.cache = new Map();
    this.cacheTimeout = config.cacheTimeout || 3600000; // 1 hour
  }

  async complete(prompt, options = {}) {
    const cacheKey = this.generateCacheKey(prompt, options);
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return { ...cached.response, cached: true };
      }
    }

    const response = await super.complete(prompt, options);
    
    this.cache.set(cacheKey, {
      response,
      timestamp: Date.now()
    });

    return response;
  }

  generateCacheKey(prompt, options) {
    const key = {
      prompt,
      model: options.model?.id,
      temperature: options.temperature,
      maxTokens: options.maxTokens
    };
    return JSON.stringify(key);
  }
}
```

### 2. Rate Limiting

```javascript
class RateLimitedAdapter extends ProviderAdapter {
  constructor(config) {
    super(config);
    this.rateLimiter = new TokenBucket(
      config.requestsPerMinute || 60,
      config.requestsPerSecond || 2
    );
  }

  async complete(prompt, options = {}) {
    await this.rateLimiter.waitForToken();
    return super.complete(prompt, options);
  }
}

class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  async waitForToken() {
    this.refill();
    
    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) * (1000 / this.refillRate);
      await this.sleep(waitTime);
      this.refill();
    }
    
    this.tokens -= 1;
  }

  refill() {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}
```

### 3. Connection Pooling & Keep-Alive

```javascript
class OptimizedAdapter extends ProviderAdapter {
  constructor(config) {
    super(config);
    
    // Configure HTTP client for optimal performance
    this.httpClient = new HttpClient({
      keepAlive: true,
      maxSockets: 10,
      timeout: 30000,
      retries: 3
    });
  }

  async makeRequest(url, options) {
    return this.httpClient.request({
      url,
      method: 'POST',
      headers: this.getHeaders(),
      ...options
    });
  }
}
```

## 🔒 Security Best Practices

### 1. API Key Management

```javascript
class SecureAdapter extends ProviderAdapter {
  constructor(config) {
    super(config);
    
    // Never log API keys
    this.apiKey = this.sanitizeApiKey(config.apiKey);
    
    // Validate API key format
    this.validateApiKey();
  }

  sanitizeApiKey(apiKey) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    // Remove whitespace and validate format
    const cleaned = apiKey.trim();
    
    if (cleaned.length < 10) {
      throw new Error('Invalid API key format');
    }
    
    return cleaned;
  }

  validateApiKey() {
    // Provider-specific validation
    const patterns = {
      openai: /^sk-[A-Za-z0-9]{48}$/,
      anthropic: /^sk-ant-api\d{2}-[A-Za-z0-9-_]{95}$/,
      // Add other provider patterns
    };

    const pattern = patterns[this.provider];
    if (pattern && !pattern.test(this.apiKey)) {
      logger.warn(`API key format may be invalid for ${this.provider}`);
    }
  }

  getLogSafeConfig() {
    return {
      ...this.config,
      apiKey: this.maskApiKey(this.apiKey)
    };
  }

  maskApiKey(key) {
    if (!key || key.length < 8) return '[MASKED]';
    return key.slice(0, 4) + '*'.repeat(key.length - 8) + key.slice(-4);
  }
}
```

### 2. Input Sanitization

```javascript
sanitizeInput(prompt, options) {
  // Remove potentially harmful content
  const sanitizedPrompt = prompt
    .replace(/[^\w\s\.,!?-]/g, '') // Remove special characters
    .trim()
    .slice(0, 100000); // Limit length

  // Validate options
  const sanitizedOptions = {
    maxTokens: Math.min(Math.max(1, options.maxTokens || 1000), 8192),
    temperature: Math.min(Math.max(0, options.temperature || 0.7), 2),
    topP: Math.min(Math.max(0, options.topP || 1), 1)
  };

  return { prompt: sanitizedPrompt, options: sanitizedOptions };
}
```

### 3. Request Validation

```javascript
validateRequest(prompt, options) {
  const errors = [];

  if (!prompt || typeof prompt !== 'string') {
    errors.push('Prompt must be a non-empty string');
  }

  if (prompt.length > 100000) {
    errors.push('Prompt too long (max 100,000 characters)');
  }

  if (options.maxTokens && (options.maxTokens < 1 || options.maxTokens > 8192)) {
    errors.push('maxTokens must be between 1 and 8192');
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join(', '));
  }
}
```

## 📝 Complete Implementation Template

Here's a complete, production-ready adapter template:

```javascript
/**
 * 🎯 {ProviderName} Provider Adapter
 * 
 * Production-ready adapter for {Provider Name} API integration
 * Features: Authentication, streaming, error handling, rate limiting, caching
 */

import APILoader from '../APILoader.js';
import { Logger } from '../../utils/Logger.js';
import { ProviderError } from '../../utils/ModelError.js';

const logger = new Logger('{ProviderName}Adapter');

/**
 * Provider-specific constants
 */
const PROVIDER_CONFIG = {
  baseURL: 'https://api.{provider}.com/v1',
  defaultModel: '{default-model}',
  rateLimit: {
    requestsPerMinute: 60,
    requestsPerSecond: 2
  },
  pricing: {
    // Per million tokens in USD
    '{model-1}': { input: 10.00, output: 30.00 },
    '{model-2}': { input: 5.00, output: 15.00 }
  }
};

/**
 * Available models with metadata
 */
const MODELS = {
  '{model-1}': {
    contextWindow: 8192,
    strengths: ['reasoning', 'code'],
    features: ['streaming', 'function-calling']
  },
  '{model-2}': {
    contextWindow: 32768,
    strengths: ['long-context', 'analysis'],
    features: ['streaming']
  }
};

class {ProviderName}Adapter extends APILoader {
  constructor(config = {}) {
    super({
      ...config,
      provider: '{provider-id}',
      baseURL: config.baseURL || PROVIDER_CONFIG.baseURL,
      apiKey: config.apiKey || process.env.{PROVIDER}_API_KEY
    });

    // Initialize components
    this.models = new Map();
    this.rateLimiter = new TokenBucket(
      PROVIDER_CONFIG.rateLimit.requestsPerMinute,
      PROVIDER_CONFIG.rateLimit.requestsPerSecond
    );
    this.circuitBreaker = new CircuitBreaker();

    // Validate configuration
    this.validateConfig();
    
    logger.info(`🎯 ${this.provider} adapter initialized`);
  }

  /**
   * Validate adapter configuration
   */
  validateConfig() {
    if (!this.apiKey) {
      throw new Error(`${this.provider} API key required`);
    }

    // Provider-specific validation
    if (!this.isValidApiKey(this.apiKey)) {
      logger.warn(`${this.provider} API key format may be invalid`);
    }
  }

  /**
   * Check API key format
   */
  isValidApiKey(key) {
    // Implement provider-specific validation
    return key && key.length > 10;
  }

  /**
   * Get request headers
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'LLM-Runner-Router/2.0.0',
      // Add provider-specific headers
    };
  }

  /**
   * Load and register a model
   */
  async load(modelId, options = {}) {
    try {
      const modelInfo = MODELS[modelId];
      if (!modelInfo) {
        logger.warn(`Model ${modelId} not recognized, attempting load anyway`);
      }

      // Test connection if requested
      if (options.testConnection !== false) {
        await this.testConnection(modelId);
      }

      const model = {
        id: `${this.provider}:${modelId}`,
        provider: this.provider,
        modelId,
        config: {
          ...PROVIDER_CONFIG,
          ...options
        },
        metadata: {
          ...modelInfo,
          loaded: true,
          loadedAt: Date.now()
        }
      };

      this.models.set(modelId, model);
      logger.info(`✅ Model loaded: ${model.id}`);
      
      return model;
    } catch (error) {
      logger.error(`Failed to load model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Test API connection
   */
  async testConnection(modelId) {
    try {
      await this.complete('Hello', {
        model: { modelId },
        maxTokens: 5,
        stream: false
      });
      logger.debug(`✅ Connection test passed for ${modelId}`);
    } catch (error) {
      throw new ProviderError(
        `Connection test failed: ${error.message}`,
        'connection_error',
        error.status,
        this.provider
      );
    }
  }

  /**
   * Generate completion
   */
  async complete(prompt, options = {}) {
    // Rate limiting
    await this.rateLimiter.waitForToken();

    // Input validation
    this.validateInput(prompt, options);

    // Build request
    const request = this.buildRequest(prompt, options);

    // Execute with circuit breaker
    return this.circuitBreaker.execute(async () => {
      if (options.stream) {
        return this.streamCompletion(request, options);
      } else {
        return this.standardCompletion(request, options);
      }
    });
  }

  /**
   * Validate input parameters
   */
  validateInput(prompt, options) {
    if (!prompt || typeof prompt !== 'string') {
      throw new ProviderError(
        'Prompt must be a non-empty string',
        'invalid_request',
        400,
        this.provider
      );
    }

    if (prompt.length > 100000) {
      throw new ProviderError(
        'Prompt too long (max 100,000 characters)',
        'invalid_request',
        400,
        this.provider
      );
    }
  }

  /**
   * Build provider-specific request
   */
  buildRequest(prompt, options) {
    const model = options.model || { modelId: PROVIDER_CONFIG.defaultModel };
    
    return {
      model: model.modelId,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.maxTokens || 1000,
      temperature: options.temperature || 0.7,
      stream: options.stream || false
    };
  }

  /**
   * Standard (non-streaming) completion
   */
  async standardCompletion(request, options) {
    const response = await this.makeRequest('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(request)
    });

    const data = await response.json();
    return this.parseResponse(data, options.model);
  }

  /**
   * Streaming completion
   */
  async streamCompletion(request, options) {
    const response = await this.makeRequest('/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ ...request, stream: true })
    });

    return this.handleStream(response, options.model);
  }

  /**
   * Make HTTP request with error handling
   */
  async makeRequest(endpoint, options) {
    const url = `${this.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers
      }
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response;
  }

  /**
   * Handle API errors
   */
  async handleError(response) {
    const errorText = await response.text();
    let errorData;
    
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }

    const errorType = this.mapErrorType(response.status);
    
    throw new ProviderError(
      errorData.message || `API error: ${response.statusText}`,
      errorType.type,
      response.status,
      this.provider,
      errorType.retryable
    );
  }

  /**
   * Map HTTP status to error type
   */
  mapErrorType(status) {
    const mapping = {
      400: { type: 'invalid_request', retryable: false },
      401: { type: 'authentication_error', retryable: false },
      403: { type: 'permission_denied', retryable: false },
      429: { type: 'rate_limit_error', retryable: true },
      500: { type: 'server_error', retryable: true },
      502: { type: 'bad_gateway', retryable: true },
      503: { type: 'service_unavailable', retryable: true },
      504: { type: 'timeout', retryable: true }
    };

    return mapping[status] || { type: 'unknown_error', retryable: false };
  }

  /**
   * Parse API response
   */
  parseResponse(data, model) {
    const choice = data.choices?.[0];
    const text = choice?.message?.content || '';
    const usage = data.usage || {};

    return {
      text,
      model: model?.id || `${this.provider}:${data.model}`,
      provider: this.provider,
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      },
      cost: this.calculateCost(usage, data.model),
      finishReason: choice?.finish_reason || 'unknown',
      metadata: {
        id: data.id,
        created: data.created
      },
      timestamp: Date.now()
    };
  }

  /**
   * Calculate request cost
   */
  calculateCost(usage, modelId) {
    const pricing = PROVIDER_CONFIG.pricing[modelId];
    if (!pricing) return 0;

    const inputCost = (usage.prompt_tokens / 1000000) * pricing.input;
    const outputCost = (usage.completion_tokens / 1000000) * pricing.output;
    
    return inputCost + outputCost;
  }

  /**
   * Handle streaming response
   */
  async *handleStream(response, model) {
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
                  model: model?.id,
                  provider: this.provider,
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
   * List available models
   */
  async listModels() {
    try {
      const response = await this.makeRequest('/models');
      const data = await response.json();
      
      return data.data?.map(model => ({
        id: model.id,
        name: model.id,
        provider: this.provider,
        metadata: MODELS[model.id] || {}
      })) || Object.keys(MODELS).map(id => ({
        id,
        name: id,
        provider: this.provider,
        metadata: MODELS[id]
      }));
    } catch (error) {
      logger.warn('Failed to fetch models, using defaults');
      return Object.keys(MODELS).map(id => ({
        id,
        name: id,
        provider: this.provider,
        metadata: MODELS[id]
      }));
    }
  }

  /**
   * Get adapter information
   */
  getInfo() {
    return {
      name: '{ProviderName}Adapter',
      version: '1.0.0',
      provider: this.provider,
      modelsLoaded: this.models.size,
      features: ['streaming', 'rate-limiting', 'error-handling', 'caching'],
      models: Object.keys(MODELS),
      status: 'ready'
    };
  }

  /**
   * Unload model
   */
  async unload(modelId) {
    if (this.models.has(modelId)) {
      this.models.delete(modelId);
      logger.info(`Model ${modelId} unloaded`);
      return true;
    }
    return false;
  }

  /**
   * Clean up resources
   */
  async dispose() {
    this.models.clear();
    logger.info(`${this.provider} adapter disposed`);
  }
}

export default {ProviderName}Adapter;
```

This architecture guide provides a comprehensive foundation for implementing robust, production-ready LLM provider adapters with consistent patterns, proper error handling, and enterprise-grade features.