/**
 * 🔑 BYOK-Aware Model Loader
 * Base class that enables model loaders to use user-provided API keys
 * Echo AI Systems - Universal Access
 */

import APILoader from './APILoader.js';
import { Logger } from '../utils/Logger.js';

const logger = new Logger('BYOKAwareLoader');

/**
 * Enhanced API Loader that supports BYOK (Bring Your Own Key)
 */
export class BYOKAwareLoader extends APILoader {
  constructor(config = {}) {
    super(config);
    this.byokKey = null;
    this.isByokEnabled = false;
  }

  /**
   * Check for and inject BYOK key from request context
   */
  injectBYOKKey(context) {
    if (context?.providerKey) {
      this.byokKey = context.providerKey;
      this.isByokEnabled = true;
      this.originalApiKey = this.apiKey; // Store original
      
      // Use BYOK key instead of system key
      if (typeof this.byokKey === 'string') {
        this.apiKey = this.byokKey;
      } else if (typeof this.byokKey === 'object') {
        // Complex configuration (e.g., Azure, Bedrock)
        Object.assign(this, this.byokKey);
      }
      
      logger.info(`🔑 Using BYOK key for ${this.provider}`);
      return true;
    }
    return false;
  }

  /**
   * Reset to system key after BYOK usage
   */
  resetToSystemKey() {
    if (this.isByokEnabled && this.originalApiKey) {
      this.apiKey = this.originalApiKey;
      this.byokKey = null;
      this.isByokEnabled = false;
      logger.info(`🔄 Reset to system key for ${this.provider}`);
    }
  }

  /**
   * Enhanced load method with BYOK support
   */
  async load(modelId, options = {}) {
    // Check for BYOK key in options
    if (options.byokKey || options.providerKey) {
      this.injectBYOKKey({
        providerKey: options.byokKey || options.providerKey
      });
    }

    try {
      const result = await super.load(modelId, options);
      
      // Add BYOK metadata if applicable
      if (this.isByokEnabled && result) {
        result.metadata = {
          ...result.metadata,
          isBYOK: true,
          keySource: 'user'
        };
      }
      
      return result;
    } finally {
      // Always reset to system key after operation
      this.resetToSystemKey();
    }
  }

  /**
   * Enhanced complete method with BYOK support
   */
  async complete(prompt, options = {}) {
    // Check for BYOK key in options
    if (options.byokKey || options.providerKey) {
      this.injectBYOKKey({
        providerKey: options.byokKey || options.providerKey
      });
    }

    try {
      const result = await super.complete(prompt, options);
      
      // Add BYOK tracking
      if (this.isByokEnabled && result) {
        result.byok = true;
      }
      
      return result;
    } finally {
      // Always reset to system key after operation
      this.resetToSystemKey();
    }
  }

  /**
   * Get current key status
   */
  getKeyStatus() {
    return {
      isByok: this.isByokEnabled,
      hasSystemKey: !!this.originalApiKey || !!this.apiKey,
      provider: this.provider
    };
  }
}

/**
 * Factory function to make any existing loader BYOK-aware
 */
export function makeBYOKAware(LoaderClass) {
  return class extends LoaderClass {
    constructor(config = {}) {
      super(config);
      this.byokKey = null;
      this.isByokEnabled = false;
      this.originalApiKey = null;
    }

    injectBYOKKey(context) {
      if (context?.providerKey) {
        this.byokKey = context.providerKey;
        this.isByokEnabled = true;
        this.originalApiKey = this.apiKey;
        
        if (typeof this.byokKey === 'string') {
          this.apiKey = this.byokKey;
        } else if (typeof this.byokKey === 'object') {
          Object.assign(this, this.byokKey);
        }
        
        logger.info(`🔑 BYOK enabled for ${this.provider || this.constructor.name}`);
        return true;
      }
      return false;
    }

    resetToSystemKey() {
      if (this.isByokEnabled && this.originalApiKey) {
        this.apiKey = this.originalApiKey;
        this.byokKey = null;
        this.isByokEnabled = false;
      }
    }

    async load(modelId, options = {}) {
      if (options.byokKey || options.providerKey) {
        this.injectBYOKKey({
          providerKey: options.byokKey || options.providerKey
        });
      }

      try {
        const result = await super.load(modelId, options);
        
        if (this.isByokEnabled && result) {
          result.metadata = {
            ...result.metadata,
            isBYOK: true,
            keySource: 'user'
          };
        }
        
        return result;
      } finally {
        this.resetToSystemKey();
      }
    }

    async complete(prompt, options = {}) {
      if (options.byokKey || options.providerKey) {
        this.injectBYOKKey({
          providerKey: options.byokKey || options.providerKey
        });
      }

      try {
        const result = await super.complete(prompt, options);
        
        if (this.isByokEnabled && result) {
          result.byok = true;
        }
        
        return result;
      } finally {
        this.resetToSystemKey();
      }
    }

    getKeyStatus() {
      return {
        isByok: this.isByokEnabled,
        hasSystemKey: !!this.originalApiKey || !!this.apiKey,
        provider: this.provider || this.constructor.name
      };
    }
  };
}

export default BYOKAwareLoader;