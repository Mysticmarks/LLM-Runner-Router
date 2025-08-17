/**
 * Memory Manager
 * Advanced memory optimization for model loading and inference
 * Handles memory mapping, pooling, and garbage collection
 */

import { Logger } from '../utils/Logger.js';
import os from 'os';
import { performance } from 'perf_hooks';

export class MemoryManager {
  constructor(config = {}) {
    this.logger = new Logger('MemoryManager');
    this.config = {
      maxMemoryUsage: config.maxMemoryUsage || 0.8, // 80% of available memory
      gcThreshold: config.gcThreshold || 0.7, // Trigger GC at 70% usage
      poolSize: config.poolSize || 10, // Buffer pool size
      enableMemoryMapping: config.enableMemoryMapping !== false,
      enableCompression: config.enableCompression !== false,
      monitoringInterval: config.monitoringInterval || 5000 // 5 seconds
    };
    
    this.models = new Map();
    this.bufferPool = [];
    this.statistics = {
      totalAllocated: 0,
      totalFreed: 0,
      peakUsage: 0,
      gcCount: 0,
      swapCount: 0
    };
    
    this.monitoring = null;
    this.compressionCache = new Map();
  }

  /**
   * Initialize memory manager
   */
  async initialize() {
    this.logger.info('Initializing Memory Manager');
    
    // Initialize buffer pool
    this.initializeBufferPool();
    
    // Start memory monitoring
    this.startMonitoring();
    
    // Set up process memory hooks
    this.setupMemoryHooks();
    
    return true;
  }

  /**
   * Initialize pre-allocated buffer pool
   */
  initializeBufferPool() {
    const bufferSize = 1024 * 1024; // 1MB buffers
    
    for (let i = 0; i < this.config.poolSize; i++) {
      this.bufferPool.push({
        buffer: Buffer.allocUnsafe(bufferSize),
        inUse: false,
        size: bufferSize
      });
    }
    
    this.logger.debug(`Buffer pool initialized with ${this.config.poolSize} buffers`);
  }

  /**
   * Start memory monitoring
   */
  startMonitoring() {
    if (this.monitoring) {
      clearInterval(this.monitoring);
    }
    
    this.monitoring = setInterval(() => {
      this.checkMemoryUsage();
    }, this.config.monitoringInterval);
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring() {
    if (this.monitoring) {
      clearInterval(this.monitoring);
      this.monitoring = null;
    }
  }

  /**
   * Set up process memory hooks
   */
  setupMemoryHooks() {
    // Handle process warnings
    process.on('warning', (warning) => {
      if (warning.name === 'MaxListenersExceededWarning') {
        this.logger.warn('Memory pressure detected - max listeners exceeded');
        this.performGarbageCollection();
      }
    });
    
    // Monitor for memory pressure
    if (global.gc) {
      // If --expose-gc flag is used
      const originalGc = global.gc;
      global.gc = () => {
        this.statistics.gcCount++;
        originalGc();
      };
    }
  }

  /**
   * Check current memory usage
   */
  checkMemoryUsage() {
    const usage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usageRatio = usedMemory / totalMemory;
    
    // Update statistics
    this.statistics.peakUsage = Math.max(this.statistics.peakUsage, usage.heapUsed);
    
    // Check if we need to trigger GC
    if (usageRatio > this.config.gcThreshold) {
      this.logger.warn(`Memory usage at ${(usageRatio * 100).toFixed(2)}% - triggering GC`);
      this.performGarbageCollection();
    }
    
    // Check if we need to swap models
    if (usageRatio > this.config.maxMemoryUsage) {
      this.logger.warn(`Memory usage critical at ${(usageRatio * 100).toFixed(2)}% - swapping models`);
      this.swapLeastUsedModel();
    }
    
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      freeMemory,
      totalMemory,
      usageRatio
    };
  }

  /**
   * Allocate memory for a model
   */
  async allocateModelMemory(modelId, sizeEstimate) {
    const memoryInfo = this.checkMemoryUsage();
    
    // Check if we have enough memory
    const requiredMemory = sizeEstimate || 100 * 1024 * 1024; // Default 100MB
    const availableMemory = memoryInfo.freeMemory;
    
    if (requiredMemory > availableMemory * 0.9) {
      // Not enough memory - try to free some
      this.logger.warn(`Insufficient memory for model ${modelId} - attempting to free memory`);
      await this.freeMemory(requiredMemory);
    }
    
    // Track allocation
    this.models.set(modelId, {
      size: requiredMemory,
      allocated: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 0,
      compressed: false,
      swapped: false
    });
    
    this.statistics.totalAllocated += requiredMemory;
    
    this.logger.debug(`Allocated ${(requiredMemory / 1024 / 1024).toFixed(2)}MB for model ${modelId}`);
    
    return true;
  }

