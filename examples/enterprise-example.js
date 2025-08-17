/**
 * Enterprise Features Example
 * Demonstrates how to use all enterprise features together
 */

import { Router } from '../src/core/Router.js';
import { Registry } from '../src/core/Registry.js';
import { EnterpriseRouter } from '../src/enterprise/RouterIntegration.js';
import { createEnterpriseExpressRoutes } from '../src/enterprise/APIIntegration.js';
import express from 'express';

// Enterprise configuration
const enterpriseConfig = {
  enableMultiTenancy: true,
  enableABTesting: true,
  enableAuditLogging: true,
  enableSLAMonitoring: true,
  enableAuthentication: true,
  
  // Multi-tenancy settings
  multiTenancy: {
    isolationLevel: 'shared',
    enableBilling: true,
    defaultQuotas: {
      'requests_per_minute': 100,
      'tokens_per_hour': 100000,
      'concurrent_requests': 10,
      'model_count': 5
    }
  },
  
  // A/B testing settings
  abTesting: {
    defaultConfidenceLevel: 0.95,
    defaultMinSampleSize: 100,
    enableFeatureFlags: true
  },
  
  // Audit logging settings
  auditLogging: {
    logDirectory: './audit-logs',
    encryptLogs: true,
    retentionDays: 2555, // 7 years
    complianceFrameworks: ['gdpr', 'hipaa']
  },
  
  // SLA monitoring settings
  slaMonitoring: {
    alertingEnabled: true,
    reportingInterval: 300000, // 5 minutes
    retentionDays: 90
  },
  
  // Authentication settings
  authentication: {
    jwtSecret: 'your-secret-key-here',
    jwtExpiration: '24h',
    mfaRequired: false,
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    }
  }
};

