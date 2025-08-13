/**
 * ⚖️ Load Balancer - Quantum Distribution Harmonizer
 * Orchestrating model workloads across the computational multiverse
 * Echo AI Systems - Where every model gets its moment to shine
 */

import { Logger } from '../utils/Logger.js';

const logger = new Logger('LoadBalancer');

export class LoadBalancer {
  constructor() {
    this.roundRobinIndex = 0;
    this.modelLoads = new Map();
    this.modelHistory = new Map();
    this.strategies = {
      roundRobin: this.roundRobin.bind(this),
      leastLoaded: this.leastLoaded.bind(this),
      weighted: this.weightedRandom.bind(this),
      sticky: this.stickySession.bind(this),
      adaptive: this.adaptive.bind(this)
    };
  }

  /**
   * Round-robin distribution - Everyone gets a turn
   */
  roundRobin(models) {
    if (models.length === 0) return null;
    
    const selected = models[this.roundRobinIndex % models.length];
    this.roundRobinIndex++;
    
    logger.debug(`🎯 Round-robin selected: ${selected.name}`);
    return selected;
  }

  /**
   * Least loaded model selection - The underdog gets a chance
   */
  leastLoaded(models) {
    let minLoad = Infinity;
    let selected = null;
    
    for (const model of models) {
      const load = this.modelLoads.get(model.id) || 0;
      if (load < minLoad) {
        minLoad = load;
        selected = model;
      }
    }
    
    if (selected) {
      this.incrementLoad(selected.id);
      logger.debug(`⚖️ Least loaded selected: ${selected.name} (load: ${minLoad})`);
    }
    
    return selected;
  }

  /**
   * Weighted random selection - Probabilistic fairness
   */
  weightedRandom(models, weights = null) {
    if (models.length === 0) return null;
    
    // Use provided weights or calculate based on model scores
    const modelWeights = weights || models.map(m => 
      1 / (this.modelLoads.get(m.id) || 1)
    );
    
    const totalWeight = modelWeights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < models.length; i++) {
      random -= modelWeights[i];
      if (random <= 0) {
        logger.debug(`🎲 Weighted random selected: ${models[i].name}`);
        return models[i];
      }
    }
    
    return models[models.length - 1];
  }

  /**
   * Sticky sessions - Affinity for repeat customers
   */
  stickySession(models, sessionId) {
    const history = this.modelHistory.get(sessionId);
    
    if (history && models.includes(history)) {
      logger.debug(`🔗 Sticky session maintained: ${history.name}`);
      return history;
    }
    
    // New session or model unavailable
    const selected = this.leastLoaded(models);
    if (selected) {
      this.modelHistory.set(sessionId, selected);
    }
    
    return selected;
  }

  /**
   * Adaptive selection - Learning from patterns
   */
  adaptive(models, context = {}) {
    // Analyze context for optimal selection
    const { promptType, urgency, quality } = context;
    
    // High urgency = pick fastest
    if (urgency === 'high') {
      return this.selectFastest(models);
    }
    
    // High quality requirement = pick best scorer
    if (quality === 'high') {
      return this.selectBestQuality(models);
    }
    
    // Default to least loaded
    return this.leastLoaded(models);
  }

  /**
   * Select fastest model based on metrics
   */
  selectFastest(models) {
    return models.reduce((fastest, model) => {
      const currentLatency = model.metrics?.avgLatency || Infinity;
      const fastestLatency = fastest?.metrics?.avgLatency || Infinity;
      return currentLatency < fastestLatency ? model : fastest;
    }, null);
  }

  /**
   * Select highest quality model
   */
  selectBestQuality(models) {
    return models.reduce((best, model) => {
      const currentScore = model.qualityScore || 0;
      const bestScore = best?.qualityScore || 0;
      return currentScore > bestScore ? model : best;
    }, null);
  }

  /**
   * Increment load counter for model
   */
  incrementLoad(modelId) {
    const current = this.modelLoads.get(modelId) || 0;
    this.modelLoads.set(modelId, current + 1);
    
    // Decay old loads periodically
    if (Math.random() < 0.01) this.decayLoads();
  }

  /**
   * Decrease load counter after completion
   */
  decrementLoad(modelId) {
    const current = this.modelLoads.get(modelId) || 0;
    this.modelLoads.set(modelId, Math.max(0, current - 1));
  }

  /**
   * Decay load counts over time
   */
  decayLoads() {
    for (const [modelId, load] of this.modelLoads.entries()) {
      this.modelLoads.set(modelId, Math.floor(load * 0.9));
    }
  }

  /**
   * Get current load distribution
   */
  getLoadDistribution() {
    return Object.fromEntries(this.modelLoads);
  }

  /**
   * Reset all counters
   */
  reset() {
    this.roundRobinIndex = 0;
    this.modelLoads.clear();
    this.modelHistory.clear();
    logger.info('🔄 Load balancer reset');
  }

  /**
   * Health check for models
   */
  async healthCheck(models) {
    const healthy = [];
    
    for (const model of models) {
      try {
        // Simple health check - could be more sophisticated
        if (model.loaded && !model.error) {
          healthy.push(model);
        }
      } catch (error) {
        logger.warn(`❌ Health check failed for ${model.name}`);
      }
    }
    
    return healthy;
  }
}

export default LoadBalancer;
