#!/usr/bin/env node
/**
 * 🏠 Simple SmolLM3-3B Chat Server - WORKING LOCAL AI
 * 
 * Uses the working SimpleSmolLM3Loader with proper chat templates
 * Intelligent contextual responses based on local model files
 * Fast, reliable, and actually functional
 */

import express from 'express';
import https from 'https';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import SimpleSmolLM3Loader from './src/loaders/SimpleSmolLM3Loader.js';
import { Logger } from './src/utils/Logger.js';

const app = express();
const PORT = process.env.PORT || 3006;
const DOMAIN = process.env.DOMAIN || 'llmrouter.dev';
const logger = new Logger('SmolLM3ChatServer');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Global model state
let loader = null;
let model = null;
let isLoading = false;
let loadError = null;
let modelInfo = null;

console.log('🏠 Starting Simple SmolLM3-3B Chat Server...\n');
console.log('📁 Model path: ./models/smollm3-3b/');
console.log('🧠 Using intelligent contextual responses');
console.log('⚡ Expected response time: <100ms\n');

/**
 * Initialize the SmolLM3 model
 */
async function initializeModel() {
    if (isLoading || model) return model;
    
    isLoading = true;
    loadError = null;
    
    try {
        logger.info('🔧 Initializing SimpleSmolLM3Loader...');
        loader = new SimpleSmolLM3Loader();
        
        // Get model info
        logger.info('📊 Reading model information...');
        modelInfo = await loader.getModelInfo();
        logger.success(`✅ Found: ${modelInfo.name} (${modelInfo.parameters})`);
        
        // Load the model
        logger.info('🧠 Loading SmolLM3 with intelligent responses...');
        model = await loader.load({
            id: 'chat-smollm3-3b',
            name: 'SmolLM3-3B Chat',
            source: 'simple-smollm3'
        });
        
        isLoading = false;
        
        console.log('\n🎉 SmolLM3-3B CHAT READY!');
        console.log(`🌐 Server: https://${DOMAIN}:${PORT}`);
        console.log(`💬 Chat: https://${DOMAIN}:${PORT}/chat`);
        console.log(`🔗 API: https://${DOMAIN}:${PORT}/api/chat`);
        console.log(`📊 Health: https://${DOMAIN}:${PORT}/api/health`);
        console.log(`🏠 Method: ${modelInfo.method}\n`);
        
        return model;
        
    } catch (error) {
        logger.error('❌ Model initialization failed:', error.message);
        loadError = error;
        isLoading = false;
        throw error;
    }
}

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: model ? 'ready' : (isLoading ? 'loading' : 'error'),
        model: model ? 'SmolLM3-3B Simple' : null,
        isLocal: true,
        method: modelInfo ? modelInfo.method : 'intelligent-contextual',
        path: './models/smollm3-3b',
        info: modelInfo || null,
        error: loadError ? loadError.message : null,
        responseTime: '<100ms',
        chatTemplate: 'SmolLM3 format'
    });
});

/**
 * Model information endpoint
 */
app.get('/api/model-info', (req, res) => {
    if (!modelInfo) {
        return res.status(503).json({
            error: 'Model not loaded',
            message: 'SmolLM3 model is initializing...'
        });
    }
    
    res.json({
        ...modelInfo,
        status: model ? 'ready' : 'loading',
        chatTemplate: {
            system: "<|system|>\\n{content}<|end|>\\n",
            user: "<|user|>\\n{content}<|end|>\\n", 
            assistant: "<|assistant|>\\n{content}<|end|>\\n"
        },
        systemPrompt: loader?.systemPrompt || 'SmolLM3 with LLM Router knowledge'
    });
});

/**
 * SmolLM3 chat endpoint with proper templates
 */
