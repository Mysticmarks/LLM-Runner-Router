# 🔌 Building Custom Adapters

Comprehensive guide for creating custom adapters to integrate new LLM providers, APIs, and services with LLM-Runner-Router.

## Table of Contents

1. [Overview](#overview)
2. [Adapter Architecture](#adapter-architecture)
3. [Basic Adapter Implementation](#basic-adapter-implementation)
4. [Advanced Adapter Features](#advanced-adapter-features)
5. [Provider-Specific Patterns](#provider-specific-patterns)
6. [Testing and Validation](#testing-and-validation)
7. [Publishing and Distribution](#publishing-and-distribution)
8. [Real-World Examples](#real-world-examples)

## Overview

Custom adapters allow you to integrate any LLM provider or service with LLM-Runner-Router's unified interface. This enables consistent routing, fallback handling, and optimization across all providers.

### Adapter Benefits

- **Unified Interface**: Same API for all providers
- **Automatic Fallback**: Seamless provider switching
- **Cost Tracking**: Built-in usage monitoring
- **Rate Limiting**: Automatic throttling
- **Streaming Support**: Real-time responses
- **Error Handling**: Robust error recovery

## Adapter Architecture

### 1. Core Adapter Interface

```javascript
// Base adapter interface
class BaseAdapter {
  constructor(config = {}) {
    this.name = 'base-adapter';
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.costTracker = new CostTracker();
  }
  
  // Required methods
  async initialize() {
    throw new Error('initialize() must be implemented');
  }
  
  async generate(request) {
    throw new Error('generate() must be implemented');
  }
  
  async generateStream(request) {
    throw new Error('generateStream() must be implemented');
  }
  
  async generateEmbedding(request) {
    throw new Error('generateEmbedding() must be implemented');
  }
  
  // Optional methods with default implementations
  async healthCheck() {
    try {
      await this.generate({
        prompt: 'test',
        maxTokens: 1
      });
      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
  
  getCapabilities() {
    return {
      generation: true,
      streaming: true,
      embeddings: false,
      functionCalling: false,
      vision: false,
      multimodal: false
    };
  }
  
  getModels() {
    return [];
  }
  
  estimateCost(request, response) {
    return 0;
  }
  
  validateRequest(request) {
    const required = ['prompt'];
    
    for (const field of required) {
      if (!request[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }
  
  transformRequest(request) {
    return request;
  }
  
  transformResponse(response) {
    return response;
  }
  
  handleError(error) {
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded');
    }
    
    if (error.response?.status >= 500) {
      throw new Error('Provider server error');
    }
    
    throw error;
  }
}
```

### 2. Request/Response Standards

```javascript
// Standard request format
const StandardRequest = {
  // Required
  prompt: 'string',
  
  // Optional generation parameters
  model: 'string',
  maxTokens: 'number',
  temperature: 'number',
  topP: 'number',
  stop: 'string[]',
  
  // Messages format (alternative to prompt)
  messages: [
    { role: 'system|user|assistant', content: 'string' }
  ],
  
  // Advanced features
  tools: 'object[]',
  toolChoice: 'string|object',
  stream: 'boolean',
  
  // Metadata
  metadata: 'object',
  userId: 'string'
};

// Standard response format
const StandardResponse = {
  // Required
  text: 'string',
  
  // Optional fields
  model: 'string',
  usage: {
    promptTokens: 'number',
    completionTokens: 'number',
    totalTokens: 'number'
  },
  
  // Advanced features
  toolCalls: 'object[]',
  
  // Metadata
  id: 'string',
  provider: 'string',
  cost: 'number',
  latency: 'number',
  cached: 'boolean'
};
```

## Basic Adapter Implementation

### 1. Simple HTTP API Adapter

```javascript
class SimpleAPIAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.name = 'simple-api';
    this.baseURL = config.baseURL;
    this.apiKey = config.apiKey;
    this.defaultModel = config.defaultModel || 'default';
  }
  
  async initialize() {
    // Validate configuration
    if (!this.baseURL) {
      throw new Error('baseURL is required');
    }
    
    if (!this.apiKey) {
      throw new Error('apiKey is required');
    }
    
    // Test connection
    await this.healthCheck();
  }
  
  async generate(request) {
    // Validate request
    this.validateRequest(request);
    
    // Check rate limits
    await this.rateLimiter.checkLimit();
    
    // Transform request to provider format
    const providerRequest = this.transformRequest(request);
    
    try {
      const response = await fetch(`${this.baseURL}/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(providerRequest)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Transform response to standard format
      const standardResponse = this.transformResponse(data);
      
      // Track cost and usage
      this.trackUsage(request, standardResponse);
      
      return standardResponse;
      
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async generateStream(request) {
    this.validateRequest(request);
    await this.rateLimiter.checkLimit();
    
    const providerRequest = {
      ...this.transformRequest(request),
      stream: true
    };
    
    try {
      const response = await fetch(`${this.baseURL}/stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(providerRequest)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return this.createStreamParser(response.body);
      
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async *createStreamParser(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              return;
            }
            
            try {
              const chunk = JSON.parse(data);
              yield this.transformStreamChunk(chunk);
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
  
  transformRequest(request) {
    return {
      prompt: request.prompt,
      model: request.model || this.defaultModel,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      top_p: request.topP,
      stop: request.stop
    };
  }
  
  transformResponse(response) {
    return {
      text: response.text || response.content,
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      },
      id: response.id,
      provider: this.name
    };
  }
  
  transformStreamChunk(chunk) {
    return {
      text: chunk.delta?.content || chunk.text || '',
      model: chunk.model,
      id: chunk.id,
      provider: this.name
    };
  }
  
  trackUsage(request, response) {
    const cost = this.estimateCost(request, response);
    
    this.costTracker.track({
      provider: this.name,
      model: response.model,
      tokens: response.usage?.totalTokens || 0,
      cost
    });
  }
  
  estimateCost(request, response) {
    // Simple cost calculation
    const tokensUsed = response.usage?.totalTokens || 0;
    const costPerToken = 0.002 / 1000; // $0.002 per 1K tokens
    
    return tokensUsed * costPerToken;
  }
  
  getModels() {
    return [
      {
        name: this.defaultModel,
        contextLength: 4096,
        maxTokens: 1024,
        costPer1kTokens: 0.002
      }
    ];
  }
}
```

### 2. WebSocket Adapter

```javascript
class WebSocketAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.name = 'websocket-provider';
    this.wsURL = config.wsURL;
    this.connection = null;
    this.pendingRequests = new Map();
    this.requestId = 0;
  }
  
  async initialize() {
    await this.connect();
  }
  
  async connect() {
    return new Promise((resolve, reject) => {
      this.connection = new WebSocket(this.wsURL);
      
      this.connection.onopen = () => {
        console.log('WebSocket connected');
        resolve();
      };
      
      this.connection.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
      
      this.connection.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
      
      this.connection.onclose = () => {
        console.log('WebSocket disconnected');
        this.reconnect();
      };
    });
  }
  
  async reconnect() {
    setTimeout(() => {
      console.log('Reconnecting WebSocket...');
      this.connect().catch(console.error);
    }, 5000);
  }
  
  handleMessage(message) {
    const { requestId, type, data, error } = message;
    const pending = this.pendingRequests.get(requestId);
    
    if (!pending) return;
    
    switch (type) {
      case 'response':
        pending.resolve(this.transformResponse(data));
        this.pendingRequests.delete(requestId);
        break;
        
      case 'chunk':
        if (pending.onChunk) {
          pending.onChunk(this.transformStreamChunk(data));
        }
        break;
        
      case 'complete':
        if (pending.onComplete) {
          pending.onComplete();
        }
        this.pendingRequests.delete(requestId);
        break;
        
      case 'error':
        pending.reject(new Error(error));
        this.pendingRequests.delete(requestId);
        break;
    }
  }
  
  async generate(request) {
    this.validateRequest(request);
    await this.rateLimiter.checkLimit();
    
    return new Promise((resolve, reject) => {
      const requestId = ++this.requestId;
      
      this.pendingRequests.set(requestId, { resolve, reject });
      
      this.connection.send(JSON.stringify({
        requestId,
        type: 'generate',
        data: this.transformRequest(request)
      }));
      
      // Timeout handling
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }
  
  async generateStream(request) {
    this.validateRequest(request);
    await this.rateLimiter.checkLimit();
    
    return new Promise((resolve, reject) => {
      const requestId = ++this.requestId;
      const chunks = [];
      
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        onChunk: (chunk) => {
          chunks.push(chunk);
        },
        onComplete: () => {
          resolve(this.createAsyncIterator(chunks));
        }
      });
      
      this.connection.send(JSON.stringify({
        requestId,
        type: 'stream',
        data: this.transformRequest(request)
      }));
    });
  }
  
  async *createAsyncIterator(chunks) {
    for (const chunk of chunks) {
      yield chunk;
    }
  }
  
  transformRequest(request) {
    return {
      prompt: request.prompt,
      model: request.model,
      parameters: {
        maxTokens: request.maxTokens,
        temperature: request.temperature
      }
    };
  }
  
  transformResponse(response) {
    return {
      text: response.generated_text,
      model: response.model,
      usage: response.usage,
      id: response.id,
      provider: this.name
    };
  }
  
  transformStreamChunk(chunk) {
    return {
      text: chunk.token,
      model: chunk.model,
      provider: this.name
    };
  }
}
```

## Advanced Adapter Features

### 1. Multi-Modal Adapter

```javascript
class MultiModalAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.name = 'multimodal-provider';
    this.supportedFormats = ['text', 'image', 'audio'];
  }
  
  getCapabilities() {
    return {
      generation: true,
      streaming: true,
      embeddings: true,
      functionCalling: true,
      vision: true,
      multimodal: true,
      audioInput: true,
      imageGeneration: true
    };
  }
  
  async generate(request) {
    this.validateRequest(request);
    
    // Handle different input types
    const processedRequest = await this.processMultiModalInput(request);
    
    return super.generate(processedRequest);
  }
  
  async processMultiModalInput(request) {
    const processed = { ...request };
    
    // Handle image inputs
    if (request.images) {
      processed.images = await Promise.all(
        request.images.map(img => this.processImage(img))
      );
    }
    
    // Handle audio inputs
    if (request.audio) {
      processed.audio = await this.processAudio(request.audio);
    }
    
    // Handle file uploads
    if (request.files) {
      processed.files = await Promise.all(
        request.files.map(file => this.processFile(file))
      );
    }
    
    return processed;
  }
  
  async processImage(image) {
    // Handle different image formats
    if (typeof image === 'string') {
      if (image.startsWith('data:')) {
        // Base64 data URL
        return {
          type: 'base64',
          data: image.split(',')[1],
          mimeType: image.split(';')[0].split(':')[1]
        };
      } else if (image.startsWith('http')) {
        // URL - download and convert
        const response = await fetch(image);
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        
        return {
          type: 'base64',
          data: base64,
          mimeType: response.headers.get('content-type')
        };
      } else {
        // File path
        const fs = require('fs').promises;
        const buffer = await fs.readFile(image);
        const base64 = buffer.toString('base64');
        
        return {
          type: 'base64',
          data: base64,
          mimeType: this.getMimeType(image)
        };
      }
    }
    
    return image;
  }
  
  async processAudio(audio) {
    if (typeof audio === 'string' && audio.startsWith('data:')) {
      return {
        type: 'base64',
        data: audio.split(',')[1],
        mimeType: audio.split(';')[0].split(':')[1]
      };
    }
    
    // Handle file upload
    return this.processFile(audio);
  }
  
  async processFile(file) {
    if (file.buffer) {
      // File object with buffer
      return {
        type: 'buffer',
        data: file.buffer,
        mimeType: file.mimetype,
        filename: file.originalname
      };
    }
    
    // File path
    const fs = require('fs').promises;
    const buffer = await fs.readFile(file);
    
    return {
      type: 'buffer',
      data: buffer,
      mimeType: this.getMimeType(file),
      filename: file
    };
  }
  
  getMimeType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'mp4': 'video/mp4',
      'pdf': 'application/pdf'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }
  
  transformRequest(request) {
    const transformed = {
      prompt: request.prompt,
      model: request.model,
      max_tokens: request.maxTokens,
      temperature: request.temperature
    };
    
    // Add multimodal content
    if (request.images) {
      transformed.images = request.images;
    }
    
    if (request.audio) {
      transformed.audio = request.audio;
    }
    
    return transformed;
  }
  
  async generateImage(request) {
    this.validateRequest(request);
    
    const response = await fetch(`${this.baseURL}/images/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: request.prompt,
        size: request.size || '1024x1024',
        quality: request.quality || 'standard',
        style: request.style || 'natural'
      })
    });
    
    const data = await response.json();
    
    return {
      images: data.data.map(img => ({
        url: img.url,
        b64_json: img.b64_json,
        revised_prompt: img.revised_prompt
      })),
      provider: this.name
    };
  }
}
```

### 2. Function Calling Adapter

```javascript
class FunctionCallingAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.name = 'function-calling-provider';
    this.toolRegistry = new Map();
  }
  
  getCapabilities() {
    return {
      ...super.getCapabilities(),
      functionCalling: true,
      parallelFunctionCalls: true,
      toolValidation: true
    };
  }
  
  registerTool(tool) {
    this.toolRegistry.set(tool.name, tool);
  }
  
  async generate(request) {
    this.validateRequest(request);
    
    // Handle function calling requests
    if (request.tools || request.toolChoice) {
      return this.generateWithTools(request);
    }
    
    return super.generate(request);
  }
  
  async generateWithTools(request) {
    const transformedRequest = this.transformRequestWithTools(request);
    
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transformedRequest)
    });
    
    const data = await response.json();
    const transformedResponse = this.transformResponseWithTools(data);
    
    // Execute tool calls if present
    if (transformedResponse.toolCalls) {
      transformedResponse.toolResults = await this.executeToolCalls(
        transformedResponse.toolCalls
      );
    }
    
    return transformedResponse;
  }
  
  transformRequestWithTools(request) {
    const transformed = {
      model: request.model || this.defaultModel,
      messages: this.formatMessages(request),
      tools: this.formatTools(request.tools || []),
      tool_choice: this.formatToolChoice(request.toolChoice)
    };
    
    return transformed;
  }
  
  formatMessages(request) {
    if (request.messages) {
      return request.messages;
    }
    
    return [
      { role: 'user', content: request.prompt }
    ];
  }
  
  formatTools(tools) {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }
  
  formatToolChoice(toolChoice) {
    if (!toolChoice) return undefined;
    
    if (toolChoice === 'auto' || toolChoice === 'none') {
      return toolChoice;
    }
    
    if (typeof toolChoice === 'string') {
      return {
        type: 'function',
        function: { name: toolChoice }
      };
    }
    
    return toolChoice;
  }
  
  transformResponseWithTools(response) {
    const message = response.choices[0].message;
    
    const result = {
      text: message.content || '',
      model: response.model,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      },
      id: response.id,
      provider: this.name
    };
    
    // Extract tool calls
    if (message.tool_calls) {
      result.toolCalls = message.tool_calls.map(call => ({
        id: call.id,
        type: call.type,
        function: {
          name: call.function.name,
          arguments: JSON.parse(call.function.arguments)
        }
      }));
    }
    
    return result;
  }
  
  async executeToolCalls(toolCalls) {
    const results = [];
    
    for (const call of toolCalls) {
      const tool = this.toolRegistry.get(call.function.name);
      
      if (!tool) {
        results.push({
          id: call.id,
          error: `Tool ${call.function.name} not found`
        });
        continue;
      }
      
      try {
        const result = await tool.execute(call.function.arguments);
        results.push({
          id: call.id,
          result
        });
      } catch (error) {
        results.push({
          id: call.id,
          error: error.message
        });
      }
    }
    
    return results;
  }
}
```

### 3. Caching Adapter

```javascript
class CachingAdapter extends BaseAdapter {
  constructor(config, baseAdapter) {
    super(config);
    this.baseAdapter = baseAdapter;
    this.name = `cached-${baseAdapter.name}`;
    this.cache = new Map();
    this.ttl = config.cacheTTL || 3600000; // 1 hour
    this.maxSize = config.maxCacheSize || 1000;
  }
  
