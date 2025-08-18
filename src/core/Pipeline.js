/**
 * 🚀 Processing Pipeline - Streamlined Flow Control
 * Echo AI Systems - Where data transforms into intelligence
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';

const logger = new Logger('Pipeline');

class Pipeline extends EventEmitter {
  /**
   * Creates a new Pipeline instance
   * @param {Object} config - Pipeline configuration
   * @param {number} config.maxConcurrent - Maximum concurrent processes (default: 5)
   * @param {number} config.timeout - Timeout in milliseconds (default: 30000)
   * @param {number} config.retries - Number of retry attempts (default: 3)
   * 
   * @example
   * // Create a basic pipeline
   * const pipeline = new Pipeline();
   * 
   * @example
   * // Create a high-throughput pipeline
   * const pipeline = new Pipeline({
   *   maxConcurrent: 10,
   *   timeout: 60000,
   *   retries: 5
   * });
   * 
   * @example
   * // Create a speed-optimized pipeline
   * const pipeline = new Pipeline({
   *   maxConcurrent: 15,
   *   timeout: 10000,
   *   retries: 1
   * });
   */
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

  /**
   * Initializes the pipeline with an execution engine
   * @param {Object} engine - The execution engine to use
   * 
   * @example
   * // Initialize with WebGPU engine
   * const engine = new WebGPUEngine();
   * await pipeline.initialize(engine);
   * 
   * @example
   * // Initialize with Node.js engine
   * const engine = new NodeEngine();
   * await pipeline.initialize(engine);
   * 
   * @example
   * // Initialize and setup event listeners
   * await pipeline.initialize(engine);
   * pipeline.on('processed', (data) => {
   *   console.log(`Processed in ${data.duration}ms`);
   * });
   */
  async initialize(engine) {
    this.engine = engine;
    logger.info('Pipeline initialized');
  }

  /**
   * Processes a prompt through the pipeline with caching and error handling
   * @param {Object} model - The model to use for processing
   * @param {string} prompt - The input prompt to process
   * @param {Object} options - Processing options
   * @param {boolean} options.cache - Enable/disable caching (default: true)
   * @param {string} options.template - Template string with {prompt} placeholder
   * @param {string} options.systemPrompt - System prompt to prepend
   * @returns {Promise<Object>} Processed result with text and metadata
   * 
   * @example
   * // Basic text generation
   * const result = await pipeline.process(model, "What is AI?");
   * console.log(result.text); // Generated response
   * 
   * @example
   * // Using templates and system prompts
   * const result = await pipeline.process(model, "machine learning", {
   *   template: "Explain the concept of {prompt} in simple terms.",
   *   systemPrompt: "You are a helpful AI tutor.",
   *   cache: true
   * });
   * 
   * @example
   * // Processing with custom options
   * const result = await pipeline.process(model, "Write a story", {
   *   temperature: 0.8,
   *   maxTokens: 500,
   *   cache: false
   * });
   * console.log(`Generated ${result.tokens} tokens`);
   * 
   * @example
   * // Error handling with retry logic
   * try {
   *   const result = await pipeline.process(model, prompt);
   *   console.log('Success:', result.text);
   * } catch (error) {
   *   console.error('Failed after retries:', error.message);
   * }
   */
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

  /**
   * Streams tokens from model generation in real-time
   * @param {Object} model - The model to use for streaming
   * @param {string} prompt - The input prompt to process
   * @param {Object} options - Streaming options
   * @yields {string} Individual processed chunks/tokens
   * 
   * @example
   * // Basic streaming
   * for await (const chunk of pipeline.stream(model, "Tell me a story")) {
   *   process.stdout.write(chunk);
   * }
   * 
   * @example
   * // Streaming with real-time processing
   * const chunks = [];
   * for await (const chunk of pipeline.stream(model, prompt)) {
   *   chunks.push(chunk);
   *   // Update UI in real-time
   *   updateTextArea(chunks.join(''));
   * }
   * 
   * @example
   * // Streaming with preprocessing
   * const stream = pipeline.stream(model, "user question", {
   *   systemPrompt: "You are a helpful assistant.",
   *   template: "Human: {prompt}\nAssistant:"
   * });
   * 
   * let response = '';
   * for await (const chunk of stream) {
   *   response += chunk;
   *   console.log('Partial response:', response);
   * }
   * 
   * @example
   * // Streaming with error handling
   * try {
   *   for await (const chunk of pipeline.stream(model, prompt)) {
   *     yield chunk; // Forward to client
   *   }
   * } catch (error) {
   *   console.error('Streaming failed:', error);
   *   yield '\n[Error: Stream interrupted]';
   * }
   */
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

  /**
   * Preprocesses input before sending to the model
   * @param {string} input - Raw input text
   * @param {Object} options - Preprocessing options
   * @param {string} options.template - Template with {prompt} placeholder
   * @param {string} options.systemPrompt - System prompt to prepend
   * @returns {Promise<string>} Processed input text
   * 
   * @example
   * // Basic preprocessing
   * const processed = await pipeline.preProcess("Hello", {});
   * console.log(processed); // "Hello"
   * 
   * @example
   * // Template injection
   * const processed = await pipeline.preProcess("AI", {
   *   template: "Explain {prompt} in detail:"
   * });
   * console.log(processed); // "Explain AI in detail:"
   * 
   * @example
   * // System prompt integration
   * const processed = await pipeline.preProcess("user question", {
   *   systemPrompt: "You are an expert assistant.",
   *   template: "Question: {prompt}\nAnswer:"
   * });
   * // Result: "You are an expert assistant.\n\nQuestion: user question\nAnswer:"
   * 
   * @example
   * // Chat format preprocessing
   * const processed = await pipeline.preProcess("How are you?", {
   *   systemPrompt: "You are Claude, an AI assistant.",
   *   template: "Human: {prompt}\n\nAssistant:"
   * });
   */
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

  /**
   * Postprocesses model output into a standardized format
   * @param {*} result - Raw model output in various formats
   * @param {Object} options - Postprocessing options
   * @returns {Promise<Object>} Standardized result with text and metadata
   * 
   * @example
   * // Processing string output
   * const result = await pipeline.postProcess("Hello world");
   * console.log(result); // { text: "Hello world" }
   * 
   * @example
   * // Processing OpenAI-style response
   * const openaiResponse = {
   *   choices: [{ message: { content: "AI response" } }],
   *   usage: { total_tokens: 150 }
   * };
   * const result = await pipeline.postProcess(openaiResponse);
   * console.log(result); // { text: "AI response", tokens: 150 }
   * 
   * @example
   * // Processing completion-style response
   * const completion = {
   *   choices: [{ text: "Generated text" }],
   *   usage: { total_tokens: 75 }
   * };
   * const result = await pipeline.postProcess(completion);
   * console.log(result); // { text: "Generated text", tokens: 75 }
   * 
   * @example
   * // Processing custom format
   * const customResult = { response: "Custom output", metadata: {} };
   * const result = await pipeline.postProcess(customResult);
   * console.log(result); // { response: "Custom output", metadata: {} }
   */
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

  /**
   * Processes individual chunks during streaming
   * @param {*} chunk - Raw chunk from model stream
   * @param {string} buffer - Current accumulated buffer
   * @returns {Promise<string>} Processed chunk text
   * 
   * @example
   * // Processing string chunks
   * const chunk = await pipeline.processChunk("hello", "");
   * console.log(chunk); // "hello"
   * 
   * @example
   * // Processing OpenAI delta chunks
   * const deltaChunk = { delta: { content: " world" } };
   * const chunk = await pipeline.processChunk(deltaChunk, "hello");
   * console.log(chunk); // " world"
   * 
   * @example
   * // Processing text-based chunks
   * const textChunk = { text: "!", finished: false };
   * const chunk = await pipeline.processChunk(textChunk, "hello world");
   * console.log(chunk); // "!"
   * 
   * @example
   * // Handling streaming in a pipeline
   * let buffer = '';
   * for await (const rawChunk of modelStream) {
   *   const processed = await pipeline.processChunk(rawChunk, buffer);
   *   buffer += processed;
   *   yield processed;
   * }
   */
  async processChunk(chunk, buffer) {
    // Handle different streaming formats
    if (typeof chunk === 'string') return chunk;
    if (chunk.delta?.content) return chunk.delta.content;
    if (chunk.text) return chunk.text;
    return '';
  }

  /**
   * Executes a function with exponential backoff retry logic
   * @param {Function} fn - Async function to execute
   * @param {number} retries - Number of retry attempts
   * @returns {Promise<*>} Function result or throws after all retries
   * 
   * @example
   * // Basic retry execution
   * const result = await pipeline.executeWithRetry(
   *   () => model.generate(prompt),
   *   3
   * );
   * 
   * @example
   * // Retry with custom function
   * const result = await pipeline.executeWithRetry(async () => {
   *   const response = await fetch('/api/model');
   *   if (!response.ok) throw new Error('API failed');
   *   return response.json();
   * }, 5);
   * 
   * @example
   * // Retry with network requests
   * const modelResponse = await pipeline.executeWithRetry(
   *   () => fetch(`${API_BASE}/chat/completions`, {
   *     method: 'POST',
   *     headers: { 'Authorization': `Bearer ${token}` },
   *     body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] })
   *   }).then(r => r.json()),
   *   this.config.retries
   * );
   * 
   * @example
   * // Retry with custom error handling
   * try {
   *   const result = await pipeline.executeWithRetry(
   *     () => riskyOperation(),
   *     3
   *   );
   *   console.log('Success after retries:', result);
   * } catch (error) {
   *   console.error('Failed after all retries:', error.message);
   * }
   */
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

  /**
   * Generates a cache key for storing processed results
   * @param {string} modelId - Model identifier
   * @param {string} prompt - Input prompt
   * @param {Object} options - Processing options
   * @returns {string} Unique cache key
   * 
   * @example
   * // Generate cache key for basic prompt
   * const key = pipeline.getCacheKey('gpt-4', 'What is AI?', {});
   * console.log(key); // "gpt-4_What is AI?_{}"
   * 
   * @example
   * // Cache key with options
   * const key = pipeline.getCacheKey('claude-3', 'Long prompt text...', {
   *   temperature: 0.7,
   *   maxTokens: 1000
   * });
   * console.log(key); // "claude-3_Long prompt text..._{'temperature':0.7,'maxTokens':1000}"
   * 
   * @example
   * // Using cache keys for manual cache management
   * const cacheKey = pipeline.getCacheKey(model.id, prompt, options);
   * if (customCache.has(cacheKey)) {
   *   return customCache.get(cacheKey);
   * }
   * const result = await pipeline.process(model, prompt, options);
   * customCache.set(cacheKey, result);
   */
  getCacheKey(modelId, prompt, options) {
    return `${modelId}_${prompt.slice(0, 50)}_${JSON.stringify(options)}`;
  }

  /**
   * Generates a unique identifier for pipeline operations
   * @returns {string} Unique identifier combining timestamp and random string
   * 
   * @example
   * // Generate unique operation ID
   * const id = pipeline.generateId();
   * console.log(id); // "1704067200000_k3j9f8x2a"
   * 
   * @example
   * // Using IDs for tracking operations
   * const operationId = pipeline.generateId();
   * console.log(`Starting operation: ${operationId}`);
   * // Process data...
   * console.log(`Completed operation: ${operationId}`);
   * 
   * @example
   * // Tracking multiple concurrent operations
   * const operations = new Map();
   * const id = pipeline.generateId();
   * operations.set(id, { startTime: Date.now(), status: 'processing' });
   * // ... later
   * operations.get(id).status = 'completed';
   */
  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleans up pipeline resources and resets state
   * @returns {Promise<void>}
   * 
   * @example
   * // Basic cleanup
   * await pipeline.cleanup();
   * console.log('Pipeline cleaned up');
   * 
   * @example
   * // Cleanup before shutdown
   * process.on('SIGTERM', async () => {
   *   console.log('Shutting down...');
   *   await pipeline.cleanup();
   *   process.exit(0);
   * });
   * 
   * @example
   * // Cleanup and reinitialize
   * await pipeline.cleanup();
   * await pipeline.initialize(newEngine);
   * console.log('Pipeline reinitialized with new engine');
   * 
   * @example
   * // Periodic cleanup for long-running processes
   * setInterval(async () => {
   *   const memUsage = process.memoryUsage();
   *   if (memUsage.heapUsed > MEMORY_THRESHOLD) {
   *     await pipeline.cleanup();
   *     console.log('Performed periodic cleanup');
   *   }
   * }, 3600000); // Every hour
   */
  async cleanup() {
    this.queue = [];
    this.processing.clear();
    this.cache.clear();
  }
}


export default Pipeline;
export { Pipeline };
