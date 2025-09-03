/**
 * BYOK (Bring Your Own Key) Management Interface
 * Handles API key storage, validation, and provider management
 */

class BYOKManager {
    constructor() {
        this.keys = {};
        this.testResults = {};
        this.apiUrl = window.location.origin;
        
        this.providers = {
            openai: {
                name: 'OpenAI',
                testEndpoint: 'https://api.openai.com/v1/models',
                validateKey: this.validateOpenAIKey.bind(this),
                keyFormat: /^sk-[a-zA-Z0-9]{48,}$/
            },
            anthropic: {
                name: 'Anthropic',
                testEndpoint: 'https://api.anthropic.com/v1/messages',
                validateKey: this.validateAnthropicKey.bind(this),
                keyFormat: /^sk-ant-[a-zA-Z0-9\-_]{32,}$/
            },
            google: {
                name: 'Google AI',
                testEndpoint: 'https://generativelanguage.googleapis.com/v1/models',
                validateKey: this.validateGoogleKey.bind(this),
                keyFormat: /^AIza[a-zA-Z0-9\-_]{35}$/
            },
            cohere: {
                name: 'Cohere',
                testEndpoint: 'https://api.cohere.ai/v1/generate',
                validateKey: this.validateCohereKey.bind(this),
                keyFormat: /^co-[a-zA-Z0-9]{16,}$/
            },
            huggingface: {
                name: 'Hugging Face',
                testEndpoint: 'https://huggingface.co/api/whoami-v2',
                validateKey: this.validateHuggingFaceKey.bind(this),
                keyFormat: /^hf_[a-zA-Z0-9]{34,}$/
            },
            openrouter: {
                name: 'OpenRouter',
                testEndpoint: 'https://openrouter.ai/api/v1/models',
                validateKey: this.validateOpenRouterKey.bind(this),
                keyFormat: /^sk-or-[a-zA-Z0-9\-_]{32,}$/
            },
            together: {
                name: 'Together AI',
                testEndpoint: 'https://api.together.xyz/models/info',
                validateKey: this.validateTogetherKey.bind(this),
                keyFormat: /^[a-f0-9]{64}$/
            },
            groq: {
                name: 'Groq',
                testEndpoint: 'https://api.groq.com/openai/v1/models',
                validateKey: this.validateGroqKey.bind(this),
                keyFormat: /^gsk_[a-zA-Z0-9]{52}$/
            }
        };
        
        this.init();
    }

    init() {
        this.loadKeys();
        this.bindEvents();
        this.loadUsageStats();
    }

    bindEvents() {
        // Key input events
        Object.keys(this.providers).forEach(provider => {
            const keyInput = document.getElementById(`${provider}-key`);
            const enabledCheckbox = document.getElementById(`${provider}-enabled`);
            
            if (keyInput) {
                keyInput.addEventListener('input', () => this.validateKeyFormat(provider));
                keyInput.addEventListener('blur', () => this.saveKey(provider));
            }
            
            if (enabledCheckbox) {
                enabledCheckbox.addEventListener('change', () => this.toggleProvider(provider));
            }
        });

        // Bulk action events
        document.getElementById('testAllKeys')?.addEventListener('click', () => this.testAllKeys());
        document.getElementById('saveAllKeys')?.addEventListener('click', () => this.saveAllKeys());
        document.getElementById('clearAllKeys')?.addEventListener('click', () => this.clearAllKeys());
        document.getElementById('loadDefaults')?.addEventListener('click', () => this.loadDefaults());
        document.getElementById('exportKeys')?.addEventListener('click', () => this.exportConfig());
        document.getElementById('importKeys')?.addEventListener('click', () => this.importConfig());

        // Modal events
        document.getElementById('modalCancel')?.addEventListener('click', () => this.hideModal());
        document.getElementById('modalConfirm')?.addEventListener('click', () => this.handleModalConfirm());
    }

    async loadKeys() {
        try {
            const response = await fetch(`${this.apiUrl}/api/admin/byok/keys`);
            if (response.ok) {
                const data = await response.json();
                this.keys = data.keys || {};
                this.populateUI();
            } else {
                console.warn('Could not load saved keys, using defaults');
                this.keys = {};
            }
        } catch (error) {
            console.warn('Error loading keys:', error);
            this.keys = {};
            this.populateUI();
        }
    }

