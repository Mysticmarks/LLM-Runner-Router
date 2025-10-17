/**
 * 🏠 Local SmolLM3-3B Loader - COMPLETELY LOCAL INFERENCE
 * 
 * Loads and runs inference on local SmolLM3-3B safetensors files
 * No CDN, no external dependencies, 100% local inference
 * 
 * Model files expected in: models/smollm3-3b/
 * - config.json
 * - tokenizer.json
 * - tokenizer_config.json
 * - model-00001-of-00002.safetensors
 * - model-00002-of-00002.safetensors
 * - model.safetensors.index.json
 */

import { BaseLoader } from './BaseLoader.js';
import { Logger } from '../utils/Logger.js';
import { pipeline, AutoTokenizer, AutoModelForCausalLM } from '@xenova/transformers';
import path from 'path';
import fs from 'fs';

const logger = new Logger('LocalSmolLM3Loader');

class LocalSmolLM3Loader extends BaseLoader {
  constructor() {
    super();
    this.name = 'LocalSmolLM3Loader';
    this.format = 'safetensors';
    this.modelPath = path.resolve('./models/smollm3-3b');
    this.loadedModels = new Map();
    
    // SmolLM3 chat template
    this.chatTemplate = {
      system: "<|system|>\n{content}<|end|>\n",
      user: "<|user|>\n{content}<|end|>\n", 
      assistant: "<|assistant|>\n{content}<|end|>\n",
      start: "<|assistant|>\n"
    };
    
    // Project-specific system prompt
    this.systemPrompt = `You are SmolLM3, running locally on the LLM Runner Router. This is a universal LLM orchestration system that provides format-agnostic model loading and intelligent routing.

Key features:
- Local model inference (no external APIs)
- Safetensors format support
- Real-time streaming responses
- Zero external dependencies

You are currently running completely locally from safetensors files. Respond helpfully about local AI deployment, model optimization, and the LLM Router architecture.`;
  }

  /**
   * Check if this loader supports the given source
   */
  supports(source) {
    return typeof source === 'string' && 
           (source.includes('smollm3') || 
            source.includes('SmolLM3') ||
            source === 'local-smollm3' ||
            source.startsWith('file://'));
  }

