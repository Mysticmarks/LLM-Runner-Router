/**
 * 🏃‍♂️ Performance Benchmark - Speed of Thought Measurement
 * Comprehensive benchmarking system for LLM provider performance
 * Echo AI Systems - Measuring excellence across dimensions
 */

import { Logger } from './Logger.js';
import { performance } from 'perf_hooks';
import { cpus } from 'os';

const logger = new Logger('PerformanceBenchmark');

class PerformanceBenchmark {
  constructor() {
    this.benchmarkHistory = new Map();
    this.activeMetrics = new Map();
    this.baselineMetrics = new Map();
    
    // Standard benchmark prompts for different categories
    this.benchmarkPrompts = {
      simple: "Hello, how are you?",
      medium: "Explain the concept of machine learning in simple terms for a beginner.",
      complex: "Write a detailed analysis of the economic implications of artificial intelligence on global employment patterns, considering both short-term disruptions and long-term adaptations across different industries and skill levels.",
      code: "Write a Python function that implements a binary search algorithm with proper error handling and documentation.",
      creative: "Write a short story about a robot who discovers emotions for the first time.",
      reasoning: "If a train leaves New York at 3 PM traveling at 120 mph, and another train leaves Boston at 4 PM traveling at 100 mph toward New York, and the distance between the cities is 200 miles, when and where will they meet?"
    };

    // Performance thresholds for quality assessment
    this.performanceThresholds = {
      excellent: { latency: 500, throughput: 100, errorRate: 0.001 },
      good: { latency: 1000, throughput: 50, errorRate: 0.01 },
      acceptable: { latency: 2000, throughput: 25, errorRate: 0.05 },
      poor: { latency: 5000, throughput: 10, errorRate: 0.1 }
    };
  }

  /**
   * Run comprehensive benchmark suite for a provider
   */
  async runBenchmarkSuite(adapter, options = {}) {
    const suiteId = `${adapter.provider}-${Date.now()}`;
    logger.info(`🏃‍♂️ Starting benchmark suite ${suiteId}`);

    const results = {
      suiteId,
      provider: adapter.provider,
      timestamp: new Date().toISOString(),
      systemInfo: await this.getSystemInfo(),
      tests: {},
      summary: {}
    };

    try {
      // Test different prompt categories
      for (const [category, prompt] of Object.entries(this.benchmarkPrompts)) {
        if (options.categories && !options.categories.includes(category)) {
          continue;
        }

        logger.info(`Testing ${category} prompts...`);
        results.tests[category] = await this.runCategoryBenchmark(
          adapter, 
          category, 
          prompt, 
          options
        );
      }

      // Run stress tests if requested
      if (options.includeStressTest) {
        results.tests.stress = await this.runStressTest(adapter, options);
      }

      // Run concurrency tests if requested
      if (options.includeConcurrencyTest) {
        results.tests.concurrency = await this.runConcurrencyTest(adapter, options);
      }

      // Generate summary metrics
      results.summary = this.generateSummary(results.tests);
      
      // Store results
      this.storeBenchmarkResults(suiteId, results);
      
      logger.info(`✅ Benchmark suite ${suiteId} completed`);
      return results;

    } catch (error) {
      logger.error(`❌ Benchmark suite ${suiteId} failed:`, error);
      results.error = error.message;
      return results;
    }
  }

  /**
   * Run benchmark for specific prompt category
   */
  async runCategoryBenchmark(adapter, category, prompt, options = {}) {
    const iterations = options.iterations || 3;
    const warmup = options.warmup || 1;
    const results = {
      category,
      prompt: prompt.slice(0, 100) + '...',
      iterations,
      runs: [],
      metrics: {}
    };

    // Warmup runs
    logger.debug(`Warming up with ${warmup} runs...`);
    for (let i = 0; i < warmup; i++) {
      try {
        await this.measureSingleRun(adapter, prompt, { timeout: 30000 });
      } catch (error) {
        logger.warn(`Warmup run ${i + 1} failed:`, error.message);
      }
    }

    // Actual benchmark runs
    for (let i = 0; i < iterations; i++) {
      logger.debug(`Running iteration ${i + 1}/${iterations}...`);
      
      try {
        const runResult = await this.measureSingleRun(adapter, prompt, options);
        results.runs.push(runResult);
        
        // Brief pause between runs
        await this.sleep(1000);
      } catch (error) {
        logger.warn(`Run ${i + 1} failed:`, error.message);
        results.runs.push({
          iteration: i + 1,
          success: false,
          error: error.message,
          metrics: {}
        });
      }
    }

    // Calculate aggregate metrics
    results.metrics = this.calculateAggregateMetrics(results.runs);
    results.performanceGrade = this.assessPerformance(results.metrics);

    return results;
  }

