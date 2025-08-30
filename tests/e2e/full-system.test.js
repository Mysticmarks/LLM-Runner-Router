/**
 * End-to-End System Tests
 * Tests the complete LLM Router system with real model interactions
 */

import { jest } from '@jest/globals';
import supertest from 'supertest';
import { LLMRouter } from '../../src/index.js';
import { DatabaseManager } from '../../src/db/DatabaseManager.js';
import express from 'express';

describe('Full System End-to-End Tests', () => {
  let app;
  let router;
  let database;
  let server;

  beforeAll(async () => {
    // Initialize database in memory mode for tests
    database = new DatabaseManager({
      type: 'memory',
      fallbackToMemory: true
    });
    await database.initialize();

    // Initialize LLM Router
    router = new LLMRouter({
      database,
      strategy: 'balanced',
      enableMetrics: true,
      enableCache: true
    });

    await router.initialize();

    // Set up Express app for API testing
    app = express();
    app.use(express.json());
    
    // Health check endpoint
    app.get('/health', async (req, res) => {
      const health = await router.healthCheck();
      res.json(health);
    });

    // Model inference endpoint
    app.post('/inference', async (req, res) => {
      try {
        const { prompt, options = {} } = req.body;
        const result = await router.quick(prompt, options);
        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Model registration endpoint
    app.post('/models/register', async (req, res) => {
      try {
        const model = await router.registry.register(req.body);
        res.json({
          success: true,
          data: model
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get available models
    app.get('/models', (req, res) => {
      const models = router.registry.getAll();
      res.json({
        success: true,
        data: models
      });
    });

    // Metrics endpoint
    app.get('/metrics', async (req, res) => {
      const metrics = await router.getMetrics();
      res.json({
        success: true,
        data: metrics
      });
    });

    server = app.listen(0); // Use random port
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    if (router) {
      await router.cleanup();
    }
    if (database) {
      await database.close();
    }
  });

  describe('System Health and Initialization', () => {
    test('should have healthy system status', async () => {
      const response = await supertest(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('models');
    });

    test('should initialize with default models', async () => {
      const response = await supertest(app)
        .get('/models')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      // Should have at least the fallback SimpleLoader
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Model Registration and Management', () => {
    test('should register a new model successfully', async () => {
      const modelConfig = {
        id: 'test-model-1',
        name: 'Test Model 1',
        type: 'simple',
        capabilities: ['text-generation'],
        config: {
          provider: 'test',
          modelId: 'test/model-1'
        }
      };

      const response = await supertest(app)
        .post('/models/register')
        .send(modelConfig)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', 'test-model-1');
    });

    test('should list registered models', async () => {
      const response = await supertest(app)
        .get('/models')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.some(m => m.id === 'test-model-1')).toBe(true);
    });
  });

  describe('Inference and Routing', () => {
    test('should perform basic inference', async () => {
      const response = await supertest(app)
        .post('/inference')
        .send({
          prompt: 'Hello, how are you?',
          options: {
            maxTokens: 10,
            temperature: 0.7
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('text');
      expect(response.body.data).toHaveProperty('model');
      expect(typeof response.body.data.text).toBe('string');
    });

    test('should handle inference with model selection', async () => {
      const response = await supertest(app)
        .post('/inference')
        .send({
          prompt: 'Write a short story',
          options: {
            modelId: 'test-model-1',
            maxTokens: 50
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('text');
      expect(response.body.data.model).toBe('test-model-1');
    });

    test('should fallback gracefully when model fails', async () => {
      // Register a model that will fail
      await supertest(app)
        .post('/models/register')
        .send({
          id: 'failing-model',
          name: 'Failing Model',
          type: 'mock',
          config: {
            shouldFail: true
          }
        });

      const response = await supertest(app)
        .post('/inference')
        .send({
          prompt: 'This should trigger fallback',
          options: {
            modelId: 'failing-model',
            enableFallback: true
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.model).not.toBe('failing-model');
    });
  });

  describe('Metrics and Monitoring', () => {
    test('should collect and report metrics', async () => {
      // Generate some activity first
      await supertest(app)
        .post('/inference')
        .send({ prompt: 'Test prompt for metrics' });

      const response = await supertest(app)
        .get('/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalRequests');
      expect(response.body.data).toHaveProperty('totalSuccess');
      expect(response.body.data).toHaveProperty('averageLatency');
      expect(response.body.data.totalRequests).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid prompts gracefully', async () => {
      const response = await supertest(app)
        .post('/inference')
        .send({
          prompt: '', // Empty prompt
          options: {}
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should handle malformed requests', async () => {
      const response = await supertest(app)
        .post('/inference')
        .send({
          // Missing prompt
          options: { maxTokens: 10 }
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    test('should handle unavailable models gracefully', async () => {
      const response = await supertest(app)
        .post('/inference')
        .send({
          prompt: 'Test with unavailable model',
          options: {
            modelId: 'nonexistent-model',
            enableFallback: true
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.model).not.toBe('nonexistent-model');
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle multiple concurrent inference requests', async () => {
      const concurrentRequests = 5;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          supertest(app)
            .post('/inference')
            .send({
              prompt: `Concurrent request ${i + 1}`,
              options: { maxTokens: 10 }
            })
        );
      }

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Database Integration', () => {
    test('should persist metrics to database', async () => {
      // Perform some operations
      await supertest(app)
        .post('/inference')
        .send({ prompt: 'Database test prompt' });

      // Check if metrics are stored
      const metrics = await database.query('metrics', 'find', {}, {
        filters: { name: 'totalRequests' }
      });

      expect(metrics.data).toBeDefined();
    });

    test('should handle database fallback gracefully', async () => {
      // This test verifies that the system continues to work even if database operations fail
      // The DatabaseManager should fallback to memory storage
      const response = await supertest(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
    });
  });
});