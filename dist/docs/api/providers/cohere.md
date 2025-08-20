# 🧠 Cohere Provider Documentation

*Complete guide to using Cohere with LLM-Runner-Router*

## What is Cohere?

Cohere is an enterprise AI platform that specializes in large language models for business applications. They provide powerful text generation, embeddings, classification, and reranking capabilities with a focus on enterprise use cases, multilingual support, and production-ready APIs.

**Key Strengths:**
- Enterprise-focused AI solutions with robust APIs
- Excellent multilingual capabilities (100+ languages)
- Best-in-class embedding and reranking models
- Strong text classification and summarization
- Production-ready with enterprise SLAs

## Quick Start

### Basic Setup

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['cohere'],
  cohere: {
    apiKey: process.env.COHERE_API_KEY
  }
});

const response = await router.generate({
  model: 'command-r-plus',
  prompt: 'Explain the benefits of enterprise AI solutions',
  maxTokens: 500
});

console.log(response.text);
```

### Environment Setup

```bash
# Set your Cohere API key
export COHERE_API_KEY=your-cohere-api-key-here
```

## Configuration

### Environment Variables

```bash
# Required
COHERE_API_KEY=your-cohere-api-key

# Optional
COHERE_BASE_URL=https://api.cohere.ai/v1  # Default
COHERE_DEFAULT_MODEL=command-r-plus       # Default model
```

### Configuration Options

```javascript
const cohereConfig = {
  // Required
  apiKey: process.env.COHERE_API_KEY,
  
  // Optional
  baseURL: 'https://api.cohere.ai/v1',               // Default endpoint
  
  // Request configuration
  timeout: 30000,                                   // Request timeout
  maxRetries: 3,                                    // Retry attempts
  
  // Default parameters
  defaultParams: {
    temperature: 0.75,
    maxTokens: 1000,
    k: 0,                                          // Top-k sampling (0 = disabled)
    p: 0.75,                                       // Top-p sampling
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    stopSequences: [],
    returnLikelihoods: 'NONE'                      // 'NONE', 'GENERATION', 'ALL'
  },
  
  // Rate limiting
  rateLimiting: {
    requestsPerMinute: 100,                        // Trial tier limit
    requestsPerSecond: 10                          // Burst limit
  },
  
  // Enterprise features
  enterprise: {
    enableDataResidency: false,                    // EU/US data residency
    enableAuditLogging: false,                     // Enhanced audit logs
    enableContentFiltering: true,                  // Content safety filters
    enablePIIDetection: false                      // PII detection and masking
  },
  
  // Multilingual settings
  multilingual: {
    defaultLanguage: 'en',                         // Default language
    autoDetectLanguage: true,                      // Auto-detect input language
    preferredLanguages: ['en', 'es', 'fr', 'de']  // Preferred languages
  }
};
```

## Available Models

### Command Models (Chat & Text Generation)

```javascript
// Command R+ (Most capable, 128k context)
model: 'command-r-plus'

// Command R (Balanced performance, 128k context)
model: 'command-r'

// Command (Legacy, high quality)
model: 'command'

// Command Light (Fast and efficient)
model: 'command-light'

// Command Nightly (Latest experimental features)
model: 'command-nightly'
```

### Embedding Models

```javascript
// Embed English v3 (Best for English)
model: 'embed-english-v3.0'

// Embed Multilingual v3 (100+ languages)
model: 'embed-multilingual-v3.0'

// Embed English Light v3 (Faster, smaller)
model: 'embed-english-light-v3.0'

// Embed Multilingual Light v3 (Faster multilingual)
model: 'embed-multilingual-light-v3.0'

// Legacy embedding models
model: 'embed-english-v2.0'
model: 'embed-multilingual-v2.0'
```

### Rerank Models

```javascript
// Rerank English v3 (Best for English)
model: 'rerank-english-v3.0'

// Rerank Multilingual v3 (100+ languages)
model: 'rerank-multilingual-v3.0'

// Rerank English v2 (Legacy)
model: 'rerank-english-v2.0'

