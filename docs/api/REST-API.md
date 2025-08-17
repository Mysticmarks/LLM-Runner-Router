# REST API Reference

Complete REST API documentation for LLM Runner Router.

## Table of Contents

1. [Authentication](#authentication)
2. [Core Endpoints](#core-endpoints)
3. [Model Management](#model-management)
4. [Enterprise Endpoints](#enterprise-endpoints)
5. [Monitoring Endpoints](#monitoring-endpoints)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Examples](#examples)

## Authentication

### API Key Authentication

Include your API key in the request header:

```http
X-API-Key: llmr_your_api_key_here
```

Or as a Bearer token:

```http
Authorization: Bearer llmr_your_api_key_here
```

### JWT Authentication

For session-based authentication:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Core Endpoints

### POST /api/v1/chat/completions

Generate text completions using available models.

**Request:**
```http
POST /api/v1/chat/completions
Content-Type: application/json
X-API-Key: llmr_your_api_key

{
  "messages": [
    {
      "role": "user",
      "content": "Explain quantum computing"
    }
  ],
  "model": "gpt-3.5-turbo",
  "max_tokens": 150,
  "temperature": 0.7,
  "stream": false
}
```

**Response:**
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-3.5-turbo",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Quantum computing is a type of computation that harnesses..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 150,
    "total_tokens": 160
  },
  "metadata": {
    "model_used": "gpt-3.5-turbo",
    "strategy": "balanced",
    "duration_ms": 1234,
    "cost_cents": 32
  }
}
```

**cURL Example:**
```bash
curl -X POST "http://localhost:3000/api/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: llmr_your_api_key" \
  -d '{
    "messages": [{"role": "user", "content": "Hello, world!"}],
    "model": "gpt-3.5-turbo",
    "max_tokens": 50
  }'
```

### POST /api/v1/completions

Simple text completion endpoint.

**Request:**
```http
POST /api/v1/completions
Content-Type: application/json
X-API-Key: llmr_your_api_key

{
  "prompt": "The future of AI is",
  "model": "gpt-3.5-turbo",
  "max_tokens": 100,
  "temperature": 0.8,
  "top_p": 0.95,
  "frequency_penalty": 0,
  "presence_penalty": 0,
  "stop": ["\n", ".", "!"]
}
```

**Response:**
```json
{
  "id": "cmpl-123",
  "object": "text_completion",
  "created": 1677652288,
  "model": "gpt-3.5-turbo",
  "choices": [
    {
      "text": "bright and full of possibilities. Machine learning...",
      "index": 0,
      "logprobs": null,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 5,
    "completion_tokens": 95,
    "total_tokens": 100
  }
}
```

### POST /api/v1/embeddings

Generate embeddings for text input.

**Request:**
```http
POST /api/v1/embeddings
Content-Type: application/json
X-API-Key: llmr_your_api_key

{
  "input": ["The food was delicious", "The movie was boring"],
  "model": "text-embedding-ada-002"
}
```

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "embedding": [0.0023064255, -0.009327292, ...],
      "index": 0
    },
    {
      "object": "embedding", 
      "embedding": [0.0019644677, -0.0021481132, ...],
      "index": 1
    }
  ],
  "model": "text-embedding-ada-002",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}
```

### GET /api/v1/models

List available models.

**Request:**
```http
GET /api/v1/models
X-API-Key: llmr_your_api_key
```

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-3.5-turbo",
      "object": "model",
      "created": 1677610602,
      "owned_by": "openai",
      "permission": [],
      "root": "gpt-3.5-turbo",
      "parent": null,
      "capabilities": ["chat", "completion"],
      "context_length": 4096,
      "status": "available"
    },
    {
      "id": "claude-3-haiku",
      "object": "model", 
      "created": 1677610602,
      "owned_by": "anthropic",
      "capabilities": ["chat", "completion"],
      "context_length": 200000,
      "status": "available"
    }
  ]
}
```

### GET /api/v1/models/{model_id}

Get details about a specific model.

**Request:**
```http
GET /api/v1/models/gpt-3.5-turbo
X-API-Key: llmr_your_api_key
```

**Response:**
```json
{
  "id": "gpt-3.5-turbo",
  "object": "model",
  "created": 1677610602,
  "owned_by": "openai",
  "capabilities": ["chat", "completion"],
  "context_length": 4096,
  "status": "available",
  "pricing": {
    "input_cost_per_1k_tokens": 0.0015,
    "output_cost_per_1k_tokens": 0.002
  },
  "performance": {
    "avg_response_time_ms": 1200,
    "tokens_per_second": 45,
    "success_rate": 0.998
  },
  "limits": {
    "max_tokens": 4096,
    "max_requests_per_minute": 3500
  }
}
```

## Model Management

### POST /api/v1/models

Register a new model.

**Request:**
```http
POST /api/v1/models
Content-Type: application/json
X-API-Key: llmr_your_api_key

