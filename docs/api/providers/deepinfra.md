# 🚀 DeepInfra Provider Documentation

*Complete guide to using DeepInfra with LLM-Runner-Router*

## What is DeepInfra?

DeepInfra is a serverless GPU platform that provides cost-effective access to popular open-source AI models. They offer up to 50% cost savings through optimized GPU infrastructure, automatic scaling, and efficient model serving with pay-per-use pricing.

**Key Strengths:**
- 50% cost savings compared to major cloud providers
- Serverless GPU infrastructure with auto-scaling
- Optimized serving for popular open-source models
- Built-in caching and load balancing
- Simple OpenAI-compatible API

## Quick Start

### Basic Setup

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['deepinfra'],
  deepinfra: {
    apiKey: process.env.DEEPINFRA_API_KEY
  }
});

const response = await router.generate({
  model: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
  prompt: 'Explain the benefits of serverless GPU computing',
  maxTokens: 500
});

console.log(response.text);
```

### Environment Setup

```bash
# Set your DeepInfra API key
export DEEPINFRA_API_KEY=your-deepinfra-api-key-here
```

## Configuration

### Environment Variables

```bash
# Required
DEEPINFRA_API_KEY=your-deepinfra-api-key

# Optional
DEEPINFRA_BASE_URL=https://api.deepinfra.com/v1/openai  # Default
DEEPINFRA_DEFAULT_MODEL=meta-llama/Meta-Llama-3.1-70B-Instruct
```

### Configuration Options

```javascript
const deepinfraConfig = {
  // Required
  apiKey: process.env.DEEPINFRA_API_KEY,
  
  // Optional
  baseURL: 'https://api.deepinfra.com/v1/openai',      // OpenAI-compatible endpoint
  
  // Request configuration
  timeout: 60000,                                      // Longer timeout for cold starts
  maxRetries: 3,                                       // Retry attempts
  
  // Default parameters
  defaultParams: {
    temperature: 0.7,
    maxTokens: 1000,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
    stop: null
  },
  
  // Rate limiting (DeepInfra has generous limits)
  rateLimiting: {
    requestsPerSecond: 10,
    requestsPerMinute: 600,
    tokensPerMinute: 200000
  },
  
  // Cost optimization
  costOptimization: {
    enableCaching: true,                               // Use DeepInfra's built-in caching
    preferCachedResponses: true,                       // Prefer cached responses for speed
    batchSimilarRequests: true,                        // Batch similar requests
    useSpotInstances: true                             // Use spot GPU instances for savings
  },
  
  // Performance settings
  performance: {
    coldStartTolerance: 'medium',                      // 'low', 'medium', 'high'
    prioritizeSpeed: false,                            // Prefer cost over speed
    enablePrewarming: false,                           // Pre-warm models (costs extra)
    maxConcurrentRequests: 5                           // Concurrent request limit
  }
};
```

## Available Models

### Llama 3.1 Models

```javascript
// Llama 3.1 405B (Most capable)
model: 'meta-llama/Meta-Llama-3.1-405B-Instruct'

// Llama 3.1 70B (Best balance)
model: 'meta-llama/Meta-Llama-3.1-70B-Instruct'

// Llama 3.1 8B (Fast and efficient)
model: 'meta-llama/Meta-Llama-3.1-8B-Instruct'
```

### Llama 3 Models

```javascript
// Llama 3 70B
model: 'meta-llama/Llama-3-70b-chat-hf'

// Llama 3 8B
model: 'meta-llama/Llama-3-8b-chat-hf'
```

### Llama 2 Models

```javascript
// Llama 2 70B Chat
model: 'meta-llama/Llama-2-70b-chat-hf'

// Llama 2 13B Chat
model: 'meta-llama/Llama-2-13b-chat-hf'

// Llama 2 7B Chat
model: 'meta-llama/Llama-2-7b-chat-hf'
```

### Code Models

```javascript
// Code Llama 34B
model: 'codellama/CodeLlama-34b-Instruct-hf'

// Code Llama 13B
model: 'codellama/CodeLlama-13b-Instruct-hf'

// Code Llama 7B
model: 'codellama/CodeLlama-7b-Instruct-hf'

// Phind Code Llama 34B (Optimized for coding)
model: 'Phind/Phind-CodeLlama-34B-v2'

