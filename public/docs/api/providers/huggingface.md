# Hugging Face Provider Guide

Comprehensive guide for integrating and using Hugging Face models through the LLM Router system.

## Overview

Hugging Face provides access to thousands of open-source models through their Inference API and Transformers library. This guide covers integration with Hugging Face's extensive model ecosystem, including text generation, embeddings, and specialized models.

## Quick Start

### Basic Setup

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['huggingface'],
  huggingface: {
    apiKey: process.env.HUGGINGFACE_API_KEY,
    baseURL: 'https://api-inference.huggingface.co'
  }
});

// Generate with open-source model
const response = await router.generate({
  model: 'microsoft/DialoGPT-large',
  prompt: 'Hello, how are you today?',
  maxTokens: 100
});

console.log(response.text);
```

### Environment Variables

```bash
# Required for Inference API
HUGGINGFACE_API_KEY=hf_your_token_here

# Optional
HUGGINGFACE_BASE_URL=https://api-inference.huggingface.co
HUGGINGFACE_CACHE_DIR=/path/to/cache  # For local inference
```

## Configuration

### Complete Configuration Options

```javascript
const router = new LLMRouter({
  providers: ['huggingface'],
  huggingface: {
    // Authentication
    apiKey: process.env.HUGGINGFACE_API_KEY,
    
    // API Settings
    baseURL: 'https://api-inference.huggingface.co',
    timeout: 30000,
    maxRetries: 3,
    
    // Model Loading Options
    waitForModel: true, // Wait for model to load if cold
    useCache: true,     // Use cached results
    
    // Local Inference (optional)
    useLocal: false,
    cacheDir: './models',
    device: 'auto', // 'cpu', 'cuda', 'auto'
    
    // Rate Limiting
    rateLimit: {
      requestsPerMinute: 100,
      requestsPerHour: 1000
    },
    
    // Default Parameters
    defaults: {
      temperature: 0.7,
      maxTokens: 200,
      topP: 0.9,
      topK: 50,
      repetitionPenalty: 1.1
    }
  }
});
```

### Hub Integration

```javascript
// Search and discover models
const models = await router.searchModels('huggingface', {
  task: 'text-generation',
  language: 'en',
  tags: ['conversational'],
  sort: 'downloads',
  limit: 10
});

console.log('Available models:', models);

// Get model information
const modelInfo = await router.getModelInfo('microsoft/DialoGPT-large');
console.log('Model details:', modelInfo);
```

## Model Categories

### Text Generation Models

```javascript
// Conversational AI
const response = await router.generate({
  model: 'microsoft/DialoGPT-large',
  prompt: 'Hello! How can I help you today?',
  maxTokens: 150
});

// Large Language Models
const response = await router.generate({
  model: 'bigscience/bloom-560m',
  prompt: 'Explain quantum computing in simple terms',
  maxTokens: 300
});

// Code Generation
const codeResponse = await router.generate({
  model: 'Salesforce/codegen-350M-mono',
  prompt: 'def fibonacci(n):',
  maxTokens: 200,
  temperature: 0.2
});
```

### Specialized Models

```javascript
// Instruction Following
const instructResponse = await router.generate({
  model: 'microsoft/DialoGPT-medium',
  messages: [
    { role: 'user', content: 'Write a Python function to sort a list' }
  ],
  maxTokens: 250
});

// Creative Writing
const storyResponse = await router.generate({
  model: 'gpt2-large',
  prompt: 'Once upon a time in a distant galaxy',
  maxTokens: 500,
  temperature: 0.8
});

// Technical Documentation
const docsResponse = await router.generate({
  model: 'microsoft/DialoGPT-large',
  prompt: 'Explain how to use React hooks',
  maxTokens: 400
});
```

### Popular Model Examples

| Model | Size | Use Case | Speed | Quality |
|-------|------|----------|-------|---------|
| `microsoft/DialoGPT-large` | 774M | Conversations | Fast | Good |
| `bigscience/bloom-560m` | 560M | General text | Fast | Good |
| `Salesforce/codegen-350M-mono` | 350M | Code generation | Very Fast | Good |
| `EleutherAI/gpt-j-6B` | 6B | High-quality text | Slow | Excellent |
| `huggingface/CodeBERTa-small-v1` | 84M | Code understanding | Very Fast | Good |

## Advanced Features

### 1. Custom Model Loading

```javascript
class HuggingFaceModelManager {
  constructor(router) {
    this.router = router;
    this.loadedModels = new Set();
  }