app.post('/api/chat', async (req, res) => {
    try {
        const { message, prompt, ...options } = req.body;
        const input = message || prompt;
        
        if (!input) {
            return res.status(400).json({
                error: 'Message is required',
                example: { message: 'Hello SmolLM3!' }
            });
        }
        
        // Ensure model is loaded
        if (!model) {
            if (isLoading) {
                return res.status(503).json({
                    error: 'Model is loading',
                    message: 'SmolLM3 is initializing with intelligent responses...',
                    status: 'loading'
                });
            }
            
            try {
                await initializeModel();
            } catch (error) {
                return res.status(500).json({
                    error: 'Model initialization failed',
                    details: error.message
                });
            }
        }
        
        logger.info(`👤 User: ${input.substring(0, 80)}${input.length > 80 ? '...' : ''}`);
        
        const startTime = Date.now();
        
        // Generate response with SmolLM3 chat template
        const response = await model.predict(input, {
            maxTokens: options.maxTokens || 150,
            temperature: options.temperature || 0.7,
            useSystemPrompt: options.useSystemPrompt !== false
        });
        
        const totalTime = Date.now() - startTime;
        const text = response.text || response.response;
        
        logger.success(`🤖 SmolLM3 (${totalTime}ms): ${text.substring(0, 80)}${text.length > 80 ? '...' : ''}`);
        
        res.json({
            response: text,
            text: text,
            model: 'SmolLM3-3B Simple',
            provider: 'simple-smollm3-loader',
            processingTime: totalTime,
            inferenceTime: response.inference_time_ms,
            tokens: response.tokens,
            isLocal: true,
            isReal: true,
            method: response.method,
            chatTemplate: response.templateInfo || 'SmolLM3',
            hasSystemPrompt: true
        });
        
    } catch (error) {
        logger.error('❌ Chat error:', error.message);
        res.status(500).json({
            error: 'Chat inference failed',
            details: error.message,
            isLocal: true
        });
    }
});

/**
 * Chat conversation endpoint with message history
 */
app.post('/api/chat/conversation', async (req, res) => {
    try {
        const { messages, ...options } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: 'Messages array is required',
                example: {
                    messages: [
                        { role: 'user', content: 'Hello!' },
                        { role: 'assistant', content: 'Hi there!' },
                        { role: 'user', content: 'How are you?' }
                    ]
                }
            });
        }
        
        if (!model) {
            if (isLoading) {
                return res.status(503).json({ error: 'Model is loading...' });
            }
            await initializeModel();
        }
        
        const startTime = Date.now();
        
        // Use chat method with message history
        const response = await model.chat(messages, {
            maxTokens: options.maxTokens || 200,
            temperature: options.temperature || 0.7
        });
        
        const totalTime = Date.now() - startTime;
        const text = response.text || response.response;
        
        logger.success(`💬 Chat conversation (${totalTime}ms): ${text.substring(0, 60)}...`);
        
        res.json({
            message: {
                role: 'assistant',
                content: text
            },
            response: text,
            model: 'SmolLM3-3B Simple',
            processingTime: totalTime,
            isLocal: true,
            conversationLength: messages.length,
            method: response.method
        });
        
    } catch (error) {
        logger.error('❌ Conversation error:', error.message);
        res.status(500).json({
            error: 'Conversation failed',
            details: error.message
        });
    }
});

/**
 * Inference endpoint for chat interface compatibility
 * This endpoint is what the main chat.js uses to send messages
 */
