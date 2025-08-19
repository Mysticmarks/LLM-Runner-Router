# 🌊 Streaming Responses

Complete guide to streaming AI responses in real-time with LLM-Runner-Router.

## How Streaming Works

Streaming allows you to receive AI-generated tokens as they're produced, rather than waiting for the complete response. This provides:

- ✅ Better perceived performance
- ✅ Early termination capability
- ✅ Real-time user feedback
- ✅ Lower time-to-first-token
- ✅ Progressive content display

## Provider Streaming Support

| Provider | Streaming Support | Format | Speed |
|----------|------------------|--------|-------|
| OpenAI | ✅ Full | SSE (Server-Sent Events) | Fast |
| Anthropic | ✅ Full | SSE with deltas | Fast |
| OpenRouter | ✅ Full | Provider-dependent | Varies |
| Groq | ✅ Full | SSE, ultra-fast | Very Fast |

## Basic Streaming

### Simple Stream Example

```javascript
import { APILoader } from 'llm-runner-router';

const ai = new APILoader({ provider: 'openai' });

const stream = await ai.streamCompletion({
  model: 'gpt-4-turbo-preview',
  prompt: "Write a story about a brave knight",
  maxTokens: 500,
  temperature: 0.8
});

// Process tokens as they arrive
for await (const chunk of stream) {
  process.stdout.write(chunk.text || '');
}
```

### Streaming with Metadata

```javascript
const stream = await ai.streamCompletion({
  prompt: "Explain quantum computing",
  maxTokens: 300
});

let fullText = '';
let tokenCount = 0;

for await (const chunk of stream) {
  if (chunk.text) {
    fullText += chunk.text;
    tokenCount++;
    
    // Display token
    process.stdout.write(chunk.text);
  }
  
  // Some providers send metadata in chunks
  if (chunk.metadata) {
    console.log('\nMetadata:', chunk.metadata);
  }
  
  // Final chunk often contains usage info
  if (chunk.usage) {
    console.log('\nTotal tokens:', chunk.usage.totalTokens);
    console.log('Cost: $', chunk.cost.toFixed(4));
  }
}
```

## Async Generator Patterns

### Custom Stream Processing

```javascript
class StreamProcessor {
  constructor() {
    this.ai = new APILoader({ provider: 'anthropic' });
  }
  
  async* processStream(prompt, options = {}) {
    const stream = await this.ai.streamCompletion({
      model: 'claude-3-sonnet-20240229',
      prompt: prompt,
      ...options
    });
    
    let buffer = '';
    let wordCount = 0;
    
    for await (const chunk of stream) {
      if (chunk.text) {
        buffer += chunk.text;
        
        // Yield complete words
        const words = buffer.split(' ');
        
        for (let i = 0; i < words.length - 1; i++) {
          wordCount++;
          yield {
            type: 'word',
            content: words[i] + ' ',
            wordNumber: wordCount
          };
        }
        
        // Keep last partial word in buffer
        buffer = words[words.length - 1];
      }
      
      // Yield metadata
      if (chunk.metadata) {
        yield {
          type: 'metadata',
          content: chunk.metadata
        };
      }
    }
    
    // Yield final buffer
    if (buffer) {
      yield {
        type: 'word',
        content: buffer,
        wordNumber: wordCount + 1
      };
    }
    
    yield {
      type: 'complete',
      totalWords: wordCount + 1
    };
  }
}

// Usage
const processor = new StreamProcessor();

for await (const item of processor.processStream("Tell me about AI")) {
  switch (item.type) {
    case 'word':
      console.log(`Word ${item.wordNumber}: ${item.content}`);
      break;
    case 'metadata':
      console.log('Metadata:', item.content);
      break;
    case 'complete':
      console.log(`Streaming complete. Total words: ${item.totalWords}`);
      break;
  }
}
```

### Transform Streams

