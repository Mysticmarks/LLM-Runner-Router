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
import { getErrorHandler, handleWithFallback } from './utils/ErrorHandler.js';
import { getDatabase } from './db/DatabaseManager.js';
import GGUFLoader from './loaders/GGUFLoader.js';
import MockLoader from './loaders/MockLoader.js';
import PyTorchLoader from './loaders/PyTorchLoader.js';
import BinaryLoader from './loaders/BinaryLoader.js';
import SimpleLoader from './loaders/SimpleLoader.js';
import SafetensorsLoader from './loaders/SafetensorsLoader.js';
import SmolLM3Loader from './loaders/SmolLM3Loader.js';
import SimpleSmolLM3Loader from './loaders/SimpleSmolLM3Loader.js';
import OllamaAdapter from './loaders/adapters/OllamaAdapter.js';
// import BitNetLoader from './loaders/BitNetLoader.js'; // Commented out - missing dependencies

const logger = new Logger('LLMRouter');

/**
 * Main LLMRouter class - The orchestrator of all model operations
 */
class LLMRouter {
  constructor(options = {}) {
    this.config = new Config(options);
    this.errorHandler = getErrorHandler(options.errorHandler);
    this.database = getDatabase(options.database);
    this.registry = new ModelRegistry(this.config);
    this.router = new Router(this.registry, this.config);
    this.pipeline = new Pipeline(this.config);
    this.engine = null;
    this.initialized = false;
    this.loaders = new Map(); // Track registered loaders
    
    logger.info('🚀 LLM-Runner-Router initializing...', {
      version: '2.0.0',
      environment: this.detectEnvironment()
    });

    // Setup error handling for graceful operation
    this.errorHandler.on('criticalError', (data) => {
      logger.error('🚨 Critical system error detected:', data);
    });

    this.errorHandler.on('fallback', (data) => {
      logger.warn('🛡️ Fallback strategy activated:', data.errorType);
    });
  }

