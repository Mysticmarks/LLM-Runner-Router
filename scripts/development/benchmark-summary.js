#!/usr/bin/env node

import { LLMRouter } from './src/index.js';
import { performance } from 'perf_hooks';

console.log('📊 LLM Router Performance Summary\n');
console.log('═'.repeat(50));

async function runQuickBenchmark() {
  const router = new LLMRouter({ 
    autoInit: false,
    strategy: 'balanced' 
  });
  
  // Measure initialization time
  const initStart = performance.now();
  await router.initialize();
  const initTime = performance.now() - initStart;
  
  console.log('\n⚡ Performance Metrics:');
  console.log('─'.repeat(50));
  console.log(`Router Initialization: ${initTime.toFixed(2)}ms`);
  
  // Check if model is loaded
  const models = router.registry.getAll();
  console.log(`Models Loaded: ${models.length}`);
  
  if (models.length > 0) {
    // Test inference speed
    console.log('\n🚀 Inference Benchmark:');
    console.log('─'.repeat(50));
    
    const prompts = [
      'Hello',
      'What is 2+2?',
      'Tell me a joke'
    ];
    
    for (const prompt of prompts) {
      try {
        const start = performance.now();
        const result = await router.quick(prompt, { maxTokens: 20 });
        const elapsed = performance.now() - start;
        
        console.log(`Prompt: "${prompt}"`);
        console.log(`  Time: ${elapsed.toFixed(0)}ms`);
        console.log(`  Tokens: ${result.tokens}`);
        console.log(`  Speed: ${(result.tokens / (elapsed/1000)).toFixed(1)} tokens/sec`);
        console.log();
      } catch (err) {
        console.log(`  Error: ${err.message}`);
      }
    }
  }
  
  // Memory usage
  const memUsage = process.memoryUsage();
  console.log('💾 Memory Usage:');
  console.log('─'.repeat(50));
  console.log(`RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  
  console.log('\n✅ Benchmark complete!');
}

runQuickBenchmark().catch(console.error);