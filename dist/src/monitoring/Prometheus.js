/**
 * 📊 Prometheus Metrics - Performance Observation Engine
 * Custom metrics collection with /metrics endpoint
 * Echo AI Systems - Measuring what matters
 */

import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import express from 'express';
import Logger from '../utils/Logger.js';

class PrometheusManager {
  constructor(config = {}) {
    this.logger = new Logger('Prometheus');
    this.config = {
      port: config.port || 9090,
      endpoint: config.endpoint || '/metrics',
      collectDefaults: config.collectDefaults ?? true,
      prefix: config.prefix || 'llm_router_',
      labels: config.labels || {},
      ...config,
    };

    this.registry = register;
    this.metrics = new Map();
    this.server = null;
    this.isRunning = false;
    
    // Initialize default metrics collection
    if (this.config.collectDefaults) {
      collectDefaultMetrics({ 
        register: this.registry,
        prefix: this.config.prefix,
        labels: this.config.labels,
      });
    }
    
    this._initializeCustomMetrics();
  }

  /**
   * Initialize custom metrics for LLM Router
   */
  _initializeCustomMetrics() {
    const commonLabels = ['method', 'route', 'status_code'];
    const modelLabels = ['model_id', 'model_type', 'engine'];
    
    // HTTP Request Metrics
    this.metrics.set('http_requests_total', new Counter({
      name: `${this.config.prefix}http_requests_total`,
      help: 'Total number of HTTP requests',
      labelNames: commonLabels,
      registers: [this.registry],
    }));

    this.metrics.set('http_request_duration_seconds', new Histogram({
      name: `${this.config.prefix}http_request_duration_seconds`,
      help: 'HTTP request duration in seconds',
      labelNames: commonLabels,
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    }));

    this.metrics.set('http_request_size_bytes', new Histogram({
      name: `${this.config.prefix}http_request_size_bytes`,
      help: 'HTTP request size in bytes',
      labelNames: commonLabels,
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.registry],
    }));

