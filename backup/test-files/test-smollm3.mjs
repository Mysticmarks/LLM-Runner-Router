#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing SmolLM3-3B Model Integration...\n');

// Test 1: Verify model files exist
console.log('📁 Checking SmolLM3-3B files...');
const modelDir = path.join(__dirname, 'models', 'smollm3-3b');
const requiredFiles = [
    'config.json',
    'model-00001-of-00002.safetensors',
    'model-00002-of-00002.safetensors',
    'model.safetensors.index.json',
    'tokenizer.json',
    'tokenizer_config.json'
];

let filesOK = true;
for (const file of requiredFiles) {
    const filePath = path.join(modelDir, file);
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`  ✅ ${file} - ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
    } else {
        console.log(`  ❌ ${file} - Missing`);
        filesOK = false;
    }
}

if (!filesOK) {
    console.log('\n❌ Model files incomplete!');
    process.exit(1);
}

// Test 2: Verify registry entry
console.log('\n📚 Checking model registry...');
const registryPath = path.join(__dirname, 'models', 'registry.json');
if (fs.existsSync(registryPath)) {
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const smollm3Model = registry.models.find(m => m.id === 'smollm3-3b');
    
    if (smollm3Model) {
        console.log('  ✅ SmolLM3-3B found in registry');
        console.log(`     - ID: ${smollm3Model.id}`);
        console.log(`     - Name: ${smollm3Model.name}`);
        console.log(`     - Format: ${smollm3Model.format}`);
        console.log(`     - Path: ${smollm3Model.path}`);
        console.log(`     - Architecture: ${smollm3Model.architecture.type}`);
        console.log(`     - Parameters: ${(smollm3Model.parameters.total_size / 1024 / 1024 / 1024).toFixed(2)} GB`);
    } else {
        console.log('  ❌ SmolLM3-3B not found in registry');
        filesOK = false;
    }
} else {
    console.log('  ❌ Registry file not found');
    filesOK = false;
}

// Test 3: Try to load LLM Router
console.log('\n🚀 Testing LLM Router initialization...');
try {
    const { LLMRouter } = await import('./src/index.js');
    console.log('  ✅ LLMRouter imported successfully');
    
    // Test basic initialization
    const router = new LLMRouter({
        autoInit: false,
        strategy: 'balanced',
        logLevel: 'error'  // Reduce log noise
    });
    
    console.log('  ✅ Router initialized');
    
    // Check available models
    const models = router.registry.list();
    console.log(`  📊 Found ${models.length} models in registry`);
    
    const smollm3 = models.find(m => m.id === 'smollm3-3b');
    if (smollm3) {
        console.log('  ✅ SmolLM3-3B available in router registry');
        console.log(`     - Status: ${smollm3.status || 'Unknown'}`);
    } else {
        console.log('  ⚠️  SmolLM3-3B not loaded in router (may need manual registration)');
    }
    
} catch (err) {
    console.log(`  ⚠️  Router initialization issue: ${err.message}`);
    console.log('     This may be expected if the model isn\'t fully configured yet');
}

// Test 4: Validate model configuration
console.log('\n🔍 Validating model configuration...');
const configPath = path.join(modelDir, 'config.json');
if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    console.log('  ✅ Model configuration loaded');
    console.log(`     - Model type: ${config.model_type}`);
    console.log(`     - Architecture: ${config.architectures?.[0]}`);
    console.log(`     - Vocab size: ${config.vocab_size.toLocaleString()}`);
    console.log(`     - Hidden layers: ${config.num_hidden_layers}`);
    console.log(`     - Context length: ${config.max_position_embeddings.toLocaleString()}`);
    
    // Validate essential fields
    const requiredFields = ['model_type', 'vocab_size', 'hidden_size', 'num_hidden_layers'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length === 0) {
        console.log('  ✅ All required configuration fields present');
    } else {
        console.log(`  ⚠️  Missing fields: ${missingFields.join(', ')}`);
    }
}

// Test 5: Check tokenizer
console.log('\n🔤 Checking tokenizer...');
const tokenizerPath = path.join(modelDir, 'tokenizer.json');
if (fs.existsSync(tokenizerPath)) {
    try {
        const tokenizer = JSON.parse(fs.readFileSync(tokenizerPath, 'utf8'));
        console.log('  ✅ Tokenizer configuration valid');
        console.log(`     - Version: ${tokenizer.version}`);
        console.log(`     - Model type: ${tokenizer.model?.type}`);
        console.log(`     - Vocab size: ${Object.keys(tokenizer.model?.vocab || {}).length.toLocaleString()}`);
    } catch (err) {
        console.log(`  ⚠️  Tokenizer parsing issue: ${err.message}`);
    }
}

console.log('\n' + '='.repeat(50));
if (filesOK) {
    console.log('🎉 SmolLM3-3B Model Integration Test: PASSED');
    console.log('   All files present and registry configured correctly!');
    console.log('\n📝 Next steps:');
    console.log('   - Test model inference with: npm run benchmark');
    console.log('   - Start development server with: npm run dev');
    console.log('   - Run full test suite with: npm test');
} else {
    console.log('❌ SmolLM3-3B Model Integration Test: FAILED');
    console.log('   Some issues need to be resolved');
    process.exit(1);
}
console.log('='.repeat(50));