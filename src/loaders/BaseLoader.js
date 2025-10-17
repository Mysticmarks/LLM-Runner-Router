/**
 * Base Loader Class
 * Abstract base class for all model loaders
 */

import { EventEmitter } from 'events';
import Logger from '../utils/Logger.js';

const logger = new Logger('BaseLoader');

/**
 * Abstract base class for model loaders
 * All format-specific loaders should extend this class
 */
class BaseLoader extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = config;
        this.loaded = false;
        this.model = null;
    }

    /**
     * Load a model from the specified source
     * @param {string|object} source - Model source (path, URL, or config)
     * @param {object} options - Loading options
     * @returns {Promise<object>} Loaded model object
     * 
     * @example
     * // Load from local file path
     * await loader.load('./models/my-model.bin', {
     *   format: 'gguf',
     *   quantization: 'q4_k_m'
     * });
     * 
     * @example
     * // Load from URL with custom options
     * await loader.load('https://example.com/model.onnx', {
     *   cacheDir: './cache',
     *   timeout: 30000
     * });
     * 
     * @example
     * // Load with config object
     * await loader.load({
     *   source: 'huggingface:microsoft/DialoGPT-medium',
     *   task: 'text-generation',
     *   quantized: true
     * });
     */
    async load(source, options = {}) {
        throw new Error('load() must be implemented by subclass');
    }

    /**
     * Unload the current model and free resources
     * @returns {Promise<void>}
     * 
     * @example
     * // Unload model and free memory
     * await loader.unload();
     * console.log('Model unloaded, memory freed');
     * 
     * @example
     * // Check if model is loaded before unloading
     * if (loader.loaded) {
     *   await loader.unload();
     *   console.log('Model successfully unloaded');
     * }
     */
    async unload() {
        this.loaded = false;
        this.model = null;
        this.emit('unloaded');
    }

    /**
     * Generate text from a prompt
     * @param {string} prompt - Input prompt
     * @param {object} options - Generation options
     * @returns {Promise<object>} Generation result
     * 
     * @example
     * // Basic text generation
     * const result = await loader.generate('Hello, how are you?');
     * console.log(result.text);
     * 
     * @example
     * // Generation with custom parameters
     * const result = await loader.generate('Explain quantum physics', {
     *   maxTokens: 200,
     *   temperature: 0.7,
     *   topP: 0.9,
     *   stopStrings: ['\n\n']
     * });
     * console.log(`Generated ${result.tokens} tokens in ${result.latency}ms`);
     */
    async generate(prompt, options = {}) {
        throw new Error('generate() must be implemented by subclass');
    }

    /**
     * Stream tokens from the model
     * @param {string} prompt - Input prompt
     * @param {object} options - Streaming options
     * @returns {AsyncGenerator} Token stream
     * 
     * @example
     * // Stream tokens as they're generated
     * for await (const token of loader.stream('Write a story about')) {
     *   process.stdout.write(token);
     * }
     * 
     * @example
     * // Collect streamed tokens with error handling
     * try {
     *   let fullText = '';
     *   for await (const token of loader.stream('Explain AI', { maxTokens: 100 })) {
     *     fullText += token;
     *     console.log(`Token: ${token}`);
     *   }
     *   console.log(`Complete text: ${fullText}`);
     * } catch (error) {
     *   console.error('Streaming failed:', error.message);
     * }
     */
      async *stream(prompt, options = {}) {
          yield* [];
          throw new Error('stream() must be implemented by subclass');
      }

    /**
     * Get information about the loaded model
     * @returns {object} Model information
     * 
     * @example
     * // Get basic model information
     * const info = loader.getModelInfo();
     * if (info) {
     *   console.log(`Model loaded: ${info.loaded}`);
     *   console.log(`Format: ${info.format}`);
     *   console.log(`Name: ${info.name}`);
     * }
     * 
     * @example
     * // Check model status before operations
     * const info = loader.getModelInfo();
     * if (!info || !info.loaded) {
     *   throw new Error('Model not loaded');
     * }
     * console.log('Model is ready for inference');
     */
    getModelInfo() {
        if (!this.loaded || !this.model) {
            return null;
        }
        return {
            loaded: this.loaded,
            ...this.model
        };
    }

    /**
     * Check if a model format is supported
     * @param {string} format - Model format
     * @returns {boolean} Whether format is supported
     * 
     * @example
     * // Check format support before loading
     * if (loader.supportsFormat('gguf')) {
     *   console.log('GGUF format is supported');
     *   await loader.load('./model.gguf');
     * } else {
     *   console.log('GGUF format not supported by this loader');
     * }
     * 
     * @example
     * // Validate multiple formats
     * const formats = ['gguf', 'onnx', 'safetensors'];
     * const supported = formats.filter(fmt => loader.supportsFormat(fmt));
     * console.log(`Supported formats: ${supported.join(', ')}`);
     */
    supportsFormat(format) {
        return false;
    }

    /**
     * Validate model source
     * @param {string|object} source - Model source
     * @returns {boolean} Whether source is valid
     * 
     * @example
     * // Validate file path
     * if (loader.validateSource('./models/my-model.bin')) {
     *   console.log('Source path is valid');
     * }
     * 
     * @example
     * // Validate URL source
     * const url = 'https://huggingface.co/microsoft/DialoGPT-medium';
     * if (loader.validateSource(url)) {
     *   console.log('URL source is valid');
     *   await loader.load(url);
     * } else {
     *   console.error('Invalid source URL');
     * }
     * 
     * @example
     * // Validate config object
     * const config = {
     *   source: 'hf:gpt2',
     *   task: 'text-generation'
     * };
     * if (loader.validateSource(config)) {
     *   await loader.load(config);
     * }
     */
    validateSource(source) {
        return true;
    }

    /**
     * Get loader capabilities
     * @returns {object} Loader capabilities
     * 
     * @example
     * // Check loader capabilities
     * const caps = loader.getCapabilities();
     * console.log(`Streaming: ${caps.streaming}`);
     * console.log(`GPU support: ${caps.gpu}`);
     * console.log(`Quantization: ${caps.quantization}`);
     * console.log(`Supported formats: ${caps.formats.join(', ')}`);
     * 
     * @example
     * // Use capabilities to choose features
     * const caps = loader.getCapabilities();
     * if (caps.streaming) {
     *   // Use streaming for real-time output
     *   for await (const token of loader.stream(prompt)) {
     *     console.log(token);
     *   }
     * } else {
     *   // Fall back to batch generation
     *   const result = await loader.generate(prompt);
     *   console.log(result.text);
     * }
     */
    getCapabilities() {
        return {
            streaming: false,
            quantization: false,
            gpu: false,
            formats: []
        };
    }
}

export default BaseLoader;
export { BaseLoader };