/**
 * Cache Manager
 * Multi-tier caching system for models and inference results
 * Implements L1 (memory), L2 (disk), and L3 (distributed) caching
 */

import { Logger } from '../utils/Logger.js';
import { LRUCache } from 'lru-cache';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';

class CacheManager {
  constructor(config = {}) {
    this.logger = new Logger('CacheManager');
    this.config = {
      // L1 Cache (Memory)
      l1Size: config.l1Size || 100, // Number of items
      l1MaxSize: config.l1MaxSize || 500 * 1024 * 1024, // 500MB
      l1TTL: config.l1TTL || 1000 * 60 * 5, // 5 minutes
      
      // L2 Cache (Disk)
      l2Enabled: config.l2Enabled !== false,
      l2Path: config.l2Path || './cache/l2',
      l2MaxSize: config.l2MaxSize || 5 * 1024 * 1024 * 1024, // 5GB
      l2TTL: config.l2TTL || 1000 * 60 * 60, // 1 hour
      
      // L3 Cache (Distributed - Redis/etc)
      l3Enabled: config.l3Enabled || false,
      l3Config: config.l3Config || {},
      
      // General settings
      compressionEnabled: config.compressionEnabled !== false,
      encryptionEnabled: config.encryptionEnabled || false,
      encryptionKey: config.encryptionKey || null,
      
      // Cache warming
      warmupEnabled: config.warmupEnabled || false,
      warmupPatterns: config.warmupPatterns || []
    };
    
    // Initialize caches
    this.l1Cache = null;
    this.l3Client = null;
    
    // Statistics
    this.stats = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      l3Hits: 0,
      l3Misses: 0,
      totalHits: 0,
      totalMisses: 0,
      bytesServed: 0,
      bytesSaved: 0
    };
    