  async loadModel(modelId, options = {}) {
    if (this.loadedModels.has(modelId)) {
      return modelId;
    }

    console.log(`Loading model: ${modelId}`);
    
    // Check model status
    const status = await this.checkModelStatus(modelId);
    
    if (status === 'loading') {
      console.log('Model is loading, waiting...');
      await this.waitForModel(modelId);
    }

    this.loadedModels.add(modelId);
    return modelId;
  }

  async checkModelStatus(modelId) {
    try {
      const response = await fetch(
        `https://api-inference.huggingface.co/models/${modelId}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`
          }
        }
      );

      if (response.status === 503) {
        return 'loading';
      } else if (response.ok) {
        return 'ready';
      } else {
        return 'error';
      }
    } catch (error) {
      return 'error';
    }
  }

  async waitForModel(modelId, maxWait = 120000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const status = await this.checkModelStatus(modelId);
      
      if (status === 'ready') {
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error(`Model ${modelId} failed to load within ${maxWait}ms`);
  }
}
```

### 2. Model Comparison

```javascript
class ModelComparison {
  constructor(router) {
    this.router = router;
  }

  async compareModels(prompt, models, maxTokens = 200) {
    const results = await Promise.all(
      models.map(async model => {
        try {
          const startTime = Date.now();
          
          const response = await this.router.generate({
            model,
            prompt,
            maxTokens,
            temperature: 0.7
          });
          
          const latency = Date.now() - startTime;
          
          return {
            model,
            text: response.text,
            latency,
            tokenCount: response.usage?.totalTokens || 0,
            success: true
          };
        } catch (error) {
          return {
            model,
            error: error.message,
            success: false
          };
        }
      })
    );

    return this.analyzeResults(results);
  }

  analyzeResults(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    const avgLatency = successful.reduce((sum, r) => sum + r.latency, 0) / successful.length;
    const avgTokens = successful.reduce((sum, r) => sum + r.tokenCount, 0) / successful.length;

    return {
      summary: {
        successful: successful.length,
        failed: failed.length,
        avgLatency: Math.round(avgLatency),
        avgTokens: Math.round(avgTokens)
      },
      results: results.sort((a, b) => a.latency - b.latency),
      fastest: successful.sort((a, b) => a.latency - b.latency)[0],
      longestResponse: successful.sort((a, b) => b.text.length - a.text.length)[0]
    };
  }
}
```

### 3. Local Model Inference

```javascript
// Configuration for local inference
const localRouter = new LLMRouter({
  providers: ['huggingface'],
  huggingface: {
    useLocal: true,
    modelPath: './models',
    device: 'cpu', // or 'cuda' if available
    cacheDir: './cache',
    
    // Local inference settings
    localSettings: {
      maxMemory: '8GB',
      quantization: '8bit', // Reduce memory usage
      loadInFp16: true,
      deviceMap: 'auto'
    }
  }
});

// Download and use model locally
await localRouter.downloadModel('microsoft/DialoGPT-medium');

const response = await localRouter.generate({
  model: 'microsoft/DialoGPT-medium',
  prompt: 'Hello, world!',
  maxTokens: 100
});
```

### 4. Embeddings and Feature Extraction

```javascript
// Generate embeddings
const embeddings = await router.generateEmbedding({
  model: 'sentence-transformers/all-MiniLM-L6-v2',
  input: [
    'This is the first sentence.',
    'Here is another sentence.',
    'And one more example.'
  ]
});

