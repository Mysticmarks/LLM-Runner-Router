/**
 * 🏥 Self-Healing Monitor
 * Automatic detection and recovery from common issues
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const logger = new Logger('SelfHealing');

class SelfHealingMonitor extends EventEmitter {
  constructor(router, config = {}) {
    super();
    
    this.router = router;
    this.config = {
      checkInterval: 10000, // 10 seconds
      modelLoadTimeout: 30000, // 30 seconds
      inferenceTimeout: 15000, // 15 seconds
      maxMemoryUsage: 0.85, // 85% of available memory
      maxCpuUsage: 0.90, // 90% CPU usage
      minResponseTime: 100, // 100ms minimum expected response
      maxResponseTime: 5000, // 5s maximum response time
      autoHeal: true,
      healingStrategies: {
        modelNotLoaded: 'reloadModel',
        highMemory: 'clearMemory',
        highCpu: 'throttleRequests',
        slowResponse: 'optimizeCache',
        noResponse: 'restartComponent',
        connectionLost: 'reconnect'
      },
      ...config
    };
    
    this.metrics = {
      checksPerformed: 0,
      issuesDetected: 0,
      healingAttempts: 0,
      healingSuccesses: 0,
      lastCheck: null,
      status: 'healthy'
    };
    
    this.issues = new Map();
    this.isHealing = false;
    
    this.startMonitoring();
  }

  /**
   * Start self-healing monitoring
   */
  startMonitoring() {
    this.monitorInterval = setInterval(async () => {
      await this.performDiagnostics();
    }, this.config.checkInterval);
    
    // Initial check
    setTimeout(() => this.performDiagnostics(), 1000);
    
    logger.info('🏥 Self-healing monitor started');
  }

  /**
   * Perform comprehensive diagnostics
   */
  async performDiagnostics() {
    this.metrics.checksPerformed++;
    this.metrics.lastCheck = Date.now();
    
    const diagnostics = {
      timestamp: Date.now(),
      issues: [],
      system: await this.checkSystemHealth(),
      models: await this.checkModelsHealth(),
      api: await this.checkAPIHealth(),
      dependencies: await this.checkDependencies()
    };
    
    // Analyze diagnostics
    this.analyzeDiagnostics(diagnostics);
    
    // Heal if needed
    if (diagnostics.issues.length > 0 && this.config.autoHeal) {
      await this.healIssues(diagnostics.issues);
    }
    
    // Update status
    this.updateStatus(diagnostics);
    
    // Emit diagnostic results
    this.emit('diagnostic-complete', diagnostics);
  }

  /**
   * Check system health
   */
  async checkSystemHealth() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = usedMem / totalMem;
    
    const cpus = os.cpus();
    const avgLoad = os.loadavg()[0] / cpus.length;
    
    const health = {
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usage: memUsage,
        threshold: this.config.maxMemoryUsage,
        healthy: memUsage < this.config.maxMemoryUsage
      },
      cpu: {
        cores: cpus.length,
        load: avgLoad,
        threshold: this.config.maxCpuUsage,
        healthy: avgLoad < this.config.maxCpuUsage
      },
      uptime: process.uptime(),
      platform: process.platform,
      node: process.version
    };
    
    // Check for issues
    if (!health.memory.healthy) {
      this.registerIssue('highMemory', `Memory usage ${(memUsage * 100).toFixed(2)}%`);
    }
    
    if (!health.cpu.healthy) {
      this.registerIssue('highCpu', `CPU load ${avgLoad.toFixed(2)}`);
    }
    
    return health;
  }

  /**
   * Check models health
   */
  async checkModelsHealth() {
    const health = {
      registered: 0,
      loaded: 0,
      available: 0,
      issues: []
    };
    
    try {
      if (this.router?.registry) {
        const models = this.router.registry.getAll();
        health.registered = models.length;
        health.loaded = models.filter(m => m.loaded).length;
        health.available = models.filter(m => m.available).length;
        
        // Check for model issues
        if (health.registered === 0) {
          this.registerIssue('noModels', 'No models registered');
          health.issues.push('No models registered');
        } else if (health.loaded === 0) {
          this.registerIssue('modelNotLoaded', 'No models loaded');
          health.issues.push('No models loaded');
        }
        
        // Test model inference
        if (health.loaded > 0) {
          const testResult = await this.testModelInference();
          if (!testResult.success) {
            this.registerIssue('inferenceFailure', testResult.error);
            health.issues.push('Inference test failed');
          }
        }
      }
    } catch (error) {
      logger.error('Model health check failed:', error);
      health.issues.push(error.message);
    }
    
    health.healthy = health.issues.length === 0;
    return health;
  }

  /**
   * Check API health
   */
  async checkAPIHealth() {
    const health = {
      endpoints: [],
      responseTime: null,
      healthy: true
    };
    
    try {
      // Test health endpoint
      const startTime = Date.now();
      const response = await fetch('http://localhost:3000/health').catch(() => null);
      const responseTime = Date.now() - startTime;
      
      health.responseTime = responseTime;
      
      if (!response) {
        this.registerIssue('apiDown', 'API server not responding');
        health.healthy = false;
      } else if (responseTime > this.config.maxResponseTime) {
        this.registerIssue('slowResponse', `Response time ${responseTime}ms`);
        health.healthy = false;
      }
      
      // Check critical endpoints
      const endpoints = ['/api/models', '/api/status'];
      for (const endpoint of endpoints) {
        const endpointHealth = await this.checkEndpoint(endpoint);
        health.endpoints.push(endpointHealth);
        if (!endpointHealth.healthy) {
          health.healthy = false;
        }
      }
    } catch (error) {
      logger.error('API health check failed:', error);
      health.healthy = false;
    }
    
    return health;
  }

  /**
   * Check single endpoint
   */
  async checkEndpoint(endpoint) {
    try {
      const response = await fetch(`http://localhost:3000${endpoint}`);
      return {
        endpoint,
        status: response.status,
        healthy: response.status < 500
      };
    } catch (error) {
      return {
        endpoint,
        error: error.message,
        healthy: false
      };
    }
  }

  /**
   * Check dependencies
   */
  async checkDependencies() {
    const health = {
      pm2: false,
      nodeLlamaCpp: false,
      diskSpace: null,
      issues: []
    };
    
    try {
      // Check PM2
      const { stdout: pm2Status } = await execAsync('pm2 status --json').catch(() => ({ stdout: '[]' }));
      const pm2Processes = JSON.parse(pm2Status);
      health.pm2 = pm2Processes.length > 0;
      
      // Check node-llama-cpp
      try {
        await import('node-llama-cpp');
        health.nodeLlamaCpp = true;
      } catch {
        health.nodeLlamaCpp = false;
      }
      
      // Check disk space
      const { stdout: dfOutput } = await execAsync("df -h / | tail -1 | awk '{print $5}'");
      const diskUsage = parseInt(dfOutput.replace('%', ''));
      health.diskSpace = {
        usage: diskUsage,
        healthy: diskUsage < 90
      };
      
      if (diskUsage > 90) {
        this.registerIssue('lowDiskSpace', `Disk usage ${diskUsage}%`);
        health.issues.push('Low disk space');
      }
    } catch (error) {
      logger.error('Dependency check failed:', error);
      health.issues.push(error.message);
    }
    
    health.healthy = health.issues.length === 0;
    return health;
  }

  /**
   * Test model inference
   */
  async testModelInference() {
    try {
      const startTime = Date.now();
      
      // Use router's quick method for test
      const result = await Promise.race([
        this.router.quick('Test', { maxTokens: 1 }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), this.config.inferenceTimeout)
        )
      ]);
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        responseTime,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Register an issue
   */
  registerIssue(type, details) {
    this.issues.set(type, {
      type,
      details,
      timestamp: Date.now(),
      attempts: (this.issues.get(type)?.attempts || 0) + 1
    });
    
    this.metrics.issuesDetected++;
  }

  /**
   * Analyze diagnostics
   */
  analyzeDiagnostics(diagnostics) {
    diagnostics.issues = Array.from(this.issues.values())
      .filter(issue => Date.now() - issue.timestamp < 60000); // Issues from last minute
    
    // Determine overall health
    diagnostics.healthy = diagnostics.issues.length === 0 &&
                         diagnostics.system.memory.healthy &&
                         diagnostics.system.cpu.healthy &&
                         diagnostics.models.healthy &&
                         diagnostics.api.healthy;
  }

  /**
   * Heal detected issues
   */
  async healIssues(issues) {
    if (this.isHealing) {
      logger.warn('🔧 Healing already in progress');
      return;
    }
    
    this.isHealing = true;
    this.metrics.healingAttempts++;
    
    try {
      for (const issue of issues) {
        await this.healIssue(issue);
      }
      
      this.metrics.healingSuccesses++;
      logger.success('✅ Healing completed successfully');
    } catch (error) {
      logger.error('❌ Healing failed:', error);
    } finally {
      this.isHealing = false;
    }
  }

  /**
   * Heal specific issue
   */
  async healIssue(issue) {
    const strategy = this.config.healingStrategies[issue.type] || 'restart';
    
    logger.info(`🔧 Healing ${issue.type} with strategy: ${strategy}`);
    
    switch (strategy) {
      case 'reloadModel':
        await this.reloadModels();
        break;
        
      case 'clearMemory':
        await this.clearMemory();
        break;
        
      case 'throttleRequests':
        await this.throttleRequests();
        break;
        
      case 'optimizeCache':
        await this.optimizeCache();
        break;
        
      case 'restartComponent':
        await this.restartComponent(issue);
        break;
        
      case 'reconnect':
        await this.reconnect();
        break;
        
      default:
        await this.restart();
    }
    
    // Clear issue after healing
    this.issues.delete(issue.type);
  }

  /**
   * Healing strategies
   */
  async reloadModels() {
    logger.info('📦 Reloading models');
    
    if (this.router?.registry) {
      const models = this.router.registry.getAll();
      for (const model of models) {
        if (!model.loaded) {
          try {
            await model.load();
            logger.info(`Loaded model: ${model.id}`);
          } catch (error) {
            logger.error(`Failed to load model ${model.id}:`, error);
          }
        }
      }
    }
  }

  async clearMemory() {
    logger.info('🧹 Clearing memory');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Clear caches
    if (this.router) {
      this.router.clearCache?.();
    }
    
    // Clear require cache for non-essential modules
    Object.keys(require.cache).forEach(key => {
      if (!key.includes('node_modules')) {
        delete require.cache[key];
      }
    });
  }

  async throttleRequests() {
    logger.info('🚦 Throttling requests');
    
    // Implement request throttling
    this.emit('throttle-requests', { duration: 30000 });
  }

  async optimizeCache() {
    logger.info('⚡ Optimizing cache');
    
    // Clear old cache entries
    if (this.router?.routeCache) {
      this.router.routeCache.clear();
    }
  }

  async restartComponent(issue) {
    logger.info('🔄 Restarting component');
    
    // Component-specific restart
    this.emit('restart-component', issue);
  }

  async reconnect() {
    logger.info('🔌 Reconnecting');
    
    // Attempt to reconnect services
    this.emit('reconnect');
  }

  async restart() {
    logger.info('♻️ Restarting system');
    
    // Trigger PM2 restart
    if (process.send) {
      process.send('restart');
    }
  }

  /**
   * Update status
   */
  updateStatus(diagnostics) {
    if (diagnostics.healthy) {
      this.metrics.status = 'healthy';
    } else if (diagnostics.issues.length > 3) {
      this.metrics.status = 'critical';
    } else {
      this.metrics.status = 'degraded';
    }
    
    // Log status changes
    if (this.lastStatus !== this.metrics.status) {
      logger.info(`Status changed: ${this.lastStatus} → ${this.metrics.status}`);
      this.emit('status-change', this.metrics.status);
      this.lastStatus = this.metrics.status;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      issues: Array.from(this.issues.values()),
      isHealing: this.isHealing
    };
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    logger.info('🛑 Self-healing monitor stopped');
  }
}


export default SelfHealingMonitor;
export { SelfHealingMonitor };
