/**
 * 🔑 BYOK (Bring Your Own Key) Manager
 * Enables users to use their own API keys from various LLM providers
 * Supports both individual and group/organization key management
 * Echo AI Systems - Universal LLM Access
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../utils/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = new Logger('BYOKManager');

/**
 * Supported provider configurations
 */
const PROVIDER_CONFIGS = {
  openai: {
    name: 'OpenAI',
    keyFormat: 'sk-[A-Za-z0-9]{48}',
    baseURL: 'https://api.openai.com/v1',
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
    validateKey: async (key) => {
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        return response.ok;
      } catch (error) {
        return false;
      }
    }
  },
  anthropic: {
    name: 'Anthropic',
    keyFormat: 'sk-ant-[A-Za-z0-9-]{95}',
    baseURL: 'https://api.anthropic.com',
    headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
    validateKey: async (key) => {
      try {
        // Anthropic doesn't have a simple validation endpoint, we'll validate on first use
        return /^sk-ant-[A-Za-z0-9-]{95}$/.test(key);
      } catch (error) {
        return false;
      }
    }
  },
  google: {
    name: 'Google AI',
    keyFormat: 'AIza[A-Za-z0-9_-]{35}',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    headers: (key) => ({ 'x-goog-api-key': key }),
    validateKey: async (key) => {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        return response.ok;
      } catch (error) {
        return false;
      }
    }
  },
  azure: {
    name: 'Azure OpenAI',
    keyFormat: 'json',
    requiresConfig: true,
    configFields: ['endpoint_url', 'api_key', 'deployment_id', 'api_version'],
    headers: (config) => ({ 'api-key': config.api_key }),
    validateKey: async (config) => {
      if (typeof config === 'string') config = JSON.parse(config);
      try {
        const response = await fetch(`${config.endpoint_url}/deployments?api-version=${config.api_version || '2024-02-15-preview'}`, {
          headers: { 'api-key': config.api_key }
        });
        return response.ok;
      } catch (error) {
        return false;
      }
    }
  },
  bedrock: {
    name: 'AWS Bedrock',
    keyFormat: 'json|string',
    requiresConfig: true,
    configFields: ['access_key_id', 'secret_access_key', 'region'],
    headers: (config) => {
      // AWS signature v4 is complex, handled in BedrockAdapter
      return {};
    },
    validateKey: async (config) => {
      // Basic format validation
      if (typeof config === 'string' && config.startsWith('BEDROCK-')) {
        return true; // Bedrock API key format
      }
      if (typeof config === 'object' && config.access_key_id && config.secret_access_key) {
        return true; // AWS credentials format
      }
      return false;
    }
  },
  cohere: {
    name: 'Cohere',
    keyFormat: '[A-Za-z0-9]{40}',
    baseURL: 'https://api.cohere.ai',
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
    validateKey: async (key) => {
      try {
        const response = await fetch('https://api.cohere.ai/v1/models', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        return response.ok;
      } catch (error) {
        return false;
      }
    }
  },
  mistral: {
    name: 'Mistral AI',
    keyFormat: '[A-Za-z0-9]{32}',
    baseURL: 'https://api.mistral.ai',
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
    validateKey: async (key) => {
      try {
        const response = await fetch('https://api.mistral.ai/v1/models', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        return response.ok;
      } catch (error) {
        return false;
      }
    }
  },
  perplexity: {
    name: 'Perplexity',
    keyFormat: 'pplx-[A-Za-z0-9]{48}',
    baseURL: 'https://api.perplexity.ai',
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
    validateKey: async (key) => {
      return /^pplx-[A-Za-z0-9]{48}$/.test(key);
    }
  },
  groq: {
    name: 'Groq',
    keyFormat: 'gsk_[A-Za-z0-9]{52}',
    baseURL: 'https://api.groq.com/openai/v1',
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
    validateKey: async (key) => {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        return response.ok;
      } catch (error) {
        return false;
      }
    }
  },
  together: {
    name: 'Together AI',
    keyFormat: '[A-Za-z0-9]{64}',
    baseURL: 'https://api.together.xyz',
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
    validateKey: async (key) => {
      try {
        const response = await fetch('https://api.together.xyz/v1/models', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        return response.ok;
      } catch (error) {
        return false;
      }
    }
  },
  deepseek: {
    name: 'DeepSeek',
    keyFormat: 'sk-[A-Za-z0-9]{32}',
    baseURL: 'https://api.deepseek.com',
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
    validateKey: async (key) => {
      return /^sk-[A-Za-z0-9]{32}$/.test(key);
    }
  },
  fireworks: {
    name: 'Fireworks AI',
    keyFormat: '[A-Za-z0-9]{40}',
    baseURL: 'https://api.fireworks.ai/inference/v1',
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
    validateKey: async (key) => {
      return key.length === 40;
    }
  },
  novita: {
    name: 'Novita AI',
    keyFormat: '[A-Za-z0-9-]{36}',
    baseURL: 'https://api.novita.ai',
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
    validateKey: async (key) => {
      return /^[A-Za-z0-9-]{36}$/.test(key);
    }
  },
  openrouter: {
    name: 'OpenRouter',
    keyFormat: 'sk-or-v1-[A-Za-z0-9]{64}',
    baseURL: 'https://openrouter.ai/api/v1',
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
    validateKey: async (key) => {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        return response.ok;
      } catch (error) {
        return false;
      }
    }
  },
  ollama: {
    name: 'Ollama (Local)',
    keyFormat: 'none',
    baseURL: 'http://localhost:11434',
    requiresConfig: true,
    configFields: ['base_url'],
    headers: () => ({}),
    validateKey: async (config) => {
      if (typeof config === 'string') config = JSON.parse(config);
      try {
        const url = config.base_url || 'http://localhost:11434';
        const response = await fetch(`${url}/api/tags`);
        return response.ok;
      } catch (error) {
        return false;
      }
    }
  }
};

