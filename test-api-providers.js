#!/usr/bin/env node

/**
 * Quick test script for API providers
 * Run: node test-api-providers.js
 */

import dotenv from 'dotenv';
import APILoader from './src/loaders/APILoader.js';
import OpenAIAdapter from './src/loaders/adapters/OpenAIAdapter.js';
import AnthropicAdapter from './src/loaders/adapters/AnthropicAdapter.js';
import OpenRouterAdapter from './src/loaders/adapters/OpenRouterAdapter.js';
import GroqAdapter from './src/loaders/adapters/GroqAdapter.js';

// Load environment variables
dotenv.config();

console.log('🧪 Testing API Providers for LLM-Runner-Router\n');
console.log('=' .repeat(50));

// Test results
const results = {
  passed: [],
  failed: [],
  skipped: []
};

/**
 * Test a provider
 */
async function testProvider(name, apiKey, TestAdapter, modelId) {
  if (!apiKey) {
    console.log(`⏭️  Skipping ${name} (no API key)`);
    results.skipped.push(name);
    return;
  }
  
  console.log(`\n🔬 Testing ${name}...`);
  
  try {
    // Create adapter
    const adapter = new TestAdapter({ apiKey });
    
    // Load model
    console.log(`   Loading model: ${modelId}`);
    const model = await adapter.load(modelId, { testConnection: false });
    console.log(`   ✅ Model loaded: ${model.id}`);
    
    // Test completion
    console.log(`   Testing completion...`);
    const response = await adapter.complete('Say "test successful" in 3 words.', {
      maxTokens: 10,
      temperature: 0
    });
    
    if (response && response.text) {
      console.log(`   ✅ Response: ${response.text.trim()}`);
      results.passed.push(name);
    } else {
      throw new Error('No response received');
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    results.failed.push(`${name}: ${error.message}`);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  // Test basic APILoader
  console.log('\n🔬 Testing Base APILoader...');
  try {
    const loader = new APILoader({ provider: 'openai' });
    console.log('   ✅ APILoader instantiated');
    results.passed.push('APILoader');
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    results.failed.push(`APILoader: ${error.message}`);
  }
  
  // Test providers
  await testProvider(
    'OpenAI',
    process.env.OPENAI_API_KEY,
    OpenAIAdapter,
    'gpt-3.5-turbo'
  );
  
  await testProvider(
    'Anthropic',
    process.env.ANTHROPIC_API_KEY,
    AnthropicAdapter,
    'claude-3-haiku-20240307'
  );
  
  await testProvider(
    'OpenRouter',
    process.env.OPENROUTER_API_KEY,
    OpenRouterAdapter,
    'auto'
  );
  
  await testProvider(
    'Groq',
    process.env.GROQ_API_KEY,
    GroqAdapter,
    'llama3-8b-8192'
  );
  
  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Test Results Summary:\n');
  
  console.log(`✅ Passed: ${results.passed.length}`);
  if (results.passed.length > 0) {
    results.passed.forEach(test => console.log(`   - ${test}`));
  }
  
  console.log(`\n❌ Failed: ${results.failed.length}`);
  if (results.failed.length > 0) {
    results.failed.forEach(test => console.log(`   - ${test}`));
  }
  
  console.log(`\n⏭️  Skipped: ${results.skipped.length}`);
  if (results.skipped.length > 0) {
    results.skipped.forEach(test => console.log(`   - ${test} (no API key)`));
  }
  
  // Overall status
  console.log('\n' + '=' .repeat(50));
  if (results.failed.length === 0 && results.passed.length > 0) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else if (results.passed.length === 0) {
    console.log('⚠️  No tests passed. Please check your API keys.');
    process.exit(1);
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});