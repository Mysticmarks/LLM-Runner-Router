/**
 * 📦 Binary Model Loader
 * Generic loader for .bin model files (supports multiple formats)
 */

import { ModelInterface } from '../core/ModelInterface.js';
import { BaseLoader } from './BaseLoader.js';
import { Logger } from '../utils/Logger.js';
import path from 'path';
import fs from 'fs/promises';

const logger = new Logger('BinaryLoader');

/**
 * Binary Model implementation
 * Handles generic .bin files which could be various model formats
 */
class BinaryModel extends ModelInterface {
  constructor(config) {
    super(config);
    this.format = 'binary';
    this.source = config.source || config.path;
    this.model = null;
    this.modelType = null;
    
    // Try to detect the actual format from metadata or naming
    this.detectedFormat = this.detectFormat(config);
    
    // Model configuration
    this.maxLength = parseInt(config.maxLength || 512);
    this.temperature = parseFloat(config.temperature || 0.7);
    this.topP = parseFloat(config.topP || 0.9);
  }

  /**
   * Attempt to detect the actual model format
   */
  detectFormat(config) {
    const source = (config.source || config.path || '').toLowerCase();
    const name = (config.name || '').toLowerCase();
    
    // Check for known patterns in filenames
    if (source.includes('pytorch_model.bin') || name.includes('pytorch')) {
      return 'pytorch';
    }
    if (source.includes('tf_model.bin') || name.includes('tensorflow')) {
      return 'tensorflow';
    }
    if (source.includes('flax_model.bin') || name.includes('flax')) {
      return 'flax';
    }
    if (source.includes('onnx') || name.includes('onnx')) {
      return 'onnx';
    }
    if (source.includes('ggml') || name.includes('ggml')) {
      return 'ggml';
    }
    
    // Check for model architecture hints
    if (name.includes('bert')) return 'bert';
    if (name.includes('gpt')) return 'gpt';
    if (name.includes('llama')) return 'llama';
    if (name.includes('t5')) return 't5';
    
    return 'unknown';
  }

