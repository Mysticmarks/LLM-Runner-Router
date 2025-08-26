/**
 * 🔑 BYOK Middleware
 * Handles Bring Your Own Key authentication and routing
 * Echo AI Systems - Universal Access
 */

import { BYOKManager } from '../auth/BYOKManager.js';
import { Logger } from '../utils/Logger.js';

const logger = new Logger('BYOKMiddleware');

let byokManager = null;

/**
 * Initialize BYOK system
 */
export async function initializeBYOK(options = {}) {
  byokManager = new BYOKManager(options);
  await byokManager.initialize();
  logger.info('🔑 BYOK system initialized');
  return byokManager;
}

/**
 * Middleware to inject BYOK keys into request
 */
export function injectBYOKKeys(req, res, next) {
  if (!byokManager) {
    req.byok = null;
    return next();
  }

  // Extract user/group context from auth
  const userId = req.auth?.keyId || req.headers['x-user-id'];
  const groupId = req.auth?.groupId || req.headers['x-group-id'];
  const requestedProvider = req.headers['x-llm-provider'] || req.body?.provider;

  if (!userId && !groupId) {
    req.byok = null;
    return next();
  }

  // Attach BYOK context to request
  req.byok = {
    userId,
    groupId,
    requestedProvider,
    manager: byokManager,
    getKey: async (provider) => {
      return byokManager.getUserKey(userId, provider || requestedProvider, groupId);
    },
    getProviders: async () => {
      return byokManager.getUserProviders(userId, groupId);
    }
  };

  next();
}

/**
 * REST API endpoints for BYOK management
 */
export function createBYOKRoutes(router) {
  // List supported providers
  router.get('/byok/providers', (req, res) => {
    const providers = byokManager.getSupportedProviders();
    res.json({
      success: true,
      providers
    });
  });

  // Get user's providers
  router.get('/byok/keys', requireAuth, async (req, res) => {
    try {
      const userId = req.auth.keyId;
      const groupId = req.auth.groupId;
      
      const providers = await byokManager.getUserProviders(userId, groupId);
      
      res.json({
        success: true,
        userId,
        groupId,
        providers
      });
    } catch (error) {
      logger.error('Failed to get user providers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve providers'
      });
    }
  });

  // Add/Update user key
  router.post('/byok/keys/:provider', requireAuth, async (req, res) => {
    try {
      const userId = req.auth.keyId;
      const provider = req.params.provider;
      const { apiKey, name, description } = req.body;

      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: 'API key is required'
        });
      }

      const result = await byokManager.setUserKey(userId, provider, apiKey, {
        name,
        description
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Failed to set user key:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Remove user key
  router.delete('/byok/keys/:provider', requireAuth, async (req, res) => {
    try {
      const userId = req.auth.keyId;
      const provider = req.params.provider;

      const removed = await byokManager.removeUserKey(userId, provider);

      if (!removed) {
        return res.status(404).json({
          success: false,
          error: 'Key not found'
        });
      }

      res.json({
        success: true,
        message: `Removed ${provider} key`
      });
    } catch (error) {
      logger.error('Failed to remove user key:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove key'
      });
    }
  });

  // Group management (admin only)
  router.post('/byok/groups/:groupId/keys/:provider', requireAuth, requireAdmin, async (req, res) => {
    try {
      const groupId = req.params.groupId;
      const provider = req.params.provider;
      const { apiKey, name, description, allowedUsers, sharedBy } = req.body;

      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: 'API key is required'
        });
      }

      const result = await byokManager.setGroupKey(groupId, provider, apiKey, {
        name,
        description,
        allowedUsers,
        sharedBy: sharedBy || req.auth.keyId
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Failed to set group key:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Add user to group
  router.post('/byok/groups/:groupId/users/:userId', requireAuth, requireAdmin, async (req, res) => {
    try {
      const groupId = req.params.groupId;
      const userId = req.params.userId;

      await byokManager.addUserToGroup(userId, groupId);

      res.json({
        success: true,
        message: `Added user ${userId} to group ${groupId}`
      });
    } catch (error) {
      logger.error('Failed to add user to group:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add user to group'
      });
    }
  });

  // Remove user from group
  router.delete('/byok/groups/:groupId/users/:userId', requireAuth, requireAdmin, async (req, res) => {
    try {
      const groupId = req.params.groupId;
      const userId = req.params.userId;

      await byokManager.removeUserFromGroup(userId, groupId);

      res.json({
        success: true,
        message: `Removed user ${userId} from group ${groupId}`
      });
    } catch (error) {
      logger.error('Failed to remove user from group:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove user from group'
      });
    }
  });

  // Get usage statistics
  router.get('/byok/stats', requireAuth, async (req, res) => {
    try {
      const userId = req.auth.keyId;
      const groupId = req.auth.groupId;

      const stats = await byokManager.getUsageStats(userId, groupId);

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('Failed to get usage stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve statistics'
      });
    }
  });

  // Validate all keys (admin only)
  router.post('/byok/validate', requireAuth, requireAdmin, async (req, res) => {
    try {
      const results = await byokManager.validateStoredKeys();

      res.json({
        success: true,
        validationResults: results
      });
    } catch (error) {
      logger.error('Failed to validate keys:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate keys'
      });
    }
  });

  return router;
}

/**
 * Helper middleware to require authentication
 */
function requireAuth(req, res, next) {
  if (!req.auth) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  next();
}

/**
 * Helper middleware to require admin privileges
 */
function requireAdmin(req, res, next) {
  if (req.auth?.tier !== 'enterprise' && req.auth?.tier !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin privileges required'
    });
  }
  next();
}

/**
 * Get the BYOK manager instance
 */
export function getBYOKManager() {
  return byokManager;
}

/**
 * BYOK-aware model loading middleware
 */
export async function loadWithBYOK(req, res, next) {
  if (!req.byok) {
    return next();
  }

  const provider = req.body?.provider || req.query?.provider;
  
  if (!provider) {
    return next();
  }

  try {
    // Try to get BYOK key for the provider
    const byokKey = await req.byok.getKey(provider);
    
    if (byokKey) {
      // Attach BYOK key to request for model loaders to use
      req.providerKey = byokKey;
      req.isBYOK = true;
      
      logger.info(`🔑 Using BYOK key for ${provider}`);
    }
  } catch (error) {
    logger.warn(`Failed to load BYOK key for ${provider}:`, error);
  }

  next();
}

export default {
  initializeBYOK,
  injectBYOKKeys,
  createBYOKRoutes,
  getBYOKManager,
  loadWithBYOK
};