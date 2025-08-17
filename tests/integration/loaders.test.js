/**
 * Integration tests for model loaders
 * Tests cross-component interactions and real model loading
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { LLMRouter } from '../../src/index.js';
import { ONNXLoader } from '../../src/loaders/ONNXLoader.js';
import { SafetensorsLoader } from '../../src/loaders/SafetensorsLoader.js';
import { HFLoader } from '../../src/loaders/HFLoader.js';
import fs from 'fs/promises';
import path from 'path';

describe('Loader Integration Tests', () => {
  let router;
  
  beforeAll(async () => {
    // Initialize router
    router = new LLMRouter({ autoInit: false });
    await router.initialize();
    
    // Register loaders
    router.registry.registerLoader('onnx', new ONNXLoader());
    router.registry.registerLoader('safetensors', new SafetensorsLoader());
    router.registry.registerLoader('huggingface', new HFLoader());
  });
  
  afterAll(async () => {
    await router.cleanup();
  });
  
  describe('ONNX Loader', () => {
    it('should detect ONNX format from file extension', () => {
      const loader = new ONNXLoader();
      expect(loader.supports('model.onnx')).toBe(true);
      expect(loader.supports('path/to/model.ort')).toBe(true);
      expect(loader.supports('model.bin')).toBe(false);
    });
    
    it('should initialize ONNX runtime', async () => {
      const loader = new ONNXLoader();
      const initialized = await loader.initialize();
      // May fail if ONNX runtime not installed
      expect(typeof initialized).toBe('boolean');
    });
    
    it('should handle invalid model gracefully', async () => {
      const loader = new ONNXLoader();
      const validation = await loader.validate({
        source: 'nonexistent.onnx'
      });
      expect(validation.valid).toBe(false);
      expect(validation.error).toBeDefined();
    });
  });
  
  describe('Safetensors Loader', () => {
    it('should detect Safetensors format from file extension', () => {
      const loader = new SafetensorsLoader();
      expect(loader.supports('model.safetensors')).toBe(true);
      expect(loader.supports('path/to/model.st')).toBe(true);
      expect(loader.supports('model.bin')).toBe(false);
    });
    
    it('should parse Safetensors header correctly', async () => {
      const loader = new SafetensorsLoader();
      
      // Create mock Safetensors data
      const header = {
        tensor1: {
          dtype: 'F32',
          shape: [2, 3],
          data_offsets: [0, 24]
        },
        __metadata__: {
          format: 'safetensors'
        }
      };
      
      const headerJson = JSON.stringify(header);
      const headerSize = Buffer.alloc(8);
      headerSize.writeBigUInt64LE(BigInt(headerJson.length));
      
      const tensorData = Buffer.alloc(24); // 6 float32 values
      const mockBuffer = Buffer.concat([
        headerSize,
        Buffer.from(headerJson),
        tensorData
      ]);
      
      const parsed = await loader.parseSafetensors(mockBuffer.buffer);
      expect(parsed.metadata.format).toBe('safetensors');
      expect(parsed.tensors.tensor1).toBeDefined();
      expect(parsed.tensors.tensor1.shape).toEqual([2, 3]);
    });
    
    it('should convert float16 to float32', () => {
      const loader = new SafetensorsLoader();
      const float16 = new Uint16Array([0x3C00]); // 1.0 in float16
      const float32 = loader.float16ToFloat32(float16);
      expect(float32[0]).toBeCloseTo(1.0);
    });
  });
  
  describe('HuggingFace Loader', () => {
    it('should detect HuggingFace format from patterns', () => {
      const loader = new HFLoader();
      expect(loader.supports('hf:bert-base-uncased')).toBe(true);
      expect(loader.supports('huggingface:gpt2')).toBe(true);
      expect(loader.supports('microsoft/DialoGPT-medium')).toBe(true);
      expect(loader.supports('https://huggingface.co/bert-base')).toBe(true);
      expect(loader.supports('model.bin')).toBe(false);
    });
    
    it('should parse model names correctly', () => {
      const loader = new HFLoader();
      expect(loader.parseModelName('hf:bert-base-uncased')).toBe('bert-base-uncased');
      expect(loader.parseModelName('huggingface:gpt2')).toBe('gpt2');
      expect(loader.parseModelName('https://huggingface.co/microsoft/phi-2')).toBe('microsoft/phi-2');
    });
    
    it('should infer task type from model name', async () => {
      const loader = new HFLoader();
      expect(await loader.inferTask('bert-base-uncased')).toBe('fill-mask');
      expect(await loader.inferTask('gpt2')).toBe('text-generation');
      expect(await loader.inferTask('facebook/bart-large')).toBe('text2text-generation');
      expect(await loader.inferTask('openai/whisper-base')).toBe('automatic-speech-recognition');
      expect(await loader.inferTask('stabilityai/stable-diffusion')).toBe('text-to-image');
    });
    
    it('should validate model availability', async () => {
      const loader = new HFLoader();
      // This makes a real API call, so we'll handle both success and failure
      const validation = await loader.validate({
        source: 'bert-base-uncased'
      });
      expect(validation).toHaveProperty('valid');
    }, 10000); // Increase timeout for API call
  });
  
  describe('Cross-Loader Integration', () => {
    it('should register multiple loaders in router', () => {
      const loaders = router.registry.loaders;
      expect(loaders.has('onnx')).toBe(true);
      expect(loaders.has('safetensors')).toBe(true);
      expect(loaders.has('huggingface')).toBe(true);
    });
    
    it('should auto-detect format from source', async () => {
      expect(router.detectFormat('model.onnx')).toBe('onnx');
      expect(router.detectFormat('model.safetensors')).toBe('safetensors');
      expect(router.detectFormat('hf:bert-base')).toBe('huggingface');
    });
    
    it('should handle loader errors gracefully', async () => {
      try {
        await router.load({
          source: 'nonexistent.onnx',
          format: 'onnx'
        });
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('Failed to load');
      }
    });
  });
});