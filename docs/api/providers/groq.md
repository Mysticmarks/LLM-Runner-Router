# ⚡ Groq Provider Documentation

Complete guide to using Groq's ultra-fast LPU inference with LLM-Runner-Router.

## What is Groq?

Groq provides the world's fastest AI inference using their revolutionary LPU (Language Processing Unit) technology. Achieve speeds of 500+ tokens/second with popular open-source models like Llama 3, Mixtral, and Gemma.

## Setup & Configuration

### API Key Setup

#### Environment Variables (Recommended)
```bash
# Required
GROQ_API_KEY=gsk_...

# Optional
GROQ_ORG_ID=org-...  # Organization ID if applicable
```

#### Programmatic Setup
```javascript
import { APILoader } from 'llm-runner-router';

const groq = new APILoader({
  provider: 'groq',
  apiKey: process.env.GROQ_API_KEY,
  organizationId: process.env.GROQ_ORG_ID,  // Optional
  defaultModel: 'mixtral-8x7b-32768'
});
```

#### Performance-Optimized Setup
```javascript
const groq = new APILoader({
  provider: 'groq',
  apiKey: process.env.GROQ_API_KEY,
  performanceMode: true,  // Enable all performance optimizations
  streaming: true,  // Always use streaming for best performance
  timeout: 10000,  // 10 second timeout for ultra-fast responses
  retryOptions: {
    maxRetries: 2,  // Fewer retries for speed
    retryDelay: 100  // Minimal delay
  }
});
```

## Performance Focus

### LPU Technology Explanation

Groq's Language Processing Unit (LPU) is purpose-built for AI inference:
- **Deterministic performance**: Consistent token generation speed
- **No memory bottlenecks**: Sequential processing optimized
- **Instant responses**: Sub-100ms first token latency
- **Massive parallelism**: Process multiple requests simultaneously

### Speed Benchmarks

| Model | Tokens/Second | First Token | Context Window | Use Case |
|-------|---------------|-------------|----------------|----------|
| `llama3-70b-8192` | 300-400 | <100ms | 8K | General purpose, fast |
| `llama3-8b-8192` | 500-800 | <50ms | 8K | Ultra-fast, lighter tasks |
| `mixtral-8x7b-32768` | 400-500 | <80ms | 32K | Complex tasks, longer context |
| `gemma-7b-it` | 600-700 | <60ms | 8K | Instruction following |
| `gemma2-9b-it` | 500-600 | <70ms | 8K | Enhanced instruction model |

### Latency Comparisons

```javascript
// Benchmark different providers
async function compareLatency() {
  const providers = {
    groq: new APILoader({ provider: 'groq' }),
    openai: new APILoader({ provider: 'openai' }),
    anthropic: new APILoader({ provider: 'anthropic' })
  };
  
  const prompt = "Write a haiku about speed";
  const results = {};
  
  for (const [name, loader] of Object.entries(providers)) {
    const start = Date.now();
    
    await loader.complete({
      model: name === 'groq' ? 'llama3-8b-8192' : 
             name === 'openai' ? 'gpt-3.5-turbo' : 
             'claude-3-haiku-20240307',
      prompt: prompt,
      maxTokens: 50
    });
    
    results[name] = {
      latency: Date.now() - start,
      tokensPerSecond: 50 / ((Date.now() - start) / 1000)
    };
  }
  
  console.table(results);
  // Typical results:
  // Groq: 150ms latency, 333 tokens/sec
  // OpenAI: 800ms latency, 62 tokens/sec
  // Anthropic: 600ms latency, 83 tokens/sec
}
```

## Available Models

### Llama 3 Models

| Model | Parameters | Context | Speed | Best For |
|-------|------------|---------|-------|----------|
| `llama3-70b-8192` | 70B | 8,192 | 300-400 tok/s | Complex reasoning, high quality |
| `llama3-8b-8192` | 8B | 8,192 | 500-800 tok/s | Ultra-fast responses, general use |

### Mixtral Models

| Model | Parameters | Context | Speed | Best For |
|-------|------------|---------|-------|----------|
| `mixtral-8x7b-32768` | 56B (MoE) | 32,768 | 400-500 tok/s | Long context, complex tasks |

### Gemma Models

