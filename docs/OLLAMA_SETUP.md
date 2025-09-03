# 🦙 Ollama Integration Guide

Complete guide for setting up and using Ollama with LLM Runner Router for zero-cost local inference.

## 📋 Table of Contents

- [What is Ollama?](#what-is-ollama)
- [Installation](#installation)
- [Model Management](#model-management)
- [LLM Router Integration](#llm-router-integration)
- [Popular Models](#popular-models)
- [Troubleshooting](#troubleshooting)
- [Performance Tips](#performance-tips)

## 🤖 What is Ollama?

**Ollama** is a powerful tool for running large language models locally on your machine. It provides:

- **Zero API Costs**: All inference happens locally
- **Privacy**: No data leaves your machine
- **Speed**: Optimized for local hardware
- **Simplicity**: Easy model management with pull/push commands
- **Quantization**: Efficient Q4_K_M quantized models for faster inference

## 🚀 Installation

### Step 1: Install Ollama

#### Linux/macOS (Recommended)
```bash
# Download and install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Verify installation
ollama --version
```

#### Manual Installation (VPS/Server)
```bash
# Download the binary directly
curl -L https://ollama.ai/download/ollama-linux-amd64 -o ollama
chmod +x ollama
sudo mv ollama /usr/local/bin/

# Create systemd service (optional for auto-start)
sudo tee /etc/systemd/system/ollama.service > /dev/null <<EOF
[Unit]
Description=Ollama Service
After=network-online.target

[Service]
ExecStart=/usr/local/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl start ollama
```

### Step 2: Start Ollama Server

```bash
# Start the Ollama server (runs on http://localhost:11434)
ollama serve
```

**Note**: Keep this terminal open or run as a background service.

## 📦 Model Management

### Pull Popular Models

```bash
# Fast 3B models (recommended for development)
ollama pull qwen2.5:3b-instruct-q4_K_M    # 1.9GB - Fast, 32K context
ollama pull phi3:mini                      # 2.2GB - Microsoft, 128K context

# Medium 7B-8B models (balanced performance)
ollama pull llama3.1:8b                    # 4.7GB - Meta's latest
ollama pull mistral:7b                     # 4.1GB - Efficient reasoning

# Large 13B+ models (best quality, requires more RAM)
ollama pull llama3.1:13b                   # 7.3GB - Higher quality
ollama pull qwen2.5:14b                    # 8.7GB - Advanced reasoning
```

### Model Management Commands

```bash
# List installed models
ollama list

# Remove a model
ollama rm qwen2.5:3b-instruct-q4_K_M

# Show model info
ollama show qwen2.5:3b-instruct-q4_K_M

# Test a model directly
ollama run qwen2.5:3b-instruct-q4_K_M "Hello! Tell me about yourself."
```

## 🔗 LLM Router Integration

### Quick Setup (Recommended)

```javascript
import { LLMRouter, setupOllama } from 'llm-runner-router';

// Automatic discovery and setup
const router = new LLMRouter();
const models = await setupOllama();

console.log(`✅ Found ${models.length} Ollama models:`);
models.forEach(m => console.log(`  - ${m.name}`));

// Use immediately
const response = await router.quick("Explain quantum computing briefly:", {
  modelId: 'qwen2.5:3b-instruct-q4_K_M'
});

console.log(response.text);
```

### Manual Model Registration

```javascript
import { LLMRouter, addOllamaModel } from 'llm-runner-router';

const router = new LLMRouter();

// Add specific models with custom configuration
await addOllamaModel('phi3:mini', {
  name: 'Phi-3 Mini',
  description: 'Microsoft\'s efficient 3.8B model',
  maxTokens: 4096,
  temperature: 0.7
});

await addOllamaModel('qwen2.5:3b-instruct-q4_K_M', {
  name: 'Qwen2.5 3B Instruct',
  description: 'Fast Chinese-English bilingual model',
  contextWindow: 32768
});

// Use the models
const phi3Response = await router.quick("Write a Python function:", {
  modelId: 'phi3:mini'
});

const qwenResponse = await router.quick("Explain machine learning:", {
  modelId: 'qwen2.5:3b-instruct-q4_K_M'
});
```

### Advanced Integration

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter();

// Load model with full control
const model = await router.load({
  provider: 'ollama',
  modelId: 'phi3:mini',
  baseURL: 'http://localhost:11434', // Custom Ollama endpoint
  options: {
    temperature: 0.8,
    top_p: 0.9,
    top_k: 40
  }
});

// Text generation
const result = await model.generate("Write a haiku about programming:");
console.log(result.text);
console.log(`Tokens used: ${result.usage.total_tokens}`);

// Chat-style conversation
const chatResult = await model.chat([
  { role: 'system', content: 'You are a helpful programming assistant.' },
  { role: 'user', content: 'How do I implement a binary search?' }
]);
console.log(chatResult.text);

// Streaming responses
console.log("Streaming response:");
for await (const token of model.stream("Tell me a story about AI:")) {
  if (token.text) {
    process.stdout.write(token.text);
  }
}
```

### Custom Ollama Configuration

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  ollama: {
    baseURL: 'http://localhost:11434',    // Default Ollama endpoint
    timeout: 30000,                       // Request timeout (30s)
    maxRetries: 3,                        // Retry failed requests
    models: {
      'qwen2.5:3b-instruct-q4_K_M': {
        priority: 'speed',
        contextWindow: 32768,
        features: ['chat', 'instruct', 'streaming']
      },
      'phi3:mini': {
        priority: 'balanced',
        contextWindow: 128000,
        features: ['chat', 'instruct', 'streaming']
      }
    }
  }
});

// Router will automatically prefer Ollama models for cost optimization
const response = await router.quick("Explain recursion:", {
  strategy: 'cost-optimized'  // Will prefer local Ollama models
});
```

## 🎯 Popular Models

### Fast Development Models (3B-4B)

#### Qwen2.5 3B Instruct Q4_K_M
```bash
ollama pull qwen2.5:3b-instruct-q4_K_M
```
- **Size**: 1.9GB
- **Context**: 32,768 tokens
- **Language**: Chinese/English bilingual
- **Best for**: Fast prototyping, coding assistance

#### Phi-3 Mini
```bash
ollama pull phi3:mini
```
- **Size**: 2.2GB
- **Context**: 128,000 tokens
- **Language**: English-focused
- **Best for**: Long documents, reasoning tasks

### Balanced Performance Models (7B-8B)

#### Llama 3.1 8B
```bash
ollama pull llama3.1:8b
```
- **Size**: 4.7GB
- **Context**: 128,000 tokens
- **Best for**: General purpose, reasoning, coding

#### Mistral 7B
```bash
ollama pull mistral:7b
```
- **Size**: 4.1GB
- **Context**: 32,768 tokens
- **Best for**: Efficient reasoning, instruction following

### High-Quality Models (13B+)

#### Llama 3.1 70B (Requires 40GB+ RAM)
```bash
ollama pull llama3.1:70b
```
- **Size**: 40GB
- **Context**: 128,000 tokens
- **Best for**: Production applications, complex reasoning

## 🛠️ Troubleshooting

### Common Issues

#### 1. "Connection refused" Error
```bash
# Check if Ollama is running
ps aux | grep ollama

# Start Ollama if not running
ollama serve
```

#### 2. "Model not found" Error
```bash
# List available models
ollama list

# Pull the missing model
ollama pull qwen2.5:3b-instruct-q4_K_M
```

#### 3. Out of Memory Errors
```bash
# Check system memory
free -h

# Use smaller models for limited RAM:
# - 4GB RAM: Use 3B models only
# - 8GB RAM: Use up to 7B models  
# - 16GB+ RAM: Use any model
```

#### 4. Slow Performance
```bash
# Check CPU usage
htop

# Optimize Ollama settings
export OLLAMA_NUM_PARALLEL=4      # Parallel requests
export OLLAMA_MAX_LOADED_MODELS=2 # Keep models in memory
```

### Debug Commands

```bash
# Check Ollama service status
curl http://localhost:11434/api/version

# Test model availability
curl http://localhost:11434/api/tags

# Monitor Ollama logs
ollama logs

# Test simple generation
curl http://localhost:11434/api/generate -d '{
  "model": "qwen2.5:3b-instruct-q4_K_M",
  "prompt": "Hello, world!",
  "stream": false
}'
```

### Performance Monitoring

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter();
const model = await router.load({ provider: 'ollama', modelId: 'phi3:mini' });

// Monitor performance
const startTime = Date.now();
const result = await model.generate("Explain quantum computing:");
const endTime = Date.now();

console.log(`Response time: ${endTime - startTime}ms`);
console.log(`Tokens per second: ${result.usage.completion_tokens / ((endTime - startTime) / 1000)}`);
console.log(`Total tokens: ${result.usage.total_tokens}`);
```

## ⚡ Performance Tips

### 1. Model Selection Strategy
```javascript
// For development (fastest)
const devModel = 'qwen2.5:3b-instruct-q4_K_M';  // 1.9GB, ~50 tokens/sec

// For balanced use (quality + speed)
const balancedModel = 'llama3.1:8b';             // 4.7GB, ~25 tokens/sec

// For production (highest quality)
const prodModel = 'llama3.1:70b';                // 40GB, ~10 tokens/sec
```

### 2. Memory Optimization
```bash
# Keep multiple models loaded (if you have RAM)
export OLLAMA_MAX_LOADED_MODELS=3

# Adjust parallel processing
export OLLAMA_NUM_PARALLEL=2
```

### 3. Strategic Model Caching
```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  cache: {
    enabled: true,
    ttl: 300000,        // 5-minute cache
    maxSize: 1000       // Cache up to 1000 responses
  }
});

// Frequently used prompts will be cached
const response = await router.quick("Explain machine learning:");
```

### 4. Hardware Optimization

#### CPU Optimization
```bash
# Use all CPU cores
export OLLAMA_NUM_PARALLEL=4

# Optimize for your CPU
export OLLAMA_CPU_ACCELERATION=1
```

#### GPU Acceleration (if available)
```bash
# Enable GPU acceleration
export OLLAMA_GPU_ACCELERATION=1
export CUDA_VISIBLE_DEVICES=0
```

### 5. Network Optimization
```javascript
// For remote Ollama instances
const router = new LLMRouter({
  ollama: {
    baseURL: 'http://your-server:11434',
    timeout: 60000,     // Longer timeout for remote
    keepAlive: true     // Reuse connections
  }
});
```

## 🔍 Model Comparison

| Model | Size | Context | Speed | Quality | Best Use Case |
|-------|------|---------|-------|---------|---------------|
| qwen2.5:3b | 1.9GB | 32K | ⚡⚡⚡⚡ | ⭐⭐⭐ | Development, Coding |
| phi3:mini | 2.2GB | 128K | ⚡⚡⚡⚡ | ⭐⭐⭐ | Long documents |
| llama3.1:8b | 4.7GB | 128K | ⚡⚡⚡ | ⭐⭐⭐⭐ | General purpose |
| mistral:7b | 4.1GB | 32K | ⚡⚡⚡ | ⭐⭐⭐⭐ | Reasoning tasks |
| llama3.1:70b | 40GB | 128K | ⚡⚡ | ⭐⭐⭐⭐⭐ | Production apps |

## 📊 Cost Comparison

| Provider | Model | Cost per 1M tokens | Ollama Cost |
|----------|-------|-------------------|-------------|
| OpenAI | GPT-4o | $2.50 | **$0.00** |
| Anthropic | Claude 3.5 Sonnet | $3.00 | **$0.00** |
| Google | Gemini Pro | $1.25 | **$0.00** |
| **Ollama** | **Any model** | **$0.00** | **$0.00** |

**Annual Savings Example**: If you process 10M tokens/month:
- Cloud APIs: $300-$360/year
- Ollama: $0/year
- **Savings: $300-$360/year** 🎉

---

## 🎉 Summary

Ollama integration with LLM Router provides:

✅ **Zero API costs** - All inference runs locally  
✅ **Complete privacy** - No data leaves your machine  
✅ **Easy setup** - One-command installation and auto-discovery  
✅ **Production ready** - Full streaming, chat, and batch support  
✅ **Performance optimized** - Quantized models for speed  
✅ **Flexible configuration** - Custom endpoints and parameters  

**Get started in 3 commands:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull qwen2.5:3b-instruct-q4_K_M  
ollama serve
```

Then in your JavaScript:
```javascript
import { setupOllama } from 'llm-runner-router';
const models = await setupOllama();
// Ready to use! 🚀
```

For support, visit our [GitHub Issues](https://github.com/MCERQUA/LLM-Runner-Router/issues) or [Discord Community](https://discord.gg/llm-router).