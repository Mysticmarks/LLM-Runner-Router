/**
 * K6 Load Test Script for LLM Router
 * 
 * This script provides comprehensive load testing scenarios for the LLM Router API,
 * including chat completions, model management, and enterprise features.
 * 
 * Usage:
 *   k6 run tests/load/k6-test.js
 *   k6 run --vus 10 --duration 5m tests/load/k6-test.js
 *   k6 run --stage 1m:10,5m:50,1m:0 tests/load/k6-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomItem, randomIntBetween, randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const chatCompletionDuration = new Trend('chat_completion_duration');
const chatCompletionSuccess = new Rate('chat_completion_success_rate');
const tokensPerSecond = new Trend('tokens_per_second');
const costPerRequest = new Trend('cost_per_request_cents');
const modelLoadTime = new Trend('model_load_time');
const errorRate = new Rate('error_rate');
const concurrentUsers = new Gauge('concurrent_users');

// Test configuration
export const options = {
  stages: [
    // Warm-up
    { duration: '2m', target: 5 },
    // Ramp-up  
    { duration: '3m', target: 20 },
    // Sustained load
    { duration: '10m', target: 20 },
    // Peak load
    { duration: '3m', target: 50 },
    // Cool-down
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% of requests under 5s
    http_req_failed: ['rate<0.1'],     // Error rate under 10%
    chat_completion_success_rate: ['rate>0.95'], // 95% success rate
    tokens_per_second: ['avg>10'],     // Average 10+ tokens/second
  },
  ext: {
    loadimpact: {
      distribution: {
        'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 50 },
        'amazon:eu:dublin': { loadZone: 'amazon:eu:dublin', percent: 30 },
        'amazon:ap:singapore': { loadZone: 'amazon:ap:singapore', percent: 20 },
      },
    },
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'llmr_load_test_key';
const ADMIN_API_KEY = __ENV.ADMIN_API_KEY || 'llmr_admin_key';

const MODELS = [
  { id: 'gpt-3.5-turbo', weight: 60 },
  { id: 'gpt-4', weight: 25 },
  { id: 'claude-3-haiku', weight: 10 },
  { id: 'claude-3-opus', weight: 5 }
];

const PROMPTS = {
  short: [
    "Hello, how are you?",
    "What is AI?",
    "Tell me a joke.",
    "Define machine learning.",
    "What's 2+2?",
    "How's the weather?",
    "Explain quantum physics.",
    "What is love?"
  ],
  medium: [
    "Write a product description for wireless noise-canceling headphones with 30-hour battery life.",
    "Explain the benefits of renewable energy sources and their impact on climate change.",
    "Create a marketing email for a new productivity app that helps teams collaborate better.",
    "Summarize the key principles of effective project management in modern organizations.",
    "Describe the process of photosynthesis and its importance to life on Earth.",
    "Write a brief history of the internet and its transformative impact on society."
  ],
  long: [
    "Write a comprehensive guide on setting up a productive home office environment, including ergonomic considerations, technology setup, lighting, and organizational strategies for maximum efficiency.",
    "Create a detailed business plan outline for a sustainable fashion startup, including market analysis, target audience research, competitive landscape assessment, and revenue projection models.",
    "Explain the evolution of artificial intelligence from its early theoretical foundations to current state-of-the-art language models, including key milestones, breakthrough technologies, and future prospects.",
    "Develop a complete digital marketing strategy for a B2B software company looking to increase brand awareness, generate qualified leads, and establish thought leadership in their industry."
  ]
};

const TENANT_CONFIGS = {
  free: {
    apiKey: 'llmr_free_tier_key',
    tenantId: 'tenant-free',
    maxTokens: 100,
    allowedModels: ['gpt-3.5-turbo']
  },
  professional: {
    apiKey: 'llmr_professional_key', 
    tenantId: 'tenant-pro',
    maxTokens: 200,
    allowedModels: ['gpt-3.5-turbo', 'gpt-4']
  },
  enterprise: {
    apiKey: 'llmr_enterprise_key',
    tenantId: 'tenant-enterprise', 
    maxTokens: 500,
    allowedModels: ['gpt-4', 'claude-3-opus']
  }
};

// Helper functions
function getHeaders(apiKey = API_KEY, tenantId = null) {
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
  };
  
  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }
  
  return headers;
}

function getWeightedRandomModel() {
  const totalWeight = MODELS.reduce((sum, model) => sum + model.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const model of MODELS) {
    random -= model.weight;
    if (random <= 0) {
      return model.id;
    }
  }
  
  return MODELS[0].id;
}

function getRandomPrompt(category = 'medium') {
  const prompts = PROMPTS[category] || PROMPTS.medium;
  return randomItem(prompts);
}

function getTenantConfig() {
  const tiers = Object.keys(TENANT_CONFIGS);
  const tier = randomItem(tiers);
  return TENANT_CONFIGS[tier];
}

// Main test function
export default function () {
  concurrentUsers.add(1);
  
  const tenantConfig = getTenantConfig();
  const headers = getHeaders(tenantConfig.apiKey, tenantConfig.tenantId);
  
  // Distribute load across different scenarios
  const scenario = Math.random();
  
  if (scenario < 0.5) {
    // 50% - Chat completions
    testChatCompletions(headers, tenantConfig);
  } else if (scenario < 0.7) {
    // 20% - Text completions  
    testTextCompletions(headers, tenantConfig);
  } else if (scenario < 0.85) {
    // 15% - Model management
    testModelManagement(headers);
  } else if (scenario < 0.95) {
    // 10% - Monitoring endpoints
    testMonitoring(headers);
  } else {
    // 5% - Enterprise features
    testEnterpriseFeatures();
  }
  
  // Realistic user think time
  sleep(randomIntBetween(1, 3));
}

function testChatCompletions(headers, tenantConfig) {
  group('Chat Completions', () => {
    const promptCategory = randomItem(['short', 'medium', 'long']);
    const prompt = getRandomPrompt(promptCategory);
    const model = randomItem(tenantConfig.allowedModels);
    
    const payload = {
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      model: model,
      max_tokens: Math.min(tenantConfig.maxTokens, randomIntBetween(50, 200)),
      temperature: Math.random() * 0.8 + 0.2, // 0.2 to 1.0
      stream: Math.random() < 0.3 // 30% streaming requests
    };
    
    const startTime = Date.now();
    const response = http.post(`${BASE_URL}/api/v1/chat/completions`, JSON.stringify(payload), {
      headers: headers,
      timeout: '30s'
    });
    
    const duration = Date.now() - startTime;
    chatCompletionDuration.add(duration);
    
    const success = check(response, {
      'status is 200': (r) => r.status === 200,
      'has choices': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.choices && body.choices.length > 0;
        } catch (e) {
          return false;
        }
      },
      'has usage info': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.usage && body.usage.total_tokens > 0;
        } catch (e) {
          return false;
        }
      }
    });
    
    chatCompletionSuccess.add(success);
    
    if (success && response.status === 200) {
      try {
        const body = JSON.parse(response.body);
        
        if (body.usage) {
          const tokensPerSec = body.usage.total_tokens / (duration / 1000);
          tokensPerSecond.add(tokensPerSec);
        }
        
        if (body.metadata && body.metadata.cost_cents) {
          costPerRequest.add(body.metadata.cost_cents);
        }
      } catch (e) {
        console.error('Failed to parse response body:', e);
      }
    } else {
      errorRate.add(1);
      console.log(`Chat completion failed: ${response.status} - ${response.body}`);
    }
  });
}

function testTextCompletions(headers, tenantConfig) {
  group('Text Completions', () => {
    const prompt = getRandomPrompt('short');
    const model = randomItem(tenantConfig.allowedModels);
    
    const payload = {
      prompt: prompt,
      model: model,
      max_tokens: Math.min(tenantConfig.maxTokens, randomIntBetween(25, 100)),
      temperature: Math.random() * 0.8 + 0.2,
      top_p: 0.95,
      frequency_penalty: 0,
      presence_penalty: 0
    };
    
    const response = http.post(`${BASE_URL}/api/v1/completions`, JSON.stringify(payload), {
      headers: headers,
      timeout: '20s'
    });
    
    const success = check(response, {
      'status is 200': (r) => r.status === 200,
      'has choices': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.choices && body.choices.length > 0;
        } catch (e) {
          return false;
        }
      }
    });
    
    if (!success) {
      errorRate.add(1);
    }
  });
}

function testModelManagement(headers) {
  group('Model Management', () => {
    // List models
    const listResponse = http.get(`${BASE_URL}/api/v1/models`, { headers });
    
    check(listResponse, {
      'list models status is 200': (r) => r.status === 200,
      'has model data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && Array.isArray(body.data);
        } catch (e) {
          return false;
        }
      }
    });
    
    // Get specific model details
    const modelId = getWeightedRandomModel();
    const detailResponse = http.get(`${BASE_URL}/api/v1/models/${modelId}`, { headers });
    
    check(detailResponse, {
      'model detail status is 200 or 404': (r) => r.status === 200 || r.status === 404,
      'has model info when found': (r) => {
        if (r.status === 200) {
          try {
            const body = JSON.parse(r.body);
            return body.id === modelId;
          } catch (e) {
            return false;
          }
        }
        return true; // 404 is acceptable
      }
    });
  });
}

function testMonitoring(headers) {
  group('Monitoring', () => {
    // Health check
    const healthResponse = http.get(`${BASE_URL}/api/v1/health`);
    
    check(healthResponse, {
      'health status is 200': (r) => r.status === 200,
      'health has status': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.status !== undefined;
        } catch (e) {
          return false;
        }
      }
    });
    
    // Stats endpoint
    const statsResponse = http.get(`${BASE_URL}/api/v1/stats`, { headers });
    
    check(statsResponse, {
      'stats status is 200': (r) => r.status === 200,
      'stats has system info': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.system !== undefined;
        } catch (e) {
          return false;
        }
      }
    });
    
    // Metrics endpoint (may require auth)
    const metricsResponse = http.get(`${BASE_URL}/api/v1/metrics`, { headers });
    
    check(metricsResponse, {
      'metrics accessible': (r) => r.status === 200 || r.status === 403
    });
  });
}

function testEnterpriseFeatures() {
  group('Enterprise Features', () => {
    const adminHeaders = getHeaders(ADMIN_API_KEY);
    
    // List tenants (admin only)
    const tenantsResponse = http.get(`${BASE_URL}/api/v1/tenants`, { headers: adminHeaders });
    
    check(tenantsResponse, {
      'tenants endpoint accessible': (r) => r.status === 200 || r.status === 403
    });
    
    // List experiments
    const experimentsResponse = http.get(`${BASE_URL}/api/v1/experiments`, { headers: adminHeaders });
    
    check(experimentsResponse, {
      'experiments endpoint accessible': (r) => r.status === 200 || r.status === 403
    });
    
    // Get tenant usage (if authorized)
    if (tenantsResponse.status === 200) {
      try {
        const body = JSON.parse(tenantsResponse.body);
        if (body.tenants && body.tenants.length > 0) {
          const tenantId = body.tenants[0].id;
          const usageResponse = http.get(
            `${BASE_URL}/api/v1/tenants/${tenantId}/usage`,
            { headers: adminHeaders }
          );
          
          check(usageResponse, {
            'tenant usage accessible': (r) => r.status === 200 || r.status === 403
          });
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
  });
}

// Stress test scenario
export function stress() {
  const headers = getHeaders();
  
  group('Stress Test', () => {
    // Rapid fire requests
    for (let i = 0; i < 5; i++) {
      const payload = {
        messages: [{ role: 'user', content: 'Quick test message' }],
        model: 'gpt-3.5-turbo',
        max_tokens: 10
      };
      
      const response = http.post(`${BASE_URL}/api/v1/chat/completions`, JSON.stringify(payload), {
        headers: headers,
        timeout: '10s'
      });
      
      check(response, {
        'rapid request succeeds': (r) => r.status === 200 || r.status === 429 // Allow rate limiting
      });
    }
  });
}

// Spike test scenario  
export function spike() {
  const headers = getHeaders();
  
  group('Spike Test', () => {
    // Large request
    const longPrompt = PROMPTS.long[0];
    const payload = {
      messages: [{ role: 'user', content: longPrompt }],
      model: 'gpt-4',
      max_tokens: 500,
      temperature: 0.8
    };
    
    const startTime = Date.now();
    const response = http.post(`${BASE_URL}/api/v1/chat/completions`, JSON.stringify(payload), {
      headers: headers,
      timeout: '60s'
    });
    
    const duration = Date.now() - startTime;
    
    check(response, {
      'large request succeeds': (r) => r.status === 200,
      'large request under 30s': () => duration < 30000
    });
    
    if (response.status === 200) {
      try {
        const body = JSON.parse(response.body);
        if (body.usage) {
          console.log(`Large request: ${body.usage.total_tokens} tokens in ${duration}ms`);
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
  });
}

// Setup and teardown
export function setup() {
  console.log('Starting load test setup...');
  
  // Verify API is accessible
  const healthResponse = http.get(`${BASE_URL}/api/v1/health`);
  if (healthResponse.status !== 200) {
    throw new Error(`API health check failed: ${healthResponse.status}`);
  }
  
  console.log('API is healthy, starting load test...');
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration} seconds`);
  
  // Generate summary report
  console.log('=== Load Test Summary ===');
  console.log(`Test duration: ${duration} seconds`);
  console.log('Check thresholds for detailed metrics');
}