// Calculate similarity
function cosineSimilarity(a, b) {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

const similarity = cosineSimilarity(
  embeddings.data[0].embedding,
  embeddings.data[1].embedding
);

console.log('Similarity:', similarity);
```

## Production Patterns

### 1. Model Pipeline

```javascript
class HuggingFacePipeline {
  constructor() {
    this.router = new LLMRouter({
      providers: ['huggingface'],
      huggingface: {
        apiKey: process.env.HUGGINGFACE_API_KEY
      }
    });
    
    this.models = {
      classifier: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
      generator: 'microsoft/DialoGPT-large',
      embedder: 'sentence-transformers/all-MiniLM-L6-v2'
    };
  }

  async processText(text) {
    // Step 1: Analyze sentiment
    const sentiment = await this.classifyText(text);
    
    // Step 2: Generate response based on sentiment
    const response = await this.generateResponse(text, sentiment);
    
    // Step 3: Create embeddings for storage
    const embedding = await this.createEmbedding(response);
    
    return {
      originalText: text,
      sentiment,
      response,
      embedding
    };
  }

  async classifyText(text) {
    const result = await this.router.classify({
      model: this.models.classifier,
      input: text
    });
    
    return result.labels[0];
  }

  async generateResponse(text, sentiment) {
    const prompt = this.buildPrompt(text, sentiment);
    
    const response = await this.router.generate({
      model: this.models.generator,
      prompt,
      maxTokens: 150,
      temperature: 0.7
    });
    
    return response.text;
  }

  async createEmbedding(text) {
    const embedding = await this.router.generateEmbedding({
      model: this.models.embedder,
      input: text
    });
    
    return embedding.data[0].embedding;
  }

  buildPrompt(text, sentiment) {
    const sentimentMap = {
      'POSITIVE': 'enthusiastic and helpful',
      'NEGATIVE': 'empathetic and supportive',
      'NEUTRAL': 'informative and balanced'
    };
    
    const tone = sentimentMap[sentiment] || 'helpful';
    
    return `Respond to the following message in a ${tone} way:\n\n"${text}"\n\nResponse:`;
  }
}
```

### 2. Model Fallback System

```javascript
class HuggingFaceFallbackSystem {
  constructor() {
    this.router = new LLMRouter({
      providers: ['huggingface'],
      huggingface: {
        apiKey: process.env.HUGGINGFACE_API_KEY
      }
    });
    
    this.modelTiers = {
      fast: ['microsoft/DialoGPT-small', 'gpt2'],
      balanced: ['microsoft/DialoGPT-medium', 'gpt2-medium'],
      quality: ['microsoft/DialoGPT-large', 'EleutherAI/gpt-neo-1.3B']
    };
  }

  async generateWithFallback(prompt, preferredTier = 'balanced', maxTokens = 200) {
    const models = this.modelTiers[preferredTier] || this.modelTiers.balanced;
    
    for (const model of models) {
      try {
        console.log(`Trying model: ${model}`);
        
        const response = await this.router.generate({
          model,
          prompt,
          maxTokens,
          temperature: 0.7,
          timeout: 30000
        });
        
        return {
          ...response,
          modelUsed: model,
          tier: preferredTier
        };
      } catch (error) {
        console.log(`Model ${model} failed:`, error.message);
        
        if (error.status === 503) {
          // Model loading, try next one
          continue;
        } else if (error.status === 429) {
          // Rate limited, wait and try next
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        } else {
          // Other error, try next model
          continue;
        }
      }
    }
    
    throw new Error(`All models in tier '${preferredTier}' failed`);
  }

  async generateWithMultipleTiers(prompt, maxTokens = 200) {
    const tiers = ['fast', 'balanced', 'quality'];
    
    for (const tier of tiers) {
      try {
        return await this.generateWithFallback(prompt, tier, maxTokens);
      } catch (error) {
        console.log(`Tier '${tier}' failed:`, error.message);
        
        if (tier === 'quality') {
          throw new Error('All tiers exhausted');
        }
      }
    }
  }
}
```

### 3. Cost-Effective Usage

```javascript
class HuggingFaceCostOptimizer {
  constructor() {
    this.router = new LLMRouter({
      providers: ['huggingface'],
      huggingface: {
        apiKey: process.env.HUGGINGFACE_API_KEY,
        useCache: true,
        waitForModel: false // Don't wait for cold models
      }
    });
    
    this.cache = new Map();
    this.usage = {
      requests: 0,
      cacheHits: 0,
      costs: 0
    };
  }

  async generate(prompt, options = {}) {
    // Check cache first
    const cacheKey = this.getCacheKey(prompt, options);
    if (this.cache.has(cacheKey)) {
      this.usage.cacheHits++;
      return this.cache.get(cacheKey);
    }

    // Select cost-effective model
    const model = this.selectOptimalModel(prompt, options);
    
    try {
      const response = await this.router.generate({
        ...options,
        model,
        prompt
      });
      
      // Cache successful response
      this.cache.set(cacheKey, response);
      this.usage.requests++;
      
      return response;
    } catch (error) {
      if (error.status === 503) {
        // Try smaller, faster model
        return this.generateWithFallback(prompt, options);
      }
      throw error;
    }
  }

  selectOptimalModel(prompt, options) {
    const promptLength = prompt.length;
    const maxTokens = options.maxTokens || 200;
    
    // For short prompts and responses, use smaller models
    if (promptLength < 100 && maxTokens < 100) {
      return 'gpt2';
    } else if (promptLength < 500 && maxTokens < 300) {
      return 'microsoft/DialoGPT-medium';
    } else {
      return 'microsoft/DialoGPT-large';
    }
  }

  async generateWithFallback(prompt, options) {
    const fallbackModels = ['gpt2', 'microsoft/DialoGPT-small'];
    
    for (const model of fallbackModels) {
      try {
        return await this.router.generate({
          ...options,
          model,
          prompt,
          maxTokens: Math.min(options.maxTokens || 200, 150) // Reduce tokens for fallback
        });
      } catch (error) {
        console.log(`Fallback model ${model} failed:`, error.message);
      }
    }
    
    throw new Error('All fallback models failed');
  }

  getCacheKey(prompt, options) {
    return JSON.stringify({ prompt, model: options.model, maxTokens: options.maxTokens });
  }

  getUsageStats() {
    return {
      ...this.usage,
      cacheHitRate: (this.usage.cacheHits / (this.usage.requests + this.usage.cacheHits)) * 100,
      cacheSize: this.cache.size
    };
  }
}
```

## Error Handling

### Common Error Patterns

```javascript
class HuggingFaceErrorHandler {
  constructor(router) {
    this.router = router;
  }

  async robustGenerate(request, maxRetries = 3) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.router.generate(request);
      } catch (error) {
        lastError = error;

        if (this.shouldRetry(error, attempt)) {
          const delay = this.getRetryDelay(error, attempt);
          console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Adjust request for retry
          request = this.adjustRequestForRetry(request, error);
          continue;
        }

        break;
      }
    }

    throw lastError;
  }

  shouldRetry(error, attempt) {
    // Model loading (503)
    if (error.status === 503) return true;
    
    // Rate limiting (429)
    if (error.status === 429) return true;
    
    // Server errors (5xx)
    if (error.status >= 500) return true;
    
    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return true;
    
    return false;
  }

  getRetryDelay(error, attempt) {
    if (error.status === 503) {
      // Model loading - wait longer
      return Math.min(30000, 5000 * (attempt + 1));
    } else if (error.status === 429) {
      // Rate limiting - exponential backoff
      return Math.min(60000, 1000 * Math.pow(2, attempt));
    } else {
      // Other errors - standard backoff
      return Math.min(10000, 1000 * (attempt + 1));
    }
  }

  adjustRequestForRetry(request, error) {
    if (error.status === 503) {
      // Model loading - try smaller model
      const smallerModels = {
        'microsoft/DialoGPT-large': 'microsoft/DialoGPT-medium',
        'microsoft/DialoGPT-medium': 'microsoft/DialoGPT-small',
        'gpt2-large': 'gpt2-medium',
        'gpt2-medium': 'gpt2'
      };
      
      if (smallerModels[request.model]) {
        return { ...request, model: smallerModels[request.model] };
      }
    }
    
    return request;
  }
}
```

## Testing and Development

### Model Testing Framework

```javascript
class HuggingFaceModelTester {
  constructor() {
    this.router = new LLMRouter({
      providers: ['huggingface'],
      huggingface: {
        apiKey: process.env.HUGGINGFACE_API_KEY
      }
    });
  }

