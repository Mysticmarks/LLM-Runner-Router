# 🤝 Together AI Provider Documentation

*Complete guide to using Together AI with LLM-Runner-Router*

## What is Together AI?

Together AI is a decentralized cloud platform that provides access to 200+ open-source models with production-ready infrastructure. They offer model fine-tuning, batch inference, and optimized serving for cost-effective AI applications.

**Key Strengths:**
- 200+ open-source models including Llama, Mistral, Qwen
- Cost-effective pricing (up to 4x cheaper than major providers)
- Custom model fine-tuning and deployment
- High-throughput batch inference
- Developer-friendly API

## Quick Start

### Basic Setup

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['together'],
  together: {
    apiKey: process.env.TOGETHER_API_KEY
  }
});

const response = await router.generate({
  model: 'meta-llama/Llama-2-70b-chat-hf',
  prompt: 'Explain the benefits of open-source AI models',
  maxTokens: 500
});

console.log(response.text);
```

### Environment Setup

```bash
# Set your Together AI API key
export TOGETHER_API_KEY=your-together-api-key-here
```

## Configuration

### Environment Variables

```bash
# Required
TOGETHER_API_KEY=your-together-api-key

# Optional
TOGETHER_BASE_URL=https://api.together.xyz/v1  # Default
TOGETHER_DEFAULT_MODEL=meta-llama/Llama-2-70b-chat-hf  # Default model
```

### Configuration Options

```javascript
const togetherConfig = {
  // Required
  apiKey: process.env.TOGETHER_API_KEY,
  
  // Optional
  baseURL: 'https://api.together.xyz/v1',        // Default endpoint
  
  // Request configuration
  timeout: 60000,                                // Longer timeout for large models
  maxRetries: 3,                                 // Retry attempts
  
  // Default parameters
  defaultParams: {
    temperature: 0.7,
    maxTokens: 1000,
    topP: 0.7,
    topK: 50,
    repetitionPenalty: 1.0,
    stop: ['</s>', '[INST]', '[/INST]']          // Common stop sequences
  },
  
  // Rate limiting (Together AI is quite generous)
  rateLimiting: {
    requestsPerSecond: 10,
    requestsPerMinute: 600
  },
  
  // Cost optimization
  costOptimization: {
    preferSmallModels: false,                    // Set true for cost savings
    batchRequests: true,                         // Use batch API when available
    cacheResponses: true                         // Cache similar responses
  }
};
```

## Available Models

### Llama 2 Models

```javascript
// Llama 2 70B Chat (Best quality)
model: 'meta-llama/Llama-2-70b-chat-hf'

// Llama 2 13B Chat (Good balance)
model: 'meta-llama/Llama-2-13b-chat-hf'

// Llama 2 7B Chat (Fastest)
model: 'meta-llama/Llama-2-7b-chat-hf'

// Code Llama models
model: 'codellama/CodeLlama-34b-Instruct-hf'
model: 'codellama/CodeLlama-13b-Instruct-hf'
model: 'codellama/CodeLlama-7b-Instruct-hf'
```

### Llama 3/3.1 Models

```javascript
// Llama 3.1 405B (Largest open model)
model: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo'

// Llama 3.1 70B 
model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'

// Llama 3.1 8B
model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'

// Llama 3 70B
model: 'meta-llama/Llama-3-70b-chat-hf'

// Llama 3 8B  
model: 'meta-llama/Llama-3-8b-chat-hf'
```

### Mistral Models

```javascript
// Mixtral 8x7B (Mixture of Experts)
model: 'mistralai/Mixtral-8x7B-Instruct-v0.1'

// Mistral 7B
model: 'mistralai/Mistral-7B-Instruct-v0.1'
model: 'mistralai/Mistral-7B-Instruct-v0.2'
model: 'mistralai/Mistral-7B-Instruct-v0.3'
```

### Qwen Models

```javascript
// Qwen 2 72B (Excellent multilingual)
model: 'Qwen/Qwen2-72B-Instruct'

