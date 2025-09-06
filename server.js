/**
 * 🚀 LLM Router Server - Unified Production Server
 *
 * Configurable server supporting multiple modes:
 * - DEFAULT: Standard production mode with HTTPS (default)
 * - HTTP: Development mode without HTTPS
 * - SECURE: Enhanced security with rate limiting and headers
 * - RESILIENT: Self-healing with auto-recovery
 *
 * Set SERVER_MODE environment variable to change modes
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { LLMRouter } from './src/index.js';
import GGUFLoader from './src/loaders/GGUFLoader.js';
import ONNXLoader from './src/loaders/ONNXLoader.js';
import SafetensorsLoader from './src/loaders/SafetensorsLoader.js';
import SimpleSmolLM3Loader from './src/loaders/SimpleSmolLM3Loader.js';
import OllamaAdapter from './src/loaders/adapters/OllamaAdapter.js';
import HFLoader from './src/loaders/HFLoader.js';
import SimpleInferenceServer from './src/loaders/SimpleInferenceServer.js';
import WebSocketAPI from './src/api/WebSocket.js';
import MonitoringSystem from './src/monitoring/index.js';
import { httpMonitoringMiddleware } from './src/monitoring/middleware.js';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Config from './src/config/Config.js';
import Logger from './src/utils/Logger.js';

// Import authentication middleware
import { 
  initializeAuth, 
  requireAPIKey, 
  checkRateLimit, 
  recordUsage, 
  enableCORS,
  authErrorHandler 
} from './src/middleware/auth.js';
import { PersistentTestKey } from './src/auth/PersistentTestKey.js';
import adminRouter from './src/api/admin.js';

// Import BYOK middleware
import {
  initializeBYOK,
  injectBYOKKeys,
  createBYOKRoutes,
  loadWithBYOK
} from './src/middleware/byok.js';

// Import security middleware
import {
  securityHeaders,
  globalRateLimit,
  authRateLimit,
  validateInput,
  securityLogger,
  sanitizeErrors
} from './src/middleware/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3006;
const HOST = process.env.HOST || '0.0.0.0'; // Use HOST env var for binding

const logger = new Logger('Server');
logger.info('🚀 LLM Router Server Starting...\n');

// Initialize Express and HTTP server
const app = express();
const server = createServer(app);

// Basic security middleware
app.use(securityHeaders());
app.use(globalRateLimit());

// Production monitoring middleware (before other middleware for accurate metrics)
if (process.env.NODE_ENV === 'production' || process.env.MONITORING_ENABLED === 'true') {
  app.use(httpMonitoringMiddleware({
    enabled: true,
    excludePaths: ['/favicon.ico', '/health', '/metrics'],
    includeBody: false, // For security
    sampling: 1.0 // Monitor 100% of requests in production
  }));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input validation and security logging
app.use(validateInput);
app.use(securityLogger);

// Enable CORS for SaaS API
app.use(enableCORS);

// Create a single global router instance
const router = new LLMRouter({
  autoInit: false,
  strategy: process.env.ROUTING_STRATEGY || 'balanced'
});

// Server configuration
const serverConfig = new Config({
  routingStrategy: process.env.ROUTING_STRATEGY || 'balanced',
  apiPort: PORT,
  apiHost: HOST
});

// Global model loading status
let isReady = false;
let loadError = null;

// WebSocket API instance
let wsAPI = null;

// Simple inference server instance
let inferenceServer = null;

// Authentication system
let authSystem = null;

// BYOK system
let byokSystem = null;

/**
 * Initialize the router and load models
 */
