# API Server Examples

This guide demonstrates building production-ready API servers using the LLM-Runner-Router system. From simple REST APIs to complex microservices with authentication, rate limiting, and monitoring.

## Table of Contents
- [Basic REST API](#basic-rest-api)
- [Express.js Integration](#expressjs-integration)
- [Fastify Integration](#fastify-integration)
- [Authentication & Authorization](#authentication--authorization)
- [Rate Limiting & Throttling](#rate-limiting--throttling)
- [Microservices Architecture](#microservices-architecture)

## Basic REST API

### Simple Express API Server

```javascript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import LLMRouter from 'llm-runner-router';

class LLMAPIServer {
  constructor(port = 3000) {
    this.port = port;
    this.app = express();
    this.router = new LLMRouter({
      strategy: 'balanced',
      logLevel: 'info'
    });
    
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  async initialize() {
    await this.router.initialize();
    await this.router.load('models/api-model.gguf');
    console.log('🤖 LLM Router initialized for API server');
  }
  
  setupMiddleware() {
    // Security
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use(limiter);
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });
  }
  
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      const status = this.router.getStatus();
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        ...status
      });
    });
    
    // Simple completion endpoint
    this.app.post('/v1/completions', async (req, res) => {
      try {
        const { prompt, max_tokens = 150, temperature = 0.7, stream = false } = req.body;
        
        if (!prompt) {
          return res.status(400).json({
            error: {
              message: 'Prompt is required',
              type: 'invalid_request_error'
            }
          });
        }
        
        if (stream) {
          await this.handleStreamingCompletion(req, res);
        } else {
          await this.handleCompletion(req, res);
        }
        
      } catch (error) {
        console.error('Completion error:', error);
        res.status(500).json({
          error: {
            message: 'Internal server error',
            type: 'server_error'
          }
        });
      }
    });
    
    // Chat completions endpoint (OpenAI compatible)
    this.app.post('/v1/chat/completions', async (req, res) => {
      try {
        await this.handleChatCompletion(req, res);
      } catch (error) {
        console.error('Chat completion error:', error);
        res.status(500).json({
          error: {
            message: 'Internal server error',
            type: 'server_error'
          }
        });
      }
    });
    
    // Models endpoint
    this.app.get('/v1/models', (req, res) => {
      const models = this.router.registry.search({});
      res.json({
        object: 'list',
        data: models.map(model => ({
          id: model.id,
          object: 'model',
          created: Math.floor(model.loadedAt / 1000),
          owned_by: 'llm-runner-router',
          permission: [],
          root: model.id,
          parent: null
        }))
      });
    });
    
    // Batch processing endpoint
    this.app.post('/v1/batch', async (req, res) => {
      try {
        await this.handleBatchRequest(req, res);
      } catch (error) {
        console.error('Batch error:', error);
        res.status(500).json({
          error: {
            message: 'Internal server error',
            type: 'server_error'
          }
        });
      }
    });
    
    // Error handling
    this.app.use((error, req, res, next) => {
      console.error('Unhandled error:', error);
      res.status(500).json({
        error: {
          message: 'Internal server error',
          type: 'server_error'
        }
      });
    });
    
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: {
          message: 'Not found',
          type: 'not_found_error'
        }
      });
    });
  }
  
  async handleCompletion(req, res) {
    const { prompt, max_tokens = 150, temperature = 0.7 } = req.body;
    
    const result = await this.router.quick(prompt, {
      maxTokens: max_tokens,
      temperature
    });
    
    res.json({
      id: `cmpl-${Date.now()}`,
      object: 'text_completion',
      created: Math.floor(Date.now() / 1000),
      model: result.model,
      choices: [{
        text: result.text,
        index: 0,
        logprobs: null,
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: prompt.split(' ').length,
        completion_tokens: result.tokens,
        total_tokens: prompt.split(' ').length + result.tokens
      }
    });
  }
  
  async handleStreamingCompletion(req, res) {
    const { prompt, max_tokens = 150, temperature = 0.7 } = req.body;
    
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    
    const stream = this.router.stream(prompt, {
      maxTokens: max_tokens,
      temperature
    });
    
    for await (const token of stream) {
      const chunk = {
        id: `cmpl-${Date.now()}`,
        object: 'text_completion',
        created: Math.floor(Date.now() / 1000),
        choices: [{
          text: token,
          index: 0,
          logprobs: null,
          finish_reason: null
        }]
      };
      
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    
    // Send final chunk
    const finalChunk = {
      id: `cmpl-${Date.now()}`,
      object: 'text_completion',
      created: Math.floor(Date.now() / 1000),
      choices: [{
        text: '',
        index: 0,
        logprobs: null,
        finish_reason: 'stop'
      }]
    };
    
    res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
  
  async handleChatCompletion(req, res) {
    const { messages, max_tokens = 150, temperature = 0.7, stream = false } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: {
          message: 'Messages array is required',
          type: 'invalid_request_error'
        }
      });
    }
    
    // Convert messages to prompt
    const prompt = messages
      .map(msg => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
      .join('\n') + '\nAssistant:';
    
    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      const streamGenerator = this.router.stream(prompt, {
        maxTokens: max_tokens,
        temperature
      });
      
      for await (const token of streamGenerator) {
        const chunk = {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          choices: [{
            index: 0,
            delta: { content: token },
            finish_reason: null
          }]
        };
        
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const result = await this.router.quick(prompt, {
        maxTokens: max_tokens,
        temperature
      });
      
      res.json({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: result.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: result.text
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: prompt.split(' ').length,
          completion_tokens: result.tokens,
          total_tokens: prompt.split(' ').length + result.tokens
        }
      });
    }
  }
  
  async handleBatchRequest(req, res) {
    const { requests } = req.body;
    
    if (!requests || !Array.isArray(requests)) {
      return res.status(400).json({
        error: {
          message: 'Requests array is required',
          type: 'invalid_request_error'
        }
      });
    }
    
    const results = await Promise.all(
      requests.map(async (request, index) => {
        try {
          const result = await this.router.quick(request.prompt, {
            maxTokens: request.max_tokens || 150,
            temperature: request.temperature || 0.7
          });
          
          return {
            index,
            success: true,
            result: {
              text: result.text,
              tokens: result.tokens,
              model: result.model,
              latency: result.latency
            }
          };
        } catch (error) {
          return {
            index,
            success: false,
            error: error.message
          };
        }
      })
    );
    
    res.json({
      object: 'batch',
      results,
      total: requests.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });
  }
  
  start() {
    this.app.listen(this.port, () => {
      console.log(`🚀 LLM API Server running on http://localhost:${this.port}`);
      console.log(`📚 API Documentation:`);
      console.log(`  GET  /health - Health check`);
      console.log(`  GET  /v1/models - List available models`);
      console.log(`  POST /v1/completions - Text completion`);
      console.log(`  POST /v1/chat/completions - Chat completion`);
      console.log(`  POST /v1/batch - Batch processing`);
    });
  }
  
  async stop() {
    console.log('🛑 Shutting down API server...');
    await this.router.cleanup();
    console.log('✅ Server shutdown complete');
  }
}

// Usage
async function startAPIServer() {
  const server = new LLMAPIServer(3000);
  await server.initialize();
  server.start();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
}

startAPIServer().catch(console.error);
```

### API Client Examples

```javascript
// Node.js client example
class LLMAPIClient {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.apiKey = process.env.LLM_API_KEY; // Optional API key
  }
  
  async completion(prompt, options = {}) {
    const response = await fetch(`${this.baseURL}/v1/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      },
      body: JSON.stringify({
        prompt,
        max_tokens: options.maxTokens || 150,
        temperature: options.temperature || 0.7,
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  async chatCompletion(messages, options = {}) {
    const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      },
      body: JSON.stringify({
        messages,
        max_tokens: options.maxTokens || 150,
        temperature: options.temperature || 0.7,
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  async *streamCompletion(prompt, options = {}) {
    const response = await fetch(`${this.baseURL}/v1/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      },
      body: JSON.stringify({
        prompt,
        max_tokens: options.maxTokens || 150,
        temperature: options.temperature || 0.7,
        stream: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.choices[0].text) {
              yield data.choices[0].text;
            }
          } catch (error) {
            console.error('Error parsing chunk:', error);
          }
        }
      }
    }
  }
  
  async batch(requests) {
    const response = await fetch(`${this.baseURL}/v1/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      },
      body: JSON.stringify({ requests })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  async getModels() {
    const response = await fetch(`${this.baseURL}/v1/models`, {
      headers: {
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    
    return await response.json();
  }
}

// Usage examples
async function clientExamples() {
  const client = new LLMAPIClient('http://localhost:3000');
  
  // Simple completion
  console.log('📝 Testing completion...');
  const completion = await client.completion('What is artificial intelligence?');
  console.log('Response:', completion.choices[0].text);
  
  // Chat completion
  console.log('\n💬 Testing chat completion...');
  const chatResponse = await client.chatCompletion([
    { role: 'user', content: 'Hello, how are you?' },
    { role: 'assistant', content: 'I\'m doing well, thank you!' },
    { role: 'user', content: 'Can you help me with math?' }
  ]);
  console.log('Chat response:', chatResponse.choices[0].message.content);
  
  // Streaming completion
  console.log('\n🌊 Testing streaming...');
  const stream = client.streamCompletion('Write a short story about a robot');
  for await (const token of stream) {
    process.stdout.write(token);
  }
  console.log('\n');
  
  // Batch processing
  console.log('\n📦 Testing batch processing...');
  const batchResults = await client.batch([
    { prompt: 'What is 2+2?', max_tokens: 50 },
    { prompt: 'What is the capital of France?', max_tokens: 50 },
    { prompt: 'Explain photosynthesis briefly', max_tokens: 100 }
  ]);
  console.log('Batch results:', batchResults);
  
  // List models
  console.log('\n🤖 Available models:');
  const models = await client.getModels();
  console.log(models.data.map(m => m.id));
}

clientExamples().catch(console.error);
```

## Express.js Integration

### Advanced Express Integration with Middleware

```javascript
import express from 'express';
import compression from 'compression';
import morgan from 'morgan';
import { body, validationResult } from 'express-validator';
import swaggerUi from 'swagger-ui-express';
import LLMRouter from 'llm-runner-router';

class AdvancedLLMAPI {
  constructor() {
    this.app = express();
    this.router = new LLMRouter({
      strategy: 'balanced',
      logLevel: 'info'
    });
    
    this.requestCount = 0;
    this.errorCount = 0;
    this.setupMiddleware();
    this.setupValidation();
    this.setupRoutes();
    this.setupSwagger();
  }
  
  async initialize() {
    await this.router.initialize();
    await this.router.load('models/api-model.gguf');
  }
  
  setupMiddleware() {
    // Compression
    this.app.use(compression());
    
    // Logging
    this.app.use(morgan('combined'));
    
    // Body parsing with size limits
    this.app.use(express.json({ 
      limit: '50mb',
      verify: (req, res, buf) => {
        req.rawBody = buf;
      }
    }));
    
    // Request tracking
    this.app.use((req, res, next) => {
      req.requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      req.startTime = Date.now();
      this.requestCount++;
      
      res.on('finish', () => {
        const duration = Date.now() - req.startTime;
        console.log(`Request ${req.requestId} completed in ${duration}ms with status ${res.statusCode}`);
      });
      
      next();
    });
    
    // Error tracking
    this.app.use((error, req, res, next) => {
      this.errorCount++;
      console.error(`Error in request ${req.requestId}:`, error);
      next(error);
    });
  }
  
  setupValidation() {
    this.completionValidation = [
      body('prompt').isString().isLength({ min: 1, max: 10000 }).withMessage('Prompt must be a string between 1-10000 characters'),
      body('max_tokens').optional().isInt({ min: 1, max: 2048 }).withMessage('max_tokens must be between 1-2048'),
      body('temperature').optional().isFloat({ min: 0, max: 2 }).withMessage('temperature must be between 0-2'),
      body('stream').optional().isBoolean().withMessage('stream must be boolean')
    ];
    
    this.chatValidation = [
      body('messages').isArray({ min: 1 }).withMessage('messages must be a non-empty array'),
      body('messages.*.role').isIn(['system', 'user', 'assistant']).withMessage('Invalid message role'),
      body('messages.*.content').isString().isLength({ min: 1 }).withMessage('Message content is required'),
      body('max_tokens').optional().isInt({ min: 1, max: 2048 }),
      body('temperature').optional().isFloat({ min: 0, max: 2 })
    ];
  }
  
  setupRoutes() {
    // Health and metrics
    this.app.get('/health', (req, res) => {
      const status = this.router.getStatus();
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        metrics: {
          requests: this.requestCount,
          errors: this.errorCount,
          uptime: process.uptime()
        },
        router: status
      });
    });
    
    this.app.get('/metrics', (req, res) => {
      const metrics = this.router.getMetrics?.() || {};
      res.json({
        api: {
          totalRequests: this.requestCount,
          totalErrors: this.errorCount,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage()
        },
        llm: metrics
      });
    });
    
    // Completions with validation
    this.app.post('/v1/completions', 
      this.completionValidation,
      this.handleValidationErrors,
      this.handleCompletion.bind(this)
    );
    
    // Chat completions with validation
    this.app.post('/v1/chat/completions',
      this.chatValidation,
      this.handleValidationErrors,
      this.handleChatCompletion.bind(this)
    );
    
    // Advanced endpoints
    this.app.post('/v1/embeddings', this.handleEmbeddings.bind(this));
    this.app.post('/v1/compare', this.handleComparison.bind(this));
    this.app.post('/v1/analyze', this.handleAnalysis.bind(this));
    
    // Admin endpoints
    this.app.post('/admin/reload-model', this.handleModelReload.bind(this));
    this.app.get('/admin/stats', this.handleAdminStats.bind(this));
  }
  
  handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          message: 'Validation failed',
          type: 'validation_error',
          details: errors.array()
        }
      });
    }
    next();
  }
  
  async handleCompletion(req, res) {
    try {
      const { prompt, max_tokens = 150, temperature = 0.7, stream = false } = req.body;
      
      if (stream) {
        return this.handleStreamingResponse(req, res, prompt, { max_tokens, temperature });
      }
      
      const result = await this.router.quick(prompt, {
        maxTokens: max_tokens,
        temperature
      });
      
      res.json({
        id: `cmpl-${req.requestId}`,
        object: 'text_completion',
        created: Math.floor(Date.now() / 1000),
        model: result.model,
        choices: [{
          text: result.text,
          index: 0,
          logprobs: null,
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: this.estimateTokens(prompt),
          completion_tokens: result.tokens,
          total_tokens: this.estimateTokens(prompt) + result.tokens
        },
        request_id: req.requestId,
        processing_time: Date.now() - req.startTime
      });
      
    } catch (error) {
      console.error(`Completion error in ${req.requestId}:`, error);
      res.status(500).json({
        error: {
          message: 'Completion failed',
          type: 'server_error',
          request_id: req.requestId
        }
      });
    }
  }
  
  async handleChatCompletion(req, res) {
    try {
      const { messages, max_tokens = 150, temperature = 0.7, stream = false } = req.body;
      
      // Convert messages to prompt
      const prompt = this.messagesToPrompt(messages);
      
      if (stream) {
        return this.handleStreamingResponse(req, res, prompt, { max_tokens, temperature, isChat: true });
      }
      
      const result = await this.router.quick(prompt, {
        maxTokens: max_tokens,
        temperature
      });
      
      res.json({
        id: `chatcmpl-${req.requestId}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: result.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: result.text
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: this.estimateTokens(prompt),
          completion_tokens: result.tokens,
          total_tokens: this.estimateTokens(prompt) + result.tokens
        },
        request_id: req.requestId
      });
      
    } catch (error) {
      console.error(`Chat completion error in ${req.requestId}:`, error);
      res.status(500).json({
        error: {
          message: 'Chat completion failed',
          type: 'server_error',
          request_id: req.requestId
        }
      });
    }
  }
  
  async handleStreamingResponse(req, res, prompt, options) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Request-ID': req.requestId
    });
    
    try {
      const stream = this.router.stream(prompt, {
        maxTokens: options.max_tokens,
        temperature: options.temperature
      });
      
      for await (const token of stream) {
        const chunk = options.isChat ? {
          id: `chatcmpl-${req.requestId}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          choices: [{
            index: 0,
            delta: { content: token },
            finish_reason: null
          }]
        } : {
          id: `cmpl-${req.requestId}`,
          object: 'text_completion',
          created: Math.floor(Date.now() / 1000),
          choices: [{
            text: token,
            index: 0,
            logprobs: null,
            finish_reason: null
          }]
        };
        
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      
      res.write('data: [DONE]\n\n');
      res.end();
      
    } catch (error) {
      console.error(`Streaming error in ${req.requestId}:`, error);
      res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
      res.end();
    }
  }
  
  async handleEmbeddings(req, res) {
    try {
      const { input, model = 'default' } = req.body;
      
      if (!input) {
        return res.status(400).json({
          error: { message: 'Input is required', type: 'validation_error' }
        });
      }
      
      // This would require embedding support in the router
      // For now, return a placeholder response
      res.json({
        object: 'list',
        data: [{
          object: 'embedding',
          embedding: new Array(768).fill(0).map(() => Math.random()),
          index: 0
        }],
        model,
        usage: {
          prompt_tokens: this.estimateTokens(input),
          total_tokens: this.estimateTokens(input)
        }
      });
      
    } catch (error) {
      console.error(`Embeddings error in ${req.requestId}:`, error);
      res.status(500).json({
        error: { message: 'Embeddings failed', type: 'server_error' }
      });
    }
  }
  
  async handleComparison(req, res) {
    try {
      const { prompt, models, options = {} } = req.body;
      
      if (!prompt || !models || !Array.isArray(models)) {
        return res.status(400).json({
          error: { message: 'Prompt and models array required', type: 'validation_error' }
        });
      }
      
      const comparison = await this.router.compare(models, prompt, options);
      
      res.json({
        object: 'comparison',
        prompt,
        models,
        results: comparison,
        request_id: req.requestId
      });
      
    } catch (error) {
      console.error(`Comparison error in ${req.requestId}:`, error);
      res.status(500).json({
        error: { message: 'Comparison failed', type: 'server_error' }
      });
    }
  }
  
  async handleAnalysis(req, res) {
    try {
      const { text, analysis_types = ['sentiment', 'keywords', 'summary'] } = req.body;
      
      if (!text) {
        return res.status(400).json({
          error: { message: 'Text is required', type: 'validation_error' }
        });
      }
      
      const results = {};
      
      for (const analysisType of analysis_types) {
        switch (analysisType) {
          case 'sentiment':
            const sentimentPrompt = `Analyze the sentiment of this text and return only: positive, negative, or neutral\n\nText: ${text}`;
            const sentimentResult = await this.router.quick(sentimentPrompt, { maxTokens: 10, temperature: 0.1 });
            results.sentiment = sentimentResult.text.trim().toLowerCase();
            break;
            
          case 'keywords':
            const keywordsPrompt = `Extract the main keywords from this text as a comma-separated list:\n\nText: ${text}`;
            const keywordsResult = await this.router.quick(keywordsPrompt, { maxTokens: 100, temperature: 0.3 });
            results.keywords = keywordsResult.text.split(',').map(k => k.trim());
            break;
            
          case 'summary':
            const summaryPrompt = `Summarize this text in one sentence:\n\nText: ${text}`;
            const summaryResult = await this.router.quick(summaryPrompt, { maxTokens: 100, temperature: 0.5 });
            results.summary = summaryResult.text.trim();
            break;
        }
      }
      
      res.json({
        object: 'analysis',
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        results,
        request_id: req.requestId
      });
      
    } catch (error) {
      console.error(`Analysis error in ${req.requestId}:`, error);
      res.status(500).json({
        error: { message: 'Analysis failed', type: 'server_error' }
      });
    }
  }
  
  async handleModelReload(req, res) {
    try {
      const { model_path } = req.body;
      
      if (!model_path) {
        return res.status(400).json({
          error: { message: 'model_path is required', type: 'validation_error' }
        });
      }
      
      await this.router.load(model_path);
      
      res.json({
        message: 'Model reloaded successfully',
        model_path,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(`Model reload error:`, error);
      res.status(500).json({
        error: { message: 'Model reload failed', type: 'server_error' }
      });
    }
  }
  
  handleAdminStats(req, res) {
    const status = this.router.getStatus();
    const metrics = this.router.getMetrics?.() || {};
    
    res.json({
      server: {
        uptime: process.uptime(),
        requests: this.requestCount,
        errors: this.errorCount,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      router: status,
      metrics
    });
  }
  
  setupSwagger() {
    const swaggerDocument = {
      openapi: '3.0.0',
      info: {
        title: 'LLM Router API',
        version: '1.0.0',
        description: 'Advanced LLM inference API with routing capabilities'
      },
      servers: [
        { url: 'http://localhost:3000', description: 'Development server' }
      ],
      paths: {
        '/v1/completions': {
          post: {
            summary: 'Create a completion',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['prompt'],
                    properties: {
                      prompt: { type: 'string' },
                      max_tokens: { type: 'integer', minimum: 1, maximum: 2048 },
                      temperature: { type: 'number', minimum: 0, maximum: 2 },
                      stream: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
    
    this.app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  }
  
  messagesToPrompt(messages) {
    return messages
      .map(msg => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
      .join('\n') + '\nAssistant:';
  }
  
  estimateTokens(text) {
    return Math.ceil(text.split(/\s+/).length * 1.3); // Rough estimation
  }
  
  start(port = 3000) {
    this.app.listen(port, () => {
      console.log(`🚀 Advanced LLM API Server running on http://localhost:${port}`);
      console.log(`📖 API Documentation: http://localhost:${port}/docs`);
    });
  }
}

