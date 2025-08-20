# Groq Adapter Reference

Complete reference for the Groq adapter, including configuration, models, and advanced features for high-speed LLM inference.

## Overview

The Groq adapter provides integration with Groq's ultra-fast LLM inference platform, featuring models like Llama 2, Code Llama, and Mixtral with dramatically reduced latency compared to traditional GPU inference.

## Configuration

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['groq'],
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1', // Optional
    timeout: 10000, // Optional - Groq is very fast
    maxRetries: 3, // Optional
    rateLimit: {
      requestsPerMinute: 30,
      tokensPerMinute: 20000
    }
  }
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | **Required** | Groq API key |
| `baseURL` | string | `https://api.groq.com/openai/v1` | API base URL |
| `timeout` | number | `10000` | Request timeout in milliseconds |
| `maxRetries` | number | `3` | Maximum retry attempts |
| `rateLimit` | object | See below | Rate limiting configuration |

### Rate Limiting Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `requestsPerMinute` | number | `30` | Max requests per minute |
| `tokensPerMinute` | number | `20000` | Max tokens per minute |
| `requestsPerDay` | number | `14400` | Max requests per day |
| `tokensPerDay` | number | `1000000` | Max tokens per day |

## Supported Models

### Llama 2 Models

```javascript
// Llama 2 70B (Most capable)
await router.generate({
  model: 'llama2-70b-4096',
  prompt: 'Your prompt here',
  maxTokens: 4096
});

// Llama 2 7B (Fastest)
await router.generate({
  model: 'llama2-7b-2048',
  prompt: 'Your prompt here',
  maxTokens: 2048
});
```

### Code Llama Models

```javascript
// Code Llama 34B (Best for coding)
await router.generate({
  model: 'codellama-34b-instruct',
  prompt: 'Write a Python function to sort a list',
  maxTokens: 2048
});

// Code Llama 7B (Fast coding)
await router.generate({
  model: 'codellama-7b-instruct',
  prompt: 'Explain this JavaScript code',
  maxTokens: 1024
});
```

### Mixtral Models

```javascript
// Mixtral 8x7B (Balanced performance)
await router.generate({
  model: 'mixtral-8x7b-32768',
  prompt: 'Your prompt here',
  maxTokens: 32768
});

// Mixtral 8x7B Instruct
await router.generate({
  model: 'mixtral-8x7b-32768-instruct',
  prompt: 'Your prompt here',
  maxTokens: 4096
});
```

### Gemma Models

```javascript
// Gemma 7B IT (Instruction tuned)
await router.generate({
  model: 'gemma-7b-it',
  prompt: 'Your prompt here',
  maxTokens: 8192
});
```

### Model Specifications

| Model | Context Length | Max Output | Speed | Use Case |
|-------|---------------|------------|-------|----------|
| `llama2-70b-4096` | 4,096 | 4,096 | Fast | General purpose, complex reasoning |
| `llama2-7b-2048` | 2,048 | 2,048 | Ultra-fast | Simple tasks, high throughput |
| `codellama-34b-instruct` | 4,096 | 4,096 | Fast | Code generation, debugging |
| `codellama-7b-instruct` | 4,096 | 4,096 | Ultra-fast | Quick code help |
| `mixtral-8x7b-32768` | 32,768 | 4,096 | Fast | Long context, analysis |
| `gemma-7b-it` | 8,192 | 8,192 | Ultra-fast | Instruction following |

## Basic Usage

### Simple Generation

```javascript
const response = await router.generate({
  model: 'llama2-70b-4096',
  prompt: 'Write a brief explanation of quantum computing',
  temperature: 0.7,
  maxTokens: 300
});

console.log(response.text);
```

### Chat Format

```javascript
const response = await router.generate({
  model: 'mixtral-8x7b-32768-instruct',
  messages: [
    { role: 'system', content: 'You are a helpful AI assistant.' },
    { role: 'user', content: 'What are the benefits of using Groq for LLM inference?' }
  ],
  maxTokens: 500
});
```

### Streaming Responses

```javascript
const stream = await router.generateStream({
  model: 'llama2-7b-2048',
  prompt: 'Tell me about renewable energy',
  maxTokens: 400
});

for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}
```

## Advanced Features

### High-Speed Code Generation

