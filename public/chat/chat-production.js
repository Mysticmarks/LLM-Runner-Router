/**
 * LLM Runner Router - Production Chat Interface
 * Connects to the API server for real AI inference
 */

class LLMRouterChat {
    constructor() {
        this.messages = [];
        this.stats = {
            messageCount: 0,
            totalTokens: 0,
            responseTimes: []
        };
        this.isProcessing = false;
        this.currentStrategy = 'balanced';
        
        // Auto-detect API URL based on current location
        this.apiUrl = this.getApiUrl();
        
        this.initializeUI();
        this.bindEvents();
        this.checkServerStatus();
    }

    getApiUrl() {
        // If running locally, use localhost
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3000';
        }
        // Otherwise, use the same hostname with port 3000
        return `http://${window.location.hostname}:3000`;
    }

    async checkServerStatus() {
        try {
            this.updateStatus('initializing', 'Connecting to server...');
            
            const response = await fetch(`${this.apiUrl}/api/health`);
            const health = await response.json();
            
            if (health.status === 'healthy') {
                this.updateStatus('online', 'Server Connected');
                this.showNotification(`🚀 Connected to LLM Router at ${this.apiUrl}`, 'success');
                this.updateModelStatus(health.router);
            } else {
                throw new Error('Server not ready');
            }
        } catch (error) {
            console.error('Server connection error:', error);
            this.updateStatus('error', 'Connection Failed');
            this.showNotification(`❌ Cannot connect to server at ${this.apiUrl}. Please check server status.`, 'error');
            
            // Retry connection after 5 seconds
            setTimeout(() => this.checkServerStatus(), 5000);
        }
    }

    initializeUI() {
        this.updateSliderValue('temperatureSlider', 'tempValue');
        this.updateSliderValue('maxTokensSlider', 'tokensValue');
        this.updateStats();
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
        document.getElementById('temperatureSlider').addEventListener('input', () => {
            this.updateSliderValue('temperatureSlider', 'tempValue');
        });

        document.getElementById('maxTokensSlider').addEventListener('input', () => {
            this.updateSliderValue('maxTokensSlider', 'tokensValue');
        });
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (!message || this.isProcessing) return;
        
        this.isProcessing = true;
        this.updateSendButton(false);
        input.value = '';
        document.getElementById('charCount').textContent = '0/1000';
        
        // Add user message
        this.addMessage('user', message);
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            // Send to API
            const response = await this.callAPI(message);
            
            // Hide typing and add response
            this.hideTypingIndicator();
            this.addMessage('assistant', response.text, {
                model: response.model,
                responseTime: response.processingTime,
                tokens: response.tokens,
                strategy: response.strategy
            });
            
            // Update stats
            this.stats.messageCount++;
            this.stats.totalTokens += response.tokens || 0;
            this.stats.responseTimes.push(response.processingTime || 0);
            this.updateStats();
            
        } catch (error) {
            this.hideTypingIndicator();
            this.showNotification('❌ Error generating response. Please try again.', 'error');
            console.error('Message send error:', error);
        } finally {
            this.isProcessing = false;
            this.updateSendButton(true);
        }
    }

    async callAPI(prompt) {
        const temperature = parseFloat(document.getElementById('temperatureSlider').value);
        const maxTokens = parseInt(document.getElementById('maxTokensSlider').value);
        const streaming = document.getElementById('streamingCheckbox').checked;
        
        const requestBody = {
            prompt,
            temperature,
            maxTokens,
            strategy: this.currentStrategy,
            stream: streaming
        };
        
        const response = await fetch(`${this.apiUrl}/api/inference`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Note: In production, you'd want to use an API key here
                // 'x-api-key': 'your-api-key'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'API request failed');
        }
        
        const result = await response.json();
        
        return {
            text: result.response || result.text || 'No response generated',
            model: result.model || 'Unknown',
            processingTime: result.processingTime || 0,
            tokens: result.usage?.totalTokens || Math.floor((result.response || '').length / 4),
            strategy: result.strategy || this.currentStrategy
        };
    }

    addMessage(role, content, metadata = {}) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        let metadataHtml = '';
        if (metadata.model) {
            metadataHtml = `
                <div class="message-metadata">
                    <span class="model-tag">${metadata.model}</span>
                    ${metadata.responseTime ? `<span class="time-tag">${metadata.responseTime}ms</span>` : ''}
                    ${metadata.tokens ? `<span class="token-tag">${metadata.tokens} tokens</span>` : ''}
                    ${metadata.strategy ? `<span class="strategy-tag">${this.getStrategyName(metadata.strategy)}</span>` : ''}
                </div>
            `;
        }
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-role">${role === 'user' ? '👤 You' : '🤖 LLM Router'}</span>
                <span class="message-time">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="message-content">${this.escapeHtml(content)}</div>
            ${metadataHtml}
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        this.messages.push({ role, content, metadata, timestamp: Date.now() });
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chatMessages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant typing-indicator';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="message-header">
                <span class="message-role">🤖 LLM Router</span>
            </div>
            <div class="message-content">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    clearChat() {
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <div class="message-content">
                    <h3>👋 Welcome to LLM Runner Router!</h3>
                    <p>Connected to: <strong>${this.apiUrl}</strong></p>
                    <p>This is a <strong>production deployment</strong> with real AI model inference.</p>
                    <div class="feature-highlights">
                        <div class="highlight-item">🤖 <strong>Real AI Models:</strong> Running actual inference</div>
                        <div class="highlight-item">🎯 <strong>Smart Routing:</strong> Intelligent model selection</div>
                        <div class="highlight-item">📊 <strong>Live Analytics:</strong> Real performance metrics</div>
                    </div>
                    <p><strong>Ask me anything!</strong> The system will route your query to the best available model.</p>
                </div>
            </div>
        `;
        
        this.messages = [];
        this.stats = {
            messageCount: 0,
            totalTokens: 0,
            responseTimes: []
        };
        this.updateStats();
        this.showNotification('💬 Chat cleared', 'info');
    }

    updateStats() {
        document.getElementById('messageCount').textContent = this.stats.messageCount;
        document.getElementById('totalTokens').textContent = this.stats.totalTokens;
        
        if (this.stats.responseTimes.length > 0) {
            const avg = Math.round(
                this.stats.responseTimes.reduce((a, b) => a + b, 0) / 
                this.stats.responseTimes.length
            );
            document.getElementById('avgResponse').textContent = `${avg}ms`;
        }
    }

    async updateModelStatus(routerStatus) {
        const modelList = document.getElementById('modelList');
        
        if (!routerStatus) {
            modelList.innerHTML = `
                <div class="model-item">
                    <div class="model-name">Checking models...</div>
                    <div class="model-status-badge loading">Loading</div>
                </div>
            `;
            return;
        }
        
        try {
            const response = await fetch(`${this.apiUrl}/api/models`);
            const data = await response.json();
            
            if (data.models && data.models.length > 0) {
                modelList.innerHTML = data.models.map(model => `
                    <div class="model-item">
                        <div class="model-name">${model.name || model.id}</div>
                        <div class="model-status-badge ready">Ready</div>
                    </div>
                `).join('');
            } else {
                modelList.innerHTML = `
                    <div class="model-item">
                        <div class="model-name">TinyLlama 1.1B</div>
                        <div class="model-status-badge ready">Active</div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error getting model status:', error);
            modelList.innerHTML = `
                <div class="model-item">
                    <div class="model-name">Default Model</div>
                    <div class="model-status-badge ready">Ready</div>
                </div>
            `;
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
        const notifications = document.getElementById('notifications') || this.createNotificationContainer();
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        notifications.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notifications';
        container.className = 'notifications-container';
        document.body.appendChild(container);
        return container;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.llmRouter = new LLMRouterChat();
    });
} else {
    window.llmRouter = new LLMRouterChat();
}