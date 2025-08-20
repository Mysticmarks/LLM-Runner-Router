# 🧠 Anthropic (Claude) Provider Documentation

Complete guide to using Anthropic's Claude models with LLM-Runner-Router.

## Quick Start

### Basic Setup

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['anthropic'],
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY
  }
});

// Generate with Claude
const response = await router.generate({
  model: 'claude-3-sonnet-20240229',
  prompt: 'Explain quantum computing in simple terms',
  maxTokens: 200
});

console.log(response.text);
```

## Configuration

### Complete Configuration Options

```javascript
const router = new LLMRouter({
  providers: ['anthropic'],
  anthropic: {
    // Authentication
    apiKey: process.env.ANTHROPIC_API_KEY,
    
    // API Settings
    version: '2023-06-01',
    betaFeatures: ['messages-2023-12-15'],
    baseURL: 'https://api.anthropic.com',
    
    // Request Settings
    timeout: 60000,
    maxRetries: 3,
    
    // Default Parameters
    defaults: {
      maxTokens: 1000,
      temperature: 0.7,
      topP: 0.9,
      topK: 50
    }
  }
});
```

## Setup & Authentication

### API Key Configuration

#### Environment Variables (Recommended)
```bash
# Required
ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional
ANTHROPIC_VERSION=2023-06-01  # API version
ANTHROPIC_BETA=messages-2023-12-15  # Beta features
```

#### Programmatic Setup
```javascript
import { APILoader } from 'llm-runner-router';

const claude = new APILoader({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  anthropicVersion: '2023-06-01',
  defaultModel: 'claude-3-opus-20240229'
});
```

#### Beta Features Setup
```javascript
const claude = new APILoader({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  betaFeatures: ['messages-2023-12-15', 'computer-use-2024-10-22'],
  maxRetries: 3
});
```

## Claude Models

### Claude 3 Family

| Model | Context Window | Input Cost | Output Cost | Strengths |
|-------|---------------|------------|-------------|-----------|
| `claude-3-opus-20240229` | 200K | $15/M | $75/M | Most capable, complex tasks |
| `claude-3-sonnet-20240229` | 200K | $3/M | $15/M | Balanced performance/cost |
| `claude-3-haiku-20240307` | 200K | $0.25/M | $1.25/M | Fast, lightweight tasks |

### Claude 2 Family (Legacy)

| Model | Context Window | Input Cost | Output Cost | Notes |
|-------|---------------|------------|-------------|-------|
| `claude-2.1` | 200K | $8/M | $24/M | Previous generation |
| `claude-2.0` | 100K | $8/M | $24/M | Older version |
| `claude-instant-1.2` | 100K | $0.8/M | $2.4/M | Fast, cheaper option |

### Model Selection Guide

```javascript
// For complex reasoning and analysis
const opus = { model: 'claude-3-opus-20240229' };

// For general purpose, balanced usage
const sonnet = { model: 'claude-3-sonnet-20240229' };

// For simple tasks, high volume
const haiku = { model: 'claude-3-haiku-20240307' };

// Automatic selection based on task
const auto = {
  model: 'auto',
  taskComplexity: 'medium',  // low, medium, high
  costPriority: 0.5  // 0 = quality, 1 = cost
};
```

## Unique Features

### System Prompts

```javascript
const response = await claude.complete({
  model: 'claude-3-opus-20240229',
  systemPrompt: `You are a helpful AI assistant with expertise in JavaScript.
                 Always provide code examples when explaining concepts.
                 Use TypeScript types when applicable.`,
  prompt: "Explain React hooks",
  maxTokens: 1000
});
```

### 200K Context Window

```javascript
// Process entire books or codebases
const response = await claude.complete({
  model: 'claude-3-opus-20240229',
  prompt: `Analyze this codebase and identify potential improvements:
           
           ${entireCodebaseContent}`,  // Up to ~150,000 words
  maxTokens: 4000
});

// Long document summarization
const summary = await claude.complete({
  model: 'claude-3-sonnet-20240229',
  systemPrompt: "You are an expert at creating concise summaries.",
  prompt: `Summarize this research paper in 3 paragraphs:
           
           ${longDocument}`,
  maxTokens: 500
});
```

### Vision Support (Claude 3)

```javascript
// Analyze images
const response = await claude.complete({
  model: 'claude-3-opus-20240229',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'What is shown in this architectural diagram?'
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
  maxTokens: 1000
});

