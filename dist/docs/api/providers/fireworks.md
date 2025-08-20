# 🎆 Fireworks AI Provider Documentation

*Complete guide to using Fireworks AI with LLM-Runner-Router*

## What is Fireworks AI?

Fireworks AI is a production inference platform that delivers fast, cost-effective AI model serving with their proprietary FireAttention optimization technology. They provide enterprise-grade infrastructure with HIPAA/SOC2 compliance and specialized optimizations for popular open-source models.

**Key Strengths:**
- FireAttention engine for ultra-fast inference
- Enterprise compliance (HIPAA, SOC2, ISO 27001)
- Function calling and structured output support
- Custom model deployment and fine-tuning
- Production-ready infrastructure with 99.9% uptime SLA

## Quick Start

### Basic Setup

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['fireworks'],
  fireworks: {
    apiKey: process.env.FIREWORKS_API_KEY
  }
});

const response = await router.generate({
  model: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
  prompt: 'Explain the benefits of fast AI inference',
  maxTokens: 500
});

console.log(response.text);
```

### Environment Setup

```bash
# Set your Fireworks AI API key
export FIREWORKS_API_KEY=your-fireworks-api-key-here
```

## Configuration

### Environment Variables

```bash
# Required
FIREWORKS_API_KEY=your-fireworks-api-key

# Optional
FIREWORKS_BASE_URL=https://api.fireworks.ai/inference/v1  # Default
FIREWORKS_DEFAULT_MODEL=accounts/fireworks/models/llama-v3p1-70b-instruct
```

### Configuration Options

```javascript
const fireworksConfig = {
  // Required
  apiKey: process.env.FIREWORKS_API_KEY,
  
  // Optional
  baseURL: 'https://api.fireworks.ai/inference/v1',    // Default endpoint
  
  // Request configuration
  timeout: 30000,                                      // Request timeout
  maxRetries: 3,                                       // Retry attempts
  
  // Default parameters
  defaultParams: {
    temperature: 0.6,
    maxTokens: 1000,
    topP: 1.0,
    topK: 40,
    frequencyPenalty: 0,
    presencePenalty: 0,
    stop: null
  },
  
  // Rate limiting (Fireworks has high limits)
  rateLimiting: {
    requestsPerSecond: 20,
    requestsPerMinute: 1200,
    tokensPerMinute: 500000
  },
  
  // Enterprise features
  enterprise: {
    enableHIPAA: false,                                // HIPAA compliance mode
    enableSOC2: false,                                 // SOC2 compliance mode
    dataResidency: 'us',                              // Data residency region
    auditLogging: false                                // Enhanced audit logs
  },
  
  // Performance optimization
  performance: {
    useFireAttention: true,                           // Enable FireAttention
    batchRequests: true,                              // Batch similar requests
    enableCaching: true,                              // Response caching
    prefetchModels: []                                // Pre-load specific models
  }
};
```

## Available Models

### Llama Models

```javascript
// Llama 3.1 405B (Largest, most capable)
model: 'accounts/fireworks/models/llama-v3p1-405b-instruct'

// Llama 3.1 70B (Best balance)
model: 'accounts/fireworks/models/llama-v3p1-70b-instruct'

// Llama 3.1 8B (Fast and efficient)
model: 'accounts/fireworks/models/llama-v3p1-8b-instruct'

// Llama 3 70B
model: 'accounts/fireworks/models/llama-v3-70b-instruct'

// Llama 3 8B
model: 'accounts/fireworks/models/llama-v3-8b-instruct'

// Llama 2 70B
model: 'accounts/fireworks/models/llama-v2-70b-chat'

// Llama 2 13B
model: 'accounts/fireworks/models/llama-v2-13b-chat'

// Llama 2 7B
model: 'accounts/fireworks/models/llama-v2-7b-chat'
```

### Code Models

```javascript
// Code Llama 34B (Best for complex code)
model: 'accounts/fireworks/models/llama-v2-34b-code-instruct'

// Code Llama 13B
model: 'accounts/fireworks/models/llama-v2-13b-code-instruct'

// Code Llama 7B (Fast code generation)
model: 'accounts/fireworks/models/llama-v2-7b-code-instruct'

// DeepSeek Coder 33B
model: 'accounts/fireworks/models/deepseek-coder-v2-instruct'

// StarCoder2 15B
model: 'accounts/fireworks/models/starcoder-16b'
```

### Mixtral Models

```javascript
// Mixtral 8x7B (Mixture of Experts)
model: 'accounts/fireworks/models/mixtral-8x7b-instruct'

