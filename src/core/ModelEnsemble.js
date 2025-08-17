/**
 * Model Ensemble
 * Combines multiple models for improved accuracy and robustness
 * Supports various ensemble strategies and voting mechanisms
 */

import { Logger } from '../utils/Logger.js';
import { EventEmitter } from 'events';

class ModelEnsemble extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = new Logger('ModelEnsemble');
    this.config = {
      strategy: config.strategy || 'weighted-average', // weighted-average, voting, stacking, boosting
      weights: config.weights || null,
      threshold: config.threshold || 0.5,
      maxModels: config.maxModels || 10,
      timeout: config.timeout || 30000,
      parallelExecution: config.parallelExecution !== false,
      consensusRequired: config.consensusRequired || 0.5, // Percentage of models that must agree
      diversityBonus: config.diversityBonus || 0.1,
      temperatureScaling: config.temperatureScaling !== false
    };
    
    this.models = new Map();
    this.weights = new Map();
    this.performance = new Map();
    this.initialized = false;
  }

  /**
   * Initialize ensemble
   */
  async initialize() {
    if (this.initialized) return true;
    
    try {
      this.logger.info('Initializing Model Ensemble');
      
      // Validate configuration
      this.validateConfig();
      
      // Initialize performance tracking
      this.initializePerformanceTracking();
      
      this.initialized = true;
      this.logger.info(`Model Ensemble initialized with ${this.config.strategy} strategy`);
      
      return true;
    } catch (error) {
      this.logger.error(`Initialization failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate configuration
   */
  validateConfig() {
    const validStrategies = ['weighted-average', 'voting', 'stacking', 'boosting', 'mixture-of-experts'];
    
    if (!validStrategies.includes(this.config.strategy)) {
      throw new Error(`Invalid strategy: ${this.config.strategy}`);
    }
    
    if (this.config.consensusRequired < 0 || this.config.consensusRequired > 1) {
      throw new Error('Consensus required must be between 0 and 1');
    }
  }

  /**
   * Initialize performance tracking
   */
  initializePerformanceTracking() {
    // Track performance metrics for adaptive weighting
    this.performanceMetrics = {
      accuracy: new Map(),
      latency: new Map(),
      consistency: new Map(),
      diversity: new Map()
    };
  }

  /**
   * Add model to ensemble
   */
  addModel(modelId, model, weight = 1.0) {
    if (this.models.size >= this.config.maxModels) {
      throw new Error(`Maximum number of models (${this.config.maxModels}) reached`);
    }
    
    this.models.set(modelId, model);
    this.weights.set(modelId, weight);
    
    // Initialize performance tracking for this model
    this.performance.set(modelId, {
      successCount: 0,
      failureCount: 0,
      totalLatency: 0,
      averageScore: 0
    });
    
    this.logger.info(`Added model ${modelId} to ensemble with weight ${weight}`);
    this.emit('modelAdded', { modelId, weight });
    
    // Normalize weights
    this.normalizeWeights();
  }

  /**
   * Remove model from ensemble
   */
  removeModel(modelId) {
    if (!this.models.has(modelId)) {
      return false;
    }
    
    this.models.delete(modelId);
    this.weights.delete(modelId);
    this.performance.delete(modelId);
    
    this.logger.info(`Removed model ${modelId} from ensemble`);
    this.emit('modelRemoved', { modelId });
    
    // Normalize remaining weights
    this.normalizeWeights();
    
    return true;
  }

  /**
   * Normalize weights to sum to 1
   */
  normalizeWeights() {
    const totalWeight = Array.from(this.weights.values()).reduce((sum, w) => sum + w, 0);
    
    if (totalWeight > 0) {
      for (const [modelId, weight] of this.weights) {
        this.weights.set(modelId, weight / totalWeight);
      }
    }
  }

  /**
   * Run inference with ensemble
   */
  async inference(input, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (this.models.size === 0) {
      throw new Error('No models in ensemble');
    }
    
    const startTime = Date.now();
    
    try {
      let results;
      
      // Execute inference based on strategy
      switch (this.config.strategy) {
        case 'weighted-average':
          results = await this.weightedAverageInference(input, options);
          break;
          
        case 'voting':
          results = await this.votingInference(input, options);
          break;
          
        case 'stacking':
          results = await this.stackingInference(input, options);
          break;
          
        case 'boosting':
          results = await this.boostingInference(input, options);
          break;
          
        case 'mixture-of-experts':
          results = await this.mixtureOfExpertsInference(input, options);
          break;
          
        default:
          results = await this.weightedAverageInference(input, options);
      }
      
      const duration = Date.now() - startTime;
      
      // Update performance metrics
      this.updatePerformanceMetrics(results, duration);
      
      // Emit result event
      this.emit('inferenceCompleted', {
        input,
        results,
        duration,
        strategy: this.config.strategy
      });
      
      return results;
    } catch (error) {
      this.logger.error(`Ensemble inference failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Weighted average inference
   */
  async weightedAverageInference(input, options) {
    const modelResults = await this.executeModels(input, options);
    
    // Calculate weighted average
    let weightedSum = null;
    let totalWeight = 0;
    
    for (const [modelId, result] of modelResults) {
      const weight = this.weights.get(modelId) || 1;
      
      if (Array.isArray(result)) {
        // Handle array outputs (e.g., token probabilities)
        if (!weightedSum) {
          weightedSum = new Array(result.length).fill(0);
        }
        
        for (let i = 0; i < result.length; i++) {
          weightedSum[i] += result[i] * weight;
        }
      } else if (typeof result === 'number') {
        // Handle scalar outputs
        if (weightedSum === null) {
          weightedSum = 0;
        }
        weightedSum += result * weight;
      } else if (typeof result === 'string') {
        // For text, use voting instead
        return this.votingInference(input, options);
      }
      
      totalWeight += weight;
    }
    
    // Normalize by total weight
    if (Array.isArray(weightedSum)) {
      return weightedSum.map(val => val / totalWeight);
    } else {
      return weightedSum / totalWeight;
    }
  }

  /**
   * Voting-based inference
   */
  async votingInference(input, options) {
    const modelResults = await this.executeModels(input, options);
    
    // Count votes
    const votes = new Map();
    let maxVotes = 0;
    let winner = null;
    
    for (const [modelId, result] of modelResults) {
      const weight = this.weights.get(modelId) || 1;
      const resultKey = JSON.stringify(result);
      
      const currentVotes = (votes.get(resultKey) || 0) + weight;
      votes.set(resultKey, currentVotes);
      
      if (currentVotes > maxVotes) {
        maxVotes = currentVotes;
        winner = result;
      }
    }
    
    // Check if consensus threshold is met
    const totalVotes = Array.from(votes.values()).reduce((sum, v) => sum + v, 0);
    const consensusRatio = maxVotes / totalVotes;
    
    if (consensusRatio < this.config.consensusRequired) {
      this.logger.warn(`Consensus not reached (${consensusRatio} < ${this.config.consensusRequired})`);
      
      // Fall back to weighted average if no consensus
      return this.weightedAverageInference(input, options);
    }
    
    return winner;
  }

  /**
   * Stacking inference (meta-learning)
   */
  async stackingInference(input, options) {
    // First level: get predictions from all models
    const modelResults = await this.executeModels(input, options);
    
    // Second level: combine predictions using a meta-model
    // For simplicity, use weighted combination with learned weights
    const stackedInput = [];
    
    for (const [modelId, result] of modelResults) {
      if (Array.isArray(result)) {
        stackedInput.push(...result);
      } else {
        stackedInput.push(result);
      }
    }
    
    // Apply meta-model (simplified as weighted sum)
    const metaWeights = this.learnMetaWeights(modelResults);
    let finalResult = 0;
    
    let index = 0;
    for (const [modelId, result] of modelResults) {
      const weight = metaWeights[index++];
      
      if (Array.isArray(result)) {
        finalResult += result.reduce((sum, val) => sum + val, 0) * weight;
      } else {
        finalResult += result * weight;
      }
    }
    
    return finalResult;
  }

  /**
   * Boosting inference (sequential improvement)
   */
  async boostingInference(input, options) {
    let currentInput = input;
    let aggregatedResult = null;
    const alpha = 0.5; // Learning rate
    
    // Process models sequentially
    for (const [modelId, model] of this.models) {
      try {
        const result = await this.executeModel(modelId, model, currentInput, options);
        
        if (aggregatedResult === null) {
          aggregatedResult = result;
        } else {
          // Combine with previous results (boosting)
          if (Array.isArray(result)) {
            aggregatedResult = aggregatedResult.map((val, i) => 
              val * (1 - alpha) + result[i] * alpha
            );
          } else {
            aggregatedResult = aggregatedResult * (1 - alpha) + result * alpha;
          }
        }
        
        // Update input for next model (residual learning)
        if (typeof currentInput === 'object') {
          currentInput = { ...currentInput, previous: aggregatedResult };
        }
      } catch (error) {
        this.logger.warn(`Model ${modelId} failed in boosting: ${error.message}`);
      }
    }
    
    return aggregatedResult;
  }

  /**
   * Mixture of Experts inference
   */
  async mixtureOfExpertsInference(input, options) {
    // Determine which expert (model) to use based on input characteristics
    const expertId = this.selectExpert(input);
    
    if (expertId && this.models.has(expertId)) {
      // Use selected expert
      const model = this.models.get(expertId);
      return await this.executeModel(expertId, model, input, options);
    } else {
      // Fall back to weighted average
      return await this.weightedAverageInference(input, options);
    }
  }

  /**
   * Select expert model based on input
   */
  selectExpert(input) {
    // Simple selection based on input characteristics
    // In real implementation, would use a gating network
    
    const inputStr = JSON.stringify(input);
    const inputLength = inputStr.length;
    
    // Select based on input complexity
    for (const [modelId, model] of this.models) {
      const perf = this.performance.get(modelId);
      
      // Check if this model performs well for similar inputs
      if (perf && perf.averageScore > 0.8) {
        return modelId;
      }
    }
    
    // Default to first model
    return this.models.keys().next().value;
  }

  /**
   * Execute all models
   */
  async executeModels(input, options) {
    const results = new Map();
    
    if (this.config.parallelExecution) {
      // Execute in parallel
      const promises = [];
      
      for (const [modelId, model] of this.models) {
        promises.push(
          this.executeModel(modelId, model, input, options)
            .then(result => ({ modelId, result }))
            .catch(error => {
              this.logger.warn(`Model ${modelId} failed: ${error.message}`);
              return null;
            })
        );
      }
      
      const responses = await Promise.all(promises);
      
      for (const response of responses) {
        if (response) {
          results.set(response.modelId, response.result);
        }
      }
    } else {
      // Execute sequentially
      for (const [modelId, model] of this.models) {
        try {
          const result = await this.executeModel(modelId, model, input, options);
          results.set(modelId, result);
        } catch (error) {
          this.logger.warn(`Model ${modelId} failed: ${error.message}`);
        }
      }
    }
    
    return results;
  }

  /**
   * Execute single model
   */
  async executeModel(modelId, model, input, options) {
    const startTime = Date.now();
    
    try {
      let result;
      
      // Handle different model interfaces
      if (typeof model.predict === 'function') {
        result = await model.predict(input, options);
      } else if (typeof model.inference === 'function') {
        result = await model.inference(input, options);
      } else if (typeof model === 'function') {
        result = await model(input, options);
      } else {
        throw new Error(`Model ${modelId} has no valid inference method`);
      }
      
      const latency = Date.now() - startTime;
      
      // Update performance
      const perf = this.performance.get(modelId);
      if (perf) {
        perf.successCount++;
        perf.totalLatency += latency;
      }
      
      return result;
    } catch (error) {
      // Update failure count
      const perf = this.performance.get(modelId);
      if (perf) {
        perf.failureCount++;
      }
      
      throw error;
    }
  }

  /**
   * Learn meta-weights for stacking
   */
  learnMetaWeights(modelResults) {
    // Simple learning based on past performance
    const weights = [];
    
    for (const [modelId] of modelResults) {
      const perf = this.performance.get(modelId);
      
      if (perf && perf.successCount > 0) {
        const successRate = perf.successCount / (perf.successCount + perf.failureCount);
        const avgLatency = perf.totalLatency / perf.successCount;
        
        // Weight based on success rate and inverse latency
        const weight = successRate / (1 + avgLatency / 1000);
        weights.push(weight);
      } else {
        weights.push(1);
      }
    }
    
    // Normalize weights
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map(w => w / sum);
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(results, duration) {
    // Calculate diversity score
    const diversity = this.calculateDiversity(results);
    
    // Update metrics
    for (const [modelId] of this.models) {
      const perf = this.performanceMetrics.diversity;
      if (perf) {
        perf.set(modelId, diversity);
      }
    }
    
    // Adaptive weight adjustment
    if (this.config.strategy === 'weighted-average') {
      this.adaptWeights();
    }
  }

  /**
   * Calculate diversity of results
   */
  calculateDiversity(results) {
    if (!results || typeof results !== 'object') return 0;
    
    // Simple diversity measure based on variance
    if (Array.isArray(results)) {
      const mean = results.reduce((sum, val) => sum + val, 0) / results.length;
      const variance = results.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / results.length;
      return Math.sqrt(variance);
    }
    
    return 0;
  }

  /**
   * Adapt weights based on performance
   */
  adaptWeights() {
    const learningRate = 0.1;
    
    for (const [modelId] of this.models) {
      const perf = this.performance.get(modelId);
      
      if (perf && perf.successCount > 0) {
        const successRate = perf.successCount / (perf.successCount + perf.failureCount);
        const currentWeight = this.weights.get(modelId) || 1;
        
        // Update weight based on success rate
        const newWeight = currentWeight + learningRate * (successRate - 0.5);
        this.weights.set(modelId, Math.max(0.1, Math.min(2, newWeight))); // Clamp between 0.1 and 2
      }
    }
    
    // Normalize weights
    this.normalizeWeights();
  }

  /**
   * Get ensemble statistics
   */
  getStatistics() {
    const stats = {
      modelCount: this.models.size,
      strategy: this.config.strategy,
      weights: Object.fromEntries(this.weights),
      performance: {}
    };
    
    for (const [modelId, perf] of this.performance) {
      stats.performance[modelId] = {
        successRate: perf.successCount / (perf.successCount + perf.failureCount) || 0,
        averageLatency: perf.totalLatency / perf.successCount || 0,
        totalRequests: perf.successCount + perf.failureCount
      };
    }
    
    return stats;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.logger.info('Cleaning up Model Ensemble');
    
    this.models.clear();
    this.weights.clear();
    this.performance.clear();
    this.performanceMetrics = null;
    this.initialized = false;
  }
}

export default ModelEnsemble;
export { ModelEnsemble };
