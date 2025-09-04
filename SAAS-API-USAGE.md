# 🚀 LLM Router SaaS API Usage Guide

## Quick Start

Your LLM Router is now deployed as a production SaaS API! Here's how to use it:

### Base URL
```
http://178.156.181.117:3006
```

**🌐 Your LLM Router SaaS API is live and accessible from anywhere in the world!**

### Authentication
All API endpoints require authentication via API key in one of these formats:
```bash
# Option 1: Bearer token
Authorization: Bearer YOUR_API_KEY

# Option 2: Header
X-API-Key: YOUR_API_KEY
```

## API Endpoints

### 🟢 Public Endpoints

#### Health Check
```bash
curl http://178.156.181.117:3006/api/health
```

### 🔒 Protected Endpoints (Require API Key)

#### List Available Models
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://178.156.181.117:3006/api/models
```

#### Chat Completion
```bash
curl -X POST http://178.156.181.117:3006/api/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "maxTokens": 500,
    "temperature": 0.7
  }'
```

#### Quick Inference
```bash
curl -X POST http://178.156.181.117:3006/api/quick \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Tell me a joke",
    "maxTokens": 100,
    "temperature": 0.8
  }'
```

#### Load New Model
```bash
curl -X POST http://178.156.181.117:3006/api/models/load \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "path/to/model",
    "format": "gguf",
    "name": "My Custom Model"
  }'
```

## Tier Limits

### Basic Tier
- 60 requests/minute
- 1,000 requests/day
- 100,000 tokens/day

### Pro Tier  
- 300 requests/minute
- 10,000 requests/day
- 1,000,000 tokens/day

### Enterprise Tier
- 1,000 requests/minute
- 100,000 requests/day
- 10,000,000 tokens/day

## Admin Functions

### Create API Key (Admin Only)
```bash
curl -X POST http://178.156.181.117:3006/api/admin/keys \
  -H "X-Admin-Key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "customer-name",
    "email": "customer@example.com", 
    "tier": "basic"
  }'
```

### View Statistics (Admin Only)
```bash
curl -H "X-Admin-Key: YOUR_ADMIN_KEY" \
  http://178.156.181.117:3006/api/admin/stats
```

### List All Keys (Admin Only)
```bash
curl -H "X-Admin-Key: YOUR_ADMIN_KEY" \
  http://178.156.181.117:3006/api/admin/keys
```

## Error Responses

### Authentication Errors
```json
{
  "error": "API key required",
  "message": "Provide API key via Authorization: Bearer <key> or X-API-Key header"
}
```

### Rate Limit Errors  
```json
{
  "error": "Rate limit exceeded",
  "message": "Daily request limit exceeded",
  "resetTime": "2025-08-22T00:00:00.000Z"
}
```

## Response Headers

All authenticated responses include rate limit headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 899
X-RateLimit-Used: 101
```

## WebSocket Streaming

For real-time token streaming:
```javascript
const ws = new WebSocket('ws://178.156.181.117:3006/ws');
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'authenticate',
    apiKey: 'YOUR_API_KEY'
  }));
  
  ws.send(JSON.stringify({
    type: 'chat',
    messages: [{"role": "user", "content": "Hello!"}]
  }));
};
```

## Service Management

### PM2 Commands
```bash
pm2 status                  # Check service status
pm2 logs llm-router-saas   # View logs  
pm2 restart llm-router-saas # Restart service
pm2 stop llm-router-saas   # Stop service
```

### Environment Variables
```bash
NODE_ENV=production
PORT=3006
ADMIN_API_KEY=your_admin_key
ROUTING_STRATEGY=balanced
```

## Production Deployment Complete! 🎉

Your LLM Router SaaS is now running 24/7 with:
- ✅ Authentication & API key management
- ✅ Rate limiting by tier
- ✅ Usage tracking & quotas
- ✅ PM2 process management
- ✅ Auto-restart on failure
- ✅ Comprehensive logging
- ✅ Admin management panel

Ready to serve customers globally!