  /**
   * Measure performance of a single run
   */
  async measureSingleRun(adapter, prompt, options = {}) {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    let firstTokenTime = null;
    let tokenCount = 0;
    let success = false;
    let error = null;
    let response = null;

    try {
      // Set up timeout
      const timeout = options.timeout || 30000;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      );

      // Start the actual request
      const requestPromise = this.makeRequest(adapter, prompt, {
        onFirstToken: () => { firstTokenTime = performance.now(); },
        onToken: () => { tokenCount++; }
      });

      response = await Promise.race([requestPromise, timeoutPromise]);
      success = true;

    } catch (err) {
      error = err.message;
      logger.warn(`Request failed: ${error}`);
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage();

    // Calculate metrics
    const totalLatency = endTime - startTime;
    const firstTokenLatency = firstTokenTime ? firstTokenTime - startTime : null;
    const tokensPerSecond = tokenCount > 0 ? (tokenCount / (totalLatency / 1000)) : 0;
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

    return {
      success,
      error,
      metrics: {
        totalLatency: Math.round(totalLatency),
        firstTokenLatency: firstTokenLatency ? Math.round(firstTokenLatency) : null,
        tokenCount,
        tokensPerSecond: Math.round(tokensPerSecond * 100) / 100,
        memoryUsageMB: Math.round(memoryDelta / 1024 / 1024 * 100) / 100,
        responseLength: response ? response.length : 0
      },
      response: response ? response.slice(0, 200) + '...' : null
    };
  }

  /**
   * Make request to adapter with performance monitoring
   */
  async makeRequest(adapter, prompt, callbacks = {}) {
    let tokenCount = 0;
    let firstToken = false;

    // Try to use streaming if available
    if (adapter.stream && typeof adapter.stream === 'function') {
      let fullResponse = '';
      
      try {
        const stream = adapter.stream(prompt, {
          maxTokens: 100, // Limit for benchmarking
          temperature: 0.7
        });

        // Check if stream is actually iterable
        if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
          throw new Error('Stream is not properly configured for async iteration');
        }

        for await (const chunk of stream) {
          if (!firstToken && callbacks.onFirstToken) {
            callbacks.onFirstToken();
            firstToken = true;
          }
          
          if (chunk && chunk.text) {
            fullResponse += chunk.text;
            tokenCount++;
            if (callbacks.onToken) callbacks.onToken();
          }
        }
        
        return fullResponse;
      } catch (streamError) {
        // Fall back to complete method if streaming fails
        logger.warn('Streaming failed, falling back to complete method:', streamError.message);
      }
    }
    
    // Use complete method (either as fallback or primary)
    if (adapter.complete && typeof adapter.complete === 'function') {
      const response = await adapter.complete(prompt, {
        maxTokens: 100,
        temperature: 0.7
      });
      
      if (callbacks.onFirstToken) callbacks.onFirstToken();
      
      // Extract text from various response formats
      const text = response?.text || response?.content || response?.message || String(response || '');
      
      // Count tokens (rough approximation)
      tokenCount = text.split(/\s+/).length;
      if (callbacks.onToken) {
        for (let i = 0; i < tokenCount; i++) {
          callbacks.onToken();
        }
      }
      
      return text;
    }
    
