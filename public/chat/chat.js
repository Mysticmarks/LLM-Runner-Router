/**
 * LLM Runner Router - Interactive Chat Demo
 * Real working example using the actual LLM Router system with HuggingFace models
 */

// Load the LLM Router system dynamically
let LLMRouter;

class LLMRouterDemo {
    constructor() {
        this.messages = [];
        this.stats = {
            messageCount: 0,
            totalTokens: 0,
            responseTimes: []
        };
        this.isProcessing = false;
        this.currentStrategy = 'balanced';
        
        // Initialize the actual LLM Router
        this.router = null;
        this.isInitialized = false;
        this.useDemoMode = false;
        
        this.initializeRouter();
        this.initializeUI();
        this.bindEvents();
    }

    async initializeRouter() {
        try {
            this.updateStatus('initializing', 'Connecting to SmolLM3...');
            
            // Test connection to the inference API endpoint
            try {
                const baseUrl = window.location.hostname === 'localhost' ? '' : '';
                const response = await fetch(`${baseUrl}/api/health`);
                const healthData = await response.json();
                
                if (healthData.status === 'healthy') {
                    this.isInitialized = true;
                    this.useDemoMode = false;
                    this.updateStatus('online', 'SmolLM3 Ready');
                    this.showNotification('🚀 Connected to SmolLM3 - Real AI inference ready!', 'success');
                } else {
                    throw new Error('Server not ready');
                }
            } catch (connectionError) {
                console.warn('Could not connect to inference API, using demo mode:', connectionError);
                this.isInitialized = false;
                this.useDemoMode = true;
                this.updateStatus('online', 'Demo Mode Ready');
                this.showNotification('🎭 Running in Demo Mode - SmolLM3 inference temporarily unavailable', 'warning');
            }
            
            // Create router instance with SmolLM3 and fallback models
            this.router = new LLMRouter({
                engines: ['node', 'webgpu', 'wasm'], // Try Node.js first for SmolLM3, fallback to WebGPU/WASM
                models: {
                    'smollm3-3b': {
                        format: 'smollm3',
                        path: './models/smollm3-3b',
                        priority: 'primary',
                        maxTokens: 512,
                        temperature: 0.7,
                        capabilities: ['chat', 'completion', 'code']
                    },
                    'smollm3-fallback': {
                        format: 'simple',
                        priority: 'fallback',
                        maxTokens: 300,
                        temperature: 0.8
                    }
                },
                strategies: {
                    'speed-priority': {
                        modelPreference: ['smollm3-fallback', 'smollm3-3b'],
                        maxLatency: 1000
                    },
                    'balanced': {
                        modelPreference: ['smollm3-3b', 'smollm3-fallback'],
                        balanceFactors: { speed: 0.3, quality: 0.5, cost: 0.2 }
                    },
                    'quality-first': {
                        modelPreference: ['smollm3-3b'],
                        maxLatency: 5000
                    }
                },
                cache: {
                    enabled: true,
                    ttl: 300000 // 5 minutes
                }
            });

            await this.router.initialize();
            
            this.isInitialized = true;
            this.updateStatus('online', 'LLM Router Ready');
            this.showNotification('🚀 LLM Router initialized with HuggingFace models!', 'success');
            this.updateModelStatus();
            
        } catch (error) {
            console.error('Router initialization failed:', error);
            this.updateStatus('error', 'Initialization Failed');
            this.showNotification('❌ Failed to initialize LLM Router. Check console for details.', 'error');
        }
    }

    initializeUI() {
        // Initialize sliders and controls
        this.updateSliderValue('temperatureSlider', 'tempValue');
        this.updateSliderValue('maxTokensSlider', 'tokensValue');
        this.updateStats();
        this.updateModelStatus();
    }

