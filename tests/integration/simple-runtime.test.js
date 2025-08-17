/**
 * Simplified runtime integration tests
 * Tests core functionality without memory issues
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Simplified Runtime Tests', () => {
  
  describe('Memory Manager', () => {
    it('should import MemoryManager', async () => {
      const { MemoryManager } = await import('../../src/runtime/MemoryManager.js');
      expect(MemoryManager).toBeDefined();
    });
    
    it('should create MemoryManager instance', async () => {
      const { MemoryManager } = await import('../../src/runtime/MemoryManager.js');
      const manager = new MemoryManager({ maxMemoryUsage: 0.5 });
      expect(manager).toBeDefined();
      expect(manager.config.maxMemoryUsage).toBe(0.5);
    });
  });
  
  describe('Cache Manager', () => {
    it('should import CacheManager', async () => {
      const { CacheManager } = await import('../../src/runtime/CacheManager.js');
      expect(CacheManager).toBeDefined();
    });
    
    it('should create CacheManager instance', async () => {
      const { CacheManager } = await import('../../src/runtime/CacheManager.js');
      const cache = new CacheManager({ maxSize: 100 });
      expect(cache).toBeDefined();
      expect(cache.config.maxSize).toBe(100);
    });
  });
  
  describe('Stream Processor', () => {
    it('should import StreamProcessor', async () => {
      const { StreamProcessor } = await import('../../src/runtime/StreamProcessor.js');
      expect(StreamProcessor).toBeDefined();
    });
    
    it('should create StreamProcessor instance', async () => {
      const { StreamProcessor } = await import('../../src/runtime/StreamProcessor.js');
      const processor = new StreamProcessor({ batchSize: 10 });
      expect(processor).toBeDefined();
      expect(processor.config.batchSize).toBe(10);
    });
  });
});