// Multiple images
const comparison = await claude.complete({
  model: 'claude-3-sonnet-20240229',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Compare these two designs:' },
        {
          type: 'image',
          source: {
            type: 'url',
            url: 'https://example.com/design1.jpg'
          }
        },
        {
          type: 'image',
          source: {
            type: 'url',
            url: 'https://example.com/design2.jpg'
          }
        }
      ]
    }
  ]
});
```

### Message Formatting Requirements

```javascript
// Correct message format for Claude
const response = await claude.chat({
  model: 'claude-3-opus-20240229',
  messages: [
    {
      role: 'user',
      content: 'What is TypeScript?'
    },
    {
      role: 'assistant',
      content: 'TypeScript is a statically typed superset of JavaScript...'
    },
    {
      role: 'user',
      content: 'How do I install it?'
    }
  ],
  // Claude-specific parameters
  temperature: 0.7,
  topP: 0.9,
  topK: 40
});

// Note: Messages must alternate between user and assistant
// First message must be from user
// Last message should be from user
```

### Stop Sequences

```javascript
const response = await claude.complete({
  model: 'claude-3-sonnet-20240229',
  prompt: "List 5 programming languages:\n1.",
  maxTokens: 200,
  stopSequences: ["\n6.", "\n\nNote:", "```"],  // Stop generation at these
  temperature: 0.5
});
```

## Code Examples

### Basic Claude Completion

```javascript
import { APILoader } from 'llm-runner-router';

const claude = new APILoader({
  provider: 'anthropic',
  model: 'claude-3-opus-20240229'
});

const response = await claude.complete({
  prompt: "Explain the concept of closures in JavaScript",
  maxTokens: 500,
  temperature: 0.7
});

console.log(response.text);
console.log(`Tokens: ${response.usage.totalTokens}`);
console.log(`Cost: $${response.cost.toFixed(4)}`);
```

### System Prompt Usage

```javascript
const claude = new APILoader({ provider: 'anthropic' });

// Code review assistant
const reviewer = await claude.complete({
  model: 'claude-3-opus-20240229',
  systemPrompt: `You are a senior software engineer reviewing code.
                 Focus on: security, performance, readability, and best practices.
                 Provide specific suggestions for improvement.`,
  prompt: `Review this React component:
  
  ${componentCode}`,
  maxTokens: 1000
});

// Language tutor
const tutor = await claude.complete({
  model: 'claude-3-sonnet-20240229',
  systemPrompt: `You are a patient language tutor teaching Spanish.
                 Correct mistakes gently and provide encouragement.
                 Include pronunciation tips when relevant.`,
  prompt: "How do I say 'I would like coffee please' in Spanish?",
  maxTokens: 300
});
```

### Vision with Claude 3

```javascript
// OCR and document analysis
const extractText = await claude.complete({
  model: 'claude-3-opus-20240229',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Extract all text from this document image and format it nicely:'
        },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: documentImageBase64
          }
        }
      ]
    }
  ],
  maxTokens: 2000
});

// Chart analysis
const analyzeChart = await claude.complete({
  model: 'claude-3-sonnet-20240229',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'What trends do you see in this sales chart? Provide 3 key insights.'
        },
        {
          type: 'image',
          source: {
            type: 'url',
            url: chartImageUrl
          }
        }
      ]
    }
  ],
  temperature: 0.3  // Lower temperature for analytical tasks
});
```

### Long Context Handling

```javascript
class DocumentProcessor {
  constructor() {
    this.claude = new APILoader({
      provider: 'anthropic',
      model: 'claude-3-opus-20240229'
    });
  }
  
  async processLargeDocument(document, operation) {
    // Claude can handle up to 200K tokens (~150K words)
    const response = await this.claude.complete({
      systemPrompt: `You are processing a large document.
                     Maintain context throughout the entire document.
                     ${operation.instructions}`,
      prompt: `${operation.prompt}
      
      Document:
      ${document}`,
      maxTokens: operation.maxTokens || 4000
    });
    
    return response.text;
  }
  