```javascript
// Ultra-fast code completion
const codeResponse = await router.generate({
  model: 'codellama-7b-instruct',
  prompt: `
    Complete this Python function:
    
    def fibonacci(n):
        """Generate the nth Fibonacci number"""
  `,
  maxTokens: 200,
  temperature: 0.1, // Low temperature for consistent code
  stopSequences: ['\n\n'] // Stop at blank line
});

console.log('Generated code:', codeResponse.text);
```

### Long Context Processing

```javascript
// Use Mixtral for long document analysis
const analysisResponse = await router.generate({
  model: 'mixtral-8x7b-32768',
  messages: [
    {
      role: 'system',
      content: 'You are an expert document analyzer. Provide detailed insights.'
    },
    {
      role: 'user',
      content: `Analyze this long document: ${longDocumentText}`
    }
  ],
  maxTokens: 2000
});
```

### Multi-Turn Conversations

```javascript
class GroqConversation {
  constructor() {
    this.messages = [];
    this.model = 'llama2-70b-4096';
  }
  
  async addUserMessage(content) {
    this.messages.push({ role: 'user', content });
    
    const response = await router.generate({
      model: this.model,
      messages: this.messages,
      maxTokens: 1000,
      temperature: 0.7
    });
    
    this.messages.push({ role: 'assistant', content: response.text });
    return response.text;
  }
  
  switchToFastMode() {
    this.model = 'llama2-7b-2048'; // Switch to faster model
  }
  
  switchToCodeMode() {
    this.model = 'codellama-34b-instruct'; // Switch to code model
  }
}
```

## Speed Optimization

### Model Selection for Speed

```javascript
// Choose model based on speed requirements
function selectGroqModel(speedPriority, taskType) {
  if (speedPriority === 'ultra-fast') {
    return taskType === 'code' ? 'codellama-7b-instruct' : 'llama2-7b-2048';
  }
  
  if (speedPriority === 'fast') {
    return taskType === 'code' ? 'codellama-34b-instruct' : 'llama2-70b-4096';
  }
  
  if (taskType === 'long-context') {
    return 'mixtral-8x7b-32768';
  }
  
  return 'llama2-70b-4096'; // Default
}

const response = await router.generate({
  model: selectGroqModel('ultra-fast', 'general'),
  prompt: 'Quick question about machine learning',
  maxTokens: 100
});
```

### Batch Processing for High Throughput

```javascript
async function batchProcessWithGroq(prompts) {
  const batchSize = 5; // Process in batches to respect rate limits
  const results = [];
  
  for (let i = 0; i < prompts.length; i += batchSize) {
    const batch = prompts.slice(i, i + batchSize);
    
    const batchPromises = batch.map(prompt =>
      router.generate({
        model: 'llama2-7b-2048', // Fastest model
        prompt,
        maxTokens: 200
      })
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches if needed
    if (i + batchSize < prompts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}
```

### Streaming for Real-Time Applications

```javascript
// Real-time chat with streaming
async function realTimeChat(userMessage) {
  const stream = await router.generateStream({
    model: 'llama2-70b-4096',
    messages: [
      { role: 'system', content: 'You are a helpful assistant. Be concise.' },
      { role: 'user', content: userMessage }
    ],
    maxTokens: 500,
    temperature: 0.7
  });
  
  let fullResponse = '';
  for await (const chunk of stream) {
    const text = chunk.text;
    fullResponse += text;
    
    // Send chunk to UI in real-time
    updateUI(text);
  }
  
  return fullResponse;
}
```

## Error Handling

### Groq-Specific Errors

```javascript
try {
  const response = await router.generate({
    model: 'llama2-70b-4096',
    prompt: 'Your prompt'
  });
} catch (error) {
  switch (error.status) {
    case 400:
      console.error('Bad request - check your prompt format');
      break;
    case 401:
      console.error('Invalid Groq API key');
      break;
    case 429:
      console.error('Rate limit exceeded - Groq limits are strict');
      break;
    case 503:
      console.error('Groq service temporarily unavailable');
      break;
    case 524:
      console.error('Timeout - even Groq has limits');
      break;
    default:
      console.error('Groq API error:', error.message);
  }
}
```

### Retry with Fallback

