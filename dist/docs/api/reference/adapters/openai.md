# OpenAI Adapter Reference

Complete reference for the OpenAI adapter, including configuration, models, and advanced features.

## Overview

The OpenAI adapter provides integration with OpenAI's GPT models, including GPT-4, GPT-3.5-turbo, and specialized models like DALL-E and Whisper.

## Configuration

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['openai'],
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORG_ID, // Optional
    baseURL: 'https://api.openai.com/v1', // Optional
    timeout: 30000, // Optional
    maxRetries: 3, // Optional
    rateLimit: {
      requestsPerMinute: 60,
      tokensPerMinute: 150000
    }
  }
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | **Required** | OpenAI API key |
| `organization` | string | `null` | OpenAI organization ID |
| `baseURL` | string | `https://api.openai.com/v1` | API base URL |
| `timeout` | number | `30000` | Request timeout in milliseconds |
| `maxRetries` | number | `3` | Maximum retry attempts |
| `rateLimit` | object | See below | Rate limiting configuration |

### Rate Limiting Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `requestsPerMinute` | number | `60` | Max requests per minute |
| `tokensPerMinute` | number | `150000` | Max tokens per minute |
| `requestsPerDay` | number | `1440` | Max requests per day |
| `tokensPerDay` | number | `200000000` | Max tokens per day |

## Supported Models

### GPT-4 Models

```javascript
// GPT-4 Turbo (latest)
await router.generate({
  model: 'gpt-4-turbo-preview',
  prompt: 'Your prompt here',
  maxTokens: 4096
});

// GPT-4 (8K context)
await router.generate({
  model: 'gpt-4',
  prompt: 'Your prompt here',
  maxTokens: 8192
});

// GPT-4 (32K context)
await router.generate({
  model: 'gpt-4-32k',
  prompt: 'Your prompt here',
  maxTokens: 32768
});
```

### GPT-3.5 Models

```javascript
// GPT-3.5 Turbo (latest)
await router.generate({
  model: 'gpt-3.5-turbo',
  prompt: 'Your prompt here',
  maxTokens: 4096
});

// GPT-3.5 Turbo (16K context)
await router.generate({
  model: 'gpt-3.5-turbo-16k',
  prompt: 'Your prompt here',
  maxTokens: 16384
});
```

### Model Specifications

| Model | Context Length | Max Output | Cost (Input/Output per 1K tokens) |
|-------|---------------|------------|-----------------------------------|
| `gpt-4-turbo-preview` | 128,000 | 4,096 | $0.01 / $0.03 |
| `gpt-4` | 8,192 | 8,192 | $0.03 / $0.06 |
| `gpt-4-32k` | 32,768 | 32,768 | $0.06 / $0.12 |
| `gpt-3.5-turbo` | 4,096 | 4,096 | $0.0015 / $0.002 |
| `gpt-3.5-turbo-16k` | 16,384 | 16,384 | $0.003 / $0.004 |

## Basic Usage

### Simple Generation

```javascript
const response = await router.generate({
  model: 'gpt-3.5-turbo',
  prompt: 'Write a short poem about AI',
  temperature: 0.7,
  maxTokens: 150
});

console.log(response.text);
```

### Conversation Messages

```javascript
const response = await router.generate({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is machine learning?' },
    { role: 'assistant', content: 'Machine learning is...' },
    { role: 'user', content: 'Can you give me an example?' }
  ],
  temperature: 0.3
});
```

### Streaming Responses

```javascript
const stream = await router.generateStream({
  model: 'gpt-3.5-turbo',
  prompt: 'Tell me a story',
  maxTokens: 500
});

for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}
```

## Advanced Features

### Function Calling

```javascript
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City and state, e.g. San Francisco, CA'
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

const response = await router.generate({
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'user', content: 'What\'s the weather in Boston?' }
  ],
  tools,
  toolChoice: 'auto'
});

if (response.toolCalls) {
  for (const call of response.toolCalls) {
    console.log('Function call:', call.function.name);
    console.log('Arguments:', call.function.arguments);
  }
}
```

### Vision (GPT-4 Vision)

```javascript
const response = await router.generate({
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
  maxTokens: 300
});
```

### JSON Mode

```javascript
const response = await router.generate({
  model: 'gpt-3.5-turbo-1106',
  messages: [
    {
      role: 'system',
      content: 'You are a helpful assistant designed to output JSON.'
    },
    {
      role: 'user',
      content: 'Generate a person with name, age, and city'
    }
  ],
  responseFormat: { type: 'json_object' }
});

const jsonData = JSON.parse(response.text);
```

