# Production Monitoring Guide

## Overview

The LLM Runner Router includes a comprehensive monitoring system for production deployments, providing observability, alerting, and performance tracking.

## Monitoring Components

### 1. Metrics Collection (Prometheus)
- **Request metrics**: Response times, request counts, error rates
- **Model metrics**: Inference latencies, token generation rates, model usage
- **System metrics**: CPU, memory, disk usage
- **Custom metrics**: Business-specific metrics

**Endpoint**: `GET /metrics` (Prometheus format)

### 2. Health Monitoring
- **System health**: CPU, memory, disk usage checks
- **Application health**: Database connectivity, model availability
- **Network health**: External service connectivity
- **Custom health checks**: Model-specific health validation

**Endpoint**: `GET /health`

### 3. Alerting System
- **Threshold-based alerts**: CPU usage, error rates, response times
- **Smart alerting**: Machine learning-based anomaly detection
- **Multi-channel notifications**: Webhook, Slack, email
- **Alert correlation**: Related alert grouping and deduplication

### 4. Performance Profiling (Optional)
- **Runtime profiling**: CPU and memory profiling
- **Request tracing**: End-to-end request flow analysis
- **Model performance**: Detailed inference performance tracking

## Configuration

### Environment Variables

```bash
# Enable/disable monitoring
MONITORING_ENABLED=true

# Component-specific toggles
PROMETHEUS_ENABLED=true
HEALTH_CHECK_ENABLED=true
ALERTING_ENABLED=true
PROFILER_ENABLED=false  # CPU intensive, use carefully

# Monitoring endpoints
METRICS_ENDPOINT=/metrics
HEALTH_ENDPOINT=/health

# Alerting configuration
ALERT_WEBHOOK_URL=https://hooks.slack.com/your-webhook
SLACK_WEBHOOK_URL=https://hooks.slack.com/your-webhook
EMAIL_ALERTS_ENABLED=false
```

### Monitoring Configuration

The monitoring system can be configured programmatically:

```javascript
import MonitoringSystem from './src/monitoring/index.js';

const monitoring = new MonitoringSystem({
  enabled: true,
  components: {
    prometheus: true,
    health: true,
    alerting: true,
    profiler: false
  },
  integrations: {
    metricsToAlerting: true,
    healthToAlerting: true
  }
});

await monitoring.start();
```

## Production Setup

### 1. Prometheus Integration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'llm-router'
    static_configs:
      - targets: ['llmrouter.dev:3006']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### 2. Grafana Dashboard

Import the provided Grafana dashboard for LLM Router metrics:
- **Dashboard ID**: (to be created)
- **Metrics**: Request rates, error rates, model performance, system resources

### 3. Alert Manager

Example alert rules:

```yaml
groups:
  - name: llm-router
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
          
      - alert: ModelInferenceLatency
        expr: histogram_quantile(0.95, rate(model_inference_duration_seconds_bucket[5m])) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Model inference latency is high
```

## Monitoring Endpoints

### Health Check (`GET /health`)

Returns comprehensive health status:

```json
{
  "status": "healthy",
  "timestamp": "2025-09-06T01:00:00Z",
  "uptime": 3600,
  "version": "2.0.0",
  "checks": {
    "cpu_usage": { "status": "healthy", "value": 45.2, "threshold": 80 },
    "memory_usage": { "status": "healthy", "value": 62.1, "threshold": 85 },
    "disk_usage": { "status": "healthy", "value": 34.8, "threshold": 90 },
    "models": { "status": "healthy", "loaded": 3, "failed": 0 }
  }
}
```

### Metrics (`GET /metrics`)

Prometheus-format metrics including:

```
# Request metrics
http_requests_total{method="POST",status="200"} 1234
http_request_duration_seconds{quantile="0.95"} 0.245

# Model metrics  
model_inference_total{model="smollm3-3b"} 856
model_inference_duration_seconds{model="smollm3-3b",quantile="0.95"} 2.1
model_tokens_generated_total{model="smollm3-3b"} 45123

# System metrics
system_cpu_usage_percent 45.2
system_memory_usage_bytes 8589934592
```

## Alert Configuration

### Webhook Alerts

Configure webhook URL for alert notifications:

```bash
ALERT_WEBHOOK_URL=https://your-webhook-endpoint.com/alerts
```

Webhook payload format:
```json
{
  "alert": "HighErrorRate",
  "severity": "critical", 
  "message": "Error rate exceeded 10% for 2 minutes",
  "timestamp": "2025-09-06T01:00:00Z",
  "metadata": {
    "current_value": 0.15,
    "threshold": 0.1
  }
}
```

### Slack Integration

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

### Custom Alert Rules

Add custom alert rules programmatically:

```javascript
monitoring.alerting.addRule({
  name: 'custom_metric_alert',
  condition: (metrics) => metrics.custom_value > threshold,
  severity: 'warning',
  message: 'Custom metric exceeded threshold'
});
```

## Best Practices

### 1. Production Deployment
- Enable all monitoring components
- Configure external Prometheus/Grafana
- Set up proper alert routing
- Monitor disk space for metrics storage

### 2. Performance Considerations
- Disable profiler unless debugging
- Use appropriate scrape intervals (15-30s)
- Configure retention policies for metrics
- Monitor monitoring system overhead

### 3. Security
- Secure metrics endpoints with authentication
- Use HTTPS for webhook notifications  
- Sanitize alert messages for sensitive data
- Implement proper access controls

### 4. Alert Management
- Set reasonable thresholds to avoid alert fatigue
- Group related alerts to reduce noise
- Implement escalation policies
- Test alert channels regularly

## Troubleshooting

### Common Issues

1. **Monitoring not starting**:
   - Check `MONITORING_ENABLED=true`
   - Verify port availability for metrics endpoint
   - Check logs for component initialization errors

2. **Missing metrics**:
   - Verify Prometheus configuration
   - Check scrape targets and intervals
   - Confirm metrics endpoint accessibility

3. **Alerts not firing**:
   - Test webhook/Slack URLs manually
   - Check alert rule thresholds
   - Verify alert manager configuration

4. **High monitoring overhead**:
   - Disable profiler component
   - Reduce metrics scrape frequency
   - Implement metric sampling for high-volume endpoints

## Dashboard Examples

### Key Metrics to Monitor

1. **Request Performance**:
   - Request rate (requests/sec)
   - Response time percentiles (P50, P95, P99)
   - Error rate percentage

2. **Model Performance**:
   - Inference latency by model
   - Token generation rate
   - Model loading times
   - Cache hit rates

3. **System Resources**:
   - CPU utilization
   - Memory usage and allocation
   - Disk I/O and space
   - Network throughput

4. **Business Metrics**:
   - Active models
   - API key usage
   - Rate limit hits
   - User activity patterns

This comprehensive monitoring setup ensures reliable operation and quick issue identification in production environments.