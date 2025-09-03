#!/usr/bin/env node
/**
 * Test updated SmolLM3-3B model with proper chat templates
 */

import SmolLM3Loader from './src/loaders/SmolLM3Loader.js';

async function testUpdatedSmolLM3() {
    console.log('🚀 Testing updated SmolLM3-3B with chat templates and project context...\n');

    try {
        const loader = new SmolLM3Loader();
        console.log('✅ SmolLM3Loader created');

        const model = await loader.load({
            id: 'test-smollm3-updated',
            name: 'SmolLM3-3B Test',
            source: 'smollm3'
        });
        console.log('✅ Model loaded successfully\n');

        // Test project-relevant questions
        const testMessages = [
            "What is the LLM Runner Router?",
            "How do I load a model with this framework?",
            "What routing strategies are available?",
            "Tell me about the architecture"
        ];

        for (const message of testMessages) {
            console.log(`👤 User: ${message}`);
            
            const start = Date.now();
            const response = await model.predict(message, {
                maxTokens: 150,
                temperature: 0.7
            });
            const time = Date.now() - start;

            console.log(`🤖 SmolLM3-3B (${time}ms): ${response.text}`);
            console.log('---');
        }

        console.log('\n🧪 Testing chat conversation...');
        
        const conversation = [
            { role: 'user', content: 'How do I get started with this LLM framework?' },
            { role: 'assistant', content: 'To get started with LLM Router, you can use the simple approach by creating a loader and loading a model directly.' },
            { role: 'user', content: 'Can you show me a code example?' }
        ];

        console.log('💬 Chat conversation test:');
        const chatResponse = await model.chat(conversation, {
            maxTokens: 200,
            temperature: 0.6
        });
        
        console.log(`🤖 SmolLM3-3B Chat Response: ${chatResponse.text}`);

        console.log('\n✅ Updated SmolLM3-3B test completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testUpdatedSmolLM3();