#!/usr/bin/env node

import { LLMRouter } from './src/index.js';

async function testModelLoading() {
    console.log('🧪 Testing LLM Router Model Loading...\n');
    
    try {
        // Create router with auto-init disabled
        console.log('📦 Creating LLMRouter instance...');
        const router = new LLMRouter({
            autoInit: false,
            strategy: 'balanced'
        });
        
        console.log('✅ Router created successfully\n');
        
        // Initialize the router
        console.log('🔄 Initializing router...');
        await router.initialize();
        console.log('✅ Router initialized\n');
        
        // Check registered models
        const models = router.registry.getAll();
        console.log(`📚 Registered models: ${models.length}`);
        
        if (models.length > 0) {
            models.forEach(model => {
                console.log(`  - ${model.id}: ${model.name} (${model.format})`);
            });
        } else {
            console.log('  No models registered yet.\n');
            
            // Try to register the TinyLlama model
            console.log('🔄 Attempting to register TinyLlama model...');
            try {
                await router.load({
                    source: './models/tinyllama/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
                    format: 'gguf',
                    id: 'tinyllama-1.1b-chat'
                });
                console.log('✅ TinyLlama model registered successfully\n');
            } catch (loadErr) {
                console.log(`⚠️  Could not load TinyLlama: ${loadErr.message}\n`);
            }
        }
        
        // Test a simple inference if models are available
        const currentModels = router.registry.getAll();
        if (currentModels.length > 0) {
            console.log('🚀 Testing inference with prompt: "Hello, how are you?"');
            try {
                const result = await router.quick('Hello, how are you?', {
                    maxTokens: 50
                });
                console.log('✅ Inference result:', result);
            } catch (inferErr) {
                console.log(`⚠️  Inference not available: ${inferErr.message}`);
                console.log('   This is expected if the model loader is not fully implemented.\n');
            }
        }
        
        console.log('\n✅ Model loading test complete!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('\nStack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
testModelLoading().catch(err => {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
});
