# 🇫🇷 Mistral AI Provider Documentation

*Complete guide to using Mistral AI with LLM-Runner-Router*

## What is Mistral AI?

Mistral AI is a French AI company providing high-performance, efficient language models with a focus on European data sovereignty. Their models offer excellent performance-to-cost ratios and support for multiple languages with European data residency options.

**Key Strengths:**
- European data residency and GDPR compliance
- Excellent performance-to-cost ratio
- Strong multilingual capabilities
- Open-source friendly approach
- Function calling and JSON mode support

## Quick Start

### Basic Setup

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['mistral'],
  mistral: {
    apiKey: process.env.MISTRAL_API_KEY
  }
});

const response = await router.generate({
  model: 'mistral-large-latest',
  prompt: 'Explain quantum computing in French',
  maxTokens: 500
});

console.log(response.text);
```

### Environment Setup

```bash
# Set your Mistral API key
export MISTRAL_API_KEY=your-mistral-api-key-here
```

## Configuration

### Environment Variables

```bash
# Required
MISTRAL_API_KEY=your-mistral-api-key

# Optional
MISTRAL_BASE_URL=https://api.mistral.ai/v1  # Default
MISTRAL_DEFAULT_MODEL=mistral-large-latest   # Default model
```

### Configuration Options

```javascript
const mistralConfig = {
  // Required
  apiKey: process.env.MISTRAL_API_KEY,
  
  // Optional
  baseURL: 'https://api.mistral.ai/v1',        // Default endpoint
  
  // Request configuration
  timeout: 30000,                              // Request timeout
  maxRetries: 3,                               // Retry attempts
  
  // Default parameters
  defaultParams: {
    temperature: 0.7,
    maxTokens: 1000,
    topP: 1.0,
    safePrompt: false                          // Mistral content filtering
  },
  
  // Rate limiting
  rateLimiting: {
    requestsPerSecond: 5,                      // API limit
    requestsPerMinute: 100                     // API limit
  }
};
```

## Available Models

### Production Models

```javascript
// Mistral Large (Most capable)
model: 'mistral-large-latest'
model: 'mistral-large-2402'

// Mistral Medium (Balanced performance)  
model: 'mistral-medium-latest'
model: 'mistral-medium-2312'

// Mistral Small (Cost-effective)
model: 'mistral-small-latest'
model: 'mistral-small-2402'

// Mistral Tiny (Ultra-fast)
model: 'mistral-tiny'
```

### Open Source Models

```javascript
// Mixtral 8x7B (Open source, best value)
model: 'open-mixtral-8x7b'

// Mistral 7B (Open source, efficient)
model: 'open-mistral-7b'

// Mistral Nemo (Latest open source)
model: 'open-mistral-nemo'
```

### Specialized Models

```javascript
// Code generation
model: 'codestral-latest'
model: 'codestral-2405'

// Embeddings
model: 'mistral-embed'

// Fine-tuned models (when available)
model: 'mistral-large-instruct'
```

## Code Examples

### Simple Text Generation

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['mistral'],
  mistral: {
    apiKey: process.env.MISTRAL_API_KEY
  }
});

async function generateText() {
  const response = await router.generate({
    model: 'mistral-large-latest',
    prompt: 'Write a technical explanation of microservices architecture',
    maxTokens: 600,
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
async function chatWithMistral() {
  const messages = [
    { role: 'system', content: 'You are a helpful AI assistant specialized in European business practices.' },
    { role: 'user', content: 'What are the key GDPR compliance requirements for AI systems?' }
  ];

  const response = await router.chat({
    model: 'mistral-large-latest',
    messages,
    maxTokens: 800,
    temperature: 0.6
  });

  console.log('Mistral response:', response.text);
}

chatWithMistral();
```

### Streaming Response

```javascript
async function streamGeneration() {
  console.log('Mistral is generating response...\n');

  for await (const chunk of router.stream({
    model: 'mistral-medium-latest',
    prompt: 'Explain the French approach to AI regulation and digital sovereignty',
    maxTokens: 800,
    temperature: 0.7
  })) {
    process.stdout.write(chunk.text);
  }
}

streamGeneration();
```

### Function Calling

```javascript
async function functionCallingExample() {
  const tools = [
    {
      type: 'function',
      function: {
        name: 'get_current_weather',
        description: 'Get the current weather in a given location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and state, e.g. San Francisco, CA'
            },
            unit: {
              type: 'string',
              enum: ['celsius', 'fahrenheit']
            }
          },
          required: ['location']
        }
      }
    }
  ];

  const response = await router.chat({
    model: 'mistral-large-latest',
    messages: [
      { role: 'user', content: 'What\'s the weather like in Paris?' }
    ],
    tools,
    toolChoice: 'auto',
    maxTokens: 500
  });

  if (response.toolCalls) {
    console.log('Function calls:', response.toolCalls);
  }
  
  console.log('Response:', response.text);
}

functionCallingExample();
```

