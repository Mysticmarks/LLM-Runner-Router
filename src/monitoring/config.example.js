/**
 * 🔧 Monitoring Configuration Examples
 * Complete configuration examples for all monitoring components
 * Echo AI Systems - Configuration made simple
 */

// Basic Configuration
export const basicConfig = {
  enabled: true,
  autoStart: true,
  components: {
    opentelemetry: true,
    prometheus: true,
    health: true,
    profiler: false, // Disabled by default due to overhead
    alerting: true,
  },
};

// Development Configuration
export const developmentConfig = {
  enabled: true,
  autoStart: true,
  components: {
    opentelemetry: true,
    prometheus: true,
    health: true,
    profiler: true, // Enabled for development debugging
    alerting: true,
  },
  
  // OpenTelemetry configuration
  opentelemetry: {
    serviceName: 'llm-router-dev',
    serviceVersion: '1.2.1',
    environment: 'development',
    tracing: {
      enabled: true,
      exporters: ['console'], // Console only for development
      sampling: 1.0, // 100% sampling for development
    },
    metrics: {
      enabled: true,
      exporters: ['console'],
      interval: 5000, // 5 seconds for faster feedback
    },
  },
  
  // Prometheus configuration
  prometheus: {
    port: 9090,
    endpoint: '/metrics',
    collectDefaults: true,
    prefix: 'llm_router_dev_',
  },
  
  // Health monitor configuration
  health: {
    interval: 5000, // 5 seconds for development
    thresholds: {
      cpu: 90, // Higher threshold for development
      memory: 90,
      disk: 95,
      errorRate: 0.1, // 10% for development
      responseTime: 10000, // 10 seconds
    },
  },
  
  // Profiler configuration
  profiler: {
    outputDir: './profiles/dev',
    autoProfile: true,
    profileDuration: 10000, // 10 seconds for development
    heapSnapshotInterval: 60000, // 1 minute
  },
  
  // Alerting configuration
  alerting: {
    enabled: true,
    channels: {
      slack: {
        enabled: false, // Disabled for development
      },
      console: {
        enabled: true, // Console alerts for development
      },
    },
  },
};

// Production Configuration
export const productionConfig = {
  enabled: true,
  autoStart: true,
  components: {
    opentelemetry: true,
    prometheus: true,
    health: true,
    profiler: false, // Disabled in production
    alerting: true,
  },
  
  // OpenTelemetry configuration
  opentelemetry: {
    serviceName: 'llm-router',
    serviceVersion: '1.2.1',
    environment: 'production',
    tracing: {
      enabled: true,
      exporters: ['jaeger'], // External tracing system
      jaeger: {
        endpoint: process.env.JAEGER_ENDPOINT || 'http://jaeger:14268/api/traces',
      },
      sampling: 0.1, // 10% sampling for production
    },
    metrics: {
      enabled: true,
      exporters: ['prometheus'],
      interval: 15000, // 15 seconds
    },
  },
  
  // Prometheus configuration
  prometheus: {
    port: 9090,
    endpoint: '/metrics',
    collectDefaults: true,
    prefix: 'llm_router_',
  },
  
  // Health monitor configuration
  health: {
    interval: 10000, // 10 seconds
    thresholds: {
      cpu: 80,
      memory: 85,
      disk: 90,
      errorRate: 0.05, // 5%
      responseTime: 5000, // 5 seconds
    },
    dependencies: [
      {
        name: 'database',
        critical: true,
        timeout: 5000,
      },
      {
        name: 'redis',
        critical: false,
        timeout: 3000,
      },
    ],
  },
  
  // Alerting configuration
  alerting: {
    enabled: true,
    channels: {
      slack: {
        enabled: true,
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: '#alerts',
        username: 'LLM Router Production',
      },
      email: {
        enabled: true,
        smtp: {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        },
        from: process.env.ALERT_FROM_EMAIL,
        to: process.env.ALERT_TO_EMAILS?.split(',') || [],
      },
      pagerduty: {
        enabled: true,
        routingKey: process.env.PAGERDUTY_ROUTING_KEY,
      },
    },
    rules: [
      {
        id: 'critical_error_rate',
        name: 'Critical Error Rate',
        description: 'Error rate exceeds critical threshold',
        severity: 'critical',
        condition: (metrics) => metrics.errorRate > 0.1, // 10%
        channels: ['slack', 'email', 'pagerduty'],
        escalation: true,
      },
      {
        id: 'high_response_time',
        name: 'High Response Time',
        description: 'Average response time is too high',
        severity: 'warning',
        condition: (metrics) => metrics.avgResponseTime > 10000, // 10 seconds
        channels: ['slack'],
        aggregationKey: 'performance',
      },
      {
        id: 'model_failures',
        name: 'Model Inference Failures',
        description: 'Model inference failure rate is high',
        severity: 'critical',
        condition: (metrics) => metrics.modelFailureRate > 0.05, // 5%
        channels: ['slack', 'pagerduty'],
        escalation: true,
      },
    ],
  },
};

