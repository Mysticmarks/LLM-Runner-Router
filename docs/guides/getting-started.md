# Getting Started with LLM Runner Router

Welcome to LLM Runner Router - a universal, format-agnostic LLM model orchestration system. This guide will help you get up and running quickly.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Basic Configuration](#basic-configuration)
5. [Your First Model](#your-first-model)
6. [Basic Usage Examples](#basic-usage-examples)
7. [Next Steps](#next-steps)

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18.0.0 or higher** - [Download Node.js](https://nodejs.org/)
- **npm** or **yarn** package manager
- **4GB+ RAM** (recommended for model loading)
- **2GB+ free disk space** (for model storage)

### System Requirements

- **Minimum**: 4GB RAM, 2GB storage
- **Recommended**: 8GB+ RAM, 10GB+ storage
- **Enterprise**: 16GB+ RAM, 50GB+ storage

## Installation

### Option 1: NPM Package (Recommended)

```bash
npm install llm-runner-router
```

### Option 2: From Source

```bash
git clone https://github.com/MCERQUA/LLM-Runner-Router.git
cd LLM-Runner-Router
npm install
```

### Option 3: Docker

```bash
docker pull llm-runner-router:latest
docker run -p 3000:3000 llm-runner-router
```

## Quick Start

### 1. Basic Usage (Node.js)

Create a new file `quick-start.js`:

```javascript
import { LLMRouter } from 'llm-runner-router';

// Initialize the router (auto-detects environment)
const router = new LLMRouter();

// Basic inference
async function quickExample() {
    try {
        const result = await router.process({
            prompt: "Hello, how are you?",
            maxTokens: 50
        });
        
        console.log('Response:', result.response);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

quickExample();
```

Run it:
```bash
node quick-start.js
```

### 2. Web Server Setup

Create `server.js`:

```javascript
import express from 'express';
import { LLMRouter } from 'llm-runner-router';

const app = express();
const router = new LLMRouter();

app.use(express.json());

app.post('/chat', async (req, res) => {
    try {
        const { prompt, maxTokens = 100 } = req.body;
        
        const result = await router.process({
            prompt,
            maxTokens,
            strategy: 'balanced'
        });
        
        res.json({
            success: true,
            response: result.response,
            model: result.modelUsed,
            metrics: result.metrics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(3000, () => {
    console.log('LLM Router server running on http://localhost:3000');
});
```

Start the server:
```bash
node server.js
```

Test it:
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain quantum computing", "maxTokens": 200}'
```

## Basic Configuration

### Environment Variables

Create a `.env` file:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Model Storage
MODEL_CACHE_DIR=./models/cache
MODEL_REGISTRY_PATH=./models/registry.json

# Performance
MAX_CONCURRENT_REQUESTS=10
REQUEST_TIMEOUT_MS=30000

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# Optional: OpenAI API (for fallback)
OPENAI_API_KEY=your_key_here

# Optional: HuggingFace (for model downloads)
HUGGINGFACE_API_KEY=your_key_here
```

### Configuration File

Create `config/llm-router.json`:

```json
{
  "routing": {
    "strategy": "balanced",
    "fallbackEnabled": true,
    "timeout": 30000
  },
  "models": {
    "autoDownload": true,
    "cacheEnabled": true,
    "maxCacheSize": "5GB"
  },
  "performance": {
    "maxConcurrent": 10,
    "enableStreaming": true,
    "enableEnsemble": false
  },
  "logging": {
    "level": "info",
    "enableMetrics": true,
    "enableTracing": false
  }
}
```

## Your First Model

### Automatic Model Setup

The router automatically sets up a lightweight model for testing:

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
    autoSetup: true  // Downloads a small test model automatically
});

// The router is ready to use immediately
const result = await router.process({
    prompt: "What is machine learning?",
    maxTokens: 100
});
```

### Manual Model Registration

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter();

// Register a local GGUF model
await router.registerModel({
    id: 'my-model',
    name: 'My Custom Model',
    format: 'gguf',
    source: './models/my-model.gguf',
    config: {
        contextLength: 2048,
        temperature: 0.7
    }
});

// Register a HuggingFace model
await router.registerModel({
    id: 'hf-model',
    name: 'HuggingFace Model',
    format: 'hf',
    source: 'microsoft/DialoGPT-medium',
    config: {
        maxLength: 1000
    }
});
```

### Download Popular Models

```javascript
// Download common lightweight models
await router.downloadModel('TinyLlama/TinyLlama-1.1B-Chat-v1.0');
await router.downloadModel('microsoft/DialoGPT-small');

// Check available models
const models = await router.listModels();
console.log('Available models:', models);
```

## Basic Usage Examples

### 1. Simple Text Generation

```javascript
const result = await router.process({
    prompt: "Write a haiku about programming:",
    maxTokens: 50,
    temperature: 0.8
});

console.log(result.response);
```

### 2. Streaming Response

```javascript
const stream = await router.processStream({
    prompt: "Explain the theory of relativity:",
    maxTokens: 200
});

for await (const chunk of stream) {
    process.stdout.write(chunk.token);
}
```

### 3. Model Selection Strategy

```javascript
// Quality-first (slowest, best results)
const qualityResult = await router.process({
    prompt: "Analyze this data...",
    strategy: 'quality-first'
});

// Speed-priority (fastest, acceptable quality)
const speedResult = await router.process({
    prompt: "Quick question...",
    strategy: 'speed-priority'
});

// Cost-optimized (cheapest options)
const costResult = await router.process({
    prompt: "Simple task...",
    strategy: 'cost-optimized'
});
```

### 4. Model Ensemble

```javascript
// Use multiple models for better results
const ensembleResult = await router.processEnsemble({
    prompt: "What is the meaning of life?",
    models: ['model1', 'model2', 'model3'],
    weights: [0.5, 0.3, 0.2],
    aggregation: 'weighted_average'
});
```

### 5. Batch Processing

```javascript
const prompts = [
    "Translate 'hello' to Spanish",
    "What is 2+2?",
    "Name a programming language"
];

const results = await router.processBatch(prompts, {
    maxTokens: 50,
    concurrent: 3
});

results.forEach((result, index) => {
    console.log(`Prompt ${index + 1}: ${result.response}`);
});
```

## Common Configuration Patterns

### Development Setup

```javascript
const devRouter = new LLMRouter({
    environment: 'development',
    logging: { level: 'debug' },
    models: { autoDownload: true },
    performance: { maxConcurrent: 2 }
});
```

### Production Setup

```javascript
const prodRouter = new LLMRouter({
    environment: 'production',
    logging: { level: 'warn' },
    caching: { enabled: true, ttl: 3600 },
    monitoring: { enabled: true },
    rateLimit: { requests: 1000, window: 60000 }
});
```

### High-Performance Setup

```javascript
const hpRouter = new LLMRouter({
    performance: {
        maxConcurrent: 20,
        enableStreaming: true,
        enableEnsemble: true,
        cacheStrategy: 'aggressive'
    },
    engines: ['webgpu', 'wasm', 'native']
});
```

## Troubleshooting

### Common Issues

**Issue**: "No models available"
```javascript
// Solution: Register or download a model first
await router.downloadModel('TinyLlama/TinyLlama-1.1B-Chat-v1.0');
```

**Issue**: "Out of memory"
```javascript
// Solution: Use smaller models or reduce concurrent requests
const router = new LLMRouter({
    performance: { maxConcurrent: 1 },
    models: { preferSmallModels: true }
});
```

**Issue**: "Request timeout"
```javascript
// Solution: Increase timeout or use faster models
const result = await router.process({
    prompt: "...",
    timeout: 60000,  // 60 seconds
    strategy: 'speed-priority'
});
```

### Debug Mode

```javascript
const router = new LLMRouter({
    debug: true,
    logging: { level: 'debug' }
});

// Check router status
const status = await router.getStatus();
console.log('Router Status:', status);

// Check model health
const health = await router.checkModelHealth();
console.log('Model Health:', health);
```

## Next Steps

Now that you have the basics working, explore these advanced features:

1. **[Configuration Guide](./configuration-guide.md)** - Detailed configuration options
2. **[Deployment Guide](./deployment-guide.md)** - Production deployment strategies
3. **[API Reference](../API_REFERENCE.md)** - Complete API documentation
4. **[Examples](../examples/)** - More complex usage examples
5. **[Tutorials](../tutorials/)** - Step-by-step tutorials

### Learning Path

1. ✅ **Getting Started** (You are here)
2. 📚 [Basic Tutorial](../tutorials/basic-usage.md)
3. 🚀 [Streaming Tutorial](../tutorials/streaming-tutorial.md)
4. ⚙️ [Configuration Guide](./configuration-guide.md)
5. 🏭 [Deployment Guide](./deployment-guide.md)

### Community & Support

- **Documentation**: [Full Documentation](../README.md)
- **Examples**: [Code Examples](../examples/)
- **Issues**: [GitHub Issues](https://github.com/MCERQUA/LLM-Runner-Router/issues)
- **Discussions**: [GitHub Discussions](https://github.com/MCERQUA/LLM-Runner-Router/discussions)

---

**Happy coding!** 🚀

For more advanced usage, continue to the [Configuration Guide](./configuration-guide.md) or try our [Interactive Tutorials](../tutorials/).