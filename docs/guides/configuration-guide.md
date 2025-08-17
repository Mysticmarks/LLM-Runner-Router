# Configuration Guide

This comprehensive guide covers all configuration options for LLM Runner Router, from basic setup to advanced enterprise features.

## Table of Contents

1. [Configuration Overview](#configuration-overview)
2. [Environment Variables](#environment-variables)
3. [Configuration File](#configuration-file)
4. [Runtime Configuration](#runtime-configuration)
5. [Model Configuration](#model-configuration)
6. [Performance Tuning](#performance-tuning)
7. [Security Configuration](#security-configuration)
8. [Monitoring Configuration](#monitoring-configuration)
9. [Enterprise Configuration](#enterprise-configuration)
10. [Advanced Scenarios](#advanced-scenarios)

## Configuration Overview

LLM Runner Router supports multiple configuration methods with the following precedence (highest to lowest):

1. **Runtime Parameters** - Direct API calls
2. **Environment Variables** - System environment
3. **Configuration Files** - JSON/YAML config files
4. **Default Values** - Built-in defaults

### Configuration Sources

```javascript
// Configuration can be provided via:

// 1. Constructor options
const router = new LLMRouter({
    performance: { maxConcurrent: 10 },
    logging: { level: 'debug' }
});

// 2. Configuration file
const router = new LLMRouter({
    configFile: './config/production.json'
});

// 3. Environment variables (automatic)
// NODE_ENV, PORT, LOG_LEVEL, etc.

// 4. Runtime updates
router.updateConfig({
    routing: { strategy: 'quality-first' }
});
```

## Environment Variables

### Core Settings

```bash
# Application
NODE_ENV=production                    # Environment (development|production|test)
PORT=3000                             # Server port
HOST=0.0.0.0                          # Server host

# Logging
LOG_LEVEL=info                        # Logging level (debug|info|warn|error)
LOG_FILE=./logs/app.log              # Log file path
LOG_FORMAT=json                       # Log format (json|text)
ENABLE_REQUEST_LOGGING=true           # Request logging

# Performance
MAX_CONCURRENT_REQUESTS=20            # Max concurrent requests
REQUEST_TIMEOUT_MS=30000              # Request timeout in milliseconds
ENABLE_CLUSTERING=false               # Enable Node.js clustering
CLUSTER_WORKERS=0                     # Number of workers (0 = auto)

# Cache
CACHE_ENABLED=true                    # Enable caching
CACHE_TTL=3600                        # Cache TTL in seconds
CACHE_MAX_SIZE=1000                   # Max cache entries
CACHE_TYPE=memory                     # Cache type (memory|redis|file)

# Models
MODEL_CACHE_DIR=./models/cache        # Model cache directory
MODEL_REGISTRY_PATH=./models/registry.json  # Model registry file
AUTO_DOWNLOAD_MODELS=true             # Auto-download missing models
PREFER_LOCAL_MODELS=true              # Prefer local over remote models

# Routing
DEFAULT_ROUTING_STRATEGY=balanced     # Default routing strategy
ENABLE_FALLBACK=true                  # Enable model fallback
HEALTH_CHECK_INTERVAL=30000           # Health check interval (ms)
LOAD_BALANCING=true                   # Enable load balancing

# Security
ENABLE_AUTH=false                     # Enable authentication
JWT_SECRET=your-secret-key            # JWT secret key
API_KEY_HEADER=X-API-Key             # API key header name
RATE_LIMIT_ENABLED=true              # Enable rate limiting
RATE_LIMIT_WINDOW=60000              # Rate limit window (ms)
RATE_LIMIT_MAX=100                   # Max requests per window

# External APIs
OPENAI_API_KEY=sk-...                # OpenAI API key
HUGGINGFACE_TOKEN=hf_...             # HuggingFace token
ANTHROPIC_API_KEY=...                # Anthropic API key

# Database
DATABASE_URL=postgresql://...         # Database connection URL
DATABASE_POOL_SIZE=20                # Database connection pool size
DATABASE_TIMEOUT=30000               # Database timeout (ms)

# Redis
REDIS_URL=redis://localhost:6379     # Redis connection URL
REDIS_PASSWORD=...                   # Redis password
REDIS_DB=0                           # Redis database number

# Monitoring
ENABLE_METRICS=true                  # Enable Prometheus metrics
METRICS_PORT=9090                    # Metrics server port
ENABLE_TRACING=false                 # Enable OpenTelemetry tracing
JAEGER_ENDPOINT=http://localhost:14268  # Jaeger endpoint
ENABLE_PROFILING=false               # Enable performance profiling

# Enterprise Features
ENABLE_MULTI_TENANCY=false           # Enable multi-tenancy
ENABLE_AB_TESTING=false              # Enable A/B testing
ENABLE_AUDIT_LOGGING=false           # Enable audit logging
ENABLE_SLA_MONITORING=false          # Enable SLA monitoring
```

### Development vs Production

```bash
# Development
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_REQUEST_LOGGING=true
AUTO_DOWNLOAD_MODELS=true
CACHE_TTL=300
MAX_CONCURRENT_REQUESTS=5

# Production
NODE_ENV=production
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=false
AUTO_DOWNLOAD_MODELS=false
CACHE_TTL=3600
MAX_CONCURRENT_REQUESTS=50
ENABLE_CLUSTERING=true
CLUSTER_WORKERS=4
```

## Configuration File

### Basic Configuration

```json
{
  "environment": "production",
  "server": {
    "port": 3000,
    "host": "0.0.0.0",
    "timeout": 30000,
    "keepAliveTimeout": 5000
  },
  "logging": {
    "level": "info",
    "format": "json",
    "file": "./logs/app.log",
    "enableRequestLogging": false,
    "enableErrorTracking": true
  },
  "performance": {
    "maxConcurrent": 20,
    "enableClustering": true,
    "clusterWorkers": 4,
    "enableGracefulShutdown": true,
    "shutdownTimeout": 10000
  },
  "cache": {
    "enabled": true,
    "type": "redis",
    "ttl": 3600,
    "maxSize": 10000,
    "redis": {
      "url": "redis://localhost:6379",
      "db": 0,
      "keyPrefix": "llm-router:"
    }
  },
  "models": {
    "cacheDir": "./models/cache",
    "registryPath": "./models/registry.json",
    "autoDownload": false,
    "preferLocal": true,
    "downloadRetries": 3,
    "downloadTimeout": 300000
  },
  "routing": {
    "strategy": "balanced",
    "enableFallback": true,
    "fallbackStrategy": "quality-first",
    "healthCheckInterval": 30000,
    "loadBalancing": true,
    "circuitBreaker": {
      "enabled": true,
      "failureThreshold": 5,
      "resetTimeout": 30000
    }
  },
  "security": {
    "enableAuth": true,
    "jwtSecret": "${JWT_SECRET}",
    "apiKeyHeader": "X-API-Key",
    "rateLimit": {
      "enabled": true,
      "window": 60000,
      "max": 100,
      "skipSuccessfulRequests": false
    },
    "cors": {
      "origin": ["https://yourapp.com"],
      "credentials": true
    },
    "helmet": {
      "enabled": true,
      "contentSecurityPolicy": true,
      "hsts": true
    }
  },
  "monitoring": {
    "enabled": true,
    "metrics": {
      "enabled": true,
      "port": 9090,
      "path": "/metrics"
    },
    "tracing": {
      "enabled": false,
      "jaegerEndpoint": "http://localhost:14268"
    },
    "healthCheck": {
      "enabled": true,
      "path": "/health",
      "interval": 30000
    }
  }
}
```

### Advanced Configuration

```json
{
  "engines": {
    "preferred": ["webgpu", "wasm", "native"],
    "fallback": true,
    "autoSelect": true,
    "webgpu": {
      "enabled": true,
      "device": "auto",
      "powerPreference": "high-performance"
    },
    "wasm": {
      "enabled": true,
      "threads": 4,
      "simd": true
    },
    "native": {
      "enabled": true,
      "acceleration": "auto"
    }
  },
  "pipeline": {
    "preprocessing": {
      "enabled": true,
      "tokenization": true,
      "normalization": true
    },
    "postprocessing": {
      "enabled": true,
      "filtering": true,
      "formatting": true
    },
    "middleware": [
      "authentication",
      "rateLimit",
      "validation",
      "logging"
    ]
  },
  "quantization": {
    "enabled": true,
    "defaultPrecision": "int8",
    "dynamicQuantization": true,
    "calibrationDataset": "./calibration.json"
  },
  "ensemble": {
    "enabled": false,
    "strategy": "weighted_average",
    "weights": [0.5, 0.3, 0.2],
    "aggregation": "mean",
    "consensus": {
      "enabled": true,
      "threshold": 0.8
    }
  }
}
```

### Environment-Specific Configs

```javascript
// config/development.json
{
  "logging": { "level": "debug" },
  "models": { "autoDownload": true },
  "cache": { "ttl": 300 },
  "performance": { "maxConcurrent": 2 }
}

// config/production.json
{
  "logging": { "level": "warn" },
  "models": { "autoDownload": false },
  "cache": { "ttl": 3600 },
  "performance": { "maxConcurrent": 50 }
}

// config/test.json
{
  "logging": { "level": "error" },
  "models": { "autoDownload": false },
  "cache": { "enabled": false },
  "performance": { "maxConcurrent": 1 }
}
```

## Runtime Configuration

### Dynamic Configuration Updates

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter();

// Update configuration at runtime
await router.updateConfig({
    routing: {
        strategy: 'quality-first'
    },
    performance: {
        maxConcurrent: 15
    }
});

// Update specific sections
await router.updateLoggingConfig({
    level: 'debug',
    enableRequestLogging: true
});

await router.updatePerformanceConfig({
    maxConcurrent: 25,
    enableStreaming: true
});

// Get current configuration
const config = router.getConfig();
console.log('Current config:', config);

// Reset to defaults
await router.resetConfig();

// Reload from file
await router.reloadConfig('./config/new-config.json');
```

### Configuration Validation

```javascript
// Validate configuration before applying
const configSchema = {
    performance: {
        maxConcurrent: { type: 'number', min: 1, max: 100 },
        timeout: { type: 'number', min: 1000, max: 300000 }
    },
    logging: {
        level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] }
    }
};

try {
    await router.updateConfig(newConfig, { validate: true, schema: configSchema });
} catch (error) {
    console.error('Configuration validation failed:', error.message);
}
```

## Model Configuration

### Model Registry Configuration

```json
{
  "models": [
    {
      "id": "gpt-3.5-turbo",
      "name": "GPT-3.5 Turbo",
      "type": "remote",
      "provider": "openai",
      "format": "api",
      "config": {
        "maxTokens": 4096,
        "temperature": 0.7,
        "topP": 1.0,
        "frequencyPenalty": 0,
        "presencePenalty": 0
      },
      "pricing": {
        "inputCost": 0.0015,
        "outputCost": 0.002,
        "currency": "USD",
        "per": 1000
      },
      "capabilities": ["text-generation", "chat", "completion"],
      "limits": {
        "requestsPerMinute": 3500,
        "tokensPerMinute": 90000
      }
    },
    {
      "id": "tinyllama-1.1b",
      "name": "TinyLlama 1.1B",
      "type": "local",
      "format": "gguf",
      "source": "./models/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
      "config": {
        "contextLength": 2048,
        "temperature": 0.8,
        "topK": 40,
        "topP": 0.95,
        "repeatPenalty": 1.1
      },
      "requirements": {
        "memory": "2GB",
        "diskSpace": "800MB",
        "gpu": false
      },
      "performance": {
        "tokensPerSecond": 25,
        "loadTime": 5000,
        "memoryUsage": "1.5GB"
      }
    },
    {
      "id": "custom-ensemble",
      "name": "Custom Ensemble",
      "type": "ensemble",
      "models": ["gpt-3.5-turbo", "tinyllama-1.1b", "phi-2"],
      "config": {
        "strategy": "weighted_average",
        "weights": [0.5, 0.3, 0.2],
        "aggregation": "consensus",
        "consensusThreshold": 0.7
      }
    }
  ],
  "templates": [
    {
      "id": "chat-template",
      "name": "Chat Template",
      "format": "<|system|>\n{system}\n<|user|>\n{user}\n<|assistant|>\n",
      "stopTokens": ["<|user|>", "<|system|>"],
      "modelCompatibility": ["tinyllama-1.1b", "phi-2"]
    }
  ],
  "strategies": {
    "balanced": {
      "weights": {
        "performance": 0.4,
        "quality": 0.4,
        "cost": 0.2
      },
      "fallback": true
    },
    "quality-first": {
      "weights": {
        "performance": 0.2,
        "quality": 0.7,
        "cost": 0.1
      },
      "minQualityScore": 0.8
    },
    "speed-priority": {
      "weights": {
        "performance": 0.8,
        "quality": 0.1,
        "cost": 0.1
      },
      "maxLatency": 2000
    }
  }
}
```

### Model Loading Configuration

```javascript
// Model-specific loading configuration
const modelConfig = {
    // GGUF models
    gguf: {
        contextLength: 2048,
        nThreads: 4,
        nGpuLayers: 0,
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        repeatPenalty: 1.1,
        enableMmap: true,
        enableMlock: false
    },
    
    // HuggingFace models
    huggingface: {
        modelName: 'microsoft/DialoGPT-medium',
        tokenizer: 'auto',
        device: 'auto',
        precision: 'fp16',
        maxLength: 1000,
        doSample: true,
        padTokenId: 50256
    },
    
    // ONNX models
    onnx: {
        executionProviders: ['CPUExecutionProvider'],
        graphOptimizationLevel: 'all',
        enableMemPattern: true,
        enableCpuMemArena: true,
        sessionOptions: {
            executionMode: 'sequential',
            enableProfiling: false
        }
    },
    
    // WebGPU models
    webgpu: {
        device: 'auto',
        powerPreference: 'high-performance',
        enableShaderCache: true,
        maxBufferSize: '1GB',
        computePassDescriptor: {
            label: 'LLM Inference'
        }
    }
};
```

## Performance Tuning

### Memory Management

```javascript
const performanceConfig = {
    memory: {
        // Heap management
        maxOldSpaceSize: 4096,  // MB
        maxSemiSpaceSize: 256,  // MB
        
        // Model memory
        modelCacheSize: '2GB',
        sharedMemoryEnabled: true,
        memoryMappingEnabled: true,
        
        // Garbage collection
        gcStrategy: 'incremental',
        gcThreshold: 0.8,
        enableWeakRefs: true
    },
    
    concurrency: {
        maxConcurrentRequests: 20,
        queueSize: 100,
        workerThreads: 4,
        loadBalancingStrategy: 'round-robin',
        
        // Resource pooling
        connectionPoolSize: 20,
        keepAliveTimeout: 5000,
        requestTimeout: 30000
    },
    
    optimization: {
        enableJIT: true,
        enableTensorOptimization: true,
        enableModelQuantization: true,
        enableBatching: true,
        batchSize: 8,
        batchTimeout: 100
    }
};
```

### CPU and GPU Optimization

```javascript
const hardwareConfig = {
    cpu: {
        threads: 0,  // 0 = auto-detect
        affinityMask: null,  // CPU affinity
        enableAVX: true,
        enableFMA: true,
        enableF16C: true
    },
    
    gpu: {
        enabled: true,
        devices: ['auto'],  // 'auto', 'cuda:0', 'opencl:0'
        memoryFraction: 0.8,
        enableTensorCore: true,
        enableMixedPrecision: true,
        kernelCacheSize: '500MB'
    },
    
    webgpu: {
        enabled: true,
        powerPreference: 'high-performance',
        forceFallbackAdapter: false,
        limits: {
            maxBindGroups: 4,
            maxBufferSize: 1073741824  // 1GB
        }
    }
};
```

### Network and I/O Optimization

```javascript
const networkConfig = {
    http: {
        keepAlive: true,
        keepAliveTimeout: 5000,
        maxSockets: 256,
        maxFreeSockets: 256,
        timeout: 30000
    },
    
    compression: {
        enabled: true,
        algorithm: 'gzip',
        level: 6,
        threshold: 1024
    },
    
    streaming: {
        enabled: true,
        bufferSize: 8192,
        highWaterMark: 16384,
        backpressureThreshold: 65536
    },
    
    fileSystem: {
        enableAsyncIO: true,
        bufferSize: 65536,
        enableDirectIO: false,
        cacheSize: '100MB'
    }
};
```

## Security Configuration

### Authentication and Authorization

```javascript
const securityConfig = {
    authentication: {
        enabled: true,
        methods: ['jwt', 'apikey', 'oauth2'],
        
        jwt: {
            secret: process.env.JWT_SECRET,
            algorithm: 'HS256',
            expiresIn: '24h',
            issuer: 'llm-router',
            audience: 'api-clients'
        },
        
        apikey: {
            header: 'X-API-Key',
            queryParam: 'api_key',
            hashAlgorithm: 'sha256',
            saltRounds: 10
        },
        
        oauth2: {
            providers: ['google', 'github'],
            scopes: ['read', 'write'],
            redirectUri: 'https://yourapp.com/callback'
        }
    },
    
    authorization: {
        enabled: true,
        model: 'rbac',  // rbac, abac, acl
        
        roles: {
            admin: ['*'],
            user: ['read', 'inference'],
            guest: ['read']
        },
        
        resources: {
            models: ['read', 'write', 'execute'],
            config: ['read', 'write'],
            metrics: ['read']
        }
    },
    
    encryption: {
        enabled: true,
        algorithm: 'aes-256-gcm',
        keyDerivation: 'pbkdf2',
        iterations: 100000,
        
        // Encrypt sensitive model data
        encryptModels: true,
        encryptCache: true,
        encryptLogs: false
    }
};
```

### Network Security

```javascript
const networkSecurityConfig = {
    tls: {
        enabled: true,
        version: ['TLSv1.2', 'TLSv1.3'],
        ciphers: [
            'ECDHE-RSA-AES256-GCM-SHA384',
            'ECDHE-RSA-AES128-GCM-SHA256'
        ],
        dhParam: './certs/dhparam.pem',
        cert: './certs/server.crt',
        key: './certs/server.key',
        ca: './certs/ca.crt'
    },
    
    firewall: {
        enabled: true,
        allowlist: ['192.168.1.0/24', '10.0.0.0/8'],
        blocklist: ['192.168.1.100'],
        rules: [
            { action: 'allow', source: '192.168.1.0/24', port: 3000 },
            { action: 'deny', source: '*', port: 22 }
        ]
    },
    
    ddos: {
        enabled: true,
        maxConnections: 1000,
        maxConnectionsPerIP: 10,
        windowMs: 60000,
        delayAfter: 100,
        delayMs: 500
    }
};
```

## Monitoring Configuration

### Metrics and Observability

```javascript
const monitoringConfig = {
    metrics: {
        enabled: true,
        provider: 'prometheus',
        port: 9090,
        path: '/metrics',
        interval: 15000,
        
        custom: {
            requestDuration: {
                type: 'histogram',
                buckets: [0.1, 0.5, 1, 2, 5, 10]
            },
            modelInference: {
                type: 'counter',
                labels: ['model_id', 'status']
            },
            activeConnections: {
                type: 'gauge'
            }
        }
    },
    
    tracing: {
        enabled: false,
        provider: 'jaeger',
        endpoint: 'http://localhost:14268',
        serviceName: 'llm-router',
        
        sampling: {
            type: 'probabilistic',
            param: 0.1  // 10% sampling
        },
        
        exporters: [
            { type: 'jaeger', endpoint: 'http://localhost:14268' },
            { type: 'zipkin', endpoint: 'http://localhost:9411' }
        ]
    },
    
    logging: {
        level: 'info',
        format: 'json',
        transports: [
            { type: 'console', colorize: true },
            { type: 'file', filename: './logs/app.log' },
            { type: 'elasticsearch', index: 'llm-router-logs' }
        ],
        
        correlation: {
            enabled: true,
            header: 'X-Correlation-ID',
            generator: 'uuid'
        }
    }
};
```

### Health Checks

```javascript
const healthConfig = {
    healthCheck: {
        enabled: true,
        path: '/health',
        interval: 30000,
        timeout: 5000,
        
        checks: {
            memory: {
                enabled: true,
                threshold: 0.9  // 90% memory usage
            },
            cpu: {
                enabled: true,
                threshold: 0.8  // 80% CPU usage
            },
            disk: {
                enabled: true,
                threshold: 0.9,  // 90% disk usage
                path: './'
            },
            models: {
                enabled: true,
                checkAllModels: false,
                timeout: 10000
            },
            database: {
                enabled: true,
                query: 'SELECT 1',
                timeout: 5000
            },
            redis: {
                enabled: true,
                command: 'ping',
                timeout: 2000
            }
        }
    },
    
    readiness: {
        enabled: true,
        path: '/ready',
        
        checks: {
            modelsLoaded: true,
            databaseConnected: true,
            cacheReady: true,
            configValid: true
        }
    }
};
```

## Enterprise Configuration

### Multi-Tenancy

```javascript
const multiTenancyConfig = {
    enabled: true,
    isolation: 'namespace',  // namespace, database, schema
    
    tenants: {
        'tenant1': {
            name: 'Enterprise Customer 1',
            limits: {
                requestsPerMinute: 1000,
                modelsAllowed: ['gpt-4', 'claude-3'],
                maxConcurrent: 50
            },
            config: {
                routing: { strategy: 'quality-first' },
                logging: { level: 'info' }
            }
        },
        'tenant2': {
            name: 'Startup Customer',
            limits: {
                requestsPerMinute: 100,
                modelsAllowed: ['gpt-3.5-turbo'],
                maxConcurrent: 5
            }
        }
    },
    
    defaultLimits: {
        requestsPerMinute: 100,
        modelsAllowed: ['tinyllama-1.1b'],
        maxConcurrent: 2
    }
};
```

### A/B Testing

```javascript
const abTestingConfig = {
    enabled: true,
    platform: 'internal',  // internal, optimizely, split
    
    experiments: {
        'model-comparison': {
            enabled: true,
            variants: {
                control: {
                    weight: 50,
                    config: { routing: { strategy: 'balanced' } }
                },
                treatment: {
                    weight: 50,
                    config: { routing: { strategy: 'quality-first' } }
                }
            },
            metrics: ['response_time', 'quality_score', 'user_satisfaction'],
            duration: 7 * 24 * 60 * 60 * 1000  // 7 days
        }
    },
    
    assignment: {
        method: 'hash',  // hash, random, sticky
        key: 'user_id',
        seed: 'experiment-seed'
    }
};
```

## Advanced Scenarios

### High Availability Setup

```javascript
const haConfig = {
    clustering: {
        enabled: true,
        workers: 'auto',  // number or 'auto'
        strategy: 'round-robin',
        
        gracefulShutdown: {
            enabled: true,
            timeout: 30000,
            forceExit: true
        }
    },
    
    loadBalancing: {
        enabled: true,
        strategy: 'least-connections',
        healthChecks: true,
        
        upstream: [
            { host: 'llm-router-1', port: 3000, weight: 1 },
            { host: 'llm-router-2', port: 3000, weight: 1 },
            { host: 'llm-router-3', port: 3000, weight: 2 }
        ]
    },
    
    failover: {
        enabled: true,
        detectFailures: true,
        maxRetries: 3,
        retryDelay: 1000,
        circuitBreaker: {
            enabled: true,
            threshold: 5,
            timeout: 30000
        }
    }
};
```

### Edge Deployment

```javascript
const edgeConfig = {
    edge: {
        enabled: true,
        provider: 'cloudflare',  // cloudflare, vercel, aws-lambda
        
        regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
        routing: 'geographic',
        
        limitations: {
            memoryLimit: '128MB',
            timeoutLimit: 30000,
            coldStartOptimization: true
        },
        
        models: {
            // Only lightweight models for edge
            allowed: ['tinyllama-1.1b', 'phi-2-mini'],
            fallbackToOrigin: true
        }
    }
};
```

### Development vs Staging vs Production

```javascript
// Development
const devConfig = {
    environment: 'development',
    logging: { level: 'debug' },
    models: { autoDownload: true },
    performance: { maxConcurrent: 2 },
    security: { enabled: false },
    monitoring: { enabled: false }
};

// Staging
const stagingConfig = {
    environment: 'staging',
    logging: { level: 'info' },
    models: { autoDownload: true },
    performance: { maxConcurrent: 10 },
    security: { enabled: true },
    monitoring: { enabled: true }
};

// Production
const prodConfig = {
    environment: 'production',
    logging: { level: 'warn' },
    models: { autoDownload: false },
    performance: { maxConcurrent: 50 },
    security: { enabled: true },
    monitoring: { enabled: true },
    backup: { enabled: true },
    clustering: { enabled: true }
};
```

This configuration guide covers all aspects of configuring LLM Runner Router. For specific implementation examples, see the [tutorials section](../tutorials/) or refer to the [troubleshooting guide](./troubleshooting.md) for common configuration issues.