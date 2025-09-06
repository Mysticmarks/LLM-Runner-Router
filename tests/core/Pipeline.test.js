/**
 * Pipeline Component Test Suite
 * Tests processing pipelines, caching, streaming, and middleware
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Pipeline } from '../../src/core/Pipeline.js';
import { EventEmitter } from 'events';

describe('Pipeline Core Component', () => {
  let pipeline;
  let mockModel;

  beforeEach(() => {
    pipeline = new Pipeline({
      maxConcurrent: 5,
      timeout: 30000,
      retries: 3
    });
    
    // Mock model
    mockModel = {
      id: 'test-model',
      name: 'Test Model',
      generate: jest.fn().mockResolvedValue({
        text: 'Generated response',
        tokens: 25,
        latency: 150
      }),
      stream: jest.fn().mockImplementation(async function* (prompt) {
        const tokens = ['Hello', ', ', 'world', '!'];
        for (const token of tokens) {
          yield token;
        }
      }),
      loaded: true
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize as EventEmitter', () => {
      expect(pipeline).toBeInstanceOf(EventEmitter);
    });

    test('should initialize with configuration', () => {
      expect(pipeline.config.maxConcurrent).toBe(5);
      expect(pipeline.config.timeout).toBe(30000);
      expect(pipeline.config.retries).toBe(3);
    });

    test('should have required methods', () => {
      expect(typeof pipeline.process).toBe('function');
      expect(typeof pipeline.initialize).toBe('function');
      expect(typeof pipeline.preProcess).toBe('function');
      expect(typeof pipeline.postProcess).toBe('function');
      expect(typeof pipeline.cleanup).toBe('function');
    });

    test('should initialize with default options', () => {
      const defaultPipeline = new Pipeline();
      expect(defaultPipeline.config.maxConcurrent).toBe(5);
      expect(defaultPipeline.config.timeout).toBe(30000);
      expect(defaultPipeline.config.retries).toBe(3);
    });

    test('should initialize with custom options', () => {
      const customPipeline = new Pipeline({
        maxConcurrent: 10,
        timeout: 60000,
        retries: 5
      });
      
      expect(customPipeline.config.maxConcurrent).toBe(10);
      expect(customPipeline.config.timeout).toBe(60000);
      expect(customPipeline.config.retries).toBe(5);
    });
  });

  describe('Request Processing', () => {
    const mockRequest = {
      prompt: 'Hello, how are you?',
      options: {
        maxTokens: 100,
        temperature: 0.7
      },
      metadata: {
        userId: 'test-user',
        sessionId: 'test-session'
      }
    };

    const mockModel = {
      id: 'test-model',
      name: 'Test Model',
      generate: jest.fn().mockResolvedValue({
        text: 'I am doing well, thank you!',
        tokens: 25,
        latency: 150
      }),
      loaded: true
    };

    beforeEach(() => {
      mockRouter.select.mockResolvedValue(mockModel);
      mockRegistry.get.mockResolvedValue(mockModel);
    });

    test('should process basic text generation request', async () => {
      const result = await pipeline.process(mockRequest);
      
      expect(result).toBeDefined();
      expect(result.text).toBe('I am doing well, thank you!');
      expect(result.tokens).toBe(25);
      expect(result.latency).toBe(150);
      expect(result.model).toBe(mockModel);
    });

    test('should emit processing events', async () => {
      const startSpy = jest.fn();
      const endSpy = jest.fn();
      
      pipeline.on('process:start', startSpy);
      pipeline.on('process:end', endSpy);
      
      await pipeline.process(mockRequest);
      
      expect(startSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: mockRequest.prompt
        })
      );
      
      expect(endSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'I am doing well, thank you!'
        })
      );
    });

    test('should handle model selection', async () => {
      await pipeline.process(mockRequest);
      
      expect(mockRouter.select).toHaveBeenCalledWith(
        expect.any(Array), // models list
        mockRequest.prompt,
        expect.any(Object)  // options
      );
    });

    test('should pass options to model generation', async () => {
      await pipeline.process(mockRequest);
      
      expect(mockModel.generate).toHaveBeenCalledWith(
        mockRequest.prompt,
        expect.objectContaining({
          maxTokens: 100,
          temperature: 0.7
        })
      );
    });

    test('should include request metadata in response', async () => {
      const result = await pipeline.process(mockRequest);
      
      expect(result.metadata).toMatchObject({
        userId: 'test-user',
        sessionId: 'test-session'
      });
    });

    test('should generate unique request ID', async () => {
      const result1 = await pipeline.process(mockRequest);
      const result2 = await pipeline.process(mockRequest);
      
      expect(result1.id).toBeDefined();
      expect(result2.id).toBeDefined();
      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe('Streaming Support', () => {
    const streamingModel = {
      id: 'streaming-model',
      name: 'Streaming Model',
      stream: jest.fn().mockImplementation(async function* (prompt, options) {
        const tokens = ['Hello', ', ', 'how', ' are', ' you', '?'];
        for (const token of tokens) {
          yield token;
        }
      }),
      loaded: true
    };

    beforeEach(() => {
      mockRouter.select.mockResolvedValue(streamingModel);
      mockRegistry.get.mockResolvedValue(streamingModel);
    });

    test('should support streaming responses', async () => {
      const request = {
        prompt: 'Hello',
        options: { stream: true }
      };
      
      const tokens = [];
      for await (const token of pipeline.stream(request)) {
        tokens.push(token);
      }
      
      expect(tokens).toEqual(['Hello', ', ', 'how', ' are', ' you', '?']);
    });

    test('should emit streaming events', async () => {
      const streamStartSpy = jest.fn();
      const tokenSpy = jest.fn();
      const streamEndSpy = jest.fn();
      
      pipeline.on('stream:start', streamStartSpy);
      pipeline.on('stream:token', tokenSpy);
      pipeline.on('stream:end', streamEndSpy);
      
      const request = { prompt: 'Hello', options: { stream: true } };
      
      const tokens = [];
      for await (const token of pipeline.stream(request)) {
        tokens.push(token);
      }
      
      expect(streamStartSpy).toHaveBeenCalled();
      expect(tokenSpy).toHaveBeenCalledTimes(6); // One for each token
      expect(streamEndSpy).toHaveBeenCalled();
    });

    test('should handle streaming errors gracefully', async () => {
      const errorModel = {
        id: 'error-model',
        stream: jest.fn().mockImplementation(async function* () {
          yield 'Hello';
          throw new Error('Streaming error');
        }),
        loaded: true
      };
      
      mockRouter.select.mockResolvedValue(errorModel);
      
      const request = { prompt: 'Hello', options: { stream: true } };
      
      const tokens = [];
      try {
        for await (const token of pipeline.stream(request)) {
          tokens.push(token);
        }
      } catch (error) {
        expect(error.message).toBe('Streaming error');
      }
      
      expect(tokens).toEqual(['Hello']);
    });
  });

  describe('Caching', () => {
    const cachedModel = {
      id: 'cached-model',
      generate: jest.fn().mockResolvedValue({
        text: 'Cached response',
        tokens: 10,
        latency: 50
      }),
      loaded: true
    };

    beforeEach(() => {
      mockRouter.select.mockResolvedValue(cachedModel);
      pipeline.cacheEnabled = true;
    });

    test('should cache responses by default', async () => {
      const request = { prompt: 'Cache test' };
      
      const result1 = await pipeline.process(request);
      const result2 = await pipeline.process(request);
      
      expect(cachedModel.generate).toHaveBeenCalledTimes(1);
      expect(result1.text).toBe(result2.text);
      expect(result2.cached).toBe(true);
    });

    test('should respect cache TTL', async () => {
      pipeline.cacheTTL = 100; // 100ms
      const request = { prompt: 'TTL test' };
      
      await pipeline.process(request);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      await pipeline.process(request);
      
      expect(cachedModel.generate).toHaveBeenCalledTimes(2);
    });

    test('should skip caching when disabled', async () => {
      pipeline.cacheEnabled = false;
      const request = { prompt: 'No cache test' };
      
      await pipeline.process(request);
      await pipeline.process(request);
      
      expect(cachedModel.generate).toHaveBeenCalledTimes(2);
    });

    test('should clear cache on demand', async () => {
      const request = { prompt: 'Clear cache test' };
      
      await pipeline.process(request);
      pipeline.clearCache();
      await pipeline.process(request);
      
      expect(cachedModel.generate).toHaveBeenCalledTimes(2);
    });

    test('should cache based on prompt and options', async () => {
      const request1 = { prompt: 'Test', options: { temperature: 0.5 } };
      const request2 = { prompt: 'Test', options: { temperature: 0.8 } };
      
      await pipeline.process(request1);
      await pipeline.process(request2);
      
      // Different options should result in different cache entries
      expect(cachedModel.generate).toHaveBeenCalledTimes(2);
    });
  });

  describe('Middleware Support', () => {
    test('should support adding middleware', () => {
      const middleware = jest.fn((req, res, next) => next());
      
      pipeline.addMiddleware(middleware);
      
      expect(pipeline.middlewares).toContain(middleware);
    });

    test('should execute middleware in order', async () => {
      const executionOrder = [];
      
      const middleware1 = jest.fn((req, res, next) => {
        executionOrder.push('middleware1');
        next();
      });
      
      const middleware2 = jest.fn((req, res, next) => {
        executionOrder.push('middleware2');
        next();
      });
      
      pipeline.addMiddleware(middleware1);
      pipeline.addMiddleware(middleware2);
      
      const mockModel = {
        id: 'test-model',
        generate: jest.fn().mockResolvedValue({ text: 'Response' }),
        loaded: true
      };
      
      mockRouter.select.mockResolvedValue(mockModel);
      
      await pipeline.process({ prompt: 'Test' });
      
      expect(executionOrder).toEqual(['middleware1', 'middleware2']);
    });

    test('should allow middleware to modify request', async () => {
      const modifyingMiddleware = (req, res, next) => {
        req.prompt = req.prompt + ' (modified)';
        next();
      };
      
      pipeline.addMiddleware(modifyingMiddleware);
      
      const mockModel = {
        id: 'test-model',
        generate: jest.fn().mockResolvedValue({ text: 'Response' }),
        loaded: true
      };
      
      mockRouter.select.mockResolvedValue(mockModel);
      
      await pipeline.process({ prompt: 'Original' });
      
      expect(mockModel.generate).toHaveBeenCalledWith(
        'Original (modified)',
        expect.any(Object)
      );
    });

    test('should handle middleware errors', async () => {
      const errorMiddleware = (req, res, next) => {
        next(new Error('Middleware error'));
      };
      
      pipeline.addMiddleware(errorMiddleware);
      
      await expect(
        pipeline.process({ prompt: 'Test' })
      ).rejects.toThrow('Middleware error');
    });

    test('should support async middleware', async () => {
      const asyncMiddleware = async (req, res, next) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        req.processed = true;
        next();
      };
      
      pipeline.addMiddleware(asyncMiddleware);
      
      const mockModel = {
        id: 'test-model',
        generate: jest.fn().mockResolvedValue({ text: 'Response' }),
        loaded: true
      };
      
      mockRouter.select.mockResolvedValue(mockModel);
      
      const request = { prompt: 'Test' };
      await pipeline.process(request);
      
      expect(request.processed).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle model selection failures', async () => {
      mockRouter.select.mockRejectedValue(new Error('No models available'));
      
      await expect(
        pipeline.process({ prompt: 'Test' })
      ).rejects.toThrow('No models available');
    });

    test('should handle model generation failures', async () => {
      const failingModel = {
        id: 'failing-model',
        generate: jest.fn().mockRejectedValue(new Error('Generation failed')),
        loaded: true
      };
      
      mockRouter.select.mockResolvedValue(failingModel);
      
      await expect(
        pipeline.process({ prompt: 'Test' })
      ).rejects.toThrow('Generation failed');
    });

    test('should emit error events', async () => {
      const errorSpy = jest.fn();
      pipeline.on('error', errorSpy);
      
      mockRouter.select.mockRejectedValue(new Error('Test error'));
      
      try {
        await pipeline.process({ prompt: 'Test' });
      } catch (error) {
        // Expected
      }
      
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error'
        })
      );
    });

    test('should include error context in error events', async () => {
      const errorSpy = jest.fn();
      pipeline.on('error', errorSpy);
      
      const request = { 
        prompt: 'Test', 
        metadata: { userId: 'test-user' } 
      };
      
      mockRouter.select.mockRejectedValue(new Error('Context error'));
      
      try {
        await pipeline.process(request);
      } catch (error) {
        // Expected
      }
      
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Context error',
          context: expect.objectContaining({
            prompt: 'Test',
            metadata: { userId: 'test-user' }
          })
        })
      );
    });
  });

  describe('Performance and Metrics', () => {
    test('should track processing latency', async () => {
      const mockModel = {
        id: 'timed-model',
        generate: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return { text: 'Response', tokens: 10, latency: 50 };
        }),
        loaded: true
      };
      
      mockRouter.select.mockResolvedValue(mockModel);
      
      const result = await pipeline.process({ prompt: 'Test' });
      
      expect(result.pipelineLatency).toBeGreaterThan(0);
      expect(result.totalLatency).toBeGreaterThan(result.latency);
    });

    test('should provide processing statistics', () => {
      const stats = pipeline.getStats();
      
      expect(stats).toMatchObject({
        totalRequests: expect.any(Number),
        cacheHits: expect.any(Number),
        cacheMisses: expect.any(Number),
        averageLatency: expect.any(Number),
        errorCount: expect.any(Number)
      });
    });

    test('should reset statistics on demand', async () => {
      await pipeline.process({ prompt: 'Test' });
      
      pipeline.resetStats();
      const stats = pipeline.getStats();
      
      expect(stats.totalRequests).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
    });
  });
});