/**
 * LLM Runner Router - Production Chat Interface
 * ONLY uses API calls - no module imports, no demo mode
 */

class LLMRouterChat {
    constructor() {
        this.messages = [];
        this.conversationHistory = [];
        this.stats = {
            messageCount: 0,
            totalTokens: 0,
            responseTimes: []
        };
        this.isProcessing = false;
        this.currentStrategy = 'balanced';
        // Automatically detect hostname for API URL
        this.apiBaseUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : `http://${window.location.hostname}:3000`;
        this.apiConnected = false;
        
        this.initializeUI();
        this.bindEvents();
        this.checkAPIConnection();
    }

    async checkAPIConnection() {
        try {
            this.updateStatus('connecting', 'Connecting to API...');
            
            const response = await fetch(`${this.apiBaseUrl}/api/health`);
            const health = await response.json();
            
            if (health.status === 'healthy') {
                this.apiConnected = true;
                this.updateStatus('online', `Connected - ${health.modelsLoaded} model(s) loaded`);
                this.showNotification('✅ Connected to LLM Router API', 'success');
                
                // Get model info
                const modelsResp = await fetch(`${this.apiBaseUrl}/api/models`);
                const models = await modelsResp.json();
                console.log('Available models:', models);
                this.updateModelStatus(models);
            } else {
                throw new Error('API not ready');
            }
        } catch (error) {
            console.error('API connection failed:', error);
            this.updateStatus('error', 'API Offline - Start server on port 3000');
            this.showNotification('⚠️ Cannot connect to API. Make sure server.js is running.', 'error');
            
            // Retry in 3 seconds
            setTimeout(() => this.checkAPIConnection(), 3000);
        }
    }

    initializeUI() {
        // Update sliders
        this.updateSliderValue('temperatureSlider', 'tempValue');
        this.updateSliderValue('maxTokensSlider', 'tokensValue');
        this.updateStats();
    }

    bindEvents() {
        // Send button
        const sendButton = document.getElementById('sendButton');
        const messageInput = document.getElementById('messageInput');
        
        sendButton.addEventListener('click', () => this.sendMessage());
        messageInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Character counter
        messageInput.addEventListener('input', () => {
            const count = messageInput.value.length;
            document.getElementById('charCount').textContent = `${count}/1000`;
        });

        // Clear chat
        document.getElementById('clearChat').addEventListener('click', () => {
            this.clearChat();
        });

        // Strategy selector
        document.getElementById('strategySelect').addEventListener('change', (e) => {
            this.currentStrategy = e.target.value;
            this.showNotification(`Strategy changed to: ${e.target.value}`, 'info');
        });

        // Sliders
        document.getElementById('temperatureSlider').addEventListener('input', () => {
            this.updateSliderValue('temperatureSlider', 'tempValue');
        });

        document.getElementById('maxTokensSlider').addEventListener('input', () => {
            this.updateSliderValue('maxTokensSlider', 'tokensValue');
        });

        // Streaming checkbox
        document.getElementById('streamingCheckbox').addEventListener('change', (e) => {
            const status = e.target.checked ? 'enabled' : 'disabled';
            this.showNotification(`Streaming ${status}`, 'info');
        });
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message || this.isProcessing) return;
        
        if (!this.apiConnected) {
            this.showNotification('⚠️ API not connected. Please wait...', 'warning');
            return;
        }

        // Add user message
        this.addMessage('user', message);
        messageInput.value = '';
        document.getElementById('charCount').textContent = '0/1000';

        // Update state
        this.isProcessing = true;
        this.updateStatus('processing', 'Generating response...');
        this.updateSendButton(false);
        this.showTypingIndicator();

