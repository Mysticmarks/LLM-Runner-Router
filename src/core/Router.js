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
export class Router extends EventEmitter {
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
   */
  getStrategies() {
    return Object.values(RoutingStrategies);
  }

  /**
   * Set routing strategy
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
   */
  getStats() {
    return {
      ...this.stats,
      cacheHitRate: this.stats.cacheHits / this.stats.totalRoutes,
      failureRate: this.stats.failures / this.stats.totalRoutes
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.routeCache.clear();
    this.modelScores.clear();
    this.removeAllListeners();
    logger.info('🧹 Router cleaned up');
  }
}

export default Router;
