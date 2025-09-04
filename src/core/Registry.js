/**
 * 📚 Model Registry - Streamlined Edition
 * Echo AI Systems - Efficient model management
 * 
 * @class ModelRegistry
 * @extends EventEmitter
 * @description Manages the lifecycle of LLM models including registration, loading, 
 * indexing, and cleanup. Supports multiple model formats through pluggable loaders
 * and provides intelligent model selection and caching.
 * 
 * @example
 * // Basic usage
 * import { ModelRegistry } from './core/Registry.js';
 * 
 * const registry = new ModelRegistry();
 * await registry.initialize();
 * 
 * // Register a model
 * await registry.register({
 *   id: 'llama-7b',
 *   name: 'Llama 7B',
 *   format: 'gguf',
 *   path: './models/llama-7b.gguf'
 * });
 * 
 * // Get and use a model
 * const model = await registry.get('llama-7b');
 * const response = await model.generate('Hello world');
 * 
 * @example
 * // Advanced configuration
 * const registry = new ModelRegistry({
 *   registryPath: './custom/models.json',
 *   maxModels: 50
 * });
 * 
 * // Listen for events
 * registry.on('registered', (model) => {
 *   console.log('New model registered:', model.name);
 * });
 * 
 * @example
 * // Production setup with error handling
 * const registry = new ModelRegistry({
 *   registryPath: './production/registry.json',
 *   maxModels: 20
 * });
 * 
 * try {
 *   await registry.initialize();
 *   
 *   // Register loaders for different formats
 *   registry.registerLoader('gguf', new GGUFLoader());
 *   registry.registerLoader('onnx', new ONNXLoader());
 *   registry.registerLoader('safetensors', new SafetensorsLoader());
 *   
 *   console.log(`Registry ready with ${registry.getModelCount()} models`);
 * } catch (error) {
 *   console.error('Failed to initialize registry:', error);
 * }
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';
import fs from 'fs/promises';
import path from 'path';

const logger = new Logger('Registry');

class ModelRegistry extends EventEmitter {
  /**
   * Create a new Model Registry
   * @param {Object} [config={}] - Configuration options
   * @param {string} [config.registryPath='./models/registry.json'] - Path to persist registry data
   * @param {number} [config.maxModels=100] - Maximum number of models to keep in memory
   * 
   * @example
   * // Default configuration
   * const registry = new ModelRegistry();
   * 
   * @example
   * // Custom configuration
   * const registry = new ModelRegistry({
   *   registryPath: './my-models/registry.json',
   *   maxModels: 50
   * });
   * 
   * @example
   * // Development setup
   * const devRegistry = new ModelRegistry({
   *   registryPath: './dev/registry.json',
   *   maxModels: 10  // Lower limit for development
   * });
   */
  constructor(config = {}) {
    super();
    this.config = {
      registryPath: './models/registry.json',
      maxModels: 100,
      ...config
    };
    
    this.models = new Map();
    this.loaders = new Map();
    this.indexes = {
      format: new Map(),
      capability: new Map()
    };
    
    this.stats = { registered: 0, loaded: 0 };
  }

  /**
   * Initialize the registry by loading persisted models
   * @example
   * // Basic initialization
   * const registry = new ModelRegistry();
   * await registry.initialize();
   * 
   * @example
   * // Initialize with custom config
   * const registry = new ModelRegistry({
   *   registryPath: './custom/registry.json',
   *   maxModels: 50
   * });
   * await registry.initialize();
   * 
   * @example
   * // Handle initialization errors gracefully
   * try {
   *   await registry.initialize();
   *   console.log('Registry ready');
   * } catch (error) {
   *   console.warn('Starting with empty registry:', error.message);
   * }
   */
  async initialize() {
    try {
      await fs.mkdir(path.dirname(this.config.registryPath), { recursive: true });
      const data = await this.loadRegistry();
      
      for (const modelData of data.models || []) {
        await this.registerFromData(modelData);
      }
      
      logger.info(`✅ Registry loaded: ${this.models.size} models`);
    } catch (error) {
      logger.warn('Starting fresh registry');
    }
  }

  /**
   * Register a model in the registry
   * @param {Object} model - The model to register
   * @returns {Promise<Object>} The registered model
   * @example
   * // Register a simple model
   * const model = {
   *   id: 'gpt-3.5-turbo',
   *   name: 'GPT-3.5 Turbo',
   *   format: 'openai',
   *   capabilities: { chat: true, completion: true }
   * };
   * await registry.register(model);
   * 
   * @example
   * // Register a local GGUF model
   * const localModel = {
   *   id: 'llama-7b-q4',
   *   name: 'Llama 7B Q4',
   *   format: 'gguf',
   *   path: './models/llama-7b-q4.gguf',
   *   capabilities: { chat: true, instruct: true }
   * };
   * const registered = await registry.register(localModel);
   * console.log('Registered:', registered.id);
   * 
   * @example
   * // Handle registration with full capacity
   * const registry = new ModelRegistry({ maxModels: 2 });
   * await registry.register(model1);
   * await registry.register(model2);
   * // This will evict the least recently used model
   * await registry.register(model3);
   */
  async register(model) {
    if (this.models.size >= this.config.maxModels) {
      await this.evictLRU();
    }
    
    this.models.set(model.id, model);
    this.indexModel(model);
    this.stats.registered++;
    
    await this.saveRegistry();
    this.emit('registered', model);
    return model;
  }

  /**
   * Get a model by ID and load it if not already loaded
   * @param {string} id - The model ID
   * @returns {Promise<Object|undefined>} The model or undefined if not found
   * @example
   * // Get and auto-load a model
   * const model = await registry.get('gpt-3.5-turbo');
   * if (model) {
   *   console.log('Model ready:', model.name);
   *   const response = await model.generate('Hello world');
   * }
   * 
   * @example
   * // Handle missing models
   * const model = await registry.get('nonexistent-model');
   * if (!model) {
   *   console.warn('Model not found in registry');
   *   return;
   * }
   * 
   * @example
   * // Check if model was already loaded
   * const model = await registry.get('llama-7b');
   * if (model.loaded) {
   *   console.log('Model was already loaded');
   * } else {
   *   console.log('Model was loaded during get()');
   * }
   */
  async get(id) {
    const model = this.models.get(id);
    if (model && !model.loaded) {
      await model.load();
      this.stats.loaded++;
    }
    return model;
  }

  /**
   * Get all currently loaded models
   * @returns {Array} Array of loaded models
   * @example
   * // Get only loaded models for immediate use
   * const loadedModels = registry.getAvailable();
   * console.log(`${loadedModels.length} models ready for inference`);
   * 
   * @example
   * // Find fastest loaded model
   * const available = registry.getAvailable();
   * const fastest = available.reduce((prev, current) => 
   *   (current.metrics?.speed || 0) > (prev.metrics?.speed || 0) ? current : prev
   * );
   * 
   * @example
   * // Check if any models are available
   * const available = registry.getAvailable();
   * if (available.length === 0) {
   *   console.warn('No models currently loaded');
   *   // Load a default model
   *   await registry.get('default-model');
   * }
   */
  getAvailable() {
    return Array.from(this.models.values()).filter(m => m.loaded);
  }

  /**
   * Get all registered models (loaded and unloaded)
   * @returns {Array} Array of all registered models
   * @example
   * // List all registered models
   * const allModels = registry.getAll();
   * allModels.forEach(model => {
   *   console.log(`${model.name} (${model.format}) - ${model.loaded ? 'loaded' : 'unloaded'}`);
   * });
   * 
   * @example
   * // Count models by format
   * const all = registry.getAll();
   * const formatCounts = all.reduce((acc, model) => {
   *   acc[model.format] = (acc[model.format] || 0) + 1;
   *   return acc;
   * }, {});
   * console.log('Models by format:', formatCounts);
   * 
   * @example
   * // Find models that need loading
   * const unloadedModels = registry.getAll().filter(m => !m.loaded);
   * console.log(`${unloadedModels.length} models need loading`);
   */
  getAll() {
    return Array.from(this.models.values());
  }

  /**
   * Get all models of a specific format
   * @param {string} format - The model format (e.g., 'gguf', 'onnx', 'safetensors')
   * @returns {Array} Array of models with the specified format
   * @example
   * // Get all GGUF models
   * const ggufModels = registry.getByFormat('gguf');
   * console.log(`Found ${ggufModels.length} GGUF models`);
   * 
   * @example
   * // Load all models of a specific format
   * const onnxModels = registry.getByFormat('onnx');
   * for (const model of onnxModels) {
   *   if (!model.loaded) {
   *     await model.load();
   *   }
   * }
   * 
   * @example
   * // Find best model for a format
   * const safetensorsModels = registry.getByFormat('safetensors');
   * const bestModel = safetensorsModels.find(m => m.capabilities?.chat && m.loaded);
   * if (!bestModel && safetensorsModels.length > 0) {
   *   await registry.get(safetensorsModels[0].id);
   * }
   */
  getByFormat(format) {
    return this.indexes.format.get(format) || [];
  }

  /**
   * Register a loader for a specific model format
   * @param {string} format - The format name (e.g., 'gguf', 'onnx')
   * @param {Object} loader - The loader instance
   * @example
   * // Register a custom GGUF loader
   * import { GGUFLoader } from '../loaders/GGUFLoader.js';
   * const ggufLoader = new GGUFLoader();
   * registry.registerLoader('gguf', ggufLoader);
   * 
   * @example
   * // Register multiple loaders
   * import { ONNXLoader } from '../loaders/ONNXLoader.js';
   * import { SafetensorsLoader } from '../loaders/SafetensorsLoader.js';
   * 
   * registry.registerLoader('onnx', new ONNXLoader());
   * registry.registerLoader('safetensors', new SafetensorsLoader());
   * 
   * @example
   * // Register a custom loader with configuration
   * class CustomLoader {
   *   constructor(config) { this.config = config; }
   *   async fromData(data) { return {}; }
   * }
   * registry.registerLoader('custom', new CustomLoader({ gpuAcceleration: true }));
   */
  registerLoader(format, loader) {
    this.loaders.set(format, loader);
  }

  /**
   * Get the registered loader for a specific format
   * @param {string} format - The format name
   * @returns {Object|undefined} The loader or undefined if not found
   * @example
   * // Get a specific loader
   * const ggufLoader = registry.getLoader('gguf');
   * if (ggufLoader) {
   *   const model = await ggufLoader.load('./models/model.gguf');
   * }
   * 
   * @example
   * // Check if format is supported
   * const formats = ['gguf', 'onnx', 'safetensors'];
   * const supportedFormats = formats.filter(fmt => registry.getLoader(fmt));
   * console.log('Supported formats:', supportedFormats);
   * 
   * @example
   * // Fallback to default loader
   * const loader = registry.getLoader('custom-format') || registry.getLoader('gguf');
   * if (!loader) {
   *   throw new Error('No suitable loader found');
   * }
   */
  getLoader(format) {
    return this.loaders.get(format);
  }

  /**
   * Search for models based on criteria
   * @param {Object} criteria - Search criteria
   * @param {string} [criteria.name] - Name pattern (regex)
   * @param {string} [criteria.format] - Exact format match
   * @returns {Array} Array of matching models
   * @example
   * // Search by name pattern
   * const gptModels = registry.search({ name: 'gpt' });
   * console.log(`Found ${gptModels.length} GPT models`);
   * 
   * @example
   * // Search by format
   * const ggufModels = registry.search({ format: 'gguf' });
   * 
   * @example
   * // Combined search criteria
   * const llamaGgufModels = registry.search({ 
   *   name: 'llama', 
   *   format: 'gguf' 
   * });
   * 
   * @example
   * // Case-insensitive search with regex
   * const largeModels = registry.search({ name: '(7b|13b|70b)' });
   * const chatModels = registry.search({ name: 'chat|instruct' });
   * 
   * @example
   * // Find models and load the best one
   * const candidates = registry.search({ name: 'llama.*7b' });
   * if (candidates.length > 0) {
   *   const bestModel = candidates.sort((a, b) => 
   *     (b.metrics?.quality || 0) - (a.metrics?.quality || 0)
   *   )[0];
   *   await registry.get(bestModel.id);
   * }
   */
  search(criteria) {
    let results = Array.from(this.models.values());
    
    if (criteria.name) {
      const pattern = new RegExp(criteria.name, 'i');
      results = results.filter(m => pattern.test(m.name));
    }
    
    if (criteria.format) {
      results = results.filter(m => m.format === criteria.format);
    }
    
    return results;
  }

  /**
   * Index a model by format and capabilities for fast lookup
   * @param {Object} model - The model to index
   * @example
   * // This method is called automatically during registration
   * // but can be used manually for re-indexing
   * const model = {
   *   id: 'custom-model',
   *   format: 'gguf',
   *   capabilities: { chat: true, completion: true }
   * };
   * registry.indexModel(model);
   * 
   * // Now the model can be found by format
   * const ggufModels = registry.getByFormat('gguf'); // includes custom-model
   */
  indexModel(model) {
    // Index by format
    if (!this.indexes.format.has(model.format)) {
      this.indexes.format.set(model.format, []);
    }
    this.indexes.format.get(model.format).push(model);
    
    // Index by capabilities (only if capabilities exist)
    if (model.capabilities && typeof model.capabilities === 'object') {
      Object.entries(model.capabilities)
        .filter(([_, enabled]) => enabled)
        .forEach(([cap]) => {
          if (!this.indexes.capability.has(cap)) {
            this.indexes.capability.set(cap, []);
          }
          this.indexes.capability.get(cap).push(model);
        });
    }
  }

  /**
   * Evict the least recently used model when registry reaches capacity
   * @example
   * // This method is called automatically when maxModels is reached
   * const registry = new ModelRegistry({ maxModels: 3 });
   * await registry.register(model1); // count: 1
   * await registry.register(model2); // count: 2  
   * await registry.register(model3); // count: 3
   * await registry.register(model4); // evictLRU() called, oldest removed
   * 
   * @example
   * // Manual eviction for memory management
   * const memoryUsage = process.memoryUsage();
   * if (memoryUsage.heapUsed > threshold) {
   *   await registry.evictLRU();
   * }
   */
  async evictLRU() {
    let oldest = null;
    let oldestTime = Date.now();
    
    for (const model of this.models.values()) {
      const lastUsed = model.metrics?.lastUsed?.getTime() || 0;
      if (lastUsed < oldestTime) {
        oldestTime = lastUsed;
        oldest = model;
      }
    }
    
    if (oldest) {
      await oldest.cleanup();
      this.models.delete(oldest.id);
      logger.info(`Evicted: ${oldest.name}`);
    }
  }

  /**
   * Load registry data from persistent storage
   * @returns {Promise<Object>} Registry data or empty structure
   * @example
   * // Called automatically during initialize()
   * // Returns structure like:
   * // {
   * //   version: '1.0.0',
   * //   models: [
   * //     { id: 'model1', name: 'Model 1', format: 'gguf', ... },
   * //     { id: 'model2', name: 'Model 2', format: 'onnx', ... }
   * //   ]
   * // }
   */
  async loadRegistry() {
    try {
      const data = await fs.readFile(this.config.registryPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return { models: [] };
    }
  }

  /**
   * Save current registry state to persistent storage
   * @example
   * // Called automatically after model registration
   * // Manual save for critical moments
   * await registry.register(importantModel);
   * await registry.saveRegistry(); // Ensure persistence
   * 
   * @example
   * // Periodic backup
   * setInterval(async () => {
   *   await registry.saveRegistry();
   *   console.log('Registry backed up');
   * }, 30000); // Every 30 seconds
   */
  async saveRegistry() {
    const data = {
      version: '1.0.0',
      models: Array.from(this.models.values()).map(m => {
        // If model has toJSON method, use it
        if (m && typeof m.toJSON === 'function') {
          return m.toJSON();
        }
        // Otherwise return basic model info
        return {
          id: m.id,
          name: m.name,
          format: m.format,
          source: m.source || m.path,
          loaded: m.loaded || false
        };
      })
    };
    await fs.writeFile(this.config.registryPath, JSON.stringify(data, null, 2));
  }

  /**
   * Register a model from serialized data using appropriate loader
   * @param {Object} data - Serialized model data
   * @returns {Promise<Object|null>} The registered model or null if no loader found
   * @example
   * // Used during registry initialization to restore models
   * const modelData = {
   *   id: 'restored-model',
   *   format: 'gguf',
   *   path: './models/restored.gguf',
   *   capabilities: { chat: true }
   * };
   * const model = await registry.registerFromData(modelData);
   * 
   * @example
   * // Handle missing loaders gracefully
   * const model = await registry.registerFromData(unknownFormatData);
   * if (!model) {
   *   console.warn('No loader available for format:', unknownFormatData.format);
   * }
   */
  async registerFromData(data) {
    const loader = this.loaders.get(data.format);
    if (!loader) return null;

    const relativeSource = data.path || data.source || '';
    let resolvedSource = relativeSource;
    if (relativeSource && !path.isAbsolute(relativeSource)) {
      resolvedSource = relativeSource.startsWith('models')
        || relativeSource.startsWith('./models')
        ? path.resolve(process.cwd(), relativeSource)
        : path.resolve(process.cwd(), 'models', relativeSource);
    }
    data.source = resolvedSource;
    data.path = resolvedSource;

    const model = await loader.fromData(data);
    this.models.set(model.id, model);
    this.indexModel(model);
    return model;
  }

  /**
   * Get the total number of registered models
   * @returns {number} Number of registered models
   * @example
   * // Check registry size
   * const count = registry.getModelCount();
   * console.log(`Registry contains ${count} models`);
   * 
   * @example
   * // Monitor registry capacity
   * const count = registry.getModelCount();
   * const maxModels = registry.config.maxModels;
   * const utilizationPercent = (count / maxModels) * 100;
   * console.log(`Registry utilization: ${utilizationPercent.toFixed(1)}%`);
   * 
   * @example
   * // Conditional model registration
   * if (registry.getModelCount() < registry.config.maxModels) {
   *   await registry.register(newModel);
   * } else {
   *   console.warn('Registry at capacity, oldest model will be evicted');
   *   await registry.register(newModel);
   * }
   */
  getModelCount() {
    return this.models.size;
  }

  /**
   * Clean up all models and clear the registry
   * @example
   * // Clean shutdown
   * process.on('SIGINT', async () => {
   *   console.log('Shutting down...');
   *   await registry.cleanup();
   *   process.exit(0);
   * });
   * 
   * @example
   * // Reset registry for testing
   * afterEach(async () => {
   *   await registry.cleanup();
   * });
   * 
   * @example
   * // Clean up before reconfiguration
   * await registry.cleanup();
   * const newRegistry = new ModelRegistry({
   *   registryPath: './new-registry.json',
   *   maxModels: 200
   * });
   * await newRegistry.initialize();
   */
  async cleanup() {
    for (const model of this.models.values()) {
      await model.cleanup();
    }
    this.models.clear();
    this.indexes.format.clear();
    this.indexes.capability.clear();
  }
}



export default ModelRegistry;
export { ModelRegistry, ModelRegistry as Registry };
