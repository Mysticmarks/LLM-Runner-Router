/**
 * 🔒 LLM Router Secure Production Server
 * Enhanced with authentication, rate limiting, and security headers
 */

import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import dotenv from 'dotenv';
import { LLMRouter } from './src/index.js';
import { GGUFLoader } from './src/loaders/GGUFLoader.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import winston from 'winston';
import Joi from 'joi';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env' });

// Validate required environment variables
const REQUIRED_ENV = [
  'NODE_ENV',
  'ALLOWED_ORIGINS',
  'API_KEYS'
];

REQUIRED_ENV.forEach(key => {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

const PORT = process.env.PORT || 3000;
const API_KEYS = new Set(process.env.API_KEYS.split(',').map(k => k.trim()));
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());

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
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ] : [])
  ]
});

console.log('🔒 Secure LLM Router Server Starting...\n');

// Initialize Express
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const inferenceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 inference requests per minute
  message: 'Inference rate limit exceeded. Please wait before making more requests.',
});

app.use('/api/', generalLimiter);
app.use('/api/inference', inferenceLimiter);

// API Key Authentication Middleware
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!apiKey) {
    logger.warn('Request without API key');
    return res.status(401).json({ 
      error: 'API key required',
      message: 'Please provide an API key in the x-api-key header'
    });
  }
  
  if (!API_KEYS.has(apiKey)) {
    logger.warn(`Invalid API key attempt: ${apiKey.substring(0, 8)}...`);
    return res.status(401).json({ 
      error: 'Invalid API key',
      message: 'The provided API key is not valid'
    });
  }
  
  req.apiKey = apiKey;
  next();
};

// Input validation schemas
const inferenceSchema = Joi.object({
  prompt: Joi.string().min(1).max(1000).required(),
  model: Joi.string().optional(),
  temperature: Joi.number().min(0).max(2).default(0.7),
  maxTokens: Joi.number().min(1).max(500).default(150),
  strategy: Joi.string().valid('balanced', 'quality-first', 'speed-priority', 'cost-optimized').default('balanced'),
  stream: Joi.boolean().default(false)
});

// Request ID middleware for tracking
app.use((req, res, next) => {
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Create router instance
const router = new LLMRouter({ 
  autoInit: false,
  strategy: process.env.ROUTING_STRATEGY || 'balanced',
  maxConcurrent: parseInt(process.env.MAX_CONCURRENT || '10'),
  cacheEnabled: process.env.CACHE_ENABLED !== 'false',
  cacheTTL: parseInt(process.env.CACHE_TTL || '300000')
});

// Global state
let isReady = false;
let loadError = null;

/**
 * Initialize the router with security constraints
 */
async function initializeRouter() {
  try {
    logger.info('Initializing secure router...');
    
    // Register loaders
    router.registry.registerLoader('gguf', new GGUFLoader());
    logger.info('GGUF loader registered');
    
    // Initialize the router
    await router.initialize();
    logger.info('Router initialized');
    
    // Load models from registry with size constraints
    const projectRoot = path.resolve(__dirname, '..', '..');
    const registryPath = path.join(projectRoot, 'models', 'registry.json');
    const MAX_MODEL_SIZE = parseInt(process.env.MAX_MODEL_SIZE || '2000000000'); // 2GB default

    try {
      const registryData = await fs.readFile(registryPath, 'utf8');
      const registry = JSON.parse(registryData);

      logger.info(`Loading ${registry.models?.length || 0} models from registry...`);

      for (const modelConfig of registry.models || []) {
        try {
          const relativeSource = modelConfig.path || modelConfig.source || '';
          const modelPath = path.isAbsolute(relativeSource)
            ? relativeSource
            : path.join(projectRoot, 'models', relativeSource);
          const stats = await fs.stat(modelPath).catch(() => null);

          if (stats) {
            if (stats.size > MAX_MODEL_SIZE) {
              logger.warn(`Model ${modelConfig.name} exceeds size limit (${stats.size} > ${MAX_MODEL_SIZE})`);
              continue;
            }

            logger.info(`Loading model: ${modelConfig.name}`);
            const model = await router.load({
              source: modelPath,
              format: modelConfig.format,
              id: modelConfig.id,
              name: modelConfig.name,
              ...modelConfig.parameters
            });
            logger.info(`Loaded model: ${modelConfig.name} (${model.id})`);
          } else {
            logger.warn(`Model file not found: ${modelPath}`);
          }
        } catch (error) {
          logger.error(`Failed to load model ${modelConfig.name}:`, error);
        }
      }
    } catch (error) {
      logger.warn('No registry file found or invalid JSON');
    }
    
    isReady = true;
    const status = router.getStatus();
    logger.info('Server ready', {
      modelsLoaded: status.modelsLoaded,
      engine: status.engine,
      strategy: router.router.config.strategy
    });
    
  } catch (error) {
    loadError = error;
    logger.error('Router initialization failed:', error);
    throw error;
  }
}

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  const health = {
    status: isReady ? 'healthy' : 'initializing',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    ...(isReady && {
      router: router.getStatus()
    })
  };
  
  res.status(isReady ? 200 : 503).json(health);
});

