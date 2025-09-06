/**
 * Router Component Test Suite
 * Tests core routing functionality, model selection, and strategies
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import Router from '../../src/core/Router.js';
import { Config } from '../../src/config/Config.js';

describe('Router Core Component', () => {
  let router;
  let mockConfig;

  beforeEach(() => {
    mockConfig = new Config({ environment: 'test' });
    router = new Router(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with default strategy', () => {
      expect(router.strategy).toBe('balanced');
      expect(router.config).toBe(mockConfig);
    });

    test('should initialize with custom strategy', () => {
      const customRouter = new Router(mockConfig, { strategy: 'quality-first' });
      expect(customRouter.strategy).toBe('quality-first');
    });

    test('should have required methods', () => {
      expect(typeof router.select).toBe('function');
      expect(typeof router.detectFormat).toBe('function');
      expect(typeof router.selectLoader).toBe('function');
      expect(typeof router.computeScores).toBe('function');
    });
  });

  describe('Format Detection', () => {
    test('should detect GGUF format from extension', () => {
      const spec = { source: '/path/to/model.gguf' };
      expect(router.detectFormat(spec)).toBe('gguf');
    });

    test('should detect ONNX format from extension', () => {
      const spec = { source: '/path/to/model.onnx' };
      expect(router.detectFormat(spec)).toBe('onnx');
    });

    test('should detect safetensors format from extension', () => {
      const spec = { source: '/path/to/model.safetensors' };
      expect(router.detectFormat(spec)).toBe('safetensors');
    });

    test('should use explicit format when provided', () => {
      const spec = { 
        source: '/path/to/model.bin', 
        format: 'gguf' 
      };
      expect(router.detectFormat(spec)).toBe('gguf');
    });

    test('should detect HuggingFace pattern', () => {
      const spec = { source: 'microsoft/DialoGPT-medium' };
      expect(router.detectFormat(spec)).toBe('huggingface');
    });

    test('should detect mock protocol', () => {
      const spec = { source: 'mock://test-model' };
      expect(router.detectFormat(spec)).toBe('mock');
    });

    test('should fallback to safetensors for unknown formats', () => {
      const spec = { source: '/path/to/model.unknown' };
      expect(router.detectFormat(spec)).toBe('safetensors');
    });
  });

  describe('Loader Selection', () => {
    test('should select correct loader for GGUF format', () => {
      const loader = router.selectLoader('gguf');
      expect(loader.name).toBe('GGUFLoader');
    });

    test('should select correct loader for ONNX format', () => {
      const loader = router.selectLoader('onnx');
      expect(loader.name).toBe('ONNXLoader');
    });

    test('should select correct loader for HuggingFace format', () => {
      const loader = router.selectLoader('huggingface');
      expect(loader.name).toBe('HFLoader');
    });

    test('should handle unknown format gracefully', () => {
      const loader = router.selectLoader('unknown-format');
      expect(loader.name).toBe('SimpleLoader'); // Default fallback
    });
  });

  describe('Model Selection Strategies', () => {
    const mockModels = [
      {
        id: 'model-1',
        name: 'High Quality Model',
        format: 'gguf',
        size: 7000000000, // 7B parameters
        quality: 0.9,
        speed: 0.6,
        cost: 0.8,
        capabilities: ['text-generation', 'chat']
      },
      {
        id: 'model-2', 
        name: 'Fast Model',
        format: 'onnx',
        size: 1000000000, // 1B parameters
        quality: 0.6,
        speed: 0.9,
        cost: 0.3,
        capabilities: ['text-generation']
      },
      {
        id: 'model-3',
        name: 'Balanced Model',
        format: 'safetensors',
        size: 3000000000, // 3B parameters
        quality: 0.75,
        speed: 0.75,
        cost: 0.5,
        capabilities: ['text-generation', 'chat']
      }
    ];

    test('should select highest quality model with quality-first strategy', () => {
      router.strategy = 'quality-first';
      const scores = router.computeScores(mockModels, 'test prompt');
      
      // Should prioritize model-1 (highest quality: 0.9)
      expect(scores[0].model.id).toBe('model-1');
      expect(scores[0].score).toBeGreaterThan(scores[1].score);
    });

    test('should select fastest model with speed-priority strategy', () => {
      router.strategy = 'speed-priority';
      const scores = router.computeScores(mockModels, 'test prompt');
      
      // Should prioritize model-2 (highest speed: 0.9)
      expect(scores[0].model.id).toBe('model-2');
    });

    test('should select cost-effective model with cost-optimized strategy', () => {
      router.strategy = 'cost-optimized';
      const scores = router.computeScores(mockModels, 'test prompt');
      
      // Should prioritize model-2 (lowest cost: 0.3)
      expect(scores[0].model.id).toBe('model-2');
    });

    test('should balance metrics with balanced strategy', () => {
      router.strategy = 'balanced';
      const scores = router.computeScores(mockModels, 'test prompt');
      
      // Model-3 should score well with balanced metrics
      const model3Score = scores.find(s => s.model.id === 'model-3');
      expect(model3Score).toBeDefined();
      expect(model3Score.score).toBeGreaterThan(0.5);
    });
  });

  describe('Route Caching', () => {
    test('should cache route selections', async () => {
      const mockModels = [
        { id: 'model-1', name: 'Test Model', quality: 0.8 }
      ];
      
      const prompt = 'test prompt';
      const firstResult = await router.select(mockModels, prompt);
      const secondResult = await router.select(mockModels, prompt);
      
      // Should return same result from cache
      expect(firstResult).toEqual(secondResult);
    });

    test('should respect cache TTL', async () => {
      // This would require mocking time, but tests basic caching concept
      const router = new Router(mockConfig, { cacheTTL: 1000 });
      expect(router.cacheTTL).toBe(1000);
    });
  });

  describe('Error Handling', () => {
    test('should handle empty model list gracefully', () => {
      expect(() => {
        router.computeScores([], 'test prompt');
      }).not.toThrow();
      
      const scores = router.computeScores([], 'test prompt');
      expect(scores).toEqual([]);
    });

    test('should handle invalid model data gracefully', () => {
      const invalidModels = [
        { id: 'invalid-model' }, // Missing required fields
        null,
        undefined
      ];
      
      expect(() => {
        router.computeScores(invalidModels, 'test prompt');
      }).not.toThrow();
    });

    test('should handle missing prompt gracefully', () => {
      const mockModels = [{ id: 'model-1', name: 'Test Model' }];
      
      expect(() => {
        router.computeScores(mockModels, '');
      }).not.toThrow();
      
      expect(() => {
        router.computeScores(mockModels, null);
      }).not.toThrow();
    });
  });

  describe('Integration Points', () => {
    test('should integrate with Config properly', () => {
      expect(router.config).toBeInstanceOf(Config);
      expect(router.config.get('strategy')).toBeDefined();
    });

    test('should handle strategy changes', () => {
      router.strategy = 'quality-first';
      expect(router.strategy).toBe('quality-first');
      
      router.strategy = 'speed-priority';  
      expect(router.strategy).toBe('speed-priority');
    });
  });
});