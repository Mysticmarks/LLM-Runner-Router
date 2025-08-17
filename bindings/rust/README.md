# LLM Runner Router - Rust Client

A high-performance Rust client library for the LLM Runner Router system, built with Tokio for async I/O and featuring comprehensive error handling.

## Features

- 🚀 **Async/Await Support** - Built with Tokio for high-performance async I/O
- 🔒 **Type Safety** - Strong typing with comprehensive error handling using `thiserror`
- 🌐 **Multiple Protocols** - HTTP REST, gRPC, and WebSocket support
- 🛡️ **Error Handling** - Rich error types with context and retry logic
- 🔄 **Retry Logic** - Built-in retries with exponential backoff and jitter
- 🎛️ **Rate Limiting** - Client-side rate limiting with governor
- 📊 **Streaming** - Real-time token streaming with futures
- 🧪 **Testing** - Extensive test suite with mock servers
- 🔗 **FFI Support** - Node.js bindings for JavaScript integration
- ⚡ **Performance** - Zero-copy deserialization and connection pooling

## Installation

Add this to your `Cargo.toml`:

```toml
[dependencies]
llm-runner-router = "1.2.1"

# For async runtime
tokio = { version = "1.0", features = ["full"] }
```

### Feature Flags

```toml
[dependencies]
llm-runner-router = { version = "1.2.1", features = ["grpc", "websocket"] }
```

Available features:
- `http` (default) - HTTP REST client
- `grpc` - gRPC protocol support
- `websocket` - WebSocket protocol support
- `napi-binding` - Node.js FFI bindings

## Quick Start

### Basic Usage

```rust
use llm_runner_router::{Client, RouterConfig, InferenceRequest, Result};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing (optional)
    llm_runner_router::init_tracing();
    
    // Create client
    let config = RouterConfig::new("http://localhost:3000");
    let client = Client::new(config).await?;
    
    // Quick inference
    let response = client.quick_inference("What is the capital of France?").await?;
    println!("Response: {}", response.text);
    
    // Clean up
    client.close().await?;
    Ok(())
}
```

### Configuration

```rust
use llm_runner_router::{RouterConfig, Client};
use std::time::Duration;

let config = RouterConfig::new("http://localhost:3000")
    .timeout(Duration::from_secs(60))
    .max_retries(5)
    .api_key("your-api-key")
    .user_agent("my-app/1.0");

let client = Client::new(config).await?;
```

### Environment Configuration

```rust
// Set environment variables
std::env::set_var("LLM_ROUTER_BASE_URL", "http://localhost:3000");
std::env::set_var("LLM_ROUTER_API_KEY", "your-api-key");
std::env::set_var("LLM_ROUTER_TIMEOUT", "30");

// Load from environment
let client = Client::from_env().await?;
```

## Advanced Usage

### Model Management

```rust
use llm_runner_router::{LoadModelRequest, InferenceOptions};

// Load a model
let load_request = LoadModelRequest::new("./models/llama-7b.gguf")
    .format("gguf")
    .id("llama-7b")
    .name("Llama 7B Model");

let response = client.load_model(load_request).await?;
if response.success {
    println!("Model loaded: {:?}", response.model);
}

// List models
let models = client.list_models(false).await?;
for model in models {
    println!("{}: {} ({})", model.id, 
             model.name.unwrap_or_else(|| "Unknown".to_string()),
             model.format.unwrap_or_else(|| "Unknown".to_string()));
}
```

### Streaming Inference

```rust
use futures::StreamExt;

let request = InferenceRequest::new("Tell me a story")
    .options(InferenceOptions::new()
        .max_tokens(200)
        .temperature(0.8)
        .stream(true));

let mut stream = client.stream_inference(request).await?;

while let Some(chunk_result) = stream.next().await {
    match chunk_result {
        Ok(chunk) => {
            print!("{}", chunk.token);
            if chunk.is_complete {
                println!("\nDone!");
                break;
            }
        }
        Err(e) => eprintln!("Stream error: {}", e),
    }
}
```

### Batch Inference

```rust
use llm_runner_router::BatchInferenceRequest;

let requests = vec![
    InferenceRequest::new("What is AI?"),
    InferenceRequest::new("What is ML?"),
    InferenceRequest::new("What is DL?"),
];

let batch_request = BatchInferenceRequest::new(requests)
    .max_concurrent(3)
    .timeout_ms(60000);

let response = client.batch_inference(batch_request).await?;
println!("Completed: {}/{}", response.successful_requests, response.total_requests);

for (i, result) in response.responses.iter().enumerate() {
    if result.success {
        println!("Response {}: {}", i + 1, result.text);
    }
}
```