  async compareDocs(doc1, doc2) {
    return this.processLargeDocument(
      `Document 1:\n${doc1}\n\nDocument 2:\n${doc2}`,
      {
        instructions: 'Compare these documents thoroughly.',
        prompt: 'Identify all differences and similarities:',
        maxTokens: 3000
      }
    );
  }
  
  async extractStructuredData(document) {
    const response = await this.claude.complete({
      model: 'claude-3-sonnet-20240229',
      systemPrompt: 'Extract data and return as JSON.',
      prompt: `Extract all person names, dates, and locations from:
      
      ${document}
      
      Return as JSON with arrays for each category.`,
      maxTokens: 2000
    });
    
    return JSON.parse(response.text);
  }
}
```

### Streaming Responses

```javascript
const stream = await claude.streamCompletion({
  model: 'claude-3-sonnet-20240229',
  prompt: "Write a detailed guide on React state management",
  maxTokens: 2000,
  temperature: 0.7
});

let fullResponse = '';
for await (const chunk of stream) {
  process.stdout.write(chunk.text || '');
  fullResponse += chunk.text || '';
  
  // Claude provides usage info in final chunk
  if (chunk.usage) {
    console.log(`\n\nTotal tokens: ${chunk.usage.totalTokens}`);
    console.log(`Cost: $${chunk.cost.toFixed(4)}`);
  }
}
```

## Migration Guide

### Migrating from OpenAI to Claude

```javascript
// Key differences to handle

class ClaudeMigration {
  constructor() {
    this.claude = new APILoader({ provider: 'anthropic' });
  }
  
  // Convert OpenAI format to Claude format
  convertMessages(openAIMessages) {
    const converted = [];
    
    for (const msg of openAIMessages) {
      if (msg.role === 'system') {
        // Claude uses systemPrompt separately
        this.systemPrompt = msg.content;
      } else {
        converted.push({
          role: msg.role,
          content: msg.content
        });
      }
    }
    
    // Ensure alternating user/assistant pattern
    return this.ensureAlternating(converted);
  }
  
  ensureAlternating(messages) {
    const fixed = [];
    let lastRole = null;
    
    for (const msg of messages) {
      if (msg.role === lastRole && msg.role === 'user') {
        // Combine consecutive user messages
        fixed[fixed.length - 1].content += '\n\n' + msg.content;
      } else if (msg.role === lastRole && msg.role === 'assistant') {
        // Combine consecutive assistant messages
        fixed[fixed.length - 1].content += '\n\n' + msg.content;
      } else {
        fixed.push(msg);
        lastRole = msg.role;
      }
    }
    
    return fixed;
  }
  
  async complete(options) {
    const claudeOptions = {
      model: this.mapModel(options.model),
      messages: this.convertMessages(options.messages),
      maxTokens: options.max_tokens || options.maxTokens,
      temperature: options.temperature,
      systemPrompt: this.systemPrompt
    };
    
    return await this.claude.complete(claudeOptions);
  }
  
  mapModel(openAIModel) {
    const mapping = {
      'gpt-4': 'claude-3-opus-20240229',
      'gpt-4-turbo': 'claude-3-opus-20240229',
      'gpt-3.5-turbo': 'claude-3-sonnet-20240229',
      'gpt-3.5-turbo-16k': 'claude-3-sonnet-20240229'
    };
    
    return mapping[openAIModel] || 'claude-3-sonnet-20240229';
  }
}
```

### API Differences

| Feature | OpenAI | Claude | Notes |
|---------|--------|--------|-------|
| System Message | In messages array | Separate `systemPrompt` | Claude is cleaner |
| Max Context | 128K (GPT-4 Turbo) | 200K (All Claude 3) | Claude has more |
| Vision | GPT-4V only | All Claude 3 models | More accessible |
| Function Calling | Native support | Use prompting | Claude via prompts |
| JSON Mode | `response_format` | Prompt engineering | Claude needs prompts |
| Streaming | Chunks with deltas | Full text chunks | Different format |

### Response Format Differences

```javascript
// OpenAI response format
{
  choices: [{
    message: { content: "..." },
    finish_reason: "stop"
  }],
  usage: { total_tokens: 100 }
}

