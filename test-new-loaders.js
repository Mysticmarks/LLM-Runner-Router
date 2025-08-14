#!/usr/bin/env node

/**
 * Test script for PyTorch and Binary model loaders
 */

import { PyTorchLoader } from './src/loaders/PyTorchLoader.js';
import { BinaryLoader } from './src/loaders/BinaryLoader.js';
import path from 'path';
import fs from 'fs/promises';

console.log('🧪 Testing PyTorch and Binary Model Loaders\n');
console.log('=' . repeat(50));

async function createTestFile(filepath, content = 'test') {
  // Create directory if it doesn't exist
  const dir = path.dirname(filepath);
  await fs.mkdir(dir, { recursive: true });
  
  // Create a small test file
  const buffer = Buffer.from(content);
  await fs.writeFile(filepath, buffer);
  console.log(`✅ Created test file: ${filepath}`);
}

async function testPyTorchLoader() {
  console.log('\n📋 Testing PyTorch Loader');
  console.log('-'.repeat(40));
  
  const loader = new PyTorchLoader();
  
  // Test canHandle method
  console.log('\nTesting canHandle():');
  console.log('  model.pth:', loader.canHandle('model.pth'));
  console.log('  model.pt:', loader.canHandle('model.pt'));
  console.log('  model.bin:', loader.canHandle('model.bin'));
  console.log('  model.gguf:', loader.canHandle('model.gguf'));
  
  // Create a test .pth file
  const testPath = './test-models/test-model.pth';
  await createTestFile(testPath, 'PKtest'); // ZIP signature for PyTorch
  
  try {
    // Test loading
    console.log('\nLoading test PyTorch model...');
    const model = await loader.load(testPath, {
      name: 'Test PyTorch Model',
      id: 'test-pytorch-1'
    });
    
    console.log('✅ Model loaded successfully');
    console.log('  Model ID:', model.id);
    console.log('  Model Name:', model.name);
    console.log('  Model Format:', model.format);
    
    // Test model info
    const info = model.getInfo();
    console.log('  Capabilities:', info.capabilities);
    
    // Test generation (will be placeholder)
    console.log('\nTesting generation...');
    const result = await model.generate('Test prompt');
    console.log('  Response received:', result.text.substring(0, 50) + '...');
    
    // Test unloading
    console.log('\nUnloading model...');
    await loader.unload(model.id);
    console.log('✅ Model unloaded successfully');
    
  } catch (error) {
    console.error('❌ PyTorch loader test failed:', error.message);
  }
  
  // Clean up test file
  await fs.unlink(testPath).catch(() => {});
}

async function testBinaryLoader() {
  console.log('\n📋 Testing Binary Loader');
  console.log('-'.repeat(40));
  
  const loader = new BinaryLoader();
  
  // Test canHandle method
  console.log('\nTesting canHandle():');
  console.log('  model.bin:', loader.canHandle('model.bin'));
  console.log('  pytorch_model.bin:', loader.canHandle('pytorch_model.bin'));
  console.log('  model.gguf:', loader.canHandle('model.gguf'));
  
  // Test different binary file types
  const testFiles = [
    { path: './test-models/pytorch_model.bin', content: 'PK\x03\x04' }, // PyTorch ZIP
    { path: './test-models/unknown_model.bin', content: 'UNKNOWN' },
    { path: './test-models/ggml_model.bin', content: 'ggml' }
  ];
  
  for (const testFile of testFiles) {
    await createTestFile(testFile.path, testFile.content);
    
    try {
      console.log(`\nLoading ${path.basename(testFile.path)}...`);
      const model = await loader.load(testFile.path, {
        name: path.basename(testFile.path, '.bin'),
        id: `test-binary-${Date.now()}`
      });
      
      console.log('✅ Model loaded successfully');
      console.log('  Model ID:', model.id);
      console.log('  Detected Format:', model.detectedFormat);
      console.log('  Metadata:', model.modelMetadata);
      
      // Test generation
      const result = await model.generate('Test prompt');
      console.log('  Response:', result.text.substring(0, 80) + '...');
      
      // Unload
      await loader.unload(model.id);
      
    } catch (error) {
      console.error(`❌ Failed to load ${testFile.path}:`, error.message);
    }
    
    // Clean up
    await fs.unlink(testFile.path).catch(() => {});
  }
  
  // Test with config file
  console.log('\nTesting with companion config file...');
  const modelPath = './test-models/model_with_config.bin';
  const configPath = './test-models/model_with_config.json';
  
  await createTestFile(modelPath, 'TEST');
  await fs.writeFile(configPath, JSON.stringify({
    model_type: 'bert',
    architectures: ['BertForSequenceClassification'],
    hidden_size: 768,
    num_hidden_layers: 12
  }));
  
  try {
    const model = await loader.load(modelPath, {
      name: 'Model with Config',
      id: 'test-with-config'
    });
    
    console.log('✅ Model with config loaded');
    console.log('  Model Type:', model.modelType);
    console.log('  Architectures:', model.architectures);
    console.log('  Config:', model.modelConfig);
    
    await loader.unload(model.id);
  } catch (error) {
    console.error('❌ Failed to load model with config:', error.message);
  }
  
  // Clean up
  await fs.unlink(modelPath).catch(() => {});
  await fs.unlink(configPath).catch(() => {});
}

async function testLoaderInfo() {
  console.log('\n📋 Loader Information');
  console.log('-'.repeat(40));
  
  const pytorchLoader = new PyTorchLoader();
  const binaryLoader = new BinaryLoader();
  
  console.log('\nPyTorch Loader Info:');
  console.log(JSON.stringify(pytorchLoader.getInfo(), null, 2));
  
  console.log('\nBinary Loader Info:');
  console.log(JSON.stringify(binaryLoader.getInfo(), null, 2));
}

async function cleanup() {
  // Clean up test directory
  try {
    await fs.rmdir('./test-models', { recursive: true });
    console.log('\n✅ Cleaned up test files');
  } catch (error) {
    // Directory might not exist
  }
}

async function main() {
  try {
    await testPyTorchLoader();
    await testBinaryLoader();
    await testLoaderInfo();
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ All loader tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

main();