# 🔷 Azure OpenAI Provider Documentation

*Complete guide to using Azure OpenAI Service with LLM-Runner-Router*

## What is Azure OpenAI?

Azure OpenAI Service provides REST API access to OpenAI's powerful language models including GPT-4, GPT-3.5-Turbo, DALL-E, Whisper, and embeddings models. Built specifically for enterprise use with enhanced security, compliance, and regional availability.

**Key Strengths:**
- Enterprise-grade security and compliance (SOC2, HIPAA, FedRAMP)
- Azure AD integration and managed identity support
- Content filtering and abuse monitoring
- Virtual network support and private endpoints
- 99.9% SLA with enterprise support

## Quick Start

### Basic Setup

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['azure-openai'],
  'azure-openai': {
    endpoint: 'https://your-resource.openai.azure.com/',
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: '2024-02-01'
  }
});

const response = await router.generate({
  model: 'gpt-4',  // Your deployment name
  prompt: 'Explain quantum computing',
  maxTokens: 500
});

console.log(response.text);
```

### With Azure AD Authentication

```javascript
import { DefaultAzureCredential } from '@azure/identity';

const router = new LLMRouter({
  providers: ['azure-openai'],
  'azure-openai': {
    endpoint: 'https://your-resource.openai.azure.com/',
    credentials: new DefaultAzureCredential(),
    apiVersion: '2024-02-01'
  }
});
```

## Configuration

### Environment Variables

```bash
# API Key Authentication
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-02-01

# Azure AD Authentication
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# Or use Managed Identity in Azure
AZURE_USE_MANAGED_IDENTITY=true
```

### Configuration Options

```javascript
const azureConfig = {
  // Required
  endpoint: 'https://your-resource.openai.azure.com/',
  apiVersion: '2024-02-01',
  
  // Authentication options (choose one)
  
  // Option 1: API Key
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  
  // Option 2: Azure AD Credential
  credentials: new DefaultAzureCredential(),
  
  // Option 3: Managed Identity
  useManagedIdentity: true,
  
  // Option 4: Service Principal
  credentials: new ClientSecretCredential(
    process.env.AZURE_TENANT_ID,
    process.env.AZURE_CLIENT_ID,
    process.env.AZURE_CLIENT_SECRET
  ),
  
  // Request configuration
  timeout: 30000,
  maxRetries: 3,
  
  // Azure-specific options
  deployments: {
    'gpt-4': 'your-gpt4-deployment-name',
    'gpt-35-turbo': 'your-gpt35-deployment-name',
    'text-embedding-ada-002': 'your-embedding-deployment'
  },
  
  // Content filtering
  contentFilterLevel: 'medium', // 'low', 'medium', 'high'
  
  // Rate limiting
  requestsPerMinute: 240,
  tokensPerMinute: 40000
};
```

## Available Models

### GPT Models

```javascript
// GPT-4 Turbo (128k context)
model: 'gpt-4-1106-preview'

// GPT-4 Turbo with Vision
model: 'gpt-4-vision-preview'

// GPT-4 (8k context)
model: 'gpt-4'

// GPT-4 (32k context)
model: 'gpt-4-32k'

// GPT-3.5 Turbo (16k context)
model: 'gpt-35-turbo-16k'

// GPT-3.5 Turbo (4k context)
model: 'gpt-35-turbo'

// GPT-3.5 Turbo Instruct
model: 'gpt-35-turbo-instruct'
```

### Embedding Models

```javascript
// Ada v2 Embeddings
model: 'text-embedding-ada-002'

// Small Embeddings (new)
model: 'text-embedding-3-small'

// Large Embeddings (new)
model: 'text-embedding-3-large'
```

### Other Models

```javascript
// DALL-E 3 (Image Generation)
model: 'dall-e-3'

// DALL-E 2 (Image Generation)
model: 'dall-e-2'

// Whisper (Speech to Text)
model: 'whisper-1'

// Text-to-Speech
model: 'tts-1'
model: 'tts-1-hd'
```

## Code Examples

### Simple Text Generation

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['azure-openai'],
  'azure-openai': {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: '2024-02-01'
  }
});

async function generateText() {
  const response = await router.generate({
    model: 'gpt-4',
    prompt: 'Write a professional email about project delays',
    maxTokens: 300,
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
async function chatConversation() {
  const messages = [
    { role: 'system', content: 'You are a helpful coding assistant.' },
    { role: 'user', content: 'How do I create a REST API in Python?' }
  ];

  const response = await router.chat({
    model: 'gpt-35-turbo',
    messages,
    maxTokens: 500,
    temperature: 0.3
  });

  console.log('Assistant:', response.text);
  
  // Continue conversation
  messages.push({ role: 'assistant', content: response.text });
  messages.push({ role: 'user', content: 'Can you show me a FastAPI example?' });

  const followUp = await router.chat({
    model: 'gpt-35-turbo',
    messages,
    maxTokens: 500
  });

  console.log('Follow-up:', followUp.text);
}

chatConversation();
```