// Claude response format (via LLM-Runner-Router)
{
  text: "...",
  usage: { totalTokens: 100 },
  model: "claude-3-opus-20240229",
  cost: 0.0015,
  provider: "anthropic"
}
```

## Best Practices

### Optimal System Prompts

```javascript
// Effective system prompt structure
const systemPrompt = `You are an AI assistant with the following capabilities:
1. [Specific expertise area]
2. [Communication style]
3. [Output format preferences]

Guidelines:
- [Specific instruction 1]
- [Specific instruction 2]

Constraints:
- [Limitation 1]
- [Limitation 2]`;

// Example: Code assistant
const codeAssistant = `You are an expert programmer specializing in JavaScript and TypeScript.

Capabilities:
- Write clean, efficient, well-commented code
- Explain complex concepts simply
- Suggest best practices and optimizations

Guidelines:
- Always use TypeScript types when applicable
- Include error handling in code examples
- Explain the "why" not just the "how"

Constraints:
- Avoid deprecated methods
- Prefer modern ES6+ syntax
- Keep examples concise but complete`;
```

### Cost Optimization Strategies

```javascript
class CostOptimizedClaude {
  constructor() {
    this.models = {
      complex: 'claude-3-opus-20240229',     // $15/$75 per M
      balanced: 'claude-3-sonnet-20240229',  // $3/$15 per M
      simple: 'claude-3-haiku-20240307'      // $0.25/$1.25 per M
    };
    
    this.claude = new APILoader({ provider: 'anthropic' });
  }
  