// Qwen 1.5 110B (Large context)
model: 'Qwen/Qwen1.5-110B-Chat'

// Qwen 1.5 72B
model: 'Qwen/Qwen1.5-72B-Chat'
```

### Specialized Models

```javascript
// Chronos for time series
model: 'chronos-forecasting/chronos-t5-large'

// WizardLM for complex reasoning
model: 'WizardLM/WizardLM-70B-V1.0'

// Alpaca models
model: 'togethercomputer/alpaca-7b'

// RedPajama models
model: 'togethercomputer/RedPajama-INCITE-7B-Chat'

// StripedHyena (alternative architecture)
model: 'togethercomputer/StripedHyena-Nous-14B'
```

### Image Generation Models

```javascript
// Stable Diffusion XL
model: 'stabilityai/stable-diffusion-xl-base-1.0'

// Stable Diffusion 2.1
model: 'stabilityai/stable-diffusion-2-1'

// RunwayML Stable Diffusion
model: 'runwayml/stable-diffusion-v1-5'
```

## Code Examples

### Simple Text Generation

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['together'],
  together: {
    apiKey: process.env.TOGETHER_API_KEY
  }
});

async function generateText() {
  const response = await router.generate({
    model: 'meta-llama/Llama-2-70b-chat-hf',
    prompt: 'Write a comprehensive guide to open-source AI development',
    maxTokens: 800,
    temperature: 0.7
  });

  console.log('Generated text:', response.text);
  console.log('Cost:', `$${response.cost.toFixed(4)}`);
  console.log('Tokens used:', response.usage.totalTokens);
}

generateText();
```

### Chat with Llama 3.1

```javascript
async function chatWithLlama() {
  const messages = [
    { role: 'system', content: 'You are a helpful AI assistant specializing in open-source technologies.' },
    { role: 'user', content: 'What are the advantages of using open-source LLMs over proprietary ones?' }
  ];

  const response = await router.chat({
    model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    messages,
    maxTokens: 600,
    temperature: 0.6
  });

  console.log('Llama 3.1 response:', response.text);
}

chatWithLlama();
```

### Streaming Response

```javascript
async function streamGeneration() {
  console.log('Llama is generating response...\n');

  for await (const chunk of router.stream({
    model: 'meta-llama/Llama-2-13b-chat-hf',
    prompt: 'Explain the open-source AI ecosystem and key players like Hugging Face, Together AI, and others',
    maxTokens: 1000,
    temperature: 0.7
  })) {
    process.stdout.write(chunk.text);
  }
}

streamGeneration();
```

### Code Generation with Code Llama

```javascript
async function generateCode() {
  const response = await router.generate({
    model: 'codellama/CodeLlama-34b-Instruct-hf',
    prompt: `
Create a Python class for a distributed task queue that:
1. Uses Redis as the backend
2. Supports priority queues
3. Has retry mechanisms for failed tasks
4. Includes monitoring and metrics
5. Is thread-safe

Include proper error handling and type hints.
`,
    maxTokens: 1000,
    temperature: 0.1,  // Low temperature for code generation
    stop: ['</s>']
  });

  console.log('Generated code:', response.text);
}

generateCode();
```

### Model Comparison

```javascript
async function compareModels() {
  const prompt = 'Explain the concept of machine learning in simple terms.';
  const models = [
    'meta-llama/Llama-2-7b-chat-hf',
    'meta-llama/Llama-2-13b-chat-hf', 
    'meta-llama/Llama-2-70b-chat-hf',
    'mistralai/Mixtral-8x7B-Instruct-v0.1'
  ];

  console.log('Comparing Together AI models...\n');

  for (const model of models) {
    console.log(`--- ${model} ---`);
    
    const startTime = Date.now();
    const response = await router.generate({
      model,
      prompt,
      maxTokens: 200,
      temperature: 0.7
    });
    const duration = Date.now() - startTime;

    console.log(response.text);
    console.log(`Cost: $${response.cost.toFixed(6)}, Tokens: ${response.usage.totalTokens}, Time: ${duration}ms\n`);
  }
}

compareModels();
```

