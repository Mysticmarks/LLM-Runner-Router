# 🎯 Best Practices for Production LLM Applications

A comprehensive guide to building robust, scalable, and cost-effective LLM applications using LLM-Runner-Router.

## Table of Contents

1. [Architecture Patterns](#architecture-patterns)
2. [Error Handling](#error-handling)
3. [Performance Optimization](#performance-optimization)
4. [Security Best Practices](#security-best-practices)
5. [Cost Management](#cost-management)
6. [Monitoring & Observability](#monitoring--observability)
7. [Testing Strategies](#testing-strategies)
8. [Deployment Guidelines](#deployment-guidelines)

## Architecture Patterns

### 1. Layered Architecture

Implement a clean separation of concerns:

```javascript
// ❌ Bad: Everything in one file
app.post('/chat', async (req, res) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    // Direct API call with hardcoded values
  });
  res.json(response);
});

// ✅ Good: Layered architecture
// controllers/chatController.js
class ChatController {
  constructor(chatService) {
    this.chatService = chatService;
  }
  
  async handleChat(req, res, next) {
    try {
      const { message, userId } = req.body;
      const response = await this.chatService.processMessage(message, userId);
      res.json({ success: true, data: response });
    } catch (error) {
      next(error);
    }
  }
}

// services/chatService.js
class ChatService {
  constructor(llmRouter, cache, rateLimiter) {
    this.llmRouter = llmRouter;
    this.cache = cache;
    this.rateLimiter = rateLimiter;
  }
  
  async processMessage(message, userId) {
    // Check rate limits
    await this.rateLimiter.check(userId);
    
    // Check cache
    const cached = await this.cache.get(message);
    if (cached) return cached;
    
    // Process with LLM
    const response = await this.llmRouter.generate({
      prompt: message,
      userId,
      strategy: 'balanced'
    });
    
    // Cache response
    await this.cache.set(message, response);
    
    return response;
  }
}

// infrastructure/llmRouter.js
const router = new LLMRouter({
  providers: ['openai', 'anthropic', 'groq'],
  fallbackChain: true,
  monitoring: true
});
```

### 2. Circuit Breaker Pattern

Prevent cascading failures:

```javascript
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.state = 'CLOSED';
    this.failures = 0;
    this.nextAttempt = Date.now();
  }
  
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
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
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
  }
}

// Usage
const breaker = new CircuitBreaker();
const router = new LLMRouter();

async function generateWithBreaker(prompt) {
  return breaker.execute(async () => {
    return router.generate({ prompt });
  });
}
```

### 3. Repository Pattern

Abstract data access:

```javascript
// repositories/conversationRepository.js
class ConversationRepository {
  constructor(database) {
    this.db = database;
  }
  
  async save(conversation) {
    const result = await this.db.conversations.insert({
      userId: conversation.userId,
      messages: conversation.messages,
      metadata: conversation.metadata,
      createdAt: new Date()
    });
    return result;
  }
  
  async findByUserId(userId, limit = 10) {
    return this.db.conversations.find({
      userId,
      limit,
      order: 'createdAt DESC'
    });
  }
  
  async addMessage(conversationId, message) {
    return this.db.conversations.update(
      { id: conversationId },
      { $push: { messages: message } }
    );
  }
}
```

## Error Handling

### 1. Comprehensive Error Types

Define specific error classes:

```javascript
// errors/LLMErrors.js
class LLMError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = 'LLMError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class RateLimitError extends LLMError {
  constructor(retryAfter) {
    super('Rate limit exceeded', 'RATE_LIMIT', 429);
    this.retryAfter = retryAfter;
  }
}

class ModelNotAvailableError extends LLMError {
  constructor(model) {
    super(`Model ${model} is not available`, 'MODEL_UNAVAILABLE', 503);
    this.model = model;
  }
}

class InvalidPromptError extends LLMError {
  constructor(reason) {
    super(`Invalid prompt: ${reason}`, 'INVALID_PROMPT', 400);
  }
}

class TokenLimitError extends LLMError {
  constructor(limit, requested) {
    super(`Token limit exceeded: ${requested} > ${limit}`, 'TOKEN_LIMIT', 400);
    this.limit = limit;
    this.requested = requested;
  }
}
```

### 2. Graceful Degradation

Implement fallback strategies:

```javascript
class ResilientLLMService {
  constructor(router) {
    this.router = router;
    this.fallbackResponses = new Map();
  }
  
  async generate(prompt, options = {}) {
    try {
      // Try primary model
      return await this.router.generate({
        ...options,
        prompt,
        model: options.model || 'gpt-4'
      });
    } catch (error) {
      // Log error for monitoring
      logger.error('Primary generation failed', { error, prompt });
      
      // Try fallback model
      if (error.code === 'RATE_LIMIT' || error.code === 'MODEL_UNAVAILABLE') {
        try {
          return await this.router.generate({
            ...options,
            prompt,
            model: 'gpt-3.5-turbo' // Fallback to cheaper/faster model
          });
        } catch (fallbackError) {
          logger.error('Fallback generation failed', { fallbackError });
        }
      }
      
      // Use cached or static response as last resort
      if (this.fallbackResponses.has(prompt)) {
        return {
          text: this.fallbackResponses.get(prompt),
          metadata: { fallback: true }
        };
      }
      
      // Return error response
      return {
        text: "I'm having trouble processing your request. Please try again later.",
        metadata: { error: true }
      };
    }
  }
  
  registerFallback(prompt, response) {
    this.fallbackResponses.set(prompt, response);
  }
}
```

### 3. Retry Logic

Implement intelligent retry mechanisms:

```javascript
async function retryWithExponentialBackoff(
  fn,
  maxRetries = 3,
  baseDelay = 1000
) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (except rate limits)
      if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
        throw error;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        30000 // Max 30 seconds
      );
      
      // Use retry-after header if available
      if (error.retryAfter) {
        await sleep(error.retryAfter * 1000);
      } else {
        await sleep(delay);
      }
      
      logger.info(`Retry attempt ${attempt + 1}/${maxRetries}`);
    }
  }
  
  throw lastError;
}
```

## Performance Optimization

### 1. Connection Pooling

Reuse connections efficiently:

```javascript
// connection/pool.js
class ConnectionPool {
  constructor(options = {}) {
    this.connections = [];
    this.maxConnections = options.maxConnections || 10;
    this.available = [];
    this.inUse = new Set();
  }
  
  async getConnection() {
    // Return available connection
    if (this.available.length > 0) {
      const conn = this.available.pop();
      this.inUse.add(conn);
      return conn;
    }
    
    // Create new connection if under limit
    if (this.connections.length < this.maxConnections) {
      const conn = await this.createConnection();
      this.connections.push(conn);
      this.inUse.add(conn);
      return conn;
    }
    
    // Wait for available connection
    return new Promise((resolve) => {
      const checkAvailable = setInterval(() => {
        if (this.available.length > 0) {
          clearInterval(checkAvailable);
          resolve(this.getConnection());
        }
      }, 100);
    });
  }
  
  releaseConnection(conn) {
    this.inUse.delete(conn);
    this.available.push(conn);
  }
  
  async createConnection() {
    // Create actual connection
    return {
      id: Date.now(),
      createdAt: new Date()
    };
  }
}
```

### 2. Request Batching

Combine multiple requests:

```javascript
class BatchProcessor {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 10;
    this.batchTimeout = options.batchTimeout || 100;
    this.queue = [];
    this.processing = false;
  }
  
  async add(item) {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });
      
      if (this.queue.length >= this.batchSize) {
        this.processBatch();
      } else if (!this.processing) {
        setTimeout(() => this.processBatch(), this.batchTimeout);
      }
    });
  }
  
  async processBatch() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    const batch = this.queue.splice(0, this.batchSize);
    
    try {
      const results = await this.executeBatch(batch.map(b => b.item));
      batch.forEach((b, i) => b.resolve(results[i]));
    } catch (error) {
      batch.forEach(b => b.reject(error));
    } finally {
      this.processing = false;
      
      if (this.queue.length > 0) {
        this.processBatch();
      }
    }
  }
  
  async executeBatch(items) {
    // Process batch with LLM
    const router = new LLMRouter();
    return Promise.all(
      items.map(item => router.generate(item))
    );
  }
}
```

### 3. Streaming Responses

Use streaming for better perceived performance:

```javascript
// streaming/handler.js
async function handleStreamingRequest(req, res) {
  const { prompt } = req.body;
  
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  try {
    const stream = await router.generateStream({
      prompt,
      model: 'gpt-3.5-turbo'
    });
    
    for await (const chunk of stream) {
      // Send SSE formatted data
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      
      // Flush to ensure client receives immediately
      if (res.flush) res.flush();
    }
    
    res.write('data: [DONE]\n\n');
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
  } finally {
    res.end();
  }
}
```

## Security Best Practices

### 1. API Key Management

Never hardcode keys:

```javascript
// ❌ Bad
const apiKey = 'sk-1234567890abcdef';

// ✅ Good
// config/secrets.js
class SecretManager {
  constructor() {
    this.secrets = new Map();
    this.loadFromEnv();
    this.loadFromVault();
  }
  
  loadFromEnv() {
    // Load from environment variables
    const envKeys = [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'GROQ_API_KEY'
    ];
    
    envKeys.forEach(key => {
      if (process.env[key]) {
        this.secrets.set(key, process.env[key]);
      }
    });
  }
  
  async loadFromVault() {
    // Load from secure vault (e.g., AWS Secrets Manager)
    if (process.env.AWS_REGION) {
      const AWS = require('aws-sdk');
      const client = new AWS.SecretsManager();
      
      try {
        const secret = await client.getSecretValue({
          SecretId: 'llm-api-keys'
        }).promise();
        
        const keys = JSON.parse(secret.SecretString);
        Object.entries(keys).forEach(([key, value]) => {
          this.secrets.set(key, value);
        });
      } catch (error) {
        logger.error('Failed to load secrets from vault', error);
      }
    }
  }
  
  get(key) {
    const secret = this.secrets.get(key);
    if (!secret) {
      throw new Error(`Secret ${key} not found`);
    }
    return secret;
  }
  
  // Rotate keys periodically
  async rotateKeys() {
    // Implement key rotation logic
  }
}
```

### 2. Input Validation

Sanitize all inputs:

```javascript
// validation/promptValidator.js
class PromptValidator {
  constructor(options = {}) {
    this.maxLength = options.maxLength || 4000;
    this.blockedPatterns = options.blockedPatterns || [];
    this.allowedCharsets = options.allowedCharsets || 'utf-8';
  }
  
  validate(prompt) {
    // Check length
    if (prompt.length > this.maxLength) {
      throw new InvalidPromptError(`Prompt exceeds maximum length of ${this.maxLength}`);
    }
    
    // Check for injection attempts
    const injectionPatterns = [
      /(\[INST\]|\[\/INST\])/gi,  // Instruction markers
      /(\{\{.*?\}\})/g,             // Template injections
      /<script.*?>.*?<\/script>/gi, // Script tags
      /javascript:/gi               // JavaScript protocol
    ];
    
    for (const pattern of injectionPatterns) {
      if (pattern.test(prompt)) {
        throw new InvalidPromptError('Potential injection detected');
      }
    }
    
    // Check blocked patterns
    for (const pattern of this.blockedPatterns) {
      if (prompt.includes(pattern)) {
        throw new InvalidPromptError('Blocked content detected');
      }
    }
    
    // Sanitize
    return this.sanitize(prompt);
  }
  
  sanitize(prompt) {
    // Remove control characters
    let sanitized = prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    return sanitized;
  }
}
```

### 3. Rate Limiting Per User

Implement user-specific limits:

```javascript
class UserRateLimiter {
  constructor(redis) {
    this.redis = redis;
    this.limits = {
      free: { rpm: 10, tpm: 10000, daily: 100 },
      pro: { rpm: 100, tpm: 100000, daily: 1000 },
      enterprise: { rpm: 1000, tpm: 1000000, daily: 10000 }
    };
  }
  
  async checkLimit(userId, tier = 'free') {
    const limits = this.limits[tier];
    const now = Date.now();
    
    // Check requests per minute
    const minuteKey = `rate:${userId}:${Math.floor(now / 60000)}`;
    const minuteCount = await this.redis.incr(minuteKey);
    await this.redis.expire(minuteKey, 60);
    
    if (minuteCount > limits.rpm) {
      throw new RateLimitError(60);
    }
    
    // Check daily limit
    const dayKey = `rate:${userId}:${new Date().toDateString()}`;
    const dayCount = await this.redis.incr(dayKey);
    await this.redis.expire(dayKey, 86400);
    
    if (dayCount > limits.daily) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const retryAfter = Math.ceil((tomorrow - now) / 1000);
      throw new RateLimitError(retryAfter);
    }
    
    return {
      remaining: {
        minute: limits.rpm - minuteCount,
        daily: limits.daily - dayCount
      }
    };
  }
}
```

## Cost Management

### 1. Budget Alerts

Monitor spending:

```javascript
class BudgetMonitor {
  constructor(options = {}) {
    this.dailyLimit = options.dailyLimit || 100;
    this.monthlyLimit = options.monthlyLimit || 2000;
    this.alertThreshold = options.alertThreshold || 0.8;
    this.costs = new Map();
  }
  
  async trackCost(userId, cost, model) {
    const date = new Date().toDateString();
    const month = new Date().toISOString().slice(0, 7);
    
    // Update daily costs
    const dailyKey = `${userId}:${date}`;
    const dailyCost = (this.costs.get(dailyKey) || 0) + cost;
    this.costs.set(dailyKey, dailyCost);
    
    // Update monthly costs
    const monthlyKey = `${userId}:${month}`;
    const monthlyCost = (this.costs.get(monthlyKey) || 0) + cost;
    this.costs.set(monthlyKey, monthlyCost);
    
    // Check limits
    if (dailyCost > this.dailyLimit) {
      await this.sendAlert('daily_limit_exceeded', {
        userId,
        cost: dailyCost,
        limit: this.dailyLimit
      });
      throw new Error('Daily budget exceeded');
    }
    
    if (monthlyCost > this.monthlyLimit) {
      await this.sendAlert('monthly_limit_exceeded', {
        userId,
        cost: monthlyCost,
        limit: this.monthlyLimit
      });
      throw new Error('Monthly budget exceeded');
    }
    
    // Check alert thresholds
    if (dailyCost > this.dailyLimit * this.alertThreshold) {
      await this.sendAlert('daily_threshold_warning', {
        userId,
        cost: dailyCost,
        threshold: this.dailyLimit * this.alertThreshold
      });
    }
    
    return {
      dailyCost,
      monthlyCost,
      model,
      timestamp: new Date()
    };
  }
  
  async sendAlert(type, data) {
    // Send to monitoring service
    logger.warn(`Budget alert: ${type}`, data);
    
    // Send email/Slack notification
    // await notificationService.send({
    //   type,
    //   data,
    //   severity: 'high'
    // });
  }
}
```

### 2. Smart Model Selection

Choose models based on task complexity:

```javascript
class SmartModelSelector {
  constructor() {
    this.classifiers = {
      complexity: this.assessComplexity.bind(this),
      length: this.assessLength.bind(this),
      domain: this.assessDomain.bind(this)
    };
  }
  
  async selectModel(prompt, requirements = {}) {
    const assessment = await this.assess(prompt);
    
    // Simple queries -> cheap model
    if (assessment.complexity === 'low' && assessment.length < 100) {
      return 'gpt-3.5-turbo';
    }
    
    // Code generation -> specialized model
    if (assessment.domain === 'code') {
      return requirements.quality === 'high' ? 'gpt-4' : 'code-llama';
    }
    
    // Long context -> model with large context window
    if (assessment.length > 4000) {
      return 'claude-3-sonnet'; // 200k context
    }
    
    // Complex reasoning -> powerful model
    if (assessment.complexity === 'high') {
      return requirements.budget === 'low' ? 'gpt-3.5-turbo' : 'gpt-4';
    }
    
    // Default balanced choice
    return 'gpt-3.5-turbo';
  }
  
  async assess(prompt) {
    return {
      complexity: this.assessComplexity(prompt),
      length: prompt.length,
      domain: this.assessDomain(prompt)
    };
  }
  
  assessComplexity(prompt) {
    // Simple heuristics (can be replaced with ML model)
    const complexIndicators = [
      /analyze|explain|compare|evaluate/i,
      /step[\s-]by[\s-]step/i,
      /pros.*cons/i,
      /multiple.*factors/i
    ];
    
    const matches = complexIndicators.filter(pattern => pattern.test(prompt));
    
    if (matches.length >= 2) return 'high';
    if (matches.length === 1) return 'medium';
    return 'low';
  }
  
  assessDomain(prompt) {
    const domains = {
      code: /function|class|variable|code|program|algorithm/i,
      math: /calculate|equation|solve|integral|derivative/i,
      creative: /story|poem|creative|imagine|write/i,
      factual: /what is|who is|when did|where is|define/i
    };
    
    for (const [domain, pattern] of Object.entries(domains)) {
      if (pattern.test(prompt)) return domain;
    }
    
    return 'general';
  }
}
```

## Monitoring & Observability

### 1. Structured Logging

Use consistent log formats:

```javascript
// logging/structuredLogger.js
class StructuredLogger {
  constructor(service = 'llm-router') {
    this.service = service;
    this.context = {};
  }
  
  setContext(context) {
    this.context = { ...this.context, ...context };
  }
  
  log(level, message, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      ...this.context,
      ...data,
      // Add trace ID for distributed tracing
      traceId: this.context.traceId || generateTraceId()
    };
    
    // Send to log aggregation service
    console.log(JSON.stringify(logEntry));
    
    // Send to monitoring service for critical errors
    if (level === 'error' || level === 'fatal') {
      this.sendToMonitoring(logEntry);
    }
  }
  
  info(message, data) {
    this.log('info', message, data);
  }
  
  warn(message, data) {
    this.log('warn', message, data);
  }
  
  error(message, error, data) {
    this.log('error', message, {
      ...data,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      }
    });
  }
  
  metric(name, value, tags = {}) {
    this.log('metric', name, {
      metricName: name,
      metricValue: value,
      metricTags: tags
    });
  }
  
  async sendToMonitoring(logEntry) {
    // Send to Datadog, New Relic, etc.
  }
}
```

### 2. Health Checks

Implement comprehensive health monitoring:

```javascript
// health/healthCheck.js
class HealthChecker {
  constructor(dependencies) {
    this.dependencies = dependencies;
    this.checks = new Map();
    this.registerDefaultChecks();
  }
  
  registerDefaultChecks() {
    // LLM Provider checks
    this.register('openai', async () => {
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
        });
        return response.ok;
      } catch {
        return false;
      }
    });
    
    // Database check
    this.register('database', async () => {
      try {
        await this.dependencies.db.ping();
        return true;
      } catch {
        return false;
      }
    });
    
    // Cache check
    this.register('cache', async () => {
      try {
        await this.dependencies.cache.ping();
        return true;
      } catch {
        return false;
      }
    });
    
    // Memory check
    this.register('memory', () => {
      const used = process.memoryUsage();
      const limit = 1024 * 1024 * 1024; // 1GB
      return used.heapUsed < limit;
    });
  }
  
  register(name, checkFn) {
    this.checks.set(name, checkFn);
  }
  
  async checkAll() {
    const results = {};
    const promises = [];
    
    for (const [name, checkFn] of this.checks) {
      promises.push(
        checkFn()
          .then(result => ({ name, healthy: result }))
          .catch(() => ({ name, healthy: false }))
      );
    }
    
    const checkResults = await Promise.all(promises);
    
    checkResults.forEach(({ name, healthy }) => {
      results[name] = healthy;
    });
    
    const allHealthy = Object.values(results).every(v => v === true);
    
    return {
      status: allHealthy ? 'healthy' : 'degraded',
      checks: results,
      timestamp: new Date().toISOString()
    };
  }
}

// Express endpoint
app.get('/health', async (req, res) => {
  const health = await healthChecker.checkAll();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

### 3. Metrics Collection

Track key performance indicators:

```javascript
class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: new Map(),
      latencies: [],
      errors: new Map(),
      costs: new Map()
    };
  }
  
  recordRequest(model, duration, success, tokens, cost) {
    const hour = new Date().toISOString().slice(0, 13);
    
    // Request counts
    const key = `${model}:${hour}`;
    const current = this.metrics.requests.get(key) || {
      total: 0,
      success: 0,
      failed: 0
    };
    
    current.total++;
    if (success) {
      current.success++;
    } else {
      current.failed++;
    }
    
    this.metrics.requests.set(key, current);
    
    // Latencies
    this.metrics.latencies.push({
      model,
      duration,
      timestamp: Date.now()
    });
    
    // Keep only last hour of latencies
    const hourAgo = Date.now() - 3600000;
    this.metrics.latencies = this.metrics.latencies.filter(
      l => l.timestamp > hourAgo
    );
    
    // Costs
    const costKey = `${model}:${new Date().toDateString()}`;
    const currentCost = this.metrics.costs.get(costKey) || 0;
    this.metrics.costs.set(costKey, currentCost + cost);
  }
  
  getMetrics() {
    const p50 = this.percentile(this.metrics.latencies.map(l => l.duration), 50);
    const p95 = this.percentile(this.metrics.latencies.map(l => l.duration), 95);
    const p99 = this.percentile(this.metrics.latencies.map(l => l.duration), 99);
    
    return {
      latency: { p50, p95, p99 },
      requests: Object.fromEntries(this.metrics.requests),
      errors: Object.fromEntries(this.metrics.errors),
      costs: Object.fromEntries(this.metrics.costs),
      timestamp: new Date().toISOString()
    };
  }
  
  percentile(values, p) {
    if (values.length === 0) return 0;
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }
}
```

## Testing Strategies

### 1. Unit Testing

Test individual components:

```javascript
// tests/llmRouter.test.js
describe('LLMRouter', () => {
  let router;
  let mockProvider;
  
  beforeEach(() => {
    mockProvider = {
      generate: jest.fn()
    };
    
    router = new LLMRouter({
      providers: [mockProvider]
    });
  });
  
  describe('generate', () => {
    it('should route to available provider', async () => {
      mockProvider.generate.mockResolvedValue({
        text: 'Test response',
        model: 'test-model'
      });
      
      const result = await router.generate({
        prompt: 'Test prompt'
      });
      
      expect(result.text).toBe('Test response');
      expect(mockProvider.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Test prompt'
        })
      );
    });
    
    it('should fallback on provider failure', async () => {
      const fallbackProvider = {
        generate: jest.fn().mockResolvedValue({
          text: 'Fallback response'
        })
      };
      
      router = new LLMRouter({
        providers: [mockProvider, fallbackProvider],
        fallbackChain: true
      });
      
      mockProvider.generate.mockRejectedValue(new Error('Provider failed'));
      
      const result = await router.generate({
        prompt: 'Test prompt'
      });
      
      expect(result.text).toBe('Fallback response');
      expect(fallbackProvider.generate).toHaveBeenCalled();
    });
    
    it('should respect rate limits', async () => {
      router = new LLMRouter({
        providers: [mockProvider],
        rateLimiting: {
          requestsPerMinute: 1
        }
      });
      
      mockProvider.generate.mockResolvedValue({ text: 'Response' });
      
      await router.generate({ prompt: 'First' });
      
      await expect(
        router.generate({ prompt: 'Second' })
      ).rejects.toThrow('Rate limit exceeded');
    });
  });
});
```

### 2. Integration Testing

Test component interactions:

```javascript
// tests/integration/chatService.test.js
describe('ChatService Integration', () => {
  let service;
  let testDb;
  
  beforeAll(async () => {
    // Setup test database
    testDb = await setupTestDatabase();
    
    // Initialize service with real dependencies
    service = new ChatService({
      db: testDb,
      router: new LLMRouter({
        providers: ['mock'],
        cache: new InMemoryCache()
      })
    });
  });
  
  afterAll(async () => {
    await testDb.close();
  });
  
  it('should handle complete conversation flow', async () => {
    const userId = 'test-user';
    
    // Start conversation
    const conversation = await service.startConversation(userId);
    expect(conversation.id).toBeDefined();
    
    // Send message
    const response = await service.sendMessage(
      conversation.id,
      'Hello, how are you?'
    );
    
    expect(response.text).toBeDefined();
    expect(response.conversationId).toBe(conversation.id);
    
    // Verify persistence
    const saved = await service.getConversation(conversation.id);
    expect(saved.messages).toHaveLength(2); // User message + AI response
  });
  
  it('should handle concurrent requests', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      service.sendMessage('conv-1', `Message ${i}`)
    );
    
    const results = await Promise.all(promises);
    
    expect(results).toHaveLength(10);
    results.forEach(result => {
      expect(result.text).toBeDefined();
    });
  });
});
```

### 3. Load Testing

Test system under stress:

```javascript
// tests/load/stress.test.js
const autocannon = require('autocannon');

describe('Load Testing', () => {
  it('should handle 100 requests per second', async () => {
    const result = await autocannon({
      url: 'http://localhost:3000',
      connections: 10,
      pipelining: 1,
      duration: 30,
      requests: [
        {
          method: 'POST',
          path: '/api/chat',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            prompt: 'Test prompt for load testing'
          })
        }
      ]
    });
    
    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
    expect(result.requests.average).toBeGreaterThan(100);
    expect(result.latency.p99).toBeLessThan(5000);
  });
});
```

## Deployment Guidelines

### 1. Environment Configuration

Use proper environment management:

```javascript
// config/environments.js
const environments = {
  development: {
    logLevel: 'debug',
    cache: 'memory',
    providers: ['mock'],
    rateLimits: { rpm: 1000 },
    monitoring: false
  },
  
  staging: {
    logLevel: 'info',
    cache: 'redis',
    providers: ['openai', 'anthropic'],
    rateLimits: { rpm: 100 },
    monitoring: true
  },
  
  production: {
    logLevel: 'warn',
    cache: 'redis-cluster',
    providers: ['openai', 'anthropic', 'groq'],
    rateLimits: { rpm: 1000 },
    monitoring: true,
    alerts: true,
    backup: true
  }
};