  /**
   * Initialize the router with automatic environment detection
   */
  async initialize() {
    if (this.initialized) return;
    
    return await handleWithFallback(async () => {
      // Initialize database first
      logger.info('🗄️ Initializing database...');
      await this.database.initialize();
      logger.success('✅ Database ready');
      // Auto-detect and select best engine
      this.engine = await EngineSelector.getBest(this.config);
      logger.info(`✅ Selected engine: ${this.engine.name}`);
      
      // Register format loaders
      const ggufLoader = new GGUFLoader();
      this.registry.registerLoader('gguf', ggufLoader);
      this.loaders.set('gguf', ggufLoader);
      logger.info('📦 Registered GGUF loader');
      
      const mockLoader = new MockLoader();
      this.registry.registerLoader('mock', mockLoader);
      this.loaders.set('mock', mockLoader);
      logger.info('📦 Registered Mock loader');
      
      const pytorchLoader = new PyTorchLoader();
      this.registry.registerLoader('pytorch', pytorchLoader);
      this.loaders.set('pytorch', pytorchLoader);
      logger.info('🔥 Registered PyTorch loader (.pth, .pt)');
      
      const binaryLoader = new BinaryLoader();
      this.registry.registerLoader('binary', binaryLoader);
      this.loaders.set('binary', binaryLoader);
      logger.info('📦 Registered Binary loader (.bin)');
      
      const safetensorsLoader = new SafetensorsLoader();
      this.registry.registerLoader('safetensors', safetensorsLoader);
      this.loaders.set('safetensors', safetensorsLoader);
      logger.info('🔒 Registered Safetensors loader (.safetensors)');
      
      const smolLM3Loader = new SmolLM3Loader();
      this.registry.registerLoader('smollm3', smolLM3Loader);
      this.loaders.set('smollm3', smolLM3Loader);
      logger.info('🧠 Registered SmolLM3 loader (Transformers.js)');
      
      const ollamaAdapter = new OllamaAdapter();
      this.registry.registerLoader('ollama', ollamaAdapter);
      this.loaders.set('ollama', ollamaAdapter);
      logger.info('🦙 Registered Ollama adapter (local models)');
      
      const simpleLoader = new SimpleLoader();
      this.registry.registerLoader('simple', simpleLoader);
      this.loaders.set('simple', simpleLoader);
      logger.info('🤖 Registered Simple loader (VPS fallback)');
      
      const simpleSmolLM3Loader = new SimpleSmolLM3Loader();
      this.registry.registerLoader('simple-smollm3', simpleSmolLM3Loader);
      this.loaders.set('simple-smollm3', simpleSmolLM3Loader);
      logger.info('🧠 Registered SimpleSmolLM3 loader for local inference');
      
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
    }, { operation: 'initialization', maxRetries: 2 });
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
   * Register a loader for a specific format
   */
  registerLoader(format, loader) {
    this.registry.registerLoader(format, loader);
    this.loaders.set(format, loader);
    logger.info(`📦 Registered loader: ${format}`);
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
   * Setup Ollama with automatic model discovery
   * @param {object} config - Ollama configuration
   */
  async setupOllama(config = {}) {
    await this.initialize();
    
    const ollamaAdapter = this.registry.getLoader('ollama');
    if (!ollamaAdapter) {
      throw new Error('Ollama adapter not registered. Please ensure Ollama is properly initialized.');
    }

    const baseURL = config.baseURL || 'http://localhost:11434';
    logger.info(`🦙 Setting up Ollama at ${baseURL}`);

    // Check if Ollama is available
    const isAvailable = await ollamaAdapter.isAvailable();
    if (!isAvailable) {
      throw new Error(`Ollama server not available at ${baseURL}. Please ensure Ollama is running.`);
    }

    // Get available models from Ollama
    const availableModels = await ollamaAdapter.getAvailableModels();
    logger.info(`Found ${availableModels.length} Ollama models: ${availableModels.map(m => m.name).join(', ')}`);

    // Auto-register discovered models
    for (const model of availableModels) {
      await this.addOllamaModel(model.name, {
        ...model,
        baseURL,
        autoDiscovered: true
      });
    }

    logger.success(`✅ Ollama setup complete with ${availableModels.length} models`);
    return availableModels;
  }

  /**
   * Add a specific Ollama model to the registry
   * @param {string} modelId - Ollama model identifier
   * @param {object} config - Model configuration
   */
  async addOllamaModel(modelId, config = {}) {
    await this.initialize();
    
    const ollamaAdapter = this.registry.getLoader('ollama');
    if (!ollamaAdapter) {
      throw new Error('Ollama adapter not registered');
    }

    logger.info(`🦙 Adding Ollama model: ${modelId}`);

    // Load the model through the adapter
    const model = await ollamaAdapter.load(modelId, {
      id: modelId,
      name: config.name || modelId,
      provider: 'ollama',
      format: 'ollama',
      baseURL: config.baseURL || 'http://localhost:11434',
      ...config
    });

    // Register in the main registry
    this.registry.register(model);
    
    logger.success(`✅ Ollama model registered: ${modelId}`);
    return model;
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

// Export API loaders
export { default as APILoader } from './loaders/APILoader.js';
export { default as OpenAIAdapter } from './loaders/adapters/OpenAIAdapter.js';
export { default as AnthropicAdapter } from './loaders/adapters/AnthropicAdapter.js';
export { default as OpenRouterAdapter } from './loaders/adapters/OpenRouterAdapter.js';
export { default as GroqAdapter } from './loaders/adapters/GroqAdapter.js';

// Create default instance (with auto-init disabled to prevent duplicate initialization)
const defaultRouter = new LLMRouter({ autoInit: false });

// Export convenience methods
export const load = (spec) => defaultRouter.load(spec);
export const quick = (prompt, options) => defaultRouter.quick(prompt, options);
export const advanced = (config) => defaultRouter.advanced(config);
export const stream = (prompt, options) => defaultRouter.stream(prompt, options);
export const ensemble = (models, prompt, options) => defaultRouter.ensemble(models, prompt, options);

// Ollama convenience methods
export const setupOllama = (config = {}) => defaultRouter.setupOllama(config);
export const addOllamaModel = (modelId, config = {}) => defaultRouter.addOllamaModel(modelId, config);

// Auto-initialize on import for convenience (disabled in test environment)
if (typeof process !== 'undefined' && 
    process.env.AUTO_INIT !== 'false' && 
    process.env.NODE_ENV !== 'test') {
  // Initialize once
  defaultRouter.initialize().catch(console.error);
}

export default LLMRouter;
