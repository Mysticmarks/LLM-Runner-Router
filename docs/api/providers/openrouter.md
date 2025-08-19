# 🌐 OpenRouter Provider Documentation

Complete guide to using OpenRouter's unified API access to 100+ AI models with LLM-Runner-Router.

## What is OpenRouter?

OpenRouter provides a single API endpoint to access models from OpenAI, Anthropic, Google, Meta, Mistral, and many more providers. It handles routing, failover, and provides cost optimization across providers.

## Setup & Configuration

### API Key Setup

#### Environment Variables (Recommended)
```bash
# Required
OPENROUTER_API_KEY=sk-or-v1-...

# Optional but recommended
OPENROUTER_APP_NAME=MyApp
OPENROUTER_SITE_URL=https://myapp.com
```

#### Programmatic Setup
```javascript
import { APILoader } from 'llm-runner-router';

const router = new APILoader({
  provider: 'openrouter',
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    'HTTP-Referer': 'https://myapp.com',  // Optional, for tracking
    'X-Title': 'My Application'  // Optional, shown in dashboard
  },
  defaultModel: 'auto'  // Let OpenRouter choose
});
```

#### Advanced Configuration
```javascript
const router = new APILoader({
  provider: 'openrouter',
  apiKey: process.env.OPENROUTER_API_KEY,
  preferences: {
    allowFallbacks: true,  // Enable automatic fallbacks
    requireParameters: ['temperature', 'max_tokens'],  // Required params
    order: ['quality', 'cost', 'speed'],  // Routing preference
    transforms: ['cache', 'minify', 'optimize']  // Response optimizations
  }
});
```

## Model Discovery

### Dynamic Model Listing

```javascript
// Get all available models
const models = await router.listModels();

console.log(`Total models available: ${models.length}`);

// Filter by capability
const visionModels = models.filter(m => m.capabilities?.vision);
const functionModels = models.filter(m => m.capabilities?.functions);
const longContextModels = models.filter(m => m.contextLength >= 100000);

// Sort by price
const cheapestModels = models
  .sort((a, b) => a.pricing.prompt - b.pricing.prompt)
  .slice(0, 10);

// Find specific provider models
const openAIModels = models.filter(m => m.id.includes('openai'));
const anthropicModels = models.filter(m => m.id.includes('anthropic'));
```

### Popular Models (100+ Available)

| Model ID | Provider | Context | Input Cost | Notes |
|----------|----------|---------|------------|-------|
| `openai/gpt-4-turbo` | OpenAI | 128K | $10/M | Latest GPT-4 |
| `anthropic/claude-3-opus` | Anthropic | 200K | $15/M | Most capable Claude |
| `google/gemini-pro-1.5` | Google | 1M | $3.5/M | Massive context |
| `meta-llama/llama-3-70b` | Meta | 8K | $0.9/M | Open source |
| `mistralai/mistral-large` | Mistral | 32K | $8/M | European alternative |
| `cohere/command-r-plus` | Cohere | 128K | $3/M | RAG optimized |
| `perplexity/sonar-medium` | Perplexity | 16K | $0.6/M | Web-aware |
| `nous/hermes-2-mixtral` | Nous | 32K | $0.5/M | Uncensored |
| `openrouter/auto` | Auto | Varies | Varies | Automatic selection |

### Auto Mode

```javascript
// Let OpenRouter automatically select the best model
const response = await router.complete({
  model: 'openrouter/auto',
  prompt: "Explain quantum computing",
  requirements: {
    maxCost: 0.01,  // Maximum cost per request
    minQuality: 0.8,  // Minimum quality score (0-1)
    maxLatency: 5000  // Maximum response time in ms
  }
});

console.log(`Used model: ${response.model}`);
console.log(`Routing reason: ${response.routingReason}`);
```

## Advanced Features

### Multi-Provider Routing

