/**
 * 🌐 API Integration
 * Enterprise API routes and middleware for Express/Fastify integration
 * Echo AI Systems - RESTful enterprise feature access
 */

import { Logger } from '../utils/Logger.js';

const logger = new Logger('APIIntegration');

/**
 * Create enterprise API routes for Express
 */
export function createEnterpriseExpressRoutes(app, enterpriseManager) {
  // Authentication middleware
  const authenticateMiddleware = async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const apiKey = req.headers['x-api-key'];

      if (token) {
        const authResult = await enterpriseManager.auth.validateToken(token);
        req.user = authResult.user;
        req.permissions = authResult.permissions;
      } else if (apiKey) {
        const authResult = await enterpriseManager.auth.validateAPIKey(apiKey, {
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        req.user = authResult.user;
        req.permissions = authResult.permissions;
      }

      next();
    } catch (error) {
      res.status(401).json({
        error: 'Unauthorized',
        message: error.message
      });
    }
  };

  // Permission check middleware
  const requirePermission = (permission) => {
    return async (req, res, next) => {
      if (!req.permissions) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const hasPermission = await enterpriseManager.auth.checkPermission(
        { permissions: req.permissions },
        permission
      );

      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  };

  // Audit logging middleware
  const auditMiddleware = (action) => {
    return async (req, res, next) => {
      if (enterpriseManager.auditLogger) {
        await enterpriseManager.auditLogger.logEvent(action, {
          userId: req.user?.id,
          method: req.method,
          url: req.url,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
      }
      next();
    };
  };

  // Multi-tenancy routes
  if (enterpriseManager.multiTenancy) {
    // Get all tenants
    app.get('/api/enterprise/tenants', 
      authenticateMiddleware,
      requirePermission('tenant:view'),
      auditMiddleware('tenant.list'),
      async (req, res) => {
        try {
          const tenants = enterpriseManager.multiTenancy.listTenants(req.query);
          res.json(tenants);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    // Create tenant
    app.post('/api/enterprise/tenants',
      authenticateMiddleware,
      requirePermission('tenant:create'),
      auditMiddleware('tenant.create'),
      async (req, res) => {
        try {
          const tenant = await enterpriseManager.multiTenancy.createTenant(req.body);
          res.status(201).json(tenant);
        } catch (error) {
          res.status(400).json({ error: error.message });
        }
      }
    );

    // Get specific tenant
    app.get('/api/enterprise/tenants/:id',
      authenticateMiddleware,
      requirePermission('tenant:view'),
      async (req, res) => {
        try {
          const tenant = enterpriseManager.multiTenancy.getTenant(req.params.id);
          if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
          }
          res.json(tenant);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    // Update tenant
    app.put('/api/enterprise/tenants/:id',
      authenticateMiddleware,
      requirePermission('tenant:update'),
      auditMiddleware('tenant.update'),
      async (req, res) => {
        try {
          const tenant = await enterpriseManager.multiTenancy.updateTenant(
            req.params.id,
            req.body
          );
          res.json(tenant);
        } catch (error) {
          res.status(400).json({ error: error.message });
        }
      }
    );

    // Get tenant usage
    app.get('/api/enterprise/tenants/:id/usage',
      authenticateMiddleware,
      requirePermission('tenant:view'),
      async (req, res) => {
        try {
          const usage = enterpriseManager.multiTenancy.getTenantUsage(
            req.params.id,
            req.query.timeframe
          );
          res.json(usage);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    // Generate billing report
    app.get('/api/enterprise/tenants/:id/billing',
      authenticateMiddleware,
      requirePermission('tenant:view'),
      async (req, res) => {
        try {
          const startDate = new Date(req.query.startDate);
          const endDate = new Date(req.query.endDate);
          
          const report = enterpriseManager.multiTenancy.generateBillingReport(
            req.params.id,
            startDate,
            endDate
          );
          res.json(report);
        } catch (error) {
          res.status(400).json({ error: error.message });
        }
      }
    );
  }

  // A/B Testing routes
  if (enterpriseManager.abTesting) {
    // Get experiments
    app.get('/api/enterprise/experiments',
      authenticateMiddleware,
      requirePermission('experiment:view'),
      async (req, res) => {
        try {
          const experiments = enterpriseManager.abTesting.listExperiments(req.query);
          res.json(experiments);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    // Create experiment
    app.post('/api/enterprise/experiments',
      authenticateMiddleware,
      requirePermission('experiment:create'),
      auditMiddleware('experiment.create'),
      async (req, res) => {
        try {
          const experiment = await enterpriseManager.abTesting.createExperiment(req.body);
          res.status(201).json(experiment);
        } catch (error) {
          res.status(400).json({ error: error.message });
        }
      }
    );

    // Start experiment
    app.post('/api/enterprise/experiments/:id/start',
      authenticateMiddleware,
      requirePermission('experiment:manage'),
      auditMiddleware('experiment.start'),
      async (req, res) => {
        try {
          const experiment = await enterpriseManager.abTesting.startExperiment(req.params.id);
          res.json(experiment);
        } catch (error) {
          res.status(400).json({ error: error.message });
        }
      }
    );

    // Stop experiment
    app.post('/api/enterprise/experiments/:id/stop',
      authenticateMiddleware,
      requirePermission('experiment:manage'),
      auditMiddleware('experiment.stop'),
      async (req, res) => {
        try {
          const experiment = await enterpriseManager.abTesting.stopExperiment(
            req.params.id,
            req.body.reason
          );
          res.json(experiment);
        } catch (error) {
          res.status(400).json({ error: error.message });
        }
      }
    );

    // Get experiment results
    app.get('/api/enterprise/experiments/:id/results',
      authenticateMiddleware,
      requirePermission('experiment:view'),
      async (req, res) => {
        try {
          const results = await enterpriseManager.abTesting.getExperimentResults(req.params.id);
          res.json(results);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    // Feature flags
    app.get('/api/enterprise/feature-flags',
      authenticateMiddleware,
      requirePermission('feature_flag:view'),
      async (req, res) => {
        try {
          const flags = Array.from(enterpriseManager.abTesting.featureFlags.values());
          res.json(flags);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    // Evaluate feature flag
    app.get('/api/enterprise/feature-flags/:id/evaluate',
      authenticateMiddleware,
      async (req, res) => {
        try {
          const result = await enterpriseManager.abTesting.evaluateFeatureFlag(
            req.params.id,
            req.user.id,
            req.query
          );
          res.json({ result });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );
  }

  // SLA Monitoring routes
  if (enterpriseManager.slaMonitor) {
    // Get SLA definitions
    app.get('/api/enterprise/slas',
      authenticateMiddleware,
      requirePermission('sla:view'),
      async (req, res) => {
        try {
          const slas = Array.from(enterpriseManager.slaMonitor.slaDefinitions.values());
          res.json(slas);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    // Create SLA
    app.post('/api/enterprise/slas',
      authenticateMiddleware,
      requirePermission('sla:create'),
      auditMiddleware('sla.create'),
      async (req, res) => {
        try {
          const sla = await enterpriseManager.slaMonitor.defineSLA(req.body);
          res.status(201).json(sla);
        } catch (error) {
          res.status(400).json({ error: error.message });
        }
      }
    );

    // Get SLA status
    app.get('/api/enterprise/slas/:serviceName/status',
      authenticateMiddleware,
      requirePermission('sla:view'),
      async (req, res) => {
        try {
          const status = await enterpriseManager.slaMonitor.getSLAStatus(req.params.serviceName);
          res.json(status);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    // Get aggregated metrics
    app.get('/api/enterprise/metrics/:serviceName/:metricType',
      authenticateMiddleware,
      requirePermission('metrics:view'),
      async (req, res) => {
        try {
          const metrics = await enterpriseManager.slaMonitor.getAggregatedMetrics(
            req.params.serviceName,
            req.params.metricType,
            req.query.timeWindow
          );
          res.json(metrics);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    // Generate SLA report
    app.get('/api/enterprise/slas/report',
      authenticateMiddleware,
      requirePermission('sla:view'),
      async (req, res) => {
        try {
          const startDate = new Date(req.query.startDate);
          const endDate = new Date(req.query.endDate);
          
          const report = await enterpriseManager.slaMonitor.generateSLAReport(
            req.query.serviceName,
            startDate,
            endDate
          );
          res.json(report);
        } catch (error) {
          res.status(400).json({ error: error.message });
        }
      }
    );

    // Get breach history
    app.get('/api/enterprise/slas/breaches',
      authenticateMiddleware,
      requirePermission('sla:view'),
      async (req, res) => {
        try {
          const breaches = enterpriseManager.slaMonitor.getBreachHistory(
            req.query.serviceName,
            req.query.startDate ? new Date(req.query.startDate) : null,
            req.query.endDate ? new Date(req.query.endDate) : null
          );
          res.json(breaches);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );
  }

  // Audit Logging routes
  if (enterpriseManager.auditLogger) {
    // Query audit events
    app.get('/api/enterprise/audit/events',
      authenticateMiddleware,
      requirePermission('audit:view'),
      async (req, res) => {
        try {
          const criteria = {
            startDate: req.query.startDate ? new Date(req.query.startDate) : null,
            endDate: req.query.endDate ? new Date(req.query.endDate) : null,
            eventType: req.query.eventType,
            userId: req.query.userId,
            riskLevel: req.query.riskLevel,
            category: req.query.category,
            limit: parseInt(req.query.limit) || 100,
            offset: parseInt(req.query.offset) || 0
          };

          const result = await enterpriseManager.auditLogger.queryEvents(criteria);
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    // Export audit logs
    app.get('/api/enterprise/audit/export',
      authenticateMiddleware,
      requirePermission('audit:export'),
      auditMiddleware('audit.export'),
      async (req, res) => {
        try {
          const format = req.query.format || 'json';
          const criteria = {
            startDate: req.query.startDate ? new Date(req.query.startDate) : null,
            endDate: req.query.endDate ? new Date(req.query.endDate) : null,
            eventType: req.query.eventType,
            userId: req.query.userId
          };

          const exported = await enterpriseManager.auditLogger.exportLogs(format, criteria);
          
          res.setHeader('Content-Type', 
            format === 'csv' ? 'text/csv' : 
            format === 'xml' ? 'application/xml' : 'application/json'
          );
          res.setHeader('Content-Disposition', `attachment; filename=audit-logs.${format}`);
          res.send(exported);
        } catch (error) {
          res.status(400).json({ error: error.message });
        }
      }
    );

    // Verify audit integrity
    app.get('/api/enterprise/audit/integrity',
      authenticateMiddleware,
      requirePermission('audit:admin'),
      async (req, res) => {
        try {
          const verification = await enterpriseManager.auditLogger.verifyIntegrity();
          res.json(verification);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    // Generate compliance report
    app.get('/api/enterprise/audit/compliance/:framework',
      authenticateMiddleware,
      requirePermission('audit:view'),
      async (req, res) => {
        try {
          const startDate = new Date(req.query.startDate);
          const endDate = new Date(req.query.endDate);
          
          const report = await enterpriseManager.auditLogger.generateComplianceReport(
            req.params.framework,
            startDate,
            endDate
          );
          res.json(report);
        } catch (error) {
          res.status(400).json({ error: error.message });
        }
      }
    );

    // Get audit statistics
    app.get('/api/enterprise/audit/stats',
      authenticateMiddleware,
      requirePermission('audit:view'),
      async (req, res) => {
        try {
          const stats = enterpriseManager.auditLogger.getStatistics();
          res.json(stats);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );
  }

  // Authentication routes
  if (enterpriseManager.auth) {
    // Login
    app.post('/api/enterprise/auth/login',
      auditMiddleware('auth.login_attempt'),
      async (req, res) => {
        try {
          const { identifier, password, mfaToken } = req.body;
          
          const result = await enterpriseManager.auth.authenticate(
            identifier,
            password,
            { 
              mfaToken,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent')
            }
          );

          res.json(result);
        } catch (error) {
          res.status(401).json({ error: error.message });
        }
      }
    );

    // Refresh token
    app.post('/api/enterprise/auth/refresh',
      async (req, res) => {
        try {
          const { refreshToken } = req.body;
          const result = await enterpriseManager.auth.refreshToken(refreshToken);
          res.json(result);
        } catch (error) {
          res.status(401).json({ error: error.message });
        }
      }
    );

    // Logout
    app.post('/api/enterprise/auth/logout',
      authenticateMiddleware,
      auditMiddleware('auth.logout'),
      async (req, res) => {
        try {
          // Extract session ID from token (simplified)
          const sessionId = req.headers['x-session-id'] || 'unknown';
          await enterpriseManager.auth.logout(sessionId);
          res.json({ message: 'Logged out successfully' });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    // User management
    app.get('/api/enterprise/users',
      authenticateMiddleware,
      requirePermission('user:view'),
      async (req, res) => {
        try {
          const users = Array.from(enterpriseManager.auth.users.values())
            .map(user => ({ ...user, passwordHash: undefined, mfaSecret: undefined }));
          res.json(users);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    // Create user
    app.post('/api/enterprise/users',
      authenticateMiddleware,
      requirePermission('user:create'),
      auditMiddleware('user.create'),
      async (req, res) => {
        try {
          const user = await enterpriseManager.auth.registerUser(req.body);
          res.status(201).json(user);
        } catch (error) {
          res.status(400).json({ error: error.message });
        }
      }
    );

    // API key management
    app.get('/api/enterprise/api-keys',
      authenticateMiddleware,
      requirePermission('api_key:view'),
      async (req, res) => {
        try {
          const apiKeys = Array.from(enterpriseManager.auth.apiKeys.values())
            .filter(key => key.userId === req.user.id)
            .map(key => ({ ...key, key: undefined })); // Hide actual key
          res.json(apiKeys);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    // Create API key
    app.post('/api/enterprise/api-keys',
      authenticateMiddleware,
      requirePermission('api_key:create'),
      auditMiddleware('api_key.create'),
      async (req, res) => {
        try {
          const apiKey = await enterpriseManager.auth.createAPIKey(req.user.id, req.body);
          res.status(201).json(apiKey);
        } catch (error) {
          res.status(400).json({ error: error.message });
        }
      }
    );
  }

  // Dashboard route
  app.get('/api/enterprise/dashboard',
    authenticateMiddleware,
    requirePermission('dashboard:view'),
    async (req, res) => {
      try {
        const dashboard = await enterpriseManager.getDashboardData();
        res.json(dashboard);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Health check
  app.get('/api/enterprise/health',
    async (req, res) => {
      try {
        const status = enterpriseManager.getStatus();
        res.json({
          status: 'healthy',
          timestamp: new Date(),
          enterprise: status
        });
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          error: error.message
        });
      }
    }
  );

  logger.info('🌐 Enterprise API routes configured');
}

/**
 * Create enterprise WebSocket handlers
 */
export function createEnterpriseWebSocketHandlers(io, enterpriseManager) {
  io.on('connection', (socket) => {
    logger.debug('Client connected to enterprise WebSocket');

    // Authentication
    socket.on('authenticate', async (data) => {
      try {
        const { token, apiKey } = data;
        
        let authResult;
        if (token) {
          authResult = await enterpriseManager.auth.validateToken(token);
        } else if (apiKey) {
          authResult = await enterpriseManager.auth.validateAPIKey(apiKey);
        } else {
          throw new Error('No authentication provided');
        }

        socket.user = authResult.user;
        socket.permissions = authResult.permissions;
        socket.emit('authenticated', { user: authResult.user });

      } catch (error) {
        socket.emit('authentication_error', { error: error.message });
      }
    });

    // Real-time SLA monitoring
    socket.on('subscribe_sla_monitoring', (data) => {
      if (!socket.user) {
        return socket.emit('error', { message: 'Authentication required' });
      }

      socket.join('sla_monitoring');
    });

    // Real-time audit events
    socket.on('subscribe_audit_events', (data) => {
      if (!socket.user) {
        return socket.emit('error', { message: 'Authentication required' });
      }

      socket.join('audit_events');
    });

    socket.on('disconnect', () => {
      logger.debug('Client disconnected from enterprise WebSocket');
    });
  });

  // Forward enterprise events to WebSocket clients
  if (enterpriseManager.slaMonitor) {
    enterpriseManager.slaMonitor.on('sla-breach', (breach) => {
      io.to('sla_monitoring').emit('sla_breach', breach);
    });

    enterpriseManager.slaMonitor.on('alert-triggered', (alert) => {
      io.to('sla_monitoring').emit('alert_triggered', alert);
    });
  }

  if (enterpriseManager.auditLogger) {
    enterpriseManager.auditLogger.on('security-violation', (violation) => {
      io.to('audit_events').emit('security_violation', violation);
    });
  }

  if (enterpriseManager.multiTenancy) {
    enterpriseManager.multiTenancy.on('quota-exceeded', (event) => {
      io.to('audit_events').emit('quota_exceeded', event);
    });
  }

  logger.info('🔌 Enterprise WebSocket handlers configured');
}

export default {
  createEnterpriseExpressRoutes,
  createEnterpriseWebSocketHandlers
};