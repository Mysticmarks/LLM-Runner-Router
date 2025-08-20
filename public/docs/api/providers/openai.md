# 🤖 OpenAI Provider Documentation

Complete guide to using OpenAI's GPT models (GPT-4, GPT-3.5) with LLM-Runner-Router.

## Quick Start

### Basic Setup

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['openai'],
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  }
});

// Generate with GPT-4
const response = await router.generate({
  model: 'gpt-4',
  prompt: 'Write a Python function to calculate fibonacci numbers',
  maxTokens: 200
});

console.log(response.text);
```

## Configuration

### Complete Configuration Options

```javascript
const router = new LLMRouter({
  providers: ['openai'],
  openai: {
    // Authentication
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORG_ID, // Optional
    
    // API Settings
    baseURL: 'https://api.openai.com/v1',
    timeout: 60000,
    maxRetries: 3,
    
    // Default Parameters
    defaults: {
      temperature: 0.7,
      maxTokens: 1000,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0
    }
  }
});
```

## Setup & Authentication

### API Key Configuration

#### Environment Variables (Recommended)
```bash
# Required
OPENAI_API_KEY=sk-...

# Optional
OPENAI_ORG_ID=org-...
OPENAI_API_BASE=https://api.openai.com/v1  # For Azure or custom endpoints
```

#### Programmatic Setup
```javascript
import { APILoader } from 'llm-runner-router';

const openai = new APILoader({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  organizationId: process.env.OPENAI_ORG_ID,
  baseURL: 'https://api.openai.com/v1',  // Optional custom endpoint
  defaultModel: 'gpt-4-turbo-preview'
});
```

#### Azure OpenAI Setup
```javascript
const azureOpenAI = new APILoader({
  provider: 'openai',
  apiKey: process.env.AZURE_OPENAI_KEY,
  baseURL: 'https://YOUR_RESOURCE.openai.azure.com',
  apiVersion: '2024-02-15-preview',
  deployment: 'your-deployment-name'
});
```

## Supported Models

### GPT-4 Family

| Model | Context Window | Input Cost | Output Cost | Best For |
|-------|---------------|------------|-------------|----------|
| `gpt-4-turbo-preview` | 128K | $0.01/1K | $0.03/1K | Latest features, large context |
| `gpt-4-turbo` | 128K | $0.01/1K | $0.03/1K | Production-ready GPT-4 |
| `gpt-4` | 8K | $0.03/1K | $0.06/1K | Complex reasoning |
| `gpt-4-32k` | 32K | $0.06/1K | $0.12/1K | Long documents |
| `gpt-4-vision-preview` | 128K | $0.01/1K | $0.03/1K | Image analysis |

### GPT-3.5 Family

| Model | Context Window | Input Cost | Output Cost | Best For |
|-------|---------------|------------|-------------|----------|
| `gpt-3.5-turbo` | 16K | $0.0005/1K | $0.0015/1K | Fast, cost-effective |
| `gpt-3.5-turbo-16k` | 16K | $0.003/1K | $0.004/1K | Longer contexts |
| `gpt-3.5-turbo-instruct` | 4K | $0.0015/1K | $0.002/1K | Completions (not chat) |

### Specialized Models

| Model | Purpose | Cost | Notes |
|-------|---------|------|-------|
| `text-embedding-3-small` | Embeddings | $0.00002/1K | 1536 dimensions |
| `text-embedding-3-large` | Embeddings | $0.00013/1K | 3072 dimensions |
| `dall-e-3` | Image Generation | $0.04-0.12/image | Various resolutions |
| `whisper-1` | Audio Transcription | $0.006/minute | Speech-to-text |
| `tts-1` | Text-to-Speech | $0.015/1K chars | Natural voices |

## Features

### Text Completion

#### Basic Completion
```javascript
const response = await openai.complete({
  model: 'gpt-4-turbo-preview',
  prompt: "Explain quantum computing",
  maxTokens: 200,
  temperature: 0.7,
  topP: 0.9,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0
});