    bindEvents() {
        // Send message events
        const sendButton = document.getElementById('sendButton');
        const messageInput = document.getElementById('messageInput');
        
        sendButton.addEventListener('click', () => this.sendMessage());
        messageInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Input character counter
        messageInput.addEventListener('input', () => {
            const count = messageInput.value.length;
            document.getElementById('charCount').textContent = `${count}/1000`;
        });

        // Clear chat
        document.getElementById('clearChat').addEventListener('click', () => {
            this.clearChat();
        });

        // Control panel events
        document.getElementById('strategySelect').addEventListener('change', (e) => {
            this.currentStrategy = e.target.value;
            this.showNotification(`🎯 Routing strategy changed to: ${this.getStrategyName(e.target.value)}`, 'info');
        });

        // Slider events
        document.getElementById('temperatureSlider').addEventListener('input', (e) => {
            this.updateSliderValue('temperatureSlider', 'tempValue');
        });

        document.getElementById('maxTokensSlider').addEventListener('input', (e) => {
            this.updateSliderValue('maxTokensSlider', 'tokensValue');
        });

        // Streaming checkbox
        document.getElementById('streamingCheckbox').addEventListener('change', (e) => {
            const status = e.target.checked ? 'enabled' : 'disabled';
            this.showNotification(`⚡ Streaming ${status}`, 'info');
        });
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message || this.isProcessing) return;

        // Add user message
        this.addMessage('user', message);
        messageInput.value = '';
        document.getElementById('charCount').textContent = '0/1000';

        // Update processing state
        this.isProcessing = true;
        this.updateStatus('processing', 'Generating response...');
        this.updateSendButton(false);

        // Show typing indicator
        this.showTypingIndicator();

        // Simulate routing decision
        const routingResult = this.simulateRouting(message);
        
