/**
 * Test script to verify actual AI inference is working
 */

import SimpleSmolLM3Loader from './src/loaders/SimpleSmolLM3Loader.js';

async function testActualAI() {
  console.log('🧪 Testing Actual AI Inference');
  console.log('================================');
  
  try {
    // Create loader instance
    const loader = new SimpleSmolLM3Loader();
    
    // Load the model
    console.log('📥 Loading model...');
    const model = await loader.load();
    
    // Test different types of messages
    const testMessages = [
      "Hello, how are you?",
      "Tell me a story about a robot",
      "What is 2 + 2?",
      "Explain quantum physics"
    ];
    
    for (const testMessage of testMessages) {
      console.log(`\n👤 User: ${testMessage}`);
      console.log('🤖 AI: ');
      
      try {
        const response = await model.predict(testMessage);
        console.log(response.response);
        console.log(`   (${response.method}, ${response.inference_time_ms}ms, ${response.tokens} tokens)`);
      } catch (error) {
        console.log(`Error: ${error.message}`);
      }
    }
    
    console.log('\n✅ AI inference test complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testActualAI().catch(console.error);