  async testModel(modelId, testCases) {
    console.log(`Testing model: ${modelId}`);
    
    const results = [];
    
    for (const testCase of testCases) {
      try {
        const startTime = Date.now();
        
        const response = await this.router.generate({
          model: modelId,
          prompt: testCase.prompt,
          maxTokens: testCase.maxTokens || 100,
          temperature: testCase.temperature || 0.7
        });
        
        const latency = Date.now() - startTime;
        
        const result = {
          testCase: testCase.name,
          prompt: testCase.prompt,
          response: response.text,
          latency,
          tokenCount: response.usage?.totalTokens || 0,
          passed: this.evaluateResponse(response.text, testCase.expected),
          success: true
        };
        
        results.push(result);
        
      } catch (error) {
        results.push({
          testCase: testCase.name,
          prompt: testCase.prompt,
          error: error.message,
          success: false,
          passed: false
        });
      }
    }
    
    return this.generateTestReport(modelId, results);
  }

  evaluateResponse(response, expected) {
    if (!expected) return true;
    
    if (typeof expected === 'string') {
      return response.toLowerCase().includes(expected.toLowerCase());
    } else if (typeof expected === 'function') {
      return expected(response);
    } else if (Array.isArray(expected)) {
      return expected.some(exp => response.toLowerCase().includes(exp.toLowerCase()));
    }
    
    return true;
  }

