#!/usr/bin/env node

/**
 * Simple test for SmolLM3 loader
 */

import { SmolLM3Loader } from './src/loaders/SmolLM3Loader.js';

console.log('🧪 Testing SmolLM3 Loader...\n');

async function testSmolLM3() {
  const loader = new SmolLM3Loader();
  
  try {
    console.log('📦 Creating SmolLM3 loader...');
    
    // Test if it supports the model
    const supports = loader.supports('./models/smollm3-3b');
    console.log(`✅ Supports SmolLM3: ${supports}`);
    
    if (!supports) {
      throw new Error('Loader does not support SmolLM3');
    }
    
    // Load the model
    console.log('🚀 Loading SmolLM3 model...');
    const model = await loader.load({
      id: 'smollm3-3b',
      name: 'SmolLM3-3B',
      path: './models/smollm3-3b'
    });
    
    console.log(`✅ Model loaded: ${model.name}`);
    console.log(`   - ID: ${model.id}`);
    console.log(`   - Format: ${model.format}`);
    console.log(`   - Loaded: ${model.loaded}`);
    
    // Test prediction
    console.log('\n🎯 Testing prediction...');
    const response = await model.predict('Hello! How are you today?', {
      maxTokens: 50,
      temperature: 0.7
    });
    
    console.log(`✅ Response: "${response.text}"`);
    console.log(`   - Model: ${response.model}`);
    console.log(`   - Tokens: ${response.usage?.totalTokens || 'unknown'}`);
    console.log(`   - Duration: ${response.metadata?.duration || 'unknown'}ms`);
    
    console.log('\n🎉 SmolLM3 test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testSmolLM3().catch(console.error);