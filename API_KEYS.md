# API Keys Documentation

## Working API Keys

The API keys use the format: `keyId.keySecret`

### Persistent Test Key (WORKING!)
```
llm_test_persistent_key_fixed_2025.persistent_test_secret_never_changes_mikecerqua_2025_llm_router
```

This is the main test key that's already configured in the system.

## Using API Keys

### Via cURL
```bash
# Test with simple key
curl -k -X POST https://llmrouter.dev/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key-2024" \
  -d '{"message": "Hello, AI!"}'

# Test with full key
curl -k -X POST https://llmrouter.dev/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ef4fda4b93ffb28c1209e641e0b66bab8235896e5d1c834861e33e15fcc6cc1a" \
  -d '{"message": "What is 2+2?"}'
```

### Via Chat Interface
When using https://llmrouter.dev/chat/, enter one of these API keys in the settings.

## Available Models

1. **llama-gguf** - Llama 3 8B GGUF (Q2_K quantization)
   - Real AI inference via node-llama-cpp
   - ~3GB model size
   - Good for general chat

2. **simple-smollm3** - SmolLM3 3B (fallback)
   - Uses GPT-2 via Transformers.js
   - Lighter weight backup option

## API Endpoints

- `GET /api/health` - Health check (no auth required)
- `POST /api/chat` - Chat completion (auth required)
- `POST /api/inference` - Main inference endpoint (auth required)
- `GET /api/models` - List available models (auth required)

## Note
These are development keys stored in `api-keys.json`. In production, use proper key management!