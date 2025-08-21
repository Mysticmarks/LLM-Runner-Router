/**
 * 🔧 Admin API Endpoints
 * Administrative functions for SaaS management
 */

import express from 'express';
import { getAPIKeyManager, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * Get all API keys (admin only)
 */
router.get('/keys', requireAdmin, async (req, res) => {
  try {
    const apiKeyManager = getAPIKeyManager();
    
    if (!apiKeyManager) {
      return res.status(500).json({ error: 'API key manager not initialized' });
    }

    const keys = apiKeyManager.listKeys();
    
    res.json({
      success: true,
      count: keys.length,
      keys
    });
  } catch (error) {
    console.error('Admin keys list error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new API key
 */
router.post('/keys', requireAdmin, async (req, res) => {
  try {
    const apiKeyManager = getAPIKeyManager();
    
    if (!apiKeyManager) {
      return res.status(500).json({ error: 'API key manager not initialized' });
    }

    const { name, email, tier = 'basic' } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Customer name required' });
    }

    const result = await apiKeyManager.createAPIKey({
      name,
      email,
      tier
    });

    res.json({
      success: true,
      message: 'API key created successfully',
      ...result,
      warning: 'This is the only time the full key will be shown'
    });
  } catch (error) {
    console.error('Admin key creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get usage statistics for a specific key
 */
router.get('/keys/:keyId/usage', requireAdmin, async (req, res) => {
  try {
    const apiKeyManager = getAPIKeyManager();
    
    if (!apiKeyManager) {
      return res.status(500).json({ error: 'API key manager not initialized' });
    }

    const { keyId } = req.params;
    const stats = apiKeyManager.getUsageStats(keyId);
    
    if (!stats) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({
      success: true,
      usage: stats
    });
  } catch (error) {
    console.error('Admin usage stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Deactivate an API key
 */
router.delete('/keys/:keyId', requireAdmin, async (req, res) => {
  try {
    const apiKeyManager = getAPIKeyManager();
    
    if (!apiKeyManager) {
      return res.status(500).json({ error: 'API key manager not initialized' });
    }

    const { keyId } = req.params;
    await apiKeyManager.deactivateKey(keyId);

    res.json({
      success: true,
      message: `API key ${keyId} deactivated`
    });
  } catch (error) {
    console.error('Admin key deactivation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get system statistics
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const apiKeyManager = getAPIKeyManager();
    
    if (!apiKeyManager) {
      return res.status(500).json({ error: 'API key manager not initialized' });
    }

    const keys = apiKeyManager.listKeys();
    
    // Calculate statistics
    const stats = {
      totalKeys: keys.length,
      activeKeys: keys.filter(k => k.active).length,
      inactiveKeys: keys.filter(k => !k.active).length,
      tierBreakdown: {
        basic: keys.filter(k => k.tier === 'basic').length,
        pro: keys.filter(k => k.tier === 'pro').length,
        enterprise: keys.filter(k => k.tier === 'enterprise').length
      },
      totalRequests: keys.reduce((sum, k) => sum + (k.totalRequests || 0), 0),
      totalTokens: keys.reduce((sum, k) => sum + (k.totalTokens || 0), 0),
      recentActivity: keys.filter(k => {
        if (!k.lastUsed) return false;
        const lastUsed = new Date(k.lastUsed);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return lastUsed > oneDayAgo;
      }).length
    };

    res.json({
      success: true,
      statistics: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update key tier
 */
router.patch('/keys/:keyId/tier', requireAdmin, async (req, res) => {
  try {
    const apiKeyManager = getAPIKeyManager();
    
    if (!apiKeyManager) {
      return res.status(500).json({ error: 'API key manager not initialized' });
    }

    const { keyId } = req.params;
    const { tier } = req.body;

    if (!['basic', 'pro', 'enterprise'].includes(tier)) {
      return res.status(400).json({ 
        error: 'Invalid tier. Must be: basic, pro, or enterprise' 
      });
    }

    // Get the key data
    const keyData = apiKeyManager.keys.get(keyId);
    
    if (!keyData) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Update tier and associated limits
    keyData.tier = tier;
    keyData.rateLimit = apiKeyManager.getRateLimitForTier(tier);
    keyData.quotas = apiKeyManager.getQuotasForTier(tier);

    await apiKeyManager.saveKeys();

    res.json({
      success: true,
      message: `Key ${keyId} upgraded to ${tier} tier`,
      newLimits: {
        tier,
        rateLimit: keyData.rateLimit,
        quotas: keyData.quotas
      }
    });
  } catch (error) {
    console.error('Admin tier update error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Reset usage statistics for a key
 */
router.post('/keys/:keyId/reset-usage', requireAdmin, async (req, res) => {
  try {
    const apiKeyManager = getAPIKeyManager();
    
    if (!apiKeyManager) {
      return res.status(500).json({ error: 'API key manager not initialized' });
    }

    const { keyId } = req.params;
    
    if (!apiKeyManager.usage.has(keyId)) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Reset usage statistics
    apiKeyManager.usage.set(keyId, {
      requestCount: 0,
      tokenCount: 0,
      lastReset: new Date().toISOString(),
      dailyUsage: {},
      monthlyUsage: {}
    });

    await apiKeyManager.saveKeys();

    res.json({
      success: true,
      message: `Usage statistics reset for key ${keyId}`
    });
  } catch (error) {
    console.error('Admin usage reset error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', requireAdmin, async (req, res) => {
  try {
    const apiKeyManager = getAPIKeyManager();
    
    res.json({
      success: true,
      status: 'healthy',
      components: {
        apiKeyManager: !!apiKeyManager,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

export default router;