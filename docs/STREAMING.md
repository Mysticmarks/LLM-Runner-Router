# Streaming Architecture

Comprehensive guide to real-time token streaming in LLM-Runner-Router.

## Table of Contents

- [Overview](#overview)
- [Streaming Architecture](#streaming-architecture)
- [Implementation Patterns](#implementation-patterns)
- [Stream Management](#stream-management)
- [Performance Optimization](#performance-optimization)
- [Error Handling](#error-handling)
- [WebSocket Integration](#websocket-integration)
- [React Integration](#react-integration)
- [Advanced Patterns](#advanced-patterns)
- [Monitoring and Debugging](#monitoring-and-debugging)
- [Best Practices](#best-practices)

## Overview

LLM-Runner-Router provides comprehensive streaming capabilities for real-time token generation, enabling responsive user interfaces and efficient resource utilization.

### Key Features

- **Real-time Token Streaming**: Stream tokens as they're generated
- **Multiple Stream Types**: Text, JSON, structured data streams
- **Backpressure Management**: Handle slow consumers gracefully
- **Stream Composition**: Combine multiple model streams
- **Error Recovery**: Automatic retry and fallback mechanisms
- **Progress Tracking**: Monitor generation progress in real-time

### Streaming Benefits

- **Improved UX**: Immediate response to user input
- **Resource Efficiency**: Process tokens as available
- **Scalability**: Handle multiple concurrent streams
- **Flexibility**: Various consumption patterns

## Streaming Architecture

### Core Streaming Components

```javascript
import { LLMRouter } from 'llm-runner-router';

// Basic streaming setup
const router = new LLMRouter({
  streaming: {
    enabled: true,
    chunkSize: 1024,
    bufferSize: 4096,
    maxConcurrent: 10,
    timeout: 30000
  }
});

// Generate streaming response
async function streamResponse(prompt) {
  const stream = await router.generateStream(prompt, {
    maxTokens: 1000,
    temperature: 0.7,
    streamOptions: {
      includeMetadata: true,
      includeProgress: true
    }
  });
  
  for await (const chunk of stream) {
    console.log('Token:', chunk.text);
    console.log('Progress:', chunk.progress);
  }
}
```

### Stream Types

#### 1. Text Streaming

```javascript
// Simple text streaming
async function* textStream(prompt) {
  const stream = await router.generateStream(prompt);
  
  for await (const chunk of stream) {
    yield chunk.text;
  }
}

// Usage
for await (const token of textStream('Tell me about AI')) {
  process.stdout.write(token);
}
```

#### 2. Structured Streaming

```javascript
// Stream with metadata and progress
async function* structuredStream(prompt, options = {}) {
  const stream = await router.generateStream(prompt, {
    ...options,
    streamOptions: {
      includeMetadata: true,
      includeProgress: true,
      includeTokens: true
    }
  });
  
  for await (const chunk of stream) {
    yield {
      text: chunk.text,
      tokens: chunk.tokens,
      progress: chunk.progress,
      metadata: {
        model: chunk.metadata.model,
        latency: chunk.metadata.latency,
        timestamp: Date.now()
      }
    };
  }
}
```

#### 3. JSON Streaming

```javascript
// Stream JSON objects as they're parsed
async function* jsonStream(prompt) {
  const stream = await router.generateStream(prompt, {
    format: 'json',
    streamOptions: {
      parseJSON: true,
      emitPartial: true
    }
  });
  
  for await (const chunk of stream) {
    if (chunk.parsedJSON) {
      yield chunk.parsedJSON;
    } else {
      // Emit partial JSON for progressive parsing
      yield { partial: chunk.text };
    }
  }
}
```

### Stream Control

#### Stream Controller

```javascript
class StreamController {
  constructor(router) {
    this.router = router;
    this.activeStreams = new Map();
  }
  
  async createStream(id, prompt, options) {
    const controller = new AbortController();
    
    const stream = await this.router.generateStream(prompt, {
      ...options,
      signal: controller.signal
    });
    
    this.activeStreams.set(id, {
      stream,
      controller,
      startTime: Date.now(),
      status: 'active'
    });
    
    return this.wrapStream(id, stream);
  }
  
  async *wrapStream(id, stream) {
    try {
      for await (const chunk of stream) {
        const streamInfo = this.activeStreams.get(id);
        if (streamInfo) {
          streamInfo.lastChunk = Date.now();
          yield chunk;
        }
      }
    } catch (error) {
      this.handleStreamError(id, error);
      throw error;
    } finally {
      this.activeStreams.delete(id);
    }
  }
  
  pauseStream(id) {
    const streamInfo = this.activeStreams.get(id);
    if (streamInfo) {
      streamInfo.status = 'paused';
      streamInfo.controller.abort();
    }
  }
  
  resumeStream(id, prompt, options) {
    // Resume from last checkpoint
    const streamInfo = this.activeStreams.get(id);
    if (streamInfo && streamInfo.status === 'paused') {
      return this.createStream(id, prompt, {
        ...options,
        resumeFrom: streamInfo.lastPosition
      });
    }
  }
  
  cancelStream(id) {
    const streamInfo = this.activeStreams.get(id);
    if (streamInfo) {
      streamInfo.controller.abort();
      this.activeStreams.delete(id);
    }
  }
  
  getStreamStatus(id) {
    return this.activeStreams.get(id);
  }
  
  getAllStreams() {
    return Array.from(this.activeStreams.entries()).map(([id, info]) => ({
      id,
      status: info.status,
      duration: Date.now() - info.startTime,
      lastActivity: info.lastChunk
    }));
  }
}
```

## Implementation Patterns

### 1. Real-time Chat Interface

```javascript
class ChatInterface {
  constructor(router) {
    this.router = router;
    this.streamController = new StreamController(router);
    this.messageHistory = [];
  }
  
  async sendMessage(message, onToken, onComplete, onError) {
    const streamId = `chat-${Date.now()}`;
    const context = this.buildContext();
    
    try {
      const stream = await this.streamController.createStream(
        streamId,
        `${context}\nHuman: ${message}\nAssistant:`,
        {
          maxTokens: 1000,
          temperature: 0.7,
          stopTokens: ['\nHuman:', 'Human:']
        }
      );
      
      let fullResponse = '';
      
      for await (const chunk of stream) {
        fullResponse += chunk.text;
        
        // Call token callback
        onToken({
          text: chunk.text,
          accumulated: fullResponse,
          progress: chunk.progress
        });
      }
      
      // Store in history
      this.messageHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: fullResponse }
      );
      
      onComplete({ message: fullResponse, streamId });
      
    } catch (error) {
      onError({ error, streamId });
    }
  }
  
  buildContext() {
    return this.messageHistory
      .map(msg => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
      .join('\n');
  }
  
  cancelMessage(streamId) {
    this.streamController.cancelStream(streamId);
  }
}

// Usage
const chat = new ChatInterface(router);

await chat.sendMessage(
  'Explain quantum computing',
  (token) => {
    // Update UI with new token
    updateChatUI(token.text);
  },
  (result) => {
    // Message complete
    console.log('Complete response:', result.message);
  },
  (error) => {
    // Handle error
    console.error('Chat error:', error);
  }
);
```

### 2. Progress-Aware Streaming

```javascript
class ProgressiveStreamer {
  constructor(router) {
    this.router = router;
  }
  
  async *streamWithProgress(prompt, options = {}) {
    const totalTokens = options.maxTokens || 1000;
    let generatedTokens = 0;
    let startTime = Date.now();
    
    const stream = await this.router.generateStream(prompt, {
      ...options,
      streamOptions: {
        includeProgress: true,
        includeMetadata: true
      }
    });
    
    for await (const chunk of stream) {
      generatedTokens += chunk.tokens || 1;
      const elapsed = Date.now() - startTime;
      const tokensPerSecond = generatedTokens / (elapsed / 1000);
      const estimatedTimeRemaining = (totalTokens - generatedTokens) / tokensPerSecond;
      
      yield {
        text: chunk.text,
        progress: {
          tokens: generatedTokens,
          totalTokens,
          percentage: (generatedTokens / totalTokens) * 100,
          tokensPerSecond,
          estimatedTimeRemaining,
          elapsed
        },
        metadata: chunk.metadata
      };
    }
  }
}

// Usage with progress bar
const streamer = new ProgressiveStreamer(router);

for await (const chunk of streamer.streamWithProgress('Write a story', { maxTokens: 500 })) {
  updateProgressBar(chunk.progress.percentage);
  displayText(chunk.text);
  updateStats({
    tokens: chunk.progress.tokens,
    speed: `${chunk.progress.tokensPerSecond.toFixed(1)} tokens/sec`,
    eta: `${chunk.progress.estimatedTimeRemaining.toFixed(1)}s remaining`
  });
}
```

### 3. Multi-Model Streaming

```javascript
class MultiModelStreamer {
  constructor(router) {
    this.router = router;
  }
  
  async *streamFromMultipleModels(prompt, models, options = {}) {
    const streams = await Promise.all(
      models.map(async (model) => {
        const stream = await this.router.generateStream(prompt, {
          ...options,
          model: model.name,
          streamOptions: {
            includeMetadata: true
          }
        });
        
        return {
          model: model.name,
          weight: model.weight || 1,
          stream
        };
      })
    );
    
    // Merge streams with weighted selection
    yield* this.mergeStreams(streams);
  }
  
  async *mergeStreams(streams) {
    const iterators = streams.map(s => ({
      ...s,
      iterator: s.stream[Symbol.asyncIterator](),
      current: null,
      done: false
    }));
    
    while (iterators.some(it => !it.done)) {
      // Get next chunk from each stream
      await Promise.all(
        iterators.map(async (it) => {
          if (!it.done && !it.current) {
            try {
              const result = await it.iterator.next();
              it.current = result.value;
              it.done = result.done;
            } catch (error) {
              it.done = true;
              it.error = error;
            }
          }
        })
      );
      
      // Select best chunk based on weights and quality
      const bestChunk = this.selectBestChunk(iterators);
      if (bestChunk) {
        yield bestChunk;
      }
    }
  }
  
  selectBestChunk(iterators) {
    const available = iterators.filter(it => it.current && !it.done);
    if (available.length === 0) return null;
    
    // Select based on quality score and weights
    const scored = available.map(it => ({
      ...it,
      score: this.calculateChunkScore(it.current) * it.weight
    }));
    
    const best = scored.reduce((a, b) => a.score > b.score ? a : b);
    const chunk = best.current;
    best.current = null; // Mark for next iteration
    
    return {
      ...chunk,
      metadata: {
        ...chunk.metadata,
        selectedModel: best.model,
        score: best.score
      }
    };
  }
  
  calculateChunkScore(chunk) {
    // Score based on confidence, relevance, etc.
    const confidence = chunk.metadata?.confidence || 0.5;
    const length = chunk.text?.length || 0;
    return confidence * Math.min(length / 10, 1); // Normalize length factor
  }
}
```

## Stream Management

### Buffering and Backpressure

```javascript
class BufferedStreamer {
  constructor(router, options = {}) {
    this.router = router;
    this.bufferSize = options.bufferSize || 1024;
    this.highWaterMark = options.highWaterMark || this.bufferSize * 0.8;
    this.lowWaterMark = options.lowWaterMark || this.bufferSize * 0.2;
  }
  
  async *createBufferedStream(prompt, options = {}) {
    const buffer = [];
    let paused = false;
    let streamEnded = false;
    
    const stream = await this.router.generateStream(prompt, options);
    
    // Start filling buffer
    this.fillBuffer(stream, buffer).then(() => {
      streamEnded = true;
    });
    
    while (!streamEnded || buffer.length > 0) {
      // Wait for buffer to have content
      while (buffer.length === 0 && !streamEnded) {
        await this.sleep(10);
      }
      
      if (buffer.length === 0) break;
      
      // Yield from buffer
      const chunk = buffer.shift();
      yield chunk;
      
      // Handle backpressure
      if (buffer.length > this.highWaterMark && !paused) {
        paused = true;
        console.log('Stream paused - buffer full');
      } else if (buffer.length < this.lowWaterMark && paused) {
        paused = false;
        console.log('Stream resumed - buffer drained');
      }
    }
  }
  
  async fillBuffer(stream, buffer) {
    try {
      for await (const chunk of stream) {
        buffer.push(chunk);
        
        // Respect buffer size limit
        while (buffer.length > this.bufferSize) {
          await this.sleep(10);
        }
      }
    } catch (error) {
      buffer.push({ error });
    }
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Stream Multiplexing

```javascript
class StreamMultiplexer {
  constructor() {
    this.streams = new Map();
    this.subscribers = new Map();
  }
  
  createStream(id, generator) {
    const stream = {
      id,
      generator,
      active: true,
      subscribers: new Set()
    };
    
    this.streams.set(id, stream);
    this.startStream(stream);
    
    return id;
  }
  
  async startStream(stream) {
    try {
      for await (const chunk of stream.generator) {
        if (!stream.active) break;
        
        // Broadcast to all subscribers
        for (const subscriberId of stream.subscribers) {
          const subscriber = this.subscribers.get(subscriberId);
          if (subscriber) {
            subscriber.callback(chunk, stream.id);
          }
        }
      }
    } catch (error) {
      this.handleStreamError(stream.id, error);
    } finally {
      this.streams.delete(stream.id);
    }
  }
  
  subscribe(streamId, callback) {
    const subscriberId = `sub-${Date.now()}-${Math.random()}`;
    
    this.subscribers.set(subscriberId, {
      streamId,
      callback,
      createdAt: Date.now()
    });
    
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.subscribers.add(subscriberId);
    }
    
    return subscriberId;
  }
  
  unsubscribe(subscriberId) {
    const subscriber = this.subscribers.get(subscriberId);
    if (subscriber) {
      const stream = this.streams.get(subscriber.streamId);
      if (stream) {
        stream.subscribers.delete(subscriberId);
      }
      this.subscribers.delete(subscriberId);
    }
  }
  
  stopStream(streamId) {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.active = false;
    }
  }
}

// Usage
const multiplexer = new StreamMultiplexer();

// Create a stream
const streamId = multiplexer.createStream(
  'chat-stream',
  router.generateStream('Tell me about space')
);

// Multiple subscribers
const sub1 = multiplexer.subscribe(streamId, (chunk) => {
  console.log('UI Update:', chunk.text);
});

const sub2 = multiplexer.subscribe(streamId, (chunk) => {
  console.log('Logger:', chunk);
});
```

## Performance Optimization

### Chunking Strategies

```javascript
class OptimizedStreamer {
  constructor(router) {
    this.router = router;
  }
  
  async *createOptimizedStream(prompt, options = {}) {
    const chunkStrategy = options.chunkStrategy || 'adaptive';
    
    const stream = await this.router.generateStream(prompt, {
      ...options,
      streamOptions: {
        includeMetadata: true,
        chunkStrategy
      }
    });
    
    let buffer = '';
    let chunkSize = this.getInitialChunkSize(chunkStrategy);
    
    for await (const chunk of stream) {
      buffer += chunk.text;
      
      // Adaptive chunking based on performance
      chunkSize = this.adaptChunkSize(chunkSize, chunk.metadata);
      
      while (buffer.length >= chunkSize) {
        const toYield = buffer.substring(0, chunkSize);
        buffer = buffer.substring(chunkSize);
        
        yield {
          text: toYield,
          metadata: {
            chunkSize,
            strategy: chunkStrategy,
            ...chunk.metadata
          }
        };
      }
    }
    
    // Yield remaining buffer
    if (buffer.length > 0) {
      yield {
        text: buffer,
        metadata: { final: true }
      };
    }
  }
  
  getInitialChunkSize(strategy) {
    switch (strategy) {
      case 'small': return 16;
      case 'medium': return 64;
      case 'large': return 256;
      case 'adaptive': return 64;
      default: return 64;
    }
  }
  
  adaptChunkSize(currentSize, metadata) {
    if (!metadata?.latency) return currentSize;
    
    // Increase chunk size if latency is high
    if (metadata.latency > 200) {
      return Math.min(currentSize * 1.5, 512);
    }
    
    // Decrease chunk size if latency is low
    if (metadata.latency < 50) {
      return Math.max(currentSize * 0.8, 16);
    }
    
    return currentSize;
  }
}
```

### Connection Pooling

```javascript
class StreamingConnectionPool {
  constructor(router, options = {}) {
    this.router = router;
    this.maxConnections = options.maxConnections || 10;
    this.activeConnections = new Map();
    this.connectionQueue = [];
  }
  
  async createPooledStream(prompt, options = {}) {
    const connectionId = await this.acquireConnection();
    
    try {
      const stream = await this.router.generateStream(prompt, {
        ...options,
        connectionId
      });
      
      return this.wrapStreamWithCleanup(stream, connectionId);
    } catch (error) {
      this.releaseConnection(connectionId);
      throw error;
    }
  }
  
  async acquireConnection() {
    // Check for available connection
    for (const [id, conn] of this.activeConnections) {
      if (!conn.busy) {
        conn.busy = true;
        return id;
      }
    }
    
    // Create new connection if under limit
    if (this.activeConnections.size < this.maxConnections) {
      const connectionId = `conn-${Date.now()}-${Math.random()}`;
      this.activeConnections.set(connectionId, {
        id: connectionId,
        busy: true,
        createdAt: Date.now()
      });
      return connectionId;
    }
    
    // Wait for connection to become available
    return new Promise((resolve) => {
      this.connectionQueue.push(resolve);
    });
  }
  
  releaseConnection(connectionId) {
    const connection = this.activeConnections.get(connectionId);
    if (connection) {
      connection.busy = false;
      
      // Notify waiting requests
      if (this.connectionQueue.length > 0) {
        const resolve = this.connectionQueue.shift();
        connection.busy = true;
        resolve(connectionId);
      }
    }
  }
  
  async *wrapStreamWithCleanup(stream, connectionId) {
    try {
      for await (const chunk of stream) {
        yield chunk;
      }
    } finally {
      this.releaseConnection(connectionId);
    }
  }
}
```

## Error Handling

### Stream Error Recovery

```javascript
class ResilientStreamer {
  constructor(router) {
    this.router = router;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }
  
  async *createResilientStream(prompt, options = {}) {
    let attempt = 0;
    let lastError = null;
    
    while (attempt < this.retryAttempts) {
      try {
        const stream = await this.router.generateStream(prompt, {
          ...options,
          attemptNumber: attempt + 1
        });
        
        yield* this.monitorStream(stream, prompt, options, attempt);
        return; // Success, exit retry loop
        
      } catch (error) {
        lastError = error;
        attempt++;
        
        if (attempt < this.retryAttempts) {
          console.log(`Stream attempt ${attempt} failed, retrying...`);
          await this.sleep(this.retryDelay * attempt);
        }
      }
    }
    
    // All attempts failed
    throw new Error(`Stream failed after ${this.retryAttempts} attempts: ${lastError.message}`);
  }
  
  async *monitorStream(stream, prompt, options, attempt) {
    let chunkCount = 0;
    let lastChunkTime = Date.now();
    const timeout = options.timeout || 30000;
    
    for await (const chunk of stream) {
      chunkCount++;
      lastChunkTime = Date.now();
      
      // Yield chunk with recovery metadata
      yield {
        ...chunk,
        metadata: {
          ...chunk.metadata,
          attempt: attempt + 1,
          chunkNumber: chunkCount,
          recoveryInfo: {
            retryAttempt: attempt,
            totalChunks: chunkCount
          }
        }
      };
      
      // Check for timeout
      if (Date.now() - lastChunkTime > timeout) {
        throw new Error('Stream timeout - no chunks received');
      }
    }
    
    if (chunkCount === 0) {
      throw new Error('Stream completed without generating any chunks');
    }
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Graceful Degradation

```javascript
class GracefulStreamer {
  constructor(router) {
    this.router = router;
    this.fallbackModels = ['gpt-3.5-turbo', 'claude-instant'];
  }
  
  async *createGracefulStream(prompt, options = {}) {
    const primaryModel = options.model || 'primary';
    
    try {
      // Try primary model first
      const stream = await this.router.generateStream(prompt, {
        ...options,
        model: primaryModel
      });
      
      yield* this.wrapStreamWithFallback(stream, prompt, options);
      
    } catch (error) {
      console.log(`Primary model failed: ${error.message}`);
      yield* this.tryFallbackModels(prompt, options);
    }
  }
  
  async *wrapStreamWithFallback(stream, prompt, options) {
    try {
      let hasYielded = false;
      
      for await (const chunk of stream) {
        hasYielded = true;
        yield chunk;
      }
      
      if (!hasYielded) {
        throw new Error('Stream completed without yielding chunks');
      }
      
    } catch (error) {
      console.log(`Stream error: ${error.message}, falling back...`);
      yield* this.tryFallbackModels(prompt, options);
    }
  }
  
  async *tryFallbackModels(prompt, options) {
    for (const fallbackModel of this.fallbackModels) {
      try {
        console.log(`Trying fallback model: ${fallbackModel}`);
        
        const stream = await this.router.generateStream(prompt, {
          ...options,
          model: fallbackModel,
          fallback: true
        });
        
        for await (const chunk of stream) {
          yield {
            ...chunk,
            metadata: {
              ...chunk.metadata,
              fallbackModel,
              fallbackUsed: true
            }
          };
        }
        
        return; // Success with fallback
        
      } catch (error) {
        console.log(`Fallback model ${fallbackModel} failed: ${error.message}`);
      }
    }
    
    // All models failed
    yield {
      text: 'I apologize, but I&apos;m experiencing technical difficulties. Please try again later.',
      metadata: {
        error: true,
        allModelsFailed: true
      }
    };
  }
}
```

## WebSocket Integration

### WebSocket Streaming Server

```javascript
import { WebSocketServer } from 'ws';

class StreamingWebSocketServer {
  constructor(router, port = 8080) {
    this.router = router;
    this.wss = new WebSocketServer({ port });
    this.activeStreams = new Map();
    
    this.wss.on('connection', (ws) => {
      this.handleConnection(ws);
    });
  }
  
  handleConnection(ws) {
    const connectionId = `ws-${Date.now()}-${Math.random()}`;
    console.log(`WebSocket connected: ${connectionId}`);
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(ws, connectionId, message);
      } catch (error) {
        this.sendError(ws, 'Invalid message format');
      }
    });
    
    ws.on('close', () => {
      this.cleanup(connectionId);
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error: ${error.message}`);
      this.cleanup(connectionId);
    });
  }
  
  async handleMessage(ws, connectionId, message) {
    switch (message.type) {
      case 'start_stream':
        await this.startStream(ws, connectionId, message);
        break;
        
      case 'stop_stream':
        this.stopStream(connectionId, message.streamId);
        break;
        
      case 'pause_stream':
        this.pauseStream(connectionId, message.streamId);
        break;
        
      case 'resume_stream':
        await this.resumeStream(ws, connectionId, message);
        break;
        
      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }
  
  async startStream(ws, connectionId, message) {
    const { streamId, prompt, options } = message;
    
    try {
      const stream = await this.router.generateStream(prompt, options);
      
      const streamInfo = {
        id: streamId,
        ws,
        stream,
        active: true,
        startTime: Date.now()
      };
      
      this.activeStreams.set(`${connectionId}-${streamId}`, streamInfo);
      
      // Start streaming
      this.processStream(connectionId, streamInfo);
      
      this.sendMessage(ws, {
        type: 'stream_started',
        streamId,
        timestamp: Date.now()
      });
      
    } catch (error) {
      this.sendError(ws, `Failed to start stream: ${error.message}`);
    }
  }
  
  async processStream(connectionId, streamInfo) {
    try {
      for await (const chunk of streamInfo.stream) {
        if (!streamInfo.active) break;
        
        this.sendMessage(streamInfo.ws, {
          type: 'stream_chunk',
          streamId: streamInfo.id,
          chunk: {
            text: chunk.text,
            tokens: chunk.tokens,
            progress: chunk.progress,
            metadata: chunk.metadata
          },
          timestamp: Date.now()
        });
      }
      
      this.sendMessage(streamInfo.ws, {
        type: 'stream_complete',
        streamId: streamInfo.id,
        duration: Date.now() - streamInfo.startTime,
        timestamp: Date.now()
      });
      
    } catch (error) {
      this.sendError(streamInfo.ws, `Stream error: ${error.message}`);
    } finally {
      this.activeStreams.delete(`${connectionId}-${streamInfo.id}`);
    }
  }
  
  sendMessage(ws, message) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
  
  sendError(ws, error) {
    this.sendMessage(ws, {
      type: 'error',
      error,
      timestamp: Date.now()
    });
  }
  
  cleanup(connectionId) {
    // Clean up all streams for this connection
    for (const [key, stream] of this.activeStreams) {
      if (key.startsWith(connectionId)) {
        stream.active = false;
        this.activeStreams.delete(key);
      }
    }
  }
}

// Usage
const streamingServer = new StreamingWebSocketServer(router, 8080);
console.log('WebSocket streaming server started on port 8080');
```

### WebSocket Client

```javascript
class StreamingWebSocketClient {
  constructor(url = 'ws://localhost:8080') {
    this.url = url;
    this.ws = null;
    this.streams = new Map();
    this.eventListeners = new Map();
  }
  
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.reconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
    });
  }
  
  handleMessage(message) {
    switch (message.type) {
      case 'stream_started':
        this.emit('streamStarted', message);
        break;
        
      case 'stream_chunk':
        this.handleStreamChunk(message);
        break;
        
      case 'stream_complete':
        this.handleStreamComplete(message);
        break;
        
      case 'error':
        this.emit('error', message);
        break;
    }
  }
  
  handleStreamChunk(message) {
    const stream = this.streams.get(message.streamId);
    if (stream && stream.onChunk) {
      stream.onChunk(message.chunk);
    }
    this.emit('chunk', message);
  }
  
  handleStreamComplete(message) {
    const stream = this.streams.get(message.streamId);
    if (stream && stream.onComplete) {
      stream.onComplete(message);
    }
    this.streams.delete(message.streamId);
    this.emit('complete', message);
  }
  
  startStream(prompt, options = {}) {
    const streamId = `stream-${Date.now()}-${Math.random()}`;
    
    return new Promise((resolve, reject) => {
      const stream = {
        id: streamId,
        onChunk: options.onChunk,
        onComplete: options.onComplete,
        onError: options.onError
      };
      
      this.streams.set(streamId, stream);
      
      this.send({
        type: 'start_stream',
        streamId,
        prompt,
        options: {
          maxTokens: options.maxTokens,
          temperature: options.temperature,
          model: options.model
        }
      });
      
      resolve(streamId);
    });
  }
  
  stopStream(streamId) {
    this.send({
      type: 'stop_stream',
      streamId
    });
    this.streams.delete(streamId);
  }
  
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
  
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }
  
  emit(event, data) {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(callback => callback(data));
  }
  
  async reconnect() {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.connect();
    } catch (error) {
      console.error('Reconnection failed:', error);
      setTimeout(() => this.reconnect(), 5000);
    }
  }
}

// Usage
const client = new StreamingWebSocketClient();

await client.connect();

const streamId = await client.startStream(
  'Tell me about artificial intelligence',
  {
    maxTokens: 500,
    onChunk: (chunk) => {
      console.log('Received:', chunk.text);
    },
    onComplete: (result) => {
      console.log('Stream completed:', result);
    }
  }
);
```

## React Integration

### Streaming Hook

```javascript
import { useState, useEffect, useCallback } from 'react';

function useStreaming(client) {
  const [streams, setStreams] = useState(new Map());
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    const connect = async () => {
      try {
        await client.connect();
        setIsConnected(true);
      } catch (error) {
        console.error('Failed to connect:', error);
      }
    };
    
    connect();
    
    client.on('chunk', (message) => {
      setStreams(prev => {
        const newStreams = new Map(prev);
        const stream = newStreams.get(message.streamId);
        if (stream) {
          newStreams.set(message.streamId, {
            ...stream,
            content: stream.content + message.chunk.text,
            progress: message.chunk.progress
          });
        }
        return newStreams;
      });
    });
    
    client.on('complete', (message) => {
      setStreams(prev => {
        const newStreams = new Map(prev);
        const stream = newStreams.get(message.streamId);
        if (stream) {
          newStreams.set(message.streamId, {
            ...stream,
            complete: true,
            duration: message.duration
          });
        }
        return newStreams;
      });
    });
    
    return () => {
      client.disconnect();
    };
  }, [client]);
  
  const startStream = useCallback(async (prompt, options = {}) => {
    const streamId = await client.startStream(prompt, options);
    
    setStreams(prev => new Map(prev).set(streamId, {
      id: streamId,
      prompt,
      content: '',
      progress: null,
      complete: false,
      startTime: Date.now()
    }));
    
    return streamId;
  }, [client]);
  
  const stopStream = useCallback((streamId) => {
    client.stopStream(streamId);
    setStreams(prev => {
      const newStreams = new Map(prev);
      newStreams.delete(streamId);
      return newStreams;
    });
  }, [client]);
  
  return {
    streams: Array.from(streams.values()),
    isConnected,
    startStream,
    stopStream
  };
}