// WizardCoder 34B
model: 'WizardLM/WizardCoder-Python-34B-V1.0'
```

### Mixtral Models

```javascript
// Mixtral 8x7B (Mixture of Experts)
model: 'mistralai/Mixtral-8x7B-Instruct-v0.1'

// Mixtral 8x22B (Larger MoE)
model: 'mistralai/Mixtral-8x22B-Instruct-v0.1'
```

### Specialized Models

```javascript
// Qwen 2 72B (Multilingual)
model: 'Qwen/Qwen2-72B-Instruct'

// Qwen 2 7B
model: 'Qwen/Qwen2-7B-Instruct'

// Yi 34B (Chinese + English)
model: '01-ai/Yi-34B-Chat'

// Dolphin 2.6 Mixtral (Uncensored)
model: 'cognitivecomputations/dolphin-2.6-mixtral-8x7b'

// OpenChat 3.5 (High performance)
model: 'openchat/openchat-3.5-1210'

// Airoboros 70B (Role-playing)
model: 'jondurbin/airoboros-l2-70b-gpt4-1.4.1'
```

### Image Models

```javascript
// Stable Diffusion XL
model: 'stabilityai/stable-diffusion-xl-base-1.0'

// Stable Diffusion 2.1
model: 'stabilityai/stable-diffusion-2-1'

// Stable Diffusion 1.5
model: 'runwayml/stable-diffusion-v1-5'

// SDXL Turbo (Fast generation)
model: 'stabilityai/sdxl-turbo'
```

## Code Examples

### Simple Text Generation

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['deepinfra'],
  deepinfra: {
    apiKey: process.env.DEEPINFRA_API_KEY
  }
});

async function generateText() {
  const response = await router.generate({
    model: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    prompt: 'Write a comprehensive guide to cost-effective AI inference',
    maxTokens: 600,
    temperature: 0.7
  });

  console.log('Generated text:', response.text);
  console.log('Cost:', `$${response.cost.toFixed(4)}`);
  console.log('Tokens used:', response.usage.totalTokens);
  console.log('Was cached:', response.metadata.cached || false);
}

generateText();
```

### Chat Conversation

```javascript
async function chatWithDeepInfra() {
  const messages = [
    { role: 'system', content: 'You are an expert in cloud computing and cost optimization.' },
    { role: 'user', content: 'How does serverless GPU computing reduce costs compared to traditional cloud instances?' }
  ];

  const response = await router.chat({
    model: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    messages,
    maxTokens: 500,
    temperature: 0.6
  });

  console.log('DeepInfra response:', response.text);
}

chatWithDeepInfra();
```

### Streaming Response

```javascript
async function streamGeneration() {
  console.log('DeepInfra streaming response...\n');

  for await (const chunk of router.stream({
    model: 'meta-llama/Llama-3-8b-chat-hf',
    prompt: 'Explain how DeepInfra optimizes GPU utilization and reduces costs for AI inference',
    maxTokens: 800,
    temperature: 0.7
  })) {
    process.stdout.write(chunk.text);
  }
}

streamGeneration();
```

### Code Generation

```javascript
async function generateCode() {
  const response = await router.generate({
    model: 'codellama/CodeLlama-34b-Instruct-hf',
    prompt: `
Write a Python class for cost-optimized AI inference that:

1. Manages multiple AI providers with fallback logic
2. Implements request batching to reduce costs
3. Has caching for repeated requests
4. Monitors cost and usage metrics
5. Supports both sync and async operations
6. Includes proper error handling and logging

Make it production-ready with type hints and documentation.
`,
    maxTokens: 1000,
    temperature: 0.1,  // Low temperature for code generation
    stop: ['```', '</code>']
  });

  console.log('Generated code:', response.text);
}

