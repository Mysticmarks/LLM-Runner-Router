# 🌐 Google Vertex AI Provider Documentation

*Complete guide to using Google Vertex AI with LLM-Runner-Router*

## What is Google Vertex AI?

Google Vertex AI is a unified ML platform that provides access to Google's foundation models including Gemini Pro, PaLM 2, Codey, and Imagen. It offers enterprise-grade MLOps capabilities with integrated tools for the entire ML lifecycle.

**Key Strengths:**
- Gemini Pro/Ultra - Google's most capable models
- Integrated MLOps and model management
- Custom model training and fine-tuning
- Multimodal capabilities (text, images, video)
- Enterprise security and compliance

## Quick Start

### Basic Setup

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['vertex-ai'],
  'vertex-ai': {
    projectId: 'your-gcp-project-id',
    location: 'us-central1',
    // Uses default Application Default Credentials (ADC)
  }
});

const response = await router.generate({
  model: 'gemini-pro',
  prompt: 'Explain quantum computing',
  maxTokens: 500
});

console.log(response.text);
```

### With Service Account

```javascript
const router = new LLMRouter({
  providers: ['vertex-ai'],
  'vertex-ai': {
    projectId: 'your-gcp-project-id',
    location: 'us-central1',
    keyFilename: '/path/to/service-account.json'
  }
});
```

### With Credentials Object

```javascript
const router = new LLMRouter({
  providers: ['vertex-ai'],
  'vertex-ai': {
    projectId: 'your-gcp-project-id',
    location: 'us-central1',
    credentials: {
      type: 'service_account',
      project_id: 'your-project',
      private_key_id: 'key-id',
      private_key: '-----BEGIN PRIVATE KEY-----\n...',
      client_email: 'service@project.iam.gserviceaccount.com',
      client_id: 'client-id',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token'
    }
  }
});
```

## Configuration

### Environment Variables

```bash
# Option 1: Service Account Key File
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
GOOGLE_CLOUD_PROJECT=your-gcp-project-id

# Option 2: Service Account Key JSON
GOOGLE_CREDENTIALS='{"type":"service_account","project_id":"..."}'

# Vertex AI Configuration
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_PUBLISHER_MODEL_ENDPOINT=publishers/google/models
```

### Configuration Options

```javascript
const vertexConfig = {
  // Required
  projectId: 'your-gcp-project-id',
  location: 'us-central1',                    // Model region
  
  // Authentication options (choose one)
  
  // Option 1: Use default ADC (recommended for GCP environments)
  useDefaultCredentials: true,
  
  // Option 2: Service account key file
  keyFilename: '/path/to/service-account.json',
  
  // Option 3: Service account credentials object
  credentials: {
    type: 'service_account',
    project_id: 'your-project',
    private_key: '-----BEGIN PRIVATE KEY-----\n...',
    client_email: 'service@project.iam.gserviceaccount.com'
  },
  
  // Model configuration
  publisherModelEndpoint: 'publishers/google/models',
  
  // Request configuration
  timeout: 30000,
  maxRetries: 3,
  
  // Safety settings (for Gemini models)
  safetySettings: [
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE'
    },
    {
      category: 'HARM_CATEGORY_HATE_SPEECH', 
      threshold: 'BLOCK_MEDIUM_AND_ABOVE'
    }
  ],
  
  // Generation config defaults
  generationConfig: {
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 1024
  }
};
```

## Available Models

### Gemini Models

```javascript
// Gemini Pro (Best balance of capability and speed)
model: 'gemini-pro'

// Gemini Pro Vision (Multimodal - text and images)
model: 'gemini-pro-vision'

// Gemini Ultra (Most capable - when available)
model: 'gemini-ultra'
```

### PaLM 2 Models

```javascript
// Text Bison (PaLM 2 for text)
model: 'text-bison@001'
model: 'text-bison@002'  // Latest version

// Chat Bison (PaLM 2 for conversations)
model: 'chat-bison@001'
model: 'chat-bison@002'  // Latest version

// Text Unicorn (Largest PaLM 2 model)
model: 'text-unicorn@001'
```

### Codey Models

```javascript
// Code Bison (Code generation)
model: 'code-bison@001'
model: 'code-bison@002'  // Latest version

// Code Chat Bison (Code conversation)
model: 'codechat-bison@001'
model: 'codechat-bison@002'  // Latest version

// Code Gecko (Code completion)
model: 'code-gecko@001'
model: 'code-gecko@002'  // Latest version
```

### Embedding Models

```javascript
// Text Embedding Gecko
model: 'textembedding-gecko@001'
model: 'textembedding-gecko@003'  // Latest multilingual

// Text Embedding Gecko (Multilingual)
model: 'textembedding-gecko-multilingual@001'

// Text Embedding Gecko 003
model: 'text-embedding-004'  // Latest high-dimensional
```

### Multimodal Models

```javascript
// Imagen (Image generation)
model: 'imagegeneration@002'
model: 'imagegeneration@005'  // Latest version