```javascript
class SmartRouter {
  constructor() {
    this.router = new APILoader({
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY
    });
  }
  
  async routeByCapability(prompt, requirements) {
    // Get models that meet requirements
    const models = await this.router.listModels();
    
    const suitable = models.filter(m => {
      const meetsContext = m.contextLength >= requirements.minContext;
      const meetsCost = m.pricing.prompt <= requirements.maxCost;
      const hasCapability = requirements.capabilities.every(
        cap => m.capabilities?.[cap]
      );
      
      return meetsContext && meetsCost && hasCapability;
    });
    
    // Sort by preference
    suitable.sort((a, b) => {
      if (requirements.prefer === 'quality') {
        return b.qualityScore - a.qualityScore;
      } else if (requirements.prefer === 'speed') {
        return a.avgLatency - b.avgLatency;
      } else {
        return a.pricing.prompt - b.pricing.prompt;
      }
    });
    
    // Use best model
    return await this.router.complete({
      model: suitable[0].id,
      prompt: prompt,
      maxTokens: requirements.maxTokens
    });
  }
}

// Usage
const smartRouter = new SmartRouter();
const response = await smartRouter.routeByCapability(
  "Analyze this code for security vulnerabilities",
  {
    minContext: 32000,
    maxCost: 5,  // $5 per million tokens
    capabilities: ['codeAnalysis'],
    prefer: 'quality',
    maxTokens: 2000
  }
);
```

### Fallback Chains

```javascript
const router = new APILoader({
  provider: 'openrouter',
  fallbacks: {
    enabled: true,
    chain: [
      'anthropic/claude-3-opus',  // Primary choice
      'openai/gpt-4-turbo',        // First fallback
      'google/gemini-pro-1.5',     // Second fallback
      'mistralai/mistral-large',   // Third fallback
      'openrouter/auto'             // Final fallback
    ],
    reasons: ['rate_limit', 'timeout', 'server_error']
  }
});

// Automatic fallback on failure
const response = await router.complete({
  prompt: "Complex analysis task",
  maxTokens: 1000
});

console.log(`Final model used: ${response.model}`);
console.log(`Fallback triggered: ${response.fallbackUsed}`);
```

### Cost Optimization

```javascript
class CostOptimizer {
  constructor() {
    this.router = new APILoader({ provider: 'openrouter' });
    this.budget = {
      daily: 10.00,  // $10 per day
      perRequest: 0.05  // $0.05 per request
    };
    this.spending = 0;
  }
  
  async selectCheapestCapable(task) {
    const models = await this.router.listModels();
    
    // Define capability requirements by task type
    const requirements = {
      simple: { minScore: 0.6, maxContext: 8000 },
      medium: { minScore: 0.75, maxContext: 32000 },
      complex: { minScore: 0.85, maxContext: 128000 },
      vision: { capability: 'vision' },
      code: { capability: 'codeGeneration' }
    };
    
    const req = requirements[task.type] || requirements.medium;
    
    // Filter and sort by cost
    const suitable = models
      .filter(m => {
        const meetsScore = m.qualityScore >= req.minScore;
        const meetsContext = m.contextLength >= req.maxContext;
        const hasCapability = !req.capability || m.capabilities?.[req.capability];
        const withinBudget = m.pricing.prompt * task.estimatedTokens / 1000000 <= this.budget.perRequest;
        
        return meetsScore && meetsContext && hasCapability && withinBudget;
      })
      .sort((a, b) => a.pricing.prompt - b.pricing.prompt);
    
    if (suitable.length === 0) {
      throw new Error('No suitable models within budget');
    }
    
    return suitable[0];
  }
  
  async complete(prompt, taskType = 'medium') {
    const model = await this.selectCheapestCapable({
      type: taskType,
      estimatedTokens: prompt.length * 2  // Rough estimate
    });
    
    console.log(`Selected model: ${model.id} ($${model.pricing.prompt}/M tokens)`);
    
    const response = await this.router.complete({
      model: model.id,
      prompt: prompt,
      maxTokens: 500
    });
    
    this.spending += response.cost;
    
    if (this.spending > this.budget.daily) {
      throw new Error('Daily budget exceeded');
    }
    
    return response;
  }
}
```

### Provider Preferences

