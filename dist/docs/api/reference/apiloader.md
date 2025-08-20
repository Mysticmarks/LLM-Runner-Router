# APILoader Class Reference

Complete API reference for the APILoader class - the core component for API provider integration in LLM-Runner-Router.

## Constructor

### `new APILoader(options)`

Creates a new APILoader instance for interacting with AI providers.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options` | `Object` | Yes | Configuration object |
| `options.provider` | `String` | Yes | Provider name: `'openai'`, `'anthropic'`, `'openrouter'`, `'groq'`, `'auto'` |
| `options.apiKey` | `String` | No* | API key (required unless using env vars) |
| `options.baseURL` | `String` | No | Custom API endpoint |
| `options.defaultModel` | `String` | No | Default model to use |
| `options.organizationId` | `String` | No | Organization ID (provider-specific) |
| `options.headers` | `Object` | No | Additional HTTP headers |
| `options.timeout` | `Number` | No | Request timeout in milliseconds (default: 30000) |
| `options.maxRetries` | `Number` | No | Maximum retry attempts (default: 3) |
| `options.retryDelay` | `Number` | No | Initial retry delay in ms (default: 1000) |
| `options.cache` | `Object` | No | Cache configuration |
| `options.rateLimit` | `Object` | No | Rate limiting configuration |

#### Example

```javascript
const loader = new APILoader({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  defaultModel: 'gpt-4-turbo-preview',
  timeout: 60000,
  maxRetries: 3,
  cache: {
    enabled: true,
    ttl: 3600,
    maxSize: 100
  }
});
```

## Core Methods

### `load(model)`

Loads and validates a specific model.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | `String` | Yes | Model identifier or `'auto'` for automatic selection |

#### Returns

`Promise<Object>` - Model configuration object

#### Example

```javascript
const model = await loader.load('gpt-4-turbo-preview');
console.log(model.name, model.contextLength, model.pricing);
```

### `generate(options)`

Generates a completion using the loaded model.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options` | `Object` | Yes | Generation options |
| `options.prompt` | `String` | Yes* | Text prompt (*or messages) |
| `options.messages` | `Array` | Yes* | Chat messages (*or prompt) |
| `options.model` | `String` | No | Override default model |
| `options.maxTokens` | `Number` | No | Maximum tokens to generate |
| `options.temperature` | `Number` | No | Sampling temperature (0-2) |
| `options.topP` | `Number` | No | Nucleus sampling parameter |
| `options.topK` | `Number` | No | Top-K sampling (provider-specific) |
| `options.stopSequences` | `Array<String>` | No | Stop generation sequences |
| `options.frequencyPenalty` | `Number` | No | Frequency penalty (-2 to 2) |
| `options.presencePenalty` | `Number` | No | Presence penalty (-2 to 2) |
| `options.systemPrompt` | `String` | No | System message (Anthropic) |
| `options.responseFormat` | `Object` | No | Response format (OpenAI) |

#### Returns

```javascript
{
  text: String,           // Generated text
  model: String,          // Model used
  provider: String,       // Provider used
  usage: {
    promptTokens: Number,
    completionTokens: Number,
    totalTokens: Number
  },
  cost: Number,          // Cost in USD
  latency: Number,       // Response time in ms
  cached: Boolean,       // Whether response was cached
  metadata: Object       // Provider-specific metadata
}
```

#### Example

```javascript
const response = await loader.generate({
  prompt: "Explain quantum computing",
  maxTokens: 200,
  temperature: 0.7
});
```

### `complete(options)`

Alias for `generate()` - generates a completion.

### `chat(options)`

Generates a chat completion with message history.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options.messages` | `Array<Object>` | Yes | Array of message objects |
| `options.messages[].role` | `String` | Yes | Role: `'user'`, `'assistant'`, `'system'` |
| `options.messages[].content` | `String\|Array` | Yes | Message content |

#### Example

```javascript
const response = await loader.chat({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is React?' },
    { role: 'assistant', content: 'React is a JavaScript library...' },
    { role: 'user', content: 'How do hooks work?' }
  ]
});
```

### `streamCompletion(options)`

Generates a streaming completion.

#### Parameters

Same as `generate()` options.

#### Returns

`AsyncGenerator` - Yields chunks as they arrive

#### Example

```javascript
const stream = await loader.streamCompletion({
  prompt: "Write a story",
  maxTokens: 500
});