// API Routes with authentication
app.get('/api/status', authenticateApiKey, (req, res) => {
  if (!isReady) {
    return res.status(503).json({ 
      error: 'Service unavailable',
      message: 'Router is still initializing' 
    });
  }
  
  res.json(router.getStatus());
});

app.get('/api/models', authenticateApiKey, (req, res) => {
  if (!isReady) {
    return res.status(503).json({ 
      error: 'Service unavailable',
      message: 'Router is still initializing' 
    });
  }
  
  const models = router.registry.list();
  res.json({ models });
});

app.post('/api/inference', authenticateApiKey, async (req, res) => {
  const requestId = req.id;
  
  // Validate input
  const { error, value } = inferenceSchema.validate(req.body);
  if (error) {
    logger.warn(`Invalid inference request: ${error.message}`, { requestId });
    return res.status(400).json({ 
      error: 'Invalid request',
      details: error.details.map(d => d.message)
    });
  }
  
  if (!isReady) {
    return res.status(503).json({ 
      error: 'Service unavailable',
      message: 'Router is still initializing' 
    });
  }
  
  try {
    logger.info('Processing inference request', { 
      requestId,
      apiKey: req.apiKey.substring(0, 8) + '...',
      strategy: value.strategy
    });
    
    const startTime = Date.now();
    
    // Route and process
    const result = await router.route(value.prompt, {
      temperature: value.temperature,
      maxTokens: value.maxTokens,
      strategy: value.strategy,
      stream: value.stream,
      modelId: value.model
    });
    
    const processingTime = Date.now() - startTime;
    
    logger.info('Inference completed', {
      requestId,
      processingTime,
      modelUsed: result.model,
      tokensGenerated: result.usage?.totalTokens
    });
    
    res.json({
      requestId,
      ...result,
      processingTime
    });
    
  } catch (error) {
    logger.error('Inference error:', { 
      requestId,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'Inference failed',
      message: process.env.NODE_ENV === 'production' 
        ? 'An error occurred during inference'
        : error.message,
      requestId
    });
  }
});

// Static file serving for UI (with security headers)
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  dotfiles: 'deny',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (path.match(/\.(js|css|woff2?)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Serve chat interface (no auth for demo)
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat', 'index.html'));
});

// 404 handler
app.use((req, res) => {
  logger.warn(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: 'Not found',
    message: 'The requested endpoint does not exist'
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    requestId: req.id
  });
  
  res.status(err.status || 500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred'
      : err.message,
    requestId: req.id
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  // Clean up router resources
  if (router) {
    await router.cleanup().catch(err => {
      logger.error('Error during router cleanup:', err);
    });
  }
  
  // Force exit after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const server = app.listen(PORT, async () => {
  console.log(`\n🔒 Secure LLM Router Server`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔑 API Keys: ${API_KEYS.size} configured`);
  console.log(`🌐 CORS Origins: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`\n🚀 Endpoints:`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Chat UI: http://localhost:${PORT}/chat`);
  console.log(`   API Status: http://localhost:${PORT}/api/status`);
  console.log(`   API Models: http://localhost:${PORT}/api/models`);
  console.log(`   API Inference: http://localhost:${PORT}/api/inference`);
  console.log(`\n⚡ Initializing router...\n`);
  
  try {
    await initializeRouter();
    console.log('\n✅ Secure server ready for production!\n');
  } catch (error) {
    console.error('\n❌ Failed to initialize router:', error.message);
    console.error('Server will continue running but inference will not be available.\n');
  }
});

export default app;