```javascript
// Prefer specific providers
const response = await router.complete({
  model: 'openrouter/auto',
  prompt: "Analyze this data",
  providers: {
    require: ['anthropic', 'openai'],  // Only use these
    prefer: ['anthropic'],  // Prefer Anthropic if available
    avoid: ['cohere', 'ai21'],  // Avoid these providers
    fallback: true  // Allow others if required unavailable
  }
});

// Route to specific regions
const euResponse = await router.complete({
  model: 'openrouter/auto',
  prompt: "Process this EU customer data",
  providers: {
    dataResidency: 'eu',  // Use EU-based providers only
    prefer: ['mistralai']  // French provider
  }
});
```

### Transforms (Response Optimization)

```javascript
const router = new APILoader({
  provider: 'openrouter',
  transforms: [
    'cache',      // Cache identical requests
    'minify',     // Remove unnecessary whitespace
    'compress',   // Compress large responses
    'stream',     // Enable streaming automatically
    'sanitize'    // Remove potentially harmful content
  ]
});

// Compression for large responses
const response = await router.complete({
  model: 'openrouter/auto',
  prompt: longPrompt,
  transforms: ['compress'],
  maxTokens: 4000
});

// Response will be automatically decompressed
console.log(response.text);
console.log(`Compression saved: ${response.compressionSaved} bytes`);
```

## Code Examples

### Auto Model Selection

```javascript
import { APILoader } from 'llm-runner-router';

const router = new APILoader({
  provider: 'openrouter',
  model: 'openrouter/auto'
});

// Simple auto-routing
const response = await router.complete({
  prompt: "Write a Python function for binary search",
  maxTokens: 200
});

console.log(`Model selected: ${response.metadata.model}`);
console.log(`Selection reason: ${response.metadata.reason}`);
console.log(response.text);
```

### Provider Preferences

```javascript
// Prefer open-source models
const openSourceRouter = new APILoader({
  provider: 'openrouter',
  preferences: {
    models: {
      prefer: [
        'meta-llama/llama-3-70b',
        'mistralai/mixtral-8x7b',
        'nous/hermes-2-mixtral'
      ]
    }
  }
});

const response = await openSourceRouter.complete({
  prompt: "Explain Docker containers",
  preferOpenSource: true,
  maxTokens: 300
});
```

### Cost-Based Routing

```javascript
class BudgetRouter {
  constructor(monthlyBudget) {
    this.router = new APILoader({ provider: 'openrouter' });
    this.monthlyBudget = monthlyBudget;
    this.currentSpend = 0;
    this.resetDate = new Date();
  }
  
  async complete(prompt, options = {}) {
    const remainingBudget = this.monthlyBudget - this.currentSpend;
    const maxCostPerRequest = remainingBudget * 0.01;  // Use max 1% per request
    
    const response = await this.router.complete({
      model: 'openrouter/auto',
      prompt: prompt,
      maxTokens: options.maxTokens || 500,
      constraints: {
        maxCost: maxCostPerRequest,
        minQuality: options.minQuality || 0.7
      }
    });
    
    this.currentSpend += response.cost;
    
    console.log(`Budget status: $${this.currentSpend}/$${this.monthlyBudget}`);
    
    return response;
  }
  
  getBudgetStatus() {
    return {
      spent: this.currentSpend,
      remaining: this.monthlyBudget - this.currentSpend,
      percentage: (this.currentSpend / this.monthlyBudget) * 100
    };
  }
}

const budgetRouter = new BudgetRouter(100);  // $100/month budget
const response = await budgetRouter.complete("Generate a business plan outline");
```

### Model Discovery

