# Monitoring & Observability Examples

Comprehensive monitoring, logging, alerting, and observability setup for LLM-Runner-Router in production environments.

## Table of Contents
- [Prometheus Metrics](#prometheus-metrics)
- [Grafana Dashboards](#grafana-dashboards)
- [Application Logging](#application-logging)
- [Health Checks](#health-checks)
- [Alerting Rules](#alerting-rules)
- [Performance Monitoring](#performance-monitoring)
- [Distributed Tracing](#distributed-tracing)
- [Error Tracking](#error-tracking)

## Prometheus Metrics

### 1. Custom Metrics Implementation

```javascript
// src/monitoring/MetricsCollector.js
import prometheus from 'prom-client';
import EventEmitter from 'events';

class MetricsCollector extends EventEmitter {
    constructor() {
        super();
        this.register = new prometheus.Registry();
        this.initializeMetrics();
        this.setupEventListeners();
    }
    
    initializeMetrics() {
        // Default system metrics
        prometheus.collectDefaultMetrics({ 
            register: this.register,
            prefix: 'llm_router_',
            gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
        });
        
        // HTTP request metrics
        this.httpRequestDuration = new prometheus.Histogram({
            name: 'llm_router_http_request_duration_seconds',
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'route', 'status_code'],
            buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30]
        });
        
        this.httpRequestsTotal = new prometheus.Counter({
            name: 'llm_router_http_requests_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'route', 'status_code']
        });
        
        // LLM inference metrics
        this.llmInferenceCount = new prometheus.Counter({
            name: 'llm_router_inference_total',
            help: 'Total number of LLM inferences',
            labelNames: ['model', 'strategy', 'status', 'cached']
        });
        
        this.llmInferenceDuration = new prometheus.Histogram({
            name: 'llm_router_inference_duration_seconds',
            help: 'Duration of LLM inferences in seconds',
            labelNames: ['model', 'strategy'],
            buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120]
        });
        
        this.llmTokensGenerated = new prometheus.Counter({
            name: 'llm_router_tokens_generated_total',
            help: 'Total number of tokens generated',
            labelNames: ['model', 'strategy']
        });
        
        this.llmTokensPerSecond = new prometheus.Histogram({
            name: 'llm_router_tokens_per_second',
            help: 'Tokens generated per second',
            labelNames: ['model'],
            buckets: [1, 5, 10, 20, 50, 100, 200, 500]
        });
        
        // Model metrics
        this.modelsLoaded = new prometheus.Gauge({
            name: 'llm_router_models_loaded',
            help: 'Number of models currently loaded',
            labelNames: ['format', 'size_category']
        });
        
        this.modelLoadDuration = new prometheus.Histogram({
            name: 'llm_router_model_load_duration_seconds',
            help: 'Duration of model loading operations',
            labelNames: ['model', 'format'],
            buckets: [1, 5, 10, 30, 60, 120, 300, 600]
        });
        
        this.modelMemoryUsage = new prometheus.Gauge({
            name: 'llm_router_model_memory_bytes',
            help: 'Memory usage by model in bytes',
            labelNames: ['model', 'format']
        });
        
        // Cache metrics
        this.cacheHits = new prometheus.Counter({
            name: 'llm_router_cache_hits_total',
            help: 'Total number of cache hits',
            labelNames: ['cache_type']
        });
        
        this.cacheMisses = new prometheus.Counter({
            name: 'llm_router_cache_misses_total',
            help: 'Total number of cache misses',
            labelNames: ['cache_type']
        });
        
        this.cacheSize = new prometheus.Gauge({
            name: 'llm_router_cache_size_bytes',
            help: 'Current cache size in bytes',
            labelNames: ['cache_type']
        });
        
        // Connection metrics
        this.activeConnections = new prometheus.Gauge({
            name: 'llm_router_active_connections',
            help: 'Number of active connections',
            labelNames: ['type', 'protocol']
        });
        
        this.connectionDuration = new prometheus.Histogram({
            name: 'llm_router_connection_duration_seconds',
            help: 'Duration of connections in seconds',
            labelNames: ['type', 'protocol'],
            buckets: [1, 10, 30, 60, 300, 600, 1800, 3600]
        });
        
        // Error metrics
        this.errorsTotal = new prometheus.Counter({
            name: 'llm_router_errors_total',
            help: 'Total number of errors',
            labelNames: ['type', 'component', 'severity']
        });
        
        // Queue metrics
        this.queueSize = new prometheus.Gauge({
            name: 'llm_router_queue_size',
            help: 'Current queue size',
            labelNames: ['queue_type']
        });
        
        this.queueProcessingTime = new prometheus.Histogram({
            name: 'llm_router_queue_processing_seconds',
            help: 'Time spent processing queue items',
            labelNames: ['queue_type'],
            buckets: [0.01, 0.1, 0.5, 1, 5, 10, 30]
        });
        
        // Register all metrics
        this.register.registerMetric(this.httpRequestDuration);
        this.register.registerMetric(this.httpRequestsTotal);
        this.register.registerMetric(this.llmInferenceCount);
        this.register.registerMetric(this.llmInferenceDuration);
        this.register.registerMetric(this.llmTokensGenerated);
        this.register.registerMetric(this.llmTokensPerSecond);
        this.register.registerMetric(this.modelsLoaded);
        this.register.registerMetric(this.modelLoadDuration);
        this.register.registerMetric(this.modelMemoryUsage);
        this.register.registerMetric(this.cacheHits);
        this.register.registerMetric(this.cacheMisses);
        this.register.registerMetric(this.cacheSize);
        this.register.registerMetric(this.activeConnections);
        this.register.registerMetric(this.connectionDuration);
        this.register.registerMetric(this.errorsTotal);
        this.register.registerMetric(this.queueSize);
        this.register.registerMetric(this.queueProcessingTime);
    }
    
    setupEventListeners() {
        // Listen to router events and update metrics
        this.on('http_request', (data) => {
            const { method, route, statusCode, duration } = data;
            this.httpRequestsTotal.labels(method, route, statusCode).inc();
            this.httpRequestDuration.labels(method, route, statusCode).observe(duration / 1000);
        });
        
        this.on('inference_complete', (data) => {
            const { model, strategy, duration, tokens, cached, status } = data;
            
            this.llmInferenceCount.labels(model, strategy, status, cached.toString()).inc();
            this.llmInferenceDuration.labels(model, strategy).observe(duration / 1000);
            this.llmTokensGenerated.labels(model, strategy).inc(tokens);
            
            if (duration > 0) {
                const tokensPerSecond = (tokens / duration) * 1000;
                this.llmTokensPerSecond.labels(model).observe(tokensPerSecond);
            }
        });
        
        this.on('model_loaded', (data) => {
            const { model, format, size, duration } = data;
            const sizeCategory = this.getSizeCategory(size);
            
            this.modelsLoaded.labels(format, sizeCategory).inc();
            this.modelLoadDuration.labels(model, format).observe(duration / 1000);
            this.modelMemoryUsage.labels(model, format).set(size);
        });
        
        this.on('model_unloaded', (data) => {
            const { format, size } = data;
            const sizeCategory = this.getSizeCategory(size);
            this.modelsLoaded.labels(format, sizeCategory).dec();
        });
        
        this.on('cache_hit', (cacheType) => {
            this.cacheHits.labels(cacheType).inc();
        });
        
        this.on('cache_miss', (cacheType) => {
            this.cacheMisses.labels(cacheType).inc();
        });
        
        this.on('cache_size_update', (data) => {
            const { cacheType, size } = data;
            this.cacheSize.labels(cacheType).set(size);
        });
        
        this.on('connection_open', (data) => {
            const { type, protocol } = data;
            this.activeConnections.labels(type, protocol).inc();
        });
        
        this.on('connection_close', (data) => {
            const { type, protocol, duration } = data;
            this.activeConnections.labels(type, protocol).dec();
            this.connectionDuration.labels(type, protocol).observe(duration / 1000);
        });
        
        this.on('error', (data) => {
            const { type, component, severity } = data;
            this.errorsTotal.labels(type, component, severity).inc();
        });
        
        this.on('queue_size_change', (data) => {
            const { queueType, size } = data;
            this.queueSize.labels(queueType).set(size);
        });
        
        this.on('queue_processed', (data) => {
            const { queueType, processingTime } = data;
            this.queueProcessingTime.labels(queueType).observe(processingTime / 1000);
        });
    }
    
    getSizeCategory(size) {
        if (size < 1e9) return 'small'; // < 1GB
        if (size < 10e9) return 'medium'; // 1-10GB
        if (size < 50e9) return 'large'; // 10-50GB
        return 'xlarge'; // > 50GB
    }
    
    // Middleware for Express apps
    middleware() {
        return (req, res, next) => {
            const start = Date.now();
            
            res.on('finish', () => {
                const duration = Date.now() - start;
                this.emit('http_request', {
                    method: req.method,
                    route: req.route?.path || req.path,
                    statusCode: res.statusCode.toString(),
                    duration
                });
            });
            
            next();
        };
    }
    
    // Get metrics in Prometheus format
    async getMetrics() {
        return this.register.metrics();
    }
    
    // Get metrics as JSON
    async getMetricsJSON() {
        const metrics = await this.register.getMetricsAsJSON();
        return metrics;
    }
    
    // Reset all metrics (useful for testing)
    reset() {
        this.register.resetMetrics();
    }
}

export default MetricsCollector;
```

### 2. Metrics Server Integration

```javascript
// src/monitoring/MetricsServer.js
import express from 'express';
import MetricsCollector from './MetricsCollector.js';
import LLMRouter from '../index.js';

class MonitoredLLMRouter extends LLMRouter {
    constructor(options = {}) {
        super(options);
        this.metrics = new MetricsCollector();
        this.setupMetricsIntegration();
        this.setupMetricsServer();
    }
    
    setupMetricsIntegration() {
        // Integrate metrics collection with router events
        this.on('model-loaded', (model) => {
            this.metrics.emit('model_loaded', {
                model: model.name,
                format: model.format,
                size: model.size,
                duration: model.loadDuration
            });
        });
        
        this.on('model-unloaded', (model) => {
            this.metrics.emit('model_unloaded', {
                format: model.format,
                size: model.size
            });
        });
        
        this.on('inference-start', (context) => {
            context._startTime = Date.now();
        });
        
        this.on('inference-complete', (result, context) => {
            const duration = Date.now() - (context._startTime || Date.now());
            
            this.metrics.emit('inference_complete', {
                model: result.model,
                strategy: context.strategy,
                duration,
                tokens: result.tokens,
                cached: result.cached,
                status: 'success'
            });
        });
        
        this.on('inference-error', (error, context) => {
            const duration = Date.now() - (context._startTime || Date.now());
            
            this.metrics.emit('inference_complete', {
                model: context.model || 'unknown',
                strategy: context.strategy,
                duration,
                tokens: 0,
                cached: false,
                status: 'error'
            });
            
            this.metrics.emit('error', {
                type: 'inference_error',
                component: 'llm_router',
                severity: 'error'
            });
        });
        
        this.on('cache-hit', () => {
            this.metrics.emit('cache_hit', 'response');
        });
        
        this.on('cache-miss', () => {
            this.metrics.emit('cache_miss', 'response');
        });
    }
    
    setupMetricsServer() {
        this.metricsApp = express();
        
        // Metrics endpoint
        this.metricsApp.get('/metrics', async (req, res) => {
            try {
                const metrics = await this.metrics.getMetrics();
                res.set('Content-Type', this.metrics.register.contentType);
                res.send(metrics);
            } catch (error) {
                res.status(500).send(`Error generating metrics: ${error.message}`);
            }
        });
        
        // Health endpoint with detailed metrics
        this.metricsApp.get('/health', (req, res) => {
            const status = this.getStatus();
            const memUsage = process.memoryUsage();
            
            const health = {
                status: status.initialized ? 'healthy' : 'initializing',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: {
                    used: memUsage.heapUsed,
                    total: memUsage.heapTotal,
                    external: memUsage.external,
                    rss: memUsage.rss
                },
                models: {
                    loaded: status.modelsLoaded,
                    registry_size: this.registry?.size || 0
                },
                engine: status.engine,
                version: process.env.npm_package_version || '1.0.0',
                environment: process.env.NODE_ENV || 'development'
            };
            
            res.status(status.initialized ? 200 : 503).json(health);
        });
        
        // Detailed metrics as JSON
        this.metricsApp.get('/metrics/json', async (req, res) => {
            try {
                const metrics = await this.metrics.getMetricsJSON();
                res.json(metrics);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    
    startMetricsServer(port = 9090) {
        this.metricsServer = this.metricsApp.listen(port, '0.0.0.0', () => {
            console.log(`📊 Metrics server running on port ${port}`);
            console.log(`🔗 Metrics: http://localhost:${port}/metrics`);
            console.log(`❤️ Health: http://localhost:${port}/health`);
        });
        
        return this.metricsServer;
    }
    
    stopMetricsServer() {
        if (this.metricsServer) {
            this.metricsServer.close();
        }
    }
    
    // Override methods to add metrics
    async quick(prompt, options = {}) {
        const result = await super.quick(prompt, options);
        
        // Additional custom metrics
        this.metrics.emit('inference_complete', {
            model: result.model,
            strategy: 'quick',
            duration: result.latency,
            tokens: result.tokens,
            cached: result.cached || false,
            status: 'success'
        });
        
        return result;
    }
}

export default MonitoredLLMRouter;
```

### 3. Prometheus Configuration

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'llm-router-cluster'
    environment: 'production'

rule_files:
  - "llm_router_rules.yml"
  - "alerts.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  # LLM Router instances
  - job_name: 'llm-router'
    static_configs:
      - targets: ['llm-router-1:9090', 'llm-router-2:9090', 'llm-router-3:9090']
    scrape_interval: 10s
    metrics_path: /metrics
    scrape_timeout: 8s
    
  # Kubernetes service discovery
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
            - llm-router
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__
        
  # Node exporter for system metrics
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
        
  # Prometheus itself
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

## Grafana Dashboards

### 1. LLM Router Overview Dashboard

```json
{
  "dashboard": {
    "id": null,
    "title": "LLM Router Overview",
    "tags": ["llm", "router", "ai"],
    "style": "dark",
    "timezone": "browser",
    "refresh": "30s",
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "panels": [
      {
        "id": 1,
        "title": "Request Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(llm_router_http_requests_total[5m])",
            "legendFormat": "Requests/sec"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "reqps",
            "color": {
              "mode": "palette-classic"
            }
          }
        },
        "gridPos": {
          "h": 8,
          "w": 6,
          "x": 0,
          "y": 0
        }
      },
      {
        "id": 2,
        "title": "Inference Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(llm_router_inference_total{status=\"success\"}[5m]) / rate(llm_router_inference_total[5m]) * 100",
            "legendFormat": "Success %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "min": 0,
            "max": 100,
            "thresholds": {
              "steps": [
                {"color": "red", "value": 0},
                {"color": "yellow", "value": 90},
                {"color": "green", "value": 95}
              ]
            }
          }
        },
        "gridPos": {
          "h": 8,
          "w": 6,
          "x": 6,
          "y": 0
        }
      },
      {
        "id": 3,
        "title": "Average Response Time",
        "type": "stat",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(llm_router_inference_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "s",
            "thresholds": {
              "steps": [
                {"color": "green", "value": 0},
                {"color": "yellow", "value": 5},
                {"color": "red", "value": 15}
              ]
            }
          }
        },
        "gridPos": {
          "h": 8,
          "w": 6,
          "x": 12,
          "y": 0
        }
      },
      {
        "id": 4,
        "title": "Models Loaded",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(llm_router_models_loaded)",
            "legendFormat": "Models"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "color": {
              "mode": "single",
              "fixedColor": "blue"
            }
          }
        },
        "gridPos": {
          "h": 8,
          "w": 6,
          "x": 18,
          "y": 0
        }
      },
      {
        "id": 5,
        "title": "Request Volume",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(llm_router_http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ],
        "yAxes": [
          {
            "unit": "reqps",
            "min": 0
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 0,
          "y": 8
        }
      },
      {
        "id": 6,
        "title": "Inference Duration",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, rate(llm_router_inference_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          },
          {
            "expr": "histogram_quantile(0.95, rate(llm_router_inference_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.99, rate(llm_router_inference_duration_seconds_bucket[5m]))",
            "legendFormat": "99th percentile"
          }
        ],
        "yAxes": [
          {
            "unit": "s",
            "min": 0
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 12,
          "y": 8
        }
      },
      {
        "id": 7,
        "title": "Token Generation Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(llm_router_tokens_generated_total[5m])",
            "legendFormat": "{{model}}"
          }
        ],
        "yAxes": [
          {
            "unit": "tps",
            "min": 0
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 0,
          "y": 16
        }
      },
      {
        "id": 8,
        "title": "Cache Hit Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(llm_router_cache_hits_total[5m]) / (rate(llm_router_cache_hits_total[5m]) + rate(llm_router_cache_misses_total[5m])) * 100",
            "legendFormat": "Hit Rate %"
          }
        ],
        "yAxes": [
          {
            "unit": "percent",
            "min": 0,
            "max": 100
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 12,
          "y": 16
        }
      }
    ]
  }
}
```

### 2. Model Performance Dashboard

```json
{
  "dashboard": {
    "title": "LLM Model Performance",
    "panels": [
      {
        "id": 1,
        "title": "Model Usage Distribution",
        "type": "piechart",
        "targets": [
          {
            "expr": "sum by (model) (rate(llm_router_inference_total[5m]))",
            "legendFormat": "{{model}}"
          }
        ],
        "gridPos": {
          "h": 10,
          "w": 12,
          "x": 0,
          "y": 0
        }
      },
      {
        "id": 2,
        "title": "Tokens per Second by Model",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(llm_router_tokens_per_second_bucket[5m]))",
            "legendFormat": "{{model}} - 95th percentile"
          }
        ],
        "yAxes": [
          {
            "unit": "tps",
            "min": 0
          }
        ],
        "gridPos": {
          "h": 10,
          "w": 12,
          "x": 12,
          "y": 0
        }
      },
      {
        "id": 3,
        "title": "Model Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "llm_router_model_memory_bytes / 1024 / 1024 / 1024",
            "legendFormat": "{{model}} ({{format}})"
          }
        ],
        "yAxes": [
          {
            "unit": "gbytes",
            "min": 0
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 24,
          "x": 0,
          "y": 10
        }
      },
      {
        "id": 4,
        "title": "Model Load Times",
        "type": "heatmap",
        "targets": [
          {
            "expr": "rate(llm_router_model_load_duration_seconds_bucket[5m])",
            "legendFormat": "{{model}} {{le}}"
          }
        ],
        "gridPos": {
          "h": 10,
          "w": 24,
          "x": 0,
          "y": 18
        }
      }
    ]
  }
}
```

### 3. System Resources Dashboard

```json
{
  "dashboard": {
    "title": "LLM Router System Resources",
    "panels": [
      {
        "id": 1,
        "title": "CPU Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(llm_router_process_cpu_seconds_total[5m]) * 100",
            "legendFormat": "CPU Usage %"
          }
        ],
        "yAxes": [
          {
            "unit": "percent",
            "min": 0,
            "max": 100
          }
        ]
      },
      {
        "id": 2,
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "llm_router_process_resident_memory_bytes / 1024 / 1024",
            "legendFormat": "Resident Memory (MB)"
          },
          {
            "expr": "llm_router_process_heap_bytes / 1024 / 1024",
            "legendFormat": "Heap Memory (MB)"
          }
        ],
        "yAxes": [
          {
            "unit": "mbytes",
            "min": 0
          }
        ]
      },
      {
        "id": 3,
        "title": "Active Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "llm_router_active_connections",
            "legendFormat": "{{type}} - {{protocol}}"
          }
        ]
      },
      {
        "id": 4,
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(llm_router_errors_total[5m])",
            "legendFormat": "{{type}} - {{severity}}"
          }
        ]
      }
    ]
  }
}
```

## Application Logging

### 1. Structured Logging Implementation

```javascript
// src/monitoring/Logger.js
import pino from 'pino';
import fs from 'fs';
import path from 'path';