{
  "id": "custom-model-v1",
  "name": "Custom Model v1",
  "format": "gguf",
  "source": "./models/custom-model.gguf",
  "config": {
    "context_length": 2048,
    "temperature": 0.7,
    "top_k": 40
  },
  "capabilities": ["text-generation"],
  "metadata": {
    "description": "Custom fine-tuned model",
    "version": "1.0.0"
  }
}
```

**Response:**
```json
{
  "id": "custom-model-v1",
  "status": "registered",
  "message": "Model registered successfully",
  "load_time_ms": 5432,
  "metadata": {
    "file_size_mb": 245,
    "format": "gguf",
    "capabilities": ["text-generation"]
  }
}
```

### DELETE /api/v1/models/{model_id}

Unregister a model.

**Request:**
```http
DELETE /api/v1/models/custom-model-v1
X-API-Key: llmr_your_api_key
```

**Response:**
```json
{
  "id": "custom-model-v1",
  "status": "unregistered",
  "message": "Model unregistered successfully"
}
```

### POST /api/v1/models/{model_id}/download

Download a model from a repository.

**Request:**
```http
POST /api/v1/models/microsoft/DialoGPT-medium/download
Content-Type: application/json
X-API-Key: llmr_your_api_key

{
  "source": "huggingface",
  "format": "gguf",
  "quantization": "q4_k_m"
}
```

**Response:**
```json
{
  "id": "microsoft/DialoGPT-medium",
  "status": "downloading",
  "download_id": "dl_123456",
  "estimated_time_minutes": 15,
  "file_size_mb": 1024
}
```

### GET /api/v1/downloads/{download_id}

Check download status.

**Request:**
```http
GET /api/v1/downloads/dl_123456
X-API-Key: llmr_your_api_key
```

**Response:**
```json
{
  "id": "dl_123456",
  "status": "in_progress",
  "progress": 0.65,
  "downloaded_mb": 665,
  "total_mb": 1024,
  "eta_seconds": 180
}
```

## Enterprise Endpoints

### GET /api/v1/tenants

List all tenants (admin only).

**Request:**
```http
GET /api/v1/tenants
X-API-Key: llmr_admin_api_key
```

**Response:**
```json
{
  "tenants": [
    {
      "id": "enterprise-corp",
      "name": "Enterprise Corporation",
      "plan": "enterprise",
      "status": "active",
      "created_at": "2024-01-15T10:30:00Z",
      "usage": {
        "requests_this_month": 15000,
        "tokens_this_month": 2500000,
        "cost_this_month_cents": 7500
      },
      "limits": {
        "requests_per_minute": 1000,
        "max_concurrent": 50
      }
    }
  ]
}
```

### GET /api/v1/tenants/{tenant_id}/usage

Get tenant usage statistics.

**Request:**
```http
GET /api/v1/tenants/enterprise-corp/usage?start_date=2024-01-01&end_date=2024-01-31
X-API-Key: llmr_your_api_key
```

**Response:**
```json
{
  "tenant_id": "enterprise-corp",
  "period": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-31T23:59:59Z"
  },
  "summary": {
    "total_requests": 25000,
    "total_tokens": 4200000,
    "total_cost_cents": 12600,
    "avg_response_time_ms": 1150
  },
  "daily_usage": [
    {
      "date": "2024-01-01",
      "requests": 800,
      "tokens": 140000,
      "cost_cents": 420
    }
  ],
  "model_breakdown": {
    "gpt-4": {
      "requests": 5000,
      "tokens": 800000,
      "cost_cents": 8000
    },
    "gpt-3.5-turbo": {
      "requests": 20000,
      "tokens": 3400000,
      "cost_cents": 4600
    }
  }
}
```

### POST /api/v1/tenants/{tenant_id}/limits

Update tenant limits (admin only).

**Request:**
```http
POST /api/v1/tenants/enterprise-corp/limits
Content-Type: application/json
X-API-Key: llmr_admin_api_key

