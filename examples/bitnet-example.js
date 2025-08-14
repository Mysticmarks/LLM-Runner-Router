#!/usr/bin/env node

/**
 * BitNet Integration Example
 * Demonstrates how to use 1-bit LLMs with the LLM Router
 */

import { LLMRouter } from '../src/index.js';

async function main() {
    console.log('🎯 BitNet Integration Example\n');
    
    // Initialize the router
    const router = new LLMRouter({
        strategy: 'balanced',
        cache: true
    });
    
    await router.initialize();
    console.log('✅ Router initialized\n');
    
    // Example 1: Load a BitNet model from HuggingFace
    console.log('📦 Example 1: Loading BitNet model from HuggingFace...');
    try {
        const model = await router.load({
            source: '1bitLLM/bitnet_b1_58-large',
            type: 'bitnet',
            quantType: 'i2_s',  // Quantization type
            threads: 4,          // Number of CPU threads
            contextSize: 2048    // Context window
        });
        
        console.log('✅ Model loaded:', model.id);
        console.log('   Format:', model.format);
        console.log('   Quantization: 1.58-bit\n');
        
        // Generate text
        console.log('🤖 Generating text...');
        const result = await router.quick(
            'The benefits of 1-bit quantization for LLMs include',
            {
                modelId: model.id,
                maxTokens: 100,
                temperature: 0.7
            }
        );
        
        console.log('📝 Generated:', result.text);
        console.log('⚡ Tokens/sec:', result.performance?.tokensPerSecond);
        
    } catch (error) {
        console.log('⚠️  Note: BitNet requires additional setup:');
        console.log('   1. Install CMake: sudo apt-get install cmake');
        console.log('   2. Run setup: npm run setup:bitnet');
        console.log('   3. Download model: See instructions in setup output\n');
    }
    
    // Example 2: Stream tokens from BitNet model
    console.log('\n📦 Example 2: Streaming tokens...');
    try {
        const model = await router.load({
            source: 'microsoft/BitNet-b1.58-2B-4T',  // Official Microsoft model
            type: 'bitnet',
            quantType: 'i2_s'
        });
        
        console.log('🔄 Streaming response for: "Explain quantum computing in simple terms"');
        
        const stream = await router.stream(
            'Explain quantum computing in simple terms',
            {
                modelId: model.id,
                maxTokens: 150,
                temperature: 0.8
            }
        );
        
        process.stdout.write('💬 ');
        for await (const token of stream) {
            process.stdout.write(token);
        }
        console.log('\n');
        
    } catch (error) {
        console.log('   Error:', error.message);
    }
    
    // Example 3: Compare BitNet with regular models
    console.log('\n📊 Example 3: BitNet vs Regular Model Comparison');
    console.log('=' .repeat(50));
    
    const testPrompt = 'The future of artificial intelligence will';
    
    // Mock comparison (would need actual models)
    const comparison = {
        bitnet: {
            model: 'BitNet-b1.58-3B',
            size: '700MB',
            quantization: '1.58-bit',
            speed: '5-7 tokens/sec (CPU)',
            energy: '55-70% less than FP16'
        },
        regular: {
            model: 'Llama-3B (FP16)',
            size: '6GB',
            quantization: '16-bit',
            speed: '1-2 tokens/sec (CPU)',
            energy: 'Baseline'
        }
    };
    
    console.table(comparison);
    
    // Show available BitNet models
    console.log('\n📚 Available BitNet Models:');
    const BitNetLoader = (await import('../src/loaders/BitNetLoader.js')).default;
    const models = await BitNetLoader.listAvailableModels();
    
    console.log('\n🏢 Official Models:');
    models.official.forEach(m => console.log(`   - ${m}`));
    
    console.log('\n🌟 Community Models:');
    models.community.forEach(m => console.log(`   - ${m}`));
    
    console.log('\n✨ BitNet Benefits:');
    console.log('   • 1.37x to 6.17x speedup on CPU');
    console.log('   • 55-82% energy reduction');
    console.log('   • Run 100B models on single CPU');
    console.log('   • Lossless inference quality');
    console.log('   • Perfect for edge deployment');
}

// Run the example
main().catch(console.error);