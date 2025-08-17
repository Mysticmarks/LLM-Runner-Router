//! Main client implementation for LLM Router

use crate::{
    config::RouterConfig,
    error::{LLMRouterError, Result},
    models::*,
    protocols::http::HttpClient,
};

#[cfg(feature = "grpc")]
use crate::protocols::grpc::GrpcClient;

#[cfg(feature = "websocket")]
use crate::protocols::websocket::WebSocketClient;

use futures::Stream;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// Main LLM Router client with support for multiple protocols
#[derive(Debug, Clone)]
pub struct Client {
    config: Arc<RouterConfig>,
    http_client: Arc<HttpClient>,
    #[cfg(feature = "grpc")]
    grpc_client: Arc<RwLock<Option<GrpcClient>>>,
    #[cfg(feature = "websocket")]
    websocket_client: Arc<RwLock<Option<WebSocketClient>>>,
    session_id: Arc<RwLock<Option<String>>>,
}

impl Client {
    /// Create a new client with the given configuration
    pub async fn new(config: RouterConfig) -> Result<Self> {
        config.validate()?;
        
        let config = Arc::new(config);
        let http_client = Arc::new(HttpClient::new(config.clone()).await?);
        
        let client = Self {
            config: config.clone(),
            http_client,
            #[cfg(feature = "grpc")]
            grpc_client: Arc::new(RwLock::new(None)),
            #[cfg(feature = "websocket")]
            websocket_client: Arc::new(RwLock::new(None)),
            session_id: Arc::new(RwLock::new(None)),
        };

        info!("LLM Router client created with base URL: {}", client.config.base_url);
        Ok(client)
    }

    /// Create a client with default configuration
    pub async fn with_defaults() -> Result<Self> {
        Self::new(RouterConfig::default()).await
    }

    /// Create a client from environment variables
    pub async fn from_env() -> Result<Self> {
        let config = RouterConfig::from_env()?;
        Self::new(config).await
    }

    /// Get the current configuration
    pub fn config(&self) -> &RouterConfig {
        &self.config
    }

    /// Set session ID for request tracking
    pub async fn set_session_id(&self, session_id: impl Into<String>) {
        let session_id = session_id.into();
        debug!("Setting session ID: {}", session_id);
        *self.session_id.write().await = Some(session_id);
    }

    /// Clear the session ID
    pub async fn clear_session(&self) {
        debug!("Clearing session ID");
        *self.session_id.write().await = None;
    }

    /// Get the current session ID
    pub async fn get_session_id(&self) -> Option<String> {
        self.session_id.read().await.clone()
    }

    /// Check server health
    pub async fn health_check(&self) -> Result<serde_json::Value> {
        debug!("Performing health check");
        self.http_client.health_check().await
    }

    /// Get system status
    pub async fn get_status(&self) -> Result<serde_json::Value> {
        debug!("Getting system status");
        self.http_client.get_status().await
    }

    /// Get system metrics
    pub async fn get_metrics(&self) -> Result<SystemMetrics> {
        debug!("Getting system metrics");
        let data = self.http_client.get_metrics().await?;
        serde_json::from_value(data).map_err(|e| LLMRouterError::serialization("Failed to parse metrics", Some(e)))
    }

    /// List available models
    pub async fn list_models(&self, include_unloaded: bool) -> Result<Vec<ModelInfo>> {
        debug!("Listing models (include_unloaded: {})", include_unloaded);
        self.http_client.list_models(include_unloaded).await
    }

    /// Get information about a specific model
    pub async fn get_model(&self, model_id: &str) -> Result<ModelInfo> {
        debug!("Getting model info for: {}", model_id);
        self.http_client.get_model(model_id).await
    }

    /// Load a model
    pub async fn load_model(&self, request: LoadModelRequest) -> Result<LoadModelResponse> {
        info!("Loading model from: {}", request.source);
        self.http_client.load_model(request).await
    }

    /// Unload a model
    pub async fn unload_model(&self, model_id: &str, force: bool) -> Result<serde_json::Value> {
        info!("Unloading model: {} (force: {})", model_id, force);
        self.http_client.unload_model(model_id, force).await
    }

    /// Perform inference
    pub async fn inference(&self, mut request: InferenceRequest) -> Result<InferenceResponse> {
        // Add session ID if available
        if request.session_id.is_none() {
            request.session_id = self.get_session_id().await;
        }

        debug!("Running inference with model: {:?}", request.model_id);
        self.http_client.inference(request).await
    }

    /// Quick inference with minimal setup
    pub async fn quick_inference(&self, prompt: impl Into<String>) -> Result<InferenceResponse> {
        let request = InferenceRequest::new(prompt);
        self.inference(request).await
    }

