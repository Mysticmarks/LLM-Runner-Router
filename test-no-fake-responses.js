#!/usr/bin/env node

/**
 * Test script to verify NO fake responses are returned
 * All responses should either be real AI or error messages
 */

import { LLMRouter } from './src/index.js';

async function testNoFakeResponses() {
  console.log('🧪 Testing that NO fake responses are returned...\n');
  
  const router = new LLMRouter();
  await router.initialize();

  const testPrompts = [
    "What color is the sky?",
    "Why do cats meow?",
    "Tell me a story about a coconut",
    "How do magnets work?",
    "What is 2 + 2?",
    "Write a poem about space",
    "Hello, how are you?",
    "What can you help me with?",
    "Tell me about yourself",
    "Create a story about a banana"
  ];

  console.log('Testing with random prompts to ensure NO fake responses...\n');

  for (const prompt of testPrompts) {
    console.log(`\n📝 Testing: "${prompt}"`);
    console.log('-'.repeat(60));
    
    try {
      const result = await router.quick(prompt, { 
        modelId: 'simple-smollm3',
        maxTokens: 100 
      });
      
      // Check for any fake response patterns
      const fakePatterns = [
        "I understand you're asking about",
        "As SmolLM3 running locally",
        "I'd be happy to",
        "I'm here to help",
        "What would you like",
        "I can assist with",
        "Programming is both an art",
        "Hello! I'm SmolLM3",
        "Considering the key aspects",
        "This is an interesting topic",
        "an extraordinary tale unfolds",
        "Here's a story about",
        "Here's a poem about",
        "The answer is 4",
        "I'm processing your query"
      ];
      
      const responseText = result.text || result.response || JSON.stringify(result);
      console.log(`Response: ${responseText.substring(0, 200)}...`);
      
      // Check if response contains fake patterns
      const hasFakeResponse = fakePatterns.some(pattern => 
        responseText.includes(pattern)
      );
      
      if (hasFakeResponse) {
        console.error(`\n❌ FAKE RESPONSE DETECTED!`);
        console.error(`Full response: ${responseText}`);
        process.exit(1);
      } else {
        console.log(`✅ Response appears to be real AI or error (no fake patterns detected)`);
      }
      
    } catch (error) {
      console.log(`🔴 Error (expected): ${error.message}`);
      
      // Check if error message indicates fallback was called
      if (error.message.includes('FALLBACK') || 
          error.message.includes('AI inference failed') ||
          error.message.includes('generation failed')) {
        console.log(`✅ Correct error thrown - no fake response returned`);
      } else {
        console.log(`⚠️ Unexpected error: ${error.message}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Test complete - checking for fake responses finished');
  console.log('='.repeat(60));
  
  await router.cleanup();
  process.exit(0);
}

// Run the test
testNoFakeResponses().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});