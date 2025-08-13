# Streaming Examples

Real-time token streaming, progress tracking, and interactive applications with LLM-Runner-Router.

## Table of Contents
- [Basic Streaming](#basic-streaming)
- [Event-Based Streaming](#event-based-streaming)
- [Browser Streaming](#browser-streaming)
- [Node.js Streaming](#nodejs-streaming)
- [Chat Applications](#chat-applications)
- [Progress Tracking](#progress-tracking)
- [Performance Optimization](#performance-optimization)
- [Error Handling](#error-handling)

## Basic Streaming

### 1. Simple Token Streaming

```javascript
import LLMRouter from 'llm-runner-router';

const router = new LLMRouter({
  strategy: 'speed-priority' // Optimize for streaming
});

await router.initialize();

// Basic streaming
const stream = router.stream("Write a story about a robot learning to paint");

console.log('Streaming response:');
for await (const token of stream) {
  process.stdout.write(token);
}
console.log('\nStream complete!');
```

**Expected Output:**
```
Streaming response:
In a small workshop filled with canvases and brushes, a curious robot named Artie discovered the magic of color...
Stream complete!
```

### 2. Streaming with Options

```javascript
import LLMRouter from 'llm-runner-router';

const router = new LLMRouter();
await router.initialize();

const stream = router.stream("Explain machine learning", {
  maxTokens: 300,
  temperature: 0.7,
  model: 'llama-7b', // Specific model
  stopSequences: ['\n\n', '###'], // Stop conditions
});

let tokenCount = 0;
const startTime = Date.now();

for await (const token of stream) {
  tokenCount++;
  process.stdout.write(token);
  
  // Show progress every 10 tokens
  if (tokenCount % 10 === 0) {
    const elapsed = Date.now() - startTime;
    const tokensPerSecond = (tokenCount / elapsed * 1000).toFixed(1);
    process.stderr.write(`\n[${tokenCount} tokens, ${tokensPerSecond} tok/s]\n`);
  }
}

console.log(`\nGenerated ${tokenCount} tokens in ${Date.now() - startTime}ms`);
```

### 3. Streaming to File

```javascript
import LLMRouter from 'llm-runner-router';
import fs from 'fs';
import { pipeline } from 'stream';
import { Readable } from 'stream';

const router = new LLMRouter();
await router.initialize();

// Create a readable stream from the token stream
async function* tokenToStream() {
  const stream = router.stream("Write a comprehensive guide to Node.js streams");
  
  for await (const token of stream) {
    yield token;
  }
}

// Convert async generator to readable stream
const readable = Readable.from(tokenToStream());

// Stream directly to file
const writeStream = fs.createWriteStream('output.txt');

pipeline(readable, writeStream, (error) => {
  if (error) {
    console.error('Pipeline error:', error);
  } else {
    console.log('Stream saved to output.txt');
  }
});
```

## Event-Based Streaming

### 1. Stream with Events

```javascript
import LLMRouter from 'llm-runner-router';

const router = new LLMRouter();
await router.initialize();

const stream = router.streamWithEvents(
  "Create a detailed plan for building a web application", 
  {
    maxTokens: 500,
    temperature: 0.5
  }
);

// Event listeners
stream.on('start', (context) => {
  console.log(`🚀 Starting generation with model: ${context.model}`);
  console.log(`📝 Prompt: ${context.prompt.substring(0, 50)}...`);
});

stream.on('token', (token, metadata) => {
  process.stdout.write(token);
  
  if (metadata.isNewSentence) {
    console.log(`\n[Sentence ${metadata.sentenceCount}]`);
  }
});

stream.on('progress', (info) => {
  const progress = (info.tokensGenerated / info.maxTokens * 100).toFixed(1);
  console.log(`\n📊 Progress: ${progress}% (${info.tokensGenerated}/${info.maxTokens})`);
});

stream.on('complete', (result) => {
  console.log('\n✅ Generation complete!');
  console.log(`📈 Stats: ${result.tokens} tokens in ${result.latency}ms`);
  console.log(`🎯 Model: ${result.model}`);
  console.log(`⚡ Speed: ${(result.tokens / result.latency * 1000).toFixed(1)} tok/s`);
});

stream.on('error', (error) => {
  console.error('❌ Stream error:', error.message);
});

// Start the stream
await stream.start();
```

### 2. Custom Event Handler

```javascript
import LLMRouter from 'llm-runner-router';
import EventEmitter from 'events';

class StreamManager extends EventEmitter {
  constructor() {
    super();
    this.router = new LLMRouter();
    this.activeStreams = new Map();
  }
  
  async initialize() {
    await this.router.initialize();
  }
  
  async startStream(streamId, prompt, options = {}) {
    const stream = this.router.stream(prompt, options);
    
    const streamState = {
      id: streamId,
      prompt,
      startTime: Date.now(),
      tokens: [],
      tokenCount: 0
    };
    
    this.activeStreams.set(streamId, streamState);
    
    this.emit('stream:started', { streamId, prompt });
    
    try {
      for await (const token of stream) {
        streamState.tokens.push(token);
        streamState.tokenCount++;
        
        this.emit('stream:token', {
          streamId,
          token,
          position: streamState.tokenCount,
          text: streamState.tokens.join('')
        });
        
        // Emit progress updates
        if (streamState.tokenCount % 5 === 0) {
          this.emit('stream:progress', {
            streamId,
            tokenCount: streamState.tokenCount,
            elapsedTime: Date.now() - streamState.startTime,
            currentText: streamState.tokens.join('')
          });
        }
      }
      
      const finalResult = {
        streamId,
        text: streamState.tokens.join(''),
        tokenCount: streamState.tokenCount,
        duration: Date.now() - streamState.startTime
      };
      
      this.emit('stream:completed', finalResult);
      this.activeStreams.delete(streamId);
      
      return finalResult;
      
    } catch (error) {
      this.emit('stream:error', { streamId, error });
      this.activeStreams.delete(streamId);
      throw error;
    }
  }
  
  getActiveStreams() {
    return Array.from(this.activeStreams.keys());
  }
  
  getStreamState(streamId) {
    return this.activeStreams.get(streamId);
  }
}

// Usage
const manager = new StreamManager();
await manager.initialize();

// Set up event listeners
manager.on('stream:started', ({ streamId, prompt }) => {
  console.log(`🎬 Stream ${streamId} started`);
});

manager.on('stream:token', ({ streamId, token, position }) => {
  process.stdout.write(token);
});

manager.on('stream:progress', ({ streamId, tokenCount, elapsedTime }) => {
  const tokensPerSecond = (tokenCount / elapsedTime * 1000).toFixed(1);
  process.stderr.write(`\r📊 ${streamId}: ${tokenCount} tokens (${tokensPerSecond} tok/s)`);
});

manager.on('stream:completed', ({ streamId, tokenCount, duration }) => {
  console.log(`\n✅ Stream ${streamId} completed: ${tokenCount} tokens in ${duration}ms`);
});

// Start a stream
const result = await manager.startStream(
  'story-1',
  "Write a short story about time travel"
);
```

## Browser Streaming

### 1. Real-time Web Interface

```html
<!DOCTYPE html>
<html>
<head>
    <title>LLM Streaming Demo</title>
    <style>
        .container { max-width: 800px; margin: 20px auto; padding: 20px; }
        .input-section { margin-bottom: 20px; }
        .prompt-input { width: 100%; height: 100px; margin-bottom: 10px; }
        .output-section { border: 1px solid #ccc; padding: 15px; min-height: 200px; }
        .progress-bar { width: 100%; height: 20px; background: #f0f0f0; margin: 10px 0; }
        .progress-fill { height: 100%; background: #007bff; transition: width 0.3s; }
        .stats { font-family: monospace; color: #666; font-size: 12px; }
        .streaming { color: #007bff; }
        .completed { color: #28a745; }
        .error { color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 LLM Streaming Interface</h1>
        
        <div class="input-section">
            <textarea 
                id="promptInput" 
                class="prompt-input" 
                placeholder="Enter your prompt here..."
            >Explain the concept of artificial intelligence and its applications</textarea>
            
            <div>
                <label>Max Tokens: <input id="maxTokens" type="number" value="300" min="50" max="1000"></label>
                <label>Temperature: <input id="temperature" type="number" value="0.7" min="0" max="2" step="0.1"></label>
                <button id="generateBtn">Generate</button>
                <button id="stopBtn" disabled>Stop</button>
            </div>
        </div>
        
        <div class="output-section">
            <div class="stats">
                <span id="status">Ready</span> | 
                Tokens: <span id="tokenCount">0</span> | 
                Speed: <span id="speed">0</span> tok/s | 
                Time: <span id="elapsed">0</span>s
            </div>
            
            <div class="progress-bar">
                <div id="progressFill" class="progress-fill" style="width: 0%"></div>
            </div>
            
            <div id="output"></div>
        </div>
    </div>

    <script type="module">
        import LLMRouter from 'llm-runner-router';
        
        class StreamingInterface {
            constructor() {
                this.router = new LLMRouter({
                    strategy: 'speed-priority'
                });
                this.currentStream = null;
                this.startTime = 0;
                this.tokenCount = 0;
                
                this.initializeElements();
                this.bindEvents();
                this.initialize();
            }
            
            initializeElements() {
                this.promptInput = document.getElementById('promptInput');
                this.maxTokensInput = document.getElementById('maxTokens');
                this.temperatureInput = document.getElementById('temperature');
                this.generateBtn = document.getElementById('generateBtn');
                this.stopBtn = document.getElementById('stopBtn');
                this.output = document.getElementById('output');
                this.status = document.getElementById('status');
                this.tokenCountDisplay = document.getElementById('tokenCount');
                this.speedDisplay = document.getElementById('speed');
                this.elapsedDisplay = document.getElementById('elapsed');
                this.progressFill = document.getElementById('progressFill');
            }
            
            bindEvents() {
                this.generateBtn.addEventListener('click', () => this.startGeneration());
                this.stopBtn.addEventListener('click', () => this.stopGeneration());
                
                this.promptInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        this.startGeneration();
                    }
                });
            }
            
            async initialize() {
                this.setStatus('Initializing...', 'streaming');
                try {
                    await this.router.initialize();
                    this.setStatus('Ready', 'completed');
                } catch (error) {
                    this.setStatus(`Error: ${error.message}`, 'error');
                }
            }
            
            async startGeneration() {
                const prompt = this.promptInput.value.trim();
                if (!prompt) return;
                
                const options = {
                    maxTokens: parseInt(this.maxTokensInput.value),
                    temperature: parseFloat(this.temperatureInput.value)
                };
                
                this.resetUI();
                this.setGenerating(true);
                this.setStatus('Generating...', 'streaming');
                
                try {
                    this.currentStream = this.router.stream(prompt, options);
                    this.startTime = Date.now();
                    
                    for await (const token of this.currentStream) {
                        if (!this.currentStream) break; // Stream was stopped
                        
                        this.appendToken(token);
                        this.updateStats();
                    }
                    
                    this.setStatus('Completed', 'completed');
                } catch (error) {
                    this.setStatus(`Error: ${error.message}`, 'error');
                    this.appendText(`\n\n❌ Error: ${error.message}`);
                } finally {
                    this.setGenerating(false);
                    this.currentStream = null;
                }
            }
            
            stopGeneration() {
                if (this.currentStream) {
                    this.currentStream = null; // This will break the for-await loop
                    this.setStatus('Stopped', 'error');
                    this.setGenerating(false);
                }
            }
            
            appendToken(token) {
                this.tokenCount++;
                this.output.textContent += token;
                this.output.scrollTop = this.output.scrollHeight;
            }
            
            appendText(text) {
                this.output.textContent += text;
                this.output.scrollTop = this.output.scrollHeight;
            }
            
            updateStats() {
                const elapsed = (Date.now() - this.startTime) / 1000;
                const speed = this.tokenCount / elapsed;
                const maxTokens = parseInt(this.maxTokensInput.value);
                const progress = Math.min((this.tokenCount / maxTokens) * 100, 100);
                
                this.tokenCountDisplay.textContent = this.tokenCount;
                this.speedDisplay.textContent = speed.toFixed(1);
                this.elapsedDisplay.textContent = elapsed.toFixed(1);
                this.progressFill.style.width = `${progress}%`;
            }
            
            resetUI() {
                this.tokenCount = 0;
                this.output.textContent = '';
                this.tokenCountDisplay.textContent = '0';
                this.speedDisplay.textContent = '0';
                this.elapsedDisplay.textContent = '0';
                this.progressFill.style.width = '0%';
            }
            
            setGenerating(generating) {
                this.generateBtn.disabled = generating;
                this.stopBtn.disabled = !generating;
                this.promptInput.disabled = generating;
                this.maxTokensInput.disabled = generating;
                this.temperatureInput.disabled = generating;
            }
            
            setStatus(text, type) {
                this.status.textContent = text;
                this.status.className = type;
            }
        }
        
        // Initialize the interface
        new StreamingInterface();
    </script>
</body>
</html>
```

### 2. WebSocket Streaming

```javascript
// client.js - Browser side
class WebSocketStreamer {
    constructor(serverUrl = 'ws://localhost:8080') {
        this.ws = null;
        this.serverUrl = serverUrl;
        this.callbacks = {};
        this.connect();
    }
    
    connect() {
        this.ws = new WebSocket(this.serverUrl);
        
        this.ws.onopen = () => {
            console.log('✅ Connected to streaming server');
            this.emit('connected');
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };
        
        this.ws.onclose = () => {
            console.log('❌ Disconnected from server');
            this.emit('disconnected');
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.emit('error', error);
        };
    }
    
    handleMessage(data) {
        switch (data.type) {
            case 'stream_start':
                this.emit('streamStart', data.streamId);
                break;
            case 'token':
                this.emit('token', data.streamId, data.token);
                break;
            case 'stream_complete':
                this.emit('streamComplete', data.streamId, data.result);
                break;
            case 'error':
                this.emit('streamError', data.streamId, data.error);
                break;
        }
    }
    
    startStream(prompt, options = {}) {
        const streamId = `stream_${Date.now()}`;
        this.ws.send(JSON.stringify({
            type: 'start_stream',
            streamId,
            prompt,
            options
        }));
        return streamId;
    }
    
    stopStream(streamId) {
        this.ws.send(JSON.stringify({
            type: 'stop_stream',
            streamId
        }));
    }
    
    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    }
    
    emit(event, ...args) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => callback(...args));
        }
    }
}

// Usage
const streamer = new WebSocketStreamer();

streamer.on('connected', () => {
    const streamId = streamer.startStream("Write a poem about the ocean");
    
    streamer.on('token', (id, token) => {
        if (id === streamId) {
            document.getElementById('output').textContent += token;
        }
    });
    
    streamer.on('streamComplete', (id, result) => {
        if (id === streamId) {
            console.log('Stream completed:', result);
        }
    });
});
```

## Node.js Streaming

### 1. Express Streaming Endpoint

```javascript
// server.js
import express from 'express';
import LLMRouter from 'llm-runner-router';

const app = express();
const router = new LLMRouter();

await router.initialize();

app.use(express.json());

// Server-Sent Events endpoint
app.get('/stream', async (req, res) => {
    const { prompt, maxTokens = 300, temperature = 0.7 } = req.query;
    
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // Set up SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    // Send initial message
    res.write(`data: ${JSON.stringify({ type: 'start', prompt })}\n\n`);
    
    try {
        const stream = router.stream(prompt, {
            maxTokens: parseInt(maxTokens),
            temperature: parseFloat(temperature)
        });
        
        let tokenCount = 0;
        const startTime = Date.now();
        
        for await (const token of stream) {
            tokenCount++;
            
            // Send token
            res.write(`data: ${JSON.stringify({
                type: 'token',
                token,
                position: tokenCount,
                timestamp: Date.now()
            })}\n\n`);
            
            // Send progress every 10 tokens
            if (tokenCount % 10 === 0) {
                const elapsed = Date.now() - startTime;
                const speed = tokenCount / elapsed * 1000;
                
                res.write(`data: ${JSON.stringify({
                    type: 'progress',
                    tokenCount,
                    elapsedTime: elapsed,
                    tokensPerSecond: speed.toFixed(1)
                })}\n\n`);
            }
        }
        
        // Send completion message
        res.write(`data: ${JSON.stringify({
            type: 'complete',
            totalTokens: tokenCount,
            totalTime: Date.now() - startTime
        })}\n\n`);
        
    } catch (error) {
        res.write(`data: ${JSON.stringify({
            type: 'error',
            error: error.message
        })}\n\n`);
    } finally {
        res.end();
    }
});

// POST endpoint for streaming
app.post('/api/stream', async (req, res) => {
    const { prompt, options = {} } = req.body;
    
    res.writeHead(200, {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked'
    });
    
    try {
        const stream = router.stream(prompt, options);
        let fullText = '';
        
        for await (const token of stream) {
            fullText += token;
            
            // Send chunked JSON
            const chunk = JSON.stringify({
                token,
                fullText,
                isComplete: false
            });
            
            res.write(`${chunk}\n`);
        }
        
        // Send final chunk
        const finalChunk = JSON.stringify({
            fullText,
            isComplete: true,
            tokenCount: fullText.split(' ').length
        });
        
        res.write(`${finalChunk}\n`);
        
    } catch (error) {
        res.write(JSON.stringify({
            error: error.message,
            isComplete: true
        }));
    } finally {
        res.end();
    }
});

app.listen(3000, () => {
    console.log('🚀 Streaming server running on http://localhost:3000');
});
```

### 2. WebSocket Server

```javascript
// websocket-server.js
import WebSocket, { WebSocketServer } from 'ws';
import LLMRouter from 'llm-runner-router';

class StreamingServer {
    constructor(port = 8080) {
        this.port = port;
        this.router = new LLMRouter();
        this.clients = new Map();
        this.activeStreams = new Map();
    }
    
    async initialize() {
        await this.router.initialize();
        
        this.wss = new WebSocketServer({ port: this.port });
        
        this.wss.on('connection', (ws) => {
            const clientId = this.generateId();
            this.clients.set(clientId, ws);
            
            console.log(`📱 Client ${clientId} connected`);
            
            ws.on('message', (data) => {
                this.handleMessage(clientId, JSON.parse(data.toString()));
            });
            
            ws.on('close', () => {
                this.handleDisconnect(clientId);
            });
            
            ws.send(JSON.stringify({
                type: 'connected',
                clientId,
                capabilities: {
                    maxTokens: 2048,
                    supportedFormats: ['text', 'markdown']
                }
            }));
        });
        
        console.log(`🌐 Streaming server running on ws://localhost:${this.port}`);
    }
    
    async handleMessage(clientId, message) {
        const ws = this.clients.get(clientId);
        if (!ws) return;
        
        switch (message.type) {
            case 'start_stream':
                await this.startStream(clientId, message);
                break;
                
            case 'stop_stream':
                this.stopStream(message.streamId);
                break;
                
            case 'list_models':
                this.sendModelList(clientId);
                break;
        }
    }
    
    async startStream(clientId, { streamId, prompt, options = {} }) {
        const ws = this.clients.get(clientId);
        
        try {
            ws.send(JSON.stringify({
                type: 'stream_start',
                streamId,
                prompt,
                timestamp: Date.now()
            }));
            
            const stream = this.router.stream(prompt, options);
            this.activeStreams.set(streamId, { stream, clientId });
            
            let tokenCount = 0;
            const startTime = Date.now();
            let fullText = '';
            
            for await (const token of stream) {
                if (!this.activeStreams.has(streamId)) break; // Stream stopped
                
                tokenCount++;
                fullText += token;
                
                ws.send(JSON.stringify({
                    type: 'token',
                    streamId,
                    token,
                    position: tokenCount,
                    fullText,
                    timestamp: Date.now()
                }));
                
                // Periodic progress updates
                if (tokenCount % 5 === 0) {
                    const elapsed = Date.now() - startTime;
                    const speed = tokenCount / elapsed * 1000;
                    
                    ws.send(JSON.stringify({
                        type: 'progress',
                        streamId,
                        tokenCount,
                        elapsedTime: elapsed,
                        tokensPerSecond: speed.toFixed(1),
                        estimatedTimeRemaining: this.estimateTimeRemaining(tokenCount, options.maxTokens || 300, speed)
                    }));
                }
            }
            
            ws.send(JSON.stringify({
                type: 'stream_complete',
                streamId,
                result: {
                    text: fullText,
                    tokenCount,
                    duration: Date.now() - startTime,
                    completedAt: new Date().toISOString()
                }
            }));
            
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'error',
                streamId,
                error: error.message
            }));
        } finally {
            this.activeStreams.delete(streamId);
        }
    }
    
    stopStream(streamId) {
        if (this.activeStreams.has(streamId)) {
            this.activeStreams.delete(streamId);
        }
    }
    
    sendModelList(clientId) {
        const ws = this.clients.get(clientId);
        const models = this.router.registry.list().map(model => ({
            id: model.id,
            name: model.name,
            type: model.type,
            size: model.size,
            capabilities: model.capabilities
        }));
        
        ws.send(JSON.stringify({
            type: 'model_list',
            models
        }));
    }
    
    estimateTimeRemaining(currentTokens, maxTokens, speed) {
        if (speed <= 0) return null;
        const remainingTokens = maxTokens - currentTokens;
        return Math.round(remainingTokens / speed * 1000); // milliseconds
    }
    
    handleDisconnect(clientId) {
        console.log(`📱 Client ${clientId} disconnected`);
        
        // Stop all streams for this client
        for (const [streamId, streamInfo] of this.activeStreams.entries()) {
            if (streamInfo.clientId === clientId) {
                this.activeStreams.delete(streamId);
            }
        }
        
        this.clients.delete(clientId);
    }
    
    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }
}

// Start server
const server = new StreamingServer(8080);
await server.initialize();
```

## Chat Applications

### 1. Interactive Chat Interface

```javascript
import LLMRouter from 'llm-runner-router';
import readline from 'readline';

class InteractiveChat {
    constructor() {
        this.router = new LLMRouter({
            strategy: 'quality-first'
        });
        this.conversation = [];
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }
    
    async initialize() {
        await this.router.initialize();
        console.log('🤖 Chat initialized! Type "exit" to quit, "clear" to reset conversation.\n');
    }
    
    async start() {
        await this.initialize();
        this.askQuestion();
    }
    
    askQuestion() {
        this.rl.question('You: ', async (input) => {
            const message = input.trim();
            
            if (message.toLowerCase() === 'exit') {
                console.log('👋 Goodbye!');
                this.rl.close();
                return;
            }
            
            if (message.toLowerCase() === 'clear') {
                this.conversation = [];
                console.log('🧹 Conversation cleared!\n');
                this.askQuestion();
                return;
            }
            
            if (!message) {
                this.askQuestion();
                return;
            }
            
            await this.processMessage(message);
            this.askQuestion();
        });
    }
    
    async processMessage(message) {
        // Add user message to conversation
        this.conversation.push({ role: 'user', content: message });
        
        // Build context from conversation history
        const context = this.buildContext();
        
        console.log('🤖 Assistant: ');
        
        try {
            const stream = this.router.stream(context, {
                maxTokens: 400,
                temperature: 0.8,
                stopSequences: ['\nUser:', 'Human:']
            });
            
            let response = '';
            let lastProgressUpdate = Date.now();
            
            for await (const token of stream) {
                response += token;
                process.stdout.write(token);
                
                // Show typing indicator
                const now = Date.now();
                if (now - lastProgressUpdate > 100) { // Every 100ms
                    this.showTypingIndicator();
                    lastProgressUpdate = now;
                }
            }
            
            console.log('\n'); // New line after response
            
            // Add assistant response to conversation
            this.conversation.push({ role: 'assistant', content: response.trim() });
            
            // Keep conversation manageable (last 10 exchanges)
            if (this.conversation.length > 20) {
                this.conversation = this.conversation.slice(-20);
            }
            
        } catch (error) {
            console.log('❌ Error:', error.message);
        }
    }
    
    buildContext() {
        // Create a natural conversation format
        const contextMessages = this.conversation.map(msg => 
            msg.role === 'user' ? `Human: ${msg.content}` : `Assistant: ${msg.content}`
        ).join('\n\n');
        
        return `${contextMessages}\n\nAssistant:`;
    }
    
    showTypingIndicator() {
        // Simple typing indicator (you could make this more sophisticated)
        process.stdout.write('');
    }
}

// Usage
const chat = new InteractiveChat();
await chat.start();
```

### 2. Multi-User Chat Room

```javascript
import LLMRouter from 'llm-runner-router';
import WebSocket, { WebSocketServer } from 'ws';

class ChatRoom {
    constructor(roomId, router) {
        this.roomId = roomId;
        this.router = router;
        this.clients = new Map();
        this.conversation = [];
        this.botPersonality = "You are a helpful and friendly AI assistant in a chat room. Keep responses concise and engaging.";
    }
    
    addClient(clientId, ws) {
        this.clients.set(clientId, {
            ws,
            username: `User${clientId.slice(-4)}`,
            joinedAt: Date.now()
        });
        
        // Send room history to new client
        this.sendToClient(clientId, {
            type: 'room_joined',
            roomId: this.roomId,
            history: this.conversation.slice(-50), // Last 50 messages
            participants: Array.from(this.clients.values()).map(c => c.username)
        });
        
        // Notify others about new participant
        this.broadcast({
            type: 'user_joined',
            username: this.clients.get(clientId).username,
            timestamp: Date.now()
        }, clientId);
    }
    
    removeClient(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            this.broadcast({
                type: 'user_left',
                username: client.username,
                timestamp: Date.now()
            }, clientId);
            
            this.clients.delete(clientId);
        }
    }
    
    async handleMessage(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        const chatMessage = {
            id: this.generateMessageId(),
            username: client.username,
            content: message.content,
            timestamp: Date.now(),
            type: 'user_message'
        };
        
        this.conversation.push(chatMessage);
        
        // Broadcast user message to all clients
        this.broadcast({
            type: 'message',
            message: chatMessage
        });
        
        // Check if message mentions the bot or asks a question
        if (this.shouldBotRespond(message.content)) {
            await this.generateBotResponse();
        }
    }
    
    shouldBotRespond(content) {
        const triggers = ['bot', 'ai', 'assistant', '?', 'help', 'explain'];
        const lowerContent = content.toLowerCase();
        return triggers.some(trigger => lowerContent.includes(trigger));
    }
    
    async generateBotResponse() {
        // Build context from recent conversation
        const recentMessages = this.conversation.slice(-10);
        const context = `${this.botPersonality}\n\nRecent conversation:\n${
            recentMessages.map(msg => `${msg.username}: ${msg.content}`).join('\n')
        }\n\nBot:`;
        
        try {
            // Show typing indicator
            this.broadcast({
                type: 'typing',
                username: 'Bot',
                isTyping: true
            });
            
            const stream = this.router.stream(context, {
                maxTokens: 200,
                temperature: 0.8,
                stopSequences: ['\n\n', 'User:', 'Human:']
            });
            
            let response = '';
            
            for await (const token of stream) {
                response += token;
                
                // Stream the response in real-time
                this.broadcast({
                    type: 'bot_token',
                    token,
                    messageId: this.generateMessageId()
                });
            }
            
            // Stop typing indicator and send final message
            this.broadcast({
                type: 'typing',
                username: 'Bot',
                isTyping: false
            });
            
            const botMessage = {
                id: this.generateMessageId(),
                username: 'Bot',
                content: response.trim(),
                timestamp: Date.now(),
                type: 'bot_message'
            };
            
            this.conversation.push(botMessage);
            
            this.broadcast({
                type: 'message',
                message: botMessage
            });
            
        } catch (error) {
            this.broadcast({
                type: 'error',
                message: 'Bot encountered an error generating response',
                error: error.message
            });
        }
    }
    
    broadcast(data, excludeClientId = null) {
        for (const [clientId, client] of this.clients.entries()) {
            if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify(data));
            }
        }
    }
    
    sendToClient(clientId, data) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(data));
        }
    }
    
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    }
}

