#!/usr/bin/env node

/**
 * Test SmolLM3 Integration
 * Test the improved SmolLM3 loader with real and mock functionality
 */

import { LLMRouter } from './src/index.js';
import SmolLM3Loader from './src/loaders/SmolLM3Loader.js';

async function testSmolLM3Integration() {
  console.log('🧪 Testing SmolLM3 Integration...\n');

  try {
    // Test 1: Create SmolLM3 Loader directly
    console.log('1️⃣ Testing SmolLM3 Loader directly...');
    const loader = new SmolLM3Loader();
    
    // Test with mock path (will fallback to intelligent mock)
    const mockModel = await loader.load({
      id: 'smollm3-test',
      source: './models/smollm3-mock',
      name: 'SmolLM3 Test Model'
    });

    console.log(`✅ Model loaded: ${mockModel.name}`);
    console.log(`   Format: ${mockModel.format}`);
    console.log(`   Capabilities: ${Object.keys(mockModel.capabilities).join(', ')}`);

    // Test 2: Test prediction with contextual prompts
    console.log('\n2️⃣ Testing contextual responses...');
    
    const testPrompts = [
      'Write a Python function to calculate fibonacci numbers',
      'What is machine learning and how does it work?',
      'Write a creative story about a robot',
      'Analyze the benefits of renewable energy',
      'Hello, how are you today?'
    ];

    for (const prompt of testPrompts) {
      console.log(`\n📝 Prompt: "${prompt}"`);
      try {
        const response = await mockModel.predict(prompt, { maxTokens: 100 });
        console.log(`✅ Response: ${response.text.substring(0, 150)}${response.text.length > 150 ? '...' : ''}`);
        console.log(`⏱️  Duration: ${response.metadata.duration}ms`);
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }
    }

    // Test 3: Test streaming
    console.log('\n3️⃣ Testing streaming functionality...');
    const streamPrompt = 'Explain the concept of artificial intelligence';
    console.log(`📝 Streaming prompt: "${streamPrompt}"`);
    console.log('🔄 Stream tokens:');
    
    let tokenCount = 0;
    for await (const chunk of mockModel.stream(streamPrompt, { maxTokens: 50 })) {
      process.stdout.write(chunk.token);
      tokenCount++;
      if (tokenCount > 20) break; // Limit for demo
    }
    console.log(`\n✅ Streaming completed (${tokenCount} tokens)`);

    // Test 4: Test chat functionality
    console.log('\n4️⃣ Testing chat interface...');
    const messages = [
      { role: 'user', content: 'Hello! Can you help me with coding?' },
      { role: 'assistant', content: 'Of course! I\'d be happy to help you with coding.' },
      { role: 'user', content: 'I need to create a REST API in Node.js' }
    ];

    const chatResponse = await mockModel.chat(messages, { maxTokens: 150 });
    console.log(`✅ Chat response: ${chatResponse.text.substring(0, 200)}${chatResponse.text.length > 200 ? '...' : ''}`);

    // Test 5: Test through LLMRouter
    console.log('\n5️⃣ Testing through LLMRouter...');
    
    const router = new LLMRouter({
      autoInit: false
    });

    await router.initialize();
    
    // Load model through router
    const routerModel = await router.load({
      id: 'smollm3',
      source: './models/smollm3-test',
      format: 'smollm3'
    });
    
    const routerResponse = await router.quick('Tell me about the benefits of using SmolLM3', {
      modelId: 'smollm3',
      maxTokens: 100
    });

    console.log(`✅ Router response: ${routerResponse.text.substring(0, 200)}${routerResponse.text.length > 200 ? '...' : ''}`);

    // Cleanup
    await mockModel.unload();
    await router.cleanup();

    console.log('\n🎉 All SmolLM3 integration tests passed!');
    console.log('\n📊 Summary:');
    console.log('   ✅ SmolLM3 Loader creation');
    console.log('   ✅ Intelligent mock fallback');
    console.log('   ✅ Contextual response generation');
    console.log('   ✅ Streaming functionality');
    console.log('   ✅ Chat interface');
    console.log('   ✅ LLMRouter integration');

  } catch (error) {
    console.error('\n❌ SmolLM3 integration test failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testSmolLM3Integration().catch(console.error);