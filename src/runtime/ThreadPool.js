/**
 * Thread Pool Manager
 * Manages worker threads for parallel processing
 * Provides efficient task distribution and resource management
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { EventEmitter } from 'events';
import { cpus } from 'os';
import { Logger } from '../utils/Logger.js';
import PQueue from 'p-queue';

export class ThreadPool extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = new Logger('ThreadPool');
    this.config = {
      minThreads: config.minThreads || 2,
      maxThreads: config.maxThreads || cpus().length,
      idleTimeout: config.idleTimeout || 60000, // 1 minute
      taskTimeout: config.taskTimeout || 30000, // 30 seconds
      maxQueueSize: config.maxQueueSize || 1000,
      workerScript: config.workerScript || null,
      resourceLimits: config.resourceLimits || {
        maxOldGenerationSizeMb: 512,
        maxYoungGenerationSizeMb: 128,
        codeRangeSizeMb: 64
      },
      enableStatistics: config.enableStatistics !== false,
      autoScale: config.autoScale !== false
    };
    
    this.workers = new Map();
    this.taskQueue = new PQueue({ 
      concurrency: this.config.maxThreads,
      timeout: this.config.taskTimeout
    });
    this.statistics = {
      tasksCompleted: 0,
      tasksFailed: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      threadsCreated: 0,
      threadsDestroyed: 0,
      currentThreads: 0
    };
    
    this.initialized = false;
    this.shuttingDown = false;
  }

  /**
   * Initialize thread pool
   */
  async initialize() {
    if (this.initialized) return true;
    
    try {
      this.logger.info('Initializing Thread Pool');
      
      // Create initial worker threads
      await this.createInitialWorkers();
      
      // Setup auto-scaling if enabled
      if (this.config.autoScale) {
        this.setupAutoScaling();
      }
      
      // Setup statistics collection
      if (this.config.enableStatistics) {
        this.setupStatisticsCollection();
      }
      
      this.initialized = true;
      this.logger.info(`Thread Pool initialized with ${this.workers.size} workers`);
      
      return true;
    } catch (error) {
      this.logger.error(`Initialization failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Create initial worker threads
   */
  async createInitialWorkers() {
    const promises = [];
    
    for (let i = 0; i < this.config.minThreads; i++) {
      promises.push(this.createWorker());
    }
    
    await Promise.all(promises);
  }

  /**
   * Create a new worker thread
   */
  async createWorker() {
    return new Promise((resolve, reject) => {
      const workerId = `worker-${Date.now()}-${Math.random()}`;
      
      let worker;
      
      if (this.config.workerScript) {
        // Use provided worker script
        worker = new Worker(this.config.workerScript, {
          workerData: { workerId },
          resourceLimits: this.config.resourceLimits
        });
      } else {
        // Create inline worker
        const workerCode = this.getInlineWorkerCode();
        worker = new Worker(workerCode, {
          eval: true,
          workerData: { workerId },
          resourceLimits: this.config.resourceLimits
        });
      }
      
      const workerInfo = {
        id: workerId,
        worker,
        busy: false,
        tasksCompleted: 0,
        lastUsed: Date.now(),
        created: Date.now()
      };
      
      // Setup event handlers
      worker.on('message', (message) => this.handleWorkerMessage(workerInfo, message));
      worker.on('error', (error) => this.handleWorkerError(workerInfo, error));
      worker.on('exit', (code) => this.handleWorkerExit(workerInfo, code));
      
      worker.once('online', () => {
        this.workers.set(workerId, workerInfo);
        this.statistics.threadsCreated++;
        this.statistics.currentThreads++;
        this.emit('workerCreated', workerId);
        resolve(workerInfo);
      });
      
      // Timeout for worker creation
      setTimeout(() => {
        if (!this.workers.has(workerId)) {
          worker.terminate();
          reject(new Error('Worker creation timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Get inline worker code
   */
  getInlineWorkerCode() {
    return `
      const { parentPort, workerData } = require('worker_threads');
      const { performance } = require('perf_hooks');
      
      const workerId = workerData.workerId;
      const tasks = new Map();
      
      // Message handler
      parentPort.on('message', async (message) => {
        const { type, taskId, data } = message;
        
        try {
          const startTime = performance.now();
          let result;
          
          switch (type) {
            case 'execute':
              result = await executeTask(data);
              break;
              
            case 'compute':
              result = await performComputation(data);
              break;
              
            case 'transform':
              result = await performTransformation(data);
              break;
              
            case 'process':
              result = await processData(data);
              break;
              
            case 'ping':
              result = { pong: true };
              break;
              
            default:
              throw new Error('Unknown task type: ' + type);
          }
          
          const duration = performance.now() - startTime;
          
          parentPort.postMessage({
            type: 'result',
            taskId,
            result,
            duration,
            workerId
          });
        } catch (error) {
          parentPort.postMessage({
            type: 'error',
            taskId,
            error: error.message,
            stack: error.stack,
            workerId
          });
        }
      });
      
      // Execute generic task
      async function executeTask(data) {
        const { operation, input } = data;
        
        switch (operation) {
          case 'factorial':
            return factorial(input);
          case 'fibonacci':
            return fibonacci(input);
          case 'prime':
            return isPrime(input);
          case 'sort':
            return quickSort(input);
          default:
            return input;
        }
      }
      
      // Perform computation
      async function performComputation(data) {
        const { type, input } = data;
        
        switch (type) {
          case 'matmul':
            return matrixMultiply(input.a, input.b);
          case 'fft':
            return fastFourierTransform(input);
          case 'convolution':
            return convolution(input.signal, input.kernel);
          default:
            return input;
        }
      }
      
      // Perform transformation
      async function performTransformation(data) {
        const { tensor, operation } = data;
        
        switch (operation) {
          case 'transpose':
            return transpose(tensor);
          case 'reshape':
            return reshape(tensor, data.shape);
          case 'normalize':
            return normalize(tensor);
          default:
            return tensor;
        }
      }
      
      // Process data
      async function processData(data) {
        const { input, pipeline } = data;
        let result = input;
        
        for (const step of pipeline || []) {
          switch (step.type) {
            case 'map':
              result = result.map(step.fn);
              break;
            case 'filter':
              result = result.filter(step.fn);
              break;
            case 'reduce':
              result = result.reduce(step.fn, step.initial);
              break;
            default:
              break;
          }
        }
        
        return result;
      }
      
      // Helper functions
      function factorial(n) {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
      }
      
      function fibonacci(n) {
        if (n <= 1) return n;
        let a = 0, b = 1;
        for (let i = 2; i <= n; i++) {
          [a, b] = [b, a + b];
        }
        return b;
      }
      
      function isPrime(n) {
        if (n <= 1) return false;
        for (let i = 2; i <= Math.sqrt(n); i++) {
          if (n % i === 0) return false;
        }
        return true;
      }
      
      function quickSort(arr) {
        if (arr.length <= 1) return arr;
        const pivot = arr[Math.floor(arr.length / 2)];
        const left = arr.filter(x => x < pivot);
        const middle = arr.filter(x => x === pivot);
        const right = arr.filter(x => x > pivot);
        return [...quickSort(left), ...middle, ...quickSort(right)];
      }
      
      function matrixMultiply(a, b) {
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
      
      function fastFourierTransform(signal) {
        // Simplified FFT (Cooley-Tukey algorithm)
        const N = signal.length;
        if (N <= 1) return signal;
        
        const even = fastFourierTransform(signal.filter((_, i) => i % 2 === 0));
        const odd = fastFourierTransform(signal.filter((_, i) => i % 2 === 1));
        
        const result = new Array(N);
        for (let k = 0; k < N / 2; k++) {
          const t = odd[k] * Math.exp(-2 * Math.PI * k / N);
          result[k] = even[k] + t;
          result[k + N / 2] = even[k] - t;
        }
        return result;
      }
      
      function convolution(signal, kernel) {
        const result = [];
        for (let i = 0; i < signal.length; i++) {
          let sum = 0;
          for (let j = 0; j < kernel.length; j++) {
            if (i - j >= 0) {
              sum += signal[i - j] * kernel[j];
            }
          }
          result.push(sum);
        }
        return result;
      }
      
      function transpose(matrix) {
        return matrix[0].map((_, i) => matrix.map(row => row[i]));
      }
      
      function reshape(tensor, shape) {
        const flat = tensor.flat();
        const result = [];
        let index = 0;
        
        function buildShape(dims) {
          if (dims.length === 1) {
            return flat.slice(index, index += dims[0]);
          }
          const arr = [];
          for (let i = 0; i < dims[0]; i++) {
            arr.push(buildShape(dims.slice(1)));
          }
          return arr;
        }
        
        return buildShape(shape);
      }
      
      function normalize(tensor) {
        const flat = tensor.flat();
        const mean = flat.reduce((a, b) => a + b, 0) / flat.length;
        const std = Math.sqrt(flat.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / flat.length);
        return flat.map(v => (v - mean) / (std + 1e-7));
      }
      
      // Signal ready
      parentPort.postMessage({ type: 'ready', workerId });
    `;
  }

  /**
   * Handle worker message
   */
  handleWorkerMessage(workerInfo, message) {
    const { type, taskId, result, error, duration } = message;
    
    if (type === 'ready') {
      this.logger.debug(`Worker ${workerInfo.id} ready`);
      return;
    }
    
    // Mark worker as available
    workerInfo.busy = false;
    workerInfo.lastUsed = Date.now();
    
    if (type === 'result') {
      workerInfo.tasksCompleted++;
      this.statistics.tasksCompleted++;
      this.statistics.totalExecutionTime += duration || 0;
      this.statistics.averageExecutionTime = 
        this.statistics.totalExecutionTime / this.statistics.tasksCompleted;
      
      this.emit('taskCompleted', { taskId, result, workerId: workerInfo.id });
    } else if (type === 'error') {
      this.statistics.tasksFailed++;
      this.emit('taskFailed', { taskId, error, workerId: workerInfo.id });
    }
  }

  /**
   * Handle worker error
   */
  handleWorkerError(workerInfo, error) {
    this.logger.error(`Worker ${workerInfo.id} error: ${error.message}`);
    this.emit('workerError', { workerId: workerInfo.id, error });
    
    // Restart worker
    this.restartWorker(workerInfo.id);
  }

  /**
   * Handle worker exit
   */
  handleWorkerExit(workerInfo, code) {
    this.logger.info(`Worker ${workerInfo.id} exited with code ${code}`);
    
    this.workers.delete(workerInfo.id);
    this.statistics.threadsDestroyed++;
    this.statistics.currentThreads--;
    
    this.emit('workerExit', { workerId: workerInfo.id, code });
    
    // Create replacement worker if not shutting down
    if (!this.shuttingDown && this.workers.size < this.config.minThreads) {
      this.createWorker();
    }
  }

  /**
   * Restart a worker
   */
  async restartWorker(workerId) {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;
    
    try {
      // Terminate old worker
      await workerInfo.worker.terminate();
      this.workers.delete(workerId);
      
      // Create new worker
      await this.createWorker();
    } catch (error) {
      this.logger.error(`Failed to restart worker: ${error.message}`);
    }
  }

  /**
   * Execute task in thread pool
   */
  async execute(type, data) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (this.taskQueue.size >= this.config.maxQueueSize) {
      throw new Error('Task queue full');
    }
    
    return this.taskQueue.add(() => this.runTask(type, data));
  }

  /**
   * Run task on available worker
   */
  async runTask(type, data) {
    const taskId = `task-${Date.now()}-${Math.random()}`;
    
    // Find available worker
    const worker = await this.getAvailableWorker();
    if (!worker) {
      throw new Error('No available workers');
    }
    
    // Mark worker as busy
    worker.busy = true;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.busy = false;
        reject(new Error('Task timeout'));
      }, this.config.taskTimeout);
      
      // Setup one-time listeners
      const resultHandler = (event) => {
        if (event.taskId === taskId) {
          clearTimeout(timeout);
          this.removeListener('taskCompleted', resultHandler);
          this.removeListener('taskFailed', errorHandler);
          resolve(event.result);
        }
      };
      
      const errorHandler = (event) => {
        if (event.taskId === taskId) {
          clearTimeout(timeout);
          this.removeListener('taskCompleted', resultHandler);
          this.removeListener('taskFailed', errorHandler);
          reject(new Error(event.error));
        }
      };
      
      this.once('taskCompleted', resultHandler);
      this.once('taskFailed', errorHandler);
      
      // Send task to worker
      worker.worker.postMessage({ type, taskId, data });
    });
  }

  /**
   * Get available worker
   */
  async getAvailableWorker() {
    // Try to find idle worker
    for (const worker of this.workers.values()) {
      if (!worker.busy) {
        return worker;
      }
    }
    
    // Create new worker if under limit
    if (this.workers.size < this.config.maxThreads) {
      return await this.createWorker();
    }
    
    // Wait for worker to become available
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        for (const worker of this.workers.values()) {
          if (!worker.busy) {
            clearInterval(checkInterval);
            resolve(worker);
            return;
          }
        }
      }, 100);
    });
  }

  /**
   * Setup auto-scaling
   */
  setupAutoScaling() {
    setInterval(() => {
      const queueSize = this.taskQueue.size;
      const busyWorkers = Array.from(this.workers.values()).filter(w => w.busy).length;
      const idleWorkers = this.workers.size - busyWorkers;
      
      // Scale up if queue is building up
      if (queueSize > 10 && this.workers.size < this.config.maxThreads) {
        this.createWorker();
      }
      
      // Scale down if too many idle workers
      if (idleWorkers > this.config.minThreads && Date.now() - this.getOldestIdleTime() > this.config.idleTimeout) {
        this.removeIdleWorker();
      }
    }, 5000);
  }

  /**
   * Get oldest idle time
   */
  getOldestIdleTime() {
    let oldest = Date.now();
    
    for (const worker of this.workers.values()) {
      if (!worker.busy && worker.lastUsed < oldest) {
        oldest = worker.lastUsed;
      }
    }
    
    return oldest;
  }

  /**
   * Remove an idle worker
   */
  removeIdleWorker() {
    for (const [id, worker] of this.workers.entries()) {
      if (!worker.busy && this.workers.size > this.config.minThreads) {
        worker.worker.terminate();
        this.workers.delete(id);
        this.statistics.threadsDestroyed++;
        this.statistics.currentThreads--;
        break;
      }
    }
  }

  /**
   * Setup statistics collection
   */
  setupStatisticsCollection() {
    setInterval(() => {
      this.emit('statistics', this.getStatistics());
    }, 10000);
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const workers = Array.from(this.workers.values());
    
    return {
      ...this.statistics,
      activeWorkers: workers.filter(w => w.busy).length,
      idleWorkers: workers.filter(w => !w.busy).length,
      queueSize: this.taskQueue.size,
      queuePending: this.taskQueue.pending,
      workerDetails: workers.map(w => ({
        id: w.id,
        busy: w.busy,
        tasksCompleted: w.tasksCompleted,
        uptime: Date.now() - w.created,
        idleTime: w.busy ? 0 : Date.now() - w.lastUsed
      }))
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.logger.info('Cleaning up Thread Pool');
    this.shuttingDown = true;
    
    // Clear queue
    this.taskQueue.clear();
    
    // Terminate all workers
    const promises = [];
    for (const worker of this.workers.values()) {
      promises.push(worker.worker.terminate());
    }
    
    await Promise.all(promises);
    
    this.workers.clear();
    this.initialized = false;
  }
}