    this.metrics.set('http_response_size_bytes', new Histogram({
      name: `${this.config.prefix}http_response_size_bytes`,
      help: 'HTTP response size in bytes',
      labelNames: commonLabels,
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.registry],
    }));

    // Model Performance Metrics
    this.metrics.set('model_inference_total', new Counter({
      name: `${this.config.prefix}model_inference_total`,
      help: 'Total number of model inferences',
      labelNames: [...modelLabels, 'status'],
      registers: [this.registry],
    }));

    this.metrics.set('model_inference_duration_seconds', new Histogram({
      name: `${this.config.prefix}model_inference_duration_seconds`,
      help: 'Model inference duration in seconds',
      labelNames: modelLabels,
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.registry],
    }));

    this.metrics.set('model_loading_duration_seconds', new Histogram({
      name: `${this.config.prefix}model_loading_duration_seconds`,
      help: 'Model loading duration in seconds',
      labelNames: modelLabels,
      buckets: [1, 5, 10, 30, 60, 120, 300, 600],
      registers: [this.registry],
    }));

    this.metrics.set('tokens_generated_total', new Counter({
      name: `${this.config.prefix}tokens_generated_total`,
      help: 'Total number of tokens generated',
      labelNames: modelLabels,
      registers: [this.registry],
    }));

    this.metrics.set('tokens_per_second', new Histogram({
      name: `${this.config.prefix}tokens_per_second`,
      help: 'Tokens generated per second',
      labelNames: modelLabels,
      buckets: [1, 5, 10, 20, 50, 100, 200, 500],
      registers: [this.registry],
    }));

    // Cache Metrics
    this.metrics.set('cache_operations_total', new Counter({
      name: `${this.config.prefix}cache_operations_total`,
      help: 'Total number of cache operations',
      labelNames: ['operation', 'cache_type', 'status'],
      registers: [this.registry],
    }));

    this.metrics.set('cache_hit_ratio', new Gauge({
      name: `${this.config.prefix}cache_hit_ratio`,
      help: 'Cache hit ratio (0-1)',
      labelNames: ['cache_type'],
      registers: [this.registry],
    }));

    this.metrics.set('cache_size_bytes', new Gauge({
      name: `${this.config.prefix}cache_size_bytes`,
      help: 'Cache size in bytes',
      labelNames: ['cache_type'],
      registers: [this.registry],
    }));

    // System Resource Metrics
    this.metrics.set('active_connections', new Gauge({
      name: `${this.config.prefix}active_connections`,
      help: 'Number of active connections',
      labelNames: ['connection_type'],
      registers: [this.registry],
    }));

    this.metrics.set('loaded_models', new Gauge({
      name: `${this.config.prefix}loaded_models`,
      help: 'Number of loaded models',
      labelNames: ['model_type'],
      registers: [this.registry],
    }));

    this.metrics.set('memory_usage_bytes', new Gauge({
      name: `${this.config.prefix}memory_usage_bytes`,
      help: 'Memory usage in bytes',
      labelNames: ['type'],
      registers: [this.registry],
    }));

    this.metrics.set('gpu_memory_usage_bytes', new Gauge({
      name: `${this.config.prefix}gpu_memory_usage_bytes`,
      help: 'GPU memory usage in bytes',
      labelNames: ['device'],
      registers: [this.registry],
    }));

    // Error Metrics
    this.metrics.set('errors_total', new Counter({
      name: `${this.config.prefix}errors_total`,
      help: 'Total number of errors',
      labelNames: ['error_type', 'component'],
      registers: [this.registry],
    }));

    this.metrics.set('error_rate', new Gauge({
      name: `${this.config.prefix}error_rate`,
      help: 'Error rate (errors per second)',
      labelNames: ['component'],
      registers: [this.registry],
    }));

    // Quality Metrics
    this.metrics.set('model_quality_score', new Gauge({
      name: `${this.config.prefix}model_quality_score`,
      help: 'Model quality score (0-1)',
      labelNames: modelLabels,
      registers: [this.registry],
    }));

    this.metrics.set('response_similarity', new Histogram({
      name: `${this.config.prefix}response_similarity`,
      help: 'Response similarity score',
      labelNames: [...modelLabels, 'comparison_model'],
      buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      registers: [this.registry],
    }));

    // Router Metrics
    this.metrics.set('routing_decisions_total', new Counter({
      name: `${this.config.prefix}routing_decisions_total`,
      help: 'Total number of routing decisions',
      labelNames: ['strategy', 'selected_model', 'reason'],
      registers: [this.registry],
    }));

    this.metrics.set('route_selection_duration_seconds', new Histogram({
      name: `${this.config.prefix}route_selection_duration_seconds`,
      help: 'Route selection duration in seconds',
      labelNames: ['strategy'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    }));

    this.logger.info('Custom Prometheus metrics initialized');
  }

  /**
   * Start Prometheus metrics server
   */
  async start() {
    if (this.isRunning) {
      this.logger.warn('Prometheus server already running');
      return;
    }

    const app = express();
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        metrics_count: this.metrics.size,
      });
    });

    // Metrics endpoint
    app.get(this.config.endpoint, async (req, res) => {
      try {
        res.set('Content-Type', this.registry.contentType);
        const metrics = await this.registry.metrics();
        res.end(metrics);
      } catch (error) {
        this.logger.error('Error generating metrics:', error);
        res.status(500).send('Error generating metrics');
      }
    });

    // Start server
    this.server = app.listen(this.config.port, () => {
      this.isRunning = true;
      this.logger.success(`Prometheus metrics server started on port ${this.config.port}`);
      this.logger.info(`Metrics available at: http://localhost:${this.config.port}${this.config.endpoint}`);
    });

    return this.server;
  }

  /**
   * Stop Prometheus metrics server
   */
  async stop() {
    if (this.server && this.isRunning) {
      this.server.close(() => {
        this.isRunning = false;
        this.logger.info('Prometheus metrics server stopped');
      });
    }
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name, labels = {}, value = 1) {
    const metric = this.metrics.get(name);
    if (metric && metric.inc) {
      metric.inc(labels, value);
    } else {
      this.logger.warn(`Counter metric ${name} not found`);
    }
  }

  /**
   * Observe a histogram metric
   */
  observeHistogram(name, value, labels = {}) {
    const metric = this.metrics.get(name);
    if (metric && metric.observe) {
      metric.observe(labels, value);
    } else {
      this.logger.warn(`Histogram metric ${name} not found`);
    }
  }

  /**
   * Set a gauge metric
   */
  setGauge(name, value, labels = {}) {
    const metric = this.metrics.get(name);
    if (metric && metric.set) {
      metric.set(labels, value);
    } else {
      this.logger.warn(`Gauge metric ${name} not found`);
    }
  }

  /**
   * Increment a gauge metric
   */
  incrementGauge(name, value = 1, labels = {}) {
    const metric = this.metrics.get(name);
    if (metric && metric.inc) {
      metric.inc(labels, value);
    } else {
      this.logger.warn(`Gauge metric ${name} not found`);
    }
  }

  /**
   * Decrement a gauge metric
   */
  decrementGauge(name, value = 1, labels = {}) {
    const metric = this.metrics.get(name);
    if (metric && metric.dec) {
      metric.dec(labels, value);
    } else {
      this.logger.warn(`Gauge metric ${name} not found`);
    }
  }

  /**
   * Time a function execution and record to histogram
   */
  async timeFunction(name, fn, labels = {}) {
    const start = Date.now();
    
    try {
      const result = await fn();
      const duration = (Date.now() - start) / 1000;
      this.observeHistogram(name, duration, labels);
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.observeHistogram(name, duration, { ...labels, status: 'error' });
      throw error;
    }
  }

  /**
   * Create a timer for histogram metrics
   */
  startTimer(name, labels = {}) {
    const metric = this.metrics.get(name);
    if (metric && metric.startTimer) {
      return metric.startTimer(labels);
    } else {
      this.logger.warn(`Histogram metric ${name} not found`);
      return () => {}; // Return no-op function
    }
  }

  /**
   * Update cache hit ratio
   */
  updateCacheHitRatio(cacheType, hits, total) {
    const ratio = total > 0 ? hits / total : 0;
    this.setGauge('cache_hit_ratio', ratio, { cache_type: cacheType });
  }

  /**
   * Record model performance metrics
   */
  recordModelInference(modelId, modelType, engine, duration, tokenCount, status = 'success') {
    this.incrementCounter('model_inference_total', {
      model_id: modelId,
      model_type: modelType,
      engine,
      status,
    });

    this.observeHistogram('model_inference_duration_seconds', duration, {
      model_id: modelId,
      model_type: modelType,
      engine,
    });

    if (tokenCount > 0) {
      this.incrementCounter('tokens_generated_total', {
        model_id: modelId,
        model_type: modelType,
        engine,
      }, tokenCount);

      const tokensPerSecond = tokenCount / duration;
      this.observeHistogram('tokens_per_second', tokensPerSecond, {
        model_id: modelId,
        model_type: modelType,
        engine,
      });
    }
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(method, route, statusCode, duration, requestSize = 0, responseSize = 0) {
    const labels = {
      method: method.toUpperCase(),
      route,
      status_code: statusCode.toString(),
    };

    this.incrementCounter('http_requests_total', labels);
    this.observeHistogram('http_request_duration_seconds', duration, labels);
    
    if (requestSize > 0) {
      this.observeHistogram('http_request_size_bytes', requestSize, labels);
    }
    
    if (responseSize > 0) {
      this.observeHistogram('http_response_size_bytes', responseSize, labels);
    }
  }

  /**
   * Get current metrics as JSON
   */
  async getMetricsAsJSON() {
    try {
      const metrics = await this.registry.getMetricsAsJSON();
      return metrics;
    } catch (error) {
      this.logger.error('Error getting metrics as JSON:', error);
      return [];
    }
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.registry.clear();
    this.logger.info('All metrics cleared');
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary() {
    return {
      total_metrics: this.metrics.size,
      is_running: this.isRunning,
      port: this.config.port,
      endpoint: this.config.endpoint,
      metrics: Array.from(this.metrics.keys()),
    };
  }
}

// Export singleton instance
const prometheusManager = new PrometheusManager();

export default prometheusManager;
export { PrometheusManager };