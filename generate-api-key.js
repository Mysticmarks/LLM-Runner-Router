#!/usr/bin/env node

/**
 * 🔑 API Key Generator for LLM Router
 * Generate a new API key for testing the LLM Router API
 */

import { APIKeyManager } from './src/auth/APIKeyManager.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function generateAPIKey() {
  console.log('🔑 LLM Router API Key Generator\n');
  
  try {
    // Get customer information
    const name = await question('Customer name (optional): ') || 'Test User';
    const email = await question('Email (optional): ') || null;
    const tier = await question('Tier (basic/premium/enterprise) [basic]: ') || 'basic';
    
    console.log('\n🔧 Generating API key...\n');
    
    // Initialize API Key Manager
    const apiKeyManager = new APIKeyManager();
    await apiKeyManager.initialize();
    
    // Create the API key
    const result = await apiKeyManager.createAPIKey({
      name,
      email,
      tier
    });
    
    // Display results
    console.log('✅ API Key Generated Successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 API KEY DETAILS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔑 API Key: ${result.fullKey}`);
    console.log(`🆔 Key ID: ${result.keyId}`);
    console.log(`👤 Customer: ${name}`);
    console.log(`📧 Email: ${email || 'Not provided'}`);
    console.log(`🏷️  Tier: ${result.tier}`);
    console.log(`⚡ Rate Limit: ${result.rateLimit.requests} requests/${result.rateLimit.window}`);
    console.log(`📊 Monthly Quota: ${result.quotas.monthly.requests} requests`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🚨 IMPORTANT: Save this API key now - it will not be shown again!\n');
    
    // Usage examples
    console.log('💡 USAGE EXAMPLES:\n');
    console.log('Test with curl:');
    console.log(`curl -H "X-API-Key: ${result.fullKey}" https://api.llmrouter.dev/api/health\n`);
    
    console.log('Test with the test suite:');
    console.log(`cd /home/mikecerqua/LLM-Runner-Test-Suite`);
    console.log(`echo "API_KEY=${result.fullKey}" > .env`);
    console.log(`./test-suite.sh\n`);
    
    console.log('Chat completion example:');
    console.log(`curl -X POST https://api.llmrouter.dev/api/chat \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -H "X-API-Key: ${result.fullKey}" \\`);
    console.log(`  -d '{"message":"Hello, world!","model":"auto","max_tokens":100}'\n`);
    
  } catch (error) {
    console.error('❌ Error generating API key:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Cancelled by user');
  rl.close();
  process.exit(0);
});

// Run the generator
generateAPIKey();