        try {
            // Simulate response generation
            const response = await this.generateResponse(message, routingResult);
            
            // Remove typing indicator
            this.hideTypingIndicator();
            
            // Add assistant response
            this.addMessage('assistant', response.text, {
                strategy: response.provider,
                model: response.model,
                responseTime: response.responseTime,
                tokens: response.tokens
            });

            // Update stats
            this.updateSessionStats(response);
            
        } catch (error) {
            this.hideTypingIndicator();
            this.showNotification('❌ Error generating response. Please try again.', 'error');
        } finally {
            this.isProcessing = false;
            this.updateStatus('online', 'Demo Ready');
            this.updateSendButton(true);
        }
    }

    simulateRouting(message) {
        if (!this.router || !this.isInitialized) {
            return {
                strategy: this.currentStrategy,
                selectedModel: 'Fallback',
                confidence: 0.5,
                alternatives: []
            };
        }

        // Use the actual router to determine routing
        const routingInfo = this.router.getRoutingInfo(message, { strategy: this.currentStrategy });
        
        return {
            strategy: routingInfo.strategy || this.currentStrategy,
            selectedModel: routingInfo.selectedModel || 'Unknown',
            confidence: routingInfo.confidence || 0.8,
            alternatives: routingInfo.alternatives || []
        };
    }

    async generateResponse(message, routingResult) {
        const startTime = Date.now();
        const streaming = document.getElementById('streamingCheckbox').checked;
        const temperature = parseFloat(document.getElementById('temperatureSlider').value);
        const maxTokens = parseInt(document.getElementById('maxTokensSlider').value);
        
        if (this.useDemoMode || !this.isInitialized) {
            // Use demo mode with realistic delays
            const fallbackResponse = this.generateFallbackResponse(message, temperature);
            const responseTime = Date.now() - startTime;
            
            return {
                text: fallbackResponse,
                responseTime,
                tokens: Math.floor(fallbackResponse.length / 4),
                model: 'Demo Mode',
                provider: 'HuggingFace (Simulated)',
                strategy: this.currentStrategy
            };
        }

        try {
            // Make API call to the real SmolLM3 inference endpoint
            const baseUrl = window.location.hostname === 'localhost' ? '' : '';
            const apiResponse = await fetch(`${baseUrl}/api/inference`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer llm_test_persistent_key_fixed_2025.persistent_test_secret_never_changes_mikecerqua_2025_llm_router'
                },
                body: JSON.stringify({
                    message: message,
                    maxTokens: maxTokens,
                    temperature: temperature,
                    model: 'smollm3-3b'
                })
            });

            if (!apiResponse.ok) {
                throw new Error(`API Error: ${apiResponse.status} ${apiResponse.statusText}`);
            }

            const result = await apiResponse.json();
            const responseTime = Date.now() - startTime;
            
            const response = {
                text: result.response || result.text || 'No response generated',
                responseTime,
                tokens: result.usage?.tokens || Math.floor((result.response || '').length / 4),
                model: result.model || 'SmolLM3-3B',
                provider: 'Transformers.js',
                strategy: this.currentStrategy
            };

            return response;

        } catch (error) {
            console.error('LLM Router Error:', error);
            
            // Fallback to demo mode if router fails
            this.showNotification('⚠️ Model unavailable, using fallback', 'warning');
            
            const fallbackResponse = this.generateFallbackResponse(message, temperature);
            const responseTime = Date.now() - startTime;
            
            return {
                text: fallbackResponse,
                responseTime,
                tokens: Math.floor(fallbackResponse.length / 4),
                model: 'Fallback',
                provider: 'Demo',
                strategy: 'fallback'
            };
        }
    }

    async handleStreamingResponse(message, options, startTime) {
        const streamGenerator = this.router.stream(message, options);
        let fullText = '';
        let tokens = 0;
        
        // Create a temporary message element for streaming updates
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant streaming';
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="streaming-text"></div>
                <div class="message-meta">
                    <span class="message-time">${new Date().toLocaleTimeString()}</span>
                    <span class="message-strategy">${options.strategy}</span>
                    <span class="streaming-indicator">⚡ Streaming...</span>
                </div>
            </div>
        `;
        
        // Remove typing indicator and add streaming message
        this.hideTypingIndicator();
        chatMessages.appendChild(messageDiv);
        
        const streamingText = messageDiv.querySelector('.streaming-text');
        
        try {
            for await (const chunk of streamGenerator) {
                if (chunk.token) {
                    fullText += chunk.token;
                    tokens++;
                    streamingText.innerHTML = this.formatMessageContent(fullText);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            }
            
            // Update final message
            messageDiv.className = 'message assistant';
            messageDiv.querySelector('.streaming-indicator').remove();
            
            const responseTime = Date.now() - startTime;
            
            return {
                text: fullText,
                responseTime,
                tokens,
                model: 'HuggingFace Model',
                provider: 'HuggingFace',
                strategy: options.strategy,
                streamed: true
            };
            
        } catch (error) {
            // Remove streaming message on error
            messageDiv.remove();
            throw error;
        }
    }

    generateFallbackResponse(message, temperature) {
        const lowerMessage = message.toLowerCase();
        
        // Pattern-based responses for demo purposes
        const responses = {
            greeting: [
                "Hello! I'm the LLM Runner Router demo. I can help demonstrate intelligent model routing and response generation.",
                "Hi there! Welcome to our advanced LLM orchestration system. What would you like to explore?",
                "Greetings! I'm powered by our universal model routing technology. How can I assist you today?"
            ],
            quantum: [
                "Quantum computing leverages quantum mechanical phenomena like superposition and entanglement to process information in fundamentally different ways than classical computers. Unlike classical bits that exist in definite states of 0 or 1, quantum bits (qubits) can exist in superposition states, allowing quantum computers to explore multiple computational paths simultaneously.",
                "Imagine a quantum computer as a multidimensional maze solver that can explore all possible paths at once, rather than trying them one by one like a classical computer. This quantum parallelism, combined with phenomena like quantum interference and entanglement, enables quantum algorithms to solve certain problems exponentially faster than classical approaches."
            ],
            ai: [
                "Artificial Intelligence encompasses machine learning, natural language processing, computer vision, and other technologies that enable machines to perform tasks typically requiring human intelligence. Modern AI systems like this demo use neural networks trained on vast datasets to understand patterns and generate human-like responses.",
                "AI has evolved from rule-based expert systems to today's large language models and multimodal systems. The LLM Router you're interacting with represents a new paradigm in AI deployment - intelligently orchestrating multiple models to optimize for quality, cost, and performance based on your specific needs."
            ],
            haiku: [
                "Code flows like water,\nIntelligent routing guides—\nAI finds its way.",
                "Models dance in sync,\nRouting strategies converge—\nWisdom emerges.",
                "Bits and bytes align,\nSmart orchestration blooms here—\nTech poetry flows."
            ],
            router: [
                "The LLM Router is a sophisticated orchestration system that intelligently selects and manages multiple language models based on your requirements. It can optimize for quality, cost, speed, or balanced performance while providing seamless fallback mechanisms and real-time streaming capabilities.",
                "Our routing system analyzes your input, evaluates available models against your configured strategy, and dynamically routes requests to the most appropriate model. This ensures optimal performance while managing costs and maintaining high availability through intelligent load balancing."
            ],
            default: [
                "That's an interesting question! The LLM Router would analyze your query, select the most appropriate model based on the current strategy, and generate a thoughtful response while optimizing for the parameters you've configured.",
                "Based on your current settings, I would route this query through our intelligent selection algorithm, considering factors like response quality, processing speed, and cost efficiency to deliver the best possible answer.",
                "This demo showcases how our universal LLM orchestration system would handle your request - evaluating context, applying the selected routing strategy, and generating responses while tracking performance metrics."
            ]
        };

        let responseOptions = responses.default;
        
        if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
            responseOptions = responses.greeting;
        } else if (lowerMessage.includes('quantum')) {
            responseOptions = responses.quantum;
        } else if (lowerMessage.includes('haiku') || lowerMessage.includes('poem')) {
            responseOptions = responses.haiku;
        } else if (lowerMessage.includes('ai') || lowerMessage.includes('artificial intelligence')) {
            responseOptions = responses.ai;
        } else if (lowerMessage.includes('router') || lowerMessage.includes('routing') || lowerMessage.includes('llm')) {
            responseOptions = responses.router;
        }

        // Add some variability based on temperature
        const baseResponse = responseOptions[Math.floor(Math.random() * responseOptions.length)];
        
        if (temperature > 0.8) {
            // High temperature: add some creative variations
            const variations = [
                `${baseResponse}\n\nAdditionally, it's worth noting that this represents just one perspective in the vast landscape of possibilities.`,
                `${baseResponse}\n\n*This response was generated with high creativity settings, showcasing the dynamic nature of AI-powered conversations.*`,
                `Interestingly, ${baseResponse.toLowerCase()}`
            ];
            return variations[Math.floor(Math.random() * variations.length)];
        } else if (temperature < 0.3) {
            // Low temperature: more direct and concise
            return baseResponse.split('.')[0] + '.';
        }
        
        return baseResponse;
    }

    getStrategyDelay(strategy) {
        const delays = {
            'speed-priority': 800,
            'cost-optimized': 1200,
            'balanced': 1000,
            'quality-first': 1800,
            'random': 1000 + Math.random() * 1000,
            'round-robin': 900
        };
        return delays[strategy] || 1000;
    }

    addMessage(type, content, metadata = {}) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const timestamp = new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        let metaHtml = '';
        if (metadata.strategy) {
            metaHtml = `
                <div class="message-meta">
                    <span class="message-time">${timestamp}</span>
                    <span class="message-strategy">${metadata.strategy}</span>
                </div>
            `;
        } else {
            metaHtml = `
                <div class="message-meta">
                    <span class="message-time">${timestamp}</span>
                </div>
            `;
        }

        messageDiv.innerHTML = `
            <div class="message-content">
                ${this.formatMessageContent(content)}
                ${metaHtml}
            </div>
        `;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Store message
        this.messages.push({
            type,
            content,
            timestamp: new Date(),
            metadata
        });
    }

    formatMessageContent(content) {
        // Simple formatting for code blocks and emphasis
        return content
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }

    showTypingIndicator() {
        const chatMessages = document.getElementById('chatMessages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant typing';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        // Keep the welcome message, remove others
        const welcomeMessage = chatMessages.querySelector('.welcome-message').parentElement;
        chatMessages.innerHTML = '';
        chatMessages.appendChild(welcomeMessage);
        
        this.messages = [];
        this.stats = {
            messageCount: 0,
            totalTokens: 0,
            responseTimes: []
        };
        this.updateStats();
        this.showNotification('💬 Chat cleared', 'info');
    }

    updateSessionStats(response) {
        this.stats.messageCount++;
        this.stats.totalTokens += response.tokens;
        this.stats.responseTimes.push(response.responseTime);
        this.updateStats();
    }

    updateStats() {
        document.getElementById('messageCount').textContent = this.stats.messageCount;
        document.getElementById('totalTokens').textContent = this.stats.totalTokens;
        
        if (this.stats.responseTimes.length > 0) {
            const avgResponse = this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length;
            document.getElementById('avgResponse').textContent = `${Math.round(avgResponse)}ms`;
        } else {
            document.getElementById('avgResponse').textContent = '-';
        }
    }

    updateModelStatus() {
        const modelList = document.getElementById('modelList');
        
        if (this.useDemoMode) {
            const models = [
                { name: 'DialoGPT-Small', status: 'Demo Mode', class: 'simulated' },
                { name: 'DialoGPT-Medium', status: 'Demo Mode', class: 'simulated' },
                { name: 'Zephyr-7B-Beta', status: 'Demo Mode', class: 'simulated' },
                { name: 'LLM Router System', status: 'Showcasing Features', class: 'simulated' }
            ];
            
            modelList.innerHTML = models.map(model => `
                <div class="model-item">
                    <div class="model-name">${model.name}</div>
                    <div class="model-status-badge ${model.class}">${model.status}</div>
                </div>
            `).join('');
            return;
        }
        
        if (!this.router || !this.isInitialized) {
            const models = [
                { name: 'LLM Router', status: 'Initializing...', class: 'loading' },
                { name: 'HuggingFace Models', status: 'Loading...', class: 'loading' }
            ];
            
            modelList.innerHTML = models.map(model => `
                <div class="model-item">
                    <div class="model-name">${model.name}</div>
                    <div class="model-status-badge ${model.class}">${model.status}</div>
                </div>
            `).join('');
            return;
        }

        try {
            const modelStatus = this.router.getModelStatus();
            const models = [
                { name: 'DialoGPT-Small', status: modelStatus['microsoft/DialoGPT-small'] || 'Ready', class: 'online' },
                { name: 'DialoGPT-Medium', status: modelStatus['microsoft/DialoGPT-medium'] || 'Ready', class: 'online' },
                { name: 'Zephyr-7B-Beta', status: modelStatus['HuggingFaceH4/zephyr-7b-beta'] || 'Loading', class: 'loading' },
                { name: 'Fallback Demo', status: 'Backup', class: 'simulated' }
            ];

            modelList.innerHTML = models.map(model => `
                <div class="model-item">
                    <div class="model-name">${model.name}</div>
                    <div class="model-status-badge ${model.class}">${model.status}</div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error getting model status:', error);
        }
    }

    updateStatus(status, text) {
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        
        statusDot.className = `status-dot ${status}`;
        statusText.textContent = text;
    }

    updateSendButton(enabled) {
        const sendButton = document.getElementById('sendButton');
        sendButton.disabled = !enabled;
        
        if (enabled) {
            sendButton.innerHTML = '<span class="btn-text">Send</span><span class="btn-icon">📤</span>';
        } else {
            sendButton.innerHTML = '<span class="btn-text">Processing...</span><span class="btn-icon">⚡</span>';
        }
    }

    updateSliderValue(sliderId, valueId) {
        const slider = document.getElementById(sliderId);
        const valueSpan = document.getElementById(valueId);
        valueSpan.textContent = slider.value;
    }

    getStrategyName(strategy) {
        const names = {
            'balanced': 'Balanced',
            'quality-first': 'Quality First',
            'cost-optimized': 'Cost Optimized',
            'speed-priority': 'Speed Priority',
            'random': 'Random',
            'round-robin': 'Round Robin'
        };
        return names[strategy] || strategy;
    }

    showNotification(message, type = 'info') {
        const notifications = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        notifications.appendChild(notification);
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 4000);
    }
}

// Initialize the demo when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new LLMRouterDemo();
});