class ChatServer {
    constructor(port = 8080) {
        this.port = port;
        this.router = new LLMRouter();
        this.rooms = new Map();
        this.clients = new Map();
    }
    
    async initialize() {
        await this.router.initialize();
        
        this.wss = new WebSocketServer({ port: this.port });
        
        this.wss.on('connection', (ws) => {
            const clientId = this.generateClientId();
            this.clients.set(clientId, { ws, currentRoom: null });
            
            ws.on('message', (data) => {
                this.handleMessage(clientId, JSON.parse(data.toString()));
            });
            
            ws.on('close', () => {
                this.handleDisconnect(clientId);
            });
            
            ws.send(JSON.stringify({
                type: 'connected',
                clientId,
                availableRooms: Array.from(this.rooms.keys())
            }));
        });
        
        console.log(`💬 Chat server running on ws://localhost:${this.port}`);
    }
    
    handleMessage(clientId, message) {
        switch (message.type) {
            case 'join_room':
                this.joinRoom(clientId, message.roomId);
                break;
                
            case 'leave_room':
                this.leaveRoom(clientId);
                break;
                
            case 'chat_message':
                this.handleChatMessage(clientId, message);
                break;
        }
    }
    
    joinRoom(clientId, roomId) {
        // Leave current room if any
        this.leaveRoom(clientId);
        
        // Get or create room
        let room = this.rooms.get(roomId);
        if (!room) {
            room = new ChatRoom(roomId, this.router);
            this.rooms.set(roomId, room);
        }
        
        // Join new room
        room.addClient(clientId, this.clients.get(clientId).ws);
        this.clients.get(clientId).currentRoom = roomId;
    }
    
