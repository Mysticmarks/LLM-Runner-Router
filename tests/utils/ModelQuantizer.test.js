/**
 * Tests for Model Quantizer
 */

import { jest } from '@jest/globals';
import ModelQuantizer, { 
  QuantizationConfig, 
  QuantizationResult, 
  QuantizationMethod,
  QuantizationPrecision
} from '../../src/utils/ModelQuantizer.js';

// Mock fs/promises
jest.mock('fs/promises', () => ({
  access: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  stat: jest.fn(),
  mkdir: jest.fn(),
  open: jest.fn(),
  close: jest.fn()
}));

// Mock worker_threads
jest.mock('worker_threads', () => ({
  Worker: jest.fn(() => ({
    on: jest.fn(),
    terminate: jest.fn()
  }))
}));

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

describe('QuantizationConfig', () => {
  test('should create config with default values', () => {
    const config = new QuantizationConfig();
    
    expect(config.method).toBe(QuantizationMethod.DYNAMIC);
    expect(config.precision).toBe(QuantizationPrecision.INT8);
    expect(config.preserveAccuracy).toBe(true);
    expect(config.accuracyThreshold).toBe(0.95);
  });

  test('should create config with custom values', () => {
    const options = {
      method: QuantizationMethod.GPTQ,
      precision: QuantizationPrecision.INT4,
      accuracyThreshold: 0.9,
      calibrationSamples: 256
    };
    
    const config = new QuantizationConfig(options);
    
    expect(config.method).toBe(QuantizationMethod.GPTQ);
    expect(config.precision).toBe(QuantizationPrecision.INT4);
    expect(config.accuracyThreshold).toBe(0.9);
    expect(config.calibrationSamples).toBe(256);
  });

  test('should include method-specific options', () => {
    const config = new QuantizationConfig({
      gptqOptions: { groupSize: 64 },
      awqOptions: { clipRatio: 0.8 }
    });
    
    expect(config.gptqOptions.groupSize).toBe(64);
    expect(config.awqOptions.clipRatio).toBe(0.8);
  });
});

describe('QuantizationResult', () => {
  test('should create result with default values', () => {
    const result = new QuantizationResult();
    
    expect(result.success).toBe(false);
    expect(result.originalSize).toBe(0);
    expect(result.quantizedSize).toBe(0);
    expect(result.compressionRatio).toBe(0);
  });

  test('should create result with provided data', () => {
    const data = {
      success: true,
      originalSize: 1000,
      quantizedSize: 250,
      accuracy: 0.96,
      outputPath: '/path/to/output'
    };
    
    const result = new QuantizationResult(data);
    
    expect(result.success).toBe(true);
    expect(result.originalSize).toBe(1000);
    expect(result.quantizedSize).toBe(250);
    expect(result.accuracy).toBe(0.96);
    expect(result.outputPath).toBe('/path/to/output');
  });

  test('should calculate compression percentage correctly', () => {
    const result = new QuantizationResult({
      originalSize: 1000,
      quantizedSize: 250
    });
    
    expect(result.compressionPercentage).toBe(75);
  });

  test('should check quality threshold', () => {
    const goodResult = new QuantizationResult({ accuracy: 0.97 });
    const badResult = new QuantizationResult({ accuracy: 0.92 });
    
    expect(goodResult.meetsQualityThreshold(0.95)).toBe(true);
    expect(badResult.meetsQualityThreshold(0.95)).toBe(false);
  });
});

