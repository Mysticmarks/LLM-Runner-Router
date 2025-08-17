/**
 * ONNX Model Loader
 * Supports loading and running ONNX format models
 * Uses ONNX Runtime Web for browser/Node.js compatibility
 */

import { BaseLoader } from './BaseLoader.js';
import { Logger } from '../utils/Logger.js';

export class ONNXLoader extends BaseLoader {
  constructor() {
    super();
    this.logger = new Logger('ONNXLoader');
    this.sessions = new Map();
    this.ort = null;
  }

  /**
   * Initialize ONNX Runtime
   */
  async initialize() {
    try {
      // Dynamically import ONNX Runtime based on environment
      if (typeof window !== 'undefined') {
        // Browser environment
        this.ort = await import('onnxruntime-web');
      } else {
        // Node.js environment
        this.ort = await import('onnxruntime-node');
      }
      
      this.logger.info('ONNX Runtime initialized');
      return true;
    } catch (error) {
      this.logger.warn('ONNX Runtime not available, using fallback', error);
      return false;
    }
  }

  /**
   * Check if this loader supports the given source
   */
  supports(source) {
    if (typeof source !== 'string') return false;
    
    // Check file extensions
    if (source.endsWith('.onnx')) return true;
    if (source.endsWith('.ort')) return true;
    
    // Check for ONNX in path
    if (source.includes('onnx')) return true;
    
    return false;
  }

  /**
   * Load an ONNX model
   */
  async load(config) {
    const modelId = config.id || `onnx-${Date.now()}`;
    
    try {
      // Initialize ONNX Runtime if not already done
      if (!this.ort) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize ONNX Runtime');
        }
      }

      this.logger.info(`Loading ONNX model: ${config.source}`);
      
      // Create inference session
      let session;
      
      if (config.source.startsWith('http')) {
        // Load from URL
        session = await this.ort.InferenceSession.create(config.source, {
          executionProviders: this.getExecutionProviders(),
          graphOptimizationLevel: 'all',
          ...config.sessionOptions
        });
      } else if (typeof config.source === 'string') {
        // Load from file path
        session = await this.ort.InferenceSession.create(config.source, {
          executionProviders: this.getExecutionProviders(),
          graphOptimizationLevel: 'all',
          ...config.sessionOptions
        });
      } else if (config.source instanceof ArrayBuffer) {
        // Load from ArrayBuffer
        session = await this.ort.InferenceSession.create(config.source, {
          executionProviders: this.getExecutionProviders(),
          graphOptimizationLevel: 'all',
          ...config.sessionOptions
        });
      } else {
        throw new Error('Invalid source type for ONNX model');
      }

      // Store session
      this.sessions.set(modelId, session);

      // Get model metadata
      const metadata = this.extractMetadata(session);

      this.logger.info(`ONNX model loaded successfully: ${modelId}`);
      
