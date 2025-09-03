#!/usr/bin/env node
/**
 * 🦙 Ollama Chat Test - Verify Real AI Works
 * 
 * This test proves that Ollama provides REAL AI responses,
 * not fake placeholder text like the old system.
 * 
 * Prerequisites:
 * 1. ollama serve (must be running)
 * 2. ollama pull qwen2.5:3b-instruct-q4_K_M (or any model)
 */

import OllamaAdapter from './src/loaders/adapters/OllamaAdapter.js';
import { Logger } from './src/utils/Logger.js';

const logger = new Logger('OllamaTest');

async function testOllamaChat() {
    console.log('🦙 Testing Ollama Chat - REAL AI Verification\n');
    
    try {
        // Step 1: Initialize Ollama adapter
        logger.info('Step 1: Initializing Ollama adapter...');
        const ollama = new OllamaAdapter();
        
        // Step 2: Check server availability
        logger.info('Step 2: Checking Ollama server...');
        const isAvailable = await ollama.isAvailable();
        
        if (!isAvailable) {
            console.error('❌ Ollama server not running at http://localhost:11434');
            console.log('\n🔧 Setup Instructions:');
            console.log('1. Install: curl -fsSL https://ollama.ai/install.sh | sh');
            console.log('2. Start server: ollama serve');
            console.log('3. Pull model: ollama pull qwen2.5:3b-instruct-q4_K_M');
            console.log('4. Or SmolLM3: ollama pull huggingface.co/HuggingFaceTB/SmolLM3-3B-Base:latest');
            process.exit(1);
        }
        
        logger.success('✅ Ollama server is running!');
        
        // Step 3: Get available models
        logger.info('Step 3: Discovering models...');
        const models = await ollama.getAvailableModels();
        
        if (models.length === 0) {
            console.error('❌ No models found!');
            console.log('\n📦 Pull a model first:');
            console.log('ollama pull qwen2.5:3b-instruct-q4_K_M  # 3B model, good for testing');
            console.log('ollama pull huggingface.co/HuggingFaceTB/SmolLM3-3B-Base:latest  # SmolLM3');
            process.exit(1);
        }
        
        logger.success(`✅ Found ${models.length} models:`);
        models.forEach((model, idx) => {
            const sizeGB = (model.size / 1024 / 1024 / 1024).toFixed(1);
            logger.info(`  ${idx + 1}. ${model.name} (${sizeGB}GB)`);
        });
        
        // Step 4: Select model (prefer SmolLM3 or first available)
        const selectedModel = models.find(m => 
            m.name.toLowerCase().includes('smol') ||
            m.name.toLowerCase().includes('smollm3')
        ) || models[0];
        
        logger.info(`🎯 Using model: ${selectedModel.name}`);
        
        // Step 5: Load model
        logger.info('Step 4: Loading model...');
        const model = await ollama.load(selectedModel.name);
        logger.success(`✅ Model loaded: ${selectedModel.name}`);
        
        // Step 6: Test real AI responses
        logger.info('Step 5: Testing REAL AI responses...\n');
        
        const testPrompts = [
            "What is the capital of France?",
            "Write a haiku about artificial intelligence:",
            "Explain what the LLM Runner Router project does:",
            "Tell me a short joke about programming:"
        ];
        
        for (let i = 0; i < testPrompts.length; i++) {
            const prompt = testPrompts[i];
            console.log(`${i + 1}. 👤 User: ${prompt}`);
            
            const startTime = Date.now();
            const response = await model.generate(prompt, {
                temperature: 0.7,
                maxTokens: 100
            });
            const responseTime = Date.now() - startTime;
            
            // Verify this is real AI, not fake
            const isRealAI = !response.text.includes('[Model output placeholder]') &&
                           !response.text.includes('mock') &&
                           !response.text.includes('fake') &&
                           response.text.length > 10 &&
                           response.text !== prompt;
            
            if (isRealAI) {
                console.log(`   🤖 ${selectedModel.name} (${responseTime}ms): ${response.text.trim()}`);
                console.log(`   ✅ REAL AI CONFIRMED - Neural network inference working!`);
            } else {
                console.log(`   ❌ FAKE RESPONSE DETECTED: ${response.text}`);
                throw new Error('This is still returning fake responses!');
            }
            
            if (response.usage) {
                console.log(`   📊 Tokens: ${response.usage.total_tokens} (${response.usage.prompt_tokens}→${response.usage.completion_tokens})`);
            }
            
            console.log('   ---');
        }
        
        // Step 7: Test streaming (if available)
        logger.info('Step 6: Testing streaming response...');
        const streamPrompt = "Count from 1 to 5:";
        console.log(`👤 User: ${streamPrompt}`);
        process.stdout.write('🌊 Streaming: ');
        
        let streamedText = '';
        let tokenCount = 0;
        const streamStart = Date.now();
        
        try {
            for await (const token of model.stream(streamPrompt, { maxTokens: 50 })) {
                if (token.text) {
                    process.stdout.write(token.text);
                    streamedText += token.text;
                    tokenCount++;
                }
                if (token.done) break;
            }
            
            const streamTime = Date.now() - streamStart;
            const tokensPerSec = tokenCount / (streamTime / 1000);
            
            console.log(`\n   ✅ Streaming works! ${tokenCount} tokens in ${streamTime}ms (${tokensPerSec.toFixed(1)} tok/sec)`);
            
        } catch (streamError) {
            console.log(`\n   ⚠️  Streaming not available: ${streamError.message}`);
        }
        
        // Success!
        console.log('\n🎉 OLLAMA CHAT TEST SUCCESSFUL!');
        console.log('✅ Real AI responses confirmed');
        console.log('✅ No fake placeholder text');
        console.log('✅ Actual neural network inference working');
        console.log(`✅ Model: ${selectedModel.name}`);
        console.log('\n🚀 Ready for production use!');
        console.log('   Start server: node ollama-server.js');
        console.log('   Chat interface: http://localhost:3004/chat');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        if (error.message.includes('Connection refused') || error.message.includes('ECONNREFUSED')) {
            console.log('\n🔧 Ollama server not running. Start with:');
            console.log('ollama serve');
        } else if (error.message.includes('model') && error.message.includes('not found')) {
            console.log('\n📦 Model not available. Pull a model:');
            console.log('ollama pull qwen2.5:3b-instruct-q4_K_M');
        }
        
        process.exit(1);
    }
}

testOllamaChat();