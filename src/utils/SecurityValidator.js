/**
 * 🛡️ Security Validator - Guardian of the Neural Realm
 * Comprehensive security validation for LLM provider integrations
 * Echo AI Systems - Security as the foundation of trust
 */

import crypto from 'crypto';
import { Logger } from './Logger.js';

const logger = new Logger('SecurityValidator');

class SecurityValidator {
  constructor() {
    this.sensitivePatterns = [
      // API Keys and tokens
      /(?:api[_-]?key|access[_-]?token|secret[_-]?key|bearer[_-]?token)[\s:=]+['"]*([a-zA-Z0-9-._~+/]+)['"]*$/i,
      
      // Cloud provider patterns
      /AKIA[0-9A-Z]{16}/i, // AWS Access Key
      /sk-[a-zA-Z0-9]{48}/i, // OpenAI API Key
      /xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+/i, // Slack Bot Token
      /ghp_[a-zA-Z0-9]{36}/i, // GitHub Personal Access Token
      /gho_[a-zA-Z0-9]{36}/i, // GitHub OAuth Token
      
      // Azure patterns
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, // Azure Client ID
      
      // Google patterns
      /ya29\.[a-zA-Z0-9_-]+/i, // Google OAuth2 Access Token
      
      // Anthropic patterns
      /sk-ant-[a-zA-Z0-9-_]+/i, // Anthropic API Key
      
      // Other sensitive data
      /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/i, // Private keys
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i, // Email addresses (potential PII)
    ];

    this.dangerousOperations = [
      'eval',
      'Function',
      'process.env',
      'require',
      'import',
      'fs.readFile',
      'fs.writeFile',
      'child_process',
      'exec',
      'spawn'
    ];

    this.allowedDomains = new Set([
      'api.openai.com',
      'api.anthropic.com',
      'openrouter.ai',
      'api.groq.com',
      'bedrock-runtime.*.amazonaws.com',
      '*.openai.azure.com',
      'aiplatform.googleapis.com',
      'api.mistral.ai',
      'api.together.xyz',
      'api.fireworks.ai',
      'api.cohere.ai',
      'api.perplexity.ai',
      'api.deepseek.com',
      'api.novita.ai'
    ]);

    this.rateLimits = new Map();
    this.failedAttempts = new Map();
    this.maxFailedAttempts = 5;
    this.rateLimitWindow = 60000; // 1 minute
  }

  /**
   * Validate API credentials for security
   */
  validateCredentials(provider, credentials) {
    const errors = [];

    if (!credentials) {
      errors.push('Missing credentials');
      return { valid: false, errors };
    }

    // Check for exposed credentials in environment
    if (this.isCredentialExposed(credentials)) {
      errors.push('Credentials appear to be exposed in environment variables');
    }

    // Validate credential format per provider
    const formatValid = this.validateCredentialFormat(provider, credentials);
    if (!formatValid.valid) {
      errors.push(...formatValid.errors);
    }

    // Check for weak or default credentials
    if (this.isWeakCredential(credentials)) {
      errors.push('Credentials appear to be weak or default values');
    }

    return {
      valid: errors.length === 0,
      errors,
      recommendations: this.getSecurityRecommendations(provider)
    };
  }

  /**
   * Validate request payload for security issues
   */
  validateRequest(request, provider) {
    const errors = [];
    const warnings = [];

    // Check for sensitive data in prompt
    if (request.prompt || request.messages) {
      const content = this.extractTextContent(request);
      const sensitiveData = this.detectSensitiveData(content);
      
      if (sensitiveData.length > 0) {
        errors.push(`Sensitive data detected: ${sensitiveData.join(', ')}`);
      }
    }

    // Check for code injection attempts
    if (this.detectCodeInjection(request)) {
      errors.push('Potential code injection detected in request');
    }

    // Validate request size
    const requestSize = JSON.stringify(request).length;
    if (requestSize > 1024 * 1024) { // 1MB limit
      warnings.push('Request size is very large, consider chunking');
    }

    // Check rate limiting
    const rateLimitCheck = this.checkRateLimit(provider);
    if (!rateLimitCheck.allowed) {
      errors.push(`Rate limit exceeded: ${rateLimitCheck.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitizedRequest: this.sanitizeRequest(request)
    };
  }

  /**
   * Validate response for security issues
   */
  validateResponse(response, provider) {
    const errors = [];
    const warnings = [];

    if (!response) {
      return { valid: true, errors: [], warnings: [] };
    }

    // Check for sensitive data in response
    const responseText = this.extractResponseText(response);
    if (responseText) {
      const sensitiveData = this.detectSensitiveData(responseText);
      if (sensitiveData.length > 0) {
        warnings.push(`Response contains potential sensitive data: ${sensitiveData.join(', ')}`);
      }
    }

    // Check for unusual response patterns that might indicate compromise
    if (this.detectAnomalousResponse(response)) {
      warnings.push('Response pattern appears unusual, manual review recommended');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitizedResponse: this.sanitizeResponse(response)
    };
  }

  /**
   * Validate endpoint URL for security
   */
  validateEndpoint(url) {
    try {
      const parsedUrl = new URL(url);
      
      // Must use HTTPS
      if (parsedUrl.protocol !== 'https:') {
        return {
          valid: false,
          errors: ['Endpoint must use HTTPS protocol']
        };
      }

      // Check against allowed domains
      const isDomainAllowed = Array.from(this.allowedDomains).some(domain => {
        if (domain.includes('*')) {
          const regex = new RegExp(domain.replace(/\*/g, '[a-zA-Z0-9-]+'));
          return regex.test(parsedUrl.hostname);
        }
        return parsedUrl.hostname === domain;
      });

      if (!isDomainAllowed) {
        return {
          valid: false,
          errors: [`Domain ${parsedUrl.hostname} is not in allowlist`],
          warnings: ['Using non-standard endpoint, verify legitimacy']
        };
      }

      return { valid: true, errors: [], warnings: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [`Invalid URL format: ${error.message}`]
      };
    }
  }

  /**
   * Detect sensitive data patterns
   */
  detectSensitiveData(text) {
    const detected = [];
    
    for (const pattern of this.sensitivePatterns) {
      if (pattern.test(text)) {
        detected.push(pattern.source.slice(0, 50) + '...');
      }
    }

    return detected;
  }

  /**
   * Check if credentials are exposed
   */
  isCredentialExposed(credentials) {
    const credString = JSON.stringify(credentials).toLowerCase();
    
    // Check if it looks like environment variable references
    return /\$\{?[a-z_]+\}?/i.test(credString) || 
           /process\.env/i.test(credString) ||
           credString.includes('test') ||
           credString.includes('demo') ||
           credString.includes('example');
  }

  /**
   * Validate credential format per provider
   */
  validateCredentialFormat(provider, credentials) {
    const errors = [];

    switch (provider.toLowerCase()) {
      case 'openai':
      case 'azure-openai':
        if (credentials.apiKey && !credentials.apiKey.startsWith('sk-')) {
          errors.push('OpenAI API key should start with "sk-"');
        }
        break;

      case 'anthropic':
        if (credentials.apiKey && !credentials.apiKey.startsWith('sk-ant-')) {
          errors.push('Anthropic API key should start with "sk-ant-"');
        }
        break;

      case 'bedrock':
      case 'aws-bedrock':
        if (credentials.accessKeyId && !credentials.accessKeyId.startsWith('AKIA')) {
          errors.push('AWS Access Key ID should start with "AKIA"');
        }
        if (credentials.secretAccessKey && credentials.secretAccessKey.length !== 40) {
          errors.push('AWS Secret Access Key should be 40 characters long');
        }
        break;

      case 'vertex-ai':
      case 'google-vertex':
        if (credentials.keyFilename && !credentials.keyFilename.endsWith('.json')) {
          errors.push('Google service account key should be a JSON file');
        }
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Check for weak credentials
   */
  isWeakCredential(credentials) {
    const credString = JSON.stringify(credentials).toLowerCase();
    const weakPatterns = [
      'test', 'demo', 'example', 'placeholder', 'your-key-here',
      '123456', 'password', 'secret', 'key123', 'apikey123'
    ];

    return weakPatterns.some(pattern => credString.includes(pattern));
  }

  /**
   * Detect code injection attempts
   */
  detectCodeInjection(request) {
    const requestText = JSON.stringify(request).toLowerCase();
    
    return this.dangerousOperations.some(op => 
      requestText.includes(op.toLowerCase())
    );
  }

  /**
   * Check rate limiting
   */
  checkRateLimit(provider, identifier = 'default') {
    const key = `${provider}:${identifier}`;
    const now = Date.now();
    
    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, { count: 1, window: now });
      return { allowed: true };
    }

    const limit = this.rateLimits.get(key);
    
    // Reset window if expired
    if (now - limit.window > this.rateLimitWindow) {
      this.rateLimits.set(key, { count: 1, window: now });
      return { allowed: true };
    }

    // Check if limit exceeded
    if (limit.count >= 100) { // 100 requests per minute
      return {
        allowed: false,
        message: `Rate limit exceeded: ${limit.count} requests in window`
      };
    }

    limit.count++;
    return { allowed: true };
  }

  /**
   * Extract text content from request
   */
  extractTextContent(request) {
    let content = '';
    
    if (request.prompt) content += request.prompt;
    if (request.messages) {
      content += request.messages.map(m => m.content || '').join(' ');
    }
    if (request.input) content += request.input;
    
    return content;
  }

  /**
   * Extract text from response
   */
  extractResponseText(response) {
    if (typeof response === 'string') return response;
    if (response.text) return response.text;
    if (response.content) return response.content;
    if (response.choices?.[0]?.message?.content) return response.choices[0].message.content;
    return JSON.stringify(response);
  }

  /**
   * Detect anomalous response patterns
   */
  detectAnomalousResponse(response) {
    const responseText = this.extractResponseText(response);
    
    // Check for suspiciously long responses
    if (responseText.length > 50000) return true;
    
    // Check for repeated patterns (potential data exfiltration)
    const repeatedPattern = /(.{20,})\1{3,}/;
    if (repeatedPattern.test(responseText)) return true;
    
    // Check for base64 encoded data
    const base64Pattern = /[A-Za-z0-9+/]{50,}={0,2}/;
    if (base64Pattern.test(responseText)) return true;
    
    return false;
  }

  /**
   * Sanitize request by removing sensitive data
   */
  sanitizeRequest(request) {
    const sanitized = JSON.parse(JSON.stringify(request));
    
    // Remove or mask sensitive fields
    if (sanitized.apiKey) sanitized.apiKey = this.maskSecret(sanitized.apiKey);
    if (sanitized.authorization) sanitized.authorization = this.maskSecret(sanitized.authorization);
    
    return sanitized;
  }

  /**
   * Sanitize response by removing sensitive data
   */
  sanitizeResponse(response) {
    const sanitized = JSON.parse(JSON.stringify(response));
    
    // Remove metadata that might contain sensitive info
    if (sanitized.model_info) delete sanitized.model_info;
    if (sanitized.debug_info) delete sanitized.debug_info;
    
    return sanitized;
  }

  /**
   * Mask secret values for logging
   */
  maskSecret(secret) {
    if (!secret || secret.length < 8) return '***';
    return secret.slice(0, 4) + '*'.repeat(secret.length - 8) + secret.slice(-4);
  }

  /**
   * Get security recommendations for provider
   */
  getSecurityRecommendations(provider) {
    const general = [
      'Store credentials in environment variables or secure key management',
      'Use HTTPS for all API communications',
      'Implement proper error handling to avoid information leakage',
      'Monitor API usage for anomalous patterns',
      'Rotate API keys regularly'
    ];

    const providerSpecific = {
      'bedrock': [
        'Use IAM roles instead of access keys when possible',
        'Enable CloudTrail logging for API calls',
        'Implement least privilege access policies'
      ],
      'azure-openai': [
        'Use Azure AD authentication when possible',
        'Enable diagnostic logging',
        'Implement network security groups'
      ],
      'vertex-ai': [
        'Use service account keys with minimal permissions',
        'Enable audit logging',
        'Implement VPC security controls'
      ]
    };

    return [...general, ...(providerSpecific[provider] || [])];
  }

  /**
   * Record security event for monitoring
   */
  recordSecurityEvent(event) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type: event.type,
      severity: event.severity || 'info',
      provider: event.provider,
      message: event.message,
      metadata: event.metadata || {}
    };

    logger.warn(`🛡️ Security Event: ${event.type} - ${event.message}`, logEntry);
    
    // In production, send to SIEM or security monitoring system
    return logEntry;
  }

  /**
   * Generate security report
   */
  generateSecurityReport() {
    return {
      timestamp: new Date().toISOString(),
      rateLimits: Object.fromEntries(this.rateLimits),
      failedAttempts: Object.fromEntries(this.failedAttempts),
      allowedDomains: Array.from(this.allowedDomains),
      securityPolicies: {
        maxRequestSize: '1MB',
        rateLimitWindow: `${this.rateLimitWindow}ms`,
        maxFailedAttempts: this.maxFailedAttempts
      }
    };
  }
}

export default SecurityValidator;
export { SecurityValidator };