  /**
   * Validate local model files exist
   */
  async validateLocalModel() {
    const requiredFiles = [
      'config.json',
      'tokenizer.json', 
      'tokenizer_config.json',
      'model-00001-of-00002.safetensors',
      'model-00002-of-00002.safetensors',
      'model.safetensors.index.json'
    ];
    
    logger.info(`🔍 Validating local model files in: ${this.modelPath}`);
    
    if (!fs.existsSync(this.modelPath)) {
      throw new Error(`Model directory not found: ${this.modelPath}`);
    }
    
    const missingFiles = [];
    for (const file of requiredFiles) {
      const filePath = path.join(this.modelPath, file);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(file);
      } else {
        const stats = fs.statSync(filePath);
        logger.info(`✅ ${file} (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
      }
    }
    
    if (missingFiles.length > 0) {
      throw new Error(`Missing required model files: ${missingFiles.join(', ')}`);
    }
    
    logger.success(`✅ All SmolLM3-3B model files validated`);
    return true;
  }

  /**
   * Load the local SmolLM3-3B model
   */
  async load(config = {}) {
    const modelId = config.id || 'local-smollm3-3b';
    
    logger.info(`🏠 Loading LOCAL SmolLM3-3B model: ${modelId}`);
    logger.info(`📁 Model path: ${this.modelPath}`);
    
    try {
      // Validate model files exist
      await this.validateLocalModel();
      
      // Load tokenizer from local files
      logger.info('📝 Loading local tokenizer...');
      const tokenizer = await AutoTokenizer.from_pretrained(this.modelPath, {
        local_files_only: true,
        use_fast: true
      });
      logger.success('✅ Tokenizer loaded from local files');
      
      // Load model from local safetensors files
      logger.info('🧠 Loading local SmolLM3 model (this may take a moment)...');
      const model = await AutoModelForCausalLM.from_pretrained(this.modelPath, {
        local_files_only: true,
        dtype: 'fp32', // Use fp32 for better compatibility
        device: 'cpu'
      });
      logger.success('✅ SmolLM3 model loaded from local safetensors files');
      
      // Create model interface
      const localModel = {
        id: modelId,
        name: 'SmolLM3-3B Local',
        format: 'safetensors',
        loader: 'LocalSmolLM3Loader',
        path: this.modelPath,
        loaded: true,
        isLocal: true,
        
        // Text generation method
        predict: async (input, options = {}) => {
          return this.generateText(tokenizer, model, input, options);
        },
        
        // Chat method with proper templates
        chat: async (messages, options = {}) => {
          return this.generateChat(tokenizer, model, messages, options);
        },
        
        // Streaming not implemented yet
          stream: async function* () {
            yield* [];
            throw new Error('Streaming not yet implemented for local SafeTensors models');
          },
        
        // Cleanup method
        unload: () => {
          this.loadedModels.delete(modelId);
          logger.info(`🗑️ Unloaded local model: ${modelId}`);
        },
        
        // JSON serialization
        toJSON: () => ({
          id: modelId,
          name: 'SmolLM3-3B Local',
          format: 'safetensors',
          loader: 'LocalSmolLM3Loader',
          path: this.modelPath,
          isLocal: true
        })
      };
      
      this.loadedModels.set(modelId, { tokenizer, model, config: localModel });
      logger.success(`🎉 LOCAL SmolLM3-3B ready for inference: ${modelId}`);
      
      return localModel;
      
    } catch (error) {
      logger.error(`❌ Failed to load local SmolLM3 model: ${error.message}`);
      
      if (error.message.includes('Missing required model files')) {
        logger.info('\n📥 To download SmolLM3-3B model files:');
        logger.info('1. pip install huggingface_hub');
        logger.info('2. huggingface-cli download HuggingFaceTB/SmolLM3-3B-Base --local-dir ./models/smollm3-3b');
      }
      
      throw new Error(`Local model loading failed: ${error.message}`);
    }
  }

  /**
   * Generate text using local model
   */
  async generateText(tokenizer, model, input, options = {}) {
    const startTime = Date.now();
    
    try {
      // Format input with chat template
      const formattedInput = this.formatChatInput(input, options.useSystemPrompt !== false);
      
      logger.info(`🤖 Generating response for: "${input.substring(0, 50)}..."`);
      
      // Tokenize input
      const inputs = await tokenizer(formattedInput, {
        return_tensors: 'pt',
        truncation: true,
        max_length: options.maxInputLength || 4096
      });
      
      // Generate with local model
      const outputs = await model.generate({
        ...inputs,
        max_new_tokens: options.maxTokens || 100,
        temperature: options.temperature || 0.7,
        do_sample: options.temperature > 0,
        top_p: options.topP || 0.9,
        top_k: options.topK || 50,
        repetition_penalty: options.repetitionPenalty || 1.1,
        pad_token_id: tokenizer.eos_token_id
      });
      
      // Decode response
      const responseTokens = outputs[0].slice(inputs.input_ids[0].length);
      const generatedText = tokenizer.decode(responseTokens, {
        skip_special_tokens: true
      });
      
      const inferenceTime = Date.now() - startTime;
      logger.success(`✅ Local inference completed in ${inferenceTime}ms`);
      
      return {
        text: generatedText.trim(),
        response: generatedText.trim(),
        inference_time_ms: inferenceTime,
        tokens: responseTokens.length,
        isLocal: true,
        model: 'SmolLM3-3B Local'
      };
      
    } catch (error) {
      logger.error(`❌ Local generation failed: ${error.message}`);
      throw new Error(`Local inference failed: ${error.message}`);
    }
  }

  /**
   * Generate chat response using local model
   */
  async generateChat(tokenizer, model, messages, options = {}) {
    // Format messages into chat template
    const formattedInput = this.formatMessages(messages);
    
    // Use the text generation method
    return this.generateText(tokenizer, model, formattedInput, options);
  }

  /**
   * Format input with SmolLM3 chat template
   */
  formatChatInput(input, includeSystem = true) {
    let formatted = '';
    
    // Add system prompt if requested
    if (includeSystem) {
      formatted += this.chatTemplate.system.replace('{content}', this.systemPrompt);
    }
    
    // Add user input
    formatted += this.chatTemplate.user.replace('{content}', input);
    
    // Start assistant response
    formatted += this.chatTemplate.start;
    
    return formatted;
  }

  /**
   * Format messages for chat conversation
   */
  formatMessages(messages) {
    let formatted = this.chatTemplate.system.replace('{content}', this.systemPrompt);
    
    for (const message of messages) {
      const role = message.role || 'user';
      const content = message.content || message;
      
      if (role === 'user') {
        formatted += this.chatTemplate.user.replace('{content}', content);
      } else if (role === 'assistant') {
        formatted += this.chatTemplate.assistant.replace('{content}', content);
      }
    }
    
    // Start new assistant response
    formatted += this.chatTemplate.start;
    
    return formatted;
  }

  /**
   * Unload model from memory
   */
  async unload(modelId) {
    if (this.loadedModels.has(modelId)) {
      this.loadedModels.delete(modelId);
      logger.info(`🗑️ Unloaded local model: ${modelId}`);
    }
  }

  /**
   * Get model info
   */
  async getModelInfo() {
    try {
      await this.validateLocalModel();
      
      const configPath = path.join(this.modelPath, 'config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      return {
        name: 'SmolLM3-3B Local',
        path: this.modelPath,
        format: 'safetensors',
        parameters: '3B',
        architecture: config.architectures[0],
        vocab_size: config.vocab_size,
        hidden_size: config.hidden_size,
        num_layers: config.num_hidden_layers,
        isLocal: true
      };
    } catch (error) {
      throw new Error(`Cannot get model info: ${error.message}`);
    }
  }
}

export default LocalSmolLM3Loader;