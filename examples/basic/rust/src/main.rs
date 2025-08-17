//! Basic Rust example demonstrating LLM Router usage
//!
//! This example shows:
//! - Client initialization and configuration
//! - Basic and advanced inference requests
//! - Error handling with proper types
//! - Resource cleanup and performance monitoring
//! - Async/await patterns with Tokio

use llm_runner_router::{
    Client, RouterConfig, InferenceRequest, InferenceOptions, LoadModelRequest,
    LLMRouterError, Result,
};
use std::time::{Duration, Instant};
use tokio::time::timeout;
use tracing::{info, warn, error, debug};
use tracing_subscriber::{EnvFilter, FmtSubscriber};

/// Initialize logging
fn init_logging() {
    let subscriber = FmtSubscriber::builder()
        .with_env_filter(EnvFilter::from_default_env().add_directive("info".parse().unwrap()))
        .with_target(false)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true)
        .finish();
    
    tracing::subscriber::set_global_default(subscriber)
        .expect("Failed to set tracing subscriber");
}

/// Basic inference example
async fn basic_inference_example() -> Result<()> {
    info!("🚀 LLM Router Rust Basic Example");
    println!();
    
    // Configure the client
    let config = RouterConfig::new("http://localhost:3000")
        .timeout(Duration::from_secs(30))
        .max_retries(3)
        .user_agent("rust-example/1.0");
    
    info!("📚 Initializing client...");
    let start_time = Instant::now();
    
    let client = Client::new(config).await?;
    
    let init_duration = start_time.elapsed();
    info!("✅ Client initialized in {:?}", init_duration);
    println!();
    
    // Check server health
    info!("🏥 Checking server health...");
    match client.health_check().await {
        Ok(health) => {
            info!("   Status: {:?}", health.status);
            info!("   Models: {:?}", health.models_loaded);
            info!("   Engine: {:?}", health.engine);
        }
        Err(e) => {
            warn!("   Could not get health status: {}", e);
        }
    }
    println!();
    
    // Basic inference
    info!("🤖 Running basic inference...");
    let inference_start = Instant::now();
    
    let response = client
        .quick_inference("What is machine learning and how does it work?")
        .await?;
    
    let inference_duration = inference_start.elapsed();
    
    info!("📝 Response:");
    info!("   Text: {}", response.text);
    info!("   Model: {}", response.model.unwrap_or_else(|| "unknown".to_string()));
    info!("   Time: {:?}", inference_duration);
    info!("   Success: {}", response.success);
    println!();
    
    // Advanced inference with custom options
    info!("🎛️ Running advanced inference...");
    let advanced_start = Instant::now();
    
    let request = InferenceRequest::new("Explain the benefits of Rust over other programming languages")
        .options(InferenceOptions::new()
            .max_tokens(200)
            .temperature(0.6)
            .top_p(0.9)
            .top_k(40)
            .stream(false));
    
    let advanced_response = client.inference(request).await?;
    let advanced_duration = advanced_start.elapsed();
    
    info!("📝 Advanced Response:");
    info!("   Text: {}", advanced_response.text);
    info!("   Model: {}", advanced_response.model.unwrap_or_else(|| "unknown".to_string()));
    info!("   Time: {:?}", advanced_duration);
    if let Some(usage) = &advanced_response.usage {
        info!("   Tokens: {}", usage.total_tokens.unwrap_or(0));
    }
    println!();
    
    Ok(())
}

/// Model management example
async fn model_management_example(client: &Client) -> Result<()> {
    info!("📋 Model Management Example");
    
    // List available models
    info!("📋 Listing available models...");
    match client.list_models(true).await {
        Ok(models) => {
            for (i, model) in models.iter().enumerate() {
                let status = if model.loaded.unwrap_or(false) { "✅ loaded" } else { "⏳ available" };
                info!("   {}. {} ({}) - {}", 
                      i + 1, 
                      model.name.as_ref().unwrap_or(&model.id), 
                      model.format.as_ref().unwrap_or(&"unknown".to_string()),
                      status);
            }
        }
        Err(e) => {
            warn!("   Could not list models: {}", e);
        }
    }
    println!();
    
    // Attempt to load a simple model (this might fail if not available)
    info!("🔄 Attempting to load a test model...");
    let load_request = LoadModelRequest::new("simple")
        .format("simple")
        .id("test-model")
        .name("Test Model");
    
    match client.load_model(load_request).await {
        Ok(response) => {
            if response.success {
                info!("✅ Model loaded successfully: {:?}", response.model);
            } else {
                warn!("⚠️  Model load reported failure: {}", response.error.unwrap_or_else(|| "unknown".to_string()));
            }
        }
        Err(e) => {
            debug!("   Model load failed (expected): {}", e);
        }
    }
    println!();
    
    Ok(())
}

