# OpenRouter Adapter Reference

Complete reference for the OpenRouter adapter, providing access to 100+ models from multiple providers through a unified API.

## Overview

The OpenRouter adapter provides integration with OpenRouter's unified model access platform, giving you access to models from OpenAI, Anthropic, Google, Meta, Mistral, and many others through a single API.

## Configuration

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['openrouter'],
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1', // Optional
    appName: 'Your App Name', // Optional but recommended
    appUrl: 'https://yourapp.com', // Optional but recommended
    timeout: 60000, // Optional
    maxRetries: 3, // Optional
    rateLimit: {
      requestsPerMinute: 200,
      tokensPerMinute: 500000
    }
  }
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | **Required** | OpenRouter API key |
| `baseURL` | string | `https://openrouter.ai/api/v1` | API base URL |
| `appName` | string | `null` | Your app name (helps with model access) |
| `appUrl` | string | `null` | Your app URL (helps with model access) |
| `timeout` | number | `60000` | Request timeout in milliseconds |
| `maxRetries` | number | `3` | Maximum retry attempts |
| `rateLimit` | object | See below | Rate limiting configuration |

### Rate Limiting Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `requestsPerMinute` | number | `200` | Max requests per minute |
| `tokensPerMinute` | number | `500000` | Max tokens per minute |
| `requestsPerDay` | number | `14400` | Max requests per day |
| `tokensPerDay` | number | `50000000` | Max tokens per day |

## Supported Models

### OpenAI Models (via OpenRouter)

```javascript
// GPT-4 Turbo
await router.generate({
  model: 'openai/gpt-4-turbo-preview',
  prompt: 'Your prompt here',
  maxTokens: 4096
});

// GPT-3.5 Turbo
await router.generate({
  model: 'openai/gpt-3.5-turbo',
  prompt: 'Your prompt here',
  maxTokens: 1000
});
```

### Anthropic Models (via OpenRouter)

```javascript
// Claude 3 Opus
await router.generate({
  model: 'anthropic/claude-3-opus',
  prompt: 'Your prompt here',
  maxTokens: 4000
});

// Claude 3 Sonnet
await router.generate({
  model: 'anthropic/claude-3-sonnet',
  prompt: 'Your prompt here',
  maxTokens: 2000
});
```

### Google Models

```javascript
// Gemini Pro
await router.generate({
  model: 'google/gemini-pro',
  prompt: 'Your prompt here',
  maxTokens: 2048
});

// PaLM 2
await router.generate({
  model: 'google/palm-2-chat-bison',
  prompt: 'Your prompt here',
  maxTokens: 1024
});
```

### Meta Models

```javascript
// Llama 2 70B
await router.generate({
  model: 'meta-llama/llama-2-70b-chat',
  prompt: 'Your prompt here',
  maxTokens: 4096
});

// Code Llama 34B
await router.generate({
  model: 'meta-llama/codellama-34b-instruct',
  prompt: 'Your prompt here',
  maxTokens: 2048
});
```

### Mistral Models

```javascript
// Mixtral 8x7B
await router.generate({
  model: 'mistralai/mixtral-8x7b-instruct',
  prompt: 'Your prompt here',
  maxTokens: 32768
});

// Mistral 7B
await router.generate({
  model: 'mistralai/mistral-7b-instruct',
  prompt: 'Your prompt here',
  maxTokens: 8192
});
```

### Model Categories Overview

| Provider | Models Available | Best For |
|----------|------------------|----------|
| OpenAI | GPT-4, GPT-3.5 | General purpose, high quality |
| Anthropic | Claude 3 series | Safety, analysis, coding |
| Google | Gemini, PaLM | Multimodal, reasoning |
| Meta | Llama 2, Code Llama | Open source, coding |
| Mistral | Mixtral, Mistral | European, multilingual |
| Cohere | Command models | Enterprise, search |
| AI21 | Jurassic models | Writing, content |

## Basic Usage

### Simple Generation

```javascript
const response = await router.generate({
  model: 'openai/gpt-3.5-turbo',
  prompt: 'Explain quantum physics in simple terms',
  temperature: 0.7,
  maxTokens: 300
});

console.log(response.text);
```

### Chat Format

```javascript
const response = await router.generate({
  model: 'anthropic/claude-3-sonnet',
  messages: [
    { role: 'system', content: 'You are a helpful research assistant.' },
    { role: 'user', content: 'What are the latest developments in AI?' }
  ],
  maxTokens: 500
});
```