      return {
        id: modelId,
        name: config.name || 'ONNX Model',
        format: 'onnx',
        loaded: true,
        session,
        metadata,
        predict: (input) => this.predict(modelId, input),
        stream: (input) => this.stream(modelId, input),
        unload: () => this.unload(modelId)
      };
    } catch (error) {
      this.logger.error(`Failed to load ONNX model: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get execution providers based on environment
   */
  getExecutionProviders() {
    const providers = [];
    
    if (typeof window !== 'undefined') {
      // Browser environment
      providers.push('webgl'); // WebGL backend for GPU acceleration
      providers.push('wasm'); // WebAssembly fallback
    } else {
      // Node.js environment
      providers.push('cpu'); // CPU backend
    }
    
    return providers;
  }

  /**
   * Extract metadata from ONNX session
   */
  extractMetadata(session) {
    const metadata = {
      inputNames: session.inputNames,
      outputNames: session.outputNames,
      inputs: {},
      outputs: {}
    };

    // Get input shapes and types
    for (const name of session.inputNames) {
      const input = session.inputs.find(i => i.name === name);
      if (input) {
        metadata.inputs[name] = {
          shape: input.dims,
          type: input.type
        };
      }
    }

    // Get output shapes and types
    for (const name of session.outputNames) {
      const output = session.outputs.find(o => o.name === name);
      if (output) {
        metadata.outputs[name] = {
          shape: output.dims,
          type: output.type
        };
      }
    }

    return metadata;
  }

  /**
   * Run prediction with the model
   */
  async predict(modelId, input) {
    const session = this.sessions.get(modelId);
    if (!session) {
      throw new Error(`Model ${modelId} not loaded`);
    }

    try {
      // Prepare input tensors
      const feeds = {};
      
      if (input instanceof Object && !Array.isArray(input)) {
        // Input is already formatted as feeds
        for (const [name, data] of Object.entries(input)) {
          if (data instanceof this.ort.Tensor) {
            feeds[name] = data;
          } else {
            // Create tensor from data
            const inputMeta = session.inputs.find(i => i.name === name);
            feeds[name] = new this.ort.Tensor(
              inputMeta?.type || 'float32',
              data.data || data,
              data.shape || inputMeta?.dims
            );
          }
        }
      } else {
        // Assume single input
        const inputName = session.inputNames[0];
        const inputMeta = session.inputs[0];
        
        if (input instanceof this.ort.Tensor) {
          feeds[inputName] = input;
        } else {
          feeds[inputName] = new this.ort.Tensor(
            inputMeta?.type || 'float32',
            Array.isArray(input) ? input : [input],
            inputMeta?.dims || [1, input.length]
          );
        }
      }

      // Run inference
      const results = await session.run(feeds);
      
      // Process outputs
      const outputs = {};
      for (const [name, tensor] of Object.entries(results)) {
        outputs[name] = {
          data: Array.from(tensor.data),
          shape: tensor.dims,
          type: tensor.type
        };
      }

      // Return single output if only one, otherwise return all
      const outputNames = Object.keys(outputs);
      if (outputNames.length === 1) {
        return outputs[outputNames[0]].data;
      }
      
      return outputs;
    } catch (error) {
      this.logger.error(`Prediction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stream predictions (for compatible models)
   */
  async *stream(modelId, input) {
    // ONNX doesn't natively support streaming, but we can simulate it
    // by running inference in chunks for sequence models
    
    const session = this.sessions.get(modelId);
    if (!session) {
      throw new Error(`Model ${modelId} not loaded`);
    }

    try {
      // Check if this is a sequence model
      const hasSequenceInput = session.inputNames.some(name => 
        name.toLowerCase().includes('sequence') || 
        name.toLowerCase().includes('token')
      );

      if (hasSequenceInput) {
        // Process as sequence model
        let context = input;
        let generated = [];
        const maxTokens = 100; // Default max tokens
        
        for (let i = 0; i < maxTokens; i++) {
          const output = await this.predict(modelId, context);
          
          // Extract next token (simplified - actual implementation would vary)
          const nextToken = Array.isArray(output) ? output[0] : output;
          generated.push(nextToken);
          
          yield nextToken;
          
          // Update context for next iteration
          context = [...context, nextToken];
          
          // Check for end token (simplified)
          if (nextToken === 0 || nextToken === '</s>') {
            break;
          }
        }
      } else {
        // For non-sequence models, just return the full prediction
        const output = await this.predict(modelId, input);
        yield output;
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
    const session = this.sessions.get(modelId);
    if (session) {
      // ONNX Runtime doesn't have explicit disposal in JS
      // but we can clear our reference
      this.sessions.delete(modelId);
      this.logger.info(`Model ${modelId} unloaded`);
      return true;
    }
    return false;
  }

  /**
   * Get model info
   */
  getModelInfo(modelId) {
    const session = this.sessions.get(modelId);
    if (!session) {
      return null;
    }

    return {
      id: modelId,
      format: 'onnx',
      loaded: true,
      inputNames: session.inputNames,
      outputNames: session.outputNames,
      executionProviders: this.getExecutionProviders()
    };
  }

  /**
   * Validate model compatibility
   */
  async validate(config) {
    try {
      // Try to create a session to validate
      if (!this.ort) {
        await this.initialize();
      }
      
      if (!this.ort) {
        return {
          valid: false,
          error: 'ONNX Runtime not available'
        };
      }

      // Quick validation by trying to create session
      const session = await this.ort.InferenceSession.create(config.source, {
        executionProviders: this.getExecutionProviders()
      });
      
      return {
        valid: true,
        metadata: this.extractMetadata(session)
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}