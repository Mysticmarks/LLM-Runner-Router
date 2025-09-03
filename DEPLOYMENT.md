# Deployment & Security Guide

Comprehensive guide for deploying and securing the LLM Runner Router in production.

## Quick Start

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or with PM2
pm2 start ecosystem.config.cjs --env development
```

### Production Deployment
```bash
# Install production dependencies only
npm ci --production

# Start with PM2
pm2 start ecosystem.config.cjs

# Or with specific mode
SERVER_MODE=secure pm2 start ecosystem.config.cjs
```

## Deployment Modes

The server supports multiple deployment modes via `SERVER_MODE` environment variable:

| Mode | Description | Use Case |
|------|-------------|----------|
| `production` | Standard production mode | Default for most deployments |
| `secure` | Enhanced security features | Public-facing APIs |
| `resilient` | Self-healing with auto-recovery | Mission-critical services |
| `development` | Development with hot reload | Local development |

## VPS Deployment

### System Requirements
- **CPU**: 4+ vCPUs recommended
- **RAM**: 16GB minimum (for 3B models)
- **Storage**: 50GB+ SSD
- **OS**: Ubuntu 20.04+ or similar
- **Node.js**: v20.0.0+

### Initial Setup

1. **Update System**
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install build-essential git curl
```

2. **Install Node.js**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y
```

3. **Install PM2**
```bash
sudo npm install -g pm2
pm2 startup systemd
```

4. **Clone Repository**
```bash
cd /home/your-user/projects
git clone https://github.com/your-org/LLM-Runner-Router.git
cd LLM-Runner-Router
```

5. **Install Dependencies**
```bash
npm ci --production
```

6. **Configure Environment**
```bash
cp .env.example .env.production
nano .env.production  # Edit with your settings
```

7. **Download Models**
```bash
# Download SmolLM3-3B model
huggingface-cli download HuggingFaceTB/SmolLM3-3B-Base --local-dir ./models/smollm3-3b
```

8. **Start Application**
```bash
pm2 start ecosystem.config.cjs
pm2 save
```

## Security Configuration

### Essential Security Settings

1. **API Authentication**
```bash
# .env.production
ENABLE_AUTH=true
API_KEY=your-strong-api-key-here
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
```

2. **HTTPS Setup**
```bash
# Using Let's Encrypt
sudo apt install certbot
sudo certbot certonly --standalone -d llmrouter.dev

# Configure in .env
SSL_CERT_PATH=/etc/letsencrypt/live/llmrouter.dev/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/llmrouter.dev/privkey.pem
```

3. **Firewall Configuration**
```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 3006/tcp    # Application
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
```

4. **Rate Limiting**
```bash
# .env.production
ENABLE_RATE_LIMIT=true
RATE_LIMIT_WINDOW=900000  # 15 minutes
RATE_LIMIT_MAX=100        # Max requests per window
```

### Security Headers

The application automatically applies security headers in production:

```javascript
// Automatically enabled in secure mode
- Helmet.js for security headers
- CORS with whitelist
- XSS protection
- CSRF tokens
- Content Security Policy
```

### API Key Management

1. **Generate Strong Keys**
```bash
# Generate API key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

2. **Rotate Keys Regularly**
- Implement key rotation every 90 days
- Maintain multiple active keys during transition
- Log key usage for audit

3. **Store Securely**
- Never commit keys to git
- Use environment variables
- Consider secrets management service

## Monitoring & Logging

### PM2 Monitoring
```bash
# View status
pm2 status

# View logs
pm2 logs llm-router

# Monitor resources
pm2 monit

# Web dashboard
pm2 install pm2-server-monit
pm2 web
```

### Application Metrics
```bash
# Enable metrics collection
ENABLE_METRICS=true

# View at
curl https://llmrouter.dev:3006/api/metrics
```

### Log Management
```bash
# Log rotation setup
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 30
```

## Performance Optimization

### 1. Model Loading
```bash
# Preload models on startup
AUTO_INIT=true

# Configure cache
MODEL_CACHE_DIR=./models
CACHE_TTL=3600
```