// Music AI (Audio generation) 
model: 'music-generation'
```

## Code Examples

### Simple Text Generation

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['vertex-ai'],
  'vertex-ai': {
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    location: 'us-central1'
  }
});

async function generateText() {
  const response = await router.generate({
    model: 'gemini-pro',
    prompt: 'Write a technical blog post about serverless computing',
    maxTokens: 500,
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
async function chatWithGemini() {
  const response = await router.chat({
    model: 'gemini-pro',
    messages: [
      {
        role: 'user',
        content: 'I need help designing a microservices architecture for an e-commerce platform. What are the key considerations?'
      }
    ],
    maxTokens: 800,
    temperature: 0.6
  });

  console.log('Gemini response:', response.text);
}

chatWithGemini();
```

### Streaming Response

```javascript
async function streamGeneration() {
  console.log('Gemini is generating response...\n');

  for await (const chunk of router.stream({
    model: 'gemini-pro',
    prompt: 'Explain the Google Cloud Platform ecosystem and its key services for AI/ML',
    maxTokens: 1000,
    temperature: 0.7
  })) {
    process.stdout.write(chunk.text);
  }
}

streamGeneration();
```

### Vision with Gemini Pro Vision

```javascript
async function analyzeImageWithGemini() {
  const response = await router.chat({
    model: 'gemini-pro-vision',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this architecture diagram and suggest improvements:' },
          {
            type: 'image',
            image: {
              // Base64 encoded image or image URL
              data: 'base64-encoded-image-data',
              mimeType: 'image/jpeg'
            }
          }
        ]
      }
    ],
    maxTokens: 600
  });

  console.log('Image analysis:', response.text);
}

analyzeImageWithGemini();
```

### Code Generation with Codey

```javascript
async function generateCode() {
  const response = await router.generate({
    model: 'code-bison@002',
    prompt: `
Write a Python function that:
1. Connects to a PostgreSQL database
2. Executes a parameterized query
3. Returns results as a list of dictionaries
4. Handles connection errors gracefully

Include proper error handling and type hints.
`,
    maxTokens: 500,
    temperature: 0.2  // Lower temperature for code generation
  });

  console.log('Generated code:', response.text);
}

generateCode();
```

### Text Embeddings

```javascript
async function generateEmbeddings() {
  const texts = [
    'Google Cloud Platform provides scalable computing',
    'Vertex AI offers managed machine learning services',
    'BigQuery enables fast analytics on large datasets'
  ];

  for (const text of texts) {
    const response = await router.embed({
      model: 'textembedding-gecko@003',
      input: text
    });

    console.log(`Text: "${text}"`);
    console.log(`Embedding dimensions: ${response.embedding.length}`);
    console.log(`Cost: $${response.cost.toFixed(6)}\n`);
  }
}

generateEmbeddings();
```

### Safety Settings

```javascript
async function generateWithSafetySettings() {
  const response = await router.generate({
    model: 'gemini-pro',
    prompt: 'Discuss the ethical implications of AI in healthcare',
    maxTokens: 500,
    safetySettings: [
      {
        category: 'HARM_CATEGORY_MEDICAL',
        threshold: 'BLOCK_LOW_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      }
    ]
  });

  console.log('Safe response:', response.text);
}

generateWithSafetySettings();
```

### Batch Processing

```javascript
async function batchGeneration() {
  const prompts = [
    'Explain containerization benefits',
    'Compare SQL vs NoSQL databases',
    'Describe REST API best practices'
  ];

  const promises = prompts.map(prompt => 
    router.generate({
      model: 'text-bison@002',
      prompt,
      maxTokens: 200,
      temperature: 0.7
    })
  );

  const results = await Promise.all(promises);
  
  results.forEach((result, index) => {
    console.log(`\n--- Response ${index + 1} ---`);
    console.log(result.text);
    console.log(`Cost: $${result.cost.toFixed(4)}`);
  });
}

batchGeneration();
```

## Best Practices

### 1. Authentication Setup

```javascript
// For production, use service accounts with minimal permissions
const serviceAccountConfig = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  credentials: {
    type: 'service_account',
    project_id: process.env.GOOGLE_CLOUD_PROJECT,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL
  }
};

// For local development, use gcloud auth
// gcloud auth application-default login
const localConfig = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  useDefaultCredentials: true
};
```

### 2. Model Selection Strategy

```javascript
const modelStrategy = {
  // High-quality, complex tasks
  complex: 'gemini-pro',
  
  // Fast, simple tasks  
  simple: 'text-bison@002',
  
  // Code-related tasks
  coding: 'code-bison@002',
  
  // Conversational tasks
  chat: 'chat-bison@002',
  
  // Multimodal tasks
  vision: 'gemini-pro-vision',
  
  // Embeddings
  embedding: 'textembedding-gecko@003'
};

// Use strategy in router
const response = await router.generate({
  model: modelStrategy.complex,
  prompt: 'Complex analysis task...'
});
```

### 3. Safety and Content Filtering

