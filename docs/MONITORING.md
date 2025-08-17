# 🔭 Monitoring and Observability System

Comprehensive monitoring and observability for the LLM Runner Router with OpenTelemetry, Prometheus, health checks, performance profiling, and intelligent alerting.

## 📋 Table of Contents

- [Overview](#overview)
- [Components](#components)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Integration](#integration)
- [Metrics](#metrics)
- [Alerting](#alerting)
- [Performance Profiling](#performance-profiling)
- [Health Monitoring](#health-monitoring)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

The monitoring system provides complete observability for your LLM Router infrastructure with:

- **📊 Metrics Collection**: Prometheus metrics with custom LLM-specific metrics
- **🔍 Distributed Tracing**: OpenTelemetry integration with Jaeger/Zipkin
- **🏥 Health Monitoring**: Comprehensive health checks and dependency monitoring
- **🔬 Performance Profiling**: CPU/memory profiling with flame graphs
- **🚨 Intelligent Alerting**: Multi-channel alerting with smart aggregation
- **🎛️ Unified Interface**: Single monitoring system managing all components

## 🧩 Components

### 1. OpenTelemetry Integration
- **File**: `src/monitoring/OpenTelemetry.js`
- **Purpose**: Distributed tracing, metrics, and context propagation
- **Features**:
  - Auto-instrumentation for HTTP, gRPC, Express
  - Multiple exporters (Jaeger, Zipkin, Console)
  - Custom spans and baggage propagation
  - Correlation between traces, metrics, and logs

### 2. Prometheus Metrics
- **File**: `src/monitoring/Prometheus.js`
- **Purpose**: Custom metrics collection with /metrics endpoint
- **Features**:
  - LLM-specific metrics (inference time, token throughput, model loading)
  - HTTP request/response metrics
  - Cache hit ratios and performance
  - System resource monitoring

### 3. Health Monitor
- **File**: `src/monitoring/HealthMonitor.js`
- **Purpose**: System health checks and dependency monitoring
- **Features**:
  - Built-in system resource checks (CPU, memory, disk)
  - Custom health check registration
  - Dependency monitoring with criticality levels
  - Health status aggregation and reporting

### 4. Performance Profiler
- **File**: `src/monitoring/Profiler.js`
- **Purpose**: Deep performance analysis and bottleneck detection
- **Features**:
  - CPU profiling with flame graphs
  - Memory profiling and heap snapshots
  - Performance bottleneck detection
  - Automated performance reports

### 5. Alerting System
- **File**: `src/monitoring/Alerting.js`
- **Purpose**: Intelligent alerting with multiple channels
- **Features**:
  - Multi-channel notifications (Slack, Email, PagerDuty, Webhooks)
  - Alert aggregation and escalation
  - Custom alert rule engine
  - Alert history and analytics

### 6. Unified Monitoring System
- **File**: `src/monitoring/index.js`
- **Purpose**: Central orchestration of all monitoring components
- **Features**:
  - Component lifecycle management
  - Cross-component integrations
  - Unified metrics collection
  - Dashboard data aggregation

## 🚀 Quick Start

### Basic Setup

```javascript
import monitoringSystem from './src/monitoring/index.js';

// Start monitoring with default configuration
await monitoringSystem.start();

// Record HTTP request
monitoringSystem.recordHttpRequest(req, res, duration);

// Record model inference
monitoringSystem.recordModelInference(
  'gpt-3.5-turbo',
  'transformer',
  'openai',
  1.5, // duration in seconds
  150  // token count
);

// Create traced span
const span = monitoringSystem.createSpan('custom-operation', {
  'operation.type': 'data-processing',
  'user.id': userId,
});

// Execute with tracing
await monitoringSystem.withSpan('database-query', async () => {
  return await database.query('SELECT * FROM users');
}, { 'db.table': 'users' });
```

### Express Integration

```javascript
import express from 'express';
import { setupMonitoring } from './src/monitoring/middleware.js';

const app = express();

// Setup comprehensive monitoring
setupMonitoring(app, {
  httpMonitoring: true,
  errorMonitoring: true,
  healthEndpoint: '/health',
  metricsEndpoint: '/metrics',
  statusEndpoint: '/status',
});

// Endpoints are automatically available:
// GET /health - Health check endpoint
// GET /metrics - Prometheus metrics
// GET /status - Complete system status
```

### Custom Monitoring

```javascript
import { 
  withModelMonitoring,
  registerHealthCheck,
  registerAlertRule,
  recordCustomMetric 
} from './src/monitoring/middleware.js';

// Monitor model inference
const monitoredInference = withModelMonitoring(
  'my-model',
  'transformer',
  'custom-engine',
  async (prompt) => {
    return await model.generate(prompt);
  }
);

// Register custom health check
registerHealthCheck('external-api', async () => {
  const response = await fetch('https://api.external.com/health');
  return {
    status: response.ok ? 'healthy' : 'unhealthy',
    message: `API responded with ${response.status}`,
  };
});

// Register custom alert rule
registerAlertRule('custom-metric-high', {
  name: 'Custom Metric Too High',
  description: 'Custom metric exceeds threshold',
  severity: 'warning',
  condition: (metrics) => metrics.customValue > 1000,
  channels: ['slack'],
});

// Record custom metrics
recordCustomMetric('business_metric', 42, { category: 'sales' }, 'gauge');
```

## ⚙️ Configuration

### Environment-Based Configuration

Create a configuration file based on your environment:

```javascript
// config/monitoring.js
import configs from '../src/monitoring/config.example.js';

const environment = process.env.NODE_ENV || 'development';

export default {
  development: configs.development,
  production: configs.production,
  vps: configs.vps,
}[environment];
```

### VPS Configuration (Current Environment)

```javascript
export const vpsConfig = {
  enabled: true,
  autoStart: true,
  components: {
    opentelemetry: true,
    prometheus: true,
    health: true,
    profiler: false, // Disabled on VPS
    alerting: true,
  },
  
  prometheus: {
    port: 9090,
    endpoint: '/metrics',
    prefix: 'llm_router_vps_',
  },
  
  health: {
    interval: 15000, // 15 seconds
    thresholds: {
      cpu: 85,
      memory: 80,
      errorRate: 0.05,
    },
  },
  
  alerting: {
    channels: {
      webhook: {
        enabled: true,
        urls: [process.env.MONITORING_WEBHOOK_URL],
      },
    },
  },
};
```

### Production Configuration

```javascript
export const productionConfig = {
  enabled: true,
  components: {
    opentelemetry: true,
    prometheus: true,
    health: true,
    profiler: false,
    alerting: true,
  },
  
  opentelemetry: {
    tracing: {
      exporters: ['jaeger'],
      sampling: 0.1, // 10% sampling
    },
  },
  
  alerting: {
    channels: {
      slack: {
        enabled: true,
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: '#alerts',
      },
      pagerduty: {
        enabled: true,
        routingKey: process.env.PAGERDUTY_ROUTING_KEY,
      },
    },
  },
};
```

## 📊 Metrics

### HTTP Metrics

```
llm_router_http_requests_total{method, route, status_code}
llm_router_http_request_duration_seconds{method, route, status_code}
llm_router_http_request_size_bytes{method, route, status_code}
llm_router_http_response_size_bytes{method, route, status_code}
```

### Model Performance Metrics

```
llm_router_model_inference_total{model_id, model_type, engine, status}
llm_router_model_inference_duration_seconds{model_id, model_type, engine}
llm_router_model_loading_duration_seconds{model_id, model_type, engine}
llm_router_tokens_generated_total{model_id, model_type, engine}
llm_router_tokens_per_second{model_id, model_type, engine}
```

### System Metrics

```
llm_router_active_connections{connection_type}
llm_router_loaded_models{model_type}
llm_router_memory_usage_bytes{type}
llm_router_errors_total{error_type, component}
```

### Cache Metrics

```
llm_router_cache_operations_total{operation, cache_type, status}
llm_router_cache_hit_ratio{cache_type}
llm_router_cache_size_bytes{cache_type}
```

## 🚨 Alerting

### Default Alert Rules

1. **High Error Rate**: Error rate > 5%
2. **High Memory Usage**: Memory usage > 85%
3. **Model Inference Failures**: Model failure rate > 10%
4. **System Health Degraded**: Health status is degraded/unhealthy
5. **Performance Degradation**: Response times > 5 seconds

### Custom Alert Rules

```javascript
import { registerAlertRule } from './src/monitoring/middleware.js';

registerAlertRule('token_limit_exceeded', {
  name: 'Token Limit Exceeded',
  description: 'Token usage has exceeded daily limit',
  severity: 'critical',
  condition: (metrics) => metrics.dailyTokens > metrics.tokenLimit,
  channels: ['slack', 'email'],
  escalation: true,
});
```

### Alert Channels

#### Slack
```javascript
slack: {
  enabled: true,
  webhookUrl: process.env.SLACK_WEBHOOK_URL,
  channel: '#alerts',
  username: 'LLM Router',
}
```

#### Email
```javascript
email: {
  enabled: true,
  smtp: {
    host: process.env.SMTP_HOST,
    port: 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
  from: 'alerts@company.com',
  to: ['ops@company.com'],
}
```

#### PagerDuty
```javascript
pagerduty: {
  enabled: true,
  routingKey: process.env.PAGERDUTY_ROUTING_KEY,
}
```

## 🔬 Performance Profiling

### CPU Profiling

```javascript
import { startPerformanceProfile } from './src/monitoring/middleware.js';

// Start 30-second CPU profile
const profilePath = await startPerformanceProfile(30000);
console.log(`CPU profile saved to: ${profilePath}`);
```

### Memory Profiling

```javascript
import { takeMemorySnapshot } from './src/monitoring/middleware.js';

// Take heap snapshot
const snapshotPath = await takeMemorySnapshot();
console.log(`Heap snapshot saved to: ${snapshotPath}`);
```

### Automatic Profiling

```javascript
profiler: {
  autoProfile: true,
  profileDuration: 30000, // 30 seconds
  heapSnapshotInterval: 300000, // 5 minutes
}
```

### Performance Reports

```javascript
import profiler from './src/monitoring/Profiler.js';

// Generate comprehensive performance report
const reportPath = await profiler.generateReport();

// Detect performance bottlenecks
const bottlenecks = profiler.detectBottlenecks();
console.log('Performance bottlenecks:', bottlenecks);
```

## 🏥 Health Monitoring

### Built-in Health Checks

- **CPU Usage**: Monitors CPU utilization
- **Memory Usage**: Tracks memory consumption
- **Disk Usage**: Checks disk space availability
- **Process Health**: Monitors Node.js process health
- **Error Rate**: Tracks application error rates
- **Response Time**: Monitors average response times

### Custom Health Checks

```javascript
import { registerHealthCheck } from './src/monitoring/middleware.js';

registerHealthCheck('database', async () => {
  try {
    await database.ping();
    return {
      status: 'healthy',
      message: 'Database connection successful',
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Database connection failed: ${error.message}`,
    };
  }
}, {
  timeout: 5000,
  retries: 3,
});
```

### Dependency Monitoring

```javascript
import { registerDependency } from './src/monitoring/middleware.js';

registerDependency('external-api', async () => {
  const response = await fetch('https://api.external.com/health');
  return {
    status: response.ok ? 'healthy' : 'unhealthy',
    message: `API status: ${response.status}`,
  };
}, {
  critical: false, // Non-critical dependency
  timeout: 3000,
});
```

## 🔌 Integration

### Express.js Integration

```javascript
import express from 'express';
import { 
  httpMonitoringMiddleware,
  errorMonitoringMiddleware,
  setupMonitoring 
} from './src/monitoring/middleware.js';

const app = express();

// Manual middleware setup
app.use(httpMonitoringMiddleware({
  excludePaths: ['/favicon.ico', '/health'],
  sampling: 0.8, // 80% sampling
}));

app.use(errorMonitoringMiddleware());

// Or use automatic setup
setupMonitoring(app, {
  httpMonitoring: true,
  errorMonitoring: true,
  healthEndpoint: '/health',
  metricsEndpoint: '/metrics',
});
```

### Model Inference Integration

```javascript
import { withModelMonitoring } from './src/monitoring/middleware.js';

class ModelService {
  constructor() {
    // Wrap inference method with monitoring
    this.generateText = withModelMonitoring(
      'gpt-3.5-turbo',
      'transformer',
      'openai',
      this._generateText.bind(this)
    );
  }

  async _generateText(prompt) {
    // Your model inference logic
    const response = await openai.completions.create({
      model: 'gpt-3.5-turbo',
      prompt,
    });
    
    return {
      result: response.choices[0].text,
      tokenCount: response.usage.total_tokens,
    };
  }
}
```

### Database Integration

```javascript
import { withDatabaseMonitoring } from './src/monitoring/middleware.js';

class UserRepository {
  constructor(db) {
    this.db = db;
    
    // Wrap database methods with monitoring
    this.findUser = withDatabaseMonitoring(
      'SELECT',
      'users',
      this._findUser.bind(this)
    );
    
    this.createUser = withDatabaseMonitoring(
      'INSERT',
      'users',
      this._createUser.bind(this)
    );
  }

  async _findUser(id) {
    return this.db.query('SELECT * FROM users WHERE id = ?', [id]);
  }

  async _createUser(userData) {
    return this.db.query('INSERT INTO users SET ?', userData);
  }
}
```

## 📚 API Reference

### MonitoringSystem

```javascript
import monitoringSystem from './src/monitoring/index.js';

// Lifecycle
await monitoringSystem.start();
await monitoringSystem.stop();

// Recording metrics
monitoringSystem.recordHttpRequest(req, res, duration);
monitoringSystem.recordModelInference(modelId, type, engine, duration, tokens);

// Tracing
const span = monitoringSystem.createSpan(name, attributes);
await monitoringSystem.withSpan(name, fn, attributes);

// Status and reporting
const status = monitoringSystem.getSystemStatus();
const dashboardData = await monitoringSystem.getDashboardData();
const metrics = await monitoringSystem.exportMetrics('json');
```

### Middleware Functions

```javascript
import middleware from './src/monitoring/middleware.js';

// Monitoring wrappers
const monitoredFn = middleware.withModelMonitoring(id, type, engine, fn);
const monitoredDb = middleware.withDatabaseMonitoring(op, table, fn);
const monitoredCache = middleware.withCacheMonitoring(op, type, fn);

// Registration helpers
middleware.registerHealthCheck(name, fn, options);
middleware.registerDependency(name, fn, options);
middleware.registerAlertRule(id, rule);

// Metrics
middleware.recordCustomMetric(name, value, labels, type);

// Status
const status = middleware.getMonitoringStatus();
const isEnabled = middleware.isMonitoringEnabled();
```

## 🔧 Troubleshooting

### Common Issues

#### 1. OpenTelemetry Not Working
```bash
# Check if OpenTelemetry is initialized
console.log(monitoringSystem.components.opentelemetry.isInitialized);

# Verify exporters are configured
console.log(monitoringSystem.config.opentelemetry.tracing.exporters);
```

#### 2. Prometheus Metrics Not Appearing
```bash
# Check if Prometheus server is running
curl http://localhost:9090/metrics

# Verify metrics are being recorded
console.log(prometheusManager.getMetricsSummary());
```

#### 3. Health Checks Failing
```javascript
// Debug specific health check
const healthStatus = await healthMonitor.runChecks();
console.log(healthStatus.checks);

// Check health check configuration
console.log(Array.from(healthMonitor.checks.keys()));
```

#### 4. Alerts Not Firing
```javascript
// Check alert rules
console.log(Array.from(alertingSystem.rules.keys()));

// Manually trigger alert
await alertingSystem.triggerAlert('test_rule', {
  message: 'Test alert',
  severity: 'warning',
});

// Check alert configuration
console.log(alertingSystem.getStatus());
```

### Performance Considerations

1. **Sampling**: Use appropriate sampling rates for tracing (1-10% in production)
2. **Profiler**: Disable profiler in production unless debugging
3. **Metrics**: Monitor metrics collection overhead
4. **Alerts**: Use aggregation to prevent alert storms

### Environment Variables

```bash
# OpenTelemetry
OTEL_SERVICE_NAME=llm-router
OTEL_EXPORTER_JAEGER_ENDPOINT=http://jaeger:14268/api/traces

# Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
PAGERDUTY_ROUTING_KEY=your-routing-key

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Monitoring
MONITORING_WEBHOOK_URL=https://your-webhook.com/alerts
```

### Debug Logging

```javascript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Monitor component logs
import Logger from './src/utils/Logger.js';
const logger = new Logger('Debug');
logger.debug('Monitoring system status:', monitoringSystem.getSystemStatus());
```

## 📈 Best Practices

1. **Start Simple**: Begin with basic monitoring and add complexity gradually
2. **Monitor What Matters**: Focus on business-critical metrics
3. **Set Appropriate Thresholds**: Avoid false positives in alerting
4. **Use Dashboards**: Create visual dashboards for key metrics
5. **Regular Review**: Periodically review and update monitoring configuration
6. **Test Alerts**: Regularly test alert channels and escalation procedures
7. **Document Runbooks**: Create clear procedures for responding to alerts

## 🤝 Contributing

To contribute to the monitoring system:

1. Add tests for new components
2. Update documentation for configuration changes
3. Follow the existing patterns for new monitoring features
4. Ensure backward compatibility
5. Test with different environments (development, production, VPS)

---

**Echo AI Systems** - Making the invisible visible through comprehensive monitoring and observability.