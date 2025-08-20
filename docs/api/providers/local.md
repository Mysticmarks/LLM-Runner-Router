# Local Provider Guide

Comprehensive guide for running models locally through the LLM Router system using various local inference engines.

## Overview

The Local Provider enables running LLM models directly on your hardware without external API dependencies. This guide covers local model inference using GGUF, ONNX, PyTorch, and other formats with various runtime engines.

## Quick Start

### Basic Local Setup

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['local'],
  local: {
    modelsDirectory: './models',
    defaultEngine: 'node-llama-cpp',
    cacheSize: '4GB'
  }
});

// Load and use a local model
await router.loadModel('llama-2-7b-chat.Q4_K_M.gguf');

const response = await router.generate({
  model: 'llama-2-7b-chat.Q4_K_M.gguf',
  prompt: 'Explain quantum computing in simple terms',
  maxTokens: 200
});

console.log(response.text);
```

### Environment Setup

```bash
# System requirements
# RAM: 8GB+ (16GB+ recommended)
# Storage: 10GB+ for models
# CPU: Modern multi-core processor

# Optional: CUDA for GPU acceleration
CUDA_VISIBLE_DEVICES=0

# Model cache directory
LOCAL_MODELS_DIR=./models
LOCAL_CACHE_DIR=./cache
```

## Configuration

### Complete Configuration Options

```javascript
const router = new LLMRouter({
  providers: ['local'],
  local: {
    // Model Management
    modelsDirectory: './models',
    cacheDirectory: './cache',
    downloadOnDemand: true,
    
    // Runtime Configuration
    defaultEngine: 'node-llama-cpp', // 'onnx', 'torch', 'ggml'
    device: 'auto', // 'cpu', 'cuda', 'mps', 'auto'
    threads: 'auto', // Number of CPU threads
    
    // Memory Management
    cacheSize: '4GB',
    maxModelsLoaded: 3,
    unloadIdleTime: 300000, // 5 minutes
    
    // Performance Settings
    batchSize: 1,
    contextLength: 4096,
    
    // Engine-Specific Settings
    engines: {
      'node-llama-cpp': {
        threads: 8,
        useMlock: true,
        useMmap: true,
        verbose: false
      },
      'onnx': {
        providers: ['CPUExecutionProvider'],
        sessionOptions: {
          executionMode: 'sequential',
          graphOptimizationLevel: 'all'
        }
      },
      'torch': {
        device: 'cuda',
        dtype: 'float16',
        quantization: '8bit'
      }
    }
  }
});
```

### Model Download Configuration

```javascript
// Automatic model downloading
const router = new LLMRouter({
  providers: ['local'],
  local: {
    downloadSources: {
      'huggingface': {
        baseURL: 'https://huggingface.co',
        token: process.env.HUGGINGFACE_TOKEN // Optional for private models
      },
      'ollama': {
        baseURL: 'https://ollama.ai/library'
      }
    },
    
    // Model preferences
    preferredFormats: ['gguf', 'onnx', 'safetensors'],
    quantizationPreference: ['Q4_K_M', 'Q8_0', 'F16'],
    
    // Download settings
    downloadTimeout: 300000,
    retryAttempts: 3,
    parallelDownloads: 2
  }
});
```

## Supported Model Formats

### GGUF Models (Recommended)

```javascript
// Load GGUF model
await router.loadModel({
  file: 'llama-2-7b-chat.Q4_K_M.gguf',
  engine: 'node-llama-cpp',
  settings: {
    contextSize: 4096,
    threads: 8,
    batchSize: 512
  }
});

// Generate with GGUF model
const response = await router.generate({
  model: 'llama-2-7b-chat.Q4_K_M.gguf',
  prompt: 'Hello, world!',
  maxTokens: 100,
  temperature: 0.7
});
```

### ONNX Models

```javascript
// Load ONNX model
await router.loadModel({
  file: 'gpt2-medium.onnx',
  engine: 'onnx',
  settings: {
    providers: ['CPUExecutionProvider'],
    sessionOptions: {
      executionMode: 'sequential'
    }
  }
});

