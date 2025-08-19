# 🗄️ Response Caching

Comprehensive guide to implementing intelligent caching strategies for LLM responses to reduce costs and improve performance.

## Table of Contents

1. [Overview](#overview)
2. [Caching Strategies](#caching-strategies)
3. [Implementation](#implementation)
4. [Semantic Caching](#semantic-caching)
5. [Cache Management](#cache-management)
6. [Distributed Caching](#distributed-caching)
7. [Performance Optimization](#performance-optimization)
8. [Best Practices](#best-practices)

## Overview

Response caching can dramatically reduce costs and latency by storing and reusing LLM responses for similar queries.

### Benefits

- **Cost Reduction**: Save 40-70% on API costs
- **Latency Improvement**: Sub-millisecond response times for cached content
- **Load Reduction**: Decrease API request volume
- **Consistency**: Ensure consistent responses for identical queries
- **Offline Capability**: Serve cached responses when APIs are unavailable

### Key Features

- **Exact Match Caching**: Cache identical prompts
- **Semantic Caching**: Cache semantically similar prompts
- **TTL Management**: Automatic cache expiration
- **Invalidation Strategies**: Smart cache clearing
- **Compression**: Reduce storage requirements

## Caching Strategies

### 1. Exact Match Caching

Simple and effective for repeated queries:

```javascript
import { LLMRouter } from 'llm-runner-router';
import crypto from 'crypto';

const router = new LLMRouter({
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 3600, // 1 hour
    maxSize: 1000 // Maximum entries
  }
});

// First request - hits API
const response1 = await router.generate({
  prompt: 'What is the capital of France?',
  useCache: true
});
console.log(`Cache hit: ${response1.metadata.cacheHit}`); // false

// Second request - served from cache
const response2 = await router.generate({
  prompt: 'What is the capital of France?',
  useCache: true
});
console.log(`Cache hit: ${response2.metadata.cacheHit}`); // true
```

### 2. Semantic Caching

Cache semantically similar queries:

```javascript
const router = new LLMRouter({
  cache: {
    enabled: true,
    strategy: 'semantic',
    similarityThreshold: 0.95, // 95% similarity required
    embeddingModel: 'text-embedding-ada-002',
    vectorStore: 'pinecone' // or 'weaviate', 'qdrant', etc.
  }
});

// These similar queries will share cached responses
const queries = [
  'What is machine learning?',
  'Can you explain machine learning?',
  'Tell me about machine learning',
  'Describe what machine learning is'
];

for (const query of queries) {
  const response = await router.generate({
    prompt: query,
    useCache: true
  });
  console.log(`Query: "${query}" - Cache hit: ${response.metadata.cacheHit}`);
}
```

### 3. Contextual Caching

Cache based on context and parameters:

```javascript
class ContextualCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.ttl = options.ttl || 3600000;
  }
  
  generateKey(prompt, context) {
    const keyData = {
      prompt,
      model: context.model,
      temperature: context.temperature,
      maxTokens: context.maxTokens,
      systemPrompt: context.systemPrompt
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }
  
  async get(prompt, context) {
    const key = this.generateKey(prompt, context);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    entry.hits++;
    return entry.response;
  }
  
  async set(prompt, context, response) {
    const key = this.generateKey(prompt, context);
    
    this.cache.set(key, {
      response,
      context,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttl,
      hits: 0
    });
  }
}
```

## Implementation

### Basic Cache Implementation

```javascript
class ResponseCache {
  constructor(options = {}) {
    this.store = new Map();
    this.config = {
      maxSize: options.maxSize || 1000,
      ttl: options.ttl || 3600000, // 1 hour
      compression: options.compression || false,
      persistence: options.persistence || false
    };
    
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
    
    if (this.config.persistence) {
      this.loadFromDisk();
    }
  }
  
  async get(key) {
    const entry = this.store.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check TTL
    if (this.isExpired(entry)) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // Update access time for LRU
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    
    this.stats.hits++;
    
    // Decompress if needed
    if (this.config.compression) {
      return this.decompress(entry.data);
    }
    
    return entry.data;
  }
  
  async set(key, value, ttl = this.config.ttl) {
    // Check size limit
    if (this.store.size >= this.config.maxSize) {
      this.evictLRU();
    }
    
    // Compress if enabled
    let data = value;
    if (this.config.compression) {
      data = await this.compress(value);
    }
    
    this.store.set(key, {
      data,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: Date.now() + ttl,
      accessCount: 0,
      size: this.getSize(data)
    });
    
    if (this.config.persistence) {
      this.saveToDisk();
    }
  }
  
  isExpired(entry) {
    return Date.now() > entry.expiresAt;
  }
  
  evictLRU() {
    let oldest = null;
    let oldestKey = null;
    
    for (const [key, entry] of this.store) {
      if (!oldest || entry.lastAccessed < oldest.lastAccessed) {
        oldest = entry;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.store.delete(oldestKey);
      this.stats.evictions++;
    }
  }
  
  async compress(data) {
    // Implement compression (e.g., using zlib)
    const zlib = require('zlib');
    return new Promise((resolve, reject) => {
      zlib.gzip(JSON.stringify(data), (err, buffer) => {
        if (err) reject(err);
        else resolve(buffer);
      });
    });
  }
  
  async decompress(buffer) {
    const zlib = require('zlib');
    return new Promise((resolve, reject) => {
      zlib.gunzip(buffer, (err, data) => {
        if (err) reject(err);
        else resolve(JSON.parse(data.toString()));
      });
    });
  }
  
  getSize(data) {
    if (Buffer.isBuffer(data)) {
      return data.length;
    }
    return JSON.stringify(data).length;
  }
  
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      size: this.store.size,
      memoryUsage: this.getMemoryUsage()
    };
  }
  
  getMemoryUsage() {
    let total = 0;
    for (const entry of this.store.values()) {
      total += entry.size;
    }
    return total;
  }
  
  clear() {
    this.store.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }
  
  async saveToDisk() {
    // Implement persistence
    const fs = require('fs').promises;
    const data = Array.from(this.store.entries());
    await fs.writeFile('cache.json', JSON.stringify(data));
  }
  
  async loadFromDisk() {
    try {
      const fs = require('fs').promises;
      const data = await fs.readFile('cache.json', 'utf8');
      const entries = JSON.parse(data);
      
      for (const [key, value] of entries) {
        if (!this.isExpired(value)) {
          this.store.set(key, value);
        }
      }
    } catch (error) {
      // Cache file doesn't exist or is corrupted
      console.log('No cache file found, starting fresh');
    }
  }
}
```

### Advanced Caching with Metadata

```javascript
class AdvancedCache {
  constructor(options = {}) {
    this.cache = new ResponseCache(options);
    this.metadata = new Map();
  }
  
  async get(prompt, options = {}) {
    const key = this.generateKey(prompt, options);
    const cached = await this.cache.get(key);
    
    if (cached) {
      // Update metadata
      this.updateMetadata(key, 'hit');
      
      // Check if cache needs refresh
      if (this.shouldRefresh(key)) {
        this.refreshInBackground(prompt, options);
      }
      
      return cached;
    }
    
    this.updateMetadata(key, 'miss');
    return null;
  }
  
  async set(prompt, options, response) {
    const key = this.generateKey(prompt, options);
    
    // Store with metadata
    await this.cache.set(key, {
      response,
      metadata: {
        model: options.model,
        timestamp: Date.now(),
        tokens: response.usage?.total_tokens || 0,
        cost: this.calculateCost(response, options.model)
      }
    });
    
    this.updateMetadata(key, 'set');
  }
  
  generateKey(prompt, options) {
    const normalized = {
      prompt: prompt.trim().toLowerCase(),
      model: options.model,
      temperature: Math.round(options.temperature * 10) / 10,
      maxTokens: options.maxTokens
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }
  
  shouldRefresh(key) {
    const meta = this.metadata.get(key);
    if (!meta) return false;
    
    // Refresh popular entries proactively
    if (meta.hits > 10 && meta.lastRefresh < Date.now() - 1800000) {
      return true;
    }
    
    return false;
  }
  
  async refreshInBackground(prompt, options) {
    // Refresh cache in background without blocking
    setImmediate(async () => {
      try {
        const response = await this.fetchFresh(prompt, options);
        await this.set(prompt, options, response);
      } catch (error) {
        console.error('Background refresh failed:', error);
      }
    });
  }
  
  updateMetadata(key, action) {
    const meta = this.metadata.get(key) || {
      hits: 0,
      misses: 0,
      sets: 0,
      lastRefresh: Date.now()
    };
    
    switch (action) {
      case 'hit':
        meta.hits++;
        break;
      case 'miss':
        meta.misses++;
        break;
      case 'set':
        meta.sets++;
        meta.lastRefresh = Date.now();
        break;
    }
    
    this.metadata.set(key, meta);
  }
  
  calculateCost(response, model) {
    const pricing = {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'claude-3-opus': { input: 0.015, output: 0.075 }
    };
    
    const modelPricing = pricing[model] || { input: 0, output: 0 };
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    
    return (inputTokens * modelPricing.input + outputTokens * modelPricing.output) / 1000;
  }
  
  getAnalytics() {
    const analytics = {
      totalEntries: this.cache.store.size,
      totalHits: 0,
      totalMisses: 0,
      avgHitRate: 0,
      costSaved: 0,
      popularQueries: []
    };
    
    for (const [key, meta] of this.metadata) {
      analytics.totalHits += meta.hits;
      analytics.totalMisses += meta.misses;
      
      if (meta.hits > 5) {
        analytics.popularQueries.push({
          key: key.substring(0, 8) + '...',
          hits: meta.hits,
          hitRate: meta.hits / (meta.hits + meta.misses)
        });
      }
    }
    
    analytics.avgHitRate = analytics.totalHits / 
      (analytics.totalHits + analytics.totalMisses);
    
    // Calculate cost saved from cache hits
    analytics.costSaved = analytics.totalHits * 0.02; // Avg $0.02 per request
    
    // Sort popular queries
    analytics.popularQueries.sort((a, b) => b.hits - a.hits);
    analytics.popularQueries = analytics.popularQueries.slice(0, 10);
    
    return analytics;
  }
}
```

## Semantic Caching

### Vector-based Semantic Cache

```javascript
import { Pipeline } from '@xenova/transformers';

class SemanticCache {
  constructor(options = {}) {
    this.embeddings = new Map();
    this.responses = new Map();
    this.threshold = options.threshold || 0.95;
    this.embeddingModel = null;
    this.initEmbedding();
  }
  
  async initEmbedding() {
    // Initialize embedding pipeline
    this.embeddingModel = await Pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }
  
  async get(prompt) {
    if (!this.embeddingModel) {
      await this.initEmbedding();
    }
    
    // Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(prompt);
    
    // Find most similar cached prompt
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const [cachedPrompt, cachedEmbedding] of this.embeddings) {
      const similarity = this.cosineSimilarity(queryEmbedding, cachedEmbedding);
      
      if (similarity > bestSimilarity && similarity >= this.threshold) {
        bestSimilarity = similarity;
        bestMatch = cachedPrompt;
      }
    }
    
    if (bestMatch) {
      console.log(`Semantic cache hit! Similarity: ${bestSimilarity.toFixed(3)}`);
      return this.responses.get(bestMatch);
    }
    
    return null;
  }
  
  async set(prompt, response) {
    const embedding = await this.generateEmbedding(prompt);
    this.embeddings.set(prompt, embedding);
    this.responses.set(prompt, response);
  }
  
  async generateEmbedding(text) {
    const output = await this.embeddingModel(text, {
      pooling: 'mean',
      normalize: true
    });
    
    return Array.from(output.data);
  }
  
  cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  async findSimilar(prompt, topK = 5) {
    const queryEmbedding = await this.generateEmbedding(prompt);
    const similarities = [];
    
    for (const [cachedPrompt, cachedEmbedding] of this.embeddings) {
      similarities.push({
        prompt: cachedPrompt,
        similarity: this.cosineSimilarity(queryEmbedding, cachedEmbedding)
      });
    }
    
    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, topK);
  }
}
```

### Hybrid Caching Strategy

```javascript
class HybridCache {
  constructor(options = {}) {
    this.exactCache = new ResponseCache({ ttl: options.exactTTL || 3600000 });
    this.semanticCache = new SemanticCache({ threshold: options.threshold || 0.95 });
    this.strategy = options.strategy || 'both'; // 'exact', 'semantic', 'both'
  }
  
  async get(prompt, options = {}) {
    // Try exact match first (fastest)
    if (this.strategy === 'exact' || this.strategy === 'both') {
      const exact = await this.exactCache.get(this.getExactKey(prompt, options));
      if (exact) {
        return { ...exact, cacheType: 'exact' };
      }
    }
    
    // Try semantic match (slower but more flexible)
    if (this.strategy === 'semantic' || this.strategy === 'both') {
      const semantic = await this.semanticCache.get(prompt);
      if (semantic) {
        return { ...semantic, cacheType: 'semantic' };
      }
    }
    
    return null;
  }
  
  async set(prompt, options, response) {
    // Store in both caches
    if (this.strategy === 'exact' || this.strategy === 'both') {
      await this.exactCache.set(this.getExactKey(prompt, options), response);
    }
    
    if (this.strategy === 'semantic' || this.strategy === 'both') {
      await this.semanticCache.set(prompt, response);
    }
  }
  
  getExactKey(prompt, options) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify({ prompt, ...options }))
      .digest('hex');
  }
  
  async analyze() {
    const exactStats = this.exactCache.getStats();
    const semanticHits = await this.getSemanticStats();
    
    return {
      exact: exactStats,
      semantic: semanticHits,
      recommendation: this.getRecommendation(exactStats, semanticHits)
    };
  }
  
  getRecommendation(exactStats, semanticStats) {
    if (exactStats.hitRate > 0.7) {
      return 'Exact caching is working well. Consider increasing TTL.';
    }
    
    if (semanticStats.averageSimilarity > 0.9) {
      return 'Many similar queries detected. Semantic caching recommended.';
    }
    
    return 'Mixed strategy recommended for optimal performance.';
  }
}
```

## Cache Management

### Cache Invalidation Strategies

```javascript
class CacheInvalidator {
  constructor(cache) {
    this.cache = cache;
    this.rules = [];
    this.dependencies = new Map();
  }
  
  addRule(rule) {
    this.rules.push(rule);
  }
  
  async invalidate(options = {}) {
    const { 
      pattern, 
      tags, 
      age, 
      selective = false 
    } = options;
    
    const keysToInvalidate = [];
    
    for (const [key, entry] of this.cache.store) {
      let shouldInvalidate = false;
      
      // Pattern matching
      if (pattern && key.match(pattern)) {
        shouldInvalidate = true;
      }
      
      // Tag matching
      if (tags && entry.tags) {
        const hasTag = tags.some(tag => entry.tags.includes(tag));
        if (hasTag) shouldInvalidate = true;
      }
      
      // Age-based invalidation
      if (age && Date.now() - entry.createdAt > age) {
        shouldInvalidate = true;
      }
      
      // Apply custom rules
      for (const rule of this.rules) {
        if (rule(key, entry)) {
          shouldInvalidate = true;
          break;
        }
      }
      
      if (shouldInvalidate) {
        keysToInvalidate.push(key);
      }
    }
    
    // Invalidate selected keys
    for (const key of keysToInvalidate) {
      this.cache.store.delete(key);
      
      // Invalidate dependencies
      if (this.dependencies.has(key)) {
        const deps = this.dependencies.get(key);
        for (const dep of deps) {
          this.cache.store.delete(dep);
        }
      }
    }
    
    console.log(`Invalidated ${keysToInvalidate.length} cache entries`);
    return keysToInvalidate.length;
  }
  
  addDependency(key, dependsOn) {
    if (!this.dependencies.has(dependsOn)) {
      this.dependencies.set(dependsOn, new Set());
    }
    this.dependencies.get(dependsOn).add(key);
  }
  
  scheduleInvalidation(options, delay) {
    setTimeout(() => this.invalidate(options), delay);
  }
}
```

### Cache Warming

```javascript
class CacheWarmer {
  constructor(cache, router) {
    this.cache = cache;
    this.router = router;
    this.warmupQueries = [];
  }
  
  addWarmupQuery(prompt, options = {}) {
    this.warmupQueries.push({ prompt, options });
  }
  
  async warmup() {
    console.log(`Warming cache with ${this.warmupQueries.length} queries...`);
    
    const results = await Promise.allSettled(
      this.warmupQueries.map(async ({ prompt, options }) => {
        try {
          // Check if already cached
          const cached = await this.cache.get(prompt, options);
          if (cached) {
            return { status: 'already-cached', prompt };
          }
          
          // Generate and cache
          const response = await this.router.generate({
            prompt,
            ...options,
            useCache: false // Force fresh generation
          });
          
          await this.cache.set(prompt, options, response);
          
          return { status: 'warmed', prompt };
        } catch (error) {
          return { status: 'failed', prompt, error: error.message };
        }
      })
    );
    
    // Report results
    const summary = {
      total: results.length,
      warmed: results.filter(r => r.value?.status === 'warmed').length,
      cached: results.filter(r => r.value?.status === 'already-cached').length,
      failed: results.filter(r => r.status === 'rejected').length
    };
    
    console.log('Cache warming complete:', summary);
    return summary;
  }
  
  async analyzeUsagePatterns() {
    // Analyze logs to find common queries
    const patterns = new Map();
    
    // This would typically read from logs/database
    const logs = await this.getRecentLogs();
    
    for (const log of logs) {
      const key = this.normalizeQuery(log.prompt);
      patterns.set(key, (patterns.get(key) || 0) + 1);
    }
    
    // Find top queries to warm
    const topQueries = Array.from(patterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([query]) => query);
    
    return topQueries;
  }
  
  normalizeQuery(prompt) {
    return prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim();
  }
  
  async scheduleWarmup(schedule = '0 0 * * *') {
    // Use node-cron or similar for scheduling
    const cron = require('node-cron');
    
    cron.schedule(schedule, async () => {
      console.log('Starting scheduled cache warmup...');
      
      // Get popular queries
      const popularQueries = await this.analyzeUsagePatterns();
      
      // Clear old warmup queries
      this.warmupQueries = [];
      
      // Add popular queries
      for (const query of popularQueries) {
        this.addWarmupQuery(query);
      }
      
      // Run warmup
      await this.warmup();
    });
  }
}
```

## Distributed Caching

### Redis-based Distributed Cache

```javascript
import Redis from 'ioredis';

class DistributedCache {
  constructor(options = {}) {
    this.redis = new Redis(options.redis || {
      host: 'localhost',
      port: 6379
    });
    
    this.prefix = options.prefix || 'llm:cache:';
    this.ttl = options.ttl || 3600;
    this.compression = options.compression || true;
  }
  
  async get(key) {
    const fullKey = this.prefix + key;
    const data = await this.redis.get(fullKey);
    
    if (!data) return null;
    
    // Update statistics
    await this.redis.hincrby(this.prefix + 'stats', 'hits', 1);
    
    // Decompress if needed
    if (this.compression) {
      return this.decompress(data);
    }
    
    return JSON.parse(data);
  }
  
  async set(key, value, ttl = this.ttl) {
    const fullKey = this.prefix + key;
    
    // Compress if enabled
    let data = JSON.stringify(value);
    if (this.compression) {
      data = await this.compress(data);
    }
    
    // Set with TTL
    await this.redis.setex(fullKey, ttl, data);
    
    // Update statistics
    await this.redis.hincrby(this.prefix + 'stats', 'sets', 1);
  }
  
  async mget(keys) {
    const fullKeys = keys.map(k => this.prefix + k);
    const values = await this.redis.mget(fullKeys);
    
    return Promise.all(values.map(async (v, i) => {
      if (!v) return null;
      
      if (this.compression) {
        return this.decompress(v);
      }
      return JSON.parse(v);
    }));
  }
  
  async mset(entries, ttl = this.ttl) {
    const pipeline = this.redis.pipeline();
    
    for (const [key, value] of entries) {
      const fullKey = this.prefix + key;
      let data = JSON.stringify(value);
      
      if (this.compression) {
        data = await this.compress(data);
      }
      
      pipeline.setex(fullKey, ttl, data);
    }
    
    await pipeline.exec();
  }
  
  async invalidatePattern(pattern) {
    const keys = await this.redis.keys(this.prefix + pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    
    return keys.length;
  }
  
  async getStats() {
    const stats = await this.redis.hgetall(this.prefix + 'stats');
    const keys = await this.redis.keys(this.prefix + '*');
    
    return {
      hits: parseInt(stats.hits || 0),
      misses: parseInt(stats.misses || 0),
      sets: parseInt(stats.sets || 0),
      hitRate: stats.hits / (stats.hits + stats.misses),
      totalKeys: keys.length
    };
  }
  
  async compress(data) {
    const zlib = require('zlib');
    return new Promise((resolve, reject) => {
      zlib.gzip(data, (err, buffer) => {
        if (err) reject(err);
        else resolve(buffer.toString('base64'));
      });
    });
  }
  
  async decompress(data) {
    const zlib = require('zlib');
    return new Promise((resolve, reject) => {
      const buffer = Buffer.from(data, 'base64');
      zlib.gunzip(buffer, (err, result) => {
        if (err) reject(err);
        else resolve(JSON.parse(result.toString()));
      });
    });
  }
}
```

### Multi-tier Caching

```javascript
class MultiTierCache {
  constructor(options = {}) {
    // L1: In-memory cache (fastest)
    this.l1 = new ResponseCache({
      maxSize: options.l1Size || 100,
      ttl: options.l1TTL || 60000 // 1 minute
    });
    
    // L2: Redis cache (fast, distributed)
    this.l2 = new DistributedCache({
      redis: options.redis,
      ttl: options.l2TTL || 3600 // 1 hour
    });
    
    // L3: Database cache (persistent)
    this.l3 = new DatabaseCache({
      connection: options.database,
      ttl: options.l3TTL || 86400 // 1 day
    });
    
    this.stats = {
      l1Hits: 0,
      l2Hits: 0,
      l3Hits: 0,
      misses: 0
    };
  }
  
  async get(key) {
    // Check L1
    let value = await this.l1.get(key);
    if (value) {
      this.stats.l1Hits++;
      return { value, tier: 'L1' };
    }
    
    // Check L2
    value = await this.l2.get(key);
    if (value) {
      this.stats.l2Hits++;
      // Promote to L1
      await this.l1.set(key, value);
      return { value, tier: 'L2' };
    }
    
    // Check L3
    value = await this.l3.get(key);
    if (value) {
      this.stats.l3Hits++;
      // Promote to L2 and L1
      await this.l2.set(key, value);
      await this.l1.set(key, value);
      return { value, tier: 'L3' };
    }
    
    this.stats.misses++;
    return null;
  }
  
  async set(key, value) {
    // Write to all tiers in parallel
    await Promise.all([
      this.l1.set(key, value),
      this.l2.set(key, value),
      this.l3.set(key, value)
    ]);
  }
  
  async invalidate(key) {
    // Invalidate in all tiers
    await Promise.all([
      this.l1.delete(key),
      this.l2.delete(key),
      this.l3.delete(key)
    ]);
  }
  
  getStats() {
    const total = this.stats.l1Hits + this.stats.l2Hits + 
                  this.stats.l3Hits + this.stats.misses;
    
    return {
      ...this.stats,
      hitRate: (total - this.stats.misses) / total,
      l1HitRate: this.stats.l1Hits / total,
      l2HitRate: this.stats.l2Hits / total,
      l3HitRate: this.stats.l3Hits / total
    };
  }
}
```

## Performance Optimization

### Cache Preloading

```javascript
class CachePreloader {
  constructor(cache, predictor) {
    this.cache = cache;
    this.predictor = predictor;
  }
  
  async preload(context) {
    // Predict likely next queries
    const predictions = await this.predictor.predict(context);
    
    // Preload top predictions
    const preloadPromises = predictions
      .slice(0, 5)
      .map(async query => {
        // Check if already cached
        const cached = await this.cache.get(query);
        
        if (!cached) {
          // Generate in background
          this.generateInBackground(query);
        }
      });
    
    await Promise.all(preloadPromises);
  }
  
  async generateInBackground(query) {
    // Don't block on preloading
    setImmediate(async () => {
      try {
        const response = await this.router.generate({
          prompt: query,
          priority: 'low'
        });
        
        await this.cache.set(query, response);
      } catch (error) {
        // Silently fail for preloading
        console.debug('Preload failed:', error.message);
      }
    });
  }
}

class QueryPredictor {
  constructor() {
    this.history = [];
    this.patterns = new Map();
  }
  
  async predict(context) {
    const predictions = [];
    
    // Based on recent history
    if (context.previousQuery) {
      const followUps = this.getCommonFollowUps(context.previousQuery);
      predictions.push(...followUps);
    }
    
    // Based on user patterns
    if (context.userId) {
      const userPatterns = this.getUserPatterns(context.userId);
      predictions.push(...userPatterns);
    }
    
    // Based on time of day
    const timeBasedQueries = this.getTimeBasedQueries();
    predictions.push(...timeBasedQueries);
    
    return [...new Set(predictions)].slice(0, 10);
  }
  
  getCommonFollowUps(query) {
    // Analyze historical data for common follow-up queries
    return this.patterns.get(query) || [];
  }
  
  getUserPatterns(userId) {
    // Get user's common queries
    return this.history
      .filter(h => h.userId === userId)
      .map(h => h.query)
      .slice(0, 5);
  }
  
  getTimeBasedQueries() {
    const hour = new Date().getHours();
    
    // Common queries by time of day
    if (hour >= 9 && hour <= 11) {
      return ['weather today', 'news summary', 'stock market'];
    } else if (hour >= 14 && hour <= 16) {
      return ['meeting notes template', 'email draft', 'task list'];
    }
    
    return [];
  }
}
```

### Cache Compression Strategies

```javascript
class CompressionOptimizer {
  constructor() {
    this.algorithms = {
      gzip: require('zlib').gzip,
      brotli: require('zlib').brotliCompress,
      lz4: this.lz4Compress
    };
  }
  
  async findOptimal(data) {
    const results = await Promise.all(
      Object.entries(this.algorithms).map(async ([name, compress]) => {
        const start = Date.now();
        const compressed = await this.compress(data, compress);
        const time = Date.now() - start;
        
        return {
          algorithm: name,
          originalSize: Buffer.byteLength(JSON.stringify(data)),
          compressedSize: compressed.length,
          ratio: compressed.length / Buffer.byteLength(JSON.stringify(data)),
          time
        };
      })
    );
    
    // Find best compression ratio vs speed trade-off
    const best = results.reduce((best, current) => {
      const score = (1 - current.ratio) * 1000 - current.time;
      const bestScore = (1 - best.ratio) * 1000 - best.time;
      
      return score > bestScore ? current : best;
    });
    
    return best;
  }
  
  async compress(data, algorithm) {
    return new Promise((resolve, reject) => {
      algorithm(JSON.stringify(data), (err, buffer) => {
        if (err) reject(err);
        else resolve(buffer);
      });
    });
  }
  
  lz4Compress(data, callback) {
    // Implement LZ4 compression
    // This is a placeholder
    callback(null, Buffer.from(data));
  }
}
```

## Best Practices

### 1. Cache Key Design

```javascript
class CacheKeyGenerator {
  static generate(prompt, options = {}) {
    // Normalize prompt
    const normalizedPrompt = prompt
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    
    // Include relevant options
    const keyData = {
      prompt: normalizedPrompt,
      model: options.model,
      temperature: Math.round((options.temperature || 0.7) * 10) / 10,
      maxTokens: Math.ceil((options.maxTokens || 100) / 50) * 50,
      // Don't include timestamp or request ID
    };
    
    // Generate stable hash
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex')
      .substring(0, 16); // Shorter keys for efficiency
  }
  
  static generateWithContext(prompt, context) {
    const contextHash = crypto
      .createHash('md5')
      .update(JSON.stringify(context))
      .digest('hex')
      .substring(0, 8);
    
    const promptHash = crypto
      .createHash('md5')
      .update(prompt)
      .digest('hex')
      .substring(0, 8);
    
    return `${contextHash}:${promptHash}`;
  }
}
```

### 2. Cache Monitoring

```javascript
class CacheMonitor {
  constructor(cache) {
    this.cache = cache;
    this.metrics = [];
  }
  
  startMonitoring(interval = 60000) {
    setInterval(() => this.collect(), interval);
  }
  
  collect() {
    const stats = this.cache.getStats();
    const metric = {
      timestamp: Date.now(),
      ...stats,
      memoryUsage: process.memoryUsage().heapUsed,
      costSaved: this.calculateCostSaved(stats)
    };
    
    this.metrics.push(metric);
    
    // Keep only last 24 hours
    const cutoff = Date.now() - 86400000;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    
    // Check for issues
    this.checkHealth(metric);
  }
  
  checkHealth(metric) {
    // Low hit rate warning
    if (metric.hitRate < 0.3) {
      console.warn('Low cache hit rate:', metric.hitRate);
    }
    
    // High eviction rate
    if (metric.evictions > metric.sets * 0.5) {
      console.warn('High eviction rate. Consider increasing cache size.');
    }
    
    // Memory pressure
    if (metric.memoryUsage > 500 * 1024 * 1024) { // 500MB
      console.warn('High memory usage:', metric.memoryUsage);
    }
  }
  
  calculateCostSaved(stats) {
    // Estimate based on average API costs
    const avgCostPerRequest = 0.02; // $0.02 average
    return stats.hits * avgCostPerRequest;
  }
  
  getReport() {
    const recent = this.metrics.slice(-60); // Last hour
    
    return {
      hourlyHitRate: this.average(recent.map(m => m.hitRate)),
      hourlyCostSaved: this.sum(recent.map(m => m.costSaved)),
      totalCostSaved: this.sum(this.metrics.map(m => m.costSaved)),
      recommendations: this.getRecommendations()
    };
  }
  
  getRecommendations() {
    const avgHitRate = this.average(this.metrics.map(m => m.hitRate));
    const recommendations = [];
    
    if (avgHitRate < 0.5) {
      recommendations.push('Consider semantic caching for better hit rates');
    }
    
    if (this.metrics.some(m => m.evictions > 100)) {
      recommendations.push('Increase cache size to reduce evictions');
    }
    
    return recommendations;
  }
  
  average(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  
  sum(arr) {
    return arr.reduce((a, b) => a + b, 0);
  }
}
```

### 3. Cache Policies

```javascript
const cachePolicies = {
  // Conservative: Short TTL, exact matching only
  conservative: {
    ttl: 300000, // 5 minutes
    strategy: 'exact',
    maxSize: 100,
    compression: false
  },
  
  // Balanced: Moderate TTL, hybrid matching
  balanced: {
    ttl: 3600000, // 1 hour
    strategy: 'hybrid',
    maxSize: 500,
    compression: true,
    semanticThreshold: 0.95
  },
  
  // Aggressive: Long TTL, semantic matching
  aggressive: {
    ttl: 86400000, // 24 hours
    strategy: 'semantic',
    maxSize: 2000,
    compression: true,
    semanticThreshold: 0.90,
    preloading: true
  },
  
  // Development: No caching
  development: {
    enabled: false
  }
};

// Use appropriate policy
const environment = process.env.NODE_ENV || 'development';
const policy = cachePolicies[environment] || cachePolicies.balanced;

const cache = new HybridCache(policy);
```

## Summary

Effective caching strategies can:

- **Reduce costs by 40-70%** through response reuse
- **Improve latency to sub-millisecond** for cached content
- **Increase reliability** with offline capability
- **Enable scaling** by reducing backend load
- **Provide consistency** across requests

Start with exact match caching and gradually adopt semantic caching as your usage patterns become clear.

---

Next: [Enterprise Features](../advanced/enterprise.md) | Previous: [Rate Limiting](./rate-limiting.md)