# 🚀 API Providers Quick Start Guide

Get up and running with API providers in LLM-Runner-Router in just 5 minutes!

## Installation

```bash
# Using npm
npm install llm-runner-router

# Using yarn
yarn add llm-runner-router

# Using pnpm
pnpm add llm-runner-router
```

## Setting Up API Keys

### Option 1: Environment Variables (Recommended)

Create a `.env` file in your project root:

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# OpenRouter
OPENROUTER_API_KEY=sk-or-...

# Groq
GROQ_API_KEY=gsk_...

# Optional: Organization IDs
OPENAI_ORG_ID=org-...
ANTHROPIC_VERSION=2023-06-01
```

### Option 2: Direct Configuration

```javascript
import { APILoader } from 'llm-runner-router';

const ai = new APILoader({
  provider: 'openai',
  apiKey: 'sk-...',  // Direct key (not recommended for production)
  organizationId: 'org-...'  // Optional
});
```

### Option 3: Secure Vault Integration

```javascript
import { getSecret } from 'your-vault-provider';

const ai = new APILoader({
  provider: 'openai',
  apiKey: await getSecret('openai-api-key'),
  secure: true  // Enables additional security features
});
```

## First API Call in 3 Steps

### Step 1: Import and Initialize

```javascript
import { APILoader } from 'llm-runner-router';

// Auto-detect provider from environment
const ai = new APILoader({ 
  provider: 'auto' 
});
```

### Step 2: Load a Model

```javascript
// Load a specific model
await ai.load('gpt-4-turbo-preview');

// Or let the router choose
await ai.load('auto');
```

### Step 3: Generate a Response

```javascript
const response = await ai.complete({
  prompt: "Write a haiku about coding",
  maxTokens: 50,
  temperature: 0.7
});

console.log(response.text);
// Output: "Fingers dance on keys,\nLogic flows through midnight oil,\nBugs bloom into features."
```

## Common Patterns

### 1. Simple Completion

```javascript
import { quick } from 'llm-runner-router';

// Simplest possible usage
const result = await quick("What is the capital of France?");
console.log(result); // "Paris"
```

### 2. Streaming Responses

```javascript
const ai = new APILoader({ provider: 'openai' });

const stream = await ai.streamCompletion({
  prompt: "Tell me a story about a robot",
  maxTokens: 200
});

for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

### 3. Multiple Providers with Fallback

```javascript
import LLMRouter from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['openai', 'anthropic', 'groq'],
  strategy: 'fallback',
  apiKeys: {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    groq: process.env.GROQ_API_KEY
  }
});

// Automatically falls back if primary provider fails
const response = await router.complete({
  prompt: "Explain REST APIs",
  preferredProvider: 'openai',
  fallbackProviders: ['anthropic', 'groq']
});
```

### 4. Cost-Conscious Usage

```javascript
const ai = new APILoader({
  provider: 'auto',
  maxCostPerRequest: 0.10,  // Max $0.10 per request
  trackCosts: true
});

const response = await ai.complete({
  prompt: "Summarize this article: ...",
  maxTokens: 150,
  costOptimized: true  // Uses cheapest suitable model
});

console.log(`Response cost: $${response.cost.toFixed(4)}`);
console.log(`Total session cost: $${ai.getTotalCost().toFixed(2)}`);
```

### 5. Conversation Management

```javascript
const ai = new APILoader({ provider: 'anthropic' });

// Initialize conversation
const conversation = ai.createConversation();

// Add messages
await conversation.addUserMessage("What is TypeScript?");
const response1 = await conversation.getAssistantResponse();

await conversation.addUserMessage("How does it differ from JavaScript?");
const response2 = await conversation.getAssistantResponse();

// Get full history
const history = conversation.getHistory();
```

## Provider-Specific Quick Starts

### OpenAI (GPT-4, GPT-3.5)

```javascript
const openai = new APILoader({
  provider: 'openai',
  model: 'gpt-4-turbo-preview',  // Latest GPT-4
  temperature: 0.7,
  topP: 0.9
});

// Function calling
const response = await openai.complete({
  prompt: "What's the weather in Paris?",
  functions: [{
    name: "get_weather",
    description: "Get weather for a location",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string" }
      }
    }
  }]
});
```

### Anthropic (Claude)

```javascript
const claude = new APILoader({
  provider: 'anthropic',
  model: 'claude-3-opus-20240229',  // Most capable
  maxTokens: 4096
});

// System prompts
const response = await claude.complete({
  systemPrompt: "You are a helpful coding assistant",
  prompt: "Explain async/await in JavaScript"
});
```

