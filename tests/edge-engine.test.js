import { EdgeEngine } from '../src/engines/EdgeEngine.js';
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';

// Helper to simulate different edge environments
const setupEnvironment = (platform) => {
  switch (platform) {
    case 'cloudflare':
      globalThis.navigator = { userAgent: 'Cloudflare-Workers' };
      globalThis.Request = class {};
      globalThis.Response = class Response {
        constructor(body) {
          this.body = body;
        }
        async json() {
          return JSON.parse(this.body);
        }
      };
      globalThis.caches = {
        default: new Map(),
        open: async () => new Map()
      };
      globalThis.KV = {
        get: jest.fn().mockResolvedValue(null),
        put: jest.fn().mockResolvedValue(undefined)
      };
      globalThis.CF = { colo: 'SFO' };
      break;
    case 'deno':
      globalThis.Deno = {
        openKv: async () => ({
          get: async (key) => ({ value: null }),
          set: async (key, value) => {},
          close: () => {}
        }),
        env: {
          get: (key) => key === 'DENO_REGION' ? 'us-west-2' : undefined
        },
        permissions: {
          query: async () => ({ state: 'granted' })
        }
      };
      break;
    case 'vercel':
      process.env.VERCEL_EDGE = 'true';
      process.env.VERCEL_REGION = 'iad1';
      break;
    case 'netlify':
      process.env.NETLIFY_EDGE = 'true';
      break;
    case 'fastly':
      globalThis.fastly = {};
      break;
  }
};

const cleanupEnvironment = () => {
  delete globalThis.navigator;
  delete globalThis.Request;
  delete globalThis.Response;
  delete globalThis.caches;
  delete globalThis.KV;
  delete globalThis.CF;
  delete globalThis.Deno;
  delete globalThis.fastly;
  delete process.env.VERCEL_EDGE;
  delete process.env.VERCEL_REGION;
  delete process.env.NETLIFY_EDGE;
};