```javascript
class ModelExplorer {
  constructor() {
    this.router = new APILoader({ provider: 'openrouter' });
  }
  
  async findBestModelForTask(taskType) {
    const models = await this.router.listModels();
    
    const taskRequirements = {
      'code-generation': {
        capabilities: ['codeGeneration'],
        minScore: 0.8,
        preferredProviders: ['openai', 'anthropic']
      },
      'creative-writing': {
        capabilities: ['creative'],
        minScore: 0.75,
        preferredProviders: ['anthropic', 'cohere']
      },
      'data-analysis': {
        capabilities: ['analysis', 'structured'],
        minScore: 0.85,
        minContext: 32000
      },
      'translation': {
        capabilities: ['multilingual'],
        minScore: 0.8,
        preferredProviders: ['google', 'anthropic']
      },
      'vision': {
        capabilities: ['vision'],
        minScore: 0.8
      }
    };
    
    const req = taskRequirements[taskType];
    if (!req) throw new Error(`Unknown task type: ${taskType}`);
    
    const suitable = models.filter(m => {
      const hasCapabilities = req.capabilities.every(
        cap => m.capabilities?.[cap]
      );
      const meetsScore = m.qualityScore >= req.minScore;
      const meetsContext = !req.minContext || m.contextLength >= req.minContext;
      const preferredProvider = !req.preferredProviders || 
        req.preferredProviders.some(p => m.id.includes(p));
      
      return hasCapabilities && meetsScore && meetsContext;
    });
    
    // Sort by preference
    suitable.sort((a, b) => {
      // Prefer specified providers
      if (req.preferredProviders) {
        const aPreferred = req.preferredProviders.some(p => a.id.includes(p));
        const bPreferred = req.preferredProviders.some(p => b.id.includes(p));
        if (aPreferred && !bPreferred) return -1;
        if (!aPreferred && bPreferred) return 1;
      }
      
      // Then by quality score
      return b.qualityScore - a.qualityScore;
    });
    
    return suitable[0];
  }
  
  async compareModels(prompt, modelIds) {
    const results = [];
    
    for (const modelId of modelIds) {
      const startTime = Date.now();
      
      try {
        const response = await this.router.complete({
          model: modelId,
          prompt: prompt,
          maxTokens: 200,
          temperature: 0.7
        });
        
        results.push({
          model: modelId,
          response: response.text,
          latency: Date.now() - startTime,
          cost: response.cost,
          tokensPerSecond: response.usage.totalTokens / ((Date.now() - startTime) / 1000)
        });
      } catch (error) {
        results.push({
          model: modelId,
          error: error.message
        });
      }
    }
    
    return results;
  }
}

// Usage
const explorer = new ModelExplorer();

// Find best model for specific task
const codeModel = await explorer.findBestModelForTask('code-generation');
console.log(`Best code model: ${codeModel.id}`);

// Compare multiple models
const comparison = await explorer.compareModels(
  "Explain the theory of relativity in simple terms",
  ['openai/gpt-4-turbo', 'anthropic/claude-3-opus', 'google/gemini-pro-1.5']
);

console.table(comparison);
```

### Fallback Handling

```javascript
class ReliableRouter {
  constructor() {
    this.router = new APILoader({
      provider: 'openrouter',
      retryOptions: {
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2
      }
    });
    
    this.fallbackChain = [
      { model: 'anthropic/claude-3-opus', maxCost: 0.10 },
      { model: 'openai/gpt-4-turbo', maxCost: 0.08 },
      { model: 'google/gemini-pro-1.5', maxCost: 0.05 },
      { model: 'mistralai/mistral-large', maxCost: 0.04 },
      { model: 'meta-llama/llama-3-70b', maxCost: 0.02 },
      { model: 'openrouter/auto', maxCost: 0.01 }
    ];
  }
  
  async completeWithFallback(prompt, options = {}) {
    let lastError;
    
    for (const config of this.fallbackChain) {
      try {
        console.log(`Trying model: ${config.model}`);
        
        const response = await this.router.complete({
          model: config.model,
          prompt: prompt,
          maxTokens: options.maxTokens || 500,
          maxCost: config.maxCost,
          timeout: 30000  // 30 second timeout
        });
        
        console.log(`Success with ${config.model}`);
        return response;
        
      } catch (error) {
        console.log(`Failed with ${config.model}: ${error.message}`);
        lastError = error;
        
        // Don't continue for client errors
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }
      }
    }
    
    throw new Error(`All models failed. Last error: ${lastError.message}`);
  }
}

const reliable = new ReliableRouter();
const response = await reliable.completeWithFallback(
  "Generate a complex technical explanation"
);
```

