#!/usr/bin/env node
/**
 * 🦙 Ollama-Powered LLM Chat Server - REAL AI THAT WORKS
 * 
 * This is the solution to the fake AI problem - uses real Ollama models
 * with proper local inference. No more fake responses!
 * 
 * Prerequisites:
 * 1. Install Ollama: curl -fsSL https://ollama.ai/install.sh | sh
 * 2. Start Ollama: ollama serve
 * 3. Pull SmolLM3: ollama pull huggingface.co/HuggingFaceTB/SmolLM3-3B-Base:latest
 * 4. Or pull any model: ollama pull qwen2.5:3b-instruct-q4_K_M
 */

import express from 'express';
import cors from 'cors';
import { LLMRouter } from './src/index.js';
import OllamaAdapter from './src/loaders/adapters/OllamaAdapter.js';
import { Logger } from './src/utils/Logger.js';

const app = express();
const PORT = process.env.PORT || 3004;
const logger = new Logger('OllamaServer');

// Middleware
app.use(cors());
app.use(express.json());

// Global router and adapter
let router = null;
let ollamaAdapter = null;
let availableModels = [];
let currentModel = null;

console.log('🦙 Starting Ollama-Powered LLM Chat Server...\n');

/**
 * Initialize Ollama and discover models
 */
async function initializeOllama() {
    try {
        logger.info('🔧 Initializing LLM Router...');
        router = new LLMRouter();
        await router.initialize();
        
        logger.info('🦙 Setting up Ollama adapter...');
        ollamaAdapter = new OllamaAdapter();
        
        // Check if Ollama is available
        const isAvailable = await ollamaAdapter.isAvailable();
        if (!isAvailable) {
            throw new Error('Ollama server not available at http://localhost:11434');
        }
        
        logger.success('✅ Ollama server is running!');
        
        // Discover available models
        logger.info('🔍 Discovering Ollama models...');
        availableModels = await ollamaAdapter.getAvailableModels();
        
        if (availableModels.length === 0) {
            logger.warn('⚠️  No models found! Please pull at least one model:');
            logger.info('  ollama pull qwen2.5:3b-instruct-q4_K_M');
            logger.info('  ollama pull huggingface.co/HuggingFaceTB/SmolLM3-3B-Base:latest');
            return false;
        }
        
        logger.success(`✅ Found ${availableModels.length} Ollama models:`);
        availableModels.forEach(model => {
            logger.info(`  - ${model.name} (${(model.size / 1024 / 1024 / 1024).toFixed(1)}GB)`);
        });
        
        // Set default model (prefer SmolLM3, fallback to first available)
        const smolLM3Model = availableModels.find(m => 
            m.name.toLowerCase().includes('smol') || 
            m.name.toLowerCase().includes('smollm3')
        );
        
        currentModel = smolLM3Model || availableModels[0];
        logger.success(`🎯 Using default model: ${currentModel.name}`);
        
        return true;
        
    } catch (error) {
        logger.error('❌ Ollama initialization failed:', error.message);
        
        if (error.message.includes('Connection refused') || error.message.includes('not available')) {
            logger.info('\n🔧 Setup Instructions:');
            logger.info('1. Install Ollama: curl -fsSL https://ollama.ai/install.sh | sh');
            logger.info('2. Start Ollama: ollama serve');
            logger.info('3. Pull a model: ollama pull qwen2.5:3b-instruct-q4_K_M');
            logger.info('4. For SmolLM3: ollama pull huggingface.co/HuggingFaceTB/SmolLM3-3B-Base:latest');
        }
        
        return false;
    }
}

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: ollamaAdapter && currentModel ? 'ready' : 'error',
        provider: 'ollama',
        model: currentModel ? currentModel.name : null,
        availableModels: availableModels.length,
        server: 'http://localhost:11434'
    });
});

/**
 * List available models
 */
app.get('/api/models', (req, res) => {
    res.json({
        models: availableModels.map(model => ({
            id: model.name,
            name: model.name,
            size: model.size,
            sizeGB: (model.size / 1024 / 1024 / 1024).toFixed(1),
            digest: model.digest,
            modified_at: model.modified_at
        })),
        currentModel: currentModel ? currentModel.name : null
    });
});

/**
 * Real AI chat endpoint using Ollama
 */