        try {
            // Add to conversation history
            this.conversationHistory.push({ role: 'user', content: message });
            
            // Keep last 10 messages
            if (this.conversationHistory.length > 10) {
                this.conversationHistory = this.conversationHistory.slice(-10);
            }

            const temperature = parseFloat(document.getElementById('temperatureSlider').value);
            const maxTokens = parseInt(document.getElementById('maxTokensSlider').value);
            
            const startTime = Date.now();
            
            // Call the actual API
            const response = await fetch(`${this.apiBaseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: this.conversationHistory,
                    maxTokens,
                    temperature
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const responseTime = Date.now() - startTime;
            
            // Add to history
            this.conversationHistory.push({ 
                role: 'assistant', 
                content: data.response 
            });
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            // Add assistant message
            this.addMessage('assistant', data.response, {
                model: data.model || 'tinyllama-1.1b',
                responseTime,
                tokens: Math.floor(data.response.length / 4),
                strategy: this.currentStrategy
            });

            // Update stats
            this.stats.messageCount++;
            this.stats.totalTokens += Math.floor(data.response.length / 4);
            this.stats.responseTimes.push(responseTime);
            this.updateStats();
            
        } catch (error) {
            console.error('Chat error:', error);
            this.hideTypingIndicator();
            this.showNotification('❌ Error generating response', 'error');
            
            // Add error message
            this.addMessage('assistant', 
                'Sorry, I encountered an error. Please make sure the API server is running.', 
                { model: 'error', responseTime: 0, tokens: 0 }
            );
        } finally {
            this.isProcessing = false;
            this.updateStatus('online', 'Ready');
            this.updateSendButton(true);
        }
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
        if (metadata.strategy || metadata.model) {
            metaHtml = `
                <div class="message-meta">
                    <span class="message-time">${timestamp}</span>
                    ${metadata.strategy ? `<span class="message-strategy">${metadata.strategy}</span>` : ''}
                    ${metadata.model ? `<span class="message-model">${metadata.model}</span>` : ''}
                    ${metadata.responseTime ? `<span class="message-latency">${metadata.responseTime}ms</span>` : ''}
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

        this.messages.push({ type, content, metadata, timestamp });
    }

    formatMessageContent(content) {
        // Basic markdown-like formatting
        return content
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>');
    }

    showTypingIndicator() {
        const chatMessages = document.getElementById('chatMessages');
        const existing = document.getElementById('typingIndicator');
        if (existing) existing.remove();
        
        const indicator = document.createElement('div');
        indicator.id = 'typingIndicator';
        indicator.className = 'message assistant typing';
        indicator.innerHTML = `
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        chatMessages.appendChild(indicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.remove();
    }

    updateStatus(status, message) {
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        
        if (statusDot && statusText) {
            statusDot.className = `status-dot ${status}`;
            statusText.textContent = message;
        }
    }

    updateSendButton(enabled) {
        const sendButton = document.getElementById('sendButton');
        if (sendButton) {
            sendButton.disabled = !enabled;
            sendButton.innerHTML = enabled 
                ? '<span class="btn-text">Send</span><span class="btn-icon">📤</span>'
                : '<span class="btn-text">Processing...</span><span class="btn-icon">⚡</span>';
        }
    }

    updateSliderValue(sliderId, displayId) {
        const slider = document.getElementById(sliderId);
        const display = document.getElementById(displayId);
        if (slider && display) {
            display.textContent = slider.value;
        }
    }

    updateStats() {
        const messageCountEl = document.getElementById('messageCount');
        const totalTokensEl = document.getElementById('totalTokens');
        const avgResponseEl = document.getElementById('avgResponse');
        
        if (messageCountEl) messageCountEl.textContent = this.stats.messageCount;
        if (totalTokensEl) totalTokensEl.textContent = this.stats.totalTokens;
        
        if (avgResponseEl) {
            if (this.stats.responseTimes.length > 0) {
                const avgTime = Math.round(
                    this.stats.responseTimes.reduce((a, b) => a + b, 0) / 
                    this.stats.responseTimes.length
                );
                avgResponseEl.textContent = `${avgTime}ms`;
            } else {
                avgResponseEl.textContent = '-';
            }
        }
    }

    updateModelStatus(modelsData) {
        const modelList = document.getElementById('modelList');
        if (!modelList) return;
        
        if (modelsData && modelsData.models) {
            modelList.innerHTML = modelsData.models.map(model => `
                <div class="model-item">
                    <div class="model-name">${model.name || model.id}</div>
                    <div class="model-status-badge online">Loaded</div>
                </div>
            `).join('');
        } else {
            modelList.innerHTML = `
                <div class="model-item">
                    <div class="model-name">Checking models...</div>
                    <div class="model-status-badge loading">Loading</div>
                </div>
            `;
        }
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        const welcomeMessage = chatMessages.querySelector('.welcome-message')?.parentElement;
        
        chatMessages.innerHTML = '';
        if (welcomeMessage) {
            chatMessages.appendChild(welcomeMessage);
        }
        
        this.messages = [];
        this.conversationHistory = [];
        this.stats = {
            messageCount: 0,
            totalTokens: 0,
            responseTimes: []
        };
        this.updateStats();
        this.showNotification('Chat cleared', 'info');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new LLMRouterChat();
});