// React component
function StreamingChat() {
  const client = new StreamingWebSocketClient();
  const { streams, isConnected, startStream, stopStream } = useStreaming(client);
  const [input, setInput] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (input.trim() && isConnected) {
      await startStream(input, {
        maxTokens: 500,
        temperature: 0.7
      });
      setInput('');
    }
  };
  
  return (
    <div className="streaming-chat">
      <div className="messages">
        {streams.map(stream => (
          <div key={stream.id} className="message">
            <div className="prompt">{stream.prompt}</div>
            <div className="response">
              {stream.content}
              {!stream.complete && <span className="cursor">|</span>}
            </div>
            {stream.progress && (
              <div className="progress">
                Progress: {stream.progress.percentage?.toFixed(1)}%
              </div>
            )}
            {!stream.complete && (
              <button onClick={() => stopStream(stream.id)}>
                Stop
              </button>
            )}
          </div>
        ))}
      </div>
      
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={!isConnected}
        />
        <button type="submit" disabled={!isConnected || !input.trim()}>
          Send
        </button>
      </form>
      
      <div className="status">
        Status: {isConnected ? 'Connected' : 'Disconnected'}
      </div>
    </div>
  );
}
```

## Advanced Patterns

### Stream Composition

```javascript
class StreamComposer {
  constructor(router) {
    this.router = router;
  }
  
