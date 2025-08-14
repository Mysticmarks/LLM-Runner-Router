/**
 * 🧠 LLM-Runner-Router Main Entry Point
 * Universal model orchestration system by Echo AI Systems
 */

import { ModelRegistry } from './core/Registry.js';
import { Router } from './core/Router.js';
import { Pipeline } from './core/Pipeline.js';
import { EngineSelector } from './engines/EngineSelector.js';
import { Logger } from './utils/Logger.js';
import { Config } from './config/Config.js';
import { GGUFLoader } from './loaders/GGUFLoader.js';
import { MockLoader } from './loaders/MockLoader.js';
import { PyTorchLoader } from './loaders/PyTorchLoader.js';
import { BinaryLoader } from './loaders/BinaryLoader.js';
// import BitNetLoader from './loaders/BitNetLoader.js'; // Commented out - missing dependencies

const logger = new Logger('LLMRouter');

/**
 * Main LLMRouter class - The orchestrator of all model operations
 */
class LLMRouter {
  constructor(options = {}) {
    this.config = new Config(options);
    this.registry = new ModelRegistry(this.config);
    this.router = new Router(this.registry, this.config);
    this.pipeline = new Pipeline(this.config);
    this.engine = null;
    this.initialized = false;
    
    logger.info('🚀 LLM-Runner-Router initializing...', {
      version: '1.0.0',
      environment: this.detectEnvironment()
    });
  }

  /**
   * Initialize the router with automatic environment detection
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Auto-detect and select best engine
      this.engine = await EngineSelector.getBest(this.config);
      logger.info(`✅ Selected engine: ${this.engine.name}`);
      
      // Register format loaders
      this.registry.registerLoader('gguf', new GGUFLoader());
      logger.info('📦 Registered GGUF loader');
      
      this.registry.registerLoader('mock', new MockLoader());
      logger.info('📦 Registered Mock loader');
      
      this.registry.registerLoader('pytorch', new PyTorchLoader());
      logger.info('🔥 Registered PyTorch loader (.pth, .pt)');
      
      this.registry.registerLoader('binary', new BinaryLoader());
      logger.info('📦 Registered Binary loader (.bin)');
      
      // Register BitNet loader with graceful fallback
      // Commented out - BitNetLoader has missing dependencies
      // try {
      //   this.registry.registerLoader('bitnet', new BitNetLoader({ bitnetPath: './temp/bitnet-repo' }));
      //   logger.info('📦 Registered BitNet loader (1-bit LLMs)');
      // } catch (error) {
      //   logger.warn('⚠️  BitNet loader not available - CMake may not be installed');
      // }
      
      // Initialize the registry
      await this.registry.initialize();
      logger.info(`📚 Model registry loaded: ${this.registry.getModelCount()} models`);
      
      // Setup routing strategies
      await this.router.initialize(this.engine);
      logger.info('🔄 Router initialized with strategies:', this.router.getStrategies());
      
      // Configure pipeline
      await this.pipeline.initialize(this.engine);
      logger.info('📊 Pipeline configured');
      
      this.initialized = true;
      logger.success('🎯 LLM-Runner-Router ready!');
    } catch (error) {
      logger.error('❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load a model with automatic format detection
   * @param {string|object} modelSpec - Model specification
   * @returns {Model} Loaded model instance
   */
  async load(modelSpec) {
    await this.initialize();
    
    const spec = typeof modelSpec === 'string' 
      ? { source: modelSpec } 
      : modelSpec;
    
    logger.info('📦 Loading model:', spec);
    
    // Use router to find best loader
    const loader = await this.router.selectLoader(spec);
    const model = await loader.load(spec);
    
    // Register the loaded model
    this.registry.register(model);
    
    logger.success(`✅ Model loaded: ${model.id}`);
    return model;
  }

  /**
   * Quick inference with automatic model selection
   * @param {string} prompt - Input prompt
   * @param {object} options - Generation options
   */
  async quick(prompt, options = {}) {
    await this.initialize();
    
    try {
      // If a specific model is requested, try to get it
      if (options.modelId) {
        const model = await this.registry.get(options.modelId);
        if (model) {
          return this.generate(model, prompt, options);
        }
      }
      
      // Otherwise use router to select best model
      const model = await this.router.selectModel(prompt, options);
      return this.generate(model, prompt, options);
    } catch (error) {
      // If no models available, try to get any registered model
      const allModels = this.registry.getAll();
      if (allModels.length > 0) {
        const model = allModels[0];
        if (!model.loaded) {
          await model.load();
        }
        return this.generate(model, prompt, options);
      }
      throw error;
    }
  }

