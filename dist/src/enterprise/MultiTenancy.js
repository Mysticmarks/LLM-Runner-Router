/**
 * 🏢 Multi-Tenancy System
 * Enterprise-grade tenant isolation and resource management
 * Echo AI Systems - Secure multi-tenant LLM orchestration
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';
import crypto from 'crypto';

const logger = new Logger('MultiTenancy');

/**
 * Tenant isolation levels
 */
export const IsolationLevels = {
  STRICT: 'strict',           // Complete resource isolation
  SHARED: 'shared',           // Shared models with usage limits
  HYBRID: 'hybrid'            // Mix of shared and dedicated resources
};

/**
 * Resource quota types
 */
export const QuotaTypes = {
  REQUESTS_PER_MINUTE: 'requests_per_minute',
  REQUESTS_PER_HOUR: 'requests_per_hour',
  REQUESTS_PER_DAY: 'requests_per_day',
  TOKENS_PER_MINUTE: 'tokens_per_minute',
  TOKENS_PER_HOUR: 'tokens_per_hour',
  TOKENS_PER_DAY: 'tokens_per_day',
  CONCURRENT_REQUESTS: 'concurrent_requests',
  MODEL_COUNT: 'model_count',
  STORAGE_GB: 'storage_gb',
  COMPUTE_UNITS: 'compute_units'
};

/**
 * Multi-Tenancy Manager
 */
class MultiTenancyManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      isolationLevel: IsolationLevels.SHARED,
      enableBilling: true,
      enableAuditLog: true,
      defaultQuotas: {
        [QuotaTypes.REQUESTS_PER_MINUTE]: 100,
        [QuotaTypes.TOKENS_PER_HOUR]: 100000,
        [QuotaTypes.CONCURRENT_REQUESTS]: 10,
        [QuotaTypes.MODEL_COUNT]: 5
      },
      ...config
    };
    
    // Tenant management
    this.tenants = new Map();
    this.tenantModels = new Map(); // tenant -> model pools
    this.tenantSessions = new Map(); // tenant -> active sessions
    
    // Usage tracking
    this.usageCounters = new Map(); // tenant -> usage counters
    this.quotaTrackers = new Map(); // tenant -> quota trackers
    
    // Billing integration
    this.billingEvents = [];
    
    logger.info('🏢 Multi-tenancy manager initialized', {
      isolationLevel: this.config.isolationLevel,
      billing: this.config.enableBilling
    });
  }

  /**
   * Create new tenant
   * @param {object} tenantData - Tenant configuration
   */
  async createTenant(tenantData) {
    const tenant = {
      id: tenantData.id || this.generateTenantId(),
      name: tenantData.name,
      isolationLevel: tenantData.isolationLevel || this.config.isolationLevel,
      quotas: { ...this.config.defaultQuotas, ...tenantData.quotas },
      metadata: tenantData.metadata || {},
      config: tenantData.config || {},
      status: 'active',
      createdAt: new Date(),
      ...tenantData
    };
    
    // Validate tenant data
    this.validateTenantData(tenant);
    
    // Store tenant
    this.tenants.set(tenant.id, tenant);
    
    // Initialize resources
    await this.initializeTenantResources(tenant);
    
    // Initialize usage tracking
    this.initializeUsageTracking(tenant.id);
    
    this.emit('tenant-created', tenant);
    logger.info(`✅ Tenant created: ${tenant.name} (${tenant.id})`);
    
    return tenant;
  }

  /**
   * Get tenant by ID
   */
  getTenant(tenantId) {
    return this.tenants.get(tenantId);
  }

  /**
   * Update tenant configuration
   */
  async updateTenant(tenantId, updates) {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }
    
    const updatedTenant = {
      ...tenant,
      ...updates,
      updatedAt: new Date()
    };
    
    this.validateTenantData(updatedTenant);
    this.tenants.set(tenantId, updatedTenant);
    
    // Update resources if needed
    if (updates.quotas || updates.isolationLevel) {
      await this.updateTenantResources(tenantId, updates);
    }
    
    this.emit('tenant-updated', updatedTenant);
    logger.info(`🔄 Tenant updated: ${tenantId}`);
    
    return updatedTenant;
  }

  /**
   * Delete tenant
   */
  async deleteTenant(tenantId) {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }
    
    // Cleanup resources
    await this.cleanupTenantResources(tenantId);
    
    // Remove from maps
    this.tenants.delete(tenantId);
    this.tenantModels.delete(tenantId);
    this.tenantSessions.delete(tenantId);
    this.usageCounters.delete(tenantId);
    this.quotaTrackers.delete(tenantId);
    
    this.emit('tenant-deleted', tenant);
    logger.info(`🗑️ Tenant deleted: ${tenantId}`);
  }

  /**
   * Check if tenant has access to model
   */
  async checkModelAccess(tenantId, modelId) {
    const tenant = this.getTenant(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }
    
    if (tenant.status !== 'active') {
      throw new Error(`Tenant not active: ${tenantId}`);
    }
    
    // Check isolation level
    switch (tenant.isolationLevel) {
      case IsolationLevels.STRICT:
        return this.checkStrictAccess(tenantId, modelId);
      case IsolationLevels.SHARED:
        return this.checkSharedAccess(tenantId, modelId);
      case IsolationLevels.HYBRID:
        return this.checkHybridAccess(tenantId, modelId);
      default:
        return false;
    }
  }

  /**
   * Check quota before request
   */
  async checkQuota(tenantId, operation = {}) {
    const tenant = this.getTenant(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }
    
    const quotaTracker = this.quotaTrackers.get(tenantId);
    if (!quotaTracker) {
      throw new Error(`Quota tracker not found for tenant: ${tenantId}`);
    }
    
    const now = Date.now();
    
    // Check each quota type
    for (const [quotaType, limit] of Object.entries(tenant.quotas)) {
      const current = this.getCurrentUsage(tenantId, quotaType, now);
      
      if (current >= limit) {
        const error = new Error(`Quota exceeded: ${quotaType} (${current}/${limit})`);
        error.quotaType = quotaType;
        error.current = current;
        error.limit = limit;
        
        this.emit('quota-exceeded', {
          tenantId,
          quotaType,
          current,
          limit
        });
        
        throw error;
      }
    }
    
    return true;
  }

  /**
   * Record usage for billing and quota tracking
   */
  async recordUsage(tenantId, usage) {
    const tenant = this.getTenant(tenantId);
    if (!tenant) {
      return;
    }
    
    const usageRecord = {
      tenantId,
      timestamp: Date.now(),
      ...usage
    };
    
    // Update usage counters
    this.updateUsageCounters(tenantId, usage);
    
    // Record for billing
    if (this.config.enableBilling) {
      this.recordBillingEvent(usageRecord);
    }
    
    this.emit('usage-recorded', usageRecord);
  }

  /**
   * Get tenant usage statistics
   */
  getTenantUsage(tenantId, timeframe = '1h') {
    const usageCounter = this.usageCounters.get(tenantId);
    if (!usageCounter) {
      return null;
    }
    
    const now = Date.now();
    const timeframes = {
      '1m': 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    
    const period = timeframes[timeframe] || timeframes['1h'];
    const since = now - period;
    
    return this.aggregateUsage(usageCounter, since, now);
  }

  /**
   * Get tenant model pool
   */
  getTenantModels(tenantId) {
    return this.tenantModels.get(tenantId) || [];
  }

  /**
   * Assign model to tenant
   */
  async assignModelToTenant(tenantId, modelId, config = {}) {
    const tenant = this.getTenant(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }
    
    let tenantModels = this.tenantModels.get(tenantId) || [];
    
    // Check model count quota
    if (tenantModels.length >= tenant.quotas[QuotaTypes.MODEL_COUNT]) {
      throw new Error(`Model count quota exceeded for tenant: ${tenantId}`);
    }
    
    const modelAssignment = {
      modelId,
      assignedAt: new Date(),
      config
    };
    
    tenantModels.push(modelAssignment);
    this.tenantModels.set(tenantId, tenantModels);
    
    this.emit('model-assigned', { tenantId, modelId, config });
    logger.info(`📦 Model ${modelId} assigned to tenant ${tenantId}`);
  }

  /**
   * Remove model from tenant
   */
  async removeModelFromTenant(tenantId, modelId) {
    let tenantModels = this.tenantModels.get(tenantId) || [];
    tenantModels = tenantModels.filter(m => m.modelId !== modelId);
    this.tenantModels.set(tenantId, tenantModels);
    
    this.emit('model-removed', { tenantId, modelId });
    logger.info(`📦 Model ${modelId} removed from tenant ${tenantId}`);
  }

  /**
   * List all tenants
   */
  listTenants(filter = {}) {
    const tenants = Array.from(this.tenants.values());
    
    if (filter.status) {
      return tenants.filter(t => t.status === filter.status);
    }
    
    if (filter.isolationLevel) {
      return tenants.filter(t => t.isolationLevel === filter.isolationLevel);
    }
    
    return tenants;
  }

  /**
   * Get system-wide usage statistics
   */
  getSystemUsage() {
    const stats = {
      totalTenants: this.tenants.size,
      activeTenants: 0,
      totalUsage: {},
      topTenants: []
    };
    
    const tenantUsages = [];
    
    for (const [tenantId, tenant] of this.tenants.entries()) {
      if (tenant.status === 'active') {
        stats.activeTenants++;
      }
      
      const usage = this.getTenantUsage(tenantId, '1h');
      if (usage) {
        tenantUsages.push({
          tenantId,
          tenantName: tenant.name,
          usage
        });
        
        // Aggregate total usage
        for (const [key, value] of Object.entries(usage)) {
          stats.totalUsage[key] = (stats.totalUsage[key] || 0) + value;
        }
      }
    }
    
    // Sort by usage
    stats.topTenants = tenantUsages
      .sort((a, b) => (b.usage.requests || 0) - (a.usage.requests || 0))
      .slice(0, 10);
    
    return stats;
  }

  /**
   * Generate billing report
   */
  generateBillingReport(tenantId, startDate, endDate) {
    if (!this.config.enableBilling) {
      throw new Error('Billing not enabled');
    }
    
    const events = this.billingEvents.filter(event => 
      event.tenantId === tenantId &&
      event.timestamp >= startDate.getTime() &&
      event.timestamp <= endDate.getTime()
    );
    
    const report = {
      tenantId,
      period: { start: startDate, end: endDate },
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      breakdown: {},
      events: events.length
    };
    
    for (const event of events) {
      report.totalRequests += event.requests || 0;
      report.totalTokens += event.tokens || 0;
      report.totalCost += event.cost || 0;
      
      // Model breakdown
      if (event.modelId) {
        if (!report.breakdown[event.modelId]) {
          report.breakdown[event.modelId] = {
            requests: 0,
            tokens: 0,
            cost: 0
          };
        }
        
        report.breakdown[event.modelId].requests += event.requests || 0;
        report.breakdown[event.modelId].tokens += event.tokens || 0;
        report.breakdown[event.modelId].cost += event.cost || 0;
      }
    }
    
    return report;
  }

  // Private methods

  /**
   * Generate unique tenant ID
   * @private
   */
  generateTenantId() {
    return 'tenant_' + crypto.randomBytes(16).toString('hex');
  }

  /**
   * Validate tenant data
   * @private
   */
  validateTenantData(tenant) {
    if (!tenant.id) {
      throw new Error('Tenant ID is required');
    }
    
    if (!tenant.name) {
      throw new Error('Tenant name is required');
    }
    
    if (!Object.values(IsolationLevels).includes(tenant.isolationLevel)) {
      throw new Error(`Invalid isolation level: ${tenant.isolationLevel}`);
    }
    
    // Validate quotas
    if (tenant.quotas) {
      for (const [type, value] of Object.entries(tenant.quotas)) {
        if (!Object.values(QuotaTypes).includes(type)) {
          throw new Error(`Invalid quota type: ${type}`);
        }
        
        if (typeof value !== 'number' || value < 0) {
          throw new Error(`Invalid quota value for ${type}: ${value}`);
        }
      }
    }
  }

  /**
   * Initialize tenant resources
   * @private
   */
  async initializeTenantResources(tenant) {
    // Initialize model pools based on isolation level
    switch (tenant.isolationLevel) {
      case IsolationLevels.STRICT:
        await this.initializeStrictResources(tenant);
        break;
      case IsolationLevels.SHARED:
        await this.initializeSharedResources(tenant);
        break;
      case IsolationLevels.HYBRID:
        await this.initializeHybridResources(tenant);
        break;
    }
    
    // Initialize tenant-specific configuration
    if (tenant.config.dedicatedModels) {
      for (const modelConfig of tenant.config.dedicatedModels) {
        await this.assignModelToTenant(tenant.id, modelConfig.id, modelConfig);
      }
    }
  }

  /**
   * Initialize usage tracking for tenant
   * @private
   */
  initializeUsageTracking(tenantId) {
    this.usageCounters.set(tenantId, new Map());
    this.quotaTrackers.set(tenantId, new Map());
  }

  /**
   * Check strict isolation access
   * @private
   */
  checkStrictAccess(tenantId, modelId) {
    const tenantModels = this.tenantModels.get(tenantId) || [];
    return tenantModels.some(m => m.modelId === modelId);
  }

  /**
   * Check shared access
   * @private
   */
  checkSharedAccess(tenantId, modelId) {
    // In shared mode, check if model is in shared pool or assigned to tenant
    const tenantModels = this.tenantModels.get(tenantId) || [];
    const hasDirectAccess = tenantModels.some(m => m.modelId === modelId);
    
    // For shared models, additional logic would check global shared pool
    // This is a simplified implementation
    return hasDirectAccess || this.isModelInSharedPool(modelId);
  }

  /**
   * Check hybrid access
   * @private
   */
  checkHybridAccess(tenantId, modelId) {
    // Hybrid combines strict and shared access patterns
    return this.checkStrictAccess(tenantId, modelId) || 
           this.checkSharedAccess(tenantId, modelId);
  }

  /**
   * Check if model is in shared pool
   * @private
   */
  isModelInSharedPool(modelId) {
    // This would check against a shared model registry
    // Simplified for demo
    return true;
  }

  /**
   * Get current usage for quota type
   * @private
   */
  getCurrentUsage(tenantId, quotaType, timestamp) {
    const usageCounter = this.usageCounters.get(tenantId);
    if (!usageCounter) {
      return 0;
    }
    
    // Calculate usage based on quota type time window
    const timeWindows = {
      [QuotaTypes.REQUESTS_PER_MINUTE]: 60 * 1000,
      [QuotaTypes.REQUESTS_PER_HOUR]: 60 * 60 * 1000,
      [QuotaTypes.REQUESTS_PER_DAY]: 24 * 60 * 60 * 1000,
      [QuotaTypes.TOKENS_PER_MINUTE]: 60 * 1000,
      [QuotaTypes.TOKENS_PER_HOUR]: 60 * 60 * 1000,
      [QuotaTypes.TOKENS_PER_DAY]: 24 * 60 * 60 * 1000,
      [QuotaTypes.CONCURRENT_REQUESTS]: 0, // Current count
      [QuotaTypes.MODEL_COUNT]: 0, // Current count
      [QuotaTypes.STORAGE_GB]: 0, // Current count
      [QuotaTypes.COMPUTE_UNITS]: 60 * 60 * 1000 // Per hour
    };
    
    const window = timeWindows[quotaType];
    if (window === 0) {
      // For current counts, return the current value
      return usageCounter.get(quotaType) || 0;
    }
    
    const since = timestamp - window;
    return this.getUsageInWindow(usageCounter, quotaType, since, timestamp);
  }

  /**
   * Get usage in time window
   * @private
   */
  getUsageInWindow(usageCounter, quotaType, since, until) {
    // This would aggregate usage data within the time window
    // Simplified implementation
    const entries = usageCounter.get(`${quotaType}_history`) || [];
    return entries
      .filter(entry => entry.timestamp >= since && entry.timestamp <= until)
      .reduce((sum, entry) => sum + entry.value, 0);
  }

  /**
   * Update usage counters
   * @private
   */
  updateUsageCounters(tenantId, usage) {
    const usageCounter = this.usageCounters.get(tenantId);
    if (!usageCounter) {
      return;
    }
    
    const timestamp = Date.now();
    
    for (const [type, value] of Object.entries(usage)) {
      // Update current value
      const current = usageCounter.get(type) || 0;
      usageCounter.set(type, current + value);
      
      // Store historical data
      const historyKey = `${type}_history`;
      const history = usageCounter.get(historyKey) || [];
      history.push({ timestamp, value });
      
      // Keep only recent history (last 24 hours)
      const cutoff = timestamp - (24 * 60 * 60 * 1000);
      const recentHistory = history.filter(entry => entry.timestamp > cutoff);
      usageCounter.set(historyKey, recentHistory);
    }
  }

  /**
   * Record billing event
   * @private
   */
  recordBillingEvent(usageRecord) {
    // Add cost calculation
    const event = {
      ...usageRecord,
      cost: this.calculateCost(usageRecord)
    };
    
    this.billingEvents.push(event);
    
    // Keep only recent events (last 30 days)
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.billingEvents = this.billingEvents.filter(e => e.timestamp > cutoff);
  }

  /**
   * Calculate cost for usage
   * @private
   */
  calculateCost(usage) {
    // Simplified cost calculation
    // In production, this would use sophisticated pricing models
    const rates = {
      requests: 0.001,  // $0.001 per request
      tokens: 0.00001,  // $0.00001 per token
      compute_units: 0.01 // $0.01 per compute unit
    };
    
    let cost = 0;
    cost += (usage.requests || 0) * rates.requests;
    cost += (usage.tokens || 0) * rates.tokens;
    cost += (usage.compute_units || 0) * rates.compute_units;
    
    return cost;
  }

  /**
   * Aggregate usage data
   * @private
   */
  aggregateUsage(usageCounter, since, until) {
    const aggregated = {};
    
    for (const [key, value] of usageCounter.entries()) {
      if (key.endsWith('_history')) {
        const baseKey = key.replace('_history', '');
        const entries = value.filter(entry => 
          entry.timestamp >= since && entry.timestamp <= until
        );
        
        aggregated[baseKey] = entries.reduce((sum, entry) => sum + entry.value, 0);
      }
    }
    
    return aggregated;
  }

  /**
   * Initialize strict isolation resources
   * @private
   */
  async initializeStrictResources(tenant) {
    // Create isolated model pool for tenant
    this.tenantModels.set(tenant.id, []);
    logger.debug(`🔒 Initialized strict resources for tenant: ${tenant.id}`);
  }

  /**
   * Initialize shared resources
   * @private
   */
  async initializeSharedResources(tenant) {
    // Setup access to shared model pool with quotas
    this.tenantModels.set(tenant.id, []);
    logger.debug(`🤝 Initialized shared resources for tenant: ${tenant.id}`);
  }

  /**
   * Initialize hybrid resources
   * @private
   */
  async initializeHybridResources(tenant) {
    // Setup mix of dedicated and shared resources
    this.tenantModels.set(tenant.id, []);
    logger.debug(`🔄 Initialized hybrid resources for tenant: ${tenant.id}`);
  }

  /**
   * Update tenant resources
   * @private
   */
  async updateTenantResources(tenantId, updates) {
    if (updates.isolationLevel) {
      // Handle isolation level changes
      const tenant = this.getTenant(tenantId);
      await this.initializeTenantResources(tenant);
    }
    
    logger.debug(`🔄 Updated resources for tenant: ${tenantId}`);
  }

  /**
   * Cleanup tenant resources
   * @private
   */
  async cleanupTenantResources(tenantId) {
    // Release dedicated resources
    // Cleanup model assignments
    // Clear usage data (optional, for compliance may need to retain)
    
    logger.debug(`🧹 Cleaned up resources for tenant: ${tenantId}`);
  }
}

export default MultiTenancyManager;
export { MultiTenancyManager };