    // Cache metadata
    this.metadata = new Map();
  }

  /**
   * Initialize cache manager
   */
  async initialize() {
    this.logger.info('Initializing Cache Manager');
    
    // Initialize L1 cache (memory)
    this.initializeL1Cache();
    
    // Initialize L2 cache (disk)
    if (this.config.l2Enabled) {
      await this.initializeL2Cache();
    }
    
    // Initialize L3 cache (distributed)
    if (this.config.l3Enabled) {
      await this.initializeL3Cache();
    }
    
    // Warm up cache if enabled
    if (this.config.warmupEnabled) {
      await this.warmupCache();
    }
    
    return true;
  }

  /**
   * Initialize L1 (memory) cache
   */
  initializeL1Cache() {
    this.l1Cache = new LRUCache({
      max: this.config.l1Size,
      maxSize: this.config.l1MaxSize,
      ttl: this.config.l1TTL,
      sizeCalculation: (value) => {
        if (typeof value === 'string') return value.length;
        if (Buffer.isBuffer(value)) return value.length;
        if (value instanceof ArrayBuffer) return value.byteLength;
        return JSON.stringify(value).length;
      },
      dispose: (value, key) => {
        this.logger.debug(`L1 cache evicting: ${key}`);
      }
    });
    
    this.logger.info(`L1 cache initialized with ${this.config.l1Size} items max`);
  }

  /**
   * Initialize L2 (disk) cache
   */
  async initializeL2Cache() {
    try {
      await fs.mkdir(this.config.l2Path, { recursive: true });
      
      // Clean up old cache files
      await this.cleanupL2Cache();
      
      this.logger.info(`L2 cache initialized at ${this.config.l2Path}`);
    } catch (error) {
      this.logger.error(`Failed to initialize L2 cache: ${error.message}`);
      this.config.l2Enabled = false;
    }
  }

  /**
   * Initialize L3 (distributed) cache
   */
  async initializeL3Cache() {
    try {
      // This would connect to Redis, Memcached, etc.
      // For now, it's a placeholder
      this.logger.info('L3 cache initialization placeholder');
      this.config.l3Enabled = false; // Disable for now
    } catch (error) {
      this.logger.error(`Failed to initialize L3 cache: ${error.message}`);
      this.config.l3Enabled = false;
    }
  }

  /**
   * Generate cache key
   */
  generateKey(identifier, params = {}) {
    const keyData = {
      id: identifier,
      ...params
    };
    
    const keyString = JSON.stringify(keyData, Object.keys(keyData).sort());
    return crypto.createHash('sha256').update(keyString).digest('hex');
  }

  /**
   * Get from cache (checks all tiers)
   */
  async get(key, options = {}) {
    const startTime = performance.now();
    
    // Check L1 cache
    let value = this.l1Cache.get(key);
    if (value !== undefined) {
      this.stats.l1Hits++;
      this.stats.totalHits++;
      this.updateAccessMetadata(key, 'l1');
      this.logger.debug(`L1 cache hit for ${key}`);
      return this.deserializeValue(value);
    }
    this.stats.l1Misses++;
    
    // Check L2 cache
    if (this.config.l2Enabled) {
      value = await this.getFromL2(key);
      if (value !== undefined) {
        this.stats.l2Hits++;
        this.stats.totalHits++;
        
        // Promote to L1
        if (options.promoteToL1 !== false) {
          this.l1Cache.set(key, value);
        }
        
        this.updateAccessMetadata(key, 'l2');
        this.logger.debug(`L2 cache hit for ${key}`);
        return this.deserializeValue(value);
      }
      this.stats.l2Misses++;
    }
    
    // Check L3 cache
    if (this.config.l3Enabled) {
      value = await this.getFromL3(key);
      if (value !== undefined) {
        this.stats.l3Hits++;
        this.stats.totalHits++;
        
        // Promote to L1 and L2
        if (options.promoteToL1 !== false) {
          this.l1Cache.set(key, value);
        }
        if (options.promoteToL2 !== false && this.config.l2Enabled) {
          await this.setInL2(key, value);
        }
        
        this.updateAccessMetadata(key, 'l3');
        this.logger.debug(`L3 cache hit for ${key}`);
        return this.deserializeValue(value);
      }
      this.stats.l3Misses++;
    }
    
    this.stats.totalMisses++;
    const duration = performance.now() - startTime;
    this.logger.debug(`Cache miss for ${key} (${duration.toFixed(2)}ms)`);
    
    return undefined;
  }

  /**
   * Set in cache (writes to appropriate tiers)
   */
  async set(key, value, options = {}) {
    const serialized = this.serializeValue(value);
    const size = this.calculateSize(serialized);
    
    // Update statistics
    this.stats.bytesSaved += size;
    
    // Determine which tiers to write to
    const tiers = options.tiers || ['l1', 'l2'];
    
    // Write to L1
    if (tiers.includes('l1')) {
      this.l1Cache.set(key, serialized, {
        ttl: options.ttl || this.config.l1TTL
      });
    }
    
    // Write to L2
    if (tiers.includes('l2') && this.config.l2Enabled) {
      await this.setInL2(key, serialized, options);
    }
    
    // Write to L3
    if (tiers.includes('l3') && this.config.l3Enabled) {
      await this.setInL3(key, serialized, options);
    }
    
    // Update metadata
    this.metadata.set(key, {
      size,
      created: Date.now(),
      accessed: Date.now(),
      accessCount: 0,
      tiers
    });
    
    return true;
  }

  /**
   * Get from L2 (disk) cache
   */
  async getFromL2(key) {
    try {
      const filePath = this.getL2FilePath(key);
      const data = await fs.readFile(filePath);
      
      // Check if expired
      const stats = await fs.stat(filePath);
      const age = Date.now() - stats.mtimeMs;
      
      if (age > this.config.l2TTL) {
        await fs.unlink(filePath);
        return undefined;
      }
      
      // Decompress if needed
      let value = data;
      if (this.config.compressionEnabled) {
        value = await this.decompress(value);
      }
      
      // Decrypt if needed
      if (this.config.encryptionEnabled) {
        value = await this.decrypt(value);
      }
      
      this.stats.bytesServed += value.length;
      return value;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error(`L2 cache read error: ${error.message}`);
      }
      return undefined;
    }
  }

  /**
   * Set in L2 (disk) cache
   */
  async setInL2(key, value, options = {}) {
    try {
      const filePath = this.getL2FilePath(key);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      let data = value;
      
      // Encrypt if enabled
      if (this.config.encryptionEnabled) {
        data = await this.encrypt(data);
      }
      
      // Compress if enabled
      if (this.config.compressionEnabled) {
        data = await this.compress(data);
      }
      
      await fs.writeFile(filePath, data);
      
      // Set TTL via file modification time
      const ttl = options.ttl || this.config.l2TTL;
      const expireTime = new Date(Date.now() + ttl);
      await fs.utimes(filePath, expireTime, expireTime);
      
      return true;
    } catch (error) {
      this.logger.error(`L2 cache write error: ${error.message}`);
      return false;
    }
  }

  /**
   * Get from L3 (distributed) cache
   */
  async getFromL3(key) {
    // Placeholder for distributed cache implementation
    return undefined;
  }

  /**
   * Set in L3 (distributed) cache
   */
  async setInL3(key, value, options = {}) {
    // Placeholder for distributed cache implementation
    return false;
  }

  /**
   * Get L2 cache file path
   */
  getL2FilePath(key) {
    // Use first 2 chars of key for directory sharding
    const shard = key.substring(0, 2);
    return path.join(this.config.l2Path, shard, `${key}.cache`);
  }

  /**
   * Delete from cache
   */
  async delete(key) {
    // Delete from all tiers
    this.l1Cache.delete(key);
    
    if (this.config.l2Enabled) {
      try {
        const filePath = this.getL2FilePath(key);
        await fs.unlink(filePath);
      } catch (error) {
        // Ignore if file doesn't exist
      }
    }
    
    if (this.config.l3Enabled) {
      // Delete from L3
    }
    
    this.metadata.delete(key);
    
    return true;
  }

  /**
   * Clear all caches
   */
  async clear() {
    // Clear L1
    this.l1Cache.clear();
    
    // Clear L2
    if (this.config.l2Enabled) {
      await this.clearL2Cache();
    }
    
    // Clear L3
    if (this.config.l3Enabled) {
      // Clear distributed cache
    }
    
    // Clear metadata
    this.metadata.clear();
    
    // Reset statistics
    this.resetStatistics();
    
    this.logger.info('All caches cleared');
  }

  /**
   * Clear L2 cache
   */
  async clearL2Cache() {
    try {
      const files = await fs.readdir(this.config.l2Path, { recursive: true });
      for (const file of files) {
        if (file.endsWith('.cache')) {
          await fs.unlink(path.join(this.config.l2Path, file));
        }
      }
    } catch (error) {
      this.logger.error(`Failed to clear L2 cache: ${error.message}`);
    }
  }

  /**
   * Clean up expired L2 cache entries
   */
  async cleanupL2Cache() {
    try {
      const now = Date.now();
      const files = await fs.readdir(this.config.l2Path, { recursive: true });
      
      for (const file of files) {
        if (file.endsWith('.cache')) {
          const filePath = path.join(this.config.l2Path, file);
          const stats = await fs.stat(filePath);
          const age = now - stats.mtimeMs;
          
          if (age > this.config.l2TTL) {
            await fs.unlink(filePath);
            this.logger.debug(`Cleaned up expired L2 cache file: ${file}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`L2 cache cleanup error: ${error.message}`);
    }
  }

  /**
   * Warm up cache with predefined patterns
   */
  async warmupCache() {
    this.logger.info('Warming up cache');
    
    for (const pattern of this.config.warmupPatterns) {
      try {
        // Load pattern data
        const data = await this.loadWarmupData(pattern);
        if (data) {
          const key = this.generateKey(pattern.id, pattern.params);
          await this.set(key, data, { tiers: ['l1', 'l2'] });
        }
      } catch (error) {
        this.logger.error(`Failed to warm up cache for ${pattern.id}: ${error.message}`);
      }
    }
  }

  /**
   * Load warmup data
   */
  async loadWarmupData(pattern) {
    // This would load actual data based on pattern
    // For now, it's a placeholder
    return null;
  }

  /**
   * Compress data
   */
  async compress(data) {
    // In real implementation, would use zlib or similar
    return data;
  }

  /**
   * Decompress data
   */
  async decompress(data) {
    // In real implementation, would use zlib or similar
    return data;
  }

  /**
   * Encrypt data
   */
  async encrypt(data) {
    if (!this.config.encryptionKey) return data;
    
    // In real implementation, would use crypto module
    return data;
  }

  /**
   * Decrypt data
   */
  async decrypt(data) {
    if (!this.config.encryptionKey) return data;
    
    // In real implementation, would use crypto module
    return data;
  }

  /**
   * Serialize value for caching
   */
  serializeValue(value) {
    if (Buffer.isBuffer(value)) return value;
    if (typeof value === 'string') return Buffer.from(value);
    return Buffer.from(JSON.stringify(value));
  }

  /**
   * Deserialize cached value
   */
  deserializeValue(value) {
    if (!Buffer.isBuffer(value)) return value;
    
    try {
      // Try to parse as JSON
      const str = value.toString();
      return JSON.parse(str);
    } catch {
      // Return as string if not JSON
      return value.toString();
    }
  }

  /**
   * Calculate size of value
   */
  calculateSize(value) {
    if (Buffer.isBuffer(value)) return value.length;
    if (typeof value === 'string') return value.length;
    return JSON.stringify(value).length;
  }

  /**
   * Update access metadata
   */
  updateAccessMetadata(key, tier) {
    const meta = this.metadata.get(key);
    if (meta) {
      meta.accessed = Date.now();
      meta.accessCount++;
      meta.lastTier = tier;
    }
  }

  /**
   * Get cache statistics
   */
  getStatistics() {
    const l1Stats = this.l1Cache ? {
      size: this.l1Cache.size,
      calculatedSize: this.l1Cache.calculatedSize,
      hitRate: this.stats.l1Hits / (this.stats.l1Hits + this.stats.l1Misses) || 0
    } : null;
    
    return {
      ...this.stats,
      l1: l1Stats,
      overallHitRate: this.stats.totalHits / (this.stats.totalHits + this.stats.totalMisses) || 0,
      bytesServedMB: (this.stats.bytesServed / 1024 / 1024).toFixed(2),
      bytesSavedMB: (this.stats.bytesSaved / 1024 / 1024).toFixed(2)
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.stats = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      l3Hits: 0,
      l3Misses: 0,
      totalHits: 0,
      totalMisses: 0,
      bytesServed: 0,
      bytesSaved: 0
    };
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    this.logger.info('Cleaning up Cache Manager');
    
    // Clear all caches
    await this.clear();
    
    // Close connections
    if (this.l3Client) {
      // Close distributed cache connection
    }
  }
}
export default CacheManager;
export { CacheManager };
