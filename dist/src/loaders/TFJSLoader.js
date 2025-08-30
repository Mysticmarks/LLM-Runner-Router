/**
 * TensorFlow.js Model Loader
 * Supports loading and running TensorFlow.js models
 * Works in both browser and Node.js environments
 */

import { BaseLoader } from './BaseLoader.js';
import { Logger } from '../utils/Logger.js';

class TFJSLoader extends BaseLoader {
  constructor() {
    super();
    this.logger = new Logger('TFJSLoader');
    this.tf = null;
    this.models = new Map();
  }

  /**
   * Initialize TensorFlow.js
   */
  async initialize() {
    try {
      // Dynamically import TensorFlow.js based on environment
      if (typeof window !== 'undefined') {
        // Browser environment
        this.tf = await import('@tensorflow/tfjs');
        await this.tf.ready();
        this.logger.info(`TensorFlow.js initialized with backend: ${this.tf.getBackend()}`);
      } else {
        // Node.js environment
        this.tf = await import('@tensorflow/tfjs-node');
        this.logger.info('TensorFlow.js Node initialized');
      }
      
      return true;
    } catch (error) {
      this.logger.warn('TensorFlow.js not available, using fallback', error);
      return false;
    }
  }

  /**
   * Check if this loader supports the given source
   */
  supports(source) {
    if (typeof source !== 'string') return false;
    
    // Check for TensorFlow.js patterns
    if (source.endsWith('.json')) return true; // model.json files
    if (source.includes('tfjs')) return true;
    if (source.includes('tensorflow')) return true;
    if (source.startsWith('tfhub:')) return true;
    if (source.includes('model.json')) return true;
    
    return false;
  }

  /**
   * Load a TensorFlow.js model
   */
  async load(config) {
    const modelId = config.id || `tfjs-${Date.now()}`;
    
    try {
      // Initialize TensorFlow.js if not already done
      if (!this.tf) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize TensorFlow.js');
        }
      }

      this.logger.info(`Loading TensorFlow.js model: ${config.source}`);
      
      let model;
      
      // Determine model type and load accordingly
      if (config.modelType === 'layers' || config.source.includes('model.json')) {
        // Load Layers model
        model = await this.loadLayersModel(config.source, config);
      } else if (config.modelType === 'graph') {
        // Load Graph model
        model = await this.loadGraphModel(config.source, config);
      } else if (config.source.startsWith('tfhub:')) {
        // Load from TensorFlow Hub
        model = await this.loadFromTFHub(config.source, config);
      } else {
        // Auto-detect and load
        model = await this.autoLoadModel(config.source, config);
      }
      
      // Store model
      this.models.set(modelId, {
        model,
        config,
        metadata: this.extractMetadata(model)
      });

      this.logger.info(`TensorFlow.js model loaded successfully: ${modelId}`);
      