// Rerank Multilingual v2 (Legacy)
model: 'rerank-multilingual-v2.0'
```

## Code Examples

### Simple Text Generation

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['cohere'],
  cohere: {
    apiKey: process.env.COHERE_API_KEY
  }
});

async function generateText() {
  const response = await router.generate({
    model: 'command-r-plus',
    prompt: 'Write a professional email about implementing AI solutions in enterprise environments',
    maxTokens: 400,
    temperature: 0.7
  });

  console.log('Generated text:', response.text);
  console.log('Cost:', `$${response.cost.toFixed(4)}`);
  console.log('Tokens used:', response.usage.totalTokens);
}

generateText();
```

### Chat Conversation

```javascript
async function chatWithCohere() {
  const response = await router.chat({
    model: 'command-r-plus',
    messages: [
      { role: 'system', content: 'You are a helpful AI assistant specialized in business and enterprise solutions.' },
      { role: 'user', content: 'What are the key considerations when implementing AI in a large enterprise?' }
    ],
    maxTokens: 600,
    temperature: 0.6
  });

  console.log('Cohere response:', response.text);
}

chatWithCohere();
```

### RAG with Command R+

```javascript
async function ragExample() {
  // Documents to search through
  const documents = [
    'Artificial Intelligence is transforming business operations across industries.',
    'Machine learning models require high-quality training data for optimal performance.',
    'Enterprise AI implementations must consider data privacy and security.',
    'Natural language processing enables better customer service automation.',
    'Computer vision applications are revolutionizing manufacturing quality control.'
  ];

  const response = await router.chat({
    model: 'command-r-plus',
    messages: [
      { role: 'user', content: 'How is AI transforming business operations?' }
    ],
    documents: documents,  // Cohere will use these for RAG
    maxTokens: 300,
    temperature: 0.5
  });

  console.log('RAG response:', response.text);
  
  if (response.citations) {
    console.log('Citations:', response.citations);
  }
}

ragExample();
```

### Streaming Response

```javascript
async function streamGeneration() {
  console.log('Cohere streaming response...\n');

  for await (const chunk of router.stream({
    model: 'command-r',
    prompt: 'Explain the Cohere platform and its enterprise AI capabilities in detail',
    maxTokens: 800,
    temperature: 0.7
  })) {
    process.stdout.write(chunk.text);
  }
}

streamGeneration();
```

### Text Embeddings

```javascript
async function generateEmbeddings() {
  const texts = [
    'Enterprise AI solutions for business automation',
    'Natural language processing for customer service',
    'Machine learning models for predictive analytics',
    'Computer vision for quality control',
    'AI-powered business intelligence and insights'
  ];

  console.log('Generating embeddings with Cohere...\n');

  for (const text of texts) {
    const response = await router.embed({
      model: 'embed-english-v3.0',
      texts: [text],  // Cohere accepts multiple texts
      inputType: 'search_document'  // 'search_document', 'search_query', 'classification', 'clustering'
    });

    console.log(`Text: "${text}"`);
    console.log(`Embedding dimensions: ${response.embeddings[0].length}`);
    console.log(`Cost: $${response.cost.toFixed(6)}\n`);
  }
}

generateEmbeddings();
```

### Multilingual Embeddings

```javascript
async function multilingualEmbeddings() {
  const texts = [
    { lang: 'English', text: 'Artificial intelligence is transforming business' },
    { lang: 'Spanish', text: 'La inteligencia artificial está transformando los negocios' },
    { lang: 'French', text: 'L\'intelligence artificielle transforme les entreprises' },
    { lang: 'German', text: 'Künstliche Intelligenz verändert die Geschäftswelt' },
    { lang: 'Portuguese', text: 'A inteligência artificial está transformando os negócios' }
  ];

  console.log('Multilingual embeddings with Cohere...\n');

  const allTexts = texts.map(t => t.text);
  
  const response = await router.embed({
    model: 'embed-multilingual-v3.0',
    texts: allTexts,
    inputType: 'search_document'
  });

  texts.forEach((item, index) => {
    console.log(`${item.lang}: "${item.text}"`);
    console.log(`Embedding dimensions: ${response.embeddings[index].length}\n`);
  });

  console.log(`Total cost: $${response.cost.toFixed(6)}`);
}

multilingualEmbeddings();
```

