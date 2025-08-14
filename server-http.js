/**
 * 🌐 LLM Router HTTP Server - For Development/Testing
 * Simplified version without strict HTTPS requirements
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { LLMRouter } from './src/index.js';
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

// Initialize LLM Router
let router;
let isReady = false;

async function initializeRouter() {
  try {
    logger.info('Initializing LLM Router...');
    router = new LLMRouter({
      maxConcurrent: parseInt(process.env.MAX_CONCURRENT || '10'),
      strategy: process.env.ROUTING_STRATEGY || 'balanced',
      cacheEnabled: process.env.CACHE_ENABLED === 'true',
      cacheTTL: parseInt(process.env.CACHE_TTL || '300000')
    });
    
    await router.initialize();
    isReady = true;
    logger.info('✅ LLM Router initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize router:', error);
    process.exit(1);
  }
}

// Health check endpoint
// Health check endpoints (both paths for compatibility)
const healthHandler = (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    router: isReady ? {
      initialized: true,
      engine: router?.engine?.type || 'unknown',
      modelsLoaded: router?.registry?.getModelCount() || 0,
      environment: router?.environment || 'unknown',
      memoryUsage: process.memoryUsage()
    } : { initialized: false }
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

// Inference endpoint
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
    
    // Route and process
    const result = await router.quick(prompt, {
      modelId: model,
      temperature,
      maxTokens,
      stream
    });
    
    const processingTime = Date.now() - startTime;
    
    logger.info('Inference completed', { 
      requestId: req.id,
      processingTime,
      modelUsed: result.model
    });
    
    res.json({
      response: result.text,
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
    
    res.status(500).json({ 
      error: 'Inference failed',
      message: error.message || 'An error occurred during inference',
      requestId: req.id
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred',
    requestId: req.id
  });
});

// Start server
async function startServer() {
  await initializeRouter();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
✅ HTTP Server ready!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Local:      http://localhost:${PORT}
🌍 Network:    http://178.156.181.117:${PORT}
💬 Chat UI:    http://178.156.181.117:${PORT}/chat/
📊 Health:     http://178.156.181.117:${PORT}/health
📚 API Docs:   http://178.156.181.117:${PORT}/api/status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  });
}

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  if (router) {
    await router.cleanup();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  if (router) {
    await router.cleanup();
  }
  process.exit(0);
});

// Start the server
startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});