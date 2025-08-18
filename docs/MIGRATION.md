# Migration Guide

Comprehensive guide for migrating from other LLM systems to LLM-Runner-Router.

## Table of Contents

- [Overview](#overview)
- [Pre-Migration Planning](#pre-migration-planning)
- [Migration Strategies](#migration-strategies)
- [Platform-Specific Migrations](#platform-specific-migrations)
- [Code Migration Patterns](#code-migration-patterns)
- [Data Migration](#data-migration)
- [Testing and Validation](#testing-and-validation)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)
- [Post-Migration Best Practices](#post-migration-best-practices)

## Overview

LLM-Runner-Router provides a unified interface for managing multiple language models, making migration from existing systems straightforward. This guide covers migration patterns from popular LLM frameworks and custom implementations.

### Migration Benefits

- **Unified Interface**: Single API for multiple model formats
- **Performance Optimization**: Advanced caching and routing strategies
- **Cost Reduction**: Intelligent model selection and resource optimization
- **Scalability**: Built-in horizontal and vertical scaling
- **Flexibility**: Format-agnostic model loading

### Supported Migration Sources

- Hugging Face Transformers
- LangChain
- LlamaIndex
- OpenAI API implementations
- Custom LLM implementations
- Node-llama-cpp
- Ollama
- LocalAI
- MLX (Apple Silicon)

## Pre-Migration Planning

### Assessment Phase

#### 1. Current System Analysis

```javascript
// Create a migration assessment
const assessmentConfig = {
  currentModels: [
    {
      name: 'gpt-3.5-turbo',
      provider: 'openai',
      usage: 'high',
      cost: '$0.002/1K tokens',
      latency: '500ms avg'
    },
    {
      name: 'llama-2-7b',
      provider: 'huggingface',
      usage: 'medium',
      local: true,
      memory: '14GB'
    }
  ],
  currentArchitecture: {
    framework: 'langchain',
    deployment: 'docker',
    scaling: 'manual',
    monitoring: 'basic'
  },
  requirements: {
    maxLatency: 1000,
    maxCost: 0.01,
    availability: 0.99,
    throughput: 100
  }
};
```

#### 2. Dependency Mapping

```bash
# Analyze current dependencies
npm list --depth=0 > current-deps.txt

# Common migration dependencies
echo "Dependencies to replace:" > migration-plan.txt
echo "- @langchain/core -> llm-runner-router" >> migration-plan.txt
echo "- openai -> llm-runner-router (unified interface)" >> migration-plan.txt
echo "- node-llama-cpp -> llm-runner-router/engines/native" >> migration-plan.txt
```

#### 3. Migration Scope Planning

```javascript
const migrationScope = {
  phase1: {
    duration: '1-2 weeks',
    tasks: [
      'Setup LLM-Runner-Router',
      'Migrate core model loading',
      'Basic inference testing'
    ]
  },
  phase2: {
    duration: '2-3 weeks', 
    tasks: [
      'Migrate routing logic',
      'Performance optimization',
      'Integration testing'
    ]
  },
  phase3: {
    duration: '1 week',
    tasks: [
      'Production deployment',
      'Monitoring setup',
      'Performance validation'
    ]
  }
};
```

## Migration Strategies

### 1. Parallel Migration Strategy

Run both systems simultaneously during transition:

```javascript
import { LLMRouter } from 'llm-runner-router';
import { ChatOpenAI } from '@langchain/openai'; // Legacy

class HybridLLMService {
  constructor() {
    // New system
    this.newRouter = new LLMRouter({
      strategy: 'balanced',
      fallbackEnabled: true
    });
    
    // Legacy system (fallback)
    this.legacyLLM = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo'
    });
    
    this.migrationMode = process.env.MIGRATION_MODE || 'hybrid';
  }
  
  async generateResponse(prompt, options = {}) {
    try {
      if (this.migrationMode === 'new-primary') {
        // Try new system first
        return await this.newRouter.generate(prompt, {
          maxTokens: options.maxTokens,
          temperature: options.temperature
        });
      }
      
      if (this.migrationMode === 'legacy-primary') {
        // Use legacy system primarily
        return await this.legacyLLM.invoke(prompt);
      }
      
      // Hybrid mode - compare both
      const [newResult, legacyResult] = await Promise.allSettled([
        this.newRouter.generate(prompt, options),
        this.legacyLLM.invoke(prompt)
      ]);
      
      // Log comparison for validation
      this.logComparison(newResult, legacyResult, prompt);
      
      // Return new system result if successful
      return newResult.status === 'fulfilled' 
        ? newResult.value 
        : legacyResult.value;
        
    } catch (error) {
      console.error('Hybrid system error:', error);
      throw error;
    }
  }
  
  logComparison(newResult, legacyResult, prompt) {
    const comparison = {
      timestamp: new Date().toISOString(),
      prompt: prompt.substring(0, 100),
      newSystem: {
        success: newResult.status === 'fulfilled',
        tokens: newResult.value?.tokens || 0,
        latency: newResult.value?.metadata?.latency || 0
      },
      legacySystem: {
        success: legacyResult.status === 'fulfilled',
        tokens: legacyResult.value?.length || 0
      }
    };
    
    // Store for analysis
    this.storeMigrationMetrics(comparison);
  }
}
```

### 2. Feature Flag Migration

Gradual rollout using feature flags:

```javascript
import { LLMRouter } from 'llm-runner-router';

class FeatureFlaggedLLM {
  constructor() {
    this.router = new LLMRouter();
    this.featureFlags = {
      useNewRouting: process.env.FF_NEW_ROUTING === 'true',
      useNewCaching: process.env.FF_NEW_CACHING === 'true',
      useNewModels: process.env.FF_NEW_MODELS === 'true'
    };
  }
  
  async processRequest(request) {
    let config = this.buildConfig(request);
    
    if (this.featureFlags.useNewRouting) {
      config.strategy = 'quality-first';
    }
    
    if (this.featureFlags.useNewCaching) {
      config.caching = { enabled: true, ttl: 3600 };
    }
    
    if (this.featureFlags.useNewModels) {
      config.models = ['llama-2-13b', 'mixtral-8x7b'];
    }
    
    return await this.router.generate(request.prompt, config);
  }
}
```

## Platform-Specific Migrations

### From Hugging Face Transformers

#### Before (Transformers):
```python
from transformers import AutoTokenizer, AutoModelForCausalLM

tokenizer = AutoTokenizer.from_pretrained("microsoft/DialoGPT-medium")
model = AutoModelForCausalLM.from_pretrained("microsoft/DialoGPT-medium")

def generate_response(prompt):
    inputs = tokenizer.encode(prompt + tokenizer.eos_token, return_tensors='pt')
    outputs = model.generate(inputs, max_length=1000, pad_token_id=tokenizer.eos_token_id)
    response = tokenizer.decode(outputs[:, inputs.shape[-1]:][0], skip_special_tokens=True)
    return response
```

#### After (LLM-Runner-Router):
```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  models: [{
    name: 'dialogpt-medium',
    source: 'huggingface:microsoft/DialoGPT-medium',
    format: 'huggingface'
  }]
});

async function generateResponse(prompt) {
  const response = await router.generate(prompt, {
    maxTokens: 1000,
    stopTokens: ['<|endoftext|>']
  });
  return response.text;
}
```

### From LangChain

#### Before (LangChain):
```javascript
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { LLMChain } from 'langchain/chains';

const llm = new ChatOpenAI({
  modelName: 'gpt-3.5-turbo',
  temperature: 0.7
});

const prompt = PromptTemplate.fromTemplate(
  "You are a helpful assistant. {question}"
);

const chain = new LLMChain({ llm, prompt });

async function askQuestion(question) {
  const result = await chain.call({ question });
  return result.text;
}
```

#### After (LLM-Runner-Router):
```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  strategy: 'balanced',
  models: [
    {
      name: 'gpt-3.5-turbo',
      source: 'openai:gpt-3.5-turbo',
      weight: 0.7
    },
    {
      name: 'claude-instant',
      source: 'anthropic:claude-instant-1',
      weight: 0.3
    }
  ]
});

async function askQuestion(question) {
  const prompt = `You are a helpful assistant. ${question}`;
  const response = await router.generate(prompt, {
    temperature: 0.7,
    strategy: 'quality-first'
  });
  return response.text;
}
```

### From Node-llama-cpp

#### Before (Node-llama-cpp):
```javascript
import { LlamaCpp } from 'node-llama-cpp';

const llama = new LlamaCpp({
  modelPath: './models/llama-2-7b-chat.gguf',
  contextSize: 2048
});

await llama.load();

async function generate(prompt) {
  const response = await llama.generate(prompt, {
    maxTokens: 512,
    temperature: 0.8
  });
  return response;
}
```

#### After (LLM-Runner-Router):
```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  models: [{
    name: 'llama-2-7b-chat',
    source: 'file:./models/llama-2-7b-chat.gguf',
    format: 'gguf',
    engine: 'native'
  }],
  config: {
    contextSize: 2048
  }
});

async function generate(prompt) {
  const response = await router.generate(prompt, {
    maxTokens: 512,
    temperature: 0.8
  });
  return response.text;
}
```

### From OpenAI API

#### Before (OpenAI SDK):
```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function chatCompletion(messages) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: messages,
    temperature: 0.7,
    max_tokens: 1000
  });
  
  return completion.choices[0].message.content;
}
```

#### After (LLM-Runner-Router):
```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  models: [
    {
      name: 'gpt-3.5-turbo',
      source: 'openai:gpt-3.5-turbo',
      priority: 1
    },
    {
      name: 'llama-2-7b',
      source: 'file:./models/llama-2-7b.gguf',
      priority: 2 // Fallback
    }
  ],
  strategy: 'cost-optimized'
});

async function chatCompletion(messages) {
  // Convert OpenAI message format
  const prompt = messages.map(msg => 
    `${msg.role}: ${msg.content}`
  ).join('\n');
  
  const response = await router.generate(prompt, {
    temperature: 0.7,
    maxTokens: 1000
  });
  
  return response.text;
}
```

## Code Migration Patterns

### 1. Configuration Migration

#### Legacy Configuration:
```javascript
// Multiple configuration objects
const openaiConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-3.5-turbo'
};

const localConfig = {
  modelPath: './models/llama.gguf',
  contextSize: 2048
};
```

#### Unified Configuration:
```javascript
const routerConfig = {
  models: [
    {
      name: 'openai-primary',
      source: 'openai:gpt-3.5-turbo',
      config: {
        apiKey: process.env.OPENAI_API_KEY
      }
    },
    {
      name: 'local-fallback',
      source: 'file:./models/llama.gguf',
      config: {
        contextSize: 2048
      }
    }
  ],
  strategy: 'cost-optimized',
  fallbackChain: ['openai-primary', 'local-fallback']
};
```

### 2. Prompt Template Migration

#### Before:
```javascript
function buildPrompt(userInput, context) {
  return `Context: ${context}\nUser: ${userInput}\nAssistant:`;
}
```

#### After:
```javascript
import { PromptTemplate } from 'llm-runner-router/utils';

const template = new PromptTemplate({
  template: "Context: {context}\nUser: {input}\nAssistant:",
  variables: ['context', 'input']
});

async function generate(userInput, context) {
  const prompt = template.format({ input: userInput, context });
  return await router.generate(prompt);
}
```

### 3. Streaming Migration

#### Before (Custom Streaming):
```javascript
async function* streamResponse(prompt) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
    headers: { 'Content-Type': 'application/json' }
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    yield chunk;
  }
}
```

#### After (Built-in Streaming):
```javascript
async function* streamResponse(prompt) {
  const stream = await router.generateStream(prompt, {
    maxTokens: 1000,
    temperature: 0.7
  });
  
  for await (const chunk of stream) {
    yield chunk.text;
  }
}
```

## Data Migration

### 1. Model Cache Migration

```javascript
// Migration utility for model caches
class CacheMigrator {
  constructor(oldCachePath, newCachePath) {
    this.oldCachePath = oldCachePath;
    this.newCachePath = newCachePath;
  }
  
  async migrateCache() {
    const oldCache = await this.loadOldCache();
    const newCache = this.transformCacheFormat(oldCache);
    await this.saveNewCache(newCache);
  }
  
  transformCacheFormat(oldCache) {
    return {
      version: '2.0.0',
      models: oldCache.models.map(model => ({
        id: model.name,
        source: this.transformSource(model.path),
        metadata: {
          size: model.size,
          format: this.detectFormat(model.path),
          lastUsed: model.lastAccess
        }
      })),
      inference: oldCache.responses?.map(resp => ({
        prompt: resp.input,
        response: resp.output,
        model: resp.modelName,
        timestamp: resp.created,
        tokens: resp.tokenCount
      })) || []
    };
  }
}

// Usage
const migrator = new CacheMigrator(
  './old-cache', 
  './new-cache'
);
await migrator.migrateCache();
```

### 2. Configuration Migration

```javascript
// Migrate existing configuration files
async function migrateConfiguration() {
  const configs = [
    { path: './langchain.config.js', type: 'langchain' },
    { path: './openai.config.js', type: 'openai' },
    { path: './local.config.js', type: 'local' }
  ];
  
  const migratedConfig = {
    models: [],
    strategies: {},
    engines: {}
  };
  
  for (const config of configs) {
    const data = await import(config.path);
    const transformed = transformConfig(data.default, config.type);
    migratedConfig.models.push(...transformed.models);
    Object.assign(migratedConfig.strategies, transformed.strategies);
  }
  
  await writeConfig('./llm-runner.config.js', migratedConfig);
}

function transformConfig(config, type) {
  switch (type) {
    case 'langchain':
      return {
        models: config.models.map(m => ({
          name: m.modelName,
          source: `${m.provider}:${m.modelName}`,
          config: {
            temperature: m.temperature,
            maxTokens: m.maxTokens
          }
        }))
      };
      
    case 'openai':
      return {
        models: [{
          name: 'openai-default',
          source: `openai:${config.model}`,
          config: {
            apiKey: config.apiKey,
            temperature: config.temperature
          }
        }]
      };
      
    default:
      throw new Error(`Unknown config type: ${type}`);
  }
}
```

## Testing and Validation

### 1. Migration Test Suite

```javascript
import { expect } from 'chai';
import { LLMRouter } from 'llm-runner-router';

describe('Migration Validation', () => {
  let router;
  let legacySystem;
  
  beforeEach(async () => {
    router = new LLMRouter({
      models: [{ name: 'test-model', source: 'mock:test' }]
    });
    
    legacySystem = new LegacyLLMSystem();
    await Promise.all([
      router.initialize(),
      legacySystem.initialize()
    ]);
  });
  
  describe('Response Compatibility', () => {
    it('should produce similar responses for identical prompts', async () => {
      const prompt = 'What is the capital of France?';
      
      const [newResponse, legacyResponse] = await Promise.all([
        router.generate(prompt),
        legacySystem.generate(prompt)
      ]);
      
      // Semantic similarity test
      const similarity = calculateSemantic Similarity(
        newResponse.text, 
        legacyResponse.text
      );
      
      expect(similarity).to.be.above(0.8);
    });
  });
  
  describe('Performance Validation', () => {
    it('should maintain or improve latency', async () => {
      const prompt = 'Generate a short story about AI';
      
      const newStart = Date.now();
      await router.generate(prompt);
      const newLatency = Date.now() - newStart;
      
      const legacyStart = Date.now();
      await legacySystem.generate(prompt);
      const legacyLatency = Date.now() - legacyStart;
      
      expect(newLatency).to.be.lessThanOrEqual(legacyLatency * 1.2);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle errors gracefully like legacy system', async () => {
      const invalidPrompt = null;
      
      const newError = await router.generate(invalidPrompt)
        .catch(err => err);
      const legacyError = await legacySystem.generate(invalidPrompt)
        .catch(err => err);
      
      expect(newError).to.be.instanceOf(Error);
      expect(legacyError).to.be.instanceOf(Error);
    });
  });
});
```

### 2. A/B Testing Framework

```javascript
class MigrationTester {
  constructor(oldSystem, newSystem) {
    this.oldSystem = oldSystem;
    this.newSystem = newSystem;
    this.results = [];
  }
  
  async runABTest(testCases, sampleSize = 100) {
    const results = {
      performance: { old: [], new: [] },
      accuracy: { old: [], new: [] },
      errors: { old: 0, new: 0 }
    };
    
    for (let i = 0; i < sampleSize; i++) {
      const testCase = testCases[i % testCases.length];
      
      try {
        // Test old system
        const oldStart = Date.now();
        const oldResult = await this.oldSystem.process(testCase);
        const oldTime = Date.now() - oldStart;
        
        results.performance.old.push(oldTime);
        results.accuracy.old.push(
          this.evaluateAccuracy(oldResult, testCase.expected)
        );
      } catch (error) {
        results.errors.old++;
      }
      
      try {
        // Test new system
        const newStart = Date.now();
        const newResult = await this.newSystem.process(testCase);
        const newTime = Date.now() - newStart;
        
        results.performance.new.push(newTime);
        results.accuracy.new.push(
          this.evaluateAccuracy(newResult, testCase.expected)
        );
      } catch (error) {
        results.errors.new++;
      }
    }
    
    return this.analyzeResults(results);
  }
  
  analyzeResults(results) {
    return {
      performance: {
        oldAvg: average(results.performance.old),
        newAvg: average(results.performance.new),
        improvement: this.calculateImprovement(
          results.performance.old,
          results.performance.new
        )
      },
      accuracy: {
        oldScore: average(results.accuracy.old),
        newScore: average(results.accuracy.new)
      },
      reliability: {
        oldErrorRate: results.errors.old / results.performance.old.length,
        newErrorRate: results.errors.new / results.performance.new.length
      }
    };
  }
}
```

## Performance Optimization

### 1. Post-Migration Optimization

```javascript
class MigrationOptimizer {
  constructor(router) {
    this.router = router;
    this.metrics = new MetricsCollector();
  }
  
  async optimizeAfterMigration() {
    // Analyze usage patterns
    const patterns = await this.analyzeUsagePatterns();
    
    // Optimize model selection
    await this.optimizeModelSelection(patterns);
    
    // Tune caching strategies
    await this.optimizeCaching(patterns);
    
    // Configure load balancing
    await this.optimizeLoadBalancing(patterns);
  }
  
  async analyzeUsagePatterns() {
    const logs = await this.metrics.getLogs('7d');
    
    return {
      popularPrompts: this.findPopularPrompts(logs),
      peakUsageTimes: this.findPeakTimes(logs),
      modelPreferences: this.analyzeModelUsage(logs),
      errorPatterns: this.analyzeErrors(logs)
    };
  }
  
  async optimizeModelSelection(patterns) {
    const optimalConfig = {
      models: patterns.modelPreferences.map(pref => ({
        name: pref.model,
        weight: pref.successRate,
        priority: pref.avgLatency < 500 ? 1 : 2
      })),
      strategy: patterns.errorPatterns.length > 10 
        ? 'reliability-first' 
        : 'balanced'
    };
    
    await this.router.updateConfig(optimalConfig);
  }
}
```

### 2. Resource Optimization

```javascript
// Optimize resource allocation post-migration
class ResourceOptimizer {
  async optimizeMemoryUsage() {
    const usage = await this.getCurrentMemoryUsage();
    
    if (usage.heap > 0.8) {
      // Enable aggressive garbage collection
      await this.router.updateConfig({
        memory: {
          gcStrategy: 'aggressive',
          modelUnloadThreshold: 300000 // 5 minutes
        }
      });
    }
    
    // Optimize model loading
    await this.optimizeModelLoading(usage);
  }
  
  async optimizeModelLoading(usage) {
    const loadingStrategy = usage.concurrent > 5 
      ? 'lazy-loading'  // Load models on demand
      : 'preloading';   // Preload frequently used models
      
    await this.router.updateConfig({
      loading: {
        strategy: loadingStrategy,
        preloadModels: usage.frequent.slice(0, 3)
      }
    });
  }
}
```

## Troubleshooting

### Common Migration Issues

#### 1. Model Format Compatibility

**Problem**: Legacy models in unsupported formats
```bash
Error: Unsupported model format '.pkl'
```

**Solution**:
```javascript
// Convert model format
import { ModelConverter } from 'llm-runner-router/utils';

const converter = new ModelConverter();

// Convert PyTorch to ONNX
await converter.convert({
  input: './models/legacy-model.pkl',
  output: './models/converted-model.onnx',
  format: 'onnx'
});

// Update router configuration
const router = new LLMRouter({
  models: [{
    name: 'converted-model',
    source: 'file:./models/converted-model.onnx',
    format: 'onnx'
  }]
});
```

#### 2. API Compatibility Issues

**Problem**: Different API signatures
```javascript
// Legacy API
const result = await oldLLM.generate(prompt, maxTokens, temperature);

// New API expects options object
const result = await router.generate(prompt, { maxTokens, temperature });
```

**Solution**: Create compatibility wrapper
```javascript
class LegacyCompatibilityWrapper {
  constructor(router) {
    this.router = router;
  }
  
  // Legacy-compatible method signature
  async generate(prompt, maxTokens = 100, temperature = 0.7) {
    return await this.router.generate(prompt, {
      maxTokens,
      temperature
    });
  }
  
  // Legacy streaming compatibility
  async *generateStream(prompt, maxTokens, temperature) {
    const stream = await this.router.generateStream(prompt, {
      maxTokens,
      temperature
    });
    
    for await (const chunk of stream) {
      yield chunk.text; // Legacy format
    }
  }
}
```

#### 3. Performance Regression

**Problem**: Slower performance after migration

**Diagnosis**:
```javascript
const diagnostics = await router.diagnose({
  includeMetrics: true,
  includeModels: true,
  includeCache: true
});

console.log('Performance Analysis:', {
  avgLatency: diagnostics.metrics.avgLatency,
  cacheHitRate: diagnostics.cache.hitRate,
  modelLoadTime: diagnostics.models.avgLoadTime
});
```

**Solutions**:
```javascript
// Enable performance optimizations
await router.updateConfig({
  performance: {
    caching: { enabled: true, ttl: 3600 },
    preloading: { enabled: true, models: ['primary-model'] },
    batching: { enabled: true, maxBatchSize: 10 },
    streaming: { enabled: true, chunkSize: 1024 }
  }
});
```

#### 4. Memory Leaks

**Problem**: Increasing memory usage over time

**Solution**:
```javascript
// Enable memory monitoring
const memoryMonitor = new MemoryMonitor(router);

memoryMonitor.on('high-usage', async (usage) => {
  if (usage.heap > 0.9) {
    // Force garbage collection
    await router.cleanup();
    
    // Unload unused models
    await router.unloadUnusedModels();
  }
});

// Configure automatic cleanup
await router.updateConfig({
  cleanup: {
    interval: 300000, // 5 minutes
    memoryThreshold: 0.8,
    autoUnload: true
  }
});
```

### Migration Rollback Plan

```javascript
class MigrationRollback {
  constructor(backupPath) {
    this.backupPath = backupPath;
    this.rollbackSteps = [];
  }
  
  async createRollbackPlan() {
    this.rollbackSteps = [
      {
        step: 'backup-config',
        action: () => this.backupConfiguration(),
        rollback: () => this.restoreConfiguration()
      },
      {
        step: 'backup-models',
        action: () => this.backupModels(),
        rollback: () => this.restoreModels()
      },
      {
        step: 'backup-cache',
        action: () => this.backupCache(),
        rollback: () => this.restoreCache()
      }
    ];
  }
  
  async executeRollback() {
    console.log('Starting migration rollback...');
    
    for (const step of this.rollbackSteps.reverse()) {
      try {
        await step.rollback();
        console.log(`✅ Rolled back: ${step.step}`);
      } catch (error) {
        console.error(`❌ Failed to rollback: ${step.step}`, error);
        throw error;
      }
    }
    
    console.log('Migration rollback completed');
  }
}
```

## Post-Migration Best Practices

### 1. Monitoring and Observability

```javascript
// Setup comprehensive monitoring
import { MetricsCollector } from 'llm-runner-router/monitoring';

const metrics = new MetricsCollector({
  retention: '30d',
  alerts: {
    latencyThreshold: 2000,
    errorRateThreshold: 0.05,
    memoryThreshold: 0.85
  }
});

// Monitor key metrics
metrics.track('inference.latency', (latency) => {
  if (latency > 2000) {
    metrics.alert('high-latency', { latency });
  }
});

metrics.track('inference.errors', (error) => {
  if (error.rate > 0.05) {
    metrics.alert('high-error-rate', { rate: error.rate });
  }
});
```

### 2. Gradual Feature Adoption

```javascript
// Gradually adopt new features
class FeatureAdopter {
  constructor(router) {
    this.router = router;
    this.adoptionSchedule = [
      { feature: 'advanced-caching', week: 1 },
      { feature: 'model-ensembles', week: 2 },
      { feature: 'auto-scaling', week: 3 },
      { feature: 'cost-optimization', week: 4 }
    ];
  }
  
  async adoptFeatures() {
    for (const item of this.adoptionSchedule) {
      await this.scheduleFeatureAdoption(item.feature, item.week);
    }
  }
  
  async scheduleFeatureAdoption(feature, week) {
    setTimeout(async () => {
      try {
        await this.enableFeature(feature);
        console.log(`✅ Adopted feature: ${feature}`);
      } catch (error) {
        console.error(`❌ Failed to adopt: ${feature}`, error);
      }
    }, week * 7 * 24 * 60 * 60 * 1000); // Convert weeks to milliseconds
  }
}
```

### 3. Continuous Optimization

```javascript
// Continuous improvement process
class ContinuousOptimizer {
  constructor(router) {
    this.router = router;
    this.optimizationInterval = 24 * 60 * 60 * 1000; // Daily
  }
  
  start() {
    setInterval(async () => {
      await this.runOptimization();
    }, this.optimizationInterval);
  }
  
  async runOptimization() {
    const metrics = await this.collectMetrics();
    const optimizations = this.analyzeOptimizations(metrics);
    
    for (const optimization of optimizations) {
      await this.applyOptimization(optimization);
    }
  }
  
  analyzeOptimizations(metrics) {
    const optimizations = [];
    
    if (metrics.cacheHitRate < 0.6) {
      optimizations.push({
        type: 'cache-tuning',
        action: 'increase-ttl',
        value: metrics.cacheTTL * 1.5
      });
    }
    
    if (metrics.avgLatency > 1000) {
      optimizations.push({
        type: 'model-optimization',
        action: 'add-faster-model',
        model: 'fast-inference-model'
      });
    }
    
    return optimizations;
  }
}
```

### 4. Documentation Updates

```javascript
// Maintain migration documentation
class MigrationDocumentation {
  constructor() {
    this.docs = {
      decisions: [],
      issues: [],
      optimizations: [],
      lessons: []
    };
  }
  
  recordDecision(decision) {
    this.docs.decisions.push({
      timestamp: new Date().toISOString(),
      decision: decision.description,
      rationale: decision.rationale,
      alternatives: decision.alternatives,
      outcome: decision.outcome
    });
  }
  
  recordIssue(issue) {
    this.docs.issues.push({
      timestamp: new Date().toISOString(),
      description: issue.description,
      impact: issue.impact,
      resolution: issue.resolution,
      prevention: issue.prevention
    });
  }
  
  generateReport() {
    return {
      summary: {
        totalDecisions: this.docs.decisions.length,
        totalIssues: this.docs.issues.length,
        migrationDuration: this.calculateDuration(),
        successRate: this.calculateSuccessRate()
      },
      details: this.docs
    };
  }
}
```

## Migration Checklist

### Pre-Migration
- [ ] Document current system architecture
- [ ] Identify all model dependencies
- [ ] Backup existing configuration and data
- [ ] Plan rollback strategy
- [ ] Set up parallel testing environment

### During Migration
- [ ] Install LLM-Runner-Router
- [ ] Configure models and engines
- [ ] Implement compatibility wrappers
- [ ] Run parallel testing
- [ ] Monitor performance metrics
- [ ] Document decisions and issues

### Post-Migration
- [ ] Validate functionality
- [ ] Optimize performance
- [ ] Set up monitoring
- [ ] Train team on new system
- [ ] Update documentation
- [ ] Plan continuous improvement

### Success Criteria
- [ ] Feature parity with legacy system
- [ ] Performance equal or better
- [ ] Error rate below threshold
- [ ] Team comfortable with new system
- [ ] Monitoring and alerts operational

---

This migration guide provides comprehensive coverage of migrating from various LLM systems to LLM-Runner-Router. Follow the strategies and patterns that best match your current setup, and use the troubleshooting section to resolve common migration challenges.

For additional support, see:
- [Architecture Documentation](./ARCHITECTURE.md)
- [Best Practices Guide](./BEST_PRACTICES.md)
- [Error Codes Reference](./ERROR_CODES.md)
- [Performance Optimization](./COST_OPTIMIZATION.md)