### Streaming Responses

```javascript
const stream = await router.generateStream({
  model: 'meta-llama/llama-2-70b-chat',
  prompt: 'Write a short story about space exploration',
  maxTokens: 800
});

for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}
```

## Advanced Features

### Model Discovery and Selection

```javascript
// Get available models
const models = await router.getAvailableModels('openrouter');

// Filter models by criteria
const codingModels = models.filter(model => 
  model.name.includes('code') || 
  model.description.toLowerCase().includes('coding')
);

// Select model based on requirements
function selectOptimalModel(taskType, maxCost, contextNeeded) {
  const candidates = models.filter(model => {
    return model.pricing.prompt <= maxCost &&
           model.context_length >= contextNeeded;
  });
  
  if (taskType === 'coding') {
    return candidates.find(m => m.name.includes('code')) || candidates[0];
  }
  
  if (taskType === 'analysis') {
    return candidates.find(m => m.name.includes('claude')) || candidates[0];
  }
  
  return candidates[0];
}
```

### Multi-Model Ensemble

```javascript
// Use multiple models for better results
async function ensembleGenerate(prompt, models) {
  const responses = await Promise.all(
    models.map(model =>
      router.generate({
        model,
        prompt,
        maxTokens: 200,
        temperature: 0.3
      })
    )
  );
  
  // Combine or select best response
  return selectBestResponse(responses);
}

// Usage
const result = await ensembleGenerate(
  'Analyze this business plan',
  [
    'openai/gpt-4-turbo-preview',
    'anthropic/claude-3-opus',
    'google/gemini-pro'
  ]
);
```

### Cost-Aware Routing

```javascript
class CostAwareRouter {
  constructor() {
    this.modelPricing = new Map();
    this.budgetUsed = 0;
    this.dailyBudget = 10.00; // $10 daily budget
  }
  
  async smartGenerate(prompt, quality = 'medium') {
    const model = this.selectByBudget(quality);
    
    const response = await router.generate({
      model,
      prompt,
      maxTokens: 500
    });
    
    this.trackCost(model, response.usage);
    return response;
  }
  
  selectByBudget(quality) {
    const remainingBudget = this.dailyBudget - this.budgetUsed;
    
    if (remainingBudget > 1.00) {
      // Can afford premium models
      return quality === 'high' ? 'openai/gpt-4-turbo-preview' : 'anthropic/claude-3-sonnet';
    } else if (remainingBudget > 0.10) {
      // Medium cost models
      return 'openai/gpt-3.5-turbo';
    } else {
      // Budget models only
      return 'meta-llama/llama-2-7b-chat';
    }
  }
  
  trackCost(model, usage) {
    // Calculate and track actual costs
    const cost = this.calculateCost(model, usage);
    this.budgetUsed += cost;
  }
}
```

### Provider Failover

```javascript
// Automatic failover between providers
async function resilientGenerate(prompt, maxRetries = 3) {
  const modelFallbacks = [
    'openai/gpt-4-turbo-preview',
    'anthropic/claude-3-sonnet',
    'google/gemini-pro',
    'meta-llama/llama-2-70b-chat',
    'mistralai/mixtral-8x7b-instruct'
  ];
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (const model of modelFallbacks) {
      try {
        return await router.generate({
          model,
          prompt,
          maxTokens: 500,
          timeout: 30000
        });
      } catch (error) {
        console.log(`${model} failed:`, error.message);
        
        if (error.status === 429) {
          // Rate limited, try next model
          continue;
        }
        
        if (error.status >= 500) {
          // Server error, try next model
          continue;
        }
        
        // Client error, might be model-specific
        continue;
      }
    }
    
    // All models failed, wait before retry
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
  
  throw new Error('All models failed after maximum retries');
}
```

## Model-Specific Features

### OpenAI Models via OpenRouter

```javascript
// Function calling with GPT models
const response = await router.generate({
  model: 'openai/gpt-4-turbo-preview',
  messages: [
    { role: 'user', content: 'What\'s the weather in Tokyo?' }
  ],
  tools: [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get weather information',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string' }
          }
        }
      }
    }
  ]
});
```

### Anthropic Models via OpenRouter

```javascript
// Claude with system prompts
const response = await router.generate({
  model: 'anthropic/claude-3-opus',
  system: 'You are Claude, a helpful AI assistant created by Anthropic.',
  messages: [
    { role: 'user', content: 'Help me write a business proposal' }
  ],
  maxTokens: 2000
});
```