describe('ModelQuantizer', () => {
  let quantizer;
  let fs;

  beforeEach(async () => {
    quantizer = new ModelQuantizer();
    fs = await import('fs/promises');
    jest.clearAllMocks();
    
    // Mock file operations
    fs.access.mockResolvedValue();
    fs.stat.mockResolvedValue({ size: 1000000 });
    fs.mkdir.mockResolvedValue();
    fs.writeFile.mockResolvedValue();
    fs.readFile.mockResolvedValue(Buffer.alloc(100000));
  });

  afterEach(async () => {
    await quantizer.cleanup?.();
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(quantizer.config.method).toBe(QuantizationMethod.DYNAMIC);
      expect(quantizer.config.enableNative).toBe(true);
      expect(quantizer.workers).toEqual([]);
    });

    test('should initialize worker pool', async () => {
      await quantizer.initialize();
      expect(quantizer.workers.length).toBeGreaterThan(0);
    });
  });

  describe('Input Validation', () => {
    test('should validate model file exists', async () => {
      fs.access.mockRejectedValue(new Error('File not found'));
      
      await expect(quantizer.validateInputs('/nonexistent/model.gguf', '/output.gguf'))
        .rejects.toThrow('Model file not found');
    });

    test('should validate supported model format', async () => {
      await expect(quantizer.validateInputs('/model.unsupported', '/output.gguf'))
        .rejects.toThrow('Unsupported model format');
    });

    test('should accept supported formats', async () => {
      const supportedFiles = [
        '/model.gguf',
        '/model.onnx', 
        '/model.safetensors',
        '/model.pytorch',
        '/model.bin'
      ];
      
      for (const file of supportedFiles) {
        await expect(quantizer.validateInputs(file, '/output.gguf'))
          .resolves.not.toThrow();
      }
    });

    test('should create output directory', async () => {
      await quantizer.validateInputs('/model.gguf', '/new/dir/output.gguf');
      expect(fs.mkdir).toHaveBeenCalledWith('/new/dir', { recursive: true });
    });
  });

  describe('Model Analysis', () => {
    test('should analyze model structure', async () => {
      const modelInfo = await quantizer.analyzeModel('/model.gguf');
      
      expect(modelInfo).toHaveProperty('path', '/model.gguf');
      expect(modelInfo).toHaveProperty('size', 1000000);
      expect(modelInfo).toHaveProperty('format', '.gguf');
    });

    test('should handle analysis errors gracefully', async () => {
      fs.stat.mockRejectedValue(new Error('Stat failed'));
      
      await expect(quantizer.analyzeModel('/model.gguf'))
        .rejects.toThrow('Stat failed');
    });
  });

  describe('Quantization Methods', () => {
    beforeEach(async () => {
      await quantizer.initialize();
    });

    test('should perform dynamic quantization', async () => {
      const result = await quantizer.quantize('/model.gguf', '/output.gguf', {
        method: QuantizationMethod.DYNAMIC
      });
      
      expect(result).toBeInstanceOf(QuantizationResult);
      expect(result.success).toBe(true);
      expect(result.originalSize).toBeGreaterThan(0);
      expect(result.quantizedSize).toBeGreaterThan(0);
    });

    test('should perform static quantization with calibration', async () => {
      quantizer.config.method = QuantizationMethod.STATIC;
      
      const result = await quantizer.quantize('/model.gguf', '/output.gguf');
      
      expect(result).toBeInstanceOf(QuantizationResult);
      expect(result.success).toBe(true);
    });

    test('should perform GPTQ quantization', async () => {
      quantizer.config.method = QuantizationMethod.GPTQ;
      
      const result = await quantizer.quantize('/model.gguf', '/output.gguf');
      
      expect(result).toBeInstanceOf(QuantizationResult);
      expect(result.success).toBe(true);
    });

    test('should perform AWQ quantization', async () => {
      quantizer.config.method = QuantizationMethod.AWQ;
      
      const result = await quantizer.quantize('/model.gguf', '/output.gguf');
      
      expect(result).toBeInstanceOf(QuantizationResult);
      expect(result.success).toBe(true);
    });

    test('should handle unsupported quantization methods', async () => {
      quantizer.config.method = 'unsupported';
      
      await expect(quantizer.quantize('/model.gguf', '/output.gguf'))
        .rejects.toThrow('Unsupported quantization method');
    });
  });

  describe('Calibration Data', () => {
    test('should check if calibration is required', () => {
      expect(quantizer.requiresCalibration()).toBe(false);
      
      quantizer.config.method = QuantizationMethod.STATIC;
      expect(quantizer.requiresCalibration()).toBe(true);
      
      quantizer.config.method = QuantizationMethod.GPTQ;
      expect(quantizer.requiresCalibration()).toBe(true);
    });

    test('should prepare calibration data from dataset', async () => {
      quantizer.config.calibrationDataset = '/dataset.txt';
      fs.readFile.mockResolvedValue('line1\nline2\nline3\n');
      
      const data = await quantizer.prepareCalibrationData();
      
      expect(data).toEqual(['line1', 'line2', 'line3']);
    });

    test('should generate synthetic calibration data', async () => {
      const data = await quantizer.generateSyntheticCalibrationData();
      
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(quantizer.config.calibrationSamples);
    });

    test('should load calibration dataset from file', async () => {
      fs.readFile.mockResolvedValue('sample1\nsample2\nsample3\n');
      
      const data = await quantizer.loadCalibrationDataset('/dataset.txt');
      
      expect(data).toEqual(['sample1', 'sample2', 'sample3']);
    });
  });

  describe('Model Validation', () => {
    test('should validate quantized model quality', async () => {
      const result = new QuantizationResult({
        outputPath: '/output.gguf',
        originalSize: 1000,
        quantizedSize: 250
      });
      
      const modelInfo = { size: 1000 };
      
      await quantizer.validateQuantizedModel(result, modelInfo);
      
      expect(result.accuracy).toBeDefined();
      expect(result.perplexity).toBeDefined();
    });

    test('should detect accuracy below threshold', async () => {
      const result = new QuantizationResult({
        outputPath: '/output.gguf',
        accuracy: 0.85
      });
      
      quantizer.config.accuracyThreshold = 0.95;
      
      await quantizer.validateQuantizedModel(result, {});
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Accuracy');
    });
  });

  describe('Compression Ratios', () => {
    test('should calculate correct compression ratios for different precisions', () => {
      quantizer.config.targetPrecision = QuantizationPrecision.FP16;
      expect(quantizer.getCompressionRatio()).toBe(0.5);
      
      quantizer.config.targetPrecision = QuantizationPrecision.INT8;
      expect(quantizer.getCompressionRatio()).toBe(0.25);
      
      quantizer.config.targetPrecision = QuantizationPrecision.INT4;
      expect(quantizer.getCompressionRatio()).toBe(0.125);
      
      quantizer.config.targetPrecision = QuantizationPrecision.INT2;
      expect(quantizer.getCompressionRatio()).toBe(0.0625);
    });
  });

  describe('Worker Pool Management', () => {
    test('should create worker script', () => {
      const script = quantizer.createWorkerScript();
      
      expect(script).toContain('parentPort');
      expect(script).toContain('quantize_layer');
      expect(script).toContain('validate_layer');
    });

    test('should handle worker messages', () => {
      const mockJob = {
        resolve: jest.fn(),
        reject: jest.fn()
      };
      
      quantizer.activeJobs.set('job1', mockJob);
      
      // Test successful message
      quantizer.handleWorkerMessage({
        jobId: 'job1',
        success: true,
        data: { result: 'success' }
      });
      
      expect(mockJob.resolve).toHaveBeenCalledWith({ result: 'success' });
      expect(quantizer.activeJobs.has('job1')).toBe(false);
    });

    test('should handle worker errors', () => {
      const mockJob = {
        resolve: jest.fn(),
        reject: jest.fn()
      };
      
      quantizer.activeJobs.set('job2', mockJob);
      
      // Test error message
      quantizer.handleWorkerMessage({
        jobId: 'job2',
        success: false,
        error: 'Worker failed'
      });
      
      expect(mockJob.reject).toHaveBeenCalledWith(new Error('Worker failed'));
      expect(quantizer.activeJobs.has('job2')).toBe(false);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should provide quantizer statistics', () => {
      quantizer.activeJobs.set('job1', {});
      quantizer.workers = [1, 2, 3]; // Mock workers
      quantizer.jobId = 10;
      
      const stats = quantizer.getStats();
      
      expect(stats.activeJobs).toBe(1);
      expect(stats.workerCount).toBe(3);
      expect(stats.totalJobsCompleted).toBe(9);
    });

    test('should emit progress events', async () => {
      const eventSpy = jest.fn();
      quantizer.on('quantization:start', eventSpy);
      quantizer.on('quantization:complete', eventSpy);
      
      await quantizer.quantize('/model.gguf', '/output.gguf');
      
      expect(eventSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle quantization errors gracefully', async () => {
      // Mock an error during quantization
      jest.spyOn(quantizer, 'dynamicQuantization').mockRejectedValue(new Error('Quantization failed'));
      
      await expect(quantizer.quantize('/model.gguf', '/output.gguf'))
        .rejects.toThrow('Quantization failed');
    });

    test('should handle missing calibration data', async () => {
      quantizer.config.method = QuantizationMethod.STATIC;
      quantizer.config.calibrationDataset = '/nonexistent.txt';
      fs.readFile.mockRejectedValue(new Error('File not found'));
      
      await expect(quantizer.quantize('/model.gguf', '/output.gguf'))
        .rejects.toThrow();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources properly', async () => {
      // Mock workers
      const mockWorker = { terminate: jest.fn() };
      quantizer.workers = [mockWorker];
      quantizer.activeJobs.set('job1', {});
      quantizer.metricsCache.set('key1', 'value');
      
      await quantizer.cleanup();
      
      expect(mockWorker.terminate).toHaveBeenCalled();
      expect(quantizer.workers).toEqual([]);
      expect(quantizer.activeJobs.size).toBe(0);
      expect(quantizer.metricsCache.size).toBe(0);
    });
  });

  describe('Performance', () => {
    test('should complete quantization within reasonable time', async () => {
      const startTime = Date.now();
      
      const result = await quantizer.quantize('/model.gguf', '/output.gguf');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete in under 10 seconds for mock
    });

    test('should handle large models efficiently', async () => {
      // Mock large model
      fs.stat.mockResolvedValue({ size: 10000000000 }); // 10GB
      
      const result = await quantizer.quantize('/large-model.gguf', '/output.gguf');
      
      expect(result.success).toBe(true);
      expect(result.originalSize).toBe(10000000000);
    });
  });

  describe('Integration with Native Quantizer', () => {
    test('should use native quantizer when available', async () => {
      // Mock native quantizer
      const mockNativeQuantizer = {
        dynamicQuantize: jest.fn().mockResolvedValue({
          success: true,
          originalSize: 1000,
          quantizedSize: 250
        })
      };
      
      quantizer.nativeQuantizer = mockNativeQuantizer;
      
      const result = await quantizer.dynamicQuantization('/model.gguf', '/output.gguf', {});
      
      expect(mockNativeQuantizer.dynamicQuantize).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    test('should fallback to JavaScript implementation', async () => {
      // Ensure no native quantizer
      quantizer.nativeQuantizer = null;
      
      const result = await quantizer.dynamicQuantization('/model.gguf', '/output.gguf', {});
      
      expect(result.success).toBe(true);
    });
  });
});