  async load() {
    if (this.loaded) return;
    
    logger.info(`📦 Loading Binary model: ${this.name}`);
    logger.info(`  Source path: ${this.source}`);
    logger.info(`  Detected format: ${this.detectedFormat}`);
    this.loading = true;
    
    try {
      // Resolve model path
      const modelPath = path.isAbsolute(this.source) 
        ? this.source 
        : path.resolve(process.cwd(), this.source);
      
      logger.info(`  Resolved path: ${modelPath}`);
      
      // Check if file exists
      await fs.access(modelPath);
      
      // Get file stats
      const stats = await fs.stat(modelPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      logger.info(`  Model size: ${sizeInMB} MB`);
      
      // Read first few bytes to check for magic numbers
      const fileHandle = await fs.open(modelPath, 'r');
      const buffer = Buffer.alloc(16);
      await fileHandle.read(buffer, 0, 16, 0);
      await fileHandle.close();
      
      // Check for known file signatures
      let fileSignature = 'unknown';
      
      // PyTorch format check (ZIP file signature)
      if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
        fileSignature = 'pytorch-zip';
        this.detectedFormat = 'pytorch';
      }
      // ONNX format check
      else if (buffer.toString('utf8', 0, 4) === '\x08\x01\x12\x00') {
        fileSignature = 'onnx';
        this.detectedFormat = 'onnx';
      }
      // GGML format check
      else if (buffer.toString('utf8', 0, 4) === 'ggml') {
        fileSignature = 'ggml';
        this.detectedFormat = 'ggml';
      }
      
      logger.info(`  File signature: ${fileSignature}`);
      
      // Store model metadata
      this.modelMetadata = {
        path: modelPath,
        size: stats.size,
        sizeInMB: sizeInMB,
        format: this.detectedFormat,
        signature: fileSignature,
        lastModified: stats.mtime
      };
      
      // Check if we have a companion config file
      const configPath = modelPath.replace('.bin', '.json');
      try {
        await fs.access(configPath);
        const configData = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configData);
        this.modelConfig = config;
        logger.info(`  Found config file: ${path.basename(configPath)}`);
        
        // Extract useful information from config
        if (config.model_type) {
          this.modelType = config.model_type;
          logger.info(`  Model type: ${this.modelType}`);
        }
        if (config.architectures) {
          this.architectures = config.architectures;
          logger.info(`  Architectures: ${config.architectures.join(', ')}`);
        }
      } catch (error) {
        logger.debug('No companion config file found');
      }
      
      // Note: Actual inference would require format-specific handling
      logger.warn(`Binary model loaded as metadata only - ${this.detectedFormat} inference requires specific implementation`);
      
      this.loaded = true;
      this.loading = false;
      this.metrics.loadTime = Date.now();
      
      logger.success(`✅ Binary model registered: ${this.name} (${this.detectedFormat})`);
    } catch (error) {
      this.error = error;
      this.loading = false;
      logger.error(`❌ Failed to load Binary model: ${error.message}`);
      throw error;
    }
  }

  async unload() {
    if (!this.loaded) return;
    
    logger.info(`📦 Unloading Binary model: ${this.name}`);
    
    this.model = null;
    this.modelConfig = null;
    this.loaded = false;
    
    logger.success(`✅ Binary model unloaded: ${this.name}`);
  }

  async generate(prompt, options = {}) {
    if (!this.loaded) {
      throw new Error('Model not loaded');
    }
    
    const config = {
      maxLength: options.maxLength || this.maxLength,
      temperature: options.temperature || this.temperature,
      topP: options.topP || this.topP,
      ...options
    };
    
    logger.info(`📦 Generating with Binary model: ${this.name}`);
    
    // Provide format-specific guidance
    let guidance = '';
    switch (this.detectedFormat) {
      case 'pytorch':
        guidance = 'This appears to be a PyTorch model. Consider using the PyTorchLoader for better support.';
        break;
      case 'onnx':
        guidance = 'This appears to be an ONNX model. Consider using the ONNXLoader for inference.';
        break;
      case 'tensorflow':
        guidance = 'This appears to be a TensorFlow model. TensorFlow.js support can be added.';
        break;
      case 'ggml':
        guidance = 'This appears to be a GGML model. Consider converting to GGUF format.';
        break;
      default:
        guidance = 'Format detection can be improved with model metadata.';
    }
    
    // Placeholder response with model information
    const response = {
      text: `[Binary Model Response - Format: ${this.detectedFormat}]\n` +
            `Model: ${this.name}\n` +
            `Size: ${this.modelMetadata.sizeInMB} MB\n` +
            `Type: ${this.modelType || 'Unknown'}\n` +
            `Prompt: ${prompt}\n\n` +
            `Note: ${guidance}`,
      usage: {
        promptTokens: prompt.length / 4,
        completionTokens: 75,
        totalTokens: prompt.length / 4 + 75
      },
      model: this.name,
      metadata: this.modelMetadata
    };
    
    // Update metrics
    this.metrics.inferenceCount++;
    this.metrics.totalTokens += response.usage.totalTokens;
    this.metrics.lastUsed = new Date().toISOString();
    
    return response;
  }

  async *stream(prompt, options = {}) {
    if (!this.loaded) {
      throw new Error('Model not loaded');
    }
    
    logger.info(`📦 Streaming with Binary model: ${this.name}`);
    
    // Placeholder streaming implementation
    const info = `[Binary Model Streaming - ${this.detectedFormat} format detected]`;
    const words = info.split(' ');
    
    for (const word of words) {
      yield {
        token: word + ' ',
        done: false
      };
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    yield { done: true };
  }

  getInfo() {
    return {
      ...super.getInfo(),
      format: 'binary',
      detectedFormat: this.detectedFormat,
      modelType: this.modelType,
      architectures: this.architectures,
      metadata: this.modelMetadata,
      modelConfig: this.modelConfig,
      capabilities: {
        ...this.capabilities,
        streaming: true,
        formats: ['.bin']
      }
    };
  }
}

/**
 * Binary Loader - Handles generic .bin files
 */
class BinaryLoader extends BaseLoader {
  constructor(config = {}) {
    super();
    this.config = config;
    this.models = new Map();
  }

  supportsFormat(format) {
    return format === 'binary' || format === 'bin';
  }

  /**
   * Check if this loader can handle the given source
   */
  canHandle(source) {
    if (typeof source === 'string') {
      return source.toLowerCase().endsWith('.bin');
    }
    return source?.format === 'binary' || source?.format === 'bin';
  }

  /**
   * Load a Binary model
   */
  async load(source, options = {}) {
    logger.info('📦 BinaryLoader: Loading model from source', { source });
    
    const modelConfig = {
      id: options.id || `binary-${Date.now()}`,
      name: options.name || path.basename(source, '.bin'),
      source: source,
      path: source,
      format: 'binary',
      ...options
    };
    
    const model = new BinaryModel(modelConfig);
    await model.load();
    
    this.models.set(model.id, model);
    return model;
  }

  /**
   * Unload a model
   */
  async unload(modelId) {
    const model = this.models.get(modelId);
    if (model) {
      await model.unload();
      this.models.delete(modelId);
    }
  }

  /**
   * Get all loaded models
   */
  getModels() {
    return Array.from(this.models.values());
  }

  /**
   * Get loader info
   */
  getInfo() {
    return {
      name: 'BinaryLoader',
      version: '1.0.0',
      formats: ['.bin'],
      capabilities: {
        streaming: true,
        quantization: false,
        formatDetection: true,
        metadataExtraction: true
      },
      supportedFormats: [
        'pytorch_model.bin',
        'tf_model.bin',
        'flax_model.bin',
        'model.bin',
        'weights.bin'
      ],
      modelsLoaded: this.models.size
    };
  }
}

export default BinaryLoader;
export { BinaryLoader };
