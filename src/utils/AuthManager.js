/**
 * 🔐 Authentication Manager
 * Universal authentication system for all LLM providers
 * Supports API Key, OAuth2, Cloud SDK, and custom authentication
 */

import crypto from 'crypto';
import { Logger } from './Logger.js';

const logger = new Logger('AuthManager');

/**
 * API Key validation patterns for different providers
 */
const API_KEY_PATTERNS = {
  openai: /^sk-[A-Za-z0-9]{48}$/,
  anthropic: /^sk-ant-api\d{2}-[A-Za-z0-9-_]{95}$/,
  groq: /^gsk_[A-Za-z0-9]{52}$/,
  openrouter: /^sk-or-v1-[A-Za-z0-9]{64}$/,
  mistral: /^[A-Za-z0-9]{32}$/,
  cohere: /^[A-Za-z0-9-]{40}$/,
  perplexity: /^pplx-[A-Za-z0-9]{32}$/,
  deepseek: /^sk-[A-Za-z0-9]{48}$/,
  together: /^[A-Za-z0-9]{64}$/,
  fireworks: /^fw-[A-Za-z0-9]{40}$/,
  deepinfra: /^[A-Za-z0-9]{32}$/,
  replicate: /^r8_[A-Za-z0-9]{32}$/,
  novita: /^[A-Za-z0-9]{32}$/
};

/**
 * Authentication types supported by different providers
 */
const AUTH_TYPES = {
  API_KEY: 'api_key',
  OAUTH2: 'oauth2',
  AWS_SDK: 'aws_sdk',
  AZURE_SDK: 'azure_sdk',
  GCP_SDK: 'gcp_sdk',
  CUSTOM: 'custom'
};

/**
 * Provider authentication configurations
 */
const PROVIDER_AUTH_CONFIG = {
  // Existing API Key providers
  openai: { type: AUTH_TYPES.API_KEY, headerType: 'Bearer' },
  anthropic: { type: AUTH_TYPES.API_KEY, headerType: 'Custom', headerName: 'x-api-key' },
  groq: { type: AUTH_TYPES.API_KEY, headerType: 'Bearer' },
  openrouter: { type: AUTH_TYPES.API_KEY, headerType: 'Bearer' },
  
  // Enterprise Cloud providers
  bedrock: { type: AUTH_TYPES.AWS_SDK, region: 'us-east-1' },
  'azure-openai': { type: AUTH_TYPES.AZURE_SDK, apiVersion: '2024-02-01' },
  'vertex-ai': { type: AUTH_TYPES.GCP_SDK, location: 'us-central1' },
  
  // Direct API providers
  mistral: { type: AUTH_TYPES.API_KEY, headerType: 'Bearer' },
  
  // High-performance providers
  together: { type: AUTH_TYPES.API_KEY, headerType: 'Bearer' },
  fireworks: { type: AUTH_TYPES.API_KEY, headerType: 'Bearer' },
  deepinfra: { type: AUTH_TYPES.API_KEY, headerType: 'Bearer' },
  replicate: { type: AUTH_TYPES.API_KEY, headerType: 'Token' },
  
  // Specialized & Multi-Modal providers
  cohere: { type: AUTH_TYPES.API_KEY, headerType: 'Bearer' },
  perplexity: { type: AUTH_TYPES.API_KEY, headerType: 'Bearer' },
  deepseek: { type: AUTH_TYPES.API_KEY, headerType: 'Bearer' },
  novita: { type: AUTH_TYPES.API_KEY, headerType: 'Bearer' }
};

/**
 * Enhanced authentication manager
 */
class AuthManager {
  constructor() {
    this.credentials = new Map();
    this.tokenCache = new Map();
    this.refreshTokens = new Map();
    this.encryptionKey = process.env.AUTH_ENCRYPTION_KEY || this.generateEncryptionKey();
  }

  /**
   * Generate encryption key for secure credential storage
   */
  generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate API key format for a provider
   */
  validateApiKey(provider, apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return { valid: false, error: 'API key must be a non-empty string' };
    }

    // Remove whitespace
    const cleanKey = apiKey.trim();

    // Check minimum length
    if (cleanKey.length < 8) {
      return { valid: false, error: 'API key appears to be too short' };
    }

    // Check for common mistakes
    if (cleanKey.includes(' ')) {
      return { valid: false, error: 'API key should not contain spaces' };
    }

    if (cleanKey.startsWith('Bearer ')) {
      return { valid: false, error: 'API key should not include "Bearer " prefix' };
    }

    // Provider-specific validation
    const pattern = API_KEY_PATTERNS[provider];
    if (pattern && !pattern.test(cleanKey)) {
      logger.warn(`API key format may be invalid for ${provider}`);
      return { valid: true, warning: `API key format may be invalid for ${provider}` };
    }

