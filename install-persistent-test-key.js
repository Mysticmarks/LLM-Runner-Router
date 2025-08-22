#!/usr/bin/env node
/**
 * 🔑 Install Persistent Test API Key
 * Creates a fixed API key that never changes and survives restarts/updates
 */

import { PersistentTestKey } from './src/auth/PersistentTestKey.js';

async function main() {
  try {
    console.log('🔑 Installing Persistent Test API Key for LLM Router');
    console.log('=' .repeat(60));
    
    const persistentKey = new PersistentTestKey();
    const fullKey = await persistentKey.getPersistentTestKey();
    
    console.log('\n✅ SUCCESS! Persistent test key is ready');
    console.log('=' .repeat(60));
    console.log('\n📋 KEY DETAILS:');
    console.log(`  🔑 Full API Key: ${fullKey}`);
    console.log(`  📝 Key ID: ${persistentKey.FIXED_TEST_KEY_ID}`);
    console.log(`  🎯 Tier: pro`);
    console.log(`  ♻️  Persistent: YES (survives restarts and updates)`);
    
    console.log('\n📖 USAGE INSTRUCTIONS:');
    console.log('  1. Use this key in your test scripts:');
    console.log(`     export ROUTER_API_KEY="${fullKey}"`);
    console.log('\n  2. Or in curl commands:');
    console.log(`     curl -H "Authorization: Bearer ${fullKey}" http://178.156.181.117:3000/api/models`);
    console.log('\n  3. This key will automatically be restored if missing from api-keys.json');
    console.log('\n  4. The key never changes - safe to hardcode in test scripts');
    
    console.log('\n💡 NEXT STEPS:');
    console.log('  1. Export the API key:');
    console.log(`     export ROUTER_API_KEY="${fullKey}"`);
    console.log('\n  2. Run your functional tests:');
    console.log('     ./functional-llm-router-tests.sh');
    
  } catch (error) {
    console.error('\n❌ FAILED to install persistent test key:');
    console.error(error.message);
    process.exit(1);
  }
}

main();