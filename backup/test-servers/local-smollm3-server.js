#!/usr/bin/env node
/**
 * 🏠 LOCAL SmolLM3-3B Server - 100% LOCAL INFERENCE
 * 
 * Serves the local SmolLM3-3B model from safetensors files
 * NO external dependencies, NO CDN, completely self-contained
 * 
 * Model files must be in: ./models/smollm3-3b/
 * - config.json
 * - tokenizer.json & tokenizer_config.json  
 * - model-00001-of-00002.safetensors
 * - model-00002-of-00002.safetensors
 * - model.safetensors.index.json
 */

import express from 'express';
import cors from 'cors';
import LocalSmolLM3Loader from './src/loaders/LocalSmolLM3Loader.js';
import { Logger } from './src/utils/Logger.js';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3005;
const logger = new Logger('LocalSmolLM3Server');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Global model state
let loader = null;
let model = null;
let isLoading = false;
let loadError = null;
let modelInfo = null;

console.log('🏠 Starting LOCAL SmolLM3-3B Server...\n');
console.log('📁 Expected model path: ./models/smollm3-3b/');
console.log('🚫 NO external dependencies - 100% local inference\n');

/**
 * Initialize the local SmolLM3-3B model
 */
async function initializeLocalModel() {
    if (isLoading || model) return model;
    
    isLoading = true;
    loadError = null;
    
    try {
        logger.info('🔧 Initializing LocalSmolLM3Loader...');
        loader = new LocalSmolLM3Loader();
        
        // Get model info first
        logger.info('📊 Getting local model information...');
        modelInfo = await loader.getModelInfo();
        logger.success(`✅ Found local model: ${modelInfo.name}`);
        logger.info(`   Path: ${modelInfo.path}`);
        logger.info(`   Parameters: ${modelInfo.parameters}`);
        logger.info(`   Architecture: ${modelInfo.architecture}`);
        logger.info(`   Vocab Size: ${modelInfo.vocab_size.toLocaleString()}`);
        
        // Load the model
        logger.info('🧠 Loading SmolLM3-3B from local safetensors files...');
        logger.warn('⚠️  This will take 1-3 minutes for first load...');
        
        model = await loader.load({
            id: 'local-smollm3-3b',
            name: 'SmolLM3-3B Local',
            source: 'local-smollm3'
        });
        
        isLoading = false;
        
        console.log('\n🎉 LOCAL SmolLM3-3B READY!');
        console.log(`🌐 Server: http://localhost:${PORT}`);
        console.log(`💬 Chat: http://localhost:${PORT}/chat`);
        console.log(`🔗 API: http://localhost:${PORT}/api/chat`);
        console.log(`📊 Status: http://localhost:${PORT}/api/health`);
        console.log(`🏠 Model: 100% LOCAL - No external dependencies!\n`);
        
        return model;
        
    } catch (error) {
        logger.error('❌ Failed to initialize local model:', error.message);
        loadError = error;
        isLoading = false;
        
        if (error.message.includes('Model directory not found')) {
            console.log('\n📥 Model files not found. Download SmolLM3-3B:');
            console.log('1. Install: pip install huggingface_hub');
            console.log('2. Download: huggingface-cli download HuggingFaceTB/SmolLM3-3B-Base --local-dir ./models/smollm3-3b');
            console.log('3. Restart: node local-smollm3-server.js');
        }
        
        throw error;
    }
}

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: model ? 'ready' : (isLoading ? 'loading' : 'error'),
        model: model ? 'SmolLM3-3B Local' : null,
        isLocal: true,
        path: modelInfo ? modelInfo.path : './models/smollm3-3b',
        info: modelInfo || null,
        error: loadError ? loadError.message : null,
        dependencies: 'None - 100% local inference'
    });
});

/**
 * Model information endpoint
 */
app.get('/api/model-info', (req, res) => {
    if (!modelInfo) {
        return res.status(503).json({
            error: 'Model not loaded',
            message: 'Local SmolLM3 model is not yet initialized'
        });
    }
    
    res.json({
        ...modelInfo,
        status: model ? 'ready' : 'loading',
        totalSize: getTotalModelSize(),
        loadTime: isLoading ? 'Loading...' : 'Ready'
    });
});

