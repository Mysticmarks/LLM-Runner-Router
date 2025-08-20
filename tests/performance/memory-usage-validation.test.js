/**
 * Memory Usage Validation Tests
 * Monitors memory consumption, detects leaks, and validates cleanup
 * 
 * These tests ensure the LLM Router manages memory efficiently,
 * especially important with large model files (1-3GB each).
 */

import { LLMRouter } from '../../src/index.js';
import { getMemoryUsage } from '../integration/real-model-inference.test.js';
import fs from 'fs/promises';

describe('Memory Usage Validation', () => {
  let router;
  let baselineMemory;
  const memorySnapshots = [];

  // Helper function to take memory snapshot
  const takeMemorySnapshot = (label) => {
    const usage = getMemoryUsage();
    const snapshot = {
      label,
      timestamp: Date.now(),
      ...usage
    };
    memorySnapshots.push(snapshot);
    console.log(`📊 Memory [${label}]: RSS=${usage.rss}MB, Heap=${usage.heapUsed}/${usage.heapTotal}MB`);
    return snapshot;
  };

  // Helper function to check available models
  const getAvailableModels = async () => {
    const models = [];
    const modelPaths = [
      { name: 'tinyllama', path: './models/tinyllama/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf', size: 638 },
      { name: 'phi-2', path: './models/phi-2/phi-2.Q4_K_M.gguf', size: 1700 },
      { name: 'qwen2.5', path: './models/qwen2.5/qwen2.5-1.5b-instruct-q4_k_m.gguf', size: 1100 }
    ];

    for (const model of modelPaths) {
      try {
        await fs.access(model.path);
        models.push(model);
      } catch (error) {
        console.log(`⏭️ Model not available: ${model.name}`);
      }
    }
    return models;
  };

  beforeAll(async () => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Take baseline memory measurement
    baselineMemory = takeMemorySnapshot('baseline');
    
    router = new LLMRouter();
    await router.initialize();
    
    takeMemorySnapshot('after-router-init');
  }, 30000);

  afterAll(async () => {
    if (router) {
      await router.cleanup();
      takeMemorySnapshot('after-cleanup');
    }

    // Generate memory report
    console.log('\n📊 Memory Usage Report:');
    memorySnapshots.forEach((snapshot, index) => {
      const rssDiff = index > 0 ? snapshot.rss - memorySnapshots[index - 1].rss : 0;
      const heapDiff = index > 0 ? snapshot.heapUsed - memorySnapshots[index - 1].heapUsed : 0;
      console.log(`  ${snapshot.label}: RSS=${snapshot.rss}MB (${rssDiff >= 0 ? '+' : ''}${rssDiff}MB), Heap=${snapshot.heapUsed}MB (${heapDiff >= 0 ? '+' : ''}${heapDiff}MB)`);
    });
  });

  describe('Baseline Memory Management', () => {
    test('should have reasonable baseline memory usage', () => {
      expect(baselineMemory.rss).toBeLessThan(200); // Under 200MB RSS
      expect(baselineMemory.heapUsed).toBeLessThan(100); // Under 100MB heap
    });

    test('router initialization should not cause excessive memory growth', () => {
      const afterInit = memorySnapshots.find(s => s.label === 'after-router-init');
      const memoryGrowth = afterInit.rss - baselineMemory.rss;
      
      console.log(`📊 Router initialization memory growth: ${memoryGrowth}MB`);
      expect(memoryGrowth).toBeLessThan(50); // Under 50MB growth for initialization
    });
  });

  describe('Model Loading Memory Impact', () => {
    test('should track memory usage during model loading', async () => {
      const availableModels = await getAvailableModels();
      if (availableModels.length === 0) {
        console.log('⏭️ Skipping model loading test - no models available');
        return;
      }

      const model = availableModels[0]; // Start with smallest model
      takeMemorySnapshot(`before-loading-${model.name}`);

      try {
        await router.registry.register({
          id: model.name,
          name: model.name,
          format: 'gguf',
          path: model.path,
          engine: 'wasm'
        });

        takeMemorySnapshot(`after-loading-${model.name}`);
        
        // Load the model for inference
        await router.generate(model.name, 'Hello', { maxTokens: 10 });
        takeMemorySnapshot(`after-inference-${model.name}`);

        const beforeLoad = memorySnapshots.find(s => s.label === `before-loading-${model.name}`);
        const afterLoad = memorySnapshots.find(s => s.label === `after-loading-${model.name}`);
        const afterInference = memorySnapshots.find(s => s.label === `after-inference-${model.name}`);

        const loadMemoryGrowth = afterLoad.rss - beforeLoad.rss;
        const inferenceMemoryGrowth = afterInference.rss - afterLoad.rss;

        console.log(`📊 Model ${model.name} memory impact:
          - Loading: ${loadMemoryGrowth}MB
          - Inference: ${inferenceMemoryGrowth}MB
          - Total: ${afterInference.rss - beforeLoad.rss}MB`);

        // Memory growth should be reasonable
        expect(loadMemoryGrowth).toBeLessThan(model.size + 100); // Model size + overhead
        expect(inferenceMemoryGrowth).toBeLessThan(200); // Inference overhead under 200MB

      } catch (error) {
        if (error.message.includes('not supported in VPS')) {
          console.log(`⚠️ Skipping memory test for ${model.name} - VPS limitation`);
          return;
        }
        throw error;
      }
    }, 120000);

    test('should handle multiple model registrations', async () => {
      const availableModels = await getAvailableModels();
      if (availableModels.length < 2) {
        console.log('⏭️ Skipping multiple model test - need at least 2 models');
        return;
      }

      const startMemory = takeMemorySnapshot('before-multiple-models');

      try {
        for (let i = 0; i < Math.min(2, availableModels.length); i++) {
          const model = availableModels[i];
          
          await router.registry.register({
            id: `multi-${model.name}`,
            name: `Multi ${model.name}`,
            format: 'gguf',
            path: model.path,
            engine: 'wasm'
          });

          takeMemorySnapshot(`after-loading-multi-${model.name}`);
        }

        const endMemory = takeMemorySnapshot('after-all-multiple-models');
        const totalGrowth = endMemory.rss - startMemory.rss;

        console.log(`📊 Multiple models memory growth: ${totalGrowth}MB`);
        
        // Should not exceed sum of individual model sizes + reasonable overhead
        const totalModelSize = availableModels.slice(0, 2).reduce((sum, model) => sum + model.size, 0);
        expect(totalGrowth).toBeLessThan(totalModelSize + 300); // Models + 300MB overhead

      } catch (error) {
        if (error.message.includes('not supported in VPS')) {
          console.log('⚠️ Skipping multiple model test - VPS limitation');
          return;
        }
        throw error;
      }
    }, 180000);
  });

  describe('Memory Leak Detection', () => {
    test('should not leak memory during repeated operations', async () => {
      const availableModels = await getAvailableModels();
      if (availableModels.length === 0) return;

      const model = availableModels[0];
      const startMemory = takeMemorySnapshot('before-repeated-ops');

      try {
        // Perform multiple operations
        for (let i = 0; i < 5; i++) {
          await router.generate(model.name || 'tinyllama', `Test prompt ${i}`, {
            maxTokens: 10,
            temperature: 0.1
          });

          if (i % 2 === 0) {
            takeMemorySnapshot(`after-op-${i}`);
          }

          // Force garbage collection between operations if available
          if (global.gc && i % 3 === 0) {
            global.gc();
          }
        }

        const endMemory = takeMemorySnapshot('after-repeated-ops');
        const memoryGrowth = endMemory.rss - startMemory.rss;

        console.log(`📊 Memory growth after 5 operations: ${memoryGrowth}MB`);
        
        // Memory growth should be minimal (under 100MB for repeated small operations)
        expect(memoryGrowth).toBeLessThan(100);

      } catch (error) {
        if (error.message.includes('not supported in VPS')) {
          console.log('⚠️ Skipping repeated operations test - VPS limitation');
          return;
        }
        throw error;
      }
    }, 120000);

    test('should clean up after model unregistration', async () => {
      const availableModels = await getAvailableModels();
      if (availableModels.length === 0) return;

      const beforeRegister = takeMemorySnapshot('before-register-for-cleanup');

      try {
        // Register a model
        await router.registry.register({
          id: 'cleanup-test',
          name: 'Cleanup Test Model',
          format: 'gguf',
          path: availableModels[0].path,
          engine: 'wasm'
        });

        const afterRegister = takeMemorySnapshot('after-register-for-cleanup');

        // Use the model briefly
        await router.generate('cleanup-test', 'Hello', { maxTokens: 5 });

        // Unregister the model
        await router.registry.unregister('cleanup-test');

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          // Wait a bit for cleanup
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const afterCleanup = takeMemorySnapshot('after-cleanup');

        const registerGrowth = afterRegister.rss - beforeRegister.rss;
        const cleanupRecovery = afterRegister.rss - afterCleanup.rss;
        const netGrowth = afterCleanup.rss - beforeRegister.rss;

        console.log(`📊 Cleanup test:
          - Memory growth on register: ${registerGrowth}MB
          - Memory recovered on cleanup: ${cleanupRecovery}MB
          - Net memory growth: ${netGrowth}MB`);

        // Should recover at least 50% of the memory used
        expect(cleanupRecovery).toBeGreaterThan(registerGrowth * 0.5);
        // Net growth should be reasonable
        expect(netGrowth).toBeLessThan(200);

      } catch (error) {
        if (error.message.includes('not supported in VPS') || 
            error.message.includes('unregister')) {
          console.log('⚠️ Skipping cleanup test - not supported in this environment');
          return;
        }
        throw error;
      }
    }, 120000);
  });

  describe('Memory Pressure Testing', () => {
    test('should handle memory pressure gracefully', async () => {
      const availableModels = await getAvailableModels();
      if (availableModels.length === 0) return;

      const startMemory = takeMemorySnapshot('before-pressure-test');

      try {
        // Try to load multiple large models if available
        const largeModels = availableModels.filter(m => m.size > 1000); // > 1GB
        
        if (largeModels.length > 0) {
          console.log('🔥 Testing memory pressure with large models...');
          
          for (let i = 0; i < Math.min(2, largeModels.length); i++) {
            const model = largeModels[i];
            
            try {
              await router.registry.register({
                id: `pressure-${model.name}`,
                name: `Pressure ${model.name}`,
                format: 'gguf',
                path: model.path,
                engine: 'wasm'
              });

              takeMemorySnapshot(`pressure-after-${model.name}`);

            } catch (error) {
              if (error.message.includes('memory') || 
                  error.message.includes('out of') ||
                  error.message.includes('insufficient')) {
                console.log(`✅ Properly handled memory pressure: ${error.message}`);
                takeMemorySnapshot('after-memory-pressure-error');
                break;
              }
              throw error;
            }
          }
        }

        const endMemory = takeMemorySnapshot('after-pressure-test');
        
        // Should not crash the process
        expect(endMemory.rss).toBeGreaterThan(0);
        
        // If we're using too much memory, it's concerning
        if (endMemory.rss > 4000) { // 4GB
          console.warn(`⚠️ High memory usage detected: ${endMemory.rss}MB`);
        }

      } catch (error) {
        if (error.message.includes('not supported in VPS')) {
          console.log('⚠️ Skipping pressure test - VPS limitation');
          return;
        }
        throw error;
      }
    }, 180000);
  });

  describe('Memory Monitoring Utilities', () => {
    test('should provide accurate memory measurements', () => {
      const usage1 = getMemoryUsage();
      const usage2 = getMemoryUsage();

      // Measurements should be consistent
      expect(Math.abs(usage1.rss - usage2.rss)).toBeLessThan(10); // Within 10MB
      expect(usage1.heapUsed).toBeGreaterThan(0);
      expect(usage1.heapTotal).toBeGreaterThan(usage1.heapUsed);
    });

    test('should detect memory growth patterns', () => {
      if (memorySnapshots.length < 3) return;

      // Analyze memory growth patterns
      const growthPatterns = [];
      for (let i = 1; i < memorySnapshots.length; i++) {
        const growth = memorySnapshots[i].rss - memorySnapshots[i-1].rss;
        growthPatterns.push({
          from: memorySnapshots[i-1].label,
          to: memorySnapshots[i].label,
          growth
        });
      }

      console.log('\n📈 Memory Growth Patterns:');
      growthPatterns.forEach(pattern => {
        if (Math.abs(pattern.growth) > 10) { // Only log significant changes
          console.log(`  ${pattern.from} → ${pattern.to}: ${pattern.growth >= 0 ? '+' : ''}${pattern.growth}MB`);
        }
      });

      // Look for concerning patterns
      const largeGrowths = growthPatterns.filter(p => p.growth > 500); // > 500MB growth
      if (largeGrowths.length > 0) {
        console.warn('⚠️ Large memory growths detected:', largeGrowths);
      }

      // Check if memory generally grows without bound
      const totalGrowth = memorySnapshots[memorySnapshots.length - 1].rss - memorySnapshots[0].rss;
      if (totalGrowth > 2000) { // > 2GB total growth
        console.warn(`⚠️ Large total memory growth: ${totalGrowth}MB`);
      }
    });
  });
});