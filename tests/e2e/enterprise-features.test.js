/**
 * Enterprise Features End-to-End Tests
 * Tests multi-tenancy, A/B testing, SLA monitoring, and enterprise authentication
 */

import { jest } from '@jest/globals';
import { LLMRouter } from '../../src/index.js';
import { EnterpriseManager } from '../../src/enterprise/EnterpriseManager.js';
import { ABTesting } from '../../src/enterprise/ABTesting.js';
import { SLAMonitor } from '../../src/enterprise/SLAMonitor.js';
import { DatabaseManager } from '../../src/db/DatabaseManager.js';

describe('Enterprise Features End-to-End Tests', () => {
  let router;
  let enterpriseManager;
  let abTesting;
  let slaMonitor;
  let database;

  beforeAll(async () => {
    // Initialize database in memory mode
    database = new DatabaseManager({
      type: 'memory',
      fallbackToMemory: true
    });
    await database.initialize();

    // Initialize enterprise components
    enterpriseManager = new EnterpriseManager({
      database,
      enableMultiTenancy: true,
      enableABTesting: true,
      enableSLAMonitoring: true
    });

    abTesting = new ABTesting({ database });
    slaMonitor = new SLAMonitor({ database });

    // Initialize router with enterprise features
    router = new LLMRouter({
      database,
      enterprise: enterpriseManager,
      enableEnterprise: true
    });

    await router.initialize();
  });

  afterAll(async () => {
    if (slaMonitor) {
      await slaMonitor.cleanup();
    }
    if (router) {
      await router.cleanup();
    }
    if (database) {
      await database.close();
    }
  });

  describe('Multi-Tenancy', () => {
    let tenant1, tenant2;

    beforeEach(async () => {
      // Create test tenants
      tenant1 = await database.query('tenants', 'insert', {
        name: 'Tenant One',
        subdomain: 'tenant1',
        settings: JSON.stringify({
          maxModels: 5,
          enableCache: true
        }),
        plan: 'premium'
      });

      tenant2 = await database.query('tenants', 'insert', {
        name: 'Tenant Two',
        subdomain: 'tenant2',
        settings: JSON.stringify({
          maxModels: 2,
          enableCache: false
        }),
        plan: 'basic'
      });
    });

    test('should isolate tenant data', async () => {
      // Create users for different tenants
      const user1 = await database.query('users', 'insert', {
        username: 'user1',
        email: 'user1@tenant1.com',
        tenantId: tenant1.id
      });

      const user2 = await database.query('users', 'insert', {
        username: 'user2',
        email: 'user2@tenant2.com',
        tenantId: tenant2.id
      });

      // Verify tenant isolation
      const tenant1Users = await database.query('users', 'find', {}, {
        filters: { tenantId: tenant1.id }
      });

      const tenant2Users = await database.query('users', 'find', {}, {
        filters: { tenantId: tenant2.id }
      });

      expect(tenant1Users.data).toHaveLength(1);
      expect(tenant1Users.data[0].email).toBe('user1@tenant1.com');
      
      expect(tenant2Users.data).toHaveLength(1);
      expect(tenant2Users.data[0].email).toBe('user2@tenant2.com');
    });

    test('should enforce tenant-specific quotas', async () => {
      // Set up quotas for tenant1
      await database.query('usage_quotas', 'insert', {
        tenantId: tenant1.id,
        quotaType: 'requests',
        quotaLimit: 100,
        quotaUsed: 95, // Near limit
        resetPeriod: 'monthly'
      });

      // Check quota enforcement
      const canMakeRequest = await enterpriseManager.checkQuota(tenant1.id, 'requests');
      expect(canMakeRequest).toBe(true); // Still under limit

      // Simulate quota exceeded
      await database.query('usage_quotas', 'update',
        { quotaUsed: 105 },
        { filters: { tenantId: tenant1.id, quotaType: 'requests' } }
      );

      const canMakeRequestAfter = await enterpriseManager.checkQuota(tenant1.id, 'requests');
      expect(canMakeRequestAfter).toBe(false); // Over limit
    });

    test('should handle tenant-specific configurations', async () => {
      const tenant1Config = await enterpriseManager.getTenantConfig(tenant1.id);
      const tenant2Config = await enterpriseManager.getTenantConfig(tenant2.id);

      expect(tenant1Config.maxModels).toBe(5);
      expect(tenant1Config.enableCache).toBe(true);
      expect(tenant1Config.plan).toBe('premium');

      expect(tenant2Config.maxModels).toBe(2);
      expect(tenant2Config.enableCache).toBe(false);
      expect(tenant2Config.plan).toBe('basic');
    });
  });

  describe('A/B Testing', () => {
    test('should create and manage A/B experiments', async () => {
      const experiment = await abTesting.createExperiment({
        name: 'Model Performance Test',
        description: 'Compare GPT-4 vs Claude performance',
        controlModel: 'gpt-4',
        variantModels: ['claude-3'],
        trafficSplit: {
          'gpt-4': 50,
          'claude-3': 50
        },
        successMetric: 'latency'
      });

      expect(experiment).toHaveProperty('id');
      expect(experiment.name).toBe('Model Performance Test');
      expect(experiment.active).toBe(true);
    });

    test('should route traffic according to experiment configuration', async () => {
      // Create experiment with 70/30 split
      const experiment = await abTesting.createExperiment({
        name: 'Traffic Split Test',
        controlModel: 'model-a',
        variantModels: ['model-b'],
        trafficSplit: {
          'model-a': 70,
          'model-b': 30
        }
      });

      const userId = 'test-user-123';
      const modelSelections = {};

      // Simulate 100 requests
      for (let i = 0; i < 100; i++) {
        const selectedModel = await abTesting.getModelForUser(
          experiment.id,
          `${userId}-${i}`,
          'test prompt'
        );
        
        modelSelections[selectedModel] = (modelSelections[selectedModel] || 0) + 1;
      }

      // Should roughly match the traffic split (allowing for variance)
      const totalRequests = Object.values(modelSelections).reduce((a, b) => a + b, 0);
      const modelAPercent = (modelSelections['model-a'] / totalRequests) * 100;
      
      expect(modelAPercent).toBeGreaterThan(60); // Should be around 70%, allow variance
      expect(modelAPercent).toBeLessThan(80);
    });

    test('should collect experiment results', async () => {
      const experiment = await abTesting.createExperiment({
        name: 'Results Collection Test',
        controlModel: 'control',
        variantModels: ['variant'],
        trafficSplit: { 'control': 50, 'variant': 50 }
      });

      // Record some results
      await abTesting.recordResult(experiment.id, 'control', {
        latency: 250,
        quality: 0.85,
        cost: 0.002
      });

      await abTesting.recordResult(experiment.id, 'variant', {
        latency: 180,
        quality: 0.82,
        cost: 0.003
      });

      const results = await abTesting.getExperimentResults(experiment.id);
      
      expect(results).toHaveProperty('control');
      expect(results).toHaveProperty('variant');
      expect(results.control.avgLatency).toBe(250);
      expect(results.variant.avgLatency).toBe(180);
    });
  });

  describe('SLA Monitoring', () => {
    test('should track availability SLA', async () => {
      const sla = await slaMonitor.createSLA({
        type: 'availability',
        targetValue: 99.9, // 99.9% uptime
        measurementPeriod: 'daily'
      });

      // Simulate some uptime/downtime
      await slaMonitor.recordMetric(sla.id, 'availability', 99.5); // Below target
      
      const violations = await slaMonitor.checkViolations(sla.id);
      expect(violations).toHaveLength(1);
      expect(violations[0].metricValue).toBe(99.5);
    });

    test('should track latency SLA', async () => {
      const sla = await slaMonitor.createSLA({
        type: 'latency',
        targetValue: 500, // 500ms max
        measurementPeriod: 'hourly'
      });

      // Record latencies
      await slaMonitor.recordMetric(sla.id, 'latency', 750); // Violation
      await slaMonitor.recordMetric(sla.id, 'latency', 300); // OK

      const violations = await slaMonitor.checkViolations(sla.id);
      expect(violations).toHaveLength(1);
      expect(violations[0].metricValue).toBe(750);
    });

    test('should calculate SLA compliance', async () => {
      const sla = await slaMonitor.createSLA({
        type: 'quality',
        targetValue: 0.8, // 80% quality score
        measurementPeriod: 'daily'
      });

      // Record various quality scores
      const scores = [0.85, 0.90, 0.75, 0.88, 0.82]; // Average: 0.84
      
      for (const score of scores) {
        await slaMonitor.recordMetric(sla.id, 'quality', score);
      }

      const compliance = await slaMonitor.calculateCompliance(sla.id);
      expect(compliance.actualValue).toBeCloseTo(0.84, 2);
      expect(compliance.meetsSLA).toBe(true); // 0.84 > 0.8
    });
  });

  describe('Enterprise Authentication and Authorization', () => {
    test('should support role-based access control', async () => {
      // Create users with different roles
      const adminUser = await database.query('users', 'insert', {
        username: 'admin',
        email: 'admin@enterprise.com',
        role: 'admin'
      });

      const regularUser = await database.query('users', 'insert', {
        username: 'user',
        email: 'user@enterprise.com',
        role: 'user'
      });

      // Test admin permissions
      const adminPermissions = await enterpriseManager.getUserPermissions(adminUser.id);
      expect(adminPermissions).toContain('manage_models');
      expect(adminPermissions).toContain('view_analytics');
      expect(adminPermissions).toContain('manage_users');

      // Test regular user permissions
      const userPermissions = await enterpriseManager.getUserPermissions(regularUser.id);
      expect(userPermissions).toContain('use_models');
      expect(userPermissions).not.toContain('manage_models');
      expect(userPermissions).not.toContain('manage_users');
    });

    test('should support API key-based authentication', async () => {
      const user = await database.query('users', 'insert', {
        username: 'apiuser',
        email: 'api@enterprise.com'
      });

      // Create API key
      const apiKey = await database.query('api_keys', 'insert', {
        userId: user.id,
        name: 'Enterprise API Key',
        keyHash: 'hashed_key_123',
        permissions: JSON.stringify(['use_models', 'view_metrics']),
        active: true
      });

      // Validate API key
      const isValid = await enterpriseManager.validateApiKey('hashed_key_123');
      expect(isValid).toBe(true);

      const keyInfo = await enterpriseManager.getApiKeyInfo('hashed_key_123');
      expect(keyInfo.userId).toBe(user.id);
      expect(JSON.parse(keyInfo.permissions)).toContain('use_models');
    });
  });

  describe('Billing and Usage Tracking', () => {
    test('should track usage for billing', async () => {
      const user = await database.query('users', 'insert', {
        username: 'billinguser',
        email: 'billing@enterprise.com'
      });

      // Record usage
      await enterpriseManager.recordUsage(user.id, {
        requestCount: 100,
        tokenCount: 1500,
        cost: 0.15
      });

      await enterpriseManager.recordUsage(user.id, {
        requestCount: 50,
        tokenCount: 800,
        cost: 0.08
      });

      // Check billing summary
      const usage = await enterpriseManager.getUserUsage(user.id);
      expect(usage.totalRequests).toBe(150);
      expect(usage.totalTokens).toBe(2300);
      expect(usage.totalCost).toBeCloseTo(0.23, 2);
    });

    test('should generate billing records', async () => {
      const tenant = await database.query('tenants', 'insert', {
        name: 'Billing Test Tenant',
        plan: 'enterprise'
      });

      const billingPeriodStart = new Date('2024-01-01');
      const billingPeriodEnd = new Date('2024-01-31');

      const billingRecord = await enterpriseManager.generateBillingRecord({
        tenantId: tenant.id,
        billingPeriodStart,
        billingPeriodEnd,
        totalRequests: 1000,
        totalTokens: 50000,
        totalCost: 25.50
      });

      expect(billingRecord.tenantId).toBe(tenant.id);
      expect(billingRecord.totalRequests).toBe(1000);
      expect(billingRecord.finalAmount).toBe(25.50);
      expect(billingRecord.status).toBe('pending');
    });
  });

  describe('Enterprise Integration Scenarios', () => {
    test('should handle complete enterprise workflow', async () => {
      // 1. Create tenant
      const tenant = await database.query('tenants', 'insert', {
        name: 'Complete Workflow Corp',
        plan: 'enterprise'
      });

      // 2. Create admin user
      const admin = await database.query('users', 'insert', {
        username: 'corp-admin',
        email: 'admin@workflow.com',
        role: 'admin',
        tenantId: tenant.id
      });

      // 3. Set up quotas
      await database.query('usage_quotas', 'insert', {
        tenantId: tenant.id,
        quotaType: 'requests',
        quotaLimit: 1000,
        resetPeriod: 'monthly'
      });

      // 4. Create A/B experiment
      const experiment = await abTesting.createExperiment({
        name: 'Enterprise Model Test',
        controlModel: 'enterprise-model-a',
        variantModels: ['enterprise-model-b'],
        trafficSplit: { 'enterprise-model-a': 60, 'enterprise-model-b': 40 }
      });

      // 5. Set up SLA monitoring
      const sla = await slaMonitor.createSLA({
        tenantId: tenant.id,
        type: 'latency',
        targetValue: 200,
        measurementPeriod: 'hourly'
      });

      // 6. Perform inference requests
      const results = [];
      for (let i = 0; i < 10; i++) {
        const selectedModel = await abTesting.getModelForUser(
          experiment.id,
          `user-${i}`,
          'enterprise test prompt'
        );

        // Simulate inference
        const latency = Math.random() * 300 + 100; // 100-400ms
        await slaMonitor.recordMetric(sla.id, 'latency', latency);

        results.push({ model: selectedModel, latency });
      }

      // 7. Check results
      expect(results).toHaveLength(10);
      
      const experimentResults = await abTesting.getExperimentResults(experiment.id);
      expect(experimentResults).toBeDefined();

      const slaStatus = await slaMonitor.checkViolations(sla.id);
      expect(Array.isArray(slaStatus)).toBe(true);

      // 8. Verify quota tracking
      const quotaStatus = await enterpriseManager.checkQuota(tenant.id, 'requests');
      expect(typeof quotaStatus).toBe('boolean');
    });
  });
});