// Generate with ONNX model
const response = await router.generate({
  model: 'gpt2-medium.onnx',
  prompt: 'The future of AI is',
  maxTokens: 150
});
```

### PyTorch Models

```javascript
// Load PyTorch model
await router.loadModel({
  file: 'model.safetensors',
  engine: 'torch',
  settings: {
    device: 'cuda',
    torch_dtype: 'float16',
    load_in_8bit: true
  }
});

// Generate with PyTorch model
const response = await router.generate({
  model: 'model.safetensors',
  prompt: 'Write a Python function',
  maxTokens: 200
});
```

### Model Format Comparison

| Format | Size | Speed | Quality | GPU Support | CPU Support |
|--------|------|-------|---------|-------------|-------------|
| GGUF Q4_K_M | Small | Fast | Good | ✅ | ✅ |
| GGUF Q8_0 | Medium | Medium | Excellent | ✅ | ✅ |
| GGUF F16 | Large | Slow | Excellent | ✅ | ✅ |
| ONNX | Medium | Fast | Good | ⚠️ | ✅ |
| PyTorch | Large | Medium | Excellent | ✅ | ✅ |
| Safetensors | Medium | Medium | Excellent | ✅ | ✅ |

## Model Management

### 1. Model Loading and Unloading

```javascript
class LocalModelManager {
  constructor(router) {
    this.router = router;
    this.loadedModels = new Map();
    this.modelUsage = new Map();
  }

  async loadModel(modelPath, options = {}) {
    if (this.loadedModels.has(modelPath)) {
      console.log(`Model ${modelPath} already loaded`);
      return this.loadedModels.get(modelPath);
    }

    console.log(`Loading model: ${modelPath}`);
    const startTime = Date.now();

    try {
      const model = await this.router.loadModel({
        file: modelPath,
        ...options
      });

      const loadTime = Date.now() - startTime;
      
      this.loadedModels.set(modelPath, model);
      this.modelUsage.set(modelPath, {
        loadTime,
        requests: 0,
        lastUsed: Date.now()
      });

      console.log(`Model loaded in ${loadTime}ms`);
      return model;
    } catch (error) {
      throw new Error(`Failed to load model ${modelPath}: ${error.message}`);
    }
  }

  async unloadModel(modelPath) {
    if (!this.loadedModels.has(modelPath)) {
      console.log(`Model ${modelPath} not loaded`);
      return;
    }

    console.log(`Unloading model: ${modelPath}`);
    
    await this.router.unloadModel(modelPath);
    
    this.loadedModels.delete(modelPath);
    this.modelUsage.delete(modelPath);
    
    console.log(`Model ${modelPath} unloaded`);
  }

  async autoUnloadIdleModels(idleTimeMs = 300000) {
    const now = Date.now();
    
    for (const [modelPath, usage] of this.modelUsage) {
      if (now - usage.lastUsed > idleTimeMs) {
        console.log(`Auto-unloading idle model: ${modelPath}`);
        await this.unloadModel(modelPath);
      }
    }
  }

  trackUsage(modelPath) {
    if (this.modelUsage.has(modelPath)) {
      const usage = this.modelUsage.get(modelPath);
      usage.requests++;
      usage.lastUsed = Date.now();
    }
  }

  getLoadedModels() {
    return Array.from(this.loadedModels.keys());
  }

  getModelStats() {
    const stats = {};
    
    for (const [modelPath, usage] of this.modelUsage) {
      stats[modelPath] = {
        ...usage,
        timeSinceLastUse: Date.now() - usage.lastUsed
      };
    }
    
    return stats;
  }
}
```

### 2. Model Download Manager

```javascript
class ModelDownloadManager {
  constructor(modelsDir = './models') {
    this.modelsDir = modelsDir;
    this.downloads = new Map();
  }

  async downloadModel(modelId, source = 'huggingface') {
    if (this.downloads.has(modelId)) {
      console.log(`Download already in progress for ${modelId}`);
      return this.downloads.get(modelId);
    }

    const downloadPromise = this.performDownload(modelId, source);
    this.downloads.set(modelId, downloadPromise);

    try {
      const result = await downloadPromise;
      this.downloads.delete(modelId);
      return result;
    } catch (error) {
      this.downloads.delete(modelId);
      throw error;
    }
  }

