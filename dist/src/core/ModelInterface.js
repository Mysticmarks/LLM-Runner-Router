/**
 * 🎭 Universal Model Interface
 * The quantum blueprint all models must embody
 * Echo AI Systems - Where models learn to dance
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';

const logger = new Logger('ModelInterface');

/**
 * Abstract Model Interface - The DNA of every model
 * All models, regardless of format, must implement this interface
 */
class ModelInterface extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Core identification
    this.id = config.id || this.generateId();
    this.name = config.name || 'unknown-model';
    this.version = config.version || '1.0.0';
    this.format = config.format || 'unknown';
    
    // Model characteristics
    this.architecture = config.architecture || {};
    this.parameters = config.parameters || {};
    this.metadata = config.metadata || {};
    
    // Runtime state
    this.loaded = false;
    this.loading = false;
    this.error = null;
    
    // Performance metrics
    this.metrics = {
      loadTime: null,
      inferenceCount: 0,
      totalTokens: 0,
      avgLatency: 0,
      lastUsed: null
    };
    
    // Capabilities
    this.capabilities = {
      streaming: false,
      batching: false,
      quantization: false,
      embedding: false,
      completion: true,
      ...config.capabilities
    };
    
    logger.debug(`🎨 Model interface created: ${this.name}`);
  }

  /**
   * Load model into memory
   * @abstract
   */
  async load() {
    throw new Error('load() must be implemented by subclass');
  }

  /**
   * Unload model from memory
   * @abstract
   */
  async unload() {
    throw new Error('unload() must be implemented by subclass');
  }

  /**
   * Generate completion from prompt
   * @abstract
   * @param {string} prompt - Input text
   * @param {object} options - Generation options
   */
  async generate(prompt, options = {}) {
    throw new Error('generate() must be implemented by subclass');
  }

  /**
   * Stream tokens in real-time
   * @abstract
   * @param {string} prompt - Input text
   * @param {object} options - Streaming options
   */
  async *stream(prompt, options = {}) {
    yield; // Required yield for generator
    throw new Error('stream() must be implemented by subclass');
  }

  /**
   * Generate embeddings
   * @abstract
   * @param {string|array} input - Text or texts to embed
   */
  async embed(input) {
    throw new Error('embed() must be implemented by subclass');
  }

  /**
   * Tokenize input text
   * @abstract
   * @param {string} text - Text to tokenize
   */
  async tokenize(text) {
    throw new Error('tokenize() must be implemented by subclass');
  }

  /**
   * Decode tokens to text
   * @abstract
   * @param {array} tokens - Token array
   */
  async detokenize(tokens) {
    throw new Error('detokenize() must be implemented by subclass');
  }

  /**
   * Validate model integrity
   */
  async validate() {
    logger.debug(`🔍 Validating model: ${this.name}`);
    
    // Check required properties
    if (!this.id || !this.name) {
      throw new Error('Model missing required identification');
    }
    
    // Check capabilities match implementation
    if (this.capabilities.streaming && !this.stream) {
      throw new Error('Model claims streaming but lacks implementation');
    }
    
    if (this.capabilities.embedding && !this.embed) {
      throw new Error('Model claims embedding but lacks implementation');
    }
    
    this.emit('validated', this);
    return true;
  }

  /**
   * Get model information
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      format: this.format,
      architecture: this.architecture,
      parameters: this.parameters,
      capabilities: this.capabilities,
      loaded: this.loaded,
      metrics: this.metrics
    };
  }

  /**
   * Update metrics after inference
   * @protected
   */
  updateMetrics(startTime, tokensGenerated) {
    const latency = Date.now() - startTime;
    
    this.metrics.inferenceCount++;
    this.metrics.totalTokens += tokensGenerated;
    this.metrics.avgLatency = (
      (this.metrics.avgLatency * (this.metrics.inferenceCount - 1) + latency) /
      this.metrics.inferenceCount
    );
    this.metrics.lastUsed = new Date();
    
    this.emit('metrics', this.metrics);
  }

  /**
   * Generate unique model ID
   * @private
   */
  generateId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `model_${timestamp}_${random}`;
  }

  /**
   * Calculate memory footprint
   */
  getMemoryUsage() {
    // Override in subclasses for accurate measurement
    return {
      estimated: this.parameters.size || 0,
      actual: 0
    };
  }

  /**
   * Optimize model for inference
   */
  async optimize(options = {}) {
    logger.info(`⚡ Optimizing model: ${this.name}`, options);
    
    // Base optimization - subclasses should override
    if (options.quantization && this.capabilities.quantization) {
      await this.quantize(options.quantization);
    }
    
    this.emit('optimized', options);
    return this;
  }

  /**
   * Quantize model weights
   * @protected
   */
  async quantize(level) {
    // Override in subclasses that support quantization
    logger.warn(`⚠️ Quantization not implemented for ${this.format}`);
  }

  /**
   * Clone model configuration
   */
  clone() {
    const ClonedClass = this.constructor;
    return new ClonedClass({
      ...this.getInfo(),
      id: this.generateId() // New ID for clone
    });
  }

  /**
   * Serialize model state
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      format: this.format,
      architecture: this.architecture,
      parameters: this.parameters,
      metadata: this.metadata,
      capabilities: this.capabilities,
      metrics: this.metrics
    };
  }

  /**
   * Restore from serialized state
   */
  static fromJSON(json) {
    return new ModelInterface(json);
  }

  /**
   * Check if model supports a capability
   */
  supports(capability) {
    return this.capabilities[capability] === true;
  }

  /**
   * Set model configuration
   */
  configure(config) {
    Object.assign(this.parameters, config);
    this.emit('configured', config);
    return this;
  }

  /**
   * Warmup model with sample inference
   */
  async warmup() {
    logger.debug(`🔥 Warming up model: ${this.name}`);
    
    try {
      const sample = 'Hello, world!';
      await this.generate(sample, { maxTokens: 1 });
      logger.debug(`✅ Model warmed up: ${this.name}`);
    } catch (error) {
      logger.warn(`⚠️ Warmup failed for ${this.name}:`, error);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    logger.debug(`🧹 Cleaning up model: ${this.name}`);
    
    if (this.loaded) {
      await this.unload();
    }
    
    this.removeAllListeners();
    this.metrics = null;
    this.error = null;
    
    logger.debug(`✅ Model cleaned up: ${this.name}`);
  }
}

