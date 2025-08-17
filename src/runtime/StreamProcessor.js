/**
 * Stream Processor
 * Handles real-time streaming of model outputs
 * Supports token-by-token generation, batching, and backpressure
 */

import { Logger } from '../utils/Logger.js';
import { EventEmitter } from 'events';
import { Transform, Readable, pipeline } from 'stream';
import { performance } from 'perf_hooks';

class StreamProcessor extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = new Logger('StreamProcessor');
    this.config = {
      // Streaming settings
      chunkSize: config.chunkSize || 1, // Tokens per chunk
      bufferSize: config.bufferSize || 100, // Max buffered tokens
      flushInterval: config.flushInterval || 50, // ms between flushes
      
      // Batching settings
      batchSize: config.batchSize || 10, // Alias for maxBatchSize
      batchingEnabled: config.batchingEnabled !== false,
      maxBatchSize: config.maxBatchSize || config.batchSize || 10,
      batchTimeout: config.batchTimeout || 100, // ms
      
      // Backpressure settings
      highWaterMark: config.highWaterMark || 16384,
      enableBackpressure: config.enableBackpressure !== false,
      
      // Token processing
      tokenizer: config.tokenizer || null,
      detokenizer: config.detokenizer || null,
      
      // Performance settings
      enableMetrics: config.enableMetrics !== false,
      metricsInterval: config.metricsInterval || 1000 // ms
    };
    
    this.streams = new Map();
    this.batches = new Map();
    this.metrics = {
      tokensGenerated: 0,
      streamsCreated: 0,
      streamsCompleted: 0,
      averageLatency: 0,
      throughput: 0
    };
    
    this.metricsTimer = null;
  }

  /**
   * Initialize stream processor
   */
  async initialize() {
    this.logger.info('Initializing Stream Processor');
    
    // Start metrics collection
    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }
    
    return true;
  }

  /**
   * Create a new streaming session
   */
  createStream(streamId, options = {}) {
    const stream = {
      id: streamId,
      created: Date.now(),
      options: { ...this.config, ...options },
      buffer: [],
      tokenCount: 0,
      completed: false,
      transform: null,
      readable: null
    };
    
    // Create transform stream for processing
    stream.transform = new Transform({
      objectMode: true,
      highWaterMark: stream.options.highWaterMark,
      transform: this.createTransformFunction(streamId),
      flush: this.createFlushFunction(streamId)
    });
    
    // Create readable stream for output
    stream.readable = new Readable({
      objectMode: options.objectMode || false,
      read() {} // No-op, we'll push data
    });
    
    // Connect streams
    pipeline(
      stream.transform,
      stream.readable,
      (err) => {
        if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
          this.logger.error(`Stream ${streamId} pipeline error: ${err.message}`);
        }
      }
    );
    
    this.streams.set(streamId, stream);
    this.metrics.streamsCreated++;
    
    this.logger.debug(`Stream ${streamId} created`);
    
    return {
      write: (token) => this.writeToken(streamId, token),
      end: () => this.endStream(streamId),
      readable: stream.readable,
      getAsyncIterator: () => this.getAsyncIterator(streamId)
    };
  }

  /**
   * Create transform function for stream
   */
  createTransformFunction(streamId) {
    return (chunk, encoding, callback) => {
      try {
        const stream = this.streams.get(streamId);
        if (!stream) {
          return callback(new Error(`Stream ${streamId} not found`));
        }
        
        // Process token
        const processed = this.processToken(chunk, stream.options);
        
        // Update metrics
        stream.tokenCount++;
        this.metrics.tokensGenerated++;
        
        // Handle batching
        if (stream.options.batchingEnabled) {
          this.addToBatch(streamId, processed);
          
          // Check if batch should be flushed
          if (this.shouldFlushBatch(streamId)) {
            const batch = this.flushBatch(streamId);
            callback(null, batch);
          } else {
            callback(); // Don't output yet
          }
        } else {
          // Direct streaming
          callback(null, processed);
        }
      } catch (error) {
        callback(error);
      }
    };
  }

  /**
   * Create flush function for stream
   */
  createFlushFunction(streamId) {
    return (callback) => {
      try {
        const stream = this.streams.get(streamId);
        if (!stream) {
          return callback();
        }
        
        // Flush any remaining batched data
        if (stream.options.batchingEnabled) {
          const batch = this.flushBatch(streamId);
          if (batch) {
            this.push(batch);
          }
        }
        
        // Mark stream as completed
        stream.completed = true;
        this.metrics.streamsCompleted++;
        
        callback();
      } catch (error) {
        callback(error);
      }
    };
  }

  /**
   * Write token to stream
   */
  async writeToken(streamId, token) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }
    
    if (stream.completed) {
      throw new Error(`Stream ${streamId} already completed`);
    }
    
    // Handle backpressure
    if (this.config.enableBackpressure) {
      const canWrite = stream.transform.write(token);
      if (!canWrite) {
        // Wait for drain event
        await new Promise((resolve) => {
          stream.transform.once('drain', resolve);
        });
      }
    } else {
      stream.transform.write(token);
    }
    
    return true;
  }

  /**
   * End a streaming session
   */
  endStream(streamId) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }
    
    // End the transform stream
    stream.transform.end();
    
    // Clean up after a delay
    setTimeout(() => {
      this.streams.delete(streamId);
      this.batches.delete(streamId);
    }, 1000);
    
    this.logger.debug(`Stream ${streamId} ended`);
  }

  /**
   * Get async iterator for stream
   */
  async *getAsyncIterator(streamId) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }
    
    for await (const chunk of stream.readable) {
      yield chunk;
    }
  }

  /**
   * Process individual token
   */
  processToken(token, options) {
    // Apply any token processing
    let processed = token;
    
    // Detokenize if configured
    if (options.detokenizer) {
      processed = options.detokenizer(token);
    }
    
    return processed;
  }

  /**
   * Add token to batch
   */
  addToBatch(streamId, token) {
    if (!this.batches.has(streamId)) {
      this.batches.set(streamId, {
        tokens: [],
        created: Date.now()
      });
    }
    
    const batch = this.batches.get(streamId);
    batch.tokens.push(token);
  }

  /**
   * Check if batch should be flushed
   */
  shouldFlushBatch(streamId) {
    const batch = this.batches.get(streamId);
    if (!batch) return false;
    
    const stream = this.streams.get(streamId);
    if (!stream) return false;
    
    // Flush if batch size reached
    if (batch.tokens.length >= stream.options.maxBatchSize) {
      return true;
    }
    
    // Flush if timeout reached
    const age = Date.now() - batch.created;
    if (age >= stream.options.batchTimeout) {
      return true;
    }
    
    return false;
  }

  /**
   * Flush batch
   */
  flushBatch(streamId) {
    const batch = this.batches.get(streamId);
    if (!batch || batch.tokens.length === 0) {
      return null;
    }
    
    const tokens = batch.tokens;
    this.batches.delete(streamId);
    
    // Combine tokens
    const stream = this.streams.get(streamId);
    if (stream && stream.options.objectMode) {
      return tokens; // Return array in object mode
    }
    
    return tokens.join(''); // Join for text mode
  }

  /**
   * Create a server-sent events (SSE) stream
   */
  createSSEStream(streamId, response, options = {}) {
    // Set SSE headers
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable nginx buffering
    });
    
    const stream = this.createStream(streamId, {
      ...options,
      formatter: this.formatSSE
    });
    
    // Pipe tokens to SSE response
    stream.readable.on('data', (chunk) => {
      const event = this.formatSSE(chunk);
      response.write(event);
    });
    
    stream.readable.on('end', () => {
      response.write('event: done\ndata: [DONE]\n\n');
      response.end();
    });
    
    // Handle client disconnect
    response.on('close', () => {
      this.endStream(streamId);
    });
    
    return stream;
  }

  /**
   * Format data for SSE
   */
  formatSSE(data) {
    const json = JSON.stringify(data);
    return `data: ${json}\n\n`;
  }

  /**
   * Create a WebSocket stream handler
   */
  createWebSocketStream(streamId, ws, options = {}) {
    const stream = this.createStream(streamId, options);
    
    // Send tokens via WebSocket
    stream.readable.on('data', (chunk) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'token',
          data: chunk
        }));
      }
    });
    
    stream.readable.on('end', () => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'done'
        }));
      }
    });
    
    // Handle WebSocket close
    ws.on('close', () => {
      this.endStream(streamId);
    });
    
    return stream;
  }

  /**
   * Create a chunked HTTP response stream
   */
  createChunkedStream(streamId, response, options = {}) {
    response.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Transfer-Encoding': 'chunked'
    });
    
    const stream = this.createStream(streamId, options);
    
    // Pipe directly to response
    stream.readable.pipe(response);
    
    // Handle client disconnect
    response.on('close', () => {
      this.endStream(streamId);
    });
    
    return stream;
  }

  /**
   * Multiplex multiple streams
   */
  createMultiplexedStream(streams, options = {}) {
    const multiplexId = `multiplex-${Date.now()}`;
    const outputs = new Map();
    
    for (const [streamId, streamOptions] of streams) {
      const stream = this.createStream(streamId, streamOptions);
      outputs.set(streamId, stream);
    }
    
    return {
      id: multiplexId,
      streams: outputs,
      broadcast: (token) => {
        for (const stream of outputs.values()) {
          stream.write(token);
        }
      },
      end: () => {
        for (const stream of outputs.values()) {
          stream.end();
        }
      }
    };
  }

  /**
   * Apply stream transformations
   */
  applyTransformation(streamId, transform) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }
    
    // Add transformation to pipeline
    const transformStream = new Transform({
      objectMode: true,
      transform: (chunk, encoding, callback) => {
        try {
          const transformed = transform(chunk);
          callback(null, transformed);
        } catch (error) {
          callback(error);
        }
      }
    });
    
    // Insert into pipeline
    stream.transform.pipe(transformStream).pipe(stream.readable);
    
    return true;
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    this.metricsTimer = setInterval(() => {
      this.updateMetrics();
    }, this.config.metricsInterval);
  }

  /**
   * Update metrics
   */
  updateMetrics() {
    const now = Date.now();
    let totalLatency = 0;
    let activeStreams = 0;
    
    for (const stream of this.streams.values()) {
      if (!stream.completed) {
        activeStreams++;
        totalLatency += now - stream.created;
      }
    }
    
    if (activeStreams > 0) {
      this.metrics.averageLatency = totalLatency / activeStreams;
    }
    
    // Calculate throughput (tokens per second)
    const duration = this.config.metricsInterval / 1000;
    this.metrics.throughput = this.metrics.tokensGenerated / duration;
    
    this.emit('metrics', this.metrics);
  }

  /**
   * Get stream statistics
   */
  getStatistics() {
    const activeStreams = [];
    const completedCount = this.metrics.streamsCompleted;
    
    for (const [id, stream] of this.streams.entries()) {
      if (!stream.completed) {
        activeStreams.push({
          id,
          tokenCount: stream.tokenCount,
          duration: Date.now() - stream.created,
          bufferSize: stream.buffer.length
        });
      }
    }
    
    return {
      ...this.metrics,
      activeStreams: activeStreams.length,
      completedStreams: completedCount,
      streams: activeStreams
    };
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    this.logger.info('Cleaning up Stream Processor');
    
    // Stop metrics collection
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    
    // End all active streams
    for (const streamId of this.streams.keys()) {
      try {
        this.endStream(streamId);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    
    // Clear data
    this.streams.clear();
    this.batches.clear();
  }
}
export default StreamProcessor;
export { StreamProcessor };