  async performDownload(modelId, source) {
    const downloadUrls = this.getDownloadUrls(modelId, source);
    
    for (const { url, filename } of downloadUrls) {
      console.log(`Downloading ${filename}...`);
      
      const filePath = path.join(this.modelsDir, filename);
      
      await this.downloadFile(url, filePath, (progress) => {
        console.log(`${filename}: ${progress.percentage}% (${progress.transferred}/${progress.total})`);
      });
      
      console.log(`Downloaded: ${filename}`);
    }
    
    return modelId;
  }

  getDownloadUrls(modelId, source) {
    const sources = {
      'huggingface': (id) => [
        {
          url: `https://huggingface.co/${id}/resolve/main/ggml-model-Q4_K_M.gguf`,
          filename: `${id.replace('/', '-')}-Q4_K_M.gguf`
        }
      ],
      'ollama': (id) => [
        {
          url: `https://ollama.ai/library/${id}/blobs/sha256:...`,
          filename: `${id}.gguf`
        }
      ]
    };

    return sources[source]?.(modelId) || [];
  }

  async downloadFile(url, filePath, onProgress) {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const contentLength = parseInt(response.headers.get('content-length') || '0');
    const fileStream = fs.createWriteStream(filePath);
    
    let transferred = 0;
    
    const reader = response.body.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      transferred += value.length;
      fileStream.write(value);
      
      if (onProgress) {
        onProgress({
          transferred,
          total: contentLength,
          percentage: Math.round((transferred / contentLength) * 100)
        });
      }
    }
    
    fileStream.close();
  }

  listLocalModels() {
    const modelFiles = fs.readdirSync(this.modelsDir)
      .filter(file => file.endsWith('.gguf') || file.endsWith('.onnx') || file.endsWith('.safetensors'));
    
    return modelFiles.map(file => ({
      filename: file,
      path: path.join(this.modelsDir, file),
      size: fs.statSync(path.join(this.modelsDir, file)).size,
      format: path.extname(file).slice(1)
    }));
  }
}
```

## Advanced Features

### 1. Multi-Engine Support

```javascript
class MultiEngineRouter {
  constructor() {
    this.engines = {
      'node-llama-cpp': new NodeLlamaCppEngine(),
      'onnx': new OnnxEngine(),
      'torch': new TorchEngine()
    };
    
    this.modelEngineMap = new Map();
  }

  async loadModel(modelPath, preferredEngine = null) {
    const engine = preferredEngine || this.selectOptimalEngine(modelPath);
    
    console.log(`Loading ${modelPath} with ${engine} engine`);
    
    const model = await this.engines[engine].loadModel(modelPath);
    this.modelEngineMap.set(modelPath, engine);
    
    return model;
  }

  selectOptimalEngine(modelPath) {
    const extension = path.extname(modelPath).toLowerCase();
    
    const engineMap = {
      '.gguf': 'node-llama-cpp',
      '.onnx': 'onnx',
      '.safetensors': 'torch',
      '.bin': 'torch'
    };
    
    return engineMap[extension] || 'node-llama-cpp';
  }

  async generate(modelPath, prompt, options = {}) {
    const engine = this.modelEngineMap.get(modelPath);
    
    if (!engine) {
      throw new Error(`Model ${modelPath} not loaded`);
    }
    
    return this.engines[engine].generate(modelPath, prompt, options);
  }

