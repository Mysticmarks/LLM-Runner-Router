/**
 * Base Engine Class
 * Abstract base class for all engine implementations
 * Ensures consistency across different compute backends
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';

export class BaseEngine extends EventEmitter {
  constructor(name = 'BaseEngine') {
    super();
    this.name = name;
    this.logger = new Logger(name);
    this.initialized = false;
    this.capabilities = {
      parallel: false,
      gpu: false,
      streaming: false,
      quantization: false,
      multiModal: false,
      batchProcessing: false
    };
    this.metrics = {
      totalInferences: 0,
      totalErrors: 0,
      avgLatency: 0,
      lastInference: null
    };
  }

  /**
   * Check if engine is supported in current environment
   * @returns {Promise<boolean>}
   */
  async isSupported() {
    throw new Error('isSupported() must be implemented by subclass');
  }

  /**
   * Initialize the engine
   * @param {Object} options - Initialization options
   * @returns {Promise<boolean>}
   */
  async initialize(options = {}) {
    if (this.initialized) {
      this.logger.debug('Engine already initialized');
      return true;
    }

    try {
      this.logger.info(`Initializing ${this.name}...`);
      
      // Subclass-specific initialization
      const result = await this._initialize(options);
      
      if (result) {
        this.initialized = true;
        this.emit('initialized', { engine: this.name, options });
        this.logger.info(`${this.name} initialized successfully`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Initialization failed: ${error.message}`);
      this.emit('error', { type: 'initialization', error });
      throw error;
    }
  }

  /**
   * Internal initialization to be implemented by subclass
   * @protected
   */
  async _initialize(options) {
    throw new Error('_initialize() must be implemented by subclass');
  }

  /**
   * Load a model
   * @param {Object} model - Model configuration
   * @returns {Promise<any>}
   */
  async loadModel(model) {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    
    try {
      this.logger.info(`Loading model: ${model.name || model.id}`);
      const result = await this._loadModel(model);
      
      const loadTime = Date.now() - startTime;
      this.emit('modelLoaded', { 
        model: model.name || model.id, 
        loadTime,
        engine: this.name 
      });
      
      this.logger.info(`Model loaded in ${loadTime}ms`);
      return result;
    } catch (error) {
      this.logger.error(`Model loading failed: ${error.message}`);
      this.emit('error', { type: 'modelLoad', error, model });
      throw error;
    }
  }

  /**
   * Internal model loading to be implemented by subclass
   * @protected
   */
  async _loadModel(model) {
    throw new Error('_loadModel() must be implemented by subclass');
  }

  /**
   * Execute inference
   * @param {Object} model - Model to use
   * @param {any} input - Input data
   * @param {Object} options - Inference options
   * @returns {Promise<any>}
   */
  async execute(model, input, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    
    try {
      this.logger.debug(`Executing inference on ${this.name}`);
      
      // Track metrics
      this.metrics.totalInferences++;
      
      // Execute inference
      const result = await this._execute(model, input, options);
      
      // Update metrics
      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);
      
      this.emit('inference', {
        engine: this.name,
        model: model.name || model.id,
        latency,
        inputSize: this.getDataSize(input),
        outputSize: this.getDataSize(result)
      });
      
      return result;
    } catch (error) {
      this.metrics.totalErrors++;
      this.logger.error(`Inference failed: ${error.message}`);
      this.emit('error', { type: 'inference', error, model });
      throw error;
    }
  }

  /**
   * Internal execution to be implemented by subclass
   * @protected
   */
  async _execute(model, input, options) {
    throw new Error('_execute() must be implemented by subclass');
  }

  /**
   * Stream tokens (for generative models)
   * @param {Object} model - Model to use
   * @param {any} input - Input data
   * @param {Object} options - Streaming options
   * @returns {AsyncGenerator}
   */
  async *stream(model, input, options = {}) {
    if (!this.capabilities.streaming) {
      throw new Error(`${this.name} does not support streaming`);
    }

    if (!this.initialized) {
      await this.initialize();
    }

    try {
      this.logger.debug(`Starting streaming inference on ${this.name}`);
      
      yield* this._stream(model, input, options);
      
      this.emit('streamComplete', {
        engine: this.name,
        model: model.name || model.id
      });
    } catch (error) {
      this.logger.error(`Streaming failed: ${error.message}`);
      this.emit('error', { type: 'streaming', error, model });
      throw error;
    }
  }

  /**
   * Internal streaming to be implemented by subclass
   * @protected
   */
  async *_stream(model, input, options) {
    throw new Error('_stream() must be implemented by subclass');
  }

  /**
   * Get engine information
   * @returns {Object}
   */
  getInfo() {
    return {
      name: this.name,
      initialized: this.initialized,
      capabilities: this.capabilities,
      metrics: this.metrics,
      status: this.getStatus()
    };
  }

  /**
   * Get engine status
   * @returns {string}
   */
  getStatus() {
    if (!this.initialized) return 'uninitialized';
    if (this.metrics.totalErrors > this.metrics.totalInferences * 0.1) return 'degraded';
    return 'healthy';
  }

  /**
   * Get capabilities
   * @returns {Object}
   */
  getCapabilities() {
    return { ...this.capabilities };
  }

  /**
   * Update latency metrics
   * @private
   */
  updateLatencyMetrics(latency) {
    const total = this.metrics.totalInferences;
    const prevAvg = this.metrics.avgLatency;
    
    // Calculate running average
    this.metrics.avgLatency = ((prevAvg * (total - 1)) + latency) / total;
    this.metrics.lastInference = new Date().toISOString();
  }

  /**
   * Get data size for metrics
   * @private
   */
  getDataSize(data) {
    if (!data) return 0;
    if (data.length !== undefined) return data.length;
    if (data.byteLength !== undefined) return data.byteLength;
    if (typeof data === 'string') return data.length;
    return JSON.stringify(data).length;
  }

  /**
   * Validate model configuration
   * @protected
   */
  validateModel(model) {
    if (!model) {
      throw new Error('Model configuration is required');
    }
    
    if (!model.name && !model.id) {
      throw new Error('Model must have a name or id');
    }
    
    // Additional validation can be added by subclasses
    return true;
  }

  /**
   * Clean up resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      this.logger.info(`Cleaning up ${this.name}...`);
      
      // Subclass-specific cleanup
      await this._cleanup();
      
      this.initialized = false;
      this.removeAllListeners();
      
      this.logger.info(`${this.name} cleaned up successfully`);
    } catch (error) {
      this.logger.error(`Cleanup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Internal cleanup to be implemented by subclass
   * @protected
   */
  async _cleanup() {
    // Override in subclass if needed
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalInferences: 0,
      totalErrors: 0,
      avgLatency: 0,
      lastInference: null
    };
  }

  /**
   * Get performance report
   * @returns {Object}
   */
  getPerformanceReport() {
    return {
      engine: this.name,
      status: this.getStatus(),
      metrics: { ...this.metrics },
      successRate: this.metrics.totalInferences > 0 
        ? ((this.metrics.totalInferences - this.metrics.totalErrors) / this.metrics.totalInferences * 100).toFixed(2) + '%'
        : 'N/A',
      capabilities: this.capabilities
    };
  }
}

export default BaseEngine;