/**
 * 🔗 Router Integration
 * Integration layer for enterprise features with the core Router
 * Echo AI Systems - Seamless enterprise feature integration
 */

import { EnterpriseManager } from './EnterpriseManager.js';
import { Logger } from '../utils/Logger.js';

const logger = new Logger('RouterIntegration');

/**
 * Enhanced Router with Enterprise Features
 */
class EnterpriseRouter {
  constructor(baseRouter, enterpriseConfig = {}) {
    this.baseRouter = baseRouter;
    this.enterpriseManager = new EnterpriseManager(enterpriseConfig);
    
    // Setup integration
    this.setupIntegration();
    
    logger.info('🔗 Enterprise Router initialized');
  }

  /**
   * Setup integration between router and enterprise features
   * @private
   */
  async setupIntegration() {
    // Integrate enterprise manager with router
    await this.enterpriseManager.integrateWithRouter(this.baseRouter);
    
    // Wrap router methods with enterprise functionality
    this.wrapRouterMethods();
    
    // Setup event forwarding
    this.setupEventForwarding();
  }

  /**
   * Wrap router methods with enterprise functionality
   * @private
   */
  wrapRouterMethods() {
    // Wrap selectModel method
    const originalSelectModel = this.baseRouter.selectModel.bind(this.baseRouter);
    this.baseRouter.selectModel = async (prompt, requirements = {}, context = {}) => {
      try {
        // Pre-process with enterprise features
        const { request, enhancedContext } = await this.enterpriseManager.processInferenceRequest(
          { prompt, requirements, modelId: requirements.preferredModel },
          context
        );

        // Call original method with potentially modified request
        const selectedModel = await originalSelectModel(request.prompt, request.requirements);

        // Post-process the model selection
        if (this.enterpriseManager.auditLogger) {
          await this.enterpriseManager.auditLogger.logModelOperation('selected', selectedModel.id, {
            userId: enhancedContext.userId,
            tenantId: enhancedContext.tenantId,
            strategy: this.baseRouter.config.strategy,
            requirements: request.requirements
          });
        }

        return selectedModel;

      } catch (error) {
        // Log error in audit logger
        if (this.enterpriseManager.auditLogger) {
          await this.enterpriseManager.auditLogger.logModelOperation('selection_failed', 'unknown', {
            userId: context.userId,
            tenantId: context.tenantId,
            error: error.message
          });
        }
        throw error;
      }
    };
  }

  /**
   * Setup event forwarding
   * @private
   */
  setupEventForwarding() {
    // Forward router events to enterprise manager
    this.baseRouter.on('model-selected', (event) => {
      this.enterpriseManager.emit('model-selected', event);
    });

    this.baseRouter.on('strategy-changed', (strategy) => {
      if (this.enterpriseManager.auditLogger) {
        this.enterpriseManager.auditLogger.logEvent('config.changed', {
          component: 'router',
          property: 'strategy',
          newValue: strategy
        });
      }
    });

    // Forward enterprise events
    this.enterpriseManager.on('security-violation', (violation) => {
      this.baseRouter.emit('security-violation', violation);
    });

    this.enterpriseManager.on('quota-exceeded', (event) => {
      this.baseRouter.emit('quota-exceeded', event);
    });
  }