    populateUI() {
        Object.keys(this.providers).forEach(provider => {
            const keyData = this.keys[provider] || {};
            
            // Populate key input (masked for security)
            const keyInput = document.getElementById(`${provider}-key`);
            if (keyInput && keyData.key) {
                keyInput.value = this.maskKey(keyData.key);
                keyInput.dataset.hasKey = 'true';
            }

            // Populate organization/additional fields
            if (provider === 'openai' && keyData.organization) {
                const orgInput = document.getElementById(`${provider}-org`);
                if (orgInput) orgInput.value = keyData.organization;
            }

            // Set enabled state
            const enabledCheckbox = document.getElementById(`${provider}-enabled`);
            if (enabledCheckbox) {
                enabledCheckbox.checked = keyData.enabled || false;
            }

            // Update status
            if (keyData.lastTestResult) {
                this.updateKeyStatus(provider, keyData.lastTestResult);
            }
        });
    }

    validateKeyFormat(provider) {
        const keyInput = document.getElementById(`${provider}-key`);
        const key = keyInput.value.trim();
        
        if (!key) {
            this.updateKeyStatus(provider, null);
            return;
        }

        const providerConfig = this.providers[provider];
        const isValid = providerConfig.keyFormat.test(key);
        
        this.updateKeyStatus(provider, {
            valid: isValid,
            message: isValid ? 'Key format is valid' : 'Invalid key format',
            type: isValid ? 'format_valid' : 'format_invalid'
        });

        return isValid;
    }

    async saveKey(provider) {
        const keyInput = document.getElementById(`${provider}-key`);
        const key = keyInput.value.trim();
        
        if (!key) {
            delete this.keys[provider];
        } else {
            // Only save if it's a new key (not masked)
            if (!keyInput.dataset.hasKey || key !== this.maskKey(this.keys[provider]?.key)) {
                this.keys[provider] = {
                    ...this.keys[provider],
                    key,
                    updatedAt: new Date().toISOString()
                };
                
                // Save organization for OpenAI
                if (provider === 'openai') {
                    const orgInput = document.getElementById(`${provider}-org`);
                    if (orgInput?.value) {
                        this.keys[provider].organization = orgInput.value.trim();
                    }
                }
            }
        }

        await this.saveToServer();
    }

    toggleProvider(provider) {
        const enabledCheckbox = document.getElementById(`${provider}-enabled`);
        const enabled = enabledCheckbox.checked;
        
        if (!this.keys[provider]) {
            this.keys[provider] = {};
        }
        
        this.keys[provider].enabled = enabled;
        this.saveToServer();
        
        this.showNotification(`${this.providers[provider].name} ${enabled ? 'enabled' : 'disabled'}`, enabled ? 'success' : 'info');
    }

    async testKey(provider) {
        const keyData = this.keys[provider];
        if (!keyData?.key) {
            this.showNotification(`No ${this.providers[provider].name} key to test`, 'error');
            return;
        }

        this.updateKeyStatus(provider, { valid: null, message: 'Testing key...', type: 'testing' });
        
        try {
            const result = await this.providers[provider].validateKey(keyData);
            this.updateKeyStatus(provider, result);
            
            // Save test result
            this.keys[provider].lastTestResult = result;
            this.keys[provider].lastTested = new Date().toISOString();
            await this.saveToServer();
            
            if (result.valid) {
                this.showNotification(`${this.providers[provider].name} key is working!`, 'success');
                this.loadUsageForProvider(provider);
            } else {
                this.showNotification(`${this.providers[provider].name} key test failed: ${result.message}`, 'error');
            }
        } catch (error) {
            const errorResult = { valid: false, message: error.message, type: 'test_error' };
            this.updateKeyStatus(provider, errorResult);
            this.showNotification(`Error testing ${this.providers[provider].name} key`, 'error');
        }
    }

