/**
 * 🔗 Monitoring Middleware - Express Integration Layer
 * Seamless integration with Express.js applications
 * Echo AI Systems - Invisible but comprehensive monitoring
 */

import monitoringSystem from './index.js';
import Logger from '../utils/Logger.js';

const logger = new Logger('MonitoringMiddleware');

/**
 * Express middleware for automatic HTTP request monitoring
 */
export function httpMonitoringMiddleware(options = {}) {
  const config = {
    enabled: options.enabled ?? true,
    excludePaths: options.excludePaths || ['/favicon.ico', '/health', '/metrics'],
    includeBody: options.includeBody ?? false,
    includeHeaders: options.includeHeaders ?? false,
    sampling: options.sampling ?? 1.0, // Sample 100% by default
    ...options,
  };

  return (req, res, next) => {
    // Skip if monitoring is disabled
    if (!config.enabled || !monitoringSystem.isRunning) {
      return next();
    }

    // Skip excluded paths
    if (config.excludePaths.includes(req.path)) {
      return next();
    }

    // Apply sampling
    if (Math.random() > config.sampling) {
      return next();
    }

    const startTime = Date.now();
    const span = monitoringSystem.createSpan(`HTTP ${req.method} ${req.path}`, {
      'http.method': req.method,
      'http.url': req.url,
      'http.route': req.route?.path || req.path,
      'http.user_agent': req.get('User-Agent'),
      'user.id': req.user?.id,
    });

    // Capture request data
    if (config.includeHeaders) {
      span.setAttributes({
        'http.request.headers': JSON.stringify(req.headers),
      });
    }

    if (config.includeBody && req.body) {
      span.setAttributes({
        'http.request.body_size': JSON.stringify(req.body).length,
      });
    }

    // Override res.end to capture response data
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const duration = Date.now() - startTime;
      
      // Set span attributes
      span.setAttributes({
        'http.status_code': res.statusCode,
        'http.response.size': res.get('Content-Length') || 0,
        'http.response.duration_ms': duration,
      });

      // Record metrics in monitoring system
      monitoringSystem.recordHttpRequest(req, res, duration);

      // Set span status
      if (res.statusCode >= 400) {
        span.setStatus({
          code: 2, // ERROR
          message: `HTTP ${res.statusCode}`,
        });
        
        if (res.statusCode >= 500) {
          span.recordException(new Error(`Server error: ${res.statusCode}`));
        }
      } else {
        span.setStatus({ code: 1 }); // OK
      }

      span.end();
      
      // Call original end
      originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

/**
 * Error handling middleware for monitoring
 */
export function errorMonitoringMiddleware() {
  return (error, req, res, next) => {
    if (!monitoringSystem.isRunning) {
      return next(error);
    }

    const span = monitoringSystem.createSpan('HTTP Error Handler', {
      'error.type': error.constructor.name,
      'error.message': error.message,
      'error.stack': error.stack,
      'http.method': req.method,
      'http.url': req.url,
    });

    span.recordException(error);
    span.setStatus({
      code: 2, // ERROR
      message: error.message,
    });

    // Record error in health monitor
    if (monitoringSystem.components.health) {
      monitoringSystem.components.health.recordError('http_error');
    }

    span.end();
    next(error);
  };
}

/**
 * Model inference monitoring wrapper
 */
export function withModelMonitoring(modelId, modelType, engine, inferenceFunction) {
  return async function monitoredInference(...args) {
    if (!monitoringSystem.isRunning) {
      return inferenceFunction.apply(this, args);
    }

    const startTime = Date.now();
    const span = monitoringSystem.createSpan(`Model Inference: ${modelId}`, {
      'model.id': modelId,
      'model.type': modelType,
      'model.engine': engine,
      'operation.type': 'inference',
    });

    try {
      const result = await inferenceFunction.apply(this, args);
      const duration = (Date.now() - startTime) / 1000; // Convert to seconds
      
      // Count tokens if available
      let tokenCount = 0;
      if (result && typeof result === 'object') {
        tokenCount = result.tokenCount || result.tokens?.length || 0;
      }

      // Record successful inference
      monitoringSystem.recordModelInference(
        modelId,
        modelType,
        engine,
        duration,
        tokenCount,
        'success'
      );

      span.setAttributes({
        'model.inference.success': true,
        'model.inference.duration_ms': duration * 1000,
        'model.inference.token_count': tokenCount,
      });

      span.setStatus({ code: 1 }); // OK
      span.end();

      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      
      // Record failed inference
      monitoringSystem.recordModelInference(
        modelId,
        modelType,
        engine,
        duration,
        0,
        'error'
      );

      span.recordException(error);
      span.setAttributes({
        'model.inference.success': false,
        'model.inference.duration_ms': duration * 1000,
        'error.type': error.constructor.name,
        'error.message': error.message,
      });

      span.setStatus({
        code: 2, // ERROR
        message: error.message,
      });

      span.end();
      throw error;
    }
  };
}

/**
 * Database operation monitoring wrapper
 */
export function withDatabaseMonitoring(operation, table, queryFunction) {
  return async function monitoredQuery(...args) {
    if (!monitoringSystem.isRunning) {
      return queryFunction.apply(this, args);
    }

    return monitoringSystem.withSpan(`DB ${operation}: ${table}`, async () => {
      const startTime = Date.now();
      
      try {
        const result = await queryFunction.apply(this, args);
        const duration = Date.now() - startTime;
        
        // Record database metrics
        if (monitoringSystem.components.prometheus) {
          monitoringSystem.components.prometheus.observeHistogram(
            'database_operation_duration_seconds',
            duration / 1000,
            { operation, table, status: 'success' }
          );
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Record failed database operation
        if (monitoringSystem.components.prometheus) {
          monitoringSystem.components.prometheus.observeHistogram(
            'database_operation_duration_seconds',
            duration / 1000,
            { operation, table, status: 'error' }
          );
        }

        throw error;
      }
    }, {
      'db.operation': operation,
      'db.table': table,
      'db.system': 'postgresql', // or whatever DB system
    });
  };
}

/**
 * Cache operation monitoring wrapper
 */
export function withCacheMonitoring(operation, cacheType, cacheFunction) {
  return async function monitoredCache(...args) {
    if (!monitoringSystem.isRunning) {
      return cacheFunction.apply(this, args);
    }

    const startTime = Date.now();
    const span = monitoringSystem.createSpan(`Cache ${operation}`, {
      'cache.operation': operation,
      'cache.type': cacheType,
    });

    try {
      const result = await cacheFunction.apply(this, args);
      const duration = Date.now() - startTime;
      const hit = result !== null && result !== undefined;

      // Record cache metrics
      if (monitoringSystem.components.prometheus) {
        monitoringSystem.components.prometheus.incrementCounter(
          'cache_operations_total',
          { operation, cache_type: cacheType, status: hit ? 'hit' : 'miss' }
        );
      }

      span.setAttributes({
        'cache.hit': hit,
        'cache.duration_ms': duration,
      });

      span.setStatus({ code: 1 }); // OK
      span.end();

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record cache error
      if (monitoringSystem.components.prometheus) {
        monitoringSystem.components.prometheus.incrementCounter(
          'cache_operations_total',
          { operation, cache_type: cacheType, status: 'error' }
        );
      }

      span.recordException(error);
      span.setAttributes({
        'cache.error': true,
        'cache.duration_ms': duration,
      });

      span.setStatus({
        code: 2, // ERROR
        message: error.message,
      });

      span.end();
      throw error;
    }
  };
}

/**
 * Queue operation monitoring wrapper
 */
export function withQueueMonitoring(queueName, operation, queueFunction) {
  return async function monitoredQueue(...args) {
    if (!monitoringSystem.isRunning) {
      return queueFunction.apply(this, args);
    }

    return monitoringSystem.withSpan(`Queue ${operation}: ${queueName}`, async () => {
      const startTime = Date.now();
      
      try {
        const result = await queueFunction.apply(this, args);
        const duration = Date.now() - startTime;
        
        // Record queue metrics
        if (monitoringSystem.components.prometheus) {
          monitoringSystem.components.prometheus.observeHistogram(
            'queue_operation_duration_seconds',
            duration / 1000,
            { queue: queueName, operation, status: 'success' }
          );
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Record failed queue operation
        if (monitoringSystem.components.prometheus) {
          monitoringSystem.components.prometheus.observeHistogram(
            'queue_operation_duration_seconds',
            duration / 1000,
            { queue: queueName, operation, status: 'error' }
          );
        }

        throw error;
      }
    }, {
      'queue.name': queueName,
      'queue.operation': operation,
    });
  };
}

/**
 * Custom metrics helper
 */
export function recordCustomMetric(name, value, labels = {}, type = 'counter') {
  if (!monitoringSystem.isRunning) {
    return;
  }

  switch (type) {
    case 'counter':
      if (monitoringSystem.components.prometheus) {
        monitoringSystem.components.prometheus.incrementCounter(name, labels, value);
      }
      if (monitoringSystem.components.opentelemetry) {
        monitoringSystem.components.opentelemetry.incrementCounter(name, labels, value);
      }
      break;
    
    case 'histogram':
      if (monitoringSystem.components.prometheus) {
        monitoringSystem.components.prometheus.observeHistogram(name, value, labels);
      }
      if (monitoringSystem.components.opentelemetry) {
        monitoringSystem.components.opentelemetry.recordHistogram(name, value, labels);
      }
      break;
    
    case 'gauge':
      if (monitoringSystem.components.prometheus) {
        monitoringSystem.components.prometheus.setGauge(name, value, labels);
      }
      if (monitoringSystem.components.opentelemetry) {
        monitoringSystem.components.opentelemetry.updateGauge(name, value, labels);
      }
      break;
    
    default:
      logger.warn(`Unknown metric type: ${type}`);
  }
}

/**
 * Health check registration helper
 */
export function registerHealthCheck(name, checkFunction, options = {}) {
  if (monitoringSystem.components.health) {
    monitoringSystem.components.health.registerCheck(name, checkFunction, options);
    logger.info(`Health check registered: ${name}`);
  } else {
    logger.warn('Health monitor not available, cannot register check');
  }
}

/**
 * Dependency monitoring registration helper
 */
export function registerDependency(name, checkFunction, options = {}) {
  if (monitoringSystem.components.health) {
    monitoringSystem.components.health.registerDependency(name, checkFunction, options);
    logger.info(`Dependency registered: ${name}`);
  } else {
    logger.warn('Health monitor not available, cannot register dependency');
  }
}

/**
 * Alert rule registration helper
 */
export function registerAlertRule(id, rule) {
  if (monitoringSystem.components.alerting) {
    monitoringSystem.components.alerting.addRule(id, rule);
    logger.info(`Alert rule registered: ${id}`);
  } else {
    logger.warn('Alerting system not available, cannot register rule');
  }
}

/**
 * Performance profiling helpers
 */
export function startPerformanceProfile(duration = 30000) {
  if (monitoringSystem.components.profiler) {
    return monitoringSystem.startCPUProfile(duration);
  }
  throw new Error('Profiler not available');
}

export function takeMemorySnapshot() {
  if (monitoringSystem.components.profiler) {
    return monitoringSystem.takeHeapSnapshot();
  }
  throw new Error('Profiler not available');
}

/**
 * Monitoring status helpers
 */
export function getMonitoringStatus() {
  return monitoringSystem.getSystemStatus();
}

export function isMonitoringEnabled() {
  return monitoringSystem.isRunning;
}

/**
 * Express app integration helper
 */
export function setupMonitoring(app, options = {}) {
  if (!app || typeof app.use !== 'function') {
    throw new Error('Invalid Express app provided');
  }

  const config = {
    httpMonitoring: options.httpMonitoring ?? true,
    errorMonitoring: options.errorMonitoring ?? true,
    healthEndpoint: options.healthEndpoint ?? '/health',
    metricsEndpoint: options.metricsEndpoint ?? '/metrics',
    statusEndpoint: options.statusEndpoint ?? '/status',
    ...options,
  };

  // Add HTTP monitoring middleware
  if (config.httpMonitoring) {
    app.use(httpMonitoringMiddleware(config.httpMonitoring));
    logger.info('HTTP monitoring middleware installed');
  }

  // Add error monitoring middleware
  if (config.errorMonitoring) {
    app.use(errorMonitoringMiddleware());
    logger.info('Error monitoring middleware installed');
  }

  // Add health endpoint
  if (config.healthEndpoint) {
    app.get(config.healthEndpoint, async (req, res) => {
      try {
        const healthStatus = await monitoringSystem.runHealthChecks();
        const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(healthStatus);
      } catch (error) {
        res.status(500).json({
          status: 'error',
          message: error.message,
        });
      }
    });
    logger.info(`Health endpoint available at: ${config.healthEndpoint}`);
  }

  // Add metrics endpoint (if not already handled by Prometheus)
  if (config.metricsEndpoint && !monitoringSystem.components.prometheus?.isRunning) {
    app.get(config.metricsEndpoint, async (req, res) => {
      try {
        const format = req.query.format || 'prometheus';
        const metrics = await monitoringSystem.exportMetrics(format);
        
        if (format === 'prometheus') {
          res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        } else {
          res.set('Content-Type', 'application/json');
        }
        
        res.send(metrics);
      } catch (error) {
        res.status(500).json({
          error: error.message,
        });
      }
    });
    logger.info(`Metrics endpoint available at: ${config.metricsEndpoint}`);
  }

  // Add status endpoint
  if (config.statusEndpoint) {
    app.get(config.statusEndpoint, async (req, res) => {
      try {
        const status = await monitoringSystem.getDashboardData();
        res.json(status);
      } catch (error) {
        res.status(500).json({
          error: error.message,
        });
      }
    });
    logger.info(`Status endpoint available at: ${config.statusEndpoint}`);
  }

  logger.success('Monitoring system integration complete');
  return app;
}

export default {
  httpMonitoringMiddleware,
  errorMonitoringMiddleware,
  withModelMonitoring,
  withDatabaseMonitoring,
  withCacheMonitoring,
  withQueueMonitoring,
  recordCustomMetric,
  registerHealthCheck,
  registerDependency,
  registerAlertRule,
  startPerformanceProfile,
  takeMemorySnapshot,
  getMonitoringStatus,
  isMonitoringEnabled,
  setupMonitoring,
};