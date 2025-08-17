/**
 * Tests for Format Converter
 */

import { jest } from '@jest/globals';
import FormatConverter, { 
  ConversionConfig, 
  ConversionResult, 
  ModelFormat 
} from '../../src/utils/FormatConverter.js';

// Mock fs/promises
jest.mock('fs/promises', () => ({
  access: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  stat: jest.fn(),
  mkdir: jest.fn(),
  open: jest.fn()
}));

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

// Mock crypto
jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mock-checksum')
  }))
}));

describe('ConversionConfig', () => {
  test('should create config with default values', () => {
    const config = new ConversionConfig();
    
    expect(config.preserveMetadata).toBe(true);
    expect(config.optimizeForInference).toBe(true);
    expect(config.validateAfterConversion).toBe(true);
    expect(config.batchSize).toBe(1);
    expect(config.precision).toBe('fp32');
  });

  test('should create config with custom values', () => {
    const options = {
      sourceFormat: ModelFormat.PYTORCH,
      targetFormat: ModelFormat.ONNX,
      precision: 'fp16',
      batchSize: 4,
      validateAfterConversion: false
    };
    
    const config = new ConversionConfig(options);
    
    expect(config.sourceFormat).toBe(ModelFormat.PYTORCH);
    expect(config.targetFormat).toBe(ModelFormat.ONNX);
    expect(config.precision).toBe('fp16');
    expect(config.batchSize).toBe(4);
    expect(config.validateAfterConversion).toBe(false);
  });

  test('should include format-specific options', () => {
    const config = new ConversionConfig({
      onnxOptions: { opsetVersion: 12 },
      ggufOptions: { quantization: 'q8_0' }
    });
    
    expect(config.onnxOptions.opsetVersion).toBe(12);
    expect(config.ggufOptions.quantization).toBe('q8_0');
  });
});