## Best Practices

### Model Selection Strategy

```javascript
class StrategyRouter {
  constructor() {
    this.router = new APILoader({ provider: 'openrouter' });
    this.strategies = {
      qualityFirst: (models) => models.sort((a, b) => b.qualityScore - a.qualityScore)[0],
      costOptimized: (models) => models.sort((a, b) => a.pricing.prompt - b.pricing.prompt)[0],
      speedPriority: (models) => models.sort((a, b) => a.avgLatency - b.avgLatency)[0],
      balanced: (models) => {
        // Score each model
        return models.map(m => ({
          ...m,
          score: (m.qualityScore * 0.4) + ((1 / m.pricing.prompt) * 0.3) + ((1 / m.avgLatency) * 0.3)
        })).sort((a, b) => b.score - a.score)[0];
      }
    };
  }
  
  async route(prompt, strategy = 'balanced') {
    const models = await this.router.listModels();
    const selectedModel = this.strategies[strategy](models);
    
    return await this.router.complete({
      model: selectedModel.id,
      prompt: prompt,
      maxTokens: 500
    });
  }
}
```

### Cost Tracking

```javascript
class CostTracker {
  constructor() {
    this.router = new APILoader({ provider: 'openrouter' });
    this.costs = {
      total: 0,
      byModel: {},
      byDay: {},
      byTask: {}
    };
  }
  
  async complete(prompt, taskType = 'general') {
    const response = await this.router.complete({
      model: 'openrouter/auto',
      prompt: prompt,
      maxTokens: 500
    });
    
    const today = new Date().toISOString().split('T')[0];
    
    // Track costs
    this.costs.total += response.cost;
    this.costs.byModel[response.model] = (this.costs.byModel[response.model] || 0) + response.cost;
    this.costs.byDay[today] = (this.costs.byDay[today] || 0) + response.cost;
    this.costs.byTask[taskType] = (this.costs.byTask[taskType] || 0) + response.cost;
    
    return response;
  }
  
  getReport() {
    return {
      total: `$${this.costs.total.toFixed(4)}`,
      topModels: Object.entries(this.costs.byModel)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([model, cost]) => ({ model, cost: `$${cost.toFixed(4)}` })),
      dailyAverage: `$${(this.costs.total / Object.keys(this.costs.byDay).length).toFixed(4)}`,
      byTask: Object.entries(this.costs.byTask)
        .map(([task, cost]) => ({ task, cost: `$${cost.toFixed(4)}` }))
    };
  }
}
```

### Performance Monitoring

```javascript
class PerformanceMonitor {
  constructor() {
    this.router = new APILoader({ provider: 'openrouter' });
    this.metrics = [];
  }
  
  async complete(prompt, options = {}) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    try {
      const response = await this.router.complete({
        model: options.model || 'openrouter/auto',
        prompt: prompt,
        maxTokens: options.maxTokens || 500
      });
      
      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;
      
      const metric = {
        timestamp: new Date(),
        model: response.model,
        latency: endTime - startTime,
        tokensPerSecond: response.usage.totalTokens / ((endTime - startTime) / 1000),
        memoryUsed: endMemory - startMemory,
        cost: response.cost,
        success: true
      };
      
      this.metrics.push(metric);
      
      // Alert on performance issues
      if (metric.latency > 10000) {
        console.warn(`High latency detected: ${metric.latency}ms for ${metric.model}`);
      }
      
      return response;
      
    } catch (error) {
      this.metrics.push({
        timestamp: new Date(),
        model: options.model || 'unknown',
        error: error.message,
        success: false
      });
      
      throw error;
    }
  }
  
  getPerformanceReport() {
    const successful = this.metrics.filter(m => m.success);
    
    return {
      totalRequests: this.metrics.length,
      successRate: (successful.length / this.metrics.length) * 100,
      avgLatency: successful.reduce((sum, m) => sum + m.latency, 0) / successful.length,
      avgTokensPerSecond: successful.reduce((sum, m) => sum + m.tokensPerSecond, 0) / successful.length,
      totalCost: successful.reduce((sum, m) => sum + m.cost, 0),
      modelPerformance: this.getModelPerformance()
    };
  }
  
  getModelPerformance() {
    const byModel = {};
    
    for (const metric of this.metrics.filter(m => m.success)) {
      if (!byModel[metric.model]) {
        byModel[metric.model] = {
          count: 0,
          totalLatency: 0,
          totalCost: 0,
          totalTokensPerSecond: 0
        };
      }
      
      byModel[metric.model].count++;
      byModel[metric.model].totalLatency += metric.latency;
      byModel[metric.model].totalCost += metric.cost;
      byModel[metric.model].totalTokensPerSecond += metric.tokensPerSecond;
    }
    
    return Object.entries(byModel).map(([model, stats]) => ({
      model,
      requests: stats.count,
      avgLatency: stats.totalLatency / stats.count,
      avgTokensPerSecond: stats.totalTokensPerSecond / stats.count,
      totalCost: stats.totalCost
    }));
  }
}
```