  async initialize() {
    return this.baseAdapter.initialize();
  }
  
  async generate(request) {
    const cacheKey = this.getCacheKey(request);
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return {
        ...cached,
        cached: true
      };
    }
    
    const response = await this.baseAdapter.generate(request);
    this.setCache(cacheKey, response);
    
    return response;
  }
  
  async generateStream(request) {
    // Streaming responses are not cached
    return this.baseAdapter.generateStream(request);
  }
  
  getCacheKey(request) {
    // Create deterministic cache key
    const key = {
      prompt: request.prompt,
      model: request.model,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      topP: request.topP,
      stop: request.stop
    };
    
    return JSON.stringify(key);
  }
  
  getFromCache(key) {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    // Update access time
    entry.lastAccess = Date.now();
    
    return entry.data;
  }
  
  setCache(key, data) {
    // Evict old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      lastAccess: Date.now()
    });
  }
  
  evictOldest() {
    let oldest = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldest = key;
        oldestTime = entry.lastAccess;
      }
    }
    
    if (oldest) {
      this.cache.delete(oldest);
    }
  }
  
  // Delegate other methods to base adapter
  getCapabilities() {
    return this.baseAdapter.getCapabilities();
  }
  
  getModels() {
    return this.baseAdapter.getModels();
  }
  
  async healthCheck() {
    return this.baseAdapter.healthCheck();
  }
}
```

## Provider-Specific Patterns

### 1. OpenAI-Compatible Adapter

```javascript
class OpenAICompatibleAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.name = config.name || 'openai-compatible';
    this.baseURL = config.baseURL;
    this.apiKey = config.apiKey;
    this.organization = config.organization;
  }
  
  async generate(request) {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(this.organization && { 'OpenAI-Organization': this.organization })
      },
      body: JSON.stringify(this.transformToOpenAIFormat(request))
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    return this.transformFromOpenAIFormat(data);
  }
  
  transformToOpenAIFormat(request) {
    return {
      model: request.model || 'gpt-3.5-turbo',
      messages: request.messages || [
        { role: 'user', content: request.prompt }
      ],
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      top_p: request.topP,
      stop: request.stop,
      stream: false
    };
  }
  
  transformFromOpenAIFormat(response) {
    const choice = response.choices[0];
    
    return {
      text: choice.message.content,
      model: response.model,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      },
      id: response.id,
      provider: this.name,
      finishReason: choice.finish_reason
    };
  }
}
```

### 2. Anthropic-Style Adapter

```javascript
class AnthropicStyleAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.name = 'anthropic-style';
    this.baseURL = config.baseURL;
    this.apiKey = config.apiKey;
    this.version = config.version || '2023-06-01';
  }
  
  async generate(request) {
    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': this.version,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(this.transformToAnthropicFormat(request))
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    return this.transformFromAnthropicFormat(data);
  }
  
  transformToAnthropicFormat(request) {
    const messages = request.messages || [
      { role: 'user', content: request.prompt }
    ];
    
    // Extract system message
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');
    
    return {
      model: request.model || 'claude-3-haiku-20240307',
      max_tokens: request.maxTokens || 1024,
      temperature: request.temperature,
      top_p: request.topP,
      stop_sequences: request.stop,
      system: systemMessage?.content,
      messages: userMessages
    };
  }
  
  transformFromAnthropicFormat(response) {
    return {
      text: response.content[0].text,
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      },
      id: response.id,
      provider: this.name,
      stopReason: response.stop_reason
    };
  }
}
```

### 3. Local Model Adapter

```javascript
class LocalModelAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.name = 'local-model';
    this.modelPath = config.modelPath;
    this.model = null;
    this.device = config.device || 'cpu';
  }
  
  async initialize() {
    // Load local model (example with hypothetical library)
    const ModelLoader = require('./model-loader');
    
    this.model = await ModelLoader.load({
      path: this.modelPath,
      device: this.device,
      precision: 'fp16'
    });
    
    console.log(`Loaded local model: ${this.modelPath}`);
  }
  
  async generate(request) {
    if (!this.model) {
      throw new Error('Model not initialized');
    }
    
    const startTime = Date.now();
    
    const result = await this.model.generate({
      prompt: request.prompt,
      maxTokens: request.maxTokens || 100,
      temperature: request.temperature || 0.7,
      topP: request.topP || 0.9
    });
    
    return {
      text: result.text,
      model: this.modelPath,
      usage: {
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.promptTokens + result.completionTokens
      },
      latency: Date.now() - startTime,
      provider: this.name
    };
  }
  
  async generateStream(request) {
    if (!this.model) {
      throw new Error('Model not initialized');
    }
    
    const stream = this.model.generateStream({
      prompt: request.prompt,
      maxTokens: request.maxTokens || 100,
      temperature: request.temperature || 0.7
    });
    
    return this.wrapLocalStream(stream);
  }
  
  async *wrapLocalStream(stream) {
    for await (const chunk of stream) {
      yield {
        text: chunk.token,
        model: this.modelPath,
        provider: this.name
      };
    }
  }
  
  getCapabilities() {
    return {
      generation: true,
      streaming: true,
      embeddings: false,
      functionCalling: false,
      vision: false,
      multimodal: false
    };
  }
  
  estimateCost() {
    // Local models have no API cost
    return 0;
  }
}
```

## Testing and Validation

### 1. Adapter Test Suite

```javascript
class AdapterTestSuite {
  constructor(adapter) {
    this.adapter = adapter;
    this.testResults = [];
  }
  
