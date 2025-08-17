#!/usr/bin/env rust

//! Basic usage examples for LLM Router Rust client

use llm_runner_router::{
    Client, RouterConfig, InferenceRequest, LoadModelRequest, InferenceOptions,
    Result, LLMRouterError,
};
use futures::StreamExt;
use tracing::{info, error};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    llm_runner_router::init_tracing();

    info!("Starting LLM Router Rust client examples");

    // Example 1: Basic client creation and health check
    basic_client_example().await?;

    // Example 2: Model management
    model_management_example().await?;

    // Example 3: Inference examples
    inference_examples().await?;

    // Example 4: Streaming inference
    streaming_example().await?;

    // Example 5: Batch inference
    batch_inference_example().await?;

    // Example 6: Error handling
    error_handling_example().await?;

    // Example 7: Configuration examples
    configuration_examples().await?;

    info!("All examples completed successfully!");
    Ok(())
}

async fn basic_client_example() -> Result<()> {
    info!("=== Basic Client Example ===");

    // Create client with default configuration
    let config = RouterConfig::new("http://localhost:3000");
    let client = Client::new(config).await?;

    // Health check
    info!("Performing health check...");
    match client.health_check().await {
        Ok(health) => info!("Health check result: {:?}", health),
        Err(e) => error!("Health check failed: {}", e),
    }

    // Get system status
    info!("Getting system status...");
    match client.get_status().await {
        Ok(status) => info!("System status: {:?}", status),
        Err(e) => error!("Failed to get status: {}", e),
    }

    // Get system metrics
    info!("Getting system metrics...");
    match client.get_metrics().await {
        Ok(metrics) => info!("System metrics: {:?}", metrics),
        Err(e) => error!("Failed to get metrics: {}", e),
    }

    // Clean up
    client.close().await?;
    
    Ok(())
}

async fn model_management_example() -> Result<()> {
    info!("=== Model Management Example ===");

    let config = RouterConfig::new("http://localhost:3000");
    let client = Client::new(config).await?;

    // List available models
    info!("Listing available models...");
    match client.list_models(false).await {
        Ok(models) => {
            info!("Found {} models:", models.len());
            for model in models {
                info!("  - {}: {} ({})", model.id, 
                      model.name.as_deref().unwrap_or("Unknown"), 
                      model.format.as_deref().unwrap_or("Unknown"));
            }
        }
        Err(e) => error!("Failed to list models: {}", e),
    }

    // Try to load a model (this will fail if the model doesn't exist)
    info!("Attempting to load a model...");
    let load_request = LoadModelRequest::new("./models/example-model.gguf")
        .format("gguf")
        .id("example-model")
        .name("Example GGUF Model");

    match client.load_model(load_request).await {
        Ok(response) => {
            if response.success {
                info!("Model loaded successfully: {:?}", response.model);
            } else {
                error!("Failed to load model: {}", response.error.unwrap_or("Unknown error".to_string()));
            }
        }
        Err(e) => error!("Load model request failed: {}", e),
    }

    client.close().await?;
    Ok(())
}