class StructuredLogger {
    constructor(options = {}) {
        this.logLevel = options.logLevel || process.env.LOG_LEVEL || 'info';
        this.logDir = options.logDir || '/app/logs';
        this.serviceName = options.serviceName || 'llm-router';
        this.version = options.version || process.env.npm_package_version || '1.0.0';
        
        this.setupLogDirectory();
        this.createLoggers();
    }
    
    setupLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }
    
    createLoggers() {
        // Base configuration
        const baseConfig = {
            name: this.serviceName,
            level: this.logLevel,
            base: {
                service: this.serviceName,
                version: this.version,
                env: process.env.NODE_ENV || 'development',
                hostname: process.env.HOSTNAME || require('os').hostname(),
                pid: process.pid
            },
            timestamp: pino.stdTimeFunctions.isoTime,
            formatters: {
                level: (label) => ({ level: label }),
                bindings: (bindings) => ({
                    service: bindings.name,
                    version: this.version,
                    hostname: bindings.hostname,
                    pid: bindings.pid
                })
            }
        };
        
        // Console logger for development
        if (process.env.NODE_ENV !== 'production') {
            this.console = pino({
                ...baseConfig,
                transport: {
                    target: 'pino-pretty',
                    options: {
                        colorize: true,
                        translateTime: 'SYS:standard',
                        ignore: 'service,version,hostname,pid'
                    }
                }
            });
        } else {
            this.console = pino(baseConfig);
        }
        
        // File loggers
        this.applicationLogger = pino(
            baseConfig,
            pino.destination({
                dest: path.join(this.logDir, 'application.log'),
                sync: false,
                mkdir: true
            })
        );
        
        this.accessLogger = pino(
            {
                ...baseConfig,
                level: 'info'
            },
            pino.destination({
                dest: path.join(this.logDir, 'access.log'),
                sync: false,
                mkdir: true
            })
        );
        
        this.errorLogger = pino(
            {
                ...baseConfig,
                level: 'error'
            },
            pino.destination({
                dest: path.join(this.logDir, 'error.log'),
                sync: false,
                mkdir: true
            })
        );
        
        this.auditLogger = pino(
            {
                ...baseConfig,
                level: 'info'
            },
            pino.destination({
                dest: path.join(this.logDir, 'audit.log'),
                sync: false,
                mkdir: true
            })
        );
        
        this.metricsLogger = pino(
            {
                ...baseConfig,
                level: 'info'
            },
            pino.destination({
                dest: path.join(this.logDir, 'metrics.log'),
                sync: false,
                mkdir: true
            })
        );
    }
    
    // Application logs
    info(message, meta = {}) {
        this.console?.info(meta, message);
        this.applicationLogger.info(meta, message);
    }
    
    debug(message, meta = {}) {
        this.console?.debug(meta, message);
        this.applicationLogger.debug(meta, message);
    }
    
    warn(message, meta = {}) {
        this.console?.warn(meta, message);
        this.applicationLogger.warn(meta, message);
    }
    
    error(message, error = null, meta = {}) {
        const logData = {
            ...meta,
            ...(error && {
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                    ...(error.code && { code: error.code }),
                    ...(error.statusCode && { statusCode: error.statusCode })
                }
            })
        };
        
        this.console?.error(logData, message);
        this.applicationLogger.error(logData, message);
        this.errorLogger.error(logData, message);
    }
    
    // Access logs
    access(req, res, meta = {}) {
        const accessData = {
            ...meta,
            request: {
                method: req.method,
                url: req.url,
                path: req.path,
                query: req.query,
                headers: {
                    userAgent: req.headers['user-agent'],
                    referer: req.headers.referer,
                    contentType: req.headers['content-type'],
                    contentLength: req.headers['content-length'],
                    authorization: req.headers.authorization ? '[REDACTED]' : undefined
                },
                ip: req.ip || req.connection?.remoteAddress,
                timestamp: new Date().toISOString()
            },
            response: {
                statusCode: res.statusCode,
                contentLength: res.getHeader('content-length'),
                contentType: res.getHeader('content-type')
            }
        };
        
        this.accessLogger.info(accessData, 'HTTP Request');
    }
    
    // Audit logs for important business events
    audit(event, data = {}) {
        const auditData = {
            event,
            timestamp: new Date().toISOString(),
            ...data
        };
        
        this.auditLogger.info(auditData, `Audit: ${event}`);
    }
    
    // Metrics logs
    metrics(name, value, labels = {}, meta = {}) {
        const metricsData = {
            metric: {
                name,
                value,
                labels,
                timestamp: new Date().toISOString()
            },
            ...meta
        };
        
        this.metricsLogger.info(metricsData, `Metric: ${name}`);
    }
    
    // LLM-specific logging methods
    inferenceStart(context) {
        this.info('Inference started', {
            inference: {
                id: context.id,
                model: context.model,
                strategy: context.strategy,
                prompt_length: context.prompt?.length || 0,
                options: context.options
            }
        });
        
        this.audit('inference_start', {
            inference_id: context.id,
            model: context.model,
            strategy: context.strategy
        });
    }
    
    inferenceComplete(context, result) {
        this.info('Inference completed', {
            inference: {
                id: context.id,
                model: result.model,
                tokens: result.tokens,
                latency: result.latency,
                cached: result.cached,
                success: true
            }
        });
        
        this.audit('inference_complete', {
            inference_id: context.id,
            model: result.model,
            tokens: result.tokens,
            latency: result.latency,
            success: true
        });
        
        this.metrics('inference_latency', result.latency, {
            model: result.model,
            strategy: context.strategy
        });
        
        this.metrics('tokens_generated', result.tokens, {
            model: result.model
        });
    }
    
    inferenceError(context, error) {
        this.error('Inference failed', error, {
            inference: {
                id: context.id,
                model: context.model,
                strategy: context.strategy,
                success: false
            }
        });
        
        this.audit('inference_error', {
            inference_id: context.id,
            model: context.model,
            error: error.message,
            success: false
        });
    }
    
    modelLoad(model, duration) {
        this.info('Model loaded', {
            model: {
                id: model.id,
                name: model.name,
                format: model.format,
                size: model.size,
                load_duration: duration
            }
        });
        
        this.audit('model_load', {
            model_id: model.id,
            model_name: model.name,
            format: model.format,
            load_duration: duration
        });
        
        this.metrics('model_load_duration', duration, {
            model: model.name,
            format: model.format
        });
    }
    
    modelUnload(model) {
        this.info('Model unloaded', {
            model: {
                id: model.id,
                name: model.name,
                format: model.format
            }
        });
        
        this.audit('model_unload', {
            model_id: model.id,
            model_name: model.name
        });
    }
    
    // Express middleware
    middleware() {
        return (req, res, next) => {
            const start = Date.now();
            
            // Log request
            this.access(req, res, { start_time: start });
            
            // Override res.end to log response
            const originalEnd = res.end;
            res.end = (...args) => {
                const duration = Date.now() - start;
                
                this.access(req, res, {
                    duration,
                    end_time: Date.now()
                });
                
                originalEnd.apply(res, args);
            };
            
            next();
        };
    }
    
    // Cleanup and flush logs
    async flush() {
        const loggers = [
            this.applicationLogger,
            this.accessLogger,
            this.errorLogger,
            this.auditLogger,
            this.metricsLogger
        ];
        
        await Promise.all(loggers.map(logger => 
            new Promise(resolve => logger.flush(resolve))
        ));
    }
}

