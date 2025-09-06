import { WASMEngine } from '../src/engines/WASMEngine.js';
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';

// Mock WebAssembly global if not available
const setupWebAssembly = () => {
  if (typeof WebAssembly === 'undefined') {
    global.WebAssembly = {
      Memory: class {
        constructor(descriptor) {
          this.initial = descriptor.initial || 1;
          this.maximum = descriptor.maximum || 256;
          this.buffer = new ArrayBuffer(this.initial * 65536);
        }
      },
      instantiate: jest.fn(async (bytes, imports) => {
        return {
          instance: {
            exports: {
              malloc: jest.fn((size) => 0),
              free: jest.fn(),
              inference: jest.fn((inputPtr, inputLen, outputPtr, outputSize, temp, topK) => {
                // Simulate inference returning token count
                return Math.min(outputSize / 4, 10);
              }),
              initModel: jest.fn()
            }
          }
        };
      })
    };
    global.Buffer = Buffer;
  }
};

describe('WASMEngine - Production Tests', () => {
  beforeAll(() => {
    setupWebAssembly();
  });

  describe('Environment Support', () => {
    test('detects WebAssembly support correctly', async () => {
      const engine = new WASMEngine();
      const supported = await engine.isSupported();
      expect(supported).toBe(true);
    });

    test('handles missing WebAssembly gracefully', async () => {
      const originalWebAssembly = global.WebAssembly;
      delete global.WebAssembly;
      
      const engine = new WASMEngine();
      const supported = await engine.isSupported();
      expect(supported).toBe(false);
      
      global.WebAssembly = originalWebAssembly;
    });
  });

  describe('Initialization', () => {
    let engine;

    beforeEach(() => {
      engine = new WASMEngine();
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    test('initializes with default configuration', async () => {
      await engine.initialize();
      
      expect(engine.initialized).toBe(true);
      expect(engine.wasmModule).toBeDefined();
      expect(engine.memory).toBeDefined();
      expect(engine.memory.buffer).toBeInstanceOf(ArrayBuffer);
    });

    test('initializes with custom memory configuration', async () => {
      await engine.initialize({
        initialMemory: 2,
        maxMemory: 512
      });
      
      expect(engine.initialized).toBe(true);
      expect(engine.memory.initial).toBe(2);
      expect(engine.memory.maximum).toBe(512);
    });

    test('prevents double initialization', async () => {
      await engine.initialize();
      const firstModule = engine.wasmModule;
      
      await engine.initialize();
      expect(engine.wasmModule).toBe(firstModule);
    });

    test('loads base WASM module correctly', async () => {
      await engine.initialize();
      
      expect(WebAssembly.instantiate).toHaveBeenCalled();
      expect(engine.wasmModule.exports).toBeDefined();
      expect(engine.wasmModule.exports.malloc).toBeDefined();
      expect(engine.wasmModule.exports.free).toBeDefined();
      expect(engine.wasmModule.exports.inference).toBeDefined();
    });
  });

  describe('Model Loading', () => {
    let engine;

    beforeEach(async () => {
      engine = new WASMEngine();
      await engine.initialize();
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    test('loads model with weights', async () => {
      const model = {
        name: 'test-model',
        size: 1024,
        weights: new Float32Array(256),
        outputSize: 128
      };
      
      const weightsPtr = await engine.loadModel(model);
      
      expect(weightsPtr).toBeDefined();
      expect(engine.wasmModule.exports.malloc).toHaveBeenCalledWith(1024);
    });

    test('initializes model in WASM if initModel exists', async () => {
      const model = {
        name: 'init-model',
        size: 512,
        weights: new Float32Array(128),
        outputSize: 64
      };
      
      await engine.loadModel(model);
      
      expect(engine.wasmModule.exports.initModel).toHaveBeenCalled();
    });

    test('handles models without initModel export', async () => {
      // Remove initModel export
      delete engine.wasmModule.exports.initModel;
      
      const model = {
        name: 'no-init-model',
        size: 256,
        weights: new Float32Array(64),
        outputSize: 32
      };
      
      // Should not throw
      const weightsPtr = await engine.loadModel(model);
      expect(weightsPtr).toBeDefined();
    });
  });

  describe('Inference Execution', () => {
    let engine;
    const testModel = {
      name: 'inference-model',
      size: 512,
      weights: new Float32Array(128),
      outputSize: 256
    };

    beforeEach(async () => {
      engine = new WASMEngine();
      await engine.initialize();
      await engine.loadModel(testModel);
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    test('executes basic inference', async () => {
      const input = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      const result = await engine.execute(testModel, input);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    test('respects temperature option', async () => {
      const input = new Float32Array([0.5]);
      
      const result1 = await engine.execute(testModel, input, { temperature: 0.1 });
      const result2 = await engine.execute(testModel, input, { temperature: 0.9 });
      
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      
      // Verify inference was called with different temperatures
      const calls = engine.wasmModule.exports.inference.mock.calls;
      const temp1 = calls[calls.length - 2][4];
      const temp2 = calls[calls.length - 1][4];
      
      expect(temp1).toBeCloseTo(0.1);
      expect(temp2).toBeCloseTo(0.9);
    });

    test('respects topK option', async () => {
      const input = new Float32Array([0.5]);
      
      await engine.execute(testModel, input, { topK: 10 });
      await engine.execute(testModel, input, { topK: 50 });
      
      const calls = engine.wasmModule.exports.inference.mock.calls;
      const topK1 = calls[calls.length - 2][5];
      const topK2 = calls[calls.length - 1][5];
      
      expect(topK1).toBe(10);
      expect(topK2).toBe(50);
    });

    test('handles empty input', async () => {
      const input = new Float32Array([]);
      const result = await engine.execute(testModel, input);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('handles large input', async () => {
      const input = new Float32Array(10000);
      const result = await engine.execute(testModel, input);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('auto-initializes if not initialized', async () => {
      const uninitializedEngine = new WASMEngine();
      const input = new Float32Array([1, 2, 3]);
      
      const result = await uninitializedEngine.execute(testModel, input);
      
      expect(uninitializedEngine.initialized).toBe(true);
      expect(result).toBeDefined();
      
      await uninitializedEngine.cleanup();
    });
  });

  describe('Token Streaming', () => {
    let engine;
    const streamModel = {
      name: 'stream-model',
      size: 256,
      weights: new Float32Array(64),
      outputSize: 128
    };

    beforeEach(async () => {
      engine = new WASMEngine();
      await engine.initialize();
      await engine.loadModel(streamModel);
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    test('streams tokens with default settings', async () => {
      const input = new Float32Array([0.5]);
      const tokens = [];
      
      for await (const token of engine.stream(streamModel, input)) {
        tokens.push(token);
      }
      
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.length).toBeLessThanOrEqual(100); // Default maxTokens
    });

    test('respects maxTokens option', async () => {
      const input = new Float32Array([0.5]);
      const tokens = [];
      
      for await (const token of engine.stream(streamModel, input, { maxTokens: 5 })) {
        tokens.push(token);
      }
      
      expect(tokens.length).toBe(5);
    });

    test('updates input with generated tokens', async () => {
      const input = new Float32Array([0.5]);
      let iterationCount = 0;
      
      // Mock to track input updates
      const originalExecute = engine.execute.bind(engine);
      let lastInput = input;
      
      engine.execute = jest.fn(async (model, currentInput, options) => {
        lastInput = currentInput;
        return originalExecute(model, currentInput, options);
      });
      
      for await (const token of engine.stream(streamModel, input, { maxTokens: 3 })) {
        iterationCount++;
        if (iterationCount > 1) {
          // Input should grow with each iteration
          expect(lastInput.length).toBeGreaterThan(input.length);
        }
      }
      
      expect(iterationCount).toBe(3);
    });

    test('handles streaming errors gracefully', async () => {
      // Make execute throw an error
      engine.execute = jest.fn().mockRejectedValue(new Error('Streaming error'));
      
      const input = new Float32Array([0.5]);
      const tokens = [];
      
      try {
        for await (const token of engine.stream(streamModel, input)) {
          tokens.push(token);
        }
      } catch (error) {
        expect(error.message).toBe('Streaming error');
      }
    });

    test('streams with custom options', async () => {
      const input = new Float32Array([0.5]);
      const tokens = [];
      
      for await (const token of engine.stream(streamModel, input, {
        maxTokens: 10,
        temperature: 0.5,
        topK: 20
      })) {
        tokens.push(token);
      }
      
      expect(tokens.length).toBe(10);
      
      // Verify options were passed through
      const calls = engine.wasmModule.exports.inference.mock.calls;
      expect(calls.some(call => call[4] === 0.5)).toBe(true); // temperature
      expect(calls.some(call => call[5] === 20)).toBe(true); // topK
    });
  });

  describe('Memory Management', () => {
    let engine;

    beforeEach(async () => {
      engine = new WASMEngine();
      await engine.initialize();
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    test('allocates memory correctly', () => {
      const size = 1024;
      const ptr = engine.allocate(size);
      
      expect(engine.wasmModule.exports.malloc).toHaveBeenCalledWith(size);
      expect(ptr).toBeDefined();
    });

    test('frees memory correctly', () => {
      const ptr = engine.allocate(1024);
      engine.free(ptr);
      
      expect(engine.wasmModule.exports.free).toHaveBeenCalledWith(ptr);
    });

    test('handles missing malloc gracefully', () => {
      delete engine.wasmModule.exports.malloc;
      
      const ptr = engine.allocate(1024);
      expect(ptr).toBe(0); // Fallback value
    });

    test('handles missing free gracefully', () => {
      delete engine.wasmModule.exports.free;
      
      // Should not throw
      expect(() => engine.free(123)).not.toThrow();
    });

    test('reports memory usage', () => {
      const usage = engine.getMemoryUsage();
      
      expect(usage).toBeDefined();
      expect(usage.used).toBeDefined();
      expect(usage.total).toBeDefined();
      expect(usage.used).toBeGreaterThanOrEqual(0);
      expect(usage.total).toBeGreaterThan(0);
    });

    test('reports zero memory when not initialized', () => {
      const uninitializedEngine = new WASMEngine();
      const usage = uninitializedEngine.getMemoryUsage();
      
      expect(usage.used).toBe(0);
      expect(usage.total).toBe(0);
    });
  });

  describe('Capabilities', () => {
    test('reports correct capabilities', () => {
      const engine = new WASMEngine();
      
      expect(engine.capabilities).toBeDefined();
      expect(engine.capabilities.parallel).toBe(false);
      expect(engine.capabilities.gpu).toBe(false);
      expect(engine.capabilities.streaming).toBe(true);
      expect(engine.capabilities.quantization).toBe(true);
    });
  });

  describe('Cleanup', () => {
    test('cleans up resources properly', async () => {
      const engine = new WASMEngine();
      await engine.initialize();
      
      const model = {
        name: 'cleanup-model',
        size: 256,
        weights: new Float32Array(64),
        outputSize: 32
      };
      
      await engine.loadModel(model);
      
      expect(engine.wasmModule).toBeDefined();
      expect(engine.memory).toBeDefined();
      expect(engine.initialized).toBe(true);
      
      await engine.cleanup();
      
      expect(engine.wasmModule).toBeNull();
      expect(engine.memory).toBeNull();
      expect(engine.initialized).toBe(false);
    });

    test('handles multiple cleanup calls', async () => {
      const engine = new WASMEngine();
      await engine.initialize();
      
      await engine.cleanup();
      await engine.cleanup(); // Should not throw
      
      expect(engine.wasmModule).toBeNull();
      expect(engine.memory).toBeNull();
    });

    test('can reinitialize after cleanup', async () => {
      const engine = new WASMEngine();
      
      await engine.initialize();
      await engine.cleanup();
      await engine.initialize();
      
      expect(engine.initialized).toBe(true);
      expect(engine.wasmModule).toBeDefined();
      expect(engine.memory).toBeDefined();
      
      await engine.cleanup();
    });
  });

  describe('Error Handling', () => {
    let engine;

    beforeEach(() => {
      engine = new WASMEngine();
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    test('handles WebAssembly instantiation errors', async () => {
      WebAssembly.instantiate = jest.fn().mockRejectedValue(new Error('WASM load failed'));
      
      // Should log error but not throw
      await engine.initialize();
      
      // Engine might not be fully initialized but should handle gracefully
      expect(engine.initialized).toBeDefined();
    });

    test('handles inference errors gracefully', async () => {
      await engine.initialize();
      
      // Make inference throw
      engine.wasmModule.exports.inference = jest.fn().mockImplementation(() => {
        throw new Error('Inference failed');
      });
      
      const model = {
        name: 'error-model',
        size: 256,
        weights: new Float32Array(64),
        outputSize: 32
      };
      
      const input = new Float32Array([1, 2, 3]);
      
      await expect(engine.execute(model, input)).rejects.toThrow('Inference failed');
    });

    test('handles memory allocation failures', async () => {
      await engine.initialize();
      
      // Make malloc return null/undefined
      engine.wasmModule.exports.malloc = jest.fn().mockReturnValue(undefined);
      
      const model = {
        name: 'alloc-fail-model',
        size: 256,
        weights: new Float32Array(64),
        outputSize: 32
      };
      
      // Should handle allocation failure
      const ptr = await engine.loadModel(model);
      expect(ptr).toBeDefined(); // May be undefined or 0
    });
  });

  describe('Integration Tests', () => {
    let engine;

    beforeEach(async () => {
      engine = new WASMEngine();
      await engine.initialize();
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    test('complete inference pipeline', async () => {
      // Load model
      const model = {
        name: 'pipeline-model',
        size: 1024,
        weights: new Float32Array(256).fill(0.1),
        outputSize: 512
      };
      
      await engine.loadModel(model);
      
      // Run inference
      const input = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
      const result = await engine.execute(model, input, {
        temperature: 0.7,
        topK: 40
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      // Check memory usage
      const usage = engine.getMemoryUsage();
      expect(usage.used).toBeGreaterThan(0);
    });

    test('concurrent inference operations', async () => {
      const model = {
        name: 'concurrent-model',
        size: 512,
        weights: new Float32Array(128),
        outputSize: 256
      };
      
      await engine.loadModel(model);
      
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const input = new Float32Array([i / 10]);
        promises.push(engine.execute(model, input));
      }
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      });
    });

    test('mixed streaming and regular inference', async () => {
      const model = {
        name: 'mixed-model',
        size: 512,
        weights: new Float32Array(128),
        outputSize: 256
      };
      
      await engine.loadModel(model);
      
      // Regular inference
      const input1 = new Float32Array([0.1]);
      const result1 = await engine.execute(model, input1);
      expect(result1).toBeDefined();
      
      // Streaming
      const input2 = new Float32Array([0.2]);
      const tokens = [];
      for await (const token of engine.stream(model, input2, { maxTokens: 3 })) {
        tokens.push(token);
      }
      expect(tokens).toHaveLength(3);
      
      // Regular inference again
      const input3 = new Float32Array([0.3]);
      const result3 = await engine.execute(model, input3);
      expect(result3).toBeDefined();
    });
  });

  describe('Performance', () => {
    let engine;

    beforeEach(async () => {
      engine = new WASMEngine();
      await engine.initialize();
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    test('handles rapid successive calls efficiently', async () => {
      const model = {
        name: 'perf-model',
        size: 256,
        weights: new Float32Array(64),
        outputSize: 128
      };
      
      await engine.loadModel(model);
      
      const start = Date.now();
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        const input = new Float32Array([i / iterations]);
        await engine.execute(model, input);
      }
      
      const duration = Date.now() - start;
      const avgTime = duration / iterations;
      
      // Should be reasonably fast (< 10ms per inference in test env)
      expect(avgTime).toBeLessThan(10);
    });

    test('memory usage remains stable', async () => {
      const model = {
        name: 'memory-model',
        size: 1024,
        weights: new Float32Array(256),
        outputSize: 512
      };
      
      await engine.loadModel(model);
      
      const initialUsage = engine.getMemoryUsage();
      
      // Run many inferences
      for (let i = 0; i < 50; i++) {
        const input = new Float32Array(100);
        await engine.execute(model, input);
      }
      
      const finalUsage = engine.getMemoryUsage();
      
      // Memory should not grow significantly (allowing some overhead)
      const growth = finalUsage.used - initialUsage.used;
      expect(growth).toBeLessThan(1024 * 1024); // Less than 1MB growth
    });
  });
});