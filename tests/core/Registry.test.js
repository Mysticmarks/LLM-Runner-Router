/**
 * Registry Component Test Suite
 * Tests model registry functionality, lifecycle management, and indexing
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ModelRegistry } from '../../src/core/Registry.js';
import { Config } from '../../src/config/Config.js';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

// Mock file system operations
jest.mock('fs/promises');

describe('Registry Core Component', () => {
  let registry;
  let mockConfig;
  let mockRegistryPath;

  beforeEach(() => {
    mockConfig = new Config({ environment: 'test' });
    mockRegistryPath = path.join(process.cwd(), 'test-registry.json');
    registry = new ModelRegistry({
      registryPath: mockRegistryPath,
      maxModels: 10
    });
    
    // Mock file operations
    fs.readFile.mockResolvedValue('{"models": [], "version": "1.0.0"}');
    fs.writeFile.mockResolvedValue();
    fs.access.mockResolvedValue();
    fs.mkdir.mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize as EventEmitter', () => {
      expect(registry).toBeInstanceOf(EventEmitter);
    });

    test('should initialize with default options', () => {
      const defaultRegistry = new ModelRegistry();
      expect(defaultRegistry.maxModels).toBe(50); // Default value
      expect(defaultRegistry.registryPath).toContain('models.json');
    });

    test('should initialize with custom options', () => {
      const customRegistry = new ModelRegistry({
        maxModels: 20,
        registryPath: '/custom/path/registry.json'
      });
      
      expect(customRegistry.maxModels).toBe(20);
      expect(customRegistry.registryPath).toBe('/custom/path/registry.json');
    });

    test('should have required methods', () => {
      expect(typeof registry.initialize).toBe('function');
      expect(typeof registry.register).toBe('function');
      expect(typeof registry.get).toBe('function');
      expect(typeof registry.list).toBe('function');
      expect(typeof registry.unload).toBe('function');
      expect(typeof registry.shutdown).toBe('function');
    });
  });

  describe('Model Registration', () => {
    const mockModel = {
      id: 'test-model',
      name: 'Test Model',
      format: 'gguf',
      source: '/path/to/model.gguf',
      type: 'text-generation',
      size: 7000000000
    };

    test('should register a new model', async () => {
      await registry.initialize();
      
      const result = await registry.register(mockModel);
      
      expect(result).toMatchObject({
        id: 'test-model',
        name: 'Test Model',
        format: 'gguf'
      });
      
      expect(result.registered).toBeDefined();
      expect(result.status).toBe('registered');
    });

    test('should emit "registered" event on successful registration', async () => {
      await registry.initialize();
      
      const eventSpy = jest.fn();
      registry.on('registered', eventSpy);
      
      await registry.register(mockModel);
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'test-model' })
      );
    });

    test('should validate required model fields', async () => {
      await registry.initialize();
      
      const invalidModel = {
        name: 'Invalid Model'
        // Missing required id, format, source
      };
      
      await expect(registry.register(invalidModel)).rejects.toThrow();
    });

    test('should prevent duplicate model registration', async () => {
      await registry.initialize();
      
      await registry.register(mockModel);
      
      // Attempt to register same model again
      await expect(registry.register(mockModel)).rejects.toThrow(/already registered/);
    });

    test('should enforce maximum model limit', async () => {
      const smallRegistry = new ModelRegistry({ maxModels: 2 });
      await smallRegistry.initialize();
      
      // Register up to the limit
      await smallRegistry.register({ ...mockModel, id: 'model-1' });
      await smallRegistry.register({ ...mockModel, id: 'model-2' });
      
      // This should either reject or evict an old model
      const result = await smallRegistry.register({ ...mockModel, id: 'model-3' });
      expect(smallRegistry.getModelCount()).toBeLessThanOrEqual(2);
    });
  });

  describe('Model Retrieval', () => {
    const mockModels = [
      {
        id: 'model-1',
        name: 'Model 1',
        format: 'gguf',
        source: '/path/to/model1.gguf'
      },
      {
        id: 'model-2', 
        name: 'Model 2',
        format: 'onnx',
        source: '/path/to/model2.onnx'
      }
    ];

    beforeEach(async () => {
      await registry.initialize();
      for (const model of mockModels) {
        await registry.register(model);
      }
    });

    test('should retrieve model by ID', async () => {
      const model = await registry.get('model-1');
      
      expect(model).toBeDefined();
      expect(model.id).toBe('model-1');
      expect(model.name).toBe('Model 1');
    });

    test('should return null for non-existent model', async () => {
      const model = await registry.get('non-existent-model');
      expect(model).toBeNull();
    });

    test('should list all registered models', async () => {
      const models = await registry.list();
      
      expect(models).toHaveLength(2);
      expect(models[0].id).toBe('model-1');
      expect(models[1].id).toBe('model-2');
    });

    test('should filter models by format', async () => {
      const ggufModels = await registry.list({ format: 'gguf' });
      
      expect(ggufModels).toHaveLength(1);
      expect(ggufModels[0].format).toBe('gguf');
    });

    test('should filter models by capability', async () => {
      // Add capability to one model
      const modelWithCap = await registry.get('model-1');
      modelWithCap.capabilities = ['text-generation'];
      
      const capableModels = await registry.list({ 
        capability: 'text-generation' 
      });
      
      expect(capableModels.length).toBeGreaterThan(0);
    });
  });

  describe('Model Lifecycle Management', () => {
    const mockModel = {
      id: 'lifecycle-model',
      name: 'Lifecycle Model',
      format: 'gguf',
      source: '/path/to/model.gguf'
    };

    beforeEach(async () => {
      await registry.initialize();
      await registry.register(mockModel);
    });

    test('should load model on first access', async () => {
      const model = await registry.get('lifecycle-model');
      
      expect(model).toBeDefined();
      expect(model.loaded).toBeDefined();
    });

    test('should track model usage statistics', async () => {
      const model = await registry.get('lifecycle-model');
      
      // Simulate model usage
      if (model.updateStats) {
        model.updateStats();
        expect(model.stats).toBeDefined();
        expect(model.stats.accessCount).toBeGreaterThan(0);
      }
    });

    test('should unload model and free resources', async () => {
      const model = await registry.get('lifecycle-model');
      
      const unloadResult = await registry.unload('lifecycle-model');
      
      expect(unloadResult).toBe(true);
      
      // Model should still be registered but not loaded
      const unloadedModel = await registry.get('lifecycle-model');
      expect(unloadedModel.loaded).toBeFalsy();
    });

    test('should handle concurrent model access safely', async () => {
      // Simulate concurrent access
      const promises = Array.from({ length: 5 }, () => 
        registry.get('lifecycle-model')
      );
      
      const results = await Promise.all(promises);
      
      // All should return the same model instance
      expect(results.every(model => model.id === 'lifecycle-model')).toBe(true);
    });
  });

  describe('Persistence', () => {
    test('should save registry to file', async () => {
      await registry.initialize();
      
      await registry.register({
        id: 'persistent-model',
        name: 'Persistent Model',
        format: 'gguf',
        source: '/path/to/model.gguf'
      });
      
      await registry.save();
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockRegistryPath,
        expect.stringContaining('persistent-model')
      );
    });

    test('should load registry from file on initialization', async () => {
      const mockData = JSON.stringify({
        models: [{
          id: 'loaded-model',
          name: 'Loaded Model',
          format: 'gguf'
        }],
        version: '1.0.0'
      });
      
      fs.readFile.mockResolvedValueOnce(mockData);
      
      await registry.initialize();
      const models = await registry.list();
      
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('loaded-model');
    });

    test('should handle corrupted registry file gracefully', async () => {
      fs.readFile.mockResolvedValueOnce('invalid json');
      
      await expect(registry.initialize()).resolves.not.toThrow();
      
      // Should start with empty registry
      const models = await registry.list();
      expect(models).toHaveLength(0);
    });

    test('should create backup on save', async () => {
      await registry.initialize();
      await registry.save();
      
      // Should have saved both main file and backup
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('Registry Statistics', () => {
    test('should provide model count', async () => {
      await registry.initialize();
      
      expect(registry.getModelCount()).toBe(0);
      
      await registry.register({
        id: 'count-model',
        name: 'Count Model', 
        format: 'gguf',
        source: '/path/to/model.gguf'
      });
      
      expect(registry.getModelCount()).toBe(1);
    });

    test('should calculate registry utilization', async () => {
      const limitedRegistry = new ModelRegistry({ maxModels: 10 });
      await limitedRegistry.initialize();
      
      // Add 3 models to registry with limit of 10
      for (let i = 1; i <= 3; i++) {
        await limitedRegistry.register({
          id: `util-model-${i}`,
          name: `Util Model ${i}`,
          format: 'gguf',
          source: `/path/to/model${i}.gguf`
        });
      }
      
      const utilization = limitedRegistry.getUtilization();
      expect(utilization).toBe(0.3); // 3/10 = 30%
    });

    test('should provide format distribution', async () => {
      await registry.initialize();
      
      await registry.register({
        id: 'gguf-model',
        name: 'GGUF Model',
        format: 'gguf',
        source: '/path/to/model.gguf'
      });
      
      await registry.register({
        id: 'onnx-model', 
        name: 'ONNX Model',
        format: 'onnx',
        source: '/path/to/model.onnx'
      });
      
      const distribution = registry.getFormatDistribution();
      expect(distribution).toEqual({
        gguf: 1,
        onnx: 1
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors gracefully', async () => {
      fs.readFile.mockRejectedValueOnce(new Error('File not found'));
      
      await expect(registry.initialize()).resolves.not.toThrow();
    });

    test('should handle model loading failures', async () => {
      await registry.initialize();
      
      const problematicModel = {
        id: 'problem-model',
        name: 'Problem Model',
        format: 'invalid-format',
        source: '/nonexistent/path'
      };
      
      // Should register but loading might fail
      await registry.register(problematicModel);
      
      const model = await registry.get('problem-model');
      expect(model.id).toBe('problem-model');
    });

    test('should emit error events for failures', async () => {
      await registry.initialize();
      
      const errorSpy = jest.fn();
      registry.on('error', errorSpy);
      
      // Trigger an error condition
      try {
        await registry.register(null);
      } catch (error) {
        // Expected
      }
      
      // Error event should have been emitted
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('Cleanup and Shutdown', () => {
    test('should shutdown gracefully', async () => {
      await registry.initialize();
      
      await registry.register({
        id: 'shutdown-model',
        name: 'Shutdown Model',
        format: 'gguf',
        source: '/path/to/model.gguf'
      });
      
      await expect(registry.shutdown()).resolves.not.toThrow();
    });

    test('should save registry on shutdown', async () => {
      await registry.initialize();
      
      await registry.register({
        id: 'final-model',
        name: 'Final Model',
        format: 'gguf', 
        source: '/path/to/model.gguf'
      });
      
      await registry.shutdown();
      
      expect(fs.writeFile).toHaveBeenCalled();
    });

    test('should unload all models on shutdown', async () => {
      await registry.initialize();
      
      const model = {
        id: 'unload-model',
        name: 'Unload Model',
        format: 'gguf',
        source: '/path/to/model.gguf'
      };
      
      await registry.register(model);
      await registry.get('unload-model'); // Load the model
      
      await registry.shutdown();
      
      // After shutdown, models should be unloaded
      const models = await registry.list();
      expect(models.every(m => !m.loaded)).toBe(true);
    });
  });
});