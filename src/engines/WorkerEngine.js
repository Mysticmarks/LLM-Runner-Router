/**
 * Worker Engine
 * Runs model inference in Web Workers or Service Workers
 * Provides non-blocking execution in browser environments
 */

import { BaseEngine } from './BaseEngine.js';

class WorkerEngine extends BaseEngine {
  constructor(config = {}) {
    super('WorkerEngine');
    this.config = {
      maxWorkers: config.maxWorkers || navigator?.hardwareConcurrency || 4,
      workerScript: config.workerScript || null,
      useSharedArrayBuffer: config.useSharedArrayBuffer !== false,
      transferableObjects: config.transferableObjects !== false,
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      loadBalancing: config.loadBalancing || 'round-robin'
    };
    
    this.workers = [];
    this.workerPool = [];
    this.taskQueue = [];
    this.currentWorkerIndex = 0;
    this.isServiceWorker = false;
    this.isBrowser = typeof window !== 'undefined';
    
    // Update capabilities
    this.capabilities = {
      ...this.capabilities,
      parallel: true,
      gpu: false,
      streaming: true,
      quantization: false,
      multiModal: false,
      batchProcessing: true
    };
  }

  /**
   * Check if supported
   */
  async isSupported() {
    return typeof Worker !== 'undefined' || typeof ServiceWorker !== 'undefined';
  }
  