// VPS Configuration (for current environment)
export const vpsConfig = {
  enabled: true,
  autoStart: true,
  components: {
    opentelemetry: true,
    prometheus: true,
    health: true,
    profiler: false, // Disabled on VPS to conserve resources
    alerting: true,
  },
  
  // OpenTelemetry configuration
  opentelemetry: {
    serviceName: 'llm-router-vps',
    serviceVersion: '1.2.1',
    environment: 'vps',
    tracing: {
      enabled: true,
      exporters: ['console'], // Console only on VPS
      sampling: 0.5, // 50% sampling
    },
    metrics: {
      enabled: true,
      exporters: ['console'],
      interval: 10000, // 10 seconds
    },
  },
  
  // Prometheus configuration
  prometheus: {
    port: 9090,
    endpoint: '/metrics',
    collectDefaults: true,
    prefix: 'llm_router_vps_',
  },
  
  // Health monitor configuration
  health: {
    interval: 15000, // 15 seconds
    thresholds: {
      cpu: 85, // VPS-appropriate thresholds
      memory: 80, // Lower memory threshold for VPS
      disk: 90,
      errorRate: 0.05,
      responseTime: 8000, // 8 seconds
    },
  },
  
  // Alerting configuration
  alerting: {
    enabled: true,
    channels: {
      slack: {
        enabled: false, // Disabled for VPS
      },
      webhook: {
        enabled: true,
        urls: [process.env.MONITORING_WEBHOOK_URL].filter(Boolean),
      },
    },
    rules: [
      {
        id: 'vps_resource_exhaustion',
        name: 'VPS Resource Exhaustion',
        description: 'VPS resources are running low',
        severity: 'warning',
        condition: (metrics) => metrics.memoryUsage > 0.8 || metrics.cpuUsage > 85,
        channels: ['webhook'],
      },
    ],
  },
};