### Batch Processing

```javascript
async function batchGeneration() {
  const prompts = [
    'Explain containerization and Docker',
    'What are the benefits of Kubernetes?',
    'How does microservices architecture work?',
    'What is DevOps and why is it important?'
  ];

  console.log('Processing batch requests...\n');

  // Process in parallel for faster results
  const promises = prompts.map((prompt, index) => 
    router.generate({
      model: 'meta-llama/Llama-2-13b-chat-hf',
      prompt,
      maxTokens: 300,
      temperature: 0.7
    }).then(response => ({ index, prompt, response }))
  );

  const results = await Promise.all(promises);
  
  results.forEach(({ index, prompt, response }) => {
    console.log(`--- Request ${index + 1}: ${prompt} ---`);
    console.log(response.text);
    console.log(`Cost: $${response.cost.toFixed(4)}\n`);
  });

  const totalCost = results.reduce((sum, r) => sum + r.response.cost, 0);
  console.log(`Total batch cost: $${totalCost.toFixed(4)}`);
}

batchGeneration();
```

### Image Generation

```javascript
async function generateImage() {
  const response = await router.generateImage({
    model: 'stabilityai/stable-diffusion-xl-base-1.0',
    prompt: 'A futuristic data center with AI servers, cyberpunk style, high quality',
    negativePrompt: 'blurry, low quality, distorted',
    width: 1024,
    height: 1024,
    steps: 50,
    guidanceScale: 7.5,
    seed: 42
  });

  console.log('Generated image URL:', response.imageUrl);
  console.log('Generation cost:', `$${response.cost.toFixed(4)}`);
}

generateImage();
```

### Fine-tuning Custom Model

```javascript
async function fineTuneModel() {
  // Upload training data
  const datasetResponse = await router.uploadDataset({
    file: '/path/to/training-data.jsonl',
    name: 'custom-dataset-v1'
  });

  console.log('Dataset uploaded:', datasetResponse.id);

  // Start fine-tuning job
  const finetuneResponse = await router.createFineTuning({
    model: 'meta-llama/Llama-2-7b-chat-hf',
    dataset: datasetResponse.id,
    hyperparameters: {
      learningRate: 5e-5,
      batchSize: 4,
      epochs: 3
    },
    name: 'my-custom-llama-model'
  });

  console.log('Fine-tuning job started:', finetuneResponse.id);
  
  // Monitor progress
  while (true) {
    const status = await router.getFineTuningStatus(finetuneResponse.id);
    console.log('Status:', status.status);
    
    if (status.status === 'completed') {
      console.log('Custom model ready:', status.modelId);
      break;
    } else if (status.status === 'failed') {
      console.error('Fine-tuning failed:', status.error);
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30s
  }
}

fineTuneModel();
```

## Best Practices

### 1. Model Selection Strategy

```javascript
const modelStrategy = {
  // High-quality tasks requiring best reasoning
  premium: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
  
  // Balanced performance and cost
  balanced: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  
  // Fast responses for simple tasks
  fast: 'meta-llama/Llama-2-7b-chat-hf',
  
  // Code generation
  coding: 'codellama/CodeLlama-34b-Instruct-hf',
  
  // Multilingual tasks
  multilingual: 'Qwen/Qwen2-72B-Instruct',
  
  // Cost-optimized
  budget: 'meta-llama/Llama-2-13b-chat-hf',
  
  // Mixture of experts (good performance per cost)
  efficient: 'mistralai/Mixtral-8x7B-Instruct-v0.1'
};
```

### 2. Cost Optimization

```javascript
// Configure for maximum cost efficiency
const costOptimizedRouter = new LLMRouter({
  providers: ['together'],
  strategy: 'cost-optimized',
  together: {
    apiKey: process.env.TOGETHER_API_KEY,
    costOptimization: {
      // Prefer smaller models for simple tasks
      preferredModels: [
        'meta-llama/Llama-2-7b-chat-hf',    // $0.0002/1K tokens
        'meta-llama/Llama-2-13b-chat-hf',   // $0.0003/1K tokens  
        'mistralai/Mistral-7B-Instruct-v0.3', // $0.0002/1K tokens
        'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo' // $0.0002/1K tokens
      ],
      maxCostPerRequest: 0.005,              // 0.5 cents max
      enableCaching: true,                   // Cache similar requests
      batchSimilarRequests: true             // Batch when possible
    }
  }
});
```