### Seed for Reproducibility

```javascript
const response = await router.generate({
  model: 'gpt-3.5-turbo',
  prompt: 'Generate a random number',
  seed: 12345, // Same seed = same output
  temperature: 0
});
```

## Embeddings

### Text Embeddings

```javascript
const embedding = await router.generateEmbedding({
  model: 'text-embedding-ada-002',
  input: 'The quick brown fox jumps over the lazy dog'
});

console.log('Embedding dimensions:', embedding.data[0].embedding.length);
console.log('Usage:', embedding.usage);
```

### Batch Embeddings

```javascript
const embeddings = await router.generateEmbedding({
  model: 'text-embedding-ada-002',
  input: [
    'First document text',
    'Second document text',
    'Third document text'
  ]
});

embeddings.data.forEach((emb, index) => {
  console.log(`Document ${index + 1} embedding:`, emb.embedding.slice(0, 5));
});
```

## Audio

### Speech to Text (Whisper)

```javascript
const transcription = await router.transcribe({
  model: 'whisper-1',
  file: audioFile, // File object or path
  language: 'en', // Optional
  prompt: 'This is a technical discussion about AI', // Optional context
  responseFormat: 'json', // json, text, srt, verbose_json, vtt
  temperature: 0
});

console.log('Transcription:', transcription.text);
```

### Text to Speech

```javascript
const speech = await router.synthesizeSpeech({
  model: 'tts-1',
  input: 'Hello, this is a test of text to speech.',
  voice: 'alloy', // alloy, echo, fable, onyx, nova, shimmer
  responseFormat: 'mp3', // mp3, opus, aac, flac
  speed: 1.0 // 0.25 to 4.0
});

// speech is an ArrayBuffer containing the audio data
```

## Image Generation (DALL-E)

### Generate Images

```javascript
const images = await router.generateImage({
  model: 'dall-e-3',
  prompt: 'A futuristic city with flying cars',
  n: 1,
  size: '1024x1024',
  quality: 'hd',
  style: 'vivid'
});

console.log('Generated image URL:', images.data[0].url);
```

### Edit Images

```javascript
const editedImage = await router.editImage({
  model: 'dall-e-2',
  image: originalImageFile,
  mask: maskImageFile,
  prompt: 'Add a rainbow in the sky',
  n: 1,
  size: '512x512'
});
```

### Create Variations

```javascript
const variations = await router.createImageVariation({
  model: 'dall-e-2',
  image: originalImageFile,
  n: 3,
  size: '512x512'
});
```

## Error Handling

### Common Errors

```javascript
try {
  const response = await router.generate({
    model: 'gpt-4',
    prompt: 'Your prompt'
  });
} catch (error) {
  switch (error.status) {
    case 400:
      console.error('Bad request:', error.message);
      break;
    case 401:
      console.error('Invalid API key');
      break;
    case 429:
      console.error('Rate limit exceeded');
      break;
    case 500:
      console.error('OpenAI server error');
      break;
    default:
      console.error('Unexpected error:', error);
  }
}
```

### Retry Logic

```javascript
const router = new LLMRouter({
  providers: ['openai'],
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    retry: {
      maxAttempts: 5,
      backoffMultiplier: 2,
      maxDelay: 10000,
      retryCondition: (error) => {
        return error.status === 429 || error.status >= 500;
      }
    }
  }
});
```

## Cost Optimization

### Model Selection

```javascript
// Use cheaper models for simple tasks
const simpleResponse = await router.generate({
  model: 'gpt-3.5-turbo', // $0.002/1K tokens vs $0.03/1K for GPT-4
  prompt: 'Summarize this in one sentence: ...'
});

// Use GPT-4 only for complex reasoning
const complexResponse = await router.generate({
  model: 'gpt-4',
  prompt: 'Analyze this complex data and provide insights...'
});
```

### Token Management

```javascript
// Limit output tokens to control costs
const response = await router.generate({
  model: 'gpt-4',
  prompt: 'Write a summary',
  maxTokens: 100 // Limit to 100 tokens
});

// Monitor token usage
console.log('Tokens used:', response.usage.totalTokens);
console.log('Estimated cost:', response.usage.totalTokens * 0.00003);
```

### Caching Responses

```javascript
const router = new LLMRouter({
  providers: ['openai'],
  cache: {
    enabled: true,
    ttl: 3600, // Cache for 1 hour
    keyGenerator: (request) => {
      return `${request.model}:${request.prompt}`;
    }
  }
});
```

