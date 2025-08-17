# LLM Runner Router - Python Client

A comprehensive Python client library for the LLM Runner Router system, providing async/await support, type hints, and enterprise-grade error handling.

## Features

- 🚀 **Async/Await Support** - Built with modern Python async patterns
- 🔒 **Type Safety** - Full type hints with Pydantic models
- 🌐 **Multiple Protocols** - HTTP REST, gRPC, and WebSocket support
- 🛡️ **Error Handling** - Comprehensive exception hierarchy
- 🔄 **Retry Logic** - Built-in retries with exponential backoff
- 🎛️ **Rate Limiting** - Client-side rate limiting
- 📊 **Streaming** - Real-time token streaming
- 🧪 **Testing** - Extensive test suite with mocks
- 📱 **CLI Tool** - Command-line interface included

## Installation

```bash
pip install llm-runner-router
```

### Development Installation

```bash
git clone https://github.com/MCERQUA/LLM-Runner-Router.git
cd LLM-Runner-Router/bindings/python
pip install -e ".[dev]"
```

## Quick Start

### Async Client (Recommended)

```python
import asyncio
from llm_runner_router import AsyncLLMRouterClient, InferenceRequest

async def main():
    async with AsyncLLMRouterClient() as client:
        # Quick inference
        response = await client.quick_inference(
            "What is the capital of France?",
            max_tokens=100
        )
        print(response.text)
        
        # Streaming inference
        request = InferenceRequest(
            prompt="Tell me a story",
            options={"stream": True, "max_tokens": 200}
        )
        
        async for chunk in client.stream_inference(request):
            print(chunk.token, end="", flush=True)
            if chunk.is_complete:
                break

asyncio.run(main())
```

### Synchronous Client

```python
from llm_runner_router import LLMRouterClient

with LLMRouterClient() as client:
    response = client.quick_inference("Hello, world!")
    print(response.text)
```

### Convenience Functions

```python
from llm_runner_router.client import quick_inference

# One-liner inference
response = quick_inference("What is machine learning?")
print(response.text)
```

## Configuration

```python
from llm_runner_router import RouterConfig, AsyncLLMRouterClient

config = RouterConfig(
    base_url="http://localhost:3000",
    grpc_url="localhost:50051",
    websocket_url="ws://localhost:3000/ws",
    timeout=30.0,
    max_retries=3,
    api_key="your-api-key"
)

async with AsyncLLMRouterClient(config) as client:
    # Your code here
    pass
```

## Advanced Usage

### Model Management

```python
from llm_runner_router import LoadModelRequest

async with AsyncLLMRouterClient() as client:
    # Load a model
    load_request = LoadModelRequest(
        source="./models/llama-7b.gguf",
        format="gguf",
        id="llama-7b",
        name="Llama 7B Model"
    )
    
    result = await client.load_model(load_request)
    if result.success:
        print(f"Model loaded: {result.model.id}")
    
    # List available models
    models = await client.list_models()
    for model in models:
        print(f"{model.id}: {model.name} ({model.format})")
```

### Batch Inference

```python
from llm_runner_router import BatchInferenceRequest, InferenceRequest

requests = [
    InferenceRequest(prompt="What is AI?"),
    InferenceRequest(prompt="What is ML?"),
    InferenceRequest(prompt="What is DL?"),
]

batch_request = BatchInferenceRequest(
    requests=requests,
    max_concurrent=2,
    timeout_ms=30000
)

result = await client.batch_inference(batch_request)
for response in result.responses:
    print(response.text)
```

### gRPC Client

```python
from llm_runner_router import GRPCClient

async with GRPCClient() as grpc_client:
    response = await grpc_client.inference(request)
    print(response.text)
```

### WebSocket Client

```python
from llm_runner_router import WebSocketClient

async with WebSocketClient() as ws_client:
    # Real-time inference
    async for chunk in ws_client.stream_inference(request):
        print(chunk.token, end="")
    
    # Event handling
    ws_client.on_event("model_loaded", lambda data: print(f"Model loaded: {data}"))
```

### Error Handling

```python
from llm_runner_router import (
    ModelNotFoundError,
    NetworkError,
    TimeoutError,
    RateLimitError,
    ValidationError
)

try:
    response = await client.quick_inference("Hello", model_id="nonexistent")
except ModelNotFoundError as e:
    print(f"Model not found: {e}")
except NetworkError as e:
    print(f"Network issue: {e}")
except TimeoutError as e:
    print(f"Request timed out: {e}")
except RateLimitError as e:
    print(f"Rate limited: {e}")
except ValidationError as e:
    print(f"Invalid request: {e}")
```

## Command Line Interface

The package includes a comprehensive CLI tool:

```bash
# Check server health
llm-router health

# List models
llm-router models --include-unloaded

# Load a model
llm-router load ./model.gguf --format gguf --id my-model

# Run inference
llm-router infer "What is the meaning of life?" --model my-model

# Streaming inference
llm-router infer "Tell me a story" --stream

# Interactive chat
llm-router chat --model my-model
```

### CLI Options

```bash
llm-router --help
llm-router --url http://remote-server:3000 --api-key YOUR_KEY health
llm-router --timeout 60 infer "Complex question" --max-tokens 1000
```

## API Reference

### Core Classes

- `AsyncLLMRouterClient` - Main async client
- `LLMRouterClient` - Synchronous wrapper
- `GRPCClient` - gRPC protocol client
- `WebSocketClient` - WebSocket protocol client

### Data Models

- `InferenceRequest` - Inference request parameters
- `InferenceResponse` - Inference response
- `StreamingResponse` - Streaming token chunk
- `LoadModelRequest` - Model loading parameters
- `LoadModelResponse` - Model loading result
- `ModelInfo` - Model information
- `RouterConfig` - Client configuration

### Exceptions

- `LLMRouterError` - Base exception
- `NetworkError` - Network-related errors
- `TimeoutError` - Request timeouts
- `ModelNotFoundError` - Model not available
- `InferenceError` - Inference failures
- `ValidationError` - Request validation errors
- `RateLimitError` - Rate limiting errors

## Testing

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=llm_runner_router

# Run specific test
pytest tests/test_client.py::TestAsyncClient::test_inference -v
```

## Examples

See the `examples/` directory for comprehensive usage examples:

- `basic_usage.py` - Basic client usage patterns
- `streaming_demo.py` - Streaming inference examples
- `model_management.py` - Model loading and management
- `error_handling.py` - Comprehensive error handling
- `performance_test.py` - Performance benchmarks

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Run the test suite
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- GitHub Issues: https://github.com/MCERQUA/LLM-Runner-Router/issues
- Documentation: https://llm-runner-router.readthedocs.io/
- Discord: [LLM Router Community](https://discord.gg/llm-router)