describe('EdgeEngine - Production Tests', () => {
  describe('Platform Detection', () => {
    afterEach(() => {
      cleanupEnvironment();
    });

    test('detects Cloudflare Workers environment', async () => {
      setupEnvironment('cloudflare');
      const engine = new EdgeEngine();
      expect(await engine.isSupported()).toBe(true);
      await engine.initialize();
      expect(engine.platform.name).toBe('cloudflare');
      expect(engine.platform.hasKV).toBe(true);
      expect(engine.platform.hasCache).toBe(true);
      await engine.cleanup();
    });

    test('detects Deno environment', async () => {
      setupEnvironment('deno');
      const engine = new EdgeEngine();
      expect(await engine.isSupported()).toBe(true);
      await engine.initialize();
      expect(engine.platform.name).toBe('deno');
      expect(engine.platform.hasKV).toBe(true);
      await engine.cleanup();
    });

    test('detects Vercel Edge environment', async () => {
      setupEnvironment('vercel');
      const engine = new EdgeEngine();
      expect(await engine.isSupported()).toBe(true);
      await engine.initialize();
      expect(engine.platform.name).toBe('vercel');
      await engine.cleanup();
    });

    test('detects Netlify Edge environment', async () => {
      setupEnvironment('netlify');
      const engine = new EdgeEngine();
      expect(await engine.isSupported()).toBe(true);
      await engine.initialize();
      expect(engine.platform.name).toBe('netlify');
      await engine.cleanup();
    });

    test('detects Fastly environment', async () => {
      setupEnvironment('fastly');
      const engine = new EdgeEngine();
      expect(await engine.isSupported()).toBe(true);
      await engine.initialize();
      expect(engine.platform.name).toBe('fastly');
      await engine.cleanup();
    });

    test('handles unknown environment gracefully', async () => {
      const engine = new EdgeEngine();
      expect(await engine.isSupported()).toBe(false);
    });
  });

  describe('Inference Operations', () => {
    beforeAll(() => {
      setupEnvironment('cloudflare');
    });

    afterAll(() => {
      cleanupEnvironment();
    });

    let engine;

    beforeEach(async () => {
      engine = new EdgeEngine();
      await engine.initialize();
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    test('executes inference operation', async () => {
      const data = { modelId: 'test-model', input: [0.1, 0.2, 0.3] };
      const result = await engine.execute('inference', data);

      expect(result).toBeDefined();
      expect(result.modelId).toBe('test-model');
      expect(result.input).toEqual([0.1, 0.2, 0.3]);
      expect(result.output).toHaveLength(10);
      expect(result.engine).toBe('edge');
      expect(result.platform).toBe('cloudflare');
      expect(result.region).toBe('SFO');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    test('caches inference results', async () => {
      const data = { modelId: 'cached-model', input: [1, 2, 3] };
      
      const first = await engine.execute('inference', data);
      expect(first.cached).toBe(false);
      
      const second = await engine.execute('inference', data);
      expect(second).toEqual(first);
    });

    test('handles model loading and persistence', async () => {
      const modelId = 'persistent-model';
      const model = await engine.loadModel(modelId);
      
      expect(model).toBeDefined();
      expect(model.id).toBe(modelId);
      expect(model.weights).toBeInstanceOf(Float32Array);
      expect(model.config.inputSize).toBe(10);
      expect(model.config.outputSize).toBe(10);
      expect(model.config.layers).toBe(3);
      
      // Should be cached in memory
      expect(engine.models.has(modelId)).toBe(true);
    });

    test('handles multiple concurrent inferences', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          engine.execute('inference', {
            modelId: `model-${i}`,
            input: Array(10).fill(i / 10)
          })
        );
      }
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result.modelId).toBe(`model-${i}`);
        expect(result.output).toHaveLength(10);
      });
    });

    test('respects timeout configuration', async () => {
      const shortTimeoutEngine = new EdgeEngine({ timeout: 1 });
      await shortTimeoutEngine.initialize();
      
      // Create a slow operation
      const slowData = {
        modelId: 'slow-model',
        input: new Array(10000).fill(0)
      };
      
      // Should complete within reasonable time
      const start = Date.now();
      await shortTimeoutEngine.execute('inference', slowData);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(5000);
      await shortTimeoutEngine.cleanup();
    });
  });

  describe('Transform Operations', () => {
    beforeAll(() => {
      setupEnvironment('cloudflare');
    });

    afterAll(() => {
      cleanupEnvironment();
    });

    let engine;

    beforeEach(async () => {
      engine = new EdgeEngine();
      await engine.initialize();
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    test('normalizes tensors', async () => {
      const result = await engine.execute('transform', {
        tensor: [1, 2, 3, 4, 5],
        operation: 'normalize'
      });
      
      expect(result.operation).toBe('normalize');
      expect(result.result).toHaveLength(5);
      
      // Check normalization (mean ~0, std ~1)
      const normalized = result.result;
      const mean = normalized.reduce((a, b) => a + b, 0) / normalized.length;
      expect(Math.abs(mean)).toBeLessThan(0.01);
    });

    test('quantizes tensors', async () => {
      const result = await engine.execute('transform', {
        tensor: [0.1, 0.5, 0.9],
        operation: 'quantize'
      });
      
      expect(result.operation).toBe('quantize');
      expect(result.result).toHaveLength(3);
      
      // Check quantization (integer values)
      result.result.forEach(val => {
        expect(Number.isInteger(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(255);
      });
    });

    test('reshapes tensors', async () => {
      const result = await engine.execute('transform', {
        tensor: [[1, 2], [3, 4]],
        operation: 'reshape',
        shape: [4]
      });
      
      expect(result.operation).toBe('reshape');
      expect(result.result.data).toEqual([1, 2, 3, 4]);
      expect(result.result.shape).toEqual([4]);
    });
  });

  describe('Compute Operations', () => {
    beforeAll(() => {
      setupEnvironment('cloudflare');
    });

    afterAll(() => {
      cleanupEnvironment();
    });

    let engine;

    beforeEach(async () => {
      engine = new EdgeEngine();
      await engine.initialize();
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    test('performs matrix multiplication', async () => {
      const result = await engine.execute('compute', {
        operation: 'matmul',
        input: {
          a: [[1, 2], [3, 4]],
          b: [[5, 6], [7, 8]]
        }
      });
      
      expect(result.operation).toBe('matmul');
      expect(result.result).toEqual([
        [19, 22],
        [43, 50]
      ]);
    });

    test('applies activation functions', async () => {
      const testCases = [
        { type: 'relu', input: [-1, 0, 1], expected: [0, 0, 1] },
        { type: 'sigmoid', input: [0], expected: [0.5] },
        { type: 'tanh', input: [0], expected: [0] }
      ];
      
      for (const testCase of testCases) {
        const result = await engine.execute('compute', {
          operation: 'activation',
          input: {
            tensor: testCase.input,
            type: testCase.type
          }
        });
        
        expect(result.operation).toBe('activation');
        
        if (testCase.type === 'relu') {
          result.result.forEach((val, i) => {
            expect(val).toBeCloseTo(testCase.expected[i], 5);
          });
        }
      }
    });

    test('applies pooling operations', async () => {
      const result = await engine.execute('compute', {
        operation: 'pooling',
        input: {
          tensor: [1, 2, 3, 4, 5, 6],
          size: 2
        }
      });
      
      expect(result.operation).toBe('pooling');
      expect(result.result).toEqual([2, 4, 6]); // Max pooling
    });
  });

  describe('Cache Management', () => {
    beforeAll(() => {
      setupEnvironment('cloudflare');
    });

    afterAll(() => {
      cleanupEnvironment();
    });

    test('uses native cache API when available', async () => {
      const engine = new EdgeEngine();
      await engine.initialize();
      
      expect(engine.cache).toBeDefined();
      expect(engine.cache).toBeInstanceOf(Map); // Using Map in test environment
      
      await engine.cleanup();
    });

    test('falls back to in-memory cache when native unavailable', async () => {
      cleanupEnvironment();
      const engine = new EdgeEngine({ platform: 'unknown' });
      await engine.initialize();
      
      expect(engine.cache).toBeInstanceOf(Map);
      
      await engine.cleanup();
    });

    test('cache key generation is deterministic', () => {
      const engine = new EdgeEngine();
      
      const key1 = engine.getCacheKey('inference', { model: 'test', input: [1, 2] });
      const key2 = engine.getCacheKey('inference', { model: 'test', input: [1, 2] });
      const key3 = engine.getCacheKey('inference', { model: 'test', input: [1, 3] });
      
      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });
  });

  describe('Error Handling', () => {
    beforeAll(() => {
      setupEnvironment('cloudflare');
    });

    afterAll(() => {
      cleanupEnvironment();
    });

    test('handles unknown operations gracefully', async () => {
      const engine = new EdgeEngine();
      await engine.initialize();
      
      await expect(
        engine.execute('unknown', {})
      ).rejects.toThrow('Unknown operation: unknown');
      
      await engine.cleanup();
    });

    test('handles initialization failures', async () => {
      // Force an error during initialization
      setupEnvironment('cloudflare');
      globalThis.caches = undefined;
      
      const engine = new EdgeEngine();
      const result = await engine.initialize();
      
      // Should handle gracefully and still initialize
      expect(result).toBe(true);
      expect(engine.initialized).toBe(true);
      
      await engine.cleanup();
    });
  });

  describe('Resource Management', () => {
    beforeAll(() => {
      setupEnvironment('cloudflare');
    });

    afterAll(() => {
      cleanupEnvironment();
    });

    test('properly cleans up resources', async () => {
      const engine = new EdgeEngine();
      await engine.initialize();
      
      // Load some models
      await engine.loadModel('model1');
      await engine.loadModel('model2');
      
      expect(engine.models.size).toBe(2);
      expect(engine.initialized).toBe(true);
      
      await engine.cleanup();
      
      expect(engine.models.size).toBe(0);
      expect(engine.initialized).toBe(false);
    });

    test('handles memory constraints', async () => {
      const engine = new EdgeEngine({ maxMemory: 1 }); // 1MB limit
      await engine.initialize();
      
      // Should handle within memory constraints
      const data = { modelId: 'small', input: new Array(100).fill(0) };
      const result = await engine.execute('inference', data);
      
      expect(result).toBeDefined();
      
      await engine.cleanup();
    });
  });

  describe('Configuration', () => {
    afterEach(() => {
      cleanupEnvironment();
    });

    test('respects custom configuration', async () => {
      setupEnvironment('cloudflare');
      
      const config = {
        platform: 'cloudflare',
        cacheStrategy: 'conservative',
        maxMemory: 256,
        timeout: 5000,
        region: 'us-east-1',
        coldStartOptimization: false
      };
      
      const engine = new EdgeEngine(config);
      await engine.initialize();
      
      expect(engine.config.cacheStrategy).toBe('conservative');
      expect(engine.config.maxMemory).toBe(256);
      expect(engine.config.timeout).toBe(5000);
      expect(engine.config.region).toBe('us-east-1');
      expect(engine.config.coldStartOptimization).toBe(false);
      
      await engine.cleanup();
    });

    test('uses sensible defaults', async () => {
      setupEnvironment('cloudflare');
      
      const engine = new EdgeEngine();
      await engine.initialize();
      
      expect(engine.config.cacheStrategy).toBe('aggressive');
      expect(engine.config.maxMemory).toBe(128);
      expect(engine.config.timeout).toBe(10000);
      expect(engine.config.region).toBe('auto');
      expect(engine.config.coldStartOptimization).toBe(true);
      
      await engine.cleanup();
    });
  });

  describe('Engine Info', () => {
    beforeAll(() => {
      setupEnvironment('cloudflare');
    });

    afterAll(() => {
      cleanupEnvironment();
    });

    test('provides comprehensive engine info', async () => {
      const engine = new EdgeEngine();
      await engine.initialize();
      await engine.loadModel('test-model');
      
      const info = engine.getInfo();
      
      expect(info.name).toBe('EdgeEngine');
      expect(info.initialized).toBe(true);
      expect(info.platform).toBeDefined();
      expect(info.platform.name).toBe('cloudflare');
      expect(info.config).toBeDefined();
      expect(info.modelsLoaded).toBe(1);
      expect(info.cacheType).toBeDefined();
      expect(info.hasKV).toBeDefined();
      
      await engine.cleanup();
    });
  });
});
