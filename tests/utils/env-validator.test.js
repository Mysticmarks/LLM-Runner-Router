import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { EnvValidator } from '../../src/utils/EnvValidator.js';

describe('EnvValidator', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Required Variables', () => {
    test('validates required variables in production', () => {
      process.env.NODE_ENV = 'production';
      
      // Missing required vars should throw
      delete process.env.JWT_SECRET;
      delete process.env.SESSION_SECRET;
      
      expect(() => EnvValidator.validate('production')).toThrow('Environment validation failed');
    });

    test('validates secret length requirements', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'short';
      process.env.SESSION_SECRET = 'also-short';
      
      // Should throw in production with invalid secrets
      expect(() => EnvValidator.validate('production')).toThrow('Environment validation failed');
    });

    test('passes with valid production variables', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.SESSION_SECRET = 'b'.repeat(32);
      
      const validator = EnvValidator.validate('production');
      
      expect(validator.errors.length).toBe(0);
    });
  });

  describe('Format Validation', () => {
    test('validates PORT format', () => {
      process.env.PORT = 'invalid';
      const validator = EnvValidator.validate('development');
      
      expect(validator.errors).toContain('PORT must be a valid port number (1-65535)');
      
      process.env.PORT = '3000';
      const validator2 = EnvValidator.validate('development');
      expect(validator2.errors).not.toContain('PORT must be a valid port number (1-65535)');
    });

    test('validates URL formats', () => {
      process.env.BASE_URL = 'not-a-url';
      process.env.REDIS_URL = 'also-not-a-url';
      
      const validator = EnvValidator.validate('development');
      
      expect(validator.errors).toContain('BASE_URL must be a valid URL');
      expect(validator.errors).toContain('REDIS_URL must be a valid URL');
      
      process.env.BASE_URL = 'https://example.com';
      process.env.REDIS_URL = 'redis://localhost:6379';
      
      const validator2 = EnvValidator.validate('development');
      expect(validator2.errors).not.toContain('BASE_URL must be a valid URL');
      expect(validator2.errors).not.toContain('REDIS_URL must be a valid URL');
    });

    test('validates NODE_ENV values', () => {
      process.env.NODE_ENV = 'invalid-env';
      const validator = EnvValidator.validate('development');
      
      expect(validator.warnings).toContain('NODE_ENV should be one of: development, test, staging, production');
    });

    test('validates LOG_LEVEL values', () => {
      process.env.LOG_LEVEL = 'invalid-level';
      const validator = EnvValidator.validate('development');
      
      expect(validator.warnings).toContain('LOG_LEVEL should be one of: debug, info, warn, error, fatal');
    });

    test('validates boolean values', () => {
      process.env.METRICS_ENABLED = 'maybe';
      const validator = EnvValidator.validate('development');
      
      expect(validator.warnings).toContain('METRICS_ENABLED should be a boolean value (true/false)');
      
      process.env.METRICS_ENABLED = 'true';
      const validator2 = EnvValidator.validate('development');
      expect(validator2.warnings).not.toContain('METRICS_ENABLED should be a boolean value (true/false)');
    });
  });

  describe('Environment Specific', () => {
    test('development has fewer requirements', () => {
      process.env.NODE_ENV = 'development';
      
      // Should not throw in development even without secrets
      delete process.env.JWT_SECRET;
      delete process.env.SESSION_SECRET;
      
      expect(() => EnvValidator.validate('development')).not.toThrow();
    });

    test('test environment has minimal requirements', () => {
      process.env.NODE_ENV = 'test';
      
      // Should not throw in test
      expect(() => EnvValidator.validate('test')).not.toThrow();
    });
  });

  describe('Summary', () => {
    test('provides accurate summary', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = 'invalid';
      process.env.LOG_LEVEL = 'invalid';
      
      const validator = EnvValidator.validate('development');
      const summary = validator.getSummary();
      
      expect(summary.valid).toBe(false);
      expect(summary.errorCount).toBeGreaterThan(0);
      expect(summary.warningCount).toBeGreaterThan(0);
      expect(summary.errors).toEqual(validator.errors);
      expect(summary.warnings).toEqual(validator.warnings);
    });
  });

  describe('Utility Methods', () => {
    test('generates .env.example content', () => {
      const content = EnvValidator.generateEnvExample();
      
      expect(content).toContain('JWT_SECRET=');
      expect(content).toContain('SESSION_SECRET=');
      expect(content).toContain('NODE_ENV=');
      expect(content).toContain('# PORT=3006');
      expect(content).toContain('# BASE_URL=https://llmrouter.dev:3006');
    });

    test('provides correct default values', () => {
      expect(EnvValidator.getDefaultValue('PORT')).toBe('3006');
      expect(EnvValidator.getDefaultValue('HOST')).toBe('llmrouter.dev');
      expect(EnvValidator.getDefaultValue('LOG_LEVEL')).toBe('info');
      expect(EnvValidator.getDefaultValue('UNKNOWN')).toBe('');
    });
  });
});