# 🚦 Rate Limiting & Throttling

Comprehensive guide to implementing rate limiting, request throttling, and API quota management across multiple LLM providers.

## Table of Contents

1. [Overview](#overview)
2. [Rate Limiting Strategies](#rate-limiting-strategies)
3. [Provider Limits](#provider-limits)
4. [Implementation](#implementation)
5. [Advanced Patterns](#advanced-patterns)
6. [Error Handling](#error-handling)
7. [Monitoring](#monitoring)
8. [Best Practices](#best-practices)

## Overview

Rate limiting is crucial for:
- **Preventing API quota exhaustion**
- **Managing costs effectively**
- **Ensuring fair resource distribution**
- **Maintaining service stability**
- **Complying with provider limits**

### Key Features

- **Multi-provider rate limiting**: Different limits per provider
- **Token-based throttling**: Limit by tokens, not just requests
- **Adaptive rate limiting**: Adjust based on response headers
- **Queue management**: Smart request queuing
- **Retry strategies**: Exponential backoff with jitter

## Rate Limiting Strategies

### 1. Token Bucket Algorithm

Most flexible for handling burst traffic:

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  rateLimiting: {
    strategy: 'token-bucket',
    tokensPerSecond: 10,
    bucketSize: 100,
    refillRate: 10
  }
});

// Requests consume tokens from the bucket
const response = await router.generate({
  prompt: 'Hello world',
  model: 'gpt-3.5-turbo'
});
```

### 2. Sliding Window

Smooth rate limiting over time:

```javascript
const router = new LLMRouter({
  rateLimiting: {
    strategy: 'sliding-window',
    windowSize: 60000, // 1 minute
    maxRequests: 100
  }
});

// Automatically throttles requests to stay within limits
```

### 3. Fixed Window

Simple time-based limiting:

```javascript
const router = new LLMRouter({
  rateLimiting: {
    strategy: 'fixed-window',
    windowSize: 60000, // 1 minute
    maxRequests: 100,
    resetOnHour: true
  }
});
```

### 4. Leaky Bucket

Constant rate processing:

```javascript
const router = new LLMRouter({
  rateLimiting: {
    strategy: 'leaky-bucket',
    capacity: 100,
    leakRate: 1 // Process 1 request per second
  }
});
```

## Provider Limits

### OpenAI Rate Limits

| Tier | RPM (Requests/Min) | TPM (Tokens/Min) | Images/Min |
|------|-------------------|------------------|------------|
| Free | 3 | 40,000 | 1 |
| Tier 1 | 60 | 60,000 | 5 |
| Tier 2 | 500 | 80,000 | 10 |
| Tier 3 | 3,000 | 160,000 | 50 |
| Tier 4 | 5,000 | 600,000 | 100 |
| Tier 5 | 10,000 | 2,000,000 | 250 |

### Anthropic Rate Limits

| Model | RPM | TPM | Daily Tokens |
|-------|-----|-----|--------------|
| Claude 3 Opus | 20 | 100,000 | 5,000,000 |
| Claude 3 Sonnet | 40 | 200,000 | 10,000,000 |
| Claude 3 Haiku | 100 | 400,000 | 25,000,000 |
| Claude 2.1 | 50 | 300,000 | 15,000,000 |

### Groq Rate Limits

| Model | RPM | TPM |
|-------|-----|-----|
| Mixtral 8x7B | 30 | 5,000 |
| LLaMA2 70B | 30 | 3,000 |
| Gemma 7B | 30 | 15,000 |

### Automatic Provider Limit Detection

```javascript
const router = new LLMRouter({
  rateLimiting: {
    autoDetect: true, // Automatically detect limits from headers
    respectProviderLimits: true
  }
});

// Router automatically adjusts to provider limits
router.on('rateLimitDetected', (limits) => {
  console.log(`Detected limits: ${limits.rpm} RPM, ${limits.tpm} TPM`);
});
```

## Implementation

### Basic Rate Limiter Setup

```javascript
import { LLMRouter, RateLimiter } from 'llm-runner-router';

// Create a rate limiter
const rateLimiter = new RateLimiter({
  // Global limits
  global: {
    requestsPerMinute: 1000,
    tokensPerMinute: 100000
  },
  
  // Per-provider limits
  providers: {
    openai: {
      requestsPerMinute: 500,
      tokensPerMinute: 60000,
      tier: 'tier-3'
    },
    anthropic: {
      requestsPerMinute: 40,
      tokensPerMinute: 200000,
      dailyTokens: 10000000
    },
    groq: {
      requestsPerMinute: 30,
      tokensPerMinute: 5000
    }
  },
  
  // Per-user limits
  userLimits: {
    default: {
      requestsPerMinute: 10,
      tokensPerDay: 100000
    },
    premium: {
      requestsPerMinute: 100,
      tokensPerDay: 1000000
    }
  }
});

// Attach to router
const router = new LLMRouter({
  rateLimiter,
  queueRequests: true, // Queue requests when rate limited
  maxQueueSize: 100
});
```

### Request Queuing

Handle rate limits gracefully with queuing:

```javascript
class RequestQueue {
  constructor(options = {}) {
    this.queue = [];
    this.processing = false;
    this.maxSize = options.maxSize || 100;
    this.maxWaitTime = options.maxWaitTime || 30000;
    this.rateLimiter = options.rateLimiter;
  }
  
  async add(request) {
    if (this.queue.length >= this.maxSize) {
      throw new Error('Queue is full');
    }
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.remove(request);
        reject(new Error('Request timeout'));
      }, this.maxWaitTime);
      
      this.queue.push({
        request,
        resolve,
        reject,
        timeoutId,
        addedAt: Date.now()
      });
      
      this.process();
    });
  }
  
  async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const item = this.queue[0];
      
      // Check if we can process
      if (await this.rateLimiter.canProcess(item.request)) {
        this.queue.shift();
        clearTimeout(item.timeoutId);
        
        try {
          const result = await this.executeRequest(item.request);
          item.resolve(result);
        } catch (error) {
          item.reject(error);
        }
      } else {
        // Wait before checking again
        await this.sleep(1000);
      }
    }
    
    this.processing = false;
  }
  
  remove(request) {
    const index = this.queue.findIndex(item => item.request === request);
    if (index > -1) {
      this.queue.splice(index, 1);
    }
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async executeRequest(request) {
    // Execute the actual API request
    return request.execute();
  }
}
```

### Adaptive Rate Limiting

Adjust limits based on API responses:

```javascript
class AdaptiveRateLimiter {
  constructor(options = {}) {
    this.limits = {
      rpm: options.initialRPM || 60,
      tpm: options.initialTPM || 60000
    };
    this.adjustmentFactor = options.adjustmentFactor || 0.9;
  }
  
  async processResponse(response, headers) {
    // Parse rate limit headers
    const remaining = parseInt(headers['x-ratelimit-remaining']);
    const reset = parseInt(headers['x-ratelimit-reset']);
    const limit = parseInt(headers['x-ratelimit-limit']);
    
    if (remaining !== undefined && limit !== undefined) {
      // Adjust limits based on remaining quota
      const usageRatio = (limit - remaining) / limit;
      
      if (usageRatio > 0.8) {
        // Slow down if approaching limit
        this.limits.rpm *= this.adjustmentFactor;
        console.log(`Reducing rate limit to ${this.limits.rpm} RPM`);
      } else if (usageRatio < 0.5 && this.limits.rpm < limit) {
        // Speed up if we have headroom
        this.limits.rpm = Math.min(
          this.limits.rpm / this.adjustmentFactor,
          limit
        );
        console.log(`Increasing rate limit to ${this.limits.rpm} RPM`);
      }
    }
    
    // Handle 429 responses
    if (response.status === 429) {
      const retryAfter = parseInt(headers['retry-after']) || 60;
      await this.backoff(retryAfter * 1000);
      
      // Reduce limits after rate limit error
      this.limits.rpm *= 0.5;
      this.limits.tpm *= 0.5;
    }
  }
  
  async backoff(ms) {
    console.log(`Rate limited. Waiting ${ms}ms before retry...`);
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Multi-Tenant Rate Limiting

Manage limits across multiple users/organizations:

```javascript
class MultiTenantRateLimiter {
  constructor(options = {}) {
    this.tenants = new Map();
    this.globalLimits = options.globalLimits;
    this.defaultTenantLimits = options.defaultTenantLimits;
  }
  
  async canProcess(tenantId, request) {
    const tenant = this.getTenant(tenantId);
    const now = Date.now();
    
    // Check tenant limits
    if (!tenant.canMakeRequest(now)) {
      return false;
    }
    
    // Check global limits
    if (!this.checkGlobalLimits()) {
      return false;
    }
    
    // Update counters
    tenant.recordRequest(request);
    this.updateGlobalCounters(request);
    
    return true;
  }
  
  getTenant(tenantId) {
    if (!this.tenants.has(tenantId)) {
      this.tenants.set(tenantId, new TenantLimiter({
        id: tenantId,
        ...this.defaultTenantLimits
      }));
    }
    return this.tenants.get(tenantId);
  }
  
  checkGlobalLimits() {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window
    
    const recentRequests = this.getRecentRequests(windowStart);
    return recentRequests < this.globalLimits.requestsPerMinute;
  }
  
  getRecentRequests(since) {
    let count = 0;
    for (const tenant of this.tenants.values()) {
      count += tenant.getRequestsSince(since);
    }
    return count;
  }
  
  updateGlobalCounters(request) {
    // Update global metrics
  }
}

class TenantLimiter {
  constructor(options) {
    this.id = options.id;
    this.limits = {
      rpm: options.requestsPerMinute || 10,
      tpm: options.tokensPerMinute || 10000,
      dailyTokens: options.dailyTokens || 100000
    };
    this.requests = [];
    this.tokenUsage = {
      today: 0,
      resetAt: this.getNextMidnight()
    };
  }
  
  canMakeRequest(now) {
    // Clean old requests
    this.requests = this.requests.filter(r => r.timestamp > now - 60000);
    
    // Check rate limits
    if (this.requests.length >= this.limits.rpm) {
      return false;
    }
    
    // Check daily token limit
    if (this.tokenUsage.today >= this.limits.dailyTokens) {
      return false;
    }
    
    return true;
  }
  
  recordRequest(request) {
    this.requests.push({
      timestamp: Date.now(),
      tokens: request.estimatedTokens
    });
    
    this.tokenUsage.today += request.estimatedTokens;
    
    // Reset daily counter if needed
    if (Date.now() > this.tokenUsage.resetAt) {
      this.tokenUsage.today = request.estimatedTokens;
      this.tokenUsage.resetAt = this.getNextMidnight();
    }
  }
  
  getRequestsSince(timestamp) {
    return this.requests.filter(r => r.timestamp > timestamp).length;
  }
  
  getNextMidnight() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }
}
```

## Advanced Patterns

### Priority Queue with Rate Limiting

Prioritize important requests:

```javascript
class PriorityRateLimiter {
  constructor(options = {}) {
    this.queues = {
      high: [],
      normal: [],
      low: []
    };
    this.rateLimiter = options.rateLimiter;
  }
  
  async add(request, priority = 'normal') {
    if (!['high', 'normal', 'low'].includes(priority)) {
      throw new Error('Invalid priority');
    }
    
    return new Promise((resolve, reject) => {
      this.queues[priority].push({
        request,
        resolve,
        reject,
        addedAt: Date.now()
      });
      
      this.process();
    });
  }
  
  async process() {
    // Process high priority first
    for (const priority of ['high', 'normal', 'low']) {
      const queue = this.queues[priority];
      
      while (queue.length > 0) {
        if (await this.rateLimiter.canProcess()) {
          const item = queue.shift();
          try {
            const result = await this.executeRequest(item.request);
            item.resolve(result);
          } catch (error) {
            item.reject(error);
          }
        } else {
          // Wait if rate limited
          await this.sleep(1000);
        }
      }
    }
  }
  
  async executeRequest(request) {
    return request.execute();
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Circuit Breaker Pattern

Prevent cascading failures:

```javascript
class CircuitBreaker {
  constructor(options = {}) {
    this.threshold = options.threshold || 5;
    this.timeout = options.timeout || 60000;
    this.resetTimeout = options.resetTimeout || 30000;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.nextAttempt = Date.now();
  }
  
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
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
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
  }
  
  onFailure() {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      console.log(`Circuit breaker opened. Will retry at ${new Date(this.nextAttempt)}`);
    }
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt) : null
    };
  }
}
```

### Distributed Rate Limiting

Share rate limits across multiple instances:

```javascript
import Redis from 'ioredis';

