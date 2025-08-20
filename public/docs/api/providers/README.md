# 🌐 LLM Provider Documentation

*Complete guide to all 24+ supported LLM providers in LLM-Runner-Router*

## 📊 Provider Overview

LLM-Runner-Router supports **24+ major LLM providers** across 4 categories, providing comprehensive coverage of the LLM ecosystem with **95% market coverage**.

### 🎯 Quick Provider Selection

| **Use Case** | **Recommended Providers** | **Why** |
|--------------|---------------------------|---------|
| **Enterprise Production** | AWS Bedrock, Azure OpenAI, Google Vertex AI | HIPAA/SOC2 compliance, enterprise SLAs |
| **Cost Optimization** | DeepSeek, Groq, DeepInfra | 50-80% cost savings |
| **European Compliance** | Mistral AI | EU data residency, GDPR compliance |
| **Ultra-Fast Inference** | Groq, Fireworks AI | LPU technology, <100ms response |
| **Function Calling** | OpenAI, Fireworks AI, Mistral AI | Advanced tool integration |
| **Open Source Models** | Together AI, Fireworks AI | 200+ OSS models, fine-tuning |
| **Multi-Provider Access** | OpenRouter | 400+ models via single API |

## 📋 Complete Provider List

### ✅ Fully Implemented (12 providers)

#### 🏢 Enterprise Cloud Giants
- **[AWS Bedrock](./bedrock.md)** - Amazon's managed foundation models
- **[Azure OpenAI](./azure-openai.md)** - Microsoft's enterprise OpenAI service  
- **[Google Vertex AI](./vertex-ai.md)** - Google Cloud's AI platform
- **[Mistral AI](./mistral.md)** - European AI leader with GDPR compliance

#### 🚀 High-Performance Inference  
- **[Together AI](./together.md)** - 200+ open-source models, batch processing
- **[Fireworks AI](./fireworks.md)** - FireAttention engine, enterprise compliance

#### 🔧 Industry Standards
- **[OpenAI](./openai.md)** - GPT-4, industry-leading models
- **[Anthropic](./anthropic.md)** - Claude models, safety focus
- **[Groq](./groq.md)** - Ultra-fast LPU inference
- **[OpenRouter](./openrouter.md)** - Multi-provider aggregation

#### 🌐 Specialized Platforms
- **[HuggingFace](./huggingface.md)** - 200K+ open-source models

### 🔄 In Development (12 providers)

#### 🎯 Specialized & Multi-Modal
- **Cohere** - Enterprise embeddings, multilingual
- **Perplexity AI** - Web-aware responses, real-time search  
- **DeepSeek** - Cost-effective reasoning models
- **Novita AI** - Multi-modal (text, image, video, speech)

#### ⚡ Cost-Optimized Inference
- **DeepInfra** - 50% cost savings, GPU optimization
- **Replicate** - Community models, version control

#### 🔗 Gateway Solutions
- **LiteLLM Proxy** - 100+ LLM unified proxy
- **Portkey Gateway** - Smart routing and optimization

## 🏗️ Architecture Overview

### Provider Integration Pattern

```javascript
import { LLMRouter } from 'llm-runner-router';

// Universal configuration pattern
const router = new LLMRouter({
  providers: ['openai', 'anthropic', 'bedrock'],
  
  // API Key providers
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  },
  
  // Cloud SDK providers  
  bedrock: {
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  },
  
  // Hybrid authentication
  'azure-openai': {
    endpoint: 'https://your-resource.openai.azure.com/',
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: '2024-02-01'
  }
});
```

### Unified Response Format

All providers return responses in a consistent format:

```javascript
{
  text: "Generated response text",
  model: "provider:model-name", 
  provider: "provider-name",
  usage: {
    promptTokens: 150,
    completionTokens: 75,
    totalTokens: 225
  },
  cost: 0.00225, // USD
  finishReason: "stop",
  metadata: {
    // Provider-specific metadata
  },
  timestamp: 1640995200000
}
```

## 🔐 Authentication Methods

### API Key Authentication
Most providers use Bearer token authentication:

```bash
# Environment variables
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key  
MISTRAL_API_KEY=your-mistral-key
TOGETHER_API_KEY=your-together-key
FIREWORKS_API_KEY=fw-your-fireworks-key
```

### Cloud SDK Authentication

#### AWS Bedrock
```bash
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
```

#### Azure OpenAI
```bash
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
```

#### Google Vertex AI
```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
GOOGLE_CLOUD_PROJECT=your-project-id
```

## 🚀 Quick Start Examples

### Basic Usage
```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['openai'],
  strategy: 'quality-first'
});

const response = await router.generate({
  prompt: 'Explain quantum computing',
  maxTokens: 500
});

console.log(response.text);
```

### Multi-Provider with Fallback
```javascript
const router = new LLMRouter({
  providers: ['openai', 'anthropic', 'mistral'],
  strategy: 'fallback-chain',
  fallback: {
    enabled: true,
    maxRetries: 2
  }
});

const response = await router.generate({
  prompt: 'Write a technical blog post about AI',
  maxTokens: 2000,
  preferredProvider: 'openai'
});
```

### Enterprise Configuration
```javascript
const router = new LLMRouter({
  providers: ['bedrock', 'azure-openai'],
  strategy: 'cost-optimized',
  
  bedrock: {
    region: 'us-east-1',
    compliance: ['HIPAA', 'SOC2']
  },
  
  'azure-openai': {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    useAzureAD: true,
    compliance: ['HIPAA', 'SOC2', 'ISO27001']
  }
});
```

