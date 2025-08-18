# 🔧 Custom Model Loaders Development Guide

*Master the art of creating custom model loaders for any AI model format*

## 📖 Table of Contents

- [Loader Architecture Overview](#loader-architecture-overview)
- [Base Loader Implementation](#base-loader-implementation)
- [Model Format Analysis](#model-format-analysis)
- [Creating Your First Custom Loader](#creating-your-first-custom-loader)
- [Advanced Loader Features](#advanced-loader-features)
- [Performance Optimization](#performance-optimization)
- [Error Handling and Validation](#error-handling-and-validation)
- [Testing Your Loader](#testing-your-loader)
- [Integration with LLM Router](#integration-with-llm-router)
- [Real-World Examples](#real-world-examples)
- [Best Practices](#best-practices)
- [Troubleshooting Guide](#troubleshooting-guide)

## 🏗️ Loader Architecture Overview

### Loader Hierarchy

```
BaseLoader (Abstract)
├── FormatSpecificLoader (Your Custom Loader)
│   ├── ModelValidator
│   ├── ModelParser  
│   ├── RuntimeAdapter
│   └── InferenceEngine
├── QuantizedModelLoader (Optional Extension)
├── StreamingModelLoader (Optional Extension)
└── DistributedModelLoader (Optional Extension)
```

### Core Loader Responsibilities

```javascript
class LoaderResponsibilities {
  static getResponsibilities() {
    return {
      modelDetection: {
        description: 'Identify if a model matches this loader',
        methods: ['supportsFormat', 'canLoad', 'detectFormat']
      },
      
      modelLoading: {
        description: 'Load model into memory and prepare for inference',
        methods: ['load', 'initialize', 'validate']
      },
      
      modelInference: {
        description: 'Execute model predictions',
        methods: ['generate', 'stream', 'batch']
      },
      
      modelLifecycle: {
        description: 'Manage model lifecycle',
        methods: ['unload', 'cleanup', 'getInfo']
      },
      
      errorHandling: {
        description: 'Handle errors gracefully',
        methods: ['validateInput', 'handleError', 'recover']
      }
    };
  }
}
```

## 🔧 Base Loader Implementation

### Understanding BaseLoader

```javascript
// src/loaders/BaseLoader.js - Reference Implementation
import { EventEmitter } from 'events';
import Logger from '../utils/Logger.js';

/**
 * Abstract base class for all model loaders
 * All custom loaders MUST extend this class
 */
class BaseLoader extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.loaded = false;
    this.model = null;
    this.logger = new Logger(`${this.constructor.name}`);
  }

  /**
   * Load a model from the specified source
   * @abstract
   * @param {string|object} source - Model source (path, URL, or config)
   * @param {object} options - Loading options
   * @returns {Promise<object>} Loaded model object
   */
  async load(source, options = {}) {
    throw new Error('load() must be implemented by subclass');
  }

  /**
   * Generate text from a prompt
   * @abstract
   * @param {string} prompt - Input prompt
   * @param {object} options - Generation options
   * @returns {Promise<object>} Generation result
   */
  async generate(prompt, options = {}) {
    throw new Error('generate() must be implemented by subclass');
  }

  /**
   * Stream tokens from the model
   * @abstract
   * @param {string} prompt - Input prompt
   * @param {object} options - Streaming options
   * @returns {AsyncGenerator} Token stream
   */
  async *stream(prompt, options = {}) {
    throw new Error('stream() must be implemented by subclass');
  }

  /**
   * Check if a model format is supported
   * @abstract
   * @param {string} format - Model format
   * @returns {boolean} Whether format is supported
   */
  supportsFormat(format) {
    return false;
  }

  /**
   * Get loader capabilities
   * @returns {object} Loader capabilities
   */
  getCapabilities() {
    return {
      streaming: false,
      quantization: false,
      gpu: false,
      formats: []
    };
  }

  // ... Additional base methods
}
```

### Custom Loader Template

```javascript
// src/loaders/YourCustomLoader.js - Template
import BaseLoader from './BaseLoader.js';
import { YourModelLibrary } from 'your-model-library';

class YourCustomLoader extends BaseLoader {
  constructor(config = {}) {
    super(config);
    
    // Loader-specific configuration
    this.supportedFormats = ['your-format', 'your-format-v2'];
    this.defaultOptions = {
      precision: 'float32',
      device: 'auto',
      ...config
    };
  }

  /**
   * Check if this loader supports the given format
   */
  supportsFormat(format) {
    return this.supportedFormats.includes(format.toLowerCase());
  }

  /**
   * Validate if we can load this specific model
   */
  async canLoad(source) {
    try {
      // Quick validation without full loading
      const metadata = await this.getModelMetadata(source);
      return this.supportsFormat(metadata.format);
    } catch (error) {
      return false;
    }
  }

  /**
   * Load the model
   */
  async load(source, options = {}) {
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    try {
      this.logger.info(`Loading model from: ${source}`);
      
      // 1. Validate source
      await this.validateSource(source);
      
      // 2. Load model using your library
      this.model = await YourModelLibrary.load(source, mergedOptions);
      
      // 3. Initialize model
      await this.initializeModel(mergedOptions);
      
      // 4. Validate loaded model
      await this.validateLoadedModel();
      
      this.loaded = true;
      this.emit('loaded', { source, options: mergedOptions });
      
      this.logger.info('Model loaded successfully');
      return this.getModelInfo();
      
    } catch (error) {
      this.logger.error('Failed to load model:', error);
      throw new ModelLoadError(`Failed to load model: ${error.message}`, {
        source,
        options: mergedOptions,
        originalError: error
      });
    }
  }

  /**
   * Generate text
   */
  async generate(prompt, options = {}) {
    if (!this.loaded) {
      throw new Error('Model not loaded');
    }

    try {
      const result = await this.model.generate(prompt, options);
      
      return {
        text: result.text,
        tokens: result.tokens || this.estimateTokenCount(result.text),
        finishReason: result.finishReason || 'completed',
        metadata: {
          model: this.getModelInfo().name,
          loader: this.constructor.name,
          generationTime: result.generationTime
        }
      };
    } catch (error) {
      throw new GenerationError(`Generation failed: ${error.message}`, {
        prompt,
        options,
        originalError: error
      });
    }
  }

  /**
   * Stream tokens
   */
  async *stream(prompt, options = {}) {
    if (!this.loaded) {
      throw new Error('Model not loaded');
    }

    try {
      const stream = this.model.stream(prompt, options);
      
      for await (const token of stream) {
        yield {
          token: token.text || token,
          logprob: token.logprob,
          finished: token.finished || false,
          metadata: token.metadata
        };
      }
    } catch (error) {
      throw new StreamingError(`Streaming failed: ${error.message}`, {
        prompt,
        options,
        originalError: error
      });
    }
  }

  /**
   * Get model capabilities
   */
  getCapabilities() {
    return {
      streaming: true,
      quantization: true,
      gpu: true,
      formats: this.supportedFormats,
      maxContextLength: this.model?.config?.maxContextLength || 4096,
      
      // Your format-specific capabilities
      customFeatures: {
        multimodal: false,
        fineTuning: true,
        embedding: false
      }
    };
  }

  // Helper methods (implement these based on your model format)
  
  async validateSource(source) {
    // Implement source validation
  }
  
  async getModelMetadata(source) {
    // Implement metadata extraction
  }
  
  async initializeModel(options) {
    // Implement model initialization
  }
  
  async validateLoadedModel() {
    // Implement post-load validation
  }
}

export default YourCustomLoader;
```

## 🔍 Model Format Analysis

### Understanding Your Model Format

Before creating a loader, you need to understand your model format:

```javascript
class ModelFormatAnalyzer {
  static async analyzeFormat(modelPath) {
    const analysis = {
      fileStructure: await this.analyzeFileStructure(modelPath),
      metadata: await this.extractMetadata(modelPath),
      dependencies: await this.identifyDependencies(modelPath),
      characteristics: await this.analyzeCharacteristics(modelPath)
    };
    
    return {
      ...analysis,
      loaderRequirements: this.determineLoaderRequirements(analysis),
      implementationStrategy: this.suggestImplementationStrategy(analysis)
    };
  }
  
  static async analyzeFileStructure(modelPath) {
    const stats = await fs.stat(modelPath);
    
    if (stats.isFile()) {
      return {
        type: 'single_file',
        size: stats.size,
        extension: path.extname(modelPath),
        format: await this.detectFileFormat(modelPath)
      };
    } else if (stats.isDirectory()) {
      const files = await fs.readdir(modelPath, { withFileTypes: true });
      
      return {
        type: 'directory',
        files: files.map(f => ({
          name: f.name,
          type: f.isDirectory() ? 'directory' : 'file',
          size: f.isFile() ? fs.statSync(path.join(modelPath, f.name)).size : null
        })),
        structure: await this.analyzeDirectoryStructure(modelPath)
      };
    }
  }
  
  static async detectFileFormat(filePath) {
    const buffer = await fs.readFile(filePath, { start: 0, end: 1024 });
    
    // Magic number detection
    const magicNumbers = {
      'GGUF': [0x47, 0x47, 0x55, 0x46], // "GGUF"
      'ONNX': [0x08, 0x01, 0x12], // ONNX protobuf signature
      'PyTorch': [0x50, 0x4B], // ZIP signature (PyTorch uses ZIP)
      'TensorFlow': [0x08, 0x03] // TensorFlow SavedModel
    };
    
    for (const [format, signature] of Object.entries(magicNumbers)) {
      if (this.matchesSignature(buffer, signature)) {
        return format;
      }
    }
    
    // Fallback to extension-based detection
    const ext = path.extname(filePath).toLowerCase();
    const extensionMap = {
      '.gguf': 'GGUF',
      '.onnx': 'ONNX', 
      '.pt': 'PyTorch',
      '.pth': 'PyTorch',
      '.safetensors': 'Safetensors',
      '.bin': 'Binary'
    };
    
    return extensionMap[ext] || 'Unknown';
  }
  
  static determineLoaderRequirements(analysis) {
    const requirements = {
      dependencies: [],
      runtime: 'node',
      memory: 'standard',
      specialFeatures: []
    };
    
    // Determine based on format
    switch (analysis.metadata.format) {
      case 'GGUF':
        requirements.dependencies.push('node-llama-cpp');
        requirements.memory = 'high';
        requirements.specialFeatures.push('quantization');
        break;
        
      case 'ONNX':
        requirements.dependencies.push('onnxruntime-node');
        requirements.specialFeatures.push('gpu_acceleration');
        break;
        
      case 'PyTorch':
        requirements.dependencies.push('pytorch-bindings');
        requirements.runtime = 'python_bridge';
        break;
    }
    
    return requirements;
  }
}
```

### Creating Format-Specific Parsers

```javascript
class ModelParser {
  constructor(format) {
    this.format = format;
    this.parsers = {
      'GGUF': new GGUFParser(),
      'ONNX': new ONNXParser(),
      'Custom': new YourCustomParser()
    };
  }
  
  async parseModel(modelPath) {
    const parser = this.parsers[this.format];
    if (!parser) {
      throw new Error(`No parser available for format: ${this.format}`);
    }
    
    return await parser.parse(modelPath);
  }
}

class YourCustomParser {
  async parse(modelPath) {
    const modelData = await this.readModelFile(modelPath);
    
    return {
      architecture: await this.parseArchitecture(modelData),
      weights: await this.parseWeights(modelData),
      vocabulary: await this.parseVocabulary(modelData),
      metadata: await this.parseMetadata(modelData)
    };
  }
  
  async parseArchitecture(modelData) {
    // Parse model architecture from your format
    return {
      type: 'transformer', // or 'cnn', 'rnn', etc.
      layers: [], // Layer definitions
      parameters: {}, // Model parameters
      config: {} // Architecture configuration
    };
  }
  
  async parseWeights(modelData) {
    // Extract model weights/parameters
    return {
      tensors: new Map(), // Weight tensors
      quantization: null, // Quantization info
      sharding: null // Sharding info if applicable
    };
  }
  
  async parseVocabulary(modelData) {
    // Extract tokenizer/vocabulary if embedded
    return {
      tokens: [], // Token list
      type: 'bpe', // Tokenizer type
      specialTokens: {}, // Special tokens
      merges: [] // BPE merges if applicable
    };
  }
}
```

## 🚀 Creating Your First Custom Loader

### Step-by-Step Implementation

Let's create a custom loader for a hypothetical "MyModel" format:

```javascript
// src/loaders/MyModelLoader.js
import BaseLoader from './BaseLoader.js';
import fs from 'fs/promises';
import path from 'path';

class MyModelLoader extends BaseLoader {
  constructor(config = {}) {
    super(config);
    
    this.supportedFormats = ['mymodel', 'mml'];
    this.loadedTensors = new Map();
    this.tokenizer = null;
    
    // Configuration specific to MyModel format
    this.config = {
      batchSize: 1,
      maxSequenceLength: 2048,
      temperature: 0.7,
      topP: 0.9,
      ...config
    };
  }

  supportsFormat(format) {
    return this.supportedFormats.includes(format.toLowerCase());
  }

  async canLoad(source) {
    try {
      // Quick format check
      if (typeof source === 'string') {
        const ext = path.extname(source).toLowerCase();
        if (ext === '.mml') return true;
        
        // Check magic number for .mymodel files
        const buffer = await fs.readFile(source, { start: 0, end: 8 });
        return buffer.toString('ascii', 0, 7) === 'MYMODEL';
      }
      
      return false;
    } catch {
      return false;
    }
  }

  async load(source, options = {}) {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Loading MyModel from: ${source}`);
      
      // Step 1: Validate and read model file
      const modelData = await this.readModelFile(source);
      
      // Step 2: Parse model structure
      const parsedModel = await this.parseModel(modelData);
      
      // Step 3: Load tensors into memory
      await this.loadTensors(parsedModel.weights);
      
      // Step 4: Initialize tokenizer
      this.tokenizer = await this.initializeTokenizer(parsedModel.vocabulary);
      
      // Step 5: Setup inference engine
      await this.setupInferenceEngine(parsedModel.architecture);
      
      // Step 6: Validate everything works
      await this.validateSetup();
      
      this.loaded = true;
      this.model = {
        name: parsedModel.metadata.name,
        version: parsedModel.metadata.version,
        parameters: parsedModel.metadata.parameters,
        architecture: parsedModel.architecture
      };
      
      const loadTime = Date.now() - startTime;
      this.logger.info(`MyModel loaded successfully in ${loadTime}ms`);
      
      this.emit('loaded', {
        source,
        loadTime,
        modelInfo: this.model
      });
      
      return this.getModelInfo();
      
    } catch (error) {
      this.logger.error('Failed to load MyModel:', error);
      throw new Error(`MyModel load failed: ${error.message}`);
    }
  }

  async readModelFile(source) {
    const buffer = await fs.readFile(source);
    
    // Validate magic number
    const magic = buffer.toString('ascii', 0, 7);
    if (magic !== 'MYMODEL') {
      throw new Error('Invalid MyModel file: missing magic number');
    }
    
    // Read version
    const version = buffer.readUInt32LE(8);
    if (version > 1) {
      throw new Error(`Unsupported MyModel version: ${version}`);
    }
    
    return {
      buffer,
      version,
      dataOffset: 12 // Start of actual model data
    };
  }

  async parseModel(modelData) {
    const { buffer, dataOffset } = modelData;
    let offset = dataOffset;
    
    // Parse header
    const headerSize = buffer.readUInt32LE(offset);
    offset += 4;
    
    const headerJson = buffer.toString('utf8', offset, offset + headerSize);
    const header = JSON.parse(headerJson);
    offset += headerSize;
    
    // Parse tensors
    const tensors = await this.parseTensors(buffer, offset, header.tensors);
    
    return {
      metadata: header.metadata,
      architecture: header.architecture,
      vocabulary: header.vocabulary,
      weights: tensors
    };
  }

  async parseTensors(buffer, offset, tensorInfos) {
    const tensors = new Map();
    
    for (const tensorInfo of tensorInfos) {
      const tensor = await this.parseTensor(buffer, offset, tensorInfo);
      tensors.set(tensorInfo.name, tensor);
      offset += tensorInfo.size;
    }
    
    return tensors;
  }

  async parseTensor(buffer, offset, tensorInfo) {
    const { name, shape, dtype, size } = tensorInfo;
    
    // Extract tensor data based on dtype
    let data;
    switch (dtype) {
      case 'float32':
        data = new Float32Array(
          buffer.buffer,
          buffer.byteOffset + offset,
          size / 4
        );
        break;
      case 'int32':
        data = new Int32Array(
          buffer.buffer,
          buffer.byteOffset + offset,
          size / 4
        );
        break;
      default:
        throw new Error(`Unsupported tensor dtype: ${dtype}`);
    }
    
    return {
      name,
      shape,
      dtype,
      data
    };
  }

  async loadTensors(tensors) {
    this.logger.info(`Loading ${tensors.size} tensors...`);
    
    for (const [name, tensor] of tensors) {
      // Convert to your preferred tensor format
      const processedTensor = await this.processTensor(tensor);
      this.loadedTensors.set(name, processedTensor);
    }
    
    this.logger.info('All tensors loaded successfully');
  }

  async processTensor(tensor) {
    // Process tensor for your inference engine
    // This might involve reshaping, quantization, GPU upload, etc.
    return {
      ...tensor,
      processed: true,
      processedAt: Date.now()
    };
  }

  async initializeTokenizer(vocabulary) {
    this.logger.info('Initializing tokenizer...');
    
    // Create tokenizer from vocabulary
    const tokenizer = new MyModelTokenizer({
      vocabulary: vocabulary.tokens,
      specialTokens: vocabulary.specialTokens,
      type: vocabulary.type
    });
    
    await tokenizer.initialize();
    return tokenizer;
  }

  async setupInferenceEngine(architecture) {
    this.logger.info('Setting up inference engine...');
    
    // Setup your inference engine based on architecture
    this.inferenceEngine = new MyModelInferenceEngine({
      architecture,
      tensors: this.loadedTensors,
      config: this.config
    });
    
    await this.inferenceEngine.initialize();
  }

  async validateSetup() {
    // Run a simple test to ensure everything works
    const testPrompt = "Test";
    const testTokens = await this.tokenizer.encode(testPrompt);
    
    if (testTokens.length === 0) {
      throw new Error('Tokenizer validation failed');
    }
    
    // Test inference engine
    const testOutput = await this.inferenceEngine.forward(testTokens);
    
    if (!testOutput || testOutput.length === 0) {
      throw new Error('Inference engine validation failed');
    }
    
    this.logger.info('Setup validation passed');
  }

  async generate(prompt, options = {}) {
    if (!this.loaded) {
      throw new Error('Model not loaded');
    }

    const startTime = Date.now();
    
    try {
      // Tokenize input
      const tokens = await this.tokenizer.encode(prompt);
      
      // Generate
      const outputTokens = await this.inferenceEngine.generate(tokens, {
        maxTokens: options.maxTokens || 100,
        temperature: options.temperature || this.config.temperature,
        topP: options.topP || this.config.topP,
        stopTokens: options.stopTokens || []
      });
      
      // Decode output
      const text = await this.tokenizer.decode(outputTokens);
      
      const generationTime = Date.now() - startTime;
      
      return {
        text,
        tokens: outputTokens.length,
        finishReason: 'completed', // Determine actual reason
        metadata: {
          model: this.model.name,
          loader: 'MyModelLoader',
          generationTime,
          inputTokens: tokens.length,
          outputTokens: outputTokens.length
        }
      };
      
    } catch (error) {
      this.logger.error('Generation failed:', error);
      throw error;
    }
  }

  async *stream(prompt, options = {}) {
    if (!this.loaded) {
      throw new Error('Model not loaded');
    }

    try {
      const tokens = await this.tokenizer.encode(prompt);
      
      // Create streaming generator
      const stream = this.inferenceEngine.stream(tokens, options);
      
      for await (const tokenId of stream) {
        const token = await this.tokenizer.decode([tokenId]);
        
        yield {
          token,
          logprob: stream.getLogprob(tokenId),
          finished: stream.isFinished(),
          metadata: {
            tokenId,
            position: stream.getPosition()
          }
        };
        
        if (stream.isFinished()) break;
      }
      
    } catch (error) {
      this.logger.error('Streaming failed:', error);
      throw error;
    }
  }

  async unload() {
    if (!this.loaded) return;
    
    this.logger.info('Unloading MyModel...');
    
    // Cleanup resources
    if (this.inferenceEngine) {
      await this.inferenceEngine.cleanup();
    }
    
    if (this.tokenizer) {
      await this.tokenizer.cleanup();
    }
    
    this.loadedTensors.clear();
    this.loaded = false;
    this.model = null;
    
    this.emit('unloaded');
    this.logger.info('MyModel unloaded successfully');
  }

  getModelInfo() {
    if (!this.loaded) return null;
    
    return {
      ...this.model,
      loaded: true,
      format: 'MyModel',
      capabilities: this.getCapabilities(),
      memoryUsage: this.getMemoryUsage(),
      performance: this.getPerformanceMetrics()
    };
  }

  getCapabilities() {
    return {
      streaming: true,
      quantization: false, // Implement if your format supports it
      gpu: false, // Implement if you support GPU
      formats: this.supportedFormats,
      maxContextLength: this.config.maxSequenceLength,
      
      // Custom capabilities
      customFeatures: {
        multimodal: false,
        fineTuning: false,
        embedding: false
      }
    };
  }

  getMemoryUsage() {
    let totalMemory = 0;
    
    for (const tensor of this.loadedTensors.values()) {
      totalMemory += tensor.data.byteLength;
    }
    
    return {
      tensors: totalMemory,
      tokenizer: this.tokenizer?.getMemoryUsage() || 0,
      engine: this.inferenceEngine?.getMemoryUsage() || 0,
      total: totalMemory
    };
  }

  getPerformanceMetrics() {
    return {
      averageLatency: this.inferenceEngine?.getAverageLatency() || 0,
      throughput: this.inferenceEngine?.getThroughput() || 0,
      cacheHitRate: this.inferenceEngine?.getCacheHitRate() || 0
    };
  }
}

// Supporting classes
class MyModelTokenizer {
  constructor(config) {
    this.vocabulary = config.vocabulary;
    this.specialTokens = config.specialTokens;
    this.type = config.type;
  }

  async initialize() {
    // Initialize tokenizer
  }

  async encode(text) {
    // Implement tokenization
    return [];
  }

  async decode(tokens) {
    // Implement detokenization
    return '';
  }

  async cleanup() {
    // Cleanup resources
  }

  getMemoryUsage() {
    return 0; // Calculate actual usage
  }
}

class MyModelInferenceEngine {
  constructor(config) {
    this.architecture = config.architecture;
    this.tensors = config.tensors;
    this.config = config;
  }

  async initialize() {
    // Initialize inference engine
  }

  async generate(tokens, options) {
    // Implement generation
    return [];
  }

  async *stream(tokens, options) {
    // Implement streaming generation
  }

  async forward(tokens) {
    // Implement forward pass
    return [];
  }

  async cleanup() {
    // Cleanup resources
  }

  getMemoryUsage() {
    return 0;
  }

  getAverageLatency() {
    return 0;
  }

  getThroughput() {
    return 0;
  }

  getCacheHitRate() {
    return 0;
  }
}

export default MyModelLoader;
```

## 🎯 Advanced Loader Features

### Quantization Support

```javascript
class QuantizedModelLoader extends BaseLoader {
  constructor(config = {}) {
    super(config);
    this.quantizationSchemes = {
      'int8': new Int8Quantizer(),
      'int4': new Int4Quantizer(),
      'dynamic': new DynamicQuantizer()
    };
  }

  async loadWithQuantization(source, quantizationScheme = 'int8') {
    const model = await this.load(source);
    
    if (this.isAlreadyQuantized(model)) {
      this.logger.info('Model is already quantized');
      return model;
    }
    
    this.logger.info(`Applying ${quantizationScheme} quantization...`);
    
    const quantizer = this.quantizationSchemes[quantizationScheme];
    if (!quantizer) {
      throw new Error(`Unsupported quantization scheme: ${quantizationScheme}`);
    }
    
    const quantizedModel = await quantizer.quantize(model);
    
    // Validate quantization didn't break the model
    await this.validateQuantization(model, quantizedModel);
    
    return quantizedModel;
  }

  async validateQuantization(original, quantized) {
    const testPrompt = "Test quantization accuracy";
    
    const originalOutput = await original.generate(testPrompt);
    const quantizedOutput = await quantized.generate(testPrompt);
    
    const similarity = this.calculateSimilarity(
      originalOutput.text,
      quantizedOutput.text
    );
    
    if (similarity < 0.8) {
      this.logger.warn(`Quantization may have degraded quality: ${similarity}`);
    } else {
      this.logger.info(`Quantization validated: ${similarity} similarity`);
    }
  }
}
```

### Streaming Optimization

```javascript
class StreamingOptimizedLoader extends BaseLoader {
  constructor(config = {}) {
    super(config);
    this.streamingConfig = {
      bufferSize: config.bufferSize || 8192,
      prefetchTokens: config.prefetchTokens || 10,
      adaptiveBuffering: config.adaptiveBuffering || true
    };
  }

  async *stream(prompt, options = {}) {
    const streamConfig = { ...this.streamingConfig, ...options };
    
    // Initialize streaming session
    const session = await this.createStreamingSession(prompt, streamConfig);
    
    try {
      let buffer = [];
      let tokenCount = 0;
      
      for await (const rawToken of session.generate()) {
        const processedToken = await this.processStreamToken(rawToken);
        
        if (streamConfig.adaptiveBuffering) {
          buffer.push(processedToken);
          
          // Adaptive yield based on content
          const shouldYield = this.shouldYieldBuffer(buffer, tokenCount);
          
          if (shouldYield) {
            yield this.combineTokens(buffer);
            buffer = [];
          }
        } else {
          yield processedToken;
        }
        
        tokenCount++;
        
        // Handle backpressure
        if (tokenCount % 100 === 0) {
          await this.handleBackpressure(session);
        }
      }
      
      // Yield remaining buffer
      if (buffer.length > 0) {
        yield this.combineTokens(buffer);
      }
      
    } finally {
      await session.cleanup();
    }
  }

  shouldYieldBuffer(buffer, tokenCount) {
    // Yield on sentence boundaries
    const lastToken = buffer[buffer.length - 1];
    if (lastToken?.token?.includes('.') || lastToken?.token?.includes('!')) {
      return true;
    }
    
    // Yield when buffer is full
    if (buffer.length >= this.streamingConfig.bufferSize) {
      return true;
    }
    
    // Yield periodically to maintain responsiveness
    if (tokenCount % 50 === 0) {
      return true;
    }
    
    return false;
  }

  async handleBackpressure(session) {
    // Check if consumer is keeping up
    const queueSize = session.getQueueSize();
    
    if (queueSize > 1000) {
      // Slow down generation
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}
```

### Distributed Model Loading

```javascript
class DistributedModelLoader extends BaseLoader {
  constructor(config = {}) {
    super(config);
    this.shardManager = new ModelShardManager();
    this.nodeManager = new NodeManager();
  }

  async loadDistributed(source, nodes) {
    this.logger.info(`Loading model across ${nodes.length} nodes`);
    
    // Analyze model for optimal sharding
    const shardingPlan = await this.analyzeForSharding(source);
    
    // Create shards
    const shards = await this.createShards(source, shardingPlan);
    
    // Distribute shards across nodes
    const distribution = await this.distributeShards(shards, nodes);
    
    // Load shards on each node
    const loadPromises = distribution.map(({ node, shards }) =>
      this.loadShardsOnNode(node, shards)
    );
    
    await Promise.all(loadPromises);
    
    // Create coordination layer
    const coordinator = new DistributedModelCoordinator({
      nodes,
      distribution,
      shardingPlan
    });
    
    await coordinator.initialize();
    
    this.model = coordinator;
    this.loaded = true;
    
    return this.getModelInfo();
  }

  async analyzeForSharding(source) {
    const modelInfo = await this.getModelMetadata(source);
    
    return {
      strategy: this.selectShardingStrategy(modelInfo),
      shardCount: this.calculateOptimalShardCount(modelInfo),
      shardSize: this.calculateShardSize(modelInfo),
      dependencies: this.analyzeDependencies(modelInfo)
    };
  }

  selectShardingStrategy(modelInfo) {
    const modelSize = modelInfo.size;
    const parameterCount = modelInfo.parameters;
    
    if (parameterCount > 70e9) { // 70B+ parameters
      return 'pipeline_parallel';
    } else if (parameterCount > 7e9) { // 7B-70B parameters
      return 'tensor_parallel';
    } else {
      return 'data_parallel';
    }
  }
}
```

## 🧪 Testing Your Loader

### Comprehensive Test Suite

```javascript
// tests/loaders/MyModelLoader.test.js
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import MyModelLoader from '../../src/loaders/MyModelLoader.js';
import path from 'path';

describe('MyModelLoader', () => {
  let loader;
  const testModelPath = path.join(__dirname, 'fixtures', 'test-model.mml');
  
  beforeEach(() => {
    loader = new MyModelLoader();
  });
  
  afterEach(async () => {
    if (loader.loaded) {
      await loader.unload();
    }
  });

  describe('Format Detection', () => {
    test('should support mymodel format', () => {
      expect(loader.supportsFormat('mymodel')).toBe(true);
      expect(loader.supportsFormat('mml')).toBe(true);
      expect(loader.supportsFormat('unknown')).toBe(false);
    });

    test('should detect compatible models', async () => {
      const canLoad = await loader.canLoad(testModelPath);
      expect(canLoad).toBe(true);
    });

    test('should reject incompatible formats', async () => {
      const canLoad = await loader.canLoad('nonexistent.txt');
      expect(canLoad).toBe(false);
    });
  });

  describe('Model Loading', () => {
    test('should load model successfully', async () => {
      const modelInfo = await loader.load(testModelPath);
      
      expect(loader.loaded).toBe(true);
      expect(modelInfo).toHaveProperty('name');
      expect(modelInfo).toHaveProperty('parameters');
      expect(modelInfo.format).toBe('MyModel');
    });

    test('should handle loading errors gracefully', async () => {
      await expect(loader.load('nonexistent.mml'))
        .rejects
        .toThrow('MyModel load failed');
    });

    test('should emit loading events', async () => {
      const loadedPromise = new Promise(resolve => {
        loader.once('loaded', resolve);
      });
      
      await loader.load(testModelPath);
      
      const event = await loadedPromise;
      expect(event).toHaveProperty('source', testModelPath);
      expect(event).toHaveProperty('loadTime');
    });
  });

  describe('Text Generation', () => {
    beforeEach(async () => {
      await loader.load(testModelPath);
    });

    test('should generate text from prompt', async () => {
      const result = await loader.generate('Hello world');
      
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('tokens');
      expect(result).toHaveProperty('finishReason');
      expect(result).toHaveProperty('metadata');
      
      expect(typeof result.text).toBe('string');
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.tokens).toBeGreaterThan(0);
    });

    test('should respect generation options', async () => {
      const result = await loader.generate('Test', {
        maxTokens: 10,
        temperature: 0.5
      });
      
      expect(result.tokens).toBeLessThanOrEqual(10);
    });

    test('should handle empty prompts', async () => {
      await expect(loader.generate(''))
        .rejects
        .toThrow();
    });
  });

  describe('Streaming Generation', () => {
    beforeEach(async () => {
      await loader.load(testModelPath);
    });

    test('should stream tokens', async () => {
      const tokens = [];
      
      for await (const token of loader.stream('Hello world')) {
        tokens.push(token);
        
        expect(token).toHaveProperty('token');
        expect(token).toHaveProperty('finished');
        
        if (tokens.length >= 10) break; // Limit test
      }
      
      expect(tokens.length).toBeGreaterThan(0);
    });

    test('should handle streaming errors', async () => {
      const stream = loader.stream('Invalid prompt that causes error');
      
      await expect(async () => {
        for await (const token of stream) {
          // This should throw
        }
      }).rejects.toThrow();
    });
  });

  describe('Model Information', () => {
    test('should return null info when not loaded', () => {
      const info = loader.getModelInfo();
      expect(info).toBeNull();
    });

    test('should return complete info when loaded', async () => {
      await loader.load(testModelPath);
      
      const info = loader.getModelInfo();
      
      expect(info).toHaveProperty('name');
      expect(info).toHaveProperty('loaded', true);
      expect(info).toHaveProperty('format', 'MyModel');
      expect(info).toHaveProperty('capabilities');
      expect(info).toHaveProperty('memoryUsage');
      expect(info).toHaveProperty('performance');
    });
  });

  describe('Capabilities', () => {
    test('should report correct capabilities', () => {
      const capabilities = loader.getCapabilities();
      
      expect(capabilities).toHaveProperty('streaming', true);
      expect(capabilities).toHaveProperty('formats');
      expect(capabilities.formats).toContain('mymodel');
    });
  });

  describe('Resource Management', () => {
    test('should clean up resources on unload', async () => {
      await loader.load(testModelPath);
      
      const memoryBefore = loader.getMemoryUsage();
      expect(memoryBefore.total).toBeGreaterThan(0);
      
      await loader.unload();
      
      expect(loader.loaded).toBe(false);
      expect(loader.getModelInfo()).toBeNull();
    });

    test('should emit unload events', async () => {
      await loader.load(testModelPath);
      
      const unloadedPromise = new Promise(resolve => {
        loader.once('unloaded', resolve);
      });
      
      await loader.unload();
      
      await unloadedPromise; // Should resolve without timeout
    });
  });

  describe('Error Handling', () => {
    test('should handle corrupted model files', async () => {
      const corruptedPath = path.join(__dirname, 'fixtures', 'corrupted.mml');
      
      await expect(loader.load(corruptedPath))
        .rejects
        .toThrow('Invalid MyModel file');
    });

    test('should handle generation on unloaded model', async () => {
      await expect(loader.generate('test'))
        .rejects
        .toThrow('Model not loaded');
    });
  });

  describe('Performance', () => {
    test('should load model within reasonable time', async () => {
      const startTime = Date.now();
      await loader.load(testModelPath);
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(30000); // 30 seconds max
    });

    test('should generate tokens efficiently', async () => {
      await loader.load(testModelPath);
      
      const startTime = Date.now();
      const result = await loader.generate('Performance test prompt');
      const generationTime = Date.now() - startTime;
      
      const tokensPerSecond = result.tokens / (generationTime / 1000);
      expect(tokensPerSecond).toBeGreaterThan(1); // At least 1 token/sec
    });
  });
});

// Integration tests
describe('MyModelLoader Integration', () => {
  test('should integrate with LLM Router', async () => {
    const { LLMRouter } = await import('../../src/index.js');
    
    const router = new LLMRouter();
    router.registerLoader(new MyModelLoader());
    
    const model = await router.load(testModelPath);
    const result = await router.generate('Integration test');
    
    expect(result).toHaveProperty('text');
  });
});
```

### Performance Benchmarks

```javascript
// benchmarks/MyModelLoader.benchmark.js
import { performance } from 'perf_hooks';
import MyModelLoader from '../src/loaders/MyModelLoader.js';

class LoaderBenchmark {
  constructor() {
    this.results = {
      loadTime: [],
      generationLatency: [],
      throughput: [],
      memoryUsage: []
    };
  }

  async runBenchmarks() {
    console.log('Running MyModelLoader benchmarks...');
    
    await this.benchmarkLoading();
    await this.benchmarkGeneration();
    await this.benchmarkThroughput();
    await this.benchmarkMemoryUsage();
    
    this.printResults();
  }

  async benchmarkLoading() {
    console.log('Benchmarking model loading...');
    
    for (let i = 0; i < 5; i++) {
      const loader = new MyModelLoader();
      
      const startTime = performance.now();
      await loader.load('test-model.mml');
      const loadTime = performance.now() - startTime;
      
      this.results.loadTime.push(loadTime);
      
      await loader.unload();
    }
  }

  async benchmarkGeneration() {
    console.log('Benchmarking text generation...');
    
    const loader = new MyModelLoader();
    await loader.load('test-model.mml');
    
    const prompts = [
      'Short prompt',
      'Medium length prompt with more context',
      'Very long prompt with extensive context that requires more processing time and memory usage'
    ];
    
    for (const prompt of prompts) {
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        await loader.generate(prompt, { maxTokens: 50 });
        const latency = performance.now() - startTime;
        
        this.results.generationLatency.push({
          prompt: prompt.length,
          latency
        });
      }
    }
    
    await loader.unload();
  }

  async benchmarkThroughput() {
    console.log('Benchmarking throughput...');
    
    const loader = new MyModelLoader();
    await loader.load('test-model.mml');
    
    const startTime = performance.now();
    let totalTokens = 0;
    
    for (let i = 0; i < 100; i++) {
      const result = await loader.generate('Throughput test', {
        maxTokens: 10
      });
      totalTokens += result.tokens;
    }
    
    const totalTime = (performance.now() - startTime) / 1000; // seconds
    const throughput = totalTokens / totalTime;
    
    this.results.throughput.push(throughput);
    
    await loader.unload();
  }

  async benchmarkMemoryUsage() {
    console.log('Benchmarking memory usage...');
    
    const baseline = process.memoryUsage();
    
    const loader = new MyModelLoader();
    await loader.load('test-model.mml');
    
    const loaded = process.memoryUsage();
    const loaderMemory = loader.getMemoryUsage();
    
    this.results.memoryUsage.push({
      processMemory: loaded.heapUsed - baseline.heapUsed,
      loaderMemory: loaderMemory.total,
      efficiency: loaderMemory.total / (loaded.heapUsed - baseline.heapUsed)
    });
    
    await loader.unload();
  }

  printResults() {
    console.log('\n=== Benchmark Results ===\n');
    
    const avgLoadTime = this.average(this.results.loadTime);
    console.log(`Average Load Time: ${avgLoadTime.toFixed(2)}ms`);
    
    const avgLatency = this.average(
      this.results.generationLatency.map(r => r.latency)
    );
    console.log(`Average Generation Latency: ${avgLatency.toFixed(2)}ms`);
    
    const avgThroughput = this.average(this.results.throughput);
    console.log(`Average Throughput: ${avgThroughput.toFixed(2)} tokens/sec`);
    
    const memUsage = this.results.memoryUsage[0];
    console.log(`Memory Usage: ${(memUsage.loaderMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Memory Efficiency: ${(memUsage.efficiency * 100).toFixed(1)}%`);
  }

  average(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}

// Run benchmarks
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmark = new LoaderBenchmark();
  await benchmark.runBenchmarks();
}
```

## 🔗 Integration with LLM Router

### Registering Your Loader

```javascript
// src/index.js - Router Integration
import { LLMRouter } from './core/Router.js';
import MyModelLoader from './loaders/MyModelLoader.js';

// Register your loader with the router
const router = new LLMRouter();
router.registerLoader(new MyModelLoader());

// Alternative: Register with configuration
router.registerLoader(new MyModelLoader({
  batchSize: 4,
  maxSequenceLength: 4096,
  temperature: 0.8
}));

// Use your loader through the router
const model = await router.load('model.mml');
const result = await router.generate('Hello from my custom loader!');
```

### Loader Priority and Selection

```javascript
// Configure loader priority
router.setLoaderPriority([
  'MyModelLoader',    // Try your loader first
  'GGUFLoader',       // Fallback to GGUF
  'ONNXLoader',       // Then ONNX
  'SimpleLoader'      // Last resort
]);

// Router will automatically select the best loader
const autoSelected = await router.load('ambiguous-model-file');
```

## 🎯 Best Practices

### Development Guidelines

1. **Follow the Interface Contract**
   ```javascript
   // Always implement required methods
   class YourLoader extends BaseLoader {
     async load(source, options) { /* Required */ }
     async generate(prompt, options) { /* Required */ }
     async *stream(prompt, options) { /* Required */ }
     supportsFormat(format) { /* Required */ }
     getCapabilities() { /* Required */ }
   }
   ```

2. **Implement Proper Error Handling**
   ```javascript
   try {
     const result = await this.model.generate(prompt);
     return this.formatResult(result);
   } catch (error) {
     // Log the error
     this.logger.error('Generation failed:', error);
     
     // Provide context
     throw new GenerationError(
       `Generation failed: ${error.message}`,
       { prompt, options, originalError: error }
     );
   }
   ```

3. **Use Events for Communication**
   ```javascript
   // Emit meaningful events
   this.emit('loadProgress', { percent: 50 });
   this.emit('loaded', { modelInfo });
   this.emit('generationStart', { prompt });
   this.emit('tokenGenerated', { token });
   this.emit('generationComplete', { result });
   ```

4. **Implement Resource Management**
   ```javascript
   async unload() {
     // Clean up in reverse order of creation
     if (this.inferenceEngine) {
       await this.inferenceEngine.cleanup();
       this.inferenceEngine = null;
     }
     
     if (this.tokenizer) {
       await this.tokenizer.cleanup();
       this.tokenizer = null;
     }
     
     // Clear large data structures
     this.loadedTensors.clear();
     
     // Mark as unloaded
     this.loaded = false;
     this.model = null;
     
     this.emit('unloaded');
   }
   ```

5. **Provide Detailed Metadata**
   ```javascript
   getModelInfo() {
     return {
       name: this.model.name,
       format: 'YourFormat',
       version: this.model.version,
       parameters: this.model.parameterCount,
       
       // Capabilities
       capabilities: this.getCapabilities(),
       
       // Performance metrics
       performance: {
         averageLatency: this.getAverageLatency(),
         throughput: this.getThroughput(),
         memoryUsage: this.getMemoryUsage()
       },
       
       // Configuration
       config: {
         maxContextLength: this.config.maxSequenceLength,
         temperature: this.config.temperature,
         topP: this.config.topP
       }
     };
   }
   ```

### Performance Optimization

1. **Lazy Loading**
   ```javascript
   async load(source, options) {
     // Load only essential components first
     await this.loadCore(source);
     
     // Defer optional components
     this.deferredInit = this.loadOptionalComponents();
     
     this.loaded = true;
   }
   
   async generate(prompt, options) {
     // Ensure optional components are loaded
     await this.deferredInit;
     
     return await this.model.generate(prompt, options);
   }
   ```

2. **Memory-Mapped Files**
   ```javascript
   async loadTensors(tensorInfo) {
     // Use memory mapping for large tensors
     if (tensorInfo.size > 100 * 1024 * 1024) { // 100MB
       return this.memoryMapTensor(tensorInfo);
     } else {
       return this.loadTensorToMemory(tensorInfo);
     }
   }
   ```

3. **Batching Support**
   ```javascript
   async generateBatch(prompts, options) {
     // Process multiple prompts efficiently
     const tokens = await Promise.all(
       prompts.map(p => this.tokenizer.encode(p))
     );
     
     const results = await this.model.generateBatch(tokens, options);
     
     return await Promise.all(
       results.map(r => this.tokenizer.decode(r))
     );
   }
   ```

---

## 📚 Additional Resources

- **[Base Loader API](./API_REFERENCE.md#base-loader)** - Complete API reference
- **[Model Formats Guide](./MODEL_FORMATS.md)** - Understanding different formats
- **[Performance Guide](./PERFORMANCE.md)** - Optimization strategies
- **[Testing Guide](./examples/testing.md)** - Testing best practices

---

*Remember: A good custom loader is not just about loading models—it's about providing a seamless, efficient, and reliable interface for AI inference.*

**Built with 💙 by Echo AI Systems**