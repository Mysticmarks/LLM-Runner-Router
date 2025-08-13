# Chat Application Examples

This guide demonstrates building various chat applications using the LLM-Runner-Router system. From simple command-line chats to sophisticated web applications with memory and context management.

## Table of Contents
- [Basic Chat Interface](#basic-chat-interface)
- [Web-Based Chat](#web-based-chat)
- [Multi-User Chat Server](#multi-user-chat-server)
- [Context-Aware Chat](#context-aware-chat)
- [Specialized Chat Bots](#specialized-chat-bots)
- [Advanced Features](#advanced-features)

## Basic Chat Interface

### Simple Terminal Chat

```javascript
import readline from 'readline';
import LLMRouter from 'llm-runner-router';

class TerminalChat {
  constructor() {
    this.router = new LLMRouter({
      strategy: 'balanced',
      logLevel: 'warn' // Reduce noise in chat
    });
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '🗣️  You: '
    });
    
    this.conversationHistory = [];
    this.maxHistoryLength = 20;
  }
  
  async initialize() {
    await this.router.initialize();
    await this.router.load('models/chat-model.gguf');
    
    console.log('🤖 Chat Assistant Ready!');
    console.log('Type "exit", "quit", or "bye" to end the conversation.\n');
    
    this.rl.prompt();
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    this.rl.on('line', async (input) => {
      const userInput = input.trim();
      
      if (this.isExitCommand(userInput)) {
        await this.goodbye();
        return;
      }
      
      if (userInput) {
        await this.processUserInput(userInput);
      }
      
      this.rl.prompt();
    });
    
    this.rl.on('SIGINT', async () => {
      await this.goodbye();
    });
  }
  
  async processUserInput(userInput) {
    // Add user input to history
    this.addToHistory('User', userInput);
    
    try {
      console.log('🤖 Assistant: ');
      
      // Build context from history
      const context = this.buildContext();
      const prompt = `${context}\nUser: ${userInput}\nAssistant:`;
      
      // Stream the response
      const stream = this.router.stream(prompt, {
        maxTokens: 300,
        temperature: 0.7,
        stopSequences: ['\\nUser:', '\\nHuman:']
      });
      
      let response = '';
      for await (const token of stream) {
        process.stdout.write(token);
        response += token;
      }
      
      console.log('\n');
      
      // Add assistant response to history
      this.addToHistory('Assistant', response.trim());
      
    } catch (error) {
      console.log('😞 Sorry, I encountered an error:', error.message);
    }
  }
  
  buildContext() {
    // Keep recent conversation history
    const recentHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    return recentHistory.map(entry => `${entry.role}: ${entry.content}`).join('\\n');
  }
  
  addToHistory(role, content) {
    this.conversationHistory.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });
    
    // Trim history if too long
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory.splice(0, this.conversationHistory.length - this.maxHistoryLength);
    }
  }
  
  isExitCommand(input) {
    const exitCommands = ['exit', 'quit', 'bye', 'goodbye'];
    return exitCommands.includes(input.toLowerCase());
  }
  
  async goodbye() {
    console.log('\\n👋 Thanks for chatting! Have a great day!');
    this.rl.close();
    await this.router.cleanup();
    process.exit(0);
  }
}

// Usage
async function startTerminalChat() {
  const chat = new TerminalChat();
  await chat.initialize();
}

startTerminalChat().catch(console.error);
```

### Enhanced Terminal Chat with Commands

```javascript
class EnhancedTerminalChat extends TerminalChat {
  constructor() {
    super();
    this.commands = {
      '/help': 'Show available commands',
      '/clear': 'Clear conversation history',
      '/save': 'Save conversation to file',
      '/load': 'Load conversation from file',
      '/stats': 'Show conversation statistics',
      '/model': 'Show current model info',
      '/switch': 'Switch to different model'
    };
    this.sessionStats = {
      messagesExchanged: 0,
      tokensGenerated: 0,
      sessionStart: new Date()
    };
  }
  
  async processUserInput(userInput) {
    // Check if it's a command
    if (userInput.startsWith('/')) {
      await this.processCommand(userInput);
      return;
    }
    
    // Regular chat processing
    await super.processUserInput(userInput);
    this.sessionStats.messagesExchanged++;
  }
  
  async processCommand(command) {
    const [cmd, ...args] = command.split(' ');
    
    switch (cmd.toLowerCase()) {
      case '/help':
        this.showHelp();
        break;
        
      case '/clear':
        this.clearHistory();
        break;
        
      case '/save':
        await this.saveConversation(args[0] || 'conversation.json');
        break;
        
      case '/load':
        await this.loadConversation(args[0] || 'conversation.json');
        break;
        
      case '/stats':
        this.showStats();
        break;
        
      case '/model':
        this.showModelInfo();
        break;
        
      case '/switch':
        await this.switchModel(args[0]);
        break;
        
      default:
        console.log(`❓ Unknown command: ${cmd}. Type /help for available commands.`);
    }
  }
  
  showHelp() {
    console.log('\\n📚 Available Commands:');
    Object.entries(this.commands).forEach(([cmd, desc]) => {
      console.log(`  ${cmd} - ${desc}`);
    });
    console.log('');
  }
  
  clearHistory() {
    this.conversationHistory = [];
    console.log('🗑️ Conversation history cleared.\\n');
  }
  
  async saveConversation(filename) {
    try {
      const data = {
        conversation: this.conversationHistory,
        stats: this.sessionStats,
        savedAt: new Date().toISOString()
      };
      
      await require('fs').promises.writeFile(filename, JSON.stringify(data, null, 2));
      console.log(`💾 Conversation saved to ${filename}\\n`);
    } catch (error) {
      console.log(`❌ Failed to save conversation: ${error.message}\\n`);
    }
  }
  
  async loadConversation(filename) {
    try {
      const data = JSON.parse(await require('fs').promises.readFile(filename, 'utf-8'));
      this.conversationHistory = data.conversation || [];
      console.log(`📂 Conversation loaded from ${filename} (${this.conversationHistory.length} messages)\\n`);
    } catch (error) {
      console.log(`❌ Failed to load conversation: ${error.message}\\n`);
    }
  }
  
  showStats() {
    const now = new Date();
    const sessionDuration = Math.round((now - this.sessionStats.sessionStart) / 1000 / 60);
    
    console.log('\\n📊 Session Statistics:');
    console.log(`  Messages exchanged: ${this.sessionStats.messagesExchanged}`);
    console.log(`  Conversation length: ${this.conversationHistory.length} entries`);
    console.log(`  Session duration: ${sessionDuration} minutes`);
    console.log(`  Started: ${this.sessionStats.sessionStart.toLocaleString()}\\n`);
  }
  
  showModelInfo() {
    const status = this.router.getStatus();
    console.log('\\n🤖 Model Information:');
    console.log(`  Current model: ${status.modelsLoaded > 0 ? 'Loaded' : 'None'}`);
    console.log(`  Engine: ${status.engine}`);
    console.log(`  Models in registry: ${status.modelsLoaded}`);
    console.log(`  Environment: ${status.environment}\\n`);
  }
  
  async switchModel(modelPath) {
    if (!modelPath) {
      console.log('❓ Please specify a model path: /switch models/your-model.gguf\\n');
      return;
    }
    
    try {
      console.log(`🔄 Loading new model: ${modelPath}...`);
      await this.router.load(modelPath);
      console.log(`✅ Successfully switched to ${modelPath}\\n`);
    } catch (error) {
      console.log(`❌ Failed to switch model: ${error.message}\\n`);
    }
  }
}

// Usage
async function startEnhancedChat() {
  const chat = new EnhancedTerminalChat();
  await chat.initialize();
}

startEnhancedChat().catch(console.error);
```

## Web-Based Chat

### Express.js Chat Server

```javascript
import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import LLMRouter from 'llm-runner-router';

class WebChatServer {
  constructor(port = 3000) {
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    
    this.router = new LLMRouter({
      strategy: 'balanced',
      logLevel: 'info'
    });
    
    this.clients = new Map();
    this.setupServer();
  }
  
  async initialize() {
    await this.router.initialize();
    await this.router.load('models/chat-model.gguf');
    console.log('🤖 Chat router initialized');
  }
  
  setupServer() {
    // Serve static files
    this.app.use(express.static('public'));
    this.app.use(express.json());
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const status = this.router.getStatus();
      res.json({
        status: 'healthy',
        ...status,
        clients: this.clients.size
      });
    });
    
    // WebSocket connection handling
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      const clientIP = req.socket.remoteAddress;
      
      this.clients.set(clientId, {
        ws,
        id: clientId,
        ip: clientIP,
        connectedAt: new Date(),
        messageCount: 0,
        conversationHistory: []
      });
      
      console.log(`👤 Client ${clientId} connected (${clientIP})`);
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'system',
        message: 'Connected to AI Chat Server',
        clientId
      }));
      
      ws.on('message', async (data) => {
        await this.handleMessage(clientId, data);
      });
      
      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`👤 Client ${clientId} disconnected`);
      });
      
      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for client ${clientId}:`, error);
      });
    });
  }
  
  async handleMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    try {
      const message = JSON.parse(data);
      client.messageCount++;
      
      switch (message.type) {
        case 'chat':
          await this.handleChatMessage(clientId, message.content);
          break;
          
        case 'clear':
          this.clearClientHistory(clientId);
          break;
          
        case 'ping':
          client.ws.send(JSON.stringify({ type: 'pong' }));
          break;
          
        default:
          console.log(`❓ Unknown message type: ${message.type}`);
      }
      
    } catch (error) {
      console.error(`❌ Error handling message from ${clientId}:`, error);
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }));
    }
  }
  
  async handleChatMessage(clientId, userMessage) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // Add user message to history
    client.conversationHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    });
    
    // Signal start of AI response
    client.ws.send(JSON.stringify({
      type: 'thinking',
      message: 'AI is thinking...'
    }));
    
    try {
      // Build context from conversation history
      const context = this.buildContext(client.conversationHistory);
      const prompt = `${context}\\nUser: ${userMessage}\\nAssistant:`;
      
      // Start streaming response
      client.ws.send(JSON.stringify({ type: 'stream_start' }));
      
      const stream = this.router.stream(prompt, {
        maxTokens: 500,
        temperature: 0.7,
        stopSequences: ['\\nUser:', '\\nHuman:']
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
      
      // Add AI response to history
      client.conversationHistory.push({
        role: 'assistant',
        content: response.trim(),
        timestamp: new Date().toISOString()
      });
      
      // Signal end of response
      client.ws.send(JSON.stringify({
        type: 'stream_end',
        fullResponse: response.trim()
      }));
      
    } catch (error) {
      console.error(`❌ Chat error for client ${clientId}:`, error);
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Sorry, I encountered an error processing your message.'
      }));
    }
  }
  
  buildContext(history, maxEntries = 20) {
    const recentHistory = history.slice(-maxEntries);
    return recentHistory
      .map(entry => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.content}`)
      .join('\\n');
  }
  
  clearClientHistory(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.conversationHistory = [];
      client.ws.send(JSON.stringify({
        type: 'system',
        message: 'Conversation history cleared'
      }));
    }
  }
  
  generateClientId() {
    return Math.random().toString(36).substr(2, 9);
  }
  
  start() {
    this.server.listen(this.port, () => {
      console.log(`🚀 Web Chat Server running on http://localhost:${this.port}`);
    });
  }
  
  async stop() {
    console.log('🛑 Shutting down server...');
    
    // Close all WebSocket connections
    this.clients.forEach(client => {
      client.ws.close();
    });
    
    // Close server
    this.server.close();
    
    // Cleanup router
    await this.router.cleanup();
    
    console.log('✅ Server shutdown complete');
  }
}

