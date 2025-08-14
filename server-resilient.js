/**
 * 🛡️ Resilient LLM Router Server with Self-Healing
 * Production-ready server with comprehensive error handling and auto-recovery
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { LLMRouter } from './src/index.js';
import { ErrorHandler } from './src/core/ErrorHandler.js';
import { SelfHealingMonitor } from './src/core/SelfHealingMonitor.js';
import path from 'path';
import { fileURLToPath } from 'url';
import winston from 'winston';
import cluster from 'cluster';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env' });

const PORT = process.env.PORT || 3000;
const API_KEYS = new Set(process.env.API_KEYS?.split(',').map(k => k.trim()) || []);

// Configure logging with rotation
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'llm-router-resilient' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Cluster management for resilience
if (cluster.isPrimary && process.env.CLUSTER_MODE === 'true') {
  const numWorkers = process.env.WORKERS || os.cpus().length;
  
  logger.info(`🚀 Master process ${process.pid} starting ${numWorkers} workers`);
  
  // Fork workers
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }
  
  // Handle worker deaths and restart
  cluster.on('exit', (worker, code, signal) => {
    logger.error(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
    setTimeout(() => {
      cluster.fork();
    }, 1000);
  });
  
  // Graceful reload on SIGUSR2
  process.on('SIGUSR2', () => {
    logger.info('Received SIGUSR2, reloading workers...');
    const workers = Object.values(cluster.workers);
    
    const restartWorker = (i) => {
      if (i >= workers.length) return;
      
      const worker = workers[i];
      const newWorker = cluster.fork();
      
      newWorker.on('listening', () => {
        worker.disconnect();
        setTimeout(() => {
          if (!worker.isDead()) worker.kill();
          restartWorker(i + 1);
        }, 5000);
      });
    };
    
    restartWorker(0);
  });
  
} else {
  // Worker process or single instance mode
  startServer();
}

async function startServer() {
  console.log('🛡️ Resilient LLM Router Server Starting...\n');
  
  // Initialize error handler
  const errorHandler = new ErrorHandler({
    maxRetries: 5,
    autoRestart: true,
    healthCheckInterval: 30000,
    errorLogPath: './logs/errors.json'
  });
  
  // Initialize Express
  const app = express();
  
  // Trust proxy for proper IP logging
  app.set('trust proxy', true);
  
  // Request tracking
  app.use((req, res, next) => {
    req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.startTime = Date.now();
    res.setHeader('X-Request-ID', req.id);
    
    // Log request
    logger.info('Request received', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      ip: req.ip
    });
    
    // Track response
    res.on('finish', () => {
      const duration = Date.now() - req.startTime;
      logger.info('Request completed', {
        requestId: req.id,
        status: res.statusCode,
        duration
      });
    });
    
    next();
  });
  
  // Health check (no middleware needed)
  // Health check endpoint (support both paths for compatibility)
  const healthHandler = (req, res) => {
    const health = {
      status: isReady ? 'healthy' : 'initializing',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      pid: process.pid,
      memory: process.memoryUsage(),
      errorHandler: errorHandler.getStats(),
      selfHealing: selfHealingMonitor?.getMetrics()
    };
    
    res.status(isReady ? 200 : 503).json(health);
  };
  
  // Register health check on both paths for compatibility
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);
  
  // CORS
  app.use(cors());
  
  // Body parsing with error handling
  app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf.toString('utf8');
    }
  }));
  
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  
  // Static files
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/chat', express.static(path.join(__dirname, 'public', 'chat')));
  
  // Initialize LLM Router with error recovery
  let router;
  let isReady = false;
  let selfHealingMonitor;
  
  async function initializeRouter(retry = 0) {
    try {
      logger.info(`Initializing LLM Router (attempt ${retry + 1})...`);
      
      router = new LLMRouter({
        maxConcurrent: parseInt(process.env.MAX_CONCURRENT || '10'),
        strategy: process.env.ROUTING_STRATEGY || 'balanced',
        cacheEnabled: process.env.CACHE_ENABLED === 'true',
        cacheTTL: parseInt(process.env.CACHE_TTL || '300000')
      });
      
      // Setup error handling for router
      router.on('error', (error) => {
        logger.error('Router error:', error);
        errorHandler.handleCriticalError(error, 'router');
      });
      
      await router.initialize();
      
      // Initialize self-healing monitor
      selfHealingMonitor = new SelfHealingMonitor(router, {
        checkInterval: 10000,
        autoHeal: true
      });
      
      // Connect self-healing to error handler
      selfHealingMonitor.on('status-change', (status) => {
        if (status === 'critical') {
          errorHandler.handleCriticalError(
            new Error('System in critical state'),
            'self-healing'
          );
        }
      });
      
      isReady = true;
      logger.info('✅ LLM Router initialized successfully');
      
    } catch (error) {
      logger.error(`Failed to initialize router (attempt ${retry + 1}):`, error);
      
      if (retry < 3) {
        logger.info(`Retrying in ${(retry + 1) * 5} seconds...`);
        await new Promise(resolve => setTimeout(resolve, (retry + 1) * 5000));
        return initializeRouter(retry + 1);
      }
      
      // Max retries exceeded
      errorHandler.handleCriticalError(error, 'initialization');
      process.exit(1);
    }
  }
  
  // API Key Authentication
  const authenticateApiKey = (req, res, next) => {
    if (API_KEYS.size === 0) {
      return next();
    }
    
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'API key required',
        message: 'Please provide an API key in the x-api-key header'
      });
    }
    
    if (!API_KEYS.has(apiKey)) {
      return res.status(401).json({ 
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      });
    }
    
    req.apiKey = apiKey;
    next();
  };
  
  // Circuit breaker middleware
  const circuitBreaker = (() => {
    let failures = 0;
    let lastFailTime = 0;
    const threshold = 5;
    const timeout = 60000; // 1 minute
    
    return (req, res, next) => {
      if (failures >= threshold) {
        if (Date.now() - lastFailTime < timeout) {
          return res.status(503).json({
            error: 'Circuit breaker open',
            message: 'Service temporarily unavailable due to high error rate'
          });
        } else {
          // Reset circuit breaker
          failures = 0;
        }
      }
      
      // Track failures
      const originalSend = res.send;
      res.send = function(data) {
        if (res.statusCode >= 500) {
          failures++;
          lastFailTime = Date.now();
        } else if (res.statusCode < 400) {
          // Success, reduce failure count
          failures = Math.max(0, failures - 1);
        }
        originalSend.call(this, data);
      };
      
      next();
    };
  })();
  
  // Apply circuit breaker to API routes
  app.use('/api', circuitBreaker);
  
  // API Status endpoint
  app.get('/api/status', authenticateApiKey, async (req, res) => {
    if (!isReady) {
      return res.status(503).json({ 
        error: 'Service unavailable',
        message: 'Router is still initializing' 
      });
    }
    
    try {
      const status = {
        ...router.getStatus(),
        selfHealing: selfHealingMonitor.getMetrics(),
        errorStats: errorHandler.getStats()
      };
      
      res.json(status);
    } catch (error) {
      logger.error('Status endpoint error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        requestId: req.id
      });
    }
  });
  
  // Get available models
  app.get('/api/models', authenticateApiKey, async (req, res) => {
    if (!isReady) {
      return res.status(503).json({ 
        error: 'Service unavailable',
        message: 'Router is still initializing' 
      });
    }
    
    try {
      const models = router.registry.getAll();
      res.json({
        count: models.length,
        models: models.map(m => ({
          id: m.id,
          name: m.name,
          format: m.format,
          loaded: m.loaded,
          capabilities: m.capabilities
        }))
      });
    } catch (error) {
      logger.error(`Failed to get models: ${error.message}`, { requestId: req.id });
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'Failed to retrieve models',
        requestId: req.id
      });
    }
  });
  
  // Inference endpoint with timeout and retry
  app.post('/api/inference', authenticateApiKey, async (req, res) => {
    if (!isReady) {
      return res.status(503).json({ 
        error: 'Service unavailable',
        message: 'Router is still initializing' 
      });
    }
    
    const { prompt, model, temperature = 0.7, maxTokens = 150, stream = false } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'Prompt is required'
      });
    }
    
    try {
      logger.info('Processing inference request', { 
        requestId: req.id,
        modelRequested: model
      });
      
      const startTime = Date.now();
      
      // Add timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Inference timeout')), 30000)
      );
      
      // Perform inference with timeout
      const result = await Promise.race([
        router.quick(prompt, {
          modelId: model,
          temperature,
          maxTokens,
          stream
        }),
        timeoutPromise
      ]);
      
      const processingTime = Date.now() - startTime;
      
      logger.info('Inference completed', { 
        requestId: req.id,
        processingTime,
        modelUsed: result.model
      });
      
      res.json({
        response: result.text || result,
        model: result.model,
        tokens: result.tokens,
        latency: result.latency,
        processingTime,
        requestId: req.id
      });
      
    } catch (error) {
      logger.error(`Inference failed: ${error.message}`, { 
        requestId: req.id,
        error: error.stack 
      });
      
      // Trigger error recovery
      errorHandler.handleCriticalError(error, 'inference');
      
      res.status(500).json({ 
        error: 'Inference failed',
        message: error.message || 'An error occurred during inference',
        requestId: req.id
      });
    }
  });
  
  // System diagnostics endpoint
  app.get('/api/diagnostics', authenticateApiKey, async (req, res) => {
    if (!selfHealingMonitor) {
      return res.status(503).json({ 
        error: 'Diagnostics unavailable'
      });
    }
    
    try {
      await selfHealingMonitor.performDiagnostics();
      const metrics = selfHealingMonitor.getMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ 
        error: 'Diagnostics failed',
        message: error.message
      });
    }
  });
  
  // Manual healing trigger
  app.post('/api/heal', authenticateApiKey, async (req, res) => {
    if (!selfHealingMonitor) {
      return res.status(503).json({ 
        error: 'Self-healing unavailable'
      });
    }
    
    try {
      await selfHealingMonitor.performDiagnostics();
      res.json({ 
        message: 'Healing initiated',
        metrics: selfHealingMonitor.getMetrics()
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Healing failed',
        message: error.message
      });
    }
  });
  
  // Error handling middleware
  app.use((err, req, res, next) => {
    logger.error('Unhandled error:', {
      error: err.message,
      stack: err.stack,
      requestId: req.id
    });
    
    // Let error handler process it
    errorHandler.handleCriticalError(err, 'express');
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred',
      requestId: req.id
    });
  });
  
  // Setup error handler event listeners
  errorHandler.on('shutdown', async (signal) => {
    logger.info(`Shutting down (${signal})...`);
    
    // Stop accepting new connections
    server.close();
    
    // Stop self-healing monitor
    if (selfHealingMonitor) {
      selfHealingMonitor.stop();
    }
    
    // Cleanup router
    if (router) {
      await router.cleanup();
    }
    
    // Signal completion
    errorHandler.emit('shutdown-complete');
  });
  
  errorHandler.on('reload', async () => {
    logger.info('Reloading configuration...');
    
    // Reload router configuration
    if (router) {
      await initializeRouter();
    }
  });
  
  errorHandler.on('clear-cache', () => {
    if (router) {
      router.clearCache?.();
    }
  });
  
  // Start server
  const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`
✅ Resilient Server ready!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️  Process ID:     ${process.pid}
🌐 Local:          http://localhost:${PORT}
🌍 Network:        http://178.156.181.117:${PORT}
💬 Chat UI:        http://178.156.181.117:${PORT}/chat/
📊 Health:         http://178.156.181.117:${PORT}/health
📚 API Status:     http://178.156.181.117:${PORT}/api/status
🏥 Diagnostics:    http://178.156.181.117:${PORT}/api/diagnostics
🔧 Manual Heal:    http://178.156.181.117:${PORT}/api/heal
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
    
    // Initialize router with retry logic
    await initializeRouter();
  });
  
  // Handle server errors
  server.on('error', (error) => {
    logger.error('Server error:', error);
    errorHandler.handleCriticalError(error, 'server');
  });
}

// Export for testing
export default startServer;