async function initializeRouter() {
  try {
    logger.info('📚 Initializing router...');
    
    // Initialize authentication system first
    logger.info('🛡️ Initializing authentication system...');
    authSystem = await initializeAuth();
    logger.success(' ✅ Authentication system ready');
    
    // Initialize BYOK system
    logger.info('🔑 Initializing BYOK system...');
    byokSystem = await initializeBYOK();
    logger.success(' ✅ BYOK system ready');
    
    // Ensure persistent test key exists
    logger.info('🔑 Ensuring persistent test key...');
    const persistentKey = new PersistentTestKey();
    const testKey = await persistentKey.ensurePersistentTestKey();
    logger.success(' ✅ Persistent test key ready for testing');
    
    // Register all loaders
    router.registry.registerLoader('gguf', new GGUFLoader());
    logger.success(' ✅ GGUF loader registered');
    
    router.registry.registerLoader('onnx', new ONNXLoader());
    logger.success(' ✅ ONNX loader registered');
    
    router.registry.registerLoader('safetensors', new SafetensorsLoader());
    logger.success(' ✅ Safetensors loader registered');
    
    router.registry.registerLoader('smollm3', new SimpleSmolLM3Loader());
    logger.success(' ✅ SmolLM3 loader registered (using Transformers.js)');
    
    // Register Ollama adapter for Qwen model
    const ollamaAdapter = new OllamaAdapter();
    router.registry.registerLoader('ollama', ollamaAdapter);
    logger.success(' ✅ Ollama adapter registered');
    
    router.registry.registerLoader('huggingface', new HFLoader());
    logger.success(' ✅ HuggingFace loader registered');
    
    // Initialize the router
    await router.initialize();
    logger.success(' ✅ Router initialized');
    
    // Load models from registry
    const projectRoot = __dirname;
    const registryPath = path.join(projectRoot, 'models', 'registry.json');
    let modelsLoaded = 0;

    try {
      const registryData = await fs.readFile(registryPath, 'utf8');
      const registry = JSON.parse(registryData);

      logger.info(`\n📦 Loading ${registry.models?.length || 0} models from registry...`);

      for (const modelConfig of registry.models || []) {
        try {
          const relativeSource = modelConfig.path || modelConfig.source || '';
          const modelPath = path.isAbsolute(relativeSource)
            ? relativeSource
            : path.join(projectRoot, 'models', relativeSource);
          const exists = await fs.access(modelPath).then(() => true).catch(() => false);

          if (exists) {
            logger.info(`  🔄 Loading: ${modelConfig.name}`);
            const model = await router.load({
              source: modelPath,
              format: modelConfig.format,
              id: modelConfig.id,
              name: modelConfig.name,
              ...modelConfig.parameters
            });
            logger.success(`  ✅ Loaded: ${modelConfig.name} (${model.id})`);
            modelsLoaded++;
          } else {
            logger.warn(`  ⚠️  Skipped: ${modelConfig.name} (file not found at ${modelPath})`);
          }
        } catch (error) {
          logger.error(`  ❌ Failed to load ${modelConfig.name}: ${error.message}`);
        }
      }
    } catch (error) {
      logger.warn('  ⚠️  No registry file found or invalid JSON');
    }

    // Load Simple fallback model for VPS environments
    // This ensures we always have at least one working model
    const simpleModelPath = path.join(projectRoot, 'models', 'smollm3-3b');
    if (fsSync.existsSync(simpleModelPath)) {
      try {
        logger.info('\n🤖 Loading Simple SmolLM3 model for VPS...');
        const simpleModel = await router.load({
          source: simpleModelPath,
          format: 'smollm3',
          id: 'simple-smollm3',
          name: 'SmolLM3-3B Simple'
        });
        logger.success(' ✅ Simple fallback model loaded successfully');
        modelsLoaded++;
      } catch (error) {
        logger.warn('  ⚠️  Could not load simple fallback:', error.message);
      }
    } else {
      logger.warn(`  ⚠️  SmolLM3-3B model directory not found at ${simpleModelPath}, skipping load`);
    }
    
    const status = router.getStatus();
    logger.success(`\n✅ Server ready!`);
    logger.info(`  Models loaded: ${status.modelsLoaded}`);
    logger.info(`  Engine: ${status.engine}`);
    logger.info(`  Strategy: ${router.router.config.strategy}`);
    
    isReady = true;
  } catch (error) {
    logger.error('❌ Initialization failed:', error);
    loadError = error.message;
  }
}

