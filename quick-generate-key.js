#!/usr/bin/env node

/**
 * 🔑 Quick API Key Generator
 * Generate an API key without interactive prompts
 */

import { APIKeyManager } from './src/auth/APIKeyManager.js';

async function generateKey() {
  console.log('🔑 Generating API key for testing...\n');
  
  try {
    // Initialize API Key Manager
    const apiKeyManager = new APIKeyManager();
    await apiKeyManager.initialize();
    
    // Create API key for testing
    const result = await apiKeyManager.createAPIKey({
      name: 'Test User',
      email: 'test@example.com',
      tier: 'basic'
    });
    
    console.log('✅ API Key Generated!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔑 API Key: ${result.fullKey}`);
    console.log(`🆔 Key ID: ${result.keyId}`);
    console.log(`🏷️  Tier: ${result.tier}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🚨 SAVE THIS KEY - it will not be shown again!\n');
    
    // Test command
    console.log('💡 Test immediately:');
    console.log(`curl -H "X-API-Key: ${result.fullKey}" https://api.llmrouter.dev/api/health\n`);
    
    return result.fullKey;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateKey().catch(console.error);
}

export { generateKey };