console.log(response.text);
console.log(`Tokens used: ${response.usage.totalTokens}`);
console.log(`Cost: $${response.cost.toFixed(4)}`);
```

#### Chat Completion
```javascript
const response = await openai.chat({
  model: 'gpt-4-turbo-preview',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is TypeScript?' },
    { role: 'assistant', content: 'TypeScript is...' },
    { role: 'user', content: 'How do I install it?' }
  ],
  temperature: 0.7
});
```

### Function Calling

```javascript
const response = await openai.complete({
  model: 'gpt-4-turbo-preview',
  prompt: "What's the weather like in San Francisco?",
  functions: [
    {
      name: 'get_weather',
      description: 'Get the current weather in a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g. San Francisco, CA'
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit']
          }
        },
        required: ['location']
      }
    }
  ],
  functionCall: 'auto'  // or 'none' or specific function name
});

if (response.functionCall) {
  console.log('Function to call:', response.functionCall.name);
  console.log('Arguments:', response.functionCall.arguments);
  
  // Execute function and continue conversation
  const functionResult = await executeFunction(response.functionCall);
  
  const finalResponse = await openai.complete({
    model: 'gpt-4-turbo-preview',
    messages: [
      ...previousMessages,
      {
        role: 'function',
        name: response.functionCall.name,
        content: JSON.stringify(functionResult)
      }
    ]
  });
}
```

### Tool Use (Parallel Function Calling)

```javascript
const response = await openai.complete({
  model: 'gpt-4-turbo-preview',
  prompt: "What's the weather in NYC and LA?",
  tools: [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string' }
          }
        }
      }
    }
  ],
  toolChoice: 'auto'  // Let model decide when to use tools
});

// Handle multiple tool calls
if (response.toolCalls) {
  const toolResults = await Promise.all(
    response.toolCalls.map(call => executeToolFunction(call))
  );
  
  // Continue conversation with results
  const finalResponse = await openai.complete({
    messages: [
      ...previousMessages,
      ...toolResults.map(result => ({
        role: 'tool',
        toolCallId: result.id,
        content: JSON.stringify(result.output)
      }))
    ]
  });
}
```

### Vision Capabilities (GPT-4V)

```javascript
const response = await openai.complete({
  model: 'gpt-4-vision-preview',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'What do you see in this image?'
        },
        {
          type: 'image_url',
          image_url: {
            url: 'https://example.com/image.jpg',
            detail: 'high'  // 'low', 'high', or 'auto'
          }
        }
      ]
    }
  ],
  maxTokens: 300
});

