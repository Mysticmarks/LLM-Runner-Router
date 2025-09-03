#!/usr/bin/env node

/**
 * 🚀 LLM Router Deployment Validation
 * Comprehensive system validation for production readiness
 */

import { LLMRouter } from './src/index.js';
import { Logger } from './src/utils/Logger.js';
import SmolLM3Loader from './src/loaders/SmolLM3Loader.js';
import os from 'os';

const logger = new Logger('DeploymentValidator');

class DeploymentValidator {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: []
    };
  }

  async runValidation() {
    console.log('🚀 LLM Router Deployment Validation\n');
    console.log('='.repeat(50));

    try {
      await this.testSystemInitialization();
      await this.testSmolLM3Integration();
      await this.testErrorHandling();
      await this.testPerformance();
      await this.testResourceManagement();
      await this.testProductionReadiness();

      this.printResults();
      
      if (this.results.failed === 0) {
        console.log('\n🎉 DEPLOYMENT VALIDATION PASSED!');
        console.log('✅ System is ready for production deployment');
        process.exit(0);
      } else {
        console.log('\n❌ DEPLOYMENT VALIDATION FAILED');
        console.log(`${this.results.failed} critical issues need to be resolved`);
        process.exit(1);
      }

    } catch (error) {
      console.error('❌ Validation failed with error:', error);
      process.exit(1);
    }
  }

  async testSystemInitialization() {
    console.log('\n📋 Testing System Initialization...');
    
    try {
      const router = new LLMRouter({ autoInit: false });
      const startTime = Date.now();
      await router.initialize();
      const initTime = Date.now() - startTime;

      this.addTest('System Initialization', true, `Initialized in ${initTime}ms`);
      
      const status = router.getStatus();
      this.addTest('System Status', status.initialized, `Engine: ${status.engine}, Environment: ${status.environment}`);

      await router.cleanup();
      this.addTest('System Cleanup', true, 'Resources cleaned up successfully');

    } catch (error) {
      this.addTest('System Initialization', false, error.message);
    }
  }

  async testSmolLM3Integration() {
    console.log('\n🧠 Testing SmolLM3 Integration...');

    try {
      const loader = new SmolLM3Loader();
      
      // Test model loading
      const model = await loader.load({
        id: 'validation-test',
        source: './models/validation-test',
        name: 'Validation Test Model'
      });

      this.addTest('SmolLM3 Model Loading', true, `Model: ${model.name}, Format: ${model.format}`);

      // Test prediction capability
      const response = await model.predict('Hello, test the system', { maxTokens: 50 });
      const responseValid = response.text && response.text.length > 10;
      this.addTest('SmolLM3 Prediction', responseValid, `Generated ${response.usage.completionTokens} tokens`);

      // Test streaming
      let streamTokens = 0;
      for await (const chunk of model.stream('Test streaming', { maxTokens: 20 })) {
        streamTokens++;
        if (streamTokens >= 10) break;
      }
      this.addTest('SmolLM3 Streaming', streamTokens > 5, `Streamed ${streamTokens} tokens`);

      // Test chat functionality
      const chatResponse = await model.chat([
        { role: 'user', content: 'Test chat functionality' }
      ], { maxTokens: 30 });
      this.addTest('SmolLM3 Chat', chatResponse.text.length > 5, 'Chat interface working');

      await model.unload();

    } catch (error) {
      this.addTest('SmolLM3 Integration', false, error.message);
    }
  }

  async testErrorHandling() {
    console.log('\n🛡️ Testing Error Handling...');

    try {
      const router = new LLMRouter({ autoInit: false });
      await router.initialize();

      // Test with invalid model
      try {
        await router.quick('Test prompt', { modelId: 'non-existent-model' });
        this.addTest('Graceful Fallback', true, 'System handled missing model gracefully');
      } catch (error) {
        // Check if error is handled gracefully
        const isGraceful = error.message.includes('No models available') || 
                          error.message.includes('fallback');
        this.addTest('Graceful Fallback', isGraceful, 'Error handling in place');
      }

      // Test resource limits
      const memUsage = process.memoryUsage();
      const memoryInMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      this.addTest('Memory Usage', memoryInMB < 500, `${memoryInMB}MB heap used`);

      await router.cleanup();

    } catch (error) {
      this.addTest('Error Handling', false, error.message);
    }
  }

  async testPerformance() {
    console.log('\n⚡ Testing Performance...');

    try {
      const loader = new SmolLM3Loader();
      const model = await loader.load({
        id: 'perf-test',
        source: './models/perf-test'
      });

      // Test response time
      const startTime = Date.now();
      const response = await model.predict('Performance test prompt', { maxTokens: 100 });
      const responseTime = Date.now() - startTime;

      this.addTest('Response Time', responseTime < 3000, `${responseTime}ms response time`);
      this.addTest('Token Generation', response.usage.completionTokens > 10, `Generated ${response.usage.completionTokens} tokens`);

      // Test concurrent requests
      const concurrentStart = Date.now();
      const promises = Array(3).fill().map(() => 
        model.predict('Concurrent test', { maxTokens: 50 })
      );
      await Promise.all(promises);
      const concurrentTime = Date.now() - concurrentStart;

      this.addTest('Concurrent Processing', concurrentTime < 5000, `3 requests in ${concurrentTime}ms`);

      await model.unload();

    } catch (error) {
      this.addTest('Performance Testing', false, error.message);
    }
  }

  async testResourceManagement() {
    console.log('\n💾 Testing Resource Management...');

    try {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create and destroy multiple models
      for (let i = 0; i < 3; i++) {
        const loader = new SmolLM3Loader();
        const model = await loader.load({
          id: `resource-test-${i}`,
          source: `./models/resource-test-${i}`
        });
        
        await model.predict('Resource test', { maxTokens: 20 });
        await model.unload();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024;
      
      this.addTest('Memory Leak Prevention', memoryGrowth < 50, `Memory growth: ${memoryGrowth.toFixed(2)}MB`);
      
      // Test CPU usage
      const cpuCount = os.cpus().length;
      this.addTest('CPU Detection', cpuCount > 0, `Detected ${cpuCount} CPU cores`);

    } catch (error) {
      this.addTest('Resource Management', false, error.message);
    }
  }

  async testProductionReadiness() {
    console.log('\n🏭 Testing Production Readiness...');

    try {
      // Test environment detection
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1));
      this.addTest('Node.js Version', majorVersion >= 18, `Running ${nodeVersion}`);

      // Test module imports
      const router = new LLMRouter({ autoInit: false });
      await router.initialize();
      
      const status = router.getStatus();
      const engineOk = status.engine !== 'unknown' || status.engine === undefined; // undefined is ok for minimal setup
      this.addTest('Engine Selection', engineOk, `Selected: ${status.engine || 'auto'}`);
      this.addTest('Environment Detection', status.environment === 'node', `Detected: ${status.environment}`);

      // Test configuration validation
      const hasConfig = router.config && router.config.strategy;
      const strategyName = router.config?.strategy || 'balanced';
      this.addTest('Configuration Valid', hasConfig, `Strategy: ${strategyName}`);

      // Test logging system
      const testLogger = new Logger('ValidationTest');
      testLogger.info('Test log message');
      this.addTest('Logging System', true, 'Logger functional');

      await router.cleanup();

    } catch (error) {
      this.addTest('Production Readiness', false, error.message);
    }
  }

  addTest(name, passed, details = '') {
    this.results.tests.push({ name, passed, details });
    if (passed) {
      this.results.passed++;
      console.log(`  ✅ ${name}: ${details}`);
    } else {
      this.results.failed++;
      console.log(`  ❌ ${name}: ${details}`);
    }
  }

  printResults() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 VALIDATION RESULTS');
    console.log('='.repeat(50));
    
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`⚠️  Warnings: ${this.results.warnings}`);
    console.log(`📋 Total Tests: ${this.results.tests.length}`);
    
    const successRate = (this.results.passed / this.results.tests.length) * 100;
    console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);

    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.tests
        .filter(test => !test.passed)
        .forEach(test => console.log(`  • ${test.name}: ${test.details}`));
    }
  }
}

// Run validation
const validator = new DeploymentValidator();
validator.runValidation().catch(console.error);