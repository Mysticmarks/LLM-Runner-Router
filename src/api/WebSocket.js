/**
 * WebSocket API
 * Real-time streaming interface for LLM inference
 * Supports bidirectional communication and streaming responses
 */

import { WebSocketServer } from 'ws';
import { Logger } from '../utils/Logger.js';
import { StreamProcessor } from '../runtime/StreamProcessor.js';
import { EventEmitter } from 'events';
import crypto from 'crypto';

export class WebSocketAPI extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = new Logger('WebSocketAPI');
    this.config = {
      port: config.port || 8080,
      path: config.path || '/ws',
      maxConnections: config.maxConnections || 100,
      heartbeatInterval: config.heartbeatInterval || 30000, // 30 seconds
      maxMessageSize: config.maxMessageSize || 10 * 1024 * 1024, // 10MB
      authEnabled: config.authEnabled || false,
      authHandler: config.authHandler || null,
      corsOrigins: config.corsOrigins || '*'
    };
    
    this.wss = null;
    this.clients = new Map();
    this.streamProcessor = new StreamProcessor();
    this.router = null; // Will be set by server
    this.heartbeatTimer = null;
  }

  /**
   * Initialize WebSocket server
   */
  async initialize(server, router) {
    this.logger.info('Initializing WebSocket API');
    
    this.router = router;
    await this.streamProcessor.initialize();
    
    // Create WebSocket server
    this.wss = new WebSocketServer({
      server,
      path: this.config.path,
      maxPayload: this.config.maxMessageSize,
      verifyClient: this.verifyClient.bind(this)
    });
    
    // Set up event handlers
    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', this.handleError.bind(this));
    
    // Start heartbeat
    this.startHeartbeat();
    
    this.logger.info(`WebSocket server listening on path ${this.config.path}`);
    
    return true;
  }

  /**
   * Verify client connection
   */
  verifyClient(info, callback) {
    // Check origin
    if (this.config.corsOrigins !== '*') {
      const origin = info.origin || info.req.headers.origin;
      const allowed = Array.isArray(this.config.corsOrigins) 
        ? this.config.corsOrigins.includes(origin)
        : this.config.corsOrigins === origin;
        
      if (!allowed) {
        callback(false, 403, 'Forbidden');
        return;
      }
    }
    
    // Check authentication if enabled
    if (this.config.authEnabled && this.config.authHandler) {
      const token = this.extractToken(info.req);
      this.config.authHandler(token, (err, authenticated) => {
        if (err || !authenticated) {
          callback(false, 401, 'Unauthorized');
        } else {
          callback(true);
        }
      });
    } else {
      callback(true);
    }
  }

  /**
   * Extract authentication token
   */
  extractToken(req) {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Check query parameter
    const url = new URL(req.url, `http://${req.headers.host}`);
    return url.searchParams.get('token');
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const clientId = crypto.randomUUID();
    const clientIp = req.socket.remoteAddress;
    
    this.logger.info(`New WebSocket connection: ${clientId} from ${clientIp}`);
    
    // Check max connections
    if (this.clients.size >= this.config.maxConnections) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Server at maximum capacity'
      }));
      ws.close(1008, 'Maximum connections reached');
      return;
    }
    
    // Create client object
    const client = {
      id: clientId,
      ws,
      ip: clientIp,
      connected: Date.now(),
      lastActivity: Date.now(),
      streams: new Set(),
      metadata: {}
    };
    
    this.clients.set(clientId, client);
    
    // Set up client event handlers
    ws.on('message', (data) => this.handleMessage(clientId, data));
    ws.on('close', () => this.handleDisconnect(clientId));
    ws.on('error', (error) => this.handleClientError(clientId, error));
    ws.on('pong', () => this.handlePong(clientId));
    
    // Send welcome message
    this.sendMessage(clientId, {
      type: 'connected',
      clientId,
      timestamp: Date.now(),
      capabilities: {
        streaming: true,
        batch: true,
        models: this.router ? this.router.registry.getAll().map(m => m.id) : []
      }
    });
    
    this.emit('connection', client);
  }

  /**
   * Handle incoming message
   */
  async handleMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    client.lastActivity = Date.now();
    
    try {
      const message = JSON.parse(data.toString());
      
      this.logger.debug(`Message from ${clientId}: ${message.type}`);
      
      switch (message.type) {
        case 'inference':
          await this.handleInference(clientId, message);
          break;
          
        case 'stream':
          await this.handleStream(clientId, message);
          break;
          
        case 'stop':
          await this.handleStop(clientId, message);
          break;
          
        case 'list_models':
          await this.handleListModels(clientId, message);
          break;
          
        case 'load_model':
          await this.handleLoadModel(clientId, message);
          break;
          
        case 'ping':
          this.sendMessage(clientId, { type: 'pong', timestamp: Date.now() });
          break;
          
        default:
          this.sendError(clientId, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error(`Error handling message from ${clientId}: ${error.message}`);
      this.sendError(clientId, error.message);
    }
  }

  /**
   * Handle inference request
   */
  async handleInference(clientId, message) {
    if (!this.router) {
      this.sendError(clientId, 'Router not initialized');
      return;
    }
    
    const { prompt, modelId, options = {} } = message;
    
    if (!prompt) {
      this.sendError(clientId, 'Prompt required');
      return;
    }
    
    try {
      const startTime = Date.now();
      
      // Run inference
      const result = await this.router.quick(prompt, {
        modelId,
        ...options
      });
      
      const duration = Date.now() - startTime;
      
      // Send response
      this.sendMessage(clientId, {
        type: 'inference_result',
        requestId: message.requestId,
        result: result.text || result,
        model: result.model,
        duration,
        usage: result.usage
      });
    } catch (error) {
      this.sendError(clientId, `Inference failed: ${error.message}`, message.requestId);
    }
  }

  /**
   * Handle streaming request
   */
  async handleStream(clientId, message) {
    if (!this.router) {
      this.sendError(clientId, 'Router not initialized');
      return;
    }
    
    const client = this.clients.get(clientId);
    if (!client) return;
    
    const { prompt, modelId, options = {} } = message;
    const streamId = message.streamId || crypto.randomUUID();
    
    if (!prompt) {
      this.sendError(clientId, 'Prompt required');
      return;
    }
    
    try {
      // Create stream
      const stream = this.streamProcessor.createStream(streamId, {
        ...options,
        batchingEnabled: options.batching !== false
      });
      
      client.streams.add(streamId);
      
      // Send stream started message
      this.sendMessage(clientId, {
        type: 'stream_started',
        streamId,
        requestId: message.requestId
      });
      
      // Set up stream output handling
      stream.readable.on('data', (chunk) => {
        this.sendMessage(clientId, {
          type: 'stream_token',
          streamId,
          token: chunk,
          timestamp: Date.now()
        });
      });
      
      stream.readable.on('end', () => {
        this.sendMessage(clientId, {
          type: 'stream_end',
          streamId,
          timestamp: Date.now()
        });
        client.streams.delete(streamId);
      });
      
      stream.readable.on('error', (error) => {
        this.sendError(clientId, `Stream error: ${error.message}`, streamId);
        client.streams.delete(streamId);
      });
      
      // Start generating tokens
      const generator = await this.router.stream(prompt, {
        modelId,
        ...options
      });
      
      // Feed tokens to stream
      (async () => {
        try {
          for await (const token of generator) {
            await stream.write(token);
          }
          stream.end();
        } catch (error) {
          this.sendError(clientId, `Generation error: ${error.message}`, streamId);
          stream.end();
        }
      })();
      
    } catch (error) {
      this.sendError(clientId, `Stream failed: ${error.message}`, message.requestId);
    }
  }

  /**
   * Handle stop request
   */
  async handleStop(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    const { streamId } = message;
    
    if (streamId && client.streams.has(streamId)) {
      try {
        this.streamProcessor.endStream(streamId);
        client.streams.delete(streamId);
        
        this.sendMessage(clientId, {
          type: 'stream_stopped',
          streamId
        });
      } catch (error) {
        this.sendError(clientId, `Failed to stop stream: ${error.message}`);
      }
    } else {
      this.sendError(clientId, 'Stream not found');
    }
  }

  /**
   * Handle list models request
   */
  async handleListModels(clientId, message) {
    if (!this.router) {
      this.sendError(clientId, 'Router not initialized');
      return;
    }
    
    const models = this.router.registry.getAll();
    
    this.sendMessage(clientId, {
      type: 'models_list',
      requestId: message.requestId,
      models: models.map(m => ({
        id: m.id,
        name: m.name,
        format: m.format,
        loaded: m.loaded || false,
        metadata: m.metadata
      }))
    });
  }

  /**
   * Handle load model request
   */
  async handleLoadModel(clientId, message) {
    if (!this.router) {
      this.sendError(clientId, 'Router not initialized');
      return;
    }
    
    const { source, format, id, name } = message;
    
    if (!source) {
      this.sendError(clientId, 'Model source required');
      return;
    }
    
    try {
      const model = await this.router.load({
        source,
        format: format || 'auto',
        id: id || `model-${Date.now()}`,
        name: name || 'WebSocket Loaded Model'
      });
      
      this.sendMessage(clientId, {
        type: 'model_loaded',
        requestId: message.requestId,
        model: {
          id: model.id,
          name: model.name,
          format: model.format
        }
      });
    } catch (error) {
      this.sendError(clientId, `Failed to load model: ${error.message}`, message.requestId);
    }
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    this.logger.info(`Client disconnected: ${clientId}`);
    
    // Clean up streams
    for (const streamId of client.streams) {
      try {
        this.streamProcessor.endStream(streamId);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    
    this.clients.delete(clientId);
    this.emit('disconnect', client);
  }

  /**
   * Handle client error
   */
  handleClientError(clientId, error) {
    this.logger.error(`Client ${clientId} error: ${error.message}`);
    
    const client = this.clients.get(clientId);
    if (client) {
      client.ws.close(1011, 'Internal error');
      this.handleDisconnect(clientId);
    }
  }

  /**
   * Handle pong message
   */
  handlePong(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastActivity = Date.now();
    }
  }

  /**
   * Handle server error
   */
  handleError(error) {
    this.logger.error(`WebSocket server error: ${error.message}`);
    this.emit('error', error);
  }

  /**
   * Send message to client
   */
  sendMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== client.ws.OPEN) {
      return false;
    }
    
    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      this.logger.error(`Failed to send message to ${clientId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Send error message
   */
  sendError(clientId, error, requestId = null) {
    this.sendMessage(clientId, {
      type: 'error',
      error: error.toString(),
      requestId,
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message, filter = null) {
    const payload = JSON.stringify(message);
    let sent = 0;
    
    for (const [clientId, client] of this.clients) {
      if (filter && !filter(client)) continue;
      
      if (client.ws.readyState === client.ws.OPEN) {
        try {
          client.ws.send(payload);
          sent++;
        } catch (error) {
          this.logger.error(`Broadcast failed for ${clientId}: ${error.message}`);
        }
      }
    }
    
    return sent;
  }

  /**
   * Start heartbeat timer
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      
      for (const [clientId, client] of this.clients) {
        // Check for inactive clients
        if (now - client.lastActivity > this.config.heartbeatInterval * 2) {
          this.logger.warn(`Client ${clientId} inactive, disconnecting`);
          client.ws.close(1000, 'Inactive');
          this.handleDisconnect(clientId);
        } else {
          // Send ping
          if (client.ws.readyState === client.ws.OPEN) {
            client.ws.ping();
          }
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const clients = [];
    
    for (const [id, client] of this.clients) {
      clients.push({
        id,
        ip: client.ip,
        connected: new Date(client.connected).toISOString(),
        lastActivity: new Date(client.lastActivity).toISOString(),
        activeStreams: client.streams.size
      });
    }
    
    return {
      totalConnections: this.clients.size,
      maxConnections: this.config.maxConnections,
      clients,
      streamProcessor: this.streamProcessor.getStatistics()
    };
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    this.logger.info('Cleaning up WebSocket API');
    
    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    // Close all connections
    for (const [clientId, client] of this.clients) {
      client.ws.close(1000, 'Server shutting down');
    }
    
    // Close server
    if (this.wss) {
      await new Promise((resolve) => {
        this.wss.close(resolve);
      });
    }
    
    // Clean up stream processor
    await this.streamProcessor.cleanup();
  }
}