| Model | Parameters | Context | Speed | Best For |
|-------|------------|---------|-------|----------|
| `gemma-7b-it` | 7B | 8,192 | 600-700 tok/s | Instructions, commands |
| `gemma2-9b-it` | 9B | 8,192 | 500-600 tok/s | Enhanced instructions |

### Model Selection for Speed

```javascript
class SpeedOptimizedGroq {
  constructor() {
    this.groq = new APILoader({ provider: 'groq' });
    
    // Models ranked by speed
    this.speedTiers = {
      ultraFast: 'llama3-8b-8192',      // 500-800 tok/s
      veryFast: 'gemma-7b-it',          // 600-700 tok/s
      fast: 'mixtral-8x7b-32768',       // 400-500 tok/s
      balanced: 'llama3-70b-8192'       // 300-400 tok/s
    };
  }
  
  async selectBySpeed(prompt, maxLatency = 1000) {
    // Estimate response time based on expected tokens
    const estimatedTokens = prompt.split(' ').length * 2;
    
    if (maxLatency < 200) {
      return this.speedTiers.ultraFast;
    } else if (maxLatency < 500) {
      return this.speedTiers.veryFast;
    } else if (maxLatency < 1000) {
      return this.speedTiers.fast;
    } else {
      return this.speedTiers.balanced;
    }
  }
  
  async complete(prompt, speedPriority = 'fast') {
    const model = this.speedTiers[speedPriority] || this.speedTiers.fast;
    
    const start = Date.now();
    const response = await this.groq.complete({
      model: model,
      prompt: prompt,
      maxTokens: 200,
      temperature: 0.7
    });
    
    const latency = Date.now() - start;
    
    return {
      ...response,
      performance: {
        latency: latency,
        tokensPerSecond: response.usage.totalTokens / (latency / 1000),
        model: model
      }
    };
  }
}
```

## Code Examples

### Speed-Optimized Generation

```javascript
import { APILoader } from 'llm-runner-router';

const groq = new APILoader({
  provider: 'groq',
  model: 'llama3-8b-8192',  // Fastest model
  streaming: true  // Stream for perceived speed
});

// Ultra-fast completion
const response = await groq.complete({
  prompt: "List 5 benefits of renewable energy",
  maxTokens: 100,
  temperature: 0.5
});

console.log(`Response time: ${response.latency}ms`);
console.log(`Tokens/sec: ${response.tokensPerSecond}`);
console.log(response.text);
```

### Performance Monitoring

```javascript
class GroqPerformanceMonitor {
  constructor() {
    this.groq = new APILoader({ provider: 'groq' });
    this.metrics = [];
  }
  
  async benchmark(model, prompts) {
    const results = [];
    
    for (const prompt of prompts) {
      const metrics = await this.measurePerformance(model, prompt);
      results.push(metrics);
      this.metrics.push(metrics);
    }
    
    return this.analyzeResults(results);
  }
  
  async measurePerformance(model, prompt) {
    const startTime = Date.now();
    let firstTokenTime = null;
    let tokenCount = 0;
    
    const stream = await this.groq.streamCompletion({
      model: model,
      prompt: prompt,
      maxTokens: 500
    });
    
    for await (const chunk of stream) {
      if (!firstTokenTime && chunk.text) {
        firstTokenTime = Date.now() - startTime;
      }
      if (chunk.text) {
        tokenCount += chunk.text.split(/\s+/).length;
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    return {
      model: model,
      promptLength: prompt.length,
      firstTokenLatency: firstTokenTime,
      totalLatency: totalTime,
      tokenCount: tokenCount,
      tokensPerSecond: tokenCount / (totalTime / 1000),
      timestamp: new Date()
    };
  }
  
  analyzeResults(results) {
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    
    return {
      avgFirstToken: avg(results.map(r => r.firstTokenLatency)),
      avgTotalLatency: avg(results.map(r => r.totalLatency)),
      avgTokensPerSecond: avg(results.map(r => r.tokensPerSecond)),
      minLatency: Math.min(...results.map(r => r.totalLatency)),
      maxLatency: Math.max(...results.map(r => r.totalLatency)),
      consistency: this.calculateConsistency(results)
    };
  }
  
  calculateConsistency(results) {
    const latencies = results.map(r => r.totalLatency);
    const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const variance = latencies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / latencies.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      mean: mean,
      stdDev: stdDev,
      coefficientOfVariation: (stdDev / mean) * 100  // Lower is more consistent
    };
  }
}

// Usage
const monitor = new GroqPerformanceMonitor();
const analysis = await monitor.benchmark('llama3-8b-8192', [
  "What is quantum computing?",
  "Explain machine learning",
  "How does blockchain work?"
]);

console.log('Performance Analysis:', analysis);
```

