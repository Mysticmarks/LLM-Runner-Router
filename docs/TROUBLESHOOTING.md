# 🔧 Troubleshooting Guide - When Reality Glitches

*Debugging is like being the detective in a crime movie where you are also the murderer*

## Table of Contents
- [Common Issues](#common-issues)
- [Installation Problems](#installation-problems)
- [Model Loading Issues](#model-loading-issues)
- [Performance Problems](#performance-problems)
- [Engine Issues](#engine-issues)
- [Memory Issues](#memory-issues)
- [Network Problems](#network-problems)
- [Diagnostic Tools](#diagnostic-tools)
- [Getting Help](#getting-help)

## Common Issues

### Issue: "Router failed to initialize"

**Symptoms**: Error on startup, no models available
**Causes**: 
- Missing dependencies
- Incompatible Node.js version
- Permission issues

**Solutions**:
```javascript
// 1. Check version compatibility
console.log('Node version:', process.version);
// Requires Node.js >= 16

// 2. Verify installation
const router = new LLMRouter({ debug: true });
await router.initialize();

// 3. Check permissions
const fs = require('fs');
try {
  fs.accessSync('./models', fs.constants.R_OK | fs.constants.W_OK);
} catch (error) {
  console.error('Permission denied for models directory');
}
```

### Issue: "Model not found"

**Symptoms**: 404 errors, failed model loading
**Causes**:
- Incorrect file paths
- Missing model files
- Format detection failure

**Solutions**:
```javascript
// 1. Debug file paths
const model = await router.load({
  source: '/absolute/path/to/model.gguf',
  debug: true
});

// 2. Check file existence
import fs from 'fs';
if (!fs.existsSync('model.gguf')) {
  console.error('Model file not found');
}

// 3. Force format detection
const model = await router.load({
  source: 'model.bin',
  format: 'gguf'  // Override auto-detection
});
```

## Installation Problems

### NPM Installation Issues

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Use specific npm version
npm install -g npm@latest
```

### Dependency Conflicts

```javascript
// Check for conflicting dependencies
npm list --depth=0

// Force resolution of specific versions
{
  "overrides": {
    "problematic-package": "1.2.3"
  }
}
```

### Platform-Specific Issues

**Windows**:
```powershell
# Enable developer mode for symlinks
New-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" -Name "AllowDevelopmentWithoutDevLicense" -Value 1
```

**macOS**:
```bash
# Install Xcode command line tools
xcode-select --install

# Fix permissions
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

**Linux**:
```bash
# Install build essentials
sudo apt-get install build-essential python3-dev

# Fix node-gyp issues
npm config set python python3
```

## Model Loading Issues

### GGUF Loading Problems

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid magic number" | Corrupted file | Re-download model |
| "Unsupported version" | Old GGUF version | Update converter |
| "Memory allocation failed" | Model too large | Use smaller quantization |
| "Invalid tensor dimensions" | Corrupted metadata | Verify file integrity |

**Diagnostic Commands**:
```javascript
// Validate GGUF file
const loader = new GGUFLoader();
const isValid = await loader.validate('/path/to/model.gguf');
console.log('Valid GGUF:', isValid);

// Check model metadata
const metadata = await loader.getMetadata('/path/to/model.gguf');
console.log('Model info:', metadata);
```

### Format Detection Issues

```javascript
// Debug format detection
const registry = router.registry;
const loaders = registry.getAvailableLoaders();
console.log('Available loaders:', loaders);

// Manual format specification
const model = await router.load({
  source: 'ambiguous-file.bin',
  format: 'gguf',  // Force specific format
  loader: GGUFLoader  // Force specific loader
});
```

## Performance Problems

### Slow Inference

**Symptoms**: Long response times, high latency
**Causes**:
- Large model size
- CPU bottleneck
- Memory swapping
- Network latency

**Solutions**:
```javascript
// 1. Use smaller models
const model = await router.load({
  source: 'llama-7b-q4_k_m.gguf',  // Instead of 70B
  quantization: 'q4_k_m'
});

// 2. Optimize engine settings
const router = new LLMRouter({
  engine: 'webgpu',  // Use GPU if available
  threads: 8,        // Optimal thread count
  batchSize: 32      // Batch multiple requests
});

// 3. Enable caching
const router = new LLMRouter({
  cache: {
    enabled: true,
    maxSize: '1GB',
    ttl: 3600
  }
});
```

### Memory Issues

**Out of Memory Errors**:
```javascript
// Monitor memory usage
const usage = process.memoryUsage();
console.log({
  heap: (usage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
  external: (usage.external / 1024 / 1024).toFixed(2) + ' MB'
});

// Use memory-efficient configurations
const router = new LLMRouter({
  memoryLimit: '4GB',
  useMemoryMapping: true,
  unloadUnusedModels: true,
  maxConcurrent: 2  // Limit concurrent requests
});
```

### CPU Bottleneck

```javascript
// Optimize CPU usage
const router = new LLMRouter({
  threads: Math.floor(require('os').cpus().length * 0.8),
  affinityMask: '0-7',  // Bind to specific CPU cores
  priorityBoost: true
});

// Use worker threads for CPU-intensive tasks
const { Worker } = require('worker_threads');
const worker = new Worker('./inference-worker.js');
```

## Engine Issues

### WebGPU Problems

**Common Issues**:
- Browser compatibility
- Driver issues
- Memory limits

**Debugging**:
```javascript
// Check WebGPU support
if (!navigator.gpu) {
  console.error('WebGPU not supported');
}

// Get adapter info
const adapter = await navigator.gpu.requestAdapter();
const info = await adapter.requestAdapterInfo();
console.log('GPU:', info);

// Check limits
const device = await adapter.requestDevice();
console.log('Limits:', device.limits);
```

### WASM Problems

**Common Issues**:
- Compilation failures
- Memory limits
- Performance issues

**Debugging**:
```javascript
// Check WASM support
if (!WebAssembly) {
  console.error('WebAssembly not supported');
}

// Debug WASM module
try {
  const module = await WebAssembly.compile(wasmBytes);
  console.log('WASM compiled successfully');
} catch (error) {
  console.error('WASM compilation failed:', error);
}
```

## Network Problems

### Download Issues

```javascript
// Configure download settings
const router = new LLMRouter({
  download: {
    timeout: 300000,  // 5 minutes
    retries: 3,
    resumable: true,
    parallel: 4       // Parallel chunks
  }
});

// Manual download with progress
import https from 'https';
import fs from 'fs';

function downloadModel(url, path) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(path);
    https.get(url, response => {
      const total = parseInt(response.headers['content-length']);
      let downloaded = 0;
      
      response.on('data', chunk => {
        downloaded += chunk.length;
        const percent = (downloaded / total * 100).toFixed(2);
        process.stdout.write(`\rDownloading: ${percent}%`);
      });
      
      response.pipe(file);
      file.on('finish', resolve);
      file.on('error', reject);
    });
  });
}
```

### Proxy Issues

```javascript
// Configure proxy settings
const router = new LLMRouter({
  proxy: {
    http: 'http://proxy.company.com:8080',
    https: 'https://proxy.company.com:8080'
  }
});

// Environment variables
process.env.HTTP_PROXY = 'http://proxy.company.com:8080';
process.env.HTTPS_PROXY = 'https://proxy.company.com:8080';
```

## Diagnostic Tools

### Built-in Diagnostics

```javascript
// Comprehensive system check
const diagnostics = await router.runDiagnostics();
console.log(JSON.stringify(diagnostics, null, 2));

// Expected output:
{
  "system": {
    "platform": "linux",
    "arch": "x64",
    "memory": "16GB",
    "cpu": "8 cores"
  },
  "engines": {
    "webgpu": { "supported": false, "reason": "Not in browser" },
    "wasm": { "supported": true, "version": "1.0" },
    "node": { "supported": true, "version": "18.0.0" }
  },
  "models": {
    "loaded": 2,
    "available": 5,
    "formats": ["gguf"]
  },
  "performance": {
    "avgLatency": "245ms",
    "memoryUsage": "2.1GB",
    "cacheHitRate": "78%"
  }
}
```

### Custom Diagnostics

```javascript
// Model validation
async function validateModel(modelPath) {
  try {
    const model = await router.load(modelPath);
    const testResponse = await model.generate('test', { maxTokens: 1 });
    console.log('✅ Model working:', modelPath);
    return true;
  } catch (error) {
    console.error('❌ Model failed:', modelPath, error.message);
    return false;
  }
}

// Performance test
async function performanceTest() {
  const start = Date.now();
  const response = await router.quick('Hello world');
  const latency = Date.now() - start;
  
  console.log(`Latency: ${latency}ms`);
  console.log(`Tokens: ${response.tokens}`);
  console.log(`Speed: ${response.tokens / (latency / 1000)} tokens/sec`);
}
```

### Logging and Debugging

```javascript
// Enable debug logging
const router = new LLMRouter({
  logLevel: 'debug',
  logFile: './logs/debug.log'
});

// Custom logger
import winston from 'winston';

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console()
  ]
});

router.setLogger(logger);
```

## Getting Help

### Before Asking for Help

1. **Check the logs**: Enable debug logging
2. **Run diagnostics**: Use built-in diagnostic tools
3. **Test with minimal config**: Reproduce with simplest setup
4. **Check versions**: Ensure compatible versions
5. **Search existing issues**: Look for similar problems

### Information to Include

When reporting issues, include:

```javascript
// System information
const systemInfo = {
  platform: process.platform,
  arch: process.arch,
  nodeVersion: process.version,
  npmVersion: process.env.npm_version,
  routerVersion: require('./package.json').version
};

// Error details
const errorInfo = {
  message: error.message,
  stack: error.stack,
  code: error.code,
  context: 'describe what you were trying to do'
};

// Configuration
const config = {
  // Your router configuration (remove sensitive data)
};

console.log('System:', systemInfo);
console.log('Error:', errorInfo);
console.log('Config:', config);
```

### Community Resources

- **GitHub Issues**: Report bugs and request features
- **Discussions**: Ask questions and share experiences
- **Discord**: Real-time community help (coming soon)
- **Email**: echoaisystems@gmail.com

### Professional Support

For enterprise users:
- **Priority Support**: Dedicated support channel
- **Custom Integration**: Professional services
- **Training**: Team training and workshops
- **Consulting**: Architecture and optimization

---

*"The best debugger ever created is a good night's sleep"* - Anonymous Developer

*Remember: Every bug is just an undocumented feature waiting for documentation!* 🐛→✨

Built with 💙 by Echo AI Systems