### Google Models

```javascript
// Gemini with multimodal input
const response = await router.generate({
  model: 'google/gemini-pro-vision',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this image' },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/image.jpg' }
        }
      ]
    }
  ]
});
```

## Error Handling

### OpenRouter-Specific Errors

```javascript
try {
  const response = await router.generate({
    model: 'openai/gpt-4',
    prompt: 'Your prompt'
  });
} catch (error) {
  switch (error.status) {
    case 400:
      console.error('Invalid request format');
      break;
    case 401:
      console.error('Invalid OpenRouter API key');
      break;
    case 402:
      console.error('Insufficient credits');
      break;
    case 429:
      console.error('Rate limit exceeded for model');
      break;
    case 502:
      console.error('Model provider unavailable');
      break;
    case 503:
      console.error('Model overloaded');
      break;
    default:
      console.error('OpenRouter error:', error.message);
  }
}
```

### Credit Management

```javascript
class OpenRouterCreditManager {
  constructor() {
    this.creditBalance = 0;
    this.dailySpend = 0;
    this.spendLimit = 5.00; // $5 daily limit
  }
  
  async checkCredits() {
    try {
      const balance = await router.getCreditBalance('openrouter');
      this.creditBalance = balance;
      return balance;
    } catch (error) {
      console.error('Failed to check credits:', error);
      return null;
    }
  }
  
  async safeGenerate(request) {
    // Check credits before expensive operations
    if (this.creditBalance < 0.10) {
      throw new Error('Insufficient credits for request');
    }
    
    if (this.dailySpend >= this.spendLimit) {
      throw new Error('Daily spend limit reached');
    }
    
    const response = await router.generate(request);
    
    // Track spending
    const cost = this.estimateCost(request.model, response.usage);
    this.dailySpend += cost;
    this.creditBalance -= cost;
    
    return response;
  }
  
  estimateCost(model, usage) {
    // Rough cost estimation
    const pricing = {
      'openai/gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
      'openai/gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'anthropic/claude-3-opus': { input: 0.015, output: 0.075 }
    };
    
    const modelPricing = pricing[model] || { input: 0.001, output: 0.002 };
    
    return ((usage.promptTokens || 0) / 1000) * modelPricing.input +
           ((usage.completionTokens || 0) / 1000) * modelPricing.output;
  }
}
```

## Rate Limiting and Optimization

### Intelligent Rate Management

```javascript
class OpenRouterRateManager {
  constructor() {
    this.modelQueues = new Map();
    this.globalQueue = [];
    this.processing = false;
  }
  
  async queueRequest(model, request) {
    return new Promise((resolve, reject) => {
      if (!this.modelQueues.has(model)) {
        this.modelQueues.set(model, []);
      }
      
      this.modelQueues.get(model).push({ request, resolve, reject });
      this.processQueues();
    });
  }
  
  async processQueues() {
    if (this.processing) return;
    this.processing = true;
    
    while (this.hasQueuedRequests()) {
      // Process different models in round-robin fashion
      for (const [model, queue] of this.modelQueues) {
        if (queue.length === 0) continue;
        
        const { request, resolve, reject } = queue.shift();
        
        try {
          const response = await router.generate({
            ...request,
            model
          });
          resolve(response);
        } catch (error) {
          if (error.status === 429) {
            // Rate limited, put back in queue
            queue.unshift({ request, resolve, reject });
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          reject(error);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    this.processing = false;
  }
  
  hasQueuedRequests() {
    return Array.from(this.modelQueues.values()).some(queue => queue.length > 0);
  }
}
```

### Cost Optimization

```javascript
// Smart model selection based on task and budget
function optimizeForCost(prompt, maxCost = 0.01) {
  const modelsByValue = [
    { model: 'meta-llama/llama-2-7b-chat', cost: 0.0002, quality: 6 },
    { model: 'mistralai/mistral-7b-instruct', cost: 0.0005, quality: 7 },
    { model: 'openai/gpt-3.5-turbo', cost: 0.002, quality: 8 },
    { model: 'anthropic/claude-3-sonnet', cost: 0.015, quality: 9 },
    { model: 'openai/gpt-4-turbo-preview', cost: 0.03, quality: 10 }
  ].filter(m => m.cost <= maxCost);
  
  // Return highest quality model within budget
  return modelsByValue.sort((a, b) => b.quality - a.quality)[0]?.model;
}

// Use optimization
const response = await router.generate({
  model: optimizeForCost(prompt, 0.005),
  prompt,
  maxTokens: 200
});
```

