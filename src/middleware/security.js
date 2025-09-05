/**
 * 🛡️ Security Middleware for Production SaaS
 * Additional security layers for the LLM Router API
 */

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

/**
 * Apply security headers using Helmet
 */
export function securityHeaders() {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    
    // HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    
    // Hide X-Powered-By header
    hidePoweredBy: true,
    
    // Prevent clickjacking
    frameguard: { action: 'deny' },
    
    // Prevent MIME sniffing
    noSniff: true,
    
    // Referrer Policy
    referrerPolicy: { policy: 'same-origin' }
  });
}

/**
 * Global rate limiting (before authentication)
 */
export function globalRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: {
      error: 'Too many requests from this IP',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for health checks
    skip: (req) => req.path === '/api/health'
  });
}

/**
 * Strict rate limiting for auth endpoints
 */
export function authRateLimit() {
  return rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // Limit each IP to 5 auth attempts per 5 minutes
    message: {
      error: 'Too many authentication attempts',
      retryAfter: '5 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
}

/**
 * Input validation and sanitization
 */
export function validateInput(req, res, next) {
  // Remove potentially dangerous characters
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  next();
}

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (typeof item === 'string') {
        return item
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      }
      if (typeof item === 'object') {
        return sanitizeObject(item);
      }
      return item;
    });
  }

  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip potentially dangerous properties
    if (key.startsWith('__') || key.includes('prototype')) {
      continue;
    }

    if (typeof value === 'string') {
      // Remove potential script tags and other dangerous content
      sanitized[key] = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Request logging for security monitoring
 */
export function securityLogger(req, res, next) {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  // Log suspicious requests
  const suspicious = checkSuspiciousRequest(req);
  
  if (suspicious.isSuspicious) {
    console.warn(`🚨 SUSPICIOUS REQUEST: ${timestamp}`, {
      ip,
      method: req.method,
      url: req.url,
      userAgent,
      reason: suspicious.reason,
      headers: req.headers
    });
  }
  
  // Log all admin requests
  if (req.path.startsWith('/api/admin/')) {
    console.log(`🔐 ADMIN REQUEST: ${timestamp}`, {
      ip,
      method: req.method,
      url: req.url,
      hasAdminKey: !!req.headers['x-admin-key']
    });
  }
  
  next();
}

/**
 * Check for suspicious request patterns
 */
function checkSuspiciousRequest(req) {
  const suspiciousPatterns = [
    /\.\.\//, // Directory traversal
    /\/etc\/passwd/, // System file access
    /<script/i, // XSS attempts
    /union\s+select/i, // SQL injection
    /\bexec\b/i, // Command injection
    /\beval\b/i, // Code injection
  ];
  
  const checkString = `${req.url} ${JSON.stringify(req.body)} ${JSON.stringify(req.query)}`;
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(checkString)) {
      return {
        isSuspicious: true,
        reason: `Matched pattern: ${pattern}`
      };
    }
  }
  
  // Check for unusual request methods
  if (!['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'].includes(req.method)) {
    return {
      isSuspicious: true,
      reason: `Unusual HTTP method: ${req.method}`
    };
  }
  
  return { isSuspicious: false };
}

/**
 * Hide sensitive information in error responses
 */
export function sanitizeErrors(err, req, res, next) {
  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const sanitizedError = {
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
    requestId: req.id || 'unknown'
  };
  
  // Log full error internally
  console.error('🚨 Internal Error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });
  
  // In development, include more details
  if (isDevelopment) {
    sanitizedError.details = err.message;
    sanitizedError.stack = err.stack;
  }
  
  res.status(500).json(sanitizedError);
}

export default {
  securityHeaders,
  globalRateLimit,
  authRateLimit,
  validateInput,
  securityLogger,
  sanitizeErrors
};