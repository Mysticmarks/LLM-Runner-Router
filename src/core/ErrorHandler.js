/**
 * 🛡️ System-Wide Error Handler with Self-Healing
 * Comprehensive error recovery and automatic healing system
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../utils/Logger.js';

const logger = new Logger('ErrorHandler');

class ErrorHandler extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      healthCheckInterval: 30000,
      memoryThreshold: 0.9, // 90% memory usage threshold
      autoRestart: true,
      gracefulShutdownTimeout: 30000,
      errorLogPath: './logs/errors.json',
      recoveryStrategies: {
        ENOMEM: 'clearCache',
        ECONNREFUSED: 'retryConnection',
        ENOENT: 'createMissing',
        TIMEOUT: 'increaseTimeout',
        SEGFAULT: 'restartProcess'
      },
      ...config
    };
    
    this.errorCounts = new Map();
    this.recoveryAttempts = new Map();
    this.lastHealthCheck = Date.now();
    this.isRecovering = false;
    
    this.setupHandlers();
    this.startHealthMonitoring();
  }

  /**
   * Setup global error handlers
   */
  setupHandlers() {
    // Uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('🚨 Uncaught Exception:', error);
      this.handleCriticalError(error, 'uncaughtException');
    });

    // Unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('🚨 Unhandled Rejection:', reason);
      this.handleCriticalError(reason, 'unhandledRejection');
    });

    // Memory warnings
    process.on('warning', (warning) => {
      logger.warn('⚠️ Process Warning:', warning);
      if (warning.name === 'MaxListenersExceededWarning') {
        this.handleMemoryLeak();
      }
    });

    // Graceful shutdown signals
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGHUP', () => this.reload('SIGHUP'));

    // PM2 specific signals
    process.on('message', (msg) => {
      if (msg === 'shutdown') {
        this.gracefulShutdown('PM2');
      }
    });

    logger.info('✅ Error handlers initialized');
  }

  /**
   * Handle critical errors with recovery
   */
  async handleCriticalError(error, source) {
    // Log the error
    await this.logError(error, source);
    
    // Track error frequency
    const errorKey = `${error.code || error.name}_${source}`;
    const count = (this.errorCounts.get(errorKey) || 0) + 1;
    this.errorCounts.set(errorKey, count);
    
    // Check if we should attempt recovery
    if (count > this.config.maxRetries) {
      logger.error('❌ Max retries exceeded, initiating emergency shutdown');
      return this.emergencyShutdown(error);
    }
    
    // Attempt recovery
    await this.attemptRecovery(error, source);
  }

  /**
   * Attempt to recover from error
   */
  async attemptRecovery(error, source) {
    if (this.isRecovering) {
      logger.warn('⏳ Recovery already in progress');
      return;
    }
    
    this.isRecovering = true;
    const recoveryKey = `${error.code || error.name}_${Date.now()}`;
    
    try {
      logger.info('🔧 Attempting recovery:', { error: error.code, source });
      
      // Select recovery strategy
      const strategy = this.selectRecoveryStrategy(error);
      
      // Execute recovery
      await this.executeRecovery(strategy, error);
      
      // Mark successful recovery
      this.recoveryAttempts.set(recoveryKey, 'success');
      logger.success('✅ Recovery successful');
      
      // Reset error count after successful recovery
      const errorKey = `${error.code || error.name}_${source}`;
      this.errorCounts.set(errorKey, 0);
      
    } catch (recoveryError) {
      logger.error('❌ Recovery failed:', recoveryError);
      this.recoveryAttempts.set(recoveryKey, 'failed');
      
      // Escalate if recovery fails
      await this.escalateError(error, recoveryError);
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * Select appropriate recovery strategy
   */
  selectRecoveryStrategy(error) {
    // Check predefined strategies
    if (error.code && this.config.recoveryStrategies[error.code]) {
      return this.config.recoveryStrategies[error.code];
    }
    
    // Analyze error type
    if (error.message?.includes('memory')) {
      return 'clearCache';
    }
    
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ETIMEDOUT')) {
      return 'retryConnection';
    }
    
    if (error.message?.includes('Cannot find module')) {
      return 'reinstallDependencies';
    }
    
    if (error.message?.includes('segmentation fault')) {
      return 'restartProcess';
    }
    
    // Default strategy
    return 'restart';
  }

  /**
   * Execute recovery strategy
   */
  async executeRecovery(strategy, error) {
    logger.info(`🔄 Executing recovery strategy: ${strategy}`);
    
    switch (strategy) {
      case 'clearCache':
        await this.clearCache();
        break;
        
      case 'retryConnection':
        await this.retryConnection(error);
        break;
        
      case 'createMissing':
        await this.createMissingResources(error);
        break;
        
      case 'increaseTimeout':
        await this.adjustTimeouts();
        break;
        
      case 'reinstallDependencies':
        await this.reinstallDependencies();
        break;
        
      case 'restartProcess':
        await this.restartProcess();
        break;
        
      case 'restart':
      default:
        await this.softRestart();
    }
  }

  /**
   * Recovery strategies
   */
  async clearCache() {
    logger.info('🧹 Clearing caches and freeing memory');
    
    // In ES modules, we can't clear require.cache
    // Instead, we'll clear any internal caches we maintain
    this.errorCounts.clear();
    this.recoveryAttempts.clear();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Clear application caches
    this.emit('clear-cache');
    
    // Wait for memory to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  async retryConnection(error) {
    logger.info('🔌 Retrying connection');
    
    for (let i = 0; i < this.config.maxRetries; i++) {
      await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * (i + 1)));
      
      // Emit retry event for components to handle
      this.emit('retry-connection', { attempt: i + 1, error });
      
      // Check if connection is restored
      const isConnected = await this.checkConnectivity();
      if (isConnected) {
        logger.success('✅ Connection restored');
        return;
      }
    }
    
    throw new Error('Failed to restore connection');
  }

  async createMissingResources(error) {
    logger.info('📁 Creating missing resources');
    
    // Extract path from error
    const pathMatch = error.message.match(/ENOENT.*'([^']+)'/);
    if (pathMatch) {
      const missingPath = pathMatch[1];
      
      // Create directory if it's a directory
      if (missingPath.endsWith('/') || !path.extname(missingPath)) {
        await fs.mkdir(missingPath, { recursive: true });
        logger.info(`Created directory: ${missingPath}`);
      } else {
        // Create file with empty content
        await fs.mkdir(path.dirname(missingPath), { recursive: true });
        await fs.writeFile(missingPath, '');
        logger.info(`Created file: ${missingPath}`);
      }
    }
  }

  async adjustTimeouts() {
    logger.info('⏰ Adjusting timeouts');
    
    // Increase global timeouts
    this.config.retryDelay *= 1.5;
    this.config.gracefulShutdownTimeout *= 1.5;
    
    // Emit event for components to adjust their timeouts
    this.emit('adjust-timeouts', { multiplier: 1.5 });
  }

  async reinstallDependencies() {
    logger.info('📦 Reinstalling dependencies');
    
    // This should be handled by PM2 or external script
    this.emit('reinstall-required');
    
    // Signal PM2 to restart with reinstall
    if (process.send) {
      process.send('reinstall');
    }
  }

  async restartProcess() {
    logger.info('🔄 Restarting process');
    
    // Clean shutdown
    await this.gracefulShutdown('error-recovery');
    
    // PM2 will handle the restart
    if (process.send) {
      process.send('restart');
    } else {
      // Self restart
      process.exit(1);
    }
  }

  async softRestart() {
    logger.info('♻️ Performing soft restart');
    
    // Emit soft restart event
    this.emit('soft-restart');
    
    // Wait for components to reset
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  /**
   * Health monitoring
   */
  startHealthMonitoring() {
    this.healthInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
    
    logger.info('🏥 Health monitoring started');
  }

  async performHealthCheck() {
    const health = {
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
      errors: this.errorCounts.size,
      recoveries: this.recoveryAttempts.size
    };
    
    // Check memory usage
    const memoryUsage = health.memory.heapUsed / health.memory.heapTotal;
    if (memoryUsage > this.config.memoryThreshold) {
      logger.warn(`⚠️ High memory usage: ${(memoryUsage * 100).toFixed(2)}%`);
      await this.clearCache();
    }
    
    // Check error rate
    const recentErrors = Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0);
    if (recentErrors > 10) {
      logger.warn(`⚠️ High error rate: ${recentErrors} errors`);
      this.emit('high-error-rate', recentErrors);
    }
    
    // Emit health status
    this.emit('health-check', health);
    
    // Log health status periodically
    if (Date.now() - this.lastHealthCheck > 300000) { // Every 5 minutes
      logger.info('💚 Health Check:', {
        memory: `${(memoryUsage * 100).toFixed(2)}%`,
        uptime: `${Math.floor(health.uptime / 60)} minutes`,
        errors: recentErrors
      });
      this.lastHealthCheck = Date.now();
    }
  }

  /**
   * Check connectivity
   */
  async checkConnectivity() {
    try {
      // Try to resolve DNS
      const dns = await import('dns').then(m => m.promises);
      await dns.resolve4('google.com');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown(signal) {
    logger.info(`🛑 Graceful shutdown initiated (${signal})`);
    
    // Stop health monitoring
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
    }
    
    // Emit shutdown event
    this.emit('shutdown', signal);
    
    // Wait for cleanup with timeout
    const shutdownPromise = new Promise(resolve => {
      this.once('shutdown-complete', resolve);
    });
    
    const timeoutPromise = new Promise(resolve => {
      setTimeout(resolve, this.config.gracefulShutdownTimeout);
    });
    
    await Promise.race([shutdownPromise, timeoutPromise]);
    
    logger.info('👋 Shutdown complete');
    process.exit(0);
  }

  /**
   * Emergency shutdown
   */
  async emergencyShutdown(error) {
    logger.error('🚨 EMERGENCY SHUTDOWN', error);
    
    // Log critical error
    await this.logError(error, 'emergency');
    
    // Force exit
    process.exit(1);
  }

  /**
   * Reload configuration
   */
  async reload(signal) {
    logger.info(`🔄 Reloading configuration (${signal})`);
    
    // Emit reload event
    this.emit('reload');
    
    // Clear error counts
    this.errorCounts.clear();
    
    logger.success('✅ Configuration reloaded');
  }

  /**
   * Log error to file
   */
  async logError(error, source) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      source,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        platform: process.platform,
        node: process.version
      }
    };
    
    try {
      // Ensure log directory exists
      await fs.mkdir(path.dirname(this.config.errorLogPath), { recursive: true });
      
      // Read existing logs
      let logs = [];
      try {
        const data = await fs.readFile(this.config.errorLogPath, 'utf-8');
        logs = JSON.parse(data);
      } catch {
        // File doesn't exist or is invalid
      }
      
      // Add new log
      logs.push(errorLog);
      
      // Keep only last 1000 entries
      if (logs.length > 1000) {
        logs = logs.slice(-1000);
      }
      
      // Write back
      await fs.writeFile(this.config.errorLogPath, JSON.stringify(logs, null, 2));
    } catch (logError) {
      logger.error('Failed to write error log:', logError);
    }
  }

  /**
   * Escalate error to external monitoring
   */
  async escalateError(originalError, recoveryError) {
    logger.error('🚨 Escalating error to external monitoring');
    
    // Emit escalation event
    this.emit('error-escalation', {
      original: originalError,
      recovery: recoveryError,
      timestamp: Date.now()
    });
    
    // Could send to external monitoring service
    // await this.sendToMonitoring(originalError, recoveryError);
  }

  /**
   * Get error statistics
   */
  getStats() {
    return {
      errorCounts: Object.fromEntries(this.errorCounts),
      recoveryAttempts: Object.fromEntries(this.recoveryAttempts),
      isRecovering: this.isRecovering,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }
}


export default ErrorHandler;
export { ErrorHandler };