  async selectModelByComplexity(prompt) {
    // Simple heuristic for task complexity
    const wordCount = prompt.split(' ').length;
    const hasCode = /```|function|class|const|let/.test(prompt);
    const hasAnalysis = /analyze|compare|evaluate|assess/.test(prompt.toLowerCase());
    
    if (hasAnalysis || wordCount > 500 || hasCode) {
      return this.models.complex;
    } else if (wordCount > 100) {
      return this.models.balanced;
    } else {
      return this.models.simple;
    }
  }
  
  async complete(prompt, options = {}) {
    const model = options.model || await this.selectModelByComplexity(prompt);
    
    console.log(`Using model: ${model}`);
    
    return await this.claude.complete({
      model,
      prompt,
      maxTokens: options.maxTokens || 500,
      temperature: options.temperature || 0.7
    });
  }
}
```

### Handling Long Contexts

```javascript
class ContextManager {
  constructor() {
    this.claude = new APILoader({ provider: 'anthropic' });
    this.maxContextTokens = 180000;  // Leave room for response
  }
  
  async splitAndProcess(longText, instruction) {
    const chunks = this.chunkText(longText, 150000);
    const results = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const response = await this.claude.complete({
        model: 'claude-3-sonnet-20240229',
        systemPrompt: `Processing part ${i + 1} of ${chunks.length}.
                       Maintain context from previous parts.`,
        prompt: `${instruction}
        
        Part ${i + 1}:
        ${chunks[i]}`,
        maxTokens: 2000
      });
      
      results.push(response.text);
    }
    
    // Combine results
    return this.combineResults(results, instruction);
  }
  
  chunkText(text, maxChunkSize) {
    // Smart chunking that respects paragraph boundaries
    const paragraphs = text.split('\n\n');
    const chunks = [];
    let currentChunk = '';
    
    for (const para of paragraphs) {
      if ((currentChunk + para).length > maxChunkSize) {
        chunks.push(currentChunk);
        currentChunk = para;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }
    
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  }
  
  async combineResults(results, originalInstruction) {
    // Use Claude to synthesize the chunked results
    const synthesis = await this.claude.complete({
      model: 'claude-3-opus-20240229',
      systemPrompt: 'Combine and synthesize these partial results into a coherent whole.',
      prompt: `Original instruction: ${originalInstruction}
      
      Partial results to combine:
      ${results.map((r, i) => `Part ${i + 1}:\n${r}`).join('\n\n')}
      
      Provide a unified, coherent response:`,
      maxTokens: 3000
    });
    
    return synthesis.text;
  }
}
```

### Error Handling

```javascript
import { APILoader, AnthropicError } from 'llm-runner-router';

async function robustClaudeCall(options, maxRetries = 3) {
  const claude = new APILoader({ provider: 'anthropic' });
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await claude.complete(options);
      
    } catch (error) {
      if (error instanceof AnthropicError) {
        console.log(`Attempt ${attempt} failed: ${error.message}`);
        
        switch (error.type) {
          case 'rate_limit_error':
            // Exponential backoff
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`Rate limited. Waiting ${delay}ms...`);
            await sleep(delay);
            break;
            
          case 'api_error':
            if (attempt === maxRetries) throw error;
            console.log('API error, retrying...');
            await sleep(1000);
            break;
            
          case 'overloaded_error':
            // Claude is overloaded, wait longer
            console.log('Claude is overloaded. Waiting 30s...');
            await sleep(30000);
            break;
            
          case 'invalid_request_error':
            // Don't retry invalid requests
            throw error;
            
          default:
            if (attempt === maxRetries) throw error;
        }
      } else {
        throw error;  // Non-Anthropic error
      }
    }
  }
}
```

## Performance Tips

1. **Model Selection**
   - Use Haiku for simple tasks (10x cheaper than Opus)
   - Use Sonnet for general purpose (balanced)
   - Reserve Opus for complex reasoning

2. **Context Management**
   - Claude excels with long context - use it
   - Provide comprehensive context upfront
   - Avoid multiple rounds when possible

3. **System Prompts**
   - Be specific and structured
   - Include examples in system prompt
   - Define output format clearly

4. **Temperature Settings**
   - Use 0-0.3 for factual/analytical tasks
   - Use 0.5-0.7 for balanced creativity
   - Use 0.8-1.0 for creative writing

5. **Cost Optimization**
   - Cache responses for repeated queries
   - Use Haiku for initial drafts, Opus for refinement
   - Batch similar requests together

6. **Streaming**
   - Use for long responses (better UX)
   - Process chunks as they arrive
   - Show progress indicators

7. **Error Recovery**
   - Implement exponential backoff
   - Have fallback models ready
   - Monitor rate limits proactively

## Common Issues & Solutions

### Issue: Alternating Message Format Error

```javascript
// Problem: Messages not alternating correctly
// Solution: Ensure proper alternation
function fixMessageAlternation(messages) {
  const fixed = [];
  let expectedRole = 'user';
  
  for (const msg of messages) {
    if (msg.role === expectedRole) {
      fixed.push(msg);
      expectedRole = expectedRole === 'user' ? 'assistant' : 'user';
    } else if (msg.role === 'user' && expectedRole === 'assistant') {
      // Insert a placeholder assistant message
      fixed.push({ role: 'assistant', content: 'I understand.' });
      fixed.push(msg);
      expectedRole = 'assistant';
    }
  }
  
  // Ensure last message is from user
  if (fixed[fixed.length - 1].role === 'assistant') {
    fixed.push({ role: 'user', content: 'Continue.' });
  }
  
  return fixed;
}
```

### Issue: JSON Extraction

```javascript
// Claude doesn't have JSON mode, use prompting
async function extractJSON(claude, text) {
  const response = await claude.complete({
    model: 'claude-3-sonnet-20240229',
    systemPrompt: 'You are a JSON extraction expert. Always return valid JSON only.',
    prompt: `Extract the following information as JSON:
    ${text}
    
    Return only valid JSON, no explanation:`,
    temperature: 0.1  // Low temperature for consistency
  });
  
  // Extract JSON from response
  const jsonMatch = response.text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  throw new Error('No valid JSON found in response');
}
```

### Issue: Rate Limiting

```javascript
// Implement token bucket algorithm
class RateLimiter {
  constructor(requestsPerMinute) {
    this.capacity = requestsPerMinute;
    this.tokens = requestsPerMinute;
    this.lastRefill = Date.now();
  }
  
  async waitForToken() {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * (this.capacity / 60);
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
    
    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) * (60000 / this.capacity);
      await sleep(waitTime);
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

const limiter = new RateLimiter(50);  // 50 requests per minute

async function rateLimitedRequest(options) {
  await limiter.waitForToken();
  return await claude.complete(options);
}
```

## Resources

- 📖 [Anthropic API Documentation](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- 💰 [Claude Pricing](https://www.anthropic.com/api#pricing)
- 🔑 [API Console](https://console.anthropic.com/)
- 📊 [Usage Dashboard](https://console.anthropic.com/usage)
- 🎮 [Claude Web Interface](https://claude.ai)
- 📚 [Model Documentation](https://docs.anthropic.com/claude/docs/models-overview)
- 🛠️ [Prompt Engineering Guide](https://docs.anthropic.com/claude/docs/prompt-engineering)