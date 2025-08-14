# LLM-Runner-Router Deployment Security Configuration

## 🔒 Security Issues Identified & Solutions

### 1. **CRITICAL: Wide-Open CORS Policy**
**Issue**: Server allows ALL origins (`*`) which is insecure for production
```javascript
// Current INSECURE configuration
res.header('Access-Control-Allow-Origin', '*');
```

**Solution**: Implement environment-based CORS with whitelist
```javascript
// SECURE configuration
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
const origin = req.headers.origin;
if (ALLOWED_ORIGINS.includes(origin)) {
  res.header('Access-Control-Allow-Origin', origin);
}
```

### 2. **Rate Limiting Required**
**Issue**: No rate limiting on API endpoints - vulnerable to DDoS
**Solution**: Implement express-rate-limit
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

### 3. **API Key Authentication Missing**
**Issue**: No authentication on inference endpoints
**Solution**: Implement API key middleware
```javascript
const API_KEYS = new Set((process.env.API_KEYS || '').split(','));

const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!API_KEYS.has(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

app.use('/api/inference', authenticateApiKey);
```

### 4. **Input Validation Required**
**Issue**: No validation on user inputs - injection risk
**Solution**: Implement joi validation
```javascript
import Joi from 'joi';

const inferenceSchema = Joi.object({
  prompt: Joi.string().max(1000).required(),
  temperature: Joi.number().min(0).max(1),
  maxTokens: Joi.number().min(1).max(500),
  strategy: Joi.string().valid('balanced', 'quality-first', 'speed-priority')
});
```

### 5. **Environment Variables Not Secured**
**Issue**: Sensitive configs hardcoded or exposed
**Solution**: Use dotenv with validation
```javascript
import dotenv from 'dotenv';
dotenv.config();

// Required environment variables
const REQUIRED_ENV = [
  'NODE_ENV',
  'PORT',
  'ALLOWED_ORIGINS',
  'API_KEYS',
  'MAX_MODEL_SIZE',
  'CACHE_TTL'
];

REQUIRED_ENV.forEach(key => {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
});
```

### 6. **Resource Limits Required**
**Issue**: No limits on model loading - memory exhaustion risk
**Solution**: Implement resource constraints
```javascript
const MAX_MODEL_SIZE = parseInt(process.env.MAX_MODEL_SIZE || '2000000000'); // 2GB default
const MAX_CONCURRENT_INFERENCES = parseInt(process.env.MAX_CONCURRENT || '10');

// Check model size before loading
if (modelStats.size > MAX_MODEL_SIZE) {
  throw new Error('Model exceeds maximum allowed size');
}
```

### 7. **Helmet Security Headers Missing**
**Issue**: Missing security headers for XSS, clickjacking protection
**Solution**: Add helmet middleware
```javascript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 8. **Request Size Limits**
**Issue**: No body size limits - potential for large payload attacks
**Solution**: Configure express body parser limits
```javascript
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));
app.use(express.urlencoded({ 
  limit: '10mb', 
  extended: true 
}));
```

## 📋 Deployment Checklist

### Pre-Deployment Requirements
- [ ] Create `.env.production` file with secure configurations
- [ ] Generate strong API keys for production
- [ ] Set up HTTPS/SSL certificates (Let's Encrypt or Netlify SSL)
- [ ] Configure firewall rules for port access
- [ ] Set up monitoring and alerting (Datadog, New Relic, or Prometheus)
- [ ] Implement logging with winston or pino
- [ ] Set up error tracking (Sentry)
- [ ] Configure backup strategy for models

### Environment Variables Template
```bash
# .env.production
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
API_KEYS=generate-strong-keys-here,separate-with-commas
MAX_MODEL_SIZE=2000000000
CACHE_TTL=300000
MAX_CONCURRENT=10
SESSION_SECRET=generate-strong-secret-here
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
LOG_LEVEL=info
SENTRY_DSN=your-sentry-dsn-here
```

### Netlify Deployment Configuration
```toml
# netlify.toml updates
[build]
  publish = "dist"
  command = "npm run build:production"
  functions = "netlify/functions"

[build.environment]
  NODE_VERSION = "20"
  NODE_ENV = "production"

[context.production.environment]
  NODE_ENV = "production"

[[headers]]
  for = "/api/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
```

### PM2 Process Management (for VPS deployment)
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'llm-router',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

## 🚀 Deployment Steps

### Option 1: Netlify Deployment (Recommended for Chat UI)
1. Push security updates to GitHub
2. Connect GitHub repo to Netlify
3. Set environment variables in Netlify dashboard
4. Deploy with automatic SSL

### Option 2: VPS Deployment (For Full Model Loading)
1. Set up Ubuntu/Debian server
2. Install Node.js 20+, PM2, Nginx
3. Configure Nginx reverse proxy with SSL
4. Set up PM2 process management
5. Configure firewall (ufw)
6. Deploy with GitHub Actions or manual git pull

### Option 3: Docker Deployment
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
USER node
CMD ["node", "server.js"]
```

## 🔍 Security Monitoring

### Recommended Tools
- **Snyk**: Vulnerability scanning for dependencies
- **OWASP ZAP**: Security testing
- **Fail2ban**: Brute force protection
- **CloudFlare**: DDoS protection and CDN
- **Let's Encrypt**: Free SSL certificates

### Logging Strategy
```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'llm-router' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

## ⚠️ Critical Security Notes

1. **Never expose model files directly** - Serve through authenticated API only
2. **Implement request throttling** - Prevent resource exhaustion
3. **Use HTTPS everywhere** - No exceptions for production
4. **Rotate API keys regularly** - Implement key rotation strategy
5. **Monitor for anomalies** - Set up alerts for unusual patterns
6. **Regular security audits** - Run npm audit weekly
7. **Backup strategy** - Regular backups of models and configurations
8. **Incident response plan** - Document security incident procedures

## 📊 Performance Optimization

### Caching Strategy
- Redis for session management
- CDN for static assets
- Model caching with LRU eviction
- Response caching for common queries

### Load Balancing
- Nginx upstream configuration
- Health check endpoints
- Graceful shutdown handling
- Zero-downtime deployments

## 🎯 Next Steps

1. **Immediate Actions**:
   - [ ] Implement authentication middleware
   - [ ] Add rate limiting
   - [ ] Configure CORS properly
   - [ ] Add input validation

2. **Before Going Live**:
   - [ ] Security audit with OWASP checklist
   - [ ] Load testing with k6 or Artillery
   - [ ] Penetration testing
   - [ ] Documentation review

3. **Post-Deployment**:
   - [ ] Monitor performance metrics
   - [ ] Set up alerting
   - [ ] Regular security updates
   - [ ] User feedback collection

This configuration ensures your LLM-Runner-Router deployment is secure, scalable, and production-ready.