### Document Reranking

```javascript
async function rerankDocuments() {
  const query = 'How to implement AI in enterprise environments';
  const documents = [
    'AI implementation requires careful planning and stakeholder buy-in',
    'Machine learning models need extensive training data',
    'Enterprise AI projects should start with clear business objectives',
    'Data privacy and security are crucial for enterprise AI',
    'AI governance frameworks help manage enterprise AI initiatives',
    'Cloud infrastructure supports scalable AI deployments'
  ];

  console.log('Reranking documents with Cohere...\n');

  const response = await router.rerank({
    model: 'rerank-english-v3.0',
    query: query,
    documents: documents,
    topN: 3,  // Return top 3 most relevant
    returnDocuments: true
  });

  console.log(`Query: "${query}"\n`);
  console.log('Top ranked documents:');
  
  response.results.forEach((result, index) => {
    console.log(`${index + 1}. (Score: ${result.relevanceScore.toFixed(3)}) ${result.document.text}`);
  });

  console.log(`\nCost: $${response.cost.toFixed(6)}`);
}

rerankDocuments();
```

### Text Classification

```javascript
async function classifyText() {
  const texts = [
    'I love this product, it works perfectly!',
    'This service is terrible, I want a refund',
    'The delivery was on time and packaging was good',
    'Customer support was very helpful and responsive',
    'The app crashes frequently and is hard to use'
  ];

  const examples = [
    { text: 'Great product, highly recommend!', label: 'positive' },
    { text: 'Excellent customer service', label: 'positive' },
    { text: 'Poor quality, not worth it', label: 'negative' },
    { text: 'Disappointed with the purchase', label: 'negative' },
    { text: 'Good value for money', label: 'positive' },
    { text: 'Too expensive for what you get', label: 'negative' }
  ];

  console.log('Text classification with Cohere...\n');

  for (const text of texts) {
    const response = await router.classify({
      model: 'command',  // Use Command model for classification
      inputs: [text],
      examples: examples
    });

    const prediction = response.classifications[0];
    const confidence = Math.max(...prediction.confidences.map(c => c.confidence));
    
    console.log(`Text: "${text}"`);
    console.log(`Sentiment: ${prediction.prediction} (${(confidence * 100).toFixed(1)}% confidence)\n`);
  }
}

classifyText();
```

### Summarization

```javascript
async function summarizeText() {
  const longText = `
  Artificial Intelligence (AI) is rapidly transforming the business landscape across industries. 
  Companies are implementing AI solutions to automate processes, enhance customer experiences, 
  and gain competitive advantages. Machine learning algorithms are being used for predictive 
  analytics, helping businesses forecast trends and make data-driven decisions. Natural language 
  processing is revolutionizing customer service through chatbots and automated support systems. 
  Computer vision technologies are improving quality control in manufacturing and enabling 
  autonomous systems. However, implementing AI in enterprise environments requires careful 
  consideration of data privacy, security, and ethical implications. Organizations must also 
  invest in talent development and change management to successfully adopt AI technologies. 
  The future of business will be increasingly dependent on AI capabilities, making it essential 
  for companies to develop comprehensive AI strategies.
  `;

  const response = await router.summarize({
    model: 'command-r',
    text: longText,
    length: 'medium',  // 'short', 'medium', 'long'
    format: 'paragraph',  // 'paragraph', 'bullets'
    temperature: 0.3
  });

  console.log('Original text length:', longText.length);
  console.log('Summary:', response.summary);
  console.log('Summary length:', response.summary.length);
  console.log('Compression ratio:', ((1 - response.summary.length / longText.length) * 100).toFixed(1) + '%');
}

summarizeText();
```

## Best Practices

### 1. Model Selection Strategy

