/**
 * 🎨 Client-side Model Template Mappings
 * Automatically selects the correct chat template for each model
 */

const ModelTemplates = {
    // Template definitions
    templates: {
        tinyllama: {
            name: 'TinyLlama',
            systemPrefix: '<|system|>\n',
            userPrefix: '<|user|>\n',
            assistantPrefix: '<|assistant|>\n',
            messageSeparator: '</s>\n',
            stopSequences: '</s>, <|user|>'
        },
        
        phi: {
            name: 'Phi',
            systemPrefix: 'Instruct: ',
            userPrefix: 'Instruct: ',
            assistantPrefix: 'Output: ',
            messageSeparator: '\n',
            stopSequences: 'Instruct:, <|endoftext|>'
        },
        
        mistral: {
            name: 'Mistral',
            systemPrefix: '<s>[INST] ',
            userPrefix: '[INST] ',
            assistantPrefix: '[/INST] ',
            messageSeparator: '</s> ',
            stopSequences: '[INST], </s>'
        },
        
        llama: {
            name: 'Llama 2',
            systemPrefix: '[INST] <<SYS>>\n',
            userPrefix: '[INST] ',
            assistantPrefix: '[/INST] ',
            messageSeparator: ' </s>',
            stopSequences: '[INST], </s>'
        },
        
        codellama: {
            name: 'CodeLlama',
            systemPrefix: '[INST] <<SYS>>\nYou are a helpful coding assistant.\n<</SYS>>\n\n',
            userPrefix: '[INST] ',
            assistantPrefix: '[/INST]\n',
            messageSeparator: '\n',
            stopSequences: '[INST], </s>'
        },
        
        alpaca: {
            name: 'Alpaca',
            systemPrefix: '',
            userPrefix: '### Instruction:\n',
            assistantPrefix: '### Response:\n',
            messageSeparator: '\n\n',
            stopSequences: '### Instruction:, ### Response:'
        },
        
        vicuna: {
            name: 'Vicuna',
            systemPrefix: '',
            userPrefix: 'USER: ',
            assistantPrefix: 'ASSISTANT: ',
            messageSeparator: '\n',
            stopSequences: 'USER:, ASSISTANT:'
        },
        
        wizard: {
            name: 'Wizard',
            systemPrefix: '',
            userPrefix: 'USER: ',
            assistantPrefix: 'ASSISTANT: ',
            messageSeparator: '\n',
            stopSequences: 'USER:, ASSISTANT:'
        },
        
        orca: {
            name: 'Orca',
            systemPrefix: '### System:\n',
            userPrefix: '### User:\n',
            assistantPrefix: '### Assistant:\n',
            messageSeparator: '\n\n',
            stopSequences: '### User:, ### Assistant:'
        },
        
        stablelm: {
            name: 'StableLM',
            systemPrefix: '<|SYSTEM|>',
            userPrefix: '<|USER|>',
            assistantPrefix: '<|ASSISTANT|>',
            messageSeparator: '\n',
            stopSequences: '<|USER|>, <|ENDOFTEXT|>'
        },
        
        chatml: {
            name: 'ChatML',
            systemPrefix: '<|im_start|>system\n',
            userPrefix: '<|im_start|>user\n',
            assistantPrefix: '<|im_start|>assistant\n',
            messageSeparator: '<|im_end|>\n',
            stopSequences: '<|im_end|>, <|im_start|>'
        },
        
        default: {
            name: 'Default',
            systemPrefix: '### System:\n',
            userPrefix: '### User:\n',
            assistantPrefix: '### Assistant:\n',
            messageSeparator: '\n\n',
            stopSequences: '### User:, ### System:'
        }
    },

    // Model to template mappings
    modelMappings: {
        // Exact model ID mappings
        'tinyllama-1.1b': 'tinyllama',
        'tinyllama-1.1b-chat': 'tinyllama',
        'tinyllama-1.1b-chat-v1.0.Q4_K_M': 'tinyllama',
        'phi-2': 'phi',
        'phi-2.Q4_K_M': 'phi',
        'phi-3': 'phi',
        'mistral-7b-instruct': 'mistral',
        'mistral-7b-instruct-v0.2.Q4_K_M': 'mistral',
        'mixtral-8x7b': 'mistral',
        'llama-2-7b-chat': 'llama',
        'llama-2-7b-chat.Q4_K_M': 'llama',
        'llama-2-13b-chat': 'llama',
        'codellama-7b': 'codellama',
        'codellama-7b.Q4_K_M': 'codellama',
        'wizard-vicuna-7b': 'wizard',
        'wizard-vicuna-7b-uncensored.Q4_K_M': 'wizard',
        'wizardlm': 'wizard',
        'orca-mini-3b': 'orca',
        'orca-mini-3b.q4_K_M': 'orca',
        'orca-2': 'orca',
        'stablelm-3b': 'stablelm',
        'stablelm-3b-4e1t.Q4_K_M': 'stablelm',
        'vicuna': 'vicuna',
        'alpaca': 'alpaca'
    },

    /**
     * Get the appropriate template for a model
     */
    getTemplateForModel(modelId, modelName = '') {
        if (!modelId) return this.templates.default;

        // Check exact mapping first
        const normalizedId = modelId.toLowerCase().replace(/[._]/g, '-');
        if (this.modelMappings[normalizedId]) {
            return this.templates[this.modelMappings[normalizedId]];
        }

        // Check pattern matching
        const combinedName = `${modelId} ${modelName}`.toLowerCase();
        
        if (combinedName.includes('tinyllama')) return this.templates.tinyllama;
        if (combinedName.includes('phi')) return this.templates.phi;
        if (combinedName.includes('mistral') || combinedName.includes('mixtral')) return this.templates.mistral;
        if (combinedName.includes('llama-2') || combinedName.includes('llama2')) return this.templates.llama;
        if (combinedName.includes('codellama')) return this.templates.codellama;
        if (combinedName.includes('wizard')) return this.templates.wizard;
        if (combinedName.includes('orca')) return this.templates.orca;
        if (combinedName.includes('stable') && combinedName.includes('lm')) return this.templates.stablelm;
        if (combinedName.includes('vicuna')) return this.templates.vicuna;
        if (combinedName.includes('alpaca')) return this.templates.alpaca;
        if (combinedName.includes('chatml') || combinedName.includes('openai')) return this.templates.chatml;

        // Default fallback
        return this.templates.default;
    },

    /**
     * Get template ID for a model
     */
    getTemplateIdForModel(modelId, modelName = '') {
        const normalizedId = modelId.toLowerCase().replace(/[._]/g, '-');
        
        // Check exact mapping
        if (this.modelMappings[normalizedId]) {
            return this.modelMappings[normalizedId];
        }

        // Check patterns
        const combinedName = `${modelId} ${modelName}`.toLowerCase();
        
        if (combinedName.includes('tinyllama')) return 'tinyllama';
        if (combinedName.includes('phi')) return 'phi';
        if (combinedName.includes('mistral') || combinedName.includes('mixtral')) return 'mistral';
        if (combinedName.includes('llama-2') || combinedName.includes('llama2')) return 'llama';
        if (combinedName.includes('codellama')) return 'codellama';
        if (combinedName.includes('wizard')) return 'wizard';
        if (combinedName.includes('orca')) return 'orca';
        if (combinedName.includes('stable') && combinedName.includes('lm')) return 'stablelm';
        if (combinedName.includes('vicuna')) return 'vicuna';
        if (combinedName.includes('alpaca')) return 'alpaca';
        if (combinedName.includes('chatml') || combinedName.includes('openai')) return 'chatml';

        return 'default';
    },

    /**
     * Get all templates for dropdown
     */
    getAllTemplates() {
        return Object.entries(this.templates).map(([id, template]) => ({
            id,
            ...template
        }));
    }
};

// Make it available globally
window.ModelTemplates = ModelTemplates;