// Complete Enterprise Configuration
export const enterpriseConfig = {
  enabled: true,
  autoStart: true,
  components: {
    opentelemetry: true,
    prometheus: true,
    health: true,
    profiler: true,
    alerting: true,
  },
  
  // OpenTelemetry configuration
  opentelemetry: {
    serviceName: 'llm-router-enterprise',
    serviceVersion: '1.2.1',
    environment: 'production',
    tracing: {
      enabled: true,
      exporters: ['jaeger', 'zipkin'],
      jaeger: {
        endpoint: process.env.JAEGER_ENDPOINT,
      },
      zipkin: {
        endpoint: process.env.ZIPKIN_ENDPOINT,
      },
      sampling: 0.05, // 5% sampling for high volume
    },
    metrics: {
      enabled: true,
      exporters: ['prometheus'],
      prometheus: {
        port: 9464, // Different port for enterprise
        endpoint: '/otel-metrics',
      },
      interval: 30000, // 30 seconds
    },
  },
  
  // Prometheus configuration
  prometheus: {
    port: 9090,
    endpoint: '/metrics',
    collectDefaults: true,
    prefix: 'llm_router_enterprise_',
  },
  
  // Health monitor configuration
  health: {
    interval: 30000, // 30 seconds for enterprise
    timeout: 10000, // 10 seconds timeout
    retries: 3,
    thresholds: {
      cpu: 75, // Stricter thresholds for enterprise
      memory: 80,
      disk: 85,
      errorRate: 0.01, // 1%
      responseTime: 3000, // 3 seconds
    },
    dependencies: [
      {
        name: 'primary_database',
        critical: true,
        timeout: 5000,
        retries: 3,
      },
      {
        name: 'cache_cluster',
        critical: false,
        timeout: 2000,
      },
      {
        name: 'model_storage',
        critical: true,
        timeout: 10000,
      },
      {
        name: 'message_queue',
        critical: false,
        timeout: 3000,
      },
    ],
  },
  
  // Profiler configuration
  profiler: {
    outputDir: '/var/log/llm-router/profiles',
    autoProfile: false, // Manual profiling only
    profileDuration: 60000, // 1 minute
    heapSnapshotInterval: 3600000, // 1 hour
    performanceThresholds: {
      cpuUsage: 70,
      memoryUsage: 1024 * 1024 * 1024, // 1GB
      gcFrequency: 5, // per minute
    },
  },
  
  // Alerting configuration
  alerting: {
    enabled: true,
    aggregationWindow: 300000, // 5 minutes
    escalationDelay: 600000, // 10 minutes
    channels: {
      slack: {
        enabled: true,
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: '#production-alerts',
        username: 'LLM Router Enterprise',
      },
      email: {
        enabled: true,
        smtp: {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: true,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        },
        from: 'alerts@company.com',
        to: ['ops-team@company.com', 'engineering@company.com'],
      },
      pagerduty: {
        enabled: true,
        routingKey: process.env.PAGERDUTY_ROUTING_KEY,
      },
      webhook: {
        enabled: true,
        urls: [
          process.env.WEBHOOK_URL_1,
          process.env.WEBHOOK_URL_2,
        ].filter(Boolean),
        headers: {
          'Authorization': `Bearer ${process.env.WEBHOOK_TOKEN}`,
          'X-Source': 'llm-router-enterprise',
        },
      },
    },
    rules: [
      // System-level alerts
      {
        id: 'system_down',
        name: 'System Down',
        description: 'System is completely down',
        severity: 'critical',
        condition: (metrics) => metrics.healthStatus === 'unhealthy',
        channels: ['slack', 'email', 'pagerduty'],
        escalation: true,
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'Error rate exceeds threshold',
        severity: 'critical',
        condition: (metrics) => metrics.errorRate > 0.05,
        channels: ['slack', 'pagerduty'],
        aggregationKey: 'error_rate',
        escalation: true,
      },
      
      // Performance alerts
      {
        id: 'response_time_degradation',
        name: 'Response Time Degradation',
        description: 'Average response time is degraded',
        severity: 'warning',
        condition: (metrics) => metrics.avgResponseTime > 5000,
        channels: ['slack'],
        aggregationKey: 'performance',
      },
      {
        id: 'throughput_degradation',
        name: 'Throughput Degradation',
        description: 'Request throughput has decreased significantly',
        severity: 'warning',
        condition: (metrics) => metrics.requestsPerSecond < 10,
        channels: ['slack'],
        aggregationKey: 'throughput',
      },
      
      // Resource alerts
      {
        id: 'memory_exhaustion',
        name: 'Memory Exhaustion',
        description: 'Memory usage is critically high',
        severity: 'critical',
        condition: (metrics) => metrics.memoryUsage > 0.9,
        channels: ['slack', 'email'],
        escalation: true,
      },
      {
        id: 'cpu_saturation',
        name: 'CPU Saturation',
        description: 'CPU usage is critically high',
        severity: 'warning',
        condition: (metrics) => metrics.cpuUsage > 85,
        channels: ['slack'],
        aggregationKey: 'cpu_usage',
      },
      
      // Model-specific alerts
      {
        id: 'model_loading_failures',
        name: 'Model Loading Failures',
        description: 'Models are failing to load',
        severity: 'critical',
        condition: (metrics) => metrics.modelLoadingFailureRate > 0.1,
        channels: ['slack', 'pagerduty'],
        escalation: true,
      },
      {
        id: 'inference_timeout',
        name: 'Inference Timeout',
        description: 'Model inferences are timing out frequently',
        severity: 'warning',
        condition: (metrics) => metrics.inferenceTimeoutRate > 0.05,
        channels: ['slack'],
        aggregationKey: 'inference_issues',
      },
      
      // Security alerts
      {
        id: 'unusual_traffic_pattern',
        name: 'Unusual Traffic Pattern',
        description: 'Detected unusual traffic patterns',
        severity: 'warning',
        condition: (metrics) => metrics.requestsPerSecond > 1000,
        channels: ['slack', 'email'],
      },
      {
        id: 'authentication_failures',
        name: 'Authentication Failures',
        description: 'High rate of authentication failures',
        severity: 'warning',
        condition: (metrics) => metrics.authFailureRate > 0.1,
        channels: ['slack'],
        aggregationKey: 'security',
      },
    ],
    storage: {
      enabled: true,
      maxHistory: 50000,
      persistInterval: 30000, // 30 seconds
      filePath: '/var/log/llm-router/alerts.json',
    },
  },
  
  // Integration settings
  integrations: {
    metricsToAlerting: true,
    healthToAlerting: true,
    profilerToAlerting: true,
  },
};

// Export all configurations
export default {
  basic: basicConfig,
  development: developmentConfig,
  production: productionConfig,
  vps: vpsConfig,
  enterprise: enterpriseConfig,
};