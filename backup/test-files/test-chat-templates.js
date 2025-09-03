#!/usr/bin/env node
/**
 * 🎭 Chat Template System Test
 * 
 * Test the new Jinja2-compatible chat template system
 * with SmolLM3 and other model formats
 */

import ChatTemplateEngine from './src/templates/ChatTemplateEngine.js';
import SimpleSmolLM3Loader from './src/loaders/SimpleSmolLM3Loader.js';
import { Logger } from './src/utils/Logger.js';
import fs from 'fs';

const logger = new Logger('ChatTemplateTest');

async function testChatTemplateEngine() {
  logger.info('🎭 Testing Chat Template Engine...\n');
  
  const engine = new ChatTemplateEngine();
  
  // Test 1: Available templates
  const templates = engine.getAvailableTemplates();
  logger.info(`✅ Available templates: ${templates.join(', ')}`);
  
  // Test 2: Template detection
  logger.info('\n🔍 Testing template auto-detection...');
  
  const testCases = [
    { name: 'smollm3-3b', expected: 'smollm3' },
    { name: 'llama-3.1-8b', expected: 'llama' },
    { name: 'mistral-7b-v0.3', expected: 'mistral' },
    { name: 'qwen2-7b', expected: 'qwen' },
    { name: 'phi-3-mini', expected: 'phi' },
    { name: 'gemma-2b', expected: 'gemma' },
    { name: 'unknown-model', expected: 'default' }
  ];
  
  for (const testCase of testCases) {
    const detected = engine.detectModelFamily(testCase.name);
    const status = detected === testCase.expected ? '✅' : '❌';
    logger.info(`${status} ${testCase.name} → ${detected} (expected: ${testCase.expected})`);
  }
  
  // Test 3: Message formatting
  logger.info('\n📝 Testing message formatting...');
  
  const testMessages = [
    { role: 'user', content: 'Hello, can you help me?' }
  ];
  
  try {
    // Test SmolLM3 formatting
    const smollm3Template = engine.getTemplate('smollm3');
    const formatted = engine.renderTemplate(smollm3Template.template, {
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        ...testMessages
      ],
      add_generation_prompt: true
    });
    
    logger.success('✅ SmolLM3 template formatting successful');
    logger.info('📋 Formatted output preview:');
    console.log(formatted.substring(0, 200) + '...\n');
    
  } catch (error) {
    logger.error(`❌ Template formatting failed: ${error.message}`);
  }
  
  // Test 4: Jinja2 expression evaluation
  logger.info('🧮 Testing Jinja2 expression evaluation...');
  
  const testContext = {
    messages: [
      { role: 'system', content: 'System message' },
      { role: 'user', content: 'User message' }
    ]
  };
  
  const expressions = [
    { expr: "messages[0]['role']", expected: 'system' },
    { expr: "messages[1]['content']", expected: 'User message' },
    { expr: "messages[0]['role'] == 'system'", expected: true }
  ];
  
  for (const test of expressions) {
    try {
      const result = engine.evaluateExpression(test.expr, testContext);
      const status = result === test.expected ? '✅' : '❌';
      logger.info(`${status} ${test.expr} → ${result} (expected: ${test.expected})`);
    } catch (error) {
      logger.error(`❌ Expression evaluation failed: ${test.expr} - ${error.message}`);
    }
  }
}

async function testSmolLM3Integration() {
  logger.info('\n🏠 Testing SmolLM3 Loader Integration...\n');
  
  try {
    const loader = new SimpleSmolLM3Loader();
    
    // Test template detection with actual model files
    logger.info('📁 Testing with actual model files...');
    
    const modelExists = fs.existsSync('./models/smollm3-3b');
    if (!modelExists) {
      logger.warn('⚠️ SmolLM3 model files not found, skipping integration test');
      return;
    }
    
    // Load the model to trigger template detection
    const model = await loader.load({ id: 'test-smollm3' });
    logger.success('✅ Model loaded with template system');
    
    // Test formatting
    const testInput = 'What is the LLM Router system?';
    const formatted = await loader.formatChatInput(testInput, { useSystemPrompt: true });
    
    logger.success('✅ Chat input formatting successful');
    logger.info('📋 Formatted input preview:');
    console.log(formatted.substring(0, 200) + '...\n');
    
    // Test model prediction
    logger.info('🤖 Testing model prediction with new templates...');
    const response = await model.predict(testInput, { temperature: 0.7 });
    
    logger.success('✅ Prediction successful with template system');
    logger.info(`📊 Response metadata: ${JSON.stringify({
      model: response.model,
      method: response.method,
      templateUsed: response.templateInfo ? 'New Template System' : 'Legacy',
      tokens: response.tokens
    }, null, 2)}`);
    
    logger.info(`💬 Response preview: "${response.text.substring(0, 100)}..."`);
    
  } catch (error) {
    logger.error(`❌ SmolLM3 integration test failed: ${error.message}`);
  }
}

async function runAllTests() {
  console.log('🎭 Chat Template System Comprehensive Test\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    await testChatTemplateEngine();
    await testSmolLM3Integration();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.success('🎉 All chat template tests completed!');
    
  } catch (error) {
    logger.error(`❌ Test suite failed: ${error.message}`);
    process.exit(1);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export { testChatTemplateEngine, testSmolLM3Integration };