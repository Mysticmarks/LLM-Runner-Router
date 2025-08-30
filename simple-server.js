#!/usr/bin/env node
/**
 * Simple LLM Chat Server - ACTUALLY WORKS
 * No complex routing, no unnecessary abstractions
 * Just working AI chat with SmolLM3
 */

import express from 'express';
import cors from 'cors';
import SmolLM3Loader from './src/loaders/SmolLM3Loader.js';

const app = express();
const PORT = process.env.PORT || 3002;

// Simple middleware
app.use(cors());
app.use(express.json());

// Global model instance
let model = null;
let isLoading = false;
let loadError = null;

console.log('🚀 Simple LLM Chat Server Starting...\n');

// Initialize the model
async function initializeModel() {
    if (isLoading || model) return model;
    
    isLoading = true;
    console.log('📦 Loading SmolLM3 model...');
    
    try {
        const loader = new SmolLM3Loader();
        model = await loader.load({
            id: 'simple-chat',
            name: 'SmolLM3 Simple Chat',
            source: 'smollm3'
        });
        
        console.log('✅ SmolLM3 model loaded successfully!\n');
        console.log(`🌐 Server running at: http://localhost:${PORT}`);
        console.log(`💬 Chat interface: http://localhost:${PORT}/chat`);
        console.log(`🔗 API endpoint: http://localhost:${PORT}/api/chat\n`);
        
        isLoading = false;
        return model;
        
    } catch (error) {
        console.error('❌ Failed to load model:', error.message);
        loadError = error;
        isLoading = false;
        throw error;
    }
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: model ? 'ready' : (isLoading ? 'loading' : 'error'),
        model: model ? 'SmolLM3-3B' : null,
        error: loadError ? loadError.message : null
    });
});

// Simple chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, prompt } = req.body;
        const input = message || prompt;
        
        if (!input) {
            return res.status(400).json({ error: 'Message required' });
        }
        
        // Ensure model is loaded
        if (!model) {
            if (isLoading) {
                return res.status(503).json({ error: 'Model is loading, please wait...' });
            }
            await initializeModel();
        }
        
        console.log(`👤 User: ${input}`);
        
        const start = Date.now();
        const response = await model.predict(input, {
            maxTokens: req.body.maxTokens || 100,
            temperature: req.body.temperature || 0.7
        });
        const time = Date.now() - start;
        
        const text = response.text || response.response || response;
        console.log(`🤖 SmolLM3 (${time}ms): ${text}`);
        
        res.json({
            response: text,
            text: text,
            model: 'SmolLM3-3B',
            provider: 'SmolLM3Loader (Transformers.js)',
            processingTime: time,
            usage: {
                totalTokens: response.tokens || Math.floor(text.length / 4)
            },
            strategy: 'simple'
        });
        
    } catch (error) {
        console.error('❌ Chat error:', error.message);
        res.status(500).json({ 
            error: 'AI inference failed', 
            details: error.message 
        });
    }
});

// Serve a simple chat interface
app.get('/chat', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Simple LLM Chat - WORKING AI</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .chat-container { border: 1px solid #ddd; border-radius: 8px; height: 400px; overflow-y: auto; padding: 15px; margin-bottom: 20px; background: #f9f9f9; }
        .input-container { display: flex; gap: 10px; }
        input[type="text"] { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        button:disabled { background: #ccc; cursor: not-allowed; }
        .message { margin: 10px 0; }
        .user { color: #2c5aa0; font-weight: bold; }
        .assistant { color: #d73527; }
        .status { padding: 10px; margin-bottom: 10px; border-radius: 4px; }
        .status.ready { background: #d4edda; color: #155724; }
        .status.loading { background: #fff3cd; color: #856404; }
        .status.error { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <h1>🤖 Simple LLM Chat - WORKING AI</h1>
    <div id="status" class="status loading">Checking model status...</div>
    <div id="chatContainer" class="chat-container"></div>
    <div class="input-container">
        <input type="text" id="messageInput" placeholder="Type your message here..." disabled>
        <button id="sendButton" onclick="sendMessage()" disabled>Send</button>
    </div>

    <script>
        const chatContainer = document.getElementById('chatContainer');
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        const status = document.getElementById('status');
        
        let isReady = false;
        
        // Check status
        async function checkStatus() {
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                
                if (data.status === 'ready') {
                    status.innerHTML = '✅ SmolLM3 model ready - Start chatting!';
                    status.className = 'status ready';
                    messageInput.disabled = false;
                    sendButton.disabled = false;
                    isReady = true;
                } else if (data.status === 'loading') {
                    status.innerHTML = '⏳ Loading SmolLM3 model... (this may take a few moments)';
                    status.className = 'status loading';
                    setTimeout(checkStatus, 2000);
                } else {
                    status.innerHTML = '❌ Model error: ' + (data.error || 'Unknown error');
                    status.className = 'status error';
                }
            } catch (error) {
                status.innerHTML = '❌ Server not responding: ' + error.message;
                status.className = 'status error';
            }
        }
        
        // Send message
        async function sendMessage() {
            if (!isReady) return;
            
            const message = messageInput.value.trim();
            if (!message) return;
            
            // Add user message
            addMessage('👤 You: ' + message, 'user');
            messageInput.value = '';
            
            // Disable input while processing
            sendButton.disabled = true;
            sendButton.textContent = 'Thinking...';
            
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    addMessage('🤖 SmolLM3 (' + data.processingTime + 'ms): ' + data.response, 'assistant');
                } else {
                    addMessage('❌ Error: ' + data.error, 'error');
                }
            } catch (error) {
                addMessage('❌ Network error: ' + error.message, 'error');
            }
            
            // Re-enable input
            sendButton.disabled = false;
            sendButton.textContent = 'Send';
        }
        
        // Add message to chat
        function addMessage(text, type) {
            const div = document.createElement('div');
            div.className = 'message ' + type;
            div.textContent = text;
            chatContainer.appendChild(div);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        // Enter key support
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !sendButton.disabled) {
                sendMessage();
            }
        });
        
        // Start status check
        checkStatus();
    </script>
</body>
</html>
    `);
});

// Start server and initialize model
app.listen(PORT, async () => {
    console.log(`🌐 Server listening on port ${PORT}`);
    
    // Initialize model in background
    initializeModel().catch(error => {
        console.error('❌ Failed to initialize model:', error.message);
    });
});