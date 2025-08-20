/**
 * Performance Regression Detection Tests
 * Monitors performance metrics over time and detects degradations
 * 
 * These tests establish performance baselines and detect when system
 * performance degrades beyond acceptable thresholds.
 */

import { LLMRouter } from '../../src/index.js';
import { getMemoryUsage } from '../integration/real-model-inference.test.js';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';

describe('Performance Regression Detection', () => {
  let router;
  let performanceBaseline;
  const performanceMetrics = [];
  
  // Performance thresholds (adjust based on actual system capabilities)
  const PERFORMANCE_THRESHOLDS = {
    routerInitTime: 2000,        // 2 seconds
    modelRegistrationTime: 5000,  // 5 seconds  
    inferenceTime: 30000,        // 30 seconds
    memoryGrowthPerOperation: 100, // 100MB max growth per operation
    tokensPerSecond: 1.0,        // Minimum 1 token/second
    maxMemoryUsage: 2000,        // 2GB max memory
    errorRecoveryTime: 1000      // 1 second max recovery
  };

  beforeAll(async () => {
    // Load existing performance baseline if available
    try {
      const baselineData = await fs.readFile('./tests/performance/baseline.json', 'utf8');
      performanceBaseline = JSON.parse(baselineData);
      console.log('📊 Loaded existing performance baseline');
    } catch (error) {
      console.log('📊 No existing baseline found, will create new one');
      performanceBaseline = null;
    }

    router = new LLMRouter();
    const initStart = performance.now();
    await router.initialize();
    const initTime = performance.now() - initStart;

    // Record router initialization performance
    recordMetric('router_init_time', initTime);

    console.log(`📊 Router initialization: ${initTime.toFixed(2)}ms`);
  }, 30000);

  afterAll(async () => {
    if (router) {
      await router.cleanup();
    }

    // Save performance baseline for future tests
    const currentBaseline = calculateBaseline(performanceMetrics);
    try {
      await fs.mkdir('./tests/performance', { recursive: true });
      await fs.writeFile(
        './tests/performance/baseline.json',
        JSON.stringify(currentBaseline, null, 2)
      );
      console.log('📊 Saved performance baseline');
    } catch (error) {
      console.warn('⚠️ Could not save performance baseline:', error.message);
    }

    // Generate performance report
    generatePerformanceReport();
  });

  // Helper function to record performance metrics
  const recordMetric = (name, value, metadata = {}) => {
    const metric = {
      name,
      value,
      timestamp: Date.now(),
      metadata
    };
    performanceMetrics.push(metric);
    
    // Check against baseline if available
    if (performanceBaseline && performanceBaseline[name]) {
      const baseline = performanceBaseline[name];
      const regression = ((value - baseline.average) / baseline.average) * 100;
      
      if (regression > 20) { // 20% regression threshold
        console.warn(`⚠️ Performance regression detected in ${name}: ${regression.toFixed(1)}% slower than baseline`);
      } else if (regression < -10) { // 10% improvement
        console.log(`✅ Performance improvement in ${name}: ${Math.abs(regression).toFixed(1)}% faster than baseline`);
      }
    }
  };

  // Helper function to get available models
  const getAvailableModels = async () => {
    const models = [];
    const modelPaths = [
      { name: 'tinyllama', path: './models/tinyllama/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf' },
      { name: 'phi-2', path: './models/phi-2/phi-2.Q4_K_M.gguf' },
      { name: 'qwen2.5', path: './models/qwen2.5/qwen2.5-1.5b-instruct-q4_k_m.gguf' }
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

  describe('Router Performance Baseline', () => {
    test('should establish router initialization baseline', () => {
      const initMetrics = performanceMetrics.filter(m => m.name === 'router_init_time');
      expect(initMetrics.length).toBeGreaterThan(0);
      
      const initTime = initMetrics[0].value;
      expect(initTime).toBeLessThan(PERFORMANCE_THRESHOLDS.routerInitTime);
      
      console.log(`📊 Router init baseline: ${initTime.toFixed(2)}ms`);
    });

    test('should measure registry operations performance', async () => {
      const availableModels = await getAvailableModels();
      if (availableModels.length === 0) {
        console.log('⏭️ Skipping registry performance test - no models available');
        return;
      }

      const model = availableModels[0];
      const registerStart = performance.now();
      
      try {
        await router.registry.register({
          id: 'performance-test',
          name: 'Performance Test Model',
          format: 'gguf',
          path: model.path,
          engine: 'wasm'
        });

        const registerTime = performance.now() - registerStart;
        recordMetric('model_registration_time', registerTime, { model: model.name });

        expect(registerTime).toBeLessThan(PERFORMANCE_THRESHOLDS.modelRegistrationTime);
        console.log(`📊 Model registration: ${registerTime.toFixed(2)}ms`);

        // Test listing performance
        const listStart = performance.now();
        const models = await router.registry.getAvailable();
        const listTime = performance.now() - listStart;

        recordMetric('model_list_time', listTime);
        expect(listTime).toBeLessThan(1000); // Should be very fast
        console.log(`📊 Model listing: ${listTime.toFixed(2)}ms`);

      } catch (error) {
        if (error.message.includes('not supported in VPS')) {
          console.log('⚠️ Skipping registry performance test - VPS limitation');
          return;
        }
        throw error;
      }
    }, 60000);

    test('should establish memory usage baseline', async () => {
      const memoryBefore = getMemoryUsage();
      
      // Perform some operations to establish baseline
      const models = await router.registry.getAvailable();
      
      // Light memory operations
      for (let i = 0; i < 10; i++) {
        const tempArray = new Array(1000).fill('test data');
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const memoryAfter = getMemoryUsage();
      const memoryGrowth = memoryAfter.rss - memoryBefore.rss;

      recordMetric('baseline_memory_growth', memoryGrowth);
      recordMetric('baseline_memory_usage', memoryAfter.rss);

      expect(memoryAfter.rss).toBeLessThan(PERFORMANCE_THRESHOLDS.maxMemoryUsage);
      console.log(`📊 Memory baseline: ${memoryAfter.rss}MB (${memoryGrowth >= 0 ? '+' : ''}${memoryGrowth}MB growth)`);
    });
  });

  describe('Inference Performance Monitoring', () => {
    test('should detect inference time regressions', async () => {
      const availableModels = await getAvailableModels();
      if (availableModels.length === 0) return;

      const model = availableModels[0];
      const prompt = "Hello! Please respond briefly.";
      
      try {
        // Multiple inference runs to get average
        const inferenceTimes = [];
        
        for (let i = 0; i < 3; i++) {
          const startTime = performance.now();
          
          const response = await router.generate(model.name || 'performance-test', prompt, {
            maxTokens: 20,
            temperature: 0.3
          });

          const inferenceTime = performance.now() - startTime;
          inferenceTimes.push(inferenceTime);

          expect(response).toBeDefined();
          expect(typeof response).toBe('string');
        }

        const avgInferenceTime = inferenceTimes.reduce((a, b) => a + b) / inferenceTimes.length;
        const minInferenceTime = Math.min(...inferenceTimes);
        const maxInferenceTime = Math.max(...inferenceTimes);

        recordMetric('inference_time_avg', avgInferenceTime, { model: model.name });
        recordMetric('inference_time_min', minInferenceTime, { model: model.name });
        recordMetric('inference_time_max', maxInferenceTime, { model: model.name });

        console.log(`📊 Inference performance:\n   
          - Average: ${avgInferenceTime.toFixed(2)}ms\n   
          - Range: ${minInferenceTime.toFixed(2)}ms - ${maxInferenceTime.toFixed(2)}ms`);

        expect(avgInferenceTime).toBeLessThan(PERFORMANCE_THRESHOLDS.inferenceTime);
        
        // Consistency check - variance shouldn't be too high
        const variance = inferenceTimes.reduce((acc, time) => 
          acc + Math.pow(time - avgInferenceTime, 2), 0) / inferenceTimes.length;
        const standardDeviation = Math.sqrt(variance);
        
        recordMetric('inference_time_stddev', standardDeviation);
        
        // Standard deviation should be less than 50% of average (reasonable consistency)
        expect(standardDeviation).toBeLessThan(avgInferenceTime * 0.5);

      } catch (error) {
        if (error.message.includes('not supported in VPS')) {
          console.log('⚠️ Skipping inference performance test - VPS limitation');
          return;
        }
        throw error;
      }
    }, 120000);

    test('should monitor tokens per second performance', async () => {
      const availableModels = await getAvailableModels();
      if (availableModels.length === 0) return;

      const model = availableModels[0];
      const prompt = "Count from 1 to 10 with brief explanations:";
      
      try {
        const startTime = performance.now();
        
        const response = await router.generate(model.name || 'performance-test', prompt, {
          maxTokens: 100,
          temperature: 0.1
        });

        const inferenceTime = performance.now() - startTime;
        
        // Estimate tokens (rough approximation: ~4 characters per token)
        const estimatedTokens = response.length / 4;
        const tokensPerSecond = estimatedTokens / (inferenceTime / 1000);

        recordMetric('tokens_per_second', tokensPerSecond, { 
          model: model.name,
          estimatedTokens,
          responseLength: response.length
        });

        console.log(`📊 Token generation rate: ${tokensPerSecond.toFixed(2)} tokens/second (${estimatedTokens} est. tokens)`);

        expect(tokensPerSecond).toBeGreaterThan(PERFORMANCE_THRESHOLDS.tokensPerSecond);

      } catch (error) {
        if (error.message.includes('not supported in VPS')) {
          console.log('⚠️ Skipping token rate test - VPS limitation');
          return;
        }
        throw error;
      }
    }, 120000);
  });

  describe('Memory Performance Regression', () => {
    test('should detect memory leaks during repeated operations', async () => {
      const availableModels = await getAvailableModels();
      if (availableModels.length === 0) return;

      const model = availableModels[0];
      const initialMemory = getMemoryUsage();
      const memorySnapshots = [initialMemory];

      try {
        // Perform repeated operations
        for (let i = 0; i < 5; i++) {
          await router.generate(model.name || 'performance-test', `Test ${i}`, {
            maxTokens: 10,
            temperature: 0.1
          });

          const memorySnapshot = getMemoryUsage();
          memorySnapshots.push(memorySnapshot);

          // Force garbage collection if available
          if (global.gc && i % 2 === 0) {
            global.gc();
          }
        }

        const finalMemory = memorySnapshots[memorySnapshots.length - 1];
        const totalMemoryGrowth = finalMemory.rss - initialMemory.rss;
        const avgGrowthPerOperation = totalMemoryGrowth / 5;

        recordMetric('memory_growth_per_operation', avgGrowthPerOperation);
        recordMetric('total_memory_growth_5ops', totalMemoryGrowth);

        console.log(`📊 Memory growth over 5 operations: ${totalMemoryGrowth}MB (${avgGrowthPerOperation.toFixed(1)}MB/op)`);

        expect(avgGrowthPerOperation).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryGrowthPerOperation);

        // Check for memory leak pattern (consistently increasing)
        let increasingCount = 0;
        for (let i = 1; i < memorySnapshots.length; i++) {
          if (memorySnapshots[i].rss > memorySnapshots[i-1].rss) {
            increasingCount++;
          }
        }

        const leakPattern = increasingCount / (memorySnapshots.length - 1);
        recordMetric('memory_leak_pattern', leakPattern);

        // If memory increases in more than 80% of measurements, potential leak
        if (leakPattern > 0.8) {
          console.warn(`⚠️ Potential memory leak detected: memory increased in ${(leakPattern * 100).toFixed(1)}% of measurements`);
        }

      } catch (error) {
        if (error.message.includes('not supported in VPS')) {
          console.log('⚠️ Skipping memory regression test - VPS limitation');
          return;
        }
        throw error;
      }
    }, 180000);
  });

  describe('Error Recovery Performance', () => {
    test('should measure error recovery speed', async () => {
      const recoveryTimes = [];

      for (let i = 0; i < 3; i++) {
        const startTime = performance.now();
        
        try {
          // Cause an error
          await router.generate('nonexistent-model', 'test');
        } catch (error) {
          // Expected to fail
        }

        // Immediately perform successful operation
        const models = await router.registry.getAvailable();
        const recoveryTime = performance.now() - startTime;
        
        recoveryTimes.push(recoveryTime);
        expect(Array.isArray(models)).toBe(true);
      }

      const avgRecoveryTime = recoveryTimes.reduce((a, b) => a + b) / recoveryTimes.length;
      recordMetric('error_recovery_time', avgRecoveryTime);

      console.log(`📊 Error recovery time: ${avgRecoveryTime.toFixed(2)}ms average`);
      
      expect(avgRecoveryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.errorRecoveryTime);
    });

    test('should maintain performance under error conditions', async () => {
      const availableModels = await getAvailableModels();
      if (availableModels.length === 0) return;

      const model = availableModels[0];
      
      // Baseline performance
      const baselineStart = performance.now();
      
      try {
        await router.generate(model.name || 'performance-test', 'Baseline test', {
          maxTokens: 20
        });
      } catch (error) {
        if (error.message.includes('not supported in VPS')) {
          console.log('⚠️ Skipping error condition performance test - VPS limitation');
          return;
        }
        throw error;
      }
      
      const baselineTime = performance.now() - baselineStart;

      // Cause some errors
      for (let i = 0; i < 3; i++) {
        try {
          await router.generate('bad-model', 'error test');
        } catch (error) {
          // Expected
        }
      }

      // Test performance after errors
      const afterErrorStart = performance.now();
      
      try {
        await router.generate(model.name || 'performance-test', 'After error test', {
          maxTokens: 20
        });
      } catch (error) {
        if (error.message.includes('not supported in VPS')) {
          return;
        }
        throw error;
      }
      
      const afterErrorTime = performance.now() - afterErrorStart;

      const performanceDegradation = ((afterErrorTime - baselineTime) / baselineTime) * 100;
      
      recordMetric('performance_after_errors', afterErrorTime);
      recordMetric('performance_degradation_percent', performanceDegradation);

      console.log(`📊 Performance after errors: ${performanceDegradation.toFixed(1)}% change from baseline`);
      
      // Performance shouldn't degrade more than 50% after errors
      expect(performanceDegradation).toBeLessThan(50);
    }, 120000);
  });

  describe('Load Performance Regression', () => {
    test('should handle concurrent requests without major degradation', async () => {
      const availableModels = await getAvailableModels();
      if (availableModels.length === 0) return;

      const model = availableModels[0];
      
      // Single request baseline
      const singleStart = performance.now();
      
      try {
        await router.generate(model.name || 'performance-test', 'Single request', {
          maxTokens: 10
        });
      } catch (error) {
        if (error.message.includes('not supported in VPS')) {
          console.log('⚠️ Skipping concurrent performance test - VPS limitation');
          return;
        }
        throw error;
      }
      
      const singleTime = performance.now() - singleStart;

      // Concurrent requests
      const concurrentStart = performance.now();
      const concurrentPromises = [];

      for (let i = 0; i < 3; i++) {
        const promise = router.generate(model.name || 'performance-test', `Concurrent ${i}`, {
          maxTokens: 10
        }).catch(error => ({
          error: true,
          message: error.message
        }));
        
        concurrentPromises.push(promise);
      }

      const results = await Promise.all(concurrentPromises);
      const concurrentTime = performance.now() - concurrentStart;

      const successful = results.filter(r => !r?.error).length;
      const avgTimePerRequest = concurrentTime / 3;

      recordMetric('single_request_time', singleTime);
      recordMetric('concurrent_request_avg_time', avgTimePerRequest);
      recordMetric('concurrent_success_rate', successful / 3);

      console.log(`📊 Concurrent performance:\n   
        - Single: ${singleTime.toFixed(2)}ms\n   
        - Concurrent avg: ${avgTimePerRequest.toFixed(2)}ms\n   
        - Success rate: ${successful}/3`);

      // Concurrent shouldn't be more than 3x slower per request
      const performanceRatio = avgTimePerRequest / singleTime;
      expect(performanceRatio).toBeLessThan(3);
      expect(successful).toBeGreaterThan(0);

    }, 180000);
  });

  // Helper functions
  function calculateBaseline(metrics) {
    const baseline = {};
    
    // Group metrics by name
    const metricGroups = {};
    metrics.forEach(metric => {
      if (!metricGroups[metric.name]) {
        metricGroups[metric.name] = [];
      }
      metricGroups[metric.name].push(metric.value);
    });

    // Calculate statistics for each metric
    Object.keys(metricGroups).forEach(metricName => {
      const values = metricGroups[metricName];
      const sum = values.reduce((a, b) => a + b, 0);
      const average = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      baseline[metricName] = {
        average,
        min,
        max,
        count: values.length,
        lastUpdated: Date.now()
      };
    });

    return baseline;
  }

  function generatePerformanceReport() {
    console.log('\n📊 Performance Regression Detection Summary:');
    console.log('=' .repeat(50));

    const metricGroups = {};
    performanceMetrics.forEach(metric => {
      if (!metricGroups[metric.name]) {
        metricGroups[metric.name] = [];
      }
      metricGroups[metric.name].push(metric.value);
    });

    Object.keys(metricGroups).forEach(metricName => {
      const values = metricGroups[metricName];
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      console.log(`${metricName}:`);
      console.log(`  Average: ${avg.toFixed(2)}`);
      console.log(`  Range: ${min.toFixed(2)} - ${max.toFixed(2)}`);
      
      if (performanceBaseline && performanceBaseline[metricName]) {
        const baselineAvg = performanceBaseline[metricName].average;
        const change = ((avg - baselineAvg) / baselineAvg) * 100;
        const changeStr = change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
        console.log(`  Change from baseline: ${changeStr}`);
      }
      console.log();
    });
  }
});