### Benchmark Testing

```javascript
class GroqBenchmarkSuite {
  constructor() {
    this.groq = new APILoader({ provider: 'groq' });
    this.models = [
      'llama3-70b-8192',
      'llama3-8b-8192',
      'mixtral-8x7b-32768',
      'gemma-7b-it'
    ];
  }
  
  async runComprehensiveBenchmark() {
    const tasks = {
      simple: "What is 2+2?",
      medium: "Explain the water cycle in 3 sentences.",
      complex: "Write a Python function to implement quicksort with comments.",
      creative: "Write a short poem about artificial intelligence.",
      analytical: "Compare and contrast democracy and republic forms of government.",
      longContext: "Summarize the following text: " + "Lorem ipsum ".repeat(500)
    };
    
    const results = {};
    
    for (const model of this.models) {
      results[model] = {};
      
      for (const [taskType, prompt] of Object.entries(tasks)) {
        // Skip long context for models with 8K limit
        if (taskType === 'longContext' && !model.includes('32768')) continue;
        
        const metrics = await this.benchmarkTask(model, prompt);
        results[model][taskType] = metrics;
      }
    }
    
    return this.generateReport(results);
  }
  
  async benchmarkTask(model, prompt) {
    const iterations = 3;
    const metrics = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      
      try {
        const response = await this.groq.complete({
          model: model,
          prompt: prompt,
          maxTokens: 200,
          temperature: 0.7
        });
        
        metrics.push({
          latency: Date.now() - start,
          tokens: response.usage.totalTokens,
          cost: response.cost,
          success: true
        });
      } catch (error) {
        metrics.push({
          error: error.message,
          success: false
        });
      }
    }
    
    const successful = metrics.filter(m => m.success);
    
    return {
      avgLatency: successful.reduce((sum, m) => sum + m.latency, 0) / successful.length,
      avgTokens: successful.reduce((sum, m) => sum + m.tokens, 0) / successful.length,
      avgCost: successful.reduce((sum, m) => sum + m.cost, 0) / successful.length,
      successRate: (successful.length / iterations) * 100,
      tokensPerSecond: successful[0]?.tokens / (successful[0]?.latency / 1000)
    };
  }
  
  generateReport(results) {
    console.log('=== Groq Model Benchmark Report ===\n');
    
    for (const [model, tasks] of Object.entries(results)) {
      console.log(`\nModel: ${model}`);
      console.log('─'.repeat(40));
      
      for (const [task, metrics] of Object.entries(tasks)) {
        console.log(`  ${task}:`);
        console.log(`    Latency: ${metrics.avgLatency.toFixed(0)}ms`);
        console.log(`    Tokens/sec: ${metrics.tokensPerSecond.toFixed(0)}`);
        console.log(`    Success rate: ${metrics.successRate}%`);
      }
    }
    
    return results;
  }
}

// Run comprehensive benchmark
const suite = new GroqBenchmarkSuite();
const report = await suite.runComprehensiveBenchmark();
```

### Batch Processing