async fn inference_examples() -> Result<()> {
    info!("=== Inference Examples ===");

    let config = RouterConfig::new("http://localhost:3000");
    let client = Client::new(config).await?;

    // Set a session ID for tracking
    client.set_session_id("rust-example-session").await;

    // Quick inference
    info!("Running quick inference...");
    match client.quick_inference("What is the capital of France?").await {
        Ok(response) => {
            if response.success {
                info!("Quick inference result: {}", response.text);
            } else {
                error!("Quick inference failed: {}", response.error.unwrap_or("Unknown error".to_string()));
            }
        }
        Err(e) => error!("Quick inference request failed: {}", e),
    }

    // Inference with options
    info!("Running inference with custom options...");
    let options = InferenceOptions::new()
        .max_tokens(100)
        .temperature(0.8)
        .top_p(0.9);

    match client.quick_inference_with_options("Tell me a joke", options).await {
        Ok(response) => {
            if response.success {
                info!("Inference with options result: {}", response.text);
            } else {
                error!("Inference failed: {}", response.error.unwrap_or("Unknown error".to_string()));
            }
        }
        Err(e) => error!("Inference request failed: {}", e),
    }

    // Inference with specific model
    info!("Running inference with specific model...");
    let request = InferenceRequest::new("What is machine learning?")
        .model_id("example-model")
        .options(InferenceOptions::new().max_tokens(200));

    match client.inference(request).await {
        Ok(response) => {
            if response.success {
                info!("Model-specific inference result: {}", response.text);
            } else {
                error!("Model-specific inference failed: {}", response.error.unwrap_or("Unknown error".to_string()));
            }
        }
        Err(e) => error!("Model-specific inference request failed: {}", e),
    }

    client.close().await?;
    Ok(())
}

async fn streaming_example() -> Result<()> {
    info!("=== Streaming Inference Example ===");

    let config = RouterConfig::new("http://localhost:3000");
    let client = Client::new(config).await?;

    let request = InferenceRequest::new("Tell me a short story about a robot discovering emotions.")
        .options(InferenceOptions::new()
            .max_tokens(300)
            .temperature(0.8)
            .stream(true));

    info!("Starting streaming inference...");
    match client.stream_inference(request).await {
        Ok(mut stream) => {
            print!("Stream output: ");
            while let Some(chunk_result) = stream.next().await {
                match chunk_result {
                    Ok(chunk) => {
                        if !chunk.token.is_empty() {
                            print!("{}", chunk.token);
                        }
                        
                        if let Some(error) = chunk.error {
                            error!("Stream error: {}", error);
                            break;
                        }
                        
                        if chunk.is_complete {
                            println!("\nStream complete!");
                            break;
                        }
                    }
                    Err(e) => {
                        error!("Stream chunk error: {}", e);
                        break;
                    }
                }
            }
        }
        Err(e) => error!("Failed to start streaming: {}", e),
    }

    client.close().await?;
    Ok(())
}

async fn batch_inference_example() -> Result<()> {
    info!("=== Batch Inference Example ===");

    let config = RouterConfig::new("http://localhost:3000");
    let client = Client::new(config).await?;

    // Create multiple requests
    let requests = vec![
        InferenceRequest::new("What is the capital of France?"),
        InferenceRequest::new("What is the capital of Germany?"),
        InferenceRequest::new("What is the capital of Spain?"),
        InferenceRequest::new("What is the capital of Italy?"),
    ];

    let batch_request = llm_runner_router::BatchInferenceRequest::new(requests)
        .max_concurrent(2)
        .timeout_ms(60000);

    info!("Running batch inference with {} requests...", batch_request.requests.len());
    match client.batch_inference(batch_request).await {
        Ok(response) => {
            info!("Batch completed: {}/{} successful", 
                  response.successful_requests, response.total_requests);
            
            for (i, result) in response.responses.iter().enumerate() {
                if result.success {
                    info!("Response {}: {}", i + 1, result.text);
                } else {
                    error!("Response {} failed: {}", i + 1, 
                           result.error.as_deref().unwrap_or("Unknown error"));
                }
            }
        }
        Err(e) => error!("Batch inference failed: {}", e),
    }

    client.close().await?;
    Ok(())
}

