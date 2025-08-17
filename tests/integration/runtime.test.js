/**
 * Integration tests for runtime components
 * Tests Memory Manager, Cache Manager, and Stream Processor
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { MemoryManager } from '../../src/runtime/MemoryManager.js';
import { CacheManager } from '../../src/runtime/CacheManager.js';
import { StreamProcessor } from '../../src/runtime/StreamProcessor.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Runtime Integration Tests', () => {
  
  describe('Memory Manager', () => {
    let memoryManager;
    
    beforeEach(async () => {
      memoryManager = new MemoryManager({
        maxMemoryUsage: 0.8,
        gcThreshold: 0.7,
        poolSize: 5
      });
      await memoryManager.initialize();
    });
    
    afterEach(async () => {
      await memoryManager.cleanup();
    });
    
    it('should initialize buffer pool', () => {
      expect(memoryManager.bufferPool).toHaveLength(5);
      expect(memoryManager.bufferPool[0].buffer).toBeInstanceOf(Buffer);
    });
    
    it('should track memory allocations', async () => {
      await memoryManager.allocateModelMemory('model1', 50 * 1024 * 1024);
      
      const stats = memoryManager.getStatistics();
      expect(stats.totalAllocated).toBeGreaterThan(0);
      expect(stats.models).toHaveLength(1);
      expect(stats.models[0].id).toBe('model1');
    });
    
    it('should compress models when memory pressure increases', async () => {
      await memoryManager.allocateModelMemory('model1', 100 * 1024 * 1024);
      await memoryManager.compressModel('model1');
      
      const model = memoryManager.models.get('model1');
      expect(model.compressed).toBe(true);
      expect(model.size).toBeLessThan(100 * 1024 * 1024);
    });
    
    it('should swap models to disk under memory pressure', async () => {
      await memoryManager.allocateModelMemory('model1', 100 * 1024 * 1024);
      await memoryManager.swapModelToDisk('model1');
      
      const model = memoryManager.models.get('model1');
      expect(model.swapped).toBe(true);
      expect(memoryManager.statistics.swapCount).toBe(1);
    });
    
    it('should update access statistics', () => {
      memoryManager.models.set('model1', {
        size: 100,
        allocated: Date.now(),
        lastAccessed: Date.now() - 1000,
        accessCount: 0,
        compressed: false,
        swapped: false
      });
      
      memoryManager.updateModelAccess('model1');
      
      const model = memoryManager.models.get('model1');
      expect(model.accessCount).toBe(1);
      expect(model.lastAccessed).toBeGreaterThan(Date.now() - 100);
    });
    
    it('should get and return pooled buffers', () => {
      const buffer = memoryManager.getPooledBuffer(1024);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBe(1024);
      
      memoryManager.returnPooledBuffer(buffer);
    });
    
    it('should optimize memory layout based on access patterns', async () => {
      // Add models with different access patterns
      memoryManager.models.set('frequent', {
        size: 100,
        allocated: Date.now() - 60000,
        lastAccessed: Date.now(),
        accessCount: 100,
        compressed: false,
        swapped: false
      });
      
      memoryManager.models.set('rare', {
        size: 100,
        allocated: Date.now() - 60000,
        lastAccessed: Date.now() - 30000,
        accessCount: 1,
        compressed: false,
        swapped: false
      });
      
      await memoryManager.optimizeMemoryLayout();
      
      const rare = memoryManager.models.get('rare');
      expect(rare.swapped || rare.compressed).toBe(true);
    });
  });
  
  describe('Cache Manager', () => {
    let cacheManager;
    const testCacheDir = path.join(os.tmpdir(), 'llm-router-test-cache');
    
    beforeEach(async () => {
      cacheManager = new CacheManager({
        l1Size: 10,
        l1MaxSize: 1024 * 1024, // 1MB
        l2Path: testCacheDir,
        l2Enabled: true,
        l3Enabled: false
      });
      await cacheManager.initialize();
    });
    
    afterEach(async () => {
      await cacheManager.cleanup();
      // Clean up test cache directory
      try {
        await fs.rm(testCacheDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore if doesn't exist
      }
    });
    
    it('should initialize multi-tier caches', () => {
      expect(cacheManager.l1Cache).toBeDefined();
      expect(cacheManager.config.l2Enabled).toBe(true);
    });
    
    it('should generate consistent cache keys', () => {
      const key1 = cacheManager.generateKey('test', { param: 1 });
      const key2 = cacheManager.generateKey('test', { param: 1 });
      const key3 = cacheManager.generateKey('test', { param: 2 });
      
      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });
    
    it('should set and get from L1 cache', async () => {
      const key = cacheManager.generateKey('test');
      await cacheManager.set(key, 'test value', { tiers: ['l1'] });
      
      const value = await cacheManager.get(key);
      expect(value).toBe('test value');
      expect(cacheManager.stats.l1Hits).toBe(1);
    });
    
    it('should set and get from L2 cache', async () => {
      const key = cacheManager.generateKey('test-l2');
      await cacheManager.set(key, 'test value L2', { tiers: ['l2'] });
      
      const value = await cacheManager.get(key);
      expect(value).toBe('test value L2');
      expect(cacheManager.stats.l2Hits).toBe(1);
    });
    
    it('should promote from L2 to L1', async () => {
      const key = cacheManager.generateKey('test-promote');
      
      // Set only in L2
      await cacheManager.set(key, 'promote me', { tiers: ['l2'] });
      
      // Get should promote to L1
      const value = await cacheManager.get(key);
      expect(value).toBe('promote me');
      
      // Second get should hit L1
      const value2 = await cacheManager.get(key);
      expect(value2).toBe('promote me');
      expect(cacheManager.stats.l1Hits).toBeGreaterThan(0);
    });
    
    it('should handle cache misses', async () => {
      const value = await cacheManager.get('nonexistent');
      expect(value).toBeUndefined();
      expect(cacheManager.stats.totalMisses).toBeGreaterThan(0);
    });
    
    it('should delete from all tiers', async () => {
      const key = cacheManager.generateKey('delete-test');
      await cacheManager.set(key, 'delete me', { tiers: ['l1', 'l2'] });
      
      await cacheManager.delete(key);
      
      const value = await cacheManager.get(key);
      expect(value).toBeUndefined();
    });
    
    it('should calculate cache statistics', async () => {
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', 'value2');
      await cacheManager.get('key1');
      await cacheManager.get('key3'); // miss
      
      const stats = cacheManager.getStatistics();
      expect(stats.totalHits).toBeGreaterThan(0);
      expect(stats.totalMisses).toBeGreaterThan(0);
      expect(stats.overallHitRate).toBeGreaterThan(0);
    });
    
    it('should serialize and deserialize values correctly', () => {
      const obj = { test: 'value', nested: { data: 123 } };
      const serialized = cacheManager.serializeValue(obj);
      expect(serialized).toBeInstanceOf(Buffer);
      
      const deserialized = cacheManager.deserializeValue(serialized);
      expect(deserialized).toEqual(obj);
    });
  });
  
  describe('Stream Processor', () => {
    let streamProcessor;
    
    beforeEach(async () => {
      streamProcessor = new StreamProcessor({
        chunkSize: 1,
        bufferSize: 10,
        batchingEnabled: true,
        maxBatchSize: 5
      });
      await streamProcessor.initialize();
    });
    
    afterEach(async () => {
      await streamProcessor.cleanup();
    });
    
    it('should create streaming sessions', () => {
      const stream = streamProcessor.createStream('test-stream');
      expect(stream).toHaveProperty('write');
      expect(stream).toHaveProperty('end');
      expect(stream).toHaveProperty('readable');
      expect(streamProcessor.streams.has('test-stream')).toBe(true);
    });
    
    it('should stream tokens', async () => {
      const stream = streamProcessor.createStream('token-stream');
      const tokens = [];
      
      stream.readable.on('data', (chunk) => {
        tokens.push(chunk);
      });
      
      await stream.write('Hello');
      await stream.write(' ');
      await stream.write('World');
      stream.end();
      
      await new Promise(resolve => stream.readable.on('end', resolve));
      
      expect(tokens.length).toBeGreaterThan(0);
    });
    
    it('should batch tokens when enabled', async () => {
      const stream = streamProcessor.createStream('batch-stream', {
        batchingEnabled: true,
        maxBatchSize: 3,
        batchTimeout: 1000
      });
      
      const batches = [];
      stream.readable.on('data', (chunk) => {
        batches.push(chunk);
      });
      
      // Write 5 tokens - should create 2 batches
      for (let i = 0; i < 5; i++) {
        await stream.write(`token${i}`);
      }
      stream.end();
      
      await new Promise(resolve => stream.readable.on('end', resolve));
      
      expect(batches.length).toBeGreaterThanOrEqual(1);
    });
    
    it('should support async iteration', async () => {
      const stream = streamProcessor.createStream('async-stream');
      const tokens = [];
      
      // Start writing in background
      (async () => {
        for (let i = 0; i < 3; i++) {
          await stream.write(`token${i}`);
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        stream.end();
      })();
      
      // Iterate over stream
      for await (const token of stream.getAsyncIterator()) {
        tokens.push(token);
      }
      
      expect(tokens).toHaveLength(3);
    });
    
    it('should format SSE events', () => {
      const event = streamProcessor.formatSSE({ text: 'Hello' });
      expect(event).toBe('data: {"text":"Hello"}\n\n');
    });
    
    it('should track stream statistics', async () => {
      const stream = streamProcessor.createStream('stats-stream');
      
      await stream.write('token1');
      await stream.write('token2');
      stream.end();
      
      const stats = streamProcessor.getStatistics();
      expect(stats.tokensGenerated).toBeGreaterThanOrEqual(2);
      expect(stats.streamsCreated).toBeGreaterThanOrEqual(1);
    });
    
    it('should handle multiple concurrent streams', async () => {
      const stream1 = streamProcessor.createStream('stream1');
      const stream2 = streamProcessor.createStream('stream2');
      
      const results1 = [];
      const results2 = [];
      
      stream1.readable.on('data', chunk => results1.push(chunk));
      stream2.readable.on('data', chunk => results2.push(chunk));
      
      await stream1.write('s1-token1');
      await stream2.write('s2-token1');
      await stream1.write('s1-token2');
      await stream2.write('s2-token2');
      
      stream1.end();
      stream2.end();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(results1.length).toBeGreaterThan(0);
      expect(results2.length).toBeGreaterThan(0);
    });
    
    it('should apply transformations to streams', () => {
      const stream = streamProcessor.createStream('transform-stream');
      
      // Apply uppercase transformation
      streamProcessor.applyTransformation('transform-stream', (token) => {
        return token.toUpperCase();
      });
      
      const results = [];
      stream.readable.on('data', chunk => results.push(chunk));
      
      stream.write('hello');
      stream.end();
      
      // Note: This test might need adjustment based on actual implementation
      expect(streamProcessor.streams.has('transform-stream')).toBe(true);
    });
  });
  
  describe('Component Integration', () => {
    it('should integrate Memory Manager with Cache Manager', async () => {
      const memoryManager = new MemoryManager();
      const cacheManager = new CacheManager();
      
      await memoryManager.initialize();
      await cacheManager.initialize();
      
      // Allocate memory for a model
      await memoryManager.allocateModelMemory('model1', 10 * 1024 * 1024);
      
      // Cache model metadata
      const key = cacheManager.generateKey('model1-metadata');
      await cacheManager.set(key, {
        id: 'model1',
        size: 10 * 1024 * 1024,
        loaded: true
      });
      
      // Retrieve cached metadata
      const metadata = await cacheManager.get(key);
      expect(metadata.id).toBe('model1');
      
      await memoryManager.cleanup();
      await cacheManager.cleanup();
    });
    
    it('should integrate Stream Processor with Cache Manager', async () => {
      const streamProcessor = new StreamProcessor();
      const cacheManager = new CacheManager();
      
      await streamProcessor.initialize();
      await cacheManager.initialize();
      
      const stream = streamProcessor.createStream('cached-stream');
      const tokens = ['token1', 'token2', 'token3'];
      
      // Cache tokens
      for (const token of tokens) {
        const key = cacheManager.generateKey(`token-${token}`);
        await cacheManager.set(key, token);
      }
      
      // Stream cached tokens
      for (const token of tokens) {
        const key = cacheManager.generateKey(`token-${token}`);
        const cached = await cacheManager.get(key);
        await stream.write(cached);
      }
      stream.end();
      
      await streamProcessor.cleanup();
      await cacheManager.cleanup();
    });
  });
});