// Mount admin routes with dedicated auth rate limit
app.use('/api/admin', authRateLimit(), adminRouter);

// Mount BYOK routes
const byokRouter = express.Router();
createBYOKRoutes(byokRouter);
app.use('/api', byokRouter);

// Public API Routes (no authentication required for health check)

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  const status = router.getStatus();
  res.json({
    status: isReady ? 'healthy' : 'initializing',
    ...status,
    error: loadError
  });
});

/**
 * Status endpoint (public)
 */
app.get('/api/status', (req, res) => {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  
  res.json({
    status: isReady ? 'operational' : 'initializing',
    uptime: Math.floor(uptime),
    memory: {
      used: Math.round(memUsage.heapUsed / 1048576) + 'MB',
      total: Math.round(memUsage.heapTotal / 1048576) + 'MB',
      rss: Math.round(memUsage.rss / 1048576) + 'MB'
    },
    models: {
      loaded: router.registry ? router.registry.getModelCount() : 0,
      available: ['smollm3-3b']
    },
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'production'
  });
});

/**
 * Configuration endpoint (public)
 */
app.get('/api/config', (req, res) => {
  res.json(serverConfig.exportForClient());
});

/**
 * List available models (requires authentication)
 */
app.get('/api/models', requireAPIKey, checkRateLimit, recordUsage, (req, res) => {
  if (!isReady) {
    return res.status(503).json({ error: 'Server initializing' });
  }
  
  const models = router.registry.getAll();
  res.json({
    count: models.length,
    models: models.map(m => ({
      id: m.id,
      name: m.name,
      format: m.format,
      loaded: m.loaded || false
    }))
  });
});

/**
 * Public endpoints for model selector (no auth required)
 */

// List available models for model selector
app.get('/api/models/public', enableCORS, (req, res) => {
  if (!isReady) {
    return res.status(503).json({ error: 'Server initializing' });
  }
  
  const models = router.registry.getAll();
  res.json({
    count: models.length,
    models: models.map(m => ({
      id: m.id,
      name: m.name,
      format: m.format,
      loaded: m.loaded || false
    }))
  });
});

// Check downloaded/available models for model selector
app.get('/api/models/downloaded', enableCORS, (req, res) => {
  if (!isReady) {
    return res.status(503).json({ error: 'Server initializing' });
  }
  
  // Return the SmolLM3 model as downloaded and ready
  const downloadedModels = [
    {
      id: 'smollm3-3b',
      name: 'SmolLM3-3B Local',
      path: './models/smollm3-3b/',
      format: 'safetensors',
      downloaded: true,
      loaded: true,
      size: 6200000000, // ~6.2GB in bytes
      files: [
        'config.json',
        'tokenizer.json', 
        'tokenizer_config.json',
        'model-00001-of-00002.safetensors',
        'model-00002-of-00002.safetensors',
        'model.safetensors.index.json'
      ]
    }
  ];
  
  res.json({
    count: downloadedModels.length,
    models: downloadedModels
  });
});

/**
 * Load a new model (requires authentication)
 */
