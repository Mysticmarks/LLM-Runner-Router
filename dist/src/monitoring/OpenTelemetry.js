/**
 * 🔭 OpenTelemetry Integration - Quantum Observability System
 * Complete tracing, metrics, and logging with OpenTelemetry
 * Echo AI Systems - Making the invisible visible
 */

import otelSDK from '@opentelemetry/sdk-node';
import otelResources from '@opentelemetry/resources';
import otelAutoInstrumentations from '@opentelemetry/auto-instrumentations-node';
import otelMetrics from '@opentelemetry/sdk-metrics';
import otelTraceNode from '@opentelemetry/sdk-trace-node';
import otelTraceBase from '@opentelemetry/sdk-trace-base';
import otelJaeger from '@opentelemetry/exporter-jaeger';
import otelZipkin from '@opentelemetry/exporter-zipkin';
import otelPrometheus from '@opentelemetry/exporter-prometheus';
import otelAPI from '@opentelemetry/api';

const { NodeSDK } = otelSDK;
const { Resource } = otelResources;
const { getNodeAutoInstrumentations } = otelAutoInstrumentations;
const { PeriodicExportingMetricReader, ConsoleMetricExporter, MeterProvider } = otelMetrics;
const { NodeTracerProvider, ConsoleSpanExporter } = otelTraceNode;
const { SimpleSpanProcessor, BatchSpanProcessor } = otelTraceBase;
const { JaegerExporter } = otelJaeger;
const { ZipkinExporter } = otelZipkin;
const { PrometheusExporter } = otelPrometheus;
const { metrics, trace, context, baggage } = otelAPI;
import Logger from '../utils/Logger.js';

class OpenTelemetryManager {
  constructor(config = {}) {
    this.logger = new Logger('OpenTelemetry');
    this.config = {
      serviceName: config.serviceName || 'llm-runner-router',
      serviceVersion: config.serviceVersion || '1.2.1',
      environment: config.environment || process.env.NODE_ENV || 'development',
      
      // Tracing configuration
      tracing: {
        enabled: config.tracing?.enabled ?? true,
        exporters: config.tracing?.exporters || ['console'],
        jaeger: {
          endpoint: config.tracing?.jaeger?.endpoint || 'http://localhost:14268/api/traces',
        },
        zipkin: {
          endpoint: config.tracing?.zipkin?.endpoint || 'http://localhost:9411/api/v2/spans',
        },
        sampling: config.tracing?.sampling || 1.0,
      },
      
      // Metrics configuration
      metrics: {
        enabled: config.metrics?.enabled ?? true,
        exporters: config.metrics?.exporters || ['prometheus'],
        prometheus: {
          port: config.metrics?.prometheus?.port || 9090,
          endpoint: config.metrics?.prometheus?.endpoint || '/metrics',
        },
        interval: config.metrics?.interval || 10000, // 10 seconds
      },
      
      // Resource configuration
      resource: {
        'service.name': config.serviceName || 'llm-runner-router',
        'service.version': config.serviceVersion || '1.2.1',
        'service.namespace': config.serviceNamespace || 'llm-systems',
        'deployment.environment': config.environment || process.env.NODE_ENV || 'development',
        ...config.resource,
      },
      
      ...config,
    };

    this.sdk = null;
    this.tracer = null;
    this.meter = null;
    this.isInitialized = false;
    
    // Metrics storage
    this.counters = new Map();
    this.histograms = new Map();
    this.gauges = new Map();
  }

