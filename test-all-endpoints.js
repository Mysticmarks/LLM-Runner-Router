#!/usr/bin/env node

/**
 * Test All API Endpoints
 * Comprehensive verification that all endpoints are accessible
 */

import axios from 'axios';

const BASE_URL = 'https://llmrouter.dev';
const API_KEY = process.env.API_KEY || 'test-key-123';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  validateStatus: () => true // Don't throw on any status
});

const tests = [];

async function testEndpoint(method, path, description, data = null, headers = {}) {
  try {
    const config = { headers };
    let response;
    
    if (method === 'GET') {
      response = await client.get(path, config);
    } else if (method === 'POST') {
      response = await client.post(path, data, config);
    }
    
    const result = {
      endpoint: `${method} ${path}`,
      description,
      status: response.status,
      success: response.status < 400,
      data: response.data
    };
    
    tests.push(result);
    
    const icon = result.success ? '✅' : response.status === 401 ? '🔒' : '❌';
    console.log(`${icon} ${method} ${path}: ${response.status} - ${description}`);
    
    return result;
  } catch (error) {
    const result = {
      endpoint: `${method} ${path}`,
      description,
      status: 'error',
      success: false,
      error: error.message
    };
    
    tests.push(result);
    console.log(`❌ ${method} ${path}: ERROR - ${error.message}`);
    return result;
  }
}

async function runTests() {
  console.log('🧪 Testing All API Endpoints\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('='.repeat(60));
  
  // Public endpoints (no auth)
  console.log('\n📂 Public Endpoints (No Auth Required):');
  await testEndpoint('GET', '/', 'Root API info');
  await testEndpoint('GET', '/api/health', 'Health check');
  await testEndpoint('GET', '/api/status', 'System status');
  await testEndpoint('GET', '/api/models/public', 'Public models list');
  await testEndpoint('GET', '/api/models/downloaded', 'Downloaded models');
  
  // Chat endpoints (no auth for basic chat)
  console.log('\n💬 Chat Endpoints:');
  await testEndpoint('POST', '/api/chat', 'Chat without auth', {
    message: 'Hello, test message'
  });
  
  await testEndpoint('POST', '/api/quick', 'Quick inference', {
    message: 'Quick test'
  });
  
  // Protected endpoints (require auth)
  console.log('\n🔐 Protected Endpoints (Auth Required):');
  const authHeaders = { 'X-API-Key': API_KEY };
  
  await testEndpoint('GET', '/api/models', 'List models (auth)', null, authHeaders);
  
  await testEndpoint('POST', '/api/chat', 'Chat with auth', {
    message: 'Authenticated test'
  }, authHeaders);
  
  await testEndpoint('POST', '/api/inference', 'Main inference', {
    prompt: 'Test prompt',
    maxTokens: 10
  }, authHeaders);
  
  await testEndpoint('POST', '/api/route', 'Advanced routing', {
    prompt: 'Test routing',
    strategy: 'balanced'
  }, authHeaders);
  
  // Admin endpoints
  console.log('\n👨‍💼 Admin Endpoints:');
  const adminHeaders = { 
    'X-API-Key': API_KEY,
    'X-Admin-Key': 'admin-key' 
  };
  
  await testEndpoint('GET', '/api/admin/keys', 'List API keys', null, adminHeaders);
  await testEndpoint('GET', '/api/admin/stats', 'System statistics', null, adminHeaders);
  
  // BYOK endpoints
  console.log('\n🔑 BYOK Endpoints:');
  await testEndpoint('GET', '/api/byok/status', 'BYOK status');
  await testEndpoint('GET', '/api/byok/providers', 'BYOK providers list');
  
  // Model management
  console.log('\n📦 Model Management:');
  await testEndpoint('POST', '/api/models/load', 'Load model', {
    model: 'smollm3-3b'
  }, authHeaders);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY:');
  console.log('='.repeat(60));
  
  const successful = tests.filter(t => t.success).length;
  const authRequired = tests.filter(t => t.status === 401).length;
  const failed = tests.filter(t => !t.success && t.status !== 401).length;
  
  console.log(`✅ Successful: ${successful}`);
  console.log(`🔒 Auth Required: ${authRequired}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${tests.length}`);
  
  // List failed endpoints
  if (failed > 0) {
    console.log('\n❌ Failed Endpoints:');
    tests.filter(t => !t.success && t.status !== 401).forEach(t => {
      console.log(`  - ${t.endpoint}: ${t.status} (${t.error || 'Unknown error'})`);
    });
  }
  
  // Overall status
  const successRate = ((successful + authRequired) / tests.length) * 100;
  console.log(`\n🎯 Success Rate: ${successRate.toFixed(1)}%`);
  
  if (successRate === 100) {
    console.log('🎉 All endpoints are working correctly!');
  } else if (successRate >= 90) {
    console.log('✅ Most endpoints are operational');
  } else if (successRate >= 70) {
    console.log('⚠️ Some endpoints need attention');
  } else {
    console.log('❌ Significant issues with API endpoints');
  }
  
  process.exit(failed > 5 ? 1 : 0);
}

// Run tests
runTests().catch(console.error);