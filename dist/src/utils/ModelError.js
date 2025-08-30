/**
 * Model Error Class
 * Custom error class for model-related errors
 */

export class ModelError extends Error {
  constructor(message, code = 'MODEL_ERROR', details = {}) {
    super(message);
    this.name = 'ModelError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

export default ModelError;