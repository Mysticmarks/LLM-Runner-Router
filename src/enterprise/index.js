/**
 * 🏢 Enterprise Features Index
 * Central export point for all enterprise functionality
 * Echo AI Systems - Enterprise-grade LLM orchestration
 */

// Core enterprise components
import MultiTenancyManager, { IsolationLevels, QuotaTypes } from './MultiTenancy.js';
import ABTestingManager, { ExperimentStatus, SplittingAlgorithms, StatisticalTests } from './ABTesting.js';
import AuditLogger, { AuditEventTypes, ComplianceFrameworks, RiskLevels } from './AuditLogger.js';
import SLAMonitor, { SLAMetricTypes, BreachSeverity, SLAStatus, TimeWindows } from './SLAMonitor.js';
import EnterpriseAuthManager, { AuthMethods, UserRoles, Permissions, SessionTypes } from './EnterpriseAuth.js';

// Integration components
import EnterpriseManager from './EnterpriseManager.js';
import EnterpriseRouter from './RouterIntegration.js';
import { createEnterpriseExpressRoutes, createEnterpriseWebSocketHandlers } from './APIIntegration.js';

export { default as MultiTenancyManager, IsolationLevels, QuotaTypes } from './MultiTenancy.js';
export { default as ABTestingManager, ExperimentStatus, SplittingAlgorithms, StatisticalTests } from './ABTesting.js';
export { default as AuditLogger, AuditEventTypes, ComplianceFrameworks, RiskLevels } from './AuditLogger.js';
export { default as SLAMonitor, SLAMetricTypes, BreachSeverity, SLAStatus, TimeWindows } from './SLAMonitor.js';
export { default as EnterpriseAuthManager, AuthMethods, UserRoles, Permissions, SessionTypes } from './EnterpriseAuth.js';
export { EnterpriseManager } from './EnterpriseManager.js';
export { EnterpriseRouter } from './RouterIntegration.js';
export { createEnterpriseExpressRoutes, createEnterpriseWebSocketHandlers } from './APIIntegration.js';

/**
 * Enterprise feature status constants
 */
export const EnterpriseFeatures = {
  MULTI_TENANCY: 'multi_tenancy',
  AB_TESTING: 'ab_testing',
  AUDIT_LOGGING: 'audit_logging',
  SLA_MONITORING: 'sla_monitoring',
  AUTHENTICATION: 'authentication'
};

/**
 * Default enterprise configuration
 */
export const defaultEnterpriseConfig = {
  enableMultiTenancy: true,
  enableABTesting: true,
  enableAuditLogging: true,
  enableSLAMonitoring: true,
  enableAuthentication: true,
  
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
  
  abTesting: {
    defaultConfidenceLevel: 0.95,
    defaultMinSampleSize: 100,
    enableFeatureFlags: true
  },
  
  auditLogging: {
    logDirectory: './audit-logs',
    encryptLogs: true,
    retentionDays: 2555, // 7 years
    complianceFrameworks: ['gdpr']
  },
  
  slaMonitoring: {
    alertingEnabled: true,
    reportingInterval: 300000, // 5 minutes
    retentionDays: 90
  },
  
  authentication: {
    jwtExpiration: '24h',
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    maxSessions: 5,
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

/**
 * Create enterprise-enabled LLM router
 * @param {Router} baseRouter - Base router instance
 * @param {object} config - Enterprise configuration
 * @returns {EnterpriseRouter} Enterprise router instance
 */
export function createEnterpriseRouter(baseRouter, config = {}) {
  const enterpriseConfig = {
    ...defaultEnterpriseConfig,
    ...config
  };
  
  return new EnterpriseRouter(baseRouter, enterpriseConfig);
}

/**
 * Utility function to check if feature is enabled
 * @param {object} config - Configuration object
 * @param {string} feature - Feature name
 * @returns {boolean} Whether feature is enabled
 */
export function isFeatureEnabled(config, feature) {
  switch (feature) {
    case EnterpriseFeatures.MULTI_TENANCY:
      return config.enableMultiTenancy !== false;
    case EnterpriseFeatures.AB_TESTING:
      return config.enableABTesting !== false;
    case EnterpriseFeatures.AUDIT_LOGGING:
      return config.enableAuditLogging !== false;
    case EnterpriseFeatures.SLA_MONITORING:
      return config.enableSLAMonitoring !== false;
    case EnterpriseFeatures.AUTHENTICATION:
      return config.enableAuthentication !== false;
    default:
      return false;
  }
}

/**
 * Get enabled enterprise features
 * @param {object} config - Configuration object
 * @returns {string[]} Array of enabled feature names
 */
export function getEnabledFeatures(config) {
  return Object.values(EnterpriseFeatures).filter(feature => 
    isFeatureEnabled(config, feature)
  );
}

/**
 * Validate enterprise configuration
 * @param {object} config - Configuration to validate
 * @returns {object} Validation result
 */
export function validateEnterpriseConfig(config) {
  const errors = [];
  const warnings = [];
  
  // Check for required fields when features are enabled
  if (config.enableAuthentication && !config.authentication?.jwtSecret) {
    errors.push('JWT secret is required when authentication is enabled');
  }
  
  if (config.enableAuditLogging && !config.auditLogging?.logDirectory) {
    warnings.push('Log directory not specified, using default: ./audit-logs');
  }
  
  if (config.enableMultiTenancy && !config.multiTenancy?.defaultQuotas) {
    warnings.push('Default quotas not specified for multi-tenancy');
  }
  
  // Check for conflicting settings
  if (config.enableABTesting && config.abTesting?.defaultMinSampleSize < 10) {
    warnings.push('Minimum sample size should be at least 10 for reliable results');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Enterprise version information
 */
export const enterpriseVersion = {
  version: '1.0.0',
  features: Object.values(EnterpriseFeatures),
  buildDate: new Date().toISOString(),
  description: 'Enterprise-grade multi-tenancy, A/B testing, audit logging, SLA monitoring, and authentication for LLM Router'
};

// Default export for convenience
export default {
  EnterpriseManager,
  EnterpriseRouter,
  MultiTenancyManager,
  ABTestingManager,
  AuditLogger,
  SLAMonitor,
  EnterpriseAuthManager,
  createEnterpriseRouter,
  createEnterpriseExpressRoutes,
  createEnterpriseWebSocketHandlers,
  defaultEnterpriseConfig,
  EnterpriseFeatures,
  isFeatureEnabled,
  getEnabledFeatures,
  validateEnterpriseConfig,
  enterpriseVersion
};