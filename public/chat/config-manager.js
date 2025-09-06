/**
 * Configuration Manager for Chat Interface
 * Loads and applies settings from admin panel
 */

class ConfigManager {
    constructor() {
        this.config = null;
        this.apiUrl = window.location.origin;
        this.loadConfig();
    }

    /**
     * Load configuration from localStorage or server
     */
    async loadConfig() {
        // First try localStorage
        const savedConfig = localStorage.getItem('llmRouterConfig');
        if (savedConfig) {
            this.config = JSON.parse(savedConfig);
        } else {
            // Fallback to defaults
            this.config = this.getDefaultConfig();
        }
        
        // Sync with server configuration
        try {
            const response = await fetch(`${this.apiUrl}/api/config`);
            if (response.ok) {
                const serverConfig = await response.json();
                // Merge with local config
                this.config = { ...this.config, ...serverConfig };
                this.saveConfig();
            }
        } catch (error) {
            console.debug('Could not fetch server config, using local:', error);
        }
        
        return this.config;
    }

    /**
     * Save configuration to localStorage
     */
    saveConfig() {
        localStorage.setItem('llmRouterConfig', JSON.stringify(this.config));
    }

    /**
     * Get default configuration
     */
    getDefaultConfig() {
        return {
            activeModel: 'auto',
            activeTemplate: 'default',
            routingStrategy: 'balanced',
            systemPrompt: 'You are a helpful AI assistant.',
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
            },
            monitoring: {
                enabled: true,
                showHealthStatus: true,
                showPerformanceMetrics: true,
                autoRefreshInterval: 5000,
                alertThresholds: {
                    errorRate: 0.05,
                    responseTime: 2000,
                    cpuUsage: 80,
                    memoryUsage: 85
                }
            },
            logging: {
                level: 'info',
                showLogs: false,
                maxLogEntries: 100,
                enableConsole: false
            },
            templateSettings: {
                systemPrefix: '### System:',
                userPrefix: '### User:',
                assistantPrefix: '### Assistant:',
                separator: '\n\n',
                stopSequences: ['### User:', '### System:']
            }
        };
    }

    /**
     * Get system prompt
     */
    getSystemPrompt() {
        return this.config?.systemPrompt || '';
    }

    /**
     * Check if system prompt is enabled
     */
    isSystemPromptEnabled() {
        return this.config?.behavior?.useSystemPrompt !== false;
    }

    /**
     * Get generation parameters
     */
    getGenerationParams() {
        return {
            temperature: this.config?.parameters?.temperature || 0.7,
            maxTokens: this.config?.parameters?.maxTokens || 500,
            topP: this.config?.parameters?.topP || 0.9,
            topK: this.config?.parameters?.topK || 40,
            repetitionPenalty: this.config?.parameters?.repetitionPenalty || 1.1,
            presencePenalty: this.config?.advanced?.presencePenalty || 0,
            frequencyPenalty: this.config?.advanced?.frequencyPenalty || 0,
            seed: this.config?.advanced?.seed || null,
            contextSize: this.config?.parameters?.contextSize || 2048
        };
    }

    /**
     * Get template settings
     */
    getTemplateSettings() {
        return this.config?.templateSettings || this.getDefaultConfig().templateSettings;
    }

    /**
     * Format messages with template
     */
    formatMessages(messages) {
        const template = this.getTemplateSettings();
        let formatted = '';
        
        // Add system prompt if enabled
        if (this.isSystemPromptEnabled() && this.getSystemPrompt()) {
            formatted += template.systemPrefix + ' ' + this.getSystemPrompt() + template.separator;
        }
        
        // Format conversation
        messages.forEach(msg => {
            if (msg.role === 'user') {
                formatted += template.userPrefix + ' ' + msg.content + template.separator;
            } else if (msg.role === 'assistant') {
                formatted += template.assistantPrefix + ' ' + msg.content + template.separator;
            }
        });
        
        return formatted;
    }

    /**
     * Get active model
     */
    getActiveModel() {
        return this.config?.activeModel || 'auto';
    }

    /**
     * Get routing strategy
     */
    getRoutingStrategy() {
        return this.config?.routingStrategy || 'balanced';
    }

    /**
     * Check if streaming is enabled
     */
    isStreamingEnabled() {
        return this.config?.behavior?.streamResponses !== false;
    }

    /**
     * Check if context should be maintained
     */
    shouldMaintainContext() {
        return this.config?.behavior?.maintainContext === true;
    }

    /**
     * Check if token count should be shown
     */
    shouldShowTokenCount() {
        return this.config?.behavior?.showTokenCount === true;
    }

    /**
     * Check if cache is enabled
     */
    isCacheEnabled() {
        return this.config?.behavior?.enableCache === true;
    }

    /**
     * Update specific setting
     */
    updateSetting(path, value) {
        const keys = path.split('.');
        let current = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
        this.saveConfig();
    }

    /**
     * Reload configuration from localStorage
     */
    reloadConfig() {
        return this.loadConfig();
    }

    /**
     * Listen for configuration changes
     */
    onConfigChange(callback) {
        // Listen for storage events (changes from other tabs/admin panel)
        window.addEventListener('storage', (e) => {
            if (e.key === 'llmRouterConfig') {
                this.config = JSON.parse(e.newValue);
                callback(this.config);
            }
        });
    }

    /**
     * Check if monitoring is enabled
     */
    isMonitoringEnabled() {
        return this.config?.monitoring?.enabled !== false;
    }

    /**
     * Check if health status should be shown
     */
    shouldShowHealthStatus() {
        return this.config?.monitoring?.showHealthStatus !== false;
    }

    /**
     * Check if performance metrics should be shown
     */
    shouldShowPerformanceMetrics() {
        return this.config?.monitoring?.showPerformanceMetrics !== false;
    }

    /**
     * Get monitoring refresh interval
     */
    getMonitoringRefreshInterval() {
        return this.config?.monitoring?.autoRefreshInterval || 5000;
    }

    /**
     * Get alert thresholds
     */
    getAlertThresholds() {
        return this.config?.monitoring?.alertThresholds || this.getDefaultConfig().monitoring.alertThresholds;
    }

    /**
     * Get logging configuration
     */
    getLoggingConfig() {
        return this.config?.logging || this.getDefaultConfig().logging;
    }

    /**
     * Check if logs should be shown
     */
    shouldShowLogs() {
        return this.config?.logging?.showLogs === true;
    }

    /**
     * Get log level
     */
    getLogLevel() {
        return this.config?.logging?.level || 'info';
    }

    /**
     * Get max log entries
     */
    getMaxLogEntries() {
        return this.config?.logging?.maxLogEntries || 100;
    }
}

// Export for use in other scripts
window.ConfigManager = ConfigManager;