```javascript
async function groqWithFallback(request) {
  try {
    // Try fast model first
    return await router.generate({
      ...request,
      model: 'llama2-7b-2048'
    });
  } catch (error) {
    if (error.status === 429) {
      console.log('Rate limit hit, trying slower model...');
      
      // Wait and try with different model
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return await router.generate({
        ...request,
        model: 'llama2-70b-4096'
      });
    }
    throw error;
  }
}
```

## Performance Monitoring

### Latency Tracking

```javascript
class GroqPerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      totalLatency: 0,
      errors: 0,
      modelUsage: new Map()
    };
  }
  
  async trackRequest(model, requestFn) {
    const startTime = Date.now();
    this.metrics.requests++;
    
    try {
      const result = await requestFn();
      const latency = Date.now() - startTime;
      
      this.metrics.totalLatency += latency;
      this.updateModelUsage(model, latency, true);
      
      console.log(`Groq ${model} completed in ${latency}ms`);
      return result;
    } catch (error) {
      this.metrics.errors++;
      this.updateModelUsage(model, Date.now() - startTime, false);
      throw error;
    }
  }
  
  updateModelUsage(model, latency, success) {
    if (!this.metrics.modelUsage.has(model)) {
      this.metrics.modelUsage.set(model, {
        requests: 0,
        totalLatency: 0,
        errors: 0
      });
    }
    
    const stats = this.metrics.modelUsage.get(model);
    stats.requests++;
    stats.totalLatency += latency;
    if (!success) stats.errors++;
  }
  
  getStats() {
    const avgLatency = this.metrics.totalLatency / this.metrics.requests;
    const errorRate = this.metrics.errors / this.metrics.requests;
    
    const modelStats = {};
    for (const [model, stats] of this.metrics.modelUsage) {
      modelStats[model] = {
        ...stats,
        avgLatency: stats.totalLatency / stats.requests,
        errorRate: stats.errors / stats.requests
      };
    }
    
    return {
      overall: { avgLatency, errorRate, totalRequests: this.metrics.requests },
      models: modelStats
    };
  }
}

// Usage
const monitor = new GroqPerformanceMonitor();

const response = await monitor.trackRequest('llama2-7b-2048', () =>
  router.generate({
    model: 'llama2-7b-2048',
    prompt: 'Test prompt'
  })
);
```

## Cost and Rate Optimization

### Smart Model Routing

```javascript
class GroqSmartRouter {
  constructor() {
    this.usage = {
      requestsThisMinute: 0,
      tokensThisMinute: 0,
      lastReset: Date.now()
    };
  }
  
  async smartGenerate(prompt, options = {}) {
    this.resetCountersIfNeeded();
    
    // Check if we're near rate limits
    if (this.usage.requestsThisMinute >= 25) {
      console.log('Near rate limit, using fastest model...');
      options.model = 'llama2-7b-2048';
    }
    
    const response = await router.generate({
      prompt,
      maxTokens: 200,
      ...options
    });
    
    this.usage.requestsThisMinute++;
    this.usage.tokensThisMinute += response.usage?.totalTokens || 0;
    
    return response;
  }
  
  resetCountersIfNeeded() {
    const now = Date.now();
    if (now - this.usage.lastReset >= 60000) {
      this.usage.requestsThisMinute = 0;
      this.usage.tokensThisMinute = 0;
      this.usage.lastReset = now;
    }
  }
  
  getRemainingCapacity() {
    this.resetCountersIfNeeded();
    return {
      requests: 30 - this.usage.requestsThisMinute,
      tokens: 20000 - this.usage.tokensThisMinute
    };
  }
}
```

### Queue Management

```javascript
class GroqQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.requestsPerMinute = 0;
    this.lastMinute = Date.now();
  }
  
  async enqueue(request) {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      this.processQueue();
    });
  }
  
  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      // Reset counter if minute passed
      if (Date.now() - this.lastMinute >= 60000) {
        this.requestsPerMinute = 0;
        this.lastMinute = Date.now();
      }
      
      // Wait if rate limit reached
      if (this.requestsPerMinute >= 30) {
        const waitTime = 60000 - (Date.now() - this.lastMinute);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      const { request, resolve, reject } = this.queue.shift();
      
      try {
        const response = await router.generate(request);
        this.requestsPerMinute++;
        resolve(response);
      } catch (error) {
        reject(error);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.processing = false;
  }
}
```