    leaveRoom(clientId) {
        const client = this.clients.get(clientId);
        if (client && client.currentRoom) {
            const room = this.rooms.get(client.currentRoom);
            if (room) {
                room.removeClient(clientId);
                
                // Remove empty rooms
                if (room.clients.size === 0) {
                    this.rooms.delete(client.currentRoom);
                }
            }
            client.currentRoom = null;
        }
    }
    
    handleChatMessage(clientId, message) {
        const client = this.clients.get(clientId);
        if (client && client.currentRoom) {
            const room = this.rooms.get(client.currentRoom);
            if (room) {
                room.handleMessage(clientId, message);
            }
        }
    }
    
    handleDisconnect(clientId) {
        this.leaveRoom(clientId);
        this.clients.delete(clientId);
    }
    
    generateClientId() {
        return Math.random().toString(36).substr(2, 12);
    }
}

// Start the chat server
const server = new ChatServer(8080);
await server.initialize();
```

## Progress Tracking

### 1. Detailed Progress Monitoring

```javascript
import LLMRouter from 'llm-runner-router';

class ProgressTracker {
    constructor() {
        this.router = new LLMRouter();
        this.activeJobs = new Map();
    }
    
    async initialize() {
        await this.router.initialize();
    }
    
    async startTrackedGeneration(jobId, prompt, options = {}) {
        const job = {
            id: jobId,
            prompt,
            options,
            startTime: Date.now(),
            stages: {
                initialization: { status: 'pending', startTime: null, endTime: null },
                modelSelection: { status: 'pending', startTime: null, endTime: null },
                generation: { status: 'pending', startTime: null, endTime: null, tokens: 0 },
                completion: { status: 'pending', startTime: null, endTime: null }
            },
            tokens: [],
            metadata: {
                estimatedTotalTokens: options.maxTokens || 500,
                actualSpeed: 0,
                estimatedCompletion: null
            }
        };
        
        this.activeJobs.set(jobId, job);
        this.updateStage(jobId, 'initialization', 'in_progress');
        
        try {
            await this.router.initialize();
            this.updateStage(jobId, 'initialization', 'completed');
            this.updateStage(jobId, 'modelSelection', 'in_progress');
            
            // Model selection phase
            const stream = this.router.stream(prompt, options);
            this.updateStage(jobId, 'modelSelection', 'completed');
            this.updateStage(jobId, 'generation', 'in_progress');
            
            // Generation phase with detailed tracking
            let tokenCount = 0;
            const generationStartTime = Date.now();
            
            for await (const token of stream) {
                tokenCount++;
                job.tokens.push({
                    token,
                    timestamp: Date.now(),
                    position: tokenCount
                });
                
                // Update progress
                this.updateGenerationProgress(jobId, tokenCount, generationStartTime);
                
                // Emit progress event
                this.emitProgress(jobId);
            }
            
            this.updateStage(jobId, 'generation', 'completed');
            this.updateStage(jobId, 'completion', 'completed');
            
            const finalResult = this.getFinalResult(jobId);
            this.activeJobs.delete(jobId);
            
            return finalResult;
            
        } catch (error) {
            this.markJobFailed(jobId, error);
            throw error;
        }
    }
    