  generateTestReport(modelId, results) {
    const passed = results.filter(r => r.passed);
    const failed = results.filter(r => !r.passed);
    const successful = results.filter(r => r.success);
    
    const avgLatency = successful.reduce((sum, r) => sum + (r.latency || 0), 0) / successful.length;
    const avgTokens = successful.reduce((sum, r) => sum + (r.tokenCount || 0), 0) / successful.length;
    
    return {
      model: modelId,
      summary: {
        total: results.length,
        passed: passed.length,
        failed: failed.length,
        successRate: (passed.length / results.length) * 100,
        avgLatency: Math.round(avgLatency),
        avgTokens: Math.round(avgTokens)
      },
      details: results
    };
  }
}

// Usage example
const tester = new HuggingFaceModelTester();

const testCases = [
  {
    name: 'greeting',
    prompt: 'Hello, how are you?',
    expected: ['hello', 'hi', 'good', 'fine'],
    maxTokens: 50
  },
  {
    name: 'math',
    prompt: 'What is 2 + 2?',
    expected: '4',
    maxTokens: 20
  },
  {
    name: 'creative',
    prompt: 'Write a short poem about nature.',
    expected: (response) => response.length > 50,
    maxTokens: 100
  }
];

await tester.testModel('microsoft/DialoGPT-medium', testCases);
```

## Best Practices

### 1. Model Selection
- Use smaller models (GPT-2, DialoGPT-small) for simple tasks and prototyping
- Choose task-specific models for better performance (e.g., CodeGen for code)
- Consider model loading time vs quality tradeoffs
- Test multiple models to find the best fit for your use case

### 2. Performance Optimization
- Enable caching to avoid redundant API calls
- Use smaller models for development and testing
- Implement proper error handling and fallbacks
- Monitor model loading status to avoid timeouts

### 3. Cost Management
- Hugging Face Inference API is free with rate limits
- Consider local inference for high-volume applications
- Use model comparison to find optimal cost/quality balance
- Implement caching to reduce API usage

### 4. Error Handling
- Handle model loading delays (503 errors) gracefully
- Implement fallback chains for reliability
- Monitor rate limits and implement backoff strategies
- Test error scenarios thoroughly

---

**Related:** [Hugging Face Hub](https://huggingface.co/models) | **Next:** [Local Inference Provider](./local.md)