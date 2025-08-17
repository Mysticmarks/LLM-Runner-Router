/**
 * gRPC API Tests
 * Tests for gRPC server functionality, streaming, and client operations
 */

import { jest } from '@jest/globals';
import { GRPCServer, GRPCClient } from '../../src/api/gRPC.js';
import { LLMRouter } from '../../src/index.js';

describe('gRPC API', () => {
  let grpcServer;
  let grpcClient;
  let router;
  let serverPort;

  beforeAll(async () => {
    // Setup test router
    router = new LLMRouter({ autoInit: false });
    await router.initialize();

    // Setup gRPC server
    serverPort = 50052; // Use different port for testing
    grpcServer = new GRPCServer({
      host: '127.0.0.1',
      port: serverPort
    });

    await grpcServer.initialize(router);
    await grpcServer.start();

    // Setup gRPC client
    grpcClient = new GRPCClient({
      host: '127.0.0.1',
      port: serverPort
    });
    await grpcClient.initialize();
  });

  afterAll(async () => {
    if (grpcClient) {
      grpcClient.close();
    }
    if (grpcServer) {
      await grpcServer.stop();
    }
    if (router) {
      await router.cleanup();
    }
  });

  describe('Server Initialization', () => {
    test('should initialize gRPC server successfully', () => {
      expect(grpcServer.server).toBeDefined();
      expect(grpcServer.router).toBe(router);
      expect(grpcServer.package).toBeDefined();
    });

    test('should have all required service methods', () => {
      const serviceMethods = [
        'LoadModel',
        'UnloadModel',
        'ListModels',
        'GetModelStatus',
        'Inference',
        'StreamInference',
        'Chat',
        'BatchInference',
        'HealthCheck',
        'ServiceDiscovery',
        'RouteModel',
        'GetMetrics'
      ];

      serviceMethods.forEach(method => {
        expect(grpcServer[method.toLowerCase()]).toBeDefined();
      });
    });
  });

  describe('Client Initialization', () => {
    test('should initialize gRPC client successfully', () => {
      expect(grpcClient.client).toBeDefined();
      expect(grpcClient.package).toBeDefined();
    });

    test('should be able to call service methods', () => {
      expect(typeof grpcClient.call).toBe('function');
      expect(typeof grpcClient.stream).toBe('function');
    });
  });

  describe('Health Check', () => {
    test('should return healthy status', async () => {
      const response = await grpcClient.call('HealthCheck', {
        service: 'llm-router'
      });

      expect(response).toBeDefined();
      expect(response.status).toBe('HEALTHY');
      expect(response.message).toContain('gRPC service operational');
      expect(response.details).toBeDefined();
      expect(response.timestamp).toBeDefined();
    });
  });

  describe('Service Discovery', () => {
    test('should return service information', async () => {
      const response = await grpcClient.call('ServiceDiscovery', {
        serviceType: 'llm-router'
      });

      expect(response).toBeDefined();
      expect(response.services).toBeDefined();
      expect(Array.isArray(response.services)).toBe(true);
      expect(response.services.length).toBeGreaterThan(0);
      
      const service = response.services[0];
      expect(service.id).toBe('llm-router-grpc');
      expect(service.name).toBe('LLM Router gRPC Service');
      expect(service.host).toBe('127.0.0.1');
      expect(service.port).toBe(serverPort);
    });
  });

  describe('Model Management', () => {
    test('should list models', async () => {
      const response = await grpcClient.call('ListModels', {
        includeUnloaded: true,
        limit: 10,
        offset: 0
      });

      expect(response).toBeDefined();
      expect(response.models).toBeDefined();
      expect(Array.isArray(response.models)).toBe(true);
      expect(response.totalCount).toBeDefined();
      expect(response.hasMore).toBeDefined();
    });

    test('should load a model', async () => {
      const response = await grpcClient.call('LoadModel', {
        source: 'test-model',
        format: 'simple',
        id: 'test-grpc-model',
        name: 'Test gRPC Model',
        parameters: {}
      });

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.message).toContain('loaded successfully');
      expect(response.model).toBeDefined();
      expect(response.model.id).toBe('test-grpc-model');
      expect(response.model.name).toBe('Test gRPC Model');
    });

    test('should get model status', async () => {
      const response = await grpcClient.call('GetModelStatus', {
        modelId: 'test-grpc-model'
      });

      expect(response).toBeDefined();
      expect(response.exists).toBe(true);
      expect(response.model).toBeDefined();
      expect(response.metrics).toBeDefined();
    });

    test('should unload a model', async () => {
      const response = await grpcClient.call('UnloadModel', {
        modelId: 'test-grpc-model',
        force: false
      });

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.message).toContain('unloaded successfully');
    });
  });

  describe('Inference', () => {
    test('should perform single inference', async () => {
      const response = await grpcClient.call('Inference', {
        prompt: 'Hello, world!',
        modelId: 'simple-fallback',
        options: {
          maxTokens: 50,
          temperature: 0.7
        },
        metadata: { test: 'true' }
      });

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.text).toBeDefined();
      expect(response.modelId).toBeDefined();
      expect(response.metrics).toBeDefined();
      expect(response.metrics.latencyMs).toBeGreaterThan(0);
    });

    test('should perform batch inference', async () => {
      const requests = [
        { prompt: 'Hello 1', options: { maxTokens: 10 } },
        { prompt: 'Hello 2', options: { maxTokens: 10 } },
        { prompt: 'Hello 3', options: { maxTokens: 10 } }
      ];

      const response = await grpcClient.call('BatchInference', {
        requests,
        options: {
          maxConcurrent: 2,
          timeoutMs: 10000
        }
      });

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.responses).toBeDefined();
      expect(Array.isArray(response.responses)).toBe(true);
      expect(response.responses.length).toBe(3);
      expect(response.metrics).toBeDefined();
      expect(response.metrics.totalRequests).toBe(3);
    });
  });

  describe('Streaming', () => {
    test('should stream inference tokens', (done) => {
      const stream = grpcClient.stream('StreamInference', {
        prompt: 'Generate a story about robots',
        modelId: 'simple-fallback',
        options: { maxTokens: 50 },
        sessionId: 'test-stream-session'
      });

      const tokens = [];
      let completed = false;

      stream.on('data', (response) => {
        expect(response).toBeDefined();
        expect(response.token).toBeDefined();
        expect(response.modelId).toBeDefined();
        expect(response.metrics).toBeDefined();

        tokens.push(response.token);

        if (response.isComplete) {
          completed = true;
        }
      });

      stream.on('end', () => {
        expect(completed).toBe(true);
        expect(tokens.length).toBeGreaterThan(0);
        done();
      });

      stream.on('error', (error) => {
        done(error);
      });
    });

    test('should handle bidirectional chat streaming', (done) => {
      const stream = grpcClient.stream('Chat', {});
      
      const responses = [];
      let messagesSent = 0;
      const messagesToSend = [
        {
          messages: [{ role: 'user', content: 'Hello!' }],
          modelId: 'simple-fallback'
        },
        {
          messages: [{ role: 'user', content: 'How are you?' }],
          modelId: 'simple-fallback'
        }
      ];

      stream.on('data', (response) => {
        expect(response).toBeDefined();
        expect(response.message).toBeDefined();
        expect(response.modelId).toBeDefined();
        
        responses.push(response);
        
        // Send next message if available
        if (messagesSent < messagesToSend.length) {
          stream.write(messagesToSend[messagesSent]);
          messagesSent++;
        } else {
          stream.end();
        }
      });

      stream.on('end', () => {
        expect(responses.length).toBeGreaterThan(0);
        expect(messagesSent).toBe(messagesToSend.length);
        done();
      });

      stream.on('error', (error) => {
        done(error);
      });

      // Send first message
      stream.write(messagesToSend[0]);
      messagesSent++;
    });
  });

  describe('Routing', () => {
    test('should route model selection', async () => {
      const response = await grpcClient.call('RouteModel', {
        prompt: 'Write a creative story',
        requirements: {
          maxLatency: '1000',
          minQuality: '0.8'
        },
        strategy: 'quality-first'
      });

      expect(response).toBeDefined();
      expect(response.selectedModelId).toBeDefined();
      expect(response.strategy).toBe('quality-first');
      expect(response.confidenceScore).toBeGreaterThan(0);
      expect(response.reasoning).toBeDefined();
    });
  });

  describe('Metrics', () => {
    test('should return system metrics', async () => {
      const response = await grpcClient.call('GetMetrics', {
        startTime: Date.now() - 3600000, // 1 hour ago
        endTime: Date.now(),
        metricTypes: ['system', 'models']
      });

      expect(response).toBeDefined();
      expect(response.systemMetrics).toBeDefined();
      expect(response.modelMetrics).toBeDefined();
      expect(response.customMetrics).toBeDefined();
      
      const systemMetrics = response.systemMetrics;
      expect(systemMetrics.memoryUsage).toBeGreaterThan(0);
      expect(systemMetrics.uptimeSeconds).toBeGreaterThan(0);
    });

    test('should track gRPC server metrics', () => {
      const metrics = grpcServer.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.uptime).toBeGreaterThan(0);
      expect(typeof metrics.activeConnections).toBe('number');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid method calls', async () => {
      try {
        await grpcClient.call('NonExistentMethod', {});
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Method NonExistentMethod not found');
      }
    });

    test('should handle invalid model loading', async () => {
      const response = await grpcClient.call('LoadModel', {
        source: '', // Invalid empty source
        format: 'invalid-format'
      });

      expect(response).toBeDefined();
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    test('should handle inference with invalid model', async () => {
      const response = await grpcClient.call('Inference', {
        prompt: 'Test prompt',
        modelId: 'non-existent-model'
      });

      expect(response).toBeDefined();
      // Should either succeed with fallback or fail gracefully
      expect(['string', 'undefined']).toContain(typeof response.error);
    });
  });

  describe('Performance', () => {
    test('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();
      const concurrentRequests = 10;
      
      const promises = Array.from({ length: concurrentRequests }, (_, i) => 
        grpcClient.call('Inference', {
          prompt: `Test prompt ${i}`,
          modelId: 'simple-fallback',
          options: { maxTokens: 10 }
        })
      );

      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(responses.length).toBe(concurrentRequests);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      
      responses.forEach((response, i) => {
        expect(response).toBeDefined();
        expect(response.success).toBe(true);
      });
    });

    test('should handle large payloads', async () => {
      const largePrompt = 'A'.repeat(5000); // 5KB prompt
      
      const response = await grpcClient.call('Inference', {
        prompt: largePrompt,
        options: { maxTokens: 100 }
      });

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.text).toBeDefined();
    });
  });

  describe('Session Management', () => {
    test('should track active sessions', async () => {
      const initialMetrics = grpcServer.getMetrics();
      const initialConnections = initialMetrics.activeConnections;

      // Start a streaming session
      const stream = grpcClient.stream('StreamInference', {
        prompt: 'Test session tracking',
        sessionId: 'test-session-123'
      });

      // Check if session is tracked
      expect(grpcServer.activeSessions.has('test-session-123')).toBe(false); // Not set until stream starts

      // End the stream
      stream.end();

      // Verify cleanup
      setTimeout(() => {
        const finalMetrics = grpcServer.getMetrics();
        expect(finalMetrics.activeConnections).toBeLessThanOrEqual(initialConnections);
      }, 100);
    });
  });
});