    updateStage(jobId, stageName, status) {
        const job = this.activeJobs.get(jobId);
        if (!job) return;
        
        const stage = job.stages[stageName];
        stage.status = status;
        
        if (status === 'in_progress') {
            stage.startTime = Date.now();
        } else if (status === 'completed' || status === 'failed') {
            stage.endTime = Date.now();
        }
    }
    
    updateGenerationProgress(jobId, tokenCount, generationStartTime) {
        const job = this.activeJobs.get(jobId);
        if (!job) return;
        
        const elapsed = Date.now() - generationStartTime;
        const speed = tokenCount / elapsed * 1000; // tokens per second
        
        job.stages.generation.tokens = tokenCount;
        job.metadata.actualSpeed = speed;
        
        // Estimate completion time
        const remainingTokens = job.metadata.estimatedTotalTokens - tokenCount;
        if (speed > 0) {
            job.metadata.estimatedCompletion = Date.now() + (remainingTokens / speed * 1000);
        }
    }
    
    emitProgress(jobId) {
        const progress = this.getProgress(jobId);
        console.log(`📊 Progress [${jobId}]:`, progress);
        // In real app, emit to event listeners or WebSocket clients
    }
    
    getProgress(jobId) {
        const job = this.activeJobs.get(jobId);
        if (!job) return null;
        
        const totalStages = Object.keys(job.stages).length;
        const completedStages = Object.values(job.stages)
            .filter(stage => stage.status === 'completed').length;
        
        const overallProgress = (completedStages / totalStages) * 100;
        
        // If in generation phase, add token progress
        let detailedProgress = overallProgress;
        if (job.stages.generation.status === 'in_progress') {
            const tokenProgress = (job.stages.generation.tokens || 0) / job.metadata.estimatedTotalTokens;
            detailedProgress = ((completedStages - 1) / totalStages * 100) + (tokenProgress * (100 / totalStages));
        }
        
        return {
            jobId,
            overallProgress: Math.min(detailedProgress, 100),
            currentStage: this.getCurrentStage(job),
            stages: job.stages,
            tokens: {
                generated: job.stages.generation.tokens || 0,
                estimated: job.metadata.estimatedTotalTokens,
                speed: job.metadata.actualSpeed.toFixed(1)
            },
            timing: {
                elapsed: Date.now() - job.startTime,
                estimatedCompletion: job.metadata.estimatedCompletion,
                estimatedRemaining: job.metadata.estimatedCompletion ? 
                    Math.max(0, job.metadata.estimatedCompletion - Date.now()) : null
            }
        };
    }
    
