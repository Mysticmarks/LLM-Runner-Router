# 💾 LLM-Runner-Router Memory Management Guide

*Master the art of efficient memory utilization for AI model orchestration*

## 📖 Table of Contents

- [Memory Architecture Overview](#memory-architecture-overview)
- [Memory Management Components](#memory-management-components)
- [Model Memory Optimization](#model-memory-optimization)
- [Cache Management Strategies](#cache-management-strategies)
- [Memory Monitoring and Alerts](#memory-monitoring-and-alerts)
- [Garbage Collection Optimization](#garbage-collection-optimization)
- [Memory Pools and Allocation](#memory-pools-and-allocation)
- [Memory Pressure Handling](#memory-pressure-handling)
- [Platform-Specific Optimizations](#platform-specific-optimizations)
- [Memory Leak Detection](#memory-leak-detection)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## 🏗️ Memory Architecture Overview

### Memory Hierarchy in LLM-Runner-Router

```
┌─────────────────────────────────────────────┐
│                Application Memory           │
├─────────────────────────────────────────────┤
│  L1: Hot Model Cache (Fast Access)         │
│  └─ 256MB - 1GB (depending on model size)  │
├─────────────────────────────────────────────┤
│  L2: Warm Model Storage (SSD/NVMe)         │
│  └─ 2GB - 16GB (persistent between loads)  │
├─────────────────────────────────────────────┤
│  L3: Cold Storage (Network/HDD)            │
│  └─ Unlimited (model repositories)         │
├─────────────────────────────────────────────┤
│  Runtime Caches                            │
│  ├─ Tokenizer Cache (64MB)                 │
│  ├─ Response Cache (256MB)                 │
│  └─ Metadata Cache (32MB)                  │
├─────────────────────────────────────────────┤
│  System Buffers                            │
│  ├─ Network Buffers (128MB)                │
│  ├─ File I/O Buffers (64MB)                │
│  └─ Stream Buffers (32MB)                  │
└─────────────────────────────────────────────┘
```

### Memory Allocation Strategy

```javascript
class MemoryManager {
  constructor(config = {}) {
    this.config = {
      // Memory limits (in bytes)
      maxHeapSize: config.maxHeapSize || (4 * 1024 * 1024 * 1024), // 4GB
      modelCacheSize: config.modelCacheSize || (1 * 1024 * 1024 * 1024), // 1GB
      responseCacheSize: config.responseCacheSize || (256 * 1024 * 1024), // 256MB
      
      // Thresholds
      warningThreshold: 0.75,  // 75%
      criticalThreshold: 0.90, // 90%
      emergencyThreshold: 0.95, // 95%
      
      // GC settings
      gcInterval: 30000,       // 30 seconds
      forcedGcThreshold: 0.85, // 85%
      
      // Pool sizes
      smallPoolSize: 64 * 1024,      // 64KB
      mediumPoolSize: 1024 * 1024,   // 1MB
      largePoolSize: 16 * 1024 * 1024, // 16MB
      
      ...config
    };
    
    this.pools = new Map();
    this.allocations = new Map();
    this.metrics = new MemoryMetrics();
    
    this.initializePools();
    this.startMonitoring();
  }
}
```

## 🧠 Memory Management Components

### 1. Memory Manager Core

```javascript
class AdvancedMemoryManager {
  constructor() {
    this.allocations = new Map();
    this.pools = {
      small: new MemoryPool(64 * 1024, 100),    // 64KB blocks
      medium: new MemoryPool(1024 * 1024, 50),  // 1MB blocks
      large: new MemoryPool(16 * 1024 * 1024, 10) // 16MB blocks
    };
    this.compressionCache = new Map();
    this.swapManager = new SwapManager();
  }
  
  async allocate(size, options = {}) {
    const { priority = 'normal', compressed = false, swappable = true } = options;
    
    // Check available memory
    const available = await this.getAvailableMemory();
    if (available < size && !swappable) {
      throw new MemoryError('Insufficient memory for non-swappable allocation');
    }
    
    // Try pool allocation first
    const poolBuffer = this.tryPoolAllocation(size);
    if (poolBuffer) {
      return this.wrapBuffer(poolBuffer, { size, priority, compressed, swappable });
    }
    
    // Direct allocation
    if (available >= size) {
      const buffer = Buffer.allocUnsafe(size);
      return this.wrapBuffer(buffer, { size, priority, compressed, swappable });
    }
    
    // Swap-based allocation
    if (swappable) {
      await this.makeRoom(size);
      const buffer = Buffer.allocUnsafe(size);
      return this.wrapBuffer(buffer, { size, priority, compressed, swappable });
    }
    
    throw new MemoryError('Unable to allocate memory');
  }
  
  async makeRoom(requiredSize) {
    // 1. Clear low-priority cached data
    await this.clearLowPriorityCaches();
    
    // 2. Compress existing allocations
    await this.compressAllocations();
    
    // 3. Swap out least recently used data
    await this.swapLRUData(requiredSize);
    
    // 4. Force garbage collection
    if (global.gc) {
      global.gc();
    }
  }
  
  wrapBuffer(buffer, metadata) {
    const allocation = new ManagedAllocation(buffer, metadata);
    this.allocations.set(allocation.id, allocation);
    
    // Set up automatic cleanup
    allocation.on('unused', () => {
      this.scheduleCleanup(allocation.id);
    });
    
    return allocation;
  }
}
```

### 2. Memory Pool Implementation

```javascript
class MemoryPool {
  constructor(blockSize, maxBlocks) {
    this.blockSize = blockSize;
    this.maxBlocks = maxBlocks;
    this.available = [];
    this.allocated = new Set();
    this.totalAllocated = 0;
    
    // Pre-allocate some blocks
    this.preAllocate(Math.min(5, maxBlocks));
  }
  
  allocate() {
    if (this.available.length === 0) {
      if (this.totalAllocated >= this.maxBlocks) {
        return null; // Pool exhausted
      }
      
      // Allocate new block
      const block = Buffer.allocUnsafe(this.blockSize);
      this.totalAllocated++;
      this.allocated.add(block);
      return block;
    }
    
    // Reuse available block
    const block = this.available.pop();
    this.allocated.add(block);
    return block;
  }
  
  free(buffer) {
    if (!this.allocated.has(buffer)) {
      throw new Error('Buffer not allocated from this pool');
    }
    
    this.allocated.delete(buffer);
    
    // Clear buffer for security
    buffer.fill(0);
    
    // Return to available pool
    this.available.push(buffer);
  }
  
  preAllocate(count) {
    for (let i = 0; i < count; i++) {
      const block = Buffer.allocUnsafe(this.blockSize);
      this.available.push(block);
      this.totalAllocated++;
    }
  }
  
  getStats() {
    return {
      blockSize: this.blockSize,
      totalAllocated: this.totalAllocated,
      available: this.available.length,
      allocated: this.allocated.size,
      utilizationRate: this.allocated.size / this.totalAllocated
    };
  }
}
```

### 3. Managed Allocation Wrapper

```javascript
class ManagedAllocation extends EventEmitter {
  constructor(buffer, metadata) {
    super();
    this.id = this.generateId();
    this.buffer = buffer;
    this.metadata = metadata;
    this.lastAccessed = Date.now();
    this.accessCount = 0;
    this.isCompressed = false;
    this.originalData = null;
    
    // Set up monitoring
    this.setupMonitoring();
  }
  
  read(offset = 0, length = this.buffer.length) {
    this.updateAccess();
    
    if (this.isCompressed) {
      return this.decompressAndRead(offset, length);
    }
    
    return this.buffer.slice(offset, offset + length);
  }
  
  write(data, offset = 0) {
    this.updateAccess();
    
    if (this.isCompressed) {
      this.decompress();
    }
    
    data.copy(this.buffer, offset);
    return this;
  }
  
  async compress() {
    if (this.isCompressed) return;
    
    const compressed = await this.compressData(this.buffer);
    if (compressed.length < this.buffer.length * 0.8) {
      this.originalData = this.buffer;
      this.buffer = compressed;
      this.isCompressed = true;
      this.emit('compressed', this.originalData.length - compressed.length);
    }
  }
  
  async decompress() {
    if (!this.isCompressed) return;
    
    this.buffer = await this.decompressData(this.buffer);
    this.isCompressed = false;
    this.originalData = null;
    this.emit('decompressed');
  }
  
  updateAccess() {
    this.lastAccessed = Date.now();
    this.accessCount++;
    this.emit('accessed');
  }
  
  setupMonitoring() {
    // Mark as unused after period of inactivity
    const checkInterval = setInterval(() => {
      const inactive = Date.now() - this.lastAccessed;
      if (inactive > 300000) { // 5 minutes
        this.emit('unused');
        clearInterval(checkInterval);
      }
    }, 60000); // Check every minute
  }
  
  free() {
    this.emit('freed');
    if (this.buffer) {
      this.buffer.fill(0); // Security: clear sensitive data
      this.buffer = null;
    }
  }
}
```

## 🤖 Model Memory Optimization

### Model Loading Strategies

```javascript
class ModelMemoryOptimizer {
  constructor() {
    this.loadedModels = new Map();
    this.modelMetrics = new Map();
    this.loadingQueue = new PriorityQueue();
  }
  
  async loadModelWithOptimization(modelName, options = {}) {
    const memoryBudget = await this.calculateMemoryBudget();
    const modelInfo = await this.getModelInfo(modelName);
    
    // Determine optimal loading strategy
    const strategy = this.selectLoadingStrategy(modelInfo, memoryBudget, options);
    
    switch (strategy.type) {
      case 'full':
        return await this.loadFullModel(modelName, strategy.options);
      case 'quantized':
        return await this.loadQuantizedModel(modelName, strategy.options);
      case 'sharded':
        return await this.loadShardedModel(modelName, strategy.options);
      case 'streaming':
        return await this.loadStreamingModel(modelName, strategy.options);
      default:
        throw new Error(`Unknown loading strategy: ${strategy.type}`);
    }
  }
  
  selectLoadingStrategy(modelInfo, budget, userOptions) {
    const modelSize = modelInfo.size;
    const availableMemory = budget.available;
    
    // Strategy selection logic
    if (modelSize <= availableMemory * 0.6) {
      // Model fits comfortably in memory
      return {
        type: 'full',
        options: { precision: 'float32' }
      };
    } else if (modelSize <= availableMemory * 0.8) {
      // Model fits with quantization
      return {
        type: 'quantized',
        options: { 
          precision: 'float16',
          quantization: 'dynamic'
        }
      };
    } else if (modelSize <= availableMemory * 1.5) {
      // Model requires sharding
      return {
        type: 'sharded',
        options: {
          shards: Math.ceil(modelSize / (availableMemory * 0.4)),
          overlap: 0.1
        }
      };
    } else {
      // Model requires streaming
      return {
        type: 'streaming',
        options: {
          chunkSize: availableMemory * 0.3,
          cacheSize: availableMemory * 0.1
        }
      };
    }
  }
  
  async loadQuantizedModel(modelName, options) {
    const model = await this.loadModel(modelName);
    
    // Apply quantization
    const quantized = await this.quantizeModel(model, {
      method: options.quantization || 'dynamic',
      precision: options.precision || 'int8',
      preserveAccuracy: options.preserveAccuracy || 0.95
    });
    
    // Verify memory savings
    const originalSize = model.getMemoryUsage();
    const quantizedSize = quantized.getMemoryUsage();
    const savings = originalSize - quantizedSize;
    
    console.log(`Quantization saved ${(savings / 1024 / 1024).toFixed(2)}MB`);
    
    return quantized;
  }
  
  async loadShardedModel(modelName, options) {
    const shards = [];
    const shardCount = options.shards;
    
    for (let i = 0; i < shardCount; i++) {
      const shardName = `${modelName}_shard_${i}`;
      const shard = await this.loadModelShard(shardName, {
        index: i,
        total: shardCount,
        overlap: options.overlap
      });
      
      shards.push(shard);
    }
    
    return new ShardedModel(modelName, shards, options);
  }
}
```

### Model Unloading and Cleanup

```javascript
class ModelCleanupManager {
  constructor() {
    this.cleanupScheduler = new Map();
    this.retentionPolicies = new Map();
    this.dependencies = new Map();
  }
  
  scheduleCleanup(modelName, delay = 300000) { // 5 minutes default
    // Cancel existing cleanup
    if (this.cleanupScheduler.has(modelName)) {
      clearTimeout(this.cleanupScheduler.get(modelName));
    }
    
    // Schedule new cleanup
    const timeoutId = setTimeout(async () => {
      await this.performCleanup(modelName);
    }, delay);
    
    this.cleanupScheduler.set(modelName, timeoutId);
  }
  
  async performCleanup(modelName) {
    const model = this.loadedModels.get(modelName);
    if (!model) return;
    
    // Check if model is still needed
    if (await this.isModelInUse(modelName)) {
      this.scheduleCleanup(modelName, 60000); // Retry in 1 minute
      return;
    }
    
    // Check dependencies
    const dependents = this.getDependentModels(modelName);
    if (dependents.length > 0) {
      console.log(`Skipping cleanup of ${modelName}, has dependents:`, dependents);
      return;
    }
    
    // Perform cleanup
    await this.unloadModel(modelName);
    this.cleanupScheduler.delete(modelName);
  }
  
  async unloadModel(modelName) {
    const model = this.loadedModels.get(modelName);
    if (!model) return;
    
    console.log(`Unloading model: ${modelName}`);
    
    // Clear model memory
    await model.unload();
    
    // Clear associated caches
    await this.clearModelCaches(modelName);
    
    // Remove from tracking
    this.loadedModels.delete(modelName);
    this.modelMetrics.delete(modelName);
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
    
    console.log(`Model ${modelName} unloaded successfully`);
  }
  
  setRetentionPolicy(modelName, policy) {
    this.retentionPolicies.set(modelName, {
      maxIdleTime: policy.maxIdleTime || 300000,  // 5 minutes
      maxMemoryPressure: policy.maxMemoryPressure || 0.8, // 80%
      priority: policy.priority || 'normal',
      persistent: policy.persistent || false
    });
  }
}
```

## 💽 Cache Management Strategies

### Multi-Level Caching System

```javascript
class MultiLevelCache {
  constructor(config = {}) {
    this.l1 = new L1Cache(config.l1 || { maxSize: 64 * 1024 * 1024 }); // 64MB
    this.l2 = new L2Cache(config.l2 || { maxSize: 256 * 1024 * 1024 }); // 256MB
    this.l3 = new L3Cache(config.l3 || { maxSize: 1024 * 1024 * 1024 }); // 1GB
    
    this.stats = {
      hits: { l1: 0, l2: 0, l3: 0 },
      misses: 0,
      evictions: { l1: 0, l2: 0, l3: 0 }
    };
  }
  
  async get(key) {
    // L1 Cache (fastest)
    const l1Result = await this.l1.get(key);
    if (l1Result !== null) {
      this.stats.hits.l1++;
      return l1Result;
    }
    
    // L2 Cache
    const l2Result = await this.l2.get(key);
    if (l2Result !== null) {
      this.stats.hits.l2++;
      // Promote to L1
      await this.l1.set(key, l2Result);
      return l2Result;
    }
    
    // L3 Cache
    const l3Result = await this.l3.get(key);
    if (l3Result !== null) {
      this.stats.hits.l3++;
      // Promote to L2 and L1
      await this.l2.set(key, l3Result);
      await this.l1.set(key, l3Result);
      return l3Result;
    }
    
    this.stats.misses++;
    return null;
  }
  
  async set(key, value, ttl = 3600) {
    const size = this.calculateSize(value);
    
    // Store in all appropriate levels
    if (size <= this.l1.maxItemSize) {
      await this.l1.set(key, value, ttl);
    }
    
    if (size <= this.l2.maxItemSize) {
      await this.l2.set(key, value, ttl);
    }
    
    await this.l3.set(key, value, ttl);
  }
  
  async evictUnderPressure(targetSize) {
    let freed = 0;
    
    // Start with L1 (fastest to rebuild)
    freed += await this.l1.evictLRU(targetSize * 0.3);
    
    if (freed < targetSize) {
      freed += await this.l2.evictLRU(targetSize * 0.4);
    }
    
    if (freed < targetSize) {
      freed += await this.l3.evictLRU(targetSize - freed);
    }
    
    return freed;
  }
}
```

### Cache Compression and Deduplication

```javascript
class CompressedCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.data = new Map();
    this.compressed = new Map();
    this.deduplication = new Map(); // Hash -> count
    this.currentSize = 0;
  }
  
  async set(key, value) {
    const hash = this.hashValue(value);
    
    // Check for deduplication opportunity
    if (this.deduplication.has(hash)) {
      this.deduplication.set(hash, this.deduplication.get(hash) + 1);
      this.data.set(key, { type: 'reference', hash });
      return;
    }
    
    // Compress if valuable
    const compressed = await this.compressValue(value);
    const shouldCompress = compressed.length < value.length * 0.8;
    
    if (shouldCompress) {
      this.compressed.set(key, compressed);
      this.data.set(key, { type: 'compressed', size: compressed.length });
      this.currentSize += compressed.length;
    } else {
      this.data.set(key, { type: 'raw', value, size: value.length });
      this.currentSize += value.length;
    }
    
    this.deduplication.set(hash, 1);
    
    // Evict if necessary
    if (this.currentSize > this.maxSize) {
      await this.evictLRU(this.currentSize - this.maxSize);
    }
  }
  
  async get(key) {
    const entry = this.data.get(key);
    if (!entry) return null;
    
    switch (entry.type) {
      case 'raw':
        return entry.value;
      case 'compressed':
        const compressed = this.compressed.get(key);
        return await this.decompressValue(compressed);
      case 'reference':
        return await this.resolveReference(entry.hash);
    }
  }
  
  async compressValue(value) {
    // Use appropriate compression based on data type
    if (Buffer.isBuffer(value)) {
      return await this.compressBuffer(value);
    } else if (typeof value === 'string') {
      return await this.compressString(value);
    } else {
      const serialized = JSON.stringify(value);
      return await this.compressString(serialized);
    }
  }
}
```

## 📊 Memory Monitoring and Alerts

### Real-Time Memory Monitoring

```javascript
class MemoryMonitor {
  constructor(config = {}) {
    this.config = {
      checkInterval: config.checkInterval || 10000, // 10 seconds
      alertThresholds: {
        warning: 0.75,
        critical: 0.90,
        emergency: 0.95
      },
      historySize: 100,
      ...config
    };
    
    this.history = [];
    this.alerts = new EventEmitter();
    this.currentState = 'normal';
  }
  
  start() {
    this.interval = setInterval(() => {
      this.checkMemoryStatus();
    }, this.config.checkInterval);
    
    console.log('Memory monitoring started');
  }
  
  async checkMemoryStatus() {
    const status = await this.getDetailedMemoryStatus();
    
    // Update history
    this.history.push(status);
    if (this.history.length > this.config.historySize) {
      this.history.shift();
    }
    
    // Check thresholds
    const alertLevel = this.determineAlertLevel(status);
    
    if (alertLevel !== this.currentState) {
      await this.handleStateChange(this.currentState, alertLevel, status);
      this.currentState = alertLevel;
    }
    
    // Emit status update
    this.alerts.emit('status', status);
  }
  
  async getDetailedMemoryStatus() {
    const process_memory = process.memoryUsage();
    const heap_stats = v8.getHeapStatistics();
    
    return {
      timestamp: Date.now(),
      process: {
        rss: process_memory.rss,
        heapTotal: process_memory.heapTotal,
        heapUsed: process_memory.heapUsed,
        external: process_memory.external,
        arrayBuffers: process_memory.arrayBuffers
      },
      heap: {
        totalHeapSize: heap_stats.total_heap_size,
        totalHeapSizeExecutable: heap_stats.total_heap_size_executable,
        totalPhysicalSize: heap_stats.total_physical_size,
        totalAvailableSize: heap_stats.total_available_size,
        usedHeapSize: heap_stats.used_heap_size,
        heapSizeLimit: heap_stats.heap_size_limit,
        mallocedMemory: heap_stats.malloced_memory,
        peakMallocedMemory: heap_stats.peak_malloced_memory,
        doesZapGarbage: heap_stats.does_zap_garbage
      },
      gc: this.getGCStats(),
      custom: await this.getCustomMemoryStats()
    };
  }
  
  determineAlertLevel(status) {
    const heapUsage = status.process.heapUsed / status.process.heapTotal;
    const { warning, critical, emergency } = this.config.alertThresholds;
    
    if (heapUsage >= emergency) return 'emergency';
    if (heapUsage >= critical) return 'critical';
    if (heapUsage >= warning) return 'warning';
    return 'normal';
  }
  
  async handleStateChange(oldState, newState, status) {
    console.log(`Memory state changed: ${oldState} -> ${newState}`);
    
    switch (newState) {
      case 'warning':
        await this.handleWarningState(status);
        break;
      case 'critical':
        await this.handleCriticalState(status);
        break;
      case 'emergency':
        await this.handleEmergencyState(status);
        break;
      case 'normal':
        await this.handleNormalState(status);
        break;
    }
    
    this.alerts.emit('stateChange', { oldState, newState, status });
  }
  
  async handleWarningState(status) {
    // Proactive cleanup
    await this.router.cache.cleanup(0.1); // Clean 10% of cache
    await this.scheduleGC();
  }
  
  async handleCriticalState(status) {
    // Aggressive cleanup
    await this.router.cache.cleanup(0.3); // Clean 30% of cache
    await this.router.unloadLeastUsedModels(2);
    await this.forceGC();
  }
  
  async handleEmergencyState(status) {
    // Emergency procedures
    console.warn('🚨 Emergency memory state - initiating emergency cleanup');
    
    await this.router.cache.clear();
    await this.router.unloadAllNonEssentialModels();
    await this.clearAllBuffers();
    await this.forceGC();
    
    // Alert administrators
    await this.sendEmergencyAlert(status);
  }
}
```

### Memory Leak Detection

```javascript
class MemoryLeakDetector {
  constructor() {
    this.snapshots = [];
    this.leakThreshold = 50 * 1024 * 1024; // 50MB growth
    this.detectionInterval = 60000; // 1 minute
    this.maxSnapshots = 10;
    
    this.startDetection();
  }
  
  startDetection() {
    setInterval(() => {
      this.takeSnapshot();
      this.analyzeLeaks();
    }, this.detectionInterval);
  }
  
  takeSnapshot() {
    const snapshot = {
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      heap: v8.getHeapStatistics(),
      objects: this.countObjects()
    };
    
    this.snapshots.push(snapshot);
    
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }
  
  countObjects() {
    // Use heap snapshot to count objects
    const snapshot = v8.writeHeapSnapshot();
    // This is a simplified version - in practice, you'd parse the snapshot
    return {
      total: 0, // Would be calculated from snapshot
      byType: {} // Would be grouped by object type
    };
  }
  
  analyzeLeaks() {
    if (this.snapshots.length < 3) return;
    
    const recent = this.snapshots.slice(-3);
    const growth = this.calculateGrowth(recent);
    
    if (growth.total > this.leakThreshold) {
      this.reportLeak(growth, recent);
    }
  }
  
  calculateGrowth(snapshots) {
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    
    return {
      total: last.memory.heapUsed - first.memory.heapUsed,
      rss: last.memory.rss - first.memory.rss,
      external: last.memory.external - first.memory.external,
      duration: last.timestamp - first.timestamp
    };
  }
  
  reportLeak(growth, snapshots) {
    const report = {
      severity: this.classifyLeakSeverity(growth),
      growth,
      snapshots,
      possibleCauses: this.identifyPossibleCauses(growth),
      recommendations: this.generateRecommendations(growth)
    };
    
    console.warn('🔍 Memory leak detected:', report);
    this.emit('leak-detected', report);
  }
  
  identifyPossibleCauses(growth) {
    const causes = [];
    
    if (growth.external > growth.total * 0.5) {
      causes.push('Large external buffer allocations (possibly model data)');
    }
    
    if (growth.total > 100 * 1024 * 1024) { // 100MB
      causes.push('Significant heap growth - check for retained objects');
    }
    
    return causes;
  }
}
```

## 🗑️ Garbage Collection Optimization

### GC Strategy Configuration

```javascript
class GCOptimizer {
  constructor() {
    this.gcStats = {
      collections: 0,
      totalTime: 0,
      averageTime: 0,
      lastCollection: null
    };
    
    this.setupGCHooks();
    this.configureGCStrategy();
  }
  
  configureGCStrategy() {
    // Set optimal GC flags based on workload
    const gcFlags = [
      '--max-old-space-size=4096',      // 4GB heap limit
      '--optimize-for-size',             // Optimize for memory usage
      '--gc-interval=100',               // More frequent minor GC
      '--max-semi-space-size=128',       // Smaller new space
      '--initial-old-space-size=1024'    // Larger initial old space
    ];
    
    // These would be set at startup via NODE_OPTIONS
    console.log('Recommended GC flags:', gcFlags.join(' '));
  }
  
  setupGCHooks() {
    // Monitor GC performance
    const obs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        if (entry.entryType === 'gc') {
          this.recordGCEvent(entry);
        }
      }
    });
    
    obs.observe({ entryTypes: ['gc'] });
  }
  
  recordGCEvent(entry) {
    this.gcStats.collections++;
    this.gcStats.totalTime += entry.duration;
    this.gcStats.averageTime = this.gcStats.totalTime / this.gcStats.collections;
    this.gcStats.lastCollection = {
      kind: entry.kind,
      duration: entry.duration,
      timestamp: entry.startTime
    };
    
    // Alert on long GC pauses
    if (entry.duration > 100) { // 100ms
      console.warn(`Long GC pause detected: ${entry.duration.toFixed(2)}ms`);
    }
  }
  
  async triggerGC(type = 'full') {
    if (!global.gc) {
      console.warn('GC not exposed - start with --expose-gc flag');
      return;
    }
    
    const start = Date.now();
    
    switch (type) {
      case 'minor':
        // Force minor GC by creating pressure in new space
        this.createNewSpacePressure();
        break;
      case 'major':
        global.gc();
        break;
      case 'full':
        // Full collection including external memory
        global.gc(true);
        break;
    }
    
    const duration = Date.now() - start;
    console.log(`Manual ${type} GC completed in ${duration}ms`);
    
    return duration;
  }
  
  createNewSpacePressure() {
    // Create temporary objects to trigger minor GC
    const temp = [];
    for (let i = 0; i < 10000; i++) {
      temp.push(new Array(100).fill(Math.random()));
    }
    // temp will be collected in next minor GC
  }
  
  optimizeGCTiming() {
    // Schedule GC during low-activity periods
    const quietHours = [2, 3, 4, 5]; // 2AM-5AM
    const currentHour = new Date().getHours();
    
    if (quietHours.includes(currentHour)) {
      // More aggressive GC during quiet hours
      setInterval(() => this.triggerGC('full'), 300000); // Every 5 minutes
    } else {
      // Conservative GC during active hours
      setInterval(() => this.triggerGC('minor'), 120000); // Every 2 minutes
    }
  }
}
```

## 🏊 Memory Pools and Allocation

### Buffer Pool Implementation

```javascript
class BufferPool {
  constructor(options = {}) {
    this.pools = new Map();
    this.defaultSizes = [1024, 4096, 16384, 65536, 262144, 1048576]; // 1KB to 1MB
    this.maxBuffersPerSize = options.maxBuffersPerSize || 50;
    this.enableZeroFill = options.enableZeroFill || true;
    
    this.initializePools();
  }
  
  initializePools() {
    for (const size of this.defaultSizes) {
      this.pools.set(size, {
        size,
        available: [],
        allocated: new Set(),
        totalCreated: 0,
        hits: 0,
        misses: 0
      });
    }
  }
  
  allocate(requestedSize) {
    const poolSize = this.findBestPoolSize(requestedSize);
    const pool = this.pools.get(poolSize);
    
    if (!pool) {
      // No suitable pool, allocate directly
      return this.allocateDirect(requestedSize);
    }
    
    // Try to reuse from pool
    if (pool.available.length > 0) {
      const buffer = pool.available.pop();
      pool.allocated.add(buffer);
      pool.hits++;
      
      if (this.enableZeroFill) {
        buffer.fill(0);
      }
      
      return new PooledBuffer(buffer, this, poolSize);
    }
    
    // Pool exhausted, create new buffer
    if (pool.totalCreated < this.maxBuffersPerSize) {
      const buffer = Buffer.allocUnsafe(poolSize);
      pool.totalCreated++;
      pool.allocated.add(buffer);
      pool.misses++;
      
      return new PooledBuffer(buffer, this, poolSize);
    }
    
    // Pool at capacity, allocate directly
    return this.allocateDirect(requestedSize);
  }
  
  free(pooledBuffer) {
    const { buffer, poolSize } = pooledBuffer;
    const pool = this.pools.get(poolSize);
    
    if (!pool || !pool.allocated.has(buffer)) {
      // Not from pool, nothing to do
      return;
    }
    
    pool.allocated.delete(buffer);
    
    // Clear buffer for security
    if (this.enableZeroFill) {
      buffer.fill(0);
    }
    
    // Return to pool if space available
    if (pool.available.length < this.maxBuffersPerSize) {
      pool.available.push(buffer);
    }
    // Otherwise let GC handle it
  }
  
  findBestPoolSize(requestedSize) {
    for (const size of this.defaultSizes) {
      if (size >= requestedSize) {
        return size;
      }
    }
    return null; // Too large for any pool
  }
  
  allocateDirect(size) {
    return new DirectBuffer(Buffer.allocUnsafe(size));
  }
  
  getStats() {
    const stats = {};
    for (const [size, pool] of this.pools) {
      stats[size] = {
        available: pool.available.length,
        allocated: pool.allocated.size,
        totalCreated: pool.totalCreated,
        hitRate: pool.hits / (pool.hits + pool.misses) || 0
      };
    }
    return stats;
  }
}

class PooledBuffer {
  constructor(buffer, pool, poolSize) {
    this.buffer = buffer;
    this.pool = pool;
    this.poolSize = poolSize;
    this.freed = false;
  }
  
  free() {
    if (this.freed) return;
    
    this.pool.free(this);
    this.freed = true;
    this.buffer = null;
  }
  
  // Proxy buffer methods
  slice(...args) { return this.buffer.slice(...args); }
  copy(...args) { return this.buffer.copy(...args); }
  toString(...args) { return this.buffer.toString(...args); }
  get length() { return this.buffer.length; }
}
```

## ⚠️ Memory Pressure Handling

### Pressure Response System

```javascript
class MemoryPressureHandler {
  constructor(memoryManager) {
    this.memoryManager = memoryManager;
    this.pressureLevels = {
      none: { threshold: 0.0, actions: [] },
      low: { threshold: 0.7, actions: ['cache_cleanup'] },
      medium: { threshold: 0.8, actions: ['cache_cleanup', 'model_unload'] },
      high: { threshold: 0.9, actions: ['cache_cleanup', 'model_unload', 'force_gc'] },
      critical: { threshold: 0.95, actions: ['emergency_cleanup'] }
    };
    
    this.currentPressure = 'none';
    this.responseHistory = [];
  }
  
  async handlePressure(memoryUsage) {
    const pressure = this.calculatePressureLevel(memoryUsage);
    
    if (pressure !== this.currentPressure) {
      await this.executePressureResponse(pressure, memoryUsage);
      this.currentPressure = pressure;
    }
  }
  
  calculatePressureLevel(usage) {
    const ratio = usage.heapUsed / usage.heapTotal;
    
    for (const [level, config] of Object.entries(this.pressureLevels).reverse()) {
      if (ratio >= config.threshold) {
        return level;
      }
    }
    
    return 'none';
  }
  
  async executePressureResponse(pressure, usage) {
    const config = this.pressureLevels[pressure];
    const response = {
      pressure,
      timestamp: Date.now(),
      actions: [],
      memoryBefore: usage,
      memoryAfter: null
    };
    
    for (const action of config.actions) {
      const result = await this.executeAction(action);
      response.actions.push({ action, result });
    }
    
    response.memoryAfter = process.memoryUsage();
    this.responseHistory.push(response);
    
    // Keep only recent history
    if (this.responseHistory.length > 100) {
      this.responseHistory.shift();
    }
    
    console.log(`Memory pressure response (${pressure}):`, response);
  }
  
  async executeAction(action) {
    const startTime = Date.now();
    let result = { success: false, details: null };
    
    try {
      switch (action) {
        case 'cache_cleanup':
          const freed = await this.memoryManager.cache.cleanup(0.3);
          result = { success: true, details: { freed } };
          break;
          
        case 'model_unload':
          const unloaded = await this.memoryManager.unloadLeastUsedModels(2);
          result = { success: true, details: { unloaded } };
          break;
          
        case 'force_gc':
          if (global.gc) {
            global.gc(true);
            result = { success: true, details: { type: 'full' } };
          }
          break;
          
        case 'emergency_cleanup':
          await this.emergencyCleanup();
          result = { success: true, details: { type: 'emergency' } };
          break;
          
        default:
          result = { success: false, details: { error: 'Unknown action' } };
      }
    } catch (error) {
      result = { success: false, details: { error: error.message } };
    }
    
    result.duration = Date.now() - startTime;
    return result;
  }
  
  async emergencyCleanup() {
    console.warn('🚨 Executing emergency memory cleanup');
    
    // 1. Clear all caches
    await this.memoryManager.cache.clear();
    
    // 2. Unload all non-essential models
    await this.memoryManager.unloadAllNonEssential();
    
    // 3. Clear all buffers and pools
    await this.memoryManager.clearAllPools();
    
    // 4. Force multiple GC cycles
    if (global.gc) {
      for (let i = 0; i < 3; i++) {
        global.gc(true);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('Emergency cleanup completed');
  }
}
```

## 🔧 Platform-Specific Optimizations

### Node.js Optimizations

```javascript
class NodeMemoryOptimizer {
  static configureOptimalSettings() {
    // Heap size optimization
    const totalMemory = require('os').totalmem();
    const recommendedHeapSize = Math.min(
      Math.floor(totalMemory * 0.8 / 1024 / 1024), // 80% of total RAM
      8192 // Cap at 8GB
    );
    
    console.log(`Recommended --max-old-space-size=${recommendedHeapSize}`);
    
    // V8 flags for memory optimization
    const v8Flags = [
      '--optimize-for-size',
      '--max-semi-space-size=64',
      '--initial-old-space-size=512',
      '--gc-interval=100'
    ];
    
    return v8Flags;
  }
  
  static enableMemoryProfiling() {
    // Enable detailed memory tracking
    if (process.env.NODE_ENV === 'development') {
      process.on('exit', () => {
        const usage = process.memoryUsage();
        console.log('Final memory usage:', {
          rss: `${(usage.rss / 1024 / 1024).toFixed(2)}MB`,
          heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
          heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          external: `${(usage.external / 1024 / 1024).toFixed(2)}MB`
        });
      });
    }
  }
}
```

### Browser-Specific Optimizations

```javascript
class BrowserMemoryOptimizer {
  constructor() {
    this.isWorker = typeof WorkerGlobalScope !== 'undefined';
    this.supportsWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
  }
  
  async optimizeForBrowser() {
    // Use appropriate allocation strategy
    if (this.supportsWebGPU) {
      await this.setupWebGPUMemory();
    }
    
    // Use transferable objects for large data
    this.enableTransferableObjects();
    
    // Setup memory pressure monitoring
    if ('memory' in performance) {
      this.monitorPerformanceMemory();
    }
  }
  
  async setupWebGPUMemory() {
    if (!this.supportsWebGPU) return;
    
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    
    // Create GPU buffer pool
    this.gpuBufferPool = new Map();
    
    // Monitor GPU memory usage
    setInterval(() => {
      if (device.lost) {
        console.warn('GPU device lost - falling back to CPU');
      }
    }, 30000);
  }
  
  enableTransferableObjects() {
    // Override postMessage to use transferable objects
    const originalPostMessage = postMessage;
    
    self.postMessage = function(message, transferList) {
      // Automatically detect transferable objects
      const transfers = [];
      
      if (message.data instanceof ArrayBuffer) {
        transfers.push(message.data);
      }
      
      return originalPostMessage.call(this, message, transfers);
    };
  }
  
  monitorPerformanceMemory() {
    setInterval(() => {
      const memory = performance.memory;
      const usage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      
      if (usage > 0.8) {
        console.warn('High browser memory usage:', {
          used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
          total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
          limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`
        });
        
        // Trigger cleanup
        this.triggerBrowserCleanup();
      }
    }, 30000);
  }
  
  triggerBrowserCleanup() {
    // Browser-specific cleanup strategies
    
    // 1. Clear unused caches
    if ('caches' in self) {
      caches.keys().then(names => {
        names.forEach(name => {
          if (name.includes('temp') || name.includes('old')) {
            caches.delete(name);
          }
        });
      });
    }
    
    // 2. Release object URLs
    this.releaseObjectURLs();
    
    // 3. Clear large arrays/objects
    this.clearLargeObjects();
  }
}
```

## 🔍 Troubleshooting

### Common Memory Issues

#### Issue: Memory Usage Keeps Growing
```javascript
// Diagnostic checklist
async function diagnoseMemoryGrowth() {
  const checks = [
    {
      name: 'Event Listener Leaks',
      check: () => {
        const eventTargets = [];
        // Check for objects with too many listeners
        return eventTargets.filter(target => 
          target.listenerCount() > 100
        );
      }
    },
    {
      name: 'Unclosed Streams',
      check: () => {
        // Check for open streams
        return process._getActiveHandles().filter(handle =>
          handle.constructor.name.includes('Stream')
        );
      }
    },
    {
      name: 'Large Objects in Memory',
      check: () => {
        // Use heap snapshot to find large objects
        const snapshot = v8.writeHeapSnapshot();
        // Parse snapshot to find large objects
        return []; // Placeholder
      }
    }
  ];
  
  for (const check of checks) {
    console.log(`Checking ${check.name}...`);
    const result = await check.check();
    if (result.length > 0) {
      console.warn(`Issue found in ${check.name}:`, result);
    }
  }
}
```

#### Issue: Frequent GC Pauses
```javascript
// GC optimization strategies
function optimizeGCPauses() {
  // 1. Reduce allocation rate
  const objectPool = new ObjectPool();
  
  // 2. Use streaming for large operations
  function processLargeArray(array) {
    return new Promise((resolve) => {
      let index = 0;
      const batchSize = 1000;
      
      function processBatch() {
        const batch = array.slice(index, index + batchSize);
        // Process batch
        index += batchSize;
        
        if (index < array.length) {
          setImmediate(processBatch); // Allow GC between batches
        } else {
          resolve();
        }
      }
      
      processBatch();
    });
  }
  
  // 3. Use WeakMap for metadata
  const metadata = new WeakMap();
  
  return { objectPool, processLargeArray, metadata };
}
```

### Memory Debugging Tools

```javascript
class MemoryDebugger {
  static async generateHeapSnapshot() {
    const snapshot = v8.writeHeapSnapshot();
    console.log(`Heap snapshot written: ${snapshot}`);
    return snapshot;
  }
  
  static trackObjectCreation(ConstructorFn) {
    const originalConstructor = ConstructorFn;
    const instances = new WeakSet();
    
    function TrackedConstructor(...args) {
      const instance = new originalConstructor(...args);
      instances.add(instance);
      return instance;
    }
    
    TrackedConstructor.getInstanceCount = () => {
      // This is approximate since WeakSet doesn't have size
      return 'Use heap snapshot for accurate count';
    };
    
    return TrackedConstructor;
  }
  
  static async analyzeMemoryUsage() {
    const usage = process.memoryUsage();
    const heap = v8.getHeapStatistics();
    
    return {
      process: {
        rss: `${(usage.rss / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
        heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        external: `${(usage.external / 1024 / 1024).toFixed(2)}MB`,
        arrayBuffers: `${(usage.arrayBuffers / 1024 / 1024).toFixed(2)}MB`
      },
      heap: {
        totalHeapSize: `${(heap.total_heap_size / 1024 / 1024).toFixed(2)}MB`,
        usedHeapSize: `${(heap.used_heap_size / 1024 / 1024).toFixed(2)}MB`,
        heapSizeLimit: `${(heap.heap_size_limit / 1024 / 1024).toFixed(2)}MB`,
        mallocedMemory: `${(heap.malloced_memory / 1024 / 1024).toFixed(2)}MB`
      }
    };
  }
}
```

---

## 📚 Additional Resources

- **[Performance Guide](./PERFORMANCE.md)** - Performance optimization strategies
- **[Error Codes](./ERROR_CODES.md)** - Memory-related error codes
- **[Best Practices](./BEST_PRACTICES.md)** - Memory management best practices
- **[Scaling Guide](./SCALING.md)** - Memory considerations for scaling

---

*Remember: Effective memory management is about finding the right balance between performance, stability, and resource utilization. Monitor, measure, and optimize continuously.*

**Built with 💙 by Echo AI Systems**