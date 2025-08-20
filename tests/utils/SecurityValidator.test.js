/**
 * 🛡️ Security Validator Test Suite
 * Comprehensive tests for security validation system
 */

import { jest } from '@jest/globals';
import { SecurityValidator } from '../../src/utils/SecurityValidator.js';

describe('SecurityValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new SecurityValidator();
  });

  describe('Credential Validation', () => {
    test('should validate correct OpenAI credentials', () => {
      const credentials = { apiKey: 'sk-1234567890abcdef1234567890abcdef1234567890abcdef' };
      const result = validator.validateCredentials('openai', credentials);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid OpenAI credentials', () => {
      const credentials = { apiKey: 'invalid-key' };
      const result = validator.validateCredentials('openai', credentials);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('OpenAI API key should start with "sk-"');
    });

    test('should validate Anthropic credentials', () => {
      const credentials = { apiKey: 'sk-ant-api03-1234567890abcdef' };
      const result = validator.validateCredentials('anthropic', credentials);
      
      expect(result.valid).toBe(true);
    });

    test('should validate AWS Bedrock credentials', () => {
      const credentials = {
        accessKeyId: 'AKIA1234567890ABCDEF',
        secretAccessKey: 'abcdefghijklmnopqrstuvwxyz1234567890ABCD'
      };
      const result = validator.validateCredentials('bedrock', credentials);
      
      expect(result.valid).toBe(true);
    });

    test('should reject weak credentials', () => {
      const credentials = { apiKey: 'test-key-123' };
      const result = validator.validateCredentials('openai', credentials);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('weak'))).toBe(true);
    });

    test('should reject exposed credentials', () => {
      const credentials = { apiKey: '${OPENAI_API_KEY}' };
      const result = validator.validateCredentials('openai', credentials);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exposed'))).toBe(true);
    });

    test('should provide security recommendations', () => {
      const credentials = { apiKey: 'sk-1234567890abcdef1234567890abcdef1234567890abcdef' };
      const result = validator.validateCredentials('openai', credentials);
      
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Request Validation', () => {
    test('should validate clean request', () => {
      const request = {
        prompt: 'Hello, how are you?',
        maxTokens: 100,
        temperature: 0.7
      };
      
      const result = validator.validateRequest(request, 'openai');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect sensitive data in prompt', () => {
      const request = {
        prompt: 'My API key is sk-1234567890abcdef and my email is test@example.com',
        maxTokens: 100
      };
      
      const result = validator.validateRequest(request, 'openai');
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Sensitive data detected'))).toBe(true);
    });

    test('should detect code injection attempts', () => {
      const request = {
        prompt: 'Execute this: eval("malicious code")',
        maxTokens: 100
      };
      
      const result = validator.validateRequest(request, 'openai');
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('code injection'))).toBe(true);
    });

    test('should warn about large requests', () => {
      const request = {
        prompt: 'A'.repeat(1024 * 1024 + 1), // > 1MB
        maxTokens: 100
      };
      
      const result = validator.validateRequest(request, 'openai');
      
      expect(result.warnings.some(w => w.includes('very large'))).toBe(true);
    });

    test('should sanitize request', () => {
      const request = {
        prompt: 'Hello',
        apiKey: 'sk-secret',
        authorization: 'Bearer token'
      };
      
      const result = validator.validateRequest(request, 'openai');
      
      expect(result.sanitizedRequest.apiKey).toContain('***');
      expect(result.sanitizedRequest.authorization).toContain('***');
    });
  });

  describe('Response Validation', () => {
    test('should validate clean response', () => {
      const response = {
        text: 'Hello! I am doing well, thank you for asking.',
        usage: { totalTokens: 15 }
      };
      
      const result = validator.validateResponse(response, 'openai');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should warn about sensitive data in response', () => {
      const response = {
        text: 'Your API key is sk-1234567890abcdef',
        usage: { totalTokens: 10 }
      };
      
      const result = validator.validateResponse(response, 'openai');
      
      expect(result.warnings.some(w => w.includes('sensitive data'))).toBe(true);
    });

    test('should detect anomalous response patterns', () => {
      const response = {
        text: 'AAAAAAAAAAAAAAAAAAAAAAAAA'.repeat(2000), // Repeated pattern
        usage: { totalTokens: 5000 }
      };
      
      const result = validator.validateResponse(response, 'openai');
      
      expect(result.warnings.some(w => w.includes('unusual'))).toBe(true);
    });
  });

  describe('Endpoint Validation', () => {
    test('should validate HTTPS endpoints', () => {
      const result = validator.validateEndpoint('https://api.openai.com/v1/chat/completions');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject HTTP endpoints', () => {
      const result = validator.validateEndpoint('http://api.openai.com/v1/chat/completions');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Endpoint must use HTTPS protocol');
    });

    test('should validate allowed domains', () => {
      const result = validator.validateEndpoint('https://api.openai.com/v1/completions');
      
      expect(result.valid).toBe(true);
    });

    test('should reject non-allowed domains', () => {
      const result = validator.validateEndpoint('https://malicious.com/api');
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('not in allowlist'))).toBe(true);
    });

    test('should handle wildcard domains', () => {
      // Test Azure OpenAI wildcard domain
      const result = validator.validateEndpoint('https://myresource.openai.azure.com/openai/deployments/gpt-4/chat/completions');
      
      expect(result.valid).toBe(true);
    });

    test('should reject invalid URLs', () => {
      const result = validator.validateEndpoint('not-a-url');
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid URL format'))).toBe(true);
    });
  });

  describe('Sensitive Data Detection', () => {
    test('should detect API keys', () => {
      const text = 'My OpenAI key is sk-1234567890abcdef';
      const detected = validator.detectSensitiveData(text);
      
      expect(detected.length).toBeGreaterThan(0);
    });

    test('should detect AWS access keys', () => {
      const text = 'AWS key: AKIA1234567890ABCDEF';
      const detected = validator.detectSensitiveData(text);
      
      expect(detected.length).toBeGreaterThan(0);
    });

    test('should detect email addresses', () => {
      const text = 'Contact me at user@example.com';
      const detected = validator.detectSensitiveData(text);
      
      expect(detected.length).toBeGreaterThan(0);
    });

    test('should detect private keys', () => {
      const text = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7...
-----END PRIVATE KEY-----`;
      const detected = validator.detectSensitiveData(text);
      
      expect(detected.length).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting', () => {
    test('should allow requests within limit', () => {
      const result = validator.checkRateLimit('openai');
      
      expect(result.allowed).toBe(true);
    });

    test('should deny requests exceeding limit', () => {
      // Simulate many requests
      for (let i = 0; i < 101; i++) {
        validator.checkRateLimit('openai');
      }
      
      const result = validator.checkRateLimit('openai');
      
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Rate limit exceeded');
    });

    test('should reset rate limit after window', async () => {
      // Set short window for testing
      validator.rateLimitWindow = 100; // 100ms
      
      // Exceed limit
      for (let i = 0; i < 101; i++) {
        validator.checkRateLimit('openai');
      }
      
      // Wait for window to reset
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const result = validator.checkRateLimit('openai');
      
      expect(result.allowed).toBe(true);
    });
  });

  describe('Security Event Recording', () => {
    test('should record security events', () => {
      const event = {
        type: 'test_event',
        severity: 'warning',
        provider: 'openai',
        message: 'Test security event'
      };
      
      const logEntry = validator.recordSecurityEvent(event);
      
      expect(logEntry.timestamp).toBeDefined();
      expect(logEntry.type).toBe('test_event');
      expect(logEntry.severity).toBe('warning');
      expect(logEntry.provider).toBe('openai');
      expect(logEntry.message).toBe('Test security event');
    });
  });

  describe('Security Report Generation', () => {
    test('should generate comprehensive security report', () => {
      // Generate some activity
      validator.checkRateLimit('openai');
      validator.recordSecurityEvent({
        type: 'test',
        provider: 'openai',
        message: 'Test'
      });
      
      const report = validator.generateSecurityReport();
      
      expect(report.timestamp).toBeDefined();
      expect(report.rateLimits).toBeDefined();
      expect(report.allowedDomains).toBeDefined();
      expect(report.securityPolicies).toBeDefined();
      expect(report.securityPolicies.maxRequestSize).toBe('1MB');
    });
  });

  describe('Utility Functions', () => {
    test('should mask secrets correctly', () => {
      const secret = 'sk-1234567890abcdef1234567890abcdef';
      const masked = validator.maskSecret(secret);
      
      expect(masked).toMatch(/^sk-1.*cdef$/);
      expect(masked).toContain('*');
    });

    test('should handle short secrets', () => {
      const secret = 'short';
      const masked = validator.maskSecret(secret);
      
      expect(masked).toBe('***');
    });

    test('should extract text content from requests', () => {
      const request1 = { prompt: 'Hello' };
      expect(validator.extractTextContent(request1)).toBe('Hello');
      
      const request2 = { messages: [{ content: 'Hi' }, { content: 'there' }] };
      expect(validator.extractTextContent(request2)).toBe('Hi there');
      
      const request3 = { input: 'Input text' };
      expect(validator.extractTextContent(request3)).toBe('Input text');
    });

    test('should extract text from responses', () => {
      expect(validator.extractResponseText('Simple string')).toBe('Simple string');
      expect(validator.extractResponseText({ text: 'Response text' })).toBe('Response text');
      expect(validator.extractResponseText({ content: 'Content text' })).toBe('Content text');
      expect(validator.extractResponseText({ 
        choices: [{ message: { content: 'Choice content' } }] 
      })).toBe('Choice content');
    });
  });
});