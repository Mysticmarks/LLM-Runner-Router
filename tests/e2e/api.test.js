/**
 * End-to-End API Tests
 * Tests the complete API flow from request to response
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { LLMRouter } from '../../src/index.js';

describe('E2E API Tests', () => {
  let app;
  let server;
  let router;
  const PORT = 3001;
  
  beforeAll(async () => {
    // Create Express app
    const express = await import('express');
    app = express.default();
    app.use(express.json());
    
    // Initialize router
    router = new LLMRouter({ autoInit: false });
    await router.initialize();
    
    // Setup routes
    app.get('/api/health', (req, res) => {
      const status = router.getStatus();
      res.json({ status: 'healthy', ...status });
    });
    
    app.get('/api/models', (req, res) => {
      const models = router.registry.getAll();
      res.json({ count: models.length, models });
    });
    
    app.post('/api/quick', async (req, res) => {
      try {
        const { prompt } = req.body;
        const response = await router.quick(prompt);
        res.json({ prompt, response });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Start server
    server = app.listen(PORT);
  });
  
  afterAll(async () => {
    await router.cleanup();
    server.close();
  });
  
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('modelsLoaded');
      expect(response.body).toHaveProperty('engine');
    });
  });
  
  describe('Models API', () => {
    it('should list all models', async () => {
      const response = await request(app)
        .get('/api/models')
        .expect(200);
      
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('models');
      expect(Array.isArray(response.body.models)).toBe(true);
    });
  });
  
  describe('Quick Inference', () => {
    it('should handle inference request', async () => {
      const response = await request(app)
        .post('/api/quick')
        .send({ prompt: 'Test prompt' })
        .expect(200);
      
      expect(response.body).toHaveProperty('prompt');
      expect(response.body).toHaveProperty('response');
      expect(response.body.prompt).toBe('Test prompt');
    });
    
    it('should handle missing prompt', async () => {
      const response = await request(app)
        .post('/api/quick')
        .send({})
        .expect(500);
      
      expect(response.body).toHaveProperty('error');
    });
  });
});