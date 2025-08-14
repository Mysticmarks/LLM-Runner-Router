/**
 * 🎨 Model-specific Chat Templates
 * Automatically provides the correct template for each model type
 */

export class ModelTemplates {
    static templates = {
        // Llama family templates
        llama: {
            name: 'Llama',
            systemPrefix: '[INST] <<SYS>>\n',
            systemSuffix: '\n<</SYS>>\n\n',
            userPrefix: '[INST] ',
            userSuffix: ' [/INST]',
            assistantPrefix: ' ',
            assistantSuffix: ' </s>',
            messageSeparator: ' ',
            stopSequences: ['[INST]', '</s>'],
            description: 'Llama 2 instruction format'
        },
        
        // Alpaca/Vicuna style
        alpaca: {
            name: 'Alpaca',
            systemPrefix: '',
            systemSuffix: '\n\n',
            userPrefix: '### Instruction:\n',
            userSuffix: '\n\n',
            assistantPrefix: '### Response:\n',
            assistantSuffix: '\n\n',
            messageSeparator: '',
            stopSequences: ['### Instruction:', '### Response:'],
            description: 'Alpaca/Vicuna instruction format'
        },
        
        // ChatML format (used by many models)
        chatml: {
            name: 'ChatML',
            systemPrefix: '<|im_start|>system\n',
            systemSuffix: '<|im_end|>\n',
            userPrefix: '<|im_start|>user\n',
            userSuffix: '<|im_end|>\n',
            assistantPrefix: '<|im_start|>assistant\n',
            assistantSuffix: '<|im_end|>\n',
            messageSeparator: '',
            stopSequences: ['<|im_end|>', '<|im_start|>'],
            description: 'ChatML format (OpenAI style)'
        },
        
        // Mistral/Mixtral format
        mistral: {
            name: 'Mistral',
            systemPrefix: '<s>[INST] ',
            systemSuffix: '\n\n',
            userPrefix: '[INST] ',
            userSuffix: ' [/INST]',
            assistantPrefix: ' ',
            assistantSuffix: '</s>',
            messageSeparator: ' ',
            stopSequences: ['[INST]', '</s>'],
            description: 'Mistral instruction format'
        },
        
        // Phi format
        phi: {
            name: 'Phi',
            systemPrefix: 'Instruct: ',
            systemSuffix: '\n',
            userPrefix: 'Instruct: ',
            userSuffix: '\n',
            assistantPrefix: 'Output: ',
            assistantSuffix: '\n',
            messageSeparator: '\n',
            stopSequences: ['Instruct:', '<|endoftext|>'],
            description: 'Microsoft Phi format'
        },
        
        // TinyLlama format
        tinyllama: {
            name: 'TinyLlama',
            systemPrefix: '<|system|>\n',
            systemSuffix: '</s>\n',
            userPrefix: '<|user|>\n',
            userSuffix: '</s>\n',
            assistantPrefix: '<|assistant|>\n',
            assistantSuffix: '</s>\n',
            messageSeparator: '',
            stopSequences: ['</s>', '<|user|>'],
            description: 'TinyLlama chat format'
        },
        
        // CodeLlama format
        codellama: {
            name: 'CodeLlama',
            systemPrefix: '[INST] <<SYS>>\nYou are a helpful coding assistant.\n<</SYS>>\n\n',
            systemSuffix: '',
            userPrefix: '[INST] ',
            userSuffix: ' [/INST]\n',
            assistantPrefix: '',
            assistantSuffix: '\n',
            messageSeparator: '',
            stopSequences: ['[INST]', '</s>'],
            description: 'CodeLlama instruction format'
        },
        
        // Orca format
        orca: {
            name: 'Orca',
            systemPrefix: '### System:\n',
            systemSuffix: '\n\n',
            userPrefix: '### User:\n',
            userSuffix: '\n\n',
            assistantPrefix: '### Assistant:\n',
            assistantSuffix: '\n\n',
            messageSeparator: '',
            stopSequences: ['### User:', '### Assistant:'],
            description: 'Orca instruction format'
        },
        
        // Wizard format
        wizard: {
            name: 'Wizard',
            systemPrefix: '',
            systemSuffix: '\n\n',
            userPrefix: 'USER: ',
            userSuffix: '\n',
            assistantPrefix: 'ASSISTANT: ',
            assistantSuffix: '\n',
            messageSeparator: '',
            stopSequences: ['USER:', 'ASSISTANT:'],
            description: 'Wizard model format'
        },
        
        // StableLM format
        stablelm: {
            name: 'StableLM',
            systemPrefix: '<|SYSTEM|>',
            systemSuffix: '\n',
            userPrefix: '<|USER|>',
            userSuffix: '\n',
            assistantPrefix: '<|ASSISTANT|>',
            assistantSuffix: '\n',
            messageSeparator: '',
            stopSequences: ['<|USER|>', '<|ENDOFTEXT|>'],
            description: 'StableLM instruction format'
        },
        
        // Default/Generic format
        default: {
            name: 'Default',
            systemPrefix: 'System: ',
            systemSuffix: '\n\n',
            userPrefix: 'User: ',
            userSuffix: '\n\n',
            assistantPrefix: 'Assistant: ',
            assistantSuffix: '\n\n',
            messageSeparator: '',
            stopSequences: ['User:', 'Human:'],
            description: 'Generic chat format'
        }
    };