      return {
        id: modelId,
        name: config.name || 'TensorFlow.js Model',
        format: 'tfjs',
        loaded: true,
        model,
        metadata: this.extractMetadata(model),
        predict: (input) => this.predict(modelId, input),
        stream: (input) => this.stream(modelId, input),
        unload: () => this.unload(modelId),
        dispose: () => this.unload(modelId)
      };
    } catch (error) {
      this.logger.error(`Failed to load TensorFlow.js model: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load a Layers model
   */
  async loadLayersModel(source, config) {
    const loadOptions = {
      requestInit: config.requestInit,
      onProgress: config.onProgress,
      fetchFunc: config.fetchFunc,
      strict: config.strict !== false,
      weightPathPrefix: config.weightPathPrefix
    };
    
    if (source.startsWith('http') || source.startsWith('file://')) {
      return await this.tf.loadLayersModel(source, loadOptions);
    } else if (source.startsWith('localstorage://')) {
      return await this.tf.loadLayersModel(source);
    } else if (source.startsWith('indexeddb://')) {
      return await this.tf.loadLayersModel(source);
    } else {
      // Assume file path
      return await this.tf.loadLayersModel(`file://${source}`, loadOptions);
    }
  }

  /**
   * Load a Graph model
   */
  async loadGraphModel(source, config) {
    const loadOptions = {
      requestInit: config.requestInit,
      onProgress: config.onProgress,
      fetchFunc: config.fetchFunc
    };
    
    if (source.startsWith('http') || source.startsWith('file://')) {
      return await this.tf.loadGraphModel(source, loadOptions);
    } else {
      // Assume file path
      return await this.tf.loadGraphModel(`file://${source}`, loadOptions);
    }
  }

  /**
   * Load from TensorFlow Hub
   */
  async loadFromTFHub(source, config) {
    const modelUrl = source.replace('tfhub:', 'https://tfhub.dev/');
    return await this.loadGraphModel(modelUrl, config);
  }

  /**
   * Auto-detect model type and load
   */
  async autoLoadModel(source, config) {
    try {
      // Try loading as Layers model first
      return await this.loadLayersModel(source, config);
    } catch (error) {
      // If that fails, try as Graph model
      try {
        return await this.loadGraphModel(source, config);
      } catch (graphError) {
        throw new Error(`Failed to load model as either Layers or Graph model: ${error.message}`);
      }
    }
  }

  /**
   * Extract metadata from model
   */
  extractMetadata(model) {
    const metadata = {
      inputs: [],
      outputs: [],
      layers: [],
      parameters: 0
    };
    
    if (model.inputs) {
      metadata.inputs = model.inputs.map(input => ({
        name: input.name,
        shape: input.shape,
        dtype: input.dtype
      }));
    }
    
    if (model.outputs) {
      metadata.outputs = model.outputs.map(output => ({
        name: output.name,
        shape: output.shape,
        dtype: output.dtype
      }));
    }
    
    if (model.layers) {
      metadata.layers = model.layers.map(layer => ({
        name: layer.name,
        className: layer.getClassName(),
        parameters: layer.countParams()
      }));
      
      metadata.parameters = model.layers.reduce((sum, layer) => 
        sum + layer.countParams(), 0
      );
    }
    
    if (model.summary) {
      // Capture model summary
      const summaryLines = [];
      model.summary(undefined, undefined, (line) => summaryLines.push(line));
      metadata.summary = summaryLines;
    }
    
    return metadata;
  }

  /**
   * Run prediction with the model
   */
  async predict(modelId, input) {
    const modelData = this.models.get(modelId);
    if (!modelData) {
      throw new Error(`Model ${modelId} not loaded`);
    }

    try {
      // Convert input to tensor if needed
      let inputTensor;
      
      if (input instanceof this.tf.Tensor) {
        inputTensor = input;
      } else if (Array.isArray(input)) {
        inputTensor = this.tf.tensor(input);
      } else if (typeof input === 'object' && input.data) {
        inputTensor = this.tf.tensor(input.data, input.shape, input.dtype);
      } else {
        throw new Error('Invalid input format for TensorFlow.js model');
      }
      
      // Run prediction
      const output = modelData.model.predict(inputTensor);
      
      // Convert output to array
      const result = await output.array();
      
      // Clean up tensors
      if (inputTensor !== input) {
        inputTensor.dispose();
      }
      output.dispose();
      
      return result;
    } catch (error) {
      this.logger.error(`Prediction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stream predictions (simulated for TensorFlow.js)
   */
  async *stream(modelId, input) {
    const modelData = this.models.get(modelId);
    if (!modelData) {
      throw new Error(`Model ${modelId} not loaded`);
    }

    try {
      // TensorFlow.js doesn't natively support streaming
      // We'll simulate it by yielding predictions in chunks
      
      if (Array.isArray(input) && input.length > 1) {
        // Batch processing
        for (const item of input) {
          const result = await this.predict(modelId, item);
          yield result;
        }
      } else {
        // Single prediction
        const result = await this.predict(modelId, input);
        
        // If result is an array, yield elements
        if (Array.isArray(result) && result.length > 1) {
          for (const element of result) {
            yield element;
            // Small delay to simulate streaming
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        } else {
          yield result;
        }
      }
    } catch (error) {
      this.logger.error(`Streaming failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unload a model
   */
  async unload(modelId) {
    const modelData = this.models.get(modelId);
    if (modelData) {
      // Dispose of the model to free memory
      if (modelData.model && modelData.model.dispose) {
        modelData.model.dispose();
      }
      
      this.models.delete(modelId);
      this.logger.info(`Model ${modelId} unloaded`);
      return true;
    }
    return false;
  }

  /**
   * Get model info
   */
  getModelInfo(modelId) {
    const modelData = this.models.get(modelId);
    if (!modelData) {
      return null;
    }

    return {
      id: modelId,
      format: 'tfjs',
      loaded: true,
      metadata: modelData.metadata,
      backend: this.tf ? this.tf.getBackend() : null
    };
  }

  /**
   * Validate model
   */
  async validate(config) {
    try {
      // Initialize TF.js if needed
      if (!this.tf) {
        await this.initialize();
      }
      
      if (!this.tf) {
        return {
          valid: false,
          error: 'TensorFlow.js not available'
        };
      }
      
      // Try to load model metadata
      if (config.source.includes('model.json')) {
        const response = await fetch(config.source);
        const modelJson = await response.json();
        
        return {
          valid: true,
          metadata: {
            format: modelJson.format,
            generatedBy: modelJson.generatedBy,
            modelTopology: modelJson.modelTopology ? 'present' : 'missing'
          }
        };
      }
      
      return {
        valid: true,
        warning: 'Cannot validate without loading'
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Save model to storage
   */
  async saveModel(modelId, destination) {
    const modelData = this.models.get(modelId);
    if (!modelData) {
      throw new Error(`Model ${modelId} not found`);
    }
    
    try {
      await modelData.model.save(destination);
      this.logger.info(`Model ${modelId} saved to ${destination}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to save model: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get available backends
   */
  getAvailableBackends() {
    if (!this.tf) {
      return [];
    }
    
    return ['cpu', 'webgl', 'wasm', 'webgpu'].filter(backend => {
      try {
        return this.tf.env().get(`${backend.toUpperCase()}_ENABLED`);
      } catch {
        return false;
      }
    });
  }

  /**
   * Set backend
   */
  async setBackend(backend) {
    if (!this.tf) {
      throw new Error('TensorFlow.js not initialized');
    }
    
    await this.tf.setBackend(backend);
    this.logger.info(`TensorFlow.js backend set to: ${backend}`);
  }
}
export default TFJSLoader;
export { TFJSLoader };
