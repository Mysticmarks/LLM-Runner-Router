# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with LLM Runner Router.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Installation Issues](#installation-issues)
3. [Model Loading Problems](#model-loading-problems)
4. [Performance Issues](#performance-issues)
5. [Memory Problems](#memory-problems)
6. [Network and API Issues](#network-and-api-issues)
7. [Configuration Problems](#configuration-problems)
8. [Security Issues](#security-issues)
9. [Monitoring and Logging](#monitoring-and-logging)
10. [Enterprise Feature Issues](#enterprise-feature-issues)
11. [Environment-Specific Issues](#environment-specific-issues)
12. [Debug Tools and Commands](#debug-tools-and-commands)

## Quick Diagnostics

### Health Check Commands

```bash
# Check system health
curl http://localhost:3000/health

# Check detailed status
curl http://localhost:3000/status

# Check model availability
curl http://localhost:3000/models

# Test basic inference
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello", "maxTokens": 10}'
```

### Basic Diagnostic Script

```javascript
// diagnostics.js
import { LLMRouter } from 'llm-runner-router';

async function runDiagnostics() {
    console.log('🔍 Running LLM Router Diagnostics...\n');
    
    try {
        const router = new LLMRouter();
        
        // 1. Check initialization
        console.log('✅ Router initialized successfully');
        
        // 2. Check configuration
        const config = router.getConfig();
        console.log('📋 Configuration loaded:', Object.keys(config));
        
        // 3. Check models
        const models = await router.listModels();
        console.log('🤖 Available models:', models.length);
        
        // 4. Check system resources
        const status = await router.getStatus();
        console.log('💾 Memory usage:', status.memory);
        console.log('⚡ CPU usage:', status.cpu);
        
        // 5. Test inference
        if (models.length > 0) {
            const result = await router.process({
                prompt: 'Test',
                maxTokens: 5
            });
            console.log('🚀 Test inference successful');
        }
        
        console.log('\n✅ All diagnostics passed!');
        
    } catch (error) {
        console.error('❌ Diagnostic failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

runDiagnostics();
```

## Installation Issues

### Node.js Version Problems

**Issue**: "Node.js version not supported"
```bash
# Check current version
node --version

# Required: Node.js 18.0.0 or higher
# Install latest Node.js
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Or use nvm
nvm install --lts
nvm use --lts
```

### npm Installation Failures

**Issue**: "npm install fails with permission errors"
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or install without sudo using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install node
```

**Issue**: "Package conflicts or dependency errors"
```bash
# Clean install
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# If still failing, try with legacy peer deps
npm install --legacy-peer-deps

# Or use yarn instead
npm install -g yarn
yarn install
```

### Native Dependencies

**Issue**: "node-gyp build failures"
```bash
# Install build tools (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install build-essential python3 python3-pip

# Install build tools (CentOS/RHEL)
sudo yum groupinstall "Development Tools"
sudo yum install python3 python3-pip

# MacOS
xcode-select --install

# Rebuild native modules
npm rebuild

# Alternative: install prebuilt binaries
npm install --no-optional
```

## Model Loading Problems

### Model Not Found

**Issue**: "Model 'model-id' not found"

```javascript
// Debug model registration
const router = new LLMRouter({ debug: true });

// Check registered models
const models = await router.listModels();
console.log('Registered models:', models);

// Register model manually
await router.registerModel({
    id: 'my-model',
    name: 'My Model',
    format: 'gguf',
    source: './models/my-model.gguf'
});

// Or download from HuggingFace
await router.downloadModel('microsoft/DialoGPT-small');
```

### Model Download Failures

**Issue**: "Failed to download model from HuggingFace"

```javascript
// Check network connectivity
try {
    const response = await fetch('https://huggingface.co/api/models');
    console.log('HuggingFace API accessible:', response.ok);
} catch (error) {
    console.error('Network issue:', error.message);
}

// Configure authentication
process.env.HUGGINGFACE_TOKEN = 'your_token_here';

// Retry with explicit configuration
await router.downloadModel('model-name', {
    retries: 3,
    timeout: 300000,
    cache: true,
    auth: process.env.HUGGINGFACE_TOKEN
});
```

### Model Format Issues

**Issue**: "Unsupported model format"

```javascript
// Check supported formats
const formats = router.getSupportedFormats();
console.log('Supported formats:', formats);

// Force specific loader
await router.registerModel({
    id: 'my-model',
    format: 'gguf',  // Explicitly specify format
    loader: 'GGUFLoader',  // Force specific loader
    source: './models/my-model.gguf'
});

// Convert model format
const converter = router.getFormatConverter();
await converter.convert({
    input: './models/model.safetensors',
    output: './models/model.gguf',
    targetFormat: 'gguf'
});
```

### Model Loading Timeout

**Issue**: "Model loading timeout"

```javascript
// Increase timeout
const router = new LLMRouter({
    models: {
        loadTimeout: 300000,  // 5 minutes
        retries: 3
    }
});

// Check model size and available memory
const modelInfo = await router.getModelInfo('model-id');
console.log('Model size:', modelInfo.size);
console.log('Available memory:', process.memoryUsage());

// Use smaller model or increase system memory
// Enable model sharding for large models
await router.registerModel({
    id: 'large-model',
    config: {
        enableSharding: true,
        shardSize: '1GB'
    }
});
```

## Performance Issues

### Slow Inference

**Issue**: "Model inference is very slow"

```javascript
// Enable performance monitoring
const router = new LLMRouter({
    monitoring: { enabled: true },
    performance: { enableProfiling: true }
});

// Check performance metrics
const metrics = await router.getMetrics();
console.log('Average inference time:', metrics.inference.avgDuration);
console.log('Tokens per second:', metrics.inference.tokensPerSecond);

// Optimize configuration
await router.updateConfig({
    performance: {
        enableGPU: true,
        enableQuantization: true,
        batchSize: 8,
        maxConcurrent: 4
    }
});

// Use faster model or strategy
const result = await router.process({
    prompt: 'Your prompt',
    strategy: 'speed-priority',
    model: 'fast-model-id'
});
```

### High Latency

**Issue**: "High response latency"

```javascript
// Enable streaming for better perceived performance
const stream = await router.processStream({
    prompt: 'Your prompt',
    maxTokens: 100
});

for await (const chunk of stream) {
    process.stdout.write(chunk.token);
}

// Optimize network settings
const router = new LLMRouter({
    performance: {
        keepAlive: true,
        enableCompression: true,
        connectionPooling: true
    }
});

// Use edge deployment
const router = new LLMRouter({
    edge: {
        enabled: true,
        preferNearbyModels: true
    }
});
```

### Resource Bottlenecks

**Issue**: "System resources maxed out"

```bash
# Monitor system resources
htop
iostat -x 1
nvidia-smi  # For GPU monitoring

# Check disk I/O
iotop

# Check network
nethogs
```

```javascript
// Limit concurrent requests
const router = new LLMRouter({
    performance: {
        maxConcurrent: 2,  // Reduce if overwhelmed
        queueSize: 10,
        enableThrottling: true
    }
});

// Enable request queuing
const result = await router.processWithQueue({
    prompt: 'Your prompt',
    priority: 'normal'  // high, normal, low
});
```

## Memory Problems

### Out of Memory Errors

**Issue**: "JavaScript heap out of memory"

```bash
# Increase Node.js memory limit
node --max-old-space-size=8192 server.js

# Or set environment variable
export NODE_OPTIONS="--max-old-space-size=8192"
```

```javascript
// Monitor memory usage
const router = new LLMRouter({
    monitoring: {
        memoryThreshold: 0.8,  // Alert at 80% usage
        enableGC: true
    }
});

// Enable memory optimization
const router = new LLMRouter({
    performance: {
        enableMemoryOptimization: true,
        gcStrategy: 'incremental',
        modelCacheSize: '2GB'
    }
});

// Manually trigger garbage collection
if (global.gc) {
    global.gc();
}
```

### Memory Leaks

**Issue**: "Memory usage keeps increasing"

```javascript
// Enable memory leak detection
const router = new LLMRouter({
    debug: true,
    monitoring: {
        enableMemoryProfiling: true,
        memoryLeakDetection: true
    }
});

// Check for event listener leaks
process.on('warning', (warning) => {
    if (warning.name === 'MaxListenersExceededWarning') {
        console.error('Memory leak detected:', warning);
    }
});

// Cleanup resources properly
process.on('SIGINT', async () => {
    await router.cleanup();
    process.exit(0);
});
```

### Model Memory Usage

**Issue**: "Models consuming too much memory"

```javascript
// Use model quantization
await router.registerModel({
    id: 'quantized-model',
    config: {
        quantization: {
            enabled: true,
            precision: 'int8'  // or 'int4' for more compression
        }
    }
});

// Enable model unloading
const router = new LLMRouter({
    models: {
        autoUnload: true,
        unloadTimeout: 300000,  // 5 minutes
        maxModelsInMemory: 2
    }
});

// Manually unload models
await router.unloadModel('model-id');
```

## Network and API Issues

### Connection Timeouts

**Issue**: "Request timeout errors"

```javascript
// Increase timeouts
const router = new LLMRouter({
    network: {
        timeout: 60000,  // 60 seconds
        retries: 3,
        retryDelay: 1000
    }
});

// Check network connectivity
try {
    const response = await fetch('https://api.openai.com/v1/models', {
        timeout: 10000
    });
    console.log('OpenAI API accessible:', response.ok);
} catch (error) {
    console.error('Network issue:', error.message);
}
```

### Rate Limiting

**Issue**: "Rate limit exceeded"

```javascript
// Implement backoff strategy
const router = new LLMRouter({
    rateLimiting: {
        enabled: true,
        strategy: 'exponential-backoff',
        maxRetries: 5,
        baseDelay: 1000
    }
});

// Check rate limits
try {
    const result = await router.process({ prompt: 'test' });
} catch (error) {
    if (error.code === 'RATE_LIMITED') {
        console.log('Rate limited, waiting...', error.retryAfter);
        await new Promise(resolve => setTimeout(resolve, error.retryAfter));
    }
}
```

### SSL/TLS Issues

**Issue**: "SSL certificate verification failed"

```javascript
// For development only - disable SSL verification
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Better: configure proper certificates
const router = new LLMRouter({
    network: {
        tls: {
            ca: fs.readFileSync('./certs/ca.pem'),
            cert: fs.readFileSync('./certs/client.pem'),
            key: fs.readFileSync('./certs/client-key.pem')
        }
    }
});
```

## Configuration Problems

### Invalid Configuration

**Issue**: "Configuration validation failed"

```javascript
// Validate configuration
const configSchema = {
    performance: {
        maxConcurrent: { type: 'number', min: 1, max: 100 }
    }
};

try {
    const router = new LLMRouter(config, { validate: true, schema: configSchema });
} catch (error) {
    console.error('Configuration error:', error.message);
    console.error('Invalid fields:', error.details);
}

// Get default configuration
const defaultConfig = LLMRouter.getDefaultConfig();
console.log('Default config:', defaultConfig);
```

### Environment Variables

**Issue**: "Environment variables not loaded"

```bash
# Check environment variables
env | grep LLM
printenv NODE_ENV

# Load from .env file
npm install dotenv
```

```javascript
// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['OPENAI_API_KEY', 'HUGGINGFACE_TOKEN'];
const missing = requiredEnvVars.filter(env => !process.env[env]);
if (missing.length > 0) {
    console.error('Missing environment variables:', missing);
    process.exit(1);
}
```

## Security Issues

### Authentication Failures

**Issue**: "Authentication failed"

```javascript
// Debug authentication
const router = new LLMRouter({
    security: {
        auth: {
            enabled: true,
            debug: true  // Enable auth debugging
        }
    }
});

// Check JWT token
import jwt from 'jsonwebtoken';

try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token valid:', decoded);
} catch (error) {
    console.error('Token validation failed:', error.message);
}

// Test API key
curl -H "X-API-Key: your-api-key" http://localhost:3000/health
```

### CORS Issues

**Issue**: "CORS policy blocked the request"

```javascript
// Configure CORS properly
const router = new LLMRouter({
    security: {
        cors: {
            origin: ['http://localhost:3000', 'https://yourdomain.com'],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
        }
    }
});

// For development - allow all origins (not for production)
const router = new LLMRouter({
    security: {
        cors: { origin: true }
    }
});
```

## Monitoring and Logging

### Missing Logs

**Issue**: "No logs generated"

```javascript
// Enable comprehensive logging
const router = new LLMRouter({
    logging: {
        level: 'debug',
        enableRequestLogging: true,
        enableErrorLogging: true,
        transports: [
            { type: 'console' },
            { type: 'file', filename: './logs/app.log' }
        ]
    }
});

// Check log file permissions
ls -la ./logs/
chmod 755 ./logs/
chmod 644 ./logs/app.log
```

### Metrics Not Working

**Issue**: "Prometheus metrics not exposed"

```javascript
// Enable metrics endpoint
const router = new LLMRouter({
    monitoring: {
        metrics: {
            enabled: true,
            port: 9090,
            path: '/metrics'
        }
    }
});

// Test metrics endpoint
curl http://localhost:9090/metrics

// Check if Prometheus is running
docker run -p 9090:9090 prom/prometheus
```

## Enterprise Feature Issues

### Multi-Tenancy Problems

**Issue**: "Tenant isolation not working"

```javascript
// Debug tenant configuration
const router = new LLMRouter({
    enterprise: {
        multiTenancy: {
            enabled: true,
            debug: true
        }
    }
});

// Check tenant context
const tenantId = req.headers['x-tenant-id'];
if (!tenantId) {
    throw new Error('Tenant ID required');
}

// Validate tenant
const tenant = await router.getTenant(tenantId);
if (!tenant) {
    throw new Error('Invalid tenant');
}
```

### A/B Testing Issues

**Issue**: "A/B test variants not working"

```javascript
// Debug A/B testing
const router = new LLMRouter({
    enterprise: {
        abTesting: {
            enabled: true,
            debug: true,
            logging: true
        }
    }
});

// Check experiment assignment
const experiment = await router.getExperiment('my-experiment');
console.log('Experiment status:', experiment.status);
console.log('User assignment:', experiment.getUserAssignment(userId));
```

## Environment-Specific Issues

### Docker Problems

**Issue**: "Container exits immediately"

```bash
# Check container logs
docker logs container-name

# Run with interactive shell
docker run -it llm-router:latest /bin/sh

# Check health
docker exec container-name curl http://localhost:3000/health
```

```dockerfile
# Add debugging to Dockerfile
RUN npm run test
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

### Kubernetes Issues

**Issue**: "Pod not starting"

```bash
# Check pod status
kubectl describe pod pod-name

# Check logs
kubectl logs pod-name

# Check resources
kubectl top pods

# Check configuration
kubectl get configmap llm-router-config -o yaml
```

### VPS/Cloud Issues

**Issue**: "Performance degraded on VPS"

```javascript
// VPS-optimized configuration
const router = new LLMRouter({
    performance: {
        maxConcurrent: 2,  // Limited by VPS resources
        enableLightweightMode: true,
        preferLocalModels: true
    },
    models: {
        autoDownload: false,  // Manual model management
        preferSmallModels: true
    }
});

// Check VPS resources
free -h
df -h
nproc
```

## Debug Tools and Commands

### Built-in Debug Tools

```javascript
// Enable debug mode
const router = new LLMRouter({ debug: true });

// Get detailed status
const status = await router.getDetailedStatus();
console.log('System status:', status);

// Run self-diagnostics
const diagnostics = await router.runDiagnostics();
console.log('Diagnostics result:', diagnostics);

// Get performance profile
const profile = await router.getPerformanceProfile();
console.log('Performance profile:', profile);
```

### Command Line Tools

```bash
# Check system resources
htop
iostat
netstat -tulpn

# Check Node.js processes
ps aux | grep node

# Check memory usage
cat /proc/meminfo
free -h

# Check disk usage
df -h
du -sh /path/to/models

# Check network
ping google.com
curl -I http://localhost:3000
```

### Log Analysis

```bash
# Monitor logs in real-time
tail -f ./logs/app.log

# Search for errors
grep -i error ./logs/app.log

# Count error types
grep -i error ./logs/app.log | cut -d' ' -f4 | sort | uniq -c

# Performance analysis
grep "response_time" ./logs/app.log | awk '{print $5}' | sort -n
```

### Memory Debugging

```javascript
// Memory profiling
import v8 from 'v8';

// Take heap snapshot
const heapSnapshot = v8.writeHeapSnapshot();
console.log('Heap snapshot saved to:', heapSnapshot);

// Monitor memory usage
setInterval(() => {
    const usage = process.memoryUsage();
    console.log('Memory usage:', {
        rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB'
    });
}, 10000);
```

### Common Solutions Checklist

When encountering issues, check these common solutions:

- [ ] **Restart the service** - Often resolves temporary issues
- [ ] **Check system resources** - CPU, memory, disk space
- [ ] **Verify configuration** - Syntax, required fields, types
- [ ] **Update dependencies** - npm update, check for security issues
- [ ] **Check logs** - Application logs, system logs, error logs
- [ ] **Test network connectivity** - Internet access, API endpoints
- [ ] **Verify file permissions** - Read/write access to required files
- [ ] **Check environment variables** - Required values, proper format
- [ ] **Validate model files** - Corruption, format compatibility
- [ ] **Clear caches** - npm cache, model cache, application cache

For additional help, check the [FAQ](../FAQ.md) or create an issue on [GitHub](https://github.com/MCERQUA/LLM-Runner-Router/issues).