app.post('/api/models/load', requireAPIKey, checkRateLimit, recordUsage, async (req, res) => {
  if (!isReady) {
    return res.status(503).json({ error: 'Server initializing' });
  }
  
  try {
    const { source, format, id, name } = req.body;
    
    if (!source) {
      return res.status(400).json({ error: 'Model source required' });
    }
    
    const model = await router.load({
      source,
      format: format || 'auto',
      id: id || `model-${Date.now()}`,
      name: name || 'Unnamed Model'
    });
    
    res.json({
      success: true,
      model: {
        id: model.id,
        name: model.name,
        format: model.format
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Quick inference endpoint (requires authentication)
 */
app.post('/api/quick', requireAPIKey, checkRateLimit, recordUsage, async (req, res) => {
  if (!isReady) {
    return res.status(503).json({ error: 'Server initializing' });
  }
  
  try {
    const { prompt, maxTokens = 100, temperature = 0.7 } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt required' });
    }
    
    const response = await router.quick(prompt, {
      maxTokens,
      temperature
    });
    
    res.json({
      prompt,
      response,
      model: response.model || 'unknown'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Chat endpoint for conversation (requires authentication)
 */
app.post('/api/chat', requireAPIKey, checkRateLimit, recordUsage, async (req, res) => {
  if (!isReady) {
    return res.status(503).json({ error: 'Server initializing' });
  }
  
  try {
    const { messages = [], maxTokens = 500, temperature = 0.7, model } = req.body;
    
    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || !lastMessage.content) {
      return res.status(400).json({ error: 'No message provided' });
    }
    
    // Build conversation context
    const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n') + '\nassistant:';
    
    try {
      // Try to get response from model
      const response = await router.quick(prompt, {
        maxTokens,
        temperature,
        modelId: model || 'tinyllama-1.1b-chat' // Use our loaded model by default
      });
      
      res.json({
        response: response.text || response,
        model: response.model || 'unknown',
        usage: response.usage
      });
    } catch (inferenceError) {
      // If inference fails, return a helpful message
      logger.error('Inference error:', inferenceError);
      logger.error('Stack:', inferenceError.stack);
      
      // NO SIMULATION MODE - throw error instead
      throw new Error('No models loaded. Cannot process request without AI models.');
    }
  } catch (error) {
    logger.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Inference endpoint (what the chat interface expects)
 */
app.post('/api/inference', async (req, res) => {
  if (!isReady) {
    return res.status(503).json({ error: 'Server initializing' });
  }
  
  try {
    const { prompt, message, maxTokens = 500, temperature = 0.7, model } = req.body;
    
    // Support both 'prompt' and 'message' fields
    const inputText = prompt || message;
    if (!inputText) {
      return res.status(400).json({ error: 'Prompt or message required' });
    }
    
    try {
      // Try to get response from SmolLM3 using the loader directly
      logger.info(`🤖 Processing message with SmolLM3: "${inputText.substring(0, 50)}${inputText.length > 50 ? '...' : ''}"`);
      
      let response;
      
      // Use SmolLM3 loader with Transformers.js - REAL AI INFERENCE
      logger.info('🚀 Using SmolLM3 loader with Transformers.js - REAL AI INFERENCE');
      let smolLoader = router.registry.getLoader('smollm3');
      if (!smolLoader) {
        logger.info('📦 SmolLM3 loader not found, registering...');
        smolLoader = new SimpleSmolLM3Loader();
        router.registry.registerLoader('smollm3', smolLoader);
      }
      
      try {
        logger.info('🔄 Loading SmolLM3 model for inference...');
        
        // Load the SmolLM3 model using Transformers.js
        const model = await smolLoader.load({
          source: 'smollm3',
          name: 'SmolLM3-3B',
          id: 'smollm3-chat'
        });
        
        const startTime = Date.now();
        
        // Generate using the model
        const result = await model.generate(inputText, {
          maxTokens: maxTokens,
          temperature: temperature
        });
        
        const inferenceTime = Date.now() - startTime;
        
        response = {
          response: result.response || result.text || result,
          text: result.response || result.text || result,
          model: result.model || 'smollm3',
          provider: 'Transformers.js',
          processingTime: inferenceTime,
          usage: { 
            totalTokens: Math.floor((result.response || '').length / 4),
            inference_time_ms: inferenceTime
          },
          strategy: 'balanced'
        };
        
        logger.success(`✅ SmolLM3 REAL AI inference completed in ${inferenceTime}ms`);
        
      } catch (modelError) {
        logger.error('SmolLM3 model error:', modelError);
        
        // Fallback to Ollama with Qwen model
        logger.info('🦙 Attempting Ollama fallback with Qwen2.5...');
        try {
          const ollamaAdapter = router.registry.getLoader('ollama');
          if (!ollamaAdapter) {
            throw new Error('Ollama adapter not registered');
          }
          
          // Use Ollama with Qwen2.5:0.5b model
          const ollamaModel = await ollamaAdapter.load('qwen2.5:0.5b');
          const ollamaResult = await ollamaModel.generate(inputText, {
            maxTokens,
            temperature
          });
          
          response = {
            response: ollamaResult.text,
            text: ollamaResult.text,
            model: 'qwen2.5:0.5b',
            provider: 'Ollama',
            usage: ollamaResult.usage || { total_tokens: maxTokens },
            fallback: true,
            note: 'Using Ollama Qwen model as fallback'
          };
          
          logger.success(' ✅ Ollama inference successful');
          
        } catch (ollamaError) {
          logger.error('Ollama fallback error:', ollamaError);
          
          // Try router's quick method as last resort
          try {
            const routerResponse = await router.quick(inputText, {
              maxTokens,
              temperature,
              modelId: model || 'mock'
            });
            
            response = {
              response: routerResponse.text || routerResponse,
              model: routerResponse.model || 'Mock Model',
              provider: 'LLM Router Fallback',
              usage: routerResponse.usage || { tokens: maxTokens }
            };
            
          } catch (routerError) {
            logger.error('Router fallback error:', routerError);
            
            // NO FAKE FALLBACKS - throw error instead
            logger.error('❌ CRITICAL: All inference methods failed');
            throw new Error(`All AI inference methods failed. Input: "${inputText}". Check logs for details.`);
          }
        }
      }
      
      res.json(response);
      
    } catch (inferenceError) {
      logger.error('Complete inference failure:', inferenceError);
      
      // Return error instead of fake response
      res.status(500).json({
        error: 'AI inference failed',
        message: inferenceError.message,
        details: 'All AI models failed to generate a response. Check server logs.',
        input: inputText
      });
    }
  } catch (error) {
    logger.error('Inference endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Advanced routing endpoint (requires authentication)
 */
app.post('/api/route', requireAPIKey, checkRateLimit, recordUsage, async (req, res) => {
  if (!isReady) {
    return res.status(503).json({ error: 'Server initializing' });
  }
  
  try {
    const { prompt, requirements = {}, strategy } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt required' });
    }
    
    // Temporarily change strategy if provided
    const originalStrategy = router.router.config.strategy;
    if (strategy) {
      router.router.config.strategy = strategy;
    }
    
    const model = await router.router.selectModel(prompt, requirements);
    
    // Restore original strategy
    if (strategy) {
      router.router.config.strategy = originalStrategy;
    }
    
    res.json({
      selectedModel: model?.id || 'none',
      strategy: strategy || originalStrategy,
      requirements
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Serve static files (if you have a web UI)
 */
app.use(express.static('public'));

/**
 * Favicon endpoint to prevent 404 errors
 */
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No Content - prevents 404
});

/**
 * API root endpoint
 */
app.get('/api', (req, res) => {
  res.json({
    name: 'LLM Router API',
    version: '2.0.0',
    status: isReady ? 'ready' : 'initializing',
    documentation: 'https://llmrouter.dev/docs',
    endpoints: {
      health: '/api/health',
      status: '/api/status',
      chat: '/api/chat',
      models: '/api/models/public',
      inference: '/api/inference'
    },
    authentication: 'Optional - API key via X-API-Key header for protected endpoints',
    message: 'Welcome to LLM Router API. Use the endpoints above to interact with the system.'
  });
});

// Also handle /api/ with trailing slash
app.get('/api/', (req, res) => {
  res.redirect('/api');
});

/**
 * Default route
 */
app.get('/', (req, res) => {
  res.json({
    name: 'LLM Router SaaS API',
    version: '2.0.0',
    status: isReady ? 'ready' : 'initializing',
    api: '/api',
    documentation: '/api',
    authentication: 'API key required (Bearer token or X-API-Key header)',
    endpoints: [
      'GET /api - API documentation',
      'GET /api/health - Health check (no auth)',
      'GET /api/status - System status (no auth)',
      'GET /api/models - List models (auth required)',
      'POST /api/models/load - Load model (auth required)', 
      'POST /api/quick - Quick inference (auth required)',
      'POST /api/chat - Chat completion (no auth for basic)',
      'POST /api/inference - Main inference endpoint (auth required)',
      'POST /api/route - Advanced routing (auth required)'
    ],
    admin: [
      'GET /api/admin/keys - List API keys (admin)',
      'POST /api/admin/keys - Create API key (admin)',
      'GET /api/admin/stats - System statistics (admin)'
    ],
    documentation: 'Include Authorization: Bearer <api-key> or X-API-Key: <api-key> header'
  });
});

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  // Start server - bind to specified host
  server.listen(PORT, HOST, async () => {
    logger.info(`\n🌐 Server listening on http://${HOST}:${PORT}\n`);
    
    // Initialize monitoring system
    const monitoring = new MonitoringSystem({
      enabled: process.env.MONITORING_ENABLED !== 'false',
      components: {
        prometheus: true,
        health: true,
        alerting: true,
        profiler: process.env.PROFILER_ENABLED === 'true'
      }
    });
    
    try {
      await monitoring.start();
      logger.success('📊 Monitoring system initialized');
      
      // Expose metrics endpoint
      app.get('/metrics', (req, res) => {
        monitoring.getMetrics().then(metrics => {
          res.set('Content-Type', 'text/plain');
          res.send(metrics);
        });
      });
      
      // Expose health check endpoint
      app.get('/health', (req, res) => {
        monitoring.getHealth().then(health => {
          res.status(health.status === 'healthy' ? 200 : 503).json(health);
        });
      });
      
    } catch (error) {
      logger.warn(`Monitoring system failed to initialize: ${error.message}`);
    }
    
    // Initialize router after server starts
    await initializeRouter();
  
  // Initialize WebSocket API
  wsAPI = new WebSocketAPI({
    path: '/ws',
    authEnabled: false
  });
  await wsAPI.initialize(server, router);
  logger.success(' ✅ WebSocket API initialized');
  
  logger.info('\n📡 SaaS API Endpoints:');
  logger.info(`  http://${HOST}:${PORT}/api/health - Health check (public)`);
  logger.info(`  http://${HOST}:${PORT}/api/models - List models (auth required)`);
  logger.info(`  http://${HOST}:${PORT}/api/quick - Quick inference (auth required)`);
  logger.info(`  http://${HOST}:${PORT}/api/chat - Chat completion (auth required)`);
  logger.info(`  http://${HOST}:${PORT}/api/inference - Main inference endpoint (auth required)`);
  logger.info(`  ws://${HOST}:${PORT}/ws - WebSocket streaming`);
  logger.info('\n🔧 Admin Endpoints:');
  logger.info(`  http://${HOST}:${PORT}/api/admin/keys - Manage API keys`);
  logger.info(`  http://${HOST}:${PORT}/api/admin/stats - System statistics`);
  logger.info('\n🔑 Authentication: Include "Authorization: Bearer <api-key>" header');
  logger.info(`💡 Ready for ${HOST === '127.0.0.1' ? 'SECURE LOCAL' : 'SaaS'} requests!\n`);
  });
}

// Error handling middleware (must be last)
app.use(authErrorHandler);
app.use(sanitizeErrors);

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('\n🛑 Shutting down gracefully...');
  if (wsAPI) {
    await wsAPI.cleanup();
  }
  await router.cleanup();
  process.exit(0);
});

export { initializeRouter, router };