```javascript
class GroqBatchProcessor {
  constructor(concurrency = 5) {
    this.groq = new APILoader({ provider: 'groq' });
    this.concurrency = concurrency;
  }
  
  async processBatch(items, processFunction) {
    const results = [];
    const queue = [...items];
    const inProgress = new Set();
    
    while (queue.length > 0 || inProgress.size > 0) {
      // Start new tasks up to concurrency limit
      while (inProgress.size < this.concurrency && queue.length > 0) {
        const item = queue.shift();
        const promise = this.processItem(item, processFunction)
          .then(result => {
            inProgress.delete(promise);
            return result;
          })
          .catch(error => {
            inProgress.delete(promise);
            return { error: error.message, item };
          });
        
        inProgress.add(promise);
        results.push(promise);
      }
      
      // Wait for at least one to complete
      if (inProgress.size > 0) {
        await Promise.race(inProgress);
      }
    }
    
    return Promise.all(results);
  }
  
  async processItem(item, processFunction) {
    const start = Date.now();
    
    const response = await this.groq.complete({
      model: 'llama3-8b-8192',  // Fast model for batch processing
      prompt: processFunction(item),
      maxTokens: 100,
      temperature: 0.5
    });
    
    return {
      input: item,
      output: response.text,
      latency: Date.now() - start,
      model: response.model
    };
  }
}

// Usage: Process 100 items with concurrency of 5
const processor = new GroqBatchProcessor(5);

const items = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  text: `Item ${i}: Process this text`
}));

const results = await processor.processBatch(
  items,
  (item) => `Summarize in one sentence: ${item.text}`
);

console.log(`Processed ${results.length} items`);
console.log(`Average latency: ${
  results.reduce((sum, r) => sum + r.latency, 0) / results.length
}ms`);
```

### Retry and Rate Limit Handling

```javascript
class RobustGroq {
  constructor() {
    this.groq = new APILoader({
      provider: 'groq',
      retryOptions: {
        maxRetries: 3,
        retryDelay: 200,
        backoffMultiplier: 1.5
      }
    });
    
    this.requestQueue = [];
    this.processing = false;
    this.rateLimit = {
      requestsPerMinute: 60,
      requestsPerSecond: 2
    };
    
    this.lastRequestTime = 0;
  }
  
  async complete(options) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ options, resolve, reject });
      this.processQueue();
    });
  }
  
  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) return;
    
    this.processing = true;
    
    while (this.requestQueue.length > 0) {
      await this.enforceRateLimit();
      
      const { options, resolve, reject } = this.requestQueue.shift();
      
      try {
        const response = await this.groqWithRetry(options);
        resolve(response);
      } catch (error) {
        reject(error);
      }
    }
    
    this.processing = false;
  }
  
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1000 / this.rateLimit.requestsPerSecond;
    
    if (timeSinceLastRequest < minInterval) {
      await sleep(minInterval - timeSinceLastRequest);
    }
    
    this.lastRequestTime = Date.now();
  }
  
  async groqWithRetry(options, attempt = 1) {
    try {
      return await this.groq.complete(options);
      
    } catch (error) {
      if (error.status === 429 && attempt <= 3) {
        // Rate limited - exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Rate limited, waiting ${delay}ms before retry ${attempt}`);
        await sleep(delay);
        return this.groqWithRetry(options, attempt + 1);
        
      } else if (error.status >= 500 && attempt <= 3) {
        // Server error - quick retry
        await sleep(500);
        return this.groqWithRetry(options, attempt + 1);
        
      } else {
        throw error;
      }
    }
  }
}

const robustGroq = new RobustGroq();

// Handles rate limiting and retries automatically
const response = await robustGroq.complete({
  model: 'mixtral-8x7b-32768',
  prompt: "Explain quantum entanglement",
  maxTokens: 200
});
```

## Best Practices

### 1. Model Selection by Task

```javascript
const TASK_MODEL_MAP = {
  // Ultra-fast responses needed
  chatbot: 'llama3-8b-8192',
  autocomplete: 'gemma-7b-it',
  
  // Balanced speed and quality
  codeGeneration: 'mixtral-8x7b-32768',
  dataAnalysis: 'mixtral-8x7b-32768',
  
  // Quality over speed
  complexReasoning: 'llama3-70b-8192',
  creativeWriting: 'llama3-70b-8192',
  
  // Long context tasks
  documentSummary: 'mixtral-8x7b-32768',
  codeReview: 'mixtral-8x7b-32768'
};

async function selectModelForTask(taskType) {
  return TASK_MODEL_MAP[taskType] || 'llama3-8b-8192';
}
```

### 2. Streaming for Perceived Performance

```javascript
class StreamingGroq {
  constructor() {
    this.groq = new APILoader({ provider: 'groq' });
  }
  