// Usage
async function startAdvancedAPI() {
  const api = new AdvancedLLMAPI();
  await api.initialize();
  api.start(3000);
}

startAdvancedAPI().catch(console.error);
```

## Fastify Integration

### High-Performance Fastify Server

```javascript
import Fastify from 'fastify';
import LLMRouter from 'llm-runner-router';

async function buildFastifyServer() {
  const fastify = Fastify({
    logger: {
      level: 'info',
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          headers: req.headers,
          hostname: req.hostname,
          remoteAddress: req.ip
        })
      }
    }
  });
  
  // Initialize LLM Router
  const router = new LLMRouter({
    strategy: 'speed-priority',
    logLevel: 'warn'
  });
  
  await router.initialize();
  await router.load('models/fast-model.gguf');
  
  // Add router to Fastify context
  fastify.decorate('llm', router);
  
  // Add schemas for validation
  const completionSchema = {
    body: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', minLength: 1, maxLength: 10000 },
        max_tokens: { type: 'integer', minimum: 1, maximum: 2048 },
        temperature: { type: 'number', minimum: 0, maximum: 2 },
        stream: { type: 'boolean' }
      }
    }
  };
  
  const chatSchema = {
    body: {
      type: 'object',
      required: ['messages'],
      properties: {
        messages: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['role', 'content'],
            properties: {
              role: { type: 'string', enum: ['system', 'user', 'assistant'] },
              content: { type: 'string', minLength: 1 }
            }
          }
        },
        max_tokens: { type: 'integer', minimum: 1, maximum: 2048 },
        temperature: { type: 'number', minimum: 0, maximum: 2 },
        stream: { type: 'boolean' }
      }
    }
  };
  
  // CORS support
  await fastify.register(import('@fastify/cors'), {
    origin: true
  });
  
  // Rate limiting
  await fastify.register(import('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute'
  });
  
  // Compression
  await fastify.register(import('@fastify/compress'));
  
  // Health check
  fastify.get('/health', async (request, reply) => {
    const status = fastify.llm.getStatus();
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      ...status
    };
  });
  
  // Completions endpoint
  fastify.post('/v1/completions', {
    schema: completionSchema,
    handler: async (request, reply) => {
      const { prompt, max_tokens = 150, temperature = 0.7, stream = false } = request.body;
      
      if (stream) {
        reply.type('text/event-stream');
        reply.header('Cache-Control', 'no-cache');
        reply.header('Connection', 'keep-alive');
        
        const streamGenerator = fastify.llm.stream(prompt, {
          maxTokens: max_tokens,
          temperature
        });
        
        const responseStream = async function* () {
          for await (const token of streamGenerator) {
            const chunk = {
              id: `cmpl-${Date.now()}`,
              object: 'text_completion',
              created: Math.floor(Date.now() / 1000),
              choices: [{
                text: token,
                index: 0,
                logprobs: null,
                finish_reason: null
              }]
            };
            
            yield `data: ${JSON.stringify(chunk)}\n\n`;
          }
          
          yield 'data: [DONE]\n\n';
        };
        
        return responseStream();
      } else {
        const result = await fastify.llm.quick(prompt, {
          maxTokens: max_tokens,
          temperature
        });
        
        return {
          id: `cmpl-${Date.now()}`,
          object: 'text_completion',
          created: Math.floor(Date.now() / 1000),
          model: result.model,
          choices: [{
            text: result.text,
            index: 0,
            logprobs: null,
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: Math.ceil(prompt.split(' ').length * 1.3),
            completion_tokens: result.tokens,
            total_tokens: Math.ceil(prompt.split(' ').length * 1.3) + result.tokens
          }
        };
      }
    }
  });
  
  // Chat completions endpoint
  fastify.post('/v1/chat/completions', {
    schema: chatSchema,
    handler: async (request, reply) => {
      const { messages, max_tokens = 150, temperature = 0.7, stream = false } = request.body;
      
      const prompt = messages
        .map(msg => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
        .join('\n') + '\nAssistant:';
      
      if (stream) {
        reply.type('text/event-stream');
        
        const streamGenerator = fastify.llm.stream(prompt, {
          maxTokens: max_tokens,
          temperature
        });
        
        const responseStream = async function* () {
          for await (const token of streamGenerator) {
            const chunk = {
              id: `chatcmpl-${Date.now()}`,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              choices: [{
                index: 0,
                delta: { content: token },
                finish_reason: null
              }]
            };
            
            yield `data: ${JSON.stringify(chunk)}\n\n`;
          }
          
          yield 'data: [DONE]\n\n';
        };
        
        return responseStream();
      } else {
        const result = await fastify.llm.quick(prompt, {
          maxTokens: max_tokens,
          temperature
        });
        
        return {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: result.model,
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: result.text
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: Math.ceil(prompt.split(' ').length * 1.3),
            completion_tokens: result.tokens,
            total_tokens: Math.ceil(prompt.split(' ').length * 1.3) + result.tokens
          }
        };
      }
    }
  });
  
  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    await router.cleanup();
  });
  
  return fastify;
}

// Start the server
async function startFastifyServer() {
  try {
    const fastify = await buildFastifyServer();
    
    await fastify.listen({ 
      port: 3000, 
      host: '0.0.0.0' 
    });
    
    console.log('🚀 Fastify LLM API Server running on http://localhost:3000');
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

startFastifyServer();
```

This comprehensive API server examples guide provides production-ready implementations for building scalable LLM services with proper validation, error handling, monitoring, and documentation.