```javascript
const cohereModelStrategy = {
  // Maximum capability for complex tasks
  premium: 'command-r-plus',
  
  // Balanced performance for most tasks
  balanced: 'command-r',
  
  // Fast responses for simple tasks
  fast: 'command-light',
  
  // Experimental features
  experimental: 'command-nightly',
  
  // Embeddings by use case
  embeddings: {
    english: 'embed-english-v3.0',
    multilingual: 'embed-multilingual-v3.0',
    fast_english: 'embed-english-light-v3.0',
    fast_multilingual: 'embed-multilingual-light-v3.0'
  },
  
  // Reranking by use case
  reranking: {
    english: 'rerank-english-v3.0',
    multilingual: 'rerank-multilingual-v3.0'
  }
};
```

### 2. Enterprise Configuration

```javascript
const enterpriseRouter = new LLMRouter({
  providers: ['cohere'],
  cohere: {
    apiKey: process.env.COHERE_API_KEY,
    enterprise: {
      enableDataResidency: true,        // EU/US data residency
      enableAuditLogging: true,         // Comprehensive audit logs
      enableContentFiltering: true,     // Content safety
      enablePIIDetection: true,         // PII detection and masking
      complianceMode: 'enterprise'      // Enterprise compliance settings
    },
    security: {
      enableEncryption: true,           // End-to-end encryption
      enableAccessLogging: true,        // Access audit trails
      dataRetentionDays: 30,           // Short retention period
      enableAnonymization: true         // Data anonymization
    }
  }
});
```

### 3. Multilingual Optimization

```javascript
// Configure for multilingual applications
const multilingualRouter = new LLMRouter({
  providers: ['cohere'],
  cohere: {
    apiKey: process.env.COHERE_API_KEY,
    multilingual: {
      defaultLanguage: 'en',
      autoDetectLanguage: true,
      preferredLanguages: ['en', 'es', 'fr', 'de', 'pt', 'it'],
      fallbackToEnglish: true,          // Fallback if language not supported
      enableTranslation: false          // Don't auto-translate
    },
    models: {
      // Use multilingual models by default
      default: 'command-r',             // Good multilingual support
      embeddings: 'embed-multilingual-v3.0',
      reranking: 'rerank-multilingual-v3.0'
    }
  }
});
```

### 4. Error Handling

```javascript
async function robustCohereCall() {
  const maxRetries = 3;
  const baseDelay = 1000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await router.generate({
        model: 'command-r-plus',
        prompt: 'Your prompt here',
        maxTokens: 500
      });
      
      return response;
    } catch (error) {
      console.log(`Attempt ${attempt + 1} failed:`, error.message);
      
      switch (error.type) {
        case 'rate_limit_exceeded':
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Rate limited, waiting ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
          
        case 'invalid_api_key':
          console.error('Invalid Cohere API key');
          throw error; // Don't retry auth errors
          
        case 'model_not_available':
          console.log('Model unavailable, trying fallback...');
          return await router.generate({
            model: 'command-r',  // Fallback model
            prompt: 'Your prompt here',
            maxTokens: 500
          });
          
        case 'content_filtered':
          console.warn('Content was filtered');
          return { text: 'Content filtered for safety reasons' };
          
        case 'context_length_exceeded':
          console.log('Prompt too long, truncating...');
          // Implement prompt truncation logic
          break;
          
        default:
          if (attempt === maxRetries - 1) {
            throw error;
          }
          continue;
      }
    }
  }
}
```

### 5. Cost Optimization

```javascript
// Optimize for cost efficiency
const costOptimizedRouter = new LLMRouter({
  providers: ['cohere'],
  strategy: 'cost-optimized',
  cohere: {
    apiKey: process.env.COHERE_API_KEY,
    costOptimization: {
      // Use light models for simple tasks
      preferredModels: [
        'command-light',              // Cheapest text generation
        'embed-english-light-v3.0',   // Cheaper embeddings
        'command-r',                  // Medium cost, good performance
        'command-r-plus'              // Only for complex tasks
      ],
      
      // Optimize embeddings
      batchEmbeddings: true,          // Batch multiple texts
      maxTextsPerBatch: 96,           // Cohere's batch limit
      
      // Optimize reranking
      rerankTopN: 5,                  // Limit rerank results
      
      // General optimization
      maxTokensLimit: 1000,           // Limit token usage
      enableCaching: true,            // Cache responses
      maxCostPerRequest: 0.01         // Cost limit per request
    }
  }
});
```