const currentEnv = process.env.NODE_ENV || 'development';
module.exports = environments[currentEnv];
```

### 2. Docker Deployment

Containerize your application:

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "server.js"]
```

### 3. Kubernetes Deployment

Deploy with proper resource limits:

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-router
spec:
  replicas: 3
  selector:
    matchLabels:
      app: llm-router
  template:
    metadata:
      labels:
        app: llm-router
    spec:
      containers:
      - name: llm-router
        image: llm-router:latest
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        env:
        - name: NODE_ENV
          value: "production"
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: llm-secrets
              key: openai-key
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: llm-router-service
spec:
  selector:
    app: llm-router
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Conclusion

Following these best practices will help you build production-ready LLM applications that are:

- **Reliable**: With proper error handling and fallbacks
- **Scalable**: Using efficient patterns and resource management
- **Secure**: Following security best practices
- **Cost-effective**: With smart optimization strategies
- **Observable**: With comprehensive monitoring
- **Maintainable**: With clean architecture and testing

Remember to:
1. Start with a solid architecture
2. Implement comprehensive error handling
3. Monitor everything
4. Test thoroughly
5. Deploy gradually
6. Iterate based on metrics

For more specific patterns and examples, see our other tutorials and the complete API reference.

---

Next: [Migration from OpenAI](./migrating-from-openai.md) | [Back to Tutorials](../tutorials/)