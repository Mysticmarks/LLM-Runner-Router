/**
 * 🏃‍♂️ Performance Benchmark Test Suite
 * Comprehensive tests for performance benchmarking system
 */

import { jest } from '@jest/globals';
import { PerformanceBenchmark } from '../../src/utils/PerformanceBenchmark.js';

// Mock performance hooks
const mockPerformance = {
  now: jest.fn(() => Date.now())
};

jest.mock('perf_hooks', () => ({
  performance: mockPerformance
}));

describe('PerformanceBenchmark', () => {
  let benchmark;
  let mockAdapter;

  beforeEach(() => {
    benchmark = new PerformanceBenchmark();
    
    // Mock adapter
    mockAdapter = {
      provider: 'test-provider',
      complete: jest.fn().mockResolvedValue({ text: 'Test response', usage: { totalTokens: 5 } }),
      stream: jest.fn().mockReturnValue({
        // Mock a non-async iterable stream
        [Symbol.asyncIterator]: undefined
      })
    };
    
    // Reset performance mock
    mockPerformance.now.mockClear();
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(benchmark.benchmarkHistory).toBeInstanceOf(Map);
      expect(benchmark.activeMetrics).toBeInstanceOf(Map);
      expect(benchmark.baselineMetrics).toBeInstanceOf(Map);
      expect(benchmark.benchmarkPrompts).toBeDefined();
      expect(benchmark.performanceThresholds).toBeDefined();
    });

    test('should have predefined benchmark prompts', () => {
      const prompts = benchmark.benchmarkPrompts;
      
      expect(prompts.simple).toBeDefined();
      expect(prompts.medium).toBeDefined();
      expect(prompts.complex).toBeDefined();
      expect(prompts.code).toBeDefined();
      expect(prompts.creative).toBeDefined();
      expect(prompts.reasoning).toBeDefined();
    });

    test('should have performance thresholds', () => {
      const thresholds = benchmark.performanceThresholds;
      
      expect(thresholds.excellent).toBeDefined();
      expect(thresholds.good).toBeDefined();
      expect(thresholds.acceptable).toBeDefined();
      expect(thresholds.poor).toBeDefined();
      
      expect(thresholds.excellent.latency).toBeLessThan(thresholds.good.latency);
      expect(thresholds.good.latency).toBeLessThan(thresholds.acceptable.latency);
    });
  });

  describe('Single Run Measurement', () => {
    test('should measure successful run', async () => {
      mockAdapter.complete.mockResolvedValue({
        text: 'Test response',
        usage: { totalTokens: 15 }
      });

      const result = await benchmark.measureSingleRun(mockAdapter, 'Test prompt');
      
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.metrics).toBeDefined();
      expect(result.metrics.totalLatency).toBeGreaterThan(0);
      expect(result.metrics.responseLength).toBeGreaterThan(0);
    });

    test('should handle adapter errors gracefully', async () => {
      mockAdapter.complete.mockRejectedValue(new Error('API Error'));

      const result = await benchmark.measureSingleRun(mockAdapter, 'Test prompt');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
      expect(result.metrics.totalLatency).toBeGreaterThan(0);
    });

    test('should handle request timeout', async () => {
      mockAdapter.complete.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 35000))
      );

      const result = await benchmark.measureSingleRun(
        mockAdapter, 
        'Test prompt', 
        { timeout: 100 }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timeout');
    });

    test('should measure streaming responses', async () => {
      const mockStreamResponse = (async function* () {
        yield { text: 'Hello' };
        yield { text: ' world' };
        yield { text: '!' };
      })();

      mockAdapter.stream.mockReturnValue(mockStreamResponse);

      const result = await benchmark.measureSingleRun(mockAdapter, 'Test prompt');
      
      expect(result.success).toBe(true);
      expect(result.metrics.tokenCount).toBe(3);
      expect(result.response).toContain('Hello world!');
    });
  });

  describe('Category Benchmarking', () => {
    test('should run category benchmark successfully', async () => {
      mockAdapter.complete.mockResolvedValue({
        text: 'Test response',
        usage: { totalTokens: 15 }
      });

      const result = await benchmark.runCategoryBenchmark(
        mockAdapter, 
        'simple', 
        'Test prompt',
        { iterations: 2, warmup: 1 }
      );
      
      expect(result.category).toBe('simple');
      expect(result.iterations).toBe(2);
      expect(result.runs).toHaveLength(2);
      expect(result.metrics).toBeDefined();
      expect(result.performanceGrade).toBeDefined();
    });

    test('should handle partial failures in runs', async () => {
      // Mock responses: first succeeds, second fails
      let callCount = 0;
      mockAdapter.complete = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ text: 'Success', usage: { totalTokens: 10 } });
        } else {
          return Promise.reject(new Error('API Error'));
        }
      });

      const result = await benchmark.runCategoryBenchmark(
        mockAdapter, 
        'simple', 
        'Test prompt',
        { iterations: 2, warmup: 0 }
      );
      
      expect(result.runs).toHaveLength(2);
      expect(result.runs[0].success).toBe(true);
      expect(result.runs[1].success).toBe(false);
      expect(result.runs[1].error).toBe('API Error');
    });
  });

  describe('Benchmark Suite', () => {
    test('should run complete benchmark suite', async () => {
      mockAdapter.complete.mockResolvedValue({
        text: 'Test response',
        usage: { totalTokens: 15 }
      });

      const result = await benchmark.runBenchmarkSuite(mockAdapter, {
        categories: ['simple', 'medium'],
        iterations: 1,
        warmup: 0
      });
      
      expect(result.suiteId).toBeDefined();
      expect(result.provider).toBe('test-provider');
      expect(result.timestamp).toBeDefined();
      expect(result.systemInfo).toBeDefined();
      expect(result.tests.simple).toBeDefined();
      expect(result.tests.medium).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    test('should handle suite failures gracefully', async () => {
      // Reset and configure adapter to fail
      mockAdapter.complete = jest.fn().mockRejectedValue(new Error('Suite failure'));
      
      const result = await benchmark.runBenchmarkSuite(mockAdapter, {
        categories: ['simple'],
        iterations: 1,
        warmup: 0
      });
      
      expect(result.error).toBeDefined();
      expect(result.suiteId).toBeDefined();
      expect(result.provider).toBe('test-provider');
    });

    test('should include stress test when requested', async () => {
      mockAdapter.complete.mockResolvedValue({
        text: 'Test response',
        usage: { totalTokens: 15 }
      });

      const result = await benchmark.runBenchmarkSuite(mockAdapter, {
        categories: ['simple'],
        includeStressTest: true,
        maxConcurrency: 2,
        stressDuration: 1000,
        iterations: 1,
        warmup: 0
      });
      
      expect(result.tests.stress).toBeDefined();
      expect(result.tests.stress.type).toBe('stress');
    });

    test('should include concurrency test when requested', async () => {
      mockAdapter.complete.mockResolvedValue({
        text: 'Test response',
        usage: { totalTokens: 15 }
      });

      const result = await benchmark.runBenchmarkSuite(mockAdapter, {
        categories: ['simple'],
        includeConcurrencyTest: true,
        concurrencyLevels: [1, 2],
        iterations: 1,
        warmup: 0
      });
      
      expect(result.tests.concurrency).toBeDefined();
      expect(result.tests.concurrency.type).toBe('concurrency');
    });
  });

  describe('Stress Testing', () => {
    test('should run stress test with increasing concurrency', async () => {
      mockAdapter.complete.mockResolvedValue({
        text: 'Test response',
        usage: { totalTokens: 15 }
      });

      const result = await benchmark.runStressTest(mockAdapter, {
        maxConcurrency: 3,
        stressDuration: 1000
      });
      
      expect(result.type).toBe('stress');
      expect(result.maxConcurrency).toBe(3);
      expect(result.stages.length).toBeGreaterThan(0);
      expect(result.stages.length).toBeLessThanOrEqual(3);
    });

    test('should stop stress test on high error rate', async () => {
      mockAdapter.complete.mockRejectedValue(new Error('High error rate'));

      const result = await benchmark.runStressTest(mockAdapter, {
        maxConcurrency: 5,
        stressDuration: 1000
      });
      
      // Should stop early due to high error rate
      expect(result.stages.length).toBeLessThan(5);
      const lastStage = result.stages[result.stages.length - 1];
      expect(lastStage.errorRate).toBeGreaterThan(0.5);
    });
  });

  describe('Concurrency Testing', () => {
    test('should test multiple concurrency levels', async () => {
      mockAdapter.complete.mockResolvedValue({
        text: 'Test response',
        usage: { totalTokens: 15 }
      });

      const result = await benchmark.runConcurrencyTest(mockAdapter, {
        concurrencyLevels: [1, 2, 5]
      });
      
      expect(result.type).toBe('concurrency');
      expect(result.levels).toHaveLength(3);
      
      result.levels.forEach(level => {
        expect(level.concurrency).toBeDefined();
        expect(level.totalRequests).toBeGreaterThan(0);
        expect(level.successful).toBeDefined();
        expect(level.failed).toBeDefined();
      });
    });
  });

  describe('Metrics Calculation', () => {
    test('should calculate aggregate metrics correctly', () => {
      const runs = [
        { success: true, metrics: { totalLatency: 1000, tokensPerSecond: 10, tokenCount: 10 } },
        { success: true, metrics: { totalLatency: 1500, tokensPerSecond: 15, tokenCount: 15 } },
        { success: false, metrics: {} },
        { success: true, metrics: { totalLatency: 2000, tokensPerSecond: 20, tokenCount: 20 } }
      ];

      const metrics = benchmark.calculateAggregateMetrics(runs);
      
      expect(metrics.successRate).toBe(0.75); // 3/4
      expect(metrics.averageLatency).toBe(1500); // (1000+1500+2000)/3
      expect(metrics.medianLatency).toBe(1500);
      expect(metrics.totalTokens).toBe(45); // 10+15+20
      expect(metrics.minLatency).toBe(1000);
      expect(metrics.maxLatency).toBe(2000);
    });

    test('should handle no successful runs', () => {
      const runs = [
        { success: false, metrics: {} },
        { success: false, metrics: {} }
      ];

      const metrics = benchmark.calculateAggregateMetrics(runs);
      
      expect(metrics.successRate).toBe(0);
      expect(metrics.averageLatency).toBe(0);
      expect(metrics.totalTokens).toBe(0);
    });
  });

  describe('Performance Assessment', () => {
    test('should assess excellent performance', () => {
      const metrics = {
        averageLatency: 400,
        successRate: 0.99,
        averageTokensPerSecond: 120
      };

      const grade = benchmark.assessPerformance(metrics);
      expect(grade).toBe('excellent');
    });

    test('should assess poor performance for low success rate', () => {
      const metrics = {
        averageLatency: 500,
        successRate: 0.8,
        averageTokensPerSecond: 100
      };

      const grade = benchmark.assessPerformance(metrics);
      expect(grade).toBe('poor');
    });

    test('should assess good performance', () => {
      const metrics = {
        averageLatency: 800,
        successRate: 0.95,
        averageTokensPerSecond: 60
      };

      const grade = benchmark.assessPerformance(metrics);
      expect(grade).toBe('good');
    });
  });

  describe('Summary Generation', () => {
    test('should generate comprehensive summary', () => {
      const tests = {
        simple: {
          metrics: { averageLatency: 1000, averageTokensPerSecond: 15, successRate: 0.95 },
          performanceGrade: 'good'
        },
        medium: {
          metrics: { averageLatency: 1500, averageTokensPerSecond: 12, successRate: 0.9 },
          performanceGrade: 'acceptable'
        }
      };

      const summary = benchmark.generateSummary(tests);
      
      expect(summary.overallGrade).toBeDefined();
      expect(summary.categoryGrades.simple).toBe('good');
      expect(summary.categoryGrades.medium).toBe('acceptable');
      expect(summary.averageMetrics.latency).toBe(1250); // (1000+1500)/2
      expect(summary.averageMetrics.throughput).toBe(13.5); // (15+12)/2
      expect(summary.recommendations).toBeDefined();
      expect(Array.isArray(summary.recommendations)).toBe(true);
    });
  });

  describe('Provider Comparison', () => {
    test('should compare multiple providers', () => {
      const results = [
        {
          provider: 'provider-a',
          summary: {
            overallGrade: 'excellent',
            averageMetrics: { latency: 500, throughput: 100, successRate: 0.99 },
            categoryGrades: { simple: 'excellent' }
          }
        },
        {
          provider: 'provider-b',
          summary: {
            overallGrade: 'good',
            averageMetrics: { latency: 1000, throughput: 50, successRate: 0.95 },
            categoryGrades: { simple: 'good' }
          }
        }
      ];

      const comparison = benchmark.compareProviders(results);
      
      expect(comparison.providers['provider-a']).toBeDefined();
      expect(comparison.providers['provider-b']).toBeDefined();
      expect(comparison.rankings.latency[0]).toBe('provider-a'); // Lower latency first
      expect(comparison.rankings.throughput[0]).toBe('provider-a'); // Higher throughput first
    });
  });

  describe('Data Management', () => {
    test('should store benchmark results', () => {
      const results = { suiteId: 'test-suite', data: 'test' };
      
      benchmark.storeBenchmarkResults('test-suite', results);
      
      expect(benchmark.benchmarkHistory.has('test-suite')).toBe(true);
      expect(benchmark.benchmarkHistory.get('test-suite')).toEqual(results);
    });

    test('should limit stored results to 100', () => {
      // Add 101 results
      for (let i = 0; i < 101; i++) {
        benchmark.storeBenchmarkResults(`suite-${i}`, { suiteId: `suite-${i}` });
      }
      
      expect(benchmark.benchmarkHistory.size).toBe(100);
      expect(benchmark.benchmarkHistory.has('suite-0')).toBe(false); // Oldest removed
      expect(benchmark.benchmarkHistory.has('suite-100')).toBe(true); // Newest kept
    });

    test('should export results to JSON', () => {
      const results = { suiteId: 'test-suite', data: 'test' };
      benchmark.storeBenchmarkResults('test-suite', results);
      
      const exported = benchmark.exportResults('test-suite');
      const parsed = JSON.parse(exported);
      
      expect(parsed).toEqual(results);
    });

    test('should throw error for non-existent suite', () => {
      expect(() => {
        benchmark.exportResults('non-existent');
      }).toThrow('Benchmark results not found');
    });

    test('should get benchmark history', () => {
      benchmark.storeBenchmarkResults('suite-1', { suiteId: 'suite-1' });
      benchmark.storeBenchmarkResults('suite-2', { suiteId: 'suite-2' });
      
      const history = benchmark.getBenchmarkHistory();
      
      expect(Array.isArray(history)).toBe(true);
      expect(history).toHaveLength(2);
    });
  });

  describe('System Information', () => {
    test('should get system information', async () => {
      const systemInfo = await benchmark.getSystemInfo();
      
      expect(systemInfo.platform).toBeDefined();
      expect(systemInfo.nodeVersion).toBeDefined();
      expect(systemInfo.memory).toBeDefined();
      expect(systemInfo.cpus).toBeDefined();
      expect(systemInfo.timestamp).toBeDefined();
    });
  });

  describe('Utility Functions', () => {
    test('should implement sleep utility', async () => {
      const start = Date.now();
      await benchmark.sleep(100);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some timing variance
    });
  });
});