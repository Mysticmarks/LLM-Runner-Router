/**
 * 🔑 Persistent Test API Key System
 * Creates a fixed API key specifically for testing that survives restarts and updates
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PersistentTestKey {
  constructor(options = {}) {
    // Fixed test key configuration - these values never change
    this.FIXED_TEST_KEY_ID = 'llm_test_persistent_key_fixed_2025';
    this.FIXED_TEST_SECRET = 'persistent_test_secret_never_changes_mikecerqua_2025_llm_router';
    this.TEST_KEY_FULL = `${this.FIXED_TEST_KEY_ID}.${this.FIXED_TEST_SECRET}`;
    
    this.keysFile = options.keysFile || path.join(__dirname, '../../data/api-keys.json');
    this.configFile = options.configFile || path.join(__dirname, '../../data/persistent-test-key.json');
  }

  /**
   * Generate the persistent test key configuration
   */
  async generatePersistentTestKey() {
    // Hash the fixed secret for storage
    const keyHash = await bcrypt.hash(this.FIXED_TEST_SECRET, 12);
    
    const testKeyData = {
      id: this.FIXED_TEST_KEY_ID,
      hash: keyHash,
      customer: 'Testing User (Persistent)',
      email: 'test-persistent@llm-router.local',
      tier: 'pro', // Give it pro tier for testing
      createdAt: '2025-08-22T00:00:00.000Z', // Fixed creation date
      lastUsed: null,
      active: true,
      rateLimit: {
        requestsPerMinute: 300,
        requestsPerHour: 10000
      },
      quotas: {
        dailyRequests: 10000,
        dailyTokens: 1000000,
        monthlyRequests: 250000
      },
      isPersistentTestKey: true // Special flag to identify this key
    };

    const testUsageData = {
      requestCount: 0,
      tokenCount: 0,
      lastReset: '2025-08-22T00:00:00.000Z',
      dailyUsage: {},
      monthlyUsage: {}
    };

    return {
      keyData: testKeyData,
      usageData: testUsageData,
      fullKey: this.TEST_KEY_FULL
    };
  }

  /**
   * Install the persistent test key into the API keys system
   */
  async installPersistentTestKey() {
    try {
      console.log('🔑 Installing persistent test API key...');
      
      // Generate the test key configuration
      const testConfig = await this.generatePersistentTestKey();
      
      // Load existing API keys data
      let apiKeysData = {
        keys: {},
        usage: {},
        lastUpdated: new Date().toISOString()
      };

      try {
        const existingData = await fs.readFile(this.keysFile, 'utf8');
        apiKeysData = JSON.parse(existingData);
      } catch (error) {
        console.log('  📝 Creating new API keys file...');
        // Ensure data directory exists
        const dataDir = path.dirname(this.keysFile);
        await fs.mkdir(dataDir, { recursive: true });
      }

      // Add or update the persistent test key
      apiKeysData.keys[this.FIXED_TEST_KEY_ID] = testConfig.keyData;
      apiKeysData.usage[this.FIXED_TEST_KEY_ID] = testConfig.usageData;
      apiKeysData.lastUpdated = new Date().toISOString();

      // Save the updated API keys
      await fs.writeFile(this.keysFile, JSON.stringify(apiKeysData, null, 2));

      // Save test key configuration for reference
      const testKeyConfig = {
        message: 'This is the persistent test API key that never changes',
        keyId: this.FIXED_TEST_KEY_ID,
        fullKey: testConfig.fullKey,
        tier: testConfig.keyData.tier,
        installedAt: new Date().toISOString(),
        instructions: [
          'This key is designed for testing and will survive server restarts',
          'Use this key in your test scripts and functional tests',
          'The key will be automatically reinstalled if missing from api-keys.json',
          'Key format: llm_test_persistent_key_fixed_2025.persistent_test_secret_never_changes_mikecerqua_2025_llm_router'
        ]
      };

      await fs.writeFile(this.configFile, JSON.stringify(testKeyConfig, null, 2));

      console.log('  ✅ Persistent test key installed successfully');
      console.log(`  🔑 Key ID: ${this.FIXED_TEST_KEY_ID}`);
      console.log(`  🎯 Full Key: ${testConfig.fullKey}`);
      console.log(`  📊 Tier: ${testConfig.keyData.tier}`);
      console.log(`  💾 Config saved to: ${this.configFile}`);

      return testConfig.fullKey;

    } catch (error) {
      console.error('❌ Failed to install persistent test key:', error);
      throw error;
    }
  }

  /**
   * Check if the persistent test key exists and is valid
   */
  async checkPersistentTestKey() {
    try {
      // Load existing API keys
      const apiKeysData = JSON.parse(await fs.readFile(this.keysFile, 'utf8'));
      
      // Check if our persistent test key exists
      const testKey = apiKeysData.keys[this.FIXED_TEST_KEY_ID];
      
      if (!testKey) {
        return { exists: false, reason: 'Key not found in database' };
      }

      if (!testKey.active) {
        return { exists: false, reason: 'Key exists but is deactivated' };
      }

      if (!testKey.isPersistentTestKey) {
        return { exists: false, reason: 'Key exists but missing persistent flag' };
      }

      // Verify the hash matches our fixed secret
      const isValid = await bcrypt.compare(this.FIXED_TEST_SECRET, testKey.hash);
      
      if (!isValid) {
        return { exists: false, reason: 'Key exists but hash does not match' };
      }

      return {
        exists: true,
        keyData: testKey,
        fullKey: this.TEST_KEY_FULL
      };

    } catch (error) {
      return { exists: false, reason: `Error checking key: ${error.message}` };
    }
  }

  /**
   * Ensure the persistent test key is always available
   */
  async ensurePersistentTestKey() {
    console.log('🔍 Checking persistent test key...');
    
    const check = await this.checkPersistentTestKey();
    
    if (check.exists) {
      console.log('  ✅ Persistent test key is already installed and valid');
      console.log(`  🔑 Full Key: ${check.fullKey}`);
      return check.fullKey;
    } else {
      console.log(`  ⚠️  Persistent test key not valid: ${check.reason}`);
      console.log('  🔄 Installing persistent test key...');
      return await this.installPersistentTestKey();
    }
  }

  /**
   * Get the persistent test key (install if missing)
   */
  async getPersistentTestKey() {
    return await this.ensurePersistentTestKey();
  }

  /**
   * Get just the key string for easy copying
   */
  getTestKeyString() {
    return this.TEST_KEY_FULL;
  }
}

export default PersistentTestKey;