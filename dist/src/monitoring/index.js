/**
 * 🎛️ Monitoring System - Central Command Center
 * Unified interface for all monitoring and observability components
 * Echo AI Systems - Complete system visibility
 */

import EventEmitter from 'events';
import otelManager from './OpenTelemetry.js';
import prometheusManager from './Prometheus.js';
import healthMonitor from './HealthMonitor.js';
import profiler from './Profiler.js';
import alertingSystem from './Alerting.js';
import Logger from '../utils/Logger.js';

class MonitoringSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = new Logger('Monitoring');
    this.config = {
      enabled: config.enabled ?? true,
      autoStart: config.autoStart ?? true,
      components: {
        opentelemetry: config.components?.opentelemetry ?? true,
        prometheus: config.components?.prometheus ?? true,
        health: config.components?.health ?? true,
        profiler: config.components?.profiler ?? false, // Disabled by default due to overhead
        alerting: config.components?.alerting ?? true,
      },
      integrations: {
        metricsToAlerting: config.integrations?.metricsToAlerting ?? true,
        healthToAlerting: config.integrations?.healthToAlerting ?? true,
        profilerToAlerting: config.integrations?.profilerToAlerting ?? true,
        ...config.integrations,
      },
      ...config,
    };

    this.components = {
      opentelemetry: otelManager,
      prometheus: prometheusManager,
      health: healthMonitor,
      profiler: profiler,
      alerting: alertingSystem,
    };

    this.isRunning = false;
    this.startupOrder = ['opentelemetry', 'prometheus', 'health', 'alerting', 'profiler'];
    this.shutdownOrder = [...this.startupOrder].reverse();
    
    this._setupIntegrations();
    
    if (this.config.autoStart) {
      // Auto-start in next tick to allow for configuration
      process.nextTick(() => this.start());
    }
  }

  /**
   * Setup integrations between monitoring components
   */
  _setupIntegrations() {
    // Health monitor to alerting integration
    if (this.config.integrations.healthToAlerting) {
      healthMonitor.on('unhealthy', (healthStatus) => {
        alertingSystem.evaluateMetrics({
          healthStatus: 'unhealthy',
          unhealthyChecks: this._getUnhealthyChecks(healthStatus),
        });
      });

      healthMonitor.on('degraded', (healthStatus) => {
        alertingSystem.evaluateMetrics({
          healthStatus: 'degraded',
          degradedChecks: this._getDegradedChecks(healthStatus),
        });
      });
    }

    // Profiler to alerting integration
    if (this.config.integrations.profilerToAlerting) {
      profiler.on('high-memory-usage', (data) => {
        alertingSystem.evaluateMetrics({
          memoryUsage: data.current / data.threshold,
          memoryThresholdExceeded: true,
        });
      });

      profiler.on('high-gc-frequency', (data) => {
        alertingSystem.evaluateMetrics({
          gcFrequency: data.count,
          gcThresholdExceeded: true,
        });
      });

      profiler.on('slow-operation', (data) => {
        alertingSystem.evaluateMetrics({
          avgResponseTime: data.duration,
          slowOperationDetected: true,
        });
      });
    }

    // Prometheus metrics to alerting integration
    if (this.config.integrations.metricsToAlerting) {
      // Periodically evaluate Prometheus metrics for alerting
      setInterval(async () => {
        if (this.isRunning) {
          try {
            const metrics = await this._collectMetricsForAlerting();
            alertingSystem.evaluateMetrics(metrics);
          } catch (error) {
            this.logger.error('Failed to collect metrics for alerting:', error);
          }
        }
      }, 30000); // Every 30 seconds
    }

    this.logger.info('Monitoring component integrations configured');
  }

  /**
   * Start all monitoring components
   */
  async start() {
    if (this.isRunning) {
      this.logger.warn('Monitoring system already running');
      return;
    }

    if (!this.config.enabled) {
      this.logger.info('Monitoring system disabled by configuration');
      return;
    }

    this.logger.info('Starting monitoring system...');
    const startTime = Date.now();

    for (const componentName of this.startupOrder) {
      if (!this.config.components[componentName]) {
        this.logger.debug(`Skipping disabled component: ${componentName}`);
        continue;
      }

      try {
        const component = this.components[componentName];
        
        if (component && typeof component.start === 'function') {
          await component.start();
          this.logger.success(`✓ ${componentName} started`);
        } else if (component && typeof component.initialize === 'function') {
          await component.initialize();
          this.logger.success(`✓ ${componentName} initialized`);
        } else {
          this.logger.debug(`Component ${componentName} does not require startup`);
        }
      } catch (error) {
        this.logger.error(`Failed to start ${componentName}:`, error);
        // Continue with other components even if one fails
      }
    }

    this.isRunning = true;
    const duration = Date.now() - startTime;
    
    this.logger.success(`Monitoring system started in ${duration}ms`);
    this.emit('started', { duration, components: this._getComponentStatus() });

    // Record startup metrics
    if (this.config.components.prometheus) {
      prometheusManager.incrementCounter('http_requests_total', {
        method: 'INTERNAL',
        route: '/monitoring/start',
        status_code: '200',
      });
    }
  }

  /**
   * Stop all monitoring components
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping monitoring system...');
    const stopTime = Date.now();

    for (const componentName of this.shutdownOrder) {
      if (!this.config.components[componentName]) {
        continue;
      }

      try {
        const component = this.components[componentName];
        
        if (component && typeof component.stop === 'function') {
          await component.stop();
          this.logger.info(`✓ ${componentName} stopped`);
        } else if (component && typeof component.shutdown === 'function') {
          await component.shutdown();
          this.logger.info(`✓ ${componentName} shutdown`);
        }
      } catch (error) {
        this.logger.error(`Failed to stop ${componentName}:`, error);
      }
    }

    this.isRunning = false;
    const duration = Date.now() - stopTime;
    
    this.logger.info(`Monitoring system stopped in ${duration}ms`);
    this.emit('stopped', { duration });
  }

  /**
   * Collect metrics for alerting evaluation
   */
  async _collectMetricsForAlerting() {
    const metrics = {};

    // Get Prometheus metrics
    try {
      const prometheusMetrics = await prometheusManager.getMetricsAsJSON();
      
      // Extract key metrics for alerting
      for (const metric of prometheusMetrics) {
        switch (metric.name) {
          case 'llm_router_http_requests_total':
            metrics.totalRequests = this._sumMetricValues(metric.values);
            metrics.errorRate = this._calculateErrorRate(metric.values);
            break;
          case 'llm_router_http_request_duration_seconds':
            metrics.avgResponseTime = this._calculateAverage(metric.values) * 1000; // Convert to ms
            break;
          case 'llm_router_memory_usage_bytes':
            metrics.memoryUsage = this._getLatestMetricValue(metric.values);
            break;
          case 'llm_router_model_inference_total':
            metrics.totalInferences = this._sumMetricValues(metric.values);
            metrics.modelFailureRate = this._calculateModelFailureRate(metric.values);
            break;
        }
      }
    } catch (error) {
      this.logger.debug('Failed to collect Prometheus metrics for alerting:', error);
    }

    // Get health status
    try {
      const healthStatus = healthMonitor.getHealthSummary();
      metrics.healthStatus = healthStatus.status;
      metrics.healthChecksUnhealthy = healthStatus.summary.checks.unhealthy;
      metrics.dependenciesUnhealthy = healthStatus.summary.dependencies.unhealthy;
    } catch (error) {
      this.logger.debug('Failed to collect health metrics for alerting:', error);
    }

    // Get profiler metrics
    try {
      const profilerStatus = profiler.getStatus();
      metrics.memoryTrend = profilerStatus.memoryTrend;
      metrics.bottlenecks = profilerStatus.recentBottlenecks?.length || 0;
    } catch (error) {
      this.logger.debug('Failed to collect profiler metrics for alerting:', error);
    }

    return metrics;
  }

  /**
   * Helper methods for metric processing
   */
  _sumMetricValues(values) {
    return values.reduce((sum, item) => sum + (item.value || 0), 0);
  }

  _calculateAverage(values) {
    if (values.length === 0) return 0;
    return this._sumMetricValues(values) / values.length;
  }

  _getLatestMetricValue(values) {
    return values.length > 0 ? values[values.length - 1].value : 0;
  }

  _calculateErrorRate(values) {
    const errorResponses = values.filter(item => 
      item.labels?.status_code && parseInt(item.labels.status_code) >= 400
    );
    const totalResponses = values.length;
    return totalResponses > 0 ? errorResponses.length / totalResponses : 0;
  }

  _calculateModelFailureRate(values) {
    const failedInferences = values.filter(item => 
      item.labels?.status === 'error' || item.labels?.status === 'failed'
    );
    const totalInferences = values.length;
    return totalInferences > 0 ? failedInferences.length / totalInferences : 0;
  }

  _getUnhealthyChecks(healthStatus) {
    return Object.entries(healthStatus.checks || {})
      .filter(([_, check]) => check.status === 'unhealthy' || check.status === 'error')
      .map(([name, _]) => name);
  }

  _getDegradedChecks(healthStatus) {
    return Object.entries(healthStatus.checks || {})
      .filter(([_, check]) => check.status === 'degraded' || check.status === 'warning')
      .map(([name, _]) => name);
  }

  /**
   * Get component status
   */
  _getComponentStatus() {
    const status = {};
    
    for (const [name, component] of Object.entries(this.components)) {
      try {
        if (typeof component.getStatus === 'function') {
          status[name] = component.getStatus();
        } else if (typeof component.isRunning !== 'undefined') {
          status[name] = { isRunning: component.isRunning };
        } else {
          status[name] = { available: true };
        }
      } catch (error) {
        status[name] = { error: error.message };
      }
    }
    
    return status;
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(req, res, duration) {
    if (!this.isRunning) return;

    const method = req.method;
    const route = req.route?.path || req.path || 'unknown';
    const statusCode = res.statusCode;
    const requestSize = parseInt(req.get('content-length')) || 0;
    const responseSize = parseInt(res.get('content-length')) || 0;

    // Record in Prometheus
    if (this.config.components.prometheus) {
      prometheusManager.recordHttpRequest(method, route, statusCode, duration / 1000, requestSize, responseSize);
    }

    // Record in OpenTelemetry
    if (this.config.components.opentelemetry) {
      otelManager.recordHistogram('http_request_duration', duration / 1000, {
        method: method.toUpperCase(),
        route,
        status_code: statusCode.toString(),
      });
    }

    // Record in health monitor
    if (this.config.components.health) {
      healthMonitor.recordResponseTime(duration);
      if (statusCode >= 400) {
        healthMonitor.recordError('http_error');
      }
    }
  }

  /**
   * Record model inference metrics
   */
  recordModelInference(modelId, modelType, engine, duration, tokenCount, status = 'success') {
    if (!this.isRunning) return;

    // Record in Prometheus
    if (this.config.components.prometheus) {
      prometheusManager.recordModelInference(modelId, modelType, engine, duration, tokenCount, status);
    }

    // Record in OpenTelemetry
    if (this.config.components.opentelemetry) {
      otelManager.recordHistogram('model_inference_duration', duration, {
        model_id: modelId,
        model_type: modelType,
        engine,
        status,
      });
      
      if (tokenCount > 0) {
        otelManager.incrementCounter('tokens_generated_total', {
          model_id: modelId,
          model_type: modelType,
          engine,
        }, tokenCount);
      }
    }
  }

  /**
   * Create a span for distributed tracing
   */
  createSpan(name, attributes = {}) {
    if (this.config.components.opentelemetry) {
      return otelManager.createSpan(name, attributes);
    }
    
    // Return dummy span if OpenTelemetry is disabled
    return {
      end: () => {},
      setAttributes: () => {},
      recordException: () => {},
      setStatus: () => {},
    };
  }

  /**
   * Execute function within a traced span
   */
  async withSpan(name, fn, attributes = {}) {
    if (this.config.components.opentelemetry) {
      return otelManager.withSpan(name, fn, attributes);
    }
    
    // Execute without tracing if OpenTelemetry is disabled
    return fn();
  }

  /**
   * Start CPU profiling
   */
  async startCPUProfile(duration = 30000) {
    if (this.config.components.profiler) {
      return profiler.profileCPU(duration);
    }
    throw new Error('Profiler component is disabled');
  }

  /**
   * Take heap snapshot
   */
  async takeHeapSnapshot() {
    if (this.config.components.profiler) {
      return profiler.takeHeapSnapshot();
    }
    throw new Error('Profiler component is disabled');
  }

  /**
   * Force health check run
   */
  async runHealthChecks() {
    if (this.config.components.health) {
      return healthMonitor.runChecks();
    }
    throw new Error('Health monitor component is disabled');
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    return {
      monitoring: {
        isRunning: this.isRunning,
        enabled: this.config.enabled,
        components: this._getComponentStatus(),
      },
      health: this.config.components.health ? healthMonitor.getHealthSummary() : null,
      alerts: this.config.components.alerting ? alertingSystem.getAlertStats() : null,
      profiler: this.config.components.profiler ? profiler.getStatus() : null,
      metrics: this.config.components.prometheus ? prometheusManager.getMetricsSummary() : null,
    };
  }

  /**
   * Get monitoring dashboard data
   */
  async getDashboardData() {
    const data = {
      timestamp: new Date(),
      system: this.getSystemStatus(),
    };

    // Add recent metrics if available
    if (this.config.components.prometheus) {
      try {
        data.recentMetrics = await prometheusManager.getMetricsAsJSON();
      } catch (error) {
        this.logger.debug('Failed to get recent metrics:', error);
      }
    }

    return data;
  }

  /**
   * Export metrics in various formats
   */
  async exportMetrics(format = 'prometheus') {
    switch (format) {
      case 'prometheus':
        if (this.config.components.prometheus) {
          return prometheusManager.registry.metrics();
        }
        throw new Error('Prometheus component is disabled');
      
      case 'json':
        if (this.config.components.prometheus) {
          return prometheusManager.getMetricsAsJSON();
        }
        throw new Error('Prometheus component is disabled');
      
      case 'opentelemetry':
        if (this.config.components.opentelemetry) {
          return otelManager.getMetrics();
        }
        throw new Error('OpenTelemetry component is disabled');
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}

// Create and export singleton instance
const monitoringSystem = new MonitoringSystem();

export default monitoringSystem;
export { 
  MonitoringSystem,
  otelManager,
  prometheusManager,
  healthMonitor,
  profiler,
  alertingSystem,
};