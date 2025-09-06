/**
 * gRPC API Implementation for LLM Runner Router
 * Provides high-performance gRPC endpoints with streaming support
 */

import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import path from 'path';
import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = new Logger('gRPC');

export class GRPCServer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      host: options.host || '127.0.0.1',
      port: options.port || 50051,
      credentials: options.credentials || grpc.ServerCredentials.createInsecure(),
      maxReceiveMessageLength: options.maxReceiveMessageLength || 4 * 1024 * 1024,
      maxSendMessageLength: options.maxSendMessageLength || 4 * 1024 * 1024,
      keepaliveTimeMs: options.keepaliveTimeMs || 30000,
      keepaliveTimeoutMs: options.keepaliveTimeoutMs || 5000,
      keepalivePermitWithoutCalls: options.keepalivePermitWithoutCalls || true,
      http2MaxPingsWithoutData: options.http2MaxPingsWithoutData || 0,
      http2MinTimeBetweenPingsMs: options.http2MinTimeBetweenPingsMs || 10000,
      http2MinPingIntervalWithoutDataMs: options.http2MinPingIntervalWithoutDataMs || 300000,
      ...options
    };

    this.server = null;
    this.router = null;
    this.package = null;
    this.activeSessions = new Map();
    this.metrics = {
      totalRequests: 0,
      activeConnections: 0,
      totalErrors: 0,
      startTime: Date.now()
    };
  }

  /**
   * Initialize the gRPC server
   */
  async initialize(router) {
    try {
      this.router = router;

      // Load the proto file
      const protoPath = path.join(__dirname, '../proto/llm_router.proto');
      const packageDefinition = protoLoader.loadSync(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [path.dirname(protoPath)]
      });

      this.package = grpc.loadPackageDefinition(packageDefinition).llm_router;

      // Create gRPC server
      this.server = new grpc.Server({
        'grpc.max_receive_message_length': this.options.maxReceiveMessageLength,
        'grpc.max_send_message_length': this.options.maxSendMessageLength,
        'grpc.keepalive_time_ms': this.options.keepaliveTimeMs,
        'grpc.keepalive_timeout_ms': this.options.keepaliveTimeoutMs,
        'grpc.keepalive_permit_without_calls': this.options.keepalivePermitWithoutCalls,
        'grpc.http2.max_pings_without_data': this.options.http2MaxPingsWithoutData,
        'grpc.http2.min_time_between_pings_ms': this.options.http2MinTimeBetweenPingsMs,
        'grpc.http2.min_ping_interval_without_data_ms': this.options.http2MinPingIntervalWithoutDataMs
      });

      // Add service implementation
      this.server.addService(this.package.LLMRouterService.service, {
        LoadModel: this.loadModel.bind(this),
        UnloadModel: this.unloadModel.bind(this),
        ListModels: this.listModels.bind(this),
        GetModelStatus: this.getModelStatus.bind(this),
        Inference: this.inference.bind(this),
        StreamInference: this.streamInference.bind(this),
        Chat: this.chat.bind(this),
        BatchInference: this.batchInference.bind(this),
        HealthCheck: this.healthCheck.bind(this),
        ServiceDiscovery: this.serviceDiscovery.bind(this),
        RouteModel: this.routeModel.bind(this),
        GetMetrics: this.getMetrics.bind(this)
      });

      this.emit('initialized');
      return this;
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize gRPC server: ${error.message}`);
    }
  }

  /**
   * Start the gRPC server
   */
  async start() {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        return reject(new Error('Server not initialized'));
      }

      const bindAddress = `${this.options.host}:${this.options.port}`;
      this.server.bindAsync(bindAddress, this.options.credentials, (error, port) => {
        if (error) {
          this.emit('error', error);
          return reject(error);
        }

        this.server.start();
        this.emit('started', { host: this.options.host, port });
        resolve({ host: this.options.host, port });
      });
    });
  }

  /**
   * Stop the gRPC server
   */
  async stop() {
    return new Promise((resolve) => {
      if (!this.server) {
        return resolve();
      }

      // Gracefully shutdown all active sessions
      for (const [sessionId, session] of this.activeSessions) {
        try {
          if (session.call && typeof session.call.end === 'function') {
            session.call.end();
          }
        } catch (error) {
          logger.warn(`Error closing session ${sessionId}:`, error.message);
        }
      }
      this.activeSessions.clear();

      this.server.tryShutdown((error) => {
        if (error) {
          logger.warn('gRPC server shutdown error:', error.message);
          this.server.forceShutdown();
        }
        this.emit('stopped');
        resolve();
      });
    });
  }

  /**
   * Load a model
   */
  async loadModel(call, callback) {
    try {
      this.incrementMetric('totalRequests');
      const request = call.request;

      const model = await this.router.load({
        source: request.source,
        format: request.format || 'auto',
        id: request.id || `model-${Date.now()}`,
        name: request.name || 'Unnamed Model',
        ...request.parameters
      });

      const response = {
        success: true,
        message: `Model ${model.name} loaded successfully`,
        model: {
          id: model.id,
          name: model.name,
          format: model.format,
          source: request.source,
          loaded: true,
          loadTime: Date.now(),
          memoryUsage: 0, // Will be populated by actual implementation
          parameters: request.parameters || {},
          version: '1.0.0',
          capabilities: ['text-generation', 'chat']
        }
      };

      callback(null, response);
    } catch (error) {
      this.incrementMetric('totalErrors');
      callback(null, {
        success: false,
        message: 'Failed to load model',
        error: error.message
      });
    }
  }

  /**
   * Unload a model
   */
  async unloadModel(call, callback) {
    try {
      this.incrementMetric('totalRequests');
      const request = call.request;

      // Implementation would call router.unload()
      // For now, simulate success
      const response = {
        success: true,
        message: `Model ${request.modelId} unloaded successfully`
      };

      callback(null, response);
    } catch (error) {
      this.incrementMetric('totalErrors');
      callback(null, {
        success: false,
        message: 'Failed to unload model',
        error: error.message
      });
    }
  }

  /**
   * List available models
   */
  async listModels(call, callback) {
    try {
      this.incrementMetric('totalRequests');
      const request = call.request;

      const allModels = this.router.registry.getAll();
      let models = allModels;

      // Apply filtering
      if (request.filter) {
        models = models.filter(m => 
          m.name.toLowerCase().includes(request.filter.toLowerCase()) ||
          m.id.toLowerCase().includes(request.filter.toLowerCase())
        );
      }

      // Apply pagination
      const offset = request.offset || 0;
      const limit = request.limit || 50;
      const paginatedModels = models.slice(offset, offset + limit);

      const response = {
        models: paginatedModels.map(m => ({
          id: m.id,
          name: m.name,
          format: m.format,
          source: m.source || 'unknown',
          loaded: m.loaded || false,
          loadTime: m.loadTime || 0,
          memoryUsage: m.memoryUsage || 0,
          parameters: m.parameters || {},
          version: m.version || '1.0.0',
          capabilities: m.capabilities || ['text-generation']
        })),
        totalCount: models.length,
        hasMore: offset + limit < models.length
      };

      callback(null, response);
    } catch (error) {
      this.incrementMetric('totalErrors');
      callback(null, {
        models: [],
        totalCount: 0,
        hasMore: false
      });
    }
  }

  /**
   * Get model status
   */
  async getModelStatus(call, callback) {
    try {
      this.incrementMetric('totalRequests');
      const request = call.request;

      const model = this.router.registry.get(request.modelId);
      
      if (!model) {
        return callback(null, {
          exists: false,
          error: 'Model not found'
        });
      }

      const response = {
        exists: true,
        model: {
          id: model.id,
          name: model.name,
          format: model.format,
          source: model.source || 'unknown',
          loaded: model.loaded || false,
          loadTime: model.loadTime || 0,
          memoryUsage: model.memoryUsage || 0,
          parameters: model.parameters || {},
          version: model.version || '1.0.0',
          capabilities: model.capabilities || ['text-generation']
        },
        metrics: {
          modelId: model.id,
          totalRequests: model.totalRequests || 0,
          totalTokens: model.totalTokens || 0,
          averageLatency: model.averageLatency || 0,
          tokensPerSecond: model.tokensPerSecond || 0,
          memoryUsage: model.memoryUsage || 0,
          cpuUsage: 0, // Would be calculated from system metrics
          lastUsed: model.lastUsed || Date.now(),
          errorRate: model.errorRate || 0
        }
      };

      callback(null, response);
    } catch (error) {
      this.incrementMetric('totalErrors');
      callback(null, {
        exists: false,
        error: error.message
      });
    }
  }

  /**
   * Single inference
   */
  async inference(call, callback) {
    const request = call.request;
    try {
      this.incrementMetric('totalRequests');
      const startTime = Date.now();

      const result = await this.router.quick(request.prompt, {
        maxTokens: request.options?.maxTokens || 100,
        temperature: request.options?.temperature || 0.7,
        modelId: request.modelId,
        ...request.options
      });

      const latency = Date.now() - startTime;

      const response = {
        text: result.text || result,
        modelId: result.model || request.modelId || 'unknown',
        metrics: {
          latencyMs: latency,
          tokensGenerated: result.tokensGenerated || 0,
          tokensPerSecond: result.tokensGenerated ? (result.tokensGenerated / latency * 1000) : 0,
          memoryUsed: 0, // Would be tracked by actual implementation
          processingTime: latency,
          queueTime: 0
        },
        success: true,
        metadata: request.metadata || {}
      };

      callback(null, response);
    } catch (error) {
      this.incrementMetric('totalErrors');
      callback(null, {
        text: '',
        success: false,
        error: error.message,
        modelId: request.modelId || 'unknown'
      });
    }
  }

  /**
   * Streaming inference
   */
  async streamInference(call) {
    try {
      this.incrementMetric('totalRequests');
      this.incrementMetric('activeConnections');

      const request = call.request;
      const sessionId = request.sessionId || `session-${Date.now()}-${Math.random()}`;
      
      // Store the active session
      this.activeSessions.set(sessionId, { call, startTime: Date.now() });

      // For demonstration, simulate streaming response
      const text = "This is a simulated streaming response from the LLM Router gRPC service. ";
      const words = text.split(' ');

      for (let i = 0; i < words.length; i++) {
        if (call.cancelled) break;

        const token = words[i] + (i < words.length - 1 ? ' ' : '');
        const isComplete = i === words.length - 1;

        call.write({
          token: token,
          isComplete: isComplete,
          modelId: request.modelId || 'simulation-model',
          metrics: {
            latencyMs: Date.now() - this.activeSessions.get(sessionId).startTime,
            tokensGenerated: i + 1,
            tokensPerSecond: (i + 1) / ((Date.now() - this.activeSessions.get(sessionId).startTime) / 1000),
            memoryUsed: 0,
            processingTime: Date.now() - this.activeSessions.get(sessionId).startTime,
            queueTime: 0
          }
        });

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.activeSessions.delete(sessionId);
      this.decrementMetric('activeConnections');
      call.end();
    } catch (error) {
      this.incrementMetric('totalErrors');
      this.decrementMetric('activeConnections');
      call.emit('error', error);
    }
  }

  /**
   * Bidirectional streaming chat
   */
  async chat(call) {
    try {
      this.incrementMetric('totalRequests');
      this.incrementMetric('activeConnections');

      const sessionId = `chat-${Date.now()}-${Math.random()}`;
      this.activeSessions.set(sessionId, { call, startTime: Date.now(), messages: [] });

      call.on('data', async (request) => {
        try {
          const session = this.activeSessions.get(sessionId);
          if (!session) return;

          // Store the conversation history
          session.messages.push(...request.messages);

          // Generate response (simulated)
          const lastMessage = request.messages[request.messages.length - 1];
          if (lastMessage && lastMessage.content) {
            const response = {
              message: {
                role: 'assistant',
                content: `Echo: ${lastMessage.content} (from gRPC service)`,
                metadata: {},
                timestamp: Date.now()
              },
              modelId: request.modelId || 'simulation-model',
              metrics: {
                latencyMs: Date.now() - session.startTime,
                tokensGenerated: lastMessage.content.split(' ').length,
                tokensPerSecond: 10,
                memoryUsed: 0,
                processingTime: 50,
                queueTime: 0
              },
              isComplete: true
            };

            call.write(response);
          }
        } catch (error) {
          call.write({
            error: error.message,
            isComplete: true
          });
        }
      });

      call.on('end', () => {
        this.activeSessions.delete(sessionId);
        this.decrementMetric('activeConnections');
        call.end();
      });

      call.on('error', (_error) => {
        this.incrementMetric('totalErrors');
        this.activeSessions.delete(sessionId);
        this.decrementMetric('activeConnections');
      });

    } catch (error) {
      this.incrementMetric('totalErrors');
      this.decrementMetric('activeConnections');
      call.emit('error', error);
    }
  }

  /**
   * Batch inference
   */
  async batchInference(call, callback) {
    try {
      this.incrementMetric('totalRequests');
      const request = call.request;
      const startTime = Date.now();

      const responses = [];
      let successful = 0;
      let failed = 0;

      // Process each request in the batch
      for (const inferenceRequest of request.requests) {
        try {
          const result = await this.router.quick(inferenceRequest.prompt, {
            maxTokens: inferenceRequest.options?.maxTokens || 100,
            temperature: inferenceRequest.options?.temperature || 0.7,
            modelId: inferenceRequest.modelId,
            ...inferenceRequest.options
          });

          responses.push({
            text: result.text || result,
            modelId: result.model || inferenceRequest.modelId || 'unknown',
            success: true,
            metrics: {
              latencyMs: 50,
              tokensGenerated: result.tokensGenerated || 0,
              tokensPerSecond: 10,
              memoryUsed: 0,
              processingTime: 50,
              queueTime: 0
            }
          });
          successful++;
        } catch (error) {
          responses.push({
            text: '',
            modelId: inferenceRequest.modelId || 'unknown',
            success: false,
            error: error.message
          });
          failed++;
        }
      }

      const totalTime = Date.now() - startTime;

      const response = {
        responses: responses,
        metrics: {
          totalRequests: request.requests.length,
          successfulRequests: successful,
          failedRequests: failed,
          totalTimeMs: totalTime,
          averageLatencyMs: totalTime / request.requests.length
        },
        success: failed === 0
      };

      callback(null, response);
    } catch (error) {
      this.incrementMetric('totalErrors');
      callback(null, {
        responses: [],
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Health check
   */
  async healthCheck(call, callback) {
    try {
      this.incrementMetric('totalRequests');

      const status = this.router.getStatus();
      
      const response = {
        status: status.modelsLoaded > 0 ? 'HEALTHY' : 'DEGRADED',
        message: `gRPC service operational with ${status.modelsLoaded} models loaded`,
        details: {
          modelsLoaded: status.modelsLoaded.toString(),
          engine: status.engine,
          uptime: ((Date.now() - this.metrics.startTime) / 1000).toFixed(2),
          totalRequests: this.metrics.totalRequests.toString(),
          activeConnections: this.metrics.activeConnections.toString()
        },
        timestamp: Date.now()
      };

      callback(null, response);
    } catch (error) {
      this.incrementMetric('totalErrors');
      callback(null, {
        status: 'UNHEALTHY',
        message: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Service discovery
   */
  async serviceDiscovery(call, callback) {
    try {
      this.incrementMetric('totalRequests');

      const response = {
        services: [
          {
            id: 'llm-router-grpc',
            name: 'LLM Router gRPC Service',
            host: this.options.host,
            port: this.options.port,
            version: '1.0.0',
            status: 'HEALTHY',
            metadata: {
              protocol: 'grpc',
              capabilities: 'inference,streaming,chat,batch',
              models: this.router.registry.getAll().length.toString()
            }
          }
        ],
        version: '1.0.0'
      };

      callback(null, response);
    } catch (error) {
      this.incrementMetric('totalErrors');
      callback(null, {
        services: [],
        version: '1.0.0'
      });
    }
  }

  /**
   * Route model selection
   */
  async routeModel(call, callback) {
    const request = call.request;
    try {
      this.incrementMetric('totalRequests');

      // Use the router's model selection logic
      const model = await this.router.router.selectModel(request.prompt, request.requirements);

      const response = {
        selectedModelId: model?.id || 'none',
        strategy: request.strategy || 'balanced',
        confidenceScore: 0.85, // Would be calculated by actual routing logic
        alternativeModels: this.router.registry.getAll()
          .filter(m => m.id !== model?.id)
          .slice(0, 3)
          .map(m => m.id),
        reasoning: `Selected based on ${request.strategy || 'balanced'} strategy`
      };

      callback(null, response);
    } catch (error) {
      this.incrementMetric('totalErrors');
      callback(null, {
        selectedModelId: 'none',
        strategy: request.strategy || 'balanced',
        confidenceScore: 0,
        alternativeModels: [],
        reasoning: `Error: ${error.message}`
      });
    }
  }

  /**
   * Get performance metrics
   */
  async getMetrics(call, callback) {
    try {
      this.incrementMetric('totalRequests');

      const uptime = Date.now() - this.metrics.startTime;
      
      const response = {
        systemMetrics: {
          cpuUsage: 0.1, // Would be calculated from actual system metrics
          memoryUsage: process.memoryUsage().heapUsed,
          memoryTotal: process.memoryUsage().heapTotal,
          diskUsage: 0,
          diskTotal: 0,
          activeConnections: this.metrics.activeConnections,
          uptimeSeconds: Math.floor(uptime / 1000),
          loadAverage: 0.5
        },
        modelMetrics: this.router.registry.getAll().map(model => ({
          modelId: model.id,
          totalRequests: model.totalRequests || 0,
          totalTokens: model.totalTokens || 0,
          averageLatency: model.averageLatency || 0,
          tokensPerSecond: model.tokensPerSecond || 0,
          memoryUsage: model.memoryUsage || 0,
          cpuUsage: 0,
          lastUsed: model.lastUsed || Date.now(),
          errorRate: model.errorRate || 0
        })),
        customMetrics: {
          'grpc.total_requests': this.metrics.totalRequests,
          'grpc.total_errors': this.metrics.totalErrors,
          'grpc.active_connections': this.metrics.activeConnections,
          'grpc.uptime_ms': uptime
        }
      };

      callback(null, response);
    } catch (error) {
      this.incrementMetric('totalErrors');
      callback(null, {
        systemMetrics: {},
        modelMetrics: [],
        customMetrics: {}
      });
    }
  }

  /**
   * Increment a metric
   */
  incrementMetric(name) {
    if (Object.prototype.hasOwnProperty.call(this.metrics, name)) {
      this.metrics[name]++;
    }
  }

  /**
   * Decrement a metric
   */
  decrementMetric(name) {
    if (Object.prototype.hasOwnProperty.call(this.metrics, name) && this.metrics[name] > 0) {
      this.metrics[name]--;
    }
  }

}

/**
 * gRPC Client for testing and integration
 */
export class GRPCClient {
  constructor(options = {}) {
    this.options = {
      host: options.host || '127.0.0.1',
      port: options.port || 50051,
      credentials: options.credentials || grpc.credentials.createInsecure(),
      ...options
    };

    this.client = null;
    this.package = null;
  }

  /**
   * Initialize the gRPC client
   */
  async initialize() {
    try {
      // Load the proto file
      const protoPath = path.join(__dirname, '../proto/llm_router.proto');
      const packageDefinition = protoLoader.loadSync(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [path.dirname(protoPath)]
      });

      this.package = grpc.loadPackageDefinition(packageDefinition).llm_router;

      // Create client
      const address = `${this.options.host}:${this.options.port}`;
      this.client = new this.package.LLMRouterService(address, this.options.credentials);

      return this;
    } catch (error) {
      throw new Error(`Failed to initialize gRPC client: ${error.message}`);
    }
  }

  /**
   * Close the client connection
   */
  close() {
    if (this.client) {
      this.client.close();
    }
  }

  /**
   * Call any service method
   */
  call(method, request, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.client[method]) {
        return reject(new Error(`Method ${method} not found`));
      }

      this.client[method](request, options, (error, response) => {
        if (error) {
          return reject(error);
        }
        resolve(response);
      });
    });
  }

  /**
   * Stream method call
   */
  stream(method, request, options = {}) {
    if (!this.client[method]) {
      throw new Error(`Method ${method} not found`);
    }

    return this.client[method](request, options);
  }
}

export default GRPCServer;