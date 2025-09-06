/**
 * 🔑 API Key Management System
 * Production-ready authentication for SaaS deployment
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../utils/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = new Logger('APIKeyManager');

export class APIKeyManager {
  constructor(options = {}) {
    this.keysFile = options.keysFile || path.join(__dirname, '../../data/api-keys.json');
    this.secretKey = options.secretKey || process.env.API_SECRET_KEY || this.generateSecret();
    this.keys = new Map();
    this.usage = new Map();
    
    // Ensure data directory exists
    this.ensureDataDirectory();
  }

  /**
   * Generate a cryptographically secure secret
   */
  generateSecret() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDirectory() {
    const dataDir = path.dirname(this.keysFile);
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  /**
   * Initialize the API key manager
   */
  async initialize() {
    try {
      await this.loadKeys();
      logger.info(`🔑 API Key Manager initialized with ${this.keys.size} keys`);
    } catch (error) {
      logger.info('🔑 Creating new API keys database');
      await this.saveKeys();
    }
  }

  /**
   * Load API keys from storage
   */
  async loadKeys() {
    const data = await fs.readFile(this.keysFile, 'utf8');
    const parsed = JSON.parse(data);
    
    for (const [keyId, keyData] of Object.entries(parsed.keys || {})) {
      this.keys.set(keyId, keyData);
    }
    
    for (const [keyId, usageData] of Object.entries(parsed.usage || {})) {
      this.usage.set(keyId, usageData);
    }
  }

  /**
   * Save API keys to storage
   */
  async saveKeys() {
    const data = {
      keys: Object.fromEntries(this.keys),
      usage: Object.fromEntries(this.usage),
      lastUpdated: new Date().toISOString()
    };
    
    await fs.writeFile(this.keysFile, JSON.stringify(data, null, 2));
  }

  /**
   * Generate a new API key for a customer
   */
  async createAPIKey(customerInfo = {}) {
    const keyId = 'llm_' + crypto.randomBytes(16).toString('hex');
    const keySecret = crypto.randomBytes(32).toString('hex');
    const keyHash = await bcrypt.hash(keySecret, 12);
    
    const keyData = {
      id: keyId,
      hash: keyHash,
      customer: customerInfo.name || 'Unknown',
      email: customerInfo.email || null,
      tier: customerInfo.tier || 'basic',
      createdAt: new Date().toISOString(),
      lastUsed: null,
      active: true,
      rateLimit: this.getRateLimitForTier(customerInfo.tier || 'basic'),
      quotas: this.getQuotasForTier(customerInfo.tier || 'basic')
    };
    
    this.keys.set(keyId, keyData);
    this.usage.set(keyId, {
      requestCount: 0,
      tokenCount: 0,
      lastReset: new Date().toISOString(),
      dailyUsage: {},
      monthlyUsage: {}
    });
    
    await this.saveKeys();
    
    // Return the full key (prefix + secret) - only shown once
    const fullKey = `${keyId}.${keySecret}`;
    
    logger.info(`🔑 Created API key for ${customerInfo.name || 'customer'}: ${keyId}`);
    
    return {
      keyId,
      fullKey,
      tier: keyData.tier,
      rateLimit: keyData.rateLimit,
      quotas: keyData.quotas
    };
  }

  /**
   * Validate an API key
   */
  async validateKey(fullKey) {
    if (!fullKey || !fullKey.includes('.')) {
      return { valid: false, error: 'Invalid key format' };
    }
    
    const [keyId, keySecret] = fullKey.split('.');
    
    if (!this.keys.has(keyId)) {
      return { valid: false, error: 'Key not found' };
    }
    
    const keyData = this.keys.get(keyId);
    
    if (!keyData.active) {
      return { valid: false, error: 'Key deactivated' };
    }
    
    const isValid = await bcrypt.compare(keySecret, keyData.hash);
    
    if (!isValid) {
      return { valid: false, error: 'Invalid credentials' };
    }
    
    // Update last used
    keyData.lastUsed = new Date().toISOString();
    await this.saveKeys();
    
    return {
      valid: true,
      keyId,
      customer: keyData.customer,
      tier: keyData.tier,
      rateLimit: keyData.rateLimit,
      quotas: keyData.quotas
    };
  }

  /**
   * Check rate limits for a key
   */
  async checkRateLimit(keyId) {
    const keyData = this.keys.get(keyId);
    const usage = this.usage.get(keyId);
    
    if (!keyData || !usage) {
      return { allowed: false, error: 'Key not found' };
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.toDateString();
    
    // Initialize daily usage if needed
    if (!usage.dailyUsage[currentDay]) {
      usage.dailyUsage[currentDay] = { requests: 0, tokens: 0 };
    }
    
    const dailyUsage = usage.dailyUsage[currentDay];
    
    // Check daily limits
    if (dailyUsage.requests >= keyData.quotas.dailyRequests) {
      return { 
        allowed: false, 
        error: 'Daily request limit exceeded',
        reset: new Date(now.getTime() + (24 - currentHour) * 60 * 60 * 1000)
      };
    }
    
    if (dailyUsage.tokens >= keyData.quotas.dailyTokens) {
      return { 
        allowed: false, 
        error: 'Daily token limit exceeded',
        reset: new Date(now.getTime() + (24 - currentHour) * 60 * 60 * 1000)
      };
    }
    
    return { allowed: true };
  }

  /**
   * Record usage for a key
   */
  async recordUsage(keyId, tokens = 0) {
    const usage = this.usage.get(keyId);
    
    if (!usage) return;
    
    const now = new Date();
    const currentDay = now.toDateString();
    const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
    
    // Update daily usage
    if (!usage.dailyUsage[currentDay]) {
      usage.dailyUsage[currentDay] = { requests: 0, tokens: 0 };
    }
    usage.dailyUsage[currentDay].requests++;
    usage.dailyUsage[currentDay].tokens += tokens;
    
    // Update monthly usage
    if (!usage.monthlyUsage[currentMonth]) {
      usage.monthlyUsage[currentMonth] = { requests: 0, tokens: 0 };
    }
    usage.monthlyUsage[currentMonth].requests++;
    usage.monthlyUsage[currentMonth].tokens += tokens;
    
    // Update total usage
    usage.requestCount++;
    usage.tokenCount += tokens;
    
    // Clean up old daily usage (keep only last 30 days)
    this.cleanupOldUsage(usage);
    
    await this.saveKeys();
  }

  /**
   * Clean up old usage data
   */
  cleanupOldUsage(usage) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    for (const day in usage.dailyUsage) {
      if (new Date(day) < thirtyDaysAgo) {
        delete usage.dailyUsage[day];
      }
    }
  }

  /**
   * Get rate limits for tier
   */
  getRateLimitForTier(tier) {
    const limits = {
      basic: { requestsPerMinute: 60, requestsPerHour: 1000 },
      pro: { requestsPerMinute: 300, requestsPerHour: 10000 },
      enterprise: { requestsPerMinute: 1000, requestsPerHour: 50000 }
    };
    
    return limits[tier] || limits.basic;
  }

  /**
   * Get quotas for tier
   */
  getQuotasForTier(tier) {
    const quotas = {
      basic: { dailyRequests: 1000, dailyTokens: 100000, monthlyRequests: 25000 },
      pro: { dailyRequests: 10000, dailyTokens: 1000000, monthlyRequests: 250000 },
      enterprise: { dailyRequests: 100000, dailyTokens: 10000000, monthlyRequests: 2500000 }
    };
    
    return quotas[tier] || quotas.basic;
  }

  /**
   * List all API keys (admin function)
   */
  listKeys() {
    const keys = [];
    
    for (const [keyId, keyData] of this.keys) {
      const usage = this.usage.get(keyId) || {};
      
      keys.push({
        id: keyId,
        customer: keyData.customer,
        tier: keyData.tier,
        active: keyData.active,
        createdAt: keyData.createdAt,
        lastUsed: keyData.lastUsed,
        totalRequests: usage.requestCount || 0,
        totalTokens: usage.tokenCount || 0
      });
    }
    
    return keys;
  }

  /**
   * Deactivate an API key
   */
  async deactivateKey(keyId) {
    const keyData = this.keys.get(keyId);
    
    if (!keyData) {
      throw new Error('Key not found');
    }
    
    keyData.active = false;
    await this.saveKeys();
    
    logger.info(`🔑 Deactivated API key: ${keyId}`);
  }

  /**
   * Get usage statistics for a key
   */
  getUsageStats(keyId) {
    const keyData = this.keys.get(keyId);
    const usage = this.usage.get(keyId);
    
    if (!keyData || !usage) {
      return null;
    }
    
    const now = new Date();
    const currentDay = now.toDateString();
    const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
    
    return {
      keyId,
      customer: keyData.customer,
      tier: keyData.tier,
      quotas: keyData.quotas,
      rateLimit: keyData.rateLimit,
      usage: {
        total: {
          requests: usage.requestCount,
          tokens: usage.tokenCount
        },
        today: usage.dailyUsage[currentDay] || { requests: 0, tokens: 0 },
        thisMonth: usage.monthlyUsage[currentMonth] || { requests: 0, tokens: 0 }
      }
    };
  }
}

export default APIKeyManager;