  // Combine multiple streams into one
  async *combineStreams(...streams) {
    const iterators = streams.map(stream => stream[Symbol.asyncIterator]());
    const results = new Array(streams.length).fill(null);
    let activeCount = streams.length;
    
    while (activeCount > 0) {
      const promises = iterators.map(async (it, index) => {
        if (results[index] === null) {
          try {
            const result = await it.next();
            return { index, result };
          } catch (error) {
            return { index, error };
          }
        }
        return null;
      });
      
      const settled = await Promise.allSettled(promises);
      
      for (const { value } of settled) {
        if (!value) continue;
        
        const { index, result, error } = value;
        
        if (error) {
          results[index] = { done: true };
          activeCount--;
        } else if (result.done) {
          results[index] = result;
          activeCount--;
        } else {
          yield {
            streamIndex: index,
            chunk: result.value,
            activeStreams: activeCount
          };
        }
      }
    }
  }
  
  // Transform stream content
  async *transformStream(stream, transformer) {
    for await (const chunk of stream) {
      const transformed = await transformer(chunk);
      if (transformed !== null) {
        yield transformed;
      }
    }
  }
  
  // Filter stream content
  async *filterStream(stream, predicate) {
    for await (const chunk of stream) {
      if (await predicate(chunk)) {
        yield chunk;
      }
    }
  }
  
