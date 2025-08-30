/**
 * 🧪 A/B Testing Framework
 * Enterprise-grade experimentation and optimization system
 * Echo AI Systems - Data-driven model performance optimization
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';
import crypto from 'crypto';

const logger = new Logger('ABTesting');

/**
 * Experiment status types
 */
export const ExperimentStatus = {
  DRAFT: 'draft',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
};

/**
 * Traffic splitting algorithms
 */
export const SplittingAlgorithms = {
  RANDOM: 'random',
  HASH_BASED: 'hash_based',
  WEIGHTED: 'weighted',
  GEOGRAPHICAL: 'geographical',
  TEMPORAL: 'temporal'
};

/**
 * Statistical test types
 */
export const StatisticalTests = {
  T_TEST: 't_test',
  CHI_SQUARE: 'chi_square',
  MANN_WHITNEY: 'mann_whitney',
  BAYESIAN: 'bayesian'
};

/**
 * A/B Testing Manager
 */
class ABTestingManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      defaultConfidenceLevel: 0.95,
      defaultMinSampleSize: 100,
      defaultMaxDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
      significanceThreshold: 0.05,
      powerThreshold: 0.8,
      enableFeatureFlags: true,
      ...config
    };
    
    // Experiment management
    this.experiments = new Map();
    this.activeExperiments = new Map();
    this.experimentResults = new Map();
    
    // Feature flags
    this.featureFlags = new Map();
    
    // Traffic allocation
    this.trafficAllocations = new Map();
    
    // User assignments
    this.userAssignments = new Map(); // userId -> experiment assignments
    
    logger.info('🧪 A/B Testing framework initialized', {
      confidenceLevel: this.config.defaultConfidenceLevel,
      featureFlags: this.config.enableFeatureFlags
    });
  }

  /**
   * Create new experiment
   * @param {object} experimentConfig - Experiment configuration
   */
  async createExperiment(experimentConfig) {
    const experiment = {
      id: experimentConfig.id || this.generateExperimentId(),
      name: experimentConfig.name,
      description: experimentConfig.description,
      hypothesis: experimentConfig.hypothesis,
      
      // Traffic configuration
      trafficPercentage: experimentConfig.trafficPercentage || 100,
      splittingAlgorithm: experimentConfig.splittingAlgorithm || SplittingAlgorithms.RANDOM,
      
      // Variants
      variants: experimentConfig.variants || [],
      
      // Success metrics
      primaryMetric: experimentConfig.primaryMetric,
      secondaryMetrics: experimentConfig.secondaryMetrics || [],
      
      // Statistical configuration
      confidenceLevel: experimentConfig.confidenceLevel || this.config.defaultConfidenceLevel,
      minSampleSize: experimentConfig.minSampleSize || this.config.defaultMinSampleSize,
      maxDuration: experimentConfig.maxDuration || this.config.defaultMaxDuration,
      
      // Targeting
      targetingRules: experimentConfig.targetingRules || {},
      
      // Status and timing
      status: ExperimentStatus.DRAFT,
      createdAt: new Date(),
      startedAt: null,
      endedAt: null,
      
      // Results
      results: {
        totalParticipants: 0,
        variantResults: {},
        significance: null,
        winner: null
      },
      
      ...experimentConfig
    };
    
    // Validate experiment
    this.validateExperiment(experiment);
    
    // Store experiment
    this.experiments.set(experiment.id, experiment);
    
    this.emit('experiment-created', experiment);
    logger.info(`✅ Experiment created: ${experiment.name} (${experiment.id})`);
    
    return experiment;
  }

  /**
   * Start experiment
   */
  async startExperiment(experimentId) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }
    
    if (experiment.status !== ExperimentStatus.DRAFT) {
      throw new Error(`Cannot start experiment in status: ${experiment.status}`);
    }
    
    // Update experiment status
    experiment.status = ExperimentStatus.RUNNING;
    experiment.startedAt = new Date();
    
    // Add to active experiments
    this.activeExperiments.set(experimentId, experiment);
    
    // Initialize traffic allocation
    this.initializeTrafficAllocation(experiment);
    
    this.emit('experiment-started', experiment);
    logger.info(`🚀 Experiment started: ${experiment.name}`);
    
    return experiment;
  }

  /**
   * Stop experiment
   */
  async stopExperiment(experimentId, reason = 'manual') {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }
    
    if (experiment.status !== ExperimentStatus.RUNNING) {
      throw new Error(`Cannot stop experiment in status: ${experiment.status}`);
    }
    
    // Update experiment status
    experiment.status = ExperimentStatus.COMPLETED;
    experiment.endedAt = new Date();
    experiment.stopReason = reason;
    
    // Remove from active experiments
    this.activeExperiments.delete(experimentId);
    
    // Calculate final results
    const results = await this.calculateExperimentResults(experimentId);
    experiment.results = results;
    
    this.emit('experiment-stopped', { experiment, reason, results });
    logger.info(`🛑 Experiment stopped: ${experiment.name} (${reason})`);
    
    return experiment;
  }

  /**
   * Assign user to experiment variant
   */
  async assignUser(userId, context = {}) {
    const assignments = new Map();
    
    for (const [experimentId, experiment] of this.activeExperiments.entries()) {
      // Check if user should be included
      if (!this.shouldIncludeUser(experiment, userId, context)) {
        continue;
      }
      
      // Get variant assignment
      const variant = await this.getVariantAssignment(experiment, userId, context);
      if (variant) {
        assignments.set(experimentId, {
          experimentId,
          experimentName: experiment.name,
          variant,
          assignedAt: new Date()
        });
        
        // Track assignment
        await this.trackAssignment(experimentId, userId, variant);
      }
    }
    
    // Update user assignments cache
    this.userAssignments.set(userId, assignments);
    
    return assignments;
  }

  /**
   * Get user assignments
   */
  getUserAssignments(userId) {
    return this.userAssignments.get(userId) || new Map();
  }

  /**
   * Track experiment event
   */
  async trackEvent(userId, eventName, eventData = {}) {
    const userAssignments = this.getUserAssignments(userId);
    
    for (const [experimentId, assignment] of userAssignments.entries()) {
      const experiment = this.experiments.get(experimentId);
      if (!experiment || experiment.status !== ExperimentStatus.RUNNING) {
        continue;
      }
      
      // Check if this event is relevant to the experiment
      if (this.isRelevantEvent(experiment, eventName)) {
        await this.recordExperimentEvent(experimentId, assignment.variant, eventName, eventData);
      }
    }
  }

  /**
   * Get experiment results
   */
  async getExperimentResults(experimentId) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }
    
    return await this.calculateExperimentResults(experimentId);
  }

  /**
   * Create feature flag
   */
  async createFeatureFlag(flagConfig) {
    if (!this.config.enableFeatureFlags) {
      throw new Error('Feature flags not enabled');
    }
    
    const flag = {
      id: flagConfig.id || this.generateFlagId(),
      name: flagConfig.name,
      description: flagConfig.description,
      enabled: flagConfig.enabled || false,
      rules: flagConfig.rules || [],
      defaultValue: flagConfig.defaultValue,
      createdAt: new Date(),
      ...flagConfig
    };
    
    this.featureFlags.set(flag.id, flag);
    
    this.emit('feature-flag-created', flag);
    logger.info(`🏳️ Feature flag created: ${flag.name} (${flag.id})`);
    
    return flag;
  }

  /**
   * Evaluate feature flag for user
   */
  async evaluateFeatureFlag(flagId, userId, context = {}) {
    const flag = this.featureFlags.get(flagId);
    if (!flag) {
      return null;
    }
    
    if (!flag.enabled) {
      return flag.defaultValue;
    }
    
    // Evaluate rules
    for (const rule of flag.rules) {
      if (this.evaluateRule(rule, userId, context)) {
        return rule.value;
      }
    }
    
    return flag.defaultValue;
  }

  /**
   * List experiments
   */
  listExperiments(filter = {}) {
    const experiments = Array.from(this.experiments.values());
    
    if (filter.status) {
      return experiments.filter(exp => exp.status === filter.status);
    }
    
    if (filter.active) {
      return experiments.filter(exp => exp.status === ExperimentStatus.RUNNING);
    }
    
    return experiments;
  }

  /**
   * Get experiment statistics
   */
  getExperimentStats(experimentId) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }
    
    const results = this.experimentResults.get(experimentId) || {};
    
    return {
      id: experiment.id,
      name: experiment.name,
      status: experiment.status,
      duration: this.getExperimentDuration(experiment),
      participants: experiment.results.totalParticipants,
      variants: experiment.variants.map(variant => ({
        name: variant.name,
        allocation: variant.allocation,
        participants: results[variant.name]?.participants || 0,
        conversionRate: results[variant.name]?.conversionRate || 0,
        confidenceInterval: results[variant.name]?.confidenceInterval
      })),
      significance: experiment.results.significance,
      winner: experiment.results.winner
    };
  }

  /**
   * Perform power analysis
   */
  performPowerAnalysis(config) {
    const {
      baselineConversion,
      minimumDetectableEffect,
      confidenceLevel = this.config.defaultConfidenceLevel,
      power = this.config.powerThreshold,
      variantCount = 2
    } = config;
    
    // Simplified power analysis calculation
    // In production, use proper statistical libraries
    const alpha = 1 - confidenceLevel;
    const beta = 1 - power;
    
    const effect = minimumDetectableEffect / baselineConversion;
    const variance = baselineConversion * (1 - baselineConversion);
    
    // Sample size calculation (simplified)
    const sampleSizePerVariant = Math.ceil(
      (2 * variance * Math.pow(1.96 + 0.84, 2)) / Math.pow(effect * baselineConversion, 2)
    );
    
    const totalSampleSize = sampleSizePerVariant * variantCount;
    
    return {
      sampleSizePerVariant,
      totalSampleSize,
      estimatedDuration: this.estimateDuration(totalSampleSize),
      assumptions: {
        baselineConversion,
        minimumDetectableEffect,
        confidenceLevel,
        power,
        variantCount
      }
    };
  }

  // Private methods

  /**
   * Validate experiment configuration
   * @private
   */
  validateExperiment(experiment) {
    if (!experiment.name) {
      throw new Error('Experiment name is required');
    }
    
    if (!experiment.primaryMetric) {
      throw new Error('Primary metric is required');
    }
    
    if (!experiment.variants || experiment.variants.length < 2) {
      throw new Error('At least 2 variants are required');
    }
    
    // Validate variant allocations sum to 100%
    const totalAllocation = experiment.variants.reduce((sum, v) => sum + (v.allocation || 0), 0);
    if (Math.abs(totalAllocation - 100) > 0.001) {
      throw new Error('Variant allocations must sum to 100%');
    }
  }

  /**
   * Generate experiment ID
   * @private
   */
  generateExperimentId() {
    return 'exp_' + crypto.randomBytes(8).toString('hex');
  }

  /**
   * Generate feature flag ID
   * @private
   */
  generateFlagId() {
    return 'flag_' + crypto.randomBytes(8).toString('hex');
  }

  /**
   * Initialize traffic allocation for experiment
   * @private
   */
  initializeTrafficAllocation(experiment) {
    const allocation = {
      experimentId: experiment.id,
      trafficPercentage: experiment.trafficPercentage,
      splittingAlgorithm: experiment.splittingAlgorithm,
      variants: experiment.variants.map(v => ({
        name: v.name,
        allocation: v.allocation,
        participants: 0
      }))
    };
    
    this.trafficAllocations.set(experiment.id, allocation);
  }

  /**
   * Check if user should be included in experiment
   * @private
   */
  shouldIncludeUser(experiment, userId, context) {
    // Check traffic percentage
    const hash = this.hashUserId(userId, experiment.id);
    const trafficThreshold = experiment.trafficPercentage / 100;
    
    if (hash > trafficThreshold) {
      return false;
    }
    
    // Check targeting rules
    if (experiment.targetingRules) {
      return this.evaluateTargetingRules(experiment.targetingRules, userId, context);
    }
    
    return true;
  }

  /**
   * Get variant assignment for user
   * @private
   */
  async getVariantAssignment(experiment, userId, context) {
    switch (experiment.splittingAlgorithm) {
      case SplittingAlgorithms.RANDOM:
        return this.getRandomVariant(experiment, userId);
      
      case SplittingAlgorithms.HASH_BASED:
        return this.getHashBasedVariant(experiment, userId);
      
      case SplittingAlgorithms.WEIGHTED:
        return this.getWeightedVariant(experiment, userId, context);
      
      case SplittingAlgorithms.GEOGRAPHICAL:
        return this.getGeographicalVariant(experiment, userId, context);
      
      case SplittingAlgorithms.TEMPORAL:
        return this.getTemporalVariant(experiment, userId, context);
      
      default:
        return this.getRandomVariant(experiment, userId);
    }
  }

  /**
   * Get random variant assignment
   * @private
   */
  getRandomVariant(experiment, userId) {
    const hash = this.hashUserId(userId, experiment.id);
    let cumulative = 0;
    
    for (const variant of experiment.variants) {
      cumulative += variant.allocation / 100;
      if (hash <= cumulative) {
        return variant;
      }
    }
    
    return experiment.variants[experiment.variants.length - 1];
  }

  /**
   * Get hash-based variant assignment
   * @private
   */
  getHashBasedVariant(experiment, userId) {
    // Same as random but uses deterministic hash
    return this.getRandomVariant(experiment, userId);
  }

  /**
   * Get weighted variant assignment
   * @private
   */
  getWeightedVariant(experiment, userId, context) {
    // Apply dynamic weights based on context
    const weights = experiment.variants.map(variant => {
      let weight = variant.allocation;
      
      // Apply context-based adjustments
      if (context.userSegment && variant.segmentWeights) {
        weight *= variant.segmentWeights[context.userSegment] || 1;
      }
      
      return { variant, weight };
    });
    
    // Normalize weights
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    const hash = this.hashUserId(userId, experiment.id);
    let cumulative = 0;
    
    for (const { variant, weight } of weights) {
      cumulative += weight / totalWeight;
      if (hash <= cumulative) {
        return variant;
      }
    }
    
    return weights[weights.length - 1].variant;
  }

  /**
   * Get geographical variant assignment
   * @private
   */
  getGeographicalVariant(experiment, userId, context) {
    if (context.country && experiment.geoRules) {
      const geoRule = experiment.geoRules[context.country];
      if (geoRule) {
        return experiment.variants.find(v => v.name === geoRule.variant);
      }
    }
    
    return this.getRandomVariant(experiment, userId);
  }

  /**
   * Get temporal variant assignment
   * @private
   */
  getTemporalVariant(experiment, userId, context) {
    const hour = new Date().getHours();
    
    if (experiment.temporalRules) {
      for (const rule of experiment.temporalRules) {
        if (hour >= rule.startHour && hour < rule.endHour) {
          return experiment.variants.find(v => v.name === rule.variant);
        }
      }
    }
    
    return this.getRandomVariant(experiment, userId);
  }

  /**
   * Hash user ID for consistent assignment
   * @private
   */
  hashUserId(userId, salt = '') {
    const hash = crypto.createHash('md5').update(userId + salt).digest('hex');
    return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
  }

  /**
   * Track assignment
   * @private
   */
  async trackAssignment(experimentId, userId, variant) {
    // Update participant count
    const experiment = this.experiments.get(experimentId);
    if (experiment) {
      experiment.results.totalParticipants++;
      
      if (!experiment.results.variantResults[variant.name]) {
        experiment.results.variantResults[variant.name] = {
          participants: 0,
          events: []
        };
      }
      
      experiment.results.variantResults[variant.name].participants++;
    }
    
    this.emit('assignment-tracked', {
      experimentId,
      userId,
      variant: variant.name
    });
  }

  /**
   * Check if event is relevant to experiment
   * @private
   */
  isRelevantEvent(experiment, eventName) {
    return eventName === experiment.primaryMetric ||
           experiment.secondaryMetrics.includes(eventName);
  }

  /**
   * Record experiment event
   * @private
   */
  async recordExperimentEvent(experimentId, variant, eventName, eventData) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      return;
    }
    
    const variantResults = experiment.results.variantResults[variant.name];
    if (variantResults) {
      variantResults.events.push({
        eventName,
        eventData,
        timestamp: new Date()
      });
    }
    
    this.emit('event-tracked', {
      experimentId,
      variant: variant.name,
      eventName,
      eventData
    });
  }

  /**
   * Calculate experiment results
   * @private
   */
  async calculateExperimentResults(experimentId) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }
    
    const results = {};
    
    // Calculate conversion rates for each variant
    for (const variant of experiment.variants) {
      const variantData = experiment.results.variantResults[variant.name];
      if (!variantData) {
        continue;
      }
      
      const conversions = variantData.events.filter(e => 
        e.eventName === experiment.primaryMetric
      ).length;
      
      const conversionRate = variantData.participants > 0 ? 
        conversions / variantData.participants : 0;
      
      results[variant.name] = {
        participants: variantData.participants,
        conversions,
        conversionRate,
        confidenceInterval: this.calculateConfidenceInterval(
          conversions, variantData.participants, experiment.confidenceLevel
        )
      };
    }
    
    // Perform statistical significance test
    const significance = this.performSignificanceTest(experiment, results);
    
    // Determine winner
    const winner = this.determineWinner(results, significance);
    
    return {
      variantResults: results,
      significance,
      winner,
      calculatedAt: new Date()
    };
  }

  /**
   * Calculate confidence interval
   * @private
   */
  calculateConfidenceInterval(conversions, participants, confidenceLevel) {
    if (participants === 0) {
      return [0, 0];
    }
    
    const p = conversions / participants;
    const z = 1.96; // 95% confidence level
    const margin = z * Math.sqrt((p * (1 - p)) / participants);
    
    return [
      Math.max(0, p - margin),
      Math.min(1, p + margin)
    ];
  }

  /**
   * Perform statistical significance test
   * @private
   */
  performSignificanceTest(experiment, results) {
    const variants = Object.keys(results);
    if (variants.length < 2) {
      return null;
    }
    
    // Simple two-proportion z-test
    const control = results[variants[0]];
    const variant = results[variants[1]];
    
    if (control.participants === 0 || variant.participants === 0) {
      return null;
    }
    
    const p1 = control.conversionRate;
    const p2 = variant.conversionRate;
    const n1 = control.participants;
    const n2 = variant.participants;
    
    const pooledP = (control.conversions + variant.conversions) / (n1 + n2);
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));
    
    const z = (p2 - p1) / se;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));
    
    return {
      zScore: z,
      pValue,
      isSignificant: pValue < this.config.significanceThreshold,
      effect: p2 - p1,
      relativeEffect: p1 > 0 ? (p2 - p1) / p1 : 0
    };
  }

  /**
   * Normal cumulative distribution function
   * @private
   */
  normalCDF(x) {
    // Approximation of normal CDF
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  /**
   * Error function approximation
   * @private
   */
  erf(x) {
    // Abramowitz and Stegun approximation
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return sign * y;
  }

  /**
   * Determine experiment winner
   * @private
   */
  determineWinner(results, significance) {
    if (!significance || !significance.isSignificant) {
      return null;
    }
    
    const variants = Object.entries(results);
    variants.sort((a, b) => b[1].conversionRate - a[1].conversionRate);
    
    return {
      variant: variants[0][0],
      conversionRate: variants[0][1].conversionRate,
      lift: significance.relativeEffect,
      confidence: 1 - significance.pValue
    };
  }

  /**
   * Evaluate targeting rules
   * @private
   */
  evaluateTargetingRules(rules, userId, context) {
    for (const rule of rules) {
      if (!this.evaluateRule(rule, userId, context)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate single rule
   * @private
   */
  evaluateRule(rule, userId, context) {
    const { field, operator, value } = rule;
    const contextValue = context[field];
    
    switch (operator) {
      case 'equals':
        return contextValue === value;
      case 'not_equals':
        return contextValue !== value;
      case 'in':
        return Array.isArray(value) && value.includes(contextValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(contextValue);
      case 'greater_than':
        return Number(contextValue) > Number(value);
      case 'less_than':
        return Number(contextValue) < Number(value);
      case 'contains':
        return String(contextValue).includes(String(value));
      case 'regex':
        return new RegExp(value).test(String(contextValue));
      default:
        return false;
    }
  }

  /**
   * Get experiment duration
   * @private
   */
  getExperimentDuration(experiment) {
    if (experiment.status === ExperimentStatus.RUNNING) {
      return Date.now() - experiment.startedAt.getTime();
    } else if (experiment.endedAt) {
      return experiment.endedAt.getTime() - experiment.startedAt.getTime();
    }
    return 0;
  }

  /**
   * Estimate experiment duration
   * @private
   */
  estimateDuration(totalSampleSize) {
    // Simplified estimation based on traffic
    // In production, use historical data and traffic patterns
    const dailyTraffic = 1000; // Assumed daily traffic
    const days = Math.ceil(totalSampleSize / dailyTraffic);
    return days;
  }
}

export default ABTestingManager;
export { ABTestingManager };