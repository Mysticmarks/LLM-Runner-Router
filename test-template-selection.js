#!/usr/bin/env node

/**
 * Test script to verify model template auto-selection
 */

import ModelTemplates from './src/config/ModelTemplates.js';

console.log('🧪 Testing Model Template Auto-Selection\n');
console.log('=' . repeat(50));

const testCases = [
    { modelId: 'tinyllama-1.1b-chat', expected: 'tinyllama' },
    { modelId: 'phi-2.Q4_K_M', expected: 'phi' },
    { modelId: 'mistral-7b-instruct', expected: 'mistral' },
    { modelId: 'llama-2-7b-chat', expected: 'llama' },
    { modelId: 'codellama-7b', expected: 'codellama' },
    { modelId: 'orca-mini-3b', expected: 'orca' },
    { modelId: 'wizard-vicuna-7b', expected: 'wizard' },
    { modelId: 'stablelm-3b', expected: 'stablelm' },
    { modelId: 'unknown-model', expected: 'default' },
];

let passed = 0;
let failed = 0;

testCases.forEach(({ modelId, expected }) => {
    const template = ModelTemplates.getTemplateForModel(modelId);
    const templateName = Object.entries(ModelTemplates.templates)
        .find(([_, t]) => t === template)?.[0] || 'unknown';
    
    const success = templateName === expected;
    
    console.log(`\n📋 Model: ${modelId}`);
    console.log(`   Expected: ${expected}`);
    console.log(`   Got: ${templateName}`);
    console.log(`   Status: ${success ? '✅ PASS' : '❌ FAIL'}`);
    
    if (success) {
        passed++;
        console.log(`   Template: ${template.name}`);
        console.log(`   User Prefix: ${template.userPrefix.replace(/\n/g, '\\n')}`);
        console.log(`   Assistant Prefix: ${template.assistantPrefix.replace(/\n/g, '\\n')}`);
    } else {
        failed++;
    }
});

console.log('\n' + '=' . repeat(50));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
    console.log('✅ All tests passed! Template auto-selection is working correctly.');
} else {
    console.log('❌ Some tests failed. Check the template mappings.');
    process.exit(1);
}

// Test conversation formatting
console.log('\n' + '=' . repeat(50));
console.log('\n📝 Testing Conversation Formatting\n');

const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' },
    { role: 'assistant', content: 'Hi! How can I help you today?' }
];

const modelId = 'tinyllama-1.1b-chat';
const formatted = ModelTemplates.formatConversation(messages, modelId);

console.log(`Formatted conversation for ${modelId}:`);
console.log('-'.repeat(40));
console.log(formatted.replace(/\n/g, '\\n'));
console.log('-'.repeat(40));

console.log('\n✅ Template system test complete!');