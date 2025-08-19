# 🌐 API Providers Guide

Complete guide for using cloud-based LLM APIs with LLM-Runner-Router.

## 📑 Table of Contents

- [Overview](#overview)
- [Supported Providers](#supported-providers)
- [Quick Start](#quick-start)
- [Provider Details](#provider-details)
  - [OpenAI](#openai)
  - [Anthropic](#anthropic)
  - [OpenRouter](#openrouter)
  - [Groq](#groq)
- [Advanced Features](#advanced-features)
- [Cost Optimization](#cost-optimization)
- [Best Practices](#best-practices)

## Overview

LLM-Runner-Router now supports major cloud AI providers alongside local models, offering:

- **Unified Interface**: Same API for local and cloud models
- **Automatic Routing**: Intelligent model selection based on requirements
- **Cost Tracking**: Real-time cost monitoring and optimization
- **Streaming Support**: Full streaming capabilities for all providers
- **Fallback Chains**: Automatic failover between providers
- **Rate Limiting**: Built-in rate limit handling with retry logic

## Supported Providers

| Provider | Models | Streaming | Function Calling | Vision | Speed |
|----------|--------|-----------|------------------|--------|-------|
| **OpenAI** | GPT-4, GPT-3.5 | ✅ | ✅ | ✅ | Medium |
| **Anthropic** | Claude 3 (Opus, Sonnet, Haiku) | ✅ | ❌ | ✅ | Medium |
| **OpenRouter** | 100+ models | ✅ | ✅ | ✅ | Varies |
| **Groq** | Llama, Mixtral, Gemma | ✅ | ❌ | ❌ | Ultra-fast |

## Quick Start

### 1. Install Dependencies

```bash
npm install llm-runner-router dotenv
```

### 2. Set API Keys

Create a `.env` file:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...
GROQ_API_KEY=gsk_...
```

### 3. Basic Usage

```javascript
import { APILoader } from 'llm-runner-router/loaders';

// Simple API usage
const loader = new APILoader({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY
});

const model = await loader.load('gpt-3.5-turbo');
const response = await loader.generate('Hello, AI!');
console.log(response.text);
```

## Provider Details

### OpenAI

**Models**: GPT-4 Turbo, GPT-4, GPT-3.5 Turbo

```javascript
import { OpenAIAdapter } from 'llm-runner-router/adapters';

const openai = new OpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  organization: 'org-...' // Optional
});

// Load model
await openai.load('gpt-4-turbo-preview');

// Basic completion
const response = await openai.complete('Explain quantum physics', {
  temperature: 0.7,
  maxTokens: 500
});

// Function calling
const functionResponse = await openai.complete('What is the weather?', {
  functions: [{
    name: 'get_weather',
    description: 'Get current weather',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string' }
      }
    }
  }]
});

// Streaming
const stream = await openai.complete('Write a story', {
  stream: true
});

for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}
```

**Features**:
- Function calling
- JSON mode
- Vision (GPT-4V)
- Embeddings
- Moderation

### Anthropic

**Models**: Claude 3 Opus, Sonnet, Haiku; Claude 2.1

```javascript
import { AnthropicAdapter } from 'llm-runner-router/adapters';

const anthropic = new AnthropicAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Load Claude 3
await anthropic.load('claude-3-opus-20240229');

// With system prompt
const response = await anthropic.complete('Explain AI safety', {
  system: 'You are an AI safety expert.',
  maxTokens: 1000
});

// Vision support
const visionMsg = anthropic.createVisionMessage(
  'What is in this image?',
  imageBase64Data
);

const visionResponse = await anthropic.complete('', {
  messages: [visionMsg]
});
```

**Features**:
- 200k context window
- Vision support (Claude 3)
- System prompts
- Stop sequences

### OpenRouter

**Models**: Access to 100+ models from all providers

```javascript
import { OpenRouterAdapter } from 'llm-runner-router/adapters';

const openrouter = new OpenRouterAdapter({
  apiKey: process.env.OPENROUTER_API_KEY,
  appName: 'MyApp'
});

// Auto mode - let OpenRouter choose
await openrouter.load('auto');

// Specific model
await openrouter.load('anthropic/claude-3-opus');

// With provider preferences
const response = await openrouter.complete('Hello', {
  providers: ['anthropic', 'openai'], // Preference order
  route: 'fallback' // Automatic fallback
});

// Get cheapest model
const cheapest = await openrouter.getCheapestModel({
  minContext: 8000
});

// Get recommendations
const models = await openrouter.getRecommendations('coding');
```

**Features**:
- Unified API for all providers
- Automatic routing
- Cost optimization
- Model discovery

### Groq

**Models**: Mixtral, Llama 3, Gemma

```javascript
import { GroqAdapter } from 'llm-runner-router/adapters';

const groq = new GroqAdapter({
  apiKey: process.env.GROQ_API_KEY
});

// Load ultra-fast model
await groq.load('mixtral-8x7b-32768');

// Speed-optimized generation
const response = await groq.complete('Generate code', {
  speedMode: true,
  maxTokens: 500
});

// Get performance stats
const stats = groq.getPerformanceStats();
console.log(`Average speed: ${stats.averageTokensPerSecond} tokens/sec`);
```

**Features**:
- Ultra-fast inference (100+ tokens/sec)
- Low latency
- Cost-effective
- LPU-optimized

## Advanced Features

### Multi-Provider Routing

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  strategy: 'balanced',
  providers: {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    groq: process.env.GROQ_API_KEY
  }
});

// Load multiple models
await router.load({ type: 'openai', modelId: 'gpt-4' });
await router.load({ type: 'anthropic', modelId: 'claude-3-opus' });
await router.load({ type: 'groq', modelId: 'mixtral-8x7b' });

// Router automatically selects best model
const response = await router.complete('Complex task...');
```

### Cost Tracking

```javascript
const loader = new APILoader({ provider: 'openai' });

// Generate with cost tracking
await loader.generate('Hello');

// Get cost statistics
const costs = loader.getCosts();
console.log(`Total cost: $${costs.totalCost.toFixed(4)}`);
console.log(`Input tokens: ${costs.inputTokens}`);
console.log(`Output tokens: ${costs.outputTokens}`);
```

### Rate Limiting & Retry

```javascript
const loader = new APILoader({
  provider: 'openai',
  maxRequests: 100, // Per minute
  maxRetries: 3,
  cacheTimeout: 3600000 // 1 hour cache
});

// Automatic retry on failure
const response = await loader.complete('Hello', {
  retries: 3,
  autoRetry: true
});
```

### Response Caching

```javascript
const loader = new APILoader({
  provider: 'openai',
  cacheTimeout: 3600000 // 1 hour
});

// First call - hits API
await loader.generate('What is 2+2?');

// Second call - returns cached response
await loader.generate('What is 2+2?'); // Instant, no API call
```

## Cost Optimization

### Strategy 1: Use Cheaper Models

```javascript
// Development: Use cheap, fast models
const dev = new APILoader({
  provider: 'groq',
  modelId: 'llama3-8b-8192' // $0.05 per 1M tokens
});

// Production: Use powerful models
const prod = new APILoader({
  provider: 'anthropic',
  modelId: 'claude-3-opus' // $15 per 1M tokens
});
```

### Strategy 2: Automatic Routing

```javascript
const router = new LLMRouter({
  strategy: 'cost-optimized'
});

// Router selects cheapest model that meets requirements
const response = await router.complete('Task', {
  minQuality: 0.8,
  maxCost: 0.001 // $0.001 per request
});
```

### Strategy 3: Caching

```javascript
// Cache common prompts
const loader = new APILoader({
  cacheTimeout: 86400000 // 24 hours
});

// Frequently asked questions cached
const faqs = [
  'What is your return policy?',
  'How do I reset my password?'
];

for (const question of faqs) {
  await loader.generate(question); // Cached for 24h
}
```

## Best Practices

### 1. Environment Variables

Always use environment variables for API keys:

```javascript
// ✅ Good
const apiKey = process.env.OPENAI_API_KEY;

// ❌ Bad
const apiKey = 'sk-...'; // Never hardcode
```

### 2. Error Handling

```javascript
try {
  const response = await loader.generate('Hello');
} catch (error) {
  if (error.message.includes('rate_limit')) {
    // Handle rate limiting
    await sleep(60000);
  } else if (error.message.includes('401')) {
    // Invalid API key
    console.error('Check your API key');
  } else {
    // Other errors
    console.error('API error:', error);
  }
}
```

### 3. Streaming for Long Responses

```javascript
// For long responses, use streaming
const stream = await loader.complete('Write a long article', {
  stream: true,
  maxTokens: 2000
});

for await (const chunk of stream) {
  // Process chunks as they arrive
  updateUI(chunk.text);
}
```

### 4. Model Selection

```javascript
// Choose model based on task
const modelMap = {
  'simple': 'gpt-3.5-turbo',      // Fast, cheap
  'complex': 'gpt-4',              // Powerful
  'creative': 'claude-3-opus',     // Creative writing
  'code': 'claude-3-sonnet',       // Code generation
  'fast': 'groq/mixtral-8x7b'      // Ultra-fast
};

const model = modelMap[taskType] || 'gpt-3.5-turbo';
```

### 5. Cost Monitoring

```javascript
class CostMonitor {
  constructor(budget = 10.00) {
    this.budget = budget;
    this.spent = 0;
  }
  
  async track(loader, prompt, options) {
    const response = await loader.generate(prompt, options);
    const costs = loader.getCosts();
    
    this.spent += costs.totalCost;
    
    if (this.spent > this.budget) {
      throw new Error(`Budget exceeded: $${this.spent.toFixed(2)}`);
    }
    
    return response;
  }
}
```

## Troubleshooting

### Common Issues

1. **Rate Limiting**
   ```javascript
   // Add automatic retry with backoff
   const response = await loader.complete(prompt, {
     autoRetry: true,
     maxRetries: 5
   });
   ```

2. **Timeout Errors**
   ```javascript
   // Increase timeout for long generations
   const loader = new APILoader({
     timeout: 120000 // 2 minutes
   });
   ```

3. **Cost Overruns**
   ```javascript
   // Set spending limits
   if (loader.getCosts().totalCost > 1.00) {
     console.warn('Spending limit reached');
     // Switch to cheaper model
   }
   ```

## Examples

See `/examples/api-providers-demo.js` for complete working examples.

## Support

- GitHub Issues: [Report bugs](https://github.com/MCERQUA/LLM-Runner-Router/issues)
- Documentation: [Full docs](https://github.com/MCERQUA/LLM-Runner-Router/docs)
- Email: echoaisystems@gmail.com