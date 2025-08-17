//! Data models for LLM Router client

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

/// Health status enumeration
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum HealthStatus {
    Unknown,
    Healthy,
    Unhealthy,
    Degraded,
    Maintenance,
}

impl Default for HealthStatus {
    fn default() -> Self {
        Self::Unknown
    }
}

/// Options for inference requests
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct InferenceOptions {
    /// Maximum number of tokens to generate
    pub max_tokens: Option<u32>,
    /// Sampling temperature (0.0 to 2.0)
    pub temperature: Option<f32>,
    /// Top-p nucleus sampling (0.0 to 1.0)
    pub top_p: Option<f32>,
    /// Top-k sampling
    pub top_k: Option<u32>,
    /// Frequency penalty (-2.0 to 2.0)
    pub frequency_penalty: Option<f32>,
    /// Presence penalty (-2.0 to 2.0)
    pub presence_penalty: Option<f32>,
    /// Stop sequences
    pub stop_sequences: Option<Vec<String>>,
    /// Enable streaming
    pub stream: Option<bool>,
    /// Random seed
    pub seed: Option<u32>,
}

impl Default for InferenceOptions {
    fn default() -> Self {
        Self {
            max_tokens: Some(500),
            temperature: Some(0.7),
            top_p: Some(1.0),
            top_k: None,
            frequency_penalty: Some(0.0),
            presence_penalty: Some(0.0),
            stop_sequences: None,
            stream: Some(false),
            seed: None,
        }
    }
}

impl InferenceOptions {
    /// Create new inference options with defaults
    pub fn new() -> Self {
        Self::default()
    }

    /// Set maximum tokens
    pub fn max_tokens(mut self, max_tokens: u32) -> Self {
        self.max_tokens = Some(max_tokens);
        self
    }

    /// Set temperature
    pub fn temperature(mut self, temperature: f32) -> Self {
        self.temperature = Some(temperature.clamp(0.0, 2.0));
        self
    }

    /// Set top-p
    pub fn top_p(mut self, top_p: f32) -> Self {
        self.top_p = Some(top_p.clamp(0.0, 1.0));
        self
    }

    /// Set top-k
    pub fn top_k(mut self, top_k: u32) -> Self {
        self.top_k = Some(top_k);
        self
    }

    /// Enable streaming
    pub fn stream(mut self, stream: bool) -> Self {
        self.stream = Some(stream);
        self
    }

    /// Set seed
    pub fn seed(mut self, seed: u32) -> Self {
        self.seed = Some(seed);
        self
    }

    /// Add stop sequence
    pub fn stop_sequence(mut self, sequence: impl Into<String>) -> Self {
        if let Some(ref mut sequences) = self.stop_sequences {
            sequences.push(sequence.into());
        } else {
            self.stop_sequences = Some(vec![sequence.into()]);
        }
        self
    }
}

/// Inference metrics
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct InferenceMetrics {
    /// Latency in milliseconds
    pub latency_ms: Option<u64>,
    /// Number of tokens generated
    pub tokens_generated: Option<u32>,
    /// Tokens per second
    pub tokens_per_second: Option<f64>,
    /// Memory used in bytes
    pub memory_used: Option<u64>,
    /// Processing time in milliseconds
    pub processing_time: Option<u64>,
    /// Queue time in milliseconds
    pub queue_time: Option<u64>,
}

/// Information about a model
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ModelInfo {
    /// Model ID
    pub id: String,
    /// Model name
    pub name: Option<String>,
    /// Model format (gguf, onnx, etc.)
    pub format: Option<String>,
    /// Model source path or URL
    pub source: Option<String>,
    /// Whether the model is loaded
    pub loaded: bool,
    /// Load time in milliseconds
    pub load_time: Option<u64>,
    /// Memory usage in bytes
    pub memory_usage: Option<u64>,
    /// Model parameters
    pub parameters: Option<HashMap<String, serde_json::Value>>,
    /// Model version
    pub version: Option<String>,
    /// Model capabilities
    pub capabilities: Option<Vec<String>>,
}

/// Model metrics
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ModelMetrics {
    /// Model ID
    pub model_id: String,
    /// Total requests processed
    pub total_requests: Option<u64>,
    /// Total tokens generated
    pub total_tokens: Option<u64>,
    /// Average latency in milliseconds
    pub average_latency: Option<f64>,
    /// Tokens per second
    pub tokens_per_second: Option<f64>,
    /// Memory usage in bytes
    pub memory_usage: Option<u64>,
    /// CPU usage percentage
    pub cpu_usage: Option<f64>,
    /// Last used timestamp
    pub last_used: Option<DateTime<Utc>>,
    /// Error rate (0.0 to 1.0)
    pub error_rate: Option<f64>,
}