### 3. Prompt Optimization for Open Models

```javascript
// Together AI models often work better with specific formatting
function formatPromptForLlama(systemPrompt, userPrompt) {
  return `<s>[INST] <<SYS>>\n${systemPrompt}\n<</SYS>>\n\n${userPrompt} [/INST]`;
}

function formatPromptForMistral(systemPrompt, userPrompt) {
  return `<s>[INST] ${systemPrompt}\n\n${userPrompt} [/INST]`;
}

// Use formatted prompts
const response = await router.generate({
  model: 'meta-llama/Llama-2-70b-chat-hf',
  prompt: formatPromptForLlama(
    'You are a helpful assistant specialized in software development.',
    'How do I implement OAuth2 authentication in Node.js?'
  ),
  maxTokens: 500
});
```

### 4. Error Handling

```javascript
async function robustTogetherCall() {
  try {
    const response = await router.generate({
      model: 'meta-llama/Llama-2-70b-chat-hf',
      prompt: 'Your prompt here',
      maxTokens: 500
    });
    
    return response;
  } catch (error) {
    switch (error.type) {
      case 'rate_limit_exceeded':
        console.warn('Rate limit hit, waiting...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return robustTogetherCall(); // Retry
        
      case 'model_not_available':
        console.error('Model temporarily unavailable, trying smaller model...');
        return await router.generate({
          model: 'meta-llama/Llama-2-13b-chat-hf',
          prompt: 'Your prompt here',
          maxTokens: 500
        });
        
      case 'context_length_exceeded':
        console.error('Prompt too long, truncating...');
        // Implement prompt truncation logic
        break;
        
      case 'timeout':
        console.warn('Request timed out, trying faster model...');
        return await router.generate({
          model: 'meta-llama/Llama-2-7b-chat-hf',
          prompt: 'Your prompt here',
          maxTokens: 500
        });
        
      default:
        console.error('Together AI error:', error);
        throw error;
    }
  }
}
```

### 5. Performance Monitoring

```javascript
// Monitor model performance and costs
const performanceTracker = {
  modelStats: new Map(),
  
  trackRequest(model, startTime, response) {
    const duration = Date.now() - startTime;
    const stats = this.modelStats.get(model) || {
      requests: 0,
      totalCost: 0,
      totalTokens: 0,
      totalDuration: 0,
      avgLatency: 0
    };
    
    stats.requests++;
    stats.totalCost += response.cost;
    stats.totalTokens += response.usage.totalTokens;
    stats.totalDuration += duration;
    stats.avgLatency = stats.totalDuration / stats.requests;
    
    this.modelStats.set(model, stats);
  },
  
  getReport() {
    const report = [];
    for (const [model, stats] of this.modelStats.entries()) {
      report.push({
        model,
        requests: stats.requests,
        avgCost: stats.totalCost / stats.requests,
        avgTokens: stats.totalTokens / stats.requests,
        avgLatency: stats.avgLatency,
        costPerToken: stats.totalCost / stats.totalTokens
      });
    }
    return report.sort((a, b) => b.requests - a.requests);
  }
};
```

## Troubleshooting

### Common Issues

#### Issue: "Model not found"
```
Error: Model 'meta-llama/llama-2-70b-chat' not found.
```

**Solution**: Use exact model names from Together AI catalog:
```javascript
// Check available models
const models = await router.listModels();
console.log(models.map(m => m.id));

// Common model name mistakes
const corrections = {
  'llama-2-70b': 'meta-llama/Llama-2-70b-chat-hf',
  'llama-3-70b': 'meta-llama/Llama-3-70b-chat-hf',
  'mixtral-8x7b': 'mistralai/Mixtral-8x7B-Instruct-v0.1'
};
```

