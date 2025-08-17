/**
 * Working tests that demonstrate actual functionality
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

describe('Working Tests', () => {
  
  describe('Core Classes', () => {
    it('should import Router class', async () => {
      const Router = (await import('../src/core/Router.js')).default;
      expect(Router).toBeDefined();
      const router = new Router({ strategy: 'balanced' });
      expect(router.config.strategy).toBe('balanced');
    });
    
    it('should import Registry class', async () => {
      const Registry = (await import('../src/core/Registry.js')).default;
      expect(Registry).toBeDefined();
      const registry = new Registry();
      expect(registry.models).toBeInstanceOf(Map);
    });
    
    it('should import Pipeline class', async () => {
      const Pipeline = (await import('../src/core/Pipeline.js')).default;
      expect(Pipeline).toBeDefined();
      const pipeline = new Pipeline();
      expect(pipeline.stages).toBeInstanceOf(Array);
    });
  });
  
  describe('Loaders', () => {
    it('should import MockLoader', async () => {
      const MockLoader = (await import('../src/loaders/MockLoader.js')).default;
      expect(MockLoader).toBeDefined();
      const loader = new MockLoader();
      expect(loader.name).toBe('MockLoader');
    });
    
    it('should import SimpleLoader', async () => {
      const SimpleLoader = (await import('../src/loaders/SimpleLoader.js')).default;
      expect(SimpleLoader).toBeDefined();
      const loader = new SimpleLoader();
      expect(loader.name).toBe('SimpleLoader');
    });
  });
  
  describe('Utils', () => {
    it('should import Logger', async () => {
      const { Logger } = await import('../src/utils/Logger.js');
      expect(Logger).toBeDefined();
      const logger = new Logger('Test');
      expect(logger.context).toBe('Test');
    });
    
    it('should import Validator', async () => {
      const Validator = (await import('../src/utils/Validator.js')).default;
      expect(Validator).toBeDefined();
      const result = Validator.validatePrompt('test prompt');
      expect(result.valid).toBe(true);
    });
  });
  
  describe('Config', () => {
    it('should import Config', async () => {
      const Config = (await import('../src/config/Config.js')).default;
      expect(Config).toBeDefined();
      const config = new Config();
      expect(config.get('environment')).toBeDefined();
    });
  });
});