for await (const chunk of stream) {
  process.stdout.write(chunk.text || '');
}
```

## Rate Limiting Methods

### `checkRateLimit()`

Checks current rate limit status.

#### Returns

```javascript
{
  limited: Boolean,      // Whether currently rate limited
  remaining: Number,     // Remaining requests
  reset: Date,          // Reset time
  retryAfter: Number    // Seconds until retry
}
```

### `waitForRateLimit()`

Waits if rate limited before proceeding.

#### Example

```javascript
await loader.waitForRateLimit();
const response = await loader.generate({ prompt: "..." });
```

## Cost Tracking Methods

### `updateCosts(usage, model)`

Updates internal cost tracking.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `usage` | `Object` | Yes | Token usage object |
| `model` | `String` | Yes | Model identifier |

### `getCosts()`

Gets current cost information.

#### Returns

```javascript
{
  total: Number,           // Total cost in USD
  byModel: {
    'model-id': Number     // Cost per model
  },
  byProvider: {
    'provider': Number     // Cost per provider
  },
  currentSession: Number,  // Session cost
  daily: Number,          // Today's cost
  monthly: Number         // This month's cost
}
```

#### Example

```javascript
const costs = loader.getCosts();
console.log(`Total spent: $${costs.total.toFixed(4)}`);
```

### `resetCosts()`

Resets cost tracking.

## Model Management Methods

### `listModels()`

Lists available models for the provider.

#### Returns

`Promise<Array<Object>>` - Array of model configurations

#### Example

```javascript
const models = await loader.listModels();
models.forEach(model => {
  console.log(model.id, model.contextLength, model.pricing);
});
```

### `validateModel(modelId)`

Validates if a model is available.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `modelId` | `String` | Yes | Model identifier to validate |

#### Returns

`Promise<Boolean>` - Whether model is valid

## Cache Methods

### `getCacheKey(options)`

Generates cache key for request.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options` | `Object` | Yes | Request options |

#### Returns

`String` - Cache key

### `getCachedResponse(key)`

Gets cached response if available.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | `String` | Yes | Cache key |

#### Returns

`Object|null` - Cached response or null

### `setCachedResponse(key, response)`

Stores response in cache.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | `String` | Yes | Cache key |
| `response` | `Object` | Yes | Response to cache |

### `clearCache()`

Clears all cached responses.

## Provider-Specific Methods

### OpenAI-Specific

#### `createEmbedding(options)`

Creates text embeddings.

```javascript
const embeddings = await loader.createEmbedding({
  model: 'text-embedding-3-small',
  input: ['Text 1', 'Text 2'],
  dimensions: 1536
});
```

#### `moderate(options)`

Checks content for policy violations.

```javascript
const moderation = await loader.moderate({
  input: 'Text to check'
});
```

### Anthropic-Specific

#### `setSystemPrompt(prompt)`

Sets system prompt for Claude.

```javascript
loader.setSystemPrompt('You are a helpful coding assistant.');
```

### OpenRouter-Specific

#### `discoverModels(filters)`

Discovers available models with filters.

```javascript
const models = await loader.discoverModels({
  capabilities: ['vision', 'functions'],
  maxCost: 10,  // Per million tokens
  minContext: 32000
});
```

### Groq-Specific

#### `benchmark(options)`

Runs performance benchmark.

```javascript
const metrics = await loader.benchmark({
  prompt: 'Test prompt',
  iterations: 5
});
```

## Event Emitters

### Events

| Event | Description | Payload |
|-------|-------------|---------|
| `request` | Before API request | `{ options, provider, model }` |
| `response` | After API response | `{ response, latency, cached }` |
| `error` | On error | `{ error, attempt, willRetry }` |
| `retry` | On retry attempt | `{ attempt, delay, error }` |
| `rateLimit` | When rate limited | `{ retryAfter, limit, remaining }` |
| `tokenWarning` | High token usage | `{ usage, percentage, limit }` |
| `costWarning` | High cost | `{ cost, threshold, total }` |

### Example

```javascript
loader.on('response', (data) => {
  console.log(`Response in ${data.latency}ms`);
});

loader.on('error', (data) => {
  console.error(`Error: ${data.error.message}`);
  if (data.willRetry) {
    console.log(`Retrying (attempt ${data.attempt})`);
  }
});

loader.on('costWarning', (data) => {
  console.warn(`Cost warning: $${data.cost} (${data.percentage}% of threshold)`);
});
```

## Error Handling

### Error Types

| Error | Description | Properties |
|-------|-------------|------------|
| `APIError` | Base API error | `message`, `code`, `status` |
| `RateLimitError` | Rate limit exceeded | `retryAfter`, `limit` |
| `AuthenticationError` | Invalid API key | `message` |
| `ModelNotFoundError` | Model doesn't exist | `model`, `available` |
| `ContextLengthError` | Context too long | `tokens`, `limit` |
| `TimeoutError` | Request timeout | `timeout` |
| `NetworkError` | Network failure | `code`, `syscall` |