  // Accumulate stream content
  async *accumulateStream(stream, accumulator = '') {
    for await (const chunk of stream) {
      accumulator += chunk.text || '';
      yield {
        ...chunk,
        accumulated: accumulator
      };
    }
  }
}

// Usage examples
const composer = new StreamComposer(router);

// Combine multiple model responses
const stream1 = router.generateStream('Explain AI', { model: 'gpt-4' });
const stream2 = router.generateStream('Explain AI', { model: 'claude' });

for await (const combined of composer.combineStreams(stream1, stream2)) {
  console.log(`Stream ${combined.streamIndex}:`, combined.chunk.text);
}

// Transform to uppercase
const upperStream = composer.transformStream(
  router.generateStream('Hello world'),
  (chunk) => ({
    ...chunk,
    text: chunk.text?.toUpperCase()
  })
);

// Filter only meaningful chunks
const filteredStream = composer.filterStream(
  router.generateStream('Generate text with spaces'),
  (chunk) => chunk.text && chunk.text.trim().length > 0
);
```

### Rate Limiting

```javascript
class RateLimitedStreamer {
  constructor(router, options = {}) {
    this.router = router;
    this.tokensPerSecond = options.tokensPerSecond || 100;
    this.burstSize = options.burstSize || 200;
    this.bucket = this.burstSize;
    this.lastRefill = Date.now();
  }
  
