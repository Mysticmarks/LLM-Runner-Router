# Custom Adapter Reference

Complete guide for creating and implementing custom adapters for the LLM Router system.

## Overview

Custom adapters allow you to integrate any LLM provider or service into the LLM Router system. This reference covers the complete adapter interface, implementation patterns, and best practices for building robust custom adapters.

## Configuration

### Setting Up Custom Adapters

```javascript
import { LLMRouter } from 'llm-runner-router';
import { MyCustomAdapter } from './my-custom-adapter.js';

const router = new LLMRouter({
  providers: ['custom'],
  adapters: {
    'my-custom-provider': MyCustomAdapter
  },
  'my-custom-provider': {
    apiKey: process.env.MY_CUSTOM_API_KEY,
    baseURL: 'https://api.mycustomprovider.com',
    timeout: 30000,
    retries: 3
  }
});
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `adapters` | object | Map of adapter names to adapter classes |
| Custom provider config | object | Provider-specific configuration |

## Examples

### Simple Custom Adapter

```javascript
class SimpleCustomAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL;
  }

  async generate(request) {
    const response = await fetch(`${this.baseURL}/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: request.prompt,
        max_tokens: request.maxTokens
      })
    });

    const data = await response.json();
    
    return {
      text: data.text,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      }
    };
  }
}
```

### Advanced Custom Adapter with Streaming

```javascript
class StreamingCustomAdapter extends BaseAdapter {
  async *stream(request) {
    const response = await fetch(`${this.baseURL}/stream`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: request.prompt,
        max_tokens: request.maxTokens,
        stream: true
      })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          if (data.text) {
            yield {
              text: data.text,
              finished: data.finished || false
            };
          }
        }
      }
    }
  }
}
```

## Adapter Interface

### Base Adapter Class

```javascript
// src/adapters/BaseAdapter.js
class BaseAdapter {
  constructor(config = {}) {
    this.config = config;
    this.name = this.constructor.name.toLowerCase().replace('adapter', '');
    this.isInitialized = false;
  }

  // Required methods to implement
  async initialize() {
    throw new Error('initialize() must be implemented');
  }

  async generate(request) {
    throw new Error('generate() must be implemented');
  }

  async generateStream(request) {
    throw new Error('generateStream() must be implemented');
  }

  // Optional methods
  async getModels() {
    return [];
  }

  async getUsage() {
    return { requests: 0, tokens: 0, cost: 0 };
  }

  validateRequest(request) {
    if (!request.prompt && !request.messages) {
      throw new Error('Either prompt or messages must be provided');
    }
    return true;
  }

  cleanup() {
    // Override if cleanup is needed
  }
}
```

### Required Interface Methods

#### 1. initialize()

```javascript
async initialize() {
  // Setup API clients, validate config, etc.
  if (!this.config.apiKey) {
    throw new Error('API key is required');
  }
  
  this.client = new YourAPIClient({
    apiKey: this.config.apiKey,
    baseURL: this.config.baseURL
  });
  
  // Test connection
  try {
    await this.client.testConnection();
    this.isInitialized = true;
  } catch (error) {
    throw new Error(`Failed to initialize: ${error.message}`);
  }
}
```

#### 2. generate()

```javascript
async generate(request) {
  this.validateRequest(request);
  
  const startTime = Date.now();
  
  try {
    const response = await this.client.complete({
      model: request.model,
      prompt: request.prompt,
      messages: request.messages,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      // ... other parameters
    });
    
    return {
      text: response.content,
      usage: {
        promptTokens: response.usage.inputTokens,
        completionTokens: response.usage.outputTokens,
        totalTokens: response.usage.totalTokens
      },
      model: request.model,
      latency: Date.now() - startTime,
      metadata: {
        requestId: response.id,
        finishReason: response.finishReason
      }
    };
  } catch (error) {
    throw this.handleError(error);
  }
}
```

#### 3. generateStream()

```javascript
async* generateStream(request) {
  this.validateRequest(request);
  
  try {
    const stream = await this.client.streamComplete({
      model: request.model,
      prompt: request.prompt,
      messages: request.messages,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      stream: true
    });
    
    for await (const chunk of stream) {
      if (chunk.delta?.content) {
        yield {
          text: chunk.delta.content,
          delta: chunk.delta.content,
          isComplete: false,
          metadata: {
            chunkId: chunk.id
          }
        };
      }
    }
    
    yield {
      text: '',
      delta: '',
      isComplete: true,
      usage: {
        // Final usage stats if available
      }
    };
  } catch (error) {
    throw this.handleError(error);
  }
}
```

## Complete Custom Adapter Example

### Example: Hugging Face Adapter

```javascript
// src/adapters/HuggingFaceAdapter.js
import { BaseAdapter } from './BaseAdapter.js';

class HuggingFaceAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config);
    this.baseURL = config.baseURL || 'https://api-inference.huggingface.co';
    this.models = new Map();
  }

  async initialize() {
    if (!this.config.apiKey) {
      throw new Error('Hugging Face API key is required');
    }

    // Test API connection
    try {
      await this.getModels();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize Hugging Face adapter: ${error.message}`);
    }
  }

  async generate(request) {
    this.validateRequest(request);

    const startTime = Date.now();
    const endpoint = `${this.baseURL}/models/${request.model}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: this.formatInput(request),
          parameters: {
            max_new_tokens: request.maxTokens || 100,
            temperature: request.temperature || 0.7,
            top_p: request.topP || 0.9,
            do_sample: true,
            return_full_text: false
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const generatedText = this.extractText(data);

      return {
        text: generatedText,
        usage: {
          promptTokens: this.estimateTokens(this.formatInput(request)),
          completionTokens: this.estimateTokens(generatedText),
          totalTokens: this.estimateTokens(this.formatInput(request)) + 
                       this.estimateTokens(generatedText)
        },
        model: request.model,
        latency: Date.now() - startTime,
        metadata: {
          provider: 'huggingface',
          endpoint
        }
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async* generateStream(request) {
    // Hugging Face Inference API doesn't support streaming
    // Fall back to regular generation
    const response = await this.generate(request);
    
    // Simulate streaming by yielding words
    const words = response.text.split(' ');
    for (let i = 0; i < words.length; i++) {
      yield {
        text: words.slice(0, i + 1).join(' '),
        delta: i === 0 ? words[i] : ` ${words[i]}`,
        isComplete: i === words.length - 1,
        metadata: response.metadata
      };
      
      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  async getModels() {
    try {
      const response = await fetch('https://huggingface.co/api/models?pipeline_tag=text-generation&limit=100', {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const models = await response.json();
      return models.map(model => ({
        id: model.modelId,
        name: model.modelId,
        description: model.description || '',
        contextLength: 2048, // Default for most HF models
        provider: 'huggingface'
      }));
    } catch (error) {
      console.warn('Failed to fetch HuggingFace models:', error.message);
      return [];
    }
  }

  formatInput(request) {
    if (request.messages) {
      // Convert messages to text format
      return request.messages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n') + '\nassistant:';
    }
    return request.prompt;
  }

  extractText(response) {
    if (Array.isArray(response)) {
      return response[0]?.generated_text || '';
    }
    return response.generated_text || '';
  }

  estimateTokens(text) {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  handleError(error) {
    if (error.message.includes('401')) {
      return new Error('Invalid Hugging Face API key');
    }
    if (error.message.includes('429')) {
      return new Error('Rate limit exceeded');
    }
    if (error.message.includes('503')) {
      return new Error('Model is loading, please wait and try again');
    }
    return error;
  }
}

export { HuggingFaceAdapter };
```

## Advanced Adapter Features

### 1. Function Calling Support

```javascript
class CustomAdapterWithFunctions extends BaseAdapter {
  async generate(request) {
    if (request.tools && request.tools.length > 0) {
      return this.generateWithTools(request);
    }
    return this.generateRegular(request);
  }

  async generateWithTools(request) {
    // First, check if the model wants to call a function
    const response = await this.client.complete({
      ...request,
      tools: request.tools,
      toolChoice: request.toolChoice
    });

    if (response.toolCalls) {
      return {
        text: response.content,
        toolCalls: response.toolCalls.map(call => ({
          id: call.id,
          type: 'function',
          function: {
            name: call.function.name,
            arguments: call.function.arguments
          }
        })),
        usage: response.usage,
        model: request.model
      };
    }

    return {
      text: response.content,
      usage: response.usage,
      model: request.model
    };
  }
}
```

### 2. Vision/Multimodal Support

```javascript
class MultimodalAdapter extends BaseAdapter {
  async generate(request) {
    // Handle multimodal content
    if (this.hasImageContent(request)) {
      return this.generateWithVision(request);
    }
    return this.generateText(request);
  }

  hasImageContent(request) {
    if (!request.messages) return false;
    
    return request.messages.some(message => 
      Array.isArray(message.content) && 
      message.content.some(content => content.type === 'image_url')
    );
  }

  async generateWithVision(request) {
    const processedMessages = await this.processImageMessages(request.messages);
    
    const response = await this.client.complete({
      ...request,
      messages: processedMessages
    });

    return {
      text: response.content,
      usage: response.usage,
      model: request.model,
      metadata: {
        hasImages: true,
        imageCount: this.countImages(request.messages)
      }
    };
  }

  async processImageMessages(messages) {
    return Promise.all(messages.map(async message => {
      if (Array.isArray(message.content)) {
        const processedContent = await Promise.all(
          message.content.map(async content => {
            if (content.type === 'image_url') {
              // Download and encode image if necessary
              return {
                type: 'image_url',
                image_url: {
                  url: await this.processImageUrl(content.image_url.url),
                  detail: content.image_url.detail || 'auto'
                }
              };
            }
            return content;
          })
        );
        return { ...message, content: processedContent };
      }
      return message;
    }));
  }
}
```

### 3. Caching and Rate Limiting

```javascript
class CachedAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.cache = new Map();
    this.rateLimiter = new RateLimiter({
      requestsPerMinute: config.requestsPerMinute || 60,
      tokensPerMinute: config.tokensPerMinute || 150000
    });
  }

  async generate(request) {
    // Check cache first
    const cacheKey = this.getCacheKey(request);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Wait for rate limit
    await this.rateLimiter.waitForSlot();

    try {
      const response = await super.generate(request);
      
      // Cache successful responses
      if (request.cache !== false) {
        this.cache.set(cacheKey, response);
      }

      return response;
    } finally {
      this.rateLimiter.releaseSlot();
    }
  }

  getCacheKey(request) {
    return JSON.stringify({
      model: request.model,
      prompt: request.prompt,
      messages: request.messages,
      temperature: request.temperature,
      maxTokens: request.maxTokens
    });
  }
}
```

## Adapter Registration

### 1. Register with Router

```javascript
// Register your custom adapter
import { LLMRouter } from 'llm-runner-router';
import { HuggingFaceAdapter } from './adapters/HuggingFaceAdapter.js';

// Method 1: Register during construction
const router = new LLMRouter({
  adapters: {
    'huggingface': HuggingFaceAdapter
  },
  providers: ['huggingface'],
  huggingface: {
    apiKey: process.env.HUGGINGFACE_API_KEY
  }
});

// Method 2: Register after construction
router.registerAdapter('huggingface', HuggingFaceAdapter);
```

### 2. Dynamic Adapter Loading

```javascript
// Dynamic loading for plugin systems
class AdapterManager {
  constructor() {
    this.adapters = new Map();
  }

  async loadAdapter(name, adapterPath, config) {
    try {
      const AdapterClass = await import(adapterPath);
      const adapter = new AdapterClass.default(config);
      await adapter.initialize();
      
      this.adapters.set(name, adapter);
      return adapter;
    } catch (error) {
      throw new Error(`Failed to load adapter ${name}: ${error.message}`);
    }
  }

  getAdapter(name) {
    return this.adapters.get(name);
  }

  async unloadAdapter(name) {
    const adapter = this.adapters.get(name);
    if (adapter && adapter.cleanup) {
      await adapter.cleanup();
    }
    this.adapters.delete(name);
  }
}
```

## Testing Custom Adapters

### 1. Basic Test Suite

```javascript
// tests/adapters/HuggingFaceAdapter.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { HuggingFaceAdapter } from '../src/adapters/HuggingFaceAdapter.js';

describe('HuggingFaceAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new HuggingFaceAdapter({
      apiKey: 'test-key'
    });
  });

  it('should initialize successfully', async () => {
    // Mock the API call
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    });

    await adapter.initialize();
    expect(adapter.isInitialized).toBe(true);
  });

  it('should generate text response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{
        generated_text: 'This is a test response'
      }])
    });

    await adapter.initialize();
    
    const response = await adapter.generate({
      model: 'gpt2',
      prompt: 'Hello world',
      maxTokens: 100
    });

    expect(response.text).toBe('This is a test response');
    expect(response.usage.totalTokens).toBeGreaterThan(0);
  });

  it('should handle streaming', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{
        generated_text: 'This is a streaming test'
      }])
    });

    await adapter.initialize();
    
    const chunks = [];
    const stream = adapter.generateStream({
      model: 'gpt2',
      prompt: 'Hello world'
    });

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[chunks.length - 1].isComplete).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized')
    });

    await adapter.initialize();
    
    await expect(adapter.generate({
      model: 'gpt2',
      prompt: 'Hello world'
    })).rejects.toThrow('Invalid Hugging Face API key');
  });
});
```

### 2. Integration Tests

```javascript
// tests/integration/custom-adapter.test.js
import { LLMRouter } from 'llm-runner-router';
import { HuggingFaceAdapter } from '../src/adapters/HuggingFaceAdapter.js';

describe('Custom Adapter Integration', () => {
  it('should work with LLMRouter', async () => {
    const router = new LLMRouter({
      adapters: {
        'huggingface': HuggingFaceAdapter
      },
      providers: ['huggingface'],
      huggingface: {
        apiKey: process.env.HUGGINGFACE_API_KEY
      }
    });

    const response = await router.generate({
      provider: 'huggingface',
      model: 'gpt2',
      prompt: 'The future of AI is',
      maxTokens: 50
    });

    expect(response.text).toBeTruthy();
    expect(response.provider).toBe('huggingface');
  });
});
```

## Best Practices

### 1. Error Handling

```javascript
class RobustAdapter extends BaseAdapter {
  handleError(error) {
    // Categorize errors for better handling
    if (this.isRateLimitError(error)) {
      return {
        type: 'rate_limit',
        message: 'Rate limit exceeded',
        retryAfter: this.extractRetryAfter(error),
        originalError: error
      };
    }

    if (this.isAuthError(error)) {
      return {
        type: 'authentication',
        message: 'Invalid API credentials',
        originalError: error
      };
    }

    if (this.isServerError(error)) {
      return {
        type: 'server_error',
        message: 'Provider server error',
        retryable: true,
        originalError: error
      };
    }

    return {
      type: 'unknown',
      message: error.message,
      originalError: error
    };
  }

  isRateLimitError(error) {
    return error.status === 429 || 
           error.message.includes('rate limit') ||
           error.message.includes('quota exceeded');
  }

  isAuthError(error) {
    return error.status === 401 || 
           error.status === 403 ||
           error.message.includes('unauthorized') ||
           error.message.includes('forbidden');
  }

  isServerError(error) {
    return error.status >= 500 || 
           error.message.includes('server error') ||
           error.message.includes('internal error');
  }
}
```

### 2. Configuration Validation

```javascript
class ValidatedAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.validateConfig(config);
  }

  validateConfig(config) {
    const required = ['apiKey'];
    const optional = {
      baseURL: 'string',
      timeout: 'number',
      maxRetries: 'number',
      userAgent: 'string'
    };

    // Check required fields
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`${field} is required for this adapter`);
      }
    }

    // Validate optional fields
    for (const [field, type] of Object.entries(optional)) {
      if (config[field] !== undefined && typeof config[field] !== type) {
        throw new Error(`${field} must be of type ${type}`);
      }
    }

    // Custom validations
    if (config.timeout && config.timeout < 1000) {
      throw new Error('Timeout must be at least 1000ms');
    }

    if (config.maxRetries && config.maxRetries > 10) {
      throw new Error('maxRetries cannot exceed 10');
    }
  }
}
```

### 3. Performance Optimization

```javascript
class OptimizedAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.requestPool = new RequestPool({
      maxConcurrent: config.maxConcurrent || 5,
      timeout: config.timeout || 30000
    });
    this.tokenEstimator = new TokenEstimator();
  }

  async generate(request) {
    // Pre-validate to avoid unnecessary API calls
    const estimatedTokens = this.tokenEstimator.estimate(request);
    if (estimatedTokens > this.getMaxTokens(request.model)) {
      throw new Error('Request exceeds model token limit');
    }

    // Use connection pooling
    return this.requestPool.execute(async () => {
      return super.generate(request);
    });
  }

  getMaxTokens(model) {
    const limits = {
      'gpt-3.5-turbo': 4096,
      'gpt-4': 8192,
      'claude-3-opus': 200000
    };
    return limits[model] || 4096;
  }
}
```

## Deployment and Distribution

### 1. Package Structure

```
my-custom-adapter/
├── package.json
├── README.md
├── src/
│   ├── index.js
│   ├── adapters/
│   │   └── MyAdapter.js
│   └── utils/
│       ├── tokenizer.js
│       └── rate-limiter.js
├── tests/
│   ├── unit/
│   └── integration/
└── docs/
    └── api.md
```

### 2. Package.json Example

```json
{
  "name": "llm-router-custom-adapter",
  "version": "1.0.0",
  "description": "Custom adapter for LLM Router",
  "main": "src/index.js",
  "type": "module",
  "exports": {
    ".": "./src/index.js",
    "./adapter": "./src/adapters/MyAdapter.js"
  },
  "keywords": ["llm", "adapter", "ai", "ml"],
  "peerDependencies": {
    "llm-runner-router": "^1.0.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0"
  },
  "scripts": {
    "test": "vitest",
    "build": "node build.js"
  }
}
```

### 3. Installation and Usage

```bash
# Install the adapter
npm install llm-router-custom-adapter

# Use in your project
```

```javascript
import { LLMRouter } from 'llm-runner-router';
import { MyAdapter } from 'llm-router-custom-adapter/adapter';

const router = new LLMRouter({
  adapters: {
    'my-provider': MyAdapter
  },
  providers: ['my-provider'],
  'my-provider': {
    apiKey: process.env.MY_PROVIDER_API_KEY
  }
});
```

---

**Back to:** [Reference Overview](../README.md) | **See also:** [Custom Adapters Tutorial](../../tutorials/custom-adapters.md)