# 🔐 Authentication Patterns & Configuration Guide

*Comprehensive guide to authentication methods across LLM providers*

## 📋 Table of Contents

1. [Authentication Overview](#authentication-overview)
2. [API Key Authentication](#api-key-authentication)
3. [Cloud SDK Authentication](#cloud-sdk-authentication)
4. [OAuth2 Authentication](#oauth2-authentication)
5. [Custom Authentication](#custom-authentication)
6. [Environment Variables](#environment-variables)
7. [Security Best Practices](#security-best-practices)
8. [Provider-Specific Patterns](#provider-specific-patterns)
9. [Configuration Examples](#configuration-examples)
10. [Troubleshooting](#troubleshooting)

## 🔍 Authentication Overview

Different LLM providers use various authentication methods. LLM-Runner-Router supports all major patterns through a unified configuration system.

### Supported Authentication Types

| Type | Providers | Complexity | Security Level |
|------|-----------|------------|----------------|
| **API Key** | OpenAI, Anthropic, Groq, OpenRouter | Low | Medium |
| **Cloud SDK** | AWS Bedrock, Azure OpenAI, Google Vertex | Medium | High |
| **OAuth2** | Enterprise providers | High | Very High |
| **Custom** | Specialized providers | Variable | Variable |

## 🔑 API Key Authentication

The most common authentication method for LLM providers.

### Basic Pattern

```javascript
import { LLMRouter } from 'llm-runner-router';

const router = new LLMRouter({
  providers: ['openai'],
  openai: {
    apiKey: 'sk-your-api-key-here'
  }
});
```

### Environment Variable Pattern (Recommended)

```javascript
// Set environment variable
// OPENAI_API_KEY=sk-your-api-key-here

const router = new LLMRouter({
  providers: ['openai'],
  openai: {
    // API key automatically loaded from OPENAI_API_KEY
  }
});
```

### Multiple Providers with API Keys

```javascript
const router = new LLMRouter({
  providers: ['openai', 'anthropic', 'groq'],
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY
  }
});
```

### API Key Validation

```javascript
class APIKeyValidator {
  static patterns = {
    openai: /^sk-[A-Za-z0-9]{48}$/,
    anthropic: /^sk-ant-api\d{2}-[A-Za-z0-9-_]{95}$/,
    groq: /^gsk_[A-Za-z0-9]{52}$/,
    openrouter: /^sk-or-v1-[A-Za-z0-9]{64}$/
  };

  static validate(provider, apiKey) {
    const pattern = this.patterns[provider];
    if (!pattern) return true; // No pattern defined
    
    return pattern.test(apiKey);
  }

  static mask(apiKey) {
    if (!apiKey || apiKey.length < 8) return '[MASKED]';
    return apiKey.slice(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.slice(-4);
  }
}

// Usage in adapter
constructor(config) {
  super(config);
  
  if (!APIKeyValidator.validate(this.provider, this.apiKey)) {
    logger.warn(`API key format may be invalid for ${this.provider}`);
  }
}
```

## ☁️ Cloud SDK Authentication

For cloud providers (AWS, Azure, GCP), authentication uses cloud SDKs with IAM roles, service accounts, or managed identities.

### AWS Bedrock Authentication

```javascript
import { BedrockClient } from '@aws-sdk/client-bedrock';

class BedrockAdapter extends APILoader {
  constructor(config = {}) {
    super(config);
    
    this.region = config.region || 'us-east-1';
    this.credentials = config.credentials;
  }

  async initialize() {
    this.client = new BedrockClient({
      region: this.region,
      credentials: this.credentials || undefined // Use default credential chain
    });
  }
}

// Usage patterns
const router = new LLMRouter({
  providers: ['bedrock'],
  bedrock: {
    region: 'us-east-1',
    // Option 1: Use default AWS credential chain (recommended)
    
    // Option 2: Explicit credentials
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN // Optional
    },
    
    // Option 3: IAM role assumption
    roleArn: 'arn:aws:iam::123456789012:role/BedrockRole'
  }
});
```

### Azure OpenAI Authentication

```javascript
import { OpenAIClient, AzureKeyCredential } from '@azure/openai';

class AzureOpenAIAdapter extends APILoader {
  constructor(config = {}) {
    super(config);
    
    this.endpoint = config.endpoint;
    this.apiVersion = config.apiVersion || '2024-02-01';
    this.credential = this.createCredential(config);
  }

  createCredential(config) {
    if (config.apiKey) {
      return new AzureKeyCredential(config.apiKey);
    } else if (config.tokenCredential) {
      return config.tokenCredential; // Azure AD token
    } else {
      throw new Error('Azure OpenAI requires apiKey or tokenCredential');
    }
  }

  async initialize() {
    this.client = new OpenAIClient(this.endpoint, this.credential);
  }
}

// Usage patterns
const router = new LLMRouter({
  providers: ['azure-openai'],
  'azure-openai': {
    endpoint: 'https://your-resource.openai.azure.com/',
    apiVersion: '2024-02-01',
    
    // Option 1: API Key authentication
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    
    // Option 2: Azure AD authentication
    tokenCredential: new DefaultAzureCredential(),
    
    // Option 3: Managed Identity
    useManagedIdentity: true
  }
});
```

### Google Vertex AI Authentication

```javascript
import { VertexAI } from '@google-cloud/vertexai';

class VertexAIAdapter extends APILoader {
  constructor(config = {}) {
    super(config);
    
    this.projectId = config.projectId;
    this.location = config.location || 'us-central1';
    this.keyFilename = config.keyFilename;
  }

  async initialize() {
    const vertexAI = new VertexAI({
      project: this.projectId,
      location: this.location,
      googleAuthOptions: {
        keyFilename: this.keyFilename // Optional, uses default if not provided
      }
    });
    
    this.generativeModel = vertexAI.getGenerativeModel({
      model: 'gemini-pro'
    });
  }
}

// Usage patterns
const router = new LLMRouter({
  providers: ['vertex-ai'],
  'vertex-ai': {
    projectId: 'your-gcp-project-id',
    location: 'us-central1',
    
    // Option 1: Service account key file
    keyFilename: '/path/to/service-account.json',
    
    // Option 2: Service account key JSON
    credentials: {
      type: 'service_account',
      project_id: 'your-project',
      private_key_id: 'key-id',
      private_key: '-----BEGIN PRIVATE KEY-----\n...',
      client_email: 'service@project.iam.gserviceaccount.com'
    },
    
    // Option 3: Use default credentials (for GCP environments)
    useDefaultCredentials: true
  }
});
```

## 🔐 OAuth2 Authentication

For enterprise providers that require OAuth2 authentication.

### OAuth2 Flow Implementation

```javascript
class OAuth2Adapter extends APILoader {
  constructor(config = {}) {
    super(config);
    
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.scope = config.scope || 'llm:read llm:write';
    
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
    this.tokenExpiry = config.tokenExpiry;
  }

  async authenticate() {
    if (!this.accessToken || this.isTokenExpired()) {
      if (this.refreshToken) {
        await this.refreshAccessToken();
      } else {
        throw new Error('OAuth2 authentication required');
      }
    }
  }

  async refreshAccessToken() {
    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      })
    });

    if (!response.ok) {
      throw new Error('Failed to refresh access token');
    }

    const data = await response.json();
    
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);
    
    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }
  }

  isTokenExpired() {
    return !this.tokenExpiry || Date.now() >= this.tokenExpiry - 300000; // 5 min buffer
  }

  async getAuthorizationUrl() {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scope,
      state: this.generateState()
    });

    return `${this.authEndpoint}?${params.toString()}`;
  }

  async exchangeCodeForToken(code, state) {
    // Verify state to prevent CSRF
    if (!this.verifyState(state)) {
      throw new Error('Invalid state parameter');
    }

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret
      })
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const data = await response.json();
    
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);
    
    return data;
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }
}
```

### OAuth2 Configuration Example

```javascript
const router = new LLMRouter({
  providers: ['enterprise-provider'],
  'enterprise-provider': {
    authType: 'oauth2',
    clientId: process.env.ENTERPRISE_CLIENT_ID,
    clientSecret: process.env.ENTERPRISE_CLIENT_SECRET,
    redirectUri: 'https://yourapp.com/oauth/callback',
    scope: 'llm:read llm:write',
    
    // Pre-existing tokens (optional)
    accessToken: process.env.ENTERPRISE_ACCESS_TOKEN,
    refreshToken: process.env.ENTERPRISE_REFRESH_TOKEN
  }
});
```

## 🔧 Custom Authentication

For providers with unique authentication requirements.

### Custom Header Authentication

```javascript
class CustomHeaderAdapter extends APILoader {
  constructor(config = {}) {
    super(config);
    
    this.customHeaders = config.customHeaders || {};
    this.signatureKey = config.signatureKey;
  }

  getHeaders() {
    const timestamp = Date.now().toString();
    const signature = this.generateSignature(timestamp);
    
    return {
      'Content-Type': 'application/json',
      'X-Timestamp': timestamp,
      'X-Signature': signature,
      'X-API-Version': '2024-01',
      ...this.customHeaders
    };
  }

  generateSignature(timestamp) {
    const payload = `${timestamp}:${this.signatureKey}`;
    return crypto.createHmac('sha256', this.signatureKey).update(payload).digest('hex');
  }
}
```

### JWT Authentication

```javascript
import jwt from 'jsonwebtoken';

class JWTAdapter extends APILoader {
  constructor(config = {}) {
    super(config);
    
    this.privateKey = config.privateKey;
    this.keyId = config.keyId;
    this.issuer = config.issuer;
    this.audience = config.audience;
  }

  generateJWT() {
    const payload = {
      iss: this.issuer,
      aud: this.audience,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
    };

    return jwt.sign(payload, this.privateKey, {
      algorithm: 'RS256',
      keyid: this.keyId
    });
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.generateJWT()}`,
      'Content-Type': 'application/json'
    };
  }
}
```

## 🌍 Environment Variables

### Standard Environment Variable Patterns

```bash
# API Key providers
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GROQ_API_KEY=gsk_your-groq-key
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key
MISTRAL_API_KEY=your-mistral-key
COHERE_API_KEY=your-cohere-key
PERPLEXITY_API_KEY=pplx-your-perplexity-key

# Cloud providers
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_SESSION_TOKEN=your-aws-session-token
AWS_REGION=us-east-1

AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/

GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
GOOGLE_CLOUD_PROJECT=your-gcp-project

# OAuth2 providers
ENTERPRISE_CLIENT_ID=your-client-id
ENTERPRISE_CLIENT_SECRET=your-client-secret
ENTERPRISE_ACCESS_TOKEN=your-access-token
ENTERPRISE_REFRESH_TOKEN=your-refresh-token
```

### Environment Variable Loading

```javascript
import dotenv from 'dotenv';

// Load from .env file
dotenv.config();

// Or load from specific file
dotenv.config({ path: '.env.local' });

// Environment variable helper
class EnvConfig {
  static get(key, defaultValue = null) {
    const value = process.env[key];
    if (value === undefined && defaultValue === null) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value || defaultValue;
  }

  static getRequired(key) {
    return this.get(key);
  }

  static getOptional(key, defaultValue = null) {
    return this.get(key, defaultValue);
  }

  static getBoolean(key, defaultValue = false) {
    const value = this.get(key, defaultValue.toString());
    return value.toLowerCase() === 'true';
  }

  static getNumber(key, defaultValue = 0) {
    const value = this.get(key, defaultValue.toString());
    return parseInt(value, 10);
  }
}

// Usage in adapter
class ProviderAdapter extends APILoader {
  constructor(config = {}) {
    super(config);
    
    this.apiKey = config.apiKey || EnvConfig.getRequired('PROVIDER_API_KEY');
    this.baseURL = config.baseURL || EnvConfig.getOptional('PROVIDER_BASE_URL', 'https://api.provider.com');
    this.timeout = config.timeout || EnvConfig.getNumber('PROVIDER_TIMEOUT', 30000);
    this.retries = config.retries || EnvConfig.getNumber('PROVIDER_RETRIES', 3);
  }
}
```

## 🛡️ Security Best Practices

### 1. API Key Security

```javascript
class SecureAdapter extends APILoader {
  constructor(config) {
    super(config);
    
    // Validate API key
    this.validateApiKey(config.apiKey);
    
    // Store securely (never log)
    this.apiKey = this.sanitizeApiKey(config.apiKey);
  }

  validateApiKey(apiKey) {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    if (typeof apiKey !== 'string') {
      throw new Error('API key must be a string');
    }

    if (apiKey.length < 10) {
      throw new Error('API key appears to be too short');
    }

    // Check for common mistakes
    if (apiKey.includes(' ')) {
      logger.warn('API key contains spaces, this may cause issues');
    }

    if (apiKey.startsWith('Bearer ')) {
      throw new Error('API key should not include "Bearer " prefix');
    }
  }

  sanitizeApiKey(apiKey) {
    return apiKey.trim();
  }

  // Never log the actual API key
  getLogSafeConfig() {
    return {
      ...this.config,
      apiKey: this.maskApiKey(this.apiKey)
    };
  }

  maskApiKey(key) {
    if (!key || key.length < 8) return '[MASKED]';
    return key.slice(0, 4) + '*'.repeat(key.length - 8) + key.slice(-4);
  }
}
```

### 2. Credential Rotation

```javascript
class RotatingCredentialAdapter extends APILoader {
  constructor(config) {
    super(config);
    
    this.credentials = new Map();
    this.currentCredential = 0;
    this.rotationInterval = config.rotationInterval || 3600000; // 1 hour
    
    this.setupRotation();
  }

  addCredential(name, credential) {
    this.credentials.set(name, {
      ...credential,
      lastUsed: 0,
      errorCount: 0
    });
  }

  getCurrentCredential() {
    const keys = Array.from(this.credentials.keys());
    if (keys.length === 0) throw new Error('No credentials available');
    
    const key = keys[this.currentCredential % keys.length];
    return this.credentials.get(key);
  }

  rotateCredential() {
    this.currentCredential = (this.currentCredential + 1) % this.credentials.size;
    logger.info(`Rotated to credential ${this.currentCredential}`);
  }

  setupRotation() {
    setInterval(() => {
      this.rotateCredential();
    }, this.rotationInterval);
  }

  async makeRequest(endpoint, options) {
    const credential = this.getCurrentCredential();
    
    try {
      const response = await super.makeRequest(endpoint, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${credential.apiKey}`
        }
      });
      
      credential.lastUsed = Date.now();
      credential.errorCount = 0;
      
      return response;
    } catch (error) {
      credential.errorCount++;
      
      if (credential.errorCount >= 3) {
        logger.warn(`Credential has failed ${credential.errorCount} times, rotating`);
        this.rotateCredential();
      }
      
      throw error;
    }
  }
}
```

### 3. Secure Storage

```javascript
import crypto from 'crypto';

class SecureCredentialStore {
  constructor(encryptionKey) {
    this.encryptionKey = encryptionKey || process.env.CREDENTIAL_ENCRYPTION_KEY;
    this.algorithm = 'aes-256-gcm';
  }

  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
    cipher.setAAD(iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encryptedData) {
    const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
    decipher.setAAD(Buffer.from(encryptedData.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  store(key, credential) {
    const encrypted = this.encrypt(JSON.stringify(credential));
    // Store encrypted data (in file, database, etc.)
    return encrypted;
  }

  retrieve(key) {
    const encrypted = this.loadEncryptedData(key);
    const decrypted = this.decrypt(encrypted);
    return JSON.parse(decrypted);
  }
}
```

## 🎯 Provider-Specific Patterns

### OpenAI Family (OpenAI, Azure OpenAI)

```javascript
// Standard OpenAI
const openaiConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID, // Optional
  baseURL: 'https://api.openai.com/v1' // Default
};

// Azure OpenAI
const azureConfig = {
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: 'https://your-resource.openai.azure.com',
  apiVersion: '2024-02-01',
  deployment: 'your-deployment-name'
};
```

### Anthropic

```javascript
const anthropicConfig = {
  apiKey: process.env.ANTHROPIC_API_KEY,
  version: '2023-06-01',
  betaFeatures: ['messages-2023-12-15'],
  baseURL: 'https://api.anthropic.com' // Default
};
```

### Cloud Providers

```javascript
// AWS Bedrock
const bedrockConfig = {
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
};

// Google Vertex AI
const vertexConfig = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  location: 'us-central1',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
};
```

## 📝 Configuration Examples

### Development Configuration

```javascript
// .env.development
OPENAI_API_KEY=sk-dev-key
ANTHROPIC_API_KEY=sk-ant-dev-key
LOG_LEVEL=debug
RATE_LIMIT_ENABLED=false

// Development router
const router = new LLMRouter({
  providers: ['openai', 'anthropic'],
  logLevel: 'debug',
  retries: 1,
  timeout: 10000
});
```

### Production Configuration

```javascript
// .env.production
OPENAI_API_KEY=sk-prod-key
ANTHROPIC_API_KEY=sk-ant-prod-key
LOG_LEVEL=info
RATE_LIMIT_ENABLED=true
ENABLE_CACHING=true

// Production router with security features
const router = new LLMRouter({
  providers: ['openai', 'anthropic'],
  security: {
    enableRateLimit: true,
    enableCaching: true,
    enableCircuitBreaker: true
  },
  monitoring: {
    enableMetrics: true,
    enableTracing: true
  }
});
```

### Multi-Environment Configuration

```javascript
class ConfigManager {
  static getConfig(environment = process.env.NODE_ENV) {
    const baseConfig = {
      logLevel: 'info',
      timeout: 30000,
      retries: 3
    };

    const envConfigs = {
      development: {
        ...baseConfig,
        logLevel: 'debug',
        retries: 1,
        enableCaching: false
      },
      
      staging: {
        ...baseConfig,
        enableCaching: true,
        enableRateLimit: true
      },
      
      production: {
        ...baseConfig,
        enableCaching: true,
        enableRateLimit: true,
        enableCircuitBreaker: true,
        enableMetrics: true
      }
    };

    return envConfigs[environment] || baseConfig;
  }
}

// Usage
const config = ConfigManager.getConfig();
const router = new LLMRouter(config);
```

## 🔧 Troubleshooting

### Common Authentication Issues

#### Issue: "API key invalid"
```javascript
// Check API key format
if (!APIKeyValidator.validate('openai', apiKey)) {
  console.error('API key format is invalid');
  console.log('Expected format: sk-[48 characters]');
}

// Check environment variable
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY environment variable not set');
}
```

#### Issue: "Authentication failed"
```javascript
// Test authentication
async function testAuth(provider, config) {
  try {
    const adapter = new ProviderAdapter(config);
    await adapter.testConnection();
    console.log(`✅ ${provider} authentication successful`);
  } catch (error) {
    console.error(`❌ ${provider} authentication failed:`, error.message);
  }
}
```

#### Issue: "Token expired" (OAuth2)
```javascript
// Implement automatic token refresh
class AutoRefreshAdapter extends OAuth2Adapter {
  async makeRequest(endpoint, options) {
    if (this.isTokenExpired()) {
      await this.refreshAccessToken();
    }
    
    return super.makeRequest(endpoint, options);
  }
}
```

### Debugging Authentication

```javascript
class AuthDebugger {
  static debugConfig(config) {
    console.log('Configuration debug:');
    
    for (const [provider, providerConfig] of Object.entries(config)) {
      console.log(`\n${provider}:`);
      
      if (providerConfig.apiKey) {
        console.log(`  API Key: ${this.maskKey(providerConfig.apiKey)}`);
        console.log(`  Key valid: ${this.validateKeyFormat(provider, providerConfig.apiKey)}`);
      }
      
      if (providerConfig.baseURL) {
        console.log(`  Base URL: ${providerConfig.baseURL}`);
      }
      
      if (providerConfig.region) {
        console.log(`  Region: ${providerConfig.region}`);
      }
    }
  }

  static maskKey(key) {
    if (!key || key.length < 8) return '[INVALID]';
    return key.slice(0, 4) + '*'.repeat(Math.min(20, key.length - 8)) + key.slice(-4);
  }

  static validateKeyFormat(provider, key) {
    return APIKeyValidator.validate(provider, key);
  }
}

// Usage
AuthDebugger.debugConfig({
  openai: { apiKey: process.env.OPENAI_API_KEY },
  anthropic: { apiKey: process.env.ANTHROPIC_API_KEY }
});
```

This comprehensive authentication guide ensures secure, reliable authentication across all supported LLM providers with proper error handling, security best practices, and troubleshooting guidance.