  async *createRateLimitedStream(prompt, options = {}) {
    const stream = await this.router.generateStream(prompt, options);
    
    for await (const chunk of stream) {
      await this.waitForTokens(chunk.tokens || 1);
      yield chunk;
    }
  }
  
  async waitForTokens(tokenCount) {
    this.refillBucket();
    
    while (this.bucket < tokenCount) {
      const waitTime = (tokenCount - this.bucket) / this.tokensPerSecond * 1000;
      await this.sleep(Math.min(waitTime, 1000)); // Max 1 second wait
      this.refillBucket();
    }
    
    this.bucket -= tokenCount;
  }
  
  refillBucket() {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.tokensPerSecond;
    
    this.bucket = Math.min(this.burstSize, this.bucket + tokensToAdd);
    this.lastRefill = now;
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Monitoring and Debugging

### Stream Analytics

```javascript
class StreamAnalytics {
  constructor() {
    this.metrics = {
      streamsCreated: 0,
      streamsCompleted: 0,
      streamsFailed: 0,
      totalTokens: 0,
      totalLatency: 0,
      averageLatency: 0
    };
    
    this.activeStreams = new Set();
    this.streamHistory = [];
  }
  
  trackStreamStart(streamId, metadata = {}) {
    this.metrics.streamsCreated++;
    this.activeStreams.add(streamId);
    
    const streamInfo = {
      id: streamId,
      startTime: Date.now(),
      metadata,
      chunks: 0,
      tokens: 0,
      status: 'active'
    };
    
    this.streamHistory.push(streamInfo);
    return streamInfo;
  }
  
  trackStreamChunk(streamId, chunk) {
    const stream = this.streamHistory.find(s => s.id === streamId);
    if (stream) {
      stream.chunks++;
      stream.tokens += chunk.tokens || 1;
      stream.lastChunk = Date.now();
    }
    
    this.metrics.totalTokens += chunk.tokens || 1;
  }
  
  trackStreamComplete(streamId) {
    this.activeStreams.delete(streamId);
    this.metrics.streamsCompleted++;
    
    const stream = this.streamHistory.find(s => s.id === streamId);
    if (stream) {
      stream.status = 'completed';
      stream.endTime = Date.now();
      stream.duration = stream.endTime - stream.startTime;
      
      this.metrics.totalLatency += stream.duration;
      this.metrics.averageLatency = this.metrics.totalLatency / this.metrics.streamsCompleted;
    }
  }
  
  trackStreamError(streamId, error) {
    this.activeStreams.delete(streamId);
    this.metrics.streamsFailed++;
    
    const stream = this.streamHistory.find(s => s.id === streamId);
    if (stream) {
      stream.status = 'failed';
      stream.error = error.message;
      stream.endTime = Date.now();
    }
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      activeStreams: this.activeStreams.size,
      successRate: this.metrics.streamsCompleted / (this.metrics.streamsCompleted + this.metrics.streamsFailed),
      tokensPerSecond: this.metrics.totalTokens / (this.metrics.totalLatency / 1000)
    };
  }
  
  getStreamHistory(limit = 100) {
    return this.streamHistory.slice(-limit);
  }
  
  generateReport() {
    const metrics = this.getMetrics();
    const recentStreams = this.getStreamHistory(50);
    
    return {
      summary: {
        totalStreams: metrics.streamsCreated,
        successRate: `${(metrics.successRate * 100).toFixed(1)}%`,
        averageLatency: `${metrics.averageLatency.toFixed(0)}ms`,
        tokensPerSecond: metrics.tokensPerSecond.toFixed(1)
      },
      performance: {
        fastestStream: Math.min(...recentStreams.map(s => s.duration || Infinity)),
        slowestStream: Math.max(...recentStreams.map(s => s.duration || 0)),
        averageChunks: recentStreams.reduce((sum, s) => sum + s.chunks, 0) / recentStreams.length
      },
      errors: recentStreams.filter(s => s.status === 'failed').map(s => ({
        id: s.id,
        error: s.error,
        timestamp: new Date(s.startTime).toISOString()
      }))
    };
  }
}

// Usage
const analytics = new StreamAnalytics();

// Instrument your streamer
class InstrumentedStreamer {
  constructor(router, analytics) {
    this.router = router;
    this.analytics = analytics;
  }
  
  async *createInstrumentedStream(prompt, options = {}) {
    const streamId = `stream-${Date.now()}-${Math.random()}`;
    const streamInfo = this.analytics.trackStreamStart(streamId, { prompt, options });
    
    try {
      const stream = await this.router.generateStream(prompt, options);
      
      for await (const chunk of stream) {
        this.analytics.trackStreamChunk(streamId, chunk);
        yield chunk;
      }
      
      this.analytics.trackStreamComplete(streamId);
      
    } catch (error) {
      this.analytics.trackStreamError(streamId, error);
      throw error;
    }
  }
}
```

### Debug Utilities

```javascript
class StreamDebugger {
  constructor() {
    this.debugMode = process.env.NODE_ENV === 'development';
    this.logs = [];
  }
  
  wrapStream(stream, streamId = 'debug') {
    if (!this.debugMode) return stream;
    
    return this.createDebugWrapper(stream, streamId);
  }
  
  async *createDebugWrapper(stream, streamId) {
    let chunkCount = 0;
    let totalTokens = 0;
    const startTime = Date.now();
    
    this.log(`🟢 Stream ${streamId} started`);
    
    try {
      for await (const chunk of stream) {
        chunkCount++;
        totalTokens += chunk.tokens || 1;
        
        this.log(`📦 Chunk ${chunkCount}: ${JSON.stringify(chunk, null, 2)}`);
        
        yield chunk;
      }
      
      const duration = Date.now() - startTime;
      this.log(`✅ Stream ${streamId} completed: ${chunkCount} chunks, ${totalTokens} tokens, ${duration}ms`);
      
    } catch (error) {
      this.log(`❌ Stream ${streamId} error: ${error.message}`);
      throw error;
    }
  }
  
  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    
    console.log(logEntry);
    this.logs.push(logEntry);
    
    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
  }
  
  getLogs(filter = null) {
    if (filter) {
      return this.logs.filter(log => log.includes(filter));
    }
    return this.logs;
  }
  
  exportLogs() {
    return {
      timestamp: new Date().toISOString(),
      logs: this.logs,
      summary: {
        totalLogs: this.logs.length,
        errors: this.logs.filter(log => log.includes('❌')).length,
        streams: this.logs.filter(log => log.includes('🟢')).length
      }
    };
  }
}

// Usage
const debugger = new StreamDebugger();

const debugStream = debugger.wrapStream(
  router.generateStream('Debug this stream'),
  'test-stream-001'
);

for await (const chunk of debugStream) {
  // Your normal processing
}
```

## Best Practices

### 1. Resource Management

```javascript
// Always clean up streams
class ResourceManagedStreamer {
  constructor(router) {
    this.router = router;
    this.activeStreams = new Set();
  }
  
  async *createManagedStream(prompt, options = {}) {
    const streamId = `stream-${Date.now()}`;
    this.activeStreams.add(streamId);
    
    try {
      const stream = await this.router.generateStream(prompt, options);
      
      for await (const chunk of stream) {
        yield chunk;
      }
    } finally {
      this.activeStreams.delete(streamId);
    }
  }
  
  cleanup() {
    // Cancel all active streams
    for (const streamId of this.activeStreams) {
      this.cancelStream(streamId);
    }
    this.activeStreams.clear();
  }
}
```

### 2. Error Boundaries

```javascript
// Implement proper error boundaries
async function safeStreamProcessing(stream, onError = null) {
  try {
    for await (const chunk of stream) {
      try {
        // Process chunk safely
        yield processChunk(chunk);
      } catch (chunkError) {
        // Handle individual chunk errors
        if (onError) {
          onError(chunkError, chunk);
        } else {
          console.warn('Chunk processing error:', chunkError);
        }
      }
    }
  } catch (streamError) {
    // Handle stream-level errors
    if (onError) {
      onError(streamError);
    } else {
      throw streamError;
    }
  }
}
```

### 3. Performance Monitoring

```javascript
// Monitor stream performance
function monitorStreamPerformance(stream) {
  return async function* () {
    let chunkCount = 0;
    let totalLatency = 0;
    const startTime = Date.now();
    
    for await (const chunk of stream) {
      chunkCount++;
      
      if (chunk.metadata?.latency) {
        totalLatency += chunk.metadata.latency;
      }
      
      // Emit performance metadata
      yield {
        ...chunk,
        performance: {
          chunkNumber: chunkCount,
          averageLatency: totalLatency / chunkCount,
          streamDuration: Date.now() - startTime
        }
      };
    }
  }();
}
```

### 4. Graceful Shutdown

```javascript
// Implement graceful shutdown
class GracefulStreamManager {
  constructor() {
    this.streams = new Set();
    this.shutdownPromise = null;
  }
  
  registerStream(stream) {
    this.streams.add(stream);
    return stream;
  }
  
  async shutdown(timeout = 30000) {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }
    
    this.shutdownPromise = this.performShutdown(timeout);
    return this.shutdownPromise;
  }
  
  async performShutdown(timeout) {
    console.log(`Shutting down ${this.streams.size} active streams...`);
    
    const shutdownPromises = Array.from(this.streams).map(stream => 
      this.shutdownStream(stream, timeout)
    );
    
    await Promise.allSettled(shutdownPromises);
    console.log('All streams shut down');
  }
  
  async shutdownStream(stream, timeout) {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Shutdown timeout')), timeout)
    );
    
    try {
      // Try to gracefully close the stream
      if (stream.close) {
        await Promise.race([stream.close(), timeoutPromise]);
      }
    } catch (error) {
      console.warn('Stream shutdown error:', error.message);
    } finally {
      this.streams.delete(stream);
    }
  }
}
```

---

This streaming architecture guide provides comprehensive coverage of real-time token streaming in LLM-Runner-Router. Use these patterns and components to build responsive, scalable streaming applications.

For additional information, see:
- [Architecture Documentation](./ARCHITECTURE.md)
- [Error Codes Reference](./ERROR_CODES.md)
- [Integration Guide](./INTEGRATION.md)
- [Performance Optimization](./COST_OPTIMIZATION.md)