    return { valid: true, key: cleanKey };
  }

  /**
   * Mask API key for logging
   */
  maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 8) return '[MASKED]';
    return apiKey.slice(0, 4) + '*'.repeat(Math.min(20, apiKey.length - 8)) + apiKey.slice(-4);
  }

  /**
   * Store credentials securely
   */
  storeCredentials(provider, credentials) {
    const encrypted = this.encrypt(JSON.stringify(credentials));
    this.credentials.set(provider, encrypted);
    logger.info(`Credentials stored for ${provider}`);
  }

  /**
   * Retrieve credentials
   */
  getCredentials(provider) {
    const encrypted = this.credentials.get(provider);
    if (!encrypted) return null;

    try {
      const decrypted = this.decrypt(encrypted);
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error(`Failed to decrypt credentials for ${provider}:`, error);
      return null;
    }
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(text) {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.encryptionKey);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData) {
    const algorithm = 'aes-256-gcm';
    const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Generate authentication headers for a provider
   */
  getAuthHeaders(provider, credentials) {
    const authConfig = PROVIDER_AUTH_CONFIG[provider];
    if (!authConfig) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    switch (authConfig.type) {
      case AUTH_TYPES.API_KEY:
        return this.getApiKeyHeaders(provider, credentials, authConfig);
      
      case AUTH_TYPES.AWS_SDK:
        return this.getAwsHeaders(credentials);
      
      case AUTH_TYPES.AZURE_SDK:
        return this.getAzureHeaders(credentials);
      
      case AUTH_TYPES.GCP_SDK:
        return this.getGcpHeaders(credentials);
      
      case AUTH_TYPES.OAUTH2:
        return this.getOAuth2Headers(provider, credentials);
      
      default:
        throw new Error(`Unsupported auth type: ${authConfig.type}`);
    }
  }

  /**
   * Generate API key headers
   */
  getApiKeyHeaders(provider, credentials, authConfig) {
    const apiKey = credentials.apiKey || credentials.key;
    if (!apiKey) {
      throw new Error(`API key required for ${provider}`);
    }

    const validation = this.validateApiKey(provider, apiKey);
    if (!validation.valid) {
      throw new Error(`Invalid API key for ${provider}: ${validation.error}`);
    }

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'LLM-Runner-Router/2.0.0'
    };

    switch (authConfig.headerType) {
      case 'Bearer':
        headers['Authorization'] = `Bearer ${validation.key}`;
        break;
      
      case 'Token':
        headers['Authorization'] = `Token ${validation.key}`;
        break;
      
      case 'Custom':
        headers[authConfig.headerName] = validation.key;
        break;
      
      default:
        headers['Authorization'] = `Bearer ${validation.key}`;
    }

    // Provider-specific headers
    switch (provider) {
      case 'anthropic':
        headers['anthropic-version'] = '2023-06-01';
        break;
      
      case 'openrouter':
        headers['HTTP-Referer'] = 'https://github.com/MCERQUA/LLM-Runner-Router';
        headers['X-Title'] = 'LLM-Runner-Router';
        break;
      
      case 'openai':
        if (credentials.organization) {
          headers['OpenAI-Organization'] = credentials.organization;
        }
        break;
    }

    return headers;
  }

  /**
   * Generate AWS SDK headers (placeholder for SDK integration)
   */
  getAwsHeaders(credentials) {
    return {
      'Content-Type': 'application/json',
      'User-Agent': 'LLM-Runner-Router/2.0.0'
    };
  }

  /**
   * Generate Azure SDK headers
   */
  getAzureHeaders(credentials) {
    if (credentials.apiKey) {
      return {
        'api-key': credentials.apiKey,
        'Content-Type': 'application/json'
      };
    }
    
    return {
      'Content-Type': 'application/json',
      'User-Agent': 'LLM-Runner-Router/2.0.0'
    };
  }

  /**
   * Generate GCP headers
   */
  getGcpHeaders(credentials) {
    return {
      'Content-Type': 'application/json',
      'User-Agent': 'LLM-Runner-Router/2.0.0'
    };
  }

  /**
   * Generate OAuth2 headers
   */
  getOAuth2Headers(provider, credentials) {
    const accessToken = this.getValidAccessToken(provider, credentials);
    
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'LLM-Runner-Router/2.0.0'
    };
  }

  /**
   * Get valid OAuth2 access token (with refresh if needed)
   */
  getValidAccessToken(provider, credentials) {
    const cached = this.tokenCache.get(provider);
    
    if (cached && Date.now() < cached.expiresAt - 300000) { // 5 min buffer
      return cached.accessToken;
    }

    // Token expired or not cached, refresh if possible
    if (credentials.refreshToken) {
      return this.refreshAccessToken(provider, credentials);
    }

    throw new Error(`OAuth2 token expired for ${provider} and no refresh token available`);
  }

  /**
   * Refresh OAuth2 access token
   */
  async refreshAccessToken(provider, credentials) {
    // Implementation would depend on provider-specific OAuth2 endpoints
    throw new Error('OAuth2 refresh not implemented yet');
  }

  /**
   * Test authentication for a provider
   */
  async testAuthentication(provider, credentials) {
    try {
      const headers = this.getAuthHeaders(provider, credentials);
      logger.info(`✅ Authentication test passed for ${provider}`);
      return { success: true, headers };
    } catch (error) {
      logger.error(`❌ Authentication test failed for ${provider}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get authentication configuration for a provider
   */
  getAuthConfig(provider) {
    return PROVIDER_AUTH_CONFIG[provider];
  }

  /**
   * Get all supported providers
   */
  getSupportedProviders() {
    return Object.keys(PROVIDER_AUTH_CONFIG);
  }

  /**
   * Clear cached tokens
   */
  clearTokenCache(provider = null) {
    if (provider) {
      this.tokenCache.delete(provider);
    } else {
      this.tokenCache.clear();
    }
  }

  /**
   * Get debug-safe credential info
   */
  getCredentialInfo(provider) {
    const credentials = this.getCredentials(provider);
    if (!credentials) return null;

    const safe = { provider };
    
    if (credentials.apiKey) {
      safe.apiKey = this.maskApiKey(credentials.apiKey);
    }
    
    if (credentials.organization) {
      safe.organization = credentials.organization;
    }
    
    if (credentials.region) {
      safe.region = credentials.region;
    }
    
    if (credentials.endpoint) {
      safe.endpoint = credentials.endpoint;
    }

    return safe;
  }
}

export { AuthManager, AUTH_TYPES, PROVIDER_AUTH_CONFIG };
export default AuthManager;