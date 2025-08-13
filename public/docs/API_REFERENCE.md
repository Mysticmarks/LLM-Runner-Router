# 🎮 API Reference - Complete Interface Documentation

*Every method, every parameter, every possibility documented with quantum precision*

## Table of Contents
- [Core API](#core-api)
- [Model Management](#model-management)
- [Routing System](#routing-system)
- [Engine Control](#engine-control)
- [Streaming API](#streaming-api)
- [Configuration API](#configuration-api)
- [Advanced Features](#advanced-features)
- [Events & Hooks](#events--hooks)

## Core API

### LLMRouter Class

The main orchestrator of the neural symphony.

```javascript
import LLMRouter from 'llm-runner-router';
```

#### Constructor

```javascript
const router = new LLMRouter(options);
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `options` | `Object` | `{}` | Configuration object |
| `options.strategy` | `String` | `'balanced'` | Routing strategy |
| `options.maxModels` | `Number` | `100` | Maximum models in registry |
| `options.cacheTTL` | `Number` | `3600000` | Cache time-to-live (ms) |
| `options.autoInit` | `Boolean` | `true` | Auto-initialize on creation |
| `options.logLevel` | `String` | `'info'` | Logging verbosity |

**Example:**
```javascript
const router = new LLMRouter({
  strategy: 'quality-first',
  maxModels: 50,
  cacheTTL: 7200000,
  logLevel: 'debug'
});
```

### Primary Methods

#### initialize()

Initialize the router system.

```javascript
await router.initialize();
```

**Returns:** `Promise<void>`

**Throws:** `Error` if initialization fails

**Example:**
```javascript
try {
  await router.initialize();
  console.log('Router ready!');
} catch (error) {
  console.error('Initialization failed:', error);
}
```

#### load()

Load a model into the system.

```javascript
const model = await router.load(spec);
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `spec` | `String\|Object` | Model specification |
| `spec.source` | `String` | Model source (path/URL) |
| `spec.format` | `String` | Optional format override |
| `spec.immediate` | `Boolean` | Load immediately |
| `spec.config` | `Object` | Model-specific config |

**Returns:** `Promise<Model>` - Loaded model instance

**Examples:**
```javascript
// Simple string load
const model1 = await router.load('models/llama-7b.gguf');

// Object specification
const model2 = await router.load({
  source: 'huggingface:meta-llama/Llama-2-7b',
  format: 'auto-detect',
  immediate: false,
  config: {
    quantization: 'q4_k_m',
    context: 4096
  }
});
```

#### quick()

Quick inference with automatic model selection.

```javascript
const response = await router.quick(prompt, options);
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | `String` | Required | Input text |
| `options` | `Object` | `{}` | Generation options |
| `options.maxTokens` | `Number` | `500` | Maximum tokens |
| `options.temperature` | `Number` | `0.7` | Sampling temperature |
| `options.topP` | `Number` | `0.9` | Nucleus sampling |
| `options.topK` | `Number` | `40` | Top-K sampling |
| `options.cache` | `Boolean` | `true` | Use cache |

**Returns:** `Promise<Response>`

**Response Structure:**
```javascript
{
  text: String,          // Generated text
  tokens: Number,        // Token count
  model: String,         // Model used
  latency: Number,       // Generation time (ms)
  cached: Boolean        // From cache?
}
```

#### advanced()

Advanced inference with full control.

```javascript
const response = await router.advanced(config);
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `config` | `Object` | Complete configuration |
| `config.prompt` | `String` | Input prompt |
| `config.model` | `String` | Specific model ID |
| `config.temperature` | `Number` | Temperature (0-2) |
| `config.maxTokens` | `Number` | Max generation length |
| `config.stream` | `Boolean` | Enable streaming |
| `config.fallbacks` | `Array<String>` | Fallback models |
| `config.timeout` | `Number` | Request timeout (ms) |
| `config.retries` | `Number` | Retry attempts |

**Example:**
```javascript
const response = await router.advanced({
  prompt: "Explain recursion",
  model: "gpt-4",
  temperature: 0.5,
  maxTokens: 1000,
  fallbacks: ['claude', 'llama-70b'],
  timeout: 30000,
  retries: 3
});
```

## Model Management

### Model Registry API

#### registry.register()

Register a model in the system.

```javascript
await router.registry.register(model);
```

#### registry.get()

Get a model by ID.

```javascript
const model = await router.registry.get(modelId);
```

#### registry.search()

Search for models.

```javascript
const models = router.registry.search({
  name: 'llama',
  format: 'gguf',
  capabilities: ['streaming'],
  maxSize: 10000000000
});
```

#### registry.unregister()

Remove a model from registry.

```javascript
await router.registry.unregister(modelId);
```

## Routing System

### Routing Strategies

#### setStrategy()

Change routing strategy at runtime.

```javascript
router.setStrategy('cost-optimized');
```

**Available Strategies:**
- `'quality-first'` - Prioritize output quality
- `'cost-optimized'` - Minimize inference costs
- `'speed-priority'` - Fastest response time
- `'balanced'` - Balance all factors
- `'round-robin'` - Equal distribution
- `'least-loaded'` - Load balancing
- `'random'` - Chaos mode

### Custom Routing

#### router.addCustomStrategy()

Add custom routing logic.

```javascript
router.addCustomStrategy('my-strategy', (models, context) => {
  // Custom selection logic
  return models.find(m => m.name === 'preferred-model');
});
```

## Streaming API

### stream()

Stream tokens in real-time.

```javascript
const stream = router.stream(prompt, options);
```

**Returns:** `AsyncGenerator<String>`

**Example:**
```javascript
const stream = router.stream("Write a story");

for await (const token of stream) {
  process.stdout.write(token);
}
```

### streamWithEvents()

Stream with progress events.

```javascript
const stream = router.streamWithEvents(prompt, options);

stream.on('token', (token) => console.log(token));
stream.on('progress', (info) => console.log(info));
stream.on('complete', (result) => console.log('Done!'));
stream.on('error', (error) => console.error(error));

await stream.start();
```

## Engine Control

### Engine Selection

#### getEngine()

Get current engine.

```javascript
const engine = router.getEngine();
console.log(engine.name); // 'webgpu'
```

#### setEngine()

Manually set engine.

```javascript
await router.setEngine('wasm');
```

#### getAvailableEngines()

List available engines.

```javascript
const engines = router.getAvailableEngines();
// ['webgpu', 'wasm', 'node']
```

## Events & Hooks

### Event System

The router emits various events for monitoring and debugging.

```javascript
router.on('model-loaded', (model) => {
  console.log(`Model loaded: ${model.name}`);
});

router.on('inference-start', (context) => {
  console.log(`Starting inference: ${context.model}`);
});

router.on('inference-complete', (result) => {
  console.log(`Completed in ${result.latency}ms`);
});

router.on('error', (error) => {
  console.error('Router error:', error);
});
```

**Available Events:**
- `'initialized'` - Router ready
- `'model-loaded'` - Model loaded
- `'model-unloaded'` - Model removed
- `'inference-start'` - Generation beginning
- `'inference-complete'` - Generation done
- `'token'` - Stream token emitted
- `'cache-hit'` - Cache used
- `'strategy-changed'` - Routing changed
- `'error'` - Error occurred

### Middleware System

#### use()

Add middleware to processing pipeline.

```javascript
router.use(async (context, next) => {
  console.log('Before inference:', context.prompt);
  const result = await next();
  console.log('After inference:', result.text);
  return result;
});
```

## Configuration API

### Runtime Configuration

#### getConfig()

Get current configuration.

```javascript
const config = router.getConfig();
```

#### updateConfig()

Update configuration at runtime.

```javascript
router.updateConfig({
  cacheTTL: 7200000,
  maxTokens: 2048
});
```

#### exportConfig()

Export configuration for persistence.

```javascript
const config = router.exportConfig();
await fs.writeFile('config.json', JSON.stringify(config));
```

## Advanced Features

### Model Ensemble

#### ensemble()

Combine multiple models.

```javascript
const result = await router.ensemble([
  { model: 'gpt-4', weight: 0.5 },
  { model: 'claude', weight: 0.3 },
  { model: 'llama', weight: 0.2 }
], prompt, options);
```

### Batch Processing

#### batch()

Process multiple prompts efficiently.

```javascript
const results = await router.batch([
  "Question 1",
  "Question 2",
  "Question 3"
], options);
```

### Model Comparison

#### compare()

Compare models side-by-side.

```javascript
const comparison = await router.compare(
  ['model1', 'model2', 'model3'],
  prompt,
  options
);

console.log(comparison.rankings);
console.log(comparison.scores);
```

## Error Handling

### Error Types

```javascript
import { 
  ModelNotFoundError,
  EngineError,
  TimeoutError,
  ValidationError 
} from 'llm-runner-router/errors';

try {
  await router.load('invalid-model');
} catch (error) {
  if (error instanceof ModelNotFoundError) {
    console.error('Model not found:', error.modelId);
  }
}
```

### Retry Configuration

```javascript
const router = new LLMRouter({
  retryConfig: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 1000,
    maxDelay: 10000
  }
});
```

## Performance Metrics

### getMetrics()

Get system metrics.

```javascript
const metrics = router.getMetrics();
console.log(metrics);
// {
//   totalInferences: 1234,
//   averageLatency: 245,
//   cacheHitRate: 0.67,
//   modelsLoaded: 5,
//   memoryUsage: 2147483648
// }
```

### resetMetrics()

Reset performance counters.

```javascript
router.resetMetrics();
```

## Cleanup

### cleanup()

Properly cleanup resources.

```javascript
await router.cleanup();
```

Always call cleanup when shutting down to:
- Unload models from memory
- Close engine connections
- Persist cache if configured
- Release resources

---

*API designed for humans, built for scale, ready for the future* 🚀

Built with 💙 by Echo AI Systems