## Best Practices

### 1. Speed-Optimized Usage

```javascript
// For maximum speed, use appropriate models and settings
const fastResponse = await router.generate({
  model: 'llama2-7b-2048', // Fastest model
  prompt: 'Quick answer needed',
  maxTokens: 50, // Limit output for speed
  temperature: 0, // No randomness = faster
  stopSequences: ['\n'] // Stop early
});
```

### 2. Code Generation Patterns

```javascript
// Optimized for code tasks
async function generateCode(prompt, language = 'python') {
  const response = await router.generate({
    model: 'codellama-34b-instruct',
    prompt: `Write ${language} code for: ${prompt}`,
    maxTokens: 500,
    temperature: 0.1, // Low randomness for consistent code
    stopSequences: ['```', '\n\n\n'] // Stop at code block end
  });
  
  return response.text.trim();
}
```

### 3. Context-Aware Model Selection

```javascript
function selectModelForTask(prompt, maxTokens) {
  const promptLength = prompt.length;
  const estimatedTokens = Math.ceil(promptLength / 4);
  
  // Need long context?
  if (estimatedTokens > 2000 || maxTokens > 2000) {
    return 'mixtral-8x7b-32768';
  }
  
  // Code-related?
  if (prompt.includes('code') || prompt.includes('function') || prompt.includes('programming')) {
    return promptLength > 1000 ? 'codellama-34b-instruct' : 'codellama-7b-instruct';
  }
  
  // Complex reasoning?
  if (prompt.includes('analyze') || prompt.includes('explain') || prompt.includes('complex')) {
    return 'llama2-70b-4096';
  }
  
  // Default to fastest
  return 'llama2-7b-2048';
}
```

### 4. Error Recovery with Speed

```javascript
async function resilientGroqRequest(request, maxRetries = 3) {
  const models = ['llama2-7b-2048', 'llama2-70b-4096', 'mixtral-8x7b-32768'];
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (const model of models) {
      try {
        return await router.generate({
          ...request,
          model
        });
      } catch (error) {
        console.log(`${model} failed (attempt ${attempt + 1}):`, error.message);
        
        if (error.status === 429) {
          // Rate limited, wait and try next model
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        if (error.status >= 500) {
          // Server error, try next model immediately
          continue;
        }
        
        // Client error, don't retry
        throw error;
      }
    }
    
    // If all models failed, wait before next attempt
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
  
  throw new Error('All Groq models failed after maximum retries');
}
```

## Troubleshooting

### Common Issues

1. **Rate Limits (Most Common)**
   ```javascript
   // Monitor and respect Groq's strict rate limits
   class GroqRateLimiter {
     constructor() {
       this.requests = [];
     }
     
     async throttledRequest(requestFn) {
       const now = Date.now();
       // Remove requests older than 1 minute
       this.requests = this.requests.filter(time => now - time < 60000);
       
       if (this.requests.length >= 30) {
         const oldestRequest = Math.min(...this.requests);
         const waitTime = 60000 - (now - oldestRequest);
         await new Promise(resolve => setTimeout(resolve, waitTime));
       }
       
       this.requests.push(now);
       return await requestFn();
     }
   }
   ```

2. **Model Context Limits**
   ```javascript
   function truncateForGroq(text, model) {
     const limits = {
       'llama2-7b-2048': 2048,
       'llama2-70b-4096': 4096,
       'mixtral-8x7b-32768': 32768
     };
     
     const limit = limits[model] || 2048;
     const maxChars = limit * 4; // Rough estimate
     
     return text.length > maxChars ? text.substring(0, maxChars) : text;
   }
   ```

3. **Timeout Issues**
   ```javascript
   // Even Groq can timeout with very large requests
   const response = await router.generate({
     model: 'llama2-70b-4096',
     prompt: longPrompt,
     timeout: 30000 // Increase timeout for large requests
   });
   ```

### Debug Mode

```javascript
const router = new LLMRouter({
  providers: ['groq'],
  debug: true,
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    debug: {
      logRequests: true,
      logResponses: false, // Responses can be large
      logLatency: true, // Important for Groq speed monitoring
      logRateLimit: true
    }
  }
});
```

---

**Next:** [OpenRouter Adapter](./openrouter.md) | **Back to:** [Reference Overview](../README.md)