/**
 * 🌐 LLM Router HTTP Server - For Development/Testing
 * Simplified version without strict HTTPS requirements
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { LLMRouter } from './src/index.js';
import { ErrorHandler } from './src/core/ErrorHandler.js';
import { SelfHealingMonitor } from './src/core/SelfHealingMonitor.js';
import { modelDownloader } from './src/services/ModelDownloader.js';
import path from 'path';
import { fileURLToPath } from 'url';
import winston from 'winston';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env' });

const PORT = process.env.PORT || 3000;
const API_KEYS = new Set(process.env.API_KEYS?.split(',').map(k => k.trim()) || []);

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'llm-router' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

console.log('🌐 HTTP LLM Router Server Starting...\n');

// Initialize Express
const app = express();

// Simple CORS - allow all origins for testing
app.use(cors({
  origin: true,
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Add basic security headers (HTTP-friendly)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Don't set COOP/COEP headers for HTTP to avoid warnings
  next();
});

// Request ID middleware
app.use((req, res, next) => {
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Static files - serve public directory with proper MIME types
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Specifically serve chat directory
app.use('/chat', express.static(path.join(__dirname, 'public', 'chat')));

// Initialize error handling and self-healing
const errorHandler = new ErrorHandler({
  maxRetries: 5,
  autoRestart: true,
  healthCheckInterval: 30000,
  errorLogPath: './logs/errors.json'
});

// Initialize LLM Router
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
    logger.info('✅ LLM Router initialized successfully with self-healing');
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

// Health check endpoint
// Health check endpoints (both paths for compatibility)
const healthHandler = (req, res) => {
  res.json({
    status: isReady ? 'healthy' : 'initializing',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    router: isReady ? {
      initialized: true,
      engine: router?.engine?.type || 'unknown',
      modelsLoaded: router?.registry?.getModelCount() || 0,
      environment: router?.environment || 'unknown',
      memoryUsage: process.memoryUsage()
    } : { initialized: false },
    errorHandler: errorHandler.getStats(),
    selfHealing: selfHealingMonitor?.getMetrics()
  });
};

// Register health check on both paths for compatibility
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Chat interface will be served by the static middleware above

// API Key Authentication (optional for testing)
const authenticateApiKey = (req, res, next) => {
  // Skip auth if no API keys are configured
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

// API status endpoint
app.get('/api/status', authenticateApiKey, (req, res) => {
  if (!isReady) {
    return res.status(503).json({ 
      error: 'Service unavailable',
      message: 'Router is still initializing' 
    });
  }
  
  res.json({
    initialized: true,
    engine: router.engine?.type || 'unknown',
    modelsLoaded: router.registry?.getModelCount() || 0,
    environment: router.environment || 'unknown',
    memoryUsage: process.memoryUsage()
  });
});

// Get available models (no auth for admin panel)
app.get('/api/models', async (req, res) => {
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

// Inference endpoint with timeout and retry (no auth for demo)
app.post('/api/inference', async (req, res) => {
  if (!isReady) {
    return res.status(503).json({ 
      error: 'Service unavailable',
      message: 'Router is still initializing' 
    });
  }
  
  // Extract parameters from request, with fallbacks to global config
  const config = global.userConfig || {};
  const { 
    prompt, 
    model = config.activeModel,
    temperature = config.parameters?.temperature || 0.7, 
    maxTokens = config.parameters?.maxTokens || 150,
    topP = config.parameters?.topP,
    topK = config.parameters?.topK,
    repetitionPenalty = config.parameters?.repetitionPenalty,
    presencePenalty = config.advanced?.presencePenalty,
    frequencyPenalty = config.advanced?.frequencyPenalty,
    seed = config.advanced?.seed,
    stream = config.behavior?.streamResponses || false,
    stopSequences = req.body.stopSequences || config.templateSettings?.stopSequences
  } = req.body;
  
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
    
    // Add timeout protection
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Inference timeout')), 30000)
    );
    
    // Perform inference with timeout
    const result = await Promise.race([
      router.quick(prompt, {
        modelId: model,
        temperature,
        maxTokens,
        topP,
        topK,
        repetitionPenalty,
        presencePenalty,
        frequencyPenalty,
        seed,
        stream,
        stopSequences
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

// System diagnostics endpoint (no auth for admin panel)
app.get('/api/diagnostics', async (req, res) => {
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

// Configuration management endpoints
app.get('/api/config', async (req, res) => {
  try {
    // For now, return empty config - client will use localStorage
    // In production, this would load from a database or config file
    res.json({});
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to load configuration',
      message: error.message
    });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const config = req.body;
    
    // Store config in memory for this session
    // In production, this would save to a database
    global.userConfig = config;
    
    logger.info('Configuration updated', { 
      activeModel: config.activeModel,
      systemPromptLength: config.systemPrompt?.length || 0
    });
    
    res.json({ 
      success: true, 
      message: 'Configuration saved'
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to save configuration',
      message: error.message
    });
  }
});

// Model management endpoints
app.post('/api/models/load', async (req, res) => {
  const { modelId, path } = req.body;
  
  try {
    if (!isReady) {
      return res.status(503).json({ 
        error: 'Service unavailable',
        message: 'Router is still initializing' 
      });
    }
    
    // Load the model
    const model = await router.load({
      source: path || modelId,
      type: 'gguf',
      id: modelId
    });
    
    res.json({ 
      success: true, 
      message: `Model ${modelId} loaded successfully`,
      model 
    });
  } catch (error) {
    logger.error(`Failed to load model: ${error.message}`);
    res.status(500).json({ 
      error: 'Failed to load model',
      message: error.message
    });
  }
});

app.post('/api/models/unload', async (req, res) => {
  const { modelId } = req.body;
  
  try {
    // Unload model from registry
    if (router && router.registry) {
      const model = router.registry.get(modelId);
      if (model) {
        // Unload the model if it has unload method
        if (model.unload) {
          await model.unload();
        }
        // Remove from registry using delete method
        router.registry.models.delete(modelId);
      }
    }
    
    logger.info(`Unloaded model: ${modelId}`);
    res.json({ 
      success: true, 
      message: `Model ${modelId} unloaded`
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to unload model',
      message: error.message
    });
  }
});

app.post('/api/models/switch', async (req, res) => {
  const { modelId } = req.body;
  
  try {
    // Set the active model for inference
    if (router) {
      router.defaultModelId = modelId;
    }
    
    logger.info(`Switched to model: ${modelId}`);
    res.json({ 
      success: true, 
      message: `Switched to model ${modelId}`
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to switch model',
      message: error.message
    });
  }
});

// Model download endpoints
app.post('/api/models/download', async (req, res) => {
  const { modelId, url } = req.body;
  
  try {
    logger.info(`Starting download: ${modelId} from ${url}`);
    
    // Start download (async, returns immediately)
    modelDownloader.download(modelId, url).catch(err => {
      logger.error(`Download failed: ${err.message}`);
    });
    
    res.json({ 
      success: true, 
      message: `Download started for ${modelId}`
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to start download',
      message: error.message
    });
  }
});

// Get download progress
app.get('/api/models/download/progress', async (req, res) => {
  try {
    const downloads = modelDownloader.getActiveDownloads();
    res.json({ downloads });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get download progress',
      message: error.message
    });
  }
});

// List downloaded models
app.get('/api/models/downloaded', async (req, res) => {
  try {
    const models = await modelDownloader.listDownloaded();
    res.json({ models });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to list downloaded models',
      message: error.message
    });
  }
});

// Delete a model
app.delete('/api/models/:modelId', async (req, res) => {
  const { modelId } = req.params;
  
  try {
    // First unload if loaded
    if (router && router.registry) {
      const model = router.registry.get(modelId);
      if (model) {
        if (model.unload) await model.unload();
        router.registry.models.delete(modelId);
      }
    }
    
    // Delete from disk
    const deleted = await modelDownloader.deleteModel(modelId);
    
    if (deleted) {
      res.json({ 
        success: true, 
        message: `Model ${modelId} deleted`
      });
    } else {
      res.status(404).json({ 
        error: 'Model not found',
        message: `Model ${modelId} not found on disk`
      });
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to delete model',
      message: error.message
    });
  }
});

// Get storage info
app.get('/api/models/storage', async (req, res) => {
  try {
    const used = await modelDownloader.getStorageUsed();
    const models = await modelDownloader.listDownloaded();
    
    res.json({ 
      used,
      usedMB: (used / 1024 / 1024).toFixed(2),
      usedGB: (used / 1024 / 1024 / 1024).toFixed(2),
      modelCount: models.length
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get storage info',
      message: error.message
    });
  }
});

// Configuration endpoints (no auth for admin panel)
app.get('/api/config', async (req, res) => {
  try {
    const config = {
      activeModel: 'auto',
      routingStrategy: process.env.ROUTING_STRATEGY || 'balanced',
      systemPrompt: '',
      parameters: {
        temperature: 0.7,
        maxTokens: 500,
        topP: 0.9,
        topK: 40,
        repetitionPenalty: 1.1,
        contextSize: 2048
      },
      behavior: {
        useSystemPrompt: true,
        maintainContext: false,
        streamResponses: true,
        showTokenCount: false,
        enableCache: process.env.CACHE_ENABLED === 'true'
      }
    };
    res.json(config);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get configuration',
      message: error.message
    });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    // In a real implementation, save config to database or file
    logger.info('Configuration updated', req.body);
    res.json({ success: true, message: 'Configuration saved' });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to save configuration',
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
  logger.error('Unhandled error:', err);
  
  // Let error handler process it
  errorHandler.handleCriticalError(err, 'express');
  
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred',
    requestId: req.id
  });
});

// Start server
let server;
async function startServer() {
  await initializeRouter();
  
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`
✅ HTTP Server ready with Self-Healing!
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
🔄 Self-healing enabled with auto-recovery
⚡ Error handling with retry strategies
📈 Health monitoring every 30 seconds
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  });
  
  // Handle server errors
  server.on('error', (error) => {
    logger.error('Server error:', error);
    errorHandler.handleCriticalError(error, 'server');
  });
}

// Setup error handler event listeners
errorHandler.on('shutdown', async (signal) => {
  logger.info(`Shutting down (${signal})...`);
  
  // Stop accepting new connections
  if (server) {
    server.close();
  }
  
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
  if (router && router.clearCache) {
    router.clearCache();
  }
});

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await errorHandler.gracefulShutdown('SIGTERM');
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await errorHandler.gracefulShutdown('SIGINT');
});

// Handle reload signal
process.on('SIGHUP', async () => {
  logger.info('SIGHUP received, reloading...');
  await errorHandler.reload('SIGHUP');
});

// Start the server
startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});