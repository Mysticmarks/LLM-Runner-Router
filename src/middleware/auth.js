/**
 * 🛡️ Authentication Middleware for SaaS API
 * Express middleware for API key validation and rate limiting
 */

import { APIKeyManager } from '../auth/APIKeyManager.js';
import rateLimit from 'express-rate-limit';
import { RateLimiterRedis } from 'rate-limiter-flexible';

// Global API key manager instance
let apiKeyManager = null;

/**
 * Initialize authentication system
 */
export async function initializeAuth(options = {}) {
  apiKeyManager = new APIKeyManager(options);
  await apiKeyManager.initialize();
  console.log('🛡️ Authentication system initialized');
  return apiKeyManager;
}

/**
 * Middleware to validate API keys
 */
export function requireAPIKey(req, res, next) {
  if (!apiKeyManager) {
    return res.status(500).json({ 
      error: 'Authentication system not initialized' 
    });
  }

  // Extract API key from headers
  const authHeader = req.headers.authorization;
  const apiKey = authHeader?.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      message: 'Provide API key via Authorization: Bearer <key> or X-API-Key header'
    });
  }

  // Validate the API key
  apiKeyManager.validateKey(apiKey)
    .then(validation => {
      if (!validation.valid) {
        return res.status(401).json({
          error: 'Invalid API key',
          message: validation.error
        });
      }

      // Add authentication info to request
      req.auth = {
        keyId: validation.keyId,
        customer: validation.customer,
        tier: validation.tier,
        rateLimit: validation.rateLimit,
        quotas: validation.quotas
      };

      next();
    })
    .catch(error => {
      console.error('Auth validation error:', error);
      res.status(500).json({
        error: 'Authentication error',
        message: 'Internal server error during authentication'
      });
    });
}

/**
 * Middleware to check rate limits
 */
export function checkRateLimit(req, res, next) {
  if (!req.auth || !apiKeyManager) {
    return next();
  }

  apiKeyManager.checkRateLimit(req.auth.keyId)
    .then(result => {
      if (!result.allowed) {
        const headers = {
          'X-RateLimit-Limit': req.auth.quotas.dailyRequests,
          'X-RateLimit-Remaining': 0,
          'X-RateLimit-Reset': result.reset ? Math.floor(result.reset.getTime() / 1000) : null
        };

        return res.status(429)
          .set(headers)
          .json({
            error: 'Rate limit exceeded',
            message: result.error,
            resetTime: result.reset
          });
      }

      // Add rate limit headers
      const stats = apiKeyManager.getUsageStats(req.auth.keyId);
      if (stats) {
        const remaining = Math.max(0, stats.quotas.dailyRequests - stats.usage.today.requests);
        res.set({
          'X-RateLimit-Limit': stats.quotas.dailyRequests,
          'X-RateLimit-Remaining': remaining,
          'X-RateLimit-Used': stats.usage.today.requests
        });
      }

      next();
    })
    .catch(error => {
      console.error('Rate limit check error:', error);
      next(); // Continue on error
    });
}

/**
 * Middleware to record API usage
 */
export function recordUsage(req, res, next) {
  if (!req.auth || !apiKeyManager) {
    return next();
  }

  // Wrap res.json to capture response and record usage
  const originalJson = res.json;
  res.json = function(data) {
    // Estimate token count (rough approximation)
    const responseText = JSON.stringify(data);
    const estimatedTokens = Math.ceil(responseText.length / 4);
    
    // Record usage asynchronously
    apiKeyManager.recordUsage(req.auth.keyId, estimatedTokens)
      .catch(error => console.error('Usage recording error:', error));

    return originalJson.call(this, data);
  };

  next();
}

/**
 * Admin middleware - requires special admin key
 */
export function requireAdmin(req, res, next) {
  const adminKey = process.env.ADMIN_API_KEY;
  
  if (!adminKey) {
    return res.status(500).json({
      error: 'Admin functionality not configured'
    });
  }

  const providedKey = req.headers['x-admin-key'];
  
  if (!providedKey || providedKey !== adminKey) {
    return res.status(403).json({
      error: 'Admin access required'
    });
  }

  next();
}

/**
 * Create tier-specific rate limiters
 */
export function createTierRateLimiter(tier = 'basic') {
  const limits = {
    basic: { windowMs: 60 * 1000, max: 60 }, // 60 requests per minute
    pro: { windowMs: 60 * 1000, max: 300 },   // 300 requests per minute  
    enterprise: { windowMs: 60 * 1000, max: 1000 } // 1000 requests per minute
  };

  const config = limits[tier] || limits.basic;

  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: {
      error: 'Too many requests',
      message: `Rate limit exceeded for ${tier} tier`,
      retryAfter: Math.ceil(config.windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.auth?.keyId || req.ip
  });
}

/**
 * Dynamic rate limiter based on user tier
 */
export function dynamicRateLimit(req, res, next) {
  if (!req.auth) {
    // Apply basic rate limiting for unauthenticated requests
    return createTierRateLimiter('basic')(req, res, next);
  }

  const tierLimiter = createTierRateLimiter(req.auth.tier);
  return tierLimiter(req, res, next);
}

/**
 * Middleware to add CORS headers for SaaS API
 */
export function enableCORS(req, res, next) {
  // Allow requests from any origin for public API
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Admin-Key');
  res.header('Access-Control-Expose-Headers', 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
}

/**
 * Error handling middleware for authentication
 */
export function authErrorHandler(err, req, res, next) {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired authentication credentials'
    });
  }

  if (err.name === 'RateLimitError') {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests, please try again later'
    });
  }

  next(err);
}

/**
 * Get the API key manager instance
 */
export function getAPIKeyManager() {
  return apiKeyManager;
}

export default {
  initializeAuth,
  requireAPIKey,
  checkRateLimit,
  recordUsage,
  requireAdmin,
  createTierRateLimiter,
  dynamicRateLimit,
  enableCORS,
  authErrorHandler,
  getAPIKeyManager
};