/**
 * Model capability flags
 */
export const Capabilities = {
  STREAMING: 'streaming',
  BATCHING: 'batching',
  QUANTIZATION: 'quantization',
  EMBEDDING: 'embedding',
  COMPLETION: 'completion',
  CHAT: 'chat',
  FUNCTION_CALLING: 'functionCalling',
  VISION: 'vision',
  AUDIO: 'audio',
  VIDEO: 'video'
};

/**
 * Model formats
 */
export const ModelFormats = {
  GGUF: 'gguf',
  GGML: 'ggml',
  ONNX: 'onnx',
  SAFETENSORS: 'safetensors',
  PYTORCH: 'pytorch',
  TENSORFLOW: 'tensorflow',
  TENSORFLOWJS: 'tensorflowjs',
  HUGGINGFACE: 'huggingface',
  CUSTOM: 'custom'
};

/**
 * Model architectures
 */
export const Architectures = {
  TRANSFORMER: 'transformer',
  LLAMA: 'llama',
  GPT: 'gpt',
  BERT: 'bert',
  T5: 't5',
  MISTRAL: 'mistral',
  MIXTRAL: 'mixtral',
  QWEN: 'qwen',
  PHI: 'phi',
  GEMMA: 'gemma',
  CUSTOM: 'custom'
};



export default ModelInterface;
export { ModelInterface };