### Example

```javascript
try {
  const response = await loader.generate({ prompt: "..." });
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof AuthenticationError) {
    console.log('Check your API key');
  } else if (error instanceof ContextLengthError) {
    console.log(`Context too long: ${error.tokens} > ${error.limit}`);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Configuration Options

### Cache Configuration

```javascript
{
  enabled: Boolean,       // Enable caching (default: false)
  ttl: Number,           // Time to live in seconds (default: 3600)
  maxSize: Number,       // Max cache entries (default: 100)
  storage: String,       // Storage type: 'memory', 'redis' (default: 'memory')
  keyPrefix: String      // Cache key prefix (default: 'api:')
}
```

### Rate Limit Configuration

```javascript
{
  requestsPerMinute: Number,  // Max requests per minute
  requestsPerHour: Number,    // Max requests per hour
  tokensPerMinute: Number,    // Max tokens per minute
  tokensPerHour: Number,      // Max tokens per hour
  concurrent: Number,         // Max concurrent requests
  queueRequests: Boolean,     // Queue when rate limited (default: true)
  throwOnLimit: Boolean       // Throw error when limited (default: false)
}
```

### Retry Configuration

```javascript
{
  maxRetries: Number,         // Max retry attempts (default: 3)
  retryDelay: Number,        // Initial delay in ms (default: 1000)
  backoffMultiplier: Number, // Backoff multiplier (default: 2)
  maxRetryDelay: Number,     // Max delay in ms (default: 30000)
  retryOn: Array,           // Status codes to retry (default: [429, 500, 502, 503, 504])
  retryCondition: Function  // Custom retry condition
}
```

## Advanced Usage

### Custom Headers

```javascript
const loader = new APILoader({
  provider: 'openai',
  headers: {
    'X-Custom-Header': 'value',
    'User-Agent': 'MyApp/1.0'
  }
});
```

### Proxy Configuration

```javascript
const loader = new APILoader({
  provider: 'anthropic',
  proxy: {
    host: 'proxy.example.com',
    port: 8080,
    auth: {
      username: 'user',
      password: 'pass'
    }
  }
});
```

### Custom Timeout

```javascript
const loader = new APILoader({
  provider: 'groq',
  timeout: 10000,  // 10 seconds
  streamTimeout: 60000  // 60 seconds for streaming
});
```

### Request Interceptors

```javascript
loader.interceptors.request.use((config) => {
  console.log('Request:', config);
  config.headers['X-Request-ID'] = generateRequestId();
  return config;
});

loader.interceptors.response.use((response) => {
  console.log('Response:', response);
  return response;
});
```

## Type Definitions

### Message Type

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string | MessageContent[];
  name?: string;
  function_call?: FunctionCall;
}

interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}
```

### Response Type

```typescript
interface CompletionResponse {
  text: string;
  model: string;
  provider: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
  latency: number;
  cached: boolean;
  metadata?: any;
  functionCall?: FunctionCall;
  finishReason?: string;
}
```

### Stream Chunk Type

```typescript
interface StreamChunk {
  text?: string;
  index?: number;
  done?: boolean;
  usage?: Usage;
  cost?: number;
  metadata?: any;
  error?: Error;
}
```

## Migration from Other Libraries

### From OpenAI SDK

```javascript
// OpenAI SDK
const openai = new OpenAI({ apiKey });
const completion = await openai.chat.completions.create({
  messages: [{ role: 'user', content: 'Hello' }],
  model: 'gpt-4'
});

// LLM-Runner-Router
const loader = new APILoader({ provider: 'openai', apiKey });
const completion = await loader.chat({
  messages: [{ role: 'user', content: 'Hello' }],
  model: 'gpt-4'
});
```

### From Anthropic SDK

```javascript
// Anthropic SDK
const anthropic = new Anthropic({ apiKey });
const message = await anthropic.messages.create({
  model: 'claude-3-opus-20240229',
  messages: [{ role: 'user', content: 'Hello' }]
});

// LLM-Runner-Router
const loader = new APILoader({ provider: 'anthropic', apiKey });
const message = await loader.chat({
  model: 'claude-3-opus-20240229',
  messages: [{ role: 'user', content: 'Hello' }]
});
```

## See Also

- [Provider Documentation](../providers/)
- [Feature Documentation](../features/)
- [Examples](../../../examples/api-providers-demo.js)
- [Best Practices](../tutorials/best-practices.md)