  async benchmarkEngines(modelPath) {
    const testPrompt = "Write a short story about a robot.";
    const results = {};
    
    for (const [engineName, engine] of Object.entries(this.engines)) {
      try {
        console.log(`Benchmarking ${engineName}...`);
        
        const startTime = Date.now();
        await engine.loadModel(modelPath);
        const loadTime = Date.now() - startTime;
        
        const genStartTime = Date.now();
        const response = await engine.generate(modelPath, testPrompt, { maxTokens: 100 });
        const genTime = Date.now() - genStartTime;
        
        results[engineName] = {
          loadTime,
          generationTime: genTime,
          tokensPerSecond: (response.usage?.completionTokens || 100) / (genTime / 1000),
          success: true
        };
        
        await engine.unloadModel(modelPath);
      } catch (error) {
        results[engineName] = {
          error: error.message,
          success: false
        };
      }
    }
    
    return results;
  }
}
```

### 2. Performance Optimization

```javascript
class LocalPerformanceOptimizer {
  constructor(router) {
    this.router = router;
    this.performanceProfile = null;
  }

  async optimizeForHardware() {
    console.log('Analyzing hardware capabilities...');
    
    const hwProfile = await this.analyzeHardware();
    const optimal = this.calculateOptimalSettings(hwProfile);
    
    console.log('Optimal settings:', optimal);
    
    return this.applyOptimalSettings(optimal);
  }

  async analyzeHardware() {
    const profile = {
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0].model,
        speed: os.cpus()[0].speed
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem()
      },
      gpu: await this.detectGpu()
    };
    
    this.performanceProfile = profile;
    return profile;
  }

  async detectGpu() {
    try {
      // Try to detect CUDA
      const cudaResult = await this.checkCuda();
      if (cudaResult.available) {
        return { type: 'cuda', ...cudaResult };
      }
      
      // Try to detect MPS (Apple Silicon)
      const mpsResult = await this.checkMps();
      if (mpsResult.available) {
        return { type: 'mps', ...mpsResult };
      }
      
      return { type: 'cpu', available: true };
    } catch (error) {
      return { type: 'cpu', available: true };
    }
  }

  calculateOptimalSettings(hwProfile) {
    const settings = {
      threads: Math.min(hwProfile.cpu.cores, 8),
      device: 'cpu',
      contextSize: 4096,
      batchSize: 1
    };
    
    // GPU optimizations
    if (hwProfile.gpu.type === 'cuda') {
      settings.device = 'cuda';
      settings.batchSize = 8;
    } else if (hwProfile.gpu.type === 'mps') {
      settings.device = 'mps';
      settings.batchSize = 4;
    }
    
    // Memory optimizations
    const availableGB = hwProfile.memory.free / (1024 * 1024 * 1024);
    
    if (availableGB < 4) {
      settings.contextSize = 2048;
      settings.quantization = 'Q4_K_M';
    } else if (availableGB < 8) {
      settings.contextSize = 4096;
      settings.quantization = 'Q4_K_M';
    } else {
      settings.contextSize = 8192;
      settings.quantization = 'Q8_0';
    }
    
    return settings;
  }

  async applyOptimalSettings(settings) {
    console.log('Applying optimal settings:', settings);
    
    await this.router.updateConfig({
      local: {
        defaultEngine: settings.device === 'cpu' ? 'node-llama-cpp' : 'torch',
        device: settings.device,
        threads: settings.threads,
        contextLength: settings.contextSize,
        batchSize: settings.batchSize
      }
    });
    
    return settings;
  }

  async checkCuda() {
    // Implementation to check CUDA availability
    return { available: false };
  }

  async checkMps() {
    // Implementation to check MPS availability
    return { available: false };
  }
}
```

### 3. Model Quantization

```javascript
class ModelQuantizer {
  constructor() {
    this.supportedFormats = ['Q2_K', 'Q3_K_S', 'Q4_K_M', 'Q5_K_M', 'Q8_0', 'F16'];
  }

  async quantizeModel(inputPath, outputPath, quantization = 'Q4_K_M') {
    if (!this.supportedFormats.includes(quantization)) {
      throw new Error(`Unsupported quantization format: ${quantization}`);
    }

    console.log(`Quantizing ${inputPath} to ${quantization}...`);
    
    const startTime = Date.now();
    
    try {
      // Use llama.cpp quantization tool
      await this.runQuantization(inputPath, outputPath, quantization);
      
      const quantTime = Date.now() - startTime;
      
      const originalSize = fs.statSync(inputPath).size;
      const quantizedSize = fs.statSync(outputPath).size;
      const compressionRatio = originalSize / quantizedSize;
      
      console.log(`Quantization completed in ${quantTime}ms`);
      console.log(`Size reduction: ${compressionRatio.toFixed(2)}x`);
      
      return {
        originalSize,
        quantizedSize,
        compressionRatio,
        quantTime,
        format: quantization
      };
    } catch (error) {
      throw new Error(`Quantization failed: ${error.message}`);
    }
  }