{
  "requests_per_minute": 1500,
  "max_concurrent": 75,
  "models_allowed": ["gpt-4", "gpt-3.5-turbo", "claude-3-opus"]
}
```

**Response:**
```json
{
  "tenant_id": "enterprise-corp",
  "status": "updated",
  "new_limits": {
    "requests_per_minute": 1500,
    "max_concurrent": 75,
    "models_allowed": ["gpt-4", "gpt-3.5-turbo", "claude-3-opus"]
  },
  "effective_at": "2024-01-15T10:30:00Z"
}
```

### GET /api/v1/experiments

List A/B testing experiments.

**Request:**
```http
GET /api/v1/experiments
X-API-Key: llmr_your_api_key
```

**Response:**
```json
{
  "experiments": [
    {
      "id": "model-comparison",
      "name": "GPT-4 vs Claude-3 Performance",
      "status": "active",
      "start_date": "2024-01-01T00:00:00Z",
      "end_date": "2024-12-31T23:59:59Z",
      "traffic_allocation": 50,
      "variants": {
        "control": {
          "name": "GPT-4 Control",
          "weight": 50,
          "assignments": 1250,
          "conversions": 1200
        },
        "treatment": {
          "name": "Claude-3 Treatment", 
          "weight": 50,
          "assignments": 1300,
          "conversions": 1280
        }
      }
    }
  ]
}
```

### GET /api/v1/experiments/{experiment_id}/results

Get experiment results.

**Request:**
```http
GET /api/v1/experiments/model-comparison/results
X-API-Key: llmr_your_api_key
```

**Response:**
```json
{
  "experiment_id": "model-comparison",
  "status": "active",
  "results": {
    "control": {
      "assignments": 1250,
      "conversions": 1200,
      "conversion_rate": 0.96,
      "avg_response_time": 1200,
      "avg_quality_score": 85.2
    },
    "treatment": {
      "assignments": 1300,
      "conversions": 1280,
      "conversion_rate": 0.985,
      "avg_response_time": 980,
      "avg_quality_score": 87.8
    }
  },
  "statistical_significance": {
    "confidence": 0.95,
    "p_value": 0.023,
    "winner": "treatment",
    "improvement": 0.025
  }
}
```

## Monitoring Endpoints

### GET /api/v1/health

Health check endpoint.

**Request:**
```http
GET /api/v1/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.2.1",
  "uptime_seconds": 3600,
  "checks": {
    "database": {
      "status": "healthy",
      "response_time_ms": 15
    },
    "cache": {
      "status": "healthy",
      "hit_rate": 0.85
    },
    "models": {
      "status": "healthy",
      "loaded_models": 5,
      "failed_models": 0
    }
  }
}
```

### GET /api/v1/metrics

Prometheus metrics endpoint.

**Request:**
```http
GET /api/v1/metrics
```

**Response:**
```text
# HELP llm_router_http_requests_total Total number of HTTP requests
# TYPE llm_router_http_requests_total counter
llm_router_http_requests_total{method="POST",route="/api/v1/chat/completions",status_code="200",tenant_id="enterprise-corp"} 1250

# HELP llm_router_model_inference_duration_seconds Duration of model inference in seconds
# TYPE llm_router_model_inference_duration_seconds histogram
llm_router_model_inference_duration_seconds_bucket{model_id="gpt-3.5-turbo",strategy="balanced",le="0.1"} 0
llm_router_model_inference_duration_seconds_bucket{model_id="gpt-3.5-turbo",strategy="balanced",le="0.5"} 15
```

### GET /api/v1/stats

System statistics.

**Request:**
```http
GET /api/v1/stats
X-API-Key: llmr_your_api_key
```

**Response:**
```json
{
  "system": {
    "cpu_usage": 0.45,
    "memory_usage": 0.67,
    "disk_usage": 0.23,
    "load_average": [1.2, 1.1, 0.9]
  },
  "application": {
    "active_connections": 25,
    "requests_per_second": 15.7,
    "avg_response_time_ms": 1150,
    "error_rate": 0.002
  },
  "models": {
    "total_loaded": 5,
    "total_requests": 50000,
    "cache_hit_rate": 0.85,
    "avg_tokens_per_request": 150
  }
}
```

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "type": "invalid_request_error",
    "code": "missing_parameter",
    "message": "Missing required parameter: 'messages'",
    "param": "messages",
    "request_id": "req_123456"
  }
}
```