/// Streaming inference example
async fn streaming_example(client: &Client) -> Result<()> {
    info!("🌊 Streaming Inference Example");
    
    let request = InferenceRequest::new("Tell me a short story about artificial intelligence")
        .options(InferenceOptions::new()
            .max_tokens(100)
            .temperature(0.8)
            .stream(true));
    
    info!("🤖 Starting streaming inference...");
    print!("📝 Response: ");
    
    use futures::StreamExt;
    
    let mut stream = client.stream_inference(request).await?;
    
    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(chunk) => {
                if let Some(token) = &chunk.token {
                    print!("{}", token);
                    std::io::Write::flush(&mut std::io::stdout()).unwrap();
                }
                if chunk.is_complete {
                    println!();
                    info!("✅ Streaming complete!");
                    break;
                }
            }
            Err(e) => {
                error!("❌ Streaming error: {}", e);
                break;
            }
        }
    }
    println!();
    
    Ok(())
}

/// Error handling demonstration
async fn error_handling_example(client: &Client) -> Result<()> {
    info!("🔧 Error Handling Example");
    
    // Test with nonexistent model
    info!("Testing error handling with nonexistent model...");
    let result = client
        .quick_inference("Test prompt")
        .await;
    
    match result {
        Ok(response) => {
            info!("   Unexpected success: {}", response.text);
        }
        Err(e) => {
            match e {
                LLMRouterError::ModelNotFound { model_id } => {
                    info!("   ✅ Correctly caught ModelNotFound error for: {}", model_id);
                }
                LLMRouterError::Network { message, .. } => {
                    info!("   ✅ Network error (expected): {}", message);
                }
                LLMRouterError::Timeout { message, .. } => {
                    info!("   ✅ Timeout error: {}", message);
                }
                _ => {
                    info!("   ⚠️  Other error: {}", e);
                }
            }
        }
    }
    println!();
    
    Ok(())
}

/// Performance monitoring
fn monitor_performance() {
    info!("📊 Performance Metrics:");
    
    // Memory usage (basic)
    use std::alloc::{GlobalAlloc, Layout, System};
    
    // Note: This is a simplified example. In a real application,
    // you'd use more sophisticated profiling tools.
    
    #[cfg(target_os = "linux")]
    {
        if let Ok(status) = std::fs::read_to_string("/proc/self/status") {
            for line in status.lines() {
                if line.starts_with("VmRSS:") {
                    info!("   Memory RSS: {}", line.trim_start_matches("VmRSS:").trim());
                    break;
                }
            }
        }
    }
    
    #[cfg(not(target_os = "linux"))]
    {
        info!("   Memory monitoring not implemented for this platform");
    }
    
    // Thread count
    let thread_count = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1);
    info!("   Available threads: {}", thread_count);
}

/// Timeout example
async fn timeout_example(client: &Client) -> Result<()> {
    info!("⏱️  Timeout Example");
    
    info!("Testing request with short timeout...");
    let short_timeout = Duration::from_millis(100);
    
    let result = timeout(
        short_timeout,
        client.quick_inference("This is a test prompt that might timeout")
    ).await;
    
    match result {
        Ok(Ok(response)) => {
            info!("   ✅ Request completed within timeout: {}", 
                  response.text.chars().take(50).collect::<String>());
        }
        Ok(Err(e)) => {
            info!("   ⚠️  Request failed: {}", e);
        }
        Err(_) => {
            info!("   ✅ Request timed out as expected");
        }
    }
    println!();
    
    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    init_logging();
    
    println!("=" .repeat(60));
    println!("🦀 LLM Router Rust Examples");
    println!("=" .repeat(60));
    println!();
    
    let overall_start = Instant::now();
    
    // Configure client once
    let config = RouterConfig::new("http://localhost:3000")
        .timeout(Duration::from_secs(30))
        .max_retries(3)
        .user_agent("rust-example/1.0");
    
    let client = match Client::new(config).await {
        Ok(client) => client,
        Err(e) => {
            error!("❌ Failed to create client: {}", e);
            
            // Provide helpful tips based on error type
            match e {
                LLMRouterError::Network { .. } => {
                    info!("💡 Tip: Make sure the LLM Router server is running on http://localhost:3000");
                }
                LLMRouterError::Timeout { .. } => {
                    info!("💡 Tip: Check if the server is responding or increase timeout");
                }
                _ => {
                    info!("💡 Tip: Check server configuration and network connectivity");
                }
            }
            
            return Err(e);
        }
    };
    
    // Run examples
    let examples = vec![
        ("Basic Inference", basic_inference_example()),
        ("Model Management", model_management_example(&client)),
        ("Streaming", streaming_example(&client)),
        ("Error Handling", error_handling_example(&client)),
        ("Timeout Handling", timeout_example(&client)),
    ];
    
    for (name, example) in examples {
        info!("Running {} example...", name);
        if let Err(e) = example.await {
            warn!("Example '{}' failed: {}", name, e);
        }
        println!("{}", "-".repeat(40));
        println!();
    }
    
    // Performance monitoring
    monitor_performance();
    
    // Cleanup
    info!("🧹 Cleaning up resources...");
    if let Err(e) = client.close().await {
        warn!("⚠️  Warning: Failed to cleanup client: {}", e);
    } else {
        info!("✅ Resources cleaned up successfully");
    }
    
    let total_duration = overall_start.elapsed();
    info!("🎉 All examples completed in {:?}!", total_duration);
    
    Ok(())
}