  async runAllTests() {
    const tests = [
      this.testInitialization,
      this.testBasicGeneration,
      this.testStreamingGeneration,
      this.testErrorHandling,
      this.testRateLimit,
      this.testCostTracking,
      this.testHealthCheck
    ];
    
    for (const test of tests) {
      try {
        await test.call(this);
        this.testResults.push({
          test: test.name,
          status: 'passed'
        });
      } catch (error) {
        this.testResults.push({
          test: test.name,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    return this.testResults;
  }
  
  async testInitialization() {
    await this.adapter.initialize();
    console.log('✓ Initialization test passed');
  }
  
  async testBasicGeneration() {
    const response = await this.adapter.generate({
      prompt: 'Say "Hello, World!"',
      maxTokens: 10
    });
    
    if (!response.text) {
      throw new Error('No text in response');
    }
    
    if (!response.provider) {
      throw new Error('No provider in response');
    }
    
    console.log('✓ Basic generation test passed');
  }
  
  async testStreamingGeneration() {
    const capabilities = this.adapter.getCapabilities();
    
    if (!capabilities.streaming) {
      console.log('⚠ Streaming not supported, skipping test');
      return;
    }
    
    const stream = await this.adapter.generateStream({
      prompt: 'Count from 1 to 5',
      maxTokens: 20
    });
    
    let chunks = 0;
    for await (const chunk of stream) {
      if (chunk.text) {
        chunks++;
      }
    }
    
    if (chunks === 0) {
      throw new Error('No chunks received from stream');
    }
    
    console.log('✓ Streaming generation test passed');
  }
  
  async testErrorHandling() {
    try {
      await this.adapter.generate({
        // Invalid request - no prompt
        maxTokens: 10
      });
      
      throw new Error('Should have thrown error for invalid request');
    } catch (error) {
      if (error.message.includes('Should have thrown')) {
        throw error;
      }
      
      console.log('✓ Error handling test passed');
    }
  }
  
  async testRateLimit() {
    // Test rate limiting by making multiple requests
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        this.adapter.generate({
          prompt: `Test ${i}`,
          maxTokens: 1
        })
      );
    }
    
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled');
    
    console.log(`✓ Rate limit test: ${successful.length}/10 requests succeeded`);
  }
  
  async testCostTracking() {
    const response = await this.adapter.generate({
      prompt: 'Short test',
      maxTokens: 5
    });
    
    const cost = this.adapter.estimateCost(
      { prompt: 'Short test', maxTokens: 5 },
      response
    );
    
    if (typeof cost !== 'number' || cost < 0) {
      throw new Error('Invalid cost tracking');
    }
    
    console.log('✓ Cost tracking test passed');
  }
  
  async testHealthCheck() {
    const health = await this.adapter.healthCheck();
    
    if (typeof health.healthy !== 'boolean') {
      throw new Error('Health check should return boolean healthy status');
    }
    
    console.log('✓ Health check test passed');
  }
}

// Usage
async function testAdapter(adapter) {
  const testSuite = new AdapterTestSuite(adapter);
  const results = await testSuite.runAllTests();
  
  const passed = results.filter(r => r.status === 'passed').length;
  const total = results.length;
  
  console.log(`\nTest Results: ${passed}/${total} tests passed`);
  
  const failed = results.filter(r => r.status === 'failed');
  if (failed.length > 0) {
    console.log('\nFailed tests:');
    failed.forEach(test => {
      console.log(`- ${test.test}: ${test.error}`);
    });
  }
  
  return results;
}
```

### 2. Performance Benchmarking

```javascript
class AdapterBenchmark {
  constructor(adapter) {
    this.adapter = adapter;
  }
  
  async runBenchmarks() {
    const tests = [
      this.benchmarkLatency,
      this.benchmarkThroughput,
      this.benchmarkConcurrency,
      this.benchmarkMemoryUsage
    ];
    
    const results = {};
    
    for (const test of tests) {
      results[test.name] = await test.call(this);
    }
    
    return results;
  }
  
  async benchmarkLatency() {
    const iterations = 10;
    const latencies = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      
      await this.adapter.generate({
        prompt: 'Quick test',
        maxTokens: 10
      });
      
      latencies.push(Date.now() - start);
    }
    
    return {
      average: latencies.reduce((a, b) => a + b) / latencies.length,
      min: Math.min(...latencies),
      max: Math.max(...latencies),
      p95: this.percentile(latencies, 0.95)
    };
  }
  
  async benchmarkThroughput() {
    const duration = 60000; // 1 minute
    const startTime = Date.now();
    let requests = 0;
    let tokens = 0;
    
    while (Date.now() - startTime < duration) {
      try {
        const response = await this.adapter.generate({
          prompt: 'Throughput test',
          maxTokens: 50
        });
        
        requests++;
        tokens += response.usage?.totalTokens || 50;
      } catch (error) {
        // Continue on errors
      }
    }
    
    const actualDuration = Date.now() - startTime;
    
    return {
      requestsPerSecond: requests / (actualDuration / 1000),
      tokensPerSecond: tokens / (actualDuration / 1000),
      totalRequests: requests,
      totalTokens: tokens
    };
  }
  
  async benchmarkConcurrency() {
    const concurrencyLevels = [1, 5, 10, 20];
    const results = {};
    
    for (const level of concurrencyLevels) {
      const promises = [];
      
      for (let i = 0; i < level; i++) {
        promises.push(this.adapter.generate({
          prompt: `Concurrent test ${i}`,
          maxTokens: 20
        }));
      }
      
      const start = Date.now();
      const responses = await Promise.allSettled(promises);
      const duration = Date.now() - start;
      
      const successful = responses.filter(r => r.status === 'fulfilled').length;
      
      results[`concurrency_${level}`] = {
        successful,
        failed: level - successful,
        averageLatency: duration / level,
        successRate: successful / level
      };
    }
    
    return results;
  }
  
  async benchmarkMemoryUsage() {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Generate many requests to test memory leaks
    for (let i = 0; i < 100; i++) {
      await this.adapter.generate({
        prompt: `Memory test ${i}`,
        maxTokens: 20
      });
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    
    return {
      initialMemoryMB: initialMemory / 1024 / 1024,
      finalMemoryMB: finalMemory / 1024 / 1024,
      memoryIncreaseMB: (finalMemory - initialMemory) / 1024 / 1024
    };
  }
  
  percentile(values, p) {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }
}
```

## Publishing and Distribution

### 1. Adapter Package Structure

```
my-llm-adapter/
├── package.json
├── README.md
├── LICENSE
├── src/
│   ├── index.js
│   ├── adapter.js
│   ├── utils.js
│   └── types.js
├── test/
│   ├── adapter.test.js
│   └── benchmark.test.js
├── examples/
│   ├── basic-usage.js
│   └── advanced-features.js
└── docs/
    ├── API.md
    └── configuration.md
```

### 2. Package.json Configuration

```json
{
  "name": "llm-runner-router-my-adapter",
  "version": "1.0.0",
  "description": "Custom adapter for My LLM Provider",
  "main": "src/index.js",
  "keywords": [
    "llm",
    "adapter",
    "llm-runner-router",
    "ai",
    "language-model"
  ],
  "author": "Your Name",
  "license": "MIT",
  "peerDependencies": {
    "llm-runner-router": "^1.0.0"
  },
  "dependencies": {
    "axios": "^1.0.0"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "@types/node": "^18.0.0"
  },
  "scripts": {
    "test": "jest",
    "benchmark": "node test/benchmark.test.js",
    "lint": "eslint src/",
    "build": "echo 'No build step required'"
  },
  "files": [
    "src/",
    "README.md",
    "LICENSE"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/my-llm-adapter"
  }
}
```

### 3. Documentation Template

```markdown
# My LLM Provider Adapter

Custom adapter for integrating My LLM Provider with LLM-Runner-Router.

## Installation

```bash
npm install llm-runner-router-my-adapter
```

## Usage

```javascript
import { LLMRouter } from 'llm-runner-router';
import { MyProviderAdapter } from 'llm-runner-router-my-adapter';

const router = new LLMRouter();

// Register the adapter
router.registerAdapter('my-provider', new MyProviderAdapter({
  apiKey: process.env.MY_PROVIDER_API_KEY,
  baseURL: 'https://api.myprovider.com/v1'
}));

// Use the adapter
const response = await router.generate({
  prompt: 'Hello, world!',
  provider: 'my-provider'
});
```

## Configuration

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKey` | string | Yes | API key for My Provider |
| `baseURL` | string | No | Base URL for API (default: https://api.myprovider.com/v1) |
| `timeout` | number | No | Request timeout in ms (default: 30000) |

## Features

- ✅ Text generation
- ✅ Streaming responses
- ✅ Function calling
- ❌ Embeddings
- ❌ Image generation

## API Reference

See [API.md](docs/API.md) for detailed API documentation.
```

## Real-World Examples

### 1. Hugging Face Adapter

```javascript
class HuggingFaceAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.name = 'huggingface';
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt2';
    this.baseURL = 'https://api-inference.huggingface.co/models';
  }
  
  async generate(request) {
    const response = await fetch(`${this.baseURL}/${this.model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: request.prompt,
        parameters: {
          max_new_tokens: request.maxTokens,
          temperature: request.temperature,
          top_p: request.topP,
          do_sample: true
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'HuggingFace API error');
    }
    
    const data = await response.json();
    
    return {
      text: data[0].generated_text.replace(request.prompt, '').trim(),
      model: this.model,
      provider: this.name
    };
  }
  