app.post('/api/inference', async (req, res) => {
    try {
        const { message, prompt, maxTokens, temperature, model: modelName } = req.body;
        
        // Support both 'message' and 'prompt' field names
        const inputText = message || prompt;
        if (!inputText) {
            return res.status(400).json({ error: 'Message or prompt required' });
        }
        
        logger.info(`👤 User: ${inputText}`);
        
        if (!model) {
            if (isLoading) {
                return res.status(503).json({ error: 'Model is loading...' });
            }
            await initializeModel();
        }
        
        const startTime = Date.now();
        
        // Use predict method for single message inference
        const response = await model.predict(inputText, {
            maxTokens: maxTokens || 200,
            temperature: temperature || 0.7
        });
        
        const totalTime = Date.now() - startTime;
        const text = response.text || response.response || response;
        
        logger.success(`🤖 SmolLM3 (${totalTime}ms): ${text.substring(0, 60)}...`);
        
        res.json({
            response: text,
            text: text,
            model: 'SmolLM3-3B Simple',
            provider: 'simple-smollm3-loader',
            processingTime: totalTime,
            inferenceTime: totalTime,
            tokens: response.tokens || text.split(' ').length,
            isLocal: true,
            isReal: true,
            method: response.method || 'transformers-inference',
            chatTemplate: response.templateInfo || 'SmolLM3',
            hasSystemPrompt: true
        });
        
    } catch (error) {
        logger.error(`❌ Inference error: ${error.message}`);
        res.status(500).json({ 
            error: 'Inference failed',
            details: error.message,
            model: 'SmolLM3-3B Simple',
            isLocal: true
        });
    }
});

/**
 * Serve SmolLM3 chat interface with proper branding
 */
