/**
 * Tests for Multi-Tenancy System
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import MultiTenancyManager, { IsolationLevels, QuotaTypes } from '../../src/enterprise/MultiTenancy.js';

describe('MultiTenancyManager', () => {
  let multiTenancy;

  beforeEach(() => {
    multiTenancy = new MultiTenancyManager({
      isolationLevel: IsolationLevels.SHARED,
      enableBilling: true,
      defaultQuotas: {
        [QuotaTypes.REQUESTS_PER_MINUTE]: 100,
        [QuotaTypes.TOKENS_PER_HOUR]: 50000,
        [QuotaTypes.CONCURRENT_REQUESTS]: 5,
        [QuotaTypes.MODEL_COUNT]: 3
      }
    });
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Tenant Management', () => {
    it('should create a new tenant', async () => {
      const tenantData = {
        name: 'Test Tenant',
        isolationLevel: IsolationLevels.STRICT,
        quotas: {
          [QuotaTypes.REQUESTS_PER_MINUTE]: 200
        },
        metadata: {
          organization: 'Test Org'
        }
      };

      const tenant = await multiTenancy.createTenant(tenantData);

      expect(tenant).toBeDefined();
      expect(tenant.id).toBeDefined();
      expect(tenant.name).toBe('Test Tenant');
      expect(tenant.isolationLevel).toBe(IsolationLevels.STRICT);
      expect(tenant.quotas[QuotaTypes.REQUESTS_PER_MINUTE]).toBe(200);
      expect(tenant.metadata.organization).toBe('Test Org');
      expect(tenant.status).toBe('active');
      expect(tenant.createdAt).toBeInstanceOf(Date);
    });

    it('should validate tenant data', async () => {
      const invalidTenantData = {};

      await expect(multiTenancy.createTenant(invalidTenantData))
        .rejects.toThrow('Tenant name is required');
    });

    it('should get tenant by ID', async () => {
      const tenant = await multiTenancy.createTenant({
        name: 'Test Tenant'
      });

      const retrieved = multiTenancy.getTenant(tenant.id);
      expect(retrieved).toEqual(tenant);
    });

    it('should update tenant configuration', async () => {
      const tenant = await multiTenancy.createTenant({
        name: 'Test Tenant'
      });

      const updates = {
        quotas: {
          [QuotaTypes.REQUESTS_PER_MINUTE]: 500
        }
      };

      const updated = await multiTenancy.updateTenant(tenant.id, updates);

      expect(updated.quotas[QuotaTypes.REQUESTS_PER_MINUTE]).toBe(500);
      expect(updated.updatedAt).toBeInstanceOf(Date);
    });

    it('should delete tenant', async () => {
      const tenant = await multiTenancy.createTenant({
        name: 'Test Tenant'
      });

      await multiTenancy.deleteTenant(tenant.id);

      const retrieved = multiTenancy.getTenant(tenant.id);
      expect(retrieved).toBeUndefined();
    });

    it('should list tenants with filters', async () => {
      await multiTenancy.createTenant({
        name: 'Active Tenant',
        status: 'active'
      });

      await multiTenancy.createTenant({
        name: 'Inactive Tenant',
        status: 'inactive'
      });

      const activeTenants = multiTenancy.listTenants({ status: 'active' });
      expect(activeTenants).toHaveLength(1);
      expect(activeTenants[0].name).toBe('Active Tenant');
    });
  });

  describe('Model Access Control', () => {
    let tenant;

    beforeEach(async () => {
      tenant = await multiTenancy.createTenant({
        name: 'Test Tenant',
        isolationLevel: IsolationLevels.STRICT
      });
    });

    it('should assign model to tenant', async () => {
      const modelId = 'test-model-1';
      const config = { priority: 'high' };

      await multiTenancy.assignModelToTenant(tenant.id, modelId, config);

      const tenantModels = multiTenancy.getTenantModels(tenant.id);
      expect(tenantModels).toHaveLength(1);
      expect(tenantModels[0].modelId).toBe(modelId);
      expect(tenantModels[0].config.priority).toBe('high');
    });

    it('should enforce model count quota', async () => {
      // Assign models up to quota
      for (let i = 1; i <= 3; i++) {
        await multiTenancy.assignModelToTenant(tenant.id, `model-${i}`);
      }

      // Try to assign one more model (should fail)
      await expect(
        multiTenancy.assignModelToTenant(tenant.id, 'model-4')
      ).rejects.toThrow('Model count quota exceeded');
    });

    it('should remove model from tenant', async () => {
      const modelId = 'test-model-1';
      await multiTenancy.assignModelToTenant(tenant.id, modelId);

      await multiTenancy.removeModelFromTenant(tenant.id, modelId);

      const tenantModels = multiTenancy.getTenantModels(tenant.id);
      expect(tenantModels).toHaveLength(0);
    });

    it('should check model access for strict isolation', async () => {
      const modelId = 'test-model-1';
      await multiTenancy.assignModelToTenant(tenant.id, modelId);

      const hasAccess = await multiTenancy.checkModelAccess(tenant.id, modelId);
      expect(hasAccess).toBe(true);

      const noAccess = await multiTenancy.checkModelAccess(tenant.id, 'other-model');
      expect(noAccess).toBe(false);
    });
  });

  describe('Quota Management', () => {
    let tenant;

    beforeEach(async () => {
      tenant = await multiTenancy.createTenant({
        name: 'Quota Test Tenant',
        quotas: {
          [QuotaTypes.REQUESTS_PER_MINUTE]: 2,
          [QuotaTypes.TOKENS_PER_HOUR]: 1000
        }
      });
    });

    it('should check quota before operation', async () => {
      // Should pass initially
      await expect(
        multiTenancy.checkQuota(tenant.id, { requests: 1 })
      ).resolves.toBe(true);
    });

    it('should reject when quota exceeded', async () => {
      // Record usage that exceeds quota
      await multiTenancy.recordUsage(tenant.id, {
        requests: 1,
        tokens: 100
      });

      await multiTenancy.recordUsage(tenant.id, {
        requests: 1,
        tokens: 100
      });

      // This should exceed the requests per minute quota
      await multiTenancy.recordUsage(tenant.id, {
        requests: 1,
        tokens: 100
      });

      await expect(
        multiTenancy.checkQuota(tenant.id)
      ).rejects.toThrow(/Quota exceeded/);
    });

    it('should record usage for billing', async () => {
      const usage = {
        requests: 1,
        tokens: 100,
        modelId: 'test-model',
        duration: 1500
      };

      await multiTenancy.recordUsage(tenant.id, usage);

      const tenantUsage = multiTenancy.getTenantUsage(tenant.id, '1h');
      expect(tenantUsage).toBeDefined();
      expect(tenantUsage.requests).toBe(1);
      expect(tenantUsage.tokens).toBe(100);
    });
  });

  describe('Usage Tracking', () => {
    let tenant;

    beforeEach(async () => {
      tenant = await multiTenancy.createTenant({
        name: 'Usage Test Tenant'
      });
    });

    it('should get tenant usage statistics', async () => {
      // Record some usage
      await multiTenancy.recordUsage(tenant.id, {
        requests: 5,
        tokens: 500
      });

      const usage = multiTenancy.getTenantUsage(tenant.id, '1h');
      expect(usage).toBeDefined();
      expect(usage.requests).toBe(5);
      expect(usage.tokens).toBe(500);
    });

    it('should get system-wide usage', async () => {
      // Create multiple tenants and record usage
      const tenant2 = await multiTenancy.createTenant({
        name: 'Usage Test Tenant 2'
      });

      await multiTenancy.recordUsage(tenant.id, { requests: 3 });
      await multiTenancy.recordUsage(tenant2.id, { requests: 7 });

      const systemUsage = multiTenancy.getSystemUsage();
      expect(systemUsage.totalTenants).toBe(2);
      expect(systemUsage.activeTenants).toBe(2);
      expect(systemUsage.totalUsage.requests).toBe(10);
    });
  });

  describe('Billing Integration', () => {
    let tenant;

    beforeEach(async () => {
      tenant = await multiTenancy.createTenant({
        name: 'Billing Test Tenant'
      });
    });

    it('should generate billing report', async () => {
      // Record usage over time
      await multiTenancy.recordUsage(tenant.id, {
        requests: 10,
        tokens: 1000,
        modelId: 'test-model',
        cost: 0.50
      });

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const report = multiTenancy.generateBillingReport(tenant.id, startDate, endDate);

      expect(report.tenantId).toBe(tenant.id);
      expect(report.totalRequests).toBe(10);
      expect(report.totalTokens).toBe(1000);
      expect(report.breakdown['test-model']).toBeDefined();
    });
  });

  describe('Isolation Levels', () => {
    it('should handle strict isolation', async () => {
      const tenant = await multiTenancy.createTenant({
        name: 'Strict Tenant',
        isolationLevel: IsolationLevels.STRICT
      });

      expect(tenant.isolationLevel).toBe(IsolationLevels.STRICT);
    });

    it('should handle shared isolation', async () => {
      const tenant = await multiTenancy.createTenant({
        name: 'Shared Tenant',
        isolationLevel: IsolationLevels.SHARED
      });

      expect(tenant.isolationLevel).toBe(IsolationLevels.SHARED);
    });

    it('should handle hybrid isolation', async () => {
      const tenant = await multiTenancy.createTenant({
        name: 'Hybrid Tenant',
        isolationLevel: IsolationLevels.HYBRID
      });

      expect(tenant.isolationLevel).toBe(IsolationLevels.HYBRID);
    });
  });

  describe('Events', () => {
    it('should emit tenant-created event', async () => {
      const eventHandler = jest.fn();
      multiTenancy.on('tenant-created', eventHandler);

      const tenant = await multiTenancy.createTenant({
        name: 'Event Test Tenant'
      });

      expect(eventHandler).toHaveBeenCalledWith(tenant);
    });

    it('should emit usage-recorded event', async () => {
      const tenant = await multiTenancy.createTenant({
        name: 'Event Test Tenant'
      });

      const eventHandler = jest.fn();
      multiTenancy.on('usage-recorded', eventHandler);

      const usage = { requests: 1, tokens: 100 };
      await multiTenancy.recordUsage(tenant.id, usage);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: tenant.id,
          requests: 1,
          tokens: 100
        })
      );
    });

    it('should emit quota-exceeded event', async () => {
      const tenant = await multiTenancy.createTenant({
        name: 'Quota Event Tenant',
        quotas: {
          [QuotaTypes.REQUESTS_PER_MINUTE]: 1
        }
      });

      const eventHandler = jest.fn();
      multiTenancy.on('quota-exceeded', eventHandler);

      // Exceed quota
      await multiTenancy.recordUsage(tenant.id, { requests: 2 });

      try {
        await multiTenancy.checkQuota(tenant.id);
      } catch (error) {
        // Expected to throw
      }

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid tenant ID', async () => {
      await expect(
        multiTenancy.checkModelAccess('invalid-tenant', 'model-1')
      ).rejects.toThrow('Tenant not found');
    });

    it('should handle inactive tenant', async () => {
      const tenant = await multiTenancy.createTenant({
        name: 'Inactive Tenant',
        status: 'inactive'
      });

      await expect(
        multiTenancy.checkModelAccess(tenant.id, 'model-1')
      ).rejects.toThrow('Tenant not active');
    });

    it('should validate quota types', async () => {
      await expect(
        multiTenancy.createTenant({
          name: 'Invalid Quota Tenant',
          quotas: {
            'invalid_quota_type': 100
          }
        })
      ).rejects.toThrow('Invalid quota type');
    });
  });
});