  async streamWithMetrics(options) {
    const metrics = {
      firstTokenLatency: null,
      tokens: [],
      startTime: Date.now()
    };
    
    const stream = await this.groq.streamCompletion(options);
    
    for await (const chunk of stream) {
      if (!metrics.firstTokenLatency && chunk.text) {
        metrics.firstTokenLatency = Date.now() - metrics.startTime;
        console.log(`First token in ${metrics.firstTokenLatency}ms`);
      }
      
      if (chunk.text) {
        metrics.tokens.push({
          text: chunk.text,
          timestamp: Date.now() - metrics.startTime
        });
        
        // Process/display token immediately
        process.stdout.write(chunk.text);
      }
    }
    
    metrics.totalTime = Date.now() - metrics.startTime;
    metrics.tokensPerSecond = metrics.tokens.length / (metrics.totalTime / 1000);
    
    return metrics;
  }
}
```

### 3. Optimal Temperature Settings

```javascript
const TEMPERATURE_PRESETS = {
  deterministic: 0.0,      // Same output every time
  factual: 0.3,            // Low creativity, high accuracy
  balanced: 0.7,           // Good for most tasks
  creative: 0.9,           // More varied outputs
  experimental: 1.0        // Maximum randomness
};

function getTemperatureForTask(taskType) {
  const taskTemperatures = {
    'code': 0.3,
    'analysis': 0.3,
    'summary': 0.5,
    'chat': 0.7,
    'creative': 0.9,
    'brainstorm': 1.0
  };
  
  return taskTemperatures[taskType] || 0.7;
}
```

### 4. Cost Optimization

```javascript
class CostEfficientGroq {
  constructor() {
    this.groq = new APILoader({ provider: 'groq' });
    
    // Groq pricing (example rates)
    this.pricing = {
      'llama3-70b-8192': { input: 0.59, output: 0.79 },  // per million tokens
      'llama3-8b-8192': { input: 0.05, output: 0.10 },
      'mixtral-8x7b-32768': { input: 0.27, output: 0.27 },
      'gemma-7b-it': { input: 0.10, output: 0.10 }
    };
  }
  
  estimateCost(model, inputTokens, outputTokens) {
    const modelPricing = this.pricing[model];
    
    const inputCost = (inputTokens / 1000000) * modelPricing.input;
    const outputCost = (outputTokens / 1000000) * modelPricing.output;
    
    return inputCost + outputCost;
  }
  
  async selectByCostEfficiency(prompt, requirements) {
    const estimatedInputTokens = prompt.length / 4;
    const estimatedOutputTokens = requirements.maxTokens || 200;
    
    const models = Object.keys(this.pricing);
    const options = [];
    
    for (const model of models) {
      const cost = this.estimateCost(model, estimatedInputTokens, estimatedOutputTokens);
      options.push({ model, cost });
    }
    
    options.sort((a, b) => a.cost - b.cost);
    
    // Select cheapest model that meets requirements
    for (const option of options) {
      if (this.meetsRequirements(option.model, requirements)) {
        return option.model;
      }
    }
    
    return options[0].model;  // Fallback to cheapest
  }
  
  meetsRequirements(model, requirements) {
    if (requirements.minQuality) {
      const qualityScores = {
        'llama3-70b-8192': 0.9,
        'mixtral-8x7b-32768': 0.85,
        'llama3-8b-8192': 0.75,
        'gemma-7b-it': 0.7
      };
      
      if (qualityScores[model] < requirements.minQuality) {
        return false;
      }
    }
    
    if (requirements.minContext) {
      const contextLengths = {
        'llama3-70b-8192': 8192,
        'llama3-8b-8192': 8192,
        'mixtral-8x7b-32768': 32768,
        'gemma-7b-it': 8192
      };
      
      if (contextLengths[model] < requirements.minContext) {
        return false;
      }
    }
    
    return true;
  }
}
```

### 5. Error Recovery

```javascript
class FaultTolerantGroq {
  constructor() {
    this.groq = new APILoader({ provider: 'groq' });
    this.failureLog = [];
  }
  