  /**
   * Free memory by removing least recently used models
   */
  async freeMemory(requiredBytes) {
    const models = Array.from(this.models.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    let freedBytes = 0;
    
    for (const [modelId, info] of models) {
      if (freedBytes >= requiredBytes) break;
      
      if (!info.swapped) {
        // Try compression first
        if (!info.compressed && this.config.enableCompression) {
          await this.compressModel(modelId);
          freedBytes += info.size * 0.5; // Assume 50% compression
        } else {
          // Swap to disk
          await this.swapModelToDisk(modelId);
          freedBytes += info.size;
        }
      }
    }
    
    this.statistics.totalFreed += freedBytes;
    
    return freedBytes;
  }

  /**
   * Compress model in memory
   */
  async compressModel(modelId) {
    const info = this.models.get(modelId);
    if (!info || info.compressed) return;
    
    this.logger.debug(`Compressing model ${modelId}`);
    
    // Simulate compression (in real implementation, would use actual compression)
    info.compressed = true;
    info.size = info.size * 0.5; // Assume 50% compression ratio
    
    this.compressionCache.set(modelId, {
      compressed: true,
      originalSize: info.size * 2,
      compressionRatio: 0.5
    });
  }

  /**
   * Decompress model
   */
  async decompressModel(modelId) {
    const info = this.models.get(modelId);
    if (!info || !info.compressed) return;
    
    const compressionInfo = this.compressionCache.get(modelId);
    if (compressionInfo) {
      info.size = compressionInfo.originalSize;
      info.compressed = false;
      this.compressionCache.delete(modelId);
    }
  }

  /**
   * Swap model to disk
   */
  async swapModelToDisk(modelId) {
    const info = this.models.get(modelId);
    if (!info || info.swapped) return;
    
    this.logger.info(`Swapping model ${modelId} to disk`);
    
    // In real implementation, would write to disk
    info.swapped = true;
    this.statistics.swapCount++;
    
    // Free the memory
    this.statistics.totalFreed += info.size;
  }

  /**
   * Load model from disk
   */
  async loadModelFromDisk(modelId) {
    const info = this.models.get(modelId);
    if (!info || !info.swapped) return;
    
    this.logger.info(`Loading model ${modelId} from disk`);
    
    // Check available memory
    await this.allocateModelMemory(modelId, info.size);
    
    // In real implementation, would read from disk
    info.swapped = false;
    info.lastAccessed = Date.now();
    info.accessCount++;
  }

  /**
   * Swap least recently used model
   */
  async swapLeastUsedModel() {
    const models = Array.from(this.models.entries())
      .filter(([_, info]) => !info.swapped)
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    if (models.length > 0) {
      const [modelId] = models[0];
      await this.swapModelToDisk(modelId);
    }
  }

  /**
   * Perform garbage collection
   */
  performGarbageCollection() {
    this.logger.debug('Performing garbage collection');
    
    if (global.gc) {
      global.gc();
    } else {
      // Trigger GC indirectly
      const arrays = [];
      try {
        while (true) {
          arrays.push(new Array(1000000));
        }
      } catch (e) {
        // Memory pressure will trigger GC
        arrays.length = 0;
      }
    }
    
    this.statistics.gcCount++;
  }

  /**
   * Get buffer from pool
   */
  getPooledBuffer(size) {
    // Find available buffer of appropriate size
    const buffer = this.bufferPool.find(b => !b.inUse && b.size >= size);
    
    if (buffer) {
      buffer.inUse = true;
      return buffer.buffer.slice(0, size);
    }
    
    // No suitable buffer in pool, allocate new one
    return Buffer.allocUnsafe(size);
  }

  /**
   * Return buffer to pool
   */
  returnPooledBuffer(buffer) {
    const poolBuffer = this.bufferPool.find(b => b.buffer === buffer);
    if (poolBuffer) {
      poolBuffer.inUse = false;
    }
  }

  /**
   * Memory-map a file
   */
  async memoryMapFile(filePath, modelId) {
    if (!this.config.enableMemoryMapping) {
      return null;
    }
    
    try {
      // In Node.js, we can use mmap-io or similar libraries
      // For now, this is a placeholder
      this.logger.debug(`Memory-mapping file ${filePath} for model ${modelId}`);
      
      // Track the mapping
      const info = this.models.get(modelId);
      if (info) {
        info.memoryMapped = true;
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to memory-map file: ${error.message}`);
      return false;
    }
  }

  /**
   * Update model access statistics
   */
  updateModelAccess(modelId) {
    const info = this.models.get(modelId);
    if (info) {
      info.lastAccessed = Date.now();
      info.accessCount++;
      
      // Load from disk if swapped
      if (info.swapped) {
        this.loadModelFromDisk(modelId);
      }
      
      // Decompress if compressed
      if (info.compressed) {
        this.decompressModel(modelId);
      }
    }
  }

  /**
   * Get memory statistics
   */
  getStatistics() {
    const memoryInfo = this.checkMemoryUsage();
    
    return {
      ...this.statistics,
      currentUsage: memoryInfo,
      models: Array.from(this.models.entries()).map(([id, info]) => ({
        id,
        size: info.size,
        compressed: info.compressed,
        swapped: info.swapped,
        lastAccessed: new Date(info.lastAccessed).toISOString(),
        accessCount: info.accessCount
      })),
      bufferPool: {
        total: this.bufferPool.length,
        inUse: this.bufferPool.filter(b => b.inUse).length,
        available: this.bufferPool.filter(b => !b.inUse).length
      }
    };
  }

  /**
   * Optimize memory layout
   */
  async optimizeMemoryLayout() {
    this.logger.info('Optimizing memory layout');
    
    // Sort models by access frequency
    const models = Array.from(this.models.entries())
      .sort((a, b) => b[1].accessCount - a[1].accessCount);
    
    // Keep frequently accessed models in memory
    // Compress or swap less frequently used ones
    for (const [modelId, info] of models) {
      const accessRate = info.accessCount / ((Date.now() - info.allocated) / 1000 / 60); // accesses per minute
      
      if (accessRate < 0.1 && !info.swapped) {
        // Very low access rate - swap to disk
        await this.swapModelToDisk(modelId);
      } else if (accessRate < 1 && !info.compressed) {
        // Low access rate - compress
        await this.compressModel(modelId);
      }
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    this.logger.info('Cleaning up Memory Manager');
    
    // Stop monitoring
    this.stopMonitoring();
    
    // Clear caches
    this.compressionCache.clear();
    this.models.clear();
    
    // Clear buffer pool
    this.bufferPool = [];
    
    // Force GC
    this.performGarbageCollection();
  }
}