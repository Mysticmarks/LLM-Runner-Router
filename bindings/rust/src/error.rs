//! Error types for the LLM Router client

use std::fmt;
use thiserror::Error;

/// Result type for LLM Router operations
pub type Result<T> = std::result::Result<T, LLMRouterError>;

/// Main error type for LLM Router client operations
#[derive(Error, Debug)]
pub enum LLMRouterError {
    /// Network-related errors
    #[error("Network error: {message}")]
    Network {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// Request timeout errors
    #[error("Request timeout: {message}")]
    Timeout {
        message: String,
        timeout_duration: Option<std::time::Duration>,
    },

    /// Rate limiting errors
    #[error("Rate limit exceeded: {message}")]
    RateLimit {
        message: String,
        retry_after: Option<std::time::Duration>,
    },

    /// Authentication/authorization errors
    #[error("Authentication error: {message}")]
    Authentication { message: String },

    /// Request validation errors
    #[error("Validation error: {message}")]
    Validation {
        message: String,
        field: Option<String>,
    },

    /// Model not found or not available
    #[error("Model not found: {model_id}")]
    ModelNotFound { model_id: String },

    /// Inference processing errors
    #[error("Inference error: {message}")]
    Inference {
        message: String,
        model_id: Option<String>,
    },

    /// Configuration-related errors
    #[error("Configuration error: {message}")]
    Configuration { message: String },

    /// Streaming response errors
    #[error("Streaming error: {message}")]
    Streaming { message: String },

    /// gRPC-specific errors
    #[error("gRPC error: {message}")]
    Grpc {
        message: String,
        status_code: Option<i32>,
    },

    /// WebSocket-specific errors
    #[error("WebSocket error: {message}")]
    WebSocket { message: String },

    /// Serialization/deserialization errors
    #[error("Serialization error: {message}")]
    Serialization {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// HTTP-specific errors
    #[error("HTTP error: {status} - {message}")]
    Http {
        status: u16,
        message: String,
        body: Option<String>,
    },

    /// Generic errors with context
    #[error("Error: {message}")]
    Other {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },
}

impl LLMRouterError {
    /// Create a network error
    pub fn network<E>(message: impl Into<String>, source: Option<E>) -> Self
    where
        E: std::error::Error + Send + Sync + 'static,
    {
        Self::Network {
            message: message.into(),
            source: source.map(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>),
        }
    }

    /// Create a timeout error
    pub fn timeout(message: impl Into<String>, duration: Option<std::time::Duration>) -> Self {
        Self::Timeout {
            message: message.into(),
            timeout_duration: duration,
        }
    }

    /// Create a rate limit error
    pub fn rate_limit(
        message: impl Into<String>,
        retry_after: Option<std::time::Duration>,
    ) -> Self {
        Self::RateLimit {
            message: message.into(),
            retry_after,
        }
    }

    /// Create an authentication error
    pub fn authentication(message: impl Into<String>) -> Self {
        Self::Authentication {
            message: message.into(),
        }
    }

    /// Create a validation error
    pub fn validation(message: impl Into<String>, field: Option<String>) -> Self {
        Self::Validation {
            message: message.into(),
            field,
        }
    }

    /// Create a model not found error
    pub fn model_not_found(model_id: impl Into<String>) -> Self {
        Self::ModelNotFound {
            model_id: model_id.into(),
        }
    }

    /// Create an inference error
    pub fn inference(message: impl Into<String>, model_id: Option<String>) -> Self {
        Self::Inference {
            message: message.into(),
            model_id,
        }
    }

    /// Create a configuration error
    pub fn configuration(message: impl Into<String>) -> Self {
        Self::Configuration {
            message: message.into(),
        }
    }

    /// Create a streaming error
    pub fn streaming(message: impl Into<String>) -> Self {
        Self::Streaming {
            message: message.into(),
        }
    }

    /// Create a gRPC error
    pub fn grpc(message: impl Into<String>, status_code: Option<i32>) -> Self {
        Self::Grpc {
            message: message.into(),
            status_code,
        }
    }

    /// Create a WebSocket error
    pub fn websocket(message: impl Into<String>) -> Self {
        Self::WebSocket {
            message: message.into(),
        }
    }

    /// Create a serialization error
    pub fn serialization<E>(message: impl Into<String>, source: Option<E>) -> Self
    where
        E: std::error::Error + Send + Sync + 'static,
    {
        Self::Serialization {
            message: message.into(),
            source: source.map(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>),
        }
    }

    /// Create an HTTP error
    pub fn http(status: u16, message: impl Into<String>, body: Option<String>) -> Self {
        Self::Http {
            status,
            message: message.into(),
            body,
        }
    }

    /// Create a generic error with context
    pub fn other<E>(message: impl Into<String>, source: Option<E>) -> Self
    where
        E: std::error::Error + Send + Sync + 'static,
    {
        Self::Other {
            message: message.into(),
            source: source.map(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>),
        }
    }

    /// Check if error is retryable
    pub fn is_retryable(&self) -> bool {
        match self {
            Self::Network { .. } => true,
            Self::Timeout { .. } => true,
            Self::RateLimit { .. } => true,
            Self::Http { status, .. } => match *status {
                500..=599 => true, // Server errors are retryable
                429 => true,       // Rate limit is retryable
                408 => true,       // Request timeout is retryable
                _ => false,
            },
            Self::Grpc { status_code, .. } => {
                // gRPC status codes that are retryable
                matches!(
                    status_code,
                    Some(14) | Some(4) | Some(8) | Some(2) // UNAVAILABLE, DEADLINE_EXCEEDED, RESOURCE_EXHAUSTED, UNKNOWN
                )
            }
            _ => false,
        }
    }

    /// Get retry delay suggestion
    pub fn retry_delay(&self) -> Option<std::time::Duration> {
        match self {
            Self::RateLimit { retry_after, .. } => *retry_after,
            Self::Timeout { .. } => Some(std::time::Duration::from_secs(2)),
            Self::Network { .. } => Some(std::time::Duration::from_secs(1)),
            _ => None,
        }
    }
}

// Conversion from reqwest errors
impl From<reqwest::Error> for LLMRouterError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            Self::timeout("HTTP request timeout", Some(std::time::Duration::from_secs(30)))
        } else if err.is_connect() {
            Self::network("Connection failed", Some(err))
        } else if err.is_request() {
            Self::validation("Invalid request", None)
        } else {
            Self::network("HTTP error", Some(err))
        }
    }
}