    getCurrentStage(job) {
        for (const [stageName, stage] of Object.entries(job.stages)) {
            if (stage.status === 'in_progress') {
                return stageName;
            }
        }
        return 'completed';
    }
    
    getFinalResult(jobId) {
        const job = this.activeJobs.get(jobId);
        if (!job) return null;
        
        return {
            jobId,
            text: job.tokens.map(t => t.token).join(''),
            tokenCount: job.tokens.length,
            duration: Date.now() - job.startTime,
            averageSpeed: job.metadata.actualSpeed,
            stages: job.stages
        };
    }
    
    markJobFailed(jobId, error) {
        const job = this.activeJobs.get(jobId);
        if (!job) return;
        
        // Mark current stage as failed
        const currentStage = this.getCurrentStage(job);
        if (currentStage !== 'completed') {
            job.stages[currentStage].status = 'failed';
            job.stages[currentStage].error = error.message;
        }
    }
    
    listActiveJobs() {
        return Array.from(this.activeJobs.keys());
    }
    
    getJobStatus(jobId) {
        return this.getProgress(jobId);
    }
}

// Usage example
const tracker = new ProgressTracker();
await tracker.initialize();

const jobId = 'job_' + Date.now();
console.log(`Starting tracked generation: ${jobId}`);

const result = await tracker.startTrackedGeneration(
    jobId,
    "Write a comprehensive guide to machine learning",
    { maxTokens: 800, temperature: 0.7 }
);