```javascript
class StreamTransformer {
  // Add markdown formatting to stream
  async* addMarkdownFormatting(stream) {
    let inCodeBlock = false;
    let buffer = '';
    
    for await (const chunk of stream) {
      if (!chunk.text) continue;
      
      buffer += chunk.text;
      
      // Detect code blocks
      if (buffer.includes('```')) {
        inCodeBlock = !inCodeBlock;
        yield {
          text: chunk.text,
          formatted: inCodeBlock ? 
            `<pre><code>${chunk.text}` : 
            `</code></pre>${chunk.text}`
        };
      } else {
        yield {
          text: chunk.text,
          formatted: inCodeBlock ? 
            chunk.text : 
            chunk.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        };
      }
    }
  }
  
  // Add typing effect
  async* addTypingEffect(stream, charsPerSecond = 30) {
    for await (const chunk of stream) {
      if (!chunk.text) continue;
      
      for (const char of chunk.text) {
        yield { text: char };
        await sleep(1000 / charsPerSecond);
      }
    }
  }
  
  // Filter sensitive content
  async* filterContent(stream, filters = []) {
    for await (const chunk of stream) {
      if (!chunk.text) continue;
      
      let filtered = chunk.text;
      for (const filter of filters) {
        filtered = filtered.replace(filter.pattern, filter.replacement);
      }
      
      yield { text: filtered, wasFiltered: filtered !== chunk.text };
    }
  }
}
```

## Chunk Processing

### Handling Different Chunk Types

```javascript
class ChunkHandler {
  constructor() {
    this.ai = new APILoader({ provider: 'openai' });
    this.handlers = new Map();
    
    // Register handlers for different chunk types
    this.registerHandler('text', this.handleText.bind(this));
    this.registerHandler('function_call', this.handleFunctionCall.bind(this));
    this.registerHandler('metadata', this.handleMetadata.bind(this));
    this.registerHandler('error', this.handleError.bind(this));
    this.registerHandler('done', this.handleDone.bind(this));
  }
  
  registerHandler(type, handler) {
    this.handlers.set(type, handler);
  }
  
  async processStream(options) {
    const stream = await this.ai.streamCompletion(options);
    const context = {
      fullText: '',
      functionCalls: [],
      metadata: {},
      startTime: Date.now()
    };
    
    for await (const chunk of stream) {
      const chunkType = this.identifyChunkType(chunk);
      const handler = this.handlers.get(chunkType);
      
      if (handler) {
        await handler(chunk, context);
      }
    }
    
    return context;
  }
  
  identifyChunkType(chunk) {
    if (chunk.text) return 'text';
    if (chunk.function_call) return 'function_call';
    if (chunk.metadata) return 'metadata';
    if (chunk.error) return 'error';
    if (chunk.done) return 'done';
    return 'unknown';
  }
  
  handleText(chunk, context) {
    context.fullText += chunk.text;
    process.stdout.write(chunk.text);
  }
  
  handleFunctionCall(chunk, context) {
    context.functionCalls.push(chunk.function_call);
    console.log('\nFunction call:', chunk.function_call.name);
  }
  
  handleMetadata(chunk, context) {
    Object.assign(context.metadata, chunk.metadata);
  }
  
  handleError(chunk, context) {
    console.error('Stream error:', chunk.error);
  }
  
  handleDone(chunk, context) {
    const duration = Date.now() - context.startTime;
    console.log(`\nStream complete in ${duration}ms`);
  }
}
```

### Buffering and Batching

```javascript
class StreamBuffer {
  constructor(batchSize = 10, flushInterval = 100) {
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.buffer = [];
    this.flushTimer = null;
  }
  
  async* batchStream(stream) {
    for await (const chunk of stream) {
      this.buffer.push(chunk);
      
      if (this.buffer.length >= this.batchSize) {
        yield this.flush();
      } else {
        this.scheduleFlush();
      }
    }
    
    // Flush remaining buffer
    if (this.buffer.length > 0) {
      yield this.flush();
    }
  }
  
  flush() {
    const batch = [...this.buffer];
    this.buffer = [];
    this.clearFlushTimer();
    
    return {
      type: 'batch',
      items: batch,
      text: batch.map(c => c.text || '').join(''),
      timestamp: Date.now()
    };
  }
  
