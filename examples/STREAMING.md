# Streaming Examples

This guide demonstrates real-time streaming capabilities of the LLM-Runner-Router system. Perfect for building interactive applications with live token generation.

## Table of Contents
- [Basic Streaming](#basic-streaming)
- [Event-Based Streaming](#event-based-streaming)
- [Advanced Stream Control](#advanced-stream-control)
- [Interactive Chat](#interactive-chat)
- [Stream Processing](#stream-processing)
- [Error Handling](#error-handling)

## Basic Streaming

### Simple Token Streaming

```javascript
import LLMRouter from 'llm-runner-router';

const router = new LLMRouter();
await router.initialize();

// Load a model for streaming
await router.load('models/llama-7b.gguf');

// Basic streaming
async function basicStreaming() {
  const prompt = "Write a short story about a brave knight";
  
  console.log('🎬 Starting story generation...\n');
  
  const stream = router.stream(prompt, {
    maxTokens: 300,
    temperature: 0.8
  });
  
  let fullText = '';
  
  for await (const token of stream) {
    process.stdout.write(token);
    fullText += token;
  }
  
  console.log('\n\n✅ Story complete!');
  console.log(`Total length: ${fullText.length} characters`);
}

basicStreaming().catch(console.error);
```

### Browser Streaming Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>LLM Streaming Demo</title>
    <style>
        #output {
            border: 1px solid #ccc;
            padding: 20px;
            margin: 20px;
            font-family: monospace;
            white-space: pre-wrap;
            min-height: 200px;
        }
        #controls {
            margin: 20px;
        }
    </style>
</head>
<body>
    <div id="controls">
        <input type="text" id="prompt" placeholder="Enter your prompt..." size="50">
        <button onclick="startStreaming()">Generate</button>
        <button onclick="stopStreaming()">Stop</button>
    </div>
    <div id="output"></div>
    
    <script type="module">
        import LLMRouter from './node_modules/llm-runner-router/dist/browser.js';
        
        let router;
        let currentStream;
        
        async function initRouter() {
            router = new LLMRouter({
                preferredEngine: 'webgpu',
                logLevel: 'info'
            });
            await router.initialize();
            await router.load('https://example.com/models/web-model.onnx');
            console.log('Router ready!');
        }
        
        window.startStreaming = async function() {
            const prompt = document.getElementById('prompt').value;
            const output = document.getElementById('output');
            
            if (!prompt.trim()) {
                alert('Please enter a prompt');
                return;
            }
            
            output.textContent = '';
            
            try {
                currentStream = router.stream(prompt, {
                    maxTokens: 200,
                    temperature: 0.7
                });
                
                for await (const token of currentStream) {
                    output.textContent += token;
                    output.scrollTop = output.scrollHeight;
                }
            } catch (error) {
                output.textContent += `\n\nError: ${error.message}`;
            }
        };
        
        window.stopStreaming = function() {
            if (currentStream && currentStream.stop) {
                currentStream.stop();
            }
        };
        
        initRouter().catch(console.error);
    </script>
</body>
</html>
```

## Event-Based Streaming

### Streaming with Progress Events

```javascript
import { EventEmitter } from 'events';

class StreamingManager extends EventEmitter {
  constructor(router) {
    super();
    this.router = router;
  }
  
  async streamWithEvents(prompt, options = {}) {
    this.emit('start', { prompt, options });
    
    try {
      const stream = this.router.stream(prompt, options);
      let tokenCount = 0;
      let fullText = '';
      const startTime = Date.now();
      
      for await (const token of stream) {
        tokenCount++;
        fullText += token;
        
        // Emit token event
        this.emit('token', {
          token,
          count: tokenCount,
          totalText: fullText,
          elapsed: Date.now() - startTime
        });
        
        // Emit progress every 10 tokens
        if (tokenCount % 10 === 0) {
          this.emit('progress', {
            tokens: tokenCount,
            charactersPerSecond: fullText.length / ((Date.now() - startTime) / 1000),
            estimatedTimeRemaining: this.estimateTimeRemaining(tokenCount, options.maxTokens, startTime)
          });
        }
      }
      
      this.emit('complete', {
        fullText,
        tokenCount,
        totalTime: Date.now() - startTime
      });
      
      return fullText;
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  estimateTimeRemaining(currentTokens, maxTokens, startTime) {
    if (!maxTokens || currentTokens === 0) return null;
    
    const elapsed = Date.now() - startTime;
    const tokensPerMs = currentTokens / elapsed;
    const remainingTokens = maxTokens - currentTokens;
    
    return Math.round(remainingTokens / tokensPerMs);
  }
}

// Usage example
async function demonstrateEventStreaming() {
  const router = new LLMRouter();
  await router.initialize();
  await router.load('models/llama-7b.gguf');
  
  const manager = new StreamingManager(router);
  
  // Set up event listeners
  manager.on('start', (data) => {
    console.log('🎬 Starting generation:', data.prompt);
  });
  
  manager.on('token', (data) => {
    process.stdout.write(data.token);
  });
  
  manager.on('progress', (data) => {
    console.log(`\n📊 Progress: ${data.tokens} tokens, ${data.charactersPerSecond.toFixed(1)} chars/sec`);
    if (data.estimatedTimeRemaining) {
      console.log(`⏱️ ETA: ${data.estimatedTimeRemaining}ms`);
    }
  });
  
  manager.on('complete', (data) => {
    console.log(`\n✅ Complete: ${data.tokenCount} tokens in ${data.totalTime}ms`);
  });
  
  manager.on('error', (error) => {
    console.error('\n❌ Error:', error.message);
  });
  
  await manager.streamWithEvents(
    "Explain the theory of relativity in simple terms",
    { maxTokens: 500, temperature: 0.6 }
  );
}

demonstrateEventStreaming().catch(console.error);
```

## Advanced Stream Control

### Controllable Streaming

```javascript
class ControllableStream {
  constructor(router) {
    this.router = router;
    this.currentStream = null;
    this.isPaused = false;
    this.isRunning = false;
  }
  
  async start(prompt, options = {}) {
    if (this.isRunning) {
      throw new Error('Stream already running');
    }
    
    this.isRunning = true;
    this.isPaused = false;
    
    try {
      this.currentStream = this.router.stream(prompt, options);
      
      for await (const token of this.currentStream) {
        // Check if paused
        while (this.isPaused && this.isRunning) {
          await this.sleep(100);
        }
        
        if (!this.isRunning) {
          break;
        }
        
        yield token;
      }
    } finally {
      this.isRunning = false;
    }
  }
  
  pause() {
    if (this.isRunning) {
      this.isPaused = true;
      console.log('⏸️ Stream paused');
    }
  }
  
  resume() {
    if (this.isRunning && this.isPaused) {
      this.isPaused = false;
      console.log('▶️ Stream resumed');
    }
  }
  
  stop() {
    this.isRunning = false;
    this.isPaused = false;
    if (this.currentStream && this.currentStream.stop) {
      this.currentStream.stop();
    }
    console.log('⏹️ Stream stopped');
  }
  
  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused
    };
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage example
async function demonstrateStreamControl() {
  const router = new LLMRouter();
  await router.initialize();
  await router.load('models/llama-7b.gguf');
  
  const stream = new ControllableStream(router);
  
  // Start streaming
  const generator = stream.start("Write a long essay about artificial intelligence", {
    maxTokens: 1000,
    temperature: 0.7
  });
  
  // Set up controls
  setTimeout(() => stream.pause(), 3000);    // Pause after 3 seconds
  setTimeout(() => stream.resume(), 6000);   // Resume after 6 seconds
  setTimeout(() => stream.stop(), 15000);    // Stop after 15 seconds
  
  try {
    for await (const token of generator) {
      process.stdout.write(token);
    }
  } catch (error) {
    console.error('Stream error:', error);
  }
  
  console.log('\n🏁 Stream finished');
}

demonstrateStreamControl().catch(console.error);
```

### Streaming with Filters

```javascript
class FilteredStream {
  constructor(router) {
    this.router = router;
    this.filters = [];
  }
  
  addFilter(filterFn) {
    this.filters.push(filterFn);
  }
  
  async *stream(prompt, options = {}) {
    const stream = this.router.stream(prompt, options);
    
    for await (const token of stream) {
      let processedToken = token;
      
      // Apply all filters
      for (const filter of this.filters) {
        processedToken = filter(processedToken);
        if (processedToken === null) {
          break; // Filter rejected this token
        }
      }
      
      if (processedToken !== null) {
        yield processedToken;
      }
    }
  }
}

// Example filters
const profanityFilter = (token) => {
  const badWords = ['bad', 'evil', 'terrible'];
  return badWords.some(word => token.toLowerCase().includes(word)) ? '***' : token;
};

const uppercaseFilter = (token) => {
  return token.toUpperCase();
};

const punctuationEnhancer = (token) => {
  if (token.includes('.')) {
    return token.replace('.', '!');
  }
  return token;
};

// Usage
async function demonstrateFilteredStreaming() {
  const router = new LLMRouter();
  await router.initialize();
  await router.load('models/llama-7b.gguf');
  
  const filteredStream = new FilteredStream(router);
  
  // Add filters
  filteredStream.addFilter(profanityFilter);
  filteredStream.addFilter(punctuationEnhancer);
  
  console.log('🎭 Streaming with filters...\n');
  
  const stream = filteredStream.stream("Tell me about bad weather and terrible storms");
  
  for await (const token of stream) {
    process.stdout.write(token);
  }
  
  console.log('\n\n✅ Filtered streaming complete');
}

demonstrateFilteredStreaming().catch(console.error);
```

## Interactive Chat

### Real-Time Chat Interface

```javascript
import readline from 'readline';

class ChatInterface {
  constructor() {
    this.router = new LLMRouter();
    this.conversationHistory = [];
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }
  
  async initialize() {
    await this.router.initialize();
    await this.router.load('models/chat-model.gguf');
    console.log('🤖 Chat assistant ready! Type "exit" to quit.\n');
  }
  
  async startChat() {
    while (true) {
      const userInput = await this.getUserInput('You: ');
      
      if (userInput.toLowerCase() === 'exit') {
        console.log('👋 Goodbye!');
        break;
      }
      
      console.log('AI: ');
      await this.generateResponse(userInput);
      console.log('\n');
    }
    
    this.rl.close();
  }
  
  async generateResponse(userInput) {
    // Add user input to history
    this.conversationHistory.push(`Human: ${userInput}`);
    
    // Create context from conversation history
    const context = this.conversationHistory.slice(-10).join('\n') + '\nAI: ';
    
    try {
      const stream = this.router.stream(context, {
        maxTokens: 200,
        temperature: 0.7,
        stopSequences: ['\nHuman:', '\nUser:']
      });
      
      let response = '';
      
      for await (const token of stream) {
        process.stdout.write(token);
        response += token;
        
        // Stop if we hit a stop sequence
        if (response.includes('\nHuman:') || response.includes('\nUser:')) {
          break;
        }
      }
      
      // Add AI response to history
      this.conversationHistory.push(`AI: ${response.trim()}`);
      
    } catch (error) {
      console.log('Sorry, I encountered an error:', error.message);
    }
  }
  
  getUserInput(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }
  
  async cleanup() {
    await this.router.cleanup();
  }
}

// Usage
async function runChatDemo() {
  const chat = new ChatInterface();
  
  try {
    await chat.initialize();
    await chat.startChat();
  } finally {
    await chat.cleanup();
  }
}

runChatDemo().catch(console.error);
```

### WebSocket Streaming Server

```javascript
import WebSocket, { WebSocketServer } from 'ws';
import LLMRouter from 'llm-runner-router';

class StreamingChatServer {
  constructor(port = 8080) {
    this.port = port;
    this.router = new LLMRouter();
    this.clients = new Map();
  }
  
  async initialize() {
    await this.router.initialize();
    await this.router.load('models/chat-model.gguf');
    
    this.wss = new WebSocketServer({ port: this.port });
    
    this.wss.on('connection', (ws) => {
      const clientId = Math.random().toString(36).substr(2, 9);
      this.clients.set(clientId, { ws, history: [] });
      
      console.log(`👤 Client ${clientId} connected`);
      
      ws.on('message', async (data) => {
        await this.handleMessage(clientId, data);
      });
      
      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`👤 Client ${clientId} disconnected`);
      });
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to AI chat server'
      }));
    });
    
    console.log(`🚀 Chat server running on ws://localhost:${this.port}`);
  }
  
  async handleMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'chat') {
        await this.streamResponse(clientId, message.content);
      }
    } catch (error) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  }
  
  async streamResponse(clientId, userMessage) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // Add to conversation history
    client.history.push(`Human: ${userMessage}`);
    
    // Create context
    const context = client.history.slice(-10).join('\n') + '\nAI: ';
    
    // Start streaming response
    client.ws.send(JSON.stringify({
      type: 'stream_start'
    }));
    
    try {
      const stream = this.router.stream(context, {
        maxTokens: 300,
        temperature: 0.7
      });
      
      let response = '';
      
      for await (const token of stream) {
        response += token;
        
        // Send token to client
        client.ws.send(JSON.stringify({
          type: 'token',
          content: token
        }));
      }
      
      // Add response to history
      client.history.push(`AI: ${response.trim()}`);
      
      // Send completion signal
      client.ws.send(JSON.stringify({
        type: 'stream_end',
        fullResponse: response.trim()
      }));
      
    } catch (error) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  }
}