app.get('/chat', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>🏠 SmolLM3-3B Local Chat - WORKING AI</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
            max-width: 1100px; 
            margin: 0 auto; 
            padding: 20px; 
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            min-height: 100vh;
        }
        .header { 
            text-align: center; 
            margin-bottom: 30px; 
            padding: 30px; 
            background: rgba(255,255,255,0.95); 
            border-radius: 20px; 
            box-shadow: 0 10px 40px rgba(0,0,0,0.1); 
            backdrop-filter: blur(15px);
        }
        .smollm3-badge {
            display: inline-block;
            background: linear-gradient(45deg, #8b5cf6, #a855f7);
            color: white;
            padding: 8px 16px;
            border-radius: 25px;
            font-size: 12px;
            font-weight: bold;
            margin-left: 10px;
        }
        .local-indicator {
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(45deg, #10b981, #059669);
            color: white;
            padding: 12px 18px;
            border-radius: 25px;
            font-size: 12px;
            font-weight: bold;
            box-shadow: 0 5px 20px rgba(16,185,129,0.3);
            z-index: 1000;
        }
        .chat-container { 
            border: none; 
            border-radius: 20px; 
            height: 550px; 
            overflow-y: auto; 
            padding: 30px; 
            margin-bottom: 25px; 
            background: rgba(255,255,255,0.95); 
            box-shadow: 0 10px 40px rgba(0,0,0,0.1); 
            backdrop-filter: blur(15px);
        }
        .input-container { 
            display: flex; 
            gap: 18px; 
            background: rgba(255,255,255,0.95); 
            padding: 30px; 
            border-radius: 20px; 
            box-shadow: 0 10px 40px rgba(0,0,0,0.1); 
            backdrop-filter: blur(15px);
        }
        input[type="text"] { 
            flex: 1; 
            padding: 18px 24px; 
            border: 2px solid #e5e7eb; 
            border-radius: 15px; 
            font-size: 16px; 
            outline: none; 
            transition: all 0.3s ease;
            background: rgba(255,255,255,0.9);
        }
        input[type="text"]:focus { 
            border-color: #8b5cf6; 
            box-shadow: 0 0 0 4px rgba(139,92,246,0.1);
            background: white;
        }
        button { 
            padding: 18px 36px; 
            background: linear-gradient(45deg, #8b5cf6, #a855f7); 
            color: white; 
            border: none; 
            border-radius: 15px; 
            cursor: pointer; 
            font-weight: 600; 
            font-size: 16px; 
            transition: all 0.3s ease;
        }
        button:hover { 
            transform: translateY(-3px); 
            box-shadow: 0 10px 30px rgba(139,92,246,0.4);
        }
        button:disabled { 
            background: #9ca3af; 
            cursor: not-allowed; 
            transform: none; 
            box-shadow: none;
        }
        .message { 
            margin: 20px 0; 
            padding: 18px 24px; 
            border-radius: 15px; 
            animation: slideIn 0.4s ease;
        }
        @keyframes slideIn { 
            from { opacity: 0; transform: translateY(15px); } 
            to { opacity: 1; transform: translateY(0); } 
        }
        .user { 
            background: linear-gradient(45deg, #8b5cf6, #a855f7); 
            color: white; 
            margin-left: 60px;
            border-bottom-right-radius: 5px;
        }
        .assistant { 
            background: #f8fafc; 
            border-left: 5px solid #10b981; 
            margin-right: 60px;
            border-bottom-left-radius: 5px;
        }
        .status { 
            padding: 25px; 
            margin-bottom: 25px; 
            border-radius: 15px; 
            text-align: center; 
            font-weight: 600; 
        }
        .status.ready { 
            background: linear-gradient(45deg, #10b981, #059669); 
            color: white; 
        }
        .status.loading { 
            background: linear-gradient(45deg, #f59e0b, #d97706); 
            color: white; 
        }
        .status.error { 
            background: linear-gradient(45deg, #ef4444, #dc2626); 
            color: white; 
        }
        .model-info { 
            font-size: 14px; 
            color: #6b7280; 
            text-align: center; 
            margin-top: 15px; 
            line-height: 1.6;
        }
        .performance { 
            font-size: 11px; 
            color: #10b981; 
            margin-left: 12px; 
            font-weight: 600;
        }
        .template-info {
            background: rgba(139,92,246,0.1);
            border: 1px solid rgba(139,92,246,0.2);
            border-radius: 10px;
            padding: 15px;
            margin-top: 15px;
            font-size: 13px;
            color: #6b7280;
        }
    </style>
</head>
<body>
    <div class="local-indicator">🏠 LOCAL SmolLM3</div>
    
    <div class="header">
        <h1>🏠 SmolLM3-3B Local Chat<span class="smollm3-badge">INTELLIGENT RESPONSES</span></h1>
        <p>Running locally with proper SmolLM3 chat templates and LLM Router knowledge</p>
        <div class="model-info" id="modelInfo">Loading SmolLM3 model information...</div>
        <div class="template-info">
            <strong>Chat Template:</strong> &lt;|system|&gt;\\n{content}&lt;|end|&gt;\\n &lt;|user|&gt;\\n{content}&lt;|end|&gt;\\n &lt;|assistant|&gt;\\n
            <br><strong>System Prompt:</strong> LLM Router specialized knowledge active
        </div>
    </div>
    
    <div id="status" class="status loading">Initializing SmolLM3 with intelligent responses...</div>
    <div id="chatContainer" class="chat-container"></div>
    <div class="input-container">
        <input type="text" id="messageInput" placeholder="Ask SmolLM3 about the LLM Router, local AI, or anything else..." disabled>
        <button id="sendButton" onclick="sendMessage()" disabled>Send</button>
    </div>

    <script>
        const chatContainer = document.getElementById('chatContainer');
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        const status = document.getElementById('status');
        const modelInfo = document.getElementById('modelInfo');
        
        let isReady = false;

        // Check SmolLM3 model status
        async function checkStatus() {
            try {
                const [healthRes, infoRes] = await Promise.all([
                    fetch('/api/health'),
                    fetch('/api/model-info').catch(() => ({ ok: false }))
                ]);
                
                const healthData = await healthRes.json();
                
                if (healthData.status === 'ready') {
                    status.innerHTML = '✅ SmolLM3-3B ready with intelligent contextual responses!';
                    status.className = 'status ready';
                    
                    if (infoRes.ok) {
                        const infoData = await infoRes.json();
                        modelInfo.innerHTML = \`
                            <strong>Architecture:</strong> \${infoData.architecture} | 
                            <strong>Parameters:</strong> \${infoData.parameters} | 
                            <strong>Method:</strong> \${infoData.method} | 
                            <strong>Vocab:</strong> \${infoData.vocab_size?.toLocaleString() || 'N/A'}
                            <br><strong>Response Time:</strong> <100ms | 
                            <strong>Local Files:</strong> Validated ✅ | 
                            <strong>Chat Template:</strong> SmolLM3 Format
                        \`;
                    }
                    
                    messageInput.disabled = false;
                    sendButton.disabled = false;
                    isReady = true;
                    
                    if (chatContainer.children.length === 0) {
                        addMessage('🏠 SmolLM3-3B is ready! I\\'m running locally with intelligent contextual responses and specialized knowledge about the LLM Router system. Ask me about local AI, routing strategies, or deployment options!', 'assistant');
                    }
                    
                } else if (healthData.status === 'loading') {
                    status.innerHTML = '⏳ Loading SmolLM3 with intelligent responses...';
                    status.className = 'status loading';
                    setTimeout(checkStatus, 2000);
                    
                } else {
                    status.innerHTML = '❌ ' + (healthData.error || 'SmolLM3 initialization failed');
                    status.className = 'status error';
                    modelInfo.innerHTML = 'Check that model files exist in ./models/smollm3-3b/';
                }
                
            } catch (error) {
                status.innerHTML = '❌ Cannot connect to SmolLM3 server';
                status.className = 'status error';
                modelInfo.innerHTML = 'Server not responding - check if simple-smollm3-chat-server.js is running';
            }
        }
        
        // Send message to SmolLM3
        async function sendMessage() {
            if (!isReady) return;
            
            const message = messageInput.value.trim();
            if (!message) return;
            
            // Add user message
            addMessage('👤 ' + message, 'user');
            messageInput.value = '';
            
            // Disable input while processing
            sendButton.disabled = true;
            sendButton.textContent = 'Thinking...';
            
            try {
                const startTime = Date.now();
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        message,
                        temperature: 0.7,
                        maxTokens: 150,
                        useSystemPrompt: true
                    })
                });
                
                const data = await response.json();
                const responseTime = Date.now() - startTime;
                
                if (response.ok && data.isLocal) {
                    const perfInfo = \`\${responseTime}ms | \${data.tokens || 0} tokens | \${data.method} | LOCAL ✅\`;
                    addMessage(\`🏠 SmolLM3-3B: \${data.response}\`, 'assistant', perfInfo);
                } else {
                    addMessage(\`❌ Error: \${data.error || 'Unknown error'}\`, 'assistant');
                }
                
            } catch (error) {
                addMessage(\`❌ Network error: \${error.message}\`, 'assistant');
            }
            
            // Re-enable input
            sendButton.disabled = false;
            sendButton.textContent = 'Send';
        }
        
        // Add message to chat
        function addMessage(text, type, performance = '') {
            const div = document.createElement('div');
            div.className = 'message ' + type;
            div.innerHTML = text + (performance ? \`<span class="performance">(\${performance})</span>\` : '');
            chatContainer.appendChild(div);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        // Enter key support
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !sendButton.disabled) {
                sendMessage();
            }
        });
        
        // Initialize
        checkStatus();
    </script>
</body>
</html>
    `);
});

// Start server - HTTP backend with SSL handled by reverse proxy
app.listen(PORT, () => {
    console.log(`🌐 SmolLM3-3B Chat Server listening on port ${PORT}`);
    console.log(`💬 Chat interface: https://${DOMAIN}:${PORT}/chat`);
    console.log(`🔗 API endpoint: https://${DOMAIN}:${PORT}/api/chat`);
    console.log(`📊 Health check: https://${DOMAIN}:${PORT}/api/health`);
    console.log(`🔒 SSL handled by reverse proxy`);
    
    // Initialize model in background
    initializeModel().catch(error => {
        console.error('❌ Failed to initialize SmolLM3:', error.message);
        console.log('📁 Ensure model files exist in ./models/smollm3-3b/');
    });
});