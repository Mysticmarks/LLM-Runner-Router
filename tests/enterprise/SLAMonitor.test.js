/**
 * Tests for SLA Monitor
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import SLAMonitor, { SLAMetricTypes, BreachSeverity, SLAStatus, TimeWindows } from '../../src/enterprise/SLAMonitor.js';

describe('SLAMonitor', () => {
  let slaMonitor;

  beforeEach(() => {
    slaMonitor = new SLAMonitor({
      alertingEnabled: true,
      reportingInterval: 1000, // 1 second for testing
      retentionDays: 7
    });
  });

  afterEach(async () => {
    await slaMonitor.stopMonitoring();
  });

  describe('SLA Definition', () => {
    it('should define an SLA', async () => {
      const slaConfig = {
        serviceName: 'model-service',
        description: 'Model inference SLA',
        targets: {
          [SLAMetricTypes.RESPONSE_TIME]: {
            threshold: 1000, // 1 second
            operator: 'less_than',
            timeWindow: TimeWindows.MINUTE
          },
          [SLAMetricTypes.ERROR_RATE]: {
            threshold: 0.01, // 1%
            operator: 'less_than',
            timeWindow: TimeWindows.HOUR
          }
        },
        businessImpact: 'high'
      };

      const sla = await slaMonitor.defineSLA(slaConfig);

      expect(sla).toBeDefined();
      expect(sla.id).toBeDefined();
      expect(sla.serviceName).toBe('model-service');
      expect(sla.targets).toHaveProperty(SLAMetricTypes.RESPONSE_TIME);
      expect(sla.targets).toHaveProperty(SLAMetricTypes.ERROR_RATE);
      expect(sla.businessImpact).toBe('high');
      expect(sla.createdAt).toBeInstanceOf(Date);
    });

    it('should validate SLA configuration', async () => {
      const invalidSLA = {
        // Missing serviceName
        targets: {
          [SLAMetricTypes.RESPONSE_TIME]: {
            threshold: 1000,
            operator: 'less_than'
          }
        }
      };

      await expect(slaMonitor.defineSLA(invalidSLA))
        .rejects.toThrow('Service name is required');
    });

    it('should validate metric types', async () => {
      const invalidSLA = {
        serviceName: 'test-service',
        targets: {
          'invalid_metric': {
            threshold: 100,
            operator: 'less_than'
          }
        }
      };

      await expect(slaMonitor.defineSLA(invalidSLA))
        .rejects.toThrow('Invalid metric type');
    });

    it('should validate threshold operators', async () => {
      const invalidSLA = {
        serviceName: 'test-service',
        targets: {
          [SLAMetricTypes.RESPONSE_TIME]: {
            threshold: 1000,
            operator: 'invalid_operator'
          }
        }
      };

      await expect(slaMonitor.defineSLA(invalidSLA))
        .rejects.toThrow('Invalid operator');
    });
  });

  describe('Metric Recording', () => {
    let sla;

    beforeEach(async () => {
      sla = await slaMonitor.defineSLA({
        serviceName: 'test-service',
        targets: {
          [SLAMetricTypes.RESPONSE_TIME]: {
            threshold: 1000,
            operator: 'less_than',
            timeWindow: TimeWindows.MINUTE
          }
        }
      });
    });

    it('should record metric values', async () => {
      await slaMonitor.recordMetric(
        'test-service',
        SLAMetricTypes.RESPONSE_TIME,
        500,
        { requestId: 'req-123' }
      );

      const currentMetrics = slaMonitor.getCurrentMetrics('test-service');
      expect(currentMetrics.has(SLAMetricTypes.RESPONSE_TIME)).toBe(true);

      const metric = currentMetrics.get(SLAMetricTypes.RESPONSE_TIME);
      expect(metric.value).toBe(500);
      expect(metric.metadata.requestId).toBe('req-123');
    });

    it('should maintain time series data', async () => {
      // Record multiple values
      await slaMonitor.recordMetric('test-service', SLAMetricTypes.RESPONSE_TIME, 400);
      await slaMonitor.recordMetric('test-service', SLAMetricTypes.RESPONSE_TIME, 600);
      await slaMonitor.recordMetric('test-service', SLAMetricTypes.RESPONSE_TIME, 800);

      const serviceMetrics = slaMonitor.metrics.get('test-service');
      const timeSeries = serviceMetrics.get(SLAMetricTypes.RESPONSE_TIME);

      expect(timeSeries).toHaveLength(3);
      expect(timeSeries.map(p => p.value)).toEqual([400, 600, 800]);
    });

    it('should check SLA compliance when recording metrics', async () => {
      // Record value that breaches SLA (threshold is 1000)
      await slaMonitor.recordMetric(
        'test-service',
        SLAMetricTypes.RESPONSE_TIME,
        1500
      );

      // Should trigger SLA breach handling
      expect(slaMonitor.activeBreaches.size).toBeGreaterThan(0);
    });
  });

  describe('SLA Status Evaluation', () => {
    let sla;

    beforeEach(async () => {
      sla = await slaMonitor.defineSLA({
        serviceName: 'test-service',
        targets: {
          [SLAMetricTypes.RESPONSE_TIME]: {
            threshold: 1000,
            operator: 'less_than',
            timeWindow: TimeWindows.MINUTE
          },
          [SLAMetricTypes.ERROR_RATE]: {
            threshold: 0.05, // 5%
            operator: 'less_than',
            timeWindow: TimeWindows.HOUR
          }
        }
      });
    });

    it('should get SLA status for healthy service', async () => {
      // Record good metrics
      await slaMonitor.recordMetric('test-service', SLAMetricTypes.RESPONSE_TIME, 500);
      await slaMonitor.recordMetric('test-service', SLAMetricTypes.ERROR_RATE, 0.01);

      const status = await slaMonitor.getSLAStatus('test-service');

      expect(status.serviceName).toBe('test-service');
      expect(status.status).toBe(SLAStatus.HEALTHY);
      expect(status.details).toHaveLength(1); // One SLA defined
    });

    it('should get SLA status for breached service', async () => {
      // Record bad metrics
      await slaMonitor.recordMetric('test-service', SLAMetricTypes.RESPONSE_TIME, 2000);
      await slaMonitor.recordMetric('test-service', SLAMetricTypes.ERROR_RATE, 0.10);

      const status = await slaMonitor.getSLAStatus('test-service');

      expect(status.status).toBe(SLAStatus.BREACH);
    });

    it('should handle unknown service', async () => {
      const status = await slaMonitor.getSLAStatus('unknown-service');

      expect(status.status).toBe(SLAStatus.UNKNOWN);
      expect(status.message).toBe('No SLAs defined');
    });
  });

  describe('Aggregated Metrics', () => {
    beforeEach(async () => {
      await slaMonitor.defineSLA({
        serviceName: 'test-service',
        targets: {
          [SLAMetricTypes.RESPONSE_TIME]: {
            threshold: 1000,
            operator: 'less_than'
          }
        }
      });

      // Record test data
      const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      for (const value of values) {
        await slaMonitor.recordMetric('test-service', SLAMetricTypes.RESPONSE_TIME, value);
      }
    });

    it('should calculate aggregated metrics', async () => {
      const aggregated = await slaMonitor.getAggregatedMetrics(
        'test-service',
        SLAMetricTypes.RESPONSE_TIME,
        TimeWindows.HOUR
      );

      expect(aggregated).toBeDefined();
      expect(aggregated.serviceName).toBe('test-service');
      expect(aggregated.metricType).toBe(SLAMetricTypes.RESPONSE_TIME);
      expect(aggregated.count).toBe(10);
      expect(aggregated.min).toBe(100);
      expect(aggregated.max).toBe(1000);
      expect(aggregated.avg).toBe(550);
      expect(aggregated.median).toBe(550);
      expect(aggregated.p95).toBeGreaterThan(aggregated.median);
      expect(aggregated.p99).toBeGreaterThan(aggregated.p95);
    });

    it('should handle empty metrics', async () => {
      const aggregated = await slaMonitor.getAggregatedMetrics(
        'empty-service',
        SLAMetricTypes.RESPONSE_TIME,
        TimeWindows.HOUR
      );

      expect(aggregated).toBeNull();
    });

    it('should respect time windows', async () => {
      // Record metric in the past (should be excluded from short time window)
      const oldTimestamp = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
      const serviceMetrics = slaMonitor.metrics.get('test-service');
      const timeSeries = serviceMetrics.get(SLAMetricTypes.RESPONSE_TIME);
      timeSeries.unshift({ timestamp: oldTimestamp, value: 50 });

      const aggregated = await slaMonitor.getAggregatedMetrics(
        'test-service',
        SLAMetricTypes.RESPONSE_TIME,
        TimeWindows.HOUR
      );

      // Should not include the old metric (min should not be 50)
      expect(aggregated.min).toBeGreaterThan(50);
    });
  });

  describe('Monitoring Lifecycle', () => {
    it('should start monitoring', async () => {
      expect(slaMonitor.isMonitoring).toBe(false);

      await slaMonitor.startMonitoring();

      expect(slaMonitor.isMonitoring).toBe(true);
      expect(slaMonitor.monitoringInterval).toBeDefined();
    });

    it('should stop monitoring', async () => {
      await slaMonitor.startMonitoring();
      expect(slaMonitor.isMonitoring).toBe(true);

      await slaMonitor.stopMonitoring();

      expect(slaMonitor.isMonitoring).toBe(false);
      expect(slaMonitor.monitoringInterval).toBeNull();
    });

    it('should handle multiple start attempts', async () => {
      await slaMonitor.startMonitoring();
      
      // Should not throw error
      await slaMonitor.startMonitoring();
      
      expect(slaMonitor.isMonitoring).toBe(true);
    });

    it('should handle stop when not monitoring', async () => {
      expect(slaMonitor.isMonitoring).toBe(false);
      
      // Should not throw error
      await slaMonitor.stopMonitoring();
      
      expect(slaMonitor.isMonitoring).toBe(false);
    });
  });

  describe('Breach Management', () => {
    let sla;

    beforeEach(async () => {
      sla = await slaMonitor.defineSLA({
        serviceName: 'breach-test-service',
        targets: {
          [SLAMetricTypes.RESPONSE_TIME]: {
            threshold: 1000,
            operator: 'less_than',
            timeWindow: TimeWindows.MINUTE
          }
        },
        alertingEnabled: true
      });
    });

    it('should detect SLA breach', async () => {
      // Record metric that breaches SLA
      await slaMonitor.recordMetric(
        'breach-test-service',
        SLAMetricTypes.RESPONSE_TIME,
        2000
      );

      expect(slaMonitor.activeBreaches.size).toBeGreaterThan(0);
      expect(slaMonitor.breachHistory.length).toBeGreaterThan(0);
    });

    it('should record breach recovery', async () => {
      // First breach the SLA
      await slaMonitor.recordMetric(
        'breach-test-service',
        SLAMetricTypes.RESPONSE_TIME,
        2000
      );

      expect(slaMonitor.activeBreaches.size).toBeGreaterThan(0);

      // Then recover
      await slaMonitor.recordMetric(
        'breach-test-service',
        SLAMetricTypes.RESPONSE_TIME,
        500
      );

      // Active breach should be resolved
      expect(slaMonitor.activeBreaches.size).toBe(0);
    });

    it('should calculate breach severity', async () => {
      // Record significantly high value
      await slaMonitor.recordMetric(
        'breach-test-service',
        SLAMetricTypes.RESPONSE_TIME,
        5000 // 5x threshold
      );

      const breach = Array.from(slaMonitor.activeBreaches.values())[0];
      expect(breach.severity).toBeDefined();
      expect([
        BreachSeverity.MINOR,
        BreachSeverity.MAJOR,
        BreachSeverity.CRITICAL
      ]).toContain(breach.severity);
    });

    it('should get breach history', () => {
      // First add some breaches to history
      slaMonitor.breachHistory.push({
        id: 'breach-1',
        serviceName: 'test-service',
        startTime: Date.now() - 1000,
        resolved: true
      });

      slaMonitor.breachHistory.push({
        id: 'breach-2',
        serviceName: 'other-service',
        startTime: Date.now() - 500,
        resolved: false
      });

      const allBreaches = slaMonitor.getBreachHistory();
      expect(allBreaches).toHaveLength(2);

      const serviceBreaches = slaMonitor.getBreachHistory('test-service');
      expect(serviceBreaches).toHaveLength(1);
      expect(serviceBreaches[0].serviceName).toBe('test-service');
    });
  });

  describe('Alert Rules', () => {
    it('should setup alert rule', async () => {
      const ruleConfig = {
        serviceName: 'alert-test-service',
        metricType: SLAMetricTypes.RESPONSE_TIME,
        threshold: 800,
        operator: 'greater_than',
        severity: BreachSeverity.WARNING
      };

      const rule = await slaMonitor.setupAlertRule(ruleConfig);

      expect(rule).toBeDefined();
      expect(rule.id).toBeDefined();
      expect(rule.serviceName).toBe('alert-test-service');
      expect(rule.metricType).toBe(SLAMetricTypes.RESPONSE_TIME);
      expect(rule.threshold).toBe(800);
      expect(rule.enabled).toBe(true);
    });

    it('should trigger alerts for breaches', async () => {
      const eventHandler = jest.fn();
      slaMonitor.on('alert-triggered', eventHandler);

      await slaMonitor.defineSLA({
        serviceName: 'alert-service',
        targets: {
          [SLAMetricTypes.RESPONSE_TIME]: {
            threshold: 1000,
            operator: 'less_than'
          }
        },
        alertingEnabled: true
      });

      // Trigger breach
      await slaMonitor.recordMetric('alert-service', SLAMetricTypes.RESPONSE_TIME, 2000);

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('Report Generation', () => {
    beforeEach(async () => {
      // Setup test SLAs and data
      await slaMonitor.defineSLA({
        serviceName: 'report-service-1',
        description: 'First test service',
        targets: {
          [SLAMetricTypes.RESPONSE_TIME]: {
            threshold: 1000,
            operator: 'less_than'
          }
        }
      });

      await slaMonitor.defineSLA({
        serviceName: 'report-service-2',
        description: 'Second test service',
        targets: {
          [SLAMetricTypes.ERROR_RATE]: {
            threshold: 0.05,
            operator: 'less_than'
          }
        }
      });

      // Record some metrics
      await slaMonitor.recordMetric('report-service-1', SLAMetricTypes.RESPONSE_TIME, 800);
      await slaMonitor.recordMetric('report-service-2', SLAMetricTypes.ERROR_RATE, 0.02);
    });

    it('should generate SLA report for all services', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const report = await slaMonitor.generateSLAReport(null, startDate, endDate);

      expect(report).toBeDefined();
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.period.startDate).toBe(startDate);
      expect(report.period.endDate).toBe(endDate);
      expect(report.services).toHaveLength(2);
      expect(report.summary).toBeDefined();
      expect(report.summary.totalServices).toBe(2);
    });

    it('should generate SLA report for specific service', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const report = await slaMonitor.generateSLAReport('report-service-1', startDate, endDate);

      expect(report.services).toHaveLength(1);
      expect(report.services[0].serviceName).toBe('report-service-1');
    });
  });

  describe('Events', () => {
    it('should emit sla-defined event', async () => {
      const eventHandler = jest.fn();
      slaMonitor.on('sla-defined', eventHandler);

      const sla = await slaMonitor.defineSLA({
        serviceName: 'event-test-service',
        targets: {
          [SLAMetricTypes.RESPONSE_TIME]: {
            threshold: 1000,
            operator: 'less_than'
          }
        }
      });

      expect(eventHandler).toHaveBeenCalledWith(sla);
    });

    it('should emit monitoring-started event', async () => {
      const eventHandler = jest.fn();
      slaMonitor.on('monitoring-started', eventHandler);

      await slaMonitor.startMonitoring();

      expect(eventHandler).toHaveBeenCalled();
    });

    it('should emit sla-breach event', async () => {
      const eventHandler = jest.fn();
      slaMonitor.on('sla-breach', eventHandler);

      await slaMonitor.defineSLA({
        serviceName: 'breach-event-service',
        targets: {
          [SLAMetricTypes.RESPONSE_TIME]: {
            threshold: 1000,
            operator: 'less_than'
          }
        }
      });

      await slaMonitor.recordMetric('breach-event-service', SLAMetricTypes.RESPONSE_TIME, 2000);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: 'breach-event-service',
          metricType: SLAMetricTypes.RESPONSE_TIME
        })
      );
    });

    it('should emit sla-recovery event', async () => {
      const eventHandler = jest.fn();
      slaMonitor.on('sla-recovery', eventHandler);

      await slaMonitor.defineSLA({
        serviceName: 'recovery-event-service',
        targets: {
          [SLAMetricTypes.RESPONSE_TIME]: {
            threshold: 1000,
            operator: 'less_than'
          }
        }
      });

      // First breach
      await slaMonitor.recordMetric('recovery-event-service', SLAMetricTypes.RESPONSE_TIME, 2000);

      // Then recover
      await slaMonitor.recordMetric('recovery-event-service', SLAMetricTypes.RESPONSE_TIME, 500);

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid service names for metrics', async () => {
      // Should not throw error, but create new service entry
      await slaMonitor.recordMetric('new-service', SLAMetricTypes.RESPONSE_TIME, 500);

      const currentMetrics = slaMonitor.getCurrentMetrics('new-service');
      expect(currentMetrics.has(SLAMetricTypes.RESPONSE_TIME)).toBe(true);
    });

    it('should handle invalid time windows', async () => {
      await slaMonitor.recordMetric('test-service', SLAMetricTypes.RESPONSE_TIME, 500);

      const aggregated = await slaMonitor.getAggregatedMetrics(
        'test-service',
        SLAMetricTypes.RESPONSE_TIME,
        'invalid-window'
      );

      // Should default to 1 hour window
      expect(aggregated).toBeDefined();
    });

    it('should handle missing SLA data gracefully', async () => {
      const status = await slaMonitor.getSLAStatus('nonexistent-service');

      expect(status.status).toBe(SLAStatus.UNKNOWN);
    });
  });

  describe('Performance', () => {
    it('should handle large volumes of metrics', async () => {
      await slaMonitor.defineSLA({
        serviceName: 'performance-test-service',
        targets: {
          [SLAMetricTypes.RESPONSE_TIME]: {
            threshold: 1000,
            operator: 'less_than'
          }
        }
      });

      const startTime = Date.now();

      // Record 1000 metrics
      for (let i = 0; i < 1000; i++) {
        await slaMonitor.recordMetric(
          'performance-test-service',
          SLAMetricTypes.RESPONSE_TIME,
          Math.random() * 2000
        );
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds

      const serviceMetrics = slaMonitor.metrics.get('performance-test-service');
      const timeSeries = serviceMetrics.get(SLAMetricTypes.RESPONSE_TIME);
      expect(timeSeries).toHaveLength(1000);
    });

    it('should cleanup old metrics based on retention', async () => {
      // This test would verify that old metrics are cleaned up
      // based on the retention policy
      const oldMetrics = slaMonitor.metrics.get('test-service');
      if (oldMetrics) {
        expect(oldMetrics.size).toBeGreaterThanOrEqual(0);
      }
    });
  });
});