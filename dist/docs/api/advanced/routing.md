# 🚀 Advanced Routing Strategies

Comprehensive guide to implementing sophisticated routing algorithms, custom strategies, and intelligent model selection in LLM-Runner-Router.

## Table of Contents

1. [Overview](#overview)
2. [Built-in Routing Strategies](#built-in-routing-strategies)
3. [Custom Routing Algorithms](#custom-routing-algorithms)
4. [Contextual Routing](#contextual-routing)
5. [Performance-Based Routing](#performance-based-routing)
6. [Multi-Factor Routing](#multi-factor-routing)
7. [Dynamic Strategy Selection](#dynamic-strategy-selection)
8. [Monitoring & Optimization](#monitoring--optimization)

## Overview

Advanced routing enables intelligent model selection based on multiple factors including cost, performance, availability, and task requirements.

### Core Concepts

- **Strategy**: Algorithm for selecting models
- **Scoring**: Evaluating models against criteria
- **Fallback**: Backup model selection
- **Context**: Request-specific information
- **Metrics**: Performance measurements

## Built-in Routing Strategies

### 1. Quality-First Strategy

Prioritizes model quality regardless of cost:

```javascript
const router = new LLMRouter({
  strategy: 'quality-first',
  modelPriority: [
    'gpt-4-turbo',
    'claude-3-opus',
    'gpt-4',
    'claude-3-sonnet',
    'gpt-3.5-turbo'
  ]
});

// Always attempts highest quality model first
const response = await router.generate({
  prompt: 'Complex reasoning task',
  minQuality: 0.9 // Minimum quality score
});
```

### 2. Cost-Optimized Strategy

Minimizes costs while maintaining acceptable quality:

```javascript
const router = new LLMRouter({
  strategy: 'cost-optimized',
  costThreshold: {
    perRequest: 0.10,  // Max $0.10 per request
    daily: 100,        // Max $100 per day
    monthly: 2000      // Max $2000 per month
  },
  qualityThreshold: 0.7 // Minimum acceptable quality
});

// Selects cheapest model meeting quality threshold
const response = await router.generate({
  prompt: 'Simple query',
  maxCost: 0.05 // Override threshold for this request
});
```

### 3. Speed-Priority Strategy

Optimizes for lowest latency:

```javascript
const router = new LLMRouter({
  strategy: 'speed-priority',
  latencyTargets: {
    p50: 500,  // 50th percentile: 500ms
    p95: 1000, // 95th percentile: 1000ms
    p99: 2000  // 99th percentile: 2000ms
  }
});

// Selects fastest available model
const response = await router.generate({
  prompt: 'Time-sensitive query',
  timeout: 1000 // Hard timeout
});
```

### 4. Balanced Strategy

Balances quality, cost, and speed:

```javascript
const router = new LLMRouter({
  strategy: 'balanced',
  weights: {
    quality: 0.4,
    cost: 0.3,
    speed: 0.3
  }
});

// Calculates weighted score for each model
const response = await router.generate({
  prompt: 'General purpose query'
});
```

## Custom Routing Algorithms

### 1. Creating Custom Strategies

```javascript
class CustomRoutingStrategy {
  constructor(options = {}) {
    this.name = 'custom-strategy';
    this.options = options;
    this.metrics = new Map();
  }
  
  async selectModel(context) {
    const { prompt, requirements, history } = context;
    
    // Get available models
    const models = await this.getAvailableModels();
    
    // Score each model
    const scores = await Promise.all(
      models.map(async model => ({
        model,
        score: await this.scoreModel(model, context)
      }))
    );
    
    // Sort by score
    scores.sort((a, b) => b.score - a.score);
    
    // Return best model
    return scores[0]?.model;
  }
  
  async scoreModel(model, context) {
    let score = 0;
    
    // Task-specific scoring
    if (context.taskType === 'code' && model.includes('code')) {
      score += 20;
    }
    
    // Length-based scoring
    if (context.prompt.length > 2000 && model.contextLength > 8000) {
      score += 15;
    }
    
    // Historical performance
    const historicalScore = this.getHistoricalScore(model);
    score += historicalScore * 10;
    
    // Cost consideration
    const costScore = this.calculateCostScore(model, context);
    score += costScore * 5;
    
    // Availability bonus
    if (this.isModelAvailable(model)) {
      score += 10;
    }
    
    return score;
  }
  
  getHistoricalScore(model) {
    const metrics = this.metrics.get(model) || {
      successRate: 0.5,
      avgLatency: 1000,
      avgQuality: 0.5
    };
    
    return (
      metrics.successRate * 0.4 +
      (1 - metrics.avgLatency / 5000) * 0.3 +
      metrics.avgQuality * 0.3
    );
  }
  
  calculateCostScore(model, context) {
    const modelCosts = {
      'gpt-4': 0.03,
      'gpt-3.5-turbo': 0.002,
      'claude-3-opus': 0.015,
      'claude-3-haiku': 0.00025
    };
    
    const cost = modelCosts[model] || 0.01;
    const budget = context.budget || 0.10;
    
    return Math.min(1, budget / cost);
  }
  
  isModelAvailable(model) {
    // Check rate limits, availability, etc.
    return true;
  }
  
  async getAvailableModels() {
    return [
      'gpt-4',
      'gpt-3.5-turbo',
      'claude-3-opus',
      'claude-3-haiku'
    ];
  }
  
  updateMetrics(model, result) {
    const current = this.metrics.get(model) || {
      requests: 0,
      successes: 0,
      totalLatency: 0,
      totalQuality: 0
    };
    
    current.requests++;
    if (result.success) current.successes++;
    current.totalLatency += result.latency;
    current.totalQuality += result.quality || 0.5;
    
    current.successRate = current.successes / current.requests;
    current.avgLatency = current.totalLatency / current.requests;
    current.avgQuality = current.totalQuality / current.requests;
    
    this.metrics.set(model, current);
  }
}

// Register custom strategy
const router = new LLMRouter();
router.registerStrategy(new CustomRoutingStrategy({
  preferredModels: ['gpt-4', 'claude-3-opus']
}));

router.setStrategy('custom-strategy');
```

### 2. Adaptive Routing

Learns from past performance:

```javascript
class AdaptiveRouter {
  constructor() {
    this.history = [];
    this.modelStats = new Map();
    this.contextPatterns = new Map();
  }
  
  async route(prompt, context = {}) {
    // Analyze prompt characteristics
    const features = this.extractFeatures(prompt);
    
    // Find similar past requests
    const similar = this.findSimilarRequests(features);
    
    // Learn from past successes
    const bestModel = this.predictBestModel(features, similar);
    
    // Execute with predicted model
    const result = await this.execute(bestModel, prompt);
    
    // Update learning
    this.updateLearning(features, bestModel, result);
    
    return result;
  }
  
  extractFeatures(prompt) {
    return {
      length: prompt.length,
      complexity: this.assessComplexity(prompt),
      domain: this.detectDomain(prompt),
      language: this.detectLanguage(prompt),
      hasCode: /```|function|class|def/.test(prompt),
      hasmath: /\d+[\+\-\*\/]\d+|equation|calculate/.test(prompt),
      sentiment: this.analyzeSentiment(prompt)
    };
  }
  
  assessComplexity(prompt) {
    const indicators = {
      simple: /what|who|when|where|define/i,
      moderate: /how|why|explain|describe/i,
      complex: /analyze|compare|evaluate|design/i
    };
    
    for (const [level, pattern] of Object.entries(indicators)) {
      if (pattern.test(prompt)) return level;
    }
    
    return 'moderate';
  }
  
  detectDomain(prompt) {
    const domains = {
      technical: /code|program|algorithm|api|function/i,
      business: /revenue|profit|market|strategy|customer/i,
      creative: /story|poem|design|create|imagine/i,
      academic: /research|study|theory|hypothesis|analysis/i
    };
    
    for (const [domain, pattern] of Object.entries(domains)) {
      if (pattern.test(prompt)) return domain;
    }
    
    return 'general';
  }
  
  findSimilarRequests(features) {
    const similar = [];
    
    for (const past of this.history) {
      const similarity = this.calculateSimilarity(features, past.features);
      if (similarity > 0.7) {
        similar.push({ ...past, similarity });
      }
    }
    
    return similar.sort((a, b) => b.similarity - a.similarity);
  }
  
  calculateSimilarity(features1, features2) {
    let score = 0;
    let count = 0;
    
    for (const key in features1) {
      count++;
      if (features1[key] === features2[key]) {
        score += 1;
      } else if (typeof features1[key] === 'number') {
        const diff = Math.abs(features1[key] - features2[key]);
        score += Math.max(0, 1 - diff / 1000);
      }
    }
    
    return score / count;
  }
  
  predictBestModel(features, similar) {
    if (similar.length === 0) {
      // No history, use heuristics
      return this.heuristicSelection(features);
    }
    
    // Weighted voting from similar requests
    const votes = new Map();
    
    for (const past of similar) {
      const weight = past.similarity * past.result.quality;
      const current = votes.get(past.model) || 0;
      votes.set(past.model, current + weight);
    }
    
    // Return model with highest weighted vote
    let bestModel = null;
    let bestScore = 0;
    
    for (const [model, score] of votes) {
      if (score > bestScore) {
        bestScore = score;
        bestModel = model;
      }
    }
    
    return bestModel || 'gpt-3.5-turbo';
  }
  
  heuristicSelection(features) {
    if (features.complexity === 'complex') {
      return 'gpt-4';
    }
    
    if (features.hasCode) {
      return 'claude-3-opus';
    }
    
    if (features.domain === 'creative') {
      return 'gpt-4';
    }
    
    return 'gpt-3.5-turbo';
  }
  
  updateLearning(features, model, result) {
    // Add to history
    this.history.push({
      features,
      model,
      result: {
        success: result.success,
        quality: result.quality || 0.5,
        latency: result.latency,
        cost: result.cost
      },
      timestamp: Date.now()
    });
    
    // Keep only recent history
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    this.history = this.history.filter(h => h.timestamp > oneWeekAgo);
    
    // Update model statistics
    const stats = this.modelStats.get(model) || {
      uses: 0,
      successes: 0,
      totalQuality: 0
    };
    
    stats.uses++;
    if (result.success) stats.successes++;
    stats.totalQuality += result.quality || 0.5;
    
    this.modelStats.set(model, stats);
  }
}
```

## Contextual Routing

### 1. User-Based Routing

Different strategies per user tier:

```javascript
class UserAwareRouter {
  constructor() {
    this.userTiers = new Map();
    this.tierStrategies = {
      free: {
        models: ['gpt-3.5-turbo', 'claude-3-haiku'],
        maxCostPerRequest: 0.01,
        rateLimit: 10
      },
      pro: {
        models: ['gpt-4', 'gpt-3.5-turbo', 'claude-3-sonnet'],
        maxCostPerRequest: 0.10,
        rateLimit: 100
      },
      enterprise: {
        models: ['gpt-4', 'claude-3-opus', 'custom-models'],
        maxCostPerRequest: 1.00,
        rateLimit: 1000
      }
    };
  }
  
  async routeForUser(userId, prompt, options = {}) {
    const tier = await this.getUserTier(userId);
    const strategy = this.tierStrategies[tier];
    
    // Filter available models
    const availableModels = strategy.models.filter(model =>
      this.isModelAvailable(model)
    );
    
    // Apply tier-specific routing
    const model = await this.selectModelForTier(
      availableModels,
      prompt,
      strategy,
      options
    );
    
    // Track usage
    await this.trackUsage(userId, model);
    
    return model;
  }
  
  async getUserTier(userId) {
    // Check cache
    if (this.userTiers.has(userId)) {
      return this.userTiers.get(userId);
    }
    
    // Fetch from database
    const tier = await this.fetchUserTier(userId);
    this.userTiers.set(userId, tier);
    
    return tier;
  }
  
  async selectModelForTier(models, prompt, strategy, options) {
    // Estimate cost for each model
    const estimates = await Promise.all(
      models.map(async model => ({
        model,
        cost: await this.estimateCost(model, prompt),
        quality: this.getModelQuality(model)
      }))
    );
    
    // Filter by cost constraint
    const affordable = estimates.filter(e => 
      e.cost <= strategy.maxCostPerRequest
    );
    
    if (affordable.length === 0) {
      throw new Error('No affordable models available');
    }
    
    // Select based on user preference
    if (options.preferQuality) {
      affordable.sort((a, b) => b.quality - a.quality);
    } else {
      affordable.sort((a, b) => a.cost - b.cost);
    }
    
    return affordable[0].model;
  }
}
```

### 2. Task-Specific Routing

Route based on detected task type:

```javascript
class TaskRouter {
  constructor() {
    this.taskDetectors = [
      {
        name: 'code-generation',
        pattern: /write.*code|implement|function|class|program/i,
        models: ['claude-3-opus', 'gpt-4', 'code-llama']
      },
      {
        name: 'translation',
        pattern: /translate|translation|en español|en français/i,
        models: ['gpt-3.5-turbo', 'claude-3-haiku']
      },
      {
        name: 'summarization',
        pattern: /summarize|summary|key points|tldr/i,
        models: ['gpt-3.5-turbo', 'claude-3-haiku']
      },
      {
        name: 'creative-writing',
        pattern: /story|poem|creative|imagine|fiction/i,
        models: ['gpt-4', 'claude-3-opus']
      },
      {
        name: 'analysis',
        pattern: /analyze|evaluate|compare|assess/i,
        models: ['gpt-4', 'claude-3-opus']
      },
      {
        name: 'qa',
        pattern: /what|who|when|where|why|how/i,
        models: ['gpt-3.5-turbo', 'claude-3-haiku']
      }
    ];
  }
  
  detectTask(prompt) {
    for (const detector of this.taskDetectors) {
      if (detector.pattern.test(prompt)) {
        return detector;
      }
    }
    
    return {
      name: 'general',
      models: ['gpt-3.5-turbo', 'claude-3-sonnet']
    };
  }
  
  async route(prompt, context = {}) {
    const task = this.detectTask(prompt);
    
    // Get task-specific models
    let models = [...task.models];
    
    // Add context-specific adjustments
    if (context.requiresVision) {
      models = models.filter(m => 
        ['gpt-4-vision', 'claude-3-opus'].includes(m)
      );
    }
    
    if (context.requiresLongContext) {
      models = models.filter(m =>
        this.getModelContextLength(m) > 8000
      );
    }
    
    // Select best available
    for (const model of models) {
      if (await this.isAvailable(model)) {
        return model;
      }
    }
    
    // Fallback
    return 'gpt-3.5-turbo';
  }
  
  getModelContextLength(model) {
    const lengths = {
      'gpt-4': 8192,
      'gpt-3.5-turbo': 4096,
      'claude-3-opus': 200000,
      'claude-3-haiku': 200000
    };
    
    return lengths[model] || 4096;
  }
}
```

## Performance-Based Routing

### 1. Latency-Aware Routing

```javascript
class LatencyRouter {
  constructor() {
    this.latencyHistory = new Map();
    this.targetLatency = 1000; // 1 second target
  }
  
  async route(prompt, options = {}) {
    const deadline = options.deadline || Date.now() + this.targetLatency;
    const models = await this.getModelsWithLatency();
    
    // Sort by expected latency
    models.sort((a, b) => a.expectedLatency - b.expectedLatency);
    
    // Try models in order of speed
    for (const model of models) {
      const timeRemaining = deadline - Date.now();
      
      if (model.expectedLatency < timeRemaining * 0.8) {
        // 80% confidence we'll meet deadline
        return model.name;
      }
    }
    
    // Use fastest available
    return models[0]?.name || 'gpt-3.5-turbo';
  }
  
  async getModelsWithLatency() {
    const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'groq'];
    
    return models.map(name => ({
      name,
      expectedLatency: this.getExpectedLatency(name),
      confidence: this.getConfidence(name)
    }));
  }
  
  getExpectedLatency(model) {
    const history = this.latencyHistory.get(model);
    
    if (!history || history.length === 0) {
      // Default estimates
      const defaults = {
        'groq': 200,
        'gpt-3.5-turbo': 800,
        'claude-3-haiku': 600,
        'gpt-4': 2000,
        'claude-3-opus': 1500
      };
      
      return defaults[model] || 1000;
    }
    
    // Calculate P75 latency
    const sorted = [...history].sort((a, b) => a - b);
    const p75Index = Math.floor(sorted.length * 0.75);
    
    return sorted[p75Index];
  }
  
  updateLatency(model, latency) {
    if (!this.latencyHistory.has(model)) {
      this.latencyHistory.set(model, []);
    }
    
    const history = this.latencyHistory.get(model);
    history.push(latency);
    
    // Keep only last 100 measurements
    if (history.length > 100) {
      history.shift();
    }
  }
}
```

### 2. Load-Balanced Routing

```javascript
class LoadBalancer {
  constructor() {
    this.modelLoads = new Map();
    this.maxConcurrent = {
      'gpt-4': 10,
      'gpt-3.5-turbo': 50,
      'claude-3-opus': 20,
      'claude-3-haiku': 100
    };
  }
  
  async route(prompt) {
    const loads = this.getCurrentLoads();
    
    // Find models with capacity
    const available = loads.filter(model =>
      model.current < model.max * 0.8 // 80% threshold
    );
    
    if (available.length === 0) {
      // All models busy, queue or wait
      await this.waitForCapacity();
      return this.route(prompt);
    }
    
    // Select least loaded model
    available.sort((a, b) => 
      (a.current / a.max) - (b.current / b.max)
    );
    
    const selected = available[0].name;
    
    // Increment load
    this.incrementLoad(selected);
    
    return selected;
  }
  
  getCurrentLoads() {
    const loads = [];
    
    for (const [model, max] of Object.entries(this.maxConcurrent)) {
      loads.push({
        name: model,
        current: this.modelLoads.get(model) || 0,
        max
      });
    }
    
    return loads;
  }
  
  incrementLoad(model) {
    const current = this.modelLoads.get(model) || 0;
    this.modelLoads.set(model, current + 1);
  }
  
  decrementLoad(model) {
    const current = this.modelLoads.get(model) || 0;
    this.modelLoads.set(model, Math.max(0, current - 1));
  }
  
  async waitForCapacity() {
    return new Promise(resolve => {
      const check = setInterval(() => {
        const loads = this.getCurrentLoads();
        const hasCapacity = loads.some(model =>
          model.current < model.max
        );
        
        if (hasCapacity) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }
}
```

## Multi-Factor Routing

### Combined Scoring System

```javascript
class MultiFactorRouter {
  constructor(options = {}) {
    this.factors = {
      quality: options.qualityWeight || 0.3,
      cost: options.costWeight || 0.2,
      speed: options.speedWeight || 0.2,
      availability: options.availabilityWeight || 0.15,
      reliability: options.reliabilityWeight || 0.15
    };
    
    this.modelScores = new Map();
  }
  
  async route(prompt, context = {}) {
    const models = await this.getAvailableModels();
    const scores = [];
    
    for (const model of models) {
      const score = await this.calculateScore(model, prompt, context);
      scores.push({ model, score, breakdown: score.breakdown });
    }
    
    // Sort by total score
    scores.sort((a, b) => b.score.total - a.score.total);
    
    // Log decision reasoning
    this.logDecision(scores[0], context);
    
    return scores[0].model;
  }
  
  async calculateScore(model, prompt, context) {
    const breakdown = {
      quality: await this.getQualityScore(model),
      cost: await this.getCostScore(model, prompt),
      speed: await this.getSpeedScore(model),
      availability: await this.getAvailabilityScore(model),
      reliability: await this.getReliabilityScore(model)
    };
    
    // Apply context modifiers
    if (context.urgency === 'high') {
      breakdown.speed *= 1.5;
    }
    
    if (context.budget === 'low') {
      breakdown.cost *= 1.5;
    }
    
    // Calculate weighted total
    let total = 0;
    for (const [factor, weight] of Object.entries(this.factors)) {
      total += (breakdown[factor] || 0) * weight;
    }
    
    return { total, breakdown };
  }
  
  async getQualityScore(model) {
    const qualityRatings = {
      'gpt-4': 0.95,
      'claude-3-opus': 0.93,
      'gpt-3.5-turbo': 0.80,
      'claude-3-haiku': 0.75
    };
    
    return qualityRatings[model] || 0.70;
  }
  
  async getCostScore(model, prompt) {
    const costs = {
      'gpt-4': 0.03,
      'claude-3-opus': 0.015,
      'gpt-3.5-turbo': 0.002,
      'claude-3-haiku': 0.00025
    };
    
    const cost = costs[model] || 0.01;
    
    // Invert cost (lower cost = higher score)
    return 1 - Math.min(1, cost / 0.05);
  }
  
  async getSpeedScore(model) {
    const avgLatencies = {
      'groq': 200,
      'claude-3-haiku': 400,
      'gpt-3.5-turbo': 800,
      'claude-3-opus': 1200,
      'gpt-4': 2000
    };
    
    const latency = avgLatencies[model] || 1000;
    
    // Invert latency (lower latency = higher score)
    return 1 - Math.min(1, latency / 3000);
  }
  
  async getAvailabilityScore(model) {
    // Check current availability
    const isAvailable = await this.checkAvailability(model);
    
    if (!isAvailable) return 0;
    
    // Check rate limit status
    const rateLimitRemaining = await this.getRateLimitRemaining(model);
    
    return Math.min(1, rateLimitRemaining / 100);
  }
  
  async getReliabilityScore(model) {
    const stats = this.modelScores.get(model) || {
      requests: 0,
      successes: 0
    };
    
    if (stats.requests === 0) return 0.8; // Default
    
    return stats.successes / stats.requests;
  }
  
  logDecision(selection, context) {
    console.log('Routing Decision:', {
      selected: selection.model,
      score: selection.score.total.toFixed(3),
      breakdown: selection.breakdown,
      context
    });
  }
}
```

## Dynamic Strategy Selection

### Automatic Strategy Switching

```javascript
class DynamicStrategySelector {
  constructor() {
    this.strategies = new Map();
    this.currentStrategy = 'balanced';
    this.metrics = {
      cost: { current: 0, limit: 100 },
      errors: { current: 0, threshold: 0.05 },
      latency: { current: 0, target: 1000 }
    };
    
    this.registerDefaultStrategies();
  }
  
  registerDefaultStrategies() {
    this.strategies.set('aggressive', {
      condition: () => this.metrics.cost.current < this.metrics.cost.limit * 0.5,
      router: new QualityFirstRouter()
    });
    
    this.strategies.set('conservative', {
      condition: () => this.metrics.cost.current > this.metrics.cost.limit * 0.8,
      router: new CostOptimizedRouter()
    });
    
    this.strategies.set('fast', {
      condition: () => this.metrics.latency.current > this.metrics.latency.target,
      router: new SpeedPriorityRouter()
    });
    
    this.strategies.set('balanced', {
      condition: () => true, // Default
      router: new BalancedRouter()
    });
  }
  
  async route(prompt, context = {}) {
    // Update strategy based on current metrics
    this.updateStrategy();
    
    // Get current router
    const strategy = this.strategies.get(this.currentStrategy);
    const model = await strategy.router.route(prompt, context);
    
    // Execute request
    const result = await this.execute(model, prompt);
    
    // Update metrics
    this.updateMetrics(result);
    
    return result;
  }
  
  updateStrategy() {
    for (const [name, strategy] of this.strategies) {
      if (name === 'balanced') continue; // Skip default
      
      if (strategy.condition()) {
        if (this.currentStrategy !== name) {
          console.log(`Switching strategy: ${this.currentStrategy} → ${name}`);
          this.currentStrategy = name;
        }
        return;
      }
    }
    
    // No special condition met, use balanced
    if (this.currentStrategy !== 'balanced') {
      console.log(`Switching strategy: ${this.currentStrategy} → balanced`);
      this.currentStrategy = 'balanced';
    }
  }
  
  updateMetrics(result) {
    // Update cost
    this.metrics.cost.current += result.cost || 0;
    
    // Update error rate (rolling average)
    const errorRate = result.error ? 1 : 0;
    this.metrics.errors.current = 
      this.metrics.errors.current * 0.95 + errorRate * 0.05;
    
    // Update latency (rolling average)
    this.metrics.latency.current = 
      this.metrics.latency.current * 0.9 + result.latency * 0.1;
  }
}
```

## Monitoring & Optimization

### Routing Analytics

```javascript
class RoutingAnalytics {
  constructor() {
    this.decisions = [];
    this.modelPerformance = new Map();
  }
  
  recordDecision(decision) {
    this.decisions.push({
      ...decision,
      timestamp: Date.now()
    });
    
    // Update model performance
    const perf = this.modelPerformance.get(decision.model) || {
      uses: 0,
      totalCost: 0,
      totalLatency: 0,
      errors: 0
    };
    
    perf.uses++;
    perf.totalCost += decision.cost || 0;
    perf.totalLatency += decision.latency || 0;
    if (decision.error) perf.errors++;
    
    this.modelPerformance.set(decision.model, perf);
  }
  
  getAnalytics(period = 3600000) {
    const now = Date.now();
    const recent = this.decisions.filter(d => 
      d.timestamp > now - period
    );
    
    const analytics = {
      totalRequests: recent.length,
      modelDistribution: {},
      avgCost: 0,
      avgLatency: 0,
      errorRate: 0,
      recommendations: []
    };
    
    // Calculate distributions
    const modelCounts = {};
    let totalCost = 0;
    let totalLatency = 0;
    let errors = 0;
    
    for (const decision of recent) {
      modelCounts[decision.model] = (modelCounts[decision.model] || 0) + 1;
      totalCost += decision.cost || 0;
      totalLatency += decision.latency || 0;
      if (decision.error) errors++;
    }
    
    // Calculate percentages
    for (const [model, count] of Object.entries(modelCounts)) {
      analytics.modelDistribution[model] = 
        ((count / recent.length) * 100).toFixed(1) + '%';
    }
    
    analytics.avgCost = (totalCost / recent.length).toFixed(4);
    analytics.avgLatency = Math.round(totalLatency / recent.length);
    analytics.errorRate = ((errors / recent.length) * 100).toFixed(2) + '%';
    
    // Generate recommendations
    analytics.recommendations = this.generateRecommendations(analytics);
    
    return analytics;
  }
  
  generateRecommendations(analytics) {
    const recommendations = [];
    
    if (parseFloat(analytics.errorRate) > 5) {
      recommendations.push({
        type: 'reliability',
        message: 'High error rate detected. Consider adding fallback models.',
        priority: 'high'
      });
    }
    
    if (analytics.avgLatency > 2000) {
      recommendations.push({
        type: 'performance',
        message: 'High average latency. Consider using faster models or caching.',
        priority: 'medium'
      });
    }
    
    if (parseFloat(analytics.avgCost) > 0.05) {
      recommendations.push({
        type: 'cost',
        message: 'High average cost per request. Enable cost optimization.',
        priority: 'medium'
      });
    }
    
    return recommendations;
  }
}
```

## Best Practices

### 1. Strategy Selection
- Start with balanced strategy
- Monitor metrics continuously
- Adjust weights based on needs
- Test strategies in staging

### 2. Custom Routing
- Keep algorithms simple
- Cache routing decisions
- Update metrics asynchronously
- Implement circuit breakers

### 3. Performance
- Pre-compute model scores
- Use connection pooling
- Implement request batching
- Cache similar requests

### 4. Monitoring
- Track all routing decisions
- Set up alerts for anomalies
- Review analytics regularly
- A/B test new strategies

## Conclusion

Advanced routing strategies enable:
- **Optimal model selection** for every request
- **Cost reduction** through intelligent routing
- **Improved reliability** with fallbacks
- **Better performance** through load balancing
- **Adaptive behavior** based on metrics

Implement gradually, starting with built-in strategies and evolving to custom solutions as needed.

---

Next: [Enterprise Features](./enterprise.md) | [Back to Advanced Topics](../advanced/)