// Mixtral 8x22B (Larger MoE)
model: 'accounts/fireworks/models/mixtral-8x22b-instruct'
```

### Specialized Models

```javascript
// Gemma 2 27B
model: 'accounts/fireworks/models/gemma2-27b-it'

// Gemma 2 9B
model: 'accounts/fireworks/models/gemma2-9b-it'

// Qwen 2 72B (Multilingual)
model: 'accounts/fireworks/models/qwen2-72b-instruct'

// Yi Large (Chinese + English)
model: 'accounts/fireworks/models/yi-large'

// Nous Hermes 2 (Uncensored)
model: 'accounts/fireworks/models/nous-hermes-2-mixtral-8x7b-dpo'
```

### Function Calling Models

```javascript
// Fireworks Function Calling v2
model: 'accounts/fireworks/models/firefunction-v2'

// Fireworks Function Calling v1
model: 'accounts/fireworks/models/firefunction-v1'
```

## Code Examples

### Simple Text Generation

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['fireworks'],
  fireworks: {
    apiKey: process.env.FIREWORKS_API_KEY
  }
});

async function generateText() {
  const response = await router.generate({
    model: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
    prompt: 'Write a technical overview of high-performance AI inference',
    maxTokens: 600,
    temperature: 0.7
  });

  console.log('Generated text:', response.text);
  console.log('Cost:', `$${response.cost.toFixed(4)}`);
  console.log('Tokens used:', response.usage.totalTokens);
  console.log('Inference time:', `${response.metadata.inferenceTime}ms`);
}

generateText();
```

### Chat Conversation

```javascript
async function chatWithFireworks() {
  const messages = [
    { role: 'system', content: 'You are an expert in high-performance computing and AI infrastructure.' },
    { role: 'user', content: 'How does Fireworks AI achieve such fast inference speeds?' }
  ];

  const response = await router.chat({
    model: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
    messages,
    maxTokens: 500,
    temperature: 0.6
  });

  console.log('Fireworks response:', response.text);
  console.log('Inference latency:', response.metadata.inferenceTime);
}

chatWithFireworks();
```

### Streaming Response

```javascript
async function streamGeneration() {
  console.log('Fireworks AI streaming response...\n');

  const startTime = Date.now();
  let firstTokenTime = null;

  for await (const chunk of router.stream({
    model: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
    prompt: 'Explain the FireAttention optimization technology and how it improves AI inference performance',
    maxTokens: 800,
    temperature: 0.7
  })) {
    if (!firstTokenTime) {
      firstTokenTime = Date.now() - startTime;
      console.log(`First token in ${firstTokenTime}ms\n`);
    }
    process.stdout.write(chunk.text);
  }
  
  console.log(`\n\nTotal time: ${Date.now() - startTime}ms`);
}

streamGeneration();
```

### Function Calling

```javascript
async function functionCallingExample() {
  const tools = [
    {
      type: 'function',
      function: {
        name: 'get_performance_metrics',
        description: 'Get current performance metrics for AI inference',
        parameters: {
          type: 'object',
          properties: {
            metric_type: {
              type: 'string',
              description: 'Type of metric to retrieve',
              enum: ['latency', 'throughput', 'cost', 'accuracy']
            },
            time_window: {
              type: 'string',
              description: 'Time window for metrics',
              enum: ['1h', '24h', '7d', '30d']
            }
          },
          required: ['metric_type']
        }
      }
    }
  ];

  const response = await router.chat({
    model: 'accounts/fireworks/models/firefunction-v2',
    messages: [
      { role: 'user', content: 'What are the current latency metrics for the past 24 hours?' }
    ],
    tools,
    toolChoice: 'auto',
    maxTokens: 200
  });

  if (response.toolCalls) {
    console.log('Function calls:', response.toolCalls);
  }
  
  console.log('Response:', response.text);
}

functionCallingExample();
```

### Code Generation with CodeLlama

```javascript
async function generateCode() {
  const response = await router.generate({
    model: 'accounts/fireworks/models/llama-v2-34b-code-instruct',
    prompt: `
Create a TypeScript class for managing high-performance HTTP connections that:

1. Implements connection pooling with configurable pool size
2. Has automatic retry logic with exponential backoff
3. Supports request/response interceptors
4. Includes circuit breaker pattern
5. Has comprehensive error handling
6. Supports both Promise and async/await patterns
7. Includes proper TypeScript types and interfaces

