# 🌟 LLM-Runner-Router Best Practices Guide

*Your roadmap to production-ready AI model orchestration excellence*

## 📖 Table of Contents

- [System Architecture Best Practices](#system-architecture-best-practices)
- [Model Management Excellence](#model-management-excellence)
- [Performance Optimization](#performance-optimization)
- [Memory Management](#memory-management)
- [Error Handling and Recovery](#error-handling-and-recovery)
- [Security and Privacy](#security-and-privacy)
- [Monitoring and Observability](#monitoring-and-observability)
- [Development Workflow](#development-workflow)
- [Deployment Strategies](#deployment-strategies)
- [Testing and Quality Assurance](#testing-and-quality-assurance)
- [Cost Optimization](#cost-optimization)
- [Scalability Patterns](#scalability-patterns)

## 🏗️ System Architecture Best Practices

### 1. Configuration Management

**✅ DO: Use Environment-Specific Configurations**
```javascript
// Good: Environment-aware configuration
const config = {
  development: {
    models: ['mock-model', 'small-llama'],
    caching: false,
    debug: true
  },
  production: {
    models: ['gpt-4', 'claude-3', 'llama-2-70b'],
    caching: true,
    debug: false,
    healthChecks: true
  }
};

const router = new LLMRouter(config[process.env.NODE_ENV]);
```

**❌ DON'T: Use Hardcoded Configurations**
```javascript
// Bad: Hardcoded values
const router = new LLMRouter({
  apiKey: 'sk-1234567890',  // Never hardcode secrets
  maxMemory: '8GB',         // Environment-dependent
  models: ['gpt-4']         // May not be available everywhere
});
```

### 2. Dependency Injection Pattern

**✅ DO: Use Dependency Injection for Flexibility**
```javascript
class ProductionLLMService {
  constructor(router, cache, monitor) {
    this.router = router;
    this.cache = cache;
    this.monitor = monitor;
  }
  
  async generateText(prompt, options = {}) {
    // Check cache first
    const cached = await this.cache.get(prompt);
    if (cached) return cached;
    
    // Monitor request
    const startTime = Date.now();
    
    try {
      const result = await this.router.generate(prompt, options);
      await this.cache.set(prompt, result);
      
      this.monitor.recordSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.monitor.recordError(error);
      throw error;
    }
  }
}
```

### 3. Modular Component Design

**✅ DO: Create Composable Components**
```javascript
// Composable router setup
const router = new LLMRouter()
  .addLoader(new GGUFLoader())
  .addLoader(new ONNXLoader())
  .addEngine(new WebGPUEngine())
  .addEngine(new WASMEngine())
  .setStrategy('balanced')
  .enableCaching()
  .enableMonitoring();
```

## 🤖 Model Management Excellence

### 1. Model Lifecycle Management

**✅ DO: Implement Proper Model Lifecycle**
```javascript
class ModelLifecycleManager {
  constructor() {
    this.models = new Map();
    this.usage = new Map();
    this.cleanup = new Set();
  }
  
  async loadModel(name, config) {
    // Check if already loaded
    if (this.models.has(name)) {
      this.updateUsage(name);
      return this.models.get(name);
    }
    
    // Load with resource management
    const model = await this.router.load(name, {
      ...config,
      onLoad: () => this.models.set(name, model),
      onUnload: () => this.models.delete(name)
    });
    
    // Track usage
    this.updateUsage(name);
    
    // Schedule cleanup check
    this.scheduleCleanup();
    
    return model;
  }
  
  scheduleCleanup() {
    setTimeout(() => this.cleanupUnusedModels(), 300000); // 5 minutes
  }
  
  async cleanupUnusedModels() {
    const threshold = Date.now() - 600000; // 10 minutes
    
    for (const [name, lastUsed] of this.usage.entries()) {
      if (lastUsed < threshold && !this.isEssential(name)) {
        await this.unloadModel(name);
      }
    }
  }
}
```

### 2. Model Selection Strategy

**✅ DO: Use Data-Driven Model Selection**
```javascript
class IntelligentModelSelector {
  constructor() {
    this.metrics = new Map();
    this.preferences = {
      speed: 0.3,
      quality: 0.4,
      cost: 0.3
    };
  }
  
  async selectBestModel(task, context = {}) {
    const candidates = await this.getCandidateModels(task);
    const scored = await Promise.all(
      candidates.map(model => this.scoreModel(model, task, context))
    );
    
    // Sort by weighted score
    scored.sort((a, b) => b.score - a.score);
    
    // Return top choice with fallbacks
    return {
      primary: scored[0].model,
      fallbacks: scored.slice(1, 3).map(s => s.model)
    };
  }
  
  async scoreModel(model, task, context) {
    const metrics = await this.getModelMetrics(model);
    const compatibility = await this.checkTaskCompatibility(model, task);
    
    const score = 
      (metrics.speed * this.preferences.speed) +
      (metrics.quality * this.preferences.quality) +
      (1 - metrics.cost) * this.preferences.cost +
      compatibility;
    
    return { model, score, metrics };
  }
}
```

### 3. Model Versioning and Updates

**✅ DO: Implement Model Versioning**
```javascript
class ModelVersionManager {
  async updateModel(name, newVersion) {
    const currentModel = this.models.get(name);
    
    // Load new version alongside current
    const newModel = await this.loadModelVersion(name, newVersion);
    
    // Gradual traffic shift
    await this.gradualMigration(currentModel, newModel, {
      trafficShift: [0.1, 0.3, 0.7, 1.0], // 10%, 30%, 70%, 100%
      interval: 300000, // 5 minutes between shifts
      rollbackOnError: true
    });
    
    // Cleanup old version
    await this.unloadModel(currentModel);
  }
  
  async gradualMigration(oldModel, newModel, config) {
    for (const percentage of config.trafficShift) {
      // Update routing weights
      await this.updateRouting({
        [oldModel.name]: 1 - percentage,
        [newModel.name]: percentage
      });
      
      // Monitor for errors
      const errorRate = await this.monitorErrorRate(newModel, 300000);
      if (errorRate > 0.05 && config.rollbackOnError) {
        await this.rollback(oldModel, newModel);
        throw new Error('Migration rolled back due to high error rate');
      }
      
      await this.wait(config.interval);
    }
  }
}
```

## ⚡ Performance Optimization

### 1. Caching Strategies

**✅ DO: Implement Multi-Level Caching**
```javascript
class MultilevelCache {
  constructor() {
    this.l1 = new Map(); // In-memory (fastest)
    this.l2 = new LRUCache({ max: 1000 }); // Memory with LRU
    this.l3 = new DiskCache(); // Persistent storage
  }
  
  async get(key) {
    // L1 Cache
    if (this.l1.has(key)) {
      return this.l1.get(key);
    }
    
    // L2 Cache
    const l2Result = this.l2.get(key);
    if (l2Result) {
      this.l1.set(key, l2Result);
      return l2Result;
    }
    
    // L3 Cache
    const l3Result = await this.l3.get(key);
    if (l3Result) {
      this.l2.set(key, l3Result);
      this.l1.set(key, l3Result);
      return l3Result;
    }
    
    return null;
  }
  
  async set(key, value, ttl = 3600) {
    // Store in all levels
    this.l1.set(key, value);
    this.l2.set(key, value);
    await this.l3.set(key, value, ttl);
  }
}
```

### 2. Request Batching

**✅ DO: Batch Similar Requests**
```javascript
class RequestBatcher {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 10;
    this.batchTimeout = options.batchTimeout || 100;
    this.pending = [];
    this.timer = null;
  }
  
  async process(request) {
    return new Promise((resolve, reject) => {
      this.pending.push({ request, resolve, reject });
      
      if (this.pending.length >= this.batchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.batchTimeout);
      }
    });
  }
  
  async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    const batch = this.pending.splice(0);
    if (batch.length === 0) return;
    
    try {
      const requests = batch.map(b => b.request);
      const results = await this.router.batchGenerate(requests);
      
      batch.forEach((b, index) => {
        b.resolve(results[index]);
      });
    } catch (error) {
      batch.forEach(b => b.reject(error));
    }
  }
}
```

### 3. Streaming Optimization

**✅ DO: Optimize Streaming Performance**
```javascript
class OptimizedStreaming {
  async *streamWithOptimizations(prompt, options = {}) {
    const stream = this.router.stream(prompt, {
      ...options,
      bufferSize: 8192,
      compression: true
    });
    
    let buffer = '';
    let tokenCount = 0;
    
    for await (const chunk of stream) {
      buffer += chunk;
      tokenCount++;
      
      // Yield in optimized chunks
      if (buffer.length >= 100 || tokenCount % 10 === 0) {
        yield buffer;
        buffer = '';
      }
      
      // Adaptive throttling based on consumer speed
      if (tokenCount % 100 === 0) {
        await this.adaptiveThrottle();
      }
    }
    
    // Yield remaining buffer
    if (buffer) {
      yield buffer;
    }
  }
  
  async adaptiveThrottle() {
    const consumerLatency = await this.measureConsumerLatency();
    if (consumerLatency > 100) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}
```

## 💾 Memory Management

### 1. Memory Monitoring and Alerts

**✅ DO: Implement Proactive Memory Monitoring**
```javascript
class MemoryMonitor {
  constructor() {
    this.thresholds = {
      warning: 0.7,   // 70%
      critical: 0.85, // 85%
      emergency: 0.95 // 95%
    };
    
    this.startMonitoring();
  }
  
  startMonitoring() {
    setInterval(async () => {
      const usage = await this.getMemoryUsage();
      const percentage = usage.used / usage.total;
      
      if (percentage > this.thresholds.emergency) {
        await this.emergencyCleanup();
      } else if (percentage > this.thresholds.critical) {
        await this.criticalCleanup();
      } else if (percentage > this.thresholds.warning) {
        await this.warningCleanup();
      }
    }, 30000); // Check every 30 seconds
  }
  
  async emergencyCleanup() {
    console.warn('🚨 Emergency memory cleanup initiated');
    
    // Unload non-essential models
    await this.unloadNonEssentialModels();
    
    // Clear all caches
    await this.clearCaches();
    
    // Force garbage collection
    if (global.gc) global.gc();
    
    // Notify administrators
    await this.notifyAdministrators('emergency_memory');
  }
}
```

### 2. Model Memory Optimization

**✅ DO: Use Memory-Efficient Model Loading**
```javascript
class MemoryEfficientLoader {
  async loadWithMemoryOptimization(modelName, options = {}) {
    const memoryBudget = await this.calculateMemoryBudget();
    
    const loadOptions = {
      ...options,
      quantization: this.selectQuantization(memoryBudget),
      precision: this.selectPrecision(memoryBudget),
      layerSharding: memoryBudget.sharding,
      memoryMapping: true
    };
    
    // Load with memory constraints
    const model = await this.router.load(modelName, loadOptions);
    
    // Monitor memory usage post-load
    this.monitorModelMemory(model);
    
    return model;
  }
  
  selectQuantization(budget) {
    if (budget.available < 2000000000) return 'int4'; // < 2GB
    if (budget.available < 4000000000) return 'int8'; // < 4GB
    return 'float16'; // > 4GB
  }
  
  async calculateMemoryBudget() {
    const total = process.memoryUsage();
    const available = total.heapTotal - total.heapUsed;
    const reserved = available * 0.2; // Reserve 20% for other operations
    
    return {
      available: available - reserved,
      sharding: available < 1000000000 // Enable sharding if < 1GB
    };
  }
}
```

## 🛡️ Error Handling and Recovery

### 1. Graceful Degradation

**✅ DO: Implement Graceful Degradation**
```javascript
class GracefulDegradationService {
  constructor() {
    this.fallbackChain = [
      'gpt-4-premium',
      'gpt-4-standard', 
      'gpt-3.5-turbo',
      'local-llama',
      'cached-responses'
    ];
  }
  
  async generateWithFallback(prompt, options = {}) {
    const context = { prompt, options, attempts: [] };
    
    for (const model of this.fallbackChain) {
      try {
        const result = await this.attemptGeneration(model, prompt, options);
        
        // Track successful fallback
        if (context.attempts.length > 0) {
          await this.recordFallbackSuccess(model, context);
        }
        
        return result;
      } catch (error) {
        context.attempts.push({ model, error });
        
        // Adjust options for next attempt
        options = this.adjustOptionsForFallback(options, error);
      }
    }
    
    // All fallbacks failed
    throw new Error('All generation methods failed');
  }
  
  adjustOptionsForFallback(options, error) {
    if (error.code === 'CONTEXT_TOO_LONG') {
      return { ...options, maxTokens: Math.floor(options.maxTokens * 0.7) };
    }
    if (error.code === 'RATE_LIMITED') {
      return { ...options, priority: 'low' };
    }
    return options;
  }
}
```

### 2. Circuit Breaker Pattern

**✅ DO: Use Circuit Breakers for External Dependencies**
```javascript
class ModelCircuitBreaker {
  constructor(modelName, options = {}) {
    this.modelName = modelName;
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 3;
    this.timeout = options.timeout || 60000;
    
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }
  
  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error(`Circuit breaker OPEN for ${this.modelName}`);
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
      }
    }
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

## 🔐 Security and Privacy

### 1. Input Sanitization

**✅ DO: Sanitize All Inputs**
```javascript
class InputSanitizer {
  static sanitizePrompt(prompt) {
    // Remove potential injection attempts
    const sanitized = prompt
      .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .trim();
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\b(exec|eval|system|shell)\s*\(/i,
      /\b(drop|delete|truncate)\s+table\b/i,
      /\bunion\s+select\b/i
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(sanitized)) {
        throw new SecurityError('Potentially malicious input detected');
      }
    }
    
    return sanitized;
  }
  
  static validateOptions(options) {
    const allowedKeys = [
      'temperature', 'maxTokens', 'topP', 'model',
      'stream', 'stop', 'presencePenalty', 'frequencyPenalty'
    ];
    
    const filtered = {};
    for (const [key, value] of Object.entries(options)) {
      if (allowedKeys.includes(key)) {
        filtered[key] = this.sanitizeValue(value);
      }
    }
    
    return filtered;
  }
}
```

### 2. Rate Limiting and Quotas

**✅ DO: Implement Comprehensive Rate Limiting**
```javascript
class AdvancedRateLimiter {
  constructor() {
    this.limits = new Map();
    this.quotas = new Map();
    this.priorities = new Map();
  }
  
  async checkLimit(userId, endpoint, options = {}) {
    const key = `${userId}:${endpoint}`;
    const now = Date.now();
    
    // Check rate limits
    const rateLimit = await this.checkRateLimit(key, now);
    if (!rateLimit.allowed) {
      throw new RateLimitError('Rate limit exceeded', rateLimit);
    }
    
    // Check quotas
    const quota = await this.checkQuota(userId, options);
    if (!quota.allowed) {
      throw new QuotaError('Quota exceeded', quota);
    }
    
    // Update counters
    await this.updateCounters(key, userId, options);
    
    return { allowed: true, remaining: rateLimit.remaining };
  }
  
  async checkRateLimit(key, now) {
    const limit = this.limits.get(key) || {
      count: 0,
      resetTime: now + 3600000 // 1 hour
    };
    
    // Reset if window expired
    if (now > limit.resetTime) {
      limit.count = 0;
      limit.resetTime = now + 3600000;
    }
    
    const maxRequests = 100; // per hour
    const allowed = limit.count < maxRequests;
    
    return {
      allowed,
      remaining: maxRequests - limit.count,
      resetTime: limit.resetTime
    };
  }
}
```

## 📊 Monitoring and Observability

### 1. Comprehensive Metrics Collection

**✅ DO: Collect Meaningful Metrics**
```javascript
class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: new Counter('llm_requests_total'),
      duration: new Histogram('llm_request_duration_seconds'),
      errors: new Counter('llm_errors_total'),
      tokens: new Histogram('llm_tokens_generated'),
      modelUsage: new Counter('llm_model_usage_total'),
      memoryUsage: new Gauge('llm_memory_usage_bytes'),
      queueSize: new Gauge('llm_queue_size')
    };
  }
  
  recordRequest(model, duration, tokens, success) {
    this.metrics.requests.inc({ model, success });
    this.metrics.duration.observe({ model }, duration);
    this.metrics.tokens.observe({ model }, tokens);
    
    if (!success) {
      this.metrics.errors.inc({ model });
    }
  }
  
  recordModelUsage(model, operation) {
    this.metrics.modelUsage.inc({ model, operation });
  }
  
  updateSystemMetrics() {
    const memory = process.memoryUsage();
    this.metrics.memoryUsage.set(memory.heapUsed);
    
    const queueSize = this.router.getQueueSize();
    this.metrics.queueSize.set(queueSize);
  }
}
```

### 2. Distributed Tracing

**✅ DO: Implement Distributed Tracing**
```javascript
class DistributedTracing {
  async traceRequest(operation, context = {}) {
    const span = this.tracer.startSpan(operation, {
      parent: context.parentSpan,
      tags: {
        'component': 'llm-router',
        'operation': operation,
        'user.id': context.userId
      }
    });
    
    try {
      const result = await this.executeWithTracing(operation, span, context);
      
      span.setTag('success', true);
      span.setTag('tokens.generated', result.tokens);
      span.setTag('model.used', result.model);
      
      return result;
    } catch (error) {
      span.setTag('error', true);
      span.setTag('error.message', error.message);
      span.log({ event: 'error', message: error.message });
      throw error;
    } finally {
      span.finish();
    }
  }
  
  async executeWithTracing(operation, span, context) {
    // Create child spans for sub-operations
    const modelSelectionSpan = this.tracer.startSpan('model_selection', {
      parent: span
    });
    
    const model = await this.selectModel(context);
    modelSelectionSpan.finish();
    
    const inferenceSpan = this.tracer.startSpan('inference', {
      parent: span,
      tags: { 'model.name': model.name }
    });
    
    const result = await model.generate(context.prompt);
    inferenceSpan.finish();
    
    return result;
  }
}
```

## 🔄 Development Workflow

### 1. Testing Strategy

**✅ DO: Implement Comprehensive Testing**
```javascript
// Unit Tests
describe('LLMRouter', () => {
  let router;
  
  beforeEach(async () => {
    router = new LLMRouter({
      models: ['mock-model'],
      strategy: 'balanced'
    });
    await router.initialize();
  });
  
  afterEach(async () => {
    await router.cleanup();
  });
  
  describe('model selection', () => {
    it('should select best model based on strategy', async () => {
      const selection = await router.selectModel({
        task: 'text-generation',
        requirements: { speed: 'high' }
      });
      
      expect(selection.model).toBeDefined();
      expect(selection.score).toBeGreaterThan(0);
    });
  });
});

// Integration Tests
describe('Model Integration', () => {
  it('should load and use real models', async () => {
    const router = new LLMRouter({ environment: 'test' });
    
    const model = await router.load('test-model');
    const result = await model.generate('Hello world');
    
    expect(result.text).toBeDefined();
    expect(result.tokens).toBeGreaterThan(0);
  });
});

// Load Tests
describe('Performance', () => {
  it('should handle concurrent requests', async () => {
    const requests = Array(100).fill().map(() => 
      router.generate('Test prompt')
    );
    
    const results = await Promise.all(requests);
    expect(results).toHaveLength(100);
  });
});
```

### 2. Code Quality Standards

**✅ DO: Maintain High Code Quality**
```javascript
// ESLint configuration
module.exports = {
  extends: ['eslint:recommended', '@typescript-eslint/recommended'],
  rules: {
    'complexity': ['error', 10],
    'max-lines-per-function': ['error', 50],
    'max-depth': ['error', 4],
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error'
  }
};

// Code documentation standards
/**
 * Generates text using the optimal model selection strategy
 * 
 * @param {string} prompt - The input prompt
 * @param {GenerationOptions} options - Generation configuration
 * @param {Object} context - Request context for optimization
 * @returns {Promise<GenerationResult>} Generated text and metadata
 * 
 * @example
 * const result = await router.generate('Explain quantum computing', {
 *   temperature: 0.7,
 *   maxTokens: 500
 * });
 */
async function generate(prompt, options = {}, context = {}) {
  // Implementation
}
```

## 🚀 Deployment Strategies

### 1. Blue-Green Deployment

**✅ DO: Use Blue-Green Deployment for Zero Downtime**
```javascript
class BlueGreenDeployment {
  constructor() {
    this.environments = {
      blue: { active: true, version: '1.0.0' },
      green: { active: false, version: '1.1.0' }
    };
  }
  
  async deploy(newVersion) {
    const inactive = this.getInactiveEnvironment();
    
    // Deploy to inactive environment
    await this.deployToEnvironment(inactive, newVersion);
    
    // Health check
    const healthy = await this.healthCheck(inactive);
    if (!healthy) {
      throw new Error('Health check failed on new deployment');
    }
    
    // Switch traffic gradually
    await this.switchTraffic(inactive);
    
    // Update version info
    this.environments[inactive].version = newVersion;
  }
  
  async switchTraffic(targetEnv) {
    const stages = [10, 30, 70, 100]; // Percentage of traffic
    
    for (const percentage of stages) {
      await this.updateLoadBalancer(targetEnv, percentage);
      await this.wait(300000); // Wait 5 minutes
      
      // Monitor error rates
      const errorRate = await this.getErrorRate(targetEnv);
      if (errorRate > 0.05) {
        await this.rollback();
        throw new Error('High error rate detected, rolled back');
      }
    }
  }
}
```

### 2. Container Optimization

**✅ DO: Optimize Container Images**
```dockerfile
# Multi-stage build for smaller images
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
WORKDIR /app

# Copy only production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S llmrouter -u 1001
USER llmrouter

# Optimize startup
EXPOSE 3000
CMD ["node", "--max-old-space-size=4096", "server.js"]
```

## 📈 Cost Optimization

### 1. Intelligent Model Selection

**✅ DO: Optimize for Cost-Performance Ratio**
```javascript
class CostOptimizer {
  constructor() {
    this.costModel = {
      'gpt-4': { costPerToken: 0.00006, quality: 0.95 },
      'gpt-3.5': { costPerToken: 0.000002, quality: 0.85 },
      'llama-2': { costPerToken: 0.0, quality: 0.80 }
    };
  }
  
  selectOptimalModel(requirements) {
    const { qualityThreshold = 0.8, budgetLimit = 0.01 } = requirements;
    
    const viable = Object.entries(this.costModel)
      .filter(([_, model]) => 
        model.quality >= qualityThreshold &&
        model.costPerToken * requirements.estimatedTokens <= budgetLimit
      )
      .sort((a, b) => {
        // Optimize for quality-to-cost ratio
        const ratioA = a[1].quality / (a[1].costPerToken || 0.000001);
        const ratioB = b[1].quality / (b[1].costPerToken || 0.000001);
        return ratioB - ratioA;
      });
    
    return viable[0]?.[0] || 'fallback-model';
  }
  
  async trackCosts(usage) {
    const cost = usage.tokens * this.costModel[usage.model].costPerToken;
    
    await this.updateBudget(usage.userId, cost);
    await this.logUsage(usage);
    
    // Alert if approaching budget limit
    const remainingBudget = await this.getRemainingBudget(usage.userId);
    if (remainingBudget < cost * 10) {
      await this.sendBudgetAlert(usage.userId, remainingBudget);
    }
  }
}
```

### 2. Resource Optimization

**✅ DO: Implement Smart Resource Management**
```javascript
class ResourceOptimizer {
  constructor() {
    this.resourcePools = new Map();
    this.utilizationTargets = {
      cpu: 0.70,    // 70% target CPU utilization
      memory: 0.80, // 80% target memory utilization
      gpu: 0.85     // 85% target GPU utilization
    };
  }
  
  async optimizeResources() {
    const current = await this.getCurrentUtilization();
    
    // Scale up if over-utilized
    if (current.cpu > this.utilizationTargets.cpu * 1.2) {
      await this.scaleUp('cpu');
    }
    
    // Scale down if under-utilized
    if (current.cpu < this.utilizationTargets.cpu * 0.5) {
      await this.scaleDown('cpu');
    }
    
    // Optimize model placement
    await this.optimizeModelPlacement(current);
  }
  
  async optimizeModelPlacement(utilization) {
    const models = await this.getLoadedModels();
    
    for (const model of models) {
      const currentNode = model.node;
      const optimalNode = await this.findOptimalNode(model, utilization);
      
      if (optimalNode !== currentNode) {
        await this.migrateModel(model, optimalNode);
      }
    }
  }
}
```

---

## 🏆 Performance Benchmarks

### Expected Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Model Load Time** | < 2 seconds | 95th percentile |
| **First Token** | < 200ms | Average |
| **Throughput** | > 50 tokens/sec | Sustained |
| **Memory Efficiency** | < 2x model size | Peak usage |
| **Cache Hit Rate** | > 85% | Daily average |
| **Error Rate** | < 0.1% | Monthly |
| **Availability** | > 99.9% | SLA target |

### Monitoring Checklist

- [ ] **Request latency** monitoring with percentiles
- [ ] **Error rate** tracking by model and endpoint
- [ ] **Resource utilization** (CPU, memory, GPU)
- [ ] **Model performance** metrics per request
- [ ] **Cache effectiveness** and hit rates
- [ ] **Cost tracking** per user and model
- [ ] **Security alerts** for suspicious activity
- [ ] **System health** checks and uptime

---

## 📚 Additional Resources

- **[Error Codes Reference](./ERROR_CODES.md)** - Complete error handling guide
- **[Performance Guide](./PERFORMANCE.md)** - Detailed optimization strategies
- **[Security Guide](./SECURITY.md)** - Security implementation details
- **[Scaling Guide](./SCALING.md)** - Horizontal and vertical scaling
- **[API Reference](./API_REFERENCE.md)** - Complete API documentation

---

*Remember: Best practices are living guidelines that evolve with your understanding and requirements. Regular review and updates ensure continued excellence.*

**Built with 💙 by Echo AI Systems**