  /**
   * Internal initialization implementation
   * @protected
   */
  async _initialize(options) {
    try {
      this.logger.info('Initializing Worker Engine');
      
      // Detect environment
      this.detectEnvironment();
      
      // Create worker pool
      if (this.isBrowser) {
        await this.createWorkerPool();
      }
      
      this.logger.info(`Worker Engine initialized with ${this.config.maxWorkers} workers`);
      
      return true;
    } catch (error) {
      this.logger.error(`Initialization failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Detect execution environment
   */
  detectEnvironment() {
    const globalScope = typeof globalThis !== 'undefined' && typeof globalThis.WorkerGlobalScope !== 'undefined'
      ? globalThis.WorkerGlobalScope
      : undefined;
    if (globalScope && typeof self !== 'undefined' && self instanceof globalScope) {
      this.isServiceWorker = true;
      this.logger.info('Running in Service Worker context');
    } else if (typeof window !== 'undefined') {
      this.isBrowser = true;
      this.logger.info('Running in Browser context');
    } else {
      this.logger.info('Running in Node.js context (Worker threads)');
    }
  }

  /**
   * Create worker pool
   */
  async createWorkerPool() {
    const workerCount = Math.min(this.config.maxWorkers, navigator.hardwareConcurrency || 4);
    
    for (let i = 0; i < workerCount; i++) {
      const worker = await this.createWorker(i);
      if (worker) {
        this.workerPool.push(worker);
      }
    }
    
    this.logger.info(`Worker pool created with ${this.workerPool.length} workers`);
  }

  /**
   * Create a single worker
   */
  async createWorker(id) {
    try {
      let worker;
      
      if (this.config.workerScript) {
        // Use provided worker script
        worker = new Worker(this.config.workerScript);
      } else {
        // Create inline worker
        const workerCode = this.getWorkerCode();
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        worker = new Worker(workerUrl);
      }
      
      // Setup worker
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Worker ${id} initialization timeout`));
        }, 5000);
        
        worker.onmessage = (e) => {
          if (e.data.type === 'ready') {
            clearTimeout(timeout);
            
            const workerWrapper = {
              id,
              worker,
              busy: false,
              taskCount: 0,
              lastUsed: Date.now()
            };
            
            // Setup message handler
            worker.onmessage = (event) => this.handleWorkerMessage(workerWrapper, event);
            worker.onerror = (error) => this.handleWorkerError(workerWrapper, error);
            
            resolve(workerWrapper);
          }
        };
        
        worker.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
        
        // Initialize worker
        worker.postMessage({ type: 'init', config: this.config });
      });
    } catch (error) {
      this.logger.error(`Failed to create worker ${id}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get inline worker code
   */
  getWorkerCode() {
    return `
      // Worker Engine - Inline Worker Code
      let initialized = false;
      let models = new Map();
      let config = {};
      
      // Message handler
      self.onmessage = async function(e) {
        const { type, id, data } = e.data;
        
        try {
          let result;
          
          switch (type) {
            case 'init':
              config = data.config || {};
              initialized = true;
              self.postMessage({ type: 'ready' });
              break;
              
            case 'loadModel':
              result = await loadModel(data);
              self.postMessage({ type: 'modelLoaded', id, result });
              break;
              
            case 'inference':
              result = await runInference(data);
              self.postMessage({ type: 'result', id, result });
              break;
              
            case 'compute':
              result = await compute(data);
              self.postMessage({ type: 'result', id, result });
              break;
              
            case 'transform':
              result = await transform(data);
              self.postMessage({ type: 'result', id, result });
              break;
              
            default:
              throw new Error('Unknown message type: ' + type);
          }
        } catch (error) {
          self.postMessage({ 
            type: 'error', 
            id, 
            error: error.message 
          });
        }
      };
      
      // Load model in worker
      async function loadModel(data) {
        const { modelId, source, format } = data;
        
        // Simulate model loading
        models.set(modelId, {
          source,
          format,
          loaded: true,
          timestamp: Date.now()
        });
        
        return { modelId, loaded: true };
      }
      
      // Run inference
      async function runInference(data) {
        const { modelId, input } = data;
        const model = models.get(modelId);
        
        if (!model) {
          throw new Error('Model not loaded: ' + modelId);
        }
        
        // Simulate inference
        const output = processInput(input);
        
        return {
          modelId,
          output,
          duration: Math.random() * 100
        };
      }
      
      // Compute operation
      async function compute(data) {
        const { operation, input } = data;
        
        switch (operation) {
          case 'matmul':
            return matrixMultiply(input.a, input.b);
          case 'activation':
            return applyActivation(input.tensor, input.type);
          case 'normalize':
            return normalize(input.tensor);
          default:
            return input;
        }
      }
      
      // Transform operation
      async function transform(data) {
        const { tensor, shape, operation } = data;
        
        switch (operation) {
          case 'reshape':
            return reshape(tensor, shape);
          case 'transpose':
            return transpose(tensor);
          case 'pad':
            return pad(tensor, data.padding);
          default:
            return tensor;
        }
      }
      
      // Helper functions
      function processInput(input) {
        if (Array.isArray(input)) {
          return input.map(val => Math.random());
        }
        return Math.random();
      }
      
      function matrixMultiply(a, b) {
        // Simplified matrix multiplication
        const result = [];
        for (let i = 0; i < a.length; i++) {
          result[i] = [];
          for (let j = 0; j < b[0].length; j++) {
            let sum = 0;
            for (let k = 0; k < b.length; k++) {
              sum += a[i][k] * b[k][j];
            }
            result[i][j] = sum;
          }
        }
        return result;
      }
      
      function applyActivation(tensor, type) {
        const flat = tensor.flat();
        switch (type) {
          case 'relu':
            return flat.map(v => Math.max(0, v));
          case 'sigmoid':
            return flat.map(v => 1 / (1 + Math.exp(-v)));
          case 'tanh':
            return flat.map(v => Math.tanh(v));
          default:
            return flat;
        }
      }
      
      function normalize(tensor) {
        const flat = tensor.flat();
        const mean = flat.reduce((a, b) => a + b, 0) / flat.length;
        const variance = flat.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / flat.length;
        const std = Math.sqrt(variance);
        return flat.map(v => (v - mean) / (std + 1e-7));
      }
      
      function reshape(tensor, shape) {
        return { data: tensor.flat(), shape };
      }
      
      function transpose(matrix) {
        if (!Array.isArray(matrix) || !Array.isArray(matrix[0])) {
          return matrix;
        }
        return matrix[0].map((_, i) => matrix.map(row => row[i]));
      }
      
      function pad(tensor, padding) {
        // Simplified padding
        return tensor.map(row => [0, ...row, 0]);
      }
      
      // Signal ready
      self.postMessage({ type: 'ready' });
    `;
  }

  /**
   * Handle worker message
   */
  handleWorkerMessage(workerWrapper, event) {
    const { type, id, result, error } = event.data;
    
    // Find pending task
    const taskIndex = this.taskQueue.findIndex(t => t.id === id);
    if (taskIndex === -1) return;
    
    const task = this.taskQueue[taskIndex];
    this.taskQueue.splice(taskIndex, 1);
    
    // Mark worker as available
    workerWrapper.busy = false;
    workerWrapper.taskCount++;
    workerWrapper.lastUsed = Date.now();
    
    // Process result
    if (type === 'error') {
      task.reject(new Error(error));
    } else {
      task.resolve(result);
    }
    
    // Process next task in queue
    this.processQueue();
  }

  /**
   * Handle worker error
   */
  handleWorkerError(workerWrapper, error) {
    this.logger.error(`Worker ${workerWrapper.id} error: ${error.message}`);
    
    // Mark worker as available (might be in error state)
    workerWrapper.busy = false;
    
    // Restart worker if needed
    this.restartWorker(workerWrapper);
  }

  /**
   * Restart a worker
   */
  async restartWorker(workerWrapper) {
    try {
      // Terminate old worker
      workerWrapper.worker.terminate();
      
      // Create new worker
      const newWorker = await this.createWorker(workerWrapper.id);
      if (newWorker) {
        const index = this.workerPool.findIndex(w => w.id === workerWrapper.id);
        if (index !== -1) {
          this.workerPool[index] = newWorker;
        }
      }
    } catch (error) {
      this.logger.error(`Failed to restart worker: ${error.message}`);
    }
  }

  /**
   * Execute task using worker
   */
  async execute(type, data) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return new Promise((resolve, reject) => {
      const taskId = `task-${Date.now()}-${Math.random()}`;
      
      const task = {
        id: taskId,
        type,
        data,
        resolve,
        reject,
        attempts: 0,
        created: Date.now()
      };
      
      // Add to queue
      this.taskQueue.push(task);
      
      // Process queue
      this.processQueue();
      
      // Set timeout
      setTimeout(() => {
        const index = this.taskQueue.findIndex(t => t.id === taskId);
        if (index !== -1) {
          this.taskQueue.splice(index, 1);
          reject(new Error('Task timeout'));
        }
      }, this.config.timeout);
    });
  }

  /**
   * Process task queue
   */
  processQueue() {
    if (this.taskQueue.length === 0) return;
    
    // Find available worker based on load balancing strategy
    const worker = this.selectWorker();
    if (!worker) return;
    
    // Get next task
    const task = this.taskQueue.find(t => t.attempts < this.config.retryAttempts);
    if (!task) return;
    
    // Mark worker as busy
    worker.busy = true;
    task.attempts++;
    
    // Send task to worker
    worker.worker.postMessage({
      type: task.type,
      id: task.id,
      data: task.data
    });
  }

  /**
   * Select worker based on load balancing strategy
   */
  selectWorker() {
    const availableWorkers = this.workerPool.filter(w => !w.busy);
    if (availableWorkers.length === 0) return null;
    
    switch (this.config.loadBalancing) {
      case 'round-robin':
        this.currentWorkerIndex = (this.currentWorkerIndex + 1) % availableWorkers.length;
        return availableWorkers[this.currentWorkerIndex];
        
      case 'least-used':
        return availableWorkers.reduce((min, w) => 
          w.taskCount < min.taskCount ? w : min
        );
        
      case 'random':
        return availableWorkers[Math.floor(Math.random() * availableWorkers.length)];
        
      default:
        return availableWorkers[0];
    }
  }

  /**
   * Load model in worker
   */
  async loadModel(modelId, source, format) {
    return await this.execute('loadModel', { modelId, source, format });
  }

  /**
   * Run inference in worker
   */
  async inference(modelId, input) {
    return await this.execute('inference', { modelId, input });
  }

  /**
   * Run computation in worker
   */
  async compute(operation, input) {
    return await this.execute('compute', { operation, input });
  }

  /**
   * Run transformation in worker
   */
  async transform(tensor, shape, operation) {
    return await this.execute('transform', { tensor, shape, operation });
  }

  /**
   * Get engine info
   */
  getInfo() {
    return {
      name: 'WorkerEngine',
      initialized: this.initialized,
      isBrowser: this.isBrowser,
      isServiceWorker: this.isServiceWorker,
      workers: this.workerPool.length,
      busyWorkers: this.workerPool.filter(w => w.busy).length,
      queueLength: this.taskQueue.length,
      config: this.config
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.logger.info('Cleaning up Worker Engine');
    
    // Terminate all workers
    for (const wrapper of this.workerPool) {
      wrapper.worker.terminate();
    }
    
    // Clear queues
    this.workerPool = [];
    this.taskQueue = [];
    this.initialized = false;
  }
}
export default WorkerEngine;
export { WorkerEngine };
