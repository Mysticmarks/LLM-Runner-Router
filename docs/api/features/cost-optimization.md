# 💰 Cost Optimization Guide

Complete guide to optimizing API costs across multiple LLM providers using intelligent routing and caching strategies.

## Table of Contents

1. [Overview](#overview)
2. [Cost Tracking](#cost-tracking)
3. [Optimization Strategies](#optimization-strategies)
4. [Provider Comparison](#provider-comparison)
5. [Implementation](#implementation)
6. [Advanced Patterns](#advanced-patterns)
7. [Monitoring & Analytics](#monitoring--analytics)
8. [Best Practices](#best-practices)

## Overview

LLM-Runner-Router provides sophisticated cost optimization features that can reduce your AI infrastructure costs by up to 80% while maintaining quality.

### Key Features

- **Real-time Cost Tracking**: Monitor costs per request, per user, per model
- **Intelligent Routing**: Automatically route to cheaper models when appropriate
- **Response Caching**: Cache frequent queries to eliminate redundant API calls
- **Batch Processing**: Combine multiple requests for volume discounts
- **Quality-Cost Balance**: Maintain output quality while minimizing costs

## Cost Tracking

### Basic Cost Tracking

Track costs for every API call:

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  costTracking: {
    enabled: true,
    currency: 'USD',
    alertThreshold: 100 // Alert when daily cost exceeds $100
  }
});

// Make a request
const response = await router.generate({
  prompt: 'Explain quantum computing',
  model: 'gpt-4'
});

// Access cost information
console.log(`Cost: $${response.metadata.cost}`);
console.log(`Input tokens: ${response.metadata.inputTokens}`);
console.log(`Output tokens: ${response.metadata.outputTokens}`);
```

### Detailed Cost Analytics

```javascript
// Get cost breakdown by model
const costBreakdown = await router.getCostAnalytics({
  period: 'day',
  groupBy: 'model'
});

console.log('Daily costs by model:');
costBreakdown.forEach(item => {
  console.log(`${item.model}: $${item.cost.toFixed(2)}`);
});

// Get cost trends
const trends = await router.getCostTrends({
  period: 'week',
  interval: 'day'
});

// Export cost report
const report = await router.exportCostReport({
  format: 'csv',
  period: 'month'
});
```

## Optimization Strategies

### 1. Model Cascading

Use cheaper models first, escalate only when needed:

```javascript
const router = new LLMRouter({
  strategy: 'cost-optimized',
  modelCascade: [
    {
      model: 'gpt-3.5-turbo',
      maxTokens: 500,
      conditions: {
        complexity: 'low',
        maxCost: 0.01
      }
    },
    {
      model: 'gpt-4',
      maxTokens: 1000,
      conditions: {
        complexity: 'high',
        maxCost: 0.10
      }
    }
  ]
});

// Router automatically selects the cheapest suitable model
const response = await router.generate({
  prompt: 'What is 2+2?', // Simple query uses gpt-3.5-turbo
  detectComplexity: true
});
```

### 2. Response Caching

Cache responses to eliminate redundant API calls:

```javascript
const router = new LLMRouter({
  cache: {
    enabled: true,
    ttl: 3600, // Cache for 1 hour
    maxSize: 1000, // Max 1000 cached responses
    strategy: 'semantic' // Use semantic similarity for cache matching
  }
});

// First call - hits API
const response1 = await router.generate({
  prompt: 'What is machine learning?',
  useCache: true
});
console.log(`Cache hit: ${response1.metadata.cacheHit}`); // false

// Second call - served from cache
const response2 = await router.generate({
  prompt: 'What is machine learning?',
  useCache: true
});
console.log(`Cache hit: ${response2.metadata.cacheHit}`); // true
console.log(`Saved: $${response2.metadata.costSaved}`);
```

### 3. Batch Processing

Combine multiple requests for better rates:

```javascript
const router = new LLMRouter({
  batching: {
    enabled: true,
    maxBatchSize: 10,
    maxWaitTime: 1000 // Wait up to 1 second to form batch
  }
});

// These requests will be batched automatically
const promises = [
  router.generate({ prompt: 'Query 1' }),
  router.generate({ prompt: 'Query 2' }),
  router.generate({ prompt: 'Query 3' })
];

const responses = await Promise.all(promises);
// All processed in a single API call, reducing overhead
```

### 4. Token Optimization

Minimize token usage without sacrificing quality:

```javascript
const router = new LLMRouter({
  tokenOptimization: {
    enabled: true,
    compressPrompts: true,
    removeRedundancy: true,
    optimizeSystemPrompts: true
  }
});

// Original prompt: 1000 tokens
const longPrompt = `Please analyze the following text and provide...`;

const response = await router.generate({
  prompt: longPrompt,
  optimizeTokens: true
});

console.log(`Original tokens: ${response.metadata.originalTokens}`);
console.log(`Optimized tokens: ${response.metadata.optimizedTokens}`);
console.log(`Tokens saved: ${response.metadata.tokensSaved}`);
```

## Provider Comparison

### Real-time Price Comparison

```javascript
const router = new LLMRouter();

// Compare costs across providers for a specific prompt
const comparison = await router.compareCosts({
  prompt: 'Write a 500-word essay on climate change',
  providers: ['openai', 'anthropic', 'groq'],
  models: ['gpt-4', 'claude-3-opus', 'mixtral-8x7b']
});

console.log('Cost comparison:');
comparison.forEach(item => {
  console.log(`${item.provider}/${item.model}: $${item.estimatedCost}`);
});

// Get cheapest option
const cheapest = comparison.sort((a, b) => a.estimatedCost - b.estimatedCost)[0];
console.log(`Cheapest: ${cheapest.provider}/${cheapest.model}`);
```

### Provider Pricing Table

| Provider | Model | Input (per 1M tokens) | Output (per 1M tokens) |
|----------|-------|----------------------|------------------------|
| OpenAI | GPT-4 Turbo | $10.00 | $30.00 |
| OpenAI | GPT-3.5 Turbo | $0.50 | $1.50 |
| Anthropic | Claude 3 Opus | $15.00 | $75.00 |
| Anthropic | Claude 3 Sonnet | $3.00 | $15.00 |
| Anthropic | Claude 3 Haiku | $0.25 | $1.25 |
| Groq | Mixtral 8x7B | $0.27 | $0.27 |
| OpenRouter | Auto (best price) | Variable | Variable |

## Implementation

### Cost-Optimized Router Setup

```javascript
import { LLMRouter } from 'llm-runner-router';

// Create a fully cost-optimized router
const router = new LLMRouter({
  // Use cost-optimized strategy
  strategy: 'cost-optimized',
  
  // Enable all cost-saving features
  costTracking: {
    enabled: true,
    alertThreshold: 100,
    dailyLimit: 500
  },
  
  // Smart caching
  cache: {
    enabled: true,
    ttl: 7200,
    strategy: 'semantic',
    similarityThreshold: 0.95
  },
  
  // Batch processing
  batching: {
    enabled: true,
    maxBatchSize: 20,
    maxWaitTime: 2000
  },
  
  // Token optimization
  tokenOptimization: {
    enabled: true,
    compressPrompts: true,
    cacheSystemPrompts: true
  },
  
  // Model preferences (cheapest first)
  modelPriority: [
    'groq/mixtral-8x7b',
    'anthropic/claude-3-haiku',
    'openai/gpt-3.5-turbo',
    'anthropic/claude-3-sonnet',
    'openai/gpt-4-turbo'
  ]
});

// Use the router
async function processQuery(query) {
  try {
    const response = await router.generate({
      prompt: query,
      maxCost: 0.10, // Maximum $0.10 per query
      fallbackOnCostExceed: true
    });
    
    console.log(`Response: ${response.text}`);
    console.log(`Cost: $${response.metadata.cost}`);
    console.log(`Model used: ${response.metadata.model}`);
    
    return response;
  } catch (error) {
    if (error.code === 'COST_LIMIT_EXCEEDED') {
      console.log('Cost limit exceeded, using fallback...');
      // Handle cost limit exceeded
    }
    throw error;
  }
}
```

### Cost Monitoring Dashboard

```javascript
// Create a cost monitoring dashboard
class CostMonitor {
  constructor(router) {
    this.router = router;
  }
  
  async getDashboardData() {
    const [
      currentCosts,
      modelUsage,
      cacheStats,
      projections
    ] = await Promise.all([
      this.router.getCurrentPeriodCosts(),
      this.router.getModelUsageStats(),
      this.router.getCacheStats(),
      this.router.getCostProjections()
    ]);
    
    return {
      summary: {
        todaySpend: currentCosts.today,
        weekSpend: currentCosts.week,
        monthSpend: currentCosts.month,
        savedByCache: cacheStats.totalSaved,
        cacheHitRate: cacheStats.hitRate
      },
      models: modelUsage.map(m => ({
        name: m.model,
        requests: m.requestCount,
        totalCost: m.totalCost,
        avgCostPerRequest: m.avgCost
      })),
      projections: {
        endOfMonth: projections.monthly,
        endOfYear: projections.yearly
      }
    };
  }
  
  async generateReport(period = 'month') {
    const data = await this.getDashboardData();
    
    return {
      period,
      generatedAt: new Date().toISOString(),
      totalSpend: data.summary.monthSpend,
      breakdown: data.models,
      savings: {
        fromCaching: data.summary.savedByCache,
        fromOptimization: data.summary.savedByOptimization
      },
      recommendations: await this.getOptimizationRecommendations()
    };
  }
  
  async getOptimizationRecommendations() {
    const usage = await this.router.getUsagePatterns();
    const recommendations = [];
    
    // Analyze usage patterns
    if (usage.repeatedQueries > 100) {
      recommendations.push({
        type: 'caching',
        impact: 'high',
        description: 'Enable semantic caching for repeated queries',
        estimatedSavings: usage.repeatedQueries * 0.02
      });
    }
    
    if (usage.simpleQueries > 0.5) {
      recommendations.push({
        type: 'model-selection',
        impact: 'medium',
        description: 'Use lighter models for simple queries',
        estimatedSavings: usage.totalCost * 0.3
      });
    }
    
    return recommendations;
  }
}
```

## Advanced Patterns

### Dynamic Cost Allocation

Allocate costs to different departments or projects:

```javascript
const router = new LLMRouter({
  costAllocation: {
    enabled: true,
    defaultProject: 'general'
  }
});

// Tag requests with project/department
const response = await router.generate({
  prompt: 'Generate marketing copy',
  metadata: {
    project: 'marketing',
    department: 'sales',
    user: 'john.doe@company.com'
  }
});

// Get cost report by project
const projectCosts = await router.getCostsByProject({
  period: 'month'
});

projectCosts.forEach(project => {
  console.log(`${project.name}: $${project.totalCost}`);
});
```

### Adaptive Quality-Cost Balance

Automatically adjust quality based on budget:

```javascript
class AdaptiveCostRouter {
  constructor(options) {
    this.router = new LLMRouter(options);
    this.monthlyBudget = options.monthlyBudget || 1000;
    this.currentSpend = 0;
  }
  
  async generate(prompt, options = {}) {
    const remainingBudget = this.monthlyBudget - this.currentSpend;
    const daysLeft = this.getDaysLeftInMonth();
    const dailyBudget = remainingBudget / daysLeft;
    
    // Adjust quality based on remaining budget
    let model;
    if (dailyBudget > 50) {
      model = 'gpt-4'; // High quality
    } else if (dailyBudget > 10) {
      model = 'gpt-3.5-turbo'; // Medium quality
    } else {
      model = 'groq/mixtral-8x7b'; // Cost-effective
    }
    
    const response = await this.router.generate({
      prompt,
      model,
      maxCost: dailyBudget * 0.01, // Use max 1% of daily budget per request
      ...options
    });
    
    this.currentSpend += response.metadata.cost;
    
    return response;
  }
  
  getDaysLeftInMonth() {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.getDate() - now.getDate() + 1;
  }
}
```

### Cost-Aware Retry Logic

Implement smart retries that consider cost:

```javascript
async function costAwareRetry(router, prompt, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const maxTotalCost = options.maxTotalCost || 1.0;
  let totalCost = 0;
  let lastError;
  
  const models = [
    'gpt-3.5-turbo',     // Cheapest
    'claude-3-haiku',    // Slightly more expensive
    'gpt-4-turbo',       // More expensive but reliable
    'claude-3-opus'      // Most expensive, highest quality
  ];
  
  for (let i = 0; i < maxRetries && i < models.length; i++) {
    try {
      const remainingBudget = maxTotalCost - totalCost;
      
      const response = await router.generate({
        prompt,
        model: models[i],
        maxCost: remainingBudget,
        ...options
      });
      
      totalCost += response.metadata.cost;
      
      // Validate response quality
      if (response.text && response.text.length > 10) {
        return {
          ...response,
          totalCost,
          attempts: i + 1
        };
      }
    } catch (error) {
      lastError = error;
      console.log(`Attempt ${i + 1} failed with ${models[i]}: ${error.message}`);
    }
    
    if (totalCost >= maxTotalCost) {
      throw new Error(`Cost limit of $${maxTotalCost} exceeded`);
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
}
```

## Monitoring & Analytics

### Real-time Cost Alerts

```javascript
const router = new LLMRouter({
  costAlerts: {
    enabled: true,
    channels: ['email', 'slack'],
    thresholds: {
      hourly: 10,
      daily: 100,
      weekly: 500,
      monthly: 2000
    },
    recipients: ['admin@company.com']
  }
});

// Set up custom alert handlers
router.on('costAlert', (alert) => {
  console.log(`⚠️ Cost Alert: ${alert.message}`);
  console.log(`Current spend: $${alert.currentSpend}`);
  console.log(`Threshold: $${alert.threshold}`);
  
  // Take action based on alert
  if (alert.level === 'critical') {
    // Switch to ultra-low-cost mode
    router.setStrategy('ultra-cost-optimized');
  }
});
```

### Cost Analytics API

```javascript
// Advanced analytics endpoints
app.get('/api/costs/analytics', async (req, res) => {
  const analytics = await router.getCostAnalytics({
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    groupBy: req.query.groupBy || 'day',
    includeProjections: true
  });
  
  res.json({
    summary: analytics.summary,
    breakdown: analytics.breakdown,
    trends: analytics.trends,
    projections: analytics.projections,
    recommendations: analytics.recommendations
  });
});

// Cost optimization suggestions
app.get('/api/costs/optimize', async (req, res) => {
  const suggestions = await router.getOptimizationSuggestions();
  
  res.json({
    potentialSavings: suggestions.totalPotentialSavings,
    suggestions: suggestions.items.map(s => ({
      action: s.action,
      impact: s.estimatedSavings,
      difficulty: s.implementationDifficulty,
      description: s.description
    }))
  });
});
```

## Best Practices

### 1. Start with Baselines

Always establish cost baselines before optimization:

```javascript
// Measure baseline costs
async function establishBaseline(router, testPrompts) {
  const baseline = {
    withoutOptimization: 0,
    withOptimization: 0
  };
  
  // Test without optimization
  router.setStrategy('quality-first');
  for (const prompt of testPrompts) {
    const response = await router.generate({ prompt });
    baseline.withoutOptimization += response.metadata.cost;
  }
  
  // Test with optimization
  router.setStrategy('cost-optimized');
  for (const prompt of testPrompts) {
    const response = await router.generate({ prompt });
    baseline.withOptimization += response.metadata.cost;
  }
  
  const savings = baseline.withoutOptimization - baseline.withOptimization;
  const savingsPercent = (savings / baseline.withoutOptimization) * 100;
  
  console.log(`Baseline cost: $${baseline.withoutOptimization.toFixed(2)}`);
  console.log(`Optimized cost: $${baseline.withOptimization.toFixed(2)}`);
  console.log(`Savings: $${savings.toFixed(2)} (${savingsPercent.toFixed(1)}%)`);
  
  return baseline;
}
```

### 2. Implement Gradual Rollout

Roll out cost optimizations gradually:

```javascript
class GradualOptimizationRollout {
  constructor(router) {
    this.router = router;
    this.rolloutPercentage = 0;
  }
  
  async generate(prompt, options = {}) {
    const useOptimization = Math.random() * 100 < this.rolloutPercentage;
    
    if (useOptimization) {
      this.router.setStrategy('cost-optimized');
    } else {
      this.router.setStrategy('balanced');
    }
    
    const response = await this.router.generate(prompt, options);
    
    // Track metrics
    await this.trackMetrics(response, useOptimization);
    
    return response;
  }
  
  increaseRollout(percentage) {
    this.rolloutPercentage = Math.min(100, this.rolloutPercentage + percentage);
    console.log(`Optimization rollout: ${this.rolloutPercentage}%`);
  }
  
  async trackMetrics(response, optimized) {
    // Track quality, cost, and user satisfaction
    // Use this data to decide on rollout progression
  }
}
```

### 3. Monitor Quality Impact

Always monitor quality when optimizing costs:

```javascript
class QualityMonitor {
  constructor(router) {
    this.router = router;
    this.metrics = {
      responses: [],
      qualityScores: []
    };
  }
  
  async generateWithQualityCheck(prompt, options = {}) {
    const response = await this.router.generate(prompt, options);
    
    // Assess quality (could use another model or heuristics)
    const qualityScore = await this.assessQuality(response);
    
    this.metrics.responses.push({
      model: response.metadata.model,
      cost: response.metadata.cost,
      qualityScore
    });
    
    // Alert if quality drops below threshold
    if (qualityScore < 0.7) {
      console.warn(`⚠️ Low quality score: ${qualityScore} for model ${response.metadata.model}`);
      
      // Retry with higher quality model if needed
      if (options.ensureQuality) {
        return this.router.generate({
          ...options,
          prompt,
          model: 'gpt-4' // Force high-quality model
        });
      }
    }
    
    return response;
  }
  
  async assessQuality(response) {
    // Implement quality assessment logic
    // Could use another model, user feedback, or heuristics
    return 0.85; // Placeholder
  }
  
  getQualityReport() {
    const avgQuality = this.metrics.qualityScores.reduce((a, b) => a + b, 0) / 
                       this.metrics.qualityScores.length;
    
    const avgCost = this.metrics.responses.reduce((sum, r) => sum + r.cost, 0) / 
                    this.metrics.responses.length;
    
    return {
      averageQuality: avgQuality,
      averageCost: avgCost,
      qualityPerDollar: avgQuality / avgCost,
      samples: this.metrics.responses.length
    };
  }
}
```

### 4. Use Tiered Pricing

Implement tiered pricing for different use cases:

```javascript
const routerConfig = {
  tiers: {
    premium: {
      models: ['gpt-4', 'claude-3-opus'],
      cache: false,
      priority: 'high'
    },
    standard: {
      models: ['gpt-3.5-turbo', 'claude-3-sonnet'],
      cache: true,
      cacheTTL: 3600
    },
    economy: {
      models: ['groq/mixtral-8x7b', 'claude-3-haiku'],
      cache: true,
      cacheTTL: 86400,
      batching: true
    }
  }
};

async function routeByTier(prompt, tier = 'standard') {
  const config = routerConfig.tiers[tier];
  
  return router.generate({
    prompt,
    models: config.models,
    useCache: config.cache,
    cacheTTL: config.cacheTTL,
    batching: config.batching
  });
}
```

## Summary

Cost optimization in LLM-Runner-Router provides:

- **Up to 80% cost reduction** through intelligent routing and caching
- **Real-time cost tracking** and analytics
- **Automatic optimization** without sacrificing quality
- **Flexible strategies** for different use cases
- **Enterprise-grade monitoring** and alerting

Start with the cost-optimized strategy and gradually tune based on your specific needs. Monitor both costs and quality to find the perfect balance for your application.

---

Next: [Rate Limiting](./rate-limiting.md) | Previous: [Streaming](./streaming.md)