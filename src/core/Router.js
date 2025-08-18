/**
 * 🧭 Intelligent Model Router
 * The quantum pathfinder that selects optimal models and strategies
 * Echo AI Systems - Routing intelligence through the neural highways
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';
import { CostOptimizer } from './CostOptimizer.js';
import { QualityScorer } from './QualityScorer.js';
import { LoadBalancer } from './LoadBalancer.js';

const logger = new Logger('Router');

/**
 * Routing strategies for model selection
 */
export const RoutingStrategies = {
  QUALITY_FIRST: 'quality-first',
  COST_OPTIMIZED: 'cost-optimized',
  SPEED_PRIORITY: 'speed-priority',
  BALANCED: 'balanced',
  RANDOM: 'random',
  ROUND_ROBIN: 'round-robin',
  LEAST_LOADED: 'least-loaded',
  CAPABILITY_MATCH: 'capability-match'
};

/**
 * Intelligent Router - The brain of model orchestration
 */
class Router extends EventEmitter {
  constructor(registry, config = {}) {
    super();
    
    this.registry = registry;
    this.config = {
      strategy: RoutingStrategies.BALANCED,
      maxRetries: 3,
      timeout: 30000,
      cacheTTL: 3600000, // 1 hour
      ...config
    };
    
    // Routing components
    this.costOptimizer = new CostOptimizer();
    this.qualityScorer = new QualityScorer();
    this.loadBalancer = new LoadBalancer();
    
    // Routing cache
    this.routeCache = new Map();
    this.modelScores = new Map();
    
    // Statistics
    this.stats = {
      totalRoutes: 0,
      cacheHits: 0,
      failures: 0,
      avgLatency: 0
    };
    
    logger.info('🧭 Router initialized with strategy:', this.config.strategy);
  }

  /**
   * Initialize router with engine
   */
  async initialize(engine) {
    this.engine = engine;
    
    // Precompute model scores
    await this.computeModelScores();
    
    // Setup monitoring
    this.startMonitoring();
    
    logger.info('✅ Router ready with engine:', engine.name);
  }

  /**
   * Select optimal model for task
   * @param {string} prompt - Input prompt
   * @param {object} requirements - Task requirements
   * @returns {Promise<object>} Selected model object
   * 
   * @example
   * // Basic model selection
   * const model = await router.selectModel('Hello, world!');
   * console.log(`Selected: ${model.name}`);
   * 
   * @example
   * // Model selection with requirements
   * const model = await router.selectModel(
   *   'Translate this text to French',
   *   {
   *     capabilities: {
   *       translation: true,
   *       multiLanguage: true
   *     },
   *     maxSize: '7B',
   *     format: 'gguf'
   *   }
   * );
   * 
   * @example
   * // Advanced requirements with cost constraints
   * const model = await router.selectModel(
   *   'Generate a creative story',
   *   {
   *     capabilities: {
   *       textGeneration: true,
   *       creativity: true
   *     },
   *     maxCost: 0.01,
   *     minQuality: 0.8,
   *     timeout: 5000
   *   }
   * );
   * 
   * @example
   * // Error handling
   * try {
   *   const model = await router.selectModel('Complex task', {
   *     capabilities: { nonExistentCapability: true }
   *   });
   * } catch (error) {
   *   if (error.message === 'No models match requirements') {
   *     console.log('Relaxing requirements...');
   *     const fallbackModel = await router.selectModel('Complex task');
   *   }
   * }
   */
  async selectModel(prompt, requirements = {}) {
    const startTime = Date.now();
    this.stats.totalRoutes++;
    
    logger.debug('🎯 Selecting model for prompt:', {
      promptLength: prompt.length,
      requirements,
      strategy: this.config.strategy
    });
    
    // Check cache
    const cacheKey = this.getCacheKey(prompt, requirements);
    if (this.routeCache.has(cacheKey)) {
      this.stats.cacheHits++;
      const cached = this.routeCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.config.cacheTTL) {
        logger.debug('✨ Cache hit for route');
        return cached.model;
      }
    }
    
    // Get available models
    const models = await this.registry.getAvailable();
    if (models.length === 0) {
      throw new Error('No models available');
    }
    
    // Filter by requirements
    const candidates = this.filterByRequirements(models, requirements);
    if (candidates.length === 0) {
      throw new Error('No models match requirements');
    }
    
    // Apply routing strategy
    const selected = await this.applyStrategy(candidates, prompt, requirements);
    
    // Cache the route
    this.routeCache.set(cacheKey, {
      model: selected,
      timestamp: Date.now()
    });
    