console.log('Final result:', result);
```

## Performance Optimization

### 1. Batched Streaming

```javascript
import LLMRouter from 'llm-runner-router';

class OptimizedStreamer {
    constructor() {
        this.router = new LLMRouter({
            strategy: 'speed-priority'
        });
        this.batchSize = 5; // Batch tokens for efficiency
        this.batchTimeout = 50; // Max wait time (ms)
    }
    
    async initialize() {
        await this.router.initialize();
    }
    
    async *batchedStream(prompt, options = {}) {
        const stream = this.router.stream(prompt, options);
        
        let batch = [];
        let lastBatchTime = Date.now();
        
        for await (const token of stream) {
            batch.push(token);
            
            const shouldFlush = 
                batch.length >= this.batchSize || 
                (Date.now() - lastBatchTime) >= this.batchTimeout;
            
            if (shouldFlush) {
                yield {
                    tokens: batch,
                    text: batch.join(''),
                    batchSize: batch.length,
                    timestamp: Date.now()
                };
                
                batch = [];
                lastBatchTime = Date.now();
            }
        }
        
        // Flush remaining tokens
        if (batch.length > 0) {
            yield {
                tokens: batch,
                text: batch.join(''),
                batchSize: batch.length,
                timestamp: Date.now(),
                final: true
            };
        }
    }
}

