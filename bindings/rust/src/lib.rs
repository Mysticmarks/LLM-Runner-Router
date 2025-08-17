//! # LLM Runner Router - Rust Client
//!
//! A comprehensive Rust client library for the LLM Runner Router system,
//! providing async/await support, proper error handling, and high performance.
//!
//! ## Features
//!
//! - 🚀 **Async/Await Support** - Built with Tokio for high-performance async I/O
//! - 🔒 **Type Safety** - Strong typing with comprehensive error handling
//! - 🌐 **Multiple Protocols** - HTTP REST, gRPC, and WebSocket support
//! - 🛡️ **Error Handling** - Comprehensive error types with context
//! - 🔄 **Retry Logic** - Built-in retries with exponential backoff
//! - 🎛️ **Rate Limiting** - Client-side rate limiting with governor
//! - 📊 **Streaming** - Real-time token streaming with futures
//! - 🧪 **Testing** - Extensive test suite with mocks
//! - 🔗 **FFI Support** - Node.js bindings for JavaScript integration
//!
//! ## Quick Start
//!
//! ```rust
//! use llm_runner_router::{Client, InferenceRequest, RouterConfig};
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let config = RouterConfig::new("http://localhost:3000");
//!     let client = Client::new(config).await?;
//!     
//!     let response = client.quick_inference("What is the capital of France?").await?;
//!     println!("Response: {}", response.text);
//!     
//!     Ok(())
//! }
//! ```

pub mod client;
pub mod config;
pub mod error;
pub mod models;
pub mod protocols;
pub mod utils;

#[cfg(feature = "napi-binding")]
pub mod node_bindings;

// Re-export main types
pub use client::Client;
pub use config::RouterConfig;
pub use error::{LLMRouterError, Result};
pub use models::{
    InferenceRequest, InferenceResponse, InferenceOptions, LoadModelRequest,
    LoadModelResponse, ModelInfo, StreamingResponse, BatchInferenceRequest,
    BatchInferenceResponse, ChatMessage, HealthStatus, SystemMetrics,
};

#[cfg(feature = "grpc")]
pub use protocols::grpc::GrpcClient;

#[cfg(feature = "websocket")]
pub use protocols::websocket::WebSocketClient;

// Version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const NAME: &str = env!("CARGO_PKG_NAME");

/// Initialize tracing for the library
pub fn init_tracing() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
}