// HTML client example
const clientHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Streaming Chat Client</title>
    <style>
        #chat { height: 400px; overflow-y: scroll; border: 1px solid #ccc; padding: 10px; }
        #input { width: 80%; }
        .user { color: blue; }
        .ai { color: green; }
    </style>
</head>
<body>
    <div id="chat"></div>
    <input type="text" id="input" placeholder="Type your message...">
    <button onclick="sendMessage()">Send</button>
    
    <script>
        const ws = new WebSocket('ws://localhost:8080');
        const chat = document.getElementById('chat');
        const input = document.getElementById('input');
        
        let currentResponse = '';
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'welcome':
                    addMessage('System', data.message);
                    break;
                case 'stream_start':
                    currentResponse = '';
                    addMessage('AI', '');
                    break;
                case 'token':
                    currentResponse += data.content;
                    updateLastMessage(currentResponse);
                    break;
                case 'stream_end':
                    break;
                case 'error':
                    addMessage('Error', data.message);
                    break;
            }
        };
        
        function addMessage(sender, text) {
            const div = document.createElement('div');
            div.className = sender.toLowerCase();
            div.innerHTML = \`<strong>\${sender}:</strong> <span id="msg-\${Date.now()}">\${text}</span>\`;
            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
        }
        
        function updateLastMessage(text) {
            const messages = chat.querySelectorAll('.ai span');
            if (messages.length > 0) {
                messages[messages.length - 1].textContent = text;
            }
        }
        
        function sendMessage() {
            const message = input.value.trim();
            if (!message) return;
            
            addMessage('You', message);
            
            ws.send(JSON.stringify({
                type: 'chat',
                content: message
            }));
            
            input.value = '';
        }
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    </script>
</body>
</html>
`;

// Start server
async function startChatServer() {
  const server = new StreamingChatServer(8080);
  await server.initialize();
}

startChatServer().catch(console.error);
```

## Stream Processing

### Token Analysis During Streaming

```javascript
class StreamAnalyzer {
  constructor(router) {
    this.router = router;
    this.stats = {
      totalTokens: 0,
      uniqueWords: new Set(),
      sentenceCount: 0,
      averageWordLength: 0
    };
  }
  
  async *analyzeStream(prompt, options = {}) {
    const stream = this.router.stream(prompt, options);
    let currentWord = '';
    let totalChars = 0;
    
    for await (const token of stream) {
      this.stats.totalTokens++;
      
      // Analyze token
      for (const char of token) {
        if (char === ' ' || char === '\n' || char === '\t') {
          if (currentWord) {
            this.stats.uniqueWords.add(currentWord.toLowerCase());
            totalChars += currentWord.length;
            currentWord = '';
          }
        } else if (char === '.' || char === '!' || char === '?') {
          this.stats.sentenceCount++;
          if (currentWord) {
            this.stats.uniqueWords.add(currentWord.toLowerCase());
            totalChars += currentWord.length;
            currentWord = '';
          }
        } else {
          currentWord += char;
        }
      }
      
      // Update averages
      if (this.stats.uniqueWords.size > 0) {
        this.stats.averageWordLength = totalChars / this.stats.uniqueWords.size;
      }
      
      yield {
        token,
        stats: { ...this.stats, uniqueWords: this.stats.uniqueWords.size }
      };
    }
  }
  
  getStats() {
    return {
      ...this.stats,
      uniqueWords: this.stats.uniqueWords.size,
      wordsPerSentence: this.stats.sentenceCount > 0 
        ? this.stats.uniqueWords.size / this.stats.sentenceCount 
        : 0
    };
  }
}

// Usage
async function demonstrateStreamAnalysis() {
  const router = new LLMRouter();
  await router.initialize();
  await router.load('models/llama-7b.gguf');
  
  const analyzer = new StreamAnalyzer(router);
  
  console.log('📊 Starting analyzed streaming...\n');
  
  const stream = analyzer.analyzeStream(
    "Write a detailed explanation of machine learning concepts",
    { maxTokens: 500, temperature: 0.7 }
  );
  
  let tokenCount = 0;
  
  for await (const { token, stats } of stream) {
    process.stdout.write(token);
    
    tokenCount++;
    
    // Show stats every 50 tokens
    if (tokenCount % 50 === 0) {
      console.log(`\n\n📈 Stats at ${tokenCount} tokens:`);
      console.log(`   Unique words: ${stats.uniqueWords}`);
      console.log(`   Sentences: ${stats.sentenceCount}`);
      console.log(`   Avg word length: ${stats.averageWordLength.toFixed(1)}`);
      console.log('\n');
    }
  }
  
  console.log('\n\n📊 Final Statistics:');
  console.log(analyzer.getStats());
}

demonstrateStreamAnalysis().catch(console.error);
```

## Error Handling

### Robust Streaming with Retries

```javascript
class RobustStreamer {
  constructor(router) {
    this.router = router;
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2
    };
  }
  
  async *streamWithRetry(prompt, options = {}) {
    let retryCount = 0;
    
    while (retryCount <= this.retryConfig.maxRetries) {
      try {
        const stream = this.router.stream(prompt, options);
        
        for await (const token of stream) {
          yield token;
        }
        
        return; // Success, exit retry loop
        
      } catch (error) {
        retryCount++;
        
        if (retryCount > this.retryConfig.maxRetries) {
          throw new Error(`Streaming failed after ${this.retryConfig.maxRetries} retries: ${error.message}`);
        }
        
        const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, retryCount - 1);
        
        console.log(`\n⚠️ Stream error (attempt ${retryCount}), retrying in ${delay}ms...`);
        console.log(`Error: ${error.message}`);
        
        await this.sleep(delay);
      }
    }
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage with error handling
async function demonstrateRobustStreaming() {
  const router = new LLMRouter();
  await router.initialize();
  
  try {
    await router.load('models/might-fail-model.gguf');
  } catch (error) {
    console.log('Loading backup model...');
    await router.load('models/backup-model.gguf');
  }
  
  const streamer = new RobustStreamer(router);
  
  try {
    const stream = streamer.streamWithRetry(
      "Explain quantum computing",
      { maxTokens: 300, temperature: 0.7 }
    );
    
    for await (const token of stream) {
      process.stdout.write(token);
    }
    
    console.log('\n✅ Streaming completed successfully');
    
  } catch (error) {
    console.error('\n❌ Streaming failed permanently:', error.message);
  }
}

demonstrateRobustStreaming().catch(console.error);
```

This comprehensive streaming examples guide covers all major streaming patterns and use cases for the LLM-Runner-Router system, from basic token streaming to advanced interactive applications.