    throw new Error('Adapter does not support streaming or complete methods');
  }

  /**
   * Run stress test with increasing load
   */
  async runStressTest(adapter, options = {}) {
    const maxConcurrency = options.maxConcurrency || 10;
    const duration = options.stressDuration || 60000; // 1 minute
    const results = {
      type: 'stress',
      duration,
      maxConcurrency,
      stages: []
    };

    logger.info(`🔥 Starting stress test (max ${maxConcurrency} concurrent, ${duration}ms)`);

    for (let concurrency = 1; concurrency <= maxConcurrency; concurrency++) {
      logger.info(`Testing concurrency level: ${concurrency}`);
      
      const stageResult = await this.runConcurrentRequests(
        adapter, 
        concurrency, 
        Math.min(duration / maxConcurrency, 10000),
        options
      );
      
      results.stages.push({
        concurrency,
        ...stageResult
      });

      // Stop if error rate gets too high
      if (stageResult.errorRate > 0.5) {
        logger.warn(`Stopping stress test at concurrency ${concurrency} due to high error rate`);
        break;
      }
    }

    return results;
  }

  /**
   * Run concurrency test
   */
  async runConcurrencyTest(adapter, options = {}) {
    const concurrencyLevels = options.concurrencyLevels || [1, 2, 5, 10];
    const results = {
      type: 'concurrency',
      levels: []
    };

    for (const level of concurrencyLevels) {
      logger.info(`Testing concurrency level: ${level}`);
      
      const levelResult = await this.runConcurrentRequests(
        adapter, 
        level, 
        10000, // 10 second test
        options
      );
      
      results.levels.push({
        concurrency: level,
        ...levelResult
      });
    }

    return results;
  }

  /**
   * Run concurrent requests
   */
  async runConcurrentRequests(adapter, concurrency, duration, options = {}) {
    const prompt = this.benchmarkPrompts.medium;
    const requests = [];
    const results = [];
    const startTime = performance.now();

    // Start concurrent requests
    for (let i = 0; i < concurrency; i++) {
      const requestPromise = this.measureSingleRun(adapter, prompt, options)
        .then(result => {
          results.push(result);
          return result;
        })
        .catch(error => {
          const errorResult = { success: false, error: error.message, metrics: {} };
          results.push(errorResult);
          return errorResult;
        });
      
      requests.push(requestPromise);
    }

    // Wait for all requests to complete or timeout
    await Promise.allSettled(requests);
    
    const totalTime = performance.now() - startTime;
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return {
      totalRequests: results.length,
      successful: successful.length,
      failed: failed.length,
      errorRate: failed.length / results.length,
      averageLatency: successful.length > 0 ? 
        successful.reduce((sum, r) => sum + r.metrics.totalLatency, 0) / successful.length : 0,
      requestsPerSecond: results.length / (totalTime / 1000),
      totalDuration: totalTime
    };
  }

  /**
   * Calculate aggregate metrics from multiple runs
   */
  calculateAggregateMetrics(runs) {
    const successful = runs.filter(r => r.success);
    
    if (successful.length === 0) {
      return {
        successRate: 0,
        averageLatency: 0,
        medianLatency: 0,
        p95Latency: 0,
        averageTokensPerSecond: 0,
        totalTokens: 0
      };
    }

    const latencies = successful.map(r => r.metrics.totalLatency).sort((a, b) => a - b);
    const tokenSpeeds = successful.map(r => r.metrics.tokensPerSecond);
    const tokens = successful.map(r => r.metrics.tokenCount);

    return {
      successRate: successful.length / runs.length,
      averageLatency: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
      medianLatency: latencies[Math.floor(latencies.length / 2)],
      p95Latency: latencies[Math.floor(latencies.length * 0.95)],
      averageTokensPerSecond: Math.round((tokenSpeeds.reduce((a, b) => a + b, 0) / tokenSpeeds.length) * 100) / 100,
      totalTokens: tokens.reduce((a, b) => a + b, 0),
      minLatency: Math.min(...latencies),
      maxLatency: Math.max(...latencies)
    };
  }

  /**
   * Assess performance grade based on metrics
   */
  assessPerformance(metrics) {
    const { averageLatency, successRate, averageTokensPerSecond } = metrics;
    
    if (successRate < 0.9) return 'poor';
    
    for (const [grade, thresholds] of Object.entries(this.performanceThresholds)) {
      if (averageLatency <= thresholds.latency && 
          averageTokensPerSecond >= thresholds.throughput) {
        return grade;
      }
    }
    
    return 'poor';
  }

  /**
   * Generate summary from all test results
   */
  generateSummary(tests) {
    const summary = {
      overallGrade: 'poor',
      categoryGrades: {},
      averageMetrics: {},
      recommendations: []
    };

    const grades = [];
    const allMetrics = {
      latency: [],
      throughput: [],
      successRate: []
    };

    // Collect metrics from all categories
    for (const [category, result] of Object.entries(tests)) {
      if (result.metrics && result.performanceGrade) {
        summary.categoryGrades[category] = result.performanceGrade;
        grades.push(result.performanceGrade);
        
        allMetrics.latency.push(result.metrics.averageLatency);
        allMetrics.throughput.push(result.metrics.averageTokensPerSecond);
        allMetrics.successRate.push(result.metrics.successRate);
      }
    }

    // Calculate overall grade
    const gradeValues = { excellent: 4, good: 3, acceptable: 2, poor: 1 };
    const avgGradeValue = grades.reduce((sum, grade) => sum + gradeValues[grade], 0) / grades.length;
    
    if (avgGradeValue >= 3.5) summary.overallGrade = 'excellent';
    else if (avgGradeValue >= 2.5) summary.overallGrade = 'good';
    else if (avgGradeValue >= 1.5) summary.overallGrade = 'acceptable';

    // Calculate average metrics
    summary.averageMetrics = {
      latency: allMetrics.latency.length > 0 ? 
        Math.round(allMetrics.latency.reduce((a, b) => a + b, 0) / allMetrics.latency.length) : 0,
      throughput: allMetrics.throughput.length > 0 ? 
        Math.round((allMetrics.throughput.reduce((a, b) => a + b, 0) / allMetrics.throughput.length) * 100) / 100 : 0,
      successRate: allMetrics.successRate.length > 0 ? 
        Math.round((allMetrics.successRate.reduce((a, b) => a + b, 0) / allMetrics.successRate.length) * 100) / 100 : 0
    };

    // Generate recommendations
    summary.recommendations = this.generateRecommendations(summary);

    return summary;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(summary) {
    const recommendations = [];
    const { averageMetrics, overallGrade } = summary;

    if (averageMetrics.successRate < 0.95) {
      recommendations.push('Improve error handling and retry logic');
    }

    if (averageMetrics.latency > 2000) {
      recommendations.push('Consider optimizing request parameters or using faster models');
    }

    if (averageMetrics.throughput < 25) {
      recommendations.push('Consider models with higher token generation speed');
    }

    if (overallGrade === 'poor') {
      recommendations.push('Consider switching to a different provider or model');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is satisfactory, consider monitoring for consistency');
    }

    return recommendations;
  }

  /**
   * Compare performance across providers
   */
  compareProviders(results) {
    const comparison = {
      timestamp: new Date().toISOString(),
      providers: {},
      rankings: {},
      insights: []
    };

    // Organize results by provider
    for (const result of results) {
      comparison.providers[result.provider] = {
        overallGrade: result.summary.overallGrade,
        metrics: result.summary.averageMetrics,
        categories: result.summary.categoryGrades
      };
    }

    // Generate rankings
    const metrics = ['latency', 'throughput', 'successRate'];
    for (const metric of metrics) {
      comparison.rankings[metric] = Object.entries(comparison.providers)
        .sort((a, b) => {
          const valueA = a[1].metrics[metric] || 0;
          const valueB = b[1].metrics[metric] || 0;
          return metric === 'latency' ? valueA - valueB : valueB - valueA;
        })
        .map(([provider]) => provider);
    }

    return comparison;
  }

  /**
   * Store benchmark results
   */
  storeBenchmarkResults(suiteId, results) {
    this.benchmarkHistory.set(suiteId, results);
    
    // Keep only last 100 results
    if (this.benchmarkHistory.size > 100) {
      const oldest = this.benchmarkHistory.keys().next().value;
      this.benchmarkHistory.delete(oldest);
    }
  }

  /**
   * Get system information
   */
  async getSystemInfo() {
    return {
      platform: process.platform,
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      cpus: cpus().length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get benchmark history
   */
  getBenchmarkHistory() {
    return Array.from(this.benchmarkHistory.values());
  }

  /**
   * Export results to JSON
   */
  exportResults(suiteId) {
    const results = this.benchmarkHistory.get(suiteId);
    if (!results) {
      throw new Error(`Benchmark results not found for suite: ${suiteId}`);
    }
    
    return JSON.stringify(results, null, 2);
  }
}

export default PerformanceBenchmark;
export { PerformanceBenchmark };