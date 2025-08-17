//! Error types for WASM bindings

use wasm_bindgen::prelude::*;
use thiserror::Error;

/// Error type for LLM Router WASM operations
#[derive(Error, Debug)]
pub enum LLMRouterError {
    #[error("Network error: {message}")]
    Network { message: String },

    #[error("Request timeout: {message}")]
    Timeout { message: String },

    #[error("Rate limit exceeded: {message}")]
    RateLimit { message: String },

    #[error("Authentication error: {message}")]
    Authentication { message: String },

    #[error("Validation error: {message}")]
    Validation { message: String },

    #[error("Model not found: {model_id}")]
    ModelNotFound { model_id: String },

    #[error("Inference error: {message}")]
    Inference { message: String },

    #[error("Serialization error: {message}")]
    Serialization { message: String },

    #[error("JavaScript error: {message}")]
    JavaScript { message: String },

    #[error("Other error: {message}")]
    Other { message: String },
}

impl LLMRouterError {
    /// Check if the error is retryable
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            LLMRouterError::Network { .. }
                | LLMRouterError::Timeout { .. }
                | LLMRouterError::RateLimit { .. }
        )
    }

    /// Get suggested retry delay in milliseconds
    pub fn retry_delay_ms(&self) -> Option<u32> {
        match self {
            LLMRouterError::RateLimit { .. } => Some(60000), // 1 minute
            LLMRouterError::Timeout { .. } => Some(2000),    // 2 seconds
            LLMRouterError::Network { .. } => Some(1000),    // 1 second
            _ => None,
        }
    }
}

// Convert to JsValue for JavaScript interop
impl From<LLMRouterError> for JsValue {
    fn from(error: LLMRouterError) -> Self {
        let error_obj = js_sys::Object::new();
        
        // Set error type
        let error_type = match error {
            LLMRouterError::Network { .. } => "NetworkError",
            LLMRouterError::Timeout { .. } => "TimeoutError",
            LLMRouterError::RateLimit { .. } => "RateLimitError",
            LLMRouterError::Authentication { .. } => "AuthenticationError",
            LLMRouterError::Validation { .. } => "ValidationError",
            LLMRouterError::ModelNotFound { .. } => "ModelNotFoundError",
            LLMRouterError::Inference { .. } => "InferenceError",
            LLMRouterError::Serialization { .. } => "SerializationError",
            LLMRouterError::JavaScript { .. } => "JavaScriptError",
            LLMRouterError::Other { .. } => "OtherError",
        };
        
        js_sys::Reflect::set(
            &error_obj,
            &"type".into(),
            &error_type.into()
        ).unwrap();
        
        // Set error message
        js_sys::Reflect::set(
            &error_obj,
            &"message".into(),
            &error.to_string().into()
        ).unwrap();
        
        // Set retryable flag
        js_sys::Reflect::set(
            &error_obj,
            &"retryable".into(),
            &error.is_retryable().into()
        ).unwrap();
        
        // Set retry delay if available
        if let Some(delay) = error.retry_delay_ms() {
            js_sys::Reflect::set(
                &error_obj,
                &"retryDelayMs".into(),
                &delay.into()
            ).unwrap();
        }
        
        error_obj.into()
    }
}

// JavaScript-accessible error type
#[wasm_bindgen]
pub struct JSError {
    error_type: String,
    message: String,
    retryable: bool,
    retry_delay_ms: Option<u32>,
}

#[wasm_bindgen]
impl JSError {
    #[wasm_bindgen(getter, js_name = "type")]
    pub fn error_type(&self) -> String {
        self.error_type.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn message(&self) -> String {
        self.message.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn retryable(&self) -> bool {
        self.retryable
    }

    #[wasm_bindgen(getter, js_name = "retryDelayMs")]
    pub fn retry_delay_ms(&self) -> Option<u32> {
        self.retry_delay_ms
    }

    /// Convert to JavaScript Error object
    #[wasm_bindgen(js_name = "toError")]
    pub fn to_error(&self) -> js_sys::Error {
        js_sys::Error::new(&self.message)
    }
}

impl From<LLMRouterError> for JSError {
    fn from(error: LLMRouterError) -> Self {
        let error_type = match error {
            LLMRouterError::Network { .. } => "NetworkError",
            LLMRouterError::Timeout { .. } => "TimeoutError",
            LLMRouterError::RateLimit { .. } => "RateLimitError",
            LLMRouterError::Authentication { .. } => "AuthenticationError",
            LLMRouterError::Validation { .. } => "ValidationError",
            LLMRouterError::ModelNotFound { .. } => "ModelNotFoundError",
            LLMRouterError::Inference { .. } => "InferenceError",
            LLMRouterError::Serialization { .. } => "SerializationError",
            LLMRouterError::JavaScript { .. } => "JavaScriptError",
            LLMRouterError::Other { .. } => "OtherError",
        }.to_string();

        JSError {
            error_type,
            message: error.to_string(),
            retryable: error.is_retryable(),
            retry_delay_ms: error.retry_delay_ms(),
        }
    }
}

// Utility function to create JavaScript-friendly error
#[wasm_bindgen]
pub fn create_error(error_type: &str, message: &str) -> JSError {
    let error = match error_type {
        "NetworkError" => LLMRouterError::Network { message: message.to_string() },
        "TimeoutError" => LLMRouterError::Timeout { message: message.to_string() },
        "RateLimitError" => LLMRouterError::RateLimit { message: message.to_string() },
        "AuthenticationError" => LLMRouterError::Authentication { message: message.to_string() },
        "ValidationError" => LLMRouterError::Validation { message: message.to_string() },
        "ModelNotFoundError" => LLMRouterError::ModelNotFound { model_id: message.to_string() },
        "InferenceError" => LLMRouterError::Inference { message: message.to_string() },
        "SerializationError" => LLMRouterError::Serialization { message: message.to_string() },
        "JavaScriptError" => LLMRouterError::JavaScript { message: message.to_string() },
        _ => LLMRouterError::Other { message: message.to_string() },
    };
    
    JSError::from(error)
}

// Convert common JavaScript errors
impl From<JsValue> for LLMRouterError {
    fn from(js_value: JsValue) -> Self {
        let message = if js_value.is_string() {
            js_value.as_string().unwrap_or_else(|| "Unknown JavaScript error".to_string())
        } else if let Some(error) = js_value.dyn_ref::<js_sys::Error>() {
            error.message().into()
        } else {
            format!("JavaScript error: {:?}", js_value)
        };
        
        LLMRouterError::JavaScript { message }
    }
}

// Convert reqwest errors (for HTTP requests)
impl From<reqwest::Error> for LLMRouterError {
    fn from(error: reqwest::Error) -> Self {
        if error.is_timeout() {
            LLMRouterError::Timeout {
                message: "Request timeout".to_string(),
            }
        } else if error.is_connect() {
            LLMRouterError::Network {
                message: format!("Connection failed: {}", error),
            }
        } else if error.is_request() {
            LLMRouterError::Validation {
                message: format!("Invalid request: {}", error),
            }
        } else {
            LLMRouterError::Network {
                message: format!("HTTP error: {}", error),
            }
        }
    }
}

// Convert serde_json errors
impl From<serde_json::Error> for LLMRouterError {
    fn from(error: serde_json::Error) -> Self {
        LLMRouterError::Serialization {
            message: format!("JSON error: {}", error),
        }
    }
}