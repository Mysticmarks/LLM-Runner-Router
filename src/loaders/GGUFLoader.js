/**
 * 🧠 GGUF Model Loader - Production Implementation
 * Real inference using node-llama-cpp v3
 */

import { ModelInterface } from '../core/ModelInterface.js';
import { Logger } from '../utils/Logger.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

// Make node-llama-cpp optional
let getLlama, LlamaChatSession;
try {
  const llamaCpp = await import('node-llama-cpp');
  getLlama = llamaCpp.getLlama;
  LlamaChatSession = llamaCpp.LlamaChatSession;
} catch (error) {
  console.warn('node-llama-cpp not available - GGUF models will not be functional');
}

const logger = new Logger('GGUFLoader');

/**
 * GGUF Model - Production implementation with real inference
 */
class GGUFModel extends ModelInterface {
  constructor(config) {
    super(config);
    this.format = 'gguf';
    this.source = config.source || config.path; // Store the model path
    this.model = null;
    this.context = null;
    this.session = null;
    this.llama = null;
    
    // CPU optimization settings
    this.maxThreads = parseInt(config.maxThreads || process.env.LLM_MAX_THREADS || 2);
    this.contextSize = parseInt(config.contextSize || process.env.LLM_CONTEXT_SIZE || 2048);
    this.batchSize = parseInt(config.batchSize || process.env.LLM_BATCH_SIZE || 8);
  }

