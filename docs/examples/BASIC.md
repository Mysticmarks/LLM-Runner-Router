# Basic Usage Examples

Complete guide to getting started with LLM-Runner-Router, from simple imports to intermediate use cases.

## Table of Contents
- [Quick Start](#quick-start)
- [Loading Models](#loading-models)
- [Basic Inference](#basic-inference)
- [Configuration](#configuration)
- [Environment Detection](#environment-detection)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

## Quick Start

### Installation & First Run

```bash
npm install llm-runner-router
```

**Simple Browser Usage:**
```html
<!DOCTYPE html>
<html>
<head>
    <title>LLM Router Demo</title>
</head>
<body>
    <script type="module">
        import LLMRouter from 'llm-runner-router';
        
        // Auto-initializes on import
        const response = await LLMRouter.quick("Hello, world!");
        console.log(response.text);
    </script>
</body>
</html>
```

**Simple Node.js Usage:**
```javascript
import LLMRouter from 'llm-runner-router';

// Quick inference with default model
const response = await LLMRouter.quick("Explain quantum computing");
console.log(response.text);
```

**Expected Output:**
```json
{
  "text": "Quantum computing is a revolutionary computing paradigm...",
  "tokens": 127,
  "model": "llama-7b-q4",
  "latency": 245,
  "cached": false
}
```

## Loading Models

### 1. Simple Model Loading

```javascript
import LLMRouter from 'llm-runner-router';

const router = new LLMRouter();
await router.initialize();

// Load from local file
const model1 = await router.load('models/llama-7b.gguf');

// Load from URL
const model2 = await router.load('https://example.com/model.gguf');

// Load from HuggingFace Hub
const model3 = await router.load('huggingface:microsoft/DialoGPT-medium');

console.log('Models loaded:', model1.id, model2.id, model3.id);
```

### 2. Advanced Model Loading

```javascript
import LLMRouter from 'llm-runner-router';

const router = new LLMRouter();
await router.initialize();

// Detailed model specification
const model = await router.load({
  source: 'models/llama-13b.gguf',
  format: 'gguf',
  immediate: false, // Lazy loading
  config: {
    quantization: 'q4_k_m',
    context: 4096,
    threads: 4,
    gpu_layers: 35
  }
});

console.log('Model ready:', model.name);
console.log('Context size:', model.contextSize);
console.log('Parameters:', model.parameters);
```

### 3. Model Registry Management

```javascript
import LLMRouter from 'llm-runner-router';

const router = new LLMRouter();
await router.initialize();

// Load multiple models
await router.load('models/llama-7b.gguf');
await router.load('models/codellama-7b.gguf');
await router.load('models/mistral-7b.gguf');

// List all loaded models
const models = router.registry.list();
console.log('Available models:', models.map(m => m.name));

// Search for specific models
const codeModels = router.registry.search({
  name: 'code',
  capabilities: ['completion']
});
console.log('Code models:', codeModels);

// Get specific model
const llamaModel = router.registry.get('llama-7b');
console.log('Model info:', llamaModel.getInfo());
```

## Basic Inference

### 1. Quick Inference

```javascript
import { quick } from 'llm-runner-router';

// Simple text generation
const result = await quick("Write a haiku about programming");

console.log(result.text);
// Output: "Code flows like water,\nBugs surface, then disappear,\nLogic finds its way."

// With custom options
const customResult = await quick("Explain recursion", {
  maxTokens: 200,
  temperature: 0.3,
  topP: 0.9
});

console.log('Generated tokens:', customResult.tokens);
console.log('Model used:', customResult.model);
console.log('Response time:', customResult.latency, 'ms');
```

### 2. Advanced Inference

```javascript
import LLMRouter from 'llm-runner-router';

const router = new LLMRouter();
await router.initialize();

const response = await router.advanced({
  prompt: "Create a REST API endpoint for user management",
  model: "codellama-7b", // Specific model
  temperature: 0.2, // Lower for code generation
  maxTokens: 500,
  topK: 20,
  fallbacks: ['llama-7b', 'mistral-7b'], // Backup models
  timeout: 30000, // 30 seconds
  retries: 3
});

console.log('Generated code:');
console.log(response.text);
```

### 3. Conversational Interface

```javascript
import LLMRouter from 'llm-runner-router';

const router = new LLMRouter({
  strategy: 'quality-first'
});

class ChatSession {
  constructor() {
    this.history = [];
  }
  
  async ask(question) {
    // Build context from history
    const context = this.history.map(h => 
      `Human: ${h.question}\nAssistant: ${h.answer}`
    ).join('\n\n');
    
    const fullPrompt = `${context}\n\nHuman: ${question}\nAssistant:`;
    
    const response = await router.quick(fullPrompt, {
      maxTokens: 300,
      temperature: 0.7,
      cache: true
    });
    
    // Save to history
    this.history.push({
      question,
      answer: response.text
    });
    
    return response;
  }
}

// Usage
const chat = new ChatSession();
const response1 = await chat.ask("What is machine learning?");
console.log(response1.text);

const response2 = await chat.ask("Can you give me a practical example?");
console.log(response2.text);
```

## Configuration

### 1. Router Configuration

```javascript
import LLMRouter from 'llm-runner-router';

const router = new LLMRouter({
  strategy: 'balanced', // Routing strategy
  maxModels: 10, // Max models in registry
  cacheTTL: 3600000, // 1 hour cache
  autoInit: false, // Manual initialization
  logLevel: 'info', // Logging level
  retryConfig: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 1000
  }
});

// Initialize manually
await router.initialize();

// Update config at runtime
router.updateConfig({
  strategy: 'speed-priority',
  maxTokens: 1000
});

console.log('Current config:', router.getConfig());
```

### 2. Model-Specific Configuration

```javascript
import LLMRouter from 'llm-runner-router';

const router = new LLMRouter();

// Configure model with specific parameters
const model = await router.load({
  source: 'models/llama-7b.gguf',
  config: {
    // Model loading configuration
    quantization: 'q4_k_m',
    context: 2048,
    threads: Math.min(4, navigator.hardwareConcurrency || 4),
    
    // Generation defaults
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    repetition_penalty: 1.1,
    
    // Performance settings
    batch_size: 512,
    gpu_layers: -1, // Use all available GPU layers
    mlock: true, // Keep model in memory
    
    // Safety settings
    max_tokens: 2048,
    stop_sequences: ['\n\n', '<|endoftext|>']
  }
});

console.log('Model configured:', model.name);
```

### 3. Environment-Specific Configuration

```javascript
import LLMRouter from 'llm-runner-router';

// Detect environment and configure accordingly
const isNode = typeof process !== 'undefined';
const isBrowser = typeof window !== 'undefined';
const hasWebGPU = 'gpu' in navigator;

const config = {
  // Base configuration
  strategy: 'balanced',
  logLevel: 'info',
  
  // Environment-specific settings
  ...(isNode && {
    // Node.js specific
    cachePath: './models/cache/',
    threads: Math.min(8, require('os').cpus().length),
    preferredEngine: 'node'
  }),
  
  ...(isBrowser && {
    // Browser specific
    preferredEngine: hasWebGPU ? 'webgpu' : 'wasm',
    maxMemory: '2GB',
    offscreenCanvas: true
  })
};

const router = new LLMRouter(config);
await router.initialize();

console.log('Environment:', router.getStatus().environment);
console.log('Engine:', router.getStatus().engine);
```

## Environment Detection

### 1. Automatic Environment Detection

```javascript
import LLMRouter from 'llm-runner-router';

const router = new LLMRouter();
await router.initialize();

const status = router.getStatus();
console.log('Environment detected:', status.environment);
console.log('Engine selected:', status.engine);
console.log('Available engines:', router.getAvailableEngines());

// Environment-specific behavior
switch (status.environment) {
  case 'browser':
    console.log('Running in browser - WebGPU or WASM available');
    break;
  case 'node':
    console.log('Running in Node.js - Full native support');
    break;
  case 'deno':
    console.log('Running in Deno - Modern runtime features');
    break;
  case 'worker':
    console.log('Running in Web Worker - Offscreen processing');
    break;
}
```

### 2. Manual Engine Selection

```javascript
import LLMRouter from 'llm-runner-router';

const router = new LLMRouter();
await router.initialize();

// Check available engines
const engines = router.getAvailableEngines();
console.log('Available engines:', engines);

// Try to use WebGPU first
if (engines.includes('webgpu')) {
  await router.setEngine('webgpu');
  console.log('Using WebGPU for acceleration');
} else if (engines.includes('wasm')) {
  await router.setEngine('wasm');
  console.log('Using WASM fallback');
} else {
  await router.setEngine('node');
  console.log('Using Node.js engine');
}

console.log('Current engine:', router.getEngine().name);
```

## Error Handling

### 1. Basic Error Handling

```javascript
import LLMRouter, { 
  ModelNotFoundError, 
  EngineError, 
  TimeoutError 
} from 'llm-runner-router';

const router = new LLMRouter();

try {
  await router.initialize();
  const response = await router.quick("Hello world");
  console.log(response.text);
} catch (error) {
  if (error instanceof ModelNotFoundError) {
    console.error('No suitable model found:', error.message);
    // Try loading a default model
    await router.load('huggingface:gpt2');
    const response = await router.quick("Hello world");
    console.log('Fallback response:', response.text);
  } else if (error instanceof EngineError) {
    console.error('Engine initialization failed:', error.message);
    // Try different engine
    await router.setEngine('wasm');
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out:', error.message);
    // Retry with longer timeout
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### 2. Graceful Degradation

```javascript
import LLMRouter from 'llm-runner-router';

class RobustLLMService {
  constructor() {
    this.router = new LLMRouter({
      retryConfig: {
        maxAttempts: 3,
        backoff: 'exponential'
      }
    });
    this.fallbackModels = [
      'huggingface:gpt2',
      'huggingface:distilgpt2'
    ];
  }
  
  async generate(prompt, options = {}) {
    try {
      await this.router.initialize();
      return await this.router.quick(prompt, options);
    } catch (error) {
      console.warn('Primary generation failed, trying fallbacks...');
      
      // Try fallback models
      for (const fallback of this.fallbackModels) {
        try {
          await this.router.load(fallback);
          return await this.router.quick(prompt, {
            ...options,
            maxTokens: Math.min(options.maxTokens || 500, 100) // Shorter response
          });
        } catch (fallbackError) {
          console.warn(`Fallback ${fallback} failed:`, fallbackError.message);
        }
      }
      
      // Final fallback - return error message
      return {
        text: "I apologize, but I'm unable to process your request right now. Please try again later.",
        error: true,
        originalError: error.message
      };
    }
  }
}

// Usage
const service = new RobustLLMService();
const response = await service.generate("Explain photosynthesis");
console.log(response.text);
```

### 3. Resource Management

```javascript
import LLMRouter from 'llm-runner-router';

class ManagedLLMRouter {
  constructor() {
    this.router = null;
    this.cleanupCallbacks = [];
  }
  
  async initialize() {
    this.router = new LLMRouter({
      maxModels: 5, // Limit memory usage
      cacheTTL: 1800000 // 30 minutes
    });
    
    await this.router.initialize();
    
    // Setup cleanup on process exit
    const cleanup = () => this.cleanup();
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
    
    // Monitor memory usage
    this.monitorMemory();
  }
  
  async cleanup() {
    console.log('Cleaning up resources...');
    if (this.router) {
      await this.router.cleanup();
      this.router = null;
    }
    
    // Run additional cleanup callbacks
    for (const callback of this.cleanupCallbacks) {
      await callback();
    }
  }
  
  monitorMemory() {
    setInterval(() => {
      if (typeof process !== 'undefined') {
        const usage = process.memoryUsage();
        const usedMB = usage.heapUsed / 1024 / 1024;
        
        if (usedMB > 1000) { // 1GB threshold
          console.warn(`High memory usage: ${usedMB.toFixed(2)}MB`);
          // Could trigger cleanup of unused models
        }
      }
    }, 30000); // Check every 30 seconds
  }
  
  async generate(prompt, options) {
    if (!this.router) {
      await this.initialize();
    }
    return this.router.quick(prompt, options);
  }
}

// Usage
const managed = new ManagedLLMRouter();
const response = await managed.generate("Hello world");
console.log(response.text);

// Cleanup will happen automatically on exit
```

## Best Practices

### 1. Performance Optimization

```javascript
import LLMRouter from 'llm-runner-router';

// Optimized configuration for production
const router = new LLMRouter({
  strategy: 'speed-priority', // Fast responses
  cacheTTL: 7200000, // 2 hours - balance freshness and performance
  maxModels: 3, // Limit memory usage
  retryConfig: {
    maxAttempts: 2, // Quick failures
    initialDelay: 500
  }
});

await router.initialize();

// Pre-load commonly used models
const commonModels = [
  'models/chat-7b.gguf',
  'models/code-7b.gguf'
];

for (const modelPath of commonModels) {
  await router.load({
    source: modelPath,
    immediate: false // Lazy loading
  });
}

// Use consistent options for better caching
const standardOptions = {
  temperature: 0.7,
  maxTokens: 500,
  topP: 0.9
};

// Example usage
const response = await router.quick("Explain async/await", standardOptions);
console.log(response.text);
```

### 2. Structured Development Pattern

```javascript
// services/llm-service.js
import LLMRouter from 'llm-runner-router';

export class LLMService {
  constructor(config = {}) {
    this.router = new LLMRouter({
      strategy: 'balanced',
      ...config
    });
    this.ready = false;
  }
  
  async initialize() {
    if (this.ready) return;
    
    await this.router.initialize();
    
    // Load application-specific models
    await this.loadModels();
    
    this.ready = true;
  }
  
  async loadModels() {
    // Define your application's model requirements
    const models = [
      { id: 'chat', source: 'models/llama-7b.gguf', primary: true },
      { id: 'code', source: 'models/codellama-7b.gguf', primary: false },
      { id: 'summary', source: 'huggingface:facebook/bart-large-cnn', primary: false }
    ];
    
    for (const model of models) {
      try {
        await this.router.load({
          source: model.source,
          immediate: model.primary
        });
        console.log(`✅ Loaded ${model.id} model`);
      } catch (error) {
        console.error(`❌ Failed to load ${model.id}:`, error.message);
      }
    }
  }
  
  async chat(message, context = []) {
    await this.initialize();
    
    const prompt = this.buildChatPrompt(message, context);
    return this.router.quick(prompt, {
      maxTokens: 300,
      temperature: 0.8
    });
  }
  
  async generateCode(description, language = 'javascript') {
    await this.initialize();
    
    const prompt = `Generate ${language} code for: ${description}\n\nCode:`;
    return this.router.advanced({
      prompt,
      model: 'code',
      temperature: 0.2,
      maxTokens: 500
    });
  }
  
  buildChatPrompt(message, context) {
    const history = context.map(c => 
      `Human: ${c.human}\nAssistant: ${c.assistant}`
    ).join('\n\n');
    
    return `${history}\n\nHuman: ${message}\nAssistant:`;
  }
}

// app.js - Usage in application
import { LLMService } from './services/llm-service.js';

const llm = new LLMService();

// Application startup
await llm.initialize();

// Use throughout application
const chatResponse = await llm.chat("Hello!");
const codeResponse = await llm.generateCode("Create a fibonacci function", "python");

console.log('Chat:', chatResponse.text);
console.log('Code:', codeResponse.text);
```

### 3. Testing and Validation

```javascript
import LLMRouter from 'llm-runner-router';

// Test utility for validating model responses
class ModelTester {
  constructor() {
    this.router = new LLMRouter({
      logLevel: 'error' // Quiet during tests
    });
  }
  
  async testModel(modelSpec, testCases) {
    await this.router.initialize();
    
    try {
      const model = await this.router.load(modelSpec);
      console.log(`Testing model: ${model.name}`);
      
      const results = [];
      
      for (const testCase of testCases) {
        const startTime = Date.now();
        
        try {
          const response = await this.router.advanced({
            prompt: testCase.input,
            model: model.id,
            maxTokens: testCase.maxTokens || 100,
            temperature: testCase.temperature || 0.3
          });
          
          const result = {
            input: testCase.input,
            output: response.text,
            tokens: response.tokens,
            latency: Date.now() - startTime,
            expected: testCase.expected,
            passed: testCase.validator ? testCase.validator(response.text) : true
          };
          
          results.push(result);
          
        } catch (error) {
          results.push({
            input: testCase.input,
            error: error.message,
            passed: false
          });
        }
      }
      
      return this.analyzeResults(results);
      
    } finally {
      await this.router.cleanup();
    }
  }
  
  analyzeResults(results) {
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const avgLatency = results
      .filter(r => r.latency)
      .reduce((sum, r) => sum + r.latency, 0) / results.length;
    
    return {
      summary: {
        passed,
        total,
        successRate: (passed / total) * 100,
        avgLatency: Math.round(avgLatency)
      },
      details: results
    };
  }
}

// Example test suite
const testCases = [
  {
    input: "What is 2 + 2?",
    expected: "4",
    validator: (output) => output.includes('4')
  },
  {
    input: "Write a hello world in Python",
    validator: (output) => output.includes('print') && output.includes('hello')
  },
  {
    input: "Explain photosynthesis in one sentence",
    maxTokens: 50,
    validator: (output) => output.includes('plants') || output.includes('sunlight')
  }
];

// Run tests
const tester = new ModelTester();
const results = await tester.testModel('models/llama-7b.gguf', testCases);

console.log('Test Results:', results.summary);
console.log('Success Rate:', `${results.summary.successRate}%`);
console.log('Average Latency:', `${results.summary.avgLatency}ms`);
```

## Troubleshooting Tips

### Common Issues and Solutions

**1. Model Loading Fails**
```javascript
// Check if file exists and is accessible
try {
  await router.load('models/nonexistent.gguf');
} catch (error) {
  if (error.message.includes('not found')) {
    console.log('Available models:', fs.readdirSync('models/'));
    // Load alternative model
    await router.load('huggingface:gpt2');
  }
}
```

**2. Out of Memory Errors**
```javascript
// Monitor and limit memory usage
const router = new LLMRouter({
  maxModels: 2, // Reduce concurrent models
  cacheTTL: 1800000 // Shorter cache time
});

// Unload models when done
await router.registry.unregister('large-model-id');
```

**3. Slow Performance**
```javascript
// Optimize for speed
const router = new LLMRouter({
  strategy: 'speed-priority'
});

// Use smaller models for better performance
await router.load('models/llama-7b.gguf'); // Instead of 70B
```

**4. Engine Selection Issues**
```javascript
// Fallback engine selection
const engines = router.getAvailableEngines();
if (!engines.includes('webgpu')) {
  console.warn('WebGPU not available, using WASM');
  await router.setEngine('wasm');
}
```

This completes the basic usage guide. Each example is production-ready and includes proper error handling, performance considerations, and real-world patterns.