async fn error_handling_example() -> Result<()> {
    info!("=== Error Handling Example ===");

    // Configure client with invalid URL to demonstrate error handling
    let config = RouterConfig::new("http://invalid-host:3000")
        .timeout(std::time::Duration::from_secs(5));
    
    let client = Client::new(config).await?;

    // This should fail with a network error
    info!("Attempting request to invalid host...");
    match client.health_check().await {
        Ok(_) => info!("Unexpected success!"),
        Err(e) => {
            match &e {
                LLMRouterError::Network { message, .. } => {
                    info!("Caught network error as expected: {}", message);
                }
                LLMRouterError::Timeout { message, .. } => {
                    info!("Caught timeout error: {}", message);
                }
                _ => {
                    info!("Caught other error: {}", e);
                }
            }
            
            // Check if error is retryable
            if e.is_retryable() {
                info!("Error is retryable");
                if let Some(delay) = e.retry_delay() {
                    info!("Suggested retry delay: {:?}", delay);
                }
            } else {
                info!("Error is not retryable");
            }
        }
    }

    // Try inference with non-existent model
    info!("Attempting inference with non-existent model...");
    let request = InferenceRequest::new("Hello").model_id("non-existent-model");
    
    match client.inference(request).await {
        Ok(_) => info!("Unexpected success!"),
        Err(e) => {
            match &e {
                LLMRouterError::ModelNotFound { model_id } => {
                    info!("Caught model not found error for: {}", model_id);
                }
                LLMRouterError::Http { status, message, .. } => {
                    info!("Caught HTTP error {}: {}", status, message);
                }
                _ => {
                    info!("Caught other error: {}", e);
                }
            }
        }
    }

    client.close().await?;
    Ok(())
}

async fn configuration_examples() -> Result<()> {
    info!("=== Configuration Examples ===");

    // Example 1: Configuration with all options
    let config = RouterConfig::new("http://localhost:3000")
        .timeout(std::time::Duration::from_secs(60))
        .max_retries(5)
        .api_key("your-api-key")
        .user_agent("rust-client/1.0");

    info!("Created config with custom settings");
    info!("  Base URL: {}", config.base_url);
    info!("  Timeout: {:?}", config.timeout);
    info!("  Max retries: {}", config.max_retries);

    // Example 2: Configuration from environment
    std::env::set_var("LLM_ROUTER_BASE_URL", "http://test-server:3000");
    std::env::set_var("LLM_ROUTER_API_KEY", "test-key");
    std::env::set_var("LLM_ROUTER_TIMEOUT", "30");

    match RouterConfig::from_env() {
        Ok(env_config) => {
            info!("Loaded config from environment:");
            info!("  Base URL: {}", env_config.base_url);
            info!("  Has API key: {}", env_config.api_key.is_some());
            info!("  Timeout: {:?}", env_config.timeout);
        }
        Err(e) => error!("Failed to load config from environment: {}", e),
    }

    // Example 3: TLS configuration
    let tls_config = RouterConfig::new("https://secure-server:3000")
        .tls(llm_runner_router::config::TlsConfig {
            verify_ssl: true,
            ca_cert_path: Some("/path/to/ca.pem".to_string()),
            client_cert_path: None,
            client_key_path: None,
        });

    info!("Created TLS config:");
    info!("  TLS enabled: {}", tls_config.is_tls_enabled());
    info!("  Verify SSL: {}", tls_config.tls.verify_ssl);

    Ok(())
}

// Chat completion example
#[allow(dead_code)]
async fn chat_completion_example() -> Result<()> {
    info!("=== Chat Completion Example ===");

    let config = RouterConfig::new("http://localhost:3000");
    let client = Client::new(config).await?;

    let messages = vec![
        llm_runner_router::ChatMessage::system("You are a helpful assistant."),
        llm_runner_router::ChatMessage::user("What is the difference between AI and ML?"),
    ];

    let options = InferenceOptions::new()
        .max_tokens(200)
        .temperature(0.7);

    match client.chat_completion(messages, None, Some(options)).await {
        Ok(response) => {
            if response.success {
                info!("Chat completion result: {}", response.text);
            } else {
                error!("Chat completion failed: {}", response.error.unwrap_or("Unknown error".to_string()));
            }
        }
        Err(e) => error!("Chat completion request failed: {}", e),
    }

    client.close().await?;
    Ok(())
}