// Usage
const streamer = new OptimizedStreamer();
await streamer.initialize();

console.log('Batched streaming:');
for await (const batch of streamer.batchedStream("Explain quantum computing")) {
    console.log(`Batch (${batch.batchSize} tokens):`, batch.text);
}
```

### 2. Connection Pooling for Multiple Streams

```javascript
import LLMRouter from 'llm-runner-router';

class StreamPool {
    constructor(poolSize = 3) {
        this.poolSize = poolSize;
        this.routers = [];
        this.busyRouters = new Set();
        this.queue = [];
    }
    
    async initialize() {
        // Create router pool
        for (let i = 0; i < this.poolSize; i++) {
            const router = new LLMRouter({
                strategy: 'speed-priority'
            });
            await router.initialize();
            this.routers.push(router);
        }
        
        console.log(`🏊 Stream pool initialized with ${this.poolSize} routers`);
    }
    
    async getRouter() {
        // Find available router
        for (const router of this.routers) {
            if (!this.busyRouters.has(router)) {
                this.busyRouters.add(router);
                return router;
            }
        }
        
        // No available router, queue the request
        return new Promise((resolve) => {
            this.queue.push(resolve);
        });
    }
    
    releaseRouter(router) {
        this.busyRouters.delete(router);
        
        // Process queued requests
        if (this.queue.length > 0) {
            const resolve = this.queue.shift();
            this.busyRouters.add(router);
            resolve(router);
        }
    }
    