generateCode();
```

### Cost Comparison Analysis

```javascript
async function costComparison() {
  const prompt = 'Explain the benefits of renewable energy sources.';
  const models = [
    { name: 'Llama 3.1 8B', model: 'meta-llama/Meta-Llama-3.1-8B-Instruct' },
    { name: 'Llama 3.1 70B', model: 'meta-llama/Meta-Llama-3.1-70B-Instruct' },
    { name: 'Llama 2 70B', model: 'meta-llama/Llama-2-70b-chat-hf' },
    { name: 'Mixtral 8x7B', model: 'mistralai/Mixtral-8x7B-Instruct-v0.1' }
  ];

  console.log('DeepInfra Cost Comparison:\n');

  for (const { name, model } of models) {
    const startTime = Date.now();
    
    const response = await router.generate({
      model,
      prompt,
      maxTokens: 200,
      temperature: 0.7
    });
    
    const duration = Date.now() - startTime;
    const costPer1KTokens = (response.cost / response.usage.totalTokens) * 1000;
    
    console.log(`${name}:`);
    console.log(`  Cost: $${response.cost.toFixed(6)}`);
    console.log(`  Tokens: ${response.usage.totalTokens}`);
    console.log(`  Cost per 1K tokens: $${costPer1KTokens.toFixed(6)}`);
    console.log(`  Latency: ${duration}ms`);
    console.log(`  Cached: ${response.metadata.cached || false}\n`);
  }
}

costComparison();
```

### Batch Processing with Cost Optimization

```javascript
async function optimizedBatchProcessing() {
  const prompts = [
    'Explain machine learning basics',
    'What is artificial intelligence?',
    'How does deep learning work?',
    'What are neural networks?',
    'Explain computer vision'
  ];

  console.log('Optimized batch processing with DeepInfra...\n');
  
  // Group similar prompts for potential caching benefits
  const results = [];
  let totalCost = 0;
  let cacheHits = 0;

  for (const [index, prompt] of prompts.entries()) {
    const response = await router.generate({
      model: 'meta-llama/Meta-Llama-3.1-8B-Instruct',  // Use cost-effective model
      prompt,
      maxTokens: 150,                                   // Limit tokens for cost
      temperature: 0.7,
      // Enable caching for similar requests
      cacheKey: `batch-${prompt.slice(0, 20)}`
    });
    
    totalCost += response.cost;
    if (response.metadata.cached) {
      cacheHits++;
    }
    
    results.push({
      index: index + 1,
      prompt,
      response: response.text,
      cost: response.cost,
      cached: response.metadata.cached || false
    });
    
    console.log(`Request ${index + 1}: $${response.cost.toFixed(6)} ${response.metadata.cached ? '(cached)' : ''}`);
  }
  
  console.log(`\nBatch Summary:`);
  console.log(`Total cost: $${totalCost.toFixed(4)}`);
  console.log(`Cache hits: ${cacheHits}/${prompts.length}`);
  console.log(`Average cost per request: $${(totalCost / prompts.length).toFixed(6)}`);
}

optimizedBatchProcessing();
```

### Image Generation

```javascript
async function generateImage() {
  const response = await router.generateImage({
    model: 'stabilityai/stable-diffusion-xl-base-1.0',
    prompt: 'A modern data center with GPU servers, futuristic style, high quality, 4K',
    negativePrompt: 'blurry, low quality, distorted, old',
    width: 1024,
    height: 1024,
    steps: 30,                          // Balanced quality/cost
    guidanceScale: 7.5,
    seed: 42
  });

  console.log('Generated image URL:', response.imageUrl);
  console.log('Generation cost:', `$${response.cost.toFixed(4)}`);
  console.log('Generation time:', `${response.metadata.generationTime}ms`);
}

generateImage();
```

### Multilingual Capabilities

```javascript
async function multilingualGeneration() {
  const prompts = [
    { lang: 'English', text: 'Explain quantum computing' },
    { lang: 'Spanish', text: 'Explica la computación cuántica' },
    { lang: 'French', text: 'Expliquez l\'informatique quantique' },
    { lang: 'German', text: 'Erklären Sie Quantencomputing' },
    { lang: 'Chinese', text: '解释量子计算' }
  ];

  console.log('Multilingual generation with Qwen 2:\n');

  for (const { lang, text } of prompts) {
    const response = await router.generate({
      model: 'Qwen/Qwen2-72B-Instruct',  // Excellent multilingual model
      prompt: text,
      maxTokens: 200,
      temperature: 0.7
    });

    console.log(`${lang}:`);
    console.log(response.text);
    console.log(`Cost: $${response.cost.toFixed(6)}\n`);
  }
}