    async testAllKeys() {
        const enabledProviders = Object.keys(this.providers).filter(provider => {
            return this.keys[provider]?.enabled && this.keys[provider]?.key;
        });

        if (enabledProviders.length === 0) {
            this.showNotification('No enabled providers with keys to test', 'warning');
            return;
        }

        this.showNotification(`Testing ${enabledProviders.length} provider keys...`, 'info');

        const results = await Promise.allSettled(
            enabledProviders.map(provider => this.testKey(provider))
        );

        const successful = results.filter(r => r.status === 'fulfilled').length;
        this.showNotification(`Tested ${enabledProviders.length} keys: ${successful} successful`, 'success');
    }

    clearKey(provider) {
        if (confirm(`Clear ${this.providers[provider].name} key?`)) {
            delete this.keys[provider];
            
            // Clear UI
            const keyInput = document.getElementById(`${provider}-key`);
            const enabledCheckbox = document.getElementById(`${provider}-enabled`);
            const orgInput = document.getElementById(`${provider}-org`);
            
            if (keyInput) {
                keyInput.value = '';
                keyInput.dataset.hasKey = 'false';
            }
            if (enabledCheckbox) enabledCheckbox.checked = false;
            if (orgInput) orgInput.value = '';
            
            this.updateKeyStatus(provider, null);
            this.saveToServer();
            this.showNotification(`${this.providers[provider].name} key cleared`, 'info');
        }
    }

    clearAllKeys() {
        if (confirm('Clear ALL API keys? This cannot be undone.')) {
            this.keys = {};
            
            // Clear UI for all providers
            Object.keys(this.providers).forEach(provider => {
                const keyInput = document.getElementById(`${provider}-key`);
                const enabledCheckbox = document.getElementById(`${provider}-enabled`);
                const orgInput = document.getElementById(`${provider}-org`);
                
                if (keyInput) {
                    keyInput.value = '';
                    keyInput.dataset.hasKey = 'false';
                }
                if (enabledCheckbox) enabledCheckbox.checked = false;
                if (orgInput) orgInput.value = '';
                
                this.updateKeyStatus(provider, null);
            });
            
            this.saveToServer();
            this.showNotification('All keys cleared', 'success');
        }
    }

    async saveAllKeys() {
        // Save all current form values
        Object.keys(this.providers).forEach(provider => {
            const keyInput = document.getElementById(`${provider}-key`);
            const key = keyInput?.value?.trim();
            
            if (key && !keyInput.dataset.hasKey) {
                if (!this.keys[provider]) this.keys[provider] = {};
                this.keys[provider].key = key;
                this.keys[provider].updatedAt = new Date().toISOString();
            }
        });
        
        await this.saveToServer();
        this.showNotification('All keys saved', 'success');
    }

    loadDefaults() {
        // Load some common test keys or examples
        const defaults = {
            openai: { enabled: true },
            anthropic: { enabled: false },
            google: { enabled: false }
        };
        
        Object.keys(defaults).forEach(provider => {
            const enabledCheckbox = document.getElementById(`${provider}-enabled`);
            if (enabledCheckbox) {
                enabledCheckbox.checked = defaults[provider].enabled;
                this.keys[provider] = { ...this.keys[provider], ...defaults[provider] };
            }
        });
        
        this.saveToServer();
        this.showNotification('Default configuration loaded', 'success');
    }

