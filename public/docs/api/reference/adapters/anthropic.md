# Anthropic Adapter Reference

Complete reference for the Anthropic adapter, including Claude models, configuration, and advanced features.

## Overview

The Anthropic adapter provides integration with Claude models, including Claude 3 Opus, Sonnet, and Haiku, offering high-quality conversational AI with strong safety features.

## Configuration

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['anthropic'],
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: 'https://api.anthropic.com', // Optional
    version: '2023-06-01', // API version
    timeout: 60000, // Optional
    maxRetries: 3, // Optional
    rateLimit: {
      requestsPerMinute: 50,
      tokensPerMinute: 100000
    }
  }
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | **Required** | Anthropic API key |
| `baseURL` | string | `https://api.anthropic.com` | API base URL |
| `version` | string | `2023-06-01` | API version header |
| `timeout` | number | `60000` | Request timeout in milliseconds |
| `maxRetries` | number | `3` | Maximum retry attempts |
| `rateLimit` | object | See below | Rate limiting configuration |

### Rate Limiting Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `requestsPerMinute` | number | `50` | Max requests per minute |
| `tokensPerMinute` | number | `100000` | Max tokens per minute |
| `requestsPerDay` | number | `1000` | Max requests per day |
| `tokensPerDay` | number | `2000000` | Max tokens per day |

## Supported Models

### Claude 3 Models

```javascript
// Claude 3 Opus (Most capable)
await router.generate({
  model: 'claude-3-opus-20240229',
  prompt: 'Your prompt here',
  maxTokens: 4096
});

// Claude 3 Sonnet (Balanced)
await router.generate({
  model: 'claude-3-sonnet-20240229',
  prompt: 'Your prompt here',
  maxTokens: 4096
});

// Claude 3 Haiku (Fast and cost-effective)
await router.generate({
  model: 'claude-3-haiku-20240307',
  prompt: 'Your prompt here',
  maxTokens: 4096
});
```

### Model Specifications

| Model | Context Length | Max Output | Cost per Million Tokens (Input/Output) |
|-------|---------------|------------|----------------------------------------|
| `claude-3-opus-20240229` | 200,000 | 4,096 | $15.00 / $75.00 |
| `claude-3-sonnet-20240229` | 200,000 | 4,096 | $3.00 / $15.00 |
| `claude-3-haiku-20240307` | 200,000 | 4,096 | $0.25 / $1.25 |

## Basic Usage

### Simple Generation

```javascript
const response = await router.generate({
  model: 'claude-3-sonnet-20240229',
  prompt: 'Write a short essay about artificial intelligence',
  maxTokens: 500,
  temperature: 0.7
});

console.log(response.text);
```

### System Prompts

```javascript
const response = await router.generate({
  model: 'claude-3-opus-20240229',
  systemPrompt: 'You are a helpful research assistant specializing in climate science.',
  prompt: 'Explain the greenhouse effect',
  maxTokens: 300
});
```

### Conversation Messages

```javascript
const response = await router.generate({
  model: 'claude-3-sonnet-20240229',
  messages: [
    { role: 'user', content: 'What is photosynthesis?' },
    { role: 'assistant', content: 'Photosynthesis is the process by which plants...' },
    { role: 'user', content: 'How does it affect the atmosphere?' }
  ],
  maxTokens: 400
});
```

### Streaming Responses

```javascript
const stream = await router.generateStream({
  model: 'claude-3-haiku-20240307',
  prompt: 'Tell me a story about a robot learning to paint',
  maxTokens: 800
});

for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}
```

## Advanced Features

### Tool Use (Function Calling)

```javascript
const tools = [
  {
    name: 'get_weather',
    description: 'Get current weather information for a location',
    input_schema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city and state, e.g. San Francisco, CA'
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description: 'Temperature unit'
        }
      },
      required: ['location']
    }
  }
];

const response = await router.generate({
  model: 'claude-3-opus-20240229',
  messages: [
    { role: 'user', content: 'What\'s the weather like in New York?' }
  ],
  tools,
  toolChoice: { type: 'auto' },
  maxTokens: 1000
});

if (response.toolUse) {
  for (const tool of response.toolUse) {
    console.log('Tool:', tool.name);
    console.log('Input:', tool.input);
  }
}
```

### Vision (Images)

