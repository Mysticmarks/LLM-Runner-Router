# 🔗 LLM-Runner-Router Integration Guide

*Seamlessly integrate AI model orchestration into any application or system*

## 📖 Table of Contents

- [Integration Overview](#integration-overview)
- [Quick Start Integration](#quick-start-integration)
- [Framework-Specific Integrations](#framework-specific-integrations)
- [API Gateway Integration](#api-gateway-integration)
- [Microservices Architecture](#microservices-architecture)
- [Database Integrations](#database-integrations)
- [Message Queue Integration](#message-queue-integration)
- [Monitoring and Observability](#monitoring-and-observability)
- [Authentication and Security](#authentication-and-security)
- [Deployment Patterns](#deployment-patterns)
- [Migration Strategies](#migration-strategies)
- [Troubleshooting](#troubleshooting)

## 🌟 Integration Overview

### Integration Patterns

```javascript
class IntegrationPatterns {
  static getPatterns() {
    return {
      embedded: {
        description: 'Direct library integration within application',
        useCases: ['Single application', 'Monolithic architecture'],
        complexity: 'Low',
        latency: 'Minimal'
      },
      
      sidecar: {
        description: 'LLM Router as sidecar service',
        useCases: ['Microservices', 'Service mesh'],
        complexity: 'Medium',
        latency: 'Low'
      },
      
      gateway: {
        description: 'Centralized API gateway',
        useCases: ['Multiple applications', 'Multi-tenant'],
        complexity: 'Medium',
        latency: 'Medium'
      },
      
      distributed: {
        description: 'Distributed across multiple nodes',
        useCases: ['High scale', 'Geographic distribution'],
        complexity: 'High',
        latency: 'Variable'
      }
    };
  }
}
```

### Integration Architecture

```
┌─────────────────────────────────────────────────┐
│              Client Applications                │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Web App   │  │ Mobile App  │  │  API Client │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│           │              │              │         │
├───────────┼──────────────┼──────────────┼─────────┤
│           │              │              │         │
│  ┌─────────────────────────────────────────────────┐ │
│  │         LLM-Runner-Router Integration         │ │
│  │                                               │ │
│  │  ┌─────────────────────────────────────────┐  │ │
│  │  │           Router Core                  │  │ │
│  │  └─────────────────────────────────────────┘  │ │
│  │                                               │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────┐  │ │
│  │  │ Models  │ │ Engines │ │ Loaders │ │Cache│  │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────┘  │ │
│  └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│              Infrastructure Layer               │
│                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │Database │ │ Message │ │Monitoring│ │ Storage │  │
│  │         │ │  Queue  │ │         │ │         │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
└─────────────────────────────────────────────────┘
```

## 🚀 Quick Start Integration

### Direct Library Integration

```javascript
// Basic integration example
import { LLMRouter } from 'llm-runner-router';

// Initialize router with configuration
const router = new LLMRouter({
  models: ['gpt-3.5-turbo', 'llama-2-7b'],
  strategy: 'balanced',
  caching: true,
  monitoring: true
});

// Initialize (loads models, sets up engines)
await router.initialize();

// Use in your application
async function generateText(prompt, options = {}) {
  try {
    const result = await router.generate(prompt, {
      model: options.preferredModel,
      maxTokens: options.maxTokens || 100,
      temperature: options.temperature || 0.7
    });
    
    return {
      success: true,
      text: result.text,
      metadata: result.metadata
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Example usage
const response = await generateText(
  "Explain machine learning in simple terms",
  { maxTokens: 200, temperature: 0.5 }
);

console.log(response.text);
```

### Express.js Integration

```javascript
// server.js - Express server with LLM Router
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { LLMRouter } from 'llm-runner-router';

class LLMExpressServer {
  constructor() {
    this.app = express();
    this.router = null;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // CORS
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP'
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        router: this.router?.initialized || false
      });
    });

    // Generate text endpoint
    this.app.post('/api/generate', async (req, res) => {
      try {
        const { prompt, options = {} } = req.body;

        if (!prompt) {
          return res.status(400).json({
            error: 'Prompt is required'
          });
        }

        const result = await this.router.generate(prompt, {
          model: options.model,
          maxTokens: Math.min(options.maxTokens || 100, 1000), // Cap at 1000
          temperature: Math.max(0, Math.min(options.temperature || 0.7, 2)), // 0-2 range
          stream: options.stream || false
        });

        res.json({
          success: true,
          result: {
            text: result.text,
            tokens: result.tokens,
            model: result.metadata.model,
            executionTime: result.metadata.executionTime
          }
        });

      } catch (error) {
        console.error('Generation error:', error);
        
        res.status(500).json({
          success: false,
          error: error.message,
          code: error.code || 'GENERATION_ERROR'
        });
      }
    });

    // Streaming endpoint
    this.app.post('/api/stream', async (req, res) => {
      try {
        const { prompt, options = {} } = req.body;

        if (!prompt) {
          return res.status(400).json({
            error: 'Prompt is required'
          });
        }

        // Set up SSE headers
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });

        // Stream tokens
        const stream = this.router.stream(prompt, options);

        for await (const token of stream) {
          res.write(`data: ${JSON.stringify(token)}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();

      } catch (error) {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    });

    // Model information
    this.app.get('/api/models', async (req, res) => {
      try {
        const models = await this.router.getAvailableModels();
        
        res.json({
          success: true,
          models: models.map(model => ({
            name: model.name,
            capabilities: model.capabilities,
            status: model.status
          }))
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Router metrics
    this.app.get('/api/metrics', async (req, res) => {
      try {
        const metrics = await this.router.getMetrics();
        
        res.json({
          success: true,
          metrics
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Error handling middleware
    this.app.use((error, req, res, next) => {
      console.error('Unhandled error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        requestId: req.id
      });
    });
  }

  async initialize() {
    // Initialize LLM Router
    this.router = new LLMRouter({
      models: process.env.LLM_MODELS?.split(',') || ['gpt-3.5-turbo'],
      strategy: process.env.LLM_STRATEGY || 'balanced',
      caching: process.env.LLM_CACHING !== 'false',
      monitoring: true
    });

    await this.router.initialize();
    console.log('LLM Router initialized successfully');
  }

  async start(port = 3000) {
    await this.initialize();
    
    this.server = this.app.listen(port, () => {
      console.log(`LLM Server running on port ${port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  async shutdown() {
    console.log('Shutting down server...');
    
    if (this.server) {
      this.server.close();
    }
    
    if (this.router) {
      await this.router.cleanup();
    }
    
    process.exit(0);
  }
}

// Start server
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new LLMExpressServer();
  server.start(process.env.PORT || 3000);
}

export default LLMExpressServer;
```

## 🎯 Framework-Specific Integrations

### Next.js Integration

```javascript
// pages/api/llm/generate.js - Next.js API route
import { LLMRouter } from 'llm-runner-router';

// Initialize router (outside handler for reuse)
let router = null;

async function getRouter() {
  if (!router) {
    router = new LLMRouter({
      models: ['gpt-3.5-turbo'],
      caching: true
    });
    await router.initialize();
  }
  return router;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, options = {} } = req.body;
    const llmRouter = await getRouter();
    
    const result = await llmRouter.generate(prompt, options);
    
    res.status(200).json({
      success: true,
      text: result.text,
      metadata: result.metadata
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// pages/api/llm/stream.js - Streaming endpoint
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, options = {} } = req.body;
    const llmRouter = await getRouter();

    // Set up streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const stream = llmRouter.stream(prompt, options);

    for await (const token of stream) {
      res.write(`data: ${JSON.stringify(token)}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
}
```

### React Hook Integration

```javascript
// hooks/useLLMRouter.js - React hook for LLM Router
import { useState, useCallback, useRef } from 'react';

export function useLLMGeneration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const abortController = useRef(null);

  const generate = useCallback(async (prompt, options = {}) => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      // Cancel previous request if any
      if (abortController.current) {
        abortController.current.abort();
      }

      abortController.current = new AbortController();

      const response = await fetch('/api/llm/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt, options }),
        signal: abortController.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        throw new Error(data.error);
      }

    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort();
    }
  }, []);

  return {
    generate,
    cancel,
    loading,
    error,
    result
  };
}

export function useLLMStreaming() {
  const [streaming, setStreaming] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);

  const startStream = useCallback(async (prompt, options = {}) => {
    try {
      setStreaming(true);
      setError(null);
      setTokens([]);

      // Close existing stream
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Create new stream
      const response = await fetch('/api/llm/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt, options })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              setStreaming(false);
              return;
            }

            try {
              const token = JSON.parse(data);
              
              if (token.error) {
                throw new Error(token.error);
              }

              setTokens(prev => [...prev, token]);
            } catch (parseError) {
              console.warn('Failed to parse token:', data);
            }
          }
        }
      }

    } catch (err) {
      setError(err.message);
      setStreaming(false);
    }
  }, []);

  const stopStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setStreaming(false);
  }, []);

  return {
    startStream,
    stopStream,
    streaming,
    tokens,
    error,
    fullText: tokens.map(t => t.token).join('')
  };
}

// Example component usage
export function LLMChat() {
  const { generate, loading, error, result } = useLLMGeneration();
  const { startStream, stopStream, streaming, tokens, fullText } = useLLMStreaming();
  const [prompt, setPrompt] = useState('');
  const [useStreaming, setUseStreaming] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (useStreaming) {
      await startStream(prompt);
    } else {
      await generate(prompt);
    }
  };

  return (
    <div className="llm-chat">
      <form onSubmit={handleSubmit}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt..."
          rows={4}
          cols={50}
        />
        <br />
        <label>
          <input
            type="checkbox"
            checked={useStreaming}
            onChange={(e) => setUseStreaming(e.target.checked)}
          />
          Use streaming
        </label>
        <br />
        <button 
          type="submit" 
          disabled={loading || streaming}
        >
          {loading || streaming ? 'Generating...' : 'Generate'}
        </button>
        {streaming && (
          <button type="button" onClick={stopStream}>
            Stop
          </button>
        )}
      </form>

      {error && (
        <div className="error">
          Error: {error}
        </div>
      )}

      {useStreaming && tokens.length > 0 && (
        <div className="streaming-output">
          <h3>Streaming Output:</h3>
          <div className="tokens">
            {fullText}
            {streaming && <span className="cursor">|</span>}
          </div>
        </div>
      )}

      {!useStreaming && result && (
        <div className="result">
          <h3>Result:</h3>
          <p>{result.text}</p>
          <small>
            Model: {result.metadata.model} | 
            Time: {result.metadata.executionTime}ms | 
            Tokens: {result.tokens}
          </small>
        </div>
      )}
    </div>
  );
}
```

### Fastify Integration

```javascript
// fastify-server.js - Fastify server with LLM Router
import Fastify from 'fastify';
import { LLMRouter } from 'llm-runner-router';

async function createServer() {
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty'
      }
    }
  });

  // Initialize LLM Router
  const router = new LLMRouter({
    models: ['gpt-3.5-turbo'],
    strategy: 'balanced'
  });

  await router.initialize();

  // Register CORS
  await fastify.register(import('@fastify/cors'), {
    origin: true
  });

  // Register rate limiting
  await fastify.register(import('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute'
  });

  // Schema definitions
  const generateSchema = {
    body: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', minLength: 1 },
        options: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            maxTokens: { type: 'integer', minimum: 1, maximum: 1000 },
            temperature: { type: 'number', minimum: 0, maximum: 2 }
          }
        }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          text: { type: 'string' },
          metadata: { type: 'object' }
        }
      }
    }
  };

  // Routes
  fastify.post('/api/generate', { schema: generateSchema }, async (request, reply) => {
    const { prompt, options = {} } = request.body;

    try {
      const result = await router.generate(prompt, options);
      
      return {
        success: true,
        text: result.text,
        metadata: result.metadata
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Health check
  fastify.get('/health', async () => {
    return {
      status: 'healthy',
      router: router.initialized
    };
  });

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    await router.cleanup();
  });

  return fastify;
}

// Start server
async function start() {
  try {
    const server = await createServer();
    await server.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Server started on port 3000');
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
```

## 🔌 API Gateway Integration

### Kong Plugin Integration

```lua
-- kong/plugins/llm-router/handler.lua
local BasePlugin = require "kong.plugins.base_plugin"
local http = require "resty.http"
local json = require "cjson"

local LLMRouterHandler = BasePlugin:extend()

LLMRouterHandler.PRIORITY = 1000
LLMRouterHandler.VERSION = "1.0.0"

function LLMRouterHandler:new()
  LLMRouterHandler.super.new(self, "llm-router")
end

function LLMRouterHandler:access(conf)
  LLMRouterHandler.super.access(self)
  
  -- Only process POST requests to /llm/generate
  if ngx.var.request_method ~= "POST" or 
     not string.match(ngx.var.uri, "/llm/generate$") then
    return
  end
  
  -- Read request body
  ngx.req.read_body()
  local body_data = ngx.req.get_body_data()
  
  if not body_data then
    return kong.response.exit(400, {error = "Request body required"})
  end
  
  local ok, body_json = pcall(json.decode, body_data)
  if not ok then
    return kong.response.exit(400, {error = "Invalid JSON"})
  end
  
  -- Add authentication and rate limiting here
  local user_id = ngx.var.http_x_user_id
  if not user_id then
    return kong.response.exit(401, {error = "User ID required"})
  end
  
  -- Forward to LLM Router service
  local httpc = http.new()
  httpc:set_timeout(conf.timeout or 30000)
  
  local res, err = httpc:request_uri(conf.llm_router_url .. "/api/generate", {
    method = "POST",
    headers = {
      ["Content-Type"] = "application/json",
      ["X-User-ID"] = user_id
    },
    body = body_data
  })
  
  if not res then
    kong.log.err("Failed to connect to LLM Router: ", err)
    return kong.response.exit(503, {error = "Service unavailable"})
  end
  
  -- Return response
  kong.response.exit(res.status, res.body, res.headers)
end

return LLMRouterHandler
```

### Nginx Integration

```nginx
# nginx.conf - Load balancing to LLM Router instances
upstream llm_router {
    least_conn;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3002 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3003 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name api.example.com;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    location /api/llm/ {
        limit_req zone=api burst=20 nodelay;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';

        # Handle preflight
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }

        # Proxy to LLM Router
        proxy_pass http://llm_router;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Streaming support
        proxy_buffering off;
        proxy_cache off;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://llm_router/health;
        access_log off;
    }
}
```

## 🏗️ Microservices Architecture

### Docker Compose Setup

```yaml
# docker-compose.yml - Complete microservices setup
version: '3.8'

services:
  # LLM Router Service
  llm-router:
    build: ./llm-router
    environment:
      - NODE_ENV=production
      - LLM_MODELS=gpt-3.5-turbo,llama-2-7b
      - REDIS_URL=redis://redis:6379
      - POSTGRES_URL=postgresql://postgres:password@postgres:5432/llmdb
    depends_on:
      - redis
      - postgres
    ports:
      - "3001:3000"
    volumes:
      - ./models:/app/models
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # API Gateway
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    depends_on:
      - llm-router
    restart: unless-stopped

  # Redis for caching
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  # PostgreSQL for persistent data
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=llmdb
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  # Monitoring
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    restart: unless-stopped

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    restart: unless-stopped

  # Message Queue
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      - RABBITMQ_DEFAULT_USER=admin
      - RABBITMQ_DEFAULT_PASS=password
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    restart: unless-stopped

volumes:
  redis_data:
  postgres_data:
  prometheus_data:
  grafana_data:
  rabbitmq_data:
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml - Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-router
  labels:
    app: llm-router
spec:
  replicas: 3
  selector:
    matchLabels:
      app: llm-router
  template:
    metadata:
      labels:
        app: llm-router
    spec:
      containers:
      - name: llm-router
        image: llm-router:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: llm-secrets
              key: redis-url
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: model-storage
          mountPath: /app/models
      volumes:
      - name: model-storage
        persistentVolumeClaim:
          claimName: model-storage-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: llm-router-service
spec:
  selector:
    app: llm-router
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: llm-router-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /api/llm
        pathType: Prefix
        backend:
          service:
            name: llm-router-service
            port:
              number: 80
```

## 🗄️ Database Integrations

### PostgreSQL Integration

```javascript
// integrations/PostgreSQLIntegration.js
import pg from 'pg';

class PostgreSQLIntegration {
  constructor(config) {
    this.pool = new pg.Pool({
      host: config.host || 'localhost',
      port: config.port || 5432,
      database: config.database,
      user: config.user,
      password: config.password,
      max: config.maxConnections || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });
    
    this.initializeSchema();
  }

  async initializeSchema() {
    const client = await this.pool.connect();
    
    try {
      // Create tables for LLM data
      await client.query(`
        CREATE TABLE IF NOT EXISTS llm_requests (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255),
          prompt TEXT NOT NULL,
          response TEXT,
          model VARCHAR(100),
          tokens INTEGER,
          execution_time INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB
        );
        
        CREATE INDEX IF NOT EXISTS idx_llm_requests_user_id ON llm_requests(user_id);
        CREATE INDEX IF NOT EXISTS idx_llm_requests_created_at ON llm_requests(created_at);
        CREATE INDEX IF NOT EXISTS idx_llm_requests_model ON llm_requests(model);
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS llm_cache (
          id SERIAL PRIMARY KEY,
          cache_key VARCHAR(255) UNIQUE NOT NULL,
          prompt_hash VARCHAR(255) NOT NULL,
          response TEXT NOT NULL,
          model VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP,
          hit_count INTEGER DEFAULT 0,
          metadata JSONB
        );
        
        CREATE INDEX IF NOT EXISTS idx_llm_cache_key ON llm_cache(cache_key);
        CREATE INDEX IF NOT EXISTS idx_llm_cache_hash ON llm_cache(prompt_hash);
        CREATE INDEX IF NOT EXISTS idx_llm_cache_expires ON llm_cache(expires_at);
      `);

      console.log('PostgreSQL schema initialized');
    } finally {
      client.release();
    }
  }

  async logRequest(requestData) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO llm_requests 
        (user_id, prompt, response, model, tokens, execution_time, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
      
      const values = [
        requestData.userId,
        requestData.prompt,
        requestData.response,
        requestData.model,
        requestData.tokens,
        requestData.executionTime,
        JSON.stringify(requestData.metadata || {})
      ];
      
      const result = await client.query(query, values);
      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  async getCachedResponse(promptHash) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT response, model, metadata 
        FROM llm_cache 
        WHERE prompt_hash = $1 
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      `;
      
      const result = await client.query(query, [promptHash]);
      
      if (result.rows.length > 0) {
        // Update hit count
        await client.query(
          'UPDATE llm_cache SET hit_count = hit_count + 1 WHERE prompt_hash = $1',
          [promptHash]
        );
        
        return result.rows[0];
      }
      
      return null;
    } finally {
      client.release();
    }
  }

  async setCachedResponse(promptHash, cacheKey, responseData, ttlSeconds = 3600) {
    const client = await this.pool.connect();
    
    try {
      const expiresAt = ttlSeconds 
        ? new Date(Date.now() + ttlSeconds * 1000) 
        : null;
      
      const query = `
        INSERT INTO llm_cache 
        (cache_key, prompt_hash, response, model, expires_at, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (cache_key) DO UPDATE SET
        response = EXCLUDED.response,
        model = EXCLUDED.model,
        expires_at = EXCLUDED.expires_at,
        metadata = EXCLUDED.metadata,
        created_at = CURRENT_TIMESTAMP
      `;
      
      const values = [
        cacheKey,
        promptHash,
        responseData.response,
        responseData.model,
        expiresAt,
        JSON.stringify(responseData.metadata || {})
      ];
      
      await client.query(query, values);
    } finally {
      client.release();
    }
  }

  async getUserUsage(userId, timeframe = '24h') {
    const client = await this.pool.connect();
    
    try {
      const interval = this.parseTimeframe(timeframe);
      
      const query = `
        SELECT 
          COUNT(*) as request_count,
          SUM(tokens) as total_tokens,
          AVG(execution_time) as avg_execution_time,
          array_agg(DISTINCT model) as models_used
        FROM llm_requests 
        WHERE user_id = $1 
        AND created_at > CURRENT_TIMESTAMP - INTERVAL '${interval}'
      `;
      
      const result = await client.query(query, [userId]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getSystemMetrics(timeframe = '1h') {
    const client = await this.pool.connect();
    
    try {
      const interval = this.parseTimeframe(timeframe);
      
      const query = `
        SELECT 
          COUNT(*) as total_requests,
          COUNT(DISTINCT user_id) as unique_users,
          SUM(tokens) as total_tokens,
          AVG(execution_time) as avg_execution_time,
          model,
          COUNT(*) as model_requests
        FROM llm_requests 
        WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${interval}'
        GROUP BY model
        ORDER BY model_requests DESC
      `;
      
      const result = await client.query(query);
      return result.rows;
    } finally {
      client.release();
    }
  }

  parseTimeframe(timeframe) {
    const match = timeframe.match(/^(\d+)([hdw])$/);
    if (!match) return '1 hour';
    
    const [, amount, unit] = match;
    const unitMap = { h: 'hour', d: 'day', w: 'week' };
    
    return `${amount} ${unitMap[unit]}${amount > 1 ? 's' : ''}`;
  }

  async cleanup() {
    await this.pool.end();
  }
}

export default PostgreSQLIntegration;
```

### MongoDB Integration

```javascript
// integrations/MongoDBIntegration.js
import { MongoClient } from 'mongodb';

class MongoDBIntegration {
  constructor(config) {
    this.url = config.url || 'mongodb://localhost:27017';
    this.dbName = config.database || 'llm_router';
    this.client = null;
    this.db = null;
  }

  async connect() {
    this.client = new MongoClient(this.url, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    
    // Create indexes
    await this.createIndexes();
    
    console.log('MongoDB connected successfully');
  }

  async createIndexes() {
    const requestsCollection = this.db.collection('requests');
    const cacheCollection = this.db.collection('cache');
    
    await requestsCollection.createIndex({ userId: 1 });
    await requestsCollection.createIndex({ createdAt: -1 });
    await requestsCollection.createIndex({ model: 1 });
    await requestsCollection.createIndex({ 'metadata.tags': 1 });
    
    await cacheCollection.createIndex({ promptHash: 1 }, { unique: true });
    await cacheCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await cacheCollection.createIndex({ createdAt: -1 });
  }

  async logRequest(requestData) {
    const collection = this.db.collection('requests');
    
    const document = {
      ...requestData,
      createdAt: new Date(),
      _id: undefined // Let MongoDB generate ID
    };
    
    const result = await collection.insertOne(document);
    return result.insertedId;
  }

  async getCachedResponse(promptHash) {
    const collection = this.db.collection('cache');
    
    const cached = await collection.findOneAndUpdate(
      { 
        promptHash,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      },
      { $inc: { hitCount: 1 } },
      { returnDocument: 'after' }
    );
    
    return cached?.value || null;
  }

  async setCachedResponse(promptHash, responseData, ttlSeconds = 3600) {
    const collection = this.db.collection('cache');
    
    const document = {
      promptHash,
      response: responseData.response,
      model: responseData.model,
      metadata: responseData.metadata || {},
      createdAt: new Date(),
      expiresAt: ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null,
      hitCount: 0
    };
    
    await collection.replaceOne(
      { promptHash },
      document,
      { upsert: true }
    );
  }

  async getUserUsage(userId, timeframe = '24h') {
    const collection = this.db.collection('requests');
    const startDate = this.parseTimeframe(timeframe);
    
    const pipeline = [
      {
        $match: {
          userId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          requestCount: { $sum: 1 },
          totalTokens: { $sum: '$tokens' },
          avgExecutionTime: { $avg: '$executionTime' },
          modelsUsed: { $addToSet: '$model' }
        }
      }
    ];
    
    const result = await collection.aggregate(pipeline).toArray();
    return result[0] || {
      requestCount: 0,
      totalTokens: 0,
      avgExecutionTime: 0,
      modelsUsed: []
    };
  }

  async getModelMetrics(timeframe = '1h') {
    const collection = this.db.collection('requests');
    const startDate = this.parseTimeframe(timeframe);
    
    const pipeline = [
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$model',
          requestCount: { $sum: 1 },
          totalTokens: { $sum: '$tokens' },
          avgExecutionTime: { $avg: '$executionTime' },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          model: '$_id',
          requestCount: 1,
          totalTokens: 1,
          avgExecutionTime: 1,
          uniqueUserCount: { $size: '$uniqueUsers' },
          _id: 0
        }
      },
      {
        $sort: { requestCount: -1 }
      }
    ];
    
    return await collection.aggregate(pipeline).toArray();
  }

  parseTimeframe(timeframe) {
    const match = timeframe.match(/^(\d+)([hdw])$/);
    if (!match) return new Date(Date.now() - 3600000); // 1 hour default
    
    const [, amount, unit] = match;
    const multipliers = { h: 3600000, d: 86400000, w: 604800000 };
    
    return new Date(Date.now() - (amount * multipliers[unit]));
  }

  async cleanup() {
    if (this.client) {
      await this.client.close();
    }
  }
}

export default MongoDBIntegration;
```

## 📨 Message Queue Integration

### RabbitMQ Integration

```javascript
// integrations/RabbitMQIntegration.js
import amqp from 'amqplib';

class RabbitMQIntegration {
  constructor(config) {
    this.url = config.url || 'amqp://localhost';
    this.connection = null;
    this.channel = null;
    this.queues = {
      requests: 'llm.requests',
      responses: 'llm.responses',
      metrics: 'llm.metrics',
      errors: 'llm.errors'
    };
  }

  async connect() {
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createChannel();
    
    // Setup exchanges and queues
    await this.setupTopology();
    
    console.log('RabbitMQ connected successfully');
  }

  async setupTopology() {
    const exchange = 'llm.exchange';
    
    // Create exchange
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    
    // Create queues
    for (const [key, queueName] of Object.entries(this.queues)) {
      await this.channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          'x-message-ttl': 86400000, // 24 hours
          'x-max-length': 10000
        }
      });
      
      // Bind queue to exchange
      const routingKey = `llm.${key}`;
      await this.channel.bindQueue(queueName, exchange, routingKey);
    }
  }

  async publishRequest(requestData) {
    const message = {
      id: requestData.id || generateId(),
      timestamp: new Date().toISOString(),
      ...requestData
    };
    
    await this.channel.publish(
      'llm.exchange',
      'llm.requests',
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );
  }

  async publishResponse(responseData) {
    const message = {
      timestamp: new Date().toISOString(),
      ...responseData
    };
    
    await this.channel.publish(
      'llm.exchange',
      'llm.responses',
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );
  }

  async publishMetrics(metricsData) {
    const message = {
      timestamp: new Date().toISOString(),
      ...metricsData
    };
    
    await this.channel.publish(
      'llm.exchange',
      'llm.metrics',
      Buffer.from(JSON.stringify(message)),
      { persistent: false } // Metrics don't need persistence
    );
  }

  async consumeRequests(handler) {
    await this.channel.consume(this.queues.requests, async (msg) => {
      if (msg) {
        try {
          const request = JSON.parse(msg.content.toString());
          await handler(request);
          this.channel.ack(msg);
        } catch (error) {
          console.error('Error processing request:', error);
          this.channel.nack(msg, false, false); // Don't requeue
        }
      }
    });
  }

  async consumeResponses(handler) {
    await this.channel.consume(this.queues.responses, async (msg) => {
      if (msg) {
        try {
          const response = JSON.parse(msg.content.toString());
          await handler(response);
          this.channel.ack(msg);
        } catch (error) {
          console.error('Error processing response:', error);
          this.channel.nack(msg, false, false);
        }
      }
    });
  }

  async cleanup() {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }
}

function generateId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

export default RabbitMQIntegration;
```

---

## 📚 Additional Resources

- **[API Reference](./API_REFERENCE.md)** - Complete API documentation
- **[Deployment Guide](./DEPLOYMENT.md)** - Production deployment strategies
- **[Monitoring Guide](./MONITORING.md)** - Monitoring and observability
- **[Security Guide](./SECURITY.md)** - Security best practices
- **[Examples](./examples/)** - Integration examples and tutorials

---

*Remember: Successful integration is about choosing the right pattern for your architecture and requirements. Start simple, then scale as needed.*

**Built with 💙 by Echo AI Systems**