### JSON Mode

```javascript
async function jsonModeExample() {
  const response = await router.chat({
    model: 'mistral-large-latest',
    messages: [
      {
        role: 'user',
        content: 'Extract the key information from this text and return it as JSON: "The conference will be held in Paris on March 15, 2024, from 9 AM to 5 PM. The topic is AI Ethics and the speaker is Dr. Marie Dubois."'
      }
    ],
    responseFormat: { type: 'json_object' },
    maxTokens: 200
  });

  console.log('JSON response:', response.text);
  
  try {
    const parsed = JSON.parse(response.text);
    console.log('Parsed JSON:', parsed);
  } catch (e) {
    console.error('Failed to parse JSON:', e);
  }
}

jsonModeExample();
```

### Code Generation with Codestral

```javascript
async function generateCode() {
  const response = await router.generate({
    model: 'codestral-latest',
    prompt: `
Write a Python class that:
1. Manages a connection pool to PostgreSQL
2. Implements async methods for CRUD operations
3. Uses proper error handling and logging
4. Follows French naming conventions where appropriate

Include type hints and documentation.
`,
    maxTokens: 800,
    temperature: 0.2  // Lower temperature for code generation
  });

  console.log('Generated code:', response.text);
}

generateCode();
```

### Multilingual Capabilities

```javascript
async function multilingualExample() {
  const languages = [
    { lang: 'French', prompt: 'Expliquez les avantages du cloud computing' },
    { lang: 'German', prompt: 'Erklären Sie die Vorteile von Künstlicher Intelligenz' },
    { lang: 'Spanish', prompt: 'Explique los beneficios de la automatización' },
    { lang: 'Italian', prompt: 'Spiega i vantaggi della cybersecurity' }
  ];

  for (const { lang, prompt } of languages) {
    console.log(`\n--- ${lang} Response ---`);
    
    const response = await router.generate({
      model: 'mistral-large-latest',
      prompt,
      maxTokens: 200,
      temperature: 0.7
    });

    console.log(response.text);
    console.log(`Cost: $${response.cost.toFixed(4)}`);
  }
}

multilingualExample();
```

### Text Embeddings

```javascript
async function generateEmbeddings() {
  const texts = [
    'Mistral AI provides European data sovereignty',
    'L\'intelligence artificielle transforme les entreprises',
    'GDPR compliance is essential for AI systems'
  ];

  for (const text of texts) {
    const response = await router.embed({
      model: 'mistral-embed',
      input: text
    });

    console.log(`Text: "${text}"`);
    console.log(`Embedding dimensions: ${response.embedding.length}`);
    console.log(`Cost: $${response.cost.toFixed(6)}\n`);
  }
}

generateEmbeddings();
```

## Best Practices

### 1. Model Selection Strategy

```javascript
const modelStrategy = {
  // Complex reasoning and analysis
  complex: 'mistral-large-latest',
  
  // Balanced performance for most tasks
  general: 'mistral-medium-latest',
  
  // Cost-effective for simple tasks
  simple: 'mistral-small-latest',
  
  // Ultra-fast responses
  fast: 'mistral-tiny',
  
  // Code generation
  coding: 'codestral-latest',
  
  // Open source alternative
  opensource: 'open-mixtral-8x7b',
  
  // Embeddings
  embedding: 'mistral-embed'
};
```

### 2. European Data Compliance

```javascript
// For GDPR-sensitive applications
const gdprCompliantRouter = new LLMRouter({
  providers: ['mistral'],
  mistral: {
    apiKey: process.env.MISTRAL_API_KEY,
    dataProcessingRegion: 'eu',  // European data processing
    gdprCompliance: true,
    logRetention: '30d',         // Short retention period
    dataMinimization: true       // Minimize data collection
  }
});
```

### 3. Cost Optimization

```javascript
// Use cost-effective models for appropriate tasks
const costOptimizedRouter = new LLMRouter({
  providers: ['mistral'],
  strategy: 'cost-optimized',
  mistral: {
    apiKey: process.env.MISTRAL_API_KEY,
    preferredModels: [
      'mistral-small-latest',    // Most cost-effective
      'open-mixtral-8x7b',       // Open source option
      'mistral-medium-latest',   // Balanced option
      'mistral-large-latest'     // Only for complex tasks
    ],
    maxCostPerRequest: 0.01      // Cost limit
  }
});
```

### 4. Content Safety

```javascript
async function safeGeneration() {
  const response = await router.generate({
    model: 'mistral-large-latest',
    prompt: 'Your prompt here',
    safePrompt: true,  // Enable Mistral's content filtering
    maxTokens: 500
  });

  // Mistral has built-in safety features
  return response;
}
```

### 5. Error Handling