```javascript
const response = await router.generate({
  model: 'claude-3-opus-20240229',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'What do you see in this image?'
        },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: base64ImageData
          }
        }
      ]
    }
  ],
  maxTokens: 300
});
```

### Document Analysis

```javascript
// Analyze a PDF document
const response = await router.generate({
  model: 'claude-3-sonnet-20240229',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Please analyze this document and provide a summary:'
        },
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64PdfData
          }
        }
      ]
    }
  ],
  maxTokens: 1000
});
```

## Message Formatting

### Human-Assistant Pattern

```javascript
const response = await router.generate({
  model: 'claude-3-sonnet-20240229',
  messages: [
    { role: 'user', content: 'Hello Claude!' },
    { role: 'assistant', content: 'Hello! How can I help you today?' },
    { role: 'user', content: 'I need help with Python programming.' }
  ],
  maxTokens: 500
});
```

### Complex Content

```javascript
const response = await router.generate({
  model: 'claude-3-opus-20240229',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Analyze this chart:' },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: chartImageData
          }
        },
        { type: 'text', text: 'What trends do you see?' }
      ]
    }
  ],
  maxTokens: 600
});
```

## Safety and Content Filtering

### Content Moderation

```javascript
const response = await router.generate({
  model: 'claude-3-sonnet-20240229',
  prompt: 'Your prompt here',
  safetySettings: {
    filterLevel: 'strict', // strict, moderate, permissive
    blockHarmfulContent: true,
    blockPersonalInfo: true
  }
});

// Check if content was filtered
if (response.safetyRating) {
  console.log('Safety rating:', response.safetyRating);
}
```

### Responsible AI Features

```javascript
// Enable enhanced safety checks
const response = await router.generate({
  model: 'claude-3-opus-20240229',
  prompt: 'Discuss a sensitive topic',
  options: {
    enhancedSafety: true,
    constitutionalAI: true, // Enable Claude's constitutional training
    harmlessness: 'prioritize'
  }
});
```

## Error Handling

### Common Errors

```javascript
try {
  const response = await router.generate({
    model: 'claude-3-opus-20240229',
    prompt: 'Your prompt'
  });
} catch (error) {
  switch (error.type) {
    case 'invalid_request_error':
      console.error('Invalid request:', error.message);
      break;
    case 'authentication_error':
      console.error('Authentication failed');
      break;
    case 'rate_limit_error':
      console.error('Rate limit exceeded');
      break;
    case 'overloaded_error':
      console.error('Service overloaded, try again later');
      break;
    case 'api_error':
      console.error('API error:', error.message);
      break;
    default:
      console.error('Unexpected error:', error);
  }
}
```

### Retry Configuration

```javascript
const router = new LLMRouter({
  providers: ['anthropic'],
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    retry: {
      maxAttempts: 5,
      backoffMultiplier: 2,
      maxDelay: 30000,
      retryCondition: (error) => {
        return error.type === 'rate_limit_error' || 
               error.type === 'overloaded_error' ||
               error.type === 'api_error';
      }
    }
  }
});
```

## Cost Optimization

### Model Selection Strategy

```javascript
// Choose model based on task complexity
function selectClaudeModel(taskType, complexityLevel) {
  if (taskType === 'creative_writing' && complexityLevel === 'high') {
    return 'claude-3-opus-20240229';
  }
  
  if (taskType === 'analysis' || complexityLevel === 'medium') {
    return 'claude-3-sonnet-20240229';
  }
  
  // For simple tasks, Q&A, or high-volume usage
  return 'claude-3-haiku-20240307';
}

const response = await router.generate({
  model: selectClaudeModel('simple_qa', 'low'),
  prompt: 'What is the capital of France?',
  maxTokens: 50
});
```

### Token Usage Optimization

```javascript
// Monitor token usage for cost control
const response = await router.generate({
  model: 'claude-3-sonnet-20240229',
  prompt: 'Summarize this text in exactly 100 words.',
  maxTokens: 120, // Slightly more than requested for safety
  stopSequences: ['\n\n'] // Stop at paragraph breaks
});

console.log('Tokens used:', response.usage.totalTokens);
console.log('Estimated cost:', calculateCost(response.usage, 'claude-3-sonnet-20240229'));
```

### Batch Processing