### 2. Resource Limits
```bash
# Memory management
MAX_MEMORY_RESTART=2G
NODE_OPTIONS="--max-old-space-size=4096"

# Connection limits
MAX_CONCURRENT_REQUESTS=10
REQUEST_TIMEOUT=30000
```

### 3. Clustering (Future)
```javascript
// ecosystem.config.cjs
instances: 'max',  // Use all CPU cores
exec_mode: 'cluster'
```

## Backup & Recovery

### Automated Backups
```bash
#!/bin/bash
# backup.sh - Run daily via cron

BACKUP_DIR="/backup/llm-router"
DATE=$(date +%Y%m%d)

# Backup configuration
cp -r /home/user/LLM-Runner-Router/.env* $BACKUP_DIR/config-$DATE/

# Backup models (selective)
rsync -av --exclude='*.bin' /home/user/LLM-Runner-Router/models/ $BACKUP_DIR/models-$DATE/

# Backup database
cp /home/user/LLM-Runner-Router/data/*.db $BACKUP_DIR/db-$DATE/

# Keep only 30 days
find $BACKUP_DIR -type d -mtime +30 -exec rm -rf {} \;
```

### Disaster Recovery
```bash
# Quick restore procedure
cd /home/user/LLM-Runner-Router
git pull origin main
npm ci --production
cp /backup/llm-router/config-latest/.env* .
pm2 restart ecosystem.config.cjs
```

## Health Checks

### Endpoint Monitoring
```bash
# Health check endpoint
curl https://llmrouter.dev:3006/api/health

# Expected response
{
  "status": "healthy",
  "uptime": 123456,
  "models": ["smollm3"],
  "memory": { "used": "1.2GB", "total": "16GB" }
}
```

### Automated Monitoring
```bash
# healthcheck.sh - Run every 5 minutes
#!/bin/bash

HEALTH_URL="https://llmrouter.dev:3006/api/health"
SLACK_WEBHOOK="your-slack-webhook"

if ! curl -f $HEALTH_URL > /dev/null 2>&1; then
  curl -X POST $SLACK_WEBHOOK \
    -d '{"text":"LLM Router health check failed!"}'
  pm2 restart llm-router
fi
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
```bash
# Find process using port
sudo lsof -i :3006
# Kill if necessary
sudo kill -9 <PID>
```

2. **Memory Issues**
```bash
# Check memory usage
free -h
pm2 status

# Restart with lower memory limit
MAX_MEMORY_RESTART=1G pm2 restart llm-router
```

3. **Model Loading Failures**
```bash
# Check model files
ls -la ./models/smollm3-3b/

# Re-download if corrupted
rm -rf ./models/smollm3-3b
huggingface-cli download HuggingFaceTB/SmolLM3-3B-Base --local-dir ./models/smollm3-3b
```

4. **SSL Certificate Issues**
```bash
# Renew certificate
sudo certbot renew

# Restart application
pm2 restart llm-router
```

## Production Checklist

Before going live:

- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Firewall rules configured
- [ ] API authentication enabled
- [ ] Rate limiting configured
- [ ] Monitoring setup
- [ ] Backup strategy implemented
- [ ] Health checks configured
- [ ] Log rotation enabled
- [ ] Security headers enabled
- [ ] CORS properly configured
- [ ] Database backups scheduled
- [ ] Error reporting configured
- [ ] Documentation updated
- [ ] Load testing completed

## Security Best Practices

1. **Regular Updates**
   - Update Node.js monthly
   - Update dependencies weekly
   - Monitor security advisories

2. **Access Control**
   - Use SSH keys only
   - Disable root login
   - Implement fail2ban

3. **Monitoring**
   - Log all API access
   - Monitor for anomalies
   - Set up alerts

4. **Data Protection**
   - Encrypt sensitive data
   - Secure API endpoints
   - Validate all inputs

5. **Incident Response**
   - Have rollback plan
   - Document procedures
   - Test recovery process

## Support

For deployment assistance:
- Check logs: `pm2 logs llm-router`
- Review documentation: `/docs/`
- File issues: GitHub Issues
- Community support: Discord/Slack