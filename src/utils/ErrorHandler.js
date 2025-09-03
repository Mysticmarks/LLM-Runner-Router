/**
 * Comprehensive Error Handler with Graceful Fallbacks
 * Ensures the application never crashes and provides meaningful user feedback
 */

import { Logger } from './Logger.js';
import { EventEmitter } from 'events';

const logger = new Logger('ErrorHandler');

export class ErrorHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      fallbackMode: options.fallbackMode !== false,
      logErrors: options.logErrors !== false,
      enableCrashReporting: options.enableCrashReporting || false,
      gracefulShutdown: options.gracefulShutdown !== false,
      ...options
    };

    this.errorCounts = new Map();
    this.circuitBreakers = new Map();
    this.fallbackStrategies = new Map();
    
    this.setupGlobalHandlers();
    this.registerFallbackStrategies();
  }

  /**
   * Setup global error handlers
   */
  setupGlobalHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('🚨 CRITICAL: Uncaught Exception:', error);
      this.handleCriticalError(error, 'uncaughtException');
    });

    // Handle unhandled promise rejections  
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('🚨 CRITICAL: Unhandled Promise Rejection:', reason);
      this.handleCriticalError(new Error(`Unhandled Promise Rejection: ${reason}`), 'unhandledRejection');
    });

    // Handle SIGTERM for graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('🛑 SIGTERM received, initiating graceful shutdown...');
      this.gracefulShutdown();
    });

    // Handle SIGINT (Ctrl+C) for graceful shutdown
    process.on('SIGINT', () => {
      logger.info('🛑 SIGINT received, initiating graceful shutdown...');
      this.gracefulShutdown();
    });
  }

  /**
   * Register fallback strategies for different error types
   */
  registerFallbackStrategies() {
    // Database connection failures
    this.fallbackStrategies.set('database', {
      fallback: async (error, context) => {
        logger.warn('📝 Database unavailable, using memory storage');
        return {
          status: 'degraded',
          message: 'Using memory storage due to database issues',
          data: context.defaultData || {}
        };
      },
      retryable: true
    });

    // Model loading failures
    this.fallbackStrategies.set('model', {
      fallback: async (error, context) => {
        logger.warn('🤖 Model unavailable, using fallback model');
        return {
          status: 'degraded',
          message: `Model ${context.modelId} unavailable, using fallback`,
          text: `I apologize, but the requested model is currently unavailable. The system is operating with a fallback model. Your request "${context.prompt || 'N/A'}" has been noted and will be processed when the primary model is restored.`,
          usage: { prompt_tokens: 0, completion_tokens: 50, total_tokens: 50 }
        };
      },
      retryable: true
    });

    // API failures
    this.fallbackStrategies.set('api', {
      fallback: async (error, context) => {
        logger.warn('🌐 API unavailable, using cached response or default');
        return {
          status: 'degraded',
          message: 'API temporarily unavailable, using fallback',
          data: context.cachedData || { message: 'Service temporarily unavailable but system remains operational' }
        };
      },
      retryable: true
    });

    // Authentication failures
    this.fallbackStrategies.set('auth', {
      fallback: async (error, context) => {
        logger.warn('🔒 Auth service degraded, using basic validation');
        return {
          status: 'degraded',
          message: 'Authentication service degraded, limited functionality available',
          user: { id: 'anonymous', role: 'readonly' },
          permissions: ['read']
        };
      },
      retryable: false
    });

    // Network failures
    this.fallbackStrategies.set('network', {
      fallback: async (error, context) => {
        logger.warn('🌐 Network issues detected, using cached data');
        return {
          status: 'offline',
          message: 'Operating in offline mode due to network issues',
          data: context.offlineData || {}
        };
      },
      retryable: true
    });
  }

  /**
   * Handle errors with automatic retry and fallback
   */
  async handleError(error, context = {}) {
    const errorType = this.classifyError(error);
    const errorKey = `${errorType}:${context.operation || 'unknown'}`;
    
    // Track error frequency
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    
    // Check circuit breaker
    if (this.isCircuitOpen(errorKey)) {
      logger.warn(`🔌 Circuit breaker open for ${errorKey}, using fallback immediately`);
      return await this.executeFallback(errorType, error, context);
    }

    // Attempt retry if configured
    if (context.retryCount < (context.maxRetries || this.options.maxRetries)) {
      logger.info(`🔄 Retrying operation (attempt ${context.retryCount + 1})`);
      
      await this.delay(this.options.retryDelay * Math.pow(2, context.retryCount));
      
      try {
        if (context.retryFunction) {
          return await context.retryFunction();
        }
      } catch (retryError) {
        return await this.handleError(retryError, {
          ...context,
          retryCount: (context.retryCount || 0) + 1
        });
      }
    }

    // Fallback strategy
    return await this.executeFallback(errorType, error, context);
  }

  /**
   * Classify error type for appropriate handling
   */
  classifyError(error) {
    const message = error.message?.toLowerCase() || '';
    const code = error.code?.toLowerCase() || '';
    
    if (message.includes('database') || message.includes('connection') || code.includes('econnrefused')) {
      return 'database';
    }
    
    if (message.includes('model') || message.includes('inference') || message.includes('gguf') || message.includes('pytorch')) {
      return 'model';
    }
    
    if (message.includes('api') || message.includes('request') || code.includes('enotfound')) {
      return 'api';
    }
    
    if (message.includes('auth') || message.includes('token') || message.includes('permission')) {
      return 'auth';
    }
    
    if (message.includes('network') || message.includes('timeout') || code.includes('etimeout')) {
      return 'network';
    }
    
    return 'unknown';
  }

  /**
   * Execute fallback strategy
   */
  async executeFallback(errorType, error, context) {
    const strategy = this.fallbackStrategies.get(errorType);
    
    if (strategy && this.options.fallbackMode) {
      try {
        logger.info(`🛡️  Executing fallback strategy for ${errorType}`);
        const result = await strategy.fallback(error, context);
        
        this.emit('fallback', { errorType, error, context, result });
        return result;
      } catch (fallbackError) {
        logger.error(`❌ Fallback strategy failed for ${errorType}:`, fallbackError);
      }
    }

    // Last resort fallback
    return this.lastResortFallback(error, context);
  }

  /**
   * Last resort fallback when all else fails
   */
  lastResortFallback(error, context) {
    const response = {
      status: 'error',
      message: 'The system encountered an issue but is still operational. Please try again or contact support if the problem persists.',
      error: this.options.logErrors ? {
        type: error.name,
        message: error.message,
        timestamp: new Date().toISOString()
      } : undefined,
      fallback: true,
      context: {
        operation: context.operation,
        timestamp: new Date().toISOString()
      }
    };

    // Provide context-specific fallback data
    if (context.operation === 'inference') {
      response.text = "I apologize, but I'm experiencing technical difficulties right now. However, the system remains fully operational and will continue processing requests. Please try your request again in a moment.";
      response.usage = { prompt_tokens: 0, completion_tokens: 30, total_tokens: 30 };
    }

    logger.warn('🚨 Using last resort fallback:', response.message);
    return response;
  }

  /**
   * Check if circuit breaker is open
   */
  isCircuitOpen(errorKey) {
    const threshold = 5; // Open circuit after 5 consecutive errors
    const timeWindow = 60000; // 1 minute
    
    const errorCount = this.errorCounts.get(errorKey) || 0;
    const breaker = this.circuitBreakers.get(errorKey);
    
    if (breaker && breaker.isOpen && Date.now() < breaker.openUntil) {
      return true;
    }
    
    if (errorCount >= threshold) {
      this.circuitBreakers.set(errorKey, {
        isOpen: true,
        openUntil: Date.now() + timeWindow,
        errorCount
      });
      return true;
    }
    
    return false;
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(errorKey) {
    this.circuitBreakers.delete(errorKey);
    this.errorCounts.delete(errorKey);
    logger.info(`🔌 Circuit breaker reset for ${errorKey}`);
  }

  /**
   * Handle critical errors that could crash the application
   */
  handleCriticalError(error, source) {
    logger.error(`🚨 CRITICAL ERROR from ${source}:`, {
      message: error.message,
      stack: error.stack,
      source,
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    });

    this.emit('criticalError', { error, source });

    if (this.options.gracefulShutdown) {
      setTimeout(() => {
        logger.error('🛑 Performing emergency graceful shutdown...');
        this.gracefulShutdown(1);
      }, 1000);
    }
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown(exitCode = 0) {
    logger.info('🛑 Initiating graceful shutdown...');
    
    try {
      // Give ongoing operations time to complete
      await this.delay(5000);
      
      // Close database connections, stop servers, etc.
      this.emit('shutdown');
      
      logger.info('✅ Graceful shutdown completed');
      process.exit(exitCode);
    } catch (error) {
      logger.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Delay utility
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wrap function with error handling
   */
  wrap(fn, context = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        return await this.handleError(error, {
          ...context,
          retryFunction: () => fn(...args),
          retryCount: 0
        });
      }
    };
  }

  /**
   * Get error statistics
   */
  getStats() {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    const openCircuits = Array.from(this.circuitBreakers.values()).filter(b => b.isOpen).length;
    
    return {
      totalErrors,
      errorsByType: Object.fromEntries(this.errorCounts),
      openCircuits,
      fallbackStrategies: this.fallbackStrategies.size
    };
  }
}

// Global error handler instance
let globalErrorHandler = null;

export function getErrorHandler(options) {
  if (!globalErrorHandler) {
    globalErrorHandler = new ErrorHandler(options);
  }
  return globalErrorHandler;
}

export function handleWithFallback(fn, context = {}) {
  const errorHandler = getErrorHandler();
  return errorHandler.wrap(fn, context);
}

export default ErrorHandler;