```javascript
async function robustMistralCall() {
  try {
    const response = await router.generate({
      model: 'mistral-large-latest',
      prompt: 'Your prompt here',
      maxTokens: 500
    });
    
    return response;
  } catch (error) {
    switch (error.type) {
      case 'invalid_api_key':
        console.error('Invalid Mistral API key');
        // Handle authentication error
        break;
        
      case 'rate_limit_exceeded':
        console.warn('Rate limit exceeded, waiting...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return robustMistralCall(); // Retry
        
      case 'model_not_found':
        console.error('Model not available, trying alternative...');
        // Try fallback model
        return await router.generate({
          model: 'mistral-medium-latest',
          prompt: 'Your prompt here',
          maxTokens: 500
        });
        
      case 'content_filter':
        console.warn('Content filtered by safety system');
        return { text: 'Content filtered for safety reasons' };
        
      default:
        console.error('Mistral API error:', error);
        throw error;
    }
  }
}
```

## Troubleshooting

### Common Issues

#### Issue: "Invalid API key"
```
Error: Authentication failed. Invalid API key.
```

**Solution**: Verify your API key format and permissions:
```javascript
// Mistral API keys typically start with specific prefixes
const isValidKey = (key) => {
  return key && typeof key === 'string' && key.length > 20;
};
```

#### Issue: "Model not available"
```
Error: Model 'mistral-ultra' is not available.
```

**Solution**: Check model availability and use correct model names:
```javascript
const availableModels = [
  'mistral-large-latest',
  'mistral-medium-latest', 
  'mistral-small-latest',
  'mistral-tiny',
  'open-mixtral-8x7b',
  'open-mistral-7b',
  'codestral-latest',
  'mistral-embed'
];
```

#### Issue: "Rate limit exceeded"
```
Error: Rate limit exceeded. Please try again later.
```

**Solution**: Implement proper rate limiting:
```javascript
// Mistral rate limits (as of 2024)
const rateLimits = {
  'mistral-large-latest': { rps: 5, rpm: 100 },
  'mistral-medium-latest': { rps: 5, rpm: 100 },
  'mistral-small-latest': { rps: 5, rpm: 100 },
  'open-mixtral-8x7b': { rps: 5, rpm: 100 }
};
```

#### Issue: "Context length exceeded"
```
Error: Input too long for model context window.
```

**Solution**: Check model context limits:
```javascript
const contextLimits = {
  'mistral-large-latest': 32000,
  'mistral-medium-latest': 32000,
  'mistral-small-latest': 32000,
  'mistral-tiny': 32000,
  'open-mixtral-8x7b': 32000,
  'codestral-latest': 32000
};
```

### Debug Mode

```javascript
const router = new LLMRouter({
  providers: ['mistral'],
  debug: true,  // Enable debug logging
  mistral: {
    apiKey: process.env.MISTRAL_API_KEY,
    logLevel: 'DEBUG',
    logRequests: true,
    logResponses: false  // Don't log response content
  }
});
```

## Pricing Information

### Commercial Models (per 1M tokens)
- **Mistral Large**: Input $8.00, Output $24.00
- **Mistral Medium**: Input $2.70, Output $8.10
- **Mistral Small**: Input $1.00, Output $3.00
- **Mistral Tiny**: Input $0.25, Output $0.25

### Open Source Models (per 1M tokens)
- **Mixtral 8x7B**: Input $0.70, Output $0.70
- **Mistral 7B**: Input $0.25, Output $0.25
- **Mistral Nemo**: Input $0.30, Output $0.30

### Specialized Models (per 1M tokens)
- **Codestral**: Input $1.00, Output $3.00
- **Mistral Embed**: $0.10 per 1M tokens

*Prices may vary based on region and usage volume. Check Mistral AI pricing for current rates.*

## Regional Considerations

### European Data Sovereignty

```javascript
// For EU-based applications requiring data residency
const euCompliantConfig = {
  apiKey: process.env.MISTRAL_API_KEY,
  region: 'eu-west-1',           // European region
  dataResidency: 'eu',           // Keep data in EU
  gdprCompliant: true,           // GDPR compliance mode
  privacyMode: 'strict'          // Enhanced privacy
};
```

### Multilingual Support

Mistral models excel at multilingual tasks, especially for European languages:

```javascript
const multilingualPrompt = `
Respond in the user's language:
User: "Bonjour, pouvez-vous m'aider avec la programmation?"
Assistant: [Respond in French]

User: "Hola, ¿puedes ayudarme con JavaScript?"
Assistant: [Respond in Spanish]
`;
```

## Resources

- **Mistral AI Website**: [mistral.ai](https://mistral.ai)
- **API Documentation**: [docs.mistral.ai](https://docs.mistral.ai)
- **Platform Dashboard**: [console.mistral.ai](https://console.mistral.ai)
- **Model Documentation**: [docs.mistral.ai/getting-started/models](https://docs.mistral.ai/getting-started/models)
- **GitHub**: [github.com/mistralai](https://github.com/mistralai)
- **Discord Community**: [discord.gg/mistralai](https://discord.gg/mistralai)

---

*Built with 💚 by Echo AI Systems*