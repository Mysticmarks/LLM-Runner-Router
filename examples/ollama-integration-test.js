#!/usr/bin/env node

/**
 * 🦙 Ollama Integration Test
 * 
 * Comprehensive test of all Ollama features with LLM Router
 * Use this to verify your setup is working correctly
 */

import { LLMRouter, setupOllama, addOllamaModel } from '../src/index.js';
import { Logger } from '../src/utils/Logger.js';

const logger = new Logger('OllamaTest');

class OllamaIntegrationTest {
  constructor() {
    this.router = new LLMRouter();
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  async runTest(name, testFn) {
    try {
      logger.info(`🧪 Testing: ${name}`);
      await testFn();
      this.passed++;
      logger.success(`✅ PASS: ${name}`);
    } catch (error) {
      this.failed++;
      logger.error(`❌ FAIL: ${name} - ${error.message}`);
    }
  }

  async runAllTests() {
    logger.info('🦙 Starting Ollama Integration Tests\n');

    // Test 1: Initialize Router and Check Ollama Adapter
    await this.runTest('Router Initialization and Ollama Registration', async () => {
      await this.router.initialize();
      const adapter = this.router.registry.getLoader('ollama');
      if (!adapter) {
        throw new Error('Ollama adapter not registered');
      }
    });

    // Test 2: Ollama Server Connectivity
    await this.runTest('Ollama Server Connection', async () => {
      const adapter = this.router.registry.getLoader('ollama');
      const isAvailable = await adapter.isAvailable();
      if (!isAvailable) {
        throw new Error('Cannot connect to Ollama server at http://localhost:11434');
      }
    });

    // Test 3: Model Discovery
    let availableModels = [];
    await this.runTest('Model Discovery', async () => {
      const adapter = this.router.registry.getLoader('ollama');
      availableModels = await adapter.getAvailableModels();
      if (availableModels.length === 0) {
        throw new Error('No models found. Please pull at least one: ollama pull qwen2.5:3b-instruct-q4_K_M');
      }
      logger.info(`  Found ${availableModels.length} models: ${availableModels.map(m => m.name).join(', ')}`);
    });

    // Test 4: Auto Setup
    let setupModels = [];
    await this.runTest('Automatic Setup', async () => {
      setupModels = await setupOllama();
      if (setupModels.length === 0) {
        throw new Error('Setup failed to register models');
      }
    });

    // Test 5: Manual Model Addition
    await this.runTest('Manual Model Registration', async () => {
      if (availableModels.length === 0) {
        throw new Error('No models available for manual registration');
      }
      
      const firstModel = availableModels[0];
      await addOllamaModel(firstModel.name, {
        name: `Test-${firstModel.name}`,
        description: 'Test model registration'
      });
    });

    // Test 6: Direct Model Loading
    let testModel = null;
    await this.runTest('Direct Model Loading', async () => {
      if (availableModels.length === 0) {
        throw new Error('No models available for loading');
      }

      testModel = await this.router.load({
        provider: 'ollama',
        modelId: availableModels[0].name
      });

      if (!testModel) {
        throw new Error('Model loading returned null');
      }
    });

    // Test 7: Text Generation
    await this.runTest('Text Generation', async () => {
      if (!testModel) {
        throw new Error('No test model available');
      }

      const response = await testModel.generate('What is 2+2?');
      if (!response || !response.text) {
        throw new Error('Generation returned empty response');
      }
      
      logger.info(`  Response: "${response.text.substring(0, 50)}..."`);
    });

    // Test 8: Chat Completion
    await this.runTest('Chat Completion', async () => {
      if (!testModel) {
        throw new Error('No test model available');
      }

      const chatResponse = await testModel.chat([
        { role: 'user', content: 'Say hello' }
      ]);
      
      if (!chatResponse || !chatResponse.text) {
        throw new Error('Chat completion returned empty response');
      }
      
      logger.info(`  Chat response: "${chatResponse.text.substring(0, 50)}..."`);
    });

    // Test 9: Streaming Generation
    await this.runTest('Streaming Generation', async () => {
      if (!testModel) {
        throw new Error('No test model available');
      }

      let tokenCount = 0;
      let hasContent = false;

      for await (const token of testModel.stream('Count from 1 to 5:')) {
        if (token.text) {
          hasContent = true;
          tokenCount++;
        }
        if (tokenCount >= 10) break; // Limit test duration
      }

      if (!hasContent) {
        throw new Error('Streaming returned no tokens');
      }
      
      logger.info(`  Streamed ${tokenCount} tokens`);
    });

    // Test 10: Quick Method
    await this.runTest('Router Quick Method', async () => {
      if (availableModels.length === 0) {
        throw new Error('No models available for quick method');
      }

      const quickResponse = await this.router.quick('What is AI?', {
        modelId: availableModels[0].name
      });

      if (!quickResponse || !quickResponse.text) {
        throw new Error('Quick method returned empty response');
      }
      
      logger.info(`  Quick response: "${quickResponse.text.substring(0, 50)}..."`);
    });

    // Test 11: Error Handling
    await this.runTest('Error Handling', async () => {
      try {
        await this.router.load({
          provider: 'ollama',
          modelId: 'nonexistent-model-12345'
        });
        throw new Error('Should have thrown error for nonexistent model');
      } catch (error) {
        if (error.message.includes('Should have thrown')) {
          throw error;
        }
        // Expected error - test passes
        logger.info(`  Correctly handled error: ${error.message.substring(0, 50)}...`);
      }
    });

    // Test 12: Performance Benchmark
    await this.runTest('Performance Benchmark', async () => {
      if (!testModel) {
        throw new Error('No test model available');
      }

      const startTime = Date.now();
      const response = await testModel.generate('Explain quantum physics in one sentence:');
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      const tokenCount = response.text ? response.text.split(' ').length : 0;
      const tokensPerSec = tokenCount / (duration / 1000);
      
      logger.info(`  Performance: ${duration}ms, ${tokenCount} tokens, ${tokensPerSec.toFixed(1)} tokens/sec`);
      
      if (duration > 30000) { // 30 seconds
        throw new Error('Generation too slow (>30s)');
      }
    });

    // Final Results
    logger.info('\n🏁 Test Results Summary:');
    logger.info(`✅ Passed: ${this.passed}`);
    logger.info(`❌ Failed: ${this.failed}`);
    logger.info(`📊 Total: ${this.passed + this.failed}`);
    
    if (this.failed === 0) {
      logger.success('🎉 All tests passed! Ollama integration is working perfectly.');
      logger.info('\n🚀 Your Ollama setup is ready for production use!');
      logger.info('Next steps:');
      logger.info('  - Try the quick start example: node examples/ollama-quick-start.js');
      logger.info('  - Read the full setup guide: docs/OLLAMA_SETUP.md');
      logger.info('  - Explore more examples in examples/ directory');
    } else {
      logger.error(`\n🔧 ${this.failed} test(s) failed. Please check your Ollama setup:`);
      logger.info('  1. Ensure Ollama is running: ollama serve');
      logger.info('  2. Pull at least one model: ollama pull qwen2.5:3b-instruct-q4_K_M');
      logger.info('  3. Check server: curl http://localhost:11434/api/version');
      logger.info('  4. See troubleshooting guide: docs/OLLAMA_SETUP.md#troubleshooting');
      process.exit(1);
    }
  }
}

// CLI handling
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🦙 Ollama Integration Test Suite

This script runs comprehensive tests of the Ollama integration.

Prerequisites:
  1. Ollama server running: ollama serve
  2. At least one model: ollama pull qwen2.5:3b-instruct-q4_K_M

Usage:
  node examples/ollama-integration-test.js

For setup instructions, see docs/OLLAMA_SETUP.md
`);
  process.exit(0);
}

// Run tests
const testSuite = new OllamaIntegrationTest();
testSuite.runAllTests().catch(error => {
  logger.error('❌ Test suite failed:', error.message);
  process.exit(1);
});