class DistributedRateLimiter {
  constructor(options = {}) {
    this.redis = new Redis(options.redis);
    this.limits = options.limits;
    this.window = options.window || 60000;
  }
  
  async canProcess(key, tokens = 1) {
    const now = Date.now();
    const windowStart = now - this.window;
    
    // Use Redis sorted set for sliding window
    const pipeline = this.redis.pipeline();
    
    // Remove old entries
    pipeline.zremrangebyscore(key, '-inf', windowStart);
    
    // Count current entries
    pipeline.zcard(key);
    
    // Add new entry if under limit
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiry
    pipeline.expire(key, Math.ceil(this.window / 1000));
    
    const results = await pipeline.exec();
    const count = results[1][1];
    
    if (count >= this.limits.requestsPerWindow) {
      // Remove the entry we just added
      await this.redis.zrem(key, `${now}-${Math.random()}`);
      return false;
    }
    
    return true;
  }
  
  async getRemainingQuota(key) {
    const now = Date.now();
    const windowStart = now - this.window;
    
    await this.redis.zremrangebyscore(key, '-inf', windowStart);
    const count = await this.redis.zcard(key);
    
    return {
      remaining: Math.max(0, this.limits.requestsPerWindow - count),
      total: this.limits.requestsPerWindow,
      resetsAt: new Date(now + this.window)
    };
  }
  