    async *parallelStream(prompts, options = {}) {
        const activeStreams = new Map();
        const results = [];
        
        // Start all streams
        for (let i = 0; i < prompts.length; i++) {
            const router = await this.getRouter();
            const stream = router.stream(prompts[i], options);
            
            activeStreams.set(i, {
                stream,
                router,
                tokens: [],
                completed: false
            });
        }
        
        // Process streams concurrently
        while (activeStreams.size > 0) {
            const promises = Array.from(activeStreams.entries()).map(
                async ([index, streamInfo]) => {
                    try {
                        const { value, done } = await streamInfo.stream.next();
                        
                        if (done) {
                            return { index, completed: true };
                        }
                        
                        streamInfo.tokens.push(value);
                        return { 
                            index, 
                            token: value,
                            text: streamInfo.tokens.join(''),
                            completed: false 
                        };
                    } catch (error) {
                        return { index, error, completed: true };
                    }
                }
            );
            
            const results = await Promise.allSettled(promises);
            
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    const { index, completed, token, text, error } = result.value;
                    
                    if (completed) {
                        const streamInfo = activeStreams.get(index);
                        this.releaseRouter(streamInfo.router);
                        activeStreams.delete(index);
                        
                        if (error) {
                            yield { index, error, type: 'error' };
                        } else {
                            yield { 
                                index, 
                                text: streamInfo.tokens.join(''),
                                type: 'complete'
                            };
                        }
                    } else if (token) {
                        yield { index, token, text, type: 'token' };
                    }
                }
            }
        }
    }
}

// Usage
const pool = new StreamPool(3);
await pool.initialize();

const prompts = [
    "Explain machine learning",
    "What is quantum computing?",
    "How do neural networks work?"
];

console.log('Parallel streaming:');
for await (const result of pool.parallelStream(prompts)) {
    console.log(`Stream ${result.index}:`, result);
}
```

## Error Handling

### 1. Resilient Streaming

```javascript
import LLMRouter from 'llm-runner-router';

class ResilientStreamer {
    constructor() {
        this.router = new LLMRouter({
            retryConfig: {
                maxAttempts: 3,
                backoff: 'exponential',
                initialDelay: 1000
            }
        });
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }
    
    async initialize() {
        await this.router.initialize();
    }
    
    async *resilientStream(prompt, options = {}) {
        let attempt = 0;
        let lastError = null;
        
        while (attempt < this.maxRetries) {
            try {
                attempt++;
                console.log(`🔄 Stream attempt ${attempt}/${this.maxRetries}`);
                
                const stream = this.router.stream(prompt, options);
                let tokenCount = 0;
                
                for await (const token of stream) {
                    tokenCount++;
                    yield {
                        token,
                        attempt,
                        tokenCount,
                        recovered: attempt > 1
                    };
                }
                
                // Successful completion
                yield {
                    type: 'complete',
                    attempt,
                    totalTokens: tokenCount,
                    recovered: attempt > 1
                };
                
                return; // Success, exit retry loop
                
            } catch (error) {
                lastError = error;
                console.error(`❌ Stream attempt ${attempt} failed:`, error.message);
                
                if (attempt < this.maxRetries) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1);
                    console.log(`⏳ Retrying in ${delay}ms...`);
                    
                    yield {
                        type: 'retry',
                        attempt,
                        nextAttempt: attempt + 1,
                        delay,
                        error: error.message
                    };
                    
                    await this.sleep(delay);
                } else {
                    yield {
                        type: 'failed',
                        attempts: attempt,
                        finalError: error.message
                    };
                    throw error;
                }
            }
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async *gracefulDegradationStream(prompt, options = {}) {
        const fallbackOptions = [
            { ...options }, // Original options
            { ...options, maxTokens: Math.floor((options.maxTokens || 500) * 0.7) }, // Shorter
            { ...options, temperature: 0.3 }, // More conservative
            { maxTokens: 100, temperature: 0.1 } // Minimal fallback
        ];
        
        for (let i = 0; i < fallbackOptions.length; i++) {
            try {
                const currentOptions = fallbackOptions[i];
                console.log(`🎯 Trying configuration ${i + 1}:`, currentOptions);
                
                yield {
                    type: 'attempt',
                    configuration: i + 1,
                    options: currentOptions
                };
                
                const stream = this.router.stream(prompt, currentOptions);
                
                for await (const token of stream) {
                    yield {
                        token,
                        configuration: i + 1,
                        degraded: i > 0
                    };
                }
                
                yield {
                    type: 'success',
                    configuration: i + 1,
                    degraded: i > 0
                };
                
                return; // Success
                
            } catch (error) {
                console.error(`Configuration ${i + 1} failed:`, error.message);
                
                if (i < fallbackOptions.length - 1) {
                    yield {
                        type: 'fallback',
                        failedConfiguration: i + 1,
                        nextConfiguration: i + 2,
                        error: error.message
                    };
                } else {
                    yield {
                        type: 'all_failed',
                        error: error.message
                    };
                    throw error;
                }
            }
        }
    }
}

// Usage
const resilientStreamer = new ResilientStreamer();
await resilientStreamer.initialize();

console.log('Resilient streaming with retries:');
try {
    for await (const result of resilientStreamer.resilientStream("Explain AI")) {
        if (result.token) {
            process.stdout.write(result.token);
        } else {
            console.log('\nStatus:', result);
        }
    }
} catch (error) {
    console.error('All attempts failed:', error.message);
}

console.log('\n\nGraceful degradation streaming:');
try {
    for await (const result of resilientStreamer.gracefulDegradationStream(
        "Write a detailed analysis of modern web technologies",
        { maxTokens: 1000, temperature: 0.8 }
    )) {
        if (result.token) {
            process.stdout.write(result.token);
        } else {
            console.log('\nStatus:', result);
        }
    }
} catch (error) {
    console.error('All configurations failed:', error.message);
}
```

This completes the comprehensive streaming examples. These examples cover real-time token streaming, browser integration, server implementations, chat applications, progress tracking, performance optimization, and robust error handling patterns.