  async completeWithFallback(options) {
    const fallbackChain = [
      { ...options, model: options.model || 'llama3-70b-8192' },
      { ...options, model: 'mixtral-8x7b-32768', maxTokens: Math.min(options.maxTokens, 1000) },
      { ...options, model: 'llama3-8b-8192', maxTokens: Math.min(options.maxTokens, 500) },
      { ...options, model: 'gemma-7b-it', maxTokens: Math.min(options.maxTokens, 200) }
    ];
    
    for (const fallbackOptions of fallbackChain) {
      try {
        const response = await this.groq.complete(fallbackOptions);
        
        if (fallbackOptions.model !== options.model) {
          console.log(`Fallback used: ${fallbackOptions.model}`);
        }
        
        return response;
        
      } catch (error) {
        this.failureLog.push({
          model: fallbackOptions.model,
          error: error.message,
          timestamp: new Date()
        });
        
        if (error.status === 400) {
          // Bad request - don't retry with other models
          throw error;
        }
      }
    }
    
    throw new Error('All models failed');
  }
}
```

## Performance Tips

1. **Use the right model for the task**
   - `llama3-8b-8192` for speed-critical applications
   - `mixtral-8x7b-32768` for long context needs
   - `llama3-70b-8192` for complex reasoning

2. **Enable streaming always**
   - Better perceived performance
   - Allows early termination if needed
   - Provides real-time feedback

3. **Optimize prompt length**
   - Shorter prompts = faster responses
   - Remove unnecessary context
   - Use clear, concise instructions

4. **Batch when possible**
   - Process multiple requests concurrently
   - Use appropriate concurrency limits
   - Monitor rate limits

5. **Cache aggressively**
   - Groq responses are deterministic with temp=0
   - Cache common queries
   - Implement TTL based on use case

6. **Monitor performance**
   - Track first token latency
   - Measure tokens per second
   - Log model performance by task

7. **Handle failures gracefully**
   - Implement retry logic
   - Have fallback models ready
   - Log failures for analysis

8. **Use appropriate temperatures**
   - Lower = more consistent, faster
   - Higher = more creative, slower
   - Match to task requirements

9. **Set realistic timeouts**
   - Groq is fast, use short timeouts
   - 5-10 seconds usually sufficient
   - Fail fast and retry

10. **Leverage concurrency**
    - Process independent requests in parallel
    - Respect rate limits
    - Monitor resource usage

## Common Issues & Solutions

### Issue: Rate Limiting
```javascript
// Solution: Implement token bucket algorithm
class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }
  
  async getToken() {
    this.refill();
    
    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) * (1000 / this.refillRate);
      await sleep(waitTime);
      this.refill();
    }
    
    this.tokens -= 1;
  }
  
  refill() {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

const rateLimiter = new TokenBucket(60, 1);  // 60 requests per minute
```

### Issue: Timeout Errors
```javascript
// Solution: Adjust timeout based on expected response
function calculateTimeout(maxTokens, model) {
  const baseLatency = 100;  // ms
  const tokensPerSecond = {
    'llama3-8b-8192': 600,
    'llama3-70b-8192': 350,
    'mixtral-8x7b-32768': 450,
    'gemma-7b-it': 650
  };
  
  const tps = tokensPerSecond[model] || 400;
  const generationTime = (maxTokens / tps) * 1000;
  
  return baseLatency + generationTime + 1000;  // Add 1s buffer
}
```

### Issue: Inconsistent Response Times
```javascript
// Solution: Implement response time monitoring
class ResponseTimeMonitor {
  constructor(windowSize = 100) {
    this.times = [];
    this.windowSize = windowSize;
  }
  
  addTime(responseTime) {
    this.times.push(responseTime);
    if (this.times.length > this.windowSize) {
      this.times.shift();
    }
  }
  
  getStats() {
    const sorted = [...this.times].sort((a, b) => a - b);
    
    return {
      mean: this.times.reduce((a, b) => a + b, 0) / this.times.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      min: sorted[0],
      max: sorted[sorted.length - 1]
    };
  }
  
  isAnomalous(responseTime) {
    const stats = this.getStats();
    return responseTime > stats.p99;
  }
}
```

## Resources

- 📖 [Groq Documentation](https://console.groq.com/docs)
- 💰 [Groq Pricing](https://wow.groq.com/pricing/)
- 🔑 [API Console](https://console.groq.com/)
- 📊 [Playground](https://console.groq.com/playground)
- 🎮 [GroqChat Interface](https://groq.com/groqchat/)
- 📚 [Model Information](https://console.groq.com/docs/models)
- 🛠️ [API Reference](https://console.groq.com/docs/api-reference)