// Conversion from serde_json errors
impl From<serde_json::Error> for LLMRouterError {
    fn from(err: serde_json::Error) -> Self {
        Self::serialization("JSON serialization error", Some(err))
    }
}

// Conversion from URL parse errors
impl From<url::ParseError> for LLMRouterError {
    fn from(err: url::ParseError) -> Self {
        Self::configuration(format!("Invalid URL: {}", err))
    }
}

// Conversion from tokio-tungstenite errors
#[cfg(feature = "websocket")]
impl From<tokio_tungstenite::tungstenite::Error> for LLMRouterError {
    fn from(err: tokio_tungstenite::tungstenite::Error) -> Self {
        Self::websocket(format!("WebSocket error: {}", err))
    }
}

// Conversion from tonic errors
#[cfg(feature = "grpc")]
impl From<tonic::Status> for LLMRouterError {
    fn from(status: tonic::Status) -> Self {
        Self::grpc(
            format!("gRPC error: {}", status.message()),
            Some(status.code() as i32),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_creation() {
        let err = LLMRouterError::model_not_found("test-model");
        assert!(matches!(err, LLMRouterError::ModelNotFound { .. }));
        assert_eq!(err.to_string(), "Model not found: test-model");
    }

    #[test]
    fn test_retryable_errors() {
        assert!(LLMRouterError::network("test", None::<reqwest::Error>).is_retryable());
        assert!(LLMRouterError::timeout("test", None).is_retryable());
        assert!(!LLMRouterError::authentication("test").is_retryable());
        assert!(!LLMRouterError::validation("test", None).is_retryable());
    }

    #[test]
    fn test_retry_delay() {
        let rate_limit_err = LLMRouterError::rate_limit(
            "rate limited",
            Some(std::time::Duration::from_secs(60)),
        );
        assert_eq!(
            rate_limit_err.retry_delay(),
            Some(std::time::Duration::from_secs(60))
        );
    }
}