  /**
   * Enhanced model selection with enterprise features
   */
  async selectModelEnterprise(prompt, requirements = {}, context = {}) {
    const startTime = Date.now();

    try {
      // 1. Authenticate if required
      if (context.token || context.apiKey) {
        const authResult = await this.enterpriseManager.authenticateRequest(
          { prompt, requirements },
          context
        );
        context.user = authResult.user;
        context.permissions = authResult.permissions;
      }

      // 2. Check tenant permissions
      if (context.tenantId && requirements.preferredModel) {
        await this.enterpriseManager.validateTenantAccess(
          context.tenantId,
          requirements.preferredModel
        );
      }

      // 3. Apply A/B testing variations
      if (context.userId && this.enterpriseManager.abTesting) {
        const experiments = await this.enterpriseManager.abTesting.assignUser(
          context.userId,
          context
        );
        
        // Modify routing strategy based on experiments
        for (const [experimentId, assignment] of experiments.entries()) {
          if (assignment.variant.routingStrategy) {
            this.baseRouter.setStrategy(assignment.variant.routingStrategy);
          }
        }
      }

      // 4. Select model using base router
      const selectedModel = await this.baseRouter.selectModel(prompt, requirements);

      // 5. Record metrics and events
      const duration = Date.now() - startTime;
      
      if (this.enterpriseManager.slaMonitor) {
        await this.enterpriseManager.slaMonitor.recordMetric(
          'router-service',
          'model_selection_time',
          duration
        );
      }

      if (this.enterpriseManager.auditLogger) {
        await this.enterpriseManager.auditLogger.logModelOperation('selected', selectedModel.id, {
          userId: context.userId,
          tenantId: context.tenantId,
          duration,
          strategy: this.baseRouter.config.strategy
        });
      }

      return {
        model: selectedModel,
        context: {
          ...context,
          selectionTime: duration,
          strategy: this.baseRouter.config.strategy
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      // Record failure metrics
      if (this.enterpriseManager.slaMonitor) {
        await this.enterpriseManager.slaMonitor.recordMetric(
          'router-service',
          'model_selection_errors',
          1
        );
      }

      // Audit log the failure
      if (this.enterpriseManager.auditLogger) {
        await this.enterpriseManager.auditLogger.logModelOperation('selection_failed', 'unknown', {
          userId: context.userId,
          tenantId: context.tenantId,
          duration,
          error: error.message
        });
      }

      throw error;
    }
  }

  /**
   * Process inference request with full enterprise integration
   */
  async processInference(prompt, options = {}, context = {}) {
    const startTime = Date.now();
    
    try {
      // Pre-process request
      const { request, enhancedContext } = await this.enterpriseManager.processInferenceRequest(
        { prompt, ...options },
        context
      );

      // Select model
      const { model, selectionContext } = await this.selectModelEnterprise(
        request.prompt,
        request.requirements || {},
        enhancedContext
      );

      // Simulate inference (this would integrate with actual model loading/inference)
      const response = await this.simulateInference(model, request, selectionContext);

      // Post-process response
      const finalResponse = await this.enterpriseManager.processInferenceResponse(
        response,
        enhancedContext
      );

      return finalResponse;

    } catch (error) {
      // Handle error with enterprise features
      await this.handleInferenceError(error, context);
      throw error;
    }
  }

  /**
   * Simulate inference (placeholder for actual inference integration)
   * @private
   */
  async simulateInference(model, request, context) {
    const startTime = Date.now();
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    const duration = Date.now() - startTime;
    const tokenCount = Math.floor(Math.random() * 500 + 100);
    
    return {
      modelId: model.id,
      model: model.name,
      response: `Generated response for: ${request.prompt.substring(0, 50)}...`,
      tokenCount,
      duration,
      success: true,
      metadata: {
        strategy: context.strategy,
        experiments: context.experiments
      }
    };
  }

  /**
   * Handle inference errors with enterprise features
   * @private
   */
  async handleInferenceError(error, context) {
    // Log security violation if authentication error
    if (error.message.includes('auth') || error.message.includes('permission')) {
      if (this.enterpriseManager.auditLogger) {
        await this.enterpriseManager.auditLogger.logSecurityViolation('access_denied', {
          userId: context.userId,
          tenantId: context.tenantId,
          error: error.message
        });
      }
    }

    // Record SLA breach for errors
    if (this.enterpriseManager.slaMonitor) {
      await this.enterpriseManager.slaMonitor.recordMetric(
        'inference-service',
        'error_rate',
        1
      );
    }
  }

  /**
   * Get enhanced router statistics
   */
  getEnhancedStats() {
    const baseStats = this.baseRouter.getStats();
    const enterpriseStatus = this.enterpriseManager.getStatus();
    
    return {
      ...baseStats,
      enterprise: enterpriseStatus,
      timestamp: new Date()
    };
  }

  /**
   * Create tenant-specific router instance
   */
  createTenantRouter(tenantId) {
    return {
      selectModel: async (prompt, requirements = {}) => {
        return this.selectModelEnterprise(prompt, requirements, { tenantId });
      },
      
      processInference: async (prompt, options = {}) => {
        return this.processInference(prompt, options, { tenantId });
      },
      
      getStats: () => {
        const stats = this.getEnhancedStats();
        stats.tenantId = tenantId;
        return stats;
      }
    };
  }

  /**
   * Create user-specific router instance
   */
  createUserRouter(userId, tenantId = null) {
    return {
      selectModel: async (prompt, requirements = {}) => {
        return this.selectModelEnterprise(prompt, requirements, { userId, tenantId });
      },
      
      processInference: async (prompt, options = {}) => {
        return this.processInference(prompt, options, { userId, tenantId });
      },
      
      getStats: () => {
        const stats = this.getEnhancedStats();
        stats.userId = userId;
        stats.tenantId = tenantId;
        return stats;
      }
    };
  }

  /**
   * Setup SLA definitions for router services
   */
  async setupRouterSLAs() {
    if (!this.enterpriseManager.slaMonitor) return;

    // Model selection SLA
    await this.enterpriseManager.slaMonitor.defineSLA({
      serviceName: 'router-service',
      description: 'Model selection performance SLA',
      targets: {
        model_selection_time: {
          threshold: 500, // 500ms
          operator: 'less_than',
          timeWindow: '1m'
        },
        model_selection_errors: {
          threshold: 0.01, // 1% error rate
          operator: 'less_than',
          timeWindow: '5m'
        }
      }
    });

    // Inference SLA
    await this.enterpriseManager.slaMonitor.defineSLA({
      serviceName: 'inference-service',
      description: 'Model inference performance SLA',
      targets: {
        response_time: {
          threshold: 2000, // 2 seconds
          operator: 'less_than',
          timeWindow: '1m'
        },
        error_rate: {
          threshold: 0.05, // 5% error rate
          operator: 'less_than',
          timeWindow: '5m'
        }
      }
    });

    logger.info('📊 Router SLAs configured');
  }

  /**
   * Start enterprise router
   */
  async start() {
    await this.enterpriseManager.start();
    await this.setupRouterSLAs();
    
    logger.info('🚀 Enterprise Router started');
  }

  /**
   * Stop enterprise router
   */
  async stop() {
    await this.enterpriseManager.stop();
    
    logger.info('🛑 Enterprise Router stopped');
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.enterpriseManager.cleanup();
    
    logger.info('🧹 Enterprise Router cleaned up');
  }

  // Proxy methods to base router
  get config() {
    return this.baseRouter.config;
  }

  get stats() {
    return this.getEnhancedStats();
  }

  setStrategy(strategy) {
    return this.baseRouter.setStrategy(strategy);
  }

  getStrategies() {
    return this.baseRouter.getStrategies();
  }

  // Proxy methods to enterprise manager
  get multiTenancy() {
    return this.enterpriseManager.multiTenancy;
  }

  get abTesting() {
    return this.enterpriseManager.abTesting;
  }

  get auditLogger() {
    return this.enterpriseManager.auditLogger;
  }

  get slaMonitor() {
    return this.enterpriseManager.slaMonitor;
  }

  get auth() {
    return this.enterpriseManager.auth;
  }
}

export default EnterpriseRouter;
export { EnterpriseRouter };