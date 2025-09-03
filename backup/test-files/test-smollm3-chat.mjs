#!/usr/bin/env node

/**
 * Direct SmolLM3 Chat Test
 * Tests the SmolLM3 loader and model functionality directly
 */

import { LLMRouter } from './src/index.js';
import SmolLM3Loader from './src/loaders/SmolLM3Loader.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testSmolLM3Chat() {
  console.log('🚀 Testing SmolLM3 Chat System...\n');
  
  try {
    // Initialize the router
    console.log('1. Initializing LLM Router...');
    const router = new LLMRouter();
    
    // Register SmolLM3 loader
    console.log('2. Registering SmolLM3 loader...');
    const smolLM3Loader = new SmolLM3Loader();
    router.registry.registerLoader('smollm3', smolLM3Loader);
    
    // Test model path
    const modelPath = path.join(__dirname, 'models', 'smollm3-3b');
    console.log(`3. Testing SmolLM3 model at: ${modelPath}`);
    
    // Try to load the model directly with the loader
    console.log('4. Loading SmolLM3 model...');
    const model = await smolLM3Loader.load({
      source: modelPath,
      name: 'smollm3-3b'
    });
    
    console.log('✅ SmolLM3 model loaded successfully!\n');
    console.log(`📋 Model info: ${model.name} (${model.format || 'SmolLM3'})`);
    
    // Test chat messages
    const testMessages = [
      "Hello! How are you?",
      "What is your name?", 
      "Can you help me with programming?",
      "Tell me a joke",
      "Explain what you are in simple terms"
    ];
    
    console.log('🔥 Testing Chat Functionality:\n');
    
    for (let i = 0; i < testMessages.length; i++) {
      const message = testMessages[i];
      console.log(`💬 User: ${message}`);
      
      try {
        const startTime = Date.now();
        
        // Use the model's predict method
        const result = await model.predict(message, {
          maxTokens: 100,
          temperature: 0.7
        });
        
        const responseTime = Date.now() - startTime;
        
        console.log(`🤖 SmolLM3: ${result.generated_text || result.text || result.response || result}`);
        console.log(`⏱️  Response time: ${responseTime}ms`);
        console.log(`📊 Model: SmolLM3-3B\n`);
        
      } catch (error) {
        console.error(`❌ Error generating response: ${error.message}\n`);
      }
    }
    
    console.log('🎉 SmolLM3 Chat Test Complete!');
    
  } catch (error) {
    console.error('❌ SmolLM3 Chat Test Failed:', error);
    
    // Fallback test - just check if files exist
    console.log('\n🔍 Diagnostic Information:');
    try {
      const fs = await import('fs/promises');
      const modelPath = path.join(__dirname, 'models', 'smollm3-3b');
      const files = await fs.readdir(modelPath);
      console.log(`📁 Model files found: ${files.length}`);
      console.log(`📄 Files: ${files.join(', ')}`);
    } catch (fsError) {
      console.log('❌ Could not access model files:', fsError.message);
    }
  }
  
  process.exit(0);
}

// Run the test
testSmolLM3Chat().catch(console.error);