# 🏢 Enterprise Features Documentation

Comprehensive guide to enterprise-grade features including multi-tenancy, SLA monitoring, audit logging, compliance, and high-availability configurations.

## Table of Contents

1. [Overview](#overview)
2. [Multi-Tenancy](#multi-tenancy)
3. [SLA Monitoring](#sla-monitoring)
4. [Audit Logging](#audit-logging)
5. [Security & Compliance](#security--compliance)
6. [High Availability](#high-availability)
7. [Enterprise Integration](#enterprise-integration)
8. [Cost Management](#cost-management)
9. [Best Practices](#best-practices)

## Overview

LLM-Runner-Router provides enterprise-grade features for organizations requiring:

- **Multi-tenant isolation** with resource limits
- **SLA guarantees** with monitoring and alerts
- **Comprehensive audit trails** for compliance
- **Enterprise authentication** (SAML, OAuth, LDAP)
- **High availability** with failover
- **Cost allocation** and chargeback

## Multi-Tenancy

### Tenant Isolation

```javascript
import { EnterpriseRouter } from 'llm-runner-router/enterprise';

const router = new EnterpriseRouter({
  multiTenancy: {
    enabled: true,
    isolation: 'strict', // strict, shared, or hybrid
    resourceLimits: true
  }
});

// Create tenant
await router.createTenant({
  id: 'acme-corp',
  name: 'ACME Corporation',
  tier: 'enterprise',
  limits: {
    requestsPerMinute: 1000,
    requestsPerDay: 100000,
    tokensPerMonth: 10000000,
    maxConcurrent: 50,
    models: ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus']
  },
  settings: {
    dataResidency: 'us-east',
    encryption: 'aes-256',
    retention: 90 // days
  }
});

// Route requests for tenant
const response = await router.generate({
  prompt: 'Hello',
  tenantId: 'acme-corp',
  userId: 'user@acme.com'
});
```

### Resource Management

```javascript
class TenantResourceManager {
  constructor() {
    this.tenants = new Map();
    this.resources = new Map();
  }
  
  async allocateResources(tenantId, requirements) {
    const tenant = await this.getTenant(tenantId);
    
    // Check resource availability
    const available = await this.checkAvailability(tenant, requirements);
    
    if (!available) {
      throw new Error('Insufficient resources for tenant');
    }
    
    // Allocate resources
    const allocation = {
      tenantId,
      cpu: requirements.cpu || 1,
      memory: requirements.memory || 512,
      storage: requirements.storage || 10,
      bandwidth: requirements.bandwidth || 100,
      timestamp: Date.now()
    };
    
    this.resources.set(`${tenantId}:${Date.now()}`, allocation);
    
    // Update tenant usage
    await this.updateUsage(tenantId, allocation);
    
    return allocation;
  }
  
  async enforceQuotas(tenantId) {
    const tenant = await this.getTenant(tenantId);
    const usage = await this.getUsage(tenantId);
    
    // Check quotas
    const violations = [];
    
    if (usage.requests > tenant.limits.requestsPerDay) {
      violations.push({
        type: 'daily_request_limit',
        limit: tenant.limits.requestsPerDay,
        usage: usage.requests
      });
    }
    
    if (usage.tokens > tenant.limits.tokensPerMonth) {
      violations.push({
        type: 'monthly_token_limit',
        limit: tenant.limits.tokensPerMonth,
        usage: usage.tokens
      });
    }
    
    if (violations.length > 0) {
      await this.handleQuotaViolations(tenantId, violations);
      throw new Error('Quota exceeded');
    }
    
    return true;
  }
  
  async handleQuotaViolations(tenantId, violations) {
    // Log violations
    await this.logViolations(tenantId, violations);
    
    // Send alerts
    await this.sendAlerts(tenantId, violations);
    
    // Apply rate limiting
    await this.applyRateLimiting(tenantId);
  }
}
```

## SLA Monitoring

### SLA Configuration

```javascript
class SLAMonitor {
  constructor() {
    this.slas = new Map();
    this.metrics = new Map();
    this.violations = [];
  }
  
  defineSLA(tenantId, sla) {
    this.slas.set(tenantId, {
      availability: sla.availability || 99.9,
      latency: {
        p50: sla.latency?.p50 || 500,
        p95: sla.latency?.p95 || 1000,
        p99: sla.latency?.p99 || 2000
      },
      errorRate: sla.errorRate || 0.1,
      throughput: sla.throughput || 1000,
      responseTime: sla.responseTime || 1000
    });
  }
  
  async monitor(tenantId, request, response) {
    const sla = this.slas.get(tenantId);
    if (!sla) return;
    
    // Record metrics
    const metric = {
      tenantId,
      timestamp: Date.now(),
      latency: response.latency,
      success: !response.error,
      statusCode: response.statusCode
    };
    
    this.recordMetric(metric);
    
    // Check SLA compliance
    const compliance = await this.checkCompliance(tenantId);
    
    if (!compliance.met) {
      await this.handleViolation(tenantId, compliance);
    }
    
    return compliance;
  }
  
  async checkCompliance(tenantId) {
    const sla = this.slas.get(tenantId);
    const metrics = this.getRecentMetrics(tenantId);
    
    const compliance = {
      met: true,
      violations: []
    };
    
    // Check availability
    const availability = this.calculateAvailability(metrics);
    if (availability < sla.availability) {
      compliance.met = false;
      compliance.violations.push({
        type: 'availability',
        expected: sla.availability,
        actual: availability
      });
    }
    
    // Check latency
    const latencies = metrics.map(m => m.latency);
    const p99 = this.percentile(latencies, 99);
    
    if (p99 > sla.latency.p99) {
      compliance.met = false;
      compliance.violations.push({
        type: 'latency_p99',
        expected: sla.latency.p99,
        actual: p99
      });
    }
    
    // Check error rate
    const errorRate = this.calculateErrorRate(metrics);
    if (errorRate > sla.errorRate) {
      compliance.met = false;
      compliance.violations.push({
        type: 'error_rate',
        expected: sla.errorRate,
        actual: errorRate
      });
    }
    
    return compliance;
  }
  
  async handleViolation(tenantId, compliance) {
    const violation = {
      tenantId,
      timestamp: Date.now(),
      violations: compliance.violations,
      severity: this.calculateSeverity(compliance.violations)
    };
    
    this.violations.push(violation);
    
    // Send alerts
    await this.sendSLAAlert(tenantId, violation);
    
    // Generate report
    await this.generateSLAReport(tenantId, violation);
    
    // Apply credits if configured
    await this.applySLACredits(tenantId, violation);
  }
  
  calculateAvailability(metrics) {
    const total = metrics.length;
    const successful = metrics.filter(m => m.success).length;
    return (successful / total) * 100;
  }
  
  calculateErrorRate(metrics) {
    const total = metrics.length;
    const errors = metrics.filter(m => !m.success).length;
    return (errors / total) * 100;
  }
  
  percentile(values, p) {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }
}
```

### Real-time SLA Dashboard

```javascript
class SLADashboard {
  constructor(monitor) {
    this.monitor = monitor;
    this.cache = new Map();
  }
  
  async getDashboardData(tenantId) {
    const cached = this.cache.get(tenantId);
    
    if (cached && Date.now() - cached.timestamp < 5000) {
      return cached.data;
    }
    
    const data = await this.generateDashboardData(tenantId);
    
    this.cache.set(tenantId, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  }
  
  async generateDashboardData(tenantId) {
    const sla = this.monitor.slas.get(tenantId);
    const metrics = this.monitor.getRecentMetrics(tenantId);
    
    return {
      current: {
        availability: this.monitor.calculateAvailability(metrics),
        errorRate: this.monitor.calculateErrorRate(metrics),
        p50Latency: this.monitor.percentile(metrics.map(m => m.latency), 50),
        p95Latency: this.monitor.percentile(metrics.map(m => m.latency), 95),
        p99Latency: this.monitor.percentile(metrics.map(m => m.latency), 99)
      },
      targets: sla,
      compliance: await this.monitor.checkCompliance(tenantId),
      violations: this.monitor.violations.filter(v => v.tenantId === tenantId),
      trends: this.calculateTrends(metrics),
      recommendations: this.generateRecommendations(metrics, sla)
    };
  }
  
  calculateTrends(metrics) {
    // Group by hour
    const hourly = {};
    
    metrics.forEach(m => {
      const hour = new Date(m.timestamp).getHours();
      if (!hourly[hour]) {
        hourly[hour] = [];
      }
      hourly[hour].push(m);
    });
    
    return Object.entries(hourly).map(([hour, metrics]) => ({
      hour: parseInt(hour),
      availability: this.monitor.calculateAvailability(metrics),
      avgLatency: metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length,
      requests: metrics.length
    }));
  }
  
  generateRecommendations(metrics, sla) {
    const recommendations = [];
    
    const errorRate = this.monitor.calculateErrorRate(metrics);
    if (errorRate > sla.errorRate * 0.8) {
      recommendations.push({
        type: 'warning',
        message: 'Error rate approaching SLA limit',
        action: 'Consider enabling fallback models'
      });
    }
    
    const p99 = this.monitor.percentile(metrics.map(m => m.latency), 99);
    if (p99 > sla.latency.p99 * 0.8) {
      recommendations.push({
        type: 'warning',
        message: 'P99 latency approaching SLA limit',
        action: 'Consider using faster models or caching'
      });
    }
    
    return recommendations;
  }
}
```

## Audit Logging

### Comprehensive Audit Trail

```javascript
class AuditLogger {
  constructor(config = {}) {
    this.storage = config.storage || 'database';
    this.encryption = config.encryption || true;
    this.retention = config.retention || 365; // days
    this.loggers = {
      database: new DatabaseLogger(),
      file: new FileLogger(),
      siem: new SIEMLogger()
    };
  }
  
  async log(event) {
    const auditEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      tenantId: event.tenantId,
      userId: event.userId,
      action: event.action,
      resource: event.resource,
      details: event.details,
      ip: event.ip,
      userAgent: event.userAgent,
      result: event.result,
      metadata: event.metadata
    };
    
    // Encrypt sensitive data
    if (this.encryption) {
      auditEntry.details = await this.encrypt(auditEntry.details);
    }
    
    // Log to multiple destinations
    await Promise.all([
      this.loggers.database.log(auditEntry),
      this.loggers.file.log(auditEntry),
      this.loggers.siem.log(auditEntry)
    ]);
    
    // Apply retention policy
    await this.applyRetention();
    
    return auditEntry.id;
  }
  
  async query(filters = {}) {
    const {
      tenantId,
      userId,
      action,
      startDate,
      endDate,
      limit = 100
    } = filters;
    
    const query = {
      tenantId,
      userId,
      action,
      timestamp: {
        $gte: startDate,
        $lte: endDate
      }
    };
    
    const results = await this.loggers.database.query(query, limit);
    
    // Decrypt if needed
    if (this.encryption) {
      for (const result of results) {
        result.details = await this.decrypt(result.details);
      }
    }
    
    return results;
  }
  
  async generateComplianceReport(tenantId, period) {
    const logs = await this.query({
      tenantId,
      startDate: period.start,
      endDate: period.end
    });
    
    return {
      tenant: tenantId,
      period,
      summary: {
        totalActions: logs.length,
        uniqueUsers: new Set(logs.map(l => l.userId)).size,
        actionBreakdown: this.groupByAction(logs),
        successRate: this.calculateSuccessRate(logs)
      },
      details: logs,
      compliance: {
        dataRetention: true,
        encryption: this.encryption,
        auditTrail: true
      }
    };
  }
  
  groupByAction(logs) {
    const groups = {};
    
    logs.forEach(log => {
      groups[log.action] = (groups[log.action] || 0) + 1;
    });
    
    return groups;
  }
  
  calculateSuccessRate(logs) {
    const successful = logs.filter(l => l.result === 'success').length;
    return (successful / logs.length) * 100;
  }
}
```

## Security & Compliance

### Enterprise Authentication

```javascript
class EnterpriseAuth {
  constructor() {
    this.providers = {
      saml: new SAMLProvider(),
      oauth: new OAuthProvider(),
      ldap: new LDAPProvider(),
      mfa: new MFAProvider()
    };
  }
  
  async authenticate(credentials, method = 'saml') {
    const provider = this.providers[method];
    
    if (!provider) {
      throw new Error(`Authentication method ${method} not supported`);
    }
    
    // Perform authentication
    const result = await provider.authenticate(credentials);
    
    // Enforce MFA if required
    if (this.requiresMFA(result.user)) {
      const mfaResult = await this.providers.mfa.verify(
        result.user,
        credentials.mfaToken
      );
      
      if (!mfaResult.verified) {
        throw new Error('MFA verification failed');
      }
    }
    
    // Create session
    const session = await this.createSession(result.user);
    
    // Log authentication
    await this.logAuthentication(result.user, method, true);
    
    return session;
  }
  
  requiresMFA(user) {
    return user.tier === 'enterprise' || user.role === 'admin';
  }
  
  async createSession(user) {
    return {
      token: this.generateToken(user),
      expiresIn: 3600,
      refreshToken: this.generateRefreshToken(user),
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        roles: user.roles,
        permissions: user.permissions
      }
    };
  }
}
```

### Data Encryption

```javascript
class DataEncryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyRotation = 90; // days
  }
  
  async encryptData(data, tenantId) {
    const key = await this.getEncryptionKey(tenantId);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      keyVersion: key.version
    };
  }
  
  async decryptData(encryptedData, tenantId) {
    const key = await this.getEncryptionKey(tenantId, encryptedData.keyVersion);
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }
  
  async rotateKeys() {
    // Rotate encryption keys periodically
    const tenants = await this.getAllTenants();
    
    for (const tenant of tenants) {
      const currentKey = await this.getEncryptionKey(tenant.id);
      
      if (this.shouldRotate(currentKey)) {
        const newKey = await this.generateNewKey(tenant.id);
        await this.reEncryptData(tenant.id, currentKey, newKey);
        await this.archiveOldKey(currentKey);
      }
    }
  }
  
  shouldRotate(key) {
    const age = Date.now() - key.createdAt;
    return age > this.keyRotation * 24 * 60 * 60 * 1000;
  }
}
```

## High Availability

### Failover Configuration

```javascript
class HighAvailability {
  constructor() {
    this.regions = ['us-east', 'us-west', 'eu-west', 'ap-south'];
    this.primaryRegion = 'us-east';
    this.healthChecks = new Map();
  }
  
  async setupFailover() {
    // Configure multi-region deployment
    for (const region of this.regions) {
      await this.deployToRegion(region);
      
      // Setup health monitoring
      this.startHealthCheck(region);
    }
    
    // Configure load balancer
    await this.configureLoadBalancer();
    
    // Setup data replication
    await this.setupReplication();
  }
  
  startHealthCheck(region) {
    const check = setInterval(async () => {
      const health = await this.checkRegionHealth(region);
      
      this.healthChecks.set(region, {
        healthy: health.healthy,
        latency: health.latency,
        timestamp: Date.now()
      });
      
      if (!health.healthy && region === this.primaryRegion) {
        await this.failover();
      }
    }, 5000);
    
    return check;
  }
  
  async failover() {
    console.log(`Initiating failover from ${this.primaryRegion}`);
    
    // Find healthy region with lowest latency
    const healthyRegions = Array.from(this.healthChecks.entries())
      .filter(([region, health]) => health.healthy && region !== this.primaryRegion)
      .sort(([, a], [, b]) => a.latency - b.latency);
    
    if (healthyRegions.length === 0) {
      throw new Error('No healthy regions available for failover');
    }
    
    const newPrimary = healthyRegions[0][0];
    
    // Update DNS
    await this.updateDNS(newPrimary);
    
    // Redirect traffic
    await this.redirectTraffic(newPrimary);
    
    // Update configuration
    this.primaryRegion = newPrimary;
    
    // Notify
    await this.notifyFailover(newPrimary);
    
    console.log(`Failover complete. New primary: ${newPrimary}`);
  }
  
  async checkRegionHealth(region) {
    try {
      const start = Date.now();
      const response = await fetch(`https://${region}.api.llmrouter.com/health`);
      const latency = Date.now() - start;
      
      return {
        healthy: response.ok,
        latency,
        status: response.status
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Infinity,
        error: error.message
      };
    }
  }
}
```

## Enterprise Integration

### API Gateway Integration

```javascript
class APIGatewayIntegration {
  constructor() {
    this.gateways = {
      kong: new KongAdapter(),
      apigee: new ApigeeAdapter(),
      aws: new AWSAPIGatewayAdapter()
    };
  }
  
  async integrate(gateway, config) {
    const adapter = this.gateways[gateway];
    
    if (!adapter) {
      throw new Error(`Gateway ${gateway} not supported`);
    }
    
    // Register routes
    await adapter.registerRoutes([
      {
        path: '/api/v1/generate',
        method: 'POST',
        upstream: 'llm-router-service',
        plugins: ['rate-limiting', 'authentication', 'logging']
      },
      {
        path: '/api/v1/models',
        method: 'GET',
        upstream: 'llm-router-service',
        cache: 300
      }
    ]);
    
    // Configure plugins
    await adapter.configurePlugins({
      rateLimiting: {
        minute: 1000,
        hour: 10000
      },
      authentication: {
        type: 'jwt',
        issuer: config.issuer
      },
      logging: {
        level: 'info',
        destination: 'elasticsearch'
      }
    });
    
    // Setup monitoring
    await adapter.enableMonitoring({
      metrics: true,
      tracing: true,
      logging: true
    });
    
    return adapter.getConfiguration();
  }
}
```

## Cost Management

### Cost Allocation & Chargeback

```javascript
class CostAllocation {
  constructor() {
    this.costs = new Map();
    this.rates = {
      'gpt-4': 0.03,
      'gpt-3.5-turbo': 0.002,
      'claude-3-opus': 0.015,
      'claude-3-haiku': 0.00025
    };
  }
  
  async allocateCosts(usage) {
    const allocation = {
      tenantId: usage.tenantId,
      period: usage.period,
      departments: new Map(),
      projects: new Map(),
      users: new Map()
    };
    
    // Process each request
    for (const request of usage.requests) {
      const cost = this.calculateCost(request);
      
      // Allocate to department
      const dept = request.metadata?.department || 'default';
      const deptCost = allocation.departments.get(dept) || 0;
      allocation.departments.set(dept, deptCost + cost);
      
      // Allocate to project
      const project = request.metadata?.project || 'default';
      const projectCost = allocation.projects.get(project) || 0;
      allocation.projects.set(project, projectCost + cost);
      
      // Allocate to user
      const user = request.userId;
      const userCost = allocation.users.get(user) || 0;
      allocation.users.set(user, userCost + cost);
    }
    
    // Generate chargeback report
    return this.generateChargebackReport(allocation);
  }
  
  calculateCost(request) {
    const rate = this.rates[request.model] || 0.01;
    const tokens = request.tokens || 100;
    return (tokens / 1000) * rate;
  }
  
  async generateChargebackReport(allocation) {
    return {
      tenant: allocation.tenantId,
      period: allocation.period,
      totalCost: this.sumCosts(allocation),
      breakdown: {
        byDepartment: Object.fromEntries(allocation.departments),
        byProject: Object.fromEntries(allocation.projects),
        byUser: this.getTopUsers(allocation.users, 10)
      },
      invoice: await this.generateInvoice(allocation)
    };
  }
  
  sumCosts(allocation) {
    let total = 0;
    for (const cost of allocation.departments.values()) {
      total += cost;
    }
    return total;
  }
  
  getTopUsers(users, limit) {
    return Array.from(users.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([user, cost]) => ({ user, cost }));
  }
}
```

## Best Practices

### 1. Multi-Tenancy
- Use strict isolation for sensitive data
- Implement resource quotas per tenant
- Monitor resource usage continuously
- Automate tenant provisioning

### 2. SLA Management
- Define realistic SLA targets
- Monitor in real-time
- Automate violation handling
- Provide transparency via dashboards

### 3. Security
- Implement defense in depth
- Encrypt data at rest and in transit
- Use enterprise authentication
- Maintain comprehensive audit logs

### 4. High Availability
- Deploy across multiple regions
- Implement automatic failover
- Test disaster recovery regularly
- Monitor health continuously

### 5. Cost Management
- Track costs per tenant/project
- Implement chargeback mechanisms
- Optimize resource usage
- Provide cost visibility

## Conclusion

Enterprise features in LLM-Runner-Router provide:

- **Complete isolation** for multi-tenant deployments
- **SLA guarantees** with automated monitoring
- **Comprehensive security** and compliance
- **High availability** with automatic failover
- **Detailed cost management** and allocation

These features enable organizations to deploy LLM applications at scale with confidence.

---

Next: [Custom Adapters](./custom-adapters.md) | [Back to Advanced Topics](../advanced/)