  /**
   * Load the GGUF model with CPU optimization for VPS environments
   * 
   * @example
   * // Basic model loading
   * const model = new GGUFModel({ source: './models/llama-7b-q4_k_m.gguf' });
   * await model.load();
   * 
   * @example
   * // Load with custom CPU settings for VPS
   * const model = new GGUFModel({
   *   source: './models/mistral-7b-q4_k_m.gguf',
   *   maxThreads: 2,        // Limit threads for VPS
   *   contextSize: 2048,    // Smaller context for memory efficiency
   *   batchSize: 8          // Smaller batch size for CPU
   * });
   * await model.load();
   * 
   * @example
   * // Load with error handling
   * try {
   *   const model = new GGUFModel({ source: './models/model.gguf' });
   *   await model.load();
   *   console.log('✅ Model loaded successfully');
   * } catch (error) {
   *   if (error.message.includes('node-llama-cpp')) {
   *     console.error('❌ node-llama-cpp dependency missing');
   *   } else {
   *     console.error('❌ Failed to load model:', error.message);
   *   }
   * }
   */
  async load() {
    if (this.loaded) return;
    
    logger.info(`🧠 Loading GGUF model: ${this.name}`);
    logger.info(`  Source path: ${this.source}`);
    this.loading = true;
    
    try {
      // Check if node-llama-cpp is available
      if (!getLlama) {
        throw new Error('node-llama-cpp is not installed. GGUF models require node-llama-cpp to function.');
      }
      
      // Get llama instance
      this.llama = await getLlama();
      
      // Resolve model path - handle both relative and absolute paths
      const modelPath = path.isAbsolute(this.source) 
        ? this.source 
        : path.resolve(process.cwd(), this.source);
      
      logger.info(`  Resolved path: ${modelPath}`);
      
      // Check if file exists
      await fs.access(modelPath);
      
      // Load the model
      this.model = await this.llama.loadModel({
        modelPath: modelPath,
        gpuLayers: 0 // CPU only for now, can be configured
      });
      
      // Create context with CPU optimization for VPS
      // Limit threads to leave headroom for system processes
      const cpuCount = (await import('os')).default.cpus().length;
      const optimalThreads = Math.max(1, Math.min(cpuCount - 1, this.maxThreads)); // Use configured max threads
      
      logger.info(`  CPU optimization: ${cpuCount} CPUs detected, using ${optimalThreads} threads`);
      
      this.context = await this.model.createContext({
        contextSize: this.contextSize,
        threads: optimalThreads,
        batchSize: this.batchSize // Smaller batch size for lower CPU usage
      });
      
      // Create a chat session
      this.session = new LlamaChatSession({
        contextSequence: this.context.getSequence(),
        systemPrompt: "You are a helpful AI assistant."
      });
      
      this.loaded = true;
      this.loading = false;
      this.metrics.loadTime = Date.now();
      
      logger.success(`✅ GGUF model loaded: ${this.name}`);
    } catch (error) {
      this.error = error;
      this.loading = false;
      logger.error(`Failed to load GGUF model: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate text response from a prompt with GGUF model
   * 
   * @param {string} prompt - Input text prompt
   * @param {object} options - Generation options
   * @returns {Promise<object>} Generation result with text, tokens, and metrics
   * 
   * @example
   * // Simple text generation
   * const result = await model.generate('Hello, how are you today?');
   * console.log(result.text);      // Generated response
   * console.log(result.tokens);    // Number of tokens
   * console.log(result.latency);   // Generation time in ms
   * 
   * @example
   * // Generation with custom parameters
   * const result = await model.generate('Explain quantum computing', {
   *   maxTokens: 300,        // Longer response
   *   temperature: 0.8,      // More creative
   *   topK: 50,             // Consider top 50 tokens
   *   topP: 0.95,           // Nucleus sampling
   *   repeatPenalty: 1.1,   // Reduce repetition
   *   stopStrings: ['\n\n', 'End'] // Stop generation at these strings
   * });
   * 
   * @example
   * // Track performance metrics
   * const startTime = Date.now();
   * const result = await model.generate('Write a short story');
   * console.log(`Generated ${result.tokens} tokens in ${result.latency}ms`);
   * console.log(`Tokens/sec: ${(result.tokens / result.latency * 1000).toFixed(2)}`);
   */
  async generate(prompt, options = {}) {
    if (!this.loaded) await this.load();
    
    const startTime = Date.now();
    
    try {
      // Update metrics
      this.metrics.inferenceCount++;
      this.metrics.lastUsed = new Date();
      
      // Generate response
      const response = await this.session.prompt(prompt, {
        maxTokens: options.maxTokens || 500,
        temperature: options.temperature || 0.7,
        topK: options.topK || 40,
        topP: options.topP || 0.95,
        repeatPenalty: options.repeatPenalty || 1.1,
        stopStrings: options.stopStrings || []
      });
      
      // Calculate metrics
      const endTime = Date.now();
      const latency = endTime - startTime;
      const tokens = response.split(/\s+/).length; // Approximate token count
      
      this.metrics.totalTokens += tokens;
      this.metrics.avgLatency = 
        (this.metrics.avgLatency * (this.metrics.inferenceCount - 1) + latency) / 
        this.metrics.inferenceCount;
      
      return {
        text: response,
        tokens,
        latency,
        model: this.name
      };
    } catch (error) {
      logger.error(`Generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stream text generation token by token
   * 
   * @param {string} prompt - Input text prompt
   * @param {object} options - Streaming options
   * @yields {string} Individual tokens as they're generated
   * 
   * @example
   * // Basic streaming
   * console.log('Streaming response:');
   * for await (const token of model.stream('Tell me about AI')) {
   *   process.stdout.write(token); // Real-time output
   * }
   * console.log('\n--- Streaming complete ---');
   * 
   * @example
   * // Streaming with options and token counting
   * let tokenCount = 0;
   * let fullResponse = '';
   * 
   * for await (const token of model.stream('Explain machine learning', {
   *   maxTokens: 200,
   *   temperature: 0.7,
   *   topP: 0.9
   * })) {
   *   fullResponse += token;
   *   tokenCount++;
   *   
   *   // Update UI or log progress
   *   if (tokenCount % 10 === 0) {
   *     console.log(`\n[${tokenCount} tokens generated so far...]`);
   *   }
   * }
   * 
   * console.log(`\nFinal response: ${fullResponse}`);
   * console.log(`Total tokens: ${tokenCount}`);
   * 
   * @example
   * // Streaming with error handling and timeout
   * const timeout = setTimeout(() => {
   *   console.log('Generation taking too long, may need to cancel');
   * }, 30000); // 30 second timeout
   * 
   * try {
   *   for await (const token of model.stream('Complex question here')) {
   *     process.stdout.write(token);
   *   }
   *   clearTimeout(timeout);
   * } catch (error) {
   *   clearTimeout(timeout);
   *   console.error('Streaming failed:', error.message);
   * }
   */
  async *stream(prompt, options = {}) {
    if (!this.loaded) await this.load();
    
    const startTime = Date.now();
    let totalTokens = 0;
    
    try {
      // Update metrics
      this.metrics.inferenceCount++;
      this.metrics.lastUsed = new Date();
      
      // Stream response tokens
      const stream = this.session.promptStream(prompt, {
        maxTokens: options.maxTokens || 500,
        temperature: options.temperature || 0.7,
        topK: options.topK || 40,
        topP: options.topP || 0.95,
        repeatPenalty: options.repeatPenalty || 1.1
      });
      
      for await (const chunk of stream) {
        totalTokens++;
        yield chunk;
      }
      
      // Update metrics
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      this.metrics.totalTokens += totalTokens;
      this.metrics.avgLatency = 
        (this.metrics.avgLatency * (this.metrics.inferenceCount - 1) + latency) / 
        this.metrics.inferenceCount;
      
    } catch (error) {
      logger.error(`Streaming failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Properly dispose of GGUF model and free all resources
   * 
   * @example
   * // Clean unload with verification
   * if (model.loaded) {
   *   await model.unload();
   *   console.log('📦 Model unloaded successfully');
   * }
   * 
   * @example
   * // Unload multiple models safely
   * const models = [model1, model2, model3];
   * await Promise.all(models.map(async (model) => {
   *   try {
   *     await model.unload();
   *     console.log(`Model ${model.name} unloaded`);
   *   } catch (error) {
   *     console.error(`Failed to unload ${model.name}:`, error.message);
   *   }
   * }));
   * 
   * @example
   * // Unload with cleanup verification
   * const memBefore = process.memoryUsage().heapUsed;
   * await model.unload();
   * 
   * // Force garbage collection if available
   * if (global.gc) {
   *   global.gc();
   * }
   * 
   * const memAfter = process.memoryUsage().heapUsed;
   * const memFreed = (memBefore - memAfter) / 1024 / 1024;
   * console.log(`Memory freed: ${memFreed.toFixed(2)} MB`);
   */
  async unload() {
    try {
      if (this.session) {
        this.session = null;
      }
      if (this.context) {
        await this.context.dispose();
        this.context = null;
      }
      if (this.model) {
        await this.model.dispose();
        this.model = null;
      }
      this.loaded = false;
      logger.info(`📦 GGUF model unloaded: ${this.name}`);
    } catch (error) {
      logger.error(`Cleanup failed: ${error.message}`);
    }
  }

  // Override toJSON to include source
  toJSON() {
    const json = super.toJSON();
    json.source = this.source;
    json.path = this.source; // Include both for compatibility
    return json;
  }
}

/**
 * GGUF Loader - The quantum gateway to quantized models
 */
class GGUFLoader {
  static format = 'gguf';
  static extensions = ['.gguf', '.ggml', '.bin'];

  /**
   * Check if a file path can be loaded by the GGUF loader
   * 
   * @param {string} path - File path to check
   * @returns {Promise<boolean>} Whether the file can be loaded
   * 
   * @example
   * // Check single file
   * if (await loader.canLoad('./models/llama-7b.gguf')) {
   *   console.log('✅ File can be loaded');
   *   await loader.load({ source: './models/llama-7b.gguf' });
   * }
   * 
   * @example
   * // Validate multiple model files
   * const modelPaths = [
   *   './models/llama-7b.gguf',
   *   './models/mistral-7b.ggml',
   *   './models/old-model.bin',
   *   './models/not-a-model.txt'
   * ];
   * 
   * for (const path of modelPaths) {
   *   const canLoad = await loader.canLoad(path);
   *   console.log(`${path}: ${canLoad ? '✅' : '❌'}`);
   * }
   * 
   * @example
   * // Dynamic model selection
   * const availableModels = await fs.readdir('./models');
   * const loadableModels = [];
   * 
   * for (const file of availableModels) {
   *   const fullPath = `./models/${file}`;
   *   if (await loader.canLoad(fullPath)) {
   *     loadableModels.push(fullPath);
   *   }
   * }
   * 
   * console.log(`Found ${loadableModels.length} loadable GGUF models`);
   */
  async canLoad(path) {
    const ext = path.split('.').pop().toLowerCase();
    return GGUFLoader.extensions.includes(`.${ext}`);
  }

  /**
   * Load a GGUF model with automatic configuration detection
   * 
   * @param {object} spec - Model specification
   * @returns {Promise<GGUFModel>} Loaded model instance
   * 
   * @example
   * // Load with minimal specification
   * const model = await loader.load({
   *   source: './models/llama-7b-q4_k_m.gguf'
   * });
   * 
   * @example
   * // Load with custom configuration
   * const model = await loader.load({
   *   id: 'my-custom-model',
   *   name: 'Custom Llama 7B',
   *   source: './models/llama-7b-q4_k_m.gguf',
   *   quantization: 'q4_k_m',
   *   context: 4096,
   *   immediate: true  // Load immediately
   * });
   * 
   * @example
   * // Load with VPS-optimized settings
   * const model = await loader.load({
   *   source: './models/mistral-7b.gguf',
   *   maxThreads: 2,     // Limit for VPS
   *   contextSize: 2048, // Smaller context
   *   batchSize: 8,      // CPU-friendly batch size
   *   immediate: false   // Defer loading until needed
   * });
   * 
   * // Load when ready to use
   * await model.load();
   * 
   * @example
   * // Batch loading multiple models
   * const specs = [
   *   { source: './models/llama-7b.gguf', name: 'Llama 7B' },
   *   { source: './models/mistral-7b.gguf', name: 'Mistral 7B' },
   *   { source: './models/codellama-7b.gguf', name: 'Code Llama 7B' }
   * ];
   * 
   * const models = await Promise.all(
   *   specs.map(spec => loader.load({ ...spec, immediate: false }))
   * );
   * 
   * console.log(`Loaded ${models.length} GGUF models`);
   */
  async load(spec) {
    logger.info(`🔮 Loading GGUF model from: ${spec.source}`);
    
    // Detect model properties
    const config = await this.detectConfig(spec);
    
    // Create model instance
    const model = new GGUFModel(config);
    
    // Load if immediate loading requested
    if (spec.immediate !== false) {
      await model.load();
    }
    
    return model;
  }

  async detectConfig(spec) {
    // Parse model name and properties from path/spec
    const config = {
      id: spec.id || this.generateId(),
      name: spec.name || this.extractName(spec.source),
      source: spec.source,
      quantization: spec.quantization || this.detectQuantization(spec.source || ''),
      context: spec.context || 2048
    };
    
    // Try to detect architecture
    if (spec.source && spec.source.includes('llama')) {
      config.architecture = { type: 'llama' };
    } else if (spec.source && spec.source.includes('mistral')) {
      config.architecture = { type: 'mistral' };
    }
    
    return config;
  }

  extractName(source) {
    // Extract name from path
    if (!source) return 'unknown';
    const parts = source.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace(/\.(gguf|ggml|bin)$/i, '');
  }

  detectQuantization(source) {
    // Detect quantization from filename
    if (!source) return 'q4_k_m';
    const quants = ['q4_0', 'q4_1', 'q4_k_m', 'q4_k_s', 'q5_0', 'q5_1', 'q5_k_m', 'q5_k_s', 'q8_0'];
    
    for (const q of quants) {
      if (source.includes(q)) return q;
    }
    
    return 'q4_k_m'; // default
  }

  async validate(model) {
    // Validate GGUF model
    if (!model.weights) {
      throw new Error('GGUF model missing weights');
    }
    
    if (!model.vocab) {
      throw new Error('GGUF model missing vocabulary');
    }
    
    return true;
  }

  async optimize(model, options) {
    // Optimize GGUF model
    if (options.quantization) {
      await this.requantize(model, options.quantization);
    }
    
    return model;
  }

  async requantize(model, level) {
    logger.info(`⚡ Requantizing model to ${level}`);
    // Implementation would convert between quantization levels
    model.quantization = level;
  }

  generateId() {
    return `gguf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Restore a GGUF model from saved data/configuration
   * 
   * @param {object} data - Saved model data
   * @returns {Promise<GGUFModel>} Restored model instance
   * 
   * @example
   * // Restore from saved configuration
   * const savedData = {
   *   id: 'llama-7b-model',
   *   name: 'Llama 7B Q4',
   *   source: './models/llama-7b-q4_k_m.gguf',
   *   quantization: 'q4_k_m',
   *   format: 'gguf'
   * };
   * 
   * const model = await loader.fromData(savedData);
   * await model.load(); // Load the restored model
   * 
   * @example
   * // Restore from registry export
   * const registry = JSON.parse(fs.readFileSync('./model-registry.json'));
   * const restoredModels = [];
   * 
   * for (const modelData of registry.models) {
   *   if (modelData.format === 'gguf') {
   *     const model = await loader.fromData(modelData);
   *     restoredModels.push(model);
   *   }
   * }
   * 
   * console.log(`Restored ${restoredModels.length} GGUF models from registry`);
   * 
   * @example
   * // Restore with error handling
   * try {
   *   const model = await loader.fromData(corruptedData);
   *   await model.load();
   *   console.log('Model restored and loaded successfully');
   * } catch (error) {
   *   console.error('Failed to restore model:', error.message);
   *   // Fall back to fresh loading
   *   const freshModel = await loader.load({
   *     source: corruptedData.source || corruptedData.path
   *   });
   * }
   */
  async fromData(data) {
    // Restore model from saved data with source path
    logger.info('Creating model from data:', data);
    const modelConfig = {
      ...data,
      source: data.source || data.path, // Handle both source and path fields
      format: 'gguf'
    };
    logger.info('Model config:', modelConfig);
    const model = new GGUFModel(modelConfig);
    return model;
  }
}

export default GGUFLoader;

