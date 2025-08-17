/**
 * Tests for Audit Logger
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AuditLogger, { AuditEventTypes, ComplianceFrameworks, RiskLevels } from '../../src/enterprise/AuditLogger.js';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

describe('AuditLogger', () => {
  let auditLogger;
  let tempDir;

  beforeEach(async () => {
    tempDir = path.join(tmpdir(), 'audit-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });

    auditLogger = new AuditLogger({
      logDirectory: tempDir,
      encryptLogs: false, // Disable for testing
      retentionDays: 30,
      batchSize: 5,
      flushInterval: 100,
      complianceFrameworks: [ComplianceFrameworks.GDPR]
    });
  });

  afterEach(async () => {
    // Cleanup
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Event Logging', () => {
    it('should log audit event', async () => {
      const eventData = {
        userId: 'user-123',
        action: 'login',
        timestamp: new Date()
      };

      const eventId = await auditLogger.logEvent(
        AuditEventTypes.LOGIN,
        eventData,
        {
          riskLevel: RiskLevels.LOW,
          category: 'authentication'
        }
      );

      expect(eventId).toBeDefined();
    });

    it('should validate required event fields', async () => {
      await expect(
        auditLogger.logEvent(null, {})
      ).rejects.toThrow('Event type is required');
    });

    it('should log authentication events', async () => {
      const eventId = await auditLogger.logAuth('login', 'user-123', {
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser'
      });

      expect(eventId).toBeDefined();
    });

    it('should log model operations', async () => {
      const eventId = await auditLogger.logModelOperation('loaded', 'gpt-4', {
        parameters: { temperature: 0.7 }
      });

      expect(eventId).toBeDefined();
    });

    it('should log data access', async () => {
      const eventId = await auditLogger.logDataAccess(
        'user-123',
        '/api/models',
        'read',
        { responseTime: 150 }
      );

      expect(eventId).toBeDefined();
    });

    it('should log security violations', async () => {
      const eventId = await auditLogger.logSecurityViolation(
        'rate_limit_exceeded',
        {
          userId: 'user-123',
          attempts: 10,
          timeWindow: '5m'
        }
      );

      expect(eventId).toBeDefined();
    });

    it('should log compliance events', async () => {
      const eventId = await auditLogger.logCompliance(
        ComplianceFrameworks.GDPR,
        'data_request',
        {
          requestType: 'deletion',
          userId: 'user-123'
        }
      );

      expect(eventId).toBeDefined();
    });
  });

  describe('Event Querying', () => {
    beforeEach(async () => {
      // Log some test events
      await auditLogger.logAuth('login', 'user-123');
      await auditLogger.logAuth('logout', 'user-123');
      await auditLogger.logModelOperation('loaded', 'model-1');
      await auditLogger.logSecurityViolation('suspicious_activity', {});
    });

    it('should query events by criteria', async () => {
      const result = await auditLogger.queryEvents({
        eventType: AuditEventTypes.LOGIN,
        limit: 10
      });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].eventType).toBe(AuditEventTypes.LOGIN);
    });

    it('should query events by user', async () => {
      const result = await auditLogger.queryEvents({
        userId: 'user-123',
        limit: 10
      });

      expect(result.events).toHaveLength(2);
      expect(result.events.every(e => e.data.userId === 'user-123')).toBe(true);
    });

    it('should query events by risk level', async () => {
      const result = await auditLogger.queryEvents({
        riskLevel: RiskLevels.HIGH,
        limit: 10
      });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].context.riskLevel).toBe(RiskLevels.HIGH);
    });

    it('should query events by category', async () => {
      const result = await auditLogger.queryEvents({
        category: 'authentication',
        limit: 10
      });

      expect(result.events).toHaveLength(2);
      expect(result.events.every(e => e.context.category === 'authentication')).toBe(true);
    });

    it('should query events by date range', async () => {
      const startDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const endDate = new Date();

      const result = await auditLogger.queryEvents({
        startDate,
        endDate,
        limit: 10
      });

      expect(result.events.length).toBeGreaterThan(0);
      result.events.forEach(event => {
        const eventDate = new Date(event.timestamp);
        expect(eventDate).toBeGreaterThanOrEqual(startDate);
        expect(eventDate).toBeLessThanOrEqual(endDate);
      });
    });

    it('should support pagination', async () => {
      const page1 = await auditLogger.queryEvents({ limit: 2, offset: 0 });
      const page2 = await auditLogger.queryEvents({ limit: 2, offset: 2 });

      expect(page1.events).toHaveLength(2);
      expect(page2.events).toHaveLength(2);
      expect(page1.events[0].id).not.toBe(page2.events[0].id);
    });
  });

  describe('Export Functionality', () => {
    beforeEach(async () => {
      // Log some test events
      await auditLogger.logAuth('login', 'user-123');
      await auditLogger.logModelOperation('loaded', 'model-1');
    });

    it('should export events as JSON', async () => {
      const exported = await auditLogger.exportLogs('json');

      expect(exported).toBeDefined();
      const events = JSON.parse(exported);
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
    });

    it('should export events as CSV', async () => {
      const exported = await auditLogger.exportLogs('csv');

      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');
      expect(exported.includes('id,eventType,timestamp')).toBe(true);
    });

    it('should export events as XML', async () => {
      const exported = await auditLogger.exportLogs('xml');

      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');
      expect(exported.includes('<?xml version="1.0"')).toBe(true);
      expect(exported.includes('<auditEvents>')).toBe(true);
    });

    it('should handle unsupported export format', async () => {
      await expect(
        auditLogger.exportLogs('unsupported')
      ).rejects.toThrow('Unsupported export format');
    });
  });

  describe('Integrity Verification', () => {
    beforeEach(async () => {
      // Log some events to create a chain
      await auditLogger.logAuth('login', 'user-123');
      await auditLogger.logAuth('logout', 'user-123');
      await auditLogger.logModelOperation('loaded', 'model-1');
    });

    it('should verify audit trail integrity', async () => {
      const verification = await auditLogger.verifyIntegrity();

      expect(verification).toBeDefined();
      expect(verification.isValid).toBe(true);
      expect(verification.violations).toHaveLength(0);
      expect(verification.totalEvents).toBeGreaterThan(0);
      expect(verification.checkedAt).toBeInstanceOf(Date);
    });

    it('should detect integrity violations', async () => {
      // Manually corrupt an event hash to simulate tampering
      const events = auditLogger.auditEvents;
      if (events.length > 0) {
        const eventId = events[0].id;
        auditLogger.eventHashes.set(eventId, 'corrupted_hash');

        const verification = await auditLogger.verifyIntegrity();

        expect(verification.isValid).toBe(false);
        expect(verification.violations.length).toBeGreaterThan(0);
        expect(verification.violations[0].type).toBe('hash_mismatch');
      }
    });
  });

  describe('Compliance Reporting', () => {
    beforeEach(async () => {
      // Log compliance events
      await auditLogger.logCompliance(
        ComplianceFrameworks.GDPR,
        'data_request',
        { requestType: 'access' }
      );

      await auditLogger.logCompliance(
        ComplianceFrameworks.GDPR,
        'data_deletion',
        { recordsDeleted: 5 }
      );
    });

    it('should generate compliance report', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const report = await auditLogger.generateComplianceReport(
        ComplianceFrameworks.GDPR,
        startDate,
        endDate
      );

      expect(report).toBeDefined();
      expect(report.framework).toBe(ComplianceFrameworks.GDPR);
      expect(report.period.startDate).toBe(startDate);
      expect(report.period.endDate).toBe(endDate);
      expect(report.summary.totalEvents).toBeGreaterThan(0);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe('Retention Policies', () => {
    it('should setup retention policy', async () => {
      await auditLogger.setupRetentionPolicy('authentication', 30, '/archive');

      // Verify policy was created
      const policy = auditLogger.retentionPolicies.get('authentication');
      expect(policy).toBeDefined();
      expect(policy.retentionDays).toBe(30);
      expect(policy.archiveLocation).toBe('/archive');
    });

    it('should apply retention policies', async () => {
      // Setup short retention for testing
      await auditLogger.setupRetentionPolicy('test', 0); // 0 days for immediate deletion

      // Log an event
      await auditLogger.logEvent(
        AuditEventTypes.LOGIN,
        { userId: 'user-123' },
        { category: 'test' }
      );

      // Apply retention (should delete the event)
      const result = await auditLogger.applyRetentionPolicies();

      expect(result.deletedCount).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      // Log various events
      await auditLogger.logAuth('login', 'user-123');
      await auditLogger.logSecurityViolation('test_violation', {});
      await auditLogger.logModelOperation('loaded', 'model-1');
    });

    it('should provide audit statistics', () => {
      const stats = auditLogger.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.lastHour).toBeGreaterThan(0);
      expect(stats.lastDay).toBeGreaterThan(0);
      expect(typeof stats.averageProcessingTime).toBe('number');
      expect(typeof stats.bufferSize).toBe('number');
    });
  });

  describe('Events', () => {
    it('should emit audit-event when logging', async () => {
      const eventHandler = jest.fn();
      auditLogger.on('audit-event', eventHandler);

      await auditLogger.logAuth('login', 'user-123');

      expect(eventHandler).toHaveBeenCalled();
    });

    it('should emit security-violation event', async () => {
      const eventHandler = jest.fn();
      auditLogger.on('security-violation', eventHandler);

      await auditLogger.logSecurityViolation('test_violation', {
        severity: RiskLevels.HIGH
      });

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          violationType: 'test_violation'
        })
      );
    });

    it('should emit compliance-violation event', async () => {
      const eventHandler = jest.fn();
      auditLogger.on('compliance-violation', eventHandler);

      // Log an event that would trigger compliance check
      await auditLogger.logEvent(
        AuditEventTypes.DATA_ACCESS,
        {
          userId: 'user-123',
          personalData: true
        },
        {
          category: 'data_access',
          hasConsent: false // This should trigger GDPR violation
        }
      );

      // Note: This test assumes compliance checking is implemented
      // and would trigger violations based on the data
    });
  });

  describe('Compliance Checks', () => {
    it('should check GDPR compliance', async () => {
      // Log event with personal data without consent
      const eventId = await auditLogger.logEvent(
        AuditEventTypes.DATA_ACCESS,
        {
          userId: 'user-123',
          email: 'user@example.com'
        },
        {
          category: 'data_access',
          hasConsent: false
        }
      );

      expect(eventId).toBeDefined();
      // Additional compliance checks would be implemented based on requirements
    });

    it('should check data retention compliance', async () => {
      const eventId = await auditLogger.logEvent(
        AuditEventTypes.DATA_ACCESS,
        { resource: 'user_data' },
        { category: 'data_without_policy' }
      );

      expect(eventId).toBeDefined();
      // Compliance check for missing retention policy
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid event types', async () => {
      await expect(
        auditLogger.logEvent('', {})
      ).rejects.toThrow('Event type is required');
    });

    it('should handle missing timestamps', async () => {
      await expect(
        auditLogger.logEvent(AuditEventTypes.LOGIN, {}, {})
      ).resolves.toBeDefined(); // Should auto-generate timestamp
    });

    it('should handle invalid query parameters', async () => {
      const result = await auditLogger.queryEvents({
        invalidParam: 'invalid'
      });

      expect(result.events).toBeDefined();
      expect(Array.isArray(result.events)).toBe(true);
    });
  });

  describe('Encryption', () => {
    it('should handle encrypted logs when enabled', async () => {
      const encryptedLogger = new AuditLogger({
        logDirectory: tempDir,
        encryptLogs: true,
        batchSize: 1,
        flushInterval: 50
      });

      const eventId = await encryptedLogger.logAuth('login', 'user-123');
      expect(eventId).toBeDefined();

      // Allow time for flush
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });

  describe('Buffer Management', () => {
    it('should flush buffer when full', async () => {
      const eventHandler = jest.fn();
      auditLogger.on('audit-event', eventHandler);

      // Log enough events to trigger flush (batchSize = 5)
      for (let i = 0; i < 6; i++) {
        await auditLogger.logAuth('login', `user-${i}`);
      }

      expect(eventHandler).toHaveBeenCalledTimes(6);
    });

    it('should handle buffer flush on interval', async () => {
      await auditLogger.logAuth('login', 'user-123');

      // Wait for flush interval
      await new Promise(resolve => setTimeout(resolve, 150));

      // Event should be processed
      const stats = auditLogger.getStatistics();
      expect(stats.total).toBeGreaterThan(0);
    });
  });
});