### Groq (Ultra-Fast)

```javascript
const groq = new APILoader({
  provider: 'groq',
  model: 'mixtral-8x7b-32768',  // Fast and capable
  streamTimeout: 10000  // 10 second timeout
});

// Speed-optimized generation
const response = await groq.complete({
  prompt: "List 10 programming languages",
  maxTokens: 100,
  speedPriority: true
});

console.log(`Generated in ${response.latency}ms`);
```

### OpenRouter (Multi-Provider)

```javascript
const router = new APILoader({
  provider: 'openrouter',
  model: 'auto',  // Let OpenRouter choose
  transforms: ['cache', 'compress']  // Optimizations
});

// Access 100+ models
const response = await router.complete({
  prompt: "Write Python code for fibonacci",
  preferredModels: ['claude-3-opus', 'gpt-4'],
  maxCost: 0.05
});
```

## Error Handling

```javascript
import { APILoader, APIError } from 'llm-runner-router';

const ai = new APILoader({ provider: 'openai' });

try {
  const response = await ai.complete({
    prompt: "Hello world",
    maxTokens: 10
  });
} catch (error) {
  if (error instanceof APIError) {
    switch (error.code) {
      case 'RATE_LIMIT':
        console.log(`Rate limited. Retry after ${error.retryAfter}s`);
        break;
      case 'INVALID_API_KEY':
        console.log('Check your API key');
        break;
      case 'QUOTA_EXCEEDED':
        console.log('API quota exceeded');
        break;
      default:
        console.log(`API Error: ${error.message}`);
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Troubleshooting Common Issues

### Issue 1: "API key not found"

**Solution**: Ensure environment variables are loaded:

```javascript
import dotenv from 'dotenv';
dotenv.config();

const ai = new APILoader({ provider: 'openai' });
```

### Issue 2: "Rate limit exceeded"

**Solution**: Implement retry logic:

```javascript
const ai = new APILoader({
  provider: 'openai',
  retryOptions: {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2
  }
});
```

### Issue 3: "Model not found"

**Solution**: Check available models:

```javascript
const ai = new APILoader({ provider: 'openai' });
const models = await ai.listModels();
console.log('Available models:', models);
```

### Issue 4: "Timeout error"

**Solution**: Increase timeout or use streaming:

```javascript
const ai = new APILoader({
  provider: 'anthropic',
  timeout: 30000,  // 30 seconds
  streamingEnabled: true  // Use streaming for long responses
});
```

### Issue 5: "Unexpected token usage"

**Solution**: Monitor and limit token usage:

```javascript
const ai = new APILoader({
  provider: 'openai',
  maxTokensPerRequest: 1000,
  maxTokensPerMinute: 10000,
  tokenWarningThreshold: 0.8  // Warn at 80% usage
});

ai.on('tokenWarning', (usage) => {
  console.log(`Token usage high: ${usage.percentage}%`);
});
```

## Best Practices Summary

1. **Always use environment variables** for API keys
2. **Implement proper error handling** with specific error types
3. **Set reasonable timeouts** for your use case
4. **Use streaming** for long responses
5. **Monitor costs** and set budget limits
6. **Implement caching** for repeated queries
7. **Use appropriate models** for each task
8. **Set up fallback providers** for reliability
9. **Log requests and responses** for debugging
10. **Rotate API keys** regularly for security

## Next Steps

- 📖 [Provider Documentation](./providers/) - Deep dive into each provider
- 🔧 [API Reference](./reference/apiloader.md) - Complete method reference
- 💡 [Advanced Features](./features/) - Streaming, caching, routing
- 🚀 [Production Guide](./tutorials/best-practices.md) - Scale to production

## Quick Reference Card

```javascript
// Initialization
import { APILoader } from 'llm-runner-router';
const ai = new APILoader({ provider: 'auto' });

// Basic completion
const response = await ai.complete({
  prompt: "Your prompt here",
  maxTokens: 100,
  temperature: 0.7
});

// Streaming
const stream = await ai.streamCompletion({ prompt: "..." });
for await (const chunk of stream) { /* ... */ }

// Cost tracking
console.log(response.cost);
console.log(ai.getTotalCost());

// Model listing
const models = await ai.listModels();

// Error handling
try {
  await ai.complete({ /* ... */ });
} catch (error) {
  if (error instanceof APIError) { /* ... */ }
}
```