  async runQuantization(inputPath, outputPath, quantization) {
    // Implementation depends on available quantization tools
    // This would typically call llama.cpp's quantization binary
    
    const command = `./quantize ${inputPath} ${outputPath} ${quantization}`;
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  getQuantizationRecommendation(availableMemoryGB, targetSpeed = 'balanced') {
    const recommendations = {
      'speed': {
        4: 'Q2_K',
        8: 'Q3_K_S',
        16: 'Q4_K_M',
        32: 'Q5_K_M'
      },
      'balanced': {
        4: 'Q3_K_S',
        8: 'Q4_K_M',
        16: 'Q5_K_M',
        32: 'Q8_0'
      },
      'quality': {
        4: 'Q4_K_M',
        8: 'Q5_K_M',
        16: 'Q8_0',
        32: 'F16'
      }
    };
    
    const memoryTiers = [4, 8, 16, 32];
    const tier = memoryTiers.find(t => availableMemoryGB <= t) || 32;
    
    return recommendations[targetSpeed][tier];
  }
}
```

## Production Deployment

### 1. Local Inference Server

```javascript
class LocalInferenceServer {
  constructor(config = {}) {
    this.router = new LLMRouter({
      providers: ['local'],
      local: config
    });
    
    this.modelManager = new LocalModelManager(this.router);
    this.requestQueue = [];
    this.processing = false;
    this.stats = {
      requests: 0,
      errors: 0,
      totalLatency: 0
    };
  }

  async start(port = 3000) {
    const app = express();
    
    app.use(express.json());
    app.use(this.corsMiddleware);
    app.use(this.rateLimitMiddleware);
    
    // Health check
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        models: this.modelManager.getLoadedModels(),
        stats: this.getStats()
      });
    });
    
    // List models
    app.get('/models', (req, res) => {
      res.json({
        loaded: this.modelManager.getLoadedModels(),
        available: this.listAvailableModels()
      });
    });
    
    // Generate text
    app.post('/generate', async (req, res) => {
      try {
        const { model, prompt, ...options } = req.body;
        
        if (!model || !prompt) {
          return res.status(400).json({
            error: 'Model and prompt are required'
          });
        }
        
        const response = await this.queueRequest({
          model,
          prompt,
          ...options
        });
        
        res.json(response);
      } catch (error) {
        this.stats.errors++;
        res.status(500).json({
          error: error.message
        });
      }
    });
    
    // Load model
    app.post('/models/:modelId/load', async (req, res) => {
      try {
        const { modelId } = req.params;
        const { engine, ...options } = req.body;
        
        await this.modelManager.loadModel(modelId, { engine, ...options });
        
        res.json({
          message: `Model ${modelId} loaded successfully`
        });
      } catch (error) {
        res.status(500).json({
          error: error.message
        });
      }
    });
    
    app.listen(port, () => {
      console.log(`Local inference server running on port ${port}`);
    });
  }

  async queueRequest(request) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ request, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    while (this.requestQueue.length > 0) {
      const { request, resolve, reject } = this.requestQueue.shift();
      
      try {
        const startTime = Date.now();
        
        // Ensure model is loaded
        if (!this.modelManager.getLoadedModels().includes(request.model)) {
          await this.modelManager.loadModel(request.model);
        }
        
        const response = await this.router.generate(request);
        
        const latency = Date.now() - startTime;
        this.stats.requests++;
        this.stats.totalLatency += latency;
        
        this.modelManager.trackUsage(request.model);
        
        resolve({
          ...response,
          latency,
          serverStats: this.getStats()
        });
      } catch (error) {
        this.stats.errors++;
        reject(error);
      }
    }
    
    this.processing = false;
  }

  corsMiddleware(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  }

  rateLimitMiddleware(req, res, next) {
    // Simple rate limiting implementation
    const clientId = req.ip;
    const now = Date.now();
    
    if (!this.rateLimits) {
      this.rateLimits = new Map();
    }
    
    const clientRequests = this.rateLimits.get(clientId) || [];
    const recentRequests = clientRequests.filter(time => now - time < 60000);
    
    if (recentRequests.length >= 60) { // 60 requests per minute
      return res.status(429).json({
        error: 'Rate limit exceeded'
      });
    }
    
    recentRequests.push(now);
    this.rateLimits.set(clientId, recentRequests);
    
    next();
  }

  getStats() {
    return {
      ...this.stats,
      avgLatency: this.stats.requests > 0 ? this.stats.totalLatency / this.stats.requests : 0,
      errorRate: this.stats.requests > 0 ? (this.stats.errors / this.stats.requests) * 100 : 0,
      uptime: process.uptime()
    };
  }

  listAvailableModels() {
    const downloadManager = new ModelDownloadManager();
    return downloadManager.listLocalModels();
  }
}
```

## Error Handling and Monitoring

### Common Error Patterns

```javascript
class LocalErrorHandler {
  constructor() {
    this.errorCounts = new Map();
    this.lastErrors = [];
  }

