/**
 * Environment Variable Validator
 * Ensures all required environment variables are set and valid
 */

import { Logger } from './Logger.js';

const logger = new Logger('EnvValidator');

export class EnvValidator {
  constructor() {
    this.required = [];
    this.optional = [];
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Define required environment variables
   */
  static getRequiredVars() {
    return {
      production: [
        'JWT_SECRET',
        'SESSION_SECRET',
        'NODE_ENV'
      ],
      development: [
        // Less strict in development
      ],
      test: [
        // Minimal requirements for testing
      ]
    };
  }

  /**
   * Define optional but recommended variables
   */
  static getOptionalVars() {
    return [
      'PORT',
      'HOST',
      'BASE_URL',
      'OAUTH_CLIENT_ID',
      'OAUTH_CLIENT_SECRET',
      'REDIS_URL',
      'DATABASE_URL',
      'LOG_LEVEL',
      'CORS_ORIGIN',
      'MAX_REQUEST_SIZE',
      'RATE_LIMIT_WINDOW',
      'RATE_LIMIT_MAX',
      'API_KEY_HEADER',
      'METRICS_ENABLED',
      'TELEMETRY_ENDPOINT'
    ];
  }

  /**
   * Validate environment variables
   */
  static validate(env = process.env.NODE_ENV || 'development') {
    const validator = new EnvValidator();
    const required = this.getRequiredVars()[env] || [];
    const optional = this.getOptionalVars();

    // Check required variables
    for (const varName of required) {
      if (!process.env[varName]) {
        validator.errors.push(`Missing required environment variable: ${varName}`);
      } else if (varName.includes('SECRET') && process.env[varName].length < 32) {
        validator.errors.push(`${varName} should be at least 32 characters for security`);
      }
    }

    // Check optional variables
    for (const varName of optional) {
      if (!process.env[varName]) {
        validator.warnings.push(`Optional environment variable not set: ${varName}`);
      }
    }

    // Validate specific formats
    validator.validateFormats();

    // Log results
    if (validator.errors.length > 0) {
      logger.error('Environment validation failed:');
      validator.errors.forEach(err => logger.error(`  - ${err}`));
      
      if (env === 'production') {
        throw new Error('Environment validation failed. Please set all required variables.');
      }
    }

    if (validator.warnings.length > 0 && env !== 'test') {
      logger.warn('Environment warnings:');
      validator.warnings.forEach(warn => logger.warn(`  - ${warn}`));
    }

    return validator;
  }

  /**
   * Validate specific variable formats
   */
  validateFormats() {
    // Validate PORT
    if (process.env.PORT) {
      const port = parseInt(process.env.PORT);
      if (isNaN(port) || port < 1 || port > 65535) {
        this.errors.push('PORT must be a valid port number (1-65535)');
      }
    }

    // Validate URLs
    const urlVars = ['BASE_URL', 'REDIS_URL', 'DATABASE_URL', 'TELEMETRY_ENDPOINT'];
    for (const varName of urlVars) {
      if (process.env[varName]) {
        try {
          new URL(process.env[varName]);
        } catch {
          this.errors.push(`${varName} must be a valid URL`);
        }
      }
    }

    // Validate NODE_ENV
    if (process.env.NODE_ENV) {
      const validEnvs = ['development', 'test', 'staging', 'production'];
      if (!validEnvs.includes(process.env.NODE_ENV)) {
        this.warnings.push(`NODE_ENV should be one of: ${validEnvs.join(', ')}`);
      }
    }

    // Validate LOG_LEVEL
    if (process.env.LOG_LEVEL) {
      const validLevels = ['debug', 'info', 'warn', 'error', 'fatal'];
      if (!validLevels.includes(process.env.LOG_LEVEL.toLowerCase())) {
        this.warnings.push(`LOG_LEVEL should be one of: ${validLevels.join(', ')}`);
      }
    }

    // Validate boolean flags
    const booleanVars = ['METRICS_ENABLED'];
    for (const varName of booleanVars) {
      if (process.env[varName]) {
        const value = process.env[varName].toLowerCase();
        if (!['true', 'false', '1', '0', 'yes', 'no'].includes(value)) {
          this.warnings.push(`${varName} should be a boolean value (true/false)`);
        }
      }
    }
  }

  /**
   * Get a summary of validation results
   */
  getSummary() {
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      errorCount: this.errors.length,
      warningCount: this.warnings.length
    };
  }

  /**
   * Generate .env.example file
   */
  static generateEnvExample() {
    const required = this.getRequiredVars().production;
    const optional = this.getOptionalVars();
    
    let content = '# Required Environment Variables\n';
    content += '# These must be set in production\n\n';
    
    for (const varName of required) {
      content += `${varName}=\n`;
    }
    
    content += '\n# Optional Environment Variables\n';
    content += '# These enhance functionality but are not required\n\n';
    
    for (const varName of optional) {
      const defaultValue = this.getDefaultValue(varName);
      content += `# ${varName}=${defaultValue}\n`;
    }
    
    return content;
  }

  /**
   * Get default value for optional variables
   */
  static getDefaultValue(varName) {
    const defaults = {
      PORT: '3006',
      HOST: 'llmrouter.dev',
      BASE_URL: 'https://llmrouter.dev:3006',
      LOG_LEVEL: 'info',
      CORS_ORIGIN: '*',
      MAX_REQUEST_SIZE: '50mb',
      RATE_LIMIT_WINDOW: '15',
      RATE_LIMIT_MAX: '100',
      API_KEY_HEADER: 'X-API-Key',
      METRICS_ENABLED: 'true'
    };
    
    return defaults[varName] || '';
  }

  /**
   * Load environment variables from .env file if it exists
   */
  static async loadEnvFile() {
    try {
      const { config } = await import('dotenv');
      const result = config();
      
      if (result.error) {
        logger.warn('No .env file found, using system environment variables');
      } else {
        logger.info('.env file loaded successfully');
      }
    } catch (error) {
      // dotenv not installed, skip
      logger.debug('dotenv not available, using system environment variables');
    }
  }
}

export default EnvValidator;