/// System-wide metrics
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SystemMetrics {
    /// CPU usage percentage
    pub cpu_usage: Option<f64>,
    /// Memory usage in bytes
    pub memory_usage: Option<u64>,
    /// Total memory in bytes
    pub memory_total: Option<u64>,
    /// Disk usage in bytes
    pub disk_usage: Option<u64>,
    /// Total disk space in bytes
    pub disk_total: Option<u64>,
    /// Active connections
    pub active_connections: Option<u32>,
    /// Uptime in seconds
    pub uptime_seconds: Option<u64>,
    /// Load average
    pub load_average: Option<f64>,
}

/// Chat message
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatMessage {
    /// Message role (user, assistant, system)
    pub role: String,
    /// Message content
    pub content: String,
    /// Additional metadata
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    /// Timestamp
    pub timestamp: Option<DateTime<Utc>>,
}

impl ChatMessage {
    /// Create a user message
    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: "user".to_string(),
            content: content.into(),
            metadata: None,
            timestamp: Some(Utc::now()),
        }
    }

    /// Create an assistant message
    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: "assistant".to_string(),
            content: content.into(),
            metadata: None,
            timestamp: Some(Utc::now()),
        }
    }

    /// Create a system message
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: "system".to_string(),
            content: content.into(),
            metadata: None,
            timestamp: Some(Utc::now()),
        }
    }
}

/// Request for inference
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct InferenceRequest {
    /// Input prompt
    pub prompt: String,
    /// Model ID to use
    pub model_id: Option<String>,
    /// Inference options
    pub options: Option<InferenceOptions>,
    /// Additional metadata
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    /// Session ID for tracking
    pub session_id: Option<String>,
}

impl InferenceRequest {
    /// Create a new inference request
    pub fn new(prompt: impl Into<String>) -> Self {
        Self {
            prompt: prompt.into(),
            model_id: None,
            options: None,
            metadata: None,
            session_id: None,
        }
    }

    /// Set model ID
    pub fn model_id(mut self, model_id: impl Into<String>) -> Self {
        self.model_id = Some(model_id.into());
        self
    }

    /// Set options
    pub fn options(mut self, options: InferenceOptions) -> Self {
        self.options = Some(options);
        self
    }

    /// Set session ID
    pub fn session_id(mut self, session_id: impl Into<String>) -> Self {
        self.session_id = Some(session_id.into());
        self
    }

    /// Add metadata
    pub fn metadata(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        if let Some(ref mut metadata) = self.metadata {
            metadata.insert(key.into(), value);
        } else {
            let mut metadata = HashMap::new();
            metadata.insert(key.into(), value);
            self.metadata = Some(metadata);
        }
        self
    }
}

