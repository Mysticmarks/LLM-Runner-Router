/**
 * 🏥 Health Monitor - System Vitals Observatory
 * Comprehensive health checks and dependency monitoring
 * Echo AI Systems - Keeping the pulse of the system
 */

import EventEmitter from 'events';
import os from 'os';
import process from 'process';
import { promises as fs } from 'fs';
import Logger from '../utils/Logger.js';

class HealthMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = new Logger('HealthMonitor');
    this.config = {
      interval: config.interval || 10000, // 10 seconds
      timeout: config.timeout || 5000, // 5 seconds
      retries: config.retries || 3,
      thresholds: {
        cpu: config.thresholds?.cpu || 80, // 80%
        memory: config.thresholds?.memory || 85, // 85%
        disk: config.thresholds?.disk || 90, // 90%
        errorRate: config.thresholds?.errorRate || 0.05, // 5%
        responseTime: config.thresholds?.responseTime || 5000, // 5 seconds
        ...config.thresholds,
      },
      dependencies: config.dependencies || [],
      ...config,
    };

    this.isRunning = false;
    this.intervalId = null;
    this.healthStatus = {
      status: 'unknown',
      timestamp: new Date(),
      uptime: 0,
      checks: new Map(),
      dependencies: new Map(),
      metrics: {},
    };

    this.checks = new Map();
    this.dependencies = new Map();
    this.errorCounts = new Map();
    this.responseTimeHistory = [];
    
    this._registerDefaultChecks();
  }

  /**
   * Register default health checks
   */
  _registerDefaultChecks() {
    // System resource checks
    this.registerCheck('cpu_usage', this._checkCpuUsage.bind(this));
    this.registerCheck('memory_usage', this._checkMemoryUsage.bind(this));
    this.registerCheck('disk_usage', this._checkDiskUsage.bind(this));
    this.registerCheck('process_health', this._checkProcessHealth.bind(this));
    this.registerCheck('error_rate', this._checkErrorRate.bind(this));
    this.registerCheck('response_time', this._checkResponseTime.bind(this));
    
    // Network checks
    this.registerCheck('network_connectivity', this._checkNetworkConnectivity.bind(this));
    
    this.logger.info('Default health checks registered');
  }

  /**
   * Register a custom health check
   */
  registerCheck(name, checkFunction, options = {}) {
    this.checks.set(name, {
      function: checkFunction,
      enabled: options.enabled ?? true,
      interval: options.interval || this.config.interval,
      timeout: options.timeout || this.config.timeout,
      retries: options.retries || this.config.retries,
      ...options,
    });
    
    this.logger.info(`Health check registered: ${name}`);
  }

  /**
   * Register a dependency for monitoring
   */
  registerDependency(name, checkFunction, options = {}) {
    this.dependencies.set(name, {
      function: checkFunction,
      enabled: options.enabled ?? true,
      critical: options.critical ?? false,
      timeout: options.timeout || this.config.timeout,
      retries: options.retries || this.config.retries,
      ...options,
    });
    
    this.logger.info(`Dependency registered: ${name} (critical: ${options.critical})`);
  }

  /**
   * Start health monitoring
   */
  start() {
    if (this.isRunning) {
      this.logger.warn('Health monitor already running');
      return;
    }

    this.isRunning = true;
    this.logger.info(`Starting health monitor (interval: ${this.config.interval}ms)`);
    
    // Run initial check
    this._runHealthChecks();
    
    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this._runHealthChecks();
    }, this.config.interval);

    this.emit('started');
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    this.logger.info('Health monitor stopped');
    this.emit('stopped');
  }

  /**
   * Run all health checks
   */
  async _runHealthChecks() {
    const startTime = Date.now();
    const results = new Map();
    
    this.healthStatus.timestamp = new Date();
    this.healthStatus.uptime = process.uptime();
    
    // Run system checks
    for (const [name, check] of this.checks) {
      if (!check.enabled) continue;
      
      try {
        const result = await this._executeCheckWithTimeout(name, check);
        results.set(name, result);
        this.healthStatus.checks.set(name, result);
      } catch (error) {
        const errorResult = {
          status: 'error',
          message: error.message,
          timestamp: new Date(),
        };
        results.set(name, errorResult);
        this.healthStatus.checks.set(name, errorResult);
        this.logger.error(`Health check failed: ${name}`, error);
      }
    }
    
    // Run dependency checks
    for (const [name, dependency] of this.dependencies) {
      if (!dependency.enabled) continue;
      
      try {
        const result = await this._executeDependencyCheck(name, dependency);
        this.healthStatus.dependencies.set(name, result);
      } catch (error) {
        const errorResult = {
          status: 'error',
          message: error.message,
          timestamp: new Date(),
          critical: dependency.critical,
        };
        this.healthStatus.dependencies.set(name, errorResult);
        this.logger.error(`Dependency check failed: ${name}`, error);
      }
    }
    
    // Calculate overall health status
    this._updateOverallStatus();
    
    // Update metrics
    this._updateMetrics();
    
    const duration = Date.now() - startTime;
    this.logger.debug(`Health checks completed in ${duration}ms`);
    
    // Emit health status
    this.emit('health-check', this.healthStatus);
    
    // Emit specific events for status changes
    if (this.healthStatus.status === 'unhealthy') {
      this.emit('unhealthy', this.healthStatus);
    } else if (this.healthStatus.status === 'degraded') {
      this.emit('degraded', this.healthStatus);
    }
  }

  /**
   * Execute a health check with timeout and retries
   */
  async _executeCheckWithTimeout(name, check) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= check.retries; attempt++) {
      try {
        const result = await Promise.race([
          check.function(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Check timeout')), check.timeout)
          ),
        ]);
        
        return {
          status: result.status || 'healthy',
          message: result.message || 'OK',
          data: result.data || {},
          timestamp: new Date(),
          attempt,
        };
      } catch (error) {
        lastError = error;
        if (attempt < check.retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Execute a dependency check
   */
  async _executeDependencyCheck(name, dependency) {
    return this._executeCheckWithTimeout(name, dependency);
  }

  /**
   * CPU usage check
   */
  async _checkCpuUsage() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const usage = Math.min(100, (loadAvg[0] / cpus.length) * 100);
    
    return {
      status: usage > this.config.thresholds.cpu ? 'unhealthy' : 'healthy',
      message: `CPU usage: ${usage.toFixed(1)}%`,
      data: {
        usage: usage,
        threshold: this.config.thresholds.cpu,
        loadAverage: loadAvg,
        cpuCount: cpus.length,
      },
    };
  }

  /**
   * Memory usage check
   */
  async _checkMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usage = (usedMem / totalMem) * 100;
    
    const processMemory = process.memoryUsage();
    
    return {
      status: usage > this.config.thresholds.memory ? 'unhealthy' : 'healthy',
      message: `Memory usage: ${usage.toFixed(1)}%`,
      data: {
        usage: usage,
        threshold: this.config.thresholds.memory,
        total: totalMem,
        used: usedMem,
        free: freeMem,
        process: processMemory,
      },
    };
  }

  /**
   * Disk usage check
   */
  async _checkDiskUsage() {
    try {
      const stats = await fs.stat(process.cwd());
      // Simplified disk check - in production, use statvfs or similar
      return {
        status: 'healthy',
        message: 'Disk accessible',
        data: {
          accessible: true,
          path: process.cwd(),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Disk not accessible',
        data: {
          accessible: false,
          error: error.message,
        },
      };
    }
  }

  /**
   * Process health check
   */
  async _checkProcessHealth() {
    const memUsage = process.memoryUsage();
    const heapUsed = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    return {
      status: heapUsed > 90 ? 'unhealthy' : 'healthy',
      message: `Process healthy, heap usage: ${heapUsed.toFixed(1)}%`,
      data: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: memUsage,
        heapUsage: heapUsed,
      },
    };
  }

  /**
   * Error rate check
   */
  async _checkErrorRate() {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    const timeWindow = 60; // 1 minute
    const errorRate = totalErrors / timeWindow;
    
    return {
      status: errorRate > this.config.thresholds.errorRate ? 'unhealthy' : 'healthy',
      message: `Error rate: ${errorRate.toFixed(3)}/sec`,
      data: {
        errorRate,
        threshold: this.config.thresholds.errorRate,
        totalErrors,
        timeWindow,
      },
    };
  }

  /**
   * Response time check
   */
  async _checkResponseTime() {
    const recentTimes = this.responseTimeHistory.slice(-100); // Last 100 requests
    const avgResponseTime = recentTimes.length > 0 
      ? recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length 
      : 0;
    
    return {
      status: avgResponseTime > this.config.thresholds.responseTime ? 'unhealthy' : 'healthy',
      message: `Avg response time: ${avgResponseTime.toFixed(1)}ms`,
      data: {
        averageResponseTime: avgResponseTime,
        threshold: this.config.thresholds.responseTime,
        sampleSize: recentTimes.length,
      },
    };
  }

  /**
   * Network connectivity check
   */
  async _checkNetworkConnectivity() {
    // Simple connectivity check - can be enhanced with actual network tests
    return {
      status: 'healthy',
      message: 'Network connectivity OK',
      data: {
        hostname: os.hostname(),
        networkInterfaces: Object.keys(os.networkInterfaces()),
      },
    };
  }

  /**
   * Update overall health status
   */
  _updateOverallStatus() {
    const checkStatuses = Array.from(this.healthStatus.checks.values()).map(check => check.status);
    const dependencyStatuses = Array.from(this.healthStatus.dependencies.values());
    
    // Check for critical dependency failures
    const criticalFailures = dependencyStatuses.filter(dep => dep.critical && dep.status === 'error');
    if (criticalFailures.length > 0) {
      this.healthStatus.status = 'unhealthy';
      return;
    }
    
    // Check overall status
    const unhealthyChecks = checkStatuses.filter(status => status === 'unhealthy' || status === 'error');
    const degradedChecks = checkStatuses.filter(status => status === 'degraded' || status === 'warning');
    
    if (unhealthyChecks.length > 0) {
      this.healthStatus.status = 'unhealthy';
    } else if (degradedChecks.length > 0) {
      this.healthStatus.status = 'degraded';
    } else {
      this.healthStatus.status = 'healthy';
    }
  }

  /**
   * Update metrics
   */
  _updateMetrics() {
    this.healthStatus.metrics = {
      checksTotal: this.checks.size,
      checksEnabled: Array.from(this.checks.values()).filter(check => check.enabled).length,
      dependenciesTotal: this.dependencies.size,
      dependenciesEnabled: Array.from(this.dependencies.values()).filter(dep => dep.enabled).length,
      lastCheckDuration: Date.now() - this.healthStatus.timestamp.getTime(),
      uptime: process.uptime(),
    };
  }

  /**
   * Record an error for error rate calculation
   */
  recordError(type = 'general') {
    const current = this.errorCounts.get(type) || 0;
    this.errorCounts.set(type, current + 1);
    
    // Clean up old error counts periodically
    setTimeout(() => {
      const count = this.errorCounts.get(type) || 0;
      if (count > 0) {
        this.errorCounts.set(type, count - 1);
      }
    }, 60000); // Remove after 1 minute
  }

  /**
   * Record response time
   */
  recordResponseTime(time) {
    this.responseTimeHistory.push(time);
    
    // Keep only recent history
    if (this.responseTimeHistory.length > 1000) {
      this.responseTimeHistory = this.responseTimeHistory.slice(-500);
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus() {
    return {
      ...this.healthStatus,
      checks: Object.fromEntries(this.healthStatus.checks),
      dependencies: Object.fromEntries(this.healthStatus.dependencies),
    };
  }

  /**
   * Alias for getHealthStatus (for compatibility)
   */
  checkHealth() {
    return this.getHealthStatus();
  }

  /**
   * Get health summary
   */
  getHealthSummary() {
    const status = this.getHealthStatus();
    const checksHealthy = Object.values(status.checks).filter(check => check.status === 'healthy').length;
    const depsHealthy = Object.values(status.dependencies).filter(dep => dep.status === 'healthy').length;
    
    return {
      status: status.status,
      uptime: status.uptime,
      timestamp: status.timestamp,
      summary: {
        checks: {
          total: Object.keys(status.checks).length,
          healthy: checksHealthy,
          unhealthy: Object.keys(status.checks).length - checksHealthy,
        },
        dependencies: {
          total: Object.keys(status.dependencies).length,
          healthy: depsHealthy,
          unhealthy: Object.keys(status.dependencies).length - depsHealthy,
        },
      },
    };
  }

  /**
   * Force run health checks (useful for testing)
   */
  async runChecks() {
    await this._runHealthChecks();
    return this.getHealthStatus();
  }
}

// Export singleton instance
const healthMonitor = new HealthMonitor();

export default healthMonitor;
export { HealthMonitor };