// With base64 image
const response = await openai.complete({
  model: 'gpt-4-vision-preview',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Describe this chart'
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${base64Image}`
          }
        }
      ]
    }
  ]
});
```

### JSON Mode

```javascript
const response = await openai.complete({
  model: 'gpt-4-turbo-preview',
  prompt: "List 5 programming languages with their paradigms",
  responseFormat: { type: 'json_object' },
  systemPrompt: "You must respond with valid JSON.",
  maxTokens: 200
});

const data = JSON.parse(response.text);
console.log(data);
```

### Embeddings API

```javascript
const embeddings = await openai.createEmbedding({
  model: 'text-embedding-3-small',
  input: [
    "First text to embed",
    "Second text to embed"
  ],
  dimensions: 1536  // Optional: reduce dimensions for small model
});

console.log(embeddings.data[0].embedding);  // Float array
console.log(`Cost: $${embeddings.cost.toFixed(6)}`);
```

### Moderation API

```javascript
const moderation = await openai.moderate({
  input: "Text to check for policy violations"
});

if (moderation.results[0].flagged) {
  console.log('Content flagged:', moderation.results[0].categories);
}
```

### Streaming Responses

```javascript
const stream = await openai.streamCompletion({
  model: 'gpt-4-turbo-preview',
  prompt: "Write a story about a robot",
  maxTokens: 500,
  temperature: 0.8
});

// Process tokens as they arrive
for await (const chunk of stream) {
  process.stdout.write(chunk.text || '');
  
  // Access partial function calls if using functions
  if (chunk.functionCall) {
    console.log('Partial function:', chunk.functionCall);
  }
}

// Get final statistics
console.log(`\nTotal tokens: ${stream.usage.totalTokens}`);
console.log(`Cost: $${stream.cost.toFixed(4)}`);
```

## Code Examples

### Basic Completion
```javascript
import { APILoader } from 'llm-runner-router';

const openai = new APILoader({
  provider: 'openai',
  model: 'gpt-4-turbo-preview'
});

const response = await openai.complete({
  prompt: "Write a haiku about programming",
  maxTokens: 50,
  temperature: 0.9
});

console.log(response.text);
```

### Conversation with Memory
```javascript
class ConversationManager {
  constructor() {
    this.openai = new APILoader({ provider: 'openai' });
    this.messages = [];
  }
  
  async addUserMessage(content) {
    this.messages.push({ role: 'user', content });
    
    const response = await this.openai.chat({
      model: 'gpt-4-turbo-preview',
      messages: this.messages,
      maxTokens: 500
    });
    
    this.messages.push({
      role: 'assistant',
      content: response.text
    });
    
    return response.text;
  }
  
  clearHistory() {
    this.messages = [];
  }
  
  getHistory() {
    return this.messages;
  }
}

// Usage
const chat = new ConversationManager();
await chat.addUserMessage("What is React?");
await chat.addUserMessage("How do hooks work?");
```

### Error Handling
```javascript
import { APILoader, OpenAIError } from 'llm-runner-router';

const openai = new APILoader({ provider: 'openai' });

try {
  const response = await openai.complete({
    model: 'gpt-4',
    prompt: "Hello",
    maxTokens: 100
  });
} catch (error) {
  if (error instanceof OpenAIError) {
    switch (error.type) {
      case 'invalid_request_error':
        console.log('Invalid request:', error.message);
        break;
      case 'rate_limit_error':
        console.log(`Rate limited. Retry after ${error.retryAfter}s`);
        await sleep(error.retryAfter * 1000);
        // Retry request
        break;
      case 'quota_exceeded':
        console.log('Quota exceeded. Upgrade your plan.');
        break;
      case 'server_error':
        console.log('OpenAI server error. Retrying...');
        // Implement exponential backoff
        break;
      default:
        console.log('OpenAI error:', error.message);
    }
  }
}
```

## Best Practices

### Token Optimization

1. **Use appropriate models**: GPT-3.5 for simple tasks, GPT-4 for complex reasoning
2. **Optimize prompts**: Be concise but clear
3. **Set max tokens wisely**: Don't request more than needed
4. **Use temperature effectively**: Lower for factual, higher for creative
5. **Cache responses**: Avoid repeated identical requests

```javascript
// Token-optimized configuration
const openai = new APILoader({
  provider: 'openai',
  defaultModel: 'gpt-3.5-turbo',  // Start with cheaper model
  maxTokensDefault: 150,  // Reasonable default
  cache: {
    enabled: true,
    ttl: 3600,  // Cache for 1 hour
    maxSize: 100  // Cache up to 100 responses
  }
});
```

### Cost Management

```javascript
class CostManagedOpenAI {
  constructor(monthlyBudget) {
    this.openai = new APILoader({ provider: 'openai' });
    this.monthlyBudget = monthlyBudget;
    this.currentSpend = 0;
    this.resetDate = new Date();
  }
  
  async complete(options) {
    // Check budget
    if (this.currentSpend >= this.monthlyBudget) {
      throw new Error('Monthly budget exceeded');
    }
    
    // Use cheaper model if approaching limit
    if (this.currentSpend > this.monthlyBudget * 0.8) {
      options.model = 'gpt-3.5-turbo';
    }
    
    const response = await this.openai.complete(options);
    this.currentSpend += response.cost;
    
    return response;
  }
  
  getSpendStatus() {
    return {
      spent: this.currentSpend,
      budget: this.monthlyBudget,
      remaining: this.monthlyBudget - this.currentSpend,
      percentage: (this.currentSpend / this.monthlyBudget) * 100
    };
  }
}
```

### Rate Limit Handling

```javascript
class RateLimitedOpenAI {
  constructor() {
    this.openai = new APILoader({ provider: 'openai' });
    this.queue = [];
    this.processing = false;
    this.requestsPerMinute = 20;  // Tier-based limit
  }
  
  async complete(options) {
    return new Promise((resolve, reject) => {
      this.queue.push({ options, resolve, reject });
      this.processQueue();
    });
  }
  
  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    const delay = 60000 / this.requestsPerMinute;
    
    while (this.queue.length > 0) {
      const { options, resolve, reject } = this.queue.shift();
      
      try {
        const response = await this.openai.complete(options);
        resolve(response);
      } catch (error) {
        reject(error);
      }
      
      if (this.queue.length > 0) {
        await sleep(delay);
      }
    }
    
    this.processing = false;
  }
}
```

### Caching Strategies

```javascript
import { createHash } from 'crypto';

class CachedOpenAI {
  constructor() {
    this.openai = new APILoader({ provider: 'openai' });
    this.cache = new Map();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
  
  getCacheKey(options) {
    const normalized = {
      model: options.model,
      prompt: options.prompt,
      temperature: options.temperature,
      maxTokens: options.maxTokens
    };
    return createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }
  
  async complete(options) {
    const key = this.getCacheKey(options);
    
    // Check cache
    if (this.cache.has(key)) {
      this.cacheHits++;
      return this.cache.get(key);
    }
    
    // Make request
    this.cacheMisses++;
    const response = await this.openai.complete(options);
    
    // Cache response
    this.cache.set(key, response);
    
    // Implement LRU if needed
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    return response;
  }
  
  getCacheStats() {
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses),
      size: this.cache.size
    };
  }
}
```

## Migration Guide

### Migrating from OpenAI SDK

```javascript
// OpenAI SDK (old)
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: '...' });

const completion = await openai.chat.completions.create({
  messages: [{ role: 'user', content: 'Hello' }],
  model: 'gpt-4',
});

// LLM-Runner-Router (new)
import { APILoader } from 'llm-runner-router';
const openai = new APILoader({ provider: 'openai' });

const completion = await openai.chat({
  messages: [{ role: 'user', content: 'Hello' }],
  model: 'gpt-4',
});
```

### API Differences

| OpenAI SDK | LLM-Runner-Router | Notes |
|------------|-------------------|-------|
| `openai.chat.completions.create()` | `openai.chat()` | Simplified method |
| `openai.completions.create()` | `openai.complete()` | Unified interface |
| `openai.embeddings.create()` | `openai.createEmbedding()` | Consistent naming |
| `response.choices[0].message` | `response.text` | Direct access |
| Manual streaming | Built-in streaming | Automatic handling |

## Common Errors & Solutions

### Error: Invalid API Key
```javascript
// Solution: Verify API key format
if (!apiKey.startsWith('sk-')) {
  throw new Error('Invalid OpenAI API key format');
}
```

### Error: Context Length Exceeded
```javascript
// Solution: Use model with larger context or truncate
const response = await openai.complete({
  model: 'gpt-4-turbo-preview',  // 128K context
  prompt: truncateToTokenLimit(longPrompt, 120000),
  maxTokens: 8000
});
```

### Error: Rate Limit
```javascript
// Solution: Implement exponential backoff
async function retryWithBackoff(fn, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.type === 'rate_limit_error' && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
}
```

## Performance Tips

1. **Use streaming for long responses** - Better perceived performance
2. **Batch embeddings** - Process multiple texts in one call
3. **Implement caching** - Avoid redundant API calls
4. **Choose appropriate models** - Balance cost vs quality
5. **Optimize prompt length** - Shorter prompts = lower cost
6. **Use JSON mode** - For structured data extraction
7. **Set reasonable timeouts** - Fail fast on network issues
8. **Monitor usage** - Track tokens and costs
9. **Use function calling** - For structured interactions
10. **Implement retry logic** - Handle transient failures

## Resources

- 📖 [OpenAI API Documentation](https://platform.openai.com/docs)
- 💰 [OpenAI Pricing](https://openai.com/pricing)
- 🔑 [API Keys](https://platform.openai.com/api-keys)
- 📊 [Usage Dashboard](https://platform.openai.com/usage)
- 🎮 [OpenAI Playground](https://platform.openai.com/playground)
- 📚 [Model Documentation](https://platform.openai.com/docs/models)