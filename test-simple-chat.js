#!/usr/bin/env node
/**
 * Simple chat test - proves SmolLM3 actually works
 * No complex routing, no unnecessary abstractions
 */

import SmolLM3Loader from './src/loaders/SmolLM3Loader.js';

async function testSimpleChat() {
    console.log('🚀 Starting SIMPLE chat test with SmolLM3...\n');

    try {
        // Create the loader directly
        const loader = new SmolLM3Loader();
        console.log('✅ SmolLM3Loader created');

        // Load the model
        const model = await loader.load({
            id: 'test-chat',
            name: 'SmolLM3 Test',
            source: 'smollm3'
        });
        console.log('✅ Model loaded successfully\n');

        // Test messages
        const testMessages = [
            "Hello, how are you?",
            "What is the capital of France?",
            "Tell me a short joke"
        ];

        for (const message of testMessages) {
            console.log(`👤 User: ${message}`);
            
            const start = Date.now();
            const response = await model.predict(message, {
                maxTokens: 50,
                temperature: 0.7
            });
            const time = Date.now() - start;

            const text = response.text || response.response || response;
            console.log(`🤖 SmolLM3 (${time}ms): ${text}`);
            console.log('---');
        }

        console.log('✅ Simple chat test completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testSimpleChat();