async function enterpriseExample() {
  console.log('🏢 Starting Enterprise LLM Router Example...\n');

  // 1. Initialize base router and registry
  const registry = new Registry();
  const baseRouter = new Router(registry);

  // Add some mock models
  await registry.register({
    id: 'gpt-4',
    name: 'GPT-4',
    type: 'completion',
    format: 'openai',
    parameters: { size: '175B' },
    capabilities: ['text-generation', 'reasoning'],
    metrics: { avgLatency: 800, accuracy: 0.95 }
  });

  await registry.register({
    id: 'claude-3',
    name: 'Claude-3',
    type: 'completion',
    format: 'anthropic',
    parameters: { size: '175B' },
    capabilities: ['text-generation', 'analysis'],
    metrics: { avgLatency: 600, accuracy: 0.93 }
  });

  // 2. Create enterprise router
  const enterpriseRouter = new EnterpriseRouter(baseRouter, enterpriseConfig);
  await enterpriseRouter.start();

  console.log('✅ Enterprise router initialized\n');

  // 3. Setup authentication - Create admin user
  const adminUser = await enterpriseRouter.auth.registerUser({
    username: 'admin',
    email: 'admin@example.com',
    password: 'AdminPass123!',
    roles: ['super_admin']
  });

  console.log('👤 Admin user created:', adminUser.username);

  // Create API user
  const apiUser = await enterpriseRouter.auth.registerUser({
    username: 'api_user',
    email: 'api@example.com',
    password: 'ApiPass123!',
    roles: ['developer']
  });

  // Create API key for the user
  const apiKey = await enterpriseRouter.auth.createAPIKey(apiUser.id, {
    name: 'Demo API Key',
    permissions: ['model:inference', 'api:read', 'api:write']
  });

  console.log('🔑 API key created for API user\n');

  // 4. Setup multi-tenancy - Create tenants
  const tenant1 = await enterpriseRouter.multiTenancy.createTenant({
    name: 'Acme Corp',
    isolationLevel: 'shared',
    quotas: {
      'requests_per_minute': 200,
      'tokens_per_hour': 200000
    }
  });

  const tenant2 = await enterpriseRouter.multiTenancy.createTenant({
    name: 'Beta Solutions',
    isolationLevel: 'strict',
    quotas: {
      'requests_per_minute': 50,
      'tokens_per_hour': 50000
    }
  });

  console.log('🏢 Tenants created:', tenant1.name, 'and', tenant2.name);

  // Assign models to tenants
  await enterpriseRouter.multiTenancy.assignModelToTenant(tenant1.id, 'gpt-4');
  await enterpriseRouter.multiTenancy.assignModelToTenant(tenant1.id, 'claude-3');
  await enterpriseRouter.multiTenancy.assignModelToTenant(tenant2.id, 'claude-3');

  console.log('📦 Models assigned to tenants\n');

  // 5. Setup A/B testing - Create experiment
  const experiment = await enterpriseRouter.abTesting.createExperiment({
    name: 'Model Selection Strategy Test',
    description: 'Testing quality-first vs balanced strategy',
    hypothesis: 'Quality-first strategy will improve user satisfaction',
    trafficPercentage: 50,
    variants: [
      { 
        name: 'control', 
        allocation: 50,
        routingStrategy: 'balanced'
      },
      { 
        name: 'quality_first', 
        allocation: 50,
        routingStrategy: 'quality-first'
      }
    ],
    primaryMetric: 'satisfaction_score',
    secondaryMetrics: ['response_time', 'accuracy']
  });

  await enterpriseRouter.abTesting.startExperiment(experiment.id);
  console.log('🧪 A/B test experiment started:', experiment.name);

  // Create feature flag
  const featureFlag = await enterpriseRouter.abTesting.createFeatureFlag({
    name: 'advanced_routing',
    description: 'Enable advanced routing algorithms',
    enabled: true,
    defaultValue: false,
    rules: [
      {
        field: 'userTier',
        operator: 'equals',
        value: 'premium',
        result: true
      }
    ]
  });

  console.log('🏳️ Feature flag created:', featureFlag.name, '\n');

  // 6. Setup SLA monitoring
  await enterpriseRouter.slaMonitor.defineSLA({
    serviceName: 'llm-inference',
    description: 'LLM inference performance SLA',
    targets: {
      'response_time': {
        threshold: 2000, // 2 seconds
        operator: 'less_than',
        timeWindow: '1m'
      },
      'error_rate': {
        threshold: 0.05, // 5%
        operator: 'less_than',
        timeWindow: '5m'
      }
    },
    businessImpact: 'high'
  });

  console.log('📊 SLA monitoring configured\n');

  // 7. Demonstrate enterprise inference
  console.log('🚀 Running enterprise inference examples...\n');

  // Example 1: Tenant-specific inference
  try {
    console.log('Example 1: Tenant-specific inference for Acme Corp');
    const result1 = await enterpriseRouter.processInference(
      'What are the benefits of AI in business?',
      { 
        preferredModel: 'gpt-4',
        temperature: 0.7 
      },
      { 
        tenantId: tenant1.id,
        userId: 'user-123'
      }
    );
    console.log('✅ Response:', result1.response.substring(0, 100) + '...');
    console.log('📈 Tokens:', result1.tokenCount, 'Duration:', result1.duration + 'ms\n');
  } catch (error) {
    console.error('❌ Error:', error.message, '\n');
  }

  // Example 2: API key authenticated inference
  try {
    console.log('Example 2: API key authenticated inference');
    const authResult = await enterpriseRouter.auth.validateAPIKey(apiKey.key);
    
    const result2 = await enterpriseRouter.processInference(
      'Explain machine learning concepts',
      { preferredModel: 'claude-3' },
      { 
        userId: authResult.user.id,
        permissions: authResult.permissions
      }
    );
    console.log('✅ Response:', result2.response.substring(0, 100) + '...');
    console.log('📈 Tokens:', result2.tokenCount, 'Duration:', result2.duration + 'ms\n');
  } catch (error) {
    console.error('❌ Error:', error.message, '\n');
  }

  // Example 3: A/B testing with user assignment
  try {
    console.log('Example 3: A/B testing with user assignment');
    const assignments = await enterpriseRouter.abTesting.assignUser('user-456', {
      userTier: 'premium'
    });
    
    console.log('🧪 User assigned to experiments:', Array.from(assignments.keys()));
    
    const result3 = await enterpriseRouter.processInference(
      'Compare different AI models',
      {},
      { 
        userId: 'user-456',
        tenantId: tenant2.id,
        experiments: assignments
      }
    );
    console.log('✅ Response:', result3.response.substring(0, 100) + '...');
    
    // Track experiment event
    await enterpriseRouter.abTesting.trackEvent('user-456', 'satisfaction_score', {
      score: 4.5
    });
    console.log('📊 Satisfaction score tracked for experiment\n');
  } catch (error) {
    console.error('❌ Error:', error.message, '\n');
  }

  // 8. Demonstrate monitoring and reporting
  console.log('📊 Enterprise monitoring and reporting...\n');

  // Get system usage
  const systemUsage = enterpriseRouter.multiTenancy.getSystemUsage();
  console.log('🏢 System Usage:', {
    totalTenants: systemUsage.totalTenants,
    activeTenants: systemUsage.activeTenants,
    totalRequests: systemUsage.totalUsage.requests || 0
  });

  // Get SLA status
  const slaStatus = await enterpriseRouter.slaMonitor.getSLAStatus('llm-inference');
  console.log('📊 SLA Status:', slaStatus.status);

  // Get audit statistics
  const auditStats = enterpriseRouter.auditLogger.getStatistics();
  console.log('📝 Audit Events:', auditStats.total);

  // Get experiment statistics
  const experimentStats = enterpriseRouter.abTesting.getExperimentStats(experiment.id);
  console.log('🧪 Experiment Participants:', experimentStats.participants);

  // Get enterprise dashboard data
  const dashboard = await enterpriseRouter.enterpriseManager.getDashboardData();
  console.log('\n📊 Enterprise Dashboard Summary:');
  console.log('- Multi-tenancy:', dashboard.multiTenancy?.totalTenants, 'tenants');
  console.log('- A/B Testing:', dashboard.abTesting?.totalExperiments, 'experiments');
  console.log('- Audit Events:', dashboard.auditLogging?.total, 'events');
  console.log('- SLA Definitions:', dashboard.slaMonitoring?.totalSLAs, 'SLAs');
  console.log('- Users:', dashboard.authentication?.totalUsers, 'users');

  // 9. Setup Express API (optional)
  if (process.argv.includes('--api')) {
    console.log('\n🌐 Starting Enterprise API server...');
    
    const app = express();
    app.use(express.json());
    
    // Setup enterprise API routes
    createEnterpriseExpressRoutes(app, enterpriseRouter.enterpriseManager);
    
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`🚀 Enterprise API server running on port ${port}`);
      console.log(`📖 API Documentation: http://localhost:${port}/api/enterprise/health`);
    });
  }

  console.log('\n✅ Enterprise example completed successfully!');
  console.log('\nTo run with API server: node examples/enterprise-example.js --api');

  // Cleanup
  if (!process.argv.includes('--api')) {
    await enterpriseRouter.stop();
    process.exit(0);
  }
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the example
enterpriseExample().catch(console.error);