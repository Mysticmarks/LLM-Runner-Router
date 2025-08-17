/**
 * 🚀 Processing Pipeline - Streamlined Flow Control
 * Echo AI Systems - Where data transforms into intelligence
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';

const logger = new Logger('Pipeline');

class Pipeline extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      maxConcurrent: 5,
      timeout: 30000,
      retries: 3,
      ...config
    };
    
    this.stages = [];
    this.queue = [];
    this.processing = new Map();
    this.cache = new Map();
    this.engine = null;
  }

  async initialize(engine) {
    this.engine = engine;
    logger.info('Pipeline initialized');
  }

  async process(model, prompt, options = {}) {
    const id = this.generateId();
    const startTime = Date.now();
    
    logger.debug(`Processing: ${id.slice(0, 8)}`);
    
    try {
      // Check cache
      const cacheKey = this.getCacheKey(model.id, prompt, options);
      if (options.cache !== false && this.cache.has(cacheKey)) {
        logger.debug('Cache hit');
        return this.cache.get(cacheKey);
      }
      
      // Pre-process
      const processed = await this.preProcess(prompt, options);
      
      // Inference
      const result = await this.executeWithRetry(
        () => model.generate(processed, options),
        this.config.retries
      );
      
      // Post-process
      const final = await this.postProcess(result, options);
      
      // Cache result
      if (options.cache !== false) {
        this.cache.set(cacheKey, final);
        setTimeout(() => this.cache.delete(cacheKey), 3600000); // 1hr TTL
      }
      
      // Update metrics
      model.updateMetrics(startTime, final.tokens || 0);
      
      this.emit('processed', { id, duration: Date.now() - startTime });
      return final;
      
    } catch (error) {
      logger.error(`Pipeline error: ${error.message}`);
      this.emit('error', { id, error });
      throw error;
    }
  }

  async *stream(model, prompt, options = {}) {
    const id = this.generateId();
    logger.debug(`Streaming: ${id.slice(0, 8)}`);
    
    try {
      const processed = await this.preProcess(prompt, options);
      const stream = model.stream(processed, options);
      
      let buffer = '';
      for await (const chunk of stream) {
        const processed = await this.processChunk(chunk, buffer);
        buffer += processed;
        yield processed;
      }
      
      this.emit('stream-complete', { id });
    } catch (error) {
      logger.error(`Stream error: ${error.message}`);
      throw error;
    }
  }

  async preProcess(input, options) {
    // Template injection
    if (options.template) {
      input = options.template.replace('{prompt}', input);
    }
    
    // System prompt
    if (options.systemPrompt) {
      input = `${options.systemPrompt}\n\n${input}`;
    }
    
    return input;
  }

  async postProcess(result, options) {
    // Extract text from various formats
    if (typeof result === 'string') {
      return { text: result };
    }
    
    if (result.choices?.[0]) {
      return {
        text: result.choices[0].text || result.choices[0].message?.content,
        tokens: result.usage?.total_tokens
      };
    }
    
    return result;
  }

  async processChunk(chunk, buffer) {
    // Handle different streaming formats
    if (typeof chunk === 'string') return chunk;
    if (chunk.delta?.content) return chunk.delta.content;
    if (chunk.text) return chunk.text;
    return '';
  }

  async executeWithRetry(fn, retries) {
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries) throw error;
        logger.warn(`Retry ${i + 1}/${retries}`);
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
  }

  getCacheKey(modelId, prompt, options) {
    return `${modelId}_${prompt.slice(0, 50)}_${JSON.stringify(options)}`;
  }

  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async cleanup() {
    this.queue = [];
    this.processing.clear();
    this.cache.clear();
  }
}


export default Pipeline;
export { Pipeline };