    // Update metrics
    const latency = Date.now() - startTime;
    this.updateLatency(latency);
    
    this.emit('model-selected', {
      model: selected.id,
      strategy: this.config.strategy,
      latency
    });
    
    logger.info(`✅ Selected model: ${selected.name} (${latency}ms)`);
    return selected;
  }

  /**
   * Select optimal loader for model format
   * @param {object} spec - Model specification object
   * @returns {Promise<object>} Selected loader instance
   * 
   * @example
   * // Select loader by explicit format
   * const loader = await router.selectLoader({
   *   format: 'gguf',
   *   source: '/path/to/model.gguf'
   * });
   * 
   * @example
   * // Auto-detect format from file extension
   * const loader = await router.selectLoader({
   *   source: 'https://example.com/model.onnx'
   * });
   * console.log(`Detected format: ${loader.format}`);
   * 
   * @example
   * // HuggingFace model loader selection
   * const loader = await router.selectLoader({
   *   source: 'microsoft/DialoGPT-medium',
   *   type: 'huggingface'
   * });
   * 
   * @example
   * // Mock loader for testing
   * const mockLoader = await router.selectLoader({
   *   source: 'mock://test-model',
   *   format: 'mock'
   * });
   * 
   * @example
   * // Error handling for unsupported formats
   * try {
   *   const loader = await router.selectLoader({
   *     format: 'unsupported-format'
   *   });
   * } catch (error) {
   *   console.error('No loader available:', error.message);
   *   // Fallback to a supported format
   *   const fallbackLoader = await router.selectLoader({
   *     format: 'gguf'
   *   });
   * }
   */
  async selectLoader(spec) {
    const format = await this.detectFormat(spec);
    const loader = await this.registry.getLoader(format);
    
    if (!loader) {
      throw new Error(`No loader available for format: ${format}`);
    }
    
    logger.debug(`📦 Selected loader for format: ${format}`);
    return loader;
  }

  /**
   * Apply routing strategy
   * @private
   */
  async applyStrategy(models, prompt, requirements) {
    switch (this.config.strategy) {
      case RoutingStrategies.QUALITY_FIRST:
        return this.selectByQuality(models, prompt);
        
      case RoutingStrategies.COST_OPTIMIZED:
        return this.selectByCost(models, requirements);
        
      case RoutingStrategies.SPEED_PRIORITY:
        return this.selectBySpeed(models);
        
      case RoutingStrategies.BALANCED:
        return this.selectBalanced(models, prompt, requirements);
        
      case RoutingStrategies.ROUND_ROBIN:
        return this.loadBalancer.roundRobin(models);
        
      case RoutingStrategies.LEAST_LOADED:
        return this.loadBalancer.leastLoaded(models);
        
      case RoutingStrategies.CAPABILITY_MATCH:
        return this.selectByCapability(models, requirements);
        
      case RoutingStrategies.RANDOM:
      default:
        return models[Math.floor(Math.random() * models.length)];
    }
  }

  /**
   * Select model by quality score
   * @private
   */
  async selectByQuality(models, prompt) {
    const scores = await Promise.all(
      models.map(async model => ({
        model,
        score: await this.qualityScorer.score(model, prompt)
      }))
    );
    
    scores.sort((a, b) => b.score - a.score);
    return scores[0].model;
  }

  /**
   * Select model by cost optimization
   * @private
   */
  async selectByCost(models, requirements) {
    const costs = await Promise.all(
      models.map(async model => ({
        model,
        cost: await this.costOptimizer.calculate(model, requirements)
      }))
    );
    
    costs.sort((a, b) => a.cost - b.cost);
    return costs[0].model;
  }

  /**
   * Select fastest model
   * @private
   */
  selectBySpeed(models) {
    const speeds = models.map(model => ({
      model,
      latency: model.metrics?.avgLatency || Infinity
    }));
    
    speeds.sort((a, b) => a.latency - b.latency);
    return speeds[0].model;
  }

  /**
   * Balanced selection considering multiple factors
   * @private
   */
  async selectBalanced(models, prompt, requirements) {
    const scores = await Promise.all(
      models.map(async model => {
        const quality = await this.qualityScorer.score(model, prompt);
        const cost = await this.costOptimizer.calculate(model, requirements);
        const speed = 1 / (model.metrics?.avgLatency || 1000);
        
        // Weighted combination
        const score = (
          quality * 0.4 +
          (1 / cost) * 0.3 +
          speed * 0.3
        );
        
        return { model, score };
      })
    );
    
    scores.sort((a, b) => b.score - a.score);
    return scores[0].model;
  }

  /**
   * Select by capability matching
   * @private
   */
  selectByCapability(models, requirements) {
    const matches = models.map(model => {
      const matchCount = Object.keys(requirements.capabilities || {})
        .filter(cap => model.supports(cap))
        .length;
      
      return { model, matchCount };
    });
    
    matches.sort((a, b) => b.matchCount - a.matchCount);
    return matches[0].model;
  }

  /**
   * Filter models by requirements
   * @private
   */
  filterByRequirements(models, requirements) {
    return models.filter(model => {
      // Check capabilities
      if (requirements.capabilities) {
        for (const [cap, required] of Object.entries(requirements.capabilities)) {
          if (required && !model.supports(cap)) {
            return false;
          }
        }
      }
      
      // Check size constraints
      if (requirements.maxSize && model.parameters.size > requirements.maxSize) {
        return false;
      }
      
      // Check format
      if (requirements.format && model.format !== requirements.format) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Detect model format from specification
   * @private
   */
  async detectFormat(spec) {
    // Check explicit format
    if (spec.format) {
      return spec.format;
    }
    
    // Check explicit type (same as format)
    if (spec.type) {
      return spec.type;
    }
    
    // Check for mock:// protocol
    if (spec.source && spec.source.startsWith('mock://')) {
      return 'mock';
    }
    
    // Check by file extension
    if (spec.source) {
      const ext = spec.source.split('.').pop().toLowerCase();
      const formatMap = {
        'gguf': 'gguf',
        'ggml': 'ggml',
        'onnx': 'onnx',
        'safetensors': 'safetensors',
        'pt': 'pytorch',
        'pb': 'tensorflow',
        'json': 'tensorflowjs'
      };
      
      if (formatMap[ext]) {
        return formatMap[ext];
      }
    }
    
    // Check for HuggingFace pattern
    if (spec.source?.includes('huggingface') || spec.source?.includes(':')) {
      return 'huggingface';
    }
    
    // Default
    return 'unknown';
  }

  /**
   * Compute model scores for caching
   * @private
   */
  async computeModelScores() {
    const models = await this.registry.getAll();
    
    for (const model of models) {
      const score = {
        quality: await this.qualityScorer.computeBaseScore(model),
        cost: await this.costOptimizer.computeBaseCost(model),
        speed: model.metrics?.avgLatency || 1000
      };
      
      this.modelScores.set(model.id, score);
    }
    
    logger.debug(`📊 Computed scores for ${models.length} models`);
  }

  /**
   * Get cache key for route
   * @private
   */
  getCacheKey(prompt, requirements) {
    // Simple hash - in production, use proper hashing
    const promptHash = prompt.substring(0, 50);
    const reqHash = JSON.stringify(requirements);
    return `${promptHash}_${reqHash}`;
  }

  /**
   * Update latency metrics
   * @private
   */
  updateLatency(latency) {
    const count = this.stats.totalRoutes;
    this.stats.avgLatency = (
      (this.stats.avgLatency * (count - 1) + latency) / count
    );
  }

  /**
   * Start monitoring
   * @private
   */
  startMonitoring() {
    // Periodic cache cleanup
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.routeCache.entries()) {
        if (now - value.timestamp > this.config.cacheTTL) {
          this.routeCache.delete(key);
        }
      }
    }, 60000); // Every minute
    
    // Periodic score recomputation
    setInterval(() => {
      this.computeModelScores().catch(console.error);
    }, 300000); // Every 5 minutes
  }

  /**
   * Get available routing strategies
   * @returns {string[]} Array of available strategy names
   * 
   * @example
   * // Get all available strategies
   * const strategies = router.getStrategies();
   * console.log('Available strategies:', strategies);
   * // Output: ['quality-first', 'cost-optimized', 'speed-priority', ...]
   * 
   * @example
   * // Use in strategy selection UI
   * const strategies = router.getStrategies();
   * const dropdown = strategies.map(strategy => ({
   *   value: strategy,
   *   label: strategy.replace('-', ' ').toUpperCase()
   * }));
   * 
   * @example
   * // Validate strategy before setting
   * const availableStrategies = router.getStrategies();
   * const userStrategy = 'custom-strategy';
   * 
   * if (availableStrategies.includes(userStrategy)) {
   *   router.setStrategy(userStrategy);
   * } else {
   *   console.warn('Strategy not available, using default');
   * }
   */
  getStrategies() {
    return Object.values(RoutingStrategies);
  }

  /**
   * Set routing strategy
   * @param {string} strategy - Strategy name from RoutingStrategies
   * @throws {Error} If strategy is invalid
   * @fires Router#strategy-changed
   * 
   * @example
   * // Set quality-first strategy
   * router.setStrategy('quality-first');
   * 
   * @example
   * // Set cost-optimized strategy for budget-conscious applications
   * router.setStrategy('cost-optimized');
   * console.log('Router will now prioritize cost-effective models');
   * 
   * @example
   * // Set speed-priority for real-time applications
   * router.setStrategy('speed-priority');
   * 
   * @example
   * // Dynamic strategy switching based on conditions
   * const isProduction = process.env.NODE_ENV === 'production';
   * const strategy = isProduction ? 'balanced' : 'quality-first';
   * router.setStrategy(strategy);
   * 
   * @example
   * // Listen for strategy changes
   * router.on('strategy-changed', (newStrategy) => {
   *   console.log(`Strategy changed to: ${newStrategy}`);
   *   // Update UI, metrics, etc.
   * });
   * 
   * @example
   * // Error handling for invalid strategies
   * try {
   *   router.setStrategy('invalid-strategy');
   * } catch (error) {
   *   console.error('Invalid strategy:', error.message);
   *   // Fallback to default
   *   router.setStrategy('balanced');
   * }
   */
  setStrategy(strategy) {
    if (!Object.values(RoutingStrategies).includes(strategy)) {
      throw new Error(`Invalid strategy: ${strategy}`);
    }
    
    this.config.strategy = strategy;
    logger.info(`🔄 Strategy changed to: ${strategy}`);
    this.emit('strategy-changed', strategy);
  }

  /**
   * Get routing statistics
   * @returns {object} Statistics object with routing metrics
   * 
   * @example
   * // Basic statistics retrieval
   * const stats = router.getStats();
   * console.log(`Total routes: ${stats.totalRoutes}`);
   * console.log(`Cache hit rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
   * 
   * @example
   * // Monitor performance metrics
   * const stats = router.getStats();
   * console.log('Router Performance:', {
   *   totalRoutes: stats.totalRoutes,
   *   avgLatency: `${stats.avgLatency.toFixed(2)}ms`,
   *   cacheHitRate: `${(stats.cacheHitRate * 100).toFixed(1)}%`,
   *   failureRate: `${(stats.failureRate * 100).toFixed(2)}%`
   * });
   * 
   * @example
   * // Performance monitoring dashboard
   * function displayRouterMetrics() {
   *   const stats = router.getStats();
   *   
   *   if (stats.failureRate > 0.05) {
   *     console.warn('High failure rate detected:', stats.failureRate);
   *   }
   *   
   *   if (stats.avgLatency > 1000) {
   *     console.warn('High latency detected:', stats.avgLatency);
   *   }
   *   
   *   if (stats.cacheHitRate < 0.3) {
   *     console.info('Low cache hit rate, consider adjusting TTL');
   *   }
   * }
   * 
   * @example
   * // Periodic stats logging
   * setInterval(() => {
   *   const stats = router.getStats();
   *   console.log('Router Stats:', {
   *     routes: stats.totalRoutes,
   *     cacheHits: stats.cacheHits,
   *     failures: stats.failures,
   *     avgLatency: Math.round(stats.avgLatency)
   *   });
   * }, 60000); // Every minute
   */
  getStats() {
    return {
      ...this.stats,
      cacheHitRate: this.stats.cacheHits / this.stats.totalRoutes,
      failureRate: this.stats.failures / this.stats.totalRoutes
    };
  }

  /**
   * Cleanup resources and stop monitoring
   * @returns {Promise<void>}
   * 
   * @example
   * // Basic cleanup on application shutdown
   * await router.cleanup();
   * console.log('Router resources cleaned up');
   * 
   * @example
   * // Graceful shutdown with cleanup
   * process.on('SIGTERM', async () => {
   *   console.log('Shutting down gracefully...');
   *   await router.cleanup();
   *   process.exit(0);
   * });
   * 
   * @example
   * // Cleanup in testing environment
   * afterEach(async () => {
   *   await router.cleanup();
   *   // Ensures clean state between tests
   * });
   * 
   * @example
   * // Cleanup with error handling
   * try {
   *   await router.cleanup();
   *   console.log('Router cleanup successful');
   * } catch (error) {
   *   console.error('Error during cleanup:', error);
   *   // Force cleanup if needed
   * }
   * 
   * @example
   * // Cleanup in Express.js application
   * app.on('close', async () => {
   *   console.log('Server closing, cleaning up router...');
   *   await router.cleanup();
   * });
   */
  async cleanup() {
    this.routeCache.clear();
    this.modelScores.clear();
    this.removeAllListeners();
    logger.info('🧹 Router cleaned up');
  }
}



export default Router;
export { Router };