export class BYOKManager {
  constructor(options = {}) {
    this.storageFile = options.storageFile || path.join(__dirname, '../../data/byok-keys.json');
    this.encryptionKey = options.encryptionKey || process.env.BYOK_ENCRYPTION_KEY || this.generateEncryptionKey();
    
    // Storage maps
    this.userKeys = new Map(); // userId -> provider -> encrypted key data
    this.groupKeys = new Map(); // groupId -> provider -> encrypted key data
    this.keyMetadata = new Map(); // keyId -> metadata
    this.accessControl = new Map(); // groupId -> [userIds]
    
    logger.info('🔑 BYOK Manager initialized');
  }

  /**
   * Generate encryption key for securing stored keys
   */
  generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Initialize BYOK manager and load existing keys
   */
  async initialize() {
    try {
      await this.ensureDataDirectory();
      await this.loadKeys();
      logger.info(`✅ Loaded BYOK data: ${this.userKeys.size} users, ${this.groupKeys.size} groups`);
    } catch (error) {
      logger.warn('Creating new BYOK storage');
      await this.saveKeys();
    }
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDirectory() {
    const dataDir = path.dirname(this.storageFile);
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(this.encryptionKey, 'hex').slice(0, 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedText) {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = Buffer.from(this.encryptionKey, 'hex').slice(0, 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Load BYOK keys from storage
   */
  async loadKeys() {
    const data = await fs.readFile(this.storageFile, 'utf8');
    const parsed = JSON.parse(data);
    
    // Load user keys
    for (const [userId, providers] of Object.entries(parsed.userKeys || {})) {
      const providerMap = new Map();
      for (const [provider, keyData] of Object.entries(providers)) {
        providerMap.set(provider, keyData);
      }
      this.userKeys.set(userId, providerMap);
    }
    
    // Load group keys
    for (const [groupId, providers] of Object.entries(parsed.groupKeys || {})) {
      const providerMap = new Map();
      for (const [provider, keyData] of Object.entries(providers)) {
        providerMap.set(provider, keyData);
      }
      this.groupKeys.set(groupId, providerMap);
    }
    
    // Load metadata
    for (const [keyId, metadata] of Object.entries(parsed.keyMetadata || {})) {
      this.keyMetadata.set(keyId, metadata);
    }
    
    // Load access control
    for (const [groupId, userIds] of Object.entries(parsed.accessControl || {})) {
      this.accessControl.set(groupId, new Set(userIds));
    }
  }

  /**
   * Save BYOK keys to storage
   */
  async saveKeys() {
    const data = {
      userKeys: {},
      groupKeys: {},
      keyMetadata: Object.fromEntries(this.keyMetadata),
      accessControl: {},
      lastUpdated: new Date().toISOString()
    };
    
    // Convert user keys
    for (const [userId, providers] of this.userKeys) {
      data.userKeys[userId] = Object.fromEntries(providers);
    }
    
    // Convert group keys
    for (const [groupId, providers] of this.groupKeys) {
      data.groupKeys[groupId] = Object.fromEntries(providers);
    }
    
    // Convert access control
    for (const [groupId, userIds] of this.accessControl) {
      data.accessControl[groupId] = Array.from(userIds);
    }
    
    await fs.writeFile(this.storageFile, JSON.stringify(data, null, 2));
  }

  /**
   * Add or update a user's provider key
   */
  async setUserKey(userId, provider, apiKey, metadata = {}) {
    if (!PROVIDER_CONFIGS[provider]) {
      throw new Error(`Unsupported provider: ${provider}`);
    }
    
    const config = PROVIDER_CONFIGS[provider];
    
    // Validate key format
    let keyData = apiKey;
    if (config.requiresConfig && typeof apiKey === 'string') {
      try {
        keyData = JSON.parse(apiKey);
      } catch (error) {
        throw new Error('Invalid configuration format for provider');
      }
    }
    
    // Validate key with provider
    const isValid = await config.validateKey(keyData);
    if (!isValid) {
      throw new Error(`Invalid ${config.name} API key or configuration`);
    }
    
    // Generate unique key ID
    const keyId = `byok_${userId}_${provider}_${Date.now()}`;
    
    // Encrypt and store the key
    const encryptedKey = this.encrypt(typeof keyData === 'object' ? JSON.stringify(keyData) : keyData);
    
    if (!this.userKeys.has(userId)) {
      this.userKeys.set(userId, new Map());
    }
    
    this.userKeys.get(userId).set(provider, {
      keyId,
      encryptedKey,
      addedAt: new Date().toISOString(),
      lastUsed: null,
      usageCount: 0
    });
    
    // Store metadata
    this.keyMetadata.set(keyId, {
      userId,
      provider,
      type: 'user',
      name: metadata.name || `${config.name} Key`,
      description: metadata.description,
      addedAt: new Date().toISOString(),
      active: true,
      limits: metadata.limits || null
    });
    
    await this.saveKeys();
    
    logger.info(`✅ Added ${provider} key for user ${userId}`);
    
    return { keyId, provider, success: true };
  }

  /**
   * Add or update a group's provider key
   */
  async setGroupKey(groupId, provider, apiKey, metadata = {}) {
    if (!PROVIDER_CONFIGS[provider]) {
      throw new Error(`Unsupported provider: ${provider}`);
    }
    
    const config = PROVIDER_CONFIGS[provider];
    
    // Validate key format
    let keyData = apiKey;
    if (config.requiresConfig && typeof apiKey === 'string') {
      try {
        keyData = JSON.parse(apiKey);
      } catch (error) {
        throw new Error('Invalid configuration format for provider');
      }
    }
    
    // Validate key with provider
    const isValid = await config.validateKey(keyData);
    if (!isValid) {
      throw new Error(`Invalid ${config.name} API key or configuration`);
    }
    
    // Generate unique key ID
    const keyId = `byok_group_${groupId}_${provider}_${Date.now()}`;
    
    // Encrypt and store the key
    const encryptedKey = this.encrypt(typeof keyData === 'object' ? JSON.stringify(keyData) : keyData);
    
    if (!this.groupKeys.has(groupId)) {
      this.groupKeys.set(groupId, new Map());
    }
    
    this.groupKeys.get(groupId).set(provider, {
      keyId,
      encryptedKey,
      addedAt: new Date().toISOString(),
      lastUsed: null,
      usageCount: 0,
      sharedBy: metadata.sharedBy || 'admin'
    });
    
    // Store metadata
    this.keyMetadata.set(keyId, {
      groupId,
      provider,
      type: 'group',
      name: metadata.name || `${config.name} Group Key`,
      description: metadata.description,
      sharedBy: metadata.sharedBy,
      addedAt: new Date().toISOString(),
      active: true,
      limits: metadata.limits || null,
      allowedUsers: metadata.allowedUsers || 'all'
    });
    
    await this.saveKeys();
    
    logger.info(`✅ Added ${provider} key for group ${groupId}`);
    
    return { keyId, provider, success: true };
  }

  /**
   * Get decrypted key for user (checks user keys first, then group keys)
   */
  async getUserKey(userId, provider, groupId = null) {
    // Check user's personal keys first
    if (this.userKeys.has(userId)) {
      const userProviders = this.userKeys.get(userId);
      if (userProviders.has(provider)) {
        const keyData = userProviders.get(provider);
        const decryptedKey = this.decrypt(keyData.encryptedKey);
        
        // Update usage stats
        keyData.lastUsed = new Date().toISOString();
        keyData.usageCount++;
        await this.saveKeys();
        
        // Parse if JSON
        try {
          return JSON.parse(decryptedKey);
        } catch {
          return decryptedKey;
        }
      }
    }
    
    // Check group keys if user belongs to group
    if (groupId && this.accessControl.has(groupId)) {
      const groupUsers = this.accessControl.get(groupId);
      if (groupUsers.has(userId) || groupUsers.has('*')) {
        if (this.groupKeys.has(groupId)) {
          const groupProviders = this.groupKeys.get(groupId);
          if (groupProviders.has(provider)) {
            const keyData = groupProviders.get(provider);
            const metadata = this.keyMetadata.get(keyData.keyId);
            
            // Check if user is allowed
            if (metadata.allowedUsers === 'all' || 
                (Array.isArray(metadata.allowedUsers) && metadata.allowedUsers.includes(userId))) {
              const decryptedKey = this.decrypt(keyData.encryptedKey);
              
              // Update usage stats
              keyData.lastUsed = new Date().toISOString();
              keyData.usageCount++;
              await this.saveKeys();
              
              // Parse if JSON
              try {
                return JSON.parse(decryptedKey);
              } catch {
                return decryptedKey;
              }
            }
          }
        }
      }
    }
    
    return null;
  }

  /**
   * List all available providers for a user
   */
  async getUserProviders(userId, groupId = null) {
    const providers = new Set();
    
    // Add user's personal providers
    if (this.userKeys.has(userId)) {
      const userProviders = this.userKeys.get(userId);
      for (const provider of userProviders.keys()) {
        providers.add(provider);
      }
    }
    
    // Add group providers if applicable
    if (groupId && this.accessControl.has(groupId)) {
      const groupUsers = this.accessControl.get(groupId);
      if (groupUsers.has(userId) || groupUsers.has('*')) {
        if (this.groupKeys.has(groupId)) {
          const groupProviders = this.groupKeys.get(groupId);
          for (const provider of groupProviders.keys()) {
            providers.add(provider);
          }
        }
      }
    }
    
    return Array.from(providers).map(provider => ({
      provider,
      name: PROVIDER_CONFIGS[provider].name,
      hasUserKey: this.userKeys.get(userId)?.has(provider) || false,
      hasGroupKey: groupId ? this.groupKeys.get(groupId)?.has(provider) || false : false
    }));
  }

  /**
   * Remove a user's provider key
   */
  async removeUserKey(userId, provider) {
    if (this.userKeys.has(userId)) {
      const userProviders = this.userKeys.get(userId);
      if (userProviders.has(provider)) {
        const keyData = userProviders.get(provider);
        userProviders.delete(provider);
        this.keyMetadata.delete(keyData.keyId);
        
        if (userProviders.size === 0) {
          this.userKeys.delete(userId);
        }
        
        await this.saveKeys();
        logger.info(`🗑️ Removed ${provider} key for user ${userId}`);
        return true;
      }
    }
    return false;
  }

  /**
   * Add user to group
   */
  async addUserToGroup(userId, groupId) {
    if (!this.accessControl.has(groupId)) {
      this.accessControl.set(groupId, new Set());
    }
    
    this.accessControl.get(groupId).add(userId);
    await this.saveKeys();
    
    logger.info(`👥 Added user ${userId} to group ${groupId}`);
  }

  /**
   * Remove user from group
   */
  async removeUserFromGroup(userId, groupId) {
    if (this.accessControl.has(groupId)) {
      this.accessControl.get(groupId).delete(userId);
      
      if (this.accessControl.get(groupId).size === 0) {
        this.accessControl.delete(groupId);
      }
      
      await this.saveKeys();
      logger.info(`👥 Removed user ${userId} from group ${groupId}`);
    }
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(userId = null, groupId = null) {
    const stats = {
      userKeys: 0,
      groupKeys: 0,
      providers: new Set(),
      totalUsage: 0
    };
    
    if (userId && this.userKeys.has(userId)) {
      const userProviders = this.userKeys.get(userId);
      stats.userKeys = userProviders.size;
      for (const [provider, keyData] of userProviders) {
        stats.providers.add(provider);
        stats.totalUsage += keyData.usageCount;
      }
    }
    
    if (groupId && this.groupKeys.has(groupId)) {
      const groupProviders = this.groupKeys.get(groupId);
      stats.groupKeys = groupProviders.size;
      for (const [provider, keyData] of groupProviders) {
        stats.providers.add(provider);
        stats.totalUsage += keyData.usageCount;
      }
    }
    
    stats.providers = Array.from(stats.providers);
    
    return stats;
  }

  /**
   * Validate all stored keys
   */
  async validateStoredKeys() {
    const validationResults = {
      userKeys: {},
      groupKeys: {}
    };
    
    // Validate user keys
    for (const [userId, providers] of this.userKeys) {
      validationResults.userKeys[userId] = {};
      for (const [provider, keyData] of providers) {
        const config = PROVIDER_CONFIGS[provider];
        const decryptedKey = this.decrypt(keyData.encryptedKey);
        let keyToValidate = decryptedKey;
        
        try {
          keyToValidate = JSON.parse(decryptedKey);
        } catch {
          // Key is not JSON
        }
        
        const isValid = await config.validateKey(keyToValidate);
        validationResults.userKeys[userId][provider] = isValid;
        
        if (!isValid) {
          logger.warn(`❌ Invalid ${provider} key for user ${userId}`);
        }
      }
    }
    
    // Validate group keys
    for (const [groupId, providers] of this.groupKeys) {
      validationResults.groupKeys[groupId] = {};
      for (const [provider, keyData] of providers) {
        const config = PROVIDER_CONFIGS[provider];
        const decryptedKey = this.decrypt(keyData.encryptedKey);
        let keyToValidate = decryptedKey;
        
        try {
          keyToValidate = JSON.parse(decryptedKey);
        } catch {
          // Key is not JSON
        }
        
        const isValid = await config.validateKey(keyToValidate);
        validationResults.groupKeys[groupId][provider] = isValid;
        
        if (!isValid) {
          logger.warn(`❌ Invalid ${provider} key for group ${groupId}`);
        }
      }
    }
    
    return validationResults;
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(provider) {
    return PROVIDER_CONFIGS[provider] || null;
  }

  /**
   * List all supported providers
   */
  getSupportedProviders() {
    return Object.entries(PROVIDER_CONFIGS).map(([key, config]) => ({
      id: key,
      name: config.name,
      requiresConfig: config.requiresConfig || false,
      configFields: config.configFields || []
    }));
  }
}

export default BYOKManager;