## Monitoring and Analytics

### Usage Analytics

```javascript
class OpenRouterAnalytics {
  constructor() {
    this.usage = {
      requests: 0,
      totalCost: 0,
      modelUsage: new Map(),
      errors: new Map(),
      latencies: []
    };
  }
  
  trackRequest(model, usage, cost, latency, error = null) {
    this.usage.requests++;
    this.usage.totalCost += cost;
    this.usage.latencies.push(latency);
    
    // Track per-model usage
    if (!this.usage.modelUsage.has(model)) {
      this.usage.modelUsage.set(model, {
        requests: 0,
        cost: 0,
        tokens: 0
      });
    }
    
    const modelStats = this.usage.modelUsage.get(model);
    modelStats.requests++;
    modelStats.cost += cost;
    modelStats.tokens += usage.totalTokens || 0;
    
    // Track errors
    if (error) {
      if (!this.usage.errors.has(model)) {
        this.usage.errors.set(model, 0);
      }
      this.usage.errors.set(model, this.usage.errors.get(model) + 1);
    }
  }
  
  getReport() {
    const avgLatency = this.usage.latencies.reduce((a, b) => a + b, 0) / this.usage.latencies.length;
    
    const modelReports = {};
    for (const [model, stats] of this.usage.modelUsage) {
      const errors = this.usage.errors.get(model) || 0;
      modelReports[model] = {
        ...stats,
        errorRate: errors / stats.requests,
        avgCostPerRequest: stats.cost / stats.requests
      };
    }
    
    return {
      overall: {
        totalRequests: this.usage.requests,
        totalCost: this.usage.totalCost,
        avgLatency,
        avgCostPerRequest: this.usage.totalCost / this.usage.requests
      },
      models: modelReports
    };
  }
}
```

## Best Practices

### 1. Model Selection Strategy

```javascript
// Choose models based on task requirements
const MODEL_RECOMMENDATIONS = {
  'creative-writing': ['openai/gpt-4-turbo-preview', 'anthropic/claude-3-opus'],
  'code-generation': ['openai/gpt-4-turbo-preview', 'meta-llama/codellama-34b-instruct'],
  'analysis': ['anthropic/claude-3-opus', 'openai/gpt-4-turbo-preview'],
  'translation': ['openai/gpt-4-turbo-preview', 'google/gemini-pro'],
  'summarization': ['anthropic/claude-3-sonnet', 'openai/gpt-3.5-turbo'],
  'conversation': ['openai/gpt-3.5-turbo', 'anthropic/claude-3-sonnet'],
  'math': ['openai/gpt-4-turbo-preview', 'google/gemini-pro']
};

function selectModelForTask(taskType, budget = 'medium') {
  const candidates = MODEL_RECOMMENDATIONS[taskType] || ['openai/gpt-3.5-turbo'];
  
  if (budget === 'low') {
    return 'meta-llama/llama-2-7b-chat';
  } else if (budget === 'high') {
    return candidates[0];
  } else {
    return candidates[1] || candidates[0];
  }
}
```

### 2. Fallback Chains

```javascript
// Implement robust fallback chains
const FALLBACK_CHAINS = {
  premium: [
    'openai/gpt-4-turbo-preview',
    'anthropic/claude-3-opus',
    'google/gemini-pro',
    'openai/gpt-3.5-turbo'
  ],
  balanced: [
    'anthropic/claude-3-sonnet',
    'openai/gpt-3.5-turbo',
    'mistralai/mixtral-8x7b-instruct',
    'meta-llama/llama-2-70b-chat'
  ],
  budget: [
    'openai/gpt-3.5-turbo',
    'meta-llama/llama-2-7b-chat',
    'mistralai/mistral-7b-instruct'
  ]
};
```

### 3. Context Management

```javascript
// Handle different context window sizes
function adaptToContextWindow(messages, model) {
  const contextLimits = {
    'openai/gpt-4-turbo-preview': 128000,
    'anthropic/claude-3-opus': 200000,
    'google/gemini-pro': 32000,
    'meta-llama/llama-2-70b-chat': 4096
  };
  
  const limit = contextLimits[model] || 4096;
  return truncateMessages(messages, limit);
}
```

---

**Next:** [Custom Adapter](./custom.md) | **Back to:** [Reference Overview](../README.md)