  handleError(error, context = {}) {
    const errorType = this.classifyError(error);
    
    this.recordError(errorType, error, context);
    
    switch (errorType) {
      case 'MEMORY_ERROR':
        return this.handleMemoryError(error, context);
      case 'MODEL_LOAD_ERROR':
        return this.handleModelLoadError(error, context);
      case 'GENERATION_ERROR':
        return this.handleGenerationError(error, context);
      default:
        return this.handleGenericError(error, context);
    }
  }

  classifyError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('memory') || message.includes('oom')) {
      return 'MEMORY_ERROR';
    } else if (message.includes('load') || message.includes('file not found')) {
      return 'MODEL_LOAD_ERROR';
    } else if (message.includes('generation') || message.includes('inference')) {
      return 'GENERATION_ERROR';
    } else {
      return 'UNKNOWN_ERROR';
    }
  }

  handleMemoryError(error, context) {
    console.error('Memory error detected:', error.message);
    
    return {
      error: 'Insufficient memory for model inference',
      suggestion: 'Try using a smaller model or quantized version',
      recovery: 'unload_models'
    };
  }

  handleModelLoadError(error, context) {
    console.error('Model load error:', error.message);
    
    return {
      error: 'Failed to load model',
      suggestion: 'Check if model file exists and is valid',
      recovery: 'download_model'
    };
  }

  recordError(type, error, context) {
    const count = this.errorCounts.get(type) || 0;
    this.errorCounts.set(type, count + 1);
    
    this.lastErrors.push({
      type,
      message: error.message,
      context,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 100 errors
    if (this.lastErrors.length > 100) {
      this.lastErrors.shift();
    }
  }

  getErrorStats() {
    return {
      counts: Object.fromEntries(this.errorCounts),
      recent: this.lastErrors.slice(-10)
    };
  }
}
```

## Best Practices

### 1. Hardware Optimization
- Use appropriate quantization levels for your hardware
- Enable GPU acceleration when available
- Optimize thread count for your CPU
- Monitor memory usage and implement model rotation

### 2. Model Management
- Keep frequently used models loaded
- Implement automatic unloading of idle models
- Use quantized models for production deployment
- Cache model responses when appropriate

### 3. Performance Tuning
- Benchmark different engines for your use case
- Optimize context length based on requirements
- Use batch processing for multiple requests
- Monitor latency and throughput metrics

### 4. Production Deployment
- Implement proper error handling and recovery
- Set up monitoring and alerting
- Use load balancing for multiple instances
- Plan for model updates and rollbacks

---

**Related:** [Model Formats Guide](../reference/model-formats.md) | **Next:** [Cloud Provider](./cloud.md)