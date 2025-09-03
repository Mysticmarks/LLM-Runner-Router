#!/usr/bin/env node

/**
 * 🦙 Ollama Quick Start Example
 * 
 * This example demonstrates how to use Ollama with LLM Router
 * Run this after setting up Ollama to verify everything works!
 */

import { LLMRouter, setupOllama, addOllamaModel } from '../src/index.js';
import { Logger } from '../src/utils/Logger.js';

const logger = new Logger('OllamaExample');

async function quickStartExample() {
  try {
    logger.info('🦙 Starting Ollama Quick Start Example...\n');

    // Step 1: Initialize LLM Router
    logger.info('Step 1: Initializing LLM Router...');
    const router = new LLMRouter();
    await router.initialize();
    
    // Step 2: Check Ollama availability
    logger.info('Step 2: Checking Ollama server...');
    const ollamaAdapter = router.registry.getLoader('ollama');
    
    if (!ollamaAdapter) {
      throw new Error('Ollama adapter not found. Please ensure the system is properly initialized.');
    }

    const isAvailable = await ollamaAdapter.isAvailable();
    if (!isAvailable) {
      logger.error('❌ Ollama server not available at http://localhost:11434');
      logger.info('Please ensure Ollama is running:');
      logger.info('  1. Install: curl -fsSL https://ollama.ai/install.sh | sh');
      logger.info('  2. Start: ollama serve');
      logger.info('  3. Pull a model: ollama pull qwen2.5:3b-instruct-q4_K_M');
      process.exit(1);
    }
    logger.success('✅ Ollama server is available!');

    // Step 3: Auto-discover models
    logger.info('Step 3: Discovering available Ollama models...');
    const models = await setupOllama();
    
    if (models.length === 0) {
      logger.warn('⚠️  No Ollama models found!');
      logger.info('Please pull at least one model:');
      logger.info('  ollama pull qwen2.5:3b-instruct-q4_K_M  # Fast 3B model');
      logger.info('  ollama pull phi3:mini                     # Microsoft 3.8B model');
      process.exit(1);
    }

    logger.success(`✅ Found ${models.length} Ollama models:`);
    models.forEach(model => {
      logger.info(`  - ${model.name || model.model}`);
    });

    // Step 4: Test simple text generation
    logger.info('\nStep 4: Testing text generation...');
    const firstModel = models[0];
    const prompt = "Write a brief haiku about artificial intelligence:";
    
    logger.info(`Using model: ${firstModel.name || firstModel.model}`);
    logger.info(`Prompt: "${prompt}"`);
    
    const response = await router.quick(prompt, {
      modelId: firstModel.name || firstModel.model
    });

    logger.info('\n📝 Generated Response:');
    console.log('---');
    console.log(response.text);
    console.log('---');
    
    if (response.usage) {
      logger.info(`\n📊 Usage Statistics:`);
      logger.info(`  - Prompt tokens: ${response.usage.promptTokens || response.usage.prompt_tokens || 0}`);
      logger.info(`  - Completion tokens: ${response.usage.completionTokens || response.usage.completion_tokens || 0}`);
      logger.info(`  - Total tokens: ${response.usage.totalTokens || response.usage.total_tokens || 0}`);
    }

    // Step 5: Test streaming (if more than one model available)
    if (models.length > 0) {
      logger.info('\nStep 5: Testing streaming response...');
      const streamPrompt = "Tell me about quantum computing in exactly 3 sentences:";
      logger.info(`Prompt: "${streamPrompt}"`);
      
      process.stdout.write('\n🌊 Streaming Response: ');
      
      let tokenCount = 0;
      const startTime = Date.now();
      
      for await (const token of router.stream(streamPrompt, {
        modelId: firstModel.name || firstModel.model
      })) {
        if (token.text) {
          process.stdout.write(token.text);
          tokenCount++;
        }
      }
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      const tokensPerSec = tokenCount / duration;
      
      console.log(`\n\n⚡ Streaming Performance:`);
      console.log(`  - Duration: ${duration.toFixed(2)}s`);
      console.log(`  - Tokens: ${tokenCount}`);
      console.log(`  - Speed: ${tokensPerSec.toFixed(1)} tokens/sec`);
    }

    // Step 6: Demonstrate manual model loading
    logger.info('\nStep 6: Testing manual model loading...');
    
    try {
      const manualModel = await router.load({
        provider: 'ollama',
        modelId: firstModel.name || firstModel.model
      });
      
      const directResult = await manualModel.generate("What is the capital of France?");
      logger.success('✅ Manual model loading successful!');
      logger.info(`Response: ${directResult.text.substring(0, 100)}...`);
    } catch (error) {
      logger.warn(`⚠️  Manual loading test failed: ${error.message}`);
    }

    // Success summary
    logger.info('\n🎉 Ollama Quick Start Complete!');
    logger.success('✅ All tests passed successfully');
    logger.info('\nNext steps:');
    logger.info('  1. Try different models: ollama pull llama3.1:8b');
    logger.info('  2. Read the full guide: docs/OLLAMA_SETUP.md');
    logger.info('  3. Check out more examples in the examples/ directory');
    
  } catch (error) {
    logger.error('❌ Quick start failed:', error.message);
    
    if (error.message.includes('Connection refused')) {
      logger.info('\n🔧 Troubleshooting:');
      logger.info('  1. Start Ollama: ollama serve');
      logger.info('  2. Check port: curl http://localhost:11434/api/version');
      logger.info('  3. Install if needed: curl -fsSL https://ollama.ai/install.sh | sh');
    }
    
    process.exit(1);
  }
}

// Handle CLI arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🦙 Ollama Quick Start Example

This script tests the Ollama integration with LLM Router.

Prerequisites:
  1. Ollama must be installed and running
  2. At least one model must be pulled

Usage:
  node examples/ollama-quick-start.js

Troubleshooting:
  node examples/ollama-quick-start.js --help

For more information, see docs/OLLAMA_SETUP.md
`);
  process.exit(0);
}

// Run the example
quickStartExample().catch(console.error);