### Streaming Response

```javascript
async function streamGeneration() {
  console.log('Azure AI is thinking...\n');

  for await (const chunk of router.stream({
    model: 'gpt-4',
    prompt: 'Explain the Azure cloud ecosystem and its key services',
    maxTokens: 800,
    temperature: 0.6
  })) {
    process.stdout.write(chunk.text);
  }
}

streamGeneration();
```

### Function Calling

```javascript
async function functionCallingExample() {
  const functions = [
    {
      name: 'get_stock_price',
      description: 'Get current stock price for a company',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock symbol (e.g., MSFT, AAPL)'
          }
        },
        required: ['symbol']
      }
    }
  ];

  const response = await router.chat({
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'What is Microsoft\'s current stock price?' }
    ],
    functions,
    functionCall: 'auto',
    maxTokens: 200
  });

  if (response.functionCall) {
    console.log('Function called:', response.functionCall.name);
    console.log('Arguments:', response.functionCall.arguments);
  }
  
  console.log('Response:', response.text);
}

functionCallingExample();
```

### Vision with GPT-4V

```javascript
async function analyzeImage() {
  const response = await router.chat({
    model: 'gpt-4-vision-preview',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What do you see in this image?' },
          {
            type: 'image_url',
            image_url: {
              url: 'https://example.com/image.jpg',
              detail: 'high'
            }
          }
        ]
      }
    ],
    maxTokens: 500
  });

  console.log('Image analysis:', response.text);
}

analyzeImage();
```

### Text Embeddings

```javascript
async function generateEmbeddings() {
  const texts = [
    'Azure OpenAI provides enterprise-grade AI',
    'Microsoft Azure cloud computing platform',
    'OpenAI GPT models for businesses'
  ];

  for (const text of texts) {
    const response = await router.embed({
      model: 'text-embedding-ada-002',
      input: text
    });

    console.log(`Text: "${text}"`);
    console.log(`Embedding dimensions: ${response.embedding.length}`);
    console.log(`Cost: $${response.cost.toFixed(6)}\n`);
  }
}

generateEmbeddings();
```

### Batch Processing

```javascript
async function batchProcess() {
  const prompts = [
    'Summarize the benefits of cloud computing',
    'Explain machine learning in simple terms',
    'What are the advantages of microservices?'
  ];

  const promises = prompts.map(prompt => 
    router.generate({
      model: 'gpt-35-turbo',
      prompt,
      maxTokens: 150,
      temperature: 0.7
    })
  );

  const results = await Promise.all(promises);
  
  results.forEach((result, index) => {
    console.log(`\n--- Prompt ${index + 1} ---`);
    console.log(result.text);
    console.log(`Cost: $${result.cost.toFixed(4)}`);
  });
}

batchProcess();
```

## Best Practices

### 1. Deployment Management

```javascript
// Use deployment names instead of model names
const router = new LLMRouter({
  providers: ['azure-openai'],
  'azure-openai': {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    deployments: {
      // Map logical names to deployment names
      'production-gpt4': 'gpt-4-deployment-prod',
      'development-gpt35': 'gpt-35-turbo-dev',
      'embeddings': 'ada-002-embeddings'
    }
  }
});

// Use logical names in requests
const response = await router.generate({
  model: 'production-gpt4',
  prompt: 'Your prompt here'
});
```

### 2. Content Filtering

Azure OpenAI includes built-in content filtering. Handle filtered responses:

```javascript
async function handleContentFilter() {
  try {
    const response = await router.generate({
      model: 'gpt-4',
      prompt: 'Your prompt here',
      maxTokens: 500
    });
    
    if (response.finishReason === 'content_filter') {
      console.log('Content was filtered by Azure OpenAI safety systems');
      // Handle filtered content appropriately
      return 'Content cannot be generated due to safety policies.';
    }
    
    return response.text;
  } catch (error) {
    if (error.type === 'content_filter') {
      console.log('Request blocked by content filter');
      return 'Request cannot be processed due to content policy.';
    }
    throw error;
  }
}
```

### 3. Rate Limiting

```javascript
// Configure rate limiting to stay within quotas
const router = new LLMRouter({
  providers: ['azure-openai'],
  'azure-openai': {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    rateLimiting: {
      requestsPerMinute: 240,  // Your quota limit
      tokensPerMinute: 40000,  // Your quota limit
      retryAfter: true         // Respect retry-after headers
    }
  }
});
```

