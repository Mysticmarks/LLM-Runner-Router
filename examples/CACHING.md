# Caching Strategies Examples

This guide demonstrates advanced caching strategies for the LLM-Runner-Router system. Learn how to implement intelligent caching for optimal performance, cost reduction, and response time improvement.

## Table of Contents
- [Basic Caching](#basic-caching)
- [Advanced Cache Strategies](#advanced-cache-strategies)
- [Distributed Caching](#distributed-caching)
- [Semantic Caching](#semantic-caching)
- [Cache Optimization](#cache-optimization)
- [Performance Monitoring](#performance-monitoring)

## Basic Caching

### Simple Response Caching

```javascript
import LLMRouter from 'llm-runner-router';
import crypto from 'crypto';

class BasicCacheSystem {
  constructor() {
    this.router = new LLMRouter({
      strategy: 'balanced',
      logLevel: 'info'
    });
    
    this.cache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0
    };
    
    this.maxCacheSize = 1000;
    this.defaultTTL = 3600000; // 1 hour
  }
  
  async initialize() {
    await this.router.initialize();
    await this.router.load('models/cached-model.gguf');
    console.log('💾 Basic cache system initialized');
  }
  
  generateCacheKey(prompt, options = {}) {
    // Create a hash-based cache key
    const keyData = {
      prompt: prompt.trim(),
      maxTokens: options.maxTokens || 150,
      temperature: options.temperature || 0.7,
      topP: options.topP || 0.9,
      topK: options.topK || 40
    };
    
    const keyString = JSON.stringify(keyData);
    return crypto.createHash('md5').update(keyString).digest('hex');
  }
  
  setCacheEntry(key, value, ttl = this.defaultTTL) {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLRU();
    }
    
    const entry = {
      value,
      timestamp: Date.now(),
      ttl,
      expiresAt: Date.now() + ttl,
      accessCount: 0,
      lastAccessed: Date.now()
    };
    
    this.cache.set(key, entry);
  }
  
  getCacheEntry(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    return entry.value;
  }
  
  evictLRU() {
    // Find least recently used entry
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.cacheStats.evictions++;
    }
  }
  
  async cachedQuery(prompt, options = {}) {
    this.cacheStats.totalRequests++;
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(prompt, options);
    
    // Try to get from cache
    const cached = this.getCacheEntry(cacheKey);
    
    if (cached) {
      this.cacheStats.hits++;
      console.log(`💾 Cache HIT for prompt: "${prompt.substring(0, 50)}..."`);
      
      return {
        ...cached,
        fromCache: true,
        cacheKey
      };
    }
    
    // Cache miss - query the model
    this.cacheStats.misses++;
    console.log(`🔍 Cache MISS for prompt: "${prompt.substring(0, 50)}..."`);
    
    const startTime = Date.now();
    const result = await this.router.quick(prompt, options);
    const queryTime = Date.now() - startTime;
    
    // Cache the result
    const cacheableResult = {
      ...result,
      queryTime,
      cachedAt: new Date()
    };
    
    this.setCacheEntry(cacheKey, cacheableResult);
    
    return {
      ...cacheableResult,
      fromCache: false,
      cacheKey
    };
  }
  
  getCacheStats() {
    const hitRate = this.cacheStats.totalRequests > 0 
      ? (this.cacheStats.hits / this.cacheStats.totalRequests) * 100 
      : 0;
    
    return {
      ...this.cacheStats,
      hitRate: hitRate.toFixed(2) + '%',
      cacheSize: this.cache.size,
      maxSize: this.maxCacheSize
    };
  }
  
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Cache cleared');
  }
  
  cleanupExpired() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    console.log(`🧹 Cleaned ${cleaned} expired entries`);
    return cleaned;
  }
}

// Usage example
async function demonstrateBasicCaching() {
  const cacheSystem = new BasicCacheSystem();
  await cacheSystem.initialize();
  
  const testPrompts = [
    "What is artificial intelligence?",
    "Explain machine learning",
    "What is artificial intelligence?", // Duplicate - should hit cache
    "How do neural networks work?",
    "Explain machine learning", // Duplicate - should hit cache
    "What is deep learning?",
    "What is artificial intelligence?" // Another duplicate
  ];
  
  console.log('💾 Testing Basic Caching System:\n');
  
  for (const [index, prompt] of testPrompts.entries()) {
    console.log(`--- Request ${index + 1} ---`);
    
    const startTime = Date.now();
    const result = await cacheSystem.cachedQuery(prompt, {
      maxTokens: 100,
      temperature: 0.7
    });
    const totalTime = Date.now() - startTime;
    
    console.log(`Prompt: "${prompt}"`);
    console.log(`From Cache: ${result.fromCache ? 'YES' : 'NO'}`);
    console.log(`Total Time: ${totalTime}ms`);
    if (result.fromCache) {
      console.log(`Original Query Time: ${result.queryTime}ms`);
      console.log(`Time Saved: ${result.queryTime - totalTime}ms`);
    }
    console.log(`Response: ${result.text.substring(0, 100)}...`);
    console.log('');
  }
  
  // Show cache statistics
  console.log('📊 Cache Statistics:');
  console.log(cacheSystem.getCacheStats());
  
  // Cleanup expired entries
  cacheSystem.cleanupExpired();
}

demonstrateBasicCaching().catch(console.error);
```

## Advanced Cache Strategies

### Multi-Level Caching System

```javascript
class MultiLevelCacheSystem {
  constructor() {
    this.router = new LLMRouter({
      strategy: 'balanced',
      logLevel: 'info'
    });
    
    // L1 Cache: In-memory, fastest
    this.l1Cache = new Map();
    this.l1MaxSize = 100;
    this.l1TTL = 300000; // 5 minutes
    
    // L2 Cache: Larger, longer TTL
    this.l2Cache = new Map();
    this.l2MaxSize = 1000;
    this.l2TTL = 3600000; // 1 hour
    
    // L3 Cache: Persistent storage simulation
    this.l3Cache = new Map();
    this.l3MaxSize = 10000;
    this.l3TTL = 86400000; // 24 hours
    
    this.cacheStats = {
      l1: { hits: 0, misses: 0 },
      l2: { hits: 0, misses: 0 },
      l3: { hits: 0, misses: 0 },
      totalRequests: 0
    };
    
    this.setupCachePromotions();
  }
  
  async initialize() {
    await this.router.initialize();
    await this.router.load('models/multilevel-cached-model.gguf');
    console.log('🏗️ Multi-level cache system initialized');
  }
  
  setupCachePromotions() {
    // Automatically promote frequently accessed items to higher cache levels
    setInterval(() => {
      this.promoteHotEntries();
    }, 60000); // Check every minute
  }
  
  generateCacheKey(prompt, options = {}) {
    const keyData = {
      prompt: prompt.trim().toLowerCase(),
      maxTokens: options.maxTokens || 150,
      temperature: Math.round((options.temperature || 0.7) * 100) / 100,
      model: options.model || 'default'
    };
    
    return crypto.createHash('sha256').update(JSON.stringify(keyData)).digest('hex');
  }
  
  async cachedQuery(prompt, options = {}) {
    this.cacheStats.totalRequests++;
    const cacheKey = this.generateCacheKey(prompt, options);
    
    console.log(`🔍 Multi-level cache lookup for: "${prompt.substring(0, 40)}..."`);
    
    // L1 Cache check (fastest)
    const l1Result = this.getFromCache(this.l1Cache, cacheKey, 'L1');
    if (l1Result) {
      this.cacheStats.l1.hits++;
      return { ...l1Result, cacheLevel: 'L1', fromCache: true };
    }
    this.cacheStats.l1.misses++;
    
    // L2 Cache check
    const l2Result = this.getFromCache(this.l2Cache, cacheKey, 'L2');
    if (l2Result) {
      this.cacheStats.l2.hits++;
      // Promote to L1
      this.setInCache(this.l1Cache, cacheKey, l2Result, this.l1TTL, this.l1MaxSize);
      console.log(`⬆️ Promoted from L2 to L1`);
      return { ...l2Result, cacheLevel: 'L2', fromCache: true };
    }
    this.cacheStats.l2.misses++;
    
    // L3 Cache check
    const l3Result = this.getFromCache(this.l3Cache, cacheKey, 'L3');
    if (l3Result) {
      this.cacheStats.l3.hits++;
      // Promote to L2 and L1
      this.setInCache(this.l2Cache, cacheKey, l3Result, this.l2TTL, this.l2MaxSize);
      this.setInCache(this.l1Cache, cacheKey, l3Result, this.l1TTL, this.l1MaxSize);
      console.log(`⬆️ Promoted from L3 to L2 and L1`);
      return { ...l3Result, cacheLevel: 'L3', fromCache: true };
    }
    this.cacheStats.l3.misses++;
    
    // Cache miss - query the model
    console.log(`❌ Complete cache miss - querying model`);
    const startTime = Date.now();
    const result = await this.router.quick(prompt, options);
    const queryTime = Date.now() - startTime;
    
    const cacheableResult = {
      ...result,
      queryTime,
      cachedAt: new Date(),
      accessCount: 1,
      lastAccessed: Date.now()
    };
    
    // Store in all cache levels
    this.setInCache(this.l3Cache, cacheKey, cacheableResult, this.l3TTL, this.l3MaxSize);
    this.setInCache(this.l2Cache, cacheKey, cacheableResult, this.l2TTL, this.l2MaxSize);
    this.setInCache(this.l1Cache, cacheKey, cacheableResult, this.l1TTL, this.l1MaxSize);
    
    return { ...cacheableResult, cacheLevel: 'MISS', fromCache: false };
  }
  
  getFromCache(cache, key, level) {
    const entry = cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return null;
    }
    
    // Update access statistics
    entry.accessCount = (entry.accessCount || 0) + 1;
    entry.lastAccessed = Date.now();
    
    console.log(`✅ ${level} cache HIT`);
    return entry.value;
  }
  
  setInCache(cache, key, value, ttl, maxSize) {
    // Evict if necessary
    if (cache.size >= maxSize) {
      this.evictLRU(cache);
    }
    
    const entry = {
      value,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
      accessCount: value.accessCount || 1,
      lastAccessed: Date.now()
    };
    
    cache.set(key, entry);
  }
  
  evictLRU(cache) {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
  
  promoteHotEntries() {
    // Promote frequently accessed L2 entries to L1
    for (const [key, entry] of this.l2Cache) {
      if (entry.accessCount >= 3 && !this.l1Cache.has(key)) {
        this.setInCache(this.l1Cache, key, entry.value, this.l1TTL, this.l1MaxSize);
        console.log(`🔥 Auto-promoted hot entry to L1`);
      }
    }
    
    // Promote frequently accessed L3 entries to L2
    for (const [key, entry] of this.l3Cache) {
      if (entry.accessCount >= 5 && !this.l2Cache.has(key)) {
        this.setInCache(this.l2Cache, key, entry.value, this.l2TTL, this.l2MaxSize);
        console.log(`🔥 Auto-promoted hot entry to L2`);
      }
    }
  }
  
  getCacheStatistics() {
    const totalHits = this.cacheStats.l1.hits + this.cacheStats.l2.hits + this.cacheStats.l3.hits;
    const totalMisses = this.cacheStats.l1.misses + this.cacheStats.l2.misses + this.cacheStats.l3.misses;
    const overallHitRate = this.cacheStats.totalRequests > 0 
      ? (totalHits / this.cacheStats.totalRequests) * 100 
      : 0;
    
    return {
      overall: {
        totalRequests: this.cacheStats.totalRequests,
        totalHits,
        totalMisses,
        hitRate: overallHitRate.toFixed(2) + '%'
      },
      l1: {
        ...this.cacheStats.l1,
        size: this.l1Cache.size,
        maxSize: this.l1MaxSize,
        hitRate: this.cacheStats.l1.hits > 0 
          ? ((this.cacheStats.l1.hits / (this.cacheStats.l1.hits + this.cacheStats.l1.misses)) * 100).toFixed(2) + '%'
          : '0%'
      },
      l2: {
        ...this.cacheStats.l2,
        size: this.l2Cache.size,
        maxSize: this.l2MaxSize,
        hitRate: this.cacheStats.l2.hits > 0 
          ? ((this.cacheStats.l2.hits / (this.cacheStats.l2.hits + this.cacheStats.l2.misses)) * 100).toFixed(2) + '%'
          : '0%'
      },
      l3: {
        ...this.cacheStats.l3,
        size: this.l3Cache.size,
        maxSize: this.l3MaxSize,
        hitRate: this.cacheStats.l3.hits > 0 
          ? ((this.cacheStats.l3.hits / (this.cacheStats.l3.hits + this.cacheStats.l3.misses)) * 100).toFixed(2) + '%'
          : '0%'
      }
    };
  }
  
  warmCache(prompts) {
    console.log(`🔥 Warming cache with ${prompts.length} prompts...`);
    return Promise.all(
      prompts.map(prompt => this.cachedQuery(prompt))
    );
  }
  
  async analyzeCacheEfficiency() {
    const stats = this.getCacheStatistics();
    const analysis = {
      efficiency: 'good',
      recommendations: [],
      hotspots: []
    };
    
    // Analyze hit rates
    if (stats.overall.hitRate < 30) {
      analysis.efficiency = 'poor';
      analysis.recommendations.push('Consider increasing cache sizes or TTL values');
    } else if (stats.overall.hitRate < 60) {
      analysis.efficiency = 'fair';
      analysis.recommendations.push('Optimize cache promotion strategies');
    }
    
    // Analyze cache distribution
    const l1Utilization = (stats.l1.size / stats.l1.maxSize) * 100;
    const l2Utilization = (stats.l2.size / stats.l2.maxSize) * 100;
    
    if (l1Utilization > 90) {
      analysis.recommendations.push('Consider increasing L1 cache size');
    }
    
    if (l2Utilization > 90) {
      analysis.recommendations.push('Consider increasing L2 cache size');
    }
    
    return { stats, analysis };
  }
}

// Usage example
async function demonstrateMultiLevelCaching() {
  const multiCache = new MultiLevelCacheSystem();
  await multiCache.initialize();
  
  // Warm cache with common prompts
  const commonPrompts = [
    "What is AI?",
    "Explain machine learning",
    "How do computers work?"
  ];
  
  console.log('🔥 Warming cache...');
  await multiCache.warmCache(commonPrompts);
  
  // Test cache behavior with repeated and new prompts
  const testPrompts = [
    "What is AI?", // Should hit L1
    "Explain machine learning", // Should hit L1
    "What is deep learning?", // Cache miss
    "How do computers work?", // Should hit L1
    "What is AI?", // Should hit L1 again
    "Explain neural networks", // Cache miss
    "Explain machine learning", // Should hit L1
  ];
  
  console.log('\n🏗️ Testing Multi-Level Cache:\n');
  
  for (const [index, prompt] of testPrompts.entries()) {
    console.log(`--- Request ${index + 1} ---`);
    
    const startTime = Date.now();
    const result = await multiCache.cachedQuery(prompt, {
      maxTokens: 80,
      temperature: 0.7
    });
    const totalTime = Date.now() - startTime;
    
    console.log(`Prompt: "${prompt}"`);
    console.log(`Cache Level: ${result.cacheLevel}`);
    console.log(`Total Time: ${totalTime}ms`);
    console.log('');
  }
  
  // Analyze cache efficiency
  console.log('📊 Cache Efficiency Analysis:');
  const efficiency = await multiCache.analyzeCacheEfficiency();
  console.log(JSON.stringify(efficiency, null, 2));
}

demonstrateMultiLevelCaching().catch(console.error);
```

## Distributed Caching

### Redis-Based Distributed Cache

```javascript
import Redis from 'ioredis';

class DistributedCacheSystem {
  constructor(redisConfig = {}) {
    this.router = new LLMRouter({
      strategy: 'balanced',
      logLevel: 'info'
    });
    
    // Redis configuration
    this.redis = new Redis({
      host: redisConfig.host || 'localhost',
      port: redisConfig.port || 6379,
      password: redisConfig.password,
      db: redisConfig.db || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });
    
    this.localCache = new Map(); // L1 local cache
    this.localCacheSize = 50;
    this.localCacheTTL = 300000; // 5 minutes
    
    this.defaultTTL = 3600; // 1 hour for Redis (in seconds)
    this.keyPrefix = 'llm-cache:';
    
    this.stats = {
      localHits: 0,
      redisHits: 0,
      misses: 0,
      errors: 0,
      totalRequests: 0
    };
    
    this.setupRedisListeners();
  }
  
  async initialize() {
    await this.router.initialize();
    await this.router.load('models/distributed-cached-model.gguf');
    
    // Test Redis connection
    try {
      await this.redis.ping();
      console.log('🌐 Connected to Redis');
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      throw error;
    }
    
    console.log('🌐 Distributed cache system initialized');
  }
  
  setupRedisListeners() {
    this.redis.on('error', (error) => {
      console.error('Redis error:', error);
      this.stats.errors++;
    });
    
    this.redis.on('reconnecting', () => {
      console.log('🔄 Reconnecting to Redis...');
    });
  }
  
  generateCacheKey(prompt, options = {}) {
    const normalized = {
      prompt: prompt.trim().toLowerCase(),
      maxTokens: options.maxTokens || 150,
      temperature: Math.round((options.temperature || 0.7) * 100) / 100,
      model: options.model || 'default'
    };
    
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
    
    return this.keyPrefix + hash;
  }
  
  async cachedQuery(prompt, options = {}) {
    this.stats.totalRequests++;
    const cacheKey = this.generateCacheKey(prompt, options);
    
    console.log(`🔍 Distributed cache lookup for: "${prompt.substring(0, 40)}..."`);
    
    try {
      // Check local cache first (L1)
      const localResult = this.getFromLocalCache(cacheKey);
      if (localResult) {
        this.stats.localHits++;
        console.log(`✅ Local cache HIT`);
        return { ...localResult, cacheLevel: 'LOCAL', fromCache: true };
      }
      
      // Check Redis cache (L2)
      const redisResult = await this.getFromRedis(cacheKey);
      if (redisResult) {
        this.stats.redisHits++;
        console.log(`✅ Redis cache HIT`);
        
        // Promote to local cache
        this.setInLocalCache(cacheKey, redisResult);
        
        return { ...redisResult, cacheLevel: 'REDIS', fromCache: true };
      }
      
      // Cache miss - query the model
      this.stats.misses++;
      console.log(`❌ Complete cache miss - querying model`);
      
      const startTime = Date.now();
      const result = await this.router.quick(prompt, options);
      const queryTime = Date.now() - startTime;
      
      const cacheableResult = {
        ...result,
        queryTime,
        cachedAt: new Date().toISOString(),
        nodeId: process.env.NODE_ID || 'unknown'
      };
      
      // Store in both caches
      await this.setInRedis(cacheKey, cacheableResult);
      this.setInLocalCache(cacheKey, cacheableResult);
      
      return { ...cacheableResult, cacheLevel: 'MISS', fromCache: false };
      
    } catch (error) {
      console.error('Cache operation error:', error);
      this.stats.errors++;
      
      // Fallback to direct model query
      const result = await this.router.quick(prompt, options);
      return { ...result, cacheLevel: 'ERROR', fromCache: false };
    }
  }
  
  getFromLocalCache(key) {
    const entry = this.localCache.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.localCache.delete(key);
      return null;
    }
    
    entry.lastAccessed = Date.now();
    return entry.value;
  }
  
  setInLocalCache(key, value) {
    // Evict if necessary
    if (this.localCache.size >= this.localCacheSize) {
      this.evictLocalLRU();
    }
    
    const entry = {
      value,
      expiresAt: Date.now() + this.localCacheTTL,
      lastAccessed: Date.now()
    };
    
    this.localCache.set(key, entry);
  }
  
  evictLocalLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.localCache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.localCache.delete(oldestKey);
    }
  }
  
  async getFromRedis(key) {
    try {
      const data = await this.redis.get(key);
      if (!data) {
        return null;
      }
      
      const parsed = JSON.parse(data);
      
      // Update access time
      await this.redis.expire(key, this.defaultTTL);
      
      return parsed;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }
  
  async setInRedis(key, value, ttl = this.defaultTTL) {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }
  
  async invalidateCache(pattern) {
    try {
      // Clear local cache
      if (pattern === '*') {
        this.localCache.clear();
        console.log('🗑️ Local cache cleared');
      }
      
      // Clear Redis cache
      const keys = await this.redis.keys(this.keyPrefix + pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`🗑️ Invalidated ${keys.length} Redis cache entries`);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }
  
  async preloadCache(prompts, options = {}) {
    console.log(`🔥 Preloading cache with ${prompts.length} prompts...`);
    
    const results = await Promise.allSettled(
      prompts.map(prompt => this.cachedQuery(prompt, options))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    console.log(`✅ Preloaded ${successful}/${prompts.length} prompts`);
    
    return successful;
  }
  
  async getDistributedStats() {
    try {
      const redisInfo = await this.redis.info('memory');
      const redisMemory = redisInfo.match(/used_memory_human:([^\\r\\n]+)/)?.[1] || 'unknown';
      
      const keyCount = await this.redis.dbsize();
      
      return {
        local: {
          ...this.stats,
          cacheSize: this.localCache.size,
          maxSize: this.localCacheSize
        },
        redis: {
          keyCount,
          memoryUsed: redisMemory,
          connected: this.redis.status === 'ready'
        },
        performance: {
          localHitRate: this.stats.totalRequests > 0 
            ? ((this.stats.localHits / this.stats.totalRequests) * 100).toFixed(2) + '%'
            : '0%',
          redisHitRate: this.stats.totalRequests > 0 
            ? ((this.stats.redisHits / this.stats.totalRequests) * 100).toFixed(2) + '%'
            : '0%',
          overallHitRate: this.stats.totalRequests > 0 
            ? (((this.stats.localHits + this.stats.redisHits) / this.stats.totalRequests) * 100).toFixed(2) + '%'
            : '0%'
        }
      };
    } catch (error) {
      console.error('Error getting distributed stats:', error);
      return { error: error.message };
    }
  }
  
  async analyzeCachePatterns() {
    try {
      // Get sample of cache keys for analysis
      const keys = await this.redis.keys(this.keyPrefix + '*');
      const sampleSize = Math.min(100, keys.length);
      const sampleKeys = keys.slice(0, sampleSize);
      
      const analysis = {
        totalKeys: keys.length,
        sampleSize,
        patterns: {},
        ttlDistribution: {}
      };
      
      // Analyze TTL distribution
      for (const key of sampleKeys) {
        const ttl = await this.redis.ttl(key);
        const bucket = Math.floor(ttl / 300) * 300; // 5-minute buckets
        analysis.ttlDistribution[bucket] = (analysis.ttlDistribution[bucket] || 0) + 1;
      }
      
      return analysis;
    } catch (error) {
      console.error('Error analyzing cache patterns:', error);
      return { error: error.message };
    }
  }
  
  async cleanup() {
    console.log('🧹 Cleaning up distributed cache...');
    this.localCache.clear();
    await this.redis.quit();
  }
}

// Usage example (requires Redis server)
async function demonstrateDistributedCaching() {
  // Note: This example requires a running Redis server
  console.log('🌐 Distributed Caching Demo');
  console.log('Note: This requires a running Redis server on localhost:6379');
  
  try {
    const distributedCache = new DistributedCacheSystem({
      host: 'localhost',
      port: 6379
    });
    
    await distributedCache.initialize();
    
    // Simulate multiple nodes accessing the same cache
    const testPrompts = [
      "What is distributed computing?",
      "Explain microservices architecture",
      "What is load balancing?",
      "What is distributed computing?", // Should hit cache
      "How does Redis work?",
      "Explain microservices architecture", // Should hit cache
    ];
    
    console.log('\n🌐 Testing Distributed Cache:\n');
    
    for (const [index, prompt] of testPrompts.entries()) {
      console.log(`--- Request ${index + 1} ---`);
      
      const startTime = Date.now();
      const result = await distributedCache.cachedQuery(prompt, {
        maxTokens: 100,
        temperature: 0.7
      });
      const totalTime = Date.now() - startTime;
      
      console.log(`Prompt: "${prompt}"`);
      console.log(`Cache Level: ${result.cacheLevel}`);
      console.log(`Total Time: ${totalTime}ms`);
      console.log(`Node ID: ${result.nodeId || 'N/A'}`);
      console.log('');
    }
    
    // Show distributed statistics
    console.log('📊 Distributed Cache Statistics:');
    const stats = await distributedCache.getDistributedStats();
    console.log(JSON.stringify(stats, null, 2));
    
    // Analyze cache patterns
    console.log('\n🔍 Cache Pattern Analysis:');
    const patterns = await distributedCache.analyzeCachePatterns();
    console.log(JSON.stringify(patterns, null, 2));
    
    // Cleanup
    await distributedCache.cleanup();
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Redis server not available. Please start Redis server to run this demo.');
    } else {
      console.error('❌ Distributed caching demo failed:', error);
    }
  }
}

// Uncomment to run (requires Redis)
// demonstrateDistributedCaching().catch(console.error);

// Alternative in-memory simulation for demo purposes
async function simulateDistributedCaching() {
  console.log('🔄 Simulating distributed caching without Redis...');
  
  // Create a mock distributed cache that simulates network delays
  class MockDistributedCache {
    constructor() {
      this.sharedCache = new Map(); // Simulates Redis
      this.localCache = new Map();
      this.stats = { localHits: 0, sharedHits: 0, misses: 0 };
    }
    
    async get(key) {
      // Check local first
      if (this.localCache.has(key)) {
        this.stats.localHits++;
        return this.localCache.get(key);
      }
      
      // Simulate network delay for shared cache
      await new Promise(resolve => setTimeout(resolve, 10));
      
      if (this.sharedCache.has(key)) {
        this.stats.sharedHits++;
        const value = this.sharedCache.get(key);
        this.localCache.set(key, value); // Promote to local
        return value;
      }
      
      this.stats.misses++;
      return null;
    }
    
    async set(key, value) {
      this.localCache.set(key, value);
      // Simulate network delay for shared cache
      await new Promise(resolve => setTimeout(resolve, 5));
      this.sharedCache.set(key, value);
    }
    
    getStats() {
      const total = this.stats.localHits + this.stats.sharedHits + this.stats.misses;
      return {
        ...this.stats,
        localHitRate: total > 0 ? ((this.stats.localHits / total) * 100).toFixed(1) + '%' : '0%',
        sharedHitRate: total > 0 ? ((this.stats.sharedHits / total) * 100).toFixed(1) + '%' : '0%',
        totalRequests: total
      };
    }
  }
  
  const mockCache = new MockDistributedCache();
  const router = new LLMRouter();
  await router.initialize();
  
  const testData = [
    "What is caching?",
    "Explain distributed systems", 
    "What is caching?", // Should hit shared cache
    "How does replication work?",
    "Explain distributed systems", // Should hit local cache
  ];
  
  for (const prompt of testData) {
    const cacheKey = crypto.createHash('md5').update(prompt).digest('hex');
    
    let result = await mockCache.get(cacheKey);
    
    if (!result) {
      // Simulate model query
      await new Promise(resolve => setTimeout(resolve, 200)); // Simulate model latency
      result = { text: `Response to: ${prompt}`, fromCache: false };
      await mockCache.set(cacheKey, result);
    } else {
      result.fromCache = true;
    }
    
    console.log(`Query: "${prompt}" - ${result.fromCache ? 'CACHED' : 'COMPUTED'}`);
  }
  
  console.log('\n📊 Mock Distributed Cache Stats:');
  console.log(mockCache.getStats());
}

simulateDistributedCaching().catch(console.error);
```

## Semantic Caching

### Intent-Based Semantic Cache

```javascript
class SemanticCacheSystem {
  constructor() {
    this.router = new LLMRouter({
      strategy: 'balanced',
      logLevel: 'info'
    });
    
    this.semanticCache = new Map();
    this.intentClassifier = new Map();
    this.similarityThreshold = 0.85;
    this.maxCacheSize = 500;
    
    this.stats = {
      exactMatches: 0,
      semanticMatches: 0,
      misses: 0,
      totalRequests: 0
    };
    
    this.setupIntentClassification();
  }
  
  async initialize() {
    await this.router.initialize();
    await this.router.load('models/semantic-cached-model.gguf');
    console.log('🧠 Semantic cache system initialized');
  }
  
  setupIntentClassification() {
    // Define intent patterns for semantic grouping
    this.intentPatterns = {
      'definition': [
        /what is (.*)/i,
        /define (.*)/i,
        /explain (.*)/i,
        /meaning of (.*)/i
      ],
      'how-to': [
        /how to (.*)/i,
        /how do (.*)/i,
        /steps to (.*)/i,
        /tutorial (.*)/i
      ],
      'comparison': [
        /difference between (.*)/i,
        /compare (.*)/i,
        /(.*) vs (.*)/i,
        /which is better (.*)/i
      ],
      'calculation': [
        /calculate (.*)/i,
        /compute (.*)/i,
        /what is \\d+ (.*)/i,
        /solve (.*)/i
      ],
      'listing': [
        /list (.*)/i,
        /examples of (.*)/i,
        /types of (.*)/i,
        /kinds of (.*)/i
      ]
    };
  }
  
  classifyIntent(prompt) {
    const normalizedPrompt = prompt.toLowerCase().trim();
    
    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedPrompt)) {
          return intent;
        }
      }
    }
    
    return 'general';
  }
  
  extractKeywords(prompt) {
    // Simple keyword extraction
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'what', 'how', 'where', 'when', 'why', 'who'
    ]);
    
    return prompt
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\\s]/g, ' ')
      .split(/\\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10); // Top 10 keywords
  }
  
  calculateSemanticSimilarity(prompt1, prompt2) {
    const keywords1 = new Set(this.extractKeywords(prompt1));
    const keywords2 = new Set(this.extractKeywords(prompt2));
    
    const intersection = new Set([...keywords1].filter(word => keywords2.has(word)));
    const union = new Set([...keywords1, ...keywords2]);
    
    // Jaccard similarity
    const jaccardSimilarity = intersection.size / union.size;
    
    // Intent similarity bonus
    const intent1 = this.classifyIntent(prompt1);
    const intent2 = this.classifyIntent(prompt2);
    const intentBonus = intent1 === intent2 ? 0.2 : 0;
    
    // Length similarity
    const lengthRatio = Math.min(prompt1.length, prompt2.length) / Math.max(prompt1.length, prompt2.length);
    const lengthBonus = lengthRatio > 0.5 ? 0.1 : 0;
    
    return Math.min(1.0, jaccardSimilarity + intentBonus + lengthBonus);
  }
  
  async semanticQuery(prompt, options = {}) {
    this.stats.totalRequests++;
    
    console.log(`🧠 Semantic cache lookup for: "${prompt.substring(0, 50)}..."`);
    
    // First, check for exact matches (fast path)
    const exactKey = this.generateExactKey(prompt, options);
    const exactMatch = this.semanticCache.get(exactKey);
    
    if (exactMatch && !this.isExpired(exactMatch)) {
      this.stats.exactMatches++;
      console.log(`✅ Exact match found`);
      exactMatch.lastAccessed = Date.now();
      return { ...exactMatch.value, fromCache: true, cacheType: 'EXACT' };
    }
    
    // Check for semantic matches
    const semanticMatch = this.findSemanticMatch(prompt, options);
    
    if (semanticMatch) {
      this.stats.semanticMatches++;
      console.log(`✅ Semantic match found (similarity: ${semanticMatch.similarity.toFixed(3)})`);
      semanticMatch.entry.lastAccessed = Date.now();
      
      // Store exact match for future fast lookups
      this.storeExactMatch(exactKey, semanticMatch.entry.value);
      
      return { 
        ...semanticMatch.entry.value, 
        fromCache: true, 
        cacheType: 'SEMANTIC',
        similarity: semanticMatch.similarity,
        originalPrompt: semanticMatch.entry.originalPrompt
      };
    }
    
    // Cache miss - query the model
    this.stats.misses++;
    console.log(`❌ No semantic match found - querying model`);
    
    const startTime = Date.now();
    const result = await this.router.quick(prompt, options);
    const queryTime = Date.now() - startTime;
    
    const cacheableResult = {
      ...result,
      queryTime,
      cachedAt: new Date(),
      originalPrompt: prompt,
      intent: this.classifyIntent(prompt),
      keywords: this.extractKeywords(prompt)
    };
    
    // Store in semantic cache
    this.storeSemanticMatch(prompt, options, cacheableResult);
    
    return { ...cacheableResult, fromCache: false, cacheType: 'MISS' };
  }
  
  generateExactKey(prompt, options = {}) {
    const keyData = {
      prompt: prompt.trim(),
      maxTokens: options.maxTokens || 150,
      temperature: options.temperature || 0.7
    };
    
    return crypto.createHash('md5').update(JSON.stringify(keyData)).digest('hex');
  }
  
  findSemanticMatch(prompt, options) {
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const [key, entry] of this.semanticCache) {
      if (this.isExpired(entry)) {
        this.semanticCache.delete(key);
        continue;
      }
      
      // Skip exact matches (already checked)
      if (key === this.generateExactKey(prompt, options)) {
        continue;
      }
      
      const similarity = this.calculateSemanticSimilarity(prompt, entry.originalPrompt);
      
      if (similarity >= this.similarityThreshold && similarity > bestSimilarity) {
        // Check if options are compatible
        if (this.areOptionsCompatible(options, entry.options)) {
          bestSimilarity = similarity;
          bestMatch = { entry, similarity };
        }
      }
    }
    
    return bestMatch;
  }
  
  areOptionsCompatible(options1, options2) {
    // Allow some tolerance for compatible options
    const temp1 = options1.temperature || 0.7;
    const temp2 = options2.temperature || 0.7;
    const tempDiff = Math.abs(temp1 - temp2);
    
    const tokens1 = options1.maxTokens || 150;
    const tokens2 = options2.maxTokens || 150;
    const tokenDiff = Math.abs(tokens1 - tokens2) / Math.max(tokens1, tokens2);
    
    return tempDiff <= 0.2 && tokenDiff <= 0.3; // 20% temp tolerance, 30% token tolerance
  }
  
  storeExactMatch(key, value) {
    this.semanticCache.set(key, {
      value,
      timestamp: Date.now(),
      expiresAt: Date.now() + 3600000, // 1 hour
      lastAccessed: Date.now(),
      accessCount: 1,
      type: 'exact'
    });
  }
  
  storeSemanticMatch(prompt, options, value) {
    // Evict if necessary
    if (this.semanticCache.size >= this.maxCacheSize) {
      this.evictLeastUsed();
    }
    
    const key = this.generateExactKey(prompt, options);
    
    this.semanticCache.set(key, {
      value,
      originalPrompt: prompt,
      options,
      timestamp: Date.now(),
      expiresAt: Date.now() + 7200000, // 2 hours for semantic matches
      lastAccessed: Date.now(),
      accessCount: 1,
      type: 'semantic'
    });
  }
  
  isExpired(entry) {
    return Date.now() > entry.expiresAt;
  }
  
  evictLeastUsed() {
    let leastUsedKey = null;
    let leastAccessed = Date.now();
    
    for (const [key, entry] of this.semanticCache) {
      if (entry.lastAccessed < leastAccessed) {
        leastAccessed = entry.lastAccessed;
        leastUsedKey = key;
      }
    }
    
    if (leastUsedKey) {
      this.semanticCache.delete(leastUsedKey);
    }
  }
  
  async analyzeSemanticPatterns() {
    const patterns = {
      intentDistribution: {},
      similarityStats: {
        averageSimilarity: 0,
        highSimilarityCount: 0,
        totalComparisons: 0
      },
      cacheEfficiency: {}
    };
    
    // Analyze intent distribution
    for (const [key, entry] of this.semanticCache) {
      if (entry.value.intent) {
        patterns.intentDistribution[entry.value.intent] = 
          (patterns.intentDistribution[entry.value.intent] || 0) + 1;
      }
    }
    
    // Analyze cache efficiency
    const totalRequests = this.stats.totalRequests;
    const totalHits = this.stats.exactMatches + this.stats.semanticMatches;
    
    patterns.cacheEfficiency = {
      exactMatchRate: totalRequests > 0 ? ((this.stats.exactMatches / totalRequests) * 100).toFixed(2) + '%' : '0%',
      semanticMatchRate: totalRequests > 0 ? ((this.stats.semanticMatches / totalRequests) * 100).toFixed(2) + '%' : '0%',
      overallHitRate: totalRequests > 0 ? ((totalHits / totalRequests) * 100).toFixed(2) + '%' : '0%',
      cacheSize: this.semanticCache.size,
      maxSize: this.maxCacheSize
    };
    
    return patterns;
  }
  
  getSemanticStats() {
    return {
      ...this.stats,
      cacheSize: this.semanticCache.size,
      hitRate: this.stats.totalRequests > 0 
        ? (((this.stats.exactMatches + this.stats.semanticMatches) / this.stats.totalRequests) * 100).toFixed(2) + '%'
        : '0%'
    };
  }
  
  demonstrateSemanticMatching(prompts) {
    console.log('🔍 Semantic Similarity Analysis:');
    
    for (let i = 0; i < prompts.length; i++) {
      for (let j = i + 1; j < prompts.length; j++) {
        const similarity = this.calculateSemanticSimilarity(prompts[i], prompts[j]);
        const intent1 = this.classifyIntent(prompts[i]);
        const intent2 = this.classifyIntent(prompts[j]);
        
        console.log(`\\n"${prompts[i]}" vs "${prompts[j]}"`);
        console.log(`  Similarity: ${similarity.toFixed(3)}`);
        console.log(`  Intent: ${intent1} vs ${intent2}`);
        console.log(`  Would match: ${similarity >= this.similarityThreshold ? 'YES' : 'NO'}`);
      }
    }
  }
}

// Usage example
async function demonstrateSemanticCaching() {
  const semanticCache = new SemanticCacheSystem();
  await semanticCache.initialize();
  
  // Test prompts with semantic similarities
  const testPrompts = [
    "What is artificial intelligence?",
    "Define artificial intelligence",
    "Explain AI technology",
    "How does machine learning work?",
    "What are the steps to implement ML?",
    "Machine learning tutorial",
    "What is artificial intelligence?", // Exact duplicate
    "AI definition and explanation", // Semantic similar to first
  ];
  
  // Demonstrate semantic similarity analysis
  semanticCache.demonstrateSemanticMatching(testPrompts.slice(0, 4));
  
  console.log('\\n🧠 Testing Semantic Caching:\\n');
  
  for (const [index, prompt] of testPrompts.entries()) {
    console.log(`--- Request ${index + 1} ---`);
    
    const startTime = Date.now();
    const result = await semanticCache.semanticQuery(prompt, {
      maxTokens: 100,
      temperature: 0.7
    });
    const totalTime = Date.now() - startTime;
    
    console.log(`Prompt: "${prompt}"`);
    console.log(`Cache Type: ${result.cacheType}`);
    
    if (result.similarity) {
      console.log(`Similarity: ${result.similarity.toFixed(3)}`);
      console.log(`Original: "${result.originalPrompt}"`);
    }
    
    console.log(`Total Time: ${totalTime}ms`);
    console.log('');
  }
  
  // Show semantic analysis
  console.log('📊 Semantic Cache Analysis:');
  const patterns = await semanticCache.analyzeSemanticPatterns();
  console.log(JSON.stringify(patterns, null, 2));
  
  console.log('\\n📈 Cache Statistics:');
  console.log(semanticCache.getSemanticStats());
}

demonstrateSemanticCaching().catch(console.error);
```

This comprehensive caching examples guide covers everything from basic response caching to sophisticated semantic and distributed caching systems, providing multiple strategies for optimizing LLM performance and cost efficiency.