/// Response from inference
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct InferenceResponse {
    /// Generated text
    pub text: String,
    /// Model ID used
    pub model_id: Option<String>,
    /// Inference metrics
    pub metrics: Option<InferenceMetrics>,
    /// Whether the request was successful
    pub success: bool,
    /// Error message if any
    pub error: Option<String>,
    /// Additional metadata
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Streaming response chunk
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StreamingResponse {
    /// Token text
    pub token: String,
    /// Whether this is the final chunk
    pub is_complete: bool,
    /// Model ID used
    pub model_id: Option<String>,
    /// Inference metrics
    pub metrics: Option<InferenceMetrics>,
    /// Error message if any
    pub error: Option<String>,
}

/// Request to load a model
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LoadModelRequest {
    /// Model source (file path or URL)
    pub source: String,
    /// Model format
    pub format: Option<String>,
    /// Model ID
    pub id: Option<String>,
    /// Model name
    pub name: Option<String>,
    /// Model parameters
    pub parameters: Option<HashMap<String, serde_json::Value>>,
    /// Force reload if already loaded
    pub force_reload: bool,
}

impl LoadModelRequest {
    /// Create a new load model request
    pub fn new(source: impl Into<String>) -> Self {
        Self {
            source: source.into(),
            format: None,
            id: None,
            name: None,
            parameters: None,
            force_reload: false,
        }
    }

    /// Set format
    pub fn format(mut self, format: impl Into<String>) -> Self {
        self.format = Some(format.into());
        self
    }

    /// Set ID
    pub fn id(mut self, id: impl Into<String>) -> Self {
        self.id = Some(id.into());
        self
    }

    /// Set name
    pub fn name(mut self, name: impl Into<String>) -> Self {
        self.name = Some(name.into());
        self
    }

    /// Force reload
    pub fn force_reload(mut self, force: bool) -> Self {
        self.force_reload = force;
        self
    }
}

/// Response from loading a model
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LoadModelResponse {
    /// Whether the operation was successful
    pub success: bool,
    /// Status message
    pub message: Option<String>,
    /// Loaded model information
    pub model: Option<ModelInfo>,
    /// Error message if any
    pub error: Option<String>,
}

/// Request for batch inference
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BatchInferenceRequest {
    /// List of inference requests
    pub requests: Vec<InferenceRequest>,
    /// Maximum concurrent requests
    pub max_concurrent: Option<u32>,
    /// Timeout in milliseconds
    pub timeout_ms: Option<u64>,
    /// Fail fast on first error
    pub fail_fast: bool,
    /// Request priority
    pub priority: Option<String>,
}

impl BatchInferenceRequest {
    /// Create a new batch inference request
    pub fn new(requests: Vec<InferenceRequest>) -> Self {
        Self {
            requests,
            max_concurrent: Some(5),
            timeout_ms: Some(30000),
            fail_fast: false,
            priority: None,
        }
    }

    /// Set maximum concurrent requests
    pub fn max_concurrent(mut self, max_concurrent: u32) -> Self {
        self.max_concurrent = Some(max_concurrent);
        self
    }

    /// Set timeout
    pub fn timeout_ms(mut self, timeout_ms: u64) -> Self {
        self.timeout_ms = Some(timeout_ms);
        self
    }

    /// Set fail fast behavior
    pub fn fail_fast(mut self, fail_fast: bool) -> Self {
        self.fail_fast = fail_fast;
        self
    }
}

/// Response from batch inference
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BatchInferenceResponse {
    /// List of responses
    pub responses: Vec<InferenceResponse>,
    /// Total number of requests
    pub total_requests: u32,
    /// Number of successful requests
    pub successful_requests: u32,
    /// Number of failed requests
    pub failed_requests: u32,
    /// Total processing time in milliseconds
    pub total_time_ms: Option<u64>,
    /// Average latency in milliseconds
    pub average_latency_ms: Option<f64>,
    /// Whether the batch was successful
    pub success: bool,
    /// Error message if any
    pub error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inference_options_builder() {
        let options = InferenceOptions::new()
            .max_tokens(100)
            .temperature(0.8)
            .stream(true);

        assert_eq!(options.max_tokens, Some(100));
        assert_eq!(options.temperature, Some(0.8));
        assert_eq!(options.stream, Some(true));
    }

    #[test]
    fn test_inference_request_builder() {
        let request = InferenceRequest::new("Hello, world!")
            .model_id("test-model")
            .session_id("session-123");

        assert_eq!(request.prompt, "Hello, world!");
        assert_eq!(request.model_id, Some("test-model".to_string()));
        assert_eq!(request.session_id, Some("session-123".to_string()));
    }

    #[test]
    fn test_chat_message_creation() {
        let user_msg = ChatMessage::user("Hello");
        let assistant_msg = ChatMessage::assistant("Hi there!");
        let system_msg = ChatMessage::system("You are a helpful assistant");

        assert_eq!(user_msg.role, "user");
        assert_eq!(assistant_msg.role, "assistant");
        assert_eq!(system_msg.role, "system");
    }

    #[test]
    fn test_load_model_request_builder() {
        let request = LoadModelRequest::new("./model.gguf")
            .format("gguf")
            .id("test-model")
            .force_reload(true);

        assert_eq!(request.source, "./model.gguf");
        assert_eq!(request.format, Some("gguf".to_string()));
        assert_eq!(request.id, Some("test-model".to_string()));
        assert_eq!(request.force_reload, true);
    }

    #[test]
    fn test_batch_inference_request() {
        let requests = vec![
            InferenceRequest::new("First prompt"),
            InferenceRequest::new("Second prompt"),
        ];

        let batch = BatchInferenceRequest::new(requests)
            .max_concurrent(3)
            .timeout_ms(60000)
            .fail_fast(true);

        assert_eq!(batch.requests.len(), 2);
        assert_eq!(batch.max_concurrent, Some(3));
        assert_eq!(batch.timeout_ms, Some(60000));
        assert_eq!(batch.fail_fast, true);
    }
}