multilingualGeneration();
```

## Best Practices

### 1. Cost Optimization Strategies

```javascript
const costOptimizedRouter = new LLMRouter({
  providers: ['deepinfra'],
  strategy: 'cost-optimized',
  deepinfra: {
    apiKey: process.env.DEEPINFRA_API_KEY,
    costOptimization: {
      // Prefer smaller models for simple tasks
      modelHierarchy: [
        'meta-llama/Meta-Llama-3.1-8B-Instruct',    // $0.0001/1K tokens
        'meta-llama/Llama-3-8b-chat-hf',            // $0.0001/1K tokens
        'meta-llama/Meta-Llama-3.1-70B-Instruct',   // $0.0007/1K tokens
        'meta-llama/Meta-Llama-3.1-405B-Instruct'   // $0.002/1K tokens
      ],
      
      // Enable aggressive caching
      enableCaching: true,
      cacheThreshold: 0.8,              // Cache if 80% similar
      
      // Batch similar requests
      batchingEnabled: true,
      batchWindow: 100,                 // 100ms batching window
      
      // Use spot instances for non-critical workloads
      useSpotInstances: true,
      
      // Set cost limits
      maxCostPerRequest: 0.01,          // 1 cent max per request
      dailyCostLimit: 10.00             // $10 daily limit
    }
  }
});
```

### 2. Performance vs Cost Balance

```javascript
// Configure for balanced performance and cost
const balancedRouter = new LLMRouter({
  providers: ['deepinfra'],
  deepinfra: {
    apiKey: process.env.DEEPINFRA_API_KEY,
    performance: {
      coldStartTolerance: 'medium',     // Accept some cold start delay
      prioritizeSpeed: false,           // Prefer cost over speed
      enablePrewarming: false,          // Don't pre-warm (costs extra)
      maxConcurrentRequests: 3          // Limit concurrency for cost
    },
    models: {
      // Smart model selection based on task complexity
      simple: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
      medium: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
      complex: 'meta-llama/Meta-Llama-3.1-405B-Instruct',
      coding: 'codellama/CodeLlama-34b-Instruct-hf'
    }
  }
});
```

### 3. Error Handling and Fallbacks

```javascript
async function robustDeepInfraCall() {
  const fallbackModels = [
    'meta-llama/Meta-Llama-3.1-70B-Instruct',
    'meta-llama/Meta-Llama-3.1-8B-Instruct',
    'meta-llama/Llama-3-8b-chat-hf'
  ];
  
  for (const [index, model] of fallbackModels.entries()) {
    try {
      const response = await router.generate({
        model,
        prompt: 'Your prompt here',
        maxTokens: 500,
        timeout: 60000  // Allow for cold starts
      });
      
      if (index > 0) {
        console.log(`Succeeded with fallback model: ${model}`);
      }
      
      return response;
    } catch (error) {
      console.log(`Model ${model} failed:`, error.message);
      
      switch (error.type) {
        case 'cold_start_timeout':
          console.log('Cold start timeout, trying smaller model...');
          continue;
          
        case 'model_overloaded':
          console.log('Model overloaded, trying alternative...');
          continue;
          
        case 'rate_limit_exceeded':
          console.log('Rate limited, waiting before retry...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
          
        default:
          if (index === fallbackModels.length - 1) {
            throw error;  // Last model failed
          }
          continue;
      }
    }
  }
}
```

### 4. Caching Strategy

```javascript
class DeepInfraCacheManager {
  constructor() {
    this.cache = new Map();
    this.cacheStats = { hits: 0, misses: 0 };
  }
  
  generateCacheKey(model, prompt, options) {
    const key = {
      model,
      prompt: prompt.slice(0, 100),  // First 100 chars
      temperature: options.temperature,
      maxTokens: options.maxTokens
    };
    return JSON.stringify(key);
  }
  
  async getCachedResponse(cacheKey) {
    if (this.cache.has(cacheKey)) {
      this.cacheStats.hits++;
      return this.cache.get(cacheKey);
    }
    this.cacheStats.misses++;
    return null;
  }
  
  setCachedResponse(cacheKey, response) {
    // Cache for 1 hour
    const expiryTime = Date.now() + 3600000;
    this.cache.set(cacheKey, { ...response, expiryTime });
    
    // Clean expired entries
    this.cleanExpiredEntries();
  }
  
  cleanExpiredEntries() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiryTime < now) {
        this.cache.delete(key);
      }
    }
  }
  
  getCacheStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    return {
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      hitRate: total > 0 ? (this.cacheStats.hits / total * 100).toFixed(1) + '%' : '0%'
    };
  }
}
```

## Troubleshooting

### Common Issues

#### Issue: "Cold start timeout"
```
Error: Request timed out due to cold start. Model is loading.
```

**Solution**: Increase timeout and implement retry logic:
```javascript
const coldStartRetry = async (fn, maxRetries = 2) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.type === 'cold_start_timeout' && i < maxRetries - 1) {
        console.log(`Cold start detected, retrying in ${(i + 1) * 2}s...`);
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 2000));
        continue;
      }
      throw error;
    }
  }
};
```

#### Issue: "Model not available"
```
Error: Model 'invalid-model-name' is not available on DeepInfra.
```

**Solution**: Check available models and use correct names:
```javascript
// List available models
const models = await router.listModels();
console.log('Available models:', models.map(m => m.id));