  scheduleFlush() {
    if (this.flushTimer) return;
    
    this.flushTimer = setTimeout(() => {
      if (this.buffer.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }
  
  clearFlushTimer() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

// Usage
const buffer = new StreamBuffer(5, 200);
const stream = await ai.streamCompletion({ prompt: "..." });

for await (const batch of buffer.batchStream(stream)) {
  console.log(`Batch of ${batch.items.length} chunks:`, batch.text);
}
```

## Backpressure Handling

### Managing Stream Flow

```javascript
class BackpressureManager {
  constructor(highWaterMark = 100) {
    this.queue = [];
    this.highWaterMark = highWaterMark;
    this.isPaused = false;
    this.consumers = [];
  }
  
  async* manageStream(stream) {
    const streamIterator = stream[Symbol.asyncIterator]();
    
    while (true) {
      // Check backpressure
      if (this.queue.length >= this.highWaterMark) {
        this.isPaused = true;
        await this.waitForConsumption();
      }
      
      // Get next chunk
      const { value, done } = await streamIterator.next();
      
      if (done) break;
      
      // Add to queue
      this.queue.push(value);
      
      // Yield for consumption
      yield value;
      
      // Remove from queue after consumption
      this.queue.shift();
    }
  }
  
  async waitForConsumption() {
    return new Promise(resolve => {
      const checkQueue = setInterval(() => {
        if (this.queue.length < this.highWaterMark / 2) {
          this.isPaused = false;
          clearInterval(checkQueue);
          resolve();
        }
      }, 10);
    });
  }
  
  getStatus() {
    return {
      queueSize: this.queue.length,
      isPaused: this.isPaused,
      pressure: this.queue.length / this.highWaterMark
    };
  }
}
```

### Adaptive Streaming

```javascript
class AdaptiveStreaming {
  constructor() {
    this.ai = new APILoader({ provider: 'groq' });
    this.metrics = {
      processingTimes: [],
      bufferSizes: [],
      throughput: []
    };
  }
  
  async* adaptiveStream(options) {
    const stream = await this.ai.streamCompletion(options);
    let lastChunkTime = Date.now();
    let chunkCount = 0;
    
    for await (const chunk of stream) {
      const now = Date.now();
      const processingTime = now - lastChunkTime;
      
      // Track metrics
      this.metrics.processingTimes.push(processingTime);
      chunkCount++;
      
      // Adapt based on performance
      if (this.shouldThrottle()) {
        await this.throttle();
      }
      
      // Yield chunk with metrics
      yield {
        ...chunk,
        metrics: {
          processingTime,
          chunkNumber: chunkCount,
          averageProcessingTime: this.getAverageProcessingTime()
        }
      };
      
      lastChunkTime = now;
    }
  }
  
  shouldThrottle() {
    const avgTime = this.getAverageProcessingTime();
    return avgTime < 10;  // Too fast for consumer
  }
  
  async throttle() {
    const targetTime = 15;  // Target ms between chunks
    const currentAvg = this.getAverageProcessingTime();
    const delay = Math.max(0, targetTime - currentAvg);
    
    if (delay > 0) {
      await sleep(delay);
    }
  }
  
  getAverageProcessingTime() {
    const recent = this.metrics.processingTimes.slice(-10);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
  }
}
```

## Provider-Specific Streaming

### OpenAI Streaming

```javascript
class OpenAIStreaming {
  constructor() {
    this.ai = new APILoader({ provider: 'openai' });
  }
  
  async streamWithFunctions(options) {
    const stream = await this.ai.streamCompletion({
      ...options,
      stream_options: {
        include_usage: true  // Include token usage in stream
      }
    });
    
    let functionCallBuffer = '';
    let functionName = null;
    
    for await (const chunk of stream) {
      // Handle text chunks
      if (chunk.choices?.[0]?.delta?.content) {
        yield {
          type: 'text',
          content: chunk.choices[0].delta.content
        };
      }
      
      // Handle function call chunks
      if (chunk.choices?.[0]?.delta?.function_call) {
        const fc = chunk.choices[0].delta.function_call;
        
        if (fc.name) {
          functionName = fc.name;
        }
        
        if (fc.arguments) {
          functionCallBuffer += fc.arguments;
        }
        
        yield {
          type: 'function_call_progress',
          name: functionName,
          partialArguments: functionCallBuffer
        };
      }
      
      // Handle completion
      if (chunk.choices?.[0]?.finish_reason) {
        if (functionCallBuffer) {
          yield {
            type: 'function_call_complete',
            name: functionName,
            arguments: JSON.parse(functionCallBuffer)
          };
        }
        
        yield {
          type: 'done',
          reason: chunk.choices[0].finish_reason,
          usage: chunk.usage
        };
      }
    }
  }
}
```

### Anthropic Streaming

```javascript
class AnthropicStreaming {
  constructor() {
    this.ai = new APILoader({ provider: 'anthropic' });
  }
  
  async* streamWithDeltas(options) {
    const stream = await this.ai.streamCompletion({
      model: 'claude-3-sonnet-20240229',
      ...options
    });
    
    let totalText = '';
    let messageStart = null;
    let messageStop = null;
    
    for await (const event of stream) {
      switch (event.type) {
        case 'message_start':
          messageStart = event.message;
          yield {
            type: 'start',
            model: messageStart.model,
            id: messageStart.id
          };
          break;
          
        case 'content_block_start':
          yield {
            type: 'block_start',
            index: event.index,
            contentType: event.content_block.type
          };
          break;
          
        case 'content_block_delta':
          if (event.delta.type === 'text_delta') {
            totalText += event.delta.text;
            yield {
              type: 'text',
              content: event.delta.text,
              totalText: totalText
            };
          }
          break;
          
        case 'content_block_stop':
          yield {
            type: 'block_stop',
            index: event.index
          };
          break;
          
        case 'message_delta':
          if (event.delta.stop_reason) {
            messageStop = event.delta.stop_reason;
          }
          if (event.usage) {
            yield {
              type: 'usage',
              inputTokens: event.usage.input_tokens,
              outputTokens: event.usage.output_tokens
            };
          }
          break;
          
        case 'message_stop':
          yield {
            type: 'complete',
            stopReason: messageStop,
            totalText: totalText
          };
          break;
          
        case 'error':
          yield {
            type: 'error',
            error: event.error
          };
          break;
      }
    }
  }
}
```

### Groq Streaming (Ultra-Fast)

```javascript
class GroqUltraFastStreaming {
  constructor() {
    this.ai = new APILoader({ provider: 'groq' });
  }
  
  async* ultraFastStream(options) {
    const startTime = Date.now();
    const stream = await this.ai.streamCompletion({
      model: 'llama3-8b-8192',  // Fastest model
      ...options
    });
    
    let tokenCount = 0;
    let firstTokenTime = null;
    
    for await (const chunk of stream) {
      const currentTime = Date.now() - startTime;
      
      if (chunk.text) {
        tokenCount++;
        
        if (!firstTokenTime) {
          firstTokenTime = currentTime;
        }
        
        yield {
          type: 'token',
          content: chunk.text,
          tokenNumber: tokenCount,
          timestamp: currentTime,
          tokensPerSecond: tokenCount / (currentTime / 1000)
        };
      }
      
      if (chunk.done) {
        yield {
          type: 'complete',
          totalTokens: tokenCount,
          totalTime: currentTime,
          firstTokenLatency: firstTokenTime,
          averageTokensPerSecond: tokenCount / (currentTime / 1000)
        };
      }
    }
  }
  
  async benchmarkStreaming(prompt) {
    const metrics = {
      firstToken: null,
      tokens: [],
      intervals: []
    };
    
    let lastTime = Date.now();
    
    for await (const chunk of this.ultraFastStream({ prompt, maxTokens: 200 })) {
      const now = Date.now();
      
      if (chunk.type === 'token') {
        if (!metrics.firstToken) {
          metrics.firstToken = now - lastTime;
        }
        
        metrics.tokens.push(chunk.content);
        metrics.intervals.push(now - lastTime);
        lastTime = now;
      }
      
      if (chunk.type === 'complete') {
        const avgInterval = metrics.intervals.reduce((a, b) => a + b, 0) / metrics.intervals.length;
        
        return {
          firstTokenLatency: metrics.firstToken,
          averageInterTokenLatency: avgInterval,
          totalTokens: chunk.totalTokens,
          tokensPerSecond: chunk.averageTokensPerSecond,
          consistency: this.calculateConsistency(metrics.intervals)
        };
      }
    }
  }
  
  calculateConsistency(intervals) {
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => 
      sum + Math.pow(val - mean, 2), 0) / intervals.length;
    
    return {
      mean: mean,
      standardDeviation: Math.sqrt(variance),
      coefficientOfVariation: (Math.sqrt(variance) / mean) * 100
    };
  }
}
```

## Error Handling in Streams

### Stream Error Recovery

```javascript
class StreamErrorHandler {
  constructor() {
    this.ai = new APILoader({ provider: 'openai' });
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }
  
  async* safeStream(options, attempt = 1) {
    try {
      const stream = await this.ai.streamCompletion(options);
      let hasError = false;
      
      for await (const chunk of stream) {
        // Check for error chunks
        if (chunk.error) {
          hasError = true;
          
          if (this.isRetriable(chunk.error) && attempt < this.maxRetries) {
            console.log(`Stream error, retrying (${attempt}/${this.maxRetries})`);
            await sleep(this.retryDelay * attempt);
            
            // Retry with exponential backoff
            yield* this.safeStream(options, attempt + 1);
            return;
          } else {
            yield {
              type: 'error',
              error: chunk.error,
              retriable: false
            };
            return;
          }
        }
        
        yield chunk;
      }
      
      if (!hasError) {
        yield { type: 'success' };
      }
      
    } catch (error) {
      if (this.isRetriable(error) && attempt < this.maxRetries) {
        console.log(`Stream initialization error, retrying (${attempt}/${this.maxRetries})`);
        await sleep(this.retryDelay * attempt);
        yield* this.safeStream(options, attempt + 1);
      } else {
        yield {
          type: 'error',
          error: error.message,
          retriable: false
        };
      }
    }
  }
  
  isRetriable(error) {
    const retriableErrors = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'rate_limit',
      'server_error'
    ];
    
    return retriableErrors.some(e => 
      error.message?.includes(e) || error.code === e
    );
  }
}
```

### Partial Response Handling

```javascript
class PartialResponseHandler {
  constructor() {
    this.ai = new APILoader({ provider: 'anthropic' });
  }
  
  async* streamWithRecovery(options) {
    let accumulated = '';
    let lastSuccessfulChunk = null;
    
    try {
      const stream = await this.ai.streamCompletion(options);
      
      for await (const chunk of stream) {
        if (chunk.text) {
          accumulated += chunk.text;
          lastSuccessfulChunk = chunk;
          
          yield {
            type: 'progress',
            text: chunk.text,
            totalText: accumulated
          };
        }
      }
      
      yield {
        type: 'complete',
        text: accumulated
      };
      
    } catch (error) {
      // Return partial response if available
      if (accumulated) {
        yield {
          type: 'partial',
          text: accumulated,
          error: error.message,
          lastChunk: lastSuccessfulChunk
        };
      } else {
        yield {
          type: 'error',
          error: error.message
        };
      }
    }
  }
  
  async completePartialResponse(partialText, originalPrompt) {
    // Try to complete a partial response
    const continuationPrompt = `Continue from where this text ends: "${partialText.slice(-100)}"`;
    
    try {
      const completion = await this.ai.complete({
        prompt: continuationPrompt,
        maxTokens: 500
      });
      
      return partialText + completion.text;
    } catch (error) {
      return partialText;  // Return what we have
    }
  }
}
```

## Best Practices

### 1. Always Use Streaming for Long Responses

```javascript
function shouldUseStreaming(expectedTokens) {
  // Stream if response > 100 tokens or > 2 seconds expected
  return expectedTokens > 100;
}
```

### 2. Implement Progress Indicators

```javascript
class StreamProgress {
  async* withProgress(stream, estimatedTokens = 200) {
    let tokenCount = 0;
    
    for await (const chunk of stream) {
      if (chunk.text) {
        tokenCount++;
        const progress = Math.min(100, (tokenCount / estimatedTokens) * 100);
        
        yield {
          ...chunk,
          progress: progress,
          tokenCount: tokenCount
        };
      }
    }
  }
}
```

### 3. Handle Connection Interruptions

```javascript
class ResilientStreaming {
  async* streamWithReconnect(options) {
    let position = 0;
    let accumulated = '';
    
    while (true) {
      try {
        const stream = await this.getStream(options, position);
        
        for await (const chunk of stream) {
          accumulated += chunk.text || '';
          position = accumulated.length;
          yield chunk;
        }
        
        break;  // Success
        
      } catch (error) {
        if (error.code === 'ECONNRESET' && position > 0) {
          console.log(`Connection reset at position ${position}, reconnecting...`);
          await sleep(1000);
          // Continue from where we left off
        } else {
          throw error;
        }
      }
    }
  }
}
```

### 4. Memory Management

```javascript
class MemoryEfficientStreaming {
  async* processLargeStream(stream, chunkSize = 1000) {
    let buffer = '';
    
    for await (const chunk of stream) {
      buffer += chunk.text || '';
      
      if (buffer.length >= chunkSize) {
        yield {
          type: 'chunk',
          content: buffer.slice(0, chunkSize)
        };
        
        buffer = buffer.slice(chunkSize);
      }
    }
    
    if (buffer) {
      yield {
        type: 'final',
        content: buffer
      };
    }
  }
}
```

### 5. Testing Streaming

```javascript
class StreamTester {
  async testStreaming(provider) {
    const ai = new APILoader({ provider });
    const testCases = [
      { prompt: "Say hello", expectedTokens: 5 },
      { prompt: "Count to 10", expectedTokens: 20 },
      { prompt: "Write a paragraph", expectedTokens: 100 }
    ];
    
    const results = [];
    
    for (const test of testCases) {
      const result = await this.runStreamTest(ai, test);
      results.push(result);
    }
    
    return results;
  }
  
  async runStreamTest(ai, test) {
    const metrics = {
      firstTokenTime: null,
      lastTokenTime: null,
      tokenCount: 0,
      errors: []
    };
    
    const startTime = Date.now();
    
    try {
      const stream = await ai.streamCompletion({
        prompt: test.prompt,
        maxTokens: test.expectedTokens * 2
      });
      
      for await (const chunk of stream) {
        if (chunk.text && !metrics.firstTokenTime) {
          metrics.firstTokenTime = Date.now() - startTime;
        }
        
        if (chunk.text) {
          metrics.tokenCount++;
          metrics.lastTokenTime = Date.now() - startTime;
        }
      }
      
      return {
        ...test,
        ...metrics,
        totalTime: Date.now() - startTime,
        success: true
      };
      
    } catch (error) {
      return {
        ...test,
        error: error.message,
        success: false
      };
    }
  }
}
```

## Performance Optimization

### Stream Caching

```javascript
class StreamCache {
  constructor() {
    this.cache = new Map();
  }
  
  async* getCachedOrStream(key, streamFactory) {
    // Check cache
    if (this.cache.has(key)) {
      const cached = this.cache.get(key);
      
      // Replay cached chunks
      for (const chunk of cached) {
        yield chunk;
      }
      
      return;
    }
    
    // Stream and cache
    const chunks = [];
    const stream = await streamFactory();
    
    for await (const chunk of stream) {
      chunks.push(chunk);
      yield chunk;
    }
    
    // Store in cache
    this.cache.set(key, chunks);
  }
}
```

### Parallel Streaming

```javascript
class ParallelStreaming {
  async streamMultiple(prompts) {
    const streams = await Promise.all(
      prompts.map(prompt => 
        this.ai.streamCompletion({ prompt, maxTokens: 200 })
      )
    );
    
    // Process streams in parallel
    const processors = streams.map((stream, index) => 
      this.processStream(stream, index)
    );
    
    return Promise.all(processors);
  }
  
  async processStream(stream, index) {
    const result = {
      index,
      text: '',
      tokenCount: 0,
      startTime: Date.now()
    };
    
    for await (const chunk of stream) {
      if (chunk.text) {
        result.text += chunk.text;
        result.tokenCount++;
      }
    }
    
    result.endTime = Date.now();
    result.duration = result.endTime - result.startTime;
    
    return result;
  }
}
```

## Resources

- 📖 [Streaming Best Practices](../tutorials/best-practices.md#streaming)
- 🔧 [API Reference - streamCompletion](../reference/apiloader.md#streamcompletion)
- 💡 [Examples](../../examples/streaming-demo.js)
- 🎮 [Interactive Demo](../../../public/streaming-playground.html)