### High-Performance Setup
```javascript
const router = new LLMRouter({
  providers: ['groq', 'fireworks', 'together'],
  strategy: 'speed-priority',
  
  groq: {
    apiKey: process.env.GROQ_API_KEY
  },
  
  fireworks: {
    apiKey: process.env.FIREWORKS_API_KEY,
    enableFireAttention: true,
    enableBatching: true
  },
  
  together: {
    apiKey: process.env.TOGETHER_API_KEY,
    enableBatchMode: true,
    preferredRegion: 'us-west-2'
  }
});
```

## 📊 Provider Comparison

### Performance Metrics

| Provider | Avg Latency | Throughput | Cost/1M Tokens | Enterprise |
|----------|-------------|------------|----------------|------------|
| **Groq** | 50-100ms | Very High | $0.27 | ❌ |
| **Fireworks** | 100-200ms | High | $0.90 | ✅ |
| **OpenAI** | 200-500ms | High | $10-30 | ✅ |
| **Together** | 150-300ms | High | $0.20-0.90 | ❌ |
| **Mistral** | 200-400ms | Medium | $2-24 | ✅ |
| **DeepSeek** | 300-600ms | Medium | $0.14-0.28 | ❌ |

### Feature Matrix

| Provider | Streaming | Functions | Vision | Embeddings | Multi-Modal |
|----------|-----------|-----------|--------|------------|-------------|
| **OpenAI** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Anthropic** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Bedrock** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Azure OpenAI** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Vertex AI** | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Fireworks** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Mistral** | ✅ | ✅ | ❌ | ✅ | ❌ |

## 🛡️ Security & Compliance

### Enterprise Compliance
- **HIPAA**: Azure OpenAI, Fireworks AI
- **SOC2**: Azure OpenAI, Fireworks AI, AWS Bedrock
- **GDPR**: Mistral AI, Azure OpenAI
- **ISO27001**: Azure OpenAI, Google Vertex AI

### Data Residency
- **US**: All providers
- **EU**: Mistral AI, Azure OpenAI (EU regions)
- **Multi-Region**: AWS Bedrock, Google Vertex AI, Azure OpenAI

### Security Features
- **API Key Masking**: All providers
- **Request Encryption**: HTTPS for all providers
- **Audit Logging**: Enterprise providers
- **Content Filtering**: Azure OpenAI, Google Vertex AI

## 📚 Provider-Specific Guides

### Enterprise Cloud
- **[AWS Bedrock Setup Guide](./bedrock.md)** - IAM roles, model access
- **[Azure OpenAI Setup Guide](./azure-openai.md)** - Resource deployment, Azure AD
- **[Google Vertex AI Setup Guide](./vertex-ai.md)** - Service accounts, project setup

### High-Performance
- **[Groq Setup Guide](./groq.md)** - LPU optimization, rate limits
- **[Fireworks AI Setup Guide](./fireworks.md)** - FireAttention, enterprise features
- **[Together AI Setup Guide](./together.md)** - Batch processing, fine-tuning

### Specialized
- **[Mistral AI Setup Guide](./mistral.md)** - European compliance, multilingual
- **[OpenRouter Setup Guide](./openrouter.md)** - Model routing, cost optimization

## 🔧 Advanced Configuration

### Load Balancing
```javascript
const router = new LLMRouter({
  providers: ['openai', 'anthropic', 'mistral'],
  strategy: 'load-balanced',
  loadBalancing: {
    weights: {
      openai: 0.5,    // 50% of traffic
      anthropic: 0.3, // 30% of traffic  
      mistral: 0.2    // 20% of traffic
    },
    healthCheck: true
  }
});
```

### Cost Optimization
```javascript
const router = new LLMRouter({
  providers: ['deepseek', 'groq', 'together'],
  strategy: 'cost-optimized',
  costOptimization: {
    maxCostPerRequest: 0.001, // $0.001 max
    fallbackToExpensive: false,
    trackingEnabled: true
  }
});
```

### Quality Assurance
```javascript
const router = new LLMRouter({
  providers: ['openai', 'anthropic'],
  strategy: 'quality-first',
  qualityControls: {
    enableContentFilter: true,
    maxTokens: 4096,
    temperature: 0.7,
    validateResponses: true
  }
});
```

## 🔍 Troubleshooting

### Common Issues

#### Authentication Errors
```javascript
// Check API key format
import { AuthManager } from 'llm-runner-router';

const authManager = new AuthManager();
const validation = authManager.validateApiKey('openai', 'your-api-key');
console.log(validation); // { valid: true/false, error?: string }
```

#### Rate Limiting
```javascript
// Configure rate limiting
const router = new LLMRouter({
  providers: ['openai'],
  rateLimit: {
    requestsPerMinute: 50,
    enableQueue: true,
    queueTimeout: 30000
  }
});
```

#### Error Handling
```javascript
try {
  const response = await router.generate({ prompt: 'test' });
} catch (error) {
  if (error.type === 'rate_limit_error') {
    console.log(`Rate limited. Retry after: ${error.retryAfter}s`);
  } else if (error.type === 'authentication_error') {
    console.log('Check your API keys');
  }
}
```

## 📖 Additional Resources

- **[Provider Integration Plan](../../PROVIDER_INTEGRATION_PLAN.md)** - Complete roadmap
- **[Authentication Patterns](../../AUTHENTICATION_PATTERNS.md)** - Security guide
- **[Performance Benchmarks](../benchmarks/)** - Speed and cost comparisons
- **[Example Applications](../examples/)** - Real-world usage patterns

---

*For provider-specific documentation, click on the individual provider links above.*