## Troubleshooting

### Common Issues

#### Issue: Model Not Available
```javascript
// Solution: Check model availability first
const models = await router.listModels();
const modelExists = models.some(m => m.id === 'desired/model');

if (!modelExists) {
  console.log('Model not available, using auto selection');
  response = await router.complete({
    model: 'openrouter/auto',
    prompt: prompt
  });
}
```

#### Issue: Rate Limiting Across Providers
```javascript
// Solution: Implement provider-aware rate limiting
class ProviderRateLimiter {
  constructor() {
    this.limits = {
      'openai': { rpm: 60, current: 0 },
      'anthropic': { rpm: 50, current: 0 },
      'google': { rpm: 60, current: 0 }
    };
  }
  
  async waitIfNeeded(modelId) {
    const provider = modelId.split('/')[0];
    const limit = this.limits[provider];
    
    if (limit && limit.current >= limit.rpm) {
      const waitTime = 60000 / limit.rpm;
      await sleep(waitTime);
      limit.current = 0;
    }
    
    if (limit) limit.current++;
  }
}
```

#### Issue: Cost Overruns
```javascript
// Solution: Implement hard cost limits
class CostLimiter {
  constructor(limits) {
    this.limits = limits;  // { daily: 10, weekly: 50, monthly: 150 }
    this.usage = { daily: 0, weekly: 0, monthly: 0 };
    this.resetTimes = {
      daily: Date.now() + 86400000,
      weekly: Date.now() + 604800000,
      monthly: Date.now() + 2592000000
    };
  }
  
  checkLimits() {
    const now = Date.now();
    
    // Reset counters if needed
    Object.keys(this.resetTimes).forEach(period => {
      if (now > this.resetTimes[period]) {
        this.usage[period] = 0;
        this.resetTimes[period] = now + (period === 'daily' ? 86400000 : 
                                         period === 'weekly' ? 604800000 : 2592000000);
      }
    });
    
    // Check limits
    for (const period of Object.keys(this.limits)) {
      if (this.usage[period] >= this.limits[period]) {
        throw new Error(`${period} cost limit exceeded: $${this.usage[period]}/$${this.limits[period]}`);
      }
    }
  }
  
  addUsage(cost) {
    Object.keys(this.usage).forEach(period => {
      this.usage[period] += cost;
    });
  }
}
```

## Resources

- 📖 [OpenRouter Documentation](https://openrouter.ai/docs)
- 💰 [Model Pricing](https://openrouter.ai/models)
- 🔑 [API Keys](https://openrouter.ai/keys)
- 📊 [Usage Dashboard](https://openrouter.ai/activity)
- 🎮 [Model Playground](https://openrouter.ai/playground)
- 📚 [Model Directory](https://openrouter.ai/models)
- 🛠️ [API Reference](https://openrouter.ai/docs/api-reference)