    /**
     * Model ID to template mapping
     */
    static modelMappings = {
        // Specific model mappings
        'tinyllama-1.1b': 'tinyllama',
        'tinyllama-1.1b-chat': 'tinyllama',
        'phi-2': 'phi',
        'phi-3': 'phi',
        'mistral-7b-instruct': 'mistral',
        'mixtral-8x7b': 'mistral',
        'llama-2-7b-chat': 'llama',
        'llama-2-13b-chat': 'llama',
        'llama-2-70b-chat': 'llama',
        'codellama-7b': 'codellama',
        'codellama-13b': 'codellama',
        'codellama-34b': 'codellama',
        'wizard-vicuna-7b': 'wizard',
        'wizard-vicuna-13b': 'wizard',
        'wizardlm': 'wizard',
        'orca-mini-3b': 'orca',
        'orca-2': 'orca',
        'stablelm-3b': 'stablelm',
        'stablelm-2': 'stablelm',
        'vicuna': 'alpaca',
        'alpaca': 'alpaca',
        
        // Pattern-based mappings (checked if exact match not found)
        patterns: [
            { pattern: /tinyllama/i, template: 'tinyllama' },
            { pattern: /phi-?\d/i, template: 'phi' },
            { pattern: /mistral|mixtral/i, template: 'mistral' },
            { pattern: /llama-?2/i, template: 'llama' },
            { pattern: /llama-?3/i, template: 'llama' },
            { pattern: /codellama/i, template: 'codellama' },
            { pattern: /wizard/i, template: 'wizard' },
            { pattern: /orca/i, template: 'orca' },
            { pattern: /stable-?lm/i, template: 'stablelm' },
            { pattern: /vicuna/i, template: 'alpaca' },
            { pattern: /alpaca/i, template: 'alpaca' },
            { pattern: /chatml|openai/i, template: 'chatml' }
        ]
    };

    /**
     * Get the appropriate template for a model
     */
    static getTemplateForModel(modelId, modelName = '') {
        if (!modelId && !modelName) {
            return this.templates.default;
        }

        // Normalize the model ID
        const normalizedId = modelId.toLowerCase().replace(/[._]/g, '-');
        
        // Check exact mapping first
        if (this.modelMappings[normalizedId]) {
            return this.templates[this.modelMappings[normalizedId]];
        }

        // Check pattern-based mappings
        const combinedName = `${modelId} ${modelName}`.toLowerCase();
        for (const { pattern, template } of this.modelMappings.patterns) {
            if (pattern.test(combinedName)) {
                return this.templates[template];
            }
        }

        // Default fallback
        return this.templates.default;
    }

    /**
     * Format a conversation using the model's template
     */
    static formatConversation(messages, modelId, modelName = '') {
        const template = this.getTemplateForModel(modelId, modelName);
        let formatted = '';

        for (const message of messages) {
            switch (message.role) {
                case 'system':
                    formatted += template.systemPrefix + message.content + template.systemSuffix;
                    break;
                case 'user':
                    formatted += template.userPrefix + message.content + template.userSuffix;
                    break;
                case 'assistant':
                    formatted += template.assistantPrefix + message.content + template.assistantSuffix;
                    break;
            }
            formatted += template.messageSeparator;
        }

        return formatted;
    }

    /**
     * Get all available templates
     */
    static getAllTemplates() {
        return Object.entries(this.templates).map(([key, template]) => ({
            id: key,
            ...template
        }));
    }

    /**
     * Add or update a custom template
     */
    static addCustomTemplate(id, template) {
        this.templates[id] = {
            ...template,
            custom: true
        };
    }

    /**
     * Add model mapping
     */
    static addModelMapping(modelId, templateId) {
        const normalizedId = modelId.toLowerCase().replace(/[._]/g, '-');
        this.modelMappings[normalizedId] = templateId;
    }
}

export default ModelTemplates;