### Common Error Codes

| HTTP Status | Error Type | Code | Description |
|-------------|------------|------|-------------|
| 400 | `invalid_request_error` | `missing_parameter` | Required parameter missing |
| 400 | `invalid_request_error` | `invalid_parameter` | Parameter value invalid |
| 401 | `authentication_error` | `invalid_api_key` | API key invalid or missing |
| 403 | `permission_error` | `insufficient_permissions` | Insufficient permissions |
| 404 | `not_found_error` | `model_not_found` | Requested model not available |
| 429 | `rate_limit_error` | `rate_limit_exceeded` | Rate limit exceeded |
| 500 | `internal_server_error` | `server_error` | Internal server error |
| 503 | `service_unavailable_error` | `overloaded` | Service temporarily overloaded |

### Error Response Examples

**Authentication Error:**
```json
{
  "error": {
    "type": "authentication_error",
    "code": "invalid_api_key",
    "message": "Invalid API key provided",
    "request_id": "req_123456"
  }
}
```

**Rate Limit Error:**
```json
{
  "error": {
    "type": "rate_limit_error",
    "code": "rate_limit_exceeded", 
    "message": "Rate limit exceeded: 100 requests per minute",
    "retry_after": 30,
    "request_id": "req_123456"
  }
}
```

**Model Not Found:**
```json
{
  "error": {
    "type": "not_found_error",
    "code": "model_not_found",
    "message": "Model 'nonexistent-model' not found",
    "available_models": ["gpt-3.5-turbo", "gpt-4", "claude-3-haiku"],
    "request_id": "req_123456"
  }
}
```

## Rate Limiting

Rate limits are applied per API key and tenant:

- **Free tier**: 20 requests/minute, 1,000 requests/day
- **Professional**: 100 requests/minute, 10,000 requests/day  
- **Enterprise**: Custom limits

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Examples

### Python Example

```python
import requests
import json

API_KEY = "llmr_your_api_key"
BASE_URL = "http://localhost:3000/api/v1"

headers = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY
}

# Chat completion
response = requests.post(
    f"{BASE_URL}/chat/completions",
    headers=headers,
    json={
        "messages": [
            {"role": "user", "content": "What is machine learning?"}
        ],
        "model": "gpt-3.5-turbo",
        "max_tokens": 150
    }
)

print(response.json())
```

### Node.js Example

```javascript
const axios = require('axios');

const apiKey = 'llmr_your_api_key';
const baseURL = 'http://localhost:3000/api/v1';

const client = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey
  }
});

// Chat completion
async function generateResponse() {
  try {
    const response = await client.post('/chat/completions', {
      messages: [
        { role: 'user', content: 'Explain quantum computing' }
      ],
      model: 'gpt-3.5-turbo',
      max_tokens: 150
    });
    
    console.log(response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

generateResponse();
```

### cURL Examples

**Basic Chat Completion:**
```bash
curl -X POST "http://localhost:3000/api/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: llmr_your_api_key" \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "model": "gpt-3.5-turbo",
    "max_tokens": 50
  }'
```

**Streaming Response:**
```bash
curl -X POST "http://localhost:3000/api/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: llmr_your_api_key" \
  -d '{
    "messages": [{"role": "user", "content": "Write a poem"}],
    "model": "gpt-3.5-turbo", 
    "max_tokens": 100,
    "stream": true
  }' \
  --no-buffer
```

**List Models:**
```bash
curl -X GET "http://localhost:3000/api/v1/models" \
  -H "X-API-Key: llmr_your_api_key"
```

**Health Check:**
```bash
curl -X GET "http://localhost:3000/api/v1/health"
```

---

For more examples and detailed usage, see the [tutorials](../tutorials/) and [examples](../examples/) directories.