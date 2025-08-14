/**
 * ⚡ LLM Router Performance Benchmarks
 * Comprehensive performance testing suite
 */

import { LLMRouter } from '../../src/index.js';
import { performance } from 'perf_hooks';
import { GGUFLoader } from '../../src/loaders/GGUFLoader.js';

console.log('⚡ LLM Router Performance Benchmarks\n');
console.log('═'.repeat(60));

class BenchmarkSuite {
  constructor() {
    this.results = [];
    this.router = null;
  }

  async setup() {
    console.log('🔧 Setting up benchmark environment...\n');
    
    // Initialize router without auto-init
    this.router = new LLMRouter({ 
      autoInit: false,
      strategy: 'balanced' 
    });
    
    // Register GGUF loader
    this.router.registry.registerLoader('gguf', new GGUFLoader());
    
    // Initialize router
    await this.router.initialize();
    
    // Load test model if available
    try {
      await this.router.load({
        source: './models/tinyllama/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
        format: 'gguf',
        id: 'tinyllama-bench',
        name: 'TinyLlama Benchmark'
      });
      console.log('✅ Test model loaded\n');
    } catch (error) {
      console.log('⚠️  No model available for benchmarking\n');
    }
  }

  async measureTime(name, fn, iterations = 100) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }
    
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    this.results.push({
      name,
      iterations,
      avg: avg.toFixed(3),
      min: min.toFixed(3),
      max: max.toFixed(3)
    });
    
    return { avg, min, max };
  }

  async runBenchmarks() {
    console.log('📊 Running benchmarks...\n');
    
    // Test 1: Router initialization
    console.log('1️⃣  Router Initialization');
    await this.measureTime('Router Init', async () => {
      const router = new LLMRouter({ autoInit: false });
    }, 1000);
    
    // Test 2: Registry operations
    console.log('2️⃣  Registry Operations');
    await this.measureTime('Registry Lookup', async () => {
      this.router.registry.getAll();
    }, 10000);
    
    // Test 3: Strategy selection
    console.log('3️⃣  Strategy Selection');
    const strategies = ['balanced', 'quality-first', 'speed-priority', 'cost-optimized'];
    for (const strategy of strategies) {
      await this.measureTime(`Strategy: ${strategy}`, async () => {
        this.router.router.config.strategy = strategy;
        await this.router.router.computeModelScores();
      }, 100);
    }
    
    // Test 4: Model routing decisions
    console.log('4️⃣  Model Routing');
    const prompts = [
      'Hello world',
      'Write a long story about AI',
      'Solve this math problem: 2+2',
      'Translate to Spanish: Hello'
    ];
    
    for (const prompt of prompts) {
      await this.measureTime(`Route: "${prompt.substring(0, 20)}..."`, async () => {
        try {
          await this.router.router.selectModel(prompt, { maxTokens: 100 });
        } catch (e) {
          // Expected if no models loaded
        }
      }, 100);
    }
    
    // Test 5: Cache performance
    console.log('5️⃣  Cache Performance');
    const cacheKey = 'test-prompt';
    
    // Prime cache
    try {
      await this.router.router.selectModel(cacheKey, { cached: true });
    } catch (e) {}
    
    await this.measureTime('Cache Hit', async () => {
      try {
        await this.router.router.selectModel(cacheKey, { cached: true });
      } catch (e) {}
    }, 1000);
    
    // Test 6: Memory usage
    console.log('6️⃣  Memory Analysis');
    const memBefore = process.memoryUsage();
    
    // Create multiple router instances
    const routers = [];
    for (let i = 0; i < 10; i++) {
      routers.push(new LLMRouter({ autoInit: false }));
    }
    
    const memAfter = process.memoryUsage();
    const memDiff = {
      heapUsed: ((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2),
      external: ((memAfter.external - memBefore.external) / 1024 / 1024).toFixed(2)
    };
    
    console.log(`   Memory per router: ${(memDiff.heapUsed / 10).toFixed(2)} MB`);
  }

  printResults() {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 BENCHMARK RESULTS\n');
    
    console.log('┌─────────────────────────────┬───────────┬───────────┬───────────┐');
    console.log('│ Operation                   │ Avg (ms)  │ Min (ms)  │ Max (ms)  │');
    console.log('├─────────────────────────────┼───────────┼───────────┼───────────┤');
    
    for (const result of this.results) {
      const name = result.name.padEnd(27);
      const avg = result.avg.padStart(9);
      const min = result.min.padStart(9);
      const max = result.max.padStart(9);
      console.log(`│ ${name} │ ${avg} │ ${min} │ ${max} │`);
    }
    
    console.log('└─────────────────────────────┴───────────┴───────────┴───────────┘');
    
    // Performance rating
    const avgTime = this.results.reduce((sum, r) => sum + parseFloat(r.avg), 0) / this.results.length;
    let rating = '🚀 Excellent';
    if (avgTime > 10) rating = '✅ Good';
    if (avgTime > 50) rating = '⚠️  Needs Optimization';
    if (avgTime > 100) rating = '❌ Poor';
    
    console.log(`\n⚡ Overall Performance: ${rating} (${avgTime.toFixed(2)}ms avg)`);
  }

  async cleanup() {
    // Save benchmark results
    const timestamp = new Date().toISOString();
    const report = {
      timestamp,
      results: this.results,
      system: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: `${Math.round(require('os').totalmem() / 1024 / 1024 / 1024)}GB`
      }
    };
    
    try {
      await require('fs').promises.writeFile(
        `benchmarks-${timestamp.split('T')[0]}.json`,
        JSON.stringify(report, null, 2)
      );
      console.log(`\n💾 Results saved to benchmarks-${timestamp.split('T')[0]}.json`);
    } catch (e) {
      // Silent fail if can't save
    }
  }
}

// Run benchmarks
async function main() {
  const suite = new BenchmarkSuite();
  
  try {
    await suite.setup();
    await suite.runBenchmarks();
    suite.printResults();
    await suite.cleanup();
  } catch (error) {
    console.error('❌ Benchmark failed:', error.message);
  }
  
  console.log('\n✅ Benchmark suite completed!\n');
  process.exit(0);
}

main().catch(console.error);