    exportConfig() {
        const config = {
            keys: this.sanitizeKeysForExport(this.keys),
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
        
        document.getElementById('modalTitle').textContent = 'Export Configuration';
        document.getElementById('configData').value = JSON.stringify(config, null, 2);
        document.getElementById('modalConfirm').textContent = 'Copy to Clipboard';
        this.currentModalAction = 'export';
        this.showModal();
    }

    importConfig() {
        document.getElementById('modalTitle').textContent = 'Import Configuration';
        document.getElementById('configData').value = '';
        document.getElementById('configData').placeholder = 'Paste your configuration JSON here...';
        document.getElementById('modalConfirm').textContent = 'Import';
        this.currentModalAction = 'import';
        this.showModal();
    }

    handleModalConfirm() {
        if (this.currentModalAction === 'export') {
            const configData = document.getElementById('configData').value;
            navigator.clipboard.writeText(configData).then(() => {
                this.showNotification('Configuration copied to clipboard', 'success');
                this.hideModal();
            }).catch(() => {
                this.showNotification('Failed to copy to clipboard', 'error');
            });
        } else if (this.currentModalAction === 'import') {
            try {
                const configData = document.getElementById('configData').value;
                const config = JSON.parse(configData);
                
                if (config.keys) {
                    this.keys = { ...this.keys, ...config.keys };
                    this.populateUI();
                    this.saveToServer();
                    this.showNotification('Configuration imported successfully', 'success');
                } else {
                    throw new Error('Invalid configuration format');
                }
                
                this.hideModal();
            } catch (error) {
                this.showNotification(`Import failed: ${error.message}`, 'error');
            }
        }
    }

    showModal() {
        document.getElementById('configModal').classList.remove('hidden');
    }

    hideModal() {
        document.getElementById('configModal').classList.add('hidden');
    }

    sanitizeKeysForExport(keys) {
        const sanitized = {};
        Object.keys(keys).forEach(provider => {
            sanitized[provider] = {
                ...keys[provider],
                key: keys[provider].key ? '[REDACTED]' : undefined
            };
        });
        return sanitized;
    }

    maskKey(key) {
        if (!key || key.length < 8) return key;
        const start = key.substring(0, 4);
        const end = key.substring(key.length - 4);
        const middle = '*'.repeat(Math.max(8, key.length - 8));
        return `${start}${middle}${end}`;
    }

    updateKeyStatus(provider, result) {
        const statusElement = document.getElementById(`${provider}-status`);
        if (!statusElement) return;

        if (!result) {
            statusElement.style.display = 'none';
            return;
        }

        statusElement.style.display = 'flex';
        statusElement.className = `key-status ${result.type || (result.valid ? 'valid' : 'invalid')}`;
        
        const icon = result.valid === null ? '🔄' : (result.valid ? '✅' : '❌');
        statusElement.innerHTML = `<span>${icon}</span><span>${result.message}</span>`;
    }

    async loadUsageStats() {
        try {
            const response = await fetch(`${this.apiUrl}/api/admin/byok/usage`);
            if (response.ok) {
                const data = await response.json();
                this.updateUsageDisplay(data);
            }
        } catch (error) {
            console.warn('Could not load usage stats:', error);
        }
    }

    async loadUsageForProvider(provider) {
        try {
            const response = await fetch(`${this.apiUrl}/api/admin/byok/usage/${provider}`);
            if (response.ok) {
                const data = await response.json();
                this.updateProviderUsage(provider, data);
            }
        } catch (error) {
            console.warn(`Could not load usage for ${provider}:`, error);
        }
    }

    updateUsageDisplay(usage) {
        Object.keys(usage).forEach(provider => {
            this.updateProviderUsage(provider, usage[provider]);
        });
    }

    updateProviderUsage(provider, usage) {
        const usageElement = document.getElementById(`${provider}-usage`);
        if (!usageElement) return;

        const todayElement = document.getElementById(`${provider}-today`);
        const monthElement = document.getElementById(`${provider}-month`);

        if (usage.today || usage.month) {
            usageElement.style.display = 'block';
            if (todayElement) todayElement.textContent = `${usage.today || 0} requests`;
            if (monthElement) monthElement.textContent = `${usage.month || 0} requests`;
        } else {
            usageElement.style.display = 'none';
        }
    }

    async saveToServer() {
        try {
            const response = await fetch(`${this.apiUrl}/api/admin/byok/keys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ keys: this.keys })
            });

            if (!response.ok) {
                throw new Error('Failed to save keys to server');
            }
        } catch (error) {
            console.warn('Could not save to server, using local storage:', error);
            localStorage.setItem('byok_keys', JSON.stringify(this.keys));
        }
    }

    // Provider-specific validation methods
    async validateOpenAIKey(keyData) {
        const headers = {
            'Authorization': `Bearer ${keyData.key}`,
            'Content-Type': 'application/json'
        };
        
        if (keyData.organization) {
            headers['OpenAI-Organization'] = keyData.organization;
        }

        const response = await fetch('https://api.openai.com/v1/models', { headers });
        
        if (response.ok) {
            const data = await response.json();
            return {
                valid: true,
                message: `Connected successfully. ${data.data?.length || 0} models available.`,
                type: 'test_success'
            };
        } else {
            const error = await response.text();
            return {
                valid: false,
                message: `API Error: ${response.status} - ${error}`,
                type: 'test_error'
            };
        }
    }

    async validateAnthropicKey(keyData) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${keyData.key}`,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Hi' }]
            })
        });