  /**
   * Initialize OpenTelemetry SDK with complete configuration
   */
  async initialize() {
    try {
      this.logger.info('Initializing OpenTelemetry SDK...');
      
      // Create resource
      const resource = Resource.default().merge(
        new Resource(this.config.resource)
      );

      // Configure tracing
      const traceExporters = this._createTraceExporters();
      const spanProcessors = traceExporters.map(exporter => 
        new BatchSpanProcessor(exporter)
      );

      // Configure metrics
      const metricReaders = this._createMetricReaders();

      // Create and configure SDK
      this.sdk = new NodeSDK({
        resource,
        traceExporter: traceExporters[0], // Primary exporter
        spanProcessors,
        metricReader: metricReaders[0], // Primary reader
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': { enabled: false },
            '@opentelemetry/instrumentation-http': {
              enabled: true,
              requestHook: this._httpRequestHook.bind(this),
              responseHook: this._httpResponseHook.bind(this),
            },
            '@opentelemetry/instrumentation-express': { enabled: true },
            '@opentelemetry/instrumentation-grpc': { enabled: true },
          }),
        ],
      });

      // Start SDK
      await this.sdk.start();
      
      // Get tracer and meter
      this.tracer = trace.getTracer(this.config.serviceName, this.config.serviceVersion);
      this.meter = metrics.getMeter(this.config.serviceName, this.config.serviceVersion);
      
      // Initialize custom metrics
      this._initializeMetrics();
      
      this.isInitialized = true;
      this.logger.success('OpenTelemetry SDK initialized successfully');
      
      return this;
    } catch (error) {
      this.logger.error('Failed to initialize OpenTelemetry SDK:', error);
      throw error;
    }
  }

  /**
   * Create trace exporters based on configuration
   */
  _createTraceExporters() {
    const exporters = [];
    
    for (const exporterType of this.config.tracing.exporters) {
      switch (exporterType) {
        case 'console':
          exporters.push(new ConsoleSpanExporter());
          break;
        case 'jaeger':
          exporters.push(new JaegerExporter(this.config.tracing.jaeger));
          break;
        case 'zipkin':
          exporters.push(new ZipkinExporter(this.config.tracing.zipkin));
          break;
        default:
          this.logger.warn(`Unknown trace exporter: ${exporterType}`);
      }
    }
    
    return exporters.length > 0 ? exporters : [new ConsoleSpanExporter()];
  }

  /**
   * Create metric readers based on configuration
   */
  _createMetricReaders() {
    const readers = [];
    
    for (const exporterType of this.config.metrics.exporters) {
      switch (exporterType) {
        case 'console':
          readers.push(new PeriodicExportingMetricReader({
            exporter: new ConsoleMetricExporter(),
            exportIntervalMillis: this.config.metrics.interval,
          }));
          break;
        case 'prometheus':
          readers.push(new PrometheusExporter(this.config.metrics.prometheus));
          break;
        default:
          this.logger.warn(`Unknown metric exporter: ${exporterType}`);
      }
    }
    
    return readers.length > 0 ? readers : [
      new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
        exportIntervalMillis: this.config.metrics.interval,
      })
    ];
  }

  /**
   * Initialize custom metrics
   */
  _initializeMetrics() {
    // Request counters
    this.counters.set('http_requests_total', this.meter.createCounter('http_requests_total', {
      description: 'Total number of HTTP requests',
    }));
    
    this.counters.set('model_inference_total', this.meter.createCounter('model_inference_total', {
      description: 'Total number of model inferences',
    }));
    
    this.counters.set('errors_total', this.meter.createCounter('errors_total', {
      description: 'Total number of errors',
    }));
    
    // Response time histograms
    this.histograms.set('http_request_duration', this.meter.createHistogram('http_request_duration_seconds', {
      description: 'HTTP request duration in seconds',
      boundaries: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
    }));
    
    this.histograms.set('model_inference_duration', this.meter.createHistogram('model_inference_duration_seconds', {
      description: 'Model inference duration in seconds',
      boundaries: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30, 60],
    }));
    
    this.histograms.set('model_loading_duration', this.meter.createHistogram('model_loading_duration_seconds', {
      description: 'Model loading duration in seconds',
      boundaries: [1, 5, 10, 30, 60, 120, 300, 600],
    }));
    
    // Gauges
    this.gauges.set('active_connections', this.meter.createUpDownCounter('active_connections', {
      description: 'Number of active connections',
    }));
    
    this.gauges.set('loaded_models', this.meter.createUpDownCounter('loaded_models', {
      description: 'Number of loaded models',
    }));
    
    this.gauges.set('memory_usage', this.meter.createObservableGauge('memory_usage_bytes', {
      description: 'Memory usage in bytes',
    }));
    
    this.gauges.set('cpu_usage', this.meter.createObservableGauge('cpu_usage_percent', {
      description: 'CPU usage percentage',
    }));

    this.logger.info('Custom metrics initialized');
  }

  /**
   * HTTP request hook for tracing
   */
  _httpRequestHook(span, request) {
    span.setAttributes({
      'http.method': request.method,
      'http.url': request.url,
      'http.user_agent': request.headers?.['user-agent'],
      'http.request_content_length': request.headers?.['content-length'],
    });
  }

  /**
   * HTTP response hook for tracing
   */
  _httpResponseHook(span, response) {
    span.setAttributes({
      'http.status_code': response.statusCode,
      'http.response_content_length': response.getHeader?.('content-length'),
    });
  }

  /**
   * Create a new span with automatic context management
   */
  createSpan(name, attributes = {}, options = {}) {
    if (!this.isInitialized) {
      this.logger.warn('OpenTelemetry not initialized, returning dummy span');
      return { end: () => {}, setAttributes: () => {}, recordException: () => {} };
    }
    
    return this.tracer.startSpan(name, {
      attributes: {
        'service.name': this.config.serviceName,
        ...attributes,
      },
      ...options,
    });
  }

  /**
   * Execute function within a span context
   */
  async withSpan(name, fn, attributes = {}) {
    const span = this.createSpan(name, attributes);
    
    try {
      const result = await context.with(trace.setSpan(context.active(), span), fn);
      span.setStatus({ code: trace.SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ 
        code: trace.SpanStatusCode.ERROR, 
        message: error.message 
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name, labels = {}, value = 1) {
    const counter = this.counters.get(name);
    if (counter) {
      counter.add(value, labels);
    } else {
      this.logger.warn(`Counter ${name} not found`);
    }
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name, value, labels = {}) {
    const histogram = this.histograms.get(name);
    if (histogram) {
      histogram.record(value, labels);
    } else {
      this.logger.warn(`Histogram ${name} not found`);
    }
  }

  /**
   * Update a gauge value
   */
  updateGauge(name, value, labels = {}) {
    const gauge = this.gauges.get(name);
    if (gauge) {
      gauge.add(value, labels);
    } else {
      this.logger.warn(`Gauge ${name} not found`);
    }
  }

  /**
   * Set baggage for context propagation
   */
  setBaggage(key, value) {
    const currentBaggage = baggage.getActiveBaggage() || baggage.createBaggage();
    const newBaggage = baggage.setBaggage(currentBaggage, key, value);
    return context.with(baggage.setActiveBaggage(context.active(), newBaggage));
  }

  /**
   * Get baggage value
   */
  getBaggage(key) {
    const currentBaggage = baggage.getActiveBaggage();
    return currentBaggage?.getEntry(key)?.value;
  }

  /**
   * Get metrics snapshot
   */
  async getMetrics() {
    return {
      counters: Array.from(this.counters.keys()),
      histograms: Array.from(this.histograms.keys()),
      gauges: Array.from(this.gauges.keys()),
      isInitialized: this.isInitialized,
      config: this.config,
    };
  }

  /**
   * Shutdown OpenTelemetry gracefully
   */
  async shutdown() {
    if (this.sdk) {
      this.logger.info('Shutting down OpenTelemetry SDK...');
      await this.sdk.shutdown();
      this.isInitialized = false;
      this.logger.success('OpenTelemetry SDK shutdown complete');
    }
  }
}

// Export singleton instance
const otelManager = new OpenTelemetryManager();

export default otelManager;
export { OpenTelemetryManager };