/**
 * Artillery.js processor for LLM Router load testing
 * Provides custom functions for dynamic test data generation and response validation
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Pre-defined test prompts for different categories
const TEST_PROMPTS = {
  short: [
    "Hello, how are you?",
    "What is AI?",
    "Explain quantum computing.",
    "Write a haiku about code.",
    "What's the weather like?",
    "Tell me a joke.",
    "Define machine learning.",
    "How does blockchain work?"
  ],
  medium: [
    "Write a product description for wireless headphones with noise cancellation.",
    "Explain the benefits of renewable energy sources in 150 words.",
    "Create a marketing email for a new productivity app launch.",
    "Summarize the key principles of effective project management.",
    "Describe the process of photosynthesis in simple terms.",
    "Write a brief history of the internet and its impact on society."
  ],
  long: [
    "Write a comprehensive guide on setting up a home office for maximum productivity, including ergonomics, technology setup, and organizational tips.",
    "Create a detailed business plan outline for a sustainable fashion startup, including market analysis, competitive landscape, and revenue projections.",
    "Explain the evolution of artificial intelligence from its early beginnings to current state-of-the-art models, including key milestones and future prospects.",
    "Develop a complete social media strategy for a B2B software company looking to increase brand awareness and generate leads through digital channels."
  ],
  technical: [
    "Implement a binary search algorithm in Python with proper error handling.",
    "Explain the differences between SQL and NoSQL databases with examples.",
    "Design a RESTful API for a todo list application with proper endpoints.",
    "Write a Dockerfile for a Node.js application with multi-stage builds.",
    "Implement a rate limiting algorithm using the token bucket method.",
    "Explain microservices architecture patterns and their trade-offs."
  ],
  creative: [
    "Write a short story about a robot learning to paint.",
    "Create a poem about the changing seasons in a futuristic city.",
    "Develop character descriptions for a fantasy adventure game.",
    "Write dialogue for a conversation between two AI assistants.",
    "Create a recipe for a magical potion using modern ingredients.",
    "Design a fictional planet with unique geography and ecosystems."
  ]
};

// User types for tenant simulation
const USER_TYPES = ['free', 'professional', 'enterprise'];
const TENANT_IDS = ['tenant-free', 'tenant-pro', 'tenant-enterprise'];

// Models to test with different weights
const MODELS = [
  { id: 'gpt-3.5-turbo', weight: 60 },
  { id: 'gpt-4', weight: 25 },
  { id: 'claude-3-haiku', weight: 10 },
  { id: 'claude-3-opus', weight: 5 }
];

// Temperature settings for testing
const TEMPERATURES = [0.3, 0.5, 0.7, 0.9, 1.0];

// Request tracking for analytics
let requestStats = {
  total: 0,
  successful: 0,
  failed: 0,
  categories: {},
  models: {},
  responseTimeSum: 0
};

/**
 * Set a random prompt for the request
 * @param {Object} requestParams - Artillery request parameters
 * @param {Object} context - Artillery context object
 * @param {Object} ee - Artillery event emitter
 * @param {Function} next - Continuation function
 */
function setRandomPrompt(requestParams, context, ee, next) {
  try {
    // Choose a random category
    const categories = Object.keys(TEST_PROMPTS);
    const category = categories[Math.floor(Math.random() * categories.length)];
    
    // Choose a random prompt from the category
    const prompts = TEST_PROMPTS[category];
    const prompt = prompts[Math.floor(Math.random() * prompts.length)];
    
    // Set prompt in context
    context.vars.prompt = prompt;
    context.vars.category = category;
    context.vars.expectedTokens = getExpectedTokens(category);
    
    // Track category usage
    if (!requestStats.categories[category]) {
      requestStats.categories[category] = 0;
    }
    requestStats.categories[category]++;
    
    return next();
  } catch (error) {
    console.error('Error setting random prompt:', error);
    return next(error);
  }
}

