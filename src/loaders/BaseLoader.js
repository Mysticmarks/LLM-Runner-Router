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
     */
    async load(source, options = {}) {
        throw new Error('load() must be implemented by subclass');
    }

    /**
     * Unload the current model and free resources
     * @returns {Promise<void>}
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
     */
    async generate(prompt, options = {}) {
        throw new Error('generate() must be implemented by subclass');
    }

    /**
     * Stream tokens from the model
     * @param {string} prompt - Input prompt
     * @param {object} options - Streaming options
     * @returns {AsyncGenerator} Token stream
     */
    async *stream(prompt, options = {}) {
        throw new Error('stream() must be implemented by subclass');
    }

    /**
     * Get information about the loaded model
     * @returns {object} Model information
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
     */
    supportsFormat(format) {
        return false;
    }

    /**
     * Validate model source
     * @param {string|object} source - Model source
     * @returns {boolean} Whether source is valid
     */
    validateSource(source) {
        return true;
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
}

export default BaseLoader;