  getModels() {
    return [
      { name: 'gpt2', contextLength: 1024 },
      { name: 'distilgpt2', contextLength: 1024 },
      { name: 'microsoft/DialoGPT-large', contextLength: 1024 }
    ];
  }
}
```

### 2. Replicate Adapter

```javascript
class ReplicateAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.name = 'replicate';
    this.apiToken = config.apiToken;
    this.baseURL = 'https://api.replicate.com/v1';
  }
  
  async generate(request) {
    // Start prediction
    const prediction = await this.startPrediction(request);
    
    // Poll for completion
    const result = await this.pollPrediction(prediction.id);
    
    return {
      text: result.output.join(''),
      model: request.model,
      usage: {
        totalTokens: this.estimateTokens(result.output.join(''))
      },
      provider: this.name,
      predictionId: prediction.id
    };
  }
  
  async startPrediction(request) {
    const response = await fetch(`${this.baseURL}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: request.model,
        input: {
          prompt: request.prompt,
          max_tokens: request.maxTokens,
          temperature: request.temperature
        }
      })
    });
    
    return response.json();
  }
  
  async pollPrediction(id) {
    while (true) {
      const response = await fetch(`${this.baseURL}/predictions/${id}`, {
        headers: {
          'Authorization': `Token ${this.apiToken}`
        }
      });
      
      const prediction = await response.json();
      
      if (prediction.status === 'succeeded') {
        return prediction;
      }
      
      if (prediction.status === 'failed') {
        throw new Error('Prediction failed');
      }
      
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }
}
```

## Best Practices

1. **Follow the interface** - Implement all required methods
2. **Handle errors gracefully** - Provide meaningful error messages
3. **Validate inputs** - Check all required parameters
4. **Transform data correctly** - Map provider formats to standard format
5. **Track usage** - Implement cost and usage tracking
6. **Test thoroughly** - Use the provided test suite
7. **Document everything** - Provide clear documentation and examples
8. **Version carefully** - Use semantic versioning
9. **Handle rate limits** - Implement proper rate limiting
10. **Support streaming** - Implement streaming where possible

## Conclusion

Building custom adapters enables integration with any LLM provider while maintaining the benefits of LLM-Runner-Router's unified interface. By following the patterns in this guide, you can create robust, well-tested adapters that provide seamless provider integration.

---

Next: [Reference Documentation](../reference/) | [Back to Advanced Topics](../advanced/)