/**
 * Set random model for testing model distribution
 * @param {Object} requestParams - Artillery request parameters
 * @param {Object} context - Artillery context object
 * @param {Object} ee - Artillery event emitter
 * @param {Function} next - Continuation function
 */
function setRandomModel(requestParams, context, ee, next) {
  try {
    const model = getWeightedRandomModel();
    context.vars.model = model.id;
    
    // Track model usage
    if (!requestStats.models[model.id]) {
      requestStats.models[model.id] = 0;
    }
    requestStats.models[model.id]++;
    
    return next();
  } catch (error) {
    console.error('Error setting random model:', error);
    return next(error);
  }
}

/**
 * Set random temperature for testing parameter variation
 * @param {Object} requestParams - Artillery request parameters
 * @param {Object} context - Artillery context object
 * @param {Object} ee - Artillery event emitter
 * @param {Function} next - Continuation function
 */
function setRandomTemperature(requestParams, context, ee, next) {
  try {
    const temperature = TEMPERATURES[Math.floor(Math.random() * TEMPERATURES.length)];
    context.vars.temperature = temperature;
    return next();
  } catch (error) {
    console.error('Error setting random temperature:', error);
    return next(error);
  }
}

/**
 * Set tenant context for multi-tenancy testing
 * @param {Object} requestParams - Artillery request parameters
 * @param {Object} context - Artillery context object
 * @param {Object} ee - Artillery event emitter
 * @param {Function} next - Continuation function
 */
function setTenantContext(requestParams, context, ee, next) {
  try {
    const userType = USER_TYPES[Math.floor(Math.random() * USER_TYPES.length)];
    const tenantId = TENANT_IDS[USER_TYPES.indexOf(userType)];
    
    context.vars.userType = userType;
    context.vars.tenantId = tenantId;
    
    // Set appropriate API key based on tenant
    const apiKeys = {
      'tenant-free': 'llmr_free_tier_key',
      'tenant-pro': 'llmr_professional_key',
      'tenant-enterprise': 'llmr_enterprise_key'
    };
    
    if (!requestParams.headers) {
      requestParams.headers = {};
    }
    requestParams.headers['X-Tenant-ID'] = tenantId;
    requestParams.headers['X-API-Key'] = apiKeys[tenantId] || 'llmr_load_test_key';
    
    return next();
  } catch (error) {
    console.error('Error setting tenant context:', error);
    return next(error);
  }
}

/**
 * Validate response and track metrics
 * @param {Object} requestParams - Artillery request parameters
 * @param {Object} response - HTTP response object
 * @param {Object} context - Artillery context object
 * @param {Object} ee - Artillery event emitter
 * @param {Function} next - Continuation function
 */
function validateResponse(requestParams, response, context, ee, next) {
  try {
    requestStats.total++;
    
    const startTime = context.vars.startTime || Date.now();
    const responseTime = Date.now() - startTime;
    requestStats.responseTimeSum += responseTime;
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      requestStats.successful++;
      
      // Parse response body for additional validation
      try {
        const body = JSON.parse(response.body);
        
        // Validate chat completion response
        if (body.choices && body.choices.length > 0) {
          const content = body.choices[0].message?.content || body.choices[0].text;
          if (content && content.length > 0) {
            context.vars.responseLength = content.length;
            context.vars.responseValid = true;
          }
        }
        
        // Validate usage metrics
        if (body.usage) {
          context.vars.tokensUsed = body.usage.total_tokens;
          context.vars.promptTokens = body.usage.prompt_tokens;
          context.vars.completionTokens = body.usage.completion_tokens;
        }
        
        // Track model performance
        if (body.metadata) {
          context.vars.modelUsed = body.metadata.model_used;
          context.vars.duration = body.metadata.duration_ms;
          context.vars.cost = body.metadata.cost_cents;
        }
        
      } catch (parseError) {
        console.warn('Failed to parse response body:', parseError.message);
      }
      
    } else {
      requestStats.failed++;
      console.warn(`Request failed with status ${response.statusCode}: ${response.body}`);
    }
    
    return next();
  } catch (error) {
    console.error('Error validating response:', error);
    return next(error);
  }
}