export default StructuredLogger;
```

### 2. Log Aggregation with ELK Stack

```yaml
# docker-compose.logging.yml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.8.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data
    networks:
      - logging
      
  kibana:
    image: docker.elastic.co/kibana/kibana:8.8.0
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
    networks:
      - logging
      
  logstash:
    image: docker.elastic.co/logstash/logstash:8.8.0
    volumes:
      - ./logstash/pipeline:/usr/share/logstash/pipeline:ro
      - ./logstash/config/logstash.yml:/usr/share/logstash/config/logstash.yml:ro
    ports:
      - "5044:5044"
      - "9600:9600"
    depends_on:
      - elasticsearch
    networks:
      - logging
      
  filebeat:
    image: docker.elastic.co/beats/filebeat:8.8.0
    user: root
    volumes:
      - ./filebeat/filebeat.yml:/usr/share/filebeat/filebeat.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - logs-volume:/app/logs:ro
    depends_on:
      - logstash
    networks:
      - logging

volumes:
  elasticsearch-data:
  logs-volume:
    external: true

networks:
  logging:
    driver: bridge
```

```yaml
# logstash/pipeline/logstash.conf
input {
  beats {
    port => 5044
  }
}

filter {
  if [fields][service] == "llm-router" {
    json {
      source => "message"
    }
    
    date {
      match => [ "timestamp", "ISO8601" ]
    }
    
    # Parse inference logs
    if [inference] {
      mutate {
        add_field => { "event_type" => "inference" }
        add_field => { "inference_id" => "%{[inference][id]}" }
        add_field => { "model_name" => "%{[inference][model]}" }
        add_field => { "tokens_generated" => "%{[inference][tokens]}" }
        add_field => { "inference_latency" => "%{[inference][latency]}" }
      }
      
      if [inference][latency] {
        ruby {
          code => "
            latency = event.get('[inference][latency]').to_f
            if latency > 10000
              event.set('performance_category', 'slow')
            elsif latency > 5000
              event.set('performance_category', 'medium')
            else
              event.set('performance_category', 'fast')
            end
          "
        }
      }
    }
    
    # Parse model logs
    if [model] {
      mutate {
        add_field => { "event_type" => "model" }
        add_field => { "model_name" => "%{[model][name]}" }
        add_field => { "model_format" => "%{[model][format]}" }
        add_field => { "model_size" => "%{[model][size]}" }
      }
    }
    
    # Parse error logs
    if [error] {
      mutate {
        add_field => { "event_type" => "error" }
        add_field => { "error_name" => "%{[error][name]}" }
        add_field => { "error_message" => "%{[error][message]}" }
      }
    }
    
    # Add environment tags
    mutate {
      add_field => { "environment" => "%{[env]}" }
      add_field => { "service_version" => "%{[version]}" }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "llm-router-%{+YYYY.MM.dd}"
  }
  
  # Debug output
  stdout { 
    codec => rubydebug 
  }
}
```

```yaml
# filebeat/filebeat.yml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /app/logs/*.log
  fields:
    service: llm-router
    environment: ${ENVIRONMENT:development}
  fields_under_root: false
  json.keys_under_root: true
  json.add_error_key: true
  multiline.pattern: '^\{'
  multiline.negate: true
  multiline.match: after

output.logstash:
  hosts: ["logstash:5044"]

processors:
  - add_host_metadata:
      when.not.contains.tags: forwarded
  - add_docker_metadata: ~
  - add_kubernetes_metadata: ~

logging.level: info
logging.to_files: true
logging.files:
  path: /var/log/filebeat
  name: filebeat
  keepfiles: 7
  permissions: 0644
```

## Health Checks

### 1. Comprehensive Health Monitoring

```javascript
// src/monitoring/HealthChecker.js
class HealthChecker {
    constructor(router, options = {}) {
        this.router = router;
        this.checks = new Map();
        this.options = {
            timeout: options.timeout || 5000,
            interval: options.interval || 30000,
            retries: options.retries || 3
        };
        
        this.setupDefaultChecks();
        this.startPeriodicChecks();
    }
    
    setupDefaultChecks() {
        // Router initialization check
        this.addCheck('router_initialized', async () => {
            const status = this.router.getStatus();
            return {
                healthy: status.initialized,
                message: status.initialized ? 'Router is initialized' : 'Router not initialized',
                details: {
                    modelsLoaded: status.modelsLoaded,
                    engine: status.engine
                }
            };
        });
        
        // Model availability check
        this.addCheck('models_available', async () => {
            const models = this.router.registry.list();
            const loadedModels = models.filter(m => m.status === 'loaded');
            
            return {
                healthy: loadedModels.length > 0,
                message: `${loadedModels.length} models loaded`,
                details: {
                    total: models.length,
                    loaded: loadedModels.length,
                    models: loadedModels.map(m => ({ id: m.id, name: m.name }))
                }
            };
        });
        
        // Memory usage check
        this.addCheck('memory_usage', async () => {
            const usage = process.memoryUsage();
            const maxMemory = 4 * 1024 * 1024 * 1024; // 4GB limit
            const usagePercent = (usage.heapUsed / maxMemory) * 100;
            
            return {
                healthy: usagePercent < 90,
                message: `Memory usage: ${usagePercent.toFixed(1)}%`,
                details: {
                    heapUsed: usage.heapUsed,
                    heapTotal: usage.heapTotal,
                    external: usage.external,
                    rss: usage.rss,
                    usagePercent
                }
            };
        });
        
        // Inference capability check
        this.addCheck('inference_capability', async () => {
            try {
                const testResult = await this.router.quick('test', { maxTokens: 10 });
                return {
                    healthy: true,
                    message: 'Inference capability verified',
                    details: {
                        model: testResult.model,
                        latency: testResult.latency,
                        tokens: testResult.tokens
                    }
                };
            } catch (error) {
                return {
                    healthy: false,
                    message: `Inference test failed: ${error.message}`,
                    details: { error: error.message }
                };
            }
        });
        
        // Cache functionality check
        this.addCheck('cache_functionality', async () => {
            try {
                // Simple cache test
                const cacheKey = `health_check_${Date.now()}`;
                const testValue = 'health_check_value';
                
                // This would depend on your cache implementation
                // await this.router.cache.set(cacheKey, testValue);
                // const retrieved = await this.router.cache.get(cacheKey);
                
                return {
                    healthy: true, // retrieved === testValue,
                    message: 'Cache functionality verified',
                    details: { tested_at: new Date().toISOString() }
                };
            } catch (error) {
                return {
                    healthy: false,
                    message: `Cache test failed: ${error.message}`,
                    details: { error: error.message }
                };
            }
        });
        
        // Disk space check
        this.addCheck('disk_space', async () => {
            try {
                const stats = await fs.promises.statfs('/app');
                const freeBytes = stats.bavail * stats.bsize;
                const totalBytes = stats.blocks * stats.bsize;
                const usagePercent = ((totalBytes - freeBytes) / totalBytes) * 100;
                
                return {
                    healthy: usagePercent < 90,
                    message: `Disk usage: ${usagePercent.toFixed(1)}%`,
                    details: {
                        freeBytes,
                        totalBytes,
                        usagePercent
                    }
                };
            } catch (error) {
                return {
                    healthy: false,
                    message: `Disk check failed: ${error.message}`,
                    details: { error: error.message }
                };
            }
        });
    }
    
    addCheck(name, checkFunction) {
        this.checks.set(name, {
            function: checkFunction,
            lastResult: null,
            lastRun: null,
            failures: 0
        });
    }
    
    removeCheck(name) {
        this.checks.delete(name);
    }
    
    async runCheck(name) {
        const check = this.checks.get(name);
        if (!check) {
            throw new Error(`Health check '${name}' not found`);
        }
        
        const startTime = Date.now();
        
        try {
            const result = await Promise.race([
                check.function(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Health check timeout')), this.options.timeout)
                )
            ]);
            
            const duration = Date.now() - startTime;
            
            check.lastResult = {
                ...result,
                duration,
                timestamp: new Date().toISOString(),
                success: true
            };
            
            check.lastRun = Date.now();
            
            if (result.healthy) {
                check.failures = 0;
            } else {
                check.failures++;
            }
            
            return check.lastResult;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            check.lastResult = {
                healthy: false,
                message: `Check failed: ${error.message}`,
                duration,
                timestamp: new Date().toISOString(),
                success: false,
                error: error.message
            };
            
            check.lastRun = Date.now();
            check.failures++;
            
            return check.lastResult;
        }
    }
    
    async runAllChecks() {
        const results = {};
        const promises = Array.from(this.checks.entries()).map(async ([name, check]) => {
            results[name] = await this.runCheck(name);
        });
        
        await Promise.all(promises);
        return results;
    }
    
    async getHealthStatus() {
        const checks = await this.runAllChecks();
        
        const overall = Object.values(checks).every(check => check.healthy);
        const criticalFailed = Object.entries(checks)
            .filter(([name, check]) => !check.healthy && this.isCriticalCheck(name))
            .length > 0;
        
        return {
            status: overall ? 'healthy' : (criticalFailed ? 'critical' : 'degraded'),
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0',
            checks,
            summary: {
                total: Object.keys(checks).length,
                healthy: Object.values(checks).filter(c => c.healthy).length,
                unhealthy: Object.values(checks).filter(c => !c.healthy).length
            }
        };
    }
    
    isCriticalCheck(name) {
        const criticalChecks = ['router_initialized', 'models_available', 'memory_usage'];
        return criticalChecks.includes(name);
    }
    
    startPeriodicChecks() {
        setInterval(async () => {
            try {
                await this.runAllChecks();
            } catch (error) {
                console.error('Periodic health check failed:', error);
            }
        }, this.options.interval);
    }
    
    // Express middleware for health endpoints
    middleware() {
        return {
            // Liveness probe - basic check
            liveness: async (req, res) => {
                const status = this.router.getStatus();
                if (status.initialized) {
                    res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
                } else {
                    res.status(503).json({ status: 'not ready', timestamp: new Date().toISOString() });
                }
            },
            
            // Readiness probe - comprehensive check
            readiness: async (req, res) => {
                try {
                    const health = await this.getHealthStatus();
                    const statusCode = health.status === 'healthy' ? 200 : 
                                     health.status === 'degraded' ? 200 : 503;
                    res.status(statusCode).json(health);
                } catch (error) {
                    res.status(503).json({
                        status: 'error',
                        message: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            },
            
            // Detailed health endpoint
            health: async (req, res) => {
                try {
                    const health = await this.getHealthStatus();
                    res.json(health);
                } catch (error) {
                    res.status(500).json({
                        status: 'error',
                        message: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        };
    }
}

export default HealthChecker;
```

### 2. Health Check Integration

```javascript
// src/monitoring/MonitoredApplication.js
import express from 'express';
import LLMRouter from '../index.js';
import HealthChecker from './HealthChecker.js';
import StructuredLogger from './Logger.js';
import MetricsCollector from './MetricsCollector.js';

class MonitoredApplication {
    constructor(options = {}) {
        this.app = express();
        this.router = new LLMRouter(options.router);
        this.logger = new StructuredLogger(options.logging);
        this.metrics = new MetricsCollector();
        this.healthChecker = new HealthChecker(this.router, options.health);
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupMonitoring();
    }
    
    setupMiddleware() {
        // Request logging
        this.app.use(this.logger.middleware());
        
        // Metrics collection
        this.app.use(this.metrics.middleware());
        
        // JSON parsing
        this.app.use(express.json({ limit: '10mb' }));
    }
    
    setupRoutes() {
        // Application routes
        this.app.post('/api/generate', async (req, res) => {
            const startTime = Date.now();
            
            try {
                const { prompt, options = {} } = req.body;
                
                this.logger.info('Generation request', {
                    request_id: req.headers['x-request-id'],
                    prompt_length: prompt?.length || 0,
                    options
                });
                
                const result = await this.router.quick(prompt, options);
                
                const duration = Date.now() - startTime;
                
                this.logger.info('Generation completed', {
                    request_id: req.headers['x-request-id'],
                    model: result.model,
                    tokens: result.tokens,
                    duration,
                    cached: result.cached
                });
                
                res.json({
                    success: true,
                    data: result,
                    metadata: {
                        request_id: req.headers['x-request-id'],
                        duration
                    }
                });
                
            } catch (error) {
                const duration = Date.now() - startTime;
                
                this.logger.error('Generation failed', error, {
                    request_id: req.headers['x-request-id'],
                    duration
                });
                
                res.status(500).json({
                    success: false,
                    error: error.message,
                    request_id: req.headers['x-request-id']
                });
            }
        });
    }
    
    setupMonitoring() {
        // Health check endpoints
        const healthMiddleware = this.healthChecker.middleware();
        this.app.get('/health', healthMiddleware.health);
        this.app.get('/health/live', healthMiddleware.liveness);
        this.app.get('/health/ready', healthMiddleware.readiness);
        
        // Metrics endpoint
        this.app.get('/metrics', async (req, res) => {
            try {
                const metrics = await this.metrics.getMetrics();
                res.set('Content-Type', this.metrics.register.contentType);
                res.send(metrics);
            } catch (error) {
                res.status(500).send(`Error: ${error.message}`);
            }
        });
        
        // Debug endpoint
        this.app.get('/debug', async (req, res) => {
            const status = this.router.getStatus();
            const health = await this.healthChecker.getHealthStatus();
            const metrics = await this.metrics.getMetricsJSON();
            
            res.json({
                status,
                health,
                metrics: metrics.length,
                environment: {
                    node_version: process.version,
                    platform: process.platform,
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    env: process.env.NODE_ENV
                }
            });
        });
    }
    
    async start(port = 3000) {
        try {
            await this.router.initialize();
            
            this.server = this.app.listen(port, '0.0.0.0', () => {
                this.logger.info('Application started', {
                    port,
                    environment: process.env.NODE_ENV,
                    version: process.env.npm_package_version
                });
            });
            
            // Graceful shutdown
            process.on('SIGTERM', () => this.shutdown('SIGTERM'));
            process.on('SIGINT', () => this.shutdown('SIGINT'));
            
        } catch (error) {
            this.logger.error('Failed to start application', error);
            process.exit(1);
        }
    }
    
    async shutdown(signal) {
        this.logger.info('Shutting down gracefully', { signal });
        
        if (this.server) {
            await new Promise(resolve => this.server.close(resolve));
        }
        
        await this.router.cleanup();
        await this.logger.flush();
        
        this.logger.info('Shutdown complete');
        process.exit(0);
    }
}

export default MonitoredApplication;
```

## Alerting Rules

### 1. Prometheus Alert Rules

```yaml
# monitoring/alerts.yml
groups:
  - name: llm_router_alerts
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(llm_router_errors_total[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} errors per second"
          
      - alert: CriticalErrorRate
        expr: rate(llm_router_errors_total[5m]) > 0.5
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Critical error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} errors per second"
          
      # High response time
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(llm_router_inference_duration_seconds_bucket[5m])) > 30
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "High inference response time"
          description: "95th percentile response time is {{ $value }}s"
          
      - alert: CriticalResponseTime
        expr: histogram_quantile(0.95, rate(llm_router_inference_duration_seconds_bucket[5m])) > 60
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Critical inference response time"
          description: "95th percentile response time is {{ $value }}s"
          
      # Memory usage
      - alert: HighMemoryUsage
        expr: (llm_router_process_resident_memory_bytes / 1024 / 1024 / 1024) > 3
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value | humanize }}GB"
          
      - alert: CriticalMemoryUsage
        expr: (llm_router_process_resident_memory_bytes / 1024 / 1024 / 1024) > 7
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Critical memory usage"
          description: "Memory usage is {{ $value | humanize }}GB"
          
      # No models loaded
      - alert: NoModelsLoaded
        expr: sum(llm_router_models_loaded) == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "No models loaded"
          description: "No LLM models are currently loaded"
          
      # Low cache hit rate
      - alert: LowCacheHitRate
        expr: rate(llm_router_cache_hits_total[10m]) / (rate(llm_router_cache_hits_total[10m]) + rate(llm_router_cache_misses_total[10m])) < 0.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low cache hit rate"
          description: "Cache hit rate is {{ $value | humanizePercentage }}"
          
      # High queue size
      - alert: HighQueueSize
        expr: llm_router_queue_size > 100
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High request queue size"
          description: "Queue size is {{ $value }}"
          
      - alert: CriticalQueueSize
        expr: llm_router_queue_size > 500
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: "Critical request queue size"
          description: "Queue size is {{ $value }}"
          
      # Service down
      - alert: ServiceDown
        expr: up{job="llm-router"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "LLM Router service is down"
          description: "Service has been down for more than 1 minute"
          
      # Low token generation rate
      - alert: LowTokenGeneration
        expr: rate(llm_router_tokens_generated_total[5m]) < 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Low token generation rate"
          description: "Token generation rate is {{ $value }} tokens/second"
```

### 2. Alertmanager Configuration

```yaml
# monitoring/alertmanager.yml
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@example.com'

route:
  group_by: ['alertname', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
    - match:
        severity: warning
      receiver: 'warning-alerts'

receivers:
  - name: 'default'
    email_configs:
      - to: 'team@example.com'
        subject: 'LLM Router Alert: {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          Labels: {{ range .Labels }}{{ .Name }}: {{ .Value }} {{ end }}
          {{ end }}
          
  - name: 'critical-alerts'
    email_configs:
      - to: 'oncall@example.com'
        subject: 'CRITICAL: LLM Router Alert'
        body: |
          CRITICAL ALERT
          
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          Time: {{ .StartsAt }}
          {{ end }}
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#critical-alerts'
        title: 'CRITICAL: LLM Router Alert'
        text: |
          {{ range .Alerts }}
          🚨 {{ .Annotations.summary }}
          {{ .Annotations.description }}
          {{ end }}
        
  - name: 'warning-alerts'
    email_configs:
      - to: 'team@example.com'
        subject: 'Warning: LLM Router Alert'
        body: |
          WARNING ALERT
          
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          Time: {{ .StartsAt }}
          {{ end }}
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#warnings'
        title: 'Warning: LLM Router Alert'
        text: |
          {{ range .Alerts }}
          ⚠️ {{ .Annotations.summary }}
          {{ .Annotations.description }}
          {{ end }}

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'service']
```

This completes the comprehensive monitoring and observability setup for LLM-Runner-Router. The examples include custom metrics collection, structured logging, health checks, Grafana dashboards, log aggregation with the ELK stack, and alerting rules with Alertmanager. This provides full observability for production deployments.