/**
 * LOCAL chat endpoint - 100% local inference
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
                    message: 'Local SmolLM3 model is initializing. This takes 1-3 minutes on first load.',
                    status: 'loading'
                });
            }
            
            try {
                await initializeLocalModel();
            } catch (error) {
                return res.status(500).json({
                    error: 'Model initialization failed',
                    details: error.message,
                    solution: 'Ensure model files exist in ./models/smollm3-3b/'
                });
            }
        }
        
        logger.info(`👤 User: ${input.substring(0, 100)}${input.length > 100 ? '...' : ''}`);
        
        const startTime = Date.now();
        
        // Generate response using LOCAL model
        const response = await model.predict(input, {
            maxTokens: options.maxTokens || 150,
            temperature: options.temperature || 0.7,
            topP: options.topP || 0.9,
            topK: options.topK || 50,
            useSystemPrompt: options.useSystemPrompt !== false
        });
        
        const totalTime = Date.now() - startTime;
        const text = response.text || response.response;
        
        logger.success(`🤖 LOCAL SmolLM3 (${totalTime}ms): ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
        
        res.json({
            response: text,
            text: text,
            model: 'SmolLM3-3B Local',
            provider: 'local-safetensors',
            processingTime: totalTime,
            inferenceTime: response.inference_time_ms,
            tokens: response.tokens,
            isLocal: true,
            isReal: true,
            dependencies: 'None',
            source: 'local-safetensors-files'
        });
        
    } catch (error) {
        logger.error('❌ Local inference error:', error.message);
        res.status(500).json({
            error: 'Local inference failed',
            details: error.message,
            isLocal: true,
            troubleshooting: {
                checkFiles: 'Ensure all model files exist in ./models/smollm3-3b/',
                checkMemory: 'Model requires ~6GB RAM',
                checkDisk: 'Model files should be ~6GB total'
            }
        });
    }
});

/**
 * Chat conversation endpoint
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
                return res.status(503).json({ error: 'Model is loading, please wait...' });
            }
            await initializeLocalModel();
        }
        
        const startTime = Date.now();
        
        // Generate chat response using LOCAL model
        const response = await model.chat(messages, {
            maxTokens: options.maxTokens || 200,
            temperature: options.temperature || 0.7,
            topP: options.topP || 0.9
        });
        
        const totalTime = Date.now() - startTime;
        const text = response.text || response.response;
        
        logger.success(`💬 LOCAL Chat (${totalTime}ms): ${text.substring(0, 80)}...`);
        
        res.json({
            message: {
                role: 'assistant',
                content: text
            },
            response: text,
            model: 'SmolLM3-3B Local',
            processingTime: totalTime,
            isLocal: true,
            conversationLength: messages.length
        });
        
    } catch (error) {
        logger.error('❌ Chat conversation error:', error.message);
        res.status(500).json({
            error: 'Chat conversation failed',
            details: error.message
        });
    }
});

/**
 * Serve local chat interface
 */