  /**
   * Advanced inference with full control
   * @param {object} config - Complete configuration
   */
  async advanced(config) {
    await this.initialize();
    
    const {
      prompt,
      model: modelId,
      temperature = 0.7,
      maxTokens = 500,
      stream = false,
      cache = true,
      fallbacks = []
    } = config;
    
    logger.debug('🎮 Advanced inference:', config);
    
    // Try primary model
    try {
      const model = await this.registry.get(modelId) || await this.load(modelId);
      return await this.generate(model, prompt, config);
    } catch (error) {
      logger.warn(`⚠️ Primary model failed: ${modelId}`, error);
      
      // Try fallbacks
      for (const fallback of fallbacks) {
        try {
          logger.info(`🔄 Trying fallback: ${fallback}`);
          const model = await this.registry.get(fallback) || await this.load(fallback);
          return await this.generate(model, prompt, config);
        } catch (fallbackError) {
          logger.warn(`⚠️ Fallback failed: ${fallback}`, fallbackError);
        }
      }
      
      throw new Error('All models failed');
    }
  }

  /**
   * Stream tokens in real-time
   * @param {string} prompt - Input prompt
   * @param {object} options - Streaming options
   */
  async *stream(prompt, options = {}) {
    await this.initialize();
    
    const model = await this.router.selectModel(prompt, options);
    const stream = await this.pipeline.stream(model, prompt, options);
    
    for await (const token of stream) {
      yield token;
    }
  }

  /**
   * Create model ensemble for combined inference
   * @param {array} models - Array of model configurations
   */
  async ensemble(models, prompt, options = {}) {
    await this.initialize();
    
    const results = await Promise.all(
      models.map(async ({ model: modelId, weight = 1.0 }) => {
        const model = await this.registry.get(modelId) || await this.load(modelId);
        const result = await this.generate(model, prompt, options);
        return { result, weight };
      })
    );
    
    // Weighted combination of results
    return this.combineResults(results);
  }

  /**
   * Generate response using model
   * @private
   */
  async generate(model, prompt, options) {
    return this.pipeline.process(model, prompt, options);
  }

  /**
   * Combine ensemble results
   * @private
   */
  combineResults(results) {
    // Implement weighted voting or averaging
    // This is a simplified version
    const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
    
    // For text generation, pick highest weighted
    // For embeddings, average them
    // This needs more sophisticated implementation
    return results.sort((a, b) => b.weight - a.weight)[0].result;
  }

  /**
   * Detect runtime environment
   * @private
   */
  detectEnvironment() {
    if (typeof window !== 'undefined') {
      return 'browser';
    } else if (typeof process !== 'undefined' && process.versions?.node) {
      return 'node';
    } else if (typeof Deno !== 'undefined') {
      return 'deno';
    } else if (typeof WorkerGlobalScope !== 'undefined') {
      return 'worker';
    }
    return 'unknown';
  }

  /**
   * Get system status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      engine: this.engine?.name,
      modelsLoaded: this.registry.getModelCount(),
      environment: this.detectEnvironment(),
      memoryUsage: process.memoryUsage?.() || {}
    };
  }

  /**
   * Cleanup and release resources
   */
  async cleanup() {
    logger.info('🧹 Cleaning up resources...');
    
    await this.pipeline.cleanup();
    await this.router.cleanup();
    await this.registry.cleanup();
    await this.engine?.cleanup();
    
    this.initialized = false;
    logger.info('✅ Cleanup complete');
  }
}

// Export main class and utilities
export { LLMRouter };
export { ModelRegistry } from './core/Registry.js';
export { Router } from './core/Router.js';
export { Pipeline } from './core/Pipeline.js';

// Create default instance
const defaultRouter = new LLMRouter();

// Export convenience methods
export const load = (spec) => defaultRouter.load(spec);
export const quick = (prompt, options) => defaultRouter.quick(prompt, options);
export const advanced = (config) => defaultRouter.advanced(config);
export const stream = (prompt, options) => defaultRouter.stream(prompt, options);
export const ensemble = (models, prompt, options) => defaultRouter.ensemble(models, prompt, options);

// Auto-initialize on import for convenience
if (typeof process !== 'undefined' && process.env.AUTO_INIT !== 'false') {
  defaultRouter.initialize().catch(console.error);
}

export default LLMRouter;