        if (response.ok || response.status === 400) {
            return {
                valid: true,
                message: 'Key validated successfully',
                type: 'test_success'
            };
        } else {
            return {
                valid: false,
                message: `API Error: ${response.status}`,
                type: 'test_error'
            };
        }
    }

    async validateGoogleKey(keyData) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${keyData.key}`);
        
        if (response.ok) {
            const data = await response.json();
            return {
                valid: true,
                message: `Connected successfully. ${data.models?.length || 0} models available.`,
                type: 'test_success'
            };
        } else {
            return {
                valid: false,
                message: `API Error: ${response.status}`,
                type: 'test_error'
            };
        }
    }

    async validateCohereKey(keyData) {
        const response = await fetch('https://api.cohere.ai/v1/models', {
            headers: {
                'Authorization': `Bearer ${keyData.key}`
            }
        });

        if (response.ok) {
            return {
                valid: true,
                message: 'Key validated successfully',
                type: 'test_success'
            };
        } else {
            return {
                valid: false,
                message: `API Error: ${response.status}`,
                type: 'test_error'
            };
        }
    }

    async validateHuggingFaceKey(keyData) {
        const response = await fetch('https://huggingface.co/api/whoami-v2', {
            headers: {
                'Authorization': `Bearer ${keyData.key}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            return {
                valid: true,
                message: `Connected as ${data.name || 'user'}`,
                type: 'test_success'
            };
        } else {
            return {
                valid: false,
                message: `API Error: ${response.status}`,
                type: 'test_error'
            };
        }
    }

    async validateOpenRouterKey(keyData) {
        const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
            headers: {
                'Authorization': `Bearer ${keyData.key}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            return {
                valid: true,
                message: `Key validated. Credit: $${data.data?.credit_left || 0}`,
                type: 'test_success'
            };
        } else {
            return {
                valid: false,
                message: `API Error: ${response.status}`,
                type: 'test_error'
            };
        }
    }

    async validateTogetherKey(keyData) {
        const response = await fetch('https://api.together.xyz/models/info', {
            headers: {
                'Authorization': `Bearer ${keyData.key}`
            }
        });

        if (response.ok) {
            return {
                valid: true,
                message: 'Key validated successfully',
                type: 'test_success'
            };
        } else {
            return {
                valid: false,
                message: `API Error: ${response.status}`,
                type: 'test_error'
            };
        }
    }

    async validateGroqKey(keyData) {
        const response = await fetch('https://api.groq.com/openai/v1/models', {
            headers: {
                'Authorization': `Bearer ${keyData.key}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            return {
                valid: true,
                message: `Connected successfully. ${data.data?.length || 0} models available.`,
                type: 'test_success'
            };
        } else {
            return {
                valid: false,
                message: `API Error: ${response.status}`,
                type: 'test_error'
            };
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notificationText');
        
        if (notification && notificationText) {
            notificationText.textContent = message;
            notification.className = `notification ${type}`;
            notification.classList.remove('hidden');
            
            setTimeout(() => {
                notification.classList.add('hidden');
            }, 5000);
        }
    }
}

// Utility functions for template
function toggleVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    
    if (input.type === 'password') {
        input.type = 'text';
        button.textContent = '🙈';
    } else {
        input.type = 'password';
        button.textContent = '👁️';
    }
}

function testKey(provider) {
    window.byokManager.testKey(provider);
}

function clearKey(provider) {
    window.byokManager.clearKey(provider);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.byokManager = new BYOKManager();
    });
} else {
    window.byokManager = new BYOKManager();
}