/**
 * Generate load test report
 * @param {Object} requestParams - Artillery request parameters
 * @param {Object} context - Artillery context object
 * @param {Object} ee - Artillery event emitter
 * @param {Function} next - Continuation function
 */
function generateReport(requestParams, context, ee, next) {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalRequests: requestStats.total,
        successfulRequests: requestStats.successful,
        failedRequests: requestStats.failed,
        successRate: requestStats.total > 0 ? requestStats.successful / requestStats.total : 0,
        avgResponseTime: requestStats.total > 0 ? requestStats.responseTimeSum / requestStats.total : 0
      },
      categoryDistribution: requestStats.categories,
      modelDistribution: requestStats.models
    };
    
    // Save report to file
    const reportPath = path.join(__dirname, 'reports', `load-test-${Date.now()}.json`);
    
    // Ensure reports directory exists
    const reportsDir = path.dirname(reportPath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Load test report saved to: ${reportPath}`);
    
    return next();
  } catch (error) {
    console.error('Error generating report:', error);
    return next(error);
  }
}

/**
 * Custom think time based on user type
 * @param {Object} context - Artillery context object
 * @returns {number} Think time in seconds
 */
function customThinkTime(context) {
  const userType = context.vars.userType || 'free';
  
  const thinkTimes = {
    free: 2 + Math.random() * 3,      // 2-5 seconds
    professional: 1 + Math.random() * 2, // 1-3 seconds
    enterprise: 0.5 + Math.random() * 1   // 0.5-1.5 seconds
  };
  
  return thinkTimes[userType] || 2;
}

/**
 * Get expected tokens based on prompt category
 * @param {string} category - Prompt category
 * @returns {number} Expected token count
 */
function getExpectedTokens(category) {
  const tokenRanges = {
    short: { min: 10, max: 50 },
    medium: { min: 100, max: 200 },
    long: { min: 300, max: 500 },
    technical: { min: 150, max: 300 },
    creative: { min: 200, max: 400 }
  };
  
  const range = tokenRanges[category] || tokenRanges.medium;
  return range.min + Math.random() * (range.max - range.min);
}

/**
 * Get weighted random model
 * @returns {Object} Selected model object
 */
function getWeightedRandomModel() {
  const totalWeight = MODELS.reduce((sum, model) => sum + model.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const model of MODELS) {
    random -= model.weight;
    if (random <= 0) {
      return model;
    }
  }
  
  return MODELS[0]; // Fallback
}

/**
 * Create test user session with realistic behavior
 * @param {Object} context - Artillery context object
 */
function createUserSession(context) {
  const sessionId = crypto.randomUUID();
  const userType = USER_TYPES[Math.floor(Math.random() * USER_TYPES.length)];
  
  context.vars.sessionId = sessionId;
  context.vars.userType = userType;
  context.vars.sessionStartTime = Date.now();
  
  // Set session-specific behavior patterns
  const behaviorPatterns = {
    free: {
      requestsPerSession: 3 + Math.random() * 5,
      avgThinkTime: 3,
      preferredModels: ['gpt-3.5-turbo'],
      maxTokens: 100
    },
    professional: {
      requestsPerSession: 8 + Math.random() * 12,
      avgThinkTime: 2,
      preferredModels: ['gpt-3.5-turbo', 'gpt-4'],
      maxTokens: 200
    },
    enterprise: {
      requestsPerSession: 15 + Math.random() * 25,
      avgThinkTime: 1,
      preferredModels: ['gpt-4', 'claude-3-opus'],
      maxTokens: 500
    }
  };
  
  context.vars.behaviorPattern = behaviorPatterns[userType];
}

// Export all functions for Artillery
module.exports = {
  setRandomPrompt,
  setRandomModel,
  setRandomTemperature,
  setTenantContext,
  validateResponse,
  generateReport,
  customThinkTime,
  createUserSession
};