## Troubleshooting

### Common Issues

#### Issue: "Invalid API key"
```
Error: The API key is invalid or has been revoked.
```

**Solution**: Verify your API key and check permissions:
```javascript
// Test API key validity
async function testApiKey() {
  try {
    const response = await router.generate({
      model: 'command-light',
      prompt: 'Hello',
      maxTokens: 5
    });
    console.log('API key is valid');
  } catch (error) {
    console.error('API key test failed:', error.message);
  }
}
```

#### Issue: "Rate limit exceeded"
```
Error: Rate limit exceeded. Please try again later.
```

**Solution**: Check your rate limits and implement backoff:
```javascript
// Cohere rate limits by tier
const rateLimits = {
  trial: { rpm: 100, rps: 10 },
  production: { rpm: 10000, rps: 100 },
  enterprise: { rpm: 'custom', rps: 'custom' }
};

// Check current usage
const usage = await router.getUsage();
console.log('Current usage:', usage);
```

#### Issue: "Model not found"
```
Error: Model 'invalid-model' is not available.
```

**Solution**: Use correct Cohere model names:
```javascript
// Valid Cohere models
const validModels = {
  generation: ['command-r-plus', 'command-r', 'command', 'command-light'],
  embeddings: ['embed-english-v3.0', 'embed-multilingual-v3.0'],
  reranking: ['rerank-english-v3.0', 'rerank-multilingual-v3.0']
};
```

#### Issue: "Context length exceeded"
```
Error: Input text exceeds maximum context length.
```

**Solution**: Check context limits and implement truncation:
```javascript
const contextLimits = {
  'command-r-plus': 128000,
  'command-r': 128000,
  'command': 4096,
  'command-light': 4096
};

function truncateText(text, model, maxTokens) {
  const limit = contextLimits[model] || 4096;
  const maxPromptTokens = limit - maxTokens - 100; // Safety margin
  
  if (text.length > maxPromptTokens * 4) { // Rough token estimate
    return text.slice(0, maxPromptTokens * 4) + '...';
  }
  
  return text;
}
```

### Debug Mode

```javascript
const router = new LLMRouter({
  providers: ['cohere'],
  debug: true,
  cohere: {
    apiKey: process.env.COHERE_API_KEY,
    logLevel: 'DEBUG',
    logRequests: true,
    logResponses: false,
    logCitations: true,      // Log RAG citations
    logMultilingual: true    // Log language detection
  }
});
```

## Pricing Information

### Text Generation Models (per 1M tokens)
- **Command R+**: Input $3.00, Output $15.00
- **Command R**: Input $0.50, Output $1.50
- **Command**: Input $1.00, Output $2.00
- **Command Light**: Input $0.30, Output $0.60

### Embedding Models (per 1M tokens)
- **Embed English v3**: $0.10
- **Embed Multilingual v3**: $0.10
- **Embed English Light v3**: $0.10
- **Embed Multilingual Light v3**: $0.10

### Rerank Models (per 1K searches)
- **Rerank English v3**: $2.00
- **Rerank Multilingual v3**: $2.00

### Additional Features
- **Fine-tuning**: Custom pricing
- **Enterprise Features**: Custom pricing
- **Dedicated Deployments**: Custom pricing

*Cohere offers enterprise discounts for high-volume usage. Check Cohere pricing for current rates.*

## Resources

- **Cohere Platform**: [cohere.com](https://cohere.com)
- **API Documentation**: [docs.cohere.com](https://docs.cohere.com)
- **Dashboard**: [dashboard.cohere.com](https://dashboard.cohere.com)
- **Playground**: [dashboard.cohere.com/playground](https://dashboard.cohere.com/playground)
- **Discord Community**: [discord.gg/co-mmunity](https://discord.gg/co-mmunity)
- **Enterprise Solutions**: [cohere.com/enterprise](https://cohere.com/enterprise)

---

*Built with 💚 by Echo AI Systems*