// HTML Client Template
const clientHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Chat</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .header {
            background: #4a90e2;
            color: white;
            padding: 1rem;
            text-align: center;
        }
        
        .chat-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            max-width: 800px;
            margin: 0 auto;
            width: 100%;
            background: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        
        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
            border-bottom: 1px solid #eee;
        }
        
        .message {
            margin-bottom: 1rem;
            padding: 0.5rem 1rem;
            border-radius: 10px;
            max-width: 80%;
        }
        
        .user-message {
            background: #4a90e2;
            color: white;
            margin-left: auto;
        }
        
        .ai-message {
            background: #f0f0f0;
            color: #333;
        }
        
        .system-message {
            background: #ffeaa7;
            color: #333;
            text-align: center;
            font-style: italic;
        }
        
        .thinking {
            background: #fd79a8;
            color: white;
            font-style: italic;
        }
        
        .input-area {
            display: flex;
            padding: 1rem;
            gap: 1rem;
        }
        
        .message-input {
            flex: 1;
            padding: 0.75rem;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 1rem;
        }
        
        .send-button, .clear-button {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1rem;
            transition: background-color 0.2s;
        }
        
        .send-button {
            background: #4a90e2;
            color: white;
        }
        
        .send-button:hover { background: #357abd; }
        .send-button:disabled { background: #ccc; cursor: not-allowed; }
        
        .clear-button {
            background: #fd79a8;
            color: white;
        }
        
        .clear-button:hover { background: #e84393; }
        
        .status {
            padding: 0.5rem;
            text-align: center;
            font-size: 0.9rem;
            color: #666;
        }
        
        .typing-indicator {
            display: none;
            padding: 0.5rem 1rem;
            font-style: italic;
            color: #666;
        }
        
        .typing-indicator.show { display: block; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 AI Chat Assistant</h1>
        <div class="status" id="status">Connecting...</div>
    </div>
    
    <div class="chat-container">
        <div class="messages" id="messages"></div>
        <div class="typing-indicator" id="typing">AI is typing...</div>
        <div class="input-area">
            <input type="text" class="message-input" id="messageInput" 
                   placeholder="Type your message..." maxlength="500">
            <button class="send-button" id="sendButton">Send</button>
            <button class="clear-button" id="clearButton">Clear</button>
        </div>
    </div>
    
    <script>
        class ChatClient {
            constructor() {
                this.ws = null;
                this.isStreaming = false;
                this.currentMessage = null;
                this.setupElements();
                this.connect();
            }
            
            setupElements() {
                this.messagesDiv = document.getElementById('messages');
                this.messageInput = document.getElementById('messageInput');
                this.sendButton = document.getElementById('sendButton');
                this.clearButton = document.getElementById('clearButton');
                this.statusDiv = document.getElementById('status');
                this.typingDiv = document.getElementById('typing');
                
                this.messageInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        this.sendMessage();
                    }
                });
                
                this.sendButton.addEventListener('click', () => this.sendMessage());
                this.clearButton.addEventListener('click', () => this.clearChat());
            }
            
            connect() {
                const wsUrl = \`ws://\${window.location.host}\`;
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    this.statusDiv.textContent = 'Connected';
                    this.statusDiv.style.color = '#27ae60';
                };
                
                this.ws.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                };
                
                this.ws.onclose = () => {
                    this.statusDiv.textContent = 'Disconnected';
                    this.statusDiv.style.color = '#e74c3c';
                    setTimeout(() => this.connect(), 3000);
                };
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.statusDiv.textContent = 'Connection Error';
                    this.statusDiv.style.color = '#e74c3c';
                };
            }
            
            handleMessage(data) {
                switch (data.type) {
                    case 'system':
                        this.addMessage(data.message, 'system');
                        break;
                        
                    case 'thinking':
                        this.typingDiv.classList.add('show');
                        break;
                        
                    case 'stream_start':
                        this.typingDiv.classList.remove('show');
                        this.currentMessage = this.addMessage('', 'ai', true);
                        this.isStreaming = true;
                        break;
                        
                    case 'token':
                        if (this.currentMessage) {
                            this.currentMessage.textContent += data.content;
                            this.scrollToBottom();
                        }
                        break;
                        
                    case 'stream_end':
                        this.isStreaming = false;
                        this.currentMessage = null;
                        break;
                        
                    case 'error':
                        this.addMessage('Error: ' + data.message, 'system');
                        this.isStreaming = false;
                        break;
                }
            }
            
            sendMessage() {
                const message = this.messageInput.value.trim();
                if (!message || this.isStreaming) return;
                
                this.addMessage(message, 'user');
                this.messageInput.value = '';
                
                this.ws.send(JSON.stringify({
                    type: 'chat',
                    content: message
                }));
            }
            
            clearChat() {
                this.messagesDiv.innerHTML = '';
                this.ws.send(JSON.stringify({ type: 'clear' }));
            }
            
            addMessage(content, type, streaming = false) {
                const messageDiv = document.createElement('div');
                messageDiv.className = \`message \${type}-message\`;
                messageDiv.textContent = content;
                
                this.messagesDiv.appendChild(messageDiv);
                this.scrollToBottom();
                
                return streaming ? messageDiv : null;
            }
            
            scrollToBottom() {
                this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
            }
        }
        
        // Initialize chat client
        new ChatClient();
    </script>
</body>
</html>
`;

// Save client HTML file
import fs from 'fs/promises';

async function setupWebChat() {
  // Create public directory and save HTML
  await fs.mkdir('public', { recursive: true });
  await fs.writeFile('public/index.html', clientHTML);
  
  // Start the server
  const server = new WebChatServer(3000);
  await server.initialize();
  server.start();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
}

setupWebChat().catch(console.error);
```

## Multi-User Chat Server

### Multi-Room Chat System

```javascript
class MultiUserChatServer extends WebChatServer {
  constructor(port = 3000) {
    super(port);
    this.rooms = new Map();
    this.defaultRoom = 'general';
    this.createRoom(this.defaultRoom, 'General Chat');
  }
  
  createRoom(roomId, roomName) {
    this.rooms.set(roomId, {
      id: roomId,
      name: roomName,
      clients: new Set(),
      messageHistory: [],
      createdAt: new Date(),
      settings: {
        maxMessages: 100,
        allowFileUploads: false,
        moderationEnabled: true
      }
    });
    
    console.log(`🏠 Created room: ${roomName} (${roomId})`);
  }
  
  async handleMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'join_room':
          this.joinRoom(clientId, message.roomId || this.defaultRoom);
          break;
          
        case 'create_room':
          this.handleCreateRoom(clientId, message.roomName);
          break;
          
        case 'list_rooms':
          this.sendRoomList(clientId);
          break;
          
        case 'chat':
          await this.handleRoomChatMessage(clientId, message.content);
          break;
          
        case 'private_message':
          await this.handlePrivateMessage(clientId, message.targetId, message.content);
          break;
          
        default:
          await super.handleMessage(clientId, data);
      }
      
    } catch (error) {
      console.error(`❌ Error handling message from ${clientId}:`, error);
    }
  }
  
  joinRoom(clientId, roomId) {
    const client = this.clients.get(clientId);
    const room = this.rooms.get(roomId);
    
    if (!client || !room) return;
    
    // Leave current room
    if (client.currentRoom) {
      const currentRoom = this.rooms.get(client.currentRoom);
      if (currentRoom) {
        currentRoom.clients.delete(clientId);
        this.broadcastToRoom(client.currentRoom, {
          type: 'user_left',
          userId: clientId,
          message: \`User \${clientId} left the room\`
        });
      }
    }
    
    // Join new room
    client.currentRoom = roomId;
    room.clients.add(clientId);
    
    // Send room info to client
    client.ws.send(JSON.stringify({
      type: 'room_joined',
      roomId,
      roomName: room.name,
      userCount: room.clients.size,
      messageHistory: room.messageHistory.slice(-20) // Last 20 messages
    }));
    
    // Notify other users
    this.broadcastToRoom(roomId, {
      type: 'user_joined',
      userId: clientId,
      message: \`User \${clientId} joined the room\`
    }, clientId);
    
    console.log(\`👤 Client \${clientId} joined room \${roomId}\`);
  }
  
  async handleRoomChatMessage(clientId, userMessage) {
    const client = this.clients.get(clientId);
    if (!client || !client.currentRoom) return;
    
    const room = this.rooms.get(client.currentRoom);
    if (!room) return;
    
    // Add message to room history
    const messageEntry = {
      id: this.generateMessageId(),
      userId: clientId,
      content: userMessage,
      timestamp: new Date().toISOString(),
      type: 'user'
    };
    
    room.messageHistory.push(messageEntry);
    this.trimRoomHistory(room);
    
    // Broadcast user message to room
    this.broadcastToRoom(client.currentRoom, {
      type: 'user_message',
      userId: clientId,
      content: userMessage,
      timestamp: messageEntry.timestamp
    });
    
    // Generate AI response for the room
    try {
      const aiResponse = await this.generateRoomAIResponse(room, userMessage);
      
      const aiMessageEntry = {
        id: this.generateMessageId(),
        userId: 'ai',
        content: aiResponse,
        timestamp: new Date().toISOString(),
        type: 'ai'
      };
      
      room.messageHistory.push(aiMessageEntry);
      
      // Broadcast AI response to room
      this.broadcastToRoom(client.currentRoom, {
        type: 'ai_message',
        content: aiResponse,
        timestamp: aiMessageEntry.timestamp
      });
      
    } catch (error) {
      console.error(\`❌ AI response error in room \${client.currentRoom}:\`, error);
    }
  }
  
  async generateRoomAIResponse(room, userMessage) {
    // Build context from room history
    const context = room.messageHistory
      .slice(-10) // Last 10 messages
      .map(msg => \`\${msg.userId === 'ai' ? 'Assistant' : 'User'}: \${msg.content}\`)
      .join('\\n');
    
    const prompt = \`\${context}\\nUser: \${userMessage}\\nAssistant:\`;
    
    const result = await this.router.quick(prompt, {
      maxTokens: 200,
      temperature: 0.7
    });
    
    return result.text;
  }
  
  async handlePrivateMessage(senderId, targetId, content) {
    const sender = this.clients.get(senderId);
    const target = this.clients.get(targetId);
    
    if (!sender || !target) return;
    
    // Generate AI response to private message
    try {
      const aiResponse = await this.router.quick(\`User: \${content}\\nAssistant:\`, {
        maxTokens: 150,
        temperature: 0.7
      });
      
      // Send to both sender and target
      const messageData = {
        type: 'private_message',
        senderId,
        targetId,
        content,
        aiResponse: aiResponse.text,
        timestamp: new Date().toISOString()
      };
      
      sender.ws.send(JSON.stringify(messageData));
      target.ws.send(JSON.stringify(messageData));
      
    } catch (error) {
      console.error(\`❌ Private message error:\`, error);
    }
  }
  
  broadcastToRoom(roomId, message, excludeClientId = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    const messageStr = JSON.stringify(message);
    
    room.clients.forEach(clientId => {
      if (clientId !== excludeClientId) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === 1) {
          client.ws.send(messageStr);
        }
      }
    });
  }
  
  handleCreateRoom(clientId, roomName) {
    if (!roomName || roomName.trim().length === 0) return;
    
    const roomId = this.generateRoomId();
    this.createRoom(roomId, roomName.trim());
    
    const client = this.clients.get(clientId);
    if (client) {
      client.ws.send(JSON.stringify({
        type: 'room_created',
        roomId,
        roomName: roomName.trim()
      }));
      
      // Auto-join the creator to the new room
      this.joinRoom(clientId, roomId);
    }
  }
  
  sendRoomList(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    const roomList = Array.from(this.rooms.values()).map(room => ({
      id: room.id,
      name: room.name,
      userCount: room.clients.size,
      createdAt: room.createdAt
    }));
    
    client.ws.send(JSON.stringify({
      type: 'room_list',
      rooms: roomList
    }));
  }
  
  trimRoomHistory(room) {
    if (room.messageHistory.length > room.settings.maxMessages) {
      room.messageHistory.splice(0, room.messageHistory.length - room.settings.maxMessages);
    }
  }
  
  generateMessageId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  
  generateRoomId() {
    return 'room_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
  
  // Override WebSocket close handler
  setupServer() {
    super.setupServer();
    
    // Add room management routes
    this.app.get('/api/rooms', (req, res) => {
      const roomList = Array.from(this.rooms.values()).map(room => ({
        id: room.id,
        name: room.name,
        userCount: room.clients.size,
        messageCount: room.messageHistory.length
      }));
      
      res.json({ rooms: roomList });
    });
    
    this.app.post('/api/rooms', express.json(), (req, res) => {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Room name required' });
      }
      
      const roomId = this.generateRoomId();
      this.createRoom(roomId, name);
      
      res.json({ roomId, name });
    });
  }
}

// Usage
async function startMultiUserChat() {
  const server = new MultiUserChatServer(3000);
  await server.initialize();
  server.start();
  
  console.log('🏠 Multi-user chat server with rooms started');
  console.log('Available at: http://localhost:3000');
}

startMultiUserChat().catch(console.error);
```

## Context-Aware Chat

### Advanced Memory Management

```javascript
class ContextAwareChatBot {
  constructor(router) {
    this.router = router;
    this.memory = {
      shortTerm: [], // Recent conversation
      longTerm: new Map(), // Facts about user
      episodic: [], // Important conversation moments
      semantic: new Map() // General knowledge updates
    };
    
    this.memoryLimits = {
      shortTerm: 20,
      episodic: 50,
      longTerm: 1000
    };
    
    this.contextWindow = 10; // Messages to include in prompt
  }
  
  async processMessage(userMessage, userId = 'default') {
    // Extract information from user message
    await this.extractInformation(userMessage, userId);
    
    // Add to short-term memory
    this.addToShortTerm('user', userMessage);
    
    // Build context-aware prompt
    const prompt = this.buildContextualPrompt(userMessage, userId);
    
    // Generate response
    const response = await this.router.quick(prompt, {
      maxTokens: 300,
      temperature: 0.7
    });
    
    // Add AI response to memory
    this.addToShortTerm('assistant', response.text);
    
    // Extract any new information from the conversation
    await this.updateMemoryFromConversation(userMessage, response.text);
    
    return response;
  }
  
  async extractInformation(message, userId) {
    // Extract personal information
    const personalInfoPrompt = \`Extract any personal information from this message: "\${message}"
    Return in JSON format with keys: name, age, interests, preferences, location, occupation.
    Only include information that is explicitly mentioned. Return empty object if none found.\`;
    
    try {
      const result = await this.router.quick(personalInfoPrompt, {
        maxTokens: 100,
        temperature: 0.1
      });
      
      const info = this.parseJSON(result.text);
      if (info && Object.keys(info).length > 0) {
        this.updateLongTermMemory(userId, info);
      }
    } catch (error) {
      console.error('Error extracting information:', error);
    }
  }
  
  buildContextualPrompt(userMessage, userId) {
    let prompt = '';
    
    // Add user profile if available
    const userProfile = this.memory.longTerm.get(userId);
    if (userProfile && Object.keys(userProfile).length > 0) {
      prompt += 'User Profile:\\n';
      Object.entries(userProfile).forEach(([key, value]) => {
        if (value) prompt += \`- \${key}: \${value}\\n\`;
      });
      prompt += '\\n';
    }
    
    // Add recent conversation history
    const recentHistory = this.memory.shortTerm.slice(-this.contextWindow);
    if (recentHistory.length > 0) {
      prompt += 'Recent Conversation:\\n';
      recentHistory.forEach(entry => {
        prompt += \`\${entry.role === 'user' ? 'User' : 'Assistant'}: \${entry.content}\\n\`;
      });
    }
    
    // Add relevant episodic memories
    const relevantEpisodes = this.findRelevantEpisodes(userMessage);
    if (relevantEpisodes.length > 0) {
      prompt += '\\nRelevant Past Conversations:\\n';
      relevantEpisodes.forEach(episode => {
        prompt += \`- \${episode.summary}\\n\`;
      });
      prompt += '\\n';
    }
    
    prompt += \`\\nUser: \${userMessage}\\nAssistant:\`;
    
    return prompt;
  }
  
  addToShortTerm(role, content) {
    this.memory.shortTerm.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });
    
    // Trim if too long
    if (this.memory.shortTerm.length > this.memoryLimits.shortTerm) {
      // Move old conversations to episodic memory
      const removed = this.memory.shortTerm.splice(0, 2); // Remove 2 oldest
      this.considerForEpisodicMemory(removed);
    }
  }
  
  updateLongTermMemory(userId, newInfo) {
    const existing = this.memory.longTerm.get(userId) || {};
    const updated = { ...existing, ...newInfo };
    this.memory.longTerm.set(userId, updated);
    
    console.log(\`📝 Updated profile for \${userId}:\`, newInfo);
  }
  
  async considerForEpisodicMemory(conversationPair) {
    if (conversationPair.length < 2) return;
    
    const [userMsg, aiMsg] = conversationPair;
    
    // Determine if this conversation is worth remembering
    const importancePrompt = \`Rate the importance of remembering this conversation (0-10):
    User: \${userMsg.content}
    Assistant: \${aiMsg.content}
    
    Consider: emotional significance, personal information, important decisions, or unique topics.
    Return only a number 0-10.\`;
    
    try {
      const result = await this.router.quick(importancePrompt, {
        maxTokens: 5,
        temperature: 0.1
      });
      
      const importance = parseInt(result.text.trim());
      
      if (importance >= 7) {
        // Create summary for episodic memory
        const summaryPrompt = \`Summarize this important conversation in 1-2 sentences:
        User: \${userMsg.content}
        Assistant: \${aiMsg.content}\`;
        
        const summaryResult = await this.router.quick(summaryPrompt, {
          maxTokens: 50,
          temperature: 0.5
        });
        
        this.memory.episodic.push({
          summary: summaryResult.text.trim(),
          importance,
          timestamp: userMsg.timestamp,
          originalExchange: conversationPair
        });
        
        // Trim episodic memory if needed
        if (this.memory.episodic.length > this.memoryLimits.episodic) {
          this.memory.episodic.sort((a, b) => b.importance - a.importance);
          this.memory.episodic = this.memory.episodic.slice(0, this.memoryLimits.episodic);
        }
        
        console.log(\`💭 Added to episodic memory (importance: \${importance})\`);
      }
    } catch (error) {
      console.error('Error evaluating conversation importance:', error);
    }
  }
  
  findRelevantEpisodes(userMessage, maxResults = 3) {
    // Simple keyword matching for relevance
    const userWords = userMessage.toLowerCase().split(/\\W+/);
    
    return this.memory.episodic
      .map(episode => {
        const episodeWords = episode.summary.toLowerCase().split(/\\W+/);
        const commonWords = userWords.filter(word => 
          word.length > 3 && episodeWords.includes(word)
        );
        
        return {
          ...episode,
          relevanceScore: commonWords.length
        };
      })
      .filter(episode => episode.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
  }
  
  async updateMemoryFromConversation(userMessage, aiResponse) {
    // Check if the AI mentioned learning something new
    const learningPrompt = \`Did the assistant learn any new facts or information from this conversation?
    User: \${userMessage}
    Assistant: \${aiResponse}
    
    Extract any new factual information the assistant should remember. Return as JSON object or empty object.\`;
    
    try {
      const result = await this.router.quick(learningPrompt, {
        maxTokens: 100,
        temperature: 0.1
      });
      
      const newFacts = this.parseJSON(result.text);
      if (newFacts && Object.keys(newFacts).length > 0) {
        Object.entries(newFacts).forEach(([key, value]) => {
          this.memory.semantic.set(key, {
            value,
            learnedAt: new Date().toISOString(),
            confidence: 0.8
          });
        });
        
        console.log('🧠 Learned new facts:', newFacts);
      }
    } catch (error) {
      console.error('Error updating semantic memory:', error);
    }
  }
  
  parseJSON(text) {
    try {
      // Clean up the text to extract JSON
      const jsonMatch = text.match(/\\{[^}]*\\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch (error) {
      return {};
    }
  }
  
  getMemoryStatus() {
    return {
      shortTerm: this.memory.shortTerm.length,
      longTerm: this.memory.longTerm.size,
      episodic: this.memory.episodic.length,
      semantic: this.memory.semantic.size
    };
  }
  
  exportMemory() {
    return {
      shortTerm: this.memory.shortTerm,
      longTerm: Object.fromEntries(this.memory.longTerm),
      episodic: this.memory.episodic,
      semantic: Object.fromEntries(this.memory.semantic)
    };
  }
  
  importMemory(memoryData) {
    if (memoryData.shortTerm) this.memory.shortTerm = memoryData.shortTerm;
    if (memoryData.longTerm) this.memory.longTerm = new Map(Object.entries(memoryData.longTerm));
    if (memoryData.episodic) this.memory.episodic = memoryData.episodic;
    if (memoryData.semantic) this.memory.semantic = new Map(Object.entries(memoryData.semantic));
  }
}

// Usage example
async function demonstrateContextAwareChat() {
  const router = new LLMRouter();
  await router.initialize();
  await router.load('models/chat-model.gguf');
  
  const chatBot = new ContextAwareChatBot(router);
  
  // Simulate a conversation
  const conversation = [
    "Hi, I'm John and I'm 25 years old. I love programming.",
    "I'm working on a React project for my job at Google.",
    "Do you remember what I told you about my age?",
    "What kind of work do I do?",
    "I'm having trouble with state management in React.",
    "Thanks! By the way, I also enjoy hiking on weekends.",
    "Can you suggest some hiking trails for someone like me?"
  ];
  
  console.log('🧠 Starting context-aware conversation...\\n');
  
  for (const [index, message] of conversation.entries()) {
    console.log(\`--- Turn \${index + 1} ---\`);
    console.log(\`User: \${message}\`);
    
    const response = await chatBot.processMessage(message, 'john');
    console.log(\`AI: \${response.text}\`);
    
    const memoryStatus = chatBot.getMemoryStatus();
    console.log(\`Memory: ST:\${memoryStatus.shortTerm} LT:\${memoryStatus.longTerm} E:\${memoryStatus.episodic} S:\${memoryStatus.semantic}\`);
    console.log('');
  }
  
  // Show final memory state
  console.log('🧠 Final Memory State:');
  console.log(JSON.stringify(chatBot.exportMemory(), null, 2));
}

demonstrateContextAwareChat().catch(console.error);
```

This comprehensive chat examples guide covers everything from simple terminal interfaces to sophisticated multi-user systems with advanced memory management, perfect for building any kind of conversational AI application.