app.post('/api/chat', async (req, res) => {
    try {
        const { message, prompt, model: requestedModel, ...options } = req.body;
        const input = message || prompt;
        
        if (!input) {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        if (!ollamaAdapter || !currentModel) {
            return res.status(503).json({ 
                error: 'Ollama not initialized. Please check server setup.',
                setup: {
                    step1: 'Install Ollama: curl -fsSL https://ollama.ai/install.sh | sh',
                    step2: 'Start server: ollama serve',
                    step3: 'Pull model: ollama pull qwen2.5:3b-instruct-q4_K_M'
                }
            });
        }
        
        // Use requested model or default
        const modelToUse = requestedModel || currentModel.name;
        const selectedModel = availableModels.find(m => m.name === modelToUse) || currentModel;
        
        logger.info(`👤 User: ${input}`);
        logger.info(`🦙 Using model: ${selectedModel.name}`);
        
        const start = Date.now();
        
        // Load the model and generate response
        const model = await ollamaAdapter.load(selectedModel.name);
        const response = await model.generate(input, {
            temperature: options.temperature || 0.7,
            maxTokens: options.maxTokens || 200,
            top_p: options.top_p || 0.9,
            top_k: options.top_k || 40
        });
        
        const processingTime = Date.now() - start;
        
        logger.success(`🤖 ${selectedModel.name} (${processingTime}ms): ${response.text.substring(0, 100)}...`);
        
        res.json({
            response: response.text,
            text: response.text,
            model: selectedModel.name,
            provider: 'ollama',
            processingTime,
            usage: response.usage || {
                totalTokens: response.usage?.total_tokens || 0,
                promptTokens: response.usage?.prompt_tokens || 0,
                completionTokens: response.usage?.completion_tokens || 0
            },
            strategy: 'ollama-local',
            isReal: true, // This is REAL AI, not fake!
            server: 'http://localhost:11434'
        });
        
    } catch (error) {
        logger.error('❌ Chat error:', error.message);
        res.status(500).json({
            error: 'Ollama inference failed',
            details: error.message,
            isReal: false,
            troubleshooting: {
                checkServer: 'curl http://localhost:11434/api/version',
                listModels: 'ollama list',
                pullModel: 'ollama pull qwen2.5:3b-instruct-q4_K_M'
            }
        });
    }
});

/**
 * Streaming chat endpoint
 */
app.post('/api/chat/stream', async (req, res) => {
    try {
        const { message, prompt, model: requestedModel, ...options } = req.body;
        const input = message || prompt;
        
        if (!input) {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        if (!ollamaAdapter || !currentModel) {
            return res.status(503).json({ error: 'Ollama not initialized' });
        }
        
        const modelToUse = requestedModel || currentModel.name;
        const selectedModel = availableModels.find(m => m.name === modelToUse) || currentModel;
        
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });
        
        logger.info(`🌊 Streaming with ${selectedModel.name}: ${input}`);
        
        try {
            const model = await ollamaAdapter.load(selectedModel.name);
            
            for await (const token of model.stream(input, options)) {
                if (token.text) {
                    res.write(`data: ${JSON.stringify({
                        text: token.text,
                        done: token.done,
                        model: selectedModel.name
                    })}\n\n`);
                }
                
                if (token.done) {
                    break;
                }
            }
            
            res.write('data: [DONE]\n\n');
        } catch (streamError) {
            res.write(`data: ${JSON.stringify({
                error: streamError.message,
                done: true
            })}\n\n`);
        }
        
        res.end();
        
    } catch (error) {
        logger.error('❌ Streaming error:', error.message);
        res.status(500).json({
            error: 'Streaming failed',
            details: error.message
        });
    }
});

/**
 * Serve chat interface
 */