// Common model name corrections
const modelCorrections = {
  'llama-3-70b': 'meta-llama/Llama-3-70b-chat-hf',
  'llama-3.1-70b': 'meta-llama/Meta-Llama-3.1-70B-Instruct',
  'code-llama-34b': 'codellama/CodeLlama-34b-Instruct-hf'
};
```

#### Issue: "Insufficient GPU capacity"
```
Error: No GPU capacity available for this model right now.
```

**Solution**: Implement model fallbacks and spot instance usage:
```javascript
const capacityFallbacks = {
  'meta-llama/Meta-Llama-3.1-405B-Instruct': [
    'meta-llama/Meta-Llama-3.1-70B-Instruct',
    'meta-llama/Llama-3-70b-chat-hf'
  ],
  'meta-llama/Meta-Llama-3.1-70B-Instruct': [
    'meta-llama/Meta-Llama-3.1-8B-Instruct',
    'meta-llama/Llama-3-8b-chat-hf'
  ]
};
```

### Debug Mode

```javascript
const router = new LLMRouter({
  providers: ['deepinfra'],
  debug: true,
  deepinfra: {
    apiKey: process.env.DEEPINFRA_API_KEY,
    logLevel: 'DEBUG',
    logRequests: true,
    logResponses: false,
    logCostMetrics: true,    // Log cost information
    logCacheStats: true      // Log cache hit/miss rates
  }
});
```

## Pricing Information

### Text Generation Models (per 1K tokens)

#### Llama 3.1 Models
- **Llama 3.1 8B Instruct**: $0.10
- **Llama 3.1 70B Instruct**: $0.70
- **Llama 3.1 405B Instruct**: $2.00

#### Llama 3 Models
- **Llama 3 8B Chat**: $0.10
- **Llama 3 70B Chat**: $0.70

#### Llama 2 Models
- **Llama 2 7B Chat**: $0.07
- **Llama 2 13B Chat**: $0.13
- **Llama 2 70B Chat**: $0.70

#### Code Models
- **Code Llama 7B**: $0.07
- **Code Llama 13B**: $0.13
- **Code Llama 34B**: $0.60

#### Other Models
- **Mixtral 8x7B**: $0.50
- **Mixtral 8x22B**: $1.20
- **Qwen 2 72B**: $0.80

### Image Generation Models (per image)
- **Stable Diffusion XL**: $0.008
- **Stable Diffusion 2.1**: $0.005
- **SDXL Turbo**: $0.003

### Additional Costs
- **Cold Starts**: No additional cost (just latency)
- **Caching**: Free (actually saves costs)
- **Spot Instances**: Up to 70% discount
- **Reserved Capacity**: Custom pricing

*DeepInfra typically offers 50-70% cost savings compared to major cloud providers. Check DeepInfra pricing for current rates.*

## Resources

- **DeepInfra Platform**: [deepinfra.com](https://deepinfra.com)
- **API Documentation**: [deepinfra.com/docs](https://deepinfra.com/docs)
- **Model Library**: [deepinfra.com/models](https://deepinfra.com/models)
- **Pricing Calculator**: [deepinfra.com/pricing](https://deepinfra.com/pricing)
- **Discord Community**: [discord.gg/deepinfra](https://discord.gg/deepinfra)
- **Status Page**: [status.deepinfra.com](https://status.deepinfra.com)

---

*Built with 💚 by Echo AI Systems*