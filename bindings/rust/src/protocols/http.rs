//! HTTP client implementation for LLM Router

use crate::{
    config::RouterConfig,
    error::{LLMRouterError, Result},
    models::*,
    utils::retry::retry_with_backoff,
};

use futures::{Stream, TryStreamExt};
use reqwest::{Client as ReqwestClient, ClientBuilder, Response};
use serde_json::Value;
use std::{collections::HashMap, sync::Arc, time::Duration};
use tokio::time::timeout;
use tracing::{debug, error, info, warn};

/// HTTP client for LLM Router REST API
#[derive(Debug, Clone)]
pub struct HttpClient {
    client: ReqwestClient,
    config: Arc<RouterConfig>,
    base_url: String,
}

impl HttpClient {
    /// Create a new HTTP client
    pub async fn new(config: Arc<RouterConfig>) -> Result<Self> {
        let mut headers = reqwest::header::HeaderMap::new();
        
        // Set default headers
        headers.insert(
            reqwest::header::CONTENT_TYPE,
            reqwest::header::HeaderValue::from_static("application/json"),
        );
        
        // Add authentication headers
        for (key, value) in config.get_auth_headers() {
            let header_name = reqwest::header::HeaderName::from_bytes(key.as_bytes())
                .map_err(|e| LLMRouterError::configuration(format!("Invalid header name: {}", e)))?;
            let header_value = reqwest::header::HeaderValue::from_str(&value)
                .map_err(|e| LLMRouterError::configuration(format!("Invalid header value: {}", e)))?;
            headers.insert(header_name, header_value);
        }

        let mut client_builder = ClientBuilder::new()
            .default_headers(headers)
            .timeout(config.timeout)
            .connect_timeout(config.connection_pool.connect_timeout)
            .pool_idle_timeout(Some(config.connection_pool.idle_timeout))
            .pool_max_idle_per_host(config.connection_pool.max_idle_connections);

        // Configure TLS
        if !config.tls.verify_ssl {
            client_builder = client_builder.danger_accept_invalid_certs(true);
        }

        let client = client_builder
            .build()
            .map_err(|e| LLMRouterError::configuration(format!("Failed to create HTTP client: {}", e)))?;

        let base_url = config.base_url.trim_end_matches('/').to_string();

        info!("HTTP client initialized for: {}", base_url);

        Ok(Self {
            client,
            config,
            base_url,
        })
    }

    /// Make a GET request with retry logic
    async fn get(&self, endpoint: &str, params: Option<&HashMap<String, String>>) -> Result<Value> {
        let url = format!("{}/api/v1/{}", self.base_url, endpoint.trim_start_matches('/'));
        
        retry_with_backoff(
            || async {
                let mut request = self.client.get(&url);
                
                if let Some(params) = params {
                    request = request.query(params);
                }
                
                let response = request.send().await?;
                self.handle_response(response).await
            },
            self.config.max_retries,
            self.config.retry_delay,
        ).await
    }

    /// Make a POST request with retry logic
    async fn post(&self, endpoint: &str, body: &Value) -> Result<Value> {
        let url = format!("{}/api/v1/{}", self.base_url, endpoint.trim_start_matches('/'));
        
        retry_with_backoff(
            || async {
                let response = self.client
                    .post(&url)
                    .json(body)
                    .send()
                    .await?;
                self.handle_response(response).await
            },
            self.config.max_retries,
            self.config.retry_delay,
        ).await
    }

    /// Handle HTTP response
    async fn handle_response(&self, response: Response) -> Result<Value> {
        let status = response.status();
        
        if status.is_success() {
            let body = response.text().await
                .map_err(|e| LLMRouterError::network("Failed to read response body", Some(e)))?;
            
            serde_json::from_str(&body)
                .map_err(|e| LLMRouterError::serialization("Failed to parse JSON response", Some(e)))
        } else {
            let body = response.text().await.ok();
            let error_message = body
                .as_ref()
                .and_then(|b| serde_json::from_str::<Value>(b).ok())
                .and_then(|v| v.get("error").and_then(|e| e.as_str()))
                .unwrap_or("Request failed");

            Err(LLMRouterError::http(
                status.as_u16(),
                error_message.to_string(),
                body,
            ))
        }
    }

    /// Health check
    pub async fn health_check(&self) -> Result<Value> {
        debug!("HTTP health check");
        self.get("health", None).await
    }

    /// Get system status
    pub async fn get_status(&self) -> Result<Value> {
        debug!("HTTP get status");
        self.get("status", None).await
    }

    /// Get system metrics
    pub async fn get_metrics(&self) -> Result<Value> {
        debug!("HTTP get metrics");
        self.get("metrics", None).await
    }

    /// List models
    pub async fn list_models(&self, include_unloaded: bool) -> Result<Vec<ModelInfo>> {
        debug!("HTTP list models");
        let mut params = HashMap::new();
        params.insert("include_unloaded".to_string(), include_unloaded.to_string());
        
        let response = self.get("models", Some(&params)).await?;
        let models = response
            .get("models")
            .and_then(|m| m.as_array())
            .ok_or_else(|| LLMRouterError::serialization("Invalid models response format", None))?;

        models
            .iter()
            .map(|model| {
                serde_json::from_value(model.clone())
                    .map_err(|e| LLMRouterError::serialization("Failed to parse model info", Some(e)))
            })
            .collect()
    }

    /// Get model information
    pub async fn get_model(&self, model_id: &str) -> Result<ModelInfo> {
        debug!("HTTP get model: {}", model_id);
        let endpoint = format!("models/{}", model_id);
        let response = self.get(&endpoint, None).await?;
        
        serde_json::from_value(response)
            .map_err(|e| LLMRouterError::serialization("Failed to parse model info", Some(e)))
    }

