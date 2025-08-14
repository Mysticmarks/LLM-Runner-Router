# ⚙️ Configuration Reference - Every Knob and Dial Explained

*Configuration is the art of making the complex simple and the powerful accessible*

## Table of Contents
- [Configuration Overview](#configuration-overview)
- [Router Configuration](#router-configuration)
- [Model Configuration](#model-configuration)
- [Engine Configuration](#engine-configuration)
- [Cache Configuration](#cache-configuration)
- [Security Configuration](#security-configuration)
- [Performance Configuration](#performance-configuration)
- [Logging Configuration](#logging-configuration)
- [Environment Variables](#environment-variables)
- [Configuration Examples](#configuration-examples)

## Configuration Overview

### Configuration Sources

Configuration is loaded in order of precedence:

1. **Environment Variables** (highest priority)
2. **Command Line Arguments**
3. **Configuration Files** (config.json, .llmrc)
4. **Constructor Options**
5. **Default Values** (lowest priority)

```javascript
// Multiple configuration sources
const router = new LLMRouter({
  // Direct constructor options
  strategy: 'balanced',
  
  // Will be overridden by environment variables
  maxTokens: process.env.MAX_TOKENS || 1000,
  
  // Load from file
  configFile: './config/production.json'
});
```

### Configuration Structure

```javascript
// Complete configuration schema
const fullConfig = {
  // Core router settings
  router: { /* ... */ },
  
  // Model management
  models: { /* ... */ },
  
  // Engine settings
  engines: { /* ... */ },
  
  // Caching configuration
  cache: { /* ... */ },
  
  // Security settings
  security: { /* ... */ },
  
  // Performance tuning
  performance: { /* ... */ },
  
  // Logging configuration
  logging: { /* ... */ },
  
  // API settings
  api: { /* ... */ }
};
```

## Router Configuration

### Basic Router Options

```javascript
const router = new LLMRouter({
  // Strategy for model selection
  strategy: 'balanced', // 'quality-first' | 'cost-optimized' | 'speed-priority' | 'balanced' | 'custom'
  
  // Maximum number of models to keep loaded
  maxModels: 5,
  
  // Auto-initialize on creation
  autoInit: true,
  
  // Fallback behavior
  fallbackEnabled: true,
  fallbackModels: ['gpt-3.5-turbo', 'llama-7b'],
  
  // Request timeout
  timeout: 30000, // 30 seconds
  
  // Retry configuration
  retries: {
    maxAttempts: 3,
    backoff: 'exponential', // 'linear' | 'exponential'
    initialDelay: 1000,
    maxDelay: 10000
  }
});
```

### Advanced Router Options

```javascript
const advancedConfig = {
  // Model selection weights
  selectionWeights: {
    quality: 0.4,
    cost: 0.3,
    speed: 0.2,
    availability: 0.1
  },
  
  // Load balancing
  loadBalancing: {
    enabled: true,
    algorithm: 'least-loaded', // 'round-robin' | 'weighted' | 'least-loaded'
    healthCheck: {
      enabled: true,
      interval: 30000, // 30 seconds
      timeout: 5000,   // 5 seconds
      failureThreshold: 3
    }
  },
  
  // Circuit breaker
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    resetTimeout: 60000,
    monitoringPeriod: 120000
  },
  
  // Model warming
  warming: {
    enabled: true,
    preloadModels: ['llama-7b', 'mistral-7b'],
    warmupPrompts: ['Hello', 'Test', 'Initialize']
  }
};
```

## Model Configuration

### Model Loading Options

```javascript
const modelConfig = {
  // Default model settings
  defaultModel: 'llama-7b-q4_k_m',
  
  // Model search paths
  modelPaths: [
    './models',
    '~/.cache/llm-models',
    '/opt/models'
  ],
  
  // Auto-download settings
  autoDownload: {
    enabled: true,
    sources: [
      'huggingface.co',
      'models.example.com'
    ],
    verifyChecksums: true,
    parallelDownloads: 4,
    resumeDownloads: true
  },
  
  // Model registry
  registry: {
    url: 'https://registry.llm-runner.com',
    cacheTime: 3600000, // 1 hour
    autoSync: true
  },
  
  // Quantization settings
  quantization: {
    enabled: true,
    defaultLevel: 'q4_k_m',
    dynamicQuantization: false,
    targetMemory: '4GB'
  }
};
```

### Model-Specific Configuration

```javascript
const modelSpecific = {
  models: {
    'llama-7b': {
      loader: 'gguf',
      quantization: 'q4_k_m',
      context: 4096,
      threads: 8,
      gpuLayers: 35,
      mmap: true,
      mlock: true
    },
    
    'gpt-4': {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1',
      timeout: 60000,
      retries: 2
    },
    
    'claude-3': {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: 'https://api.anthropic.com',
      version: '2023-06-01'
    }
  }
};
```

## Engine Configuration

### Engine Selection

```javascript
const engineConfig = {
  // Automatic engine selection
  autoSelectEngine: true,
  
  // Preferred engine order
  enginePriority: ['webgpu', 'node', 'wasm'],
  
  // Engine-specific settings
  engines: {
    webgpu: {
      enabled: true,
      powerPreference: 'high-performance', // 'low-power' | 'high-performance'
      requiredFeatures: ['shader-f16'],
      workgroupSize: 64,
      sharedMemory: true
    },
    
    wasm: {
      enabled: true,
      memory: {
        initial: 256,  // 16MB
        maximum: 4096  // 256MB
      },
      simd: true,
      threading: true,
      workers: 4
    },
    
    node: {
      enabled: true,
      nativeBindings: true,
      optimizations: ['avx2', 'fma'],
      threadCount: 'auto'
    }
  }
};
```

### WebGPU Configuration

```javascript
const webgpuConfig = {
  // Adapter selection
  adapter: {
    powerPreference: 'high-performance',
    forceFallbackAdapter: false
  },
  
  // Device settings
  device: {
    requiredFeatures: [
      'shader-f16',
      'timestamp-query'
    ],
    requiredLimits: {
      maxComputeInvocationsPerWorkgroup: 256,
      maxComputeWorkgroupSizeX: 256,
      maxComputeWorkgroupSizeY: 256,
      maxComputeWorkgroupSizeZ: 64
    }
  },
  
  // Pipeline settings
  pipeline: {
    cacheEnabled: true,
    maxPipelines: 100,
    shaderOptimization: true
  },
  
  // Buffer management
  buffers: {
    reuseBuffers: true,
    maxBufferSize: 1024 * 1024 * 1024, // 1GB
    alignment: 256
  }
};
```

### WASM Configuration

```javascript
const wasmConfig = {
  // Memory configuration
  memory: {
    initial: 256,    // Pages (16MB)
    maximum: 4096,   // Pages (256MB)
    shared: true
  },
  
  // Threading
  threading: {
    enabled: true,
    workers: Math.min(8, require('os').cpus().length),
    sharedArrayBuffer: true
  },
  
  // SIMD support
  simd: {
    enabled: true,
    autoDetect: true
  },
  
  // Module loading
  modules: {
    cache: true,
    precompile: true,
    validation: true
  }
};
```

## Cache Configuration

### Multi-tier Cache Setup

```javascript
const cacheConfig = {
  cache: {
    enabled: true,
    
    // L1 Cache (in-memory)
    l1: {
      enabled: true,
      maxSize: 100,        // Number of entries
      maxMemory: '256MB',
      ttl: 3600000,        // 1 hour
      algorithm: 'lru'     // 'lru' | 'lfu' | 'fifo'
    },
    
    // L2 Cache (Redis)
    l2: {
      enabled: true,
      type: 'redis',
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      maxMemory: '1GB',
      ttl: 7200000,        // 2 hours
      compression: true,
      keyPrefix: 'llmr:'
    },
    
    // L3 Cache (disk)
    l3: {
      enabled: true,
      type: 'disk',
      path: './cache',
      maxSize: '10GB',
      ttl: 86400000,       // 24 hours
      compression: true
    }
  }
};
```

### Cache Strategies

```javascript
const cacheStrategies = {
  // Cache key generation
  keyGeneration: {
    includeModel: true,
    includePrompt: true,
    includeParams: true,
    hashAlgorithm: 'sha256',
    maxKeyLength: 250
  },
  
  // Invalidation rules
  invalidation: {
    onModelUpdate: true,
    onConfigChange: true,
    maxAge: 86400000,     // 24 hours
    unusedThreshold: 7    // Days
  },
  
  // Preloading
  preloading: {
    enabled: true,
    commonPrompts: [
      'Hello',
      'How are you?',
      'What can you do?'
    ],
    scheduledPreload: '0 2 * * *' // Daily at 2 AM
  },
  
  // Cache warming
  warming: {
    enabled: true,
    warmupModels: ['llama-7b', 'mistral-7b'],
    warmupPrompts: ['test', 'hello', 'init']
  }
};
```

## Security Configuration

### Authentication & Authorization

```javascript
const securityConfig = {
  security: {
    // Authentication
    authentication: {
      enabled: true,
      method: 'api-key',      // 'api-key' | 'jwt' | 'oauth'
      keyLength: 32,
      keyPrefix: 'llmr_',
      expiration: 365 * 24 * 60 * 60 * 1000 // 1 year
    },
    
    // Authorization
    authorization: {
      enabled: true,
      rbac: true,
      defaultRole: 'user',
      roles: {
        admin: ['*'],
        developer: ['model:load', 'inference:*', 'debug:*'],
        user: ['inference:basic'],
        readonly: ['status:read', 'models:list']
      }
    },
    
    // Rate limiting
    rateLimit: {
      enabled: true,
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,                 // Requests per window
      skipSuccessfulRequests: false,
      keyGenerator: (req) => req.ip
    }
  }
};
```

### Model Security

```javascript
const modelSecurity = {
  // Model verification
  verification: {
    enabled: true,
    checksumValidation: true,
    signatureValidation: true,
    trustedSources: [
      'huggingface.co',
      'models.example.com'
    ]
  },
  
  // Sandboxing
  sandboxing: {
    enabled: true,
    isolateModels: true,
    memoryLimit: '2GB',
    cpuLimit: 80, // Percentage
    networkAccess: false,
    fileSystemAccess: 'readonly'
  },
  
  // Input validation
  inputValidation: {
    enabled: true,
    maxPromptLength: 4096,
    blacklistedPatterns: [
      /ignore previous instructions/i,
      /system:\s*you are now/i
    ],
    sanitization: true
  }
};
```

## Performance Configuration

### Resource Management

```javascript
const performanceConfig = {
  performance: {
    // Memory management
    memory: {
      maxUsage: '8GB',
      gcThreshold: '6GB',
      memoryMapping: true,
      pageLocking: true,
      swapPath: '/tmp/llm-swap'
    },
    
    // CPU settings
    cpu: {
      threads: 'auto',           // Or specific number
      affinity: 'auto',          // CPU core binding
      priority: 'normal',        // Process priority
      throttling: {
        enabled: true,
        maxCpuUsage: 80          // Percentage
      }
    },
    
    // Concurrency limits
    concurrency: {
      maxConcurrentRequests: 10,
      maxConcurrentModels: 3,
      queueSize: 100,
      requestTimeout: 30000
    }
  }
};
```

### Optimization Settings

```javascript
const optimizations = {
  // Batch processing
  batching: {
    enabled: true,
    maxBatchSize: 32,
    batchTimeout: 100,        // ms
    dynamicBatching: true
  },
  
  // Streaming optimizations
  streaming: {
    enabled: true,
    chunkSize: 1,             // Tokens per chunk
    bufferSize: 1024,
    backpressure: true
  },
  
  // Model optimizations
  modelOptimization: {
    quantization: 'dynamic',
    pruning: false,
    compilation: true,
    tensorRT: false           // NVIDIA TensorRT
  }
};
```

## Logging Configuration

### Log Levels and Output

```javascript
const loggingConfig = {
  logging: {
    // Log level
    level: 'info',            // 'error' | 'warn' | 'info' | 'debug' | 'trace'
    
    // Output destinations
    outputs: [
      {
        type: 'console',
        level: 'info',
        colorize: true,
        timestamp: true
      },
      {
        type: 'file',
        level: 'debug',
        filename: './logs/llm-router.log',
        maxSize: '10MB',
        maxFiles: 5,
        rotateDaily: true
      },
      {
        type: 'syslog',
        level: 'error',
        facility: 'local0',
        tag: 'llm-router'
      }
    ],
    
    // Log format
    format: {
      timestamp: 'ISO',         // 'ISO' | 'epoch' | custom format
      includeLevel: true,
      includeContext: true,
      structured: true          // JSON logging
    }
  }
};
```

### Structured Logging

```javascript
const structuredLogging = {
  // Correlation IDs
  correlation: {
    enabled: true,
    headerName: 'X-Correlation-ID',
    autoGenerate: true
  },
  
  // Request logging
  requests: {
    enabled: true,
    includeHeaders: false,
    includeBody: false,       // Security consideration
    includeResponse: true,
    sanitizeFields: ['password', 'token', 'key']
  },
  
  // Performance logging
  performance: {
    enabled: true,
    includeTimings: true,
    includeMemory: true,
    includeCpu: false
  },
  
  // Error logging
  errors: {
    includeStack: true,
    includeContext: true,
    captureUncaught: true,
    notifyOnError: false
  }
};
```

## Environment Variables

### Core Environment Variables

```bash
# Application
NODE_ENV=production
DEBUG=0
PORT=3000
HOST=0.0.0.0

# Models
MODEL_PATH=./models
AUTO_DOWNLOAD_MODELS=true
VERIFY_MODEL_SIGNATURES=true
MAX_MODEL_SIZE=10GB

# Cache
CACHE_ENABLED=true
REDIS_URL=redis://localhost:6379
CACHE_TTL=3600
CACHE_MAX_SIZE=1GB

# Security
API_KEY_PREFIX=llmr_
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=900000
TRUSTED_MODEL_SOURCES=huggingface.co

# Performance
MAX_CONCURRENT_REQUESTS=10
REQUEST_TIMEOUT=30000
MEMORY_LIMIT=8GB
CPU_THREADS=auto

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/llm-router.log
LOG_FORMAT=json
ENABLE_REQUEST_LOGGING=true
```

### Service-Specific Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TIMEOUT=60000

# Anthropic Configuration
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_VERSION=2023-06-01

# Azure OpenAI
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_VERSION=2023-12-01-preview

# Hugging Face
HUGGINGFACE_API_TOKEN=hf_...
HUGGINGFACE_CACHE_DIR=~/.cache/huggingface

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
ENABLE_TRACING=true
JAEGER_ENDPOINT=http://localhost:14268/api/traces
```

## Configuration Examples

### Development Configuration

```javascript
// config/development.js
export default {
  router: {
    strategy: 'speed-priority',
    autoInit: true,
    timeout: 15000
  },
  
  models: {
    autoDownload: true,
    defaultModel: 'tinyllama',
    modelPaths: ['./models']
  },
  
  engines: {
    autoSelectEngine: true,
    enginePriority: ['wasm', 'node']
  },
  
  cache: {
    enabled: true,
    l1: { enabled: true, maxSize: 50 },
    l2: { enabled: false },
    l3: { enabled: false }
  },
  
  security: {
    authentication: { enabled: false },
    rateLimit: { enabled: false }
  },
  
  logging: {
    level: 'debug',
    outputs: [{ type: 'console', colorize: true }]
  }
};
```

### Production Configuration

```javascript
// config/production.js
export default {
  router: {
    strategy: 'balanced',
    autoInit: true,
    timeout: 30000,
    retries: { maxAttempts: 3 }
  },
  
  models: {
    autoDownload: false,
    verifyChecksums: true,
    defaultModel: 'llama-7b-q4_k_m',
    modelPaths: ['/opt/models']
  },
  
  engines: {
    autoSelectEngine: true,
    enginePriority: ['webgpu', 'node', 'wasm']
  },
  
  cache: {
    enabled: true,
    l1: { enabled: true, maxSize: 1000 },
    l2: { enabled: true, url: process.env.REDIS_URL },
    l3: { enabled: true, path: '/var/cache/llm' }
  },
  
  security: {
    authentication: { enabled: true },
    authorization: { enabled: true },
    rateLimit: { enabled: true, max: 1000 }
  },
  
  performance: {
    memory: { maxUsage: '16GB' },
    concurrency: { maxConcurrentRequests: 100 }
  },
  
  logging: {
    level: 'info',
    outputs: [
      { type: 'file', filename: '/var/log/llm-router.log' },
      { type: 'console', level: 'error' }
    ]
  }
};
```

### Enterprise Configuration

```javascript
// config/enterprise.js
export default {
  router: {
    strategy: 'quality-first',
    fallbackEnabled: true,
    circuitBreaker: { enabled: true }
  },
  
  models: {
    registry: {
      url: 'https://enterprise-registry.company.com',
      authentication: true
    },
    verification: {
      signatureValidation: true,
      trustedSources: ['internal.company.com']
    }
  },
  
  security: {
    authentication: { method: 'oauth' },
    authorization: { rbac: true },
    sandboxing: { enabled: true },
    auditLogging: { enabled: true }
  },
  
  monitoring: {
    metrics: { enabled: true, endpoint: '/metrics' },
    tracing: { enabled: true, jaegerEndpoint: process.env.JAEGER_ENDPOINT },
    healthChecks: { enabled: true, endpoint: '/health' }
  },
  
  compliance: {
    dataRetention: { enabled: true, maxAge: 2592000000 }, // 30 days
    encryption: { atRest: true, inTransit: true },
    auditTrail: { enabled: true, immutable: true }
  }
};
```

---

*"Good configuration is invisible - it just works. Great configuration adapts and learns."*

*Configure once, run everywhere, optimize forever* ⚙️

Built with 💙 by Echo AI Systems