### Error Handling

```rust
use llm_runner_router::{LLMRouterError, Result};

match client.quick_inference("Hello").await {
    Ok(response) => println!("Success: {}", response.text),
    Err(e) => match e {
        LLMRouterError::Network { message, .. } => {
            eprintln!("Network error: {}", message);
            if e.is_retryable() {
                eprintln!("Error is retryable");
            }
        }
        LLMRouterError::ModelNotFound { model_id } => {
            eprintln!("Model not found: {}", model_id);
        }
        LLMRouterError::Timeout { message, .. } => {
            eprintln!("Request timeout: {}", message);
        }
        _ => eprintln!("Other error: {}", e),
    }
}
```

### Custom Retry Logic

```rust
use llm_runner_router::utils::retry::{retry_with_config, RetryConfig};
use std::time::Duration;

let retry_config = RetryConfig::new()
    .max_retries(5)
    .base_delay(Duration::from_millis(500))
    .backoff_multiplier(1.5);

let result = retry_with_config(
    || client.quick_inference("Test prompt"),
    &retry_config,
).await?;
```

## Protocol Support

### gRPC Client

```rust
#[cfg(feature = "grpc")]
{
    let grpc_client = client.grpc_client().await?;
    let response = grpc_client.inference(request).await?;
}
```

### WebSocket Client

```rust
#[cfg(feature = "websocket")]
{
    let ws_client = client.websocket_client().await?;
    let response = ws_client.inference(request).await?;
}
```

## Node.js Integration

When built with the `napi-binding` feature, this crate can be used from Node.js:

```javascript
const { LLMRouterClient } = require('llm-runner-router-native');

const client = new LLMRouterClient('http://localhost:3000');
const response = await client.quickInference('Hello, world!');
console.log(response.text);
```

## Configuration Options

### RouterConfig

```rust
RouterConfig {
    base_url: String,              // REST API base URL
    grpc_url: Option<String>,      // gRPC server URL
    websocket_url: Option<String>, // WebSocket URL (auto-derived)
    timeout: Duration,             // Request timeout
    max_retries: u32,              // Maximum retry attempts
    retry_delay: Duration,         // Base retry delay
    api_key: Option<String>,       // Authentication key
    user_agent: String,            // User agent string
    connection_pool: ConnectionPoolConfig,
    rate_limit: RateLimitConfig,
    tls: TlsConfig,
}
```

### TLS Configuration

```rust
use llm_runner_router::config::TlsConfig;

let config = RouterConfig::new("https://secure-server:3000")
    .tls(TlsConfig {
        verify_ssl: true,
        ca_cert_path: Some("/path/to/ca.crt".to_string()),
        client_cert_path: Some("/path/to/client.crt".to_string()),
        client_key_path: Some("/path/to/client.key".to_string()),
    });
```

## Examples

Run the examples:

```bash
# Basic usage
cargo run --example basic_usage

# Streaming example
cargo run --example streaming --features websocket

# gRPC example
cargo run --example grpc_client --features grpc
```

## Testing

Run the test suite:

```bash
# All tests
cargo test

# HTTP tests only
cargo test --no-default-features --features http

# With all features
cargo test --all-features

# Integration tests
cargo test --test integration

# Benchmarks
cargo bench
```

## Performance

The Rust client is optimized for performance:

- **Zero-copy deserialization** where possible
- **Connection pooling** with configurable limits
- **Async I/O** with Tokio for high concurrency
- **Streaming** support for real-time responses
- **Efficient retry logic** with exponential backoff

Typical performance characteristics:
- ~1ms overhead for simple requests
- 10,000+ concurrent connections supported
- Sub-millisecond serialization/deserialization

## Error Types

Comprehensive error handling with context:

```rust
pub enum LLMRouterError {
    Network { message: String, source: Option<Box<dyn Error>> },
    Timeout { message: String, timeout_duration: Option<Duration> },
    RateLimit { message: String, retry_after: Option<Duration> },
    Authentication { message: String },
    Validation { message: String, field: Option<String> },
    ModelNotFound { model_id: String },
    Inference { message: String, model_id: Option<String> },
    // ... and more
}
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests: `cargo test`
5. Run clippy: `cargo clippy`
6. Format code: `cargo fmt`
7. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Links

- [Documentation](https://docs.rs/llm-runner-router)
- [Repository](https://github.com/MCERQUA/LLM-Runner-Router)
- [Issues](https://github.com/MCERQUA/LLM-Runner-Router/issues)
- [Crates.io](https://crates.io/crates/llm-runner-router)