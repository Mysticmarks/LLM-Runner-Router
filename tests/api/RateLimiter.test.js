/**
 * Rate Limiter Tests
 * Tests for rate limiting strategies, Redis integration, and intelligent throttling
 */

import { jest } from '@jest/globals';
import { RateLimitManager } from '../../src/api/RateLimiter.js';

describe('Rate Limiting System', () => {
  let rateLimiter;
  let mockReq, mockRes, mockNext;

  beforeEach(async () => {
    rateLimiter = new RateLimitManager({
      useRedis: false, // Use memory for tests
      enableAdaptiveRateLimiting: true,
      enableCostBasedLimiting: true,
      enableAnomalyDetection: true,
      tiers: {
        test: {
          requestsPerHour: 100,
          requestsPerMinute: 10,
          concurrentRequests: 3,
          costMultiplier: 1
        }
      }
    });

    await rateLimiter.initialize();

    // Mock Express request/response objects
    mockReq = {
      ip: '127.0.0.1',
      user: { id: 'test-user', role: 'user', tier: 'test' },
      headers: { 'user-agent': 'test-agent' },
      route: { path: '/api/test' },
      method: 'POST'
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  afterEach(async () => {
    if (rateLimiter) {
      await rateLimiter.shutdown();
    }
  });

  describe('Initialization', () => {
    test('should initialize rate limiter successfully', () => {
      expect(rateLimiter.limiters.size).toBeGreaterThan(0);
      expect(rateLimiter.options).toBeDefined();
      expect(rateLimiter.metrics).toBeDefined();
    });

    test('should setup tier-based limiters', () => {
      expect(rateLimiter.limiters.has('tier:test:hourly')).toBe(true);
      expect(rateLimiter.limiters.has('tier:test:minute')).toBe(true);
      expect(rateLimiter.limiters.has('tier:test:concurrent')).toBe(true);
    });

    test('should setup global and strategy limiters', () => {
      expect(rateLimiter.limiters.has('global')).toBe(true);
      expect(rateLimiter.limiters.has('fixedWindow')).toBe(true);
      expect(rateLimiter.limiters.has('slidingWindow')).toBe(true);
      expect(rateLimiter.limiters.has('tokenBucket')).toBe(true);
    });
  });

  describe('Key Generation', () => {
    test('should generate unique keys for different users', () => {
      const key1 = rateLimiter.generateKey(mockReq, 'test');
      
      const req2 = { ...mockReq, user: { id: 'another-user' } };
      const key2 = rateLimiter.generateKey(req2, 'test');
      
      expect(key1).not.toBe(key2);
      expect(key1).toContain('user:test-user');
      expect(key2).toContain('user:another-user');
    });

    test('should use IP when no user is present', () => {
      const reqWithoutUser = { ...mockReq, user: null };
      const key = rateLimiter.generateKey(reqWithoutUser, 'test');
      
      expect(key).toContain('ip:127.0.0.1');
    });

    test('should include route information', () => {
      const key = rateLimiter.generateKey(mockReq, 'test');
      expect(key).toContain('route:_api_test');
    });
  });

  describe('Tier Detection', () => {
    test('should detect user tier correctly', () => {
      expect(rateLimiter.getUserTier(mockReq)).toBe('test');
    });

    test('should default to free tier for unauthenticated users', () => {
      const unauthReq = { ...mockReq, user: null, apiKey: null };
      expect(rateLimiter.getUserTier(unauthReq)).toBe('free');
    });

    test('should use admin tier for admin users', () => {
      const adminReq = { ...mockReq, user: { role: 'admin' } };
      expect(rateLimiter.getUserTier(adminReq)).toBe('enterprise');
    });

    test('should use API key tier when available', () => {
      const apiReq = { 
        ...mockReq, 
        user: null, 
        apiKey: { tier: 'premium' } 
      };
      expect(rateLimiter.getUserTier(apiReq)).toBe('premium');
    });
  });

  describe('Rate Limit Checking', () => {
    test('should allow requests within limits', async () => {
      const result = await rateLimiter.checkRateLimit(mockReq, mockRes);
      
      expect(result.allowed).toBe(true);
      expect(result.tier).toBe('test');
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    test('should track metrics correctly', async () => {
      const initialRequests = rateLimiter.metrics.totalRequests;
      
      await rateLimiter.checkRateLimit(mockReq, mockRes);
      
      expect(rateLimiter.metrics.totalRequests).toBe(initialRequests + 1);
    });

    test('should set rate limit headers', async () => {
      await rateLimiter.checkRateLimit(mockReq, mockRes);
      
      expect(mockRes.set).toHaveBeenCalled();
      const setCall = mockRes.set.mock.calls[0][0];
      expect(setCall).toHaveProperty('X-RateLimit-Limit');
      expect(setCall).toHaveProperty('X-RateLimit-Remaining');
      expect(setCall).toHaveProperty('X-RateLimit-Tier');
    });

    test('should handle cost-based limiting', async () => {
      const result = await rateLimiter.checkRateLimit(mockReq, mockRes, { cost: 5 });
      
      expect(result.allowed).toBe(true);
      expect(result.cost).toBe(5);
    });
  });

  describe('Middleware Integration', () => {
    test('should create working middleware', async () => {
      const middleware = rateLimiter.createMiddleware();
      
      await middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.rateLimit).toBeDefined();
      expect(mockReq.rateLimit.allowed).toBe(true);
    });

    test('should block requests when limit exceeded', async () => {
      // Simulate rate limit exceeded by making many requests quickly
      const middleware = rateLimiter.createMiddleware();
      
      // Make requests up to the limit
      for (let i = 0; i < 15; i++) {
        const req = { ...mockReq };
        const res = { ...mockRes, set: jest.fn() };
        const next = jest.fn();
        
        try {
          await middleware(req, res, next);
        } catch (error) {
          // Expected when limit is exceeded
        }
      }
      
      // This request should be blocked
      const finalReq = { ...mockReq };
      const finalRes = { 
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn()
      };
      const finalNext = jest.fn();
      
      await middleware(finalReq, finalRes, finalNext);
      
      // Should not call next, but instead return 429
      expect(finalNext).not.toHaveBeenCalled();
    });

    test('should create cost-based middleware', async () => {
      const costCalculator = (req) => req.body?.complexity || 1;
      const middleware = rateLimiter.createCostMiddleware(costCalculator);
      
      mockReq.body = { complexity: 3 };
      
      await middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.rateLimit.cost).toBe(3);
    });

    test('should create bypass middleware', async () => {
      const bypassConditions = [
        (req) => req.user?.role === 'admin',
        '127.0.0.1' // IP bypass
      ];
      
      const bypassMiddleware = rateLimiter.createBypassMiddleware(bypassConditions);
      const regularMiddleware = rateLimiter.createMiddleware();
      
      // Test admin bypass
      const adminReq = { ...mockReq, user: { role: 'admin' } };
      bypassMiddleware(adminReq, mockRes, mockNext);
      
      expect(adminReq.rateLimit.bypassed).toBe(true);
      
      // Test IP bypass
      const ipReq = { ...mockReq, ip: '127.0.0.1', user: null };
      bypassMiddleware(ipReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(2);
    });
  });

  describe('Adaptive Rate Limiting', () => {
    test('should adjust limits based on error rates', async () => {
      const key = rateLimiter.generateKey(mockReq, 'adaptive');
      
      // Simulate high error rate
      rateLimiter.userMetrics.set(key, {
        requests: 100,
        errors: 10, // 10% error rate
        avgLatency: 500,
        currentLimit: 100
      });
      
      await rateLimiter.applyAdaptiveRateLimiting(mockReq, []);
      
      const metrics = rateLimiter.userMetrics.get(key);
      expect(metrics.currentLimit).toBeGreaterThan(100); // Should increase limit
    });

    test('should decrease limits when performing well', async () => {
      const key = rateLimiter.generateKey(mockReq, 'adaptive');
      
      // Simulate low error rate
      rateLimiter.userMetrics.set(key, {
        requests: 100,
        errors: 1, // 1% error rate
        avgLatency: 50,
        currentLimit: 1000
      });
      
      await rateLimiter.applyAdaptiveRateLimiting(mockReq, []);
      
      const metrics = rateLimiter.userMetrics.get(key);
      expect(metrics.currentLimit).toBeLessThan(1000); // Should decrease limit
    });
  });

  describe('Cost Tracking', () => {
    test('should track request costs', async () => {
      await rateLimiter.trackCost(mockReq, 5);
      
      const key = rateLimiter.generateKey(mockReq, 'cost');
      const costData = rateLimiter.costTracking.get(key);
      
      expect(costData).toBeDefined();
      expect(costData.total).toBe(5);
      expect(costData.requests).toBe(1);
    });

    test('should accumulate costs over time', async () => {
      await rateLimiter.trackCost(mockReq, 3);
      await rateLimiter.trackCost(mockReq, 7);
      
      const key = rateLimiter.generateKey(mockReq, 'cost');
      const costData = rateLimiter.costTracking.get(key);
      
      expect(costData.total).toBe(10);
      expect(costData.requests).toBe(2);
    });

    test('should reset cost window after expiry', async () => {
      const key = rateLimiter.generateKey(mockReq, 'cost');
      
      // Set old window
      rateLimiter.costTracking.set(key, {
        total: 100,
        requests: 50,
        window: Date.now() - 3700000 // More than 1 hour ago
      });
      
      await rateLimiter.trackCost(mockReq, 5);
      
      const costData = rateLimiter.costTracking.get(key);
      expect(costData.total).toBe(5); // Should reset
      expect(costData.requests).toBe(1);
    });
  });

  describe('Anomaly Detection', () => {
    test('should detect suspicious request patterns', () => {
      const ip = '192.168.1.100';
      const suspiciousReq = { ...mockReq, ip };
      
      // Simulate many requests in short time
      for (let i = 0; i < 150; i++) {
        rateLimiter.detectAnomalies(suspiciousReq);
      }
      
      expect(rateLimiter.anomalyDetection.alerts.length).toBeGreaterThan(0);
      
      const alert = rateLimiter.anomalyDetection.alerts[0];
      expect(alert.ip).toBe(ip);
      expect(alert.type).toBe('suspicious_activity');
    });

    test('should track multiple user agents', () => {
      const requests = [
        { ...mockReq, headers: { 'user-agent': 'Bot1' } },
        { ...mockReq, headers: { 'user-agent': 'Bot2' } },
        { ...mockReq, headers: { 'user-agent': 'Bot3' } }
      ];
      
      requests.forEach(req => {
        for (let i = 0; i < 20; i++) {
          rateLimiter.detectAnomalies(req);
        }
      });
      
      const pattern = rateLimiter.anomalyDetection.patterns.get(mockReq.ip);
      expect(pattern.userAgents.size).toBe(3);
    });

    test('should clean old patterns', () => {
      const oldReq = { ...mockReq, ip: '10.0.0.1' };
      
      // Add old pattern
      rateLimiter.anomalyDetection.patterns.set('10.0.0.1', {
        requests: [Date.now() - 7200000], // 2 hours ago
        firstSeen: Date.now() - 7200000,
        countries: new Set(),
        userAgents: new Set(['OldBot'])
      });
      
      rateLimiter.analyzePatterns();
      
      expect(rateLimiter.anomalyDetection.patterns.has('10.0.0.1')).toBe(false);
    });
  });

  describe('Metrics and Statistics', () => {
    test('should provide comprehensive statistics', async () => {
      // Generate some activity
      await rateLimiter.checkRateLimit(mockReq, mockRes);
      
      const stats = rateLimiter.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalRequests).toBeGreaterThan(0);
      expect(stats.userCount).toBeGreaterThanOrEqual(0);
      expect(stats.redis).toBe('memory'); // We're using memory mode
      expect(typeof stats.anomalies).toBe('number');
    });

    test('should track user-specific statistics', async () => {
      await rateLimiter.checkRateLimit(mockReq, mockRes);
      
      const userStats = rateLimiter.getUserStats('test-user');
      
      expect(userStats).toBeDefined();
      expect(userStats.metrics).toBeDefined();
      expect(Array.isArray(userStats.metrics)).toBe(true);
    });

    test('should update user metrics correctly', async () => {
      rateLimiter.updateUserMetrics(mockReq, {
        processed: true,
        cost: 3,
        duration: 150
      });
      
      const key = rateLimiter.generateKey(mockReq, 'metrics');
      const metrics = rateLimiter.userMetrics.get(key);
      
      expect(metrics).toBeDefined();
      expect(metrics.requests).toBe(1);
      expect(metrics.totalCost).toBe(3);
      expect(metrics.avgLatency).toBe(150);
    });
  });

  describe('Concurrent Request Tracking', () => {
    test('should track concurrent requests', () => {
      const key = rateLimiter.generateKey(mockReq, 'concurrent');
      
      // Start requests
      rateLimiter.trackConcurrentRequest(mockReq, true);
      rateLimiter.trackConcurrentRequest(mockReq, true);
      
      expect(rateLimiter.concurrentRequests.get(key)).toBe(2);
      
      // End one request
      rateLimiter.trackConcurrentRequest(mockReq, false);
      
      expect(rateLimiter.concurrentRequests.get(key)).toBe(1);
    });

    test('should not go below zero concurrent requests', () => {
      const key = rateLimiter.generateKey(mockReq, 'concurrent');
      
      // Try to end more requests than started
      rateLimiter.trackConcurrentRequest(mockReq, false);
      rateLimiter.trackConcurrentRequest(mockReq, false);
      
      expect(rateLimiter.concurrentRequests.get(key)).toBe(0);
    });
  });

  describe('Administrative Functions', () => {
    test('should reset user limits', async () => {
      // Generate some activity
      await rateLimiter.checkRateLimit(mockReq, mockRes);
      
      const resetCount = await rateLimiter.resetUserLimits('test-user');
      
      expect(resetCount).toBeGreaterThanOrEqual(0);
    });

    test('should clean up expired data', () => {
      // Add some old data
      const oldKey = 'test:old:user';
      rateLimiter.userMetrics.set(oldKey, {
        requests: 10,
        lastSeen: Date.now() - 7200000 // 2 hours ago
      });
      
      rateLimiter.cleanup();
      
      expect(rateLimiter.userMetrics.has(oldKey)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle limiter errors gracefully', async () => {
      // Mock a failing limiter
      const failingLimiter = {
        consume: jest.fn().mockRejectedValue(new Error('Limiter failed'))
      };
      
      rateLimiter.limiters.set('failing', failingLimiter);
      
      try {
        await rateLimiter.checkRateLimit(mockReq, mockRes);
        // Should not throw, but handle gracefully
      } catch (error) {
        expect(rateLimiter.metrics.errors).toBeGreaterThan(0);
      }
    });

    test('should fail open when rate limiting fails', async () => {
      const middleware = rateLimiter.createMiddleware();
      
      // Mock checkRateLimit to fail
      const originalCheck = rateLimiter.checkRateLimit;
      rateLimiter.checkRateLimit = jest.fn().mockRejectedValue(new Error('System failure'));
      
      await middleware(mockReq, mockRes, mockNext);
      
      // Should call next (fail open)
      expect(mockNext).toHaveBeenCalled();
      
      // Restore original method
      rateLimiter.checkRateLimit = originalCheck;
    });
  });

  describe('Performance', () => {
    test('should handle many concurrent requests efficiently', async () => {
      const requests = Array.from({ length: 50 }, (_, i) => ({
        ...mockReq,
        user: { id: `user-${i}`, role: 'user', tier: 'test' }
      }));
      
      const startTime = Date.now();
      
      const promises = requests.map(req => 
        rateLimiter.checkRateLimit(req, mockRes)
      );
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      expect(results.length).toBe(50);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      
      results.forEach(result => {
        expect(result.allowed).toBe(true);
      });
    });

    test('should maintain performance with large datasets', () => {
      // Add many user metrics
      for (let i = 0; i < 1000; i++) {
        rateLimiter.userMetrics.set(`user:${i}`, {
          requests: Math.floor(Math.random() * 100),
          lastSeen: Date.now() - Math.random() * 3600000
        });
      }
      
      const startTime = Date.now();
      rateLimiter.cleanup();
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(100); // Cleanup should be fast
    });
  });
});