## Rate Limiting

### Default Limits

The OpenAI adapter automatically handles rate limiting based on your account tier:

- **Free tier**: 3 RPM, 150 RPD
- **Pay-as-you-go**: 3,500 RPM, no daily limit
- **Tier 1**: 3,500 RPM, no daily limit
- **Tier 5**: 10,000 RPM, no daily limit

### Custom Rate Limiting

```javascript
const router = new LLMRouter({
  providers: ['openai'],
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    rateLimit: {
      requestsPerMinute: 100,
      tokensPerMinute: 200000,
      queueRequests: true, // Queue requests when limit hit
      retryAfter: 60000 // Wait 1 minute before retry
    }
  }
});
```

## Monitoring and Logging

### Request Logging

```javascript
const router = new LLMRouter({
  providers: ['openai'],
  logging: {
    enabled: true,
    level: 'info',
    requestDetails: true,
    responseDetails: false, // Don't log full responses
    errorDetails: true
  }
});
```

### Usage Tracking

```javascript
router.on('request', (event) => {
  console.log('Request:', {
    model: event.model,
    tokens: event.estimatedTokens
  });
});

router.on('response', (event) => {
  console.log('Response:', {
    model: event.model,
    tokens: event.usage.totalTokens,
    latency: event.latency,
    cost: event.cost
  });
});
```

## Best Practices

### 1. Model Selection

```javascript
// Use appropriate model for task complexity
const getModel = (taskComplexity) => {
  switch (taskComplexity) {
    case 'simple':
      return 'gpt-3.5-turbo';
    case 'moderate':
      return 'gpt-4';
    case 'complex':
      return 'gpt-4-turbo-preview';
    default:
      return 'gpt-3.5-turbo';
  }
};
```

### 2. Prompt Engineering

```javascript
// Use system messages for consistent behavior
const response = await router.generate({
  model: 'gpt-3.5-turbo',
  messages: [
    {
      role: 'system',
      content: 'You are a concise technical writer. Provide clear, brief explanations.'
    },
    {
      role: 'user',
      content: 'Explain REST APIs'
    }
  ]
});
```

### 3. Error Recovery

```javascript
async function robustGenerate(prompt, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await router.generate({
        model: 'gpt-3.5-turbo',
        prompt
      });
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries - 1) {
        // Wait before retry on rate limit
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
        continue;
      }
      
      if (error.status === 500 && attempt < maxRetries - 1) {
        // Retry on server errors
        continue;
      }
      
      throw error;
    }
  }
}
```

### 4. Context Management

```javascript
// Manage conversation context length
function trimContext(messages, maxTokens = 4000) {
  let totalTokens = 0;
  const trimmed = [];
  
  // Always keep system message
  if (messages[0]?.role === 'system') {
    trimmed.push(messages[0]);
    totalTokens += estimateTokens(messages[0].content);
  }
  
  // Add messages from end until token limit
  for (let i = messages.length - 1; i >= 1; i--) {
    const tokens = estimateTokens(messages[i].content);
    if (totalTokens + tokens > maxTokens) break;
    
    trimmed.unshift(messages[i]);
    totalTokens += tokens;
  }
  
  return trimmed;
}
```

## Troubleshooting

### Common Issues

1. **Rate Limit Errors**
   ```javascript
   // Solution: Implement exponential backoff
   const response = await router.generate(request, {
     retry: {
       maxAttempts: 5,
       backoffMultiplier: 2
     }
   });
   ```

2. **Token Limit Exceeded**
   ```javascript
   // Solution: Truncate input or use a model with larger context
   const response = await router.generate({
     model: 'gpt-4-32k', // Larger context window
     prompt: truncateToTokens(longPrompt, 30000)
   });
   ```

3. **Invalid JSON in JSON Mode**
   ```javascript
   // Solution: Be explicit in system prompt
   const response = await router.generate({
     model: 'gpt-3.5-turbo-1106',
     messages: [
       {
         role: 'system',
         content: 'You must respond with valid JSON only. No additional text.'
       },
       { role: 'user', content: prompt }
     ],
     responseFormat: { type: 'json_object' }
   });
   ```

### Debug Mode

```javascript
const router = new LLMRouter({
  providers: ['openai'],
  debug: true, // Enable debug logging
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    debug: {
      logRequests: true,
      logResponses: true,
      logErrors: true
    }
  }
});
```

---

**Next:** [Anthropic Adapter](./anthropic.md) | **Back to:** [Reference Overview](../README.md)