Make it production-ready with proper error handling.
`,
    maxTokens: 1200,
    temperature: 0.1,  // Low temperature for code generation
    stop: ['</code>', '```']
  });

  console.log('Generated code:', response.text);
}

generateCode();
```

### Structured Output with JSON Mode

```javascript
async function structuredOutput() {
  const response = await router.chat({
    model: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
    messages: [
      {
        role: 'system',
        content: 'You are a data extraction assistant. Always respond with valid JSON.'
      },
      {
        role: 'user',
        content: 'Extract key information from this text into JSON format: "The AI conference will be held in San Francisco from June 15-17, 2024. Tickets cost $299 for regular attendees and $199 for students. The keynote speaker is Dr. Sarah Chen from OpenAI."'
      }
    ],
    responseFormat: { type: 'json_object' },
    temperature: 0.3,
    maxTokens: 300
  });

  console.log('Structured JSON response:', response.text);
  
  try {
    const parsed = JSON.parse(response.text);
    console.log('Parsed data:', parsed);
  } catch (e) {
    console.error('Failed to parse JSON:', e);
  }
}

structuredOutput();
```

### Batch Processing with Performance Monitoring

```javascript
async function batchWithPerformanceTracking() {
  const prompts = [
    'Explain machine learning in simple terms',
    'What is the difference between AI and ML?',
    'How does deep learning work?',
    'What are neural networks?',
    'Explain natural language processing'
  ];

  console.log('Processing batch with performance monitoring...\n');
  
  const results = [];
  const totalStartTime = Date.now();

  for (const [index, prompt] of prompts.entries()) {
    const startTime = Date.now();
    
    const response = await router.generate({
      model: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
      prompt,
      maxTokens: 200,
      temperature: 0.7
    });
    
    const duration = Date.now() - startTime;
    
    results.push({
      index: index + 1,
      prompt,
      response: response.text,
      cost: response.cost,
      tokens: response.usage.totalTokens,
      duration,
      tokensPerSecond: response.usage.totalTokens / (duration / 1000)
    });
    
    console.log(`Request ${index + 1}: ${duration}ms, ${response.usage.totalTokens} tokens, ${(response.usage.totalTokens / (duration / 1000)).toFixed(1)} tok/s`);
  }
  
  const totalDuration = Date.now() - totalStartTime;
  const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
  const totalTokens = results.reduce((sum, r) => sum + r.tokens, 0);
  const avgTokensPerSecond = totalTokens / (totalDuration / 1000);
  
  console.log('\n--- Batch Performance Summary ---');
  console.log(`Total time: ${totalDuration}ms`);
  console.log(`Total cost: $${totalCost.toFixed(4)}`);
  console.log(`Total tokens: ${totalTokens}`);
  console.log(`Average throughput: ${avgTokensPerSecond.toFixed(1)} tokens/second`);
  console.log(`Average latency: ${(totalDuration / results.length).toFixed(1)}ms per request`);
}