app.get('/chat', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>🏠 Local SmolLM3-3B - 100% LOCAL AI</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
            max-width: 1000px; 
            margin: 0 auto; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .header { 
            text-align: center; 
            margin-bottom: 30px; 
            padding: 25px; 
            background: rgba(255,255,255,0.95); 
            border-radius: 15px; 
            box-shadow: 0 8px 32px rgba(0,0,0,0.1); 
            backdrop-filter: blur(10px);
        }
        .local-badge {
            display: inline-block;
            background: linear-gradient(45deg, #00c851, #007e33);
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-left: 10px;
        }
        .chat-container { 
            border: none; 
            border-radius: 15px; 
            height: 500px; 
            overflow-y: auto; 
            padding: 25px; 
            margin-bottom: 20px; 
            background: rgba(255,255,255,0.95); 
            box-shadow: 0 8px 32px rgba(0,0,0,0.1); 
            backdrop-filter: blur(10px);
        }
        .input-container { 
            display: flex; 
            gap: 15px; 
            background: rgba(255,255,255,0.95); 
            padding: 25px; 
            border-radius: 15px; 
            box-shadow: 0 8px 32px rgba(0,0,0,0.1); 
            backdrop-filter: blur(10px);
        }
        input[type="text"] { 
            flex: 1; 
            padding: 15px 20px; 
            border: 2px solid #e1e5e9; 
            border-radius: 10px; 
            font-size: 16px; 
            outline: none; 
            transition: all 0.3s ease;
        }
        input[type="text"]:focus { 
            border-color: #667eea; 
            box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }
        button { 
            padding: 15px 30px; 
            background: linear-gradient(45deg, #667eea, #764ba2); 
            color: white; 
            border: none; 
            border-radius: 10px; 
            cursor: pointer; 
            font-weight: 600; 
            font-size: 16px; 
            transition: all 0.3s ease;
        }
        button:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 8px 25px rgba(102,126,234,0.3);
        }
        button:disabled { 
            background: #9ca3af; 
            cursor: not-allowed; 
            transform: none; 
            box-shadow: none;
        }
        .message { 
            margin: 20px 0; 
            padding: 15px 20px; 
            border-radius: 12px; 
            animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .user { 
            background: linear-gradient(45deg, #667eea, #764ba2); 
            color: white; 
            margin-left: 50px;
        }
        .assistant { 
            background: #f8f9fa; 
            border-left: 4px solid #28a745; 
            margin-right: 50px;
        }
        .status { 
            padding: 20px; 
            margin-bottom: 20px; 
            border-radius: 12px; 
            text-align: center; 
            font-weight: 600; 
        }
        .status.ready { 
            background: linear-gradient(45deg, #28a745, #20c997); 
            color: white; 
        }
        .status.loading { 
            background: linear-gradient(45deg, #ffc107, #fd7e14); 
            color: white; 
        }
        .status.error { 
            background: linear-gradient(45deg, #dc3545, #e83e8c); 
            color: white; 
        }
        .model-info { 
            font-size: 14px; 
            color: #6c757d; 
            text-align: center; 
            margin-top: 15px; 
        }
        .performance { 
            font-size: 11px; 
            color: #28a745; 
            margin-left: 10px; 
            font-weight: 600;
        }
        .local-indicator {
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(45deg, #28a745, #20c997);
            color: white;
            padding: 10px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(40,167,69,0.3);
        }
    </style>
</head>
<body>
    <div class="local-indicator">🏠 100% LOCAL</div>
    
    <div class="header">
        <h1>🏠 Local SmolLM3-3B<span class="local-badge">NO EXTERNAL DEPS</span></h1>
        <p>Running completely locally from safetensors files - Zero external dependencies!</p>
        <div class="model-info" id="modelInfo">Loading model information...</div>
    </div>
    
    <div id="status" class="status loading">Initializing local SmolLM3 model...</div>
    <div id="chatContainer" class="chat-container"></div>
    <div class="input-container">
        <input type="text" id="messageInput" placeholder="Chat with your local SmolLM3 model..." disabled>
        <button id="sendButton" onclick="sendMessage()" disabled>Send</button>
    </div>

    <script>
        const chatContainer = document.getElementById('chatContainer');
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        const status = document.getElementById('status');
        const modelInfo = document.getElementById('modelInfo');
        
        let isReady = false;

        // Check local model status
        async function checkStatus() {
            try {
                const [healthRes, infoRes] = await Promise.all([
                    fetch('/api/health'),
                    fetch('/api/model-info')
                ]);
                
                const healthData = await healthRes.json();
                
                if (healthData.status === 'ready') {
                    status.innerHTML = '✅ Local SmolLM3-3B ready - 100% local inference active!';
                    status.className = 'status ready';
                    
                    if (infoRes.ok) {
                        const infoData = await infoRes.json();
                        modelInfo.innerHTML = \`
                            Path: \${infoData.path} | 
                            Parameters: \${infoData.parameters} | 
                            Architecture: \${infoData.architecture} | 
                            Vocab: \${infoData.vocab_size?.toLocaleString() || 'N/A'}
                        \`;
                    }
                    
                    messageInput.disabled = false;
                    sendButton.disabled = false;
                    isReady = true;
                    
                    if (chatContainer.children.length === 0) {
                        addMessage('🏠 Local SmolLM3-3B is ready! This model runs completely locally from safetensors files with zero external dependencies.', 'assistant');
                    }
                    
                } else if (healthData.status === 'loading') {
                    status.innerHTML = '⏳ Loading local model... (First load takes 1-3 minutes)';
                    status.className = 'status loading';
                    setTimeout(checkStatus, 3000);
                    
                } else {
                    status.innerHTML = '❌ ' + (healthData.error || 'Model initialization failed');
                    status.className = 'status error';
                    modelInfo.innerHTML = 'Download model files: huggingface-cli download HuggingFaceTB/SmolLM3-3B-Base --local-dir ./models/smollm3-3b';
                }
                
            } catch (error) {
                status.innerHTML = '❌ Cannot connect to local server';
                status.className = 'status error';
                modelInfo.innerHTML = 'Server not responding - check if local-smollm3-server.js is running';
            }
        }
        
        // Send message to local model
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
                        maxTokens: 150
                    })
                });
                
                const data = await response.json();
                const responseTime = Date.now() - startTime;
                
                if (response.ok && data.isLocal) {
                    const perfInfo = \`\${responseTime}ms total | \${data.tokens || 0} tokens | LOCAL ✅\`;
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

/**
 * Get total model size from files
 */
function getTotalModelSize() {
    try {
        const modelPath = path.resolve('./models/smollm3-3b');
        const files = fs.readdirSync(modelPath);
        let totalSize = 0;
        
        for (const file of files) {
            const filePath = path.join(modelPath, file);
            const stats = fs.statSync(filePath);
            totalSize += stats.size;
        }
        
        return {
            bytes: totalSize,
            mb: Math.round(totalSize / 1024 / 1024),
            gb: (totalSize / 1024 / 1024 / 1024).toFixed(2)
        };
    } catch (error) {
        return { error: error.message };
    }
}

// Start server and initialize model
app.listen(PORT, async () => {
    console.log(`🌐 LOCAL SmolLM3 Server listening on port ${PORT}`);
    console.log(`💬 Chat interface: http://localhost:${PORT}/chat`);
    console.log(`🔗 API endpoint: http://localhost:${PORT}/api/chat`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🏠 Model path: ./models/smollm3-3b/`);
    
    // Initialize model in background
    initializeLocalModel().catch(error => {
        console.error('\n❌ Failed to initialize local model:', error.message);
        if (error.message.includes('Model directory not found')) {
            console.log('\n📥 To download the model:');
            console.log('pip install huggingface_hub');
            console.log('huggingface-cli download HuggingFaceTB/SmolLM3-3B-Base --local-dir ./models/smollm3-3b');
        }
    });
});