#### Issue: "Rate limit exceeded"
```
Error: Rate limit exceeded. Please slow down your requests.
```

**Solution**: Together AI has generous rate limits, but implement backoff:
```javascript
// Together AI typical limits (may vary by tier)
const rateLimits = {
  requestsPerMinute: 600,
  tokensPerMinute: 200000,
  concurrentRequests: 10
};

// Implement exponential backoff
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.type === 'rate_limit_exceeded' && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

#### Issue: "Model overloaded"
```
Error: Model is currently overloaded. Please try again later.
```

**Solution**: Implement fallback to similar models:
```javascript
const modelFallbacks = {
  'meta-llama/Llama-2-70b-chat-hf': [
    'meta-llama/Llama-2-13b-chat-hf',
    'mistralai/Mixtral-8x7B-Instruct-v0.1'
  ],
  'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo': [
    'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    'meta-llama/Llama-2-70b-chat-hf'
  ]
};
```

#### Issue: "Context length exceeded"
```
Error: Input is too long for model context window.
```

**Solution**: Check context limits and implement truncation:
```javascript
const contextLimits = {
  'meta-llama/Llama-2-70b-chat-hf': 4096,
  'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo': 131072,
  'mistralai/Mixtral-8x7B-Instruct-v0.1': 32768,
  'Qwen/Qwen2-72B-Instruct': 131072
};

function truncatePrompt(prompt, model, maxTokens) {
  const limit = contextLimits[model] || 4096;
  const estimatedTokens = prompt.length / 4; // Rough estimate
  
  if (estimatedTokens + maxTokens > limit) {
    const maxPromptTokens = limit - maxTokens - 100; // Safety margin
    const maxChars = maxPromptTokens * 4;
    return prompt.slice(0, maxChars) + '...';
  }
  
  return prompt;
}
```

### Debug Mode

```javascript
const router = new LLMRouter({
  providers: ['together'],
  debug: true,  // Enable debug logging
  together: {
    apiKey: process.env.TOGETHER_API_KEY,
    logLevel: 'DEBUG',
    logRequests: true,
    logResponses: false,  // Don't log response content
    logModelStats: true   // Log performance statistics
  }
});
```

## Pricing Information

### Text Generation Models (per 1M tokens)

#### Llama 2 Models
- **Llama 2 7B Chat**: $0.20
- **Llama 2 13B Chat**: $0.30
- **Llama 2 70B Chat**: $0.90

#### Llama 3/3.1 Models  
- **Llama 3.1 8B Instruct**: $0.20
- **Llama 3.1 70B Instruct**: $0.90
- **Llama 3.1 405B Instruct**: $3.50

#### Code Models
- **Code Llama 7B**: $0.20
- **Code Llama 13B**: $0.30
- **Code Llama 34B**: $0.80

#### Other Models
- **Mixtral 8x7B**: $0.60
- **Mistral 7B**: $0.20
- **Qwen 2 72B**: $0.90

### Image Generation Models (per image)
- **Stable Diffusion XL**: $0.01
- **Stable Diffusion 2.1**: $0.005

### Fine-tuning Costs
- **Training**: $1.00 per 1M tokens processed
- **Inference**: Same as base model + 20% premium

*Together AI typically offers 4-10x cost savings compared to proprietary models. Check Together AI pricing for current rates.*

## Resources

- **Together AI Platform**: [together.ai](https://together.ai)
- **API Documentation**: [docs.together.ai](https://docs.together.ai)
- **Model Library**: [together.ai/models](https://together.ai/models)
- **Discord Community**: [discord.gg/together-ai](https://discord.gg/together-ai)
- **GitHub**: [github.com/togethercomputer](https://github.com/togethercomputer)
- **Fine-tuning Guide**: [docs.together.ai/docs/fine-tuning](https://docs.together.ai/docs/fine-tuning)

---

*Built with 💚 by Echo AI Systems*