```javascript
// Configure safety settings based on use case
const safetyConfigs = {
  strict: [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' }
  ],
  
  moderate: [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
  ]
};
```

### 4. Error Handling

```javascript
async function robustVertexCall() {
  try {
    const response = await router.generate({
      model: 'gemini-pro',
      prompt: 'Your prompt here',
      maxTokens: 500
    });
    
    return response;
  } catch (error) {
    switch (error.type) {
      case 'quota_exceeded':
        console.error('Quota exceeded, trying different region...');
        // Try different location
        break;
        
      case 'safety_filter':
        console.warn('Content blocked by safety filters');
        return { text: 'Content filtered for safety reasons' };
        
      case 'authentication_error':
        console.error('Authentication failed');
        // Check service account permissions
        break;
        
      case 'model_not_found':
        console.error('Model not available in this location');
        // Try different model or location
        break;
        
      default:
        console.error('Vertex AI error:', error);
        throw error;
    }
  }
}
```

### 5. Cost Optimization

```javascript
// Use appropriate models for tasks to optimize costs
const costOptimizedRouter = new LLMRouter({
  providers: ['vertex-ai'],
  strategy: 'cost-optimized',
  'vertex-ai': {
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    location: 'us-central1',
    costOptimization: {
      preferredModels: [
        'text-bison@002',     // Lower cost for simple tasks
        'code-bison@002',     // Code tasks
        'gemini-pro'          // Complex tasks only when needed
      ],
      maxCostPerRequest: 0.01 // Limit cost per request
    }
  }
});
```

## Troubleshooting

### Common Issues

#### Issue: "Project not found or access denied"
```
Error: The project 'your-project' either does not exist or you do not have permission to access it.
```

**Solution**: Verify project ID and permissions:
```bash
# Check current project
gcloud config get-value project

# Enable Vertex AI API
gcloud services enable aiplatform.googleapis.com

# Grant necessary roles to service account
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/aiplatform.user"
```

#### Issue: "Model not available in location"
```
Error: The model 'gemini-pro' is not available in location 'europe-west1'.
```

**Solution**: Check model availability by region:
```javascript
const modelAvailability = {
  'us-central1': ['gemini-pro', 'text-bison@002', 'code-bison@002'],
  'us-east4': ['gemini-pro', 'text-bison@002'],
  'europe-west1': ['text-bison@002', 'code-bison@002'],
  'asia-southeast1': ['text-bison@002']
};
```

#### Issue: "Quota exceeded"
```
Error: Quota 'Generate requests per minute' exceeded. Limit: 60 in location us-central1.
```

**Solution**: Implement rate limiting and backoff:
```javascript
// Use exponential backoff
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

#### Issue: "Safety filter blocked content"
```
Error: The response was blocked due to safety concerns.
```

**Solution**: Adjust safety settings or rephrase prompts:
```javascript
// Lower safety thresholds if appropriate for your use case
const relaxedSafety = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' }
];
```

### Debug Mode

```javascript
const router = new LLMRouter({
  providers: ['vertex-ai'],
  debug: true,  // Enable debug logging
  'vertex-ai': {
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    location: 'us-central1',
    logLevel: 'DEBUG',
    logRequests: true,
    logResponses: false  // Don't log response content
  }
});
```

## Pricing Information

### Gemini Models (per 1K characters)
- **Gemini Pro**: Input $0.50, Output $1.50
- **Gemini Pro Vision**: Input $0.50, Output $1.50 (+ $0.0025 per image)

### PaLM 2 Models (per 1K characters)  
- **Text Bison**: Input $1.00, Output $1.00
- **Chat Bison**: Input $0.50, Output $0.50
- **Text Unicorn**: Input $6.00, Output $6.00

### Codey Models (per 1K characters)
- **Code Bison**: Input $0.50, Output $0.50
- **Code Chat Bison**: Input $0.50, Output $0.50
- **Code Gecko**: Input $0.10, Output $0.10

### Embedding Models (per 1K characters)
- **Text Embedding Gecko**: $0.025
- **Text Embedding Gecko Multilingual**: $0.025

### Image Models
- **Imagen**: $0.02 per image
- **Imagen (1024x1024)**: $0.04 per image

*Prices vary by region. Check Google Cloud pricing for current rates.*

## Resources

- **Vertex AI Console**: [console.cloud.google.com/vertex-ai](https://console.cloud.google.com/vertex-ai)
- **API Documentation**: [cloud.google.com/vertex-ai/docs](https://cloud.google.com/vertex-ai/docs)
- **Generative AI Studio**: [console.cloud.google.com/vertex-ai/generative](https://console.cloud.google.com/vertex-ai/generative)
- **Model Garden**: [console.cloud.google.com/vertex-ai/model-garden](https://console.cloud.google.com/vertex-ai/model-garden)
- **Client Libraries**: [cloud.google.com/vertex-ai/docs/client-libraries](https://cloud.google.com/vertex-ai/docs/client-libraries)
- **Gemini API Documentation**: [cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)

---

*Built with 💚 by Echo AI Systems*