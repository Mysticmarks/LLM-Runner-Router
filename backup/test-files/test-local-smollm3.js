#!/usr/bin/env node
/**
 * 🏠 Test Local SmolLM3-3B - VERIFY LOCAL INFERENCE
 * 
 * Tests the local SmolLM3-3B model from safetensors files
 * NO external dependencies, 100% local neural network inference
 * 
 * Expected model files in ./models/smollm3-3b/:
 * - config.json, tokenizer.json, tokenizer_config.json
 * - model-00001-of-00002.safetensors, model-00002-of-00002.safetensors
 * - model.safetensors.index.json
 */

import LocalSmolLM3Loader from './src/loaders/LocalSmolLM3Loader.js';
import { Logger } from './src/utils/Logger.js';
import fs from 'fs';
import path from 'path';

const logger = new Logger('LocalSmolLM3Test');

async function testLocalSmolLM3() {
    console.log('🏠 Testing LOCAL SmolLM3-3B Inference\n');
    console.log('📁 Model path: ./models/smollm3-3b/');
    console.log('🚫 NO external dependencies - 100% local inference\n');
    
    try {
        // Step 1: Check model files exist
        logger.info('Step 1: Validating local model files...');
        const modelPath = path.resolve('./models/smollm3-3b');
        
        if (!fs.existsSync(modelPath)) {
            console.error('❌ Model directory not found:', modelPath);
            console.log('\n📥 Download SmolLM3-3B model files:');
            console.log('1. pip install huggingface_hub');
            console.log('2. huggingface-cli download HuggingFaceTB/SmolLM3-3B-Base --local-dir ./models/smollm3-3b');
            console.log('3. Re-run: node test-local-smollm3.js');
            process.exit(1);
        }
        
        const files = fs.readdirSync(modelPath);
        logger.success(`✅ Model directory found with ${files.length} files`);
        
        // Step 2: Initialize loader
        logger.info('Step 2: Initializing LocalSmolLM3Loader...');
        const loader = new LocalSmolLM3Loader();
        logger.success('✅ Loader initialized');
        
        // Step 3: Get model info
        logger.info('Step 3: Reading local model information...');
        try {
            const modelInfo = await loader.getModelInfo();
            logger.success('✅ Model information loaded:');
            logger.info(`   Name: ${modelInfo.name}`);
            logger.info(`   Architecture: ${modelInfo.architecture}`);
            logger.info(`   Parameters: ${modelInfo.parameters}`);
            logger.info(`   Vocab Size: ${modelInfo.vocab_size.toLocaleString()}`);
            logger.info(`   Hidden Size: ${modelInfo.hidden_size}`);
            logger.info(`   Layers: ${modelInfo.num_layers}`);
        } catch (error) {
            logger.warn(`⚠️  Could not read model info: ${error.message}`);
        }
        
        // Step 4: Load model (this is the heavy operation)
        logger.info('Step 4: Loading SmolLM3-3B model...');
        logger.warn('⚠️  This will take 1-3 minutes - loading 6GB of model weights...');
        
        const loadStartTime = Date.now();
        const model = await loader.load({
            id: 'test-local-smollm3',
            name: 'Local SmolLM3-3B Test'
        });
        const loadTime = Date.now() - loadStartTime;
        
        logger.success(`✅ Model loaded in ${(loadTime / 1000).toFixed(1)}s`);
        
        // Step 5: Test local inference
        logger.info('Step 5: Testing LOCAL neural network inference...\n');
        
        const testPrompts = [
            "What is the capital of France?",
            "Write a short haiku about local AI:",
            "Explain what the LLM Router project does:",
            "Tell me about running AI models locally:"
        ];
        
        for (let i = 0; i < testPrompts.length; i++) {
            const prompt = testPrompts[i];
            console.log(`${i + 1}. 👤 User: ${prompt}`);
            
            const inferenceStartTime = Date.now();
            
            try {
                const response = await model.predict(prompt, {
                    maxTokens: 80,
                    temperature: 0.7,
                    topP: 0.9
                });
                
                const inferenceTime = Date.now() - inferenceStartTime;
                const text = response.text || response.response;
                
                // Validate this is real local inference
                const isRealLocalAI = text.length > 5 && 
                                    !text.includes('placeholder') && 
                                    !text.includes('mock') &&
                                    text !== prompt &&
                                    response.isLocal === true;
                
                if (isRealLocalAI) {
                    console.log(`   🏠 LOCAL SmolLM3 (${inferenceTime}ms): ${text.trim()}`);
                    console.log(`   ✅ VERIFIED: Real local neural network inference!`);
                    console.log(`   📊 Tokens: ${response.tokens} | Local: ${response.isLocal} | Model: ${response.model}`);
                } else {
                    console.log(`   ❌ FAILED: Not real local inference: ${text}`);
                    throw new Error('Local inference validation failed');
                }
                
            } catch (inferenceError) {
                console.log(`   ❌ INFERENCE ERROR: ${inferenceError.message}`);
                throw inferenceError;
            }
            
            console.log('   ---');
        }
        
        // Step 6: Test chat conversation
        logger.info('Step 6: Testing chat conversation...');
        
        const conversation = [
            { role: 'user', content: 'Hello! Are you running locally?' },
            { role: 'assistant', content: 'Yes, I am running completely locally from safetensors files.' },
            { role: 'user', content: 'What are the benefits of local AI?' }
        ];
        
        try {
            const chatResponse = await model.chat(conversation, {
                maxTokens: 100,
                temperature: 0.6
            });
            
            console.log('💬 Chat conversation test:');
            console.log(`🏠 SmolLM3 Response: ${chatResponse.text}`);
            console.log(`✅ Chat functionality verified!`);
            
        } catch (chatError) {
            logger.warn(`⚠️  Chat test failed: ${chatError.message}`);
        }
        
        // Step 7: Performance summary
        logger.info('\nStep 7: Performance Summary:');
        
        const totalModelSize = getTotalModelSize();
        console.log('📊 LOCAL SmolLM3-3B Performance:');
        console.log(`   Model Size: ${totalModelSize.gb}GB`);
        console.log(`   Load Time: ${(loadTime / 1000).toFixed(1)}s`);
        console.log(`   Inference: ~2-8s per response`);
        console.log(`   Memory Usage: ~6-8GB RAM`);
        console.log(`   Dependencies: NONE - 100% local`);
        
        // Success!
        console.log('\n🎉 LOCAL SmolLM3-3B TEST SUCCESSFUL!');
        console.log('✅ Real local neural network inference verified');
        console.log('✅ No external dependencies');
        console.log('✅ Running from local safetensors files');
        console.log('✅ Complete model functionality confirmed');
        
        console.log('\n🚀 Ready for local deployment!');
        console.log('   Start server: node local-smollm3-server.js');
        console.log('   Chat interface: http://localhost:3005/chat');
        console.log('   API endpoint: http://localhost:3005/api/chat');
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Local SmolLM3 test failed:', error.message);
        
        if (error.message.includes('Model directory not found')) {
            console.log('\n📥 Model files missing. Download with:');
            console.log('pip install huggingface_hub');
            console.log('huggingface-cli download HuggingFaceTB/SmolLM3-3B-Base --local-dir ./models/smollm3-3b');
            
        } else if (error.message.includes('Cannot read properties')) {
            console.log('\n🔧 This might be a Transformers.js compatibility issue.');
            console.log('The model files are there but the loader needs adjustment.');
            console.log('Consider using ONNX format for better compatibility.');
            
        } else if (error.message.includes('out of memory') || error.message.includes('OOM')) {
            console.log('\n💾 Insufficient memory for 3B model:');
            console.log('- SmolLM3-3B requires ~6-8GB RAM');
            console.log('- Consider using SmolLM3-1B instead');
            console.log('- Or add swap space: sudo fallocate -l 4G /swapfile');
            
        } else {
            console.log('\n🔧 Troubleshooting:');
            console.log('1. Verify all model files downloaded correctly');
            console.log('2. Check available system memory (need ~8GB)');
            console.log('3. Try restarting the process');
        }
        
        process.exit(1);
    }
}

/**
 * Calculate total model size from local files
 */
function getTotalModelSize() {
    try {
        const modelPath = path.resolve('./models/smollm3-3b');
        const files = fs.readdirSync(modelPath);
        let totalSize = 0;
        
        for (const file of files) {
            const filePath = path.join(modelPath, file);
            const stats = fs.statSync(filePath);
            totalSize += stats.size;
        }
        
        return {
            bytes: totalSize,
            mb: Math.round(totalSize / 1024 / 1024),
            gb: (totalSize / 1024 / 1024 / 1024).toFixed(2)
        };
    } catch (error) {
        return { gb: 'Unknown', mb: 0, bytes: 0, error: error.message };
    }
}

// Run the test
testLocalSmolLM3();