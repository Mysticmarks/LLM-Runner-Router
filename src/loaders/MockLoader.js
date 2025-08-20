/**
 * Mock Model Loader - For testing without native dependencies
 */

import { ModelInterface } from '../core/ModelInterface.js';
import { BaseLoader } from './BaseLoader.js';
import { Logger } from '../utils/Logger.js';

const logger = new Logger('MockLoader');

/**
 * Mock Model - Returns predefined responses for testing
 */
class MockModel extends ModelInterface {
  constructor(config) {
    super(config);
    this.format = 'mock';
    this.responses = [
      "I'm a mock model running on your LLM Router. The actual model requires node-llama-cpp to be installed.",
      "This is a test response from the mock model. Your router is working correctly!",
      "The LLM Router is successfully routing requests. To use real models, install node-llama-cpp.",
      "Mock model response: Everything is functioning as expected on the router side."
    ];
    this.responseIndex = 0;
  }

  async load() {
    if (this.loaded) return;
    
    logger.info(`Loading mock model: ${this.name}`);
    this.loading = true;
    
    // Simulate loading time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.loaded = true;
    this.loading = false;
    this.metrics.loadTime = Date.now();
    
    logger.info(`✅ Mock model loaded: ${this.name}`);
    this.emit('loaded', this);
  }

  async unload() {
    if (!this.loaded) return;
    
    this.loaded = false;
    logger.info(`Mock model unloaded: ${this.name}`);
    this.emit('unloaded', this);
  }

  async infer(input, options = {}) {
    if (!this.loaded) {
      throw new Error('Model not loaded');
    }

    const startTime = Date.now();
    
    // Simulate inference time
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Rotate through responses
    const response = this.responses[this.responseIndex];
    this.responseIndex = (this.responseIndex + 1) % this.responses.length;
    
    // Update metrics
    this.metrics.inferenceCount++;
    this.metrics.lastUsed = Date.now();
    const latency = Date.now() - startTime;
    this.metrics.avgLatency = (this.metrics.avgLatency * (this.metrics.inferenceCount - 1) + latency) / this.metrics.inferenceCount;
    
    return {
      text: response,
      tokens: response.split(' ').length,
      latency: latency,
      model: this.name
    };
  }

  async *stream(input, options = {}) {
    if (!this.loaded) {
      throw new Error('Model not loaded');
    }

    const response = this.responses[this.responseIndex];
    this.responseIndex = (this.responseIndex + 1) % this.responses.length;
    
    // Simulate streaming by yielding words one at a time
    const words = response.split(' ');
    for (const word of words) {
      await new Promise(resolve => setTimeout(resolve, 50));
      yield word + ' ';
    }
  }

  // Alias for compatibility
  async generate(input, options = {}) {
    return this.infer(input, options);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      format: this.format,
      loaded: this.loaded,
      capabilities: this.capabilities,
      metrics: this.metrics
    };
  }
}

/**
 * Mock Loader - Creates mock models for testing
 */
class MockLoader extends BaseLoader {
  constructor() {
    super();
    this.format = 'mock';
    this.models = new Map();
  }

  static extensions = ['.mock', '.test'];

  supportsFormat(format) {
    return format === 'mock' || format === 'test';
  }

  canLoad(source) {
    return source.includes('mock') || source.includes('test');
  }

  async load(source, config = {}) {
    logger.info(`Creating mock model from: ${source}`);
    
    const modelConfig = {
      ...config,
      source,
      format: 'mock',
      capabilities: {
        streaming: true,
        batching: false,
        quantization: false,
        embedding: false,
        completion: true
      }
    };
    
    const model = new MockModel(modelConfig);
    await model.load();
    
    this.models.set(model.id, model);
    return model;
  }

  async unload(modelId) {
    const model = this.models.get(modelId);
    if (model) {
      await model.unload();
      this.models.delete(modelId);
    }
  }

  createModel(data) {
    logger.info('Creating mock model from data:', data);
    return new MockModel(data);
  }
}
export default MockLoader;
export { MockLoader };