  async reset(key) {
    await this.redis.del(key);
  }
}
```

## Error Handling

### Retry with Exponential Backoff

```javascript
class RetryManager {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.jitter = options.jitter || true;
  }
  
  async execute(fn, context = {}) {
    let lastError;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (!this.shouldRetry(error, attempt)) {
          throw error;
        }
        
        const delay = this.calculateDelay(attempt, error);
        console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }
  
  shouldRetry(error, attempt) {
    // Don't retry on client errors (4xx except 429)
    if (error.status >= 400 && error.status < 500 && error.status !== 429) {
      return false;
    }
    
    // Always retry rate limit errors
    if (error.status === 429) {
      return true;
    }
    
    // Retry server errors
    if (error.status >= 500) {
      return attempt < this.maxRetries;
    }
    
    // Retry network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return attempt < this.maxRetries;
    }
    
    return false;
  }
  
  calculateDelay(attempt, error) {
    let delay;
    
    // Use retry-after header if available
    if (error.headers && error.headers['retry-after']) {
      delay = parseInt(error.headers['retry-after']) * 1000;
    } else {
      // Exponential backoff
      delay = Math.min(
        this.baseDelay * Math.pow(2, attempt),
        this.maxDelay
      );
    }
    
    // Add jitter to prevent thundering herd
    if (this.jitter) {
      delay += Math.random() * 1000;
    }
    
    return delay;
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Rate Limit Error Handling

```javascript
class RateLimitErrorHandler {
  constructor(router) {
    this.router = router;
    this.errorCounts = new Map();
    this.backoffTimers = new Map();
  }
  
  async handle(error, request) {
    const provider = request.provider;
    
    if (error.status === 429) {
      // Rate limit error
      await this.handleRateLimit(provider, error);
      
      // Try alternative provider
      const alternative = this.findAlternativeProvider(provider);
      if (alternative) {
        console.log(`Switching from ${provider} to ${alternative}`);
        request.provider = alternative;
        return this.router.generate(request);
      }
    }
    
    throw error;
  }
  
  async handleRateLimit(provider, error) {
    // Track error count
    const count = (this.errorCounts.get(provider) || 0) + 1;
    this.errorCounts.set(provider, count);
    
    // Calculate backoff
    const backoffMs = this.calculateBackoff(provider, error);
    
    // Set provider as unavailable
    this.router.setProviderAvailability(provider, false);
    
    // Schedule re-enable
    if (this.backoffTimers.has(provider)) {
      clearTimeout(this.backoffTimers.get(provider));
    }
    
    const timer = setTimeout(() => {
      this.router.setProviderAvailability(provider, true);
      this.errorCounts.set(provider, 0);
      console.log(`Re-enabled provider: ${provider}`);
    }, backoffMs);
    
    this.backoffTimers.set(provider, timer);
    
    console.log(`Provider ${provider} rate limited. Disabled for ${backoffMs}ms`);
  }
  
  calculateBackoff(provider, error) {
    const count = this.errorCounts.get(provider) || 1;
    
    // Use retry-after if provided
    if (error.headers && error.headers['retry-after']) {
      return parseInt(error.headers['retry-after']) * 1000;
    }
    
    // Exponential backoff based on error count
    return Math.min(1000 * Math.pow(2, count), 300000); // Max 5 minutes
  }
  
  findAlternativeProvider(excludeProvider) {
    const providers = ['openai', 'anthropic', 'groq', 'openrouter'];
    return providers.find(p => 
      p !== excludeProvider && 
      this.router.isProviderAvailable(p)
    );
  }
}
```

## Monitoring

### Rate Limit Metrics

```javascript
class RateLimitMonitor {
  constructor() {
    this.metrics = {
      requests: new Map(),
      rateLimits: new Map(),
      errors: new Map()
    };
  }
  
  recordRequest(provider, success, tokensUsed) {
    const key = `${provider}:${this.getCurrentWindow()}`;
    const current = this.metrics.requests.get(key) || {
      total: 0,
      success: 0,
      failed: 0,
      tokens: 0
    };
    
    current.total++;
    if (success) {
      current.success++;
      current.tokens += tokensUsed;
    } else {
      current.failed++;
    }
    
    this.metrics.requests.set(key, current);
  }
  
  recordRateLimit(provider, remaining, reset) {
    this.metrics.rateLimits.set(provider, {
      remaining,
      reset: new Date(reset * 1000),
      timestamp: Date.now()
    });
  }
  
  recordError(provider, error) {
    const key = `${provider}:${error.status || 'unknown'}`;
    const count = this.metrics.errors.get(key) || 0;
    this.metrics.errors.set(key, count + 1);
  }
  
  getCurrentWindow() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
  }
  
  getReport() {
    const report = {
      summary: {},
      providers: {}
    };
    
    // Aggregate metrics by provider
    for (const [key, value] of this.metrics.requests) {
      const [provider] = key.split(':');
      
      if (!report.providers[provider]) {
        report.providers[provider] = {
          requests: 0,
          success: 0,
          failed: 0,
          tokens: 0,
          successRate: 0
        };
      }
      
      report.providers[provider].requests += value.total;
      report.providers[provider].success += value.success;
      report.providers[provider].failed += value.failed;
      report.providers[provider].tokens += value.tokens;
    }
    
    // Calculate success rates
    for (const provider in report.providers) {
      const p = report.providers[provider];
      p.successRate = p.requests > 0 ? p.success / p.requests : 0;
    }
    
    // Add current rate limits
    report.rateLimits = Object.fromEntries(this.metrics.rateLimits);
    
    // Add error summary
    report.errors = Object.fromEntries(this.metrics.errors);
    
    return report;
  }
  
  async sendAlert(message, severity = 'warning') {
    console.log(`[${severity.toUpperCase()}] ${message}`);
    
    // Send to monitoring service
    // await monitoringService.alert({
    //   message,
    //   severity,
    //   timestamp: Date.now(),
    //   metrics: this.getReport()
    // });
  }
}
```

### Dashboard Integration

```javascript
// Express endpoint for rate limit dashboard
app.get('/api/rate-limits/dashboard', async (req, res) => {
  const monitor = req.app.locals.rateLimitMonitor;
  
  const dashboard = {
    providers: [],
    alerts: [],
    recommendations: []
  };
  
  // Get current status for each provider
  for (const provider of ['openai', 'anthropic', 'groq']) {
    const limits = await router.getRateLimitStatus(provider);
    const usage = monitor.getProviderUsage(provider);
    
    dashboard.providers.push({
      name: provider,
      status: limits.remaining > 0 ? 'healthy' : 'limited',
      remaining: limits.remaining,
      total: limits.total,
      resetsAt: limits.resetsAt,
      currentRPM: usage.rpm,
      currentTPM: usage.tpm,
      successRate: usage.successRate
    });
    
    // Generate alerts
    if (limits.remaining < limits.total * 0.1) {
      dashboard.alerts.push({
        provider,
        type: 'warning',
        message: `Low rate limit quota: ${limits.remaining} remaining`
      });
    }
  }
  
  // Generate recommendations
  if (dashboard.alerts.length > 0) {
    dashboard.recommendations.push(
      'Consider spreading requests across multiple providers',
      'Enable request queuing to handle bursts',
      'Implement caching to reduce API calls'
    );
  }
  
  res.json(dashboard);
});
```

## Best Practices

### 1. Implement Graceful Degradation

```javascript
const router = new LLMRouter({
  rateLimiting: {
    gracefulDegradation: true,
    fallbackChain: [
      'openai/gpt-4',
      'anthropic/claude-3-opus',
      'openai/gpt-3.5-turbo',
      'groq/mixtral-8x7b'
    ]
  }
});

// Automatically falls back when rate limited
const response = await router.generate({
  prompt: 'Hello world',
  allowFallback: true
});
```

### 2. Use Request Pooling

```javascript
class RequestPool {
  constructor(size = 10) {
    this.pool = [];
    this.size = size;
    this.available = size;
  }
  
  async acquire() {
    if (this.available > 0) {
      this.available--;
      return true;
    }
    
    // Wait for availability
    return new Promise(resolve => {
      this.pool.push(resolve);
    });
  }
  
  release() {
    if (this.pool.length > 0) {
      const resolve = this.pool.shift();
      resolve(true);
    } else {
      this.available++;
    }
  }
  
  async execute(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}
```

### 3. Implement Smart Batching

```javascript
class SmartBatcher {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 10;
    this.maxWait = options.maxWait || 100;
    this.batch = [];
    this.timer = null;
  }
  
  async add(item) {
    return new Promise((resolve, reject) => {
      this.batch.push({ item, resolve, reject });
      
      if (this.batch.length >= this.batchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.maxWait);
      }
    });
  }
  
  async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    if (this.batch.length === 0) return;
    
    const batch = this.batch.splice(0, this.batchSize);
    
    try {
      // Process batch together
      const results = await this.processBatch(batch.map(b => b.item));
      
      // Resolve individual promises
      batch.forEach((b, i) => b.resolve(results[i]));
    } catch (error) {
      batch.forEach(b => b.reject(error));
    }
    
    // Process remaining items
    if (this.batch.length > 0) {
      this.flush();
    }
  }
  
  async processBatch(items) {
    // Implement batch processing logic
    return items.map(item => ({ processed: true, item }));
  }
}
```

### 4. Monitor and Alert

```javascript
const rateLimitAlerts = {
  async checkHealth() {
    const providers = ['openai', 'anthropic', 'groq'];
    
    for (const provider of providers) {
      const status = await router.getRateLimitStatus(provider);
      
      if (status.remaining < status.total * 0.1) {
        await this.sendAlert({
          level: 'warning',
          provider,
          message: `Low rate limit: ${status.remaining}/${status.total}`,
          action: 'Consider reducing request rate'
        });
      }
      
      if (status.remaining === 0) {
        await this.sendAlert({
          level: 'critical',
          provider,
          message: `Rate limit exhausted for ${provider}`,
          action: 'Switching to fallback providers'
        });
      }
    }
  },
  
  async sendAlert(alert) {
    console.log(`[ALERT] ${alert.level}: ${alert.message}`);
    // Send to monitoring service, Slack, etc.
  }
};

// Run health checks periodically
setInterval(() => rateLimitAlerts.checkHealth(), 60000);
```

## Summary

Effective rate limiting ensures:

- **Service reliability** through intelligent request management
- **Cost control** by preventing quota exhaustion
- **Fair resource distribution** across users and services
- **Graceful degradation** when limits are reached
- **Optimal performance** through smart queuing and batching

Implement rate limiting from the start to avoid production issues and unexpected costs.

---

Next: [Response Caching](./caching.md) | Previous: [Cost Optimization](./cost-optimization.md)