app.get('/chat', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>🦙 Ollama Chat - REAL AI</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
            max-width: 900px; 
            margin: 0 auto; 
            padding: 20px; 
            background: #f5f5f7;
        }
        .header { 
            text-align: center; 
            margin-bottom: 30px; 
            padding: 20px; 
            background: white; 
            border-radius: 12px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .chat-container { 
            border: 1px solid #d1d5db; 
            border-radius: 12px; 
            height: 500px; 
            overflow-y: auto; 
            padding: 20px; 
            margin-bottom: 20px; 
            background: white; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .input-container { 
            display: flex; 
            gap: 12px; 
            background: white; 
            padding: 20px; 
            border-radius: 12px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        input[type="text"] { 
            flex: 1; 
            padding: 12px 16px; 
            border: 2px solid #e5e7eb; 
            border-radius: 8px; 
            font-size: 16px; 
            outline: none; 
        }
        input[type="text"]:focus { border-color: #3b82f6; }
        button { 
            padding: 12px 24px; 
            background: #3b82f6; 
            color: white; 
            border: none; 
            border-radius: 8px; 
            cursor: pointer; 
            font-weight: 500; 
            font-size: 16px; 
        }
        button:hover { background: #2563eb; }
        button:disabled { background: #9ca3af; cursor: not-allowed; }
        .message { 
            margin: 15px 0; 
            padding: 12px; 
            border-radius: 8px; 
        }
        .user { 
            background: #eff6ff; 
            border-left: 4px solid #3b82f6; 
            color: #1e40af; 
        }
        .assistant { 
            background: #f0fdf4; 
            border-left: 4px solid #10b981; 
            color: #065f46; 
        }
        .status { 
            padding: 16px; 
            margin-bottom: 20px; 
            border-radius: 8px; 
            text-align: center; 
            font-weight: 500; 
        }
        .status.ready { background: #dcfce7; color: #166534; }
        .status.loading { background: #fef3c7; color: #92400e; }
        .status.error { background: #fee2e2; color: #991b1b; }
        .model-info { 
            font-size: 14px; 
            color: #6b7280; 
            text-align: center; 
            margin-top: 10px; 
        }
        .performance { 
            font-size: 12px; 
            color: #9ca3af; 
            margin-left: 8px; 
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🦙 Ollama Chat - REAL AI</h1>
        <p>Powered by local Ollama models - No fake responses!</p>
        <div class="model-info" id="modelInfo">Loading...</div>
    </div>
    
    <div id="status" class="status loading">Checking Ollama server status...</div>
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
        const modelInfo = document.getElementById('modelInfo');
        
        let isReady = false;
        let currentModel = null;

        // Check Ollama status and models
        async function checkStatus() {
            try {
                const healthResponse = await fetch('/api/health');
                const healthData = await healthResponse.json();
                
                const modelsResponse = await fetch('/api/models');
                const modelsData = await modelsResponse.json();
                
                if (healthData.status === 'ready' && modelsData.models.length > 0) {
                    status.innerHTML = '✅ Ollama server ready - Real AI chat active!';
                    status.className = 'status ready';
                    currentModel = modelsData.currentModel;
                    
                    modelInfo.innerHTML = \`Using: \${currentModel} | Available: \${modelsData.models.length} models\`;
                    
                    messageInput.disabled = false;
                    sendButton.disabled = false;
                    isReady = true;
                    
                    addMessage('🦙 Ollama AI is ready! Ask me anything.', 'assistant');
                } else {
                    status.innerHTML = '❌ Ollama setup required. Check console for instructions.';
                    status.className = 'status error';
                    
                    modelInfo.innerHTML = 'Setup: ollama serve && ollama pull qwen2.5:3b-instruct-q4_K_M';
                }
            } catch (error) {
                status.innerHTML = '❌ Cannot connect to Ollama server';
                status.className = 'status error';
                modelInfo.innerHTML = 'Run: ollama serve (in another terminal)';
            }
        }
        
        // Send message to Ollama
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
                        maxTokens: 200 
                    })
                });
                
                const data = await response.json();
                const responseTime = Date.now() - startTime;
                
                if (response.ok && data.isReal) {
                    addMessage(\`🦙 \${data.model}: \${data.response}\`, 'assistant', \`\${responseTime}ms | Real AI ✅\`);
                } else {
                    addMessage(\`❌ Error: \${data.error || 'Unknown error'}\`, 'assistant', 'Failed');
                }
            } catch (error) {
                addMessage(\`❌ Network error: \${error.message}\`, 'assistant', 'Error');
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

// Start server and initialize Ollama
app.listen(PORT, async () => {
    logger.success(`🌐 Server listening on port ${PORT}`);
    console.log(`💬 Chat interface: http://localhost:${PORT}/chat`);
    console.log(`🔗 API endpoint: http://localhost:${PORT}/api/chat`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    
    // Initialize Ollama in background
    const success = await initializeOllama();
    
    if (success) {
        console.log(`\n✅ Ollama-powered chat server is ready!`);
        console.log(`🦙 Using model: ${currentModel.name}`);
        console.log(`🚀 Visit http://localhost:${PORT}/chat to start chatting!\n`);
    } else {
        console.log(`\n⚠️  Server started but Ollama needs setup.`);
        console.log(`📋 Visit http://localhost:${PORT}/chat for setup instructions.\n`);
    }
});