// Admin Panel JavaScript

class AdminPanel {
    constructor() {
        this.apiUrl = window.location.origin;
        this.config = this.loadConfig();
        this.models = [];
        this.templates = this.loadTemplates();
        this.systemPresets = this.getSystemPresets();
        this.metrics = {
            requestCount: 0,
            totalLatency: 0,
            memoryUsage: 0
        };
        
        this.init();
    }

    async init() {
        this.setupNavigation();
        this.setupModelControls();
        this.setupTemplateControls();
        this.setupSystemControls();
        this.setupParameterControls();
        this.setupMonitoring();
        this.setupImportExport();
        
        // Initialize template selector with all available templates
        this.updateTemplateSelector();
        
        // Load config first
        this.loadCurrentConfig();
        // Then load models, which will restore the saved selection
        await this.loadModels();
        this.startMonitoring();
    }

    // Navigation
    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                // Update active nav
                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                
                // Show corresponding section
                const section = item.dataset.section;
                document.querySelectorAll('.settings-section').forEach(s => {
                    s.classList.remove('active');
                });
                document.getElementById(`${section}-section`).classList.add('active');
            });
        });
    }

    // Model Controls
    setupModelControls() {
        // Refresh models button
        document.getElementById('refreshModels').addEventListener('click', () => {
            this.loadModels();
        });

        // Model selection
        document.getElementById('activeModel').addEventListener('change', (e) => {
            this.selectModel(e.target.value);
        });

        // Parameter sliders
        const sliders = [
            { id: 'temperature', display: 'tempValue' },
            { id: 'maxTokens', display: 'maxTokensValue' },
            { id: 'topP', display: 'topPValue' },
            { id: 'topK', display: 'topKValue' },
            { id: 'repetitionPenalty', display: 'repPenaltyValue' },
            { id: 'contextSize', display: 'contextSizeValue' }
        ];

        sliders.forEach(slider => {
            const input = document.getElementById(slider.id);
            const display = document.getElementById(slider.display);
            
            input.addEventListener('input', (e) => {
                display.textContent = e.target.value;
                this.config.parameters[slider.id] = parseFloat(e.target.value);
            });
        });

        // Routing strategy
        document.getElementById('routingStrategy').addEventListener('change', (e) => {
            this.config.routingStrategy = e.target.value;
        });
    }

    // Template Controls
    setupTemplateControls() {
        // Template selection
        document.getElementById('activeTemplate').addEventListener('change', (e) => {
            this.loadTemplate(e.target.value);
        });

        // Template inputs
        const templateInputs = ['systemPrefix', 'userPrefix', 'assistantPrefix', 'messageSeparator', 'stopSequences'];
        templateInputs.forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                this.updateTemplatePreview();
            });
        });

        // Save template
        document.getElementById('saveTemplate').addEventListener('click', () => {
            this.saveCurrentTemplate();
        });

        // Initialize the template selector and list
        this.updateTemplateSelector();
        this.loadTemplateList();
    }

    // System Instructions
    setupSystemControls() {
        // System prompt
        document.getElementById('systemPrompt').addEventListener('input', (e) => {
            this.config.systemPrompt = e.target.value;
        });

        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                this.loadSystemPreset(preset);
            });
        });

        // Behavior checkboxes
        const checkboxes = ['useSystemPrompt', 'maintainContext', 'streamResponses', 'showTokenCount', 'enableCache'];
        checkboxes.forEach(id => {
            document.getElementById(id).addEventListener('change', (e) => {
                this.config.behavior[id] = e.target.checked;
            });
        });
    }

    // Advanced Parameters
    setupParameterControls() {
        // Sampling parameters
        const samplingParams = ['minLength', 'presencePenalty', 'frequencyPenalty', 'seed'];
        samplingParams.forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                this.config.advanced[id] = parseFloat(e.target.value) || null;
            });
        });

        // Performance settings
        const perfParams = ['batchSize', 'threads', 'gpuLayers', 'timeout'];
        perfParams.forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                this.config.performance[id] = parseInt(e.target.value);
            });
        });

        // Memory settings
        const memParams = ['cacheSize', 'cacheTTL', 'maxConcurrent'];
        memParams.forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                this.config.memory[id] = parseInt(e.target.value);
            });
        });
    }

    // Monitoring
    setupMonitoring() {
        // Clear logs
        document.getElementById('clearLogs').addEventListener('click', () => {
            document.getElementById('logsContainer').innerHTML = '';
        });

        // Download logs
        document.getElementById('downloadLogs').addEventListener('click', () => {
            this.downloadLogs();
        });

        // Logging configuration controls
        document.getElementById('logLevel').addEventListener('change', (e) => {
            this.updateLoggingConfig('logging.level', e.target.value);
        });

        document.getElementById('maxLogEntries').addEventListener('change', (e) => {
            this.updateLoggingConfig('logging.maxLogEntries', parseInt(e.target.value));
        });

        document.getElementById('showLogs').addEventListener('change', (e) => {
            this.updateLoggingConfig('logging.showLogs', e.target.checked);
        });

        document.getElementById('enableConsoleLogging').addEventListener('change', (e) => {
            this.updateLoggingConfig('logging.enableConsole', e.target.checked);
        });
    }

    updateLoggingConfig(path, value) {
        const keys = path.split('.');
        let current = this.config;
        
        // Ensure nested objects exist
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        // Set the value
        current[keys[keys.length - 1]] = value;
        
        // Save configuration
        this.saveConfig();
        this.showNotification(`Logging ${keys[keys.length - 1]} updated`, 'success');
    }

    // Import/Export
    setupImportExport() {
        // Save configuration
        document.getElementById('saveConfig').addEventListener('click', () => {
            this.saveConfig();
        });

        // Export configuration
        document.getElementById('exportConfig').addEventListener('click', () => {
            this.exportConfig();
        });

        // Import configuration
        document.getElementById('importConfig').addEventListener('click', () => {
            this.importConfig();
        });
    }

    // Load models from API
    async loadModels() {
        try {
            const response = await fetch(`${this.apiUrl}/api/models`);
            if (response.ok) {
                const data = await response.json();
                this.models = data.models || [];
                this.updateModelSelector();
                // Restore saved model selection after models are loaded
                if (this.config.activeModel) {
                    document.getElementById('activeModel').value = this.config.activeModel;
                    this.selectModel(this.config.activeModel);
                }
                this.showNotification('Models loaded successfully', 'success');
            }
        } catch (error) {
            console.error('Failed to load models:', error);
            this.showNotification('Failed to load models', 'error');
        }
    }

    updateModelSelector() {
        const selector = document.getElementById('activeModel');
        const currentValue = selector.value; // Save current selection
        selector.innerHTML = '<option value="auto">Auto-Select (Router)</option>';
        
        this.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = `${model.name} (${model.format})`;
            selector.appendChild(option);
        });
        
        // Try to restore previous selection if it still exists
        if (currentValue && Array.from(selector.options).some(opt => opt.value === currentValue)) {
            selector.value = currentValue;
        }
    }

    selectModel(modelId) {
        if (modelId === 'auto') {
            document.getElementById('modelInfo').innerHTML = '<p>Router will automatically select the best model</p>';
        } else {
            const model = this.models.find(m => m.id === modelId);
            if (model) {
                document.getElementById('modelInfo').innerHTML = `
                    <p><strong>Name:</strong> ${model.name}</p>
                    <p><strong>Format:</strong> ${model.format}</p>
                    <p><strong>Size:</strong> ${model.size || 'Unknown'}</p>
                    <p><strong>Context:</strong> ${model.contextSize || 'Unknown'}</p>
                    <p><strong>Status:</strong> ${model.loaded ? 'Loaded' : 'Not loaded'}</p>
                `;
                
                // Auto-select the appropriate template for this model
                this.autoSelectTemplate(modelId, model.name);
                
                // Also apply any model-specific parameters if available
                if (model.contextSize) {
                    document.getElementById('contextSize').value = model.contextSize;
                    document.getElementById('contextSizeValue').textContent = model.contextSize;
                    this.config.parameters.contextSize = model.contextSize;
                }
            }
        }
        this.config.activeModel = modelId;
    }

    autoSelectTemplate(modelId, modelName) {
        // Get the appropriate template for this model
        const template = window.ModelTemplates.getTemplateForModel(modelId, modelName);
        const templateId = window.ModelTemplates.getTemplateIdForModel(modelId, modelName);
        
        // Update the template dropdown if we're on the templates section
        const templateSelect = document.getElementById('activeTemplate');
        if (templateSelect) {
            // Check if this template exists in our saved templates
            if (!this.templates[templateId]) {
                // Add the template to our saved templates
                this.templates[templateId] = template;
                this.saveTemplates();
                
                // Update the dropdown
                this.updateTemplateSelector();
            }
            
            // Select the template
            templateSelect.value = templateId;
            this.loadTemplate(templateId);
            
            // Show notification
            this.showNotification(`Auto-selected ${template.name} template for ${modelName || modelId}`, 'info');
        }
        
        // Also update the template in config
        this.config.activeTemplate = templateId;
        this.config.templateSettings = template;
    }

    updateTemplateSelector() {
        const selector = document.getElementById('activeTemplate');
        if (!selector) return;
        
        const currentValue = selector.value;
        selector.innerHTML = '';
        
        // Add all predefined templates from ModelTemplates
        const allTemplates = window.ModelTemplates.getAllTemplates();
        allTemplates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            selector.appendChild(option);
        });
        
        // Add any custom saved templates
        Object.keys(this.templates).forEach(name => {
            if (!allTemplates.find(t => t.id === name)) {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = `Custom: ${name.charAt(0).toUpperCase() + name.slice(1)}`;
                selector.appendChild(option);
            }
        });
        
        // Restore selection if it exists
        if (currentValue && Array.from(selector.options).some(opt => opt.value === currentValue)) {
            selector.value = currentValue;
        }
    }

    // Template Management
    loadTemplate(templateName) {
        // First check if it's a predefined template from ModelTemplates
        const predefinedTemplate = window.ModelTemplates.templates[templateName];
        const template = predefinedTemplate || this.templates[templateName] || this.templates.default;
        
        document.getElementById('systemPrefix').value = template.systemPrefix || '';
        document.getElementById('userPrefix').value = template.userPrefix || '';
        document.getElementById('assistantPrefix').value = template.assistantPrefix || '';
        document.getElementById('messageSeparator').value = template.messageSeparator || template.separator || '\\n\\n';
        
        // Handle stop sequences - could be array or string
        const stopSeq = template.stopSequences;
        if (Array.isArray(stopSeq)) {
            document.getElementById('stopSequences').value = stopSeq.join(', ');
        } else if (typeof stopSeq === 'string') {
            document.getElementById('stopSequences').value = stopSeq;
        } else {
            document.getElementById('stopSequences').value = '';
        }
        
        this.updateTemplatePreview();
        
        // Update config
        this.config.activeTemplate = templateName;
        this.config.templateSettings = template;
    }

    updateTemplatePreview() {
        const system = document.getElementById('systemPrefix').value;
        const user = document.getElementById('userPrefix').value;
        const assistant = document.getElementById('assistantPrefix').value;
        const separator = document.getElementById('messageSeparator').value.replace(/\\n/g, '\n');
        
        const preview = `${system} You are a helpful assistant.${separator}${user} Hello!${separator}${assistant} Hi! How can I help you today?`;
        document.getElementById('templatePreview').textContent = preview;
    }

    saveCurrentTemplate() {
        const name = prompt('Enter template name:');
        if (name) {
            this.templates[name] = {
                systemPrefix: document.getElementById('systemPrefix').value,
                userPrefix: document.getElementById('userPrefix').value,
                assistantPrefix: document.getElementById('assistantPrefix').value,
                separator: document.getElementById('messageSeparator').value,
                stopSequences: document.getElementById('stopSequences').value.split(',').map(s => s.trim())
            };
            this.saveTemplates();
            this.loadTemplateList();
            this.showNotification('Template saved successfully', 'success');
        }
    }

    loadTemplateList() {
        const container = document.getElementById('templateList');
        container.innerHTML = '';
        
        // First add all predefined templates from ModelTemplates
        const predefinedTemplates = window.ModelTemplates.getAllTemplates();
        predefinedTemplates.forEach(template => {
            const div = document.createElement('div');
            div.className = 'template-item';
            div.innerHTML = `
                <span>${template.name} (Built-in)</span>
                <button class="btn btn-sm" onclick="adminPanel.loadTemplate('${template.id}')">Load</button>
            `;
            container.appendChild(div);
        });
        
        // Then add any custom saved templates
        Object.keys(this.templates).forEach(name => {
            // Skip if it's already in predefined templates
            if (!predefinedTemplates.find(t => t.id === name)) {
                const div = document.createElement('div');
                div.className = 'template-item';
                div.innerHTML = `
                    <span>${name}</span>
                    <button class="btn btn-sm" onclick="adminPanel.loadTemplate('${name}')">Load</button>
                    <button class="btn btn-sm" onclick="adminPanel.deleteTemplate('${name}')">Delete</button>
                `;
                container.appendChild(div);
            }
        });
    }

    deleteTemplate(name) {
        if (name !== 'default' && confirm(`Delete template "${name}"?`)) {
            delete this.templates[name];
            this.saveTemplates();
            this.loadTemplateList();
        }
    }

    // System Presets
    getSystemPresets() {
        return {
            helpful: "You are a helpful, harmless, and honest AI assistant. You provide clear, accurate, and useful responses while being respectful and professional.",
            creative: "You are a creative writing assistant. You help with storytelling, poetry, and creative expression. You are imaginative, descriptive, and engaging.",
            technical: "You are a technical expert assistant. You provide detailed, accurate technical information and help with programming, engineering, and scientific topics.",
            teacher: "You are an educational assistant. You explain concepts clearly, provide examples, and help students learn. You are patient, encouraging, and thorough.",
            analyst: "You are a data analyst assistant. You help interpret data, identify patterns, and provide insights. You are analytical, precise, and detail-oriented.",
            translator: "You are a translation assistant. You accurately translate between languages while preserving meaning, tone, and cultural context."
        };
    }

    loadSystemPreset(preset) {
        const prompt = this.systemPresets[preset];
        if (prompt) {
            document.getElementById('systemPrompt').value = prompt;
            this.config.systemPrompt = prompt;
            this.showNotification(`Loaded ${preset} preset`, 'success');
        }
    }

    // Monitoring
    startMonitoring() {
        // Update metrics every 5 seconds
        setInterval(() => {
            this.updateMetrics();
        }, 5000);

        // Update logs
        this.connectToLogs();
    }

    async updateMetrics() {
        try {
            const response = await fetch(`${this.apiUrl}/api/status`);
            if (response.ok) {
                const data = await response.json();
                
                // Update memory usage
                const memoryMB = (data.memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
                document.getElementById('memoryUsage').textContent = `${memoryMB} MB`;
                
                // Update model status
                document.getElementById('modelStatus').textContent = 
                    data.initialized ? `${data.modelsLoaded} models` : 'Initializing...';
            }
        } catch (error) {
            console.error('Failed to update metrics:', error);
        }
    }

    connectToLogs() {
        // In a real implementation, this would connect to a WebSocket for live logs
        this.addLog('info', 'Admin panel connected');
    }

    addLog(level, message) {
        const container = document.getElementById('logsContainer');
        const log = document.createElement('div');
        log.className = `log-entry log-${level}`;
        log.textContent = `[${new Date().toLocaleTimeString()}] [${level.toUpperCase()}] ${message}`;
        container.appendChild(log);
        
        if (document.getElementById('autoScroll').checked) {
            container.scrollTop = container.scrollHeight;
        }
    }

    downloadLogs() {
        const logs = document.getElementById('logsContainer').textContent;
        const blob = new Blob([logs], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `llm-router-logs-${Date.now()}.txt`;
        a.click();
    }

    // Configuration Management
    loadConfig() {
        const saved = localStorage.getItem('llmRouterConfig');
        if (saved) {
            return JSON.parse(saved);
        }
        
        return {
            activeModel: 'auto',
            routingStrategy: 'balanced',
            systemPrompt: '',
            parameters: {
                temperature: 0.7,
                maxTokens: 500,
                topP: 0.9,
                topK: 40,
                repetitionPenalty: 1.1,
                contextSize: 2048
            },
            behavior: {
                useSystemPrompt: true,
                maintainContext: false,
                streamResponses: true,
                showTokenCount: false,
                enableCache: false
            },
            advanced: {
                minLength: 1,
                presencePenalty: 0,
                frequencyPenalty: 0,
                seed: null
            },
            performance: {
                batchSize: 1,
                threads: 4,
                gpuLayers: 0,
                timeout: 30000
            },
            memory: {
                cacheSize: 100,
                cacheTTL: 300,
                maxConcurrent: 10
            }
        };
    }

    loadCurrentConfig() {
        // Load config into UI
        const config = this.config;
        
        // Model settings
        document.getElementById('activeModel').value = config.activeModel;
        document.getElementById('routingStrategy').value = config.routingStrategy;
        
        // Parameters
        Object.keys(config.parameters).forEach(key => {
            const input = document.getElementById(key);
            if (input) {
                input.value = config.parameters[key];
                const display = document.getElementById(key.replace(/([A-Z])/g, '$1').toLowerCase() + 'Value');
                if (display) {
                    display.textContent = config.parameters[key];
                }
            }
        });
        
        // System prompt
        document.getElementById('systemPrompt').value = config.systemPrompt || '';
        
        // Behavior settings
        Object.keys(config.behavior).forEach(key => {
            const checkbox = document.getElementById(key);
            if (checkbox) {
                checkbox.checked = config.behavior[key];
            }
        });
        
        // Advanced parameters
        Object.keys(config.advanced).forEach(key => {
            const input = document.getElementById(key);
            if (input) {
                input.value = config.advanced[key] || '';
            }
        });
        
        // Performance settings
        Object.keys(config.performance).forEach(key => {
            const input = document.getElementById(key);
            if (input) {
                input.value = config.performance[key];
            }
        });
        
        // Memory settings
        Object.keys(config.memory).forEach(key => {
            const input = document.getElementById(key);
            if (input) {
                input.value = config.memory[key];
            }
        });
        
        // Logging configuration
        if (config.logging) {
            const logLevelSelect = document.getElementById('logLevel');
            if (logLevelSelect && config.logging.level) {
                logLevelSelect.value = config.logging.level;
            }
            
            const maxLogEntriesInput = document.getElementById('maxLogEntries');
            if (maxLogEntriesInput && config.logging.maxLogEntries) {
                maxLogEntriesInput.value = config.logging.maxLogEntries;
            }
            
            const showLogsCheckbox = document.getElementById('showLogs');
            if (showLogsCheckbox) {
                showLogsCheckbox.checked = config.logging.showLogs || false;
            }
            
            const enableConsoleCheckbox = document.getElementById('enableConsoleLogging');
            if (enableConsoleCheckbox) {
                enableConsoleCheckbox.checked = config.logging.enableConsole || false;
            }
        }
    }

    async saveConfig() {
        // Make sure to capture the current model selection
        const currentModel = document.getElementById('activeModel').value;
        if (currentModel) {
            this.config.activeModel = currentModel;
        }
        
        localStorage.setItem('llmRouterConfig', JSON.stringify(this.config));
        
        // Also save to server
        try {
            const response = await fetch(`${this.apiUrl}/api/config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.config)
            });
            
            if (response.ok) {
                this.showNotification('Configuration saved successfully', 'success');
            } else {
                throw new Error('Failed to save to server');
            }
        } catch (error) {
            console.error('Failed to save config:', error);
            this.showNotification('Configuration saved locally', 'warning');
        }
    }

    exportConfig() {
        const config = JSON.stringify(this.config, null, 2);
        const blob = new Blob([config], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `llm-router-config-${Date.now()}.json`;
        a.click();
    }

    importConfig() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    this.config = JSON.parse(event.target.result);
                    this.loadCurrentConfig();
                    this.saveConfig();
                    this.showNotification('Configuration imported successfully', 'success');
                } catch (error) {
                    this.showNotification('Invalid configuration file', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // Template Management
    loadTemplates() {
        const saved = localStorage.getItem('llmRouterTemplates');
        if (saved) {
            return JSON.parse(saved);
        }
        
        return {
            default: {
                systemPrefix: '### System:',
                userPrefix: '### User:',
                assistantPrefix: '### Assistant:',
                separator: '\n\n',
                stopSequences: ['### User:', '### System:']
            },
            alpaca: {
                systemPrefix: '### Instruction:',
                userPrefix: '### Input:',
                assistantPrefix: '### Response:',
                separator: '\n\n',
                stopSequences: ['### Input:', '### Instruction:']
            },
            chatml: {
                systemPrefix: '<|im_start|>system',
                userPrefix: '<|im_start|>user',
                assistantPrefix: '<|im_start|>assistant',
                separator: '<|im_end|>\n',
                stopSequences: ['<|im_end|>']
            },
            llama: {
                systemPrefix: '[INST] <<SYS>>',
                userPrefix: '[INST]',
                assistantPrefix: '[/INST]',
                separator: '\n',
                stopSequences: ['[INST]', '</s>']
            },
            vicuna: {
                systemPrefix: 'SYSTEM:',
                userPrefix: 'USER:',
                assistantPrefix: 'ASSISTANT:',
                separator: '\n',
                stopSequences: ['USER:', 'SYSTEM:']
            }
        };
    }

    saveTemplates() {
        localStorage.setItem('llmRouterTemplates', JSON.stringify(this.templates));
    }

    // Notifications
    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const text = document.getElementById('notificationText');
        
        notification.className = `notification ${type}`;
        text.textContent = message;
        notification.classList.remove('hidden');
        
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);
    }
}

// Initialize admin panel
const adminPanel = new AdminPanel();