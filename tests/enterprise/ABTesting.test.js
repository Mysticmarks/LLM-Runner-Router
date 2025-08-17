/**
 * Tests for A/B Testing Framework
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ABTestingManager, { ExperimentStatus, SplittingAlgorithms } from '../../src/enterprise/ABTesting.js';

describe('ABTestingManager', () => {
  let abTesting;

  beforeEach(() => {
    abTesting = new ABTestingManager({
      defaultConfidenceLevel: 0.95,
      defaultMinSampleSize: 100,
      enableFeatureFlags: true
    });
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Experiment Management', () => {
    it('should create a new experiment', async () => {
      const experimentConfig = {
        name: 'Model Selection Test',
        description: 'Testing different model selection strategies',
        hypothesis: 'Quality-first strategy will improve user satisfaction',
        trafficPercentage: 50,
        variants: [
          { name: 'control', allocation: 50 },
          { name: 'quality_first', allocation: 50 }
        ],
        primaryMetric: 'satisfaction_score',
        secondaryMetrics: ['response_time', 'accuracy'],
        confidenceLevel: 0.95,
        minSampleSize: 200
      };

      const experiment = await abTesting.createExperiment(experimentConfig);

      expect(experiment).toBeDefined();
      expect(experiment.id).toBeDefined();
      expect(experiment.name).toBe('Model Selection Test');
      expect(experiment.status).toBe(ExperimentStatus.DRAFT);
      expect(experiment.variants).toHaveLength(2);
      expect(experiment.primaryMetric).toBe('satisfaction_score');
      expect(experiment.createdAt).toBeInstanceOf(Date);
    });

    it('should validate experiment configuration', async () => {
      const invalidConfig = {
        // Missing required fields
        variants: [{ name: 'control', allocation: 100 }]
      };

      await expect(abTesting.createExperiment(invalidConfig))
        .rejects.toThrow('Experiment name is required');
    });

    it('should validate variant allocations sum to 100%', async () => {
      const invalidConfig = {
        name: 'Invalid Test',
        primaryMetric: 'test_metric',
        variants: [
          { name: 'control', allocation: 30 },
          { name: 'variant', allocation: 30 } // Total = 60%, not 100%
        ]
      };

      await expect(abTesting.createExperiment(invalidConfig))
        .rejects.toThrow('Variant allocations must sum to 100%');
    });

    it('should start experiment', async () => {
      const experiment = await abTesting.createExperiment({
        name: 'Start Test',
        primaryMetric: 'conversion',
        variants: [
          { name: 'control', allocation: 50 },
          { name: 'variant', allocation: 50 }
        ]
      });

      const started = await abTesting.startExperiment(experiment.id);

      expect(started.status).toBe(ExperimentStatus.RUNNING);
      expect(started.startedAt).toBeInstanceOf(Date);
    });

    it('should stop experiment', async () => {
      const experiment = await abTesting.createExperiment({
        name: 'Stop Test',
        primaryMetric: 'conversion',
        variants: [
          { name: 'control', allocation: 50 },
          { name: 'variant', allocation: 50 }
        ]
      });

      await abTesting.startExperiment(experiment.id);
      const stopped = await abTesting.stopExperiment(experiment.id, 'manual');

      expect(stopped.status).toBe(ExperimentStatus.COMPLETED);
      expect(stopped.endedAt).toBeInstanceOf(Date);
      expect(stopped.stopReason).toBe('manual');
    });

    it('should list experiments with filters', async () => {
      await abTesting.createExperiment({
        name: 'Running Test',
        primaryMetric: 'conversion',
        variants: [
          { name: 'control', allocation: 50 },
          { name: 'variant', allocation: 50 }
        ]
      });

      const experiment2 = await abTesting.createExperiment({
        name: 'Draft Test',
        primaryMetric: 'conversion',
        variants: [
          { name: 'control', allocation: 50 },
          { name: 'variant', allocation: 50 }
        ]
      });

      await abTesting.startExperiment(experiment2.id);

      const runningExperiments = abTesting.listExperiments({ active: true });
      expect(runningExperiments).toHaveLength(1);
      expect(runningExperiments[0].name).toBe('Draft Test');
    });
  });

  describe('User Assignment', () => {
    let experiment;

    beforeEach(async () => {
      experiment = await abTesting.createExperiment({
        name: 'Assignment Test',
        primaryMetric: 'conversion',
        trafficPercentage: 100,
        variants: [
          { name: 'control', allocation: 50 },
          { name: 'variant', allocation: 50 }
        ]
      });

      await abTesting.startExperiment(experiment.id);
    });

    it('should assign user to experiment variant', async () => {
      const userId = 'user-123';
      const assignments = await abTesting.assignUser(userId);

      expect(assignments.size).toBe(1);
      expect(assignments.has(experiment.id)).toBe(true);

      const assignment = assignments.get(experiment.id);
      expect(assignment.experimentId).toBe(experiment.id);
      expect(assignment.variant).toBeDefined();
      expect(['control', 'variant']).toContain(assignment.variant.name);
    });

    it('should consistently assign same user to same variant', async () => {
      const userId = 'user-123';
      
      const assignments1 = await abTesting.assignUser(userId);
      const assignments2 = await abTesting.assignUser(userId);

      const variant1 = assignments1.get(experiment.id).variant.name;
      const variant2 = assignments2.get(experiment.id).variant.name;

      expect(variant1).toBe(variant2);
    });

    it('should respect traffic percentage', async () => {
      // Create experiment with 10% traffic
      const lowTrafficExperiment = await abTesting.createExperiment({
        name: 'Low Traffic Test',
        primaryMetric: 'conversion',
        trafficPercentage: 10,
        variants: [
          { name: 'control', allocation: 50 },
          { name: 'variant', allocation: 50 }
        ]
      });

      await abTesting.startExperiment(lowTrafficExperiment.id);

      // Test many users - should only assign ~10%
      let assignedCount = 0;
      for (let i = 0; i < 100; i++) {
        const assignments = await abTesting.assignUser(`user-${i}`);
        if (assignments.has(lowTrafficExperiment.id)) {
          assignedCount++;
        }
      }

      // Should be approximately 10% (allow some variance)
      expect(assignedCount).toBeGreaterThan(0);
      expect(assignedCount).toBeLessThan(25); // Allow variance but not too much
    });

    it('should get user assignments', async () => {
      const userId = 'user-123';
      await abTesting.assignUser(userId);

      const assignments = abTesting.getUserAssignments(userId);
      expect(assignments.size).toBe(1);
      expect(assignments.has(experiment.id)).toBe(true);
    });
  });

  describe('Event Tracking', () => {
    let experiment;

    beforeEach(async () => {
      experiment = await abTesting.createExperiment({
        name: 'Event Test',
        primaryMetric: 'conversion',
        secondaryMetrics: ['click'],
        variants: [
          { name: 'control', allocation: 50 },
          { name: 'variant', allocation: 50 }
        ]
      });

      await abTesting.startExperiment(experiment.id);
    });

    it('should track experiment events', async () => {
      const userId = 'user-123';
      await abTesting.assignUser(userId);

      // Track primary metric event
      await abTesting.trackEvent(userId, 'conversion', { value: 1 });

      // Track secondary metric event
      await abTesting.trackEvent(userId, 'click', { button: 'cta' });

      // Verify events were recorded
      const results = await abTesting.getExperimentResults(experiment.id);
      expect(results).toBeDefined();
    });

    it('should only track relevant events', async () => {
      const userId = 'user-123';
      await abTesting.assignUser(userId);

      // Track irrelevant event
      await abTesting.trackEvent(userId, 'irrelevant_event', { value: 1 });

      // Should not affect experiment results
      const results = await abTesting.getExperimentResults(experiment.id);
      expect(results).toBeDefined();
    });
  });

  describe('Statistical Analysis', () => {
    let experiment;

    beforeEach(async () => {
      experiment = await abTesting.createExperiment({
        name: 'Stats Test',
        primaryMetric: 'conversion',
        variants: [
          { name: 'control', allocation: 50 },
          { name: 'variant', allocation: 50 }
        ],
        minSampleSize: 10
      });

      await abTesting.startExperiment(experiment.id);
    });

    it('should calculate experiment results', async () => {
      // Simulate user assignments and conversions
      for (let i = 0; i < 20; i++) {
        const userId = `user-${i}`;
        await abTesting.assignUser(userId);
        
        // Simulate 50% conversion rate for control, 60% for variant
        const assignments = abTesting.getUserAssignments(userId);
        const assignment = assignments.get(experiment.id);
        
        if (assignment) {
          const shouldConvert = assignment.variant.name === 'control' ? 
            Math.random() < 0.5 : Math.random() < 0.6;
          
          if (shouldConvert) {
            await abTesting.trackEvent(userId, 'conversion');
          }
        }
      }

      const results = await abTesting.getExperimentResults(experiment.id);

      expect(results).toBeDefined();
      expect(results.variantResults).toBeDefined();
      expect(results.variantResults.control).toBeDefined();
      expect(results.variantResults.variant).toBeDefined();
      expect(results.calculatedAt).toBeInstanceOf(Date);
    });

    it('should perform power analysis', () => {
      const powerAnalysis = abTesting.performPowerAnalysis({
        baselineConversion: 0.05,
        minimumDetectableEffect: 0.01,
        confidenceLevel: 0.95,
        power: 0.8
      });

      expect(powerAnalysis).toBeDefined();
      expect(powerAnalysis.sampleSizePerVariant).toBeGreaterThan(0);
      expect(powerAnalysis.totalSampleSize).toBeGreaterThan(0);
      expect(powerAnalysis.estimatedDuration).toBeGreaterThan(0);
    });

    it('should get experiment statistics', async () => {
      const stats = abTesting.getExperimentStats(experiment.id);

      expect(stats).toBeDefined();
      expect(stats.id).toBe(experiment.id);
      expect(stats.name).toBe(experiment.name);
      expect(stats.status).toBe(ExperimentStatus.RUNNING);
      expect(stats.variants).toHaveLength(2);
    });
  });

  describe('Feature Flags', () => {
    it('should create feature flag', async () => {
      const flagConfig = {
        name: 'new_ui_feature',
        description: 'Enable new UI design',
        enabled: true,
        defaultValue: false,
        rules: [
          {
            field: 'userType',
            operator: 'equals',
            value: 'premium',
            result: true
          }
        ]
      };

      const flag = await abTesting.createFeatureFlag(flagConfig);

      expect(flag).toBeDefined();
      expect(flag.id).toBeDefined();
      expect(flag.name).toBe('new_ui_feature');
      expect(flag.enabled).toBe(true);
      expect(flag.rules).toHaveLength(1);
    });

    it('should evaluate feature flag', async () => {
      const flag = await abTesting.createFeatureFlag({
        name: 'test_feature',
        enabled: true,
        defaultValue: false,
        rules: [
          {
            field: 'userType',
            operator: 'equals',
            value: 'premium',
            result: true
          }
        ]
      });

      // Test premium user
      const premiumResult = await abTesting.evaluateFeatureFlag(
        flag.id, 
        'user-123', 
        { userType: 'premium' }
      );
      expect(premiumResult).toBe(true);

      // Test regular user
      const regularResult = await abTesting.evaluateFeatureFlag(
        flag.id, 
        'user-456', 
        { userType: 'regular' }
      );
      expect(regularResult).toBe(false);
    });

    it('should return default value when flag disabled', async () => {
      const flag = await abTesting.createFeatureFlag({
        name: 'disabled_feature',
        enabled: false,
        defaultValue: 'default_value'
      });

      const result = await abTesting.evaluateFeatureFlag(flag.id, 'user-123');
      expect(result).toBe('default_value');
    });
  });

  describe('Splitting Algorithms', () => {
    it('should support random splitting', async () => {
      const experiment = await abTesting.createExperiment({
        name: 'Random Split Test',
        primaryMetric: 'conversion',
        splittingAlgorithm: SplittingAlgorithms.RANDOM,
        variants: [
          { name: 'control', allocation: 50 },
          { name: 'variant', allocation: 50 }
        ]
      });

      await abTesting.startExperiment(experiment.id);

      const assignments = await abTesting.assignUser('user-123');
      expect(assignments.has(experiment.id)).toBe(true);
    });

    it('should support hash-based splitting', async () => {
      const experiment = await abTesting.createExperiment({
        name: 'Hash Split Test',
        primaryMetric: 'conversion',
        splittingAlgorithm: SplittingAlgorithms.HASH_BASED,
        variants: [
          { name: 'control', allocation: 50 },
          { name: 'variant', allocation: 50 }
        ]
      });

      await abTesting.startExperiment(experiment.id);

      const assignments = await abTesting.assignUser('user-123');
      expect(assignments.has(experiment.id)).toBe(true);
    });
  });

  describe('Events', () => {
    it('should emit experiment-created event', async () => {
      const eventHandler = jest.fn();
      abTesting.on('experiment-created', eventHandler);

      const experiment = await abTesting.createExperiment({
        name: 'Event Test',
        primaryMetric: 'conversion',
        variants: [
          { name: 'control', allocation: 50 },
          { name: 'variant', allocation: 50 }
        ]
      });

      expect(eventHandler).toHaveBeenCalledWith(experiment);
    });

    it('should emit experiment-started event', async () => {
      const experiment = await abTesting.createExperiment({
        name: 'Event Test',
        primaryMetric: 'conversion',
        variants: [
          { name: 'control', allocation: 50 },
          { name: 'variant', allocation: 50 }
        ]
      });

      const eventHandler = jest.fn();
      abTesting.on('experiment-started', eventHandler);

      await abTesting.startExperiment(experiment.id);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: experiment.id,
          status: ExperimentStatus.RUNNING
        })
      );
    });

    it('should emit assignment-tracked event', async () => {
      const experiment = await abTesting.createExperiment({
        name: 'Event Test',
        primaryMetric: 'conversion',
        variants: [
          { name: 'control', allocation: 50 },
          { name: 'variant', allocation: 50 }
        ]
      });

      await abTesting.startExperiment(experiment.id);

      const eventHandler = jest.fn();
      abTesting.on('assignment-tracked', eventHandler);

      await abTesting.assignUser('user-123');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          experimentId: experiment.id,
          userId: 'user-123'
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid experiment ID', async () => {
      await expect(
        abTesting.startExperiment('invalid-id')
      ).rejects.toThrow('Experiment not found');
    });

    it('should handle invalid experiment status transitions', async () => {
      const experiment = await abTesting.createExperiment({
        name: 'Status Test',
        primaryMetric: 'conversion',
        variants: [
          { name: 'control', allocation: 50 },
          { name: 'variant', allocation: 50 }
        ]
      });

      await abTesting.startExperiment(experiment.id);

      // Try to start already running experiment
      await expect(
        abTesting.startExperiment(experiment.id)
      ).rejects.toThrow('Cannot start experiment in status: running');
    });

    it('should handle feature flags when disabled', async () => {
      const abTestingNoFlags = new ABTestingManager({
        enableFeatureFlags: false
      });

      await expect(
        abTestingNoFlags.createFeatureFlag({ name: 'test' })
      ).rejects.toThrow('Feature flags not enabled');
    });
  });
});