batchWithPerformanceTracking();
```

## Best Practices

### 1. Model Selection for Performance

```javascript
const performanceStrategy = {
  // Ultra-fast responses (< 100ms first token)
  ultraFast: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
  
  // Balanced speed and quality
  balanced: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
  
  // Maximum quality (longer latency)
  quality: 'accounts/fireworks/models/llama-v3p1-405b-instruct',
  
  // Code generation (optimized for coding)
  coding: 'accounts/fireworks/models/llama-v2-34b-code-instruct',
  
  // Function calling (structured outputs)
  functions: 'accounts/fireworks/models/firefunction-v2',
  
  // Mixture of experts (good performance/cost ratio)
  efficient: 'accounts/fireworks/models/mixtral-8x7b-instruct'
};
```

### 2. Optimizing for Speed

```javascript
// Configure for maximum speed
const speedOptimizedRouter = new LLMRouter({
  providers: ['fireworks'],
  fireworks: {
    apiKey: process.env.FIREWORKS_API_KEY,
    performance: {
      useFireAttention: true,           // Enable FireAttention optimization
      batchRequests: true,              // Batch similar requests
      enableCaching: true,              // Cache responses
      prefetchModels: [                 // Pre-warm frequently used models
        'accounts/fireworks/models/llama-v3p1-8b-instruct',
        'accounts/fireworks/models/llama-v3p1-70b-instruct'
      ],
      concurrentRequests: 10,           // Higher concurrency
      keepAliveConnections: true        // Reuse connections
    },
    defaultParams: {
      temperature: 0.7,
      maxTokens: 500,                   // Reasonable token limit
      topP: 0.95,                       // Slightly reduce for speed
      stop: ['\n\n']                    // Early stopping
    }
  }
});
```

### 3. Enterprise Configuration

```javascript
// Configure for enterprise compliance
const enterpriseRouter = new LLMRouter({
  providers: ['fireworks'],
  fireworks: {
    apiKey: process.env.FIREWORKS_API_KEY,
    enterprise: {
      enableHIPAA: true,                // HIPAA compliance
      enableSOC2: true,                 // SOC2 compliance
      dataResidency: 'us',              // US data residency
      auditLogging: true,               // Enhanced audit logs
      encryptionAtRest: true,           // Data encryption
      encryptionInTransit: true         // Transit encryption
    },
    security: {
      enableContentFiltering: true,     // Content safety
      enableDataRedaction: true,        // PII redaction
      maxTokensPerRequest: 4000,        // Security limits
      enableIPWhitelisting: true        // IP restrictions
    }
  }
});
```

### 4. Error Handling and Resilience

```javascript
async function resilientFireworksCall() {
  const maxRetries = 3;
  const baseDelay = 1000;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await router.generate({
        model: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
        prompt: 'Your prompt here',
        maxTokens: 500,
        timeout: 30000
      });
      
      return response;
    } catch (error) {
      console.log(`Attempt ${attempt + 1} failed:`, error.message);
      
      switch (error.type) {
        case 'rate_limit_exceeded':
          // Fireworks has high limits, so this is rare
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Rate limited, waiting ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
          
        case 'model_overloaded':
          // Try a smaller, faster model
          console.log('Model overloaded, trying smaller model...');
          return await router.generate({
            model: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
            prompt: 'Your prompt here',
            maxTokens: 500
          });
          
        case 'timeout':
          // Reduce max tokens for faster response
          if (attempt === maxRetries - 1) {
            console.log('Timeout, trying with fewer tokens...');
            return await router.generate({
              model: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
              prompt: 'Your prompt here',
              maxTokens: 200
            });
          }
          continue;
          
        default:
          if (attempt === maxRetries - 1) {
            throw error;
          }
          continue;
      }
    }
  }
}
```

### 5. Cost and Performance Monitoring

```javascript
class FireworksMonitor {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      totalCost: 0,
      totalTokens: 0,
      totalLatency: 0,
      modelUsage: new Map(),
      errorCount: 0
    };
  }
  
  trackRequest(model, startTime, response, error = null) {
    this.metrics.totalRequests++;
    
    if (error) {
      this.metrics.errorCount++;
      return;
    }
    
    const latency = Date.now() - startTime;
    this.metrics.totalCost += response.cost;
    this.metrics.totalTokens += response.usage.totalTokens;
    this.metrics.totalLatency += latency;
    
    // Track per-model metrics
    const modelStats = this.metrics.modelUsage.get(model) || {
      requests: 0,
      cost: 0,
      tokens: 0,
      latency: 0
    };
    
    modelStats.requests++;
    modelStats.cost += response.cost;
    modelStats.tokens += response.usage.totalTokens;
    modelStats.latency += latency;
    
    this.metrics.modelUsage.set(model, modelStats);
  }
  
  getReport() {
    const avgLatency = this.metrics.totalLatency / this.metrics.totalRequests;
    const avgCost = this.metrics.totalCost / this.metrics.totalRequests;
    const avgTokens = this.metrics.totalTokens / this.metrics.totalRequests;
    const errorRate = (this.metrics.errorCount / this.metrics.totalRequests) * 100;
    
    return {
      summary: {
        totalRequests: this.metrics.totalRequests,
        totalCost: this.metrics.totalCost,
        avgLatency: Math.round(avgLatency),
        avgCost: avgCost.toFixed(6),
        avgTokens: Math.round(avgTokens),
        errorRate: errorRate.toFixed(2) + '%'
      },
      byModel: Array.from(this.metrics.modelUsage.entries()).map(([model, stats]) => ({
        model: model.split('/').pop(),
        requests: stats.requests,
        avgLatency: Math.round(stats.latency / stats.requests),
        avgCost: (stats.cost / stats.requests).toFixed(6),
        tokensPerSecond: Math.round(stats.tokens / (stats.latency / 1000))
      }))
    };
  }
}
```

## Troubleshooting

### Common Issues

#### Issue: "Model not found"
```
Error: Model 'llama-3-70b' not found in Fireworks catalog.
```

**Solution**: Use full Fireworks model paths:
```javascript
// Correct Fireworks model naming
const correctModels = {
  'llama-3-70b': 'accounts/fireworks/models/llama-v3-70b-instruct',
  'llama-3.1-70b': 'accounts/fireworks/models/llama-v3p1-70b-instruct',
  'mixtral-8x7b': 'accounts/fireworks/models/mixtral-8x7b-instruct',
  'code-llama-34b': 'accounts/fireworks/models/llama-v2-34b-code-instruct'
};
```

#### Issue: "Rate limit exceeded" (rare)
```
Error: Rate limit exceeded. Too many requests.
```

**Solution**: Fireworks has generous limits, but implement backoff:
```javascript
// Typical Fireworks limits (may vary by tier)
const fireworksLimits = {
  requestsPerSecond: 20,
  requestsPerMinute: 1200,
  tokensPerMinute: 500000,
  concurrentRequests: 100
};
```

#### Issue: "Model temporarily unavailable"
```
Error: Model is temporarily unavailable due to high demand.
```

**Solution**: Implement fallback models:
```javascript
const modelFallbacks = {
  'accounts/fireworks/models/llama-v3p1-405b-instruct': [
    'accounts/fireworks/models/llama-v3p1-70b-instruct',
    'accounts/fireworks/models/llama-v3-70b-instruct'
  ],
  'accounts/fireworks/models/llama-v3p1-70b-instruct': [
    'accounts/fireworks/models/llama-v3p1-8b-instruct',
    'accounts/fireworks/models/mixtral-8x7b-instruct'
  ]
};
```

#### Issue: "Context length exceeded"
```
Error: Input exceeds maximum context length for model.
```

**Solution**: Check context limits and implement truncation:
```javascript
const contextLimits = {
  'accounts/fireworks/models/llama-v3p1-405b-instruct': 131072,
  'accounts/fireworks/models/llama-v3p1-70b-instruct': 131072,
  'accounts/fireworks/models/llama-v3p1-8b-instruct': 131072,
  'accounts/fireworks/models/mixtral-8x7b-instruct': 32768,
  'accounts/fireworks/models/llama-v2-70b-chat': 4096
};
```

### Debug Mode

```javascript
const router = new LLMRouter({
  providers: ['fireworks'],
  debug: true,  // Enable debug logging
  fireworks: {
    apiKey: process.env.FIREWORKS_API_KEY,
    logLevel: 'DEBUG',
    logRequests: true,
    logResponses: false,
    logPerformanceMetrics: true,    // Log latency and throughput
    logFireAttentionStats: true     // Log FireAttention performance
  }
});
```

## Pricing Information

### Text Generation Models (per 1M tokens)

#### Llama 3.1 Models
- **Llama 3.1 8B Instruct**: $0.20
- **Llama 3.1 70B Instruct**: $0.90
- **Llama 3.1 405B Instruct**: $3.00

#### Llama 3 Models
- **Llama 3 8B Instruct**: $0.20
- **Llama 3 70B Instruct**: $0.90

#### Llama 2 Models
- **Llama 2 7B Chat**: $0.20
- **Llama 2 13B Chat**: $0.20
- **Llama 2 70B Chat**: $0.90

#### Code Models
- **Code Llama 7B**: $0.20
- **Code Llama 13B**: $0.20
- **Code Llama 34B**: $0.80

#### Other Models
- **Mixtral 8x7B**: $0.50
- **Mixtral 8x22B**: $1.20
- **Gemma 2 9B**: $0.20
- **Qwen 2 72B**: $0.90

#### Function Calling
- **FireFunction v1/v2**: $0.20

### Enterprise Features
- **HIPAA Compliance**: +25% premium
- **SOC2 Compliance**: +20% premium
- **Dedicated Instances**: Custom pricing
- **SLA Guarantees**: Custom pricing

*Fireworks often provides significant cost savings with enterprise-grade performance. Check Fireworks AI pricing for current rates and enterprise discounts.*

## Resources

- **Fireworks AI Platform**: [fireworks.ai](https://fireworks.ai)
- **API Documentation**: [docs.fireworks.ai](https://docs.fireworks.ai)
- **Model Playground**: [fireworks.ai/models](https://fireworks.ai/models)
- **Enterprise Solutions**: [fireworks.ai/enterprise](https://fireworks.ai/enterprise)
- **Discord Community**: [discord.gg/fireworks-ai](https://discord.gg/fireworks-ai)
- **Status Page**: [status.fireworks.ai](https://status.fireworks.ai)

---

*Built with 💚 by Echo AI Systems*