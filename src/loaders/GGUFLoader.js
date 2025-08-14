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
    this.maxThreads = config.maxThreads || process.env.LLM_MAX_THREADS || 2;
    this.contextSize = config.contextSize || process.env.LLM_CONTEXT_SIZE || 2048;
    this.batchSize = config.batchSize || process.env.LLM_BATCH_SIZE || 8;
  }

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
export class GGUFLoader {
  static format = 'gguf';
  static extensions = ['.gguf', '.ggml', '.bin'];

  async canLoad(path) {
    const ext = path.split('.').pop().toLowerCase();
    return GGUFLoader.extensions.includes(`.${ext}`);
  }

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
