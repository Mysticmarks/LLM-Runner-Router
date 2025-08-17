/**
 * Advanced API Server Example
 * Demonstrates all API components working together
 */

import express from 'express';
import { AuthenticationManager, AuthMiddleware } from '../src/api/Auth.js';
import { RateLimitManager } from '../src/api/RateLimiter.js';
import { OpenAPIManager } from '../src/api/OpenAPI.js';
import { GRPCServer } from '../src/api/gRPC.js';
import { LLMRouter } from '../src/index.js';

async function createAdvancedAPIServer() {
  console.log('🚀 Creating Advanced LLM Router API Server...\n');

  // Initialize core router
  const router = new LLMRouter({ autoInit: false });
  await router.initialize();

  // Initialize authentication
  const authManager = new AuthenticationManager({
    jwtSecret: 'demo-secret-key',
    jwtExpiresIn: '24h'
  });

  await new Promise(resolve => {
    authManager.on('initialized', resolve);
  });

  const authMiddleware = new AuthMiddleware(authManager);

  // Initialize rate limiting
  const rateLimiter = new RateLimitManager({
    useRedis: false,
    tiers: {
      free: { requestsPerHour: 100, requestsPerMinute: 5 },
      premium: { requestsPerHour: 1000, requestsPerMinute: 50 },
      enterprise: { requestsPerHour: 10000, requestsPerMinute: 500 }
    }
  });

  // Initialize OpenAPI documentation
  const openAPIManager = new OpenAPIManager({
    title: 'Advanced LLM Router API',
    version: '2.0.0',
    description: 'Production-ready LLM orchestration API with advanced features'
  });

  // Create Express app
  const app = express();
  app.use(express.json());

  // Add request tracking
  app.use((req, res, next) => {
    req.startTime = Date.now();
    req.id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  // OpenAPI documentation endpoints
  app.get('/api/docs/openapi.json', (req, res) => {
    res.json(openAPIManager.getSpecJSON());
  });

  // Authentication endpoints
  app.post('/api/auth/login',
    rateLimiter.createMiddleware({ cost: 2 }),
    async (req, res) => {
      try {
        const { username, password } = req.body;
        const user = await authManager.authenticateUser(username, password);
        
        if (!user) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const tokens = authManager.generateTokens(user);
        res.json({ ...tokens, user });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  // API key management
  app.post('/api/auth/apikeys',
    authMiddleware.authenticateFlexible(),
    authMiddleware.requirePermission('apikey:create'),
    rateLimiter.createMiddleware(),
    async (req, res) => {
      try {
        const { name, permissions, tier } = req.body;
        const apiKey = await authManager.generateApiKey(
          req.user.id,
          name,
          permissions
        );
        res.status(201).json(apiKey);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Model management
  app.get('/api/models',
    authMiddleware.authenticateFlexible(),
    authMiddleware.requirePermission('model:read'),
    rateLimiter.createMiddleware(),
    (req, res) => {
      const models = router.registry.getAll();
      res.json({
        models: models.map(m => ({
          id: m.id,
          name: m.name,
          format: m.format,
          loaded: m.loaded || false
        })),
        total: models.length
      });
    }
  );

  // Advanced inference with cost-based rate limiting
  app.post('/api/inference',
    authMiddleware.authenticateFlexible(),
    authMiddleware.requirePermission('inference:create'),
    rateLimiter.createCostMiddleware(req => {
      const maxTokens = req.body?.maxTokens || 100;
      return Math.ceil(maxTokens / 100); // 1 cost per 100 tokens
    }),
    async (req, res) => {
      try {
        const { prompt, model, maxTokens = 100, temperature = 0.7 } = req.body;
        
        const result = await router.quick(prompt, {
          maxTokens,
          temperature,
          modelId: model
        });

        res.json({
          text: result.text || result,
          model: result.model || model || 'unknown',
          usage: {
            promptTokens: prompt.split(' ').length,
            completionTokens: (result.text || result).split(' ').length,
            totalTokens: prompt.split(' ').length + (result.text || result).split(' ').length
          },
          metadata: {
            requestId: req.id,
            processingTime: Date.now() - req.startTime,
            tier: req.user?.tier || 'free'
          }
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Streaming chat endpoint
  app.post('/api/chat/stream',
    authMiddleware.authenticateFlexible(),
    authMiddleware.requirePermission('chat:create'),
    rateLimiter.createMiddleware(),
    async (req, res) => {
      try {
        const { messages, model } = req.body;
        
        // Set headers for Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Simulate streaming response
        const lastMessage = messages[messages.length - 1];
        const responseText = `Streaming response to: ${lastMessage.content}`;
        const words = responseText.split(' ');
        
        for (let i = 0; i < words.length; i++) {
          const chunk = {
            content: words[i] + ' ',
            done: i === words.length - 1,
            model: model || 'default',
            requestId: req.id
          };
          
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        res.end();
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Admin endpoints
  app.get('/api/admin/stats',
    authMiddleware.authenticateFlexible(),
    authMiddleware.requireRole('admin'),
    rateLimiter.createMiddleware(),
    (req, res) => {
      res.json({
        auth: authManager.getStats(),
        rateLimit: rateLimiter.getStats(),
        router: router.getStatus(),
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        }
      });
    }
  );

  // Health endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {
        auth: authManager.getStats(),
        rateLimit: rateLimiter.getStats(),
        router: router.getStatus()
      }
    });
  });

  // Error handling
  app.use((error, req, res, next) => {
    console.error('API Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      requestId: req.id
    });
  });

  // Start gRPC server
  const grpcServer = new GRPCServer({
    host: '127.0.0.1',
    port: 50051
  });

  console.log('✅ All components initialized successfully!');
  console.log('\n📋 Available Features:');
  console.log('   🔐 JWT & API Key Authentication');
  console.log('   ⏱️  Multi-strategy Rate Limiting');
  console.log('   📋 OpenAPI 3.0 Documentation');
  console.log('   🔄 gRPC Interface');
  console.log('   🌐 RESTful API Gateway');
  console.log('   📊 Real-time Streaming');
  console.log('   🎯 Intelligent Model Routing');
  console.log('   📈 Comprehensive Metrics');

  return {
    app,
    router,
    authManager,
    rateLimiter,
    openAPIManager,
    grpcServer
  };
}

// Example usage
async function runExample() {
  try {
    const server = await createAdvancedAPIServer();
    
    console.log('\n🎯 Example Usage:');
    console.log('\n1. Start the server:');
    console.log('   server.app.listen(3000)');
    
    console.log('\n2. Login and get token:');
    console.log('   POST /api/auth/login');
    console.log('   { "username": "admin", "password": "admin123" }');
    
    console.log('\n3. Create API key:');
    console.log('   POST /api/auth/apikeys');
    console.log('   Authorization: Bearer <token>');
    console.log('   { "name": "My API Key", "permissions": ["inference:create"] }');
    
    console.log('\n4. Use inference:');
    console.log('   POST /api/inference');
    console.log('   X-API-Key: llmr_<apikey>');
    console.log('   { "prompt": "Hello world", "maxTokens": 50 }');
    
    console.log('\n5. Stream chat:');
    console.log('   POST /api/chat/stream');
    console.log('   { "messages": [{"role": "user", "content": "Hi"}] }');
    
    console.log('\n6. Check documentation:');
    console.log('   GET /api/docs/openapi.json');
    
    console.log('\n✨ Server components ready for production use!');
    
  } catch (error) {
    console.error('❌ Failed to create advanced API server:', error);
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExample();
}

export { createAdvancedAPIServer };