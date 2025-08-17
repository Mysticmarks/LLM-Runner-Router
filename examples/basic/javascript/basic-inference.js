#!/usr/bin/env node

/**
 * Basic JavaScript/Node.js example demonstrating LLM Router usage
 * 
 * This example shows:
 * - Simple client initialization
 * - Basic inference request
 * - Error handling
 * - Resource cleanup
 */

import { LLMRouter } from '../../../src/index.js';
import { performance } from 'perf_hooks';

async function basicInferenceExample() {
    console.log('🚀 LLM Router Basic Inference Example\n');
    
    const router = new LLMRouter({
        autoInit: false,
        strategy: 'balanced'
    });
    
    try {
        console.log('📚 Initializing router...');
        const startTime = performance.now();
        
        await router.initialize();
        
        const initTime = performance.now() - startTime;
        console.log(`✅ Router initialized in ${initTime.toFixed(2)}ms\n`);
        
        // Get router status
        const status = router.getStatus();
        console.log('📊 Router Status:');
        console.log(`   Models loaded: ${status.modelsLoaded}`);
        console.log(`   Engine: ${status.engine}`);
        console.log(`   Strategy: ${status.strategy}\n`);
        
        // Basic inference
        console.log('🤖 Running basic inference...');
        const inferenceStart = performance.now();
        
        const response = await router.quick(
            'What is machine learning and how does it work?',
            {
                maxTokens: 150,
                temperature: 0.7
            }
        );
        
        const inferenceTime = performance.now() - inferenceStart;
        
        console.log('\n📝 Response:');
        console.log(`   Text: ${response.text || response}`);
        console.log(`   Model: ${response.model || 'unknown'}`);
        console.log(`   Time: ${inferenceTime.toFixed(2)}ms\n`);
        
        // Advanced inference with options
        console.log('🎛️ Running advanced inference...');
        const advancedStart = performance.now();
        
        const advancedResponse = await router.advanced(
            'Explain the benefits of TypeScript over JavaScript',
            {
                requirements: {
                    minQuality: 0.8,
                    maxLatency: 5000,
                    preferredFormats: ['gguf', 'onnx']
                },
                options: {
                    maxTokens: 200,
                    temperature: 0.6,
                    topP: 0.9
                }
            }
        );
        
        const advancedTime = performance.now() - advancedStart;
        
        console.log('\n📝 Advanced Response:');
        console.log(`   Text: ${advancedResponse.text || advancedResponse}`);
        console.log(`   Model: ${advancedResponse.model || 'unknown'}`);
        console.log(`   Time: ${advancedTime.toFixed(2)}ms\n`);
        
        // List available models
        console.log('📋 Available models:');
        const models = router.registry.getAll();
        models.forEach((model, index) => {
            console.log(`   ${index + 1}. ${model.name || model.id} (${model.format || 'unknown'})`);
        });
        
    } catch (error) {
        console.error('❌ Error occurred:', error.message);
        
        if (error.code === 'NO_MODELS_LOADED') {
            console.log('\n💡 Tip: Make sure you have models loaded in the registry.');
            console.log('   You can load models using router.load() or check the registry.json file.');
        } else if (error.code === 'NETWORK_ERROR') {
            console.log('\n💡 Tip: Check if the LLM Router server is running on the expected port.');
        } else if (error.code === 'TIMEOUT_ERROR') {
            console.log('\n💡 Tip: Increase the timeout or check model performance.');
        }
        
        console.error('\n🔍 Error details:');
        console.error(`   Type: ${error.constructor.name}`);
        console.error(`   Code: ${error.code || 'unknown'}`);
        console.error(`   Stack: ${error.stack}`);
        
        process.exit(1);
    } finally {
        // Cleanup resources
        console.log('\n🧹 Cleaning up resources...');
        try {
            await router.cleanup();
            console.log('✅ Resources cleaned up successfully');
        } catch (cleanupError) {
            console.warn('⚠️  Warning: Failed to cleanup resources:', cleanupError.message);
        }
    }
}

// Performance monitoring
function monitorPerformance() {
    const memUsage = process.memoryUsage();
    
    console.log('\n📊 Performance Metrics:');
    console.log(`   Memory RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Memory Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Memory Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Memory External: ${(memUsage.external / 1024 / 1024).toFixed(2)} MB`);
}

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Graceful shutdown initiated...');
    process.exit(0);
});

// Run the example
console.log('Starting LLM Router Basic Example...\n');

basicInferenceExample()
    .then(() => {
        monitorPerformance();
        console.log('\n🎉 Example completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Example failed:', error);
        process.exit(1);
    });