```javascript
// Process multiple requests efficiently
async function batchProcess(prompts) {
  const responses = await Promise.all(
    prompts.map(prompt => 
      router.generate({
        model: 'claude-3-haiku-20240307', // Cheapest model
        prompt,
        maxTokens: 200
      })
    )
  );
  
  return responses;
}
```

## Best Practices

### 1. Effective Prompting

```javascript
// Use clear, specific instructions
const response = await router.generate({
  model: 'claude-3-sonnet-20240229',
  systemPrompt: 'You are an expert data analyst. Always provide specific numbers and cite sources when available.',
  prompt: `
    Analyze the following sales data and provide:
    1. Total revenue for Q1
    2. Best performing product category
    3. Month-over-month growth rate
    4. Key insights and recommendations
    
    Data: [sales data here]
  `,
  maxTokens: 800
});
```

### 2. Conversation Management

```javascript
class ClaudeConversation {
  constructor() {
    this.messages = [];
    this.maxContextLength = 150000; // Leave room for response
  }
  
  addMessage(role, content) {
    this.messages.push({ role, content });
    this.trimContext();
  }
  
  trimContext() {
    let totalTokens = this.estimateTokens();
    
    while (totalTokens > this.maxContextLength && this.messages.length > 1) {
      // Remove oldest messages (keep system message if present)
      if (this.messages[0].role === 'system') {
        this.messages.splice(1, 1);
      } else {
        this.messages.splice(0, 1);
      }
      totalTokens = this.estimateTokens();
    }
  }
  
  async getClaude3Response(prompt) {
    this.addMessage('user', prompt);
    
    const response = await router.generate({
      model: 'claude-3-sonnet-20240229',
      messages: this.messages,
      maxTokens: 1000
    });
    
    this.addMessage('assistant', response.text);
    return response.text;
  }
  
  estimateTokens() {
    // Rough estimate: 1 token ≈ 4 characters for English
    const text = this.messages.map(m => m.content).join(' ');
    return Math.ceil(text.length / 4);
  }
}
```

### 3. Tool Integration

```javascript
class ClaudeToolManager {
  constructor() {
    this.tools = new Map();
  }
  
  registerTool(tool) {
    this.tools.set(tool.name, tool);
  }
  
  async executeWithTools(prompt) {
    const toolSchemas = Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema
    }));
    
    const response = await router.generate({
      model: 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: prompt }],
      tools: toolSchemas,
      toolChoice: { type: 'auto' },
      maxTokens: 1000
    });
    
    if (response.toolUse) {
      const results = [];
      
      for (const toolUse of response.toolUse) {
        const tool = this.tools.get(toolUse.name);
        if (tool) {
          const result = await tool.execute(toolUse.input);
          results.push({ tool: toolUse.name, result });
        }
      }
      
      // Continue conversation with tool results
      const followUp = await router.generate({
        model: 'claude-3-opus-20240229',
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: response.text, toolUse: response.toolUse },
          { role: 'user', content: `Tool results: ${JSON.stringify(results)}` }
        ],
        maxTokens: 500
      });
      
      return followUp.text;
    }
    
    return response.text;
  }
}
```

### 4. Safety Guidelines

```javascript
// Implement content filtering
function validatePrompt(prompt) {
  const prohibitedPatterns = [
    /personal information/i,
    /private data/i,
    // Add your patterns
  ];
  
  for (const pattern of prohibitedPatterns) {
    if (pattern.test(prompt)) {
      throw new Error('Prompt contains prohibited content');
    }
  }
  
  return true;
}

// Use with safety checks
async function safeGenerate(prompt) {
  validatePrompt(prompt);
  
  const response = await router.generate({
    model: 'claude-3-sonnet-20240229',
    prompt,
    options: {
      safetyChecks: true,
      responsibleAI: true
    }
  });
  
  return response;
}
```

## Rate Limiting and Scaling

### Intelligent Rate Limiting