### 4. Error Handling

```javascript
async function robustAzureCall() {
  try {
    const response = await router.generate({
      model: 'gpt-4',
      prompt: 'Your prompt here',
      maxTokens: 500
    });
    
    return response;
  } catch (error) {
    switch (error.type) {
      case 'quota_exceeded':
        console.error('Quota exceeded for this deployment');
        // Try different deployment or wait
        break;
        
      case 'content_filter':
        console.warn('Content was filtered');
        return { text: 'Content filtered by safety systems' };
        
      case 'authentication_error':
        console.error('Invalid credentials or expired token');
        // Refresh credentials
        break;
        
      case 'deployment_not_found':
        console.error('Deployment not found');
        // Check deployment name
        break;
        
      default:
        console.error('Azure OpenAI error:', error);
        throw error;
    }
  }
}
```

### 5. Monitoring and Logging

```javascript
// Enable monitoring for Azure integration
const router = new LLMRouter({
  providers: ['azure-openai'],
  monitoring: {
    enabled: true,
    logRequests: true,
    logResponses: false, // Don't log response content for privacy
    metrics: ['cost', 'latency', 'tokens', 'errors']
  },
  'azure-openai': {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    monitoring: {
      trackQuotaUsage: true,
      alertOnQuotaThreshold: 0.8  // Alert at 80% quota usage
    }
  }
});
```

## Troubleshooting

### Common Issues

#### Issue: "The API deployment for this resource does not exist"
```
Error: The API deployment for this resource does not exist. 
If you created the deployment within the last 5 minutes, please wait a moment and try again.
```

**Solution**: Verify deployment names in Azure portal:
1. Go to Azure OpenAI Studio
2. Check "Deployments" section
3. Use exact deployment name, not model name

#### Issue: "Quota exceeded"
```
Error: Rate limit reached for requests. Try again later.
```

**Solution**: Check and manage quotas:
```javascript
// Implement exponential backoff
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.type === 'quota_exceeded' && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

#### Issue: "Invalid authentication"
```
Error: Access denied due to invalid subscription key or wrong API endpoint.
```

**Solution**: Verify credentials and endpoint:
```javascript
// Check endpoint format
const correctEndpoint = 'https://YOUR-RESOURCE-NAME.openai.azure.com/';

// Verify API key format (should be 32 characters)
const apiKeyPattern = /^[a-f0-9]{32}$/i;
```

#### Issue: "Content filtering"
```
Error: The response was filtered due to the prompt triggering Azure OpenAI's content management policy.
```

**Solution**: Adjust content or handle filtered responses:
```javascript
// Review and modify prompts to comply with content policy
// Handle filtered responses gracefully in your application
```

### Debug Mode

```javascript
const router = new LLMRouter({
  providers: ['azure-openai'],
  debug: true,  // Enable debug logging
  'azure-openai': {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    logLevel: 'DEBUG',
    logRequests: true,
    logHeaders: false  // Don't log auth headers
  }
});
```

## Pricing Information

### GPT Models (per 1K tokens)
- **GPT-4 Turbo**: Input $10.00, Output $30.00
- **GPT-4**: Input $30.00, Output $60.00
- **GPT-4 32K**: Input $60.00, Output $120.00
- **GPT-3.5 Turbo**: Input $0.50, Output $1.50
- **GPT-3.5 Turbo 16K**: Input $3.00, Output $4.00

### Embedding Models (per 1K tokens)
- **Ada v2**: $0.10
- **Text Embedding 3 Small**: $0.02
- **Text Embedding 3 Large**: $0.13

### Image Models
- **DALL-E 3**: $0.04 per image (1024×1024)
- **DALL-E 2**: $0.02 per image (1024×1024)

### Audio Models
- **Whisper**: $0.006 per minute
- **TTS**: $15.00 per 1M characters
- **TTS HD**: $30.00 per 1M characters

*Prices vary by region. Check Azure OpenAI pricing page for current rates.*

## Resources

- **Azure OpenAI Studio**: [oai.azure.com](https://oai.azure.com)
- **API Documentation**: [docs.microsoft.com/azure/cognitive-services/openai](https://docs.microsoft.com/azure/cognitive-services/openai)
- **REST API Reference**: [docs.microsoft.com/azure/cognitive-services/openai/reference](https://docs.microsoft.com/azure/cognitive-services/openai/reference)
- **Azure SDK**: [github.com/Azure/azure-sdk-for-js](https://github.com/Azure/azure-sdk-for-js)
- **Content Policy**: [docs.microsoft.com/azure/cognitive-services/openai/concepts/content-filter](https://docs.microsoft.com/azure/cognitive-services/openai/concepts/content-filter)

---

*Built with 💚 by Echo AI Systems*