    /// Load a model
    pub async fn load_model(&self, request: LoadModelRequest) -> Result<LoadModelResponse> {
        debug!("HTTP load model: {}", request.source);
        let body = serde_json::to_value(&request)
            .map_err(|e| LLMRouterError::serialization("Failed to serialize load request", Some(e)))?;
        
        let response = self.post("models/load", &body).await?;
        
        serde_json::from_value(response)
            .map_err(|e| LLMRouterError::serialization("Failed to parse load response", Some(e)))
    }

    /// Unload a model
    pub async fn unload_model(&self, model_id: &str, force: bool) -> Result<Value> {
        debug!("HTTP unload model: {} (force: {})", model_id, force);
        let body = serde_json::json!({
            "model_id": model_id,
            "force": force
        });
        
        self.post("models/unload", &body).await
    }

    /// Perform inference
    pub async fn inference(&self, request: InferenceRequest) -> Result<InferenceResponse> {
        debug!("HTTP inference");
        let body = serde_json::to_value(&request)
            .map_err(|e| LLMRouterError::serialization("Failed to serialize inference request", Some(e)))?;
        
        let response = self.post("inference", &body).await?;
        
        serde_json::from_value(response)
            .map_err(|e| LLMRouterError::serialization("Failed to parse inference response", Some(e)))
    }

    /// Stream inference
    pub async fn stream_inference(
        &self,
        request: InferenceRequest,
    ) -> Result<impl Stream<Item = Result<StreamingResponse>>> {
        debug!("HTTP stream inference");
        let url = format!("{}/api/v1/inference/stream", self.base_url);
        
        let body = serde_json::to_value(&request)
            .map_err(|e| LLMRouterError::serialization("Failed to serialize stream request", Some(e)))?;

        let response = self.client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| LLMRouterError::network("Failed to start stream", Some(e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.ok();
            return Err(LLMRouterError::http(
                status.as_u16(),
                "Streaming request failed".to_string(),
                body,
            ));
        }

        let stream = response.bytes_stream().map_err(|e| {
            LLMRouterError::streaming(format!("Stream error: {}", e))
        });

        Ok(stream.and_then(|chunk| async move {
            let text = String::from_utf8(chunk.to_vec())
                .map_err(|e| LLMRouterError::streaming(format!("Invalid UTF-8 in stream: {}", e)))?;

            // Parse Server-Sent Events format
            for line in text.lines() {
                if let Some(data) = line.strip_prefix("data: ") {
                    let chunk: StreamingResponse = serde_json::from_str(data)
                        .map_err(|e| LLMRouterError::serialization("Failed to parse stream chunk", Some(e)))?;
                    return Ok(chunk);
                }
            }

            Err(LLMRouterError::streaming("No valid data in stream chunk"))
        }))
    }

    /// Batch inference
    pub async fn batch_inference(&self, request: BatchInferenceRequest) -> Result<BatchInferenceResponse> {
        debug!("HTTP batch inference with {} requests", request.requests.len());
        let body = serde_json::to_value(&request)
            .map_err(|e| LLMRouterError::serialization("Failed to serialize batch request", Some(e)))?;
        
        // Use longer timeout for batch requests
        let timeout_duration = Duration::from_millis(request.timeout_ms.unwrap_or(30000));
        
        let future = self.post("inference/batch", &body);
        let response = timeout(timeout_duration, future)
            .await
            .map_err(|_| LLMRouterError::timeout("Batch inference timeout", Some(timeout_duration)))?;
        
        let response = response?;
        
        serde_json::from_value(response)
            .map_err(|e| LLMRouterError::serialization("Failed to parse batch response", Some(e)))
    }

    /// Close the client
    pub async fn close(&self) -> Result<()> {
        debug!("Closing HTTP client");
        // reqwest::Client doesn't need explicit cleanup
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockito::{mock, server_url};

    async fn test_client() -> HttpClient {
        let config = Arc::new(RouterConfig::new(&server_url()));
        HttpClient::new(config).await.unwrap()
    }

    #[tokio::test]
    async fn test_health_check() {
        let _m = mock("GET", "/api/v1/health")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"status": "healthy"}"#)
            .create();

        let client = test_client().await;
        let result = client.health_check().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_list_models() {
        let _m = mock("GET", "/api/v1/models")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"models": [{"id": "test-model", "name": "Test Model", "loaded": true}]}"#)
            .create();

        let client = test_client().await;
        let result = client.list_models(false).await;
        assert!(result.is_ok());
        let models = result.unwrap();
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].id, "test-model");
    }

    #[tokio::test]
    async fn test_inference() {
        let _m = mock("POST", "/api/v1/inference")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"text": "Hello, world!", "success": true}"#)
            .create();

        let client = test_client().await;
        let request = InferenceRequest::new("Hello");
        let result = client.inference(request).await;
        assert!(result.is_ok());
        let response = result.unwrap();
        assert_eq!(response.text, "Hello, world!");
        assert!(response.success);
    }

    #[tokio::test]
    async fn test_error_handling() {
        let _m = mock("GET", "/api/v1/health")
            .with_status(500)
            .with_header("content-type", "application/json")
            .with_body(r#"{"error": "Internal server error"}"#)
            .create();

        let client = test_client().await;
        let result = client.health_check().await;
        assert!(result.is_err());
        
        if let Err(LLMRouterError::Http { status, message, .. }) = result {
            assert_eq!(status, 500);
            assert_eq!(message, "Internal server error");
        } else {
            panic!("Expected HTTP error");
        }
    }
}