```javascript
class AnthropicRateLimiter {
  constructor() {
    this.queues = new Map(); // Per-model queues
    this.limits = {
      'claude-3-opus-20240229': { rpm: 5, tpm: 10000 },
      'claude-3-sonnet-20240229': { rpm: 20, tpm: 40000 },
      'claude-3-haiku-20240307': { rpm: 50, tpm: 100000 }
    };
  }
  
  async queueRequest(model, request) {
    const queue = this.getQueue(model);
    const limit = this.limits[model];
    
    await this.waitForSlot(queue, limit);
    
    try {
      const response = await router.generate({
        model,
        ...request
      });
      
      this.updateUsage(model, response.usage);
      return response;
    } finally {
      this.releaseSlot(queue);
    }
  }
  
  getQueue(model) {
    if (!this.queues.has(model)) {
      this.queues.set(model, {
        active: 0,
        waiting: [],
        tokensUsed: 0,
        lastReset: Date.now()
      });
    }
    return this.queues.get(model);
  }
  
  async waitForSlot(queue, limit) {
    return new Promise((resolve) => {
      const check = () => {
        // Reset counters if minute has passed
        if (Date.now() - queue.lastReset > 60000) {
          queue.tokensUsed = 0;
          queue.lastReset = Date.now();
        }
        
        if (queue.active < limit.rpm && queue.tokensUsed < limit.tpm) {
          queue.active++;
          resolve();
        } else {
          queue.waiting.push(check);
        }
      };
      
      check();
    });
  }
  
  releaseSlot(queue) {
    queue.active--;
    if (queue.waiting.length > 0) {
      const next = queue.waiting.shift();
      setTimeout(next, 0);
    }
  }
  
  updateUsage(model, usage) {
    const queue = this.queues.get(model);
    if (queue && usage) {
      queue.tokensUsed += usage.totalTokens || 0;
    }
  }
}
```

## Monitoring and Analytics

### Usage Tracking

```javascript
class AnthropicAnalytics {
  constructor() {
    this.metrics = {
      requests: 0,
      tokens: 0,
      costs: 0,
      latencies: [],
      errors: 0
    };
  }
  
  trackRequest(model, usage, latency, error = null) {
    this.metrics.requests++;
    
    if (error) {
      this.metrics.errors++;
    } else {
      this.metrics.tokens += usage.totalTokens || 0;
      this.metrics.costs += this.calculateCost(model, usage);
      this.metrics.latencies.push(latency);
    }
  }
  
  calculateCost(model, usage) {
    const costs = {
      'claude-3-opus-20240229': { input: 15/1000000, output: 75/1000000 },
      'claude-3-sonnet-20240229': { input: 3/1000000, output: 15/1000000 },
      'claude-3-haiku-20240307': { input: 0.25/1000000, output: 1.25/1000000 }
    };
    
    const cost = costs[model];
    if (!cost || !usage) return 0;
    
    return (usage.promptTokens * cost.input) + 
           (usage.completionTokens * cost.output);
  }
  
  getStats() {
    return {
      ...this.metrics,
      avgLatency: this.metrics.latencies.reduce((a, b) => a + b, 0) / this.metrics.latencies.length,
      errorRate: this.metrics.errors / this.metrics.requests
    };
  }
}
```

## Troubleshooting

### Common Issues

1. **Context Length Exceeded**
   ```javascript
   // Solution: Implement smart truncation
   function truncateMessages(messages, maxTokens = 150000) {
     let totalTokens = estimateTokens(messages);
     
     while (totalTokens > maxTokens && messages.length > 1) {
       // Remove oldest non-system messages
       messages.splice(1, 1);
       totalTokens = estimateTokens(messages);
     }
     
     return messages;
   }
   ```

2. **Tool Use Not Working**
   ```javascript
   // Ensure proper tool schema format
   const tools = [
     {
       name: 'my_tool',
       description: 'Clear description of what the tool does',
       input_schema: {
         type: 'object',
         properties: {
           // Define all parameters with types
         },
         required: ['required_param']
       }
     }
   ];
   ```

3. **Rate Limit Issues**
   ```javascript
   // Implement exponential backoff
   async function withRetry(fn, maxAttempts = 3) {
     for (let attempt = 0; attempt < maxAttempts; attempt++) {
       try {
         return await fn();
       } catch (error) {
         if (error.type === 'rate_limit_error' && attempt < maxAttempts - 1) {
           await new Promise(resolve => 
             setTimeout(resolve, Math.pow(2, attempt) * 1000)
           );
           continue;
         }
         throw error;
       }
     }
   }
   ```

### Debug Mode

```javascript
const router = new LLMRouter({
  providers: ['anthropic'],
  debug: true,
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    debug: {
      logRequests: true,
      logResponses: true,
      logTokenUsage: true
    }
  }
});
```

---

**Next:** [Groq Adapter](./groq.md) | **Back to:** [Reference Overview](../README.md)