    /// Quick inference with options
    pub async fn quick_inference_with_options(
        &self,
        prompt: impl Into<String>,
        options: InferenceOptions,
    ) -> Result<InferenceResponse> {
        let request = InferenceRequest::new(prompt).options(options);
        self.inference(request).await
    }

    /// Stream inference tokens
    pub async fn stream_inference(
        &self,
        mut request: InferenceRequest,
    ) -> Result<impl Stream<Item = Result<StreamingResponse>>> {
        // Ensure streaming is enabled
        if let Some(ref mut options) = request.options {
            options.stream = Some(true);
        } else {
            request.options = Some(InferenceOptions::new().stream(true));
        }

        // Add session ID if available
        if request.session_id.is_none() {
            request.session_id = self.get_session_id().await;
        }

        debug!("Starting streaming inference with model: {:?}", request.model_id);
        self.http_client.stream_inference(request).await
    }

    /// Perform batch inference
    pub async fn batch_inference(&self, request: BatchInferenceRequest) -> Result<BatchInferenceResponse> {
        info!("Running batch inference with {} requests", request.requests.len());
        self.http_client.batch_inference(request).await
    }

    /// Chat completion interface
    pub async fn chat_completion(
        &self,
        messages: Vec<ChatMessage>,
        model_id: Option<String>,
        options: Option<InferenceOptions>,
    ) -> Result<InferenceResponse> {
        // Convert messages to a single prompt (simplified approach)
        let prompt = messages
            .iter()
            .map(|msg| format!("{}: {}", msg.role, msg.content))
            .collect::<Vec<_>>()
            .join("\n");

        let mut request = InferenceRequest::new(prompt);
        if let Some(model_id) = model_id {
            request = request.model_id(model_id);
        }
        if let Some(options) = options {
            request = request.options(options);
        }

        self.inference(request).await
    }

    /// Get gRPC client (if enabled)
    #[cfg(feature = "grpc")]
    pub async fn grpc_client(&self) -> Result<GrpcClient> {
        let mut client_guard = self.grpc_client.write().await;
        
        if client_guard.is_none() {
            info!("Initializing gRPC client");
            let grpc_client = GrpcClient::new(self.config.clone()).await?;
            *client_guard = Some(grpc_client);
        }
        
        Ok(client_guard.as_ref().unwrap().clone())
    }

    /// Get WebSocket client (if enabled)
    #[cfg(feature = "websocket")]
    pub async fn websocket_client(&self) -> Result<WebSocketClient> {
        let mut client_guard = self.websocket_client.write().await;
        
        if client_guard.is_none() {
            info!("Initializing WebSocket client");
            let ws_client = WebSocketClient::new(self.config.clone()).await?;
            *client_guard = Some(ws_client);
        }
        
        Ok(client_guard.as_ref().unwrap().clone())
    }

    /// Close all connections
    pub async fn close(&self) -> Result<()> {
        info!("Closing LLM Router client connections");

        #[cfg(feature = "grpc")]
        {
            if let Some(grpc_client) = self.grpc_client.write().await.take() {
                grpc_client.close().await?;
            }
        }

        #[cfg(feature = "websocket")]
        {
            if let Some(ws_client) = self.websocket_client.write().await.take() {
                ws_client.close().await?;
            }
        }

        self.http_client.close().await?;
        info!("All connections closed");
        Ok(())
    }
}

// Implement Drop to ensure cleanup
impl Drop for Client {
    fn drop(&mut self) {
        // Note: This is a best-effort cleanup since we can't await in Drop
        // Users should call close() explicitly for proper cleanup
        warn!("Client dropped - connections may not be properly closed");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio_test;

    #[tokio::test]
    async fn test_client_creation() {
        let config = RouterConfig::new("http://localhost:3000");
        let client = Client::new(config).await;
        assert!(client.is_ok());
    }

    #[tokio::test]
    async fn test_session_management() {
        let config = RouterConfig::new("http://localhost:3000");
        let client = Client::new(config).await.unwrap();

        assert!(client.get_session_id().await.is_none());

        client.set_session_id("test-session").await;
        assert_eq!(client.get_session_id().await, Some("test-session".to_string()));

        client.clear_session().await;
        assert!(client.get_session_id().await.is_none());
    }

    #[tokio::test]
    async fn test_inference_request_creation() {
        let request = InferenceRequest::new("Test prompt")
            .model_id("test-model")
            .options(InferenceOptions::new().max_tokens(100));

        assert_eq!(request.prompt, "Test prompt");
        assert_eq!(request.model_id, Some("test-model".to_string()));
        assert_eq!(request.options.unwrap().max_tokens, Some(100));
    }
}