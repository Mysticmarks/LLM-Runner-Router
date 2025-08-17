/**
 * 🛡️ Model Validator - Quantum Integrity Verification Engine
 * Ensuring models are who they claim to be in the multiverse
 * Echo AI Systems - Trust, but verify with algorithmic precision
 */

import { Logger } from './Logger.js';
import crypto from 'crypto';

const logger = new Logger('Validator');

class ModelValidator {
  constructor() {
    this.rules = new Map();
    this.checksums = new Map();
    this.setupDefaultRules();
  }

  setupDefaultRules() {
    // Format validation rules
    this.rules.set('gguf', {
      magic: ['GGUF', 'GGML'],
      minSize: 1024 * 1024, // 1MB minimum
      maxSize: 100 * 1024 * 1024 * 1024, // 100GB max
      requiredFields: ['architecture', 'parameters']
    });
    
    this.rules.set('onnx', {
      magic: [0x08, 0x01],
      minSize: 1024,
      maxSize: 10 * 1024 * 1024 * 1024,
      requiredFields: ['graph', 'opset']
    });
  }

  validatePrompt(prompt) {
    // Validate prompt input
    if (!prompt) {
      return { valid: false, error: 'Prompt is required' };
    }
    
    if (typeof prompt !== 'string') {
      return { valid: false, error: 'Prompt must be a string' };
    }
    
    if (prompt.length === 0) {
      return { valid: false, error: 'Prompt cannot be empty' };
    }
    
    if (prompt.length > 100000) {
      return { valid: false, error: 'Prompt is too long' };
    }
    
    return { valid: true, prompt };
  }

  async validate(model) {
    logger.debug(`🔍 Validating model: ${model.name}`);
    
    // Check basic properties
    this.validateProperties(model);
    
    // Check format-specific rules
    if (this.rules.has(model.format)) {
      await this.validateFormat(model);
    }
    
    // Verify integrity if checksum provided
    if (model.metadata?.checksum) {
      await this.verifyChecksum(model);
    }
    
    // Validate capabilities match implementation
    this.validateCapabilities(model);
    
    logger.success(`✅ Model validated: ${model.name}`);
    return true;
  }

  validateProperties(model) {
    if (!model.id) throw new Error('Model missing ID');
    if (!model.name) throw new Error('Model missing name');
    if (!model.format) throw new Error('Model missing format');
    
    if (typeof model.generate !== 'function') {
      throw new Error('Model missing generate function');
    }
  }

  async validateFormat(model) {
    const rules = this.rules.get(model.format);
    
    // Check size constraints
    const size = model.parameters?.size || 0;
    if (size < rules.minSize) {
      throw new Error(`Model too small: ${size} < ${rules.minSize}`);
    }
    if (size > rules.maxSize) {
      throw new Error(`Model too large: ${size} > ${rules.maxSize}`);
    }
    
    // Check required fields
    for (const field of rules.requiredFields) {
      if (!model[field] && !model.metadata?.[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }

  async verifyChecksum(model) {
    const expected = model.metadata.checksum;
    const actual = await this.calculateChecksum(model);
    
    if (expected !== actual) {
      throw new Error(`Checksum mismatch: ${expected} != ${actual}`);
    }
    
    logger.debug(`✅ Checksum verified: ${expected.slice(0, 8)}...`);
  }

  async calculateChecksum(model) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(model.weights || model.parameters));
    return hash.digest('hex');
  }

  validateCapabilities(model) {
    const caps = model.capabilities || {};
    
    if (caps.streaming && typeof model.stream !== 'function') {
      throw new Error('Model claims streaming but lacks implementation');
    }
    
    if (caps.embedding && typeof model.embed !== 'function') {
      throw new Error('Model claims embedding but lacks implementation');
    }
  }

  async validateSecurity(model) {
    // Check for suspicious patterns
    const suspicious = [
      /eval\(/,
      /Function\(/,
      /require\(['"]child_process/,
      /__proto__/
    ];
    
    const code = model.toString();
    for (const pattern of suspicious) {
      if (pattern.test(code)) {
        throw new Error(`Security violation: suspicious pattern detected`);
      }
    }
  }
}

// Create a singleton instance
const Validator = new ModelValidator();

export default Validator;
export { ModelValidator, Validator };