describe('ConversionResult', () => {
  test('should create result with default values', () => {
    const result = new ConversionResult();
    
    expect(result.success).toBe(false);
    expect(result.sourceSize).toBe(0);
    expect(result.outputSize).toBe(0);
    expect(result.compressionRatio).toBe(0);
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  test('should create result with provided data', () => {
    const data = {
      success: true,
      sourceFormat: ModelFormat.PYTORCH,
      targetFormat: ModelFormat.ONNX,
      sourceSize: 1000,
      outputSize: 800,
      conversionTime: 5000
    };
    
    const result = new ConversionResult(data);
    
    expect(result.success).toBe(true);
    expect(result.sourceFormat).toBe(ModelFormat.PYTORCH);
    expect(result.targetFormat).toBe(ModelFormat.ONNX);
    expect(result.sourceSize).toBe(1000);
    expect(result.outputSize).toBe(800);
    expect(result.conversionTime).toBe(5000);
  });

  test('should calculate size reduction correctly', () => {
    const result = new ConversionResult({
      sourceSize: 1000,
      outputSize: 750
    });
    
    expect(result.sizeReduction).toBe(25);
  });

  test('should check validity correctly', () => {
    const validResult = new ConversionResult({
      success: true,
      validationResult: { isValid: true },
      errors: []
    });
    
    const invalidResult = new ConversionResult({
      success: true,
      validationResult: { isValid: false },
      errors: []
    });
    
    expect(validResult.isValid).toBe(true);
    expect(invalidResult.isValid).toBe(false);
  });
});

describe('FormatConverter', () => {
  let converter;
  let fs;

  beforeEach(async () => {
    converter = new FormatConverter();
    fs = await import('fs/promises');
    jest.clearAllMocks();
    
    // Mock file operations
    fs.access.mockResolvedValue();
    fs.stat.mockResolvedValue({ 
      size: 1000000, 
      isDirectory: () => false,
      mtime: new Date()
    });
    fs.mkdir.mockResolvedValue();
    fs.writeFile.mockResolvedValue();
    fs.readFile.mockResolvedValue('{"model_type": "gpt2"}');
    fs.open.mockResolvedValue({
      read: jest.fn().mockResolvedValue(),
      close: jest.fn().mockResolvedValue()
    });
  });

  describe('Format Detection', () => {
    test('should detect GGUF format by extension', async () => {
      const format = await converter.detectFormat('/model.gguf');
      expect(format).toBe(ModelFormat.GGUF);
    });

    test('should detect ONNX format by extension', async () => {
      const format = await converter.detectFormat('/model.onnx');
      expect(format).toBe(ModelFormat.ONNX);
    });

    test('should detect Safetensors format by extension', async () => {
      const format = await converter.detectFormat('/model.safetensors');
      expect(format).toBe(ModelFormat.SAFETENSORS);
    });

    test('should detect PyTorch format by extension', async () => {
      const format = await converter.detectFormat('/model.pt');
      expect(format).toBe(ModelFormat.PYTORCH);
    });

    test('should detect HuggingFace directory format', async () => {
      fs.stat.mockResolvedValue({ 
        isDirectory: () => true,
        size: 0,
        mtime: new Date()
      });
      
      const format = await converter.detectFormat('/model-dir');
      expect(format).toBe(ModelFormat.HUGGINGFACE);
    });

    test('should verify magic bytes for GGUF', async () => {
      const mockFile = {
        read: jest.fn().mockResolvedValue(),
        close: jest.fn().mockResolvedValue()
      };
      fs.open.mockResolvedValue(mockFile);
      
      // Mock GGUF magic bytes
      const ggufBuffer = Buffer.from('GGUF');
      mockFile.read.mockImplementation((buffer) => {
        ggufBuffer.copy(buffer);
      });
      
      const isValid = await converter.verifyMagicBytes('/model.gguf', {
        magicBytes: Buffer.from('GGUF'),
        headerOffset: 0
      });
      
      expect(isValid).toBe(true);
    });

    test('should handle detection errors', async () => {
      fs.stat.mockRejectedValue(new Error('File not found'));
      
      await expect(converter.detectFormat('/nonexistent.model'))
        .rejects.toThrow('File not found');
    });
  });

  describe('Conversion Support Matrix', () => {
    test('should check supported conversions correctly', () => {
      expect(converter.isConversionSupported(ModelFormat.PYTORCH, ModelFormat.ONNX)).toBe(true);
      expect(converter.isConversionSupported(ModelFormat.HUGGINGFACE, ModelFormat.GGUF)).toBe(true);
      expect(converter.isConversionSupported(ModelFormat.GGUF, ModelFormat.PYTORCH)).toBe(false);
    });

    test('should return conversion matrix', () => {
      const matrix = converter.getSupportedConversions();
      
      expect(matrix).toHaveProperty(ModelFormat.PYTORCH);
      expect(matrix[ModelFormat.PYTORCH]).toContain(ModelFormat.ONNX);
      expect(matrix[ModelFormat.HUGGINGFACE]).toContain(ModelFormat.GGUF);
    });
  });

  describe('Model Analysis', () => {
    test('should analyze source model properties', async () => {
      const sourceInfo = await converter.analyzeSourceModel('/model.pt', ModelFormat.PYTORCH);
      
      expect(sourceInfo).toHaveProperty('path', '/model.pt');
      expect(sourceInfo).toHaveProperty('format', ModelFormat.PYTORCH);
      expect(sourceInfo).toHaveProperty('size', 1000000);
      expect(sourceInfo).toHaveProperty('checksum', 'mock-checksum');
    });

    test('should analyze HuggingFace models', async () => {
      const sourceInfo = await converter.analyzeSourceModel('/model-dir', ModelFormat.HUGGINGFACE);
      
      expect(sourceInfo.architecture).toBe('gpt2');
    });

    test('should handle analysis errors gracefully', async () => {
      jest.spyOn(converter, 'analyzeGGUF').mockRejectedValue(new Error('Analysis failed'));
      
      const sourceInfo = await converter.analyzeSourceModel('/model.gguf', ModelFormat.GGUF);
      
      // Should not throw, just warn
      expect(sourceInfo).toHaveProperty('format', ModelFormat.GGUF);
    });
  });

  describe('Conversion Process', () => {
    beforeEach(() => {
      // Mock successful conversion
      jest.spyOn(converter, 'runPythonScript').mockResolvedValue('Conversion successful');
    });

    test('should convert PyTorch to ONNX', async () => {
      const result = await converter.convert('/model.pt', '/output.onnx', {
        sourceFormat: ModelFormat.PYTORCH,
        targetFormat: ModelFormat.ONNX
      });
      
      expect(result).toBeInstanceOf(ConversionResult);
      expect(result.success).toBe(true);
      expect(result.sourceFormat).toBe(ModelFormat.PYTORCH);
      expect(result.targetFormat).toBe(ModelFormat.ONNX);
    });

    test('should convert HuggingFace to ONNX', async () => {
      const result = await converter.convert('/model-dir', '/output.onnx', {
        sourceFormat: ModelFormat.HUGGINGFACE,
        targetFormat: ModelFormat.ONNX
      });
      
      expect(result.success).toBe(true);
      expect(result.sourceFormat).toBe(ModelFormat.HUGGINGFACE);
      expect(result.targetFormat).toBe(ModelFormat.ONNX);
    });

    test('should convert HuggingFace to GGUF', async () => {
      const result = await converter.convert('/model-dir', '/output.gguf', {
        sourceFormat: ModelFormat.HUGGINGFACE,
        targetFormat: ModelFormat.GGUF
      });
      
      expect(result.success).toBe(true);
      expect(result.targetFormat).toBe(ModelFormat.GGUF);
    });

    test('should auto-detect source format', async () => {
      const result = await converter.convert('/model.pt', '/output.onnx', {
        targetFormat: ModelFormat.ONNX
      });
      
      expect(result.success).toBe(true);
      expect(result.sourceFormat).toBe(ModelFormat.PYTORCH);
    });

    test('should reject unsupported conversions', async () => {
      await expect(converter.convert('/model.gguf', '/output.pt', {
        sourceFormat: ModelFormat.GGUF,
        targetFormat: ModelFormat.PYTORCH
      })).rejects.toThrow('not supported');
    });
  });

  describe('Python Script Generation', () => {
    test('should generate PyTorch to ONNX script', () => {
      const script = converter.generatePyTorchToONNXScript();
      
      expect(script).toContain('torch.onnx.export');
      expect(script).toContain('--input');
      expect(script).toContain('--output');
      expect(script).toContain('--opset-version');
    });

    test('should generate HuggingFace to ONNX script', () => {
      const script = converter.generateHuggingFaceToONNXScript();
      
      expect(script).toContain('AutoModel.from_pretrained');
      expect(script).toContain('export');
      expect(script).toContain('--model-path');
    });

    test('should generate PyTorch to Safetensors script', () => {
      const script = converter.generatePyTorchToSafetensorsScript();
      
      expect(script).toContain('safetensors.torch');
      expect(script).toContain('save_file');
      expect(script).toContain('torch.load');
    });

    test('should generate ONNX to TensorFlow script', () => {
      const script = converter.generateONNXToTensorFlowScript();
      
      expect(script).toContain('onnx_tf.backend');
      expect(script).toContain('prepare');
      expect(script).toContain('export_graph');
    });
  });

  describe('Validation', () => {
    test('should validate conversion when requested', async () => {
      converter.config.validateAfterConversion = true;
      
      const result = await converter.convert('/model.pt', '/output.onnx', {
        sourceFormat: ModelFormat.PYTORCH,
        targetFormat: ModelFormat.ONNX
      });
      
      expect(result.validationResult).toBeDefined();
      expect(result.validationResult.isValid).toBe(true);
    });

    test('should detect validation errors', async () => {
      fs.stat.mockResolvedValueOnce({ size: 1000000 }) // source
             .mockResolvedValueOnce({ size: 0 }); // empty output
      
      const result = new ConversionResult({
        outputPath: '/empty.onnx',
        sourceSize: 1000000,
        outputSize: 0
      });
      
      const validation = await converter.validateConversion(result, { size: 1000000 });
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should warn about unusual size ratios', async () => {
      const result = new ConversionResult({
        outputPath: '/huge.onnx',
        sourceSize: 1000,
        outputSize: 10000 // 10x larger
      });
      
      const validation = await converter.validateConversion(result, { size: 1000 });
      
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('Unusual size ratio');
    });
  });

  describe('Error Handling', () => {
    test('should handle conversion script failures', async () => {
      jest.spyOn(converter, 'runPythonScript').mockRejectedValue(new Error('Script failed'));
      
      await expect(converter.convert('/model.pt', '/output.onnx', {
        sourceFormat: ModelFormat.PYTORCH,
        targetFormat: ModelFormat.ONNX
      })).rejects.toThrow('Script failed');
    });

    test('should handle missing source files', async () => {
      fs.access.mockRejectedValue(new Error('Source not found'));
      
      await expect(converter.convert('/nonexistent.pt', '/output.onnx'))
        .rejects.toThrow();
    });

    test('should handle timeout errors', async () => {
      converter.config.timeout = 100; // Very short timeout
      
      jest.spyOn(converter, 'runPythonScript').mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );
      
      await expect(converter.convert('/model.pt', '/output.onnx', {
        sourceFormat: ModelFormat.PYTORCH,
        targetFormat: ModelFormat.ONNX
      })).rejects.toThrow();
    });
  });

  describe('Python Script Execution', () => {
    test('should run Python scripts successfully', async () => {
      const { spawn } = await import('child_process');
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        })
      };
      
      spawn.mockReturnValue(mockProcess);
      
      // Simulate stdout data
      setTimeout(() => {
        const callback = mockProcess.stdout.on.mock.calls.find(call => call[0] === 'data')[1];
        callback('Script output');
      }, 5);
      
      const result = await converter.runPythonScript('python3', ['script.py']);
      expect(result).toBe('Script output');
    });

    test('should handle script errors', async () => {
      const { spawn } = await import('child_process');
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 10); // Non-zero exit code
          }
        })
      };
      
      spawn.mockReturnValue(mockProcess);
      
      // Simulate stderr data
      setTimeout(() => {
        const callback = mockProcess.stderr.on.mock.calls.find(call => call[0] === 'data')[1];
        callback('Script error');
      }, 5);
      
      await expect(converter.runPythonScript('python3', ['script.py']))
        .rejects.toThrow('Script failed with code 1');
    });
  });

  describe('Fallback Conversions', () => {
    test('should use fallback for HuggingFace to GGUF when llama.cpp not available', async () => {
      fs.access.mockRejectedValue(new Error('File not found'));
      jest.spyOn(converter, 'fallbackHuggingFaceToGGUF').mockResolvedValue();
      
      const result = await converter.convertHuggingFaceToGGUF('/model', '/output.gguf', {}, {});
      
      expect(result.success).toBe(true);
    });

    test('should simulate conversion for unsupported formats', async () => {
      jest.spyOn(converter, 'simulateConversion').mockResolvedValue();
      
      await converter.simulateConversion('/input.model', '/output.model', 0.8);
      
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should provide converter statistics', () => {
      converter.stats.totalConversions = 10;
      converter.stats.successfulConversions = 8;
      converter.stats.failedConversions = 2;
      
      const stats = converter.getStats();
      
      expect(stats.totalConversions).toBe(10);
      expect(stats.successRate).toBe(0.8);
      expect(stats.supportedFormats).toContain(ModelFormat.GGUF);
    });

    test('should emit conversion events', async () => {
      const eventSpy = jest.fn();
      converter.on('conversion:start', eventSpy);
      converter.on('conversion:complete', eventSpy);
      
      await converter.convert('/model.pt', '/output.onnx', {
        sourceFormat: ModelFormat.PYTORCH,
        targetFormat: ModelFormat.ONNX
      });
      
      expect(eventSpy).toHaveBeenCalledTimes(2);
    });

    test('should update statistics after conversion', async () => {
      const initialTotal = converter.stats.totalConversions;
      
      await converter.convert('/model.pt', '/output.onnx', {
        sourceFormat: ModelFormat.PYTORCH,
        targetFormat: ModelFormat.ONNX
      });
      
      expect(converter.stats.totalConversions).toBe(initialTotal + 1);
      expect(converter.stats.successfulConversions).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    test('should complete conversion within reasonable time', async () => {
      const startTime = Date.now();
      
      const result = await converter.convert('/model.pt', '/output.onnx', {
        sourceFormat: ModelFormat.PYTORCH,
        targetFormat: ModelFormat.ONNX
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds for mock
    });

    test('should handle large models efficiently', async () => {
      // Mock large model
      fs.stat.mockResolvedValue({ 
        size: 5000000000, // 5GB
        isDirectory: () => false,
        mtime: new Date()
      });
      
      const result = await converter.convert('/large-model.pt', '/output.onnx', {
        sourceFormat: ModelFormat.PYTORCH,
        targetFormat: ModelFormat.ONNX
      });
      
      expect(result.success).toBe(true);
      expect(result.sourceSize).toBe(5000000000);
    });
  });

  describe('Utility Functions', () => {
    test('should check file existence', async () => {
      fs.access.mockResolvedValue();
      expect(await converter.fileExists('/existing.file')).toBe(true);
      
      fs.access.mockRejectedValue(new Error('Not found'));
      expect(await converter.fileExists('/missing.file')).toBe(false);
    });

    test('should calculate checksums', async () => {
      fs.readFile.mockResolvedValue(Buffer.from('test data'));
      
      const checksum = await converter.calculateChecksum('/file.txt');
      
      expect(checksum).toBe('mock-checksum');
    });
  });
});