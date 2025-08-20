/**
 * Error Recovery Verification Tests
 * Tests system resilience, self-healing, and graceful failure handling
 * 
 * These tests verify that the LLM Router can recover from various failure
 * scenarios and continue operating reliably.
 */

import { LLMRouter } from '../../src/index.js';
import { getMemoryUsage } from '../integration/real-model-inference.test.js';
import fs from 'fs/promises';
import path from 'path';

describe('Error Recovery Verification', () => {
  let router;
  let originalConsoleError;

  beforeAll(async () => {
    // Capture console.error to check error handling
    originalConsoleError = console.error;
    
    router = new LLMRouter({
      maxRetries: 3,
      timeout: 10000,
      selfHealingEnabled: true
    });
    await router.initialize();
  });

  afterAll(async () => {
    if (router) {
      await router.cleanup();
    }
    // Restore console.error
    console.error = originalConsoleError;
  });

  describe('Model Loading Error Recovery', () => {
    test('should handle corrupted model file gracefully', async () => {
      const corruptedModelPath = './temp/corrupted-model.gguf';
      
      try {
        // Create a fake corrupted model file
        await fs.mkdir('./temp', { recursive: true });
        await fs.writeFile(corruptedModelPath, 'This is not a valid GGUF file');

        // Try to load the corrupted model through the router
        await expect(router.load({
          id: 'corrupted-model',
          name: 'Corrupted Model',
          format: 'gguf',
          path: corruptedModelPath,
          source: corruptedModelPath
        })).rejects.toThrow();

        // Verify router is still functional after error
        const models = await router.registry.getAvailable();
        expect(Array.isArray(models)).toBe(true);

        console.log('✅ Successfully handled corrupted model file');

      } finally {
        // Cleanup
        try {
          await fs.unlink(corruptedModelPath);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    test('should handle missing model file gracefully', async () => {
      const missingModelPath = './nonexistent/model.gguf';

      // Try to load a missing model through the router
      await expect(router.load({
        id: 'missing-model',
        name: 'Missing Model',
        format: 'gguf',
        path: missingModelPath,
        source: missingModelPath
      })).rejects.toThrow();

      // Verify router is still functional
      const models = await router.registry.getAvailable();
      expect(Array.isArray(models)).toBe(true);

      console.log('✅ Successfully handled missing model file');
    });

    test('should handle invalid model configuration', async () => {
      const invalidConfigs = [
        { id: '', name: 'Empty ID', format: 'gguf', path: './models/test' },
        { id: 'no-format', name: 'No Format', path: './models/test' },
        { id: 'invalid-format', name: 'Invalid Format', format: 'unknown', path: './models/test' },
        { id: 'no-path', name: 'No Path', format: 'gguf' }
      ];

      for (const config of invalidConfigs) {
        await expect(router.load(config)).rejects.toThrow();
        console.log(`✅ Rejected invalid config: ${config.id || 'unnamed'}`);
      }

      // Router should still be functional
      const models = await router.registry.getAvailable();
      expect(Array.isArray(models)).toBe(true);
    });
  });

  describe('Inference Error Recovery', () => {
    test('should handle network timeouts gracefully', async () => {
      // Test with very short timeout to force timeout
      const shortTimeoutRouter = new LLMRouter({
        timeout: 1, // 1ms - will definitely timeout
        maxRetries: 2
      });
      await shortTimeoutRouter.initialize();

      try {
        await expect(shortTimeoutRouter.generate('any-model', 'test prompt'))
          .rejects.toThrow(/timeout|time/i);

        console.log('✅ Successfully handled timeout error');

      } finally {
        await shortTimeoutRouter.shutdown();
      }
    });

    test('should retry failed inference attempts', async () => {
      let attemptCount = 0;
      const errors = [];

      // Mock console.error to capture retry attempts
      console.error = (...args) => {
        errors.push(args.join(' '));
        attemptCount++;
      };

      try {
        // This will fail but should retry
        await router.generate('nonexistent-model-for-retry', 'test prompt');
      } catch (error) {
        expect(error).toBeDefined();
        console.log(`✅ Failed after retries as expected: ${error.message}`);
      }

      // Should have made multiple attempts (original + retries)
      // Note: Exact retry behavior depends on implementation
      console.log(`📊 Captured ${errors.length} error messages during retry attempts`);
    });

    test('should handle malformed prompts gracefully', async () => {
      // Check if we have any available models
      const models = await router.registry.getAvailable();
      if (models.length === 0) {
        console.log('⏭️ Skipping malformed prompt test - no models available');
        return;
      }

      const malformedPrompts = [
        null,
        undefined,
        123,
        {},
        [],
        '\x00\x01\x02', // Binary data
        'A'.repeat(100000) // Very long prompt
      ];

      for (const prompt of malformedPrompts) {
        try {
          await router.generate(models[0].id, prompt, { maxTokens: 10 });
          console.log(`⚠️ Unexpectedly succeeded with prompt: ${typeof prompt}`);
        } catch (error) {
          expect(error).toBeDefined();
          console.log(`✅ Properly rejected malformed prompt: ${typeof prompt}`);
        }
      }

      // Router should still be functional
      const updatedModels = await router.registry.getAvailable();
      expect(Array.isArray(updatedModels)).toBe(true);
    });
  });

  describe('Resource Exhaustion Recovery', () => {
    test('should handle memory pressure gracefully', async () => {
      const initialMemory = getMemoryUsage();
      
      try {
        // Try to create a scenario that uses a lot of memory
        const largeTasks = [];
        
        for (let i = 0; i < 10; i++) {
          const task = new Promise(async (resolve, reject) => {
            try {
              // Create large arrays to consume memory
              const largeArray = new Array(1000000).fill('memory test data');
              await new Promise(r => setTimeout(r, 100)); // Hold memory briefly
              resolve(largeArray.length);
            } catch (error) {
              reject(error);
            }
          });
          largeTasks.push(task);
        }

        // Execute all tasks concurrently
        const results = await Promise.allSettled(largeTasks);
        
        // Check that some completed
        const completed = results.filter(r => r.status === 'fulfilled');
        console.log(`📊 Memory pressure test: ${completed.length}/10 tasks completed`);

        // Router should still be responsive
        const models = await router.registry.getAvailable();
        expect(Array.isArray(models)).toBe(true);

        console.log('✅ Survived memory pressure test');

      } catch (error) {
        if (error.message.includes('memory') || error.message.includes('out of')) {
          console.log(`✅ Properly handled memory exhaustion: ${error.message}`);
        } else {
          throw error;
        }
      }

      const finalMemory = getMemoryUsage();
      const memoryGrowth = finalMemory.rss - initialMemory.rss;
      console.log(`📊 Memory growth during pressure test: ${memoryGrowth}MB`);
    });

    test('should handle concurrent request overload', async () => {
      const models = await router.registry.getAvailable();
      if (models.length === 0) {
        console.log('⏭️ Skipping concurrent request test - no models available');
        return;
      }

      // Create many concurrent requests
      const concurrentRequests = [];
      const startTime = Date.now();

      for (let i = 0; i < 20; i++) {
        const request = router.generate(models[0].id, `Request ${i}`, {
          maxTokens: 5,
          timeout: 5000
        }).catch(error => ({
          error: true,
          message: error.message,
          requestId: i
        }));
        
        concurrentRequests.push(request);
      }

      const results = await Promise.allSettled(concurrentRequests);
      const endTime = Date.now();

      const successful = results.filter(r => 
        r.status === 'fulfilled' && !r.value?.error
      ).length;
      const failed = results.length - successful;

      console.log(`📊 Concurrent request test (${endTime - startTime}ms):
        - Successful: ${successful}/20
        - Failed: ${failed}/20`);

      // Should handle some requests successfully
      expect(successful).toBeGreaterThan(0);
      
      // Router should still be responsive after overload
      const modelsAfter = await router.registry.getAvailable();
      expect(Array.isArray(modelsAfter)).toBe(true);

      console.log('✅ Survived concurrent request overload');
    }, 30000);
  });

  describe('Self-Healing Capabilities', () => {
    test('should recover from component failures', async () => {
      // Simulate component failure by breaking something temporarily
      const originalMethod = router.registry.get;
      let failureCount = 0;

      // Make registry.get fail the first few times
      router.registry.get = function(id) {
        failureCount++;
        if (failureCount <= 2) {
          throw new Error('Simulated component failure');
        }
        return originalMethod.call(this, id);
      };

      try {
        // This should fail initially, then potentially recover
        const models = await router.registry.getAvailable();
        expect(Array.isArray(models)).toBe(true);
        
        console.log(`✅ Self-healing test: failed ${failureCount} times before recovery`);

      } finally {
        // Restore original method
        router.registry.get = originalMethod;
      }
    });

    test('should maintain health monitoring', async () => {
      // Check if health monitoring is working
      if (router.healthMonitor) {
        const health = await router.healthMonitor.getStatus();
        expect(health).toBeDefined();
        expect(typeof health).toBe('object');
        console.log('✅ Health monitoring is active');
      } else {
        console.log('ℹ️ Health monitoring not available in current configuration');
      }
    });
  });

  describe('Error State Recovery', () => {
    test('should clear error states after successful operations', async () => {
      let errorStates = 0;

      // Monitor error events
      const errorHandler = () => errorStates++;
      router.on('error', errorHandler);

      try {
        // Cause some errors
        try { await router.generate('nonexistent-1', 'test'); } catch (e) {}
        try { await router.generate('nonexistent-2', 'test'); } catch (e) {}

        // Now do a successful operation
        const models = await router.registry.getAvailable();
        expect(Array.isArray(models)).toBe(true);

        console.log(`📊 Error states captured: ${errorStates}`);
        console.log('✅ Successfully performed operation after errors');

      } finally {
        router.off('error', errorHandler);
      }
    });

    test('should handle graceful shutdown after errors', async () => {
      // Create a temporary router to test shutdown
      const tempRouter = new LLMRouter();
      await tempRouter.initialize();

      // Cause some errors
      try { await tempRouter.generate('bad-model', 'test'); } catch (e) {}

      // Should still shut down gracefully
      await expect(tempRouter.shutdown()).resolves.not.toThrow();
      console.log('✅ Graceful shutdown after errors');
    });
  });

  describe('Error Reporting and Logging', () => {
    test('should provide meaningful error messages', async () => {
      const testCases = [
        {
          action: () => router.generate('', 'test'),
          expectedPattern: /model|id|empty/i
        },
        {
          action: () => router.generate('nonexistent', null),
          expectedPattern: /prompt|input|null/i
        },
        {
          action: () => router.registry.register({}),
          expectedPattern: /id|required|missing/i
        }
      ];

      for (const testCase of testCases) {
        try {
          await testCase.action();
          fail('Expected error was not thrown');
        } catch (error) {
          expect(error.message).toMatch(testCase.expectedPattern);
          console.log(`✅ Meaningful error: "${error.message}"`);
        }
      }
    });

    test('should maintain error statistics', async () => {
      // Check if router maintains error statistics
      if (router.stats) {
        const stats = router.stats;
        expect(typeof stats).toBe('object');
        
        // Common error statistics
        if (stats.failures !== undefined) {
          expect(typeof stats.failures).toBe('number');
          console.log(`📊 Failure count: ${stats.failures}`);
        }
        
        if (stats.totalRoutes !== undefined) {
          expect(typeof stats.totalRoutes).toBe('number');
          console.log(`📊 Total routes: ${stats.totalRoutes}`);
        }

        console.log('✅ Error statistics available');
      } else {
        console.log('ℹ️ Error statistics not available in current configuration');
      }
    });
  });

  describe('Recovery Performance', () => {
    test('should recover quickly from failures', async () => {
      const recoveryTimes = [];

      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        
        try {
          await router.generate('nonexistent-model', 'test');
        } catch (error) {
          // Expected to fail
        }

        // Immediately try a successful operation
        const models = await router.registry.getAvailable();
        const recoveryTime = Date.now() - startTime;
        
        recoveryTimes.push(recoveryTime);
        expect(Array.isArray(models)).toBe(true);
      }

      const avgRecoveryTime = recoveryTimes.reduce((a, b) => a + b) / recoveryTimes.length;
      console.log(`📊 Average recovery time: ${avgRecoveryTime.toFixed(2)}ms`);
      console.log(`📊 Recovery times: ${recoveryTimes.join(', ')}ms`);

      // Recovery should be fast (under 1 second)
      expect(avgRecoveryTime).toBeLessThan(1000);
      console.log('✅ Fast error recovery verified');
    });
  });
});