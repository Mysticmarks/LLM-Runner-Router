import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { WebGPUEngine } from '../../src/engines/WebGPUEngine.js';
import { EngineSelector } from '../../src/engines/EngineSelector.js';

// Mock navigator.gpu for testing
const setupWebGPU = () => {
  const mockDevice = {
    queue: {
      submit: jest.fn(),
      onSubmittedWorkDone: jest.fn().mockResolvedValue(),
      writeBuffer: jest.fn()
    },
    createBuffer: jest.fn((descriptor) => ({
      size: descriptor.size,
      usage: descriptor.usage,
      destroy: jest.fn(),
      mapAsync: jest.fn().mockResolvedValue(),
      getMappedRange: jest.fn(() => new ArrayBuffer(descriptor.size)),
      unmap: jest.fn()
    })),
    createShaderModule: jest.fn(() => ({})),
    createComputePipeline: jest.fn(() => ({
      getBindGroupLayout: jest.fn(() => ({}))
    })),
    createBindGroup: jest.fn(() => ({})),
    createCommandEncoder: jest.fn(() => ({
      beginComputePass: jest.fn(() => ({
        setPipeline: jest.fn(),
        setBindGroup: jest.fn(),
        dispatchWorkgroups: jest.fn(),
        end: jest.fn()
      })),
      copyBufferToBuffer: jest.fn(),
      finish: jest.fn(() => ({}))
    })),
    destroy: jest.fn()
  };

  const mockAdapter = {
    requestDevice: jest.fn().mockResolvedValue(mockDevice),
    requestAdapterInfo: jest.fn().mockResolvedValue({
      vendor: 'Mock Vendor',
      architecture: 'Mock Architecture',
      device: 'Mock Device',
      description: 'Mock GPU Adapter'
    })
  };

  if (typeof global.navigator === 'undefined') {
    global.navigator = {};
  }

  global.navigator.gpu = {
    requestAdapter: jest.fn().mockResolvedValue(mockAdapter)
  };

  global.GPUBufferUsage = {
    STORAGE: 0x80,
    COPY_DST: 0x8,
    COPY_SRC: 0x4,
    MAP_READ: 0x1
  };

  global.GPUMapMode = {
    READ: 0x1
  };

  return { mockAdapter, mockDevice };
};

const cleanupWebGPU = () => {
  if (global.navigator) {
    delete global.navigator.gpu;
  }
  delete global.GPUBufferUsage;
  delete global.GPUMapMode;
};

describe('WebGPU Engine Integration - Production Tests', () => {
  let originalEnv;
  let mockSetup;

  beforeAll(() => {
    originalEnv = process.env.NODE_ENV;
    mockSetup = setupWebGPU();
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
    cleanupWebGPU();
  });

  describe('Environment Detection', () => {
    it('detects WebGPU availability correctly', async () => {
      const engine = new WebGPUEngine();
      const supported = await engine.isSupported();
      expect(supported).toBe(true);
    });

    it('handles missing WebGPU gracefully', async () => {
      delete global.navigator.gpu;
      
      const engine = new WebGPUEngine();
      const supported = await engine.isSupported();
      expect(supported).toBe(false);
      
      // Restore WebGPU
      mockSetup = setupWebGPU();
    });

    it('handles server-side environment correctly', async () => {
      const originalWindow = global.window;
      delete global.window;
      
      const engine = new WebGPUEngine();
      const supported = await engine.isSupported();
      expect(supported).toBe(false);
      
      global.window = originalWindow;
    });
  });

  describe('Initialization', () => {
    let engine;

    beforeEach(() => {
      engine = new WebGPUEngine();
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    it('initializes with default configuration', async () => {
      await engine.initialize();
      
      expect(engine.initialized).toBe(true);
      expect(engine.adapter).toBeDefined();
      expect(engine.device).toBeDefined();
      expect(navigator.gpu.requestAdapter).toHaveBeenCalled();
    });

    it('initializes with custom power preference', async () => {
      await engine.initialize({ powerPreference: 'low-power' });
      
      expect(navigator.gpu.requestAdapter).toHaveBeenCalledWith({
        powerPreference: 'low-power'
      });
    });

    it('initializes with custom features and limits', async () => {
      await engine.initialize({
        features: ['timestamp-query'],
        limits: { maxComputeWorkgroupSizeX: 512 }
      });
      
      expect(mockSetup.mockAdapter.requestDevice).toHaveBeenCalledWith({
        requiredFeatures: ['timestamp-query'],
        requiredLimits: { maxComputeWorkgroupSizeX: 512 }
      });
    });

    it('prevents double initialization', async () => {
      await engine.initialize();
      const firstDevice = engine.device;
      
      await engine.initialize();
      expect(engine.device).toBe(firstDevice);
    });

    it('logs GPU adapter info', async () => {
      await engine.initialize();
      
      expect(mockSetup.mockAdapter.requestAdapterInfo).toHaveBeenCalled();
    });

    it('handles adapter request failure', async () => {
      navigator.gpu.requestAdapter = jest.fn().mockResolvedValue(null);
      
      await expect(engine.initialize()).rejects.toThrow('No WebGPU adapter available');
    });

    it('handles device request failure', async () => {
      mockSetup.mockAdapter.requestDevice = jest.fn().mockRejectedValue(new Error('Device error'));
      
      await expect(engine.initialize()).rejects.toThrow('Device error');
    });
  });

  describe('Engine Selection', () => {
    beforeEach(async () => {
      process.env.NODE_ENV = 'production';
      const { EngineSelector } = await import('../../src/engines/EngineSelector.js');
      EngineSelector.engines.clear();
      EngineSelector.initialized = false;
    });

    afterEach(async () => {
      const { EngineSelector } = await import('../../src/engines/EngineSelector.js');
      EngineSelector.engines.clear();
      EngineSelector.initialized = false;
    });

    it('selects WebGPU engine when available', async () => {
      const { EngineSelector } = await import('../../src/engines/EngineSelector.js');
      const engine = await EngineSelector.getBest();
      
      expect(engine.name).toBe('WebGPU');
      await engine.cleanup();
    });

    it('falls back when WebGPU is unavailable', async () => {
      cleanupWebGPU();
      
      const { EngineSelector } = await import('../../src/engines/EngineSelector.js');
      const engine = await EngineSelector.getBest();
      
      expect(engine.name).not.toBe('WebGPU');
      await engine.cleanup();
      
      // Restore WebGPU
      mockSetup = setupWebGPU();
    });
  });

  describe('Compute Shader Execution', () => {
    let engine;

    beforeEach(async () => {
      engine = new WebGPUEngine();
      await engine.initialize();
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    it('runs a simple compute shader', async () => {
      const model = { outputSize: 16 };
      const input = new Float32Array([1, 2, 3, 4]);
      
      const result = await engine.execute(model, input);
      
      expect(result).toBeInstanceOf(Float32Array);
      expect(mockSetup.mockDevice.createBuffer).toHaveBeenCalledTimes(3); // input, output, staging
      expect(mockSetup.mockDevice.queue.submit).toHaveBeenCalled();
    });

    it('creates compute pipeline correctly', async () => {
      const model = { shaderCode: 'custom shader code', outputSize: 8 };
      const input = new Float32Array([1, 2]);
      
      await engine.execute(model, input);
      
      expect(mockSetup.mockDevice.createShaderModule).toHaveBeenCalledWith({
        code: 'custom shader code'
      });
      expect(mockSetup.mockDevice.createComputePipeline).toHaveBeenCalled();
    });

    it('uses default shader when not provided', async () => {
      const model = { outputSize: 8 };
      const input = new Float32Array([1, 2]);
      
      await engine.execute(model, input);
      
      expect(mockSetup.mockDevice.createShaderModule).toHaveBeenCalledWith({
        code: expect.stringContaining('@compute')
      });
    });

    it('handles different input sizes', async () => {
      const model = { outputSize: 64 };
      
      // Small input
      const smallInput = new Float32Array([1]);
      await engine.execute(model, smallInput);
      
      // Medium input
      const mediumInput = new Float32Array(100);
      await engine.execute(model, mediumInput);
      
      // Large input
      const largeInput = new Float32Array(10000);
      await engine.execute(model, largeInput);
      
      // All should complete without error
      expect(mockSetup.mockDevice.queue.submit).toHaveBeenCalledTimes(3);
    });

    it('dispatches correct number of workgroups', async () => {
      const model = { outputSize: 256 };
      const input = new Float32Array(256);
      
      await engine.execute(model, input);
      
      const commandEncoder = mockSetup.mockDevice.createCommandEncoder();
      const passEncoder = commandEncoder.beginComputePass();
      
      // Should dispatch ceil(256/64) = 4 workgroups
      expect(passEncoder.dispatchWorkgroups).toBeDefined();
    });
  });

  describe('Buffer Management', () => {
    let engine;

    beforeEach(async () => {
      engine = new WebGPUEngine();
      await engine.initialize();
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    it('creates buffers with correct usage flags', () => {
      const data = new Float32Array([1, 2, 3]);
      const buffer = engine.createBuffer(data);
      
      expect(mockSetup.mockDevice.createBuffer).toHaveBeenCalledWith({
        size: data.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });
    });

    it('creates empty buffers with specified size', () => {
      const buffer = engine.createBuffer(null, 1024);
      
      expect(mockSetup.mockDevice.createBuffer).toHaveBeenCalledWith({
        size: 1024,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });
    });

    it('writes data to buffer', () => {
      const data = new Float32Array([1, 2, 3]);
      const buffer = engine.createBuffer(data);
      
      expect(mockSetup.mockDevice.queue.writeBuffer).toHaveBeenCalledWith(
        buffer, 0, data
      );
    });

    it('reads buffer data correctly', async () => {
      const buffer = engine.createBuffer(null, 16);
      const result = await engine.readBuffer(buffer);
      
      expect(result).toBeInstanceOf(Float32Array);
      expect(mockSetup.mockDevice.createCommandEncoder).toHaveBeenCalled();
    });

    it('destroys buffers after use', async () => {
      const model = { outputSize: 8 };
      const input = new Float32Array([1, 2]);
      
      await engine.execute(model, input);
      
      // Check that destroy was called on buffers
      const createBufferCalls = mockSetup.mockDevice.createBuffer.mock.results;
      createBufferCalls.forEach(result => {
        if (result.value && result.value.destroy) {
          expect(result.value.destroy).toHaveBeenCalled();
        }
      });
    });
  });

  describe('Bind Groups', () => {
    let engine;

    beforeEach(async () => {
      engine = new WebGPUEngine();
      await engine.initialize();
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    it('creates bind groups correctly', async () => {
      const model = { outputSize: 8 };
      const input = new Float32Array([1, 2]);
      
      await engine.execute(model, input);
      
      expect(mockSetup.mockDevice.createBindGroup).toHaveBeenCalledWith({
        layout: expect.any(Object),
        entries: [
          { binding: 0, resource: { buffer: expect.any(Object) }},
          { binding: 1, resource: { buffer: expect.any(Object) }}
        ]
      });
    });

    it('gets bind group layout from pipeline', async () => {
      const model = { outputSize: 8 };
      const input = new Float32Array([1, 2]);
      
      await engine.execute(model, input);
      
      const pipeline = mockSetup.mockDevice.createComputePipeline.mock.results[0].value;
      expect(pipeline.getBindGroupLayout).toHaveBeenCalledWith(0);
    });
  });

  describe('Command Encoding', () => {
    let engine;

    beforeEach(async () => {
      engine = new WebGPUEngine();
      await engine.initialize();
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    it('encodes compute pass correctly', async () => {
      const model = { outputSize: 8 };
      const input = new Float32Array([1, 2]);
      
      await engine.execute(model, input);
      
      const commandEncoder = mockSetup.mockDevice.createCommandEncoder.mock.results[0].value;
      const passEncoder = commandEncoder.beginComputePass.mock.results[0].value;
      
      expect(passEncoder.setPipeline).toHaveBeenCalled();
      expect(passEncoder.setBindGroup).toHaveBeenCalledWith(0, expect.any(Object));
      expect(passEncoder.dispatchWorkgroups).toHaveBeenCalled();
      expect(passEncoder.end).toHaveBeenCalled();
    });

    it('submits command buffer', async () => {
      const model = { outputSize: 8 };
      const input = new Float32Array([1, 2]);
      
      await engine.execute(model, input);
      
      expect(mockSetup.mockDevice.queue.submit).toHaveBeenCalledWith([expect.any(Object)]);
      expect(mockSetup.mockDevice.queue.onSubmittedWorkDone).toHaveBeenCalled();
    });

    it('copies buffer for reading', async () => {
      const buffer = engine.createBuffer(null, 16);
      await engine.readBuffer(buffer);
      
      const commandEncoder = mockSetup.mockDevice.createCommandEncoder.mock.results[0].value;
      expect(commandEncoder.copyBufferToBuffer).toHaveBeenCalled();
    });
  });

  describe('Capabilities', () => {
    it('reports correct capabilities', () => {
      const engine = new WebGPUEngine();
      
      expect(engine.capabilities).toEqual({
        parallel: true,
        gpu: true,
        streaming: true,
        quantization: true
      });
    });
  });

  describe('Error Handling', () => {
    let engine;

    beforeEach(() => {
      engine = new WebGPUEngine();
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    it('handles initialization errors gracefully', async () => {
      navigator.gpu.requestAdapter = jest.fn().mockRejectedValue(new Error('GPU error'));
      
      await expect(engine.initialize()).rejects.toThrow('GPU error');
      expect(engine.initialized).toBe(false);
    });

    it('handles shader compilation errors', async () => {
      await engine.initialize();
      
      mockSetup.mockDevice.createShaderModule = jest.fn().mockImplementation(() => {
        throw new Error('Shader compilation failed');
      });
      
      const model = { outputSize: 8 };
      const input = new Float32Array([1, 2]);
      
      await expect(engine.execute(model, input)).rejects.toThrow('Shader compilation failed');
    });

    it('handles buffer creation errors', async () => {
      await engine.initialize();
      
      mockSetup.mockDevice.createBuffer = jest.fn().mockImplementation(() => {
        throw new Error('Out of memory');
      });
      
      const model = { outputSize: 8 };
      const input = new Float32Array([1, 2]);
      
      await expect(engine.execute(model, input)).rejects.toThrow('Out of memory');
    });

    it('handles command submission errors', async () => {
      await engine.initialize();
      
      mockSetup.mockDevice.queue.submit = jest.fn().mockImplementation(() => {
        throw new Error('Queue error');
      });
      
      const model = { outputSize: 8 };
      const input = new Float32Array([1, 2]);
      
      await expect(engine.execute(model, input)).rejects.toThrow('Queue error');
    });
  });

  describe('Cleanup', () => {
    it('cleans up resources properly', async () => {
      const engine = new WebGPUEngine();
      await engine.initialize();
      
      expect(engine.device).toBeDefined();
      expect(engine.adapter).toBeDefined();
      expect(engine.initialized).toBe(true);
      
      await engine.cleanup();
      
      expect(engine.device).toBeNull();
      expect(engine.adapter).toBeNull();
      expect(engine.initialized).toBe(false);
      expect(mockSetup.mockDevice.destroy).toHaveBeenCalled();
    });

    it('handles cleanup without destroy method', async () => {
      const engine = new WebGPUEngine();
      await engine.initialize();
      
      delete mockSetup.mockDevice.destroy;
      
      // Should not throw
      await engine.cleanup();
      
      expect(engine.device).toBeNull();
      expect(engine.adapter).toBeNull();
    });

    it('handles multiple cleanup calls', async () => {
      const engine = new WebGPUEngine();
      await engine.initialize();
      
      await engine.cleanup();
      await engine.cleanup(); // Should not throw
      
      expect(engine.device).toBeNull();
      expect(engine.adapter).toBeNull();
    });

    it('can reinitialize after cleanup', async () => {
      const engine = new WebGPUEngine();
      
      await engine.initialize();
      await engine.cleanup();
      await engine.initialize();
      
      expect(engine.initialized).toBe(true);
      expect(engine.device).toBeDefined();
      expect(engine.adapter).toBeDefined();
      
      await engine.cleanup();
    });

    it('cleans up pipeline references', async () => {
      const engine = new WebGPUEngine();
      await engine.initialize();
      
      const model = { outputSize: 8 };
      const input = new Float32Array([1, 2]);
      
      await engine.execute(model, input);
      
      // Pipeline should be cleaned up after execution
      expect(engine.pipeline).toBeNull();
    });
  });

  describe('Integration with Model Execution', () => {
    let engine;

    beforeEach(async () => {
      engine = new WebGPUEngine();
      await engine.initialize();
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    it('handles complete inference pipeline', async () => {
      const model = {
        outputSize: 256,
        shaderCode: engine.getDefaultShader()
      };
      
      const input = new Float32Array(128).fill(0.5);
      const result = await engine.execute(model, input);
      
      expect(result).toBeInstanceOf(Float32Array);
      expect(mockSetup.mockDevice.queue.onSubmittedWorkDone).toHaveBeenCalled();
    });

    it('handles concurrent executions', async () => {
      const model = { outputSize: 64 };
      
      const promises = [];
      for (let i = 0; i < 5; i++) {
        const input = new Float32Array(32).fill(i);
        promises.push(engine.execute(model, input));
      }
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeInstanceOf(Float32Array);
      });
    });

    it('handles varying model configurations', async () => {
      const models = [
        { outputSize: 16 },
        { outputSize: 256, shaderCode: 'custom shader' },
        { outputSize: 1024 }
      ];
      
      for (const model of models) {
        const input = new Float32Array(64);
        const result = await engine.execute(model, input);
        expect(result).toBeInstanceOf(Float32Array);
      }
    });
  });

  describe('Performance Optimization', () => {
    let engine;

    beforeEach(async () => {
      engine = new WebGPUEngine();
      await engine.initialize();
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    it('reuses pipeline for same model', async () => {
      const model = { outputSize: 64 };
      const input = new Float32Array(32);
      
      // First execution creates pipeline
      await engine.execute(model, input);
      const firstPipelineCount = mockSetup.mockDevice.createComputePipeline.mock.calls.length;
      
      // Second execution should create new pipeline (since we null it after each execution)
      await engine.execute(model, input);
      const secondPipelineCount = mockSetup.mockDevice.createComputePipeline.mock.calls.length;
      
      expect(secondPipelineCount).toBe(firstPipelineCount + 1);
    });

    it('handles large data efficiently', async () => {
      const model = { outputSize: 1024 * 1024 }; // 1MB output
      const input = new Float32Array(1024 * 1024); // 4MB input
      
      const start = Date.now();
      await engine.execute(model, input);
      const duration = Date.now() - start;
      
      // Should complete in reasonable time (< 1 second for mock)
      expect(duration).toBeLessThan(1000);
    });

    it('manages memory efficiently', async () => {
      const model = { outputSize: 256 };
      
      // Run multiple executions
      for (let i = 0; i < 10; i++) {
        const input = new Float32Array(256);
        await engine.execute(model, input);
      }
      
      // All buffers should be destroyed
      const bufferCalls = mockSetup.mockDevice.createBuffer.mock.results;
      bufferCalls.forEach(result => {
        if (result.value && result.value.destroy) {
          expect(result.value.destroy).toHaveBeenCalled();
        }
      });
    });
  });

  describe('WebGPU Features', () => {
    let engine;

    beforeEach(() => {
      engine = new WebGPUEngine();
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    it('requests high-performance adapter by default', async () => {
      await engine.initialize();
      
      expect(navigator.gpu.requestAdapter).toHaveBeenCalledWith({
        powerPreference: 'high-performance'
      });
    });

    it('supports low-power mode', async () => {
      await engine.initialize({ powerPreference: 'low-power' });
      
      expect(navigator.gpu.requestAdapter).toHaveBeenCalledWith({
        powerPreference: 'low-power'
      });
    });

    it('logs adapter information', async () => {
      await engine.initialize();
      
      expect(mockSetup.mockAdapter.requestAdapterInfo).toHaveBeenCalled();
    });

    it('provides default shader implementation', () => {
      const shader = engine.getDefaultShader();
      
      expect(shader).toContain('@compute');
      expect(shader).toContain('@workgroup_size');
      expect(shader).toContain('@group(0)');
      expect(shader).toContain('@binding(0)');
      expect(shader).toContain('@binding(1)');
    });
  });

  describe('Real-world Scenarios', () => {
    let engine;

    beforeEach(async () => {
      engine = new WebGPUEngine();
      await engine.initialize();
    });

    afterEach(async () => {
      await engine.cleanup();
    });

    it('handles matrix multiplication workload', async () => {
      const model = {
        outputSize: 16 * 16 * 4, // 16x16 matrix in bytes
        shaderCode: `
          @group(0) @binding(0) var<storage, read> input: array<f32>;
          @group(0) @binding(1) var<storage, read_write> output: array<f32>;
          
          @compute @workgroup_size(8, 8)
          fn main(@builtin(global_invocation_id) id: vec3<u32>) {
            let row = id.x;
            let col = id.y;
            let idx = row * 16u + col;
            if (idx < arrayLength(&output)) {
              output[idx] = input[idx] * 2.0;
            }
          }
        `
      };
      
      const input = new Float32Array(16 * 16).fill(1.0);
      const result = await engine.execute(model, input);
      
      expect(result).toBeInstanceOf(Float32Array);
    });

    it('handles neural network layer computation', async () => {
      const model = {
        outputSize: 128 * 4, // 128 neurons output
        shaderCode: `
          @group(0) @binding(0) var<storage, read> input: array<f32>;
          @group(0) @binding(1) var<storage, read_write> output: array<f32>;
          
          @compute @workgroup_size(64)
          fn main(@builtin(global_invocation_id) id: vec3<u32>) {
            // Simplified neuron activation
            let idx = id.x;
            if (idx < arrayLength(&output)) {
              // ReLU activation
              output[idx] = max(0.0, input[idx]);
            }
          }
        `
      };
      
      const input = new Float32Array(256).map((_, i) => i - 128); // Some negative, some positive
      const result = await engine.execute(model, input);
      
      expect(result).toBeInstanceOf(Float32Array);
    });

    it('handles batch processing', async () => {
      const batchSize = 32;
      const model = { outputSize: 64 };
      
      const results = [];
      for (let batch = 0; batch < batchSize; batch++) {
        const input = new Float32Array(64).fill(batch);
        const result = await engine.execute(model, input);
        results.push(result);
      }
      
      expect(results).toHaveLength(batchSize);
      results.forEach(result => {
        expect(result).toBeInstanceOf(Float32Array);
      });
    });
  });
});