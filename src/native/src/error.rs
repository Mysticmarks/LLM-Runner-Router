//! Error types for the native module

use napi::{Error as NapiError, Status};
use thiserror::Error;

pub type Result<T> = std::result::Result<T, NativeError>;

/// Error types for native operations
#[derive(Error, Debug)]
pub enum NativeError {
    #[error("Tokenizer error: {message}")]
    Tokenizer { message: String },

    #[error("Quantization error: {message}")]
    Quantization { message: String },

    #[error("Tensor operation error: {message}")]
    TensorOp { message: String },

    #[error("Memory error: {message}")]
    Memory { message: String },

    #[error("IO error: {message}")]
    Io { message: String },

    #[error("Invalid input: {message}")]
    InvalidInput { message: String },

    #[error("Not implemented: {feature}")]
    NotImplemented { feature: String },

    #[error("Internal error: {message}")]
    Internal { message: String },
}

impl NativeError {
    pub fn tokenizer(message: impl Into<String>) -> Self {
        Self::Tokenizer { message: message.into() }
    }

    pub fn quantization(message: impl Into<String>) -> Self {
        Self::Quantization { message: message.into() }
    }

    pub fn tensor_op(message: impl Into<String>) -> Self {
        Self::TensorOp { message: message.into() }
    }

    pub fn memory(message: impl Into<String>) -> Self {
        Self::Memory { message: message.into() }
    }

    pub fn io(message: impl Into<String>) -> Self {
        Self::Io { message: message.into() }
    }

    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self::InvalidInput { message: message.into() }
    }

    pub fn not_implemented(feature: impl Into<String>) -> Self {
        Self::NotImplemented { feature: feature.into() }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::Internal { message: message.into() }
    }
}

// Convert to NAPI error for JavaScript interop
impl From<NativeError> for NapiError {
    fn from(err: NativeError) -> Self {
        let status = match err {
            NativeError::InvalidInput { .. } => Status::InvalidArg,
            NativeError::NotImplemented { .. } => Status::GenericFailure,
            NativeError::Memory { .. } => Status::GenericFailure,
            NativeError::Io { .. } => Status::GenericFailure,
            _ => Status::GenericFailure,
        };
        
        NapiError::new(status, err.to_string())
    }
}

// Convert from common error types
impl From<std::io::Error> for NativeError {
    fn from(err: std::io::Error) -> Self {
        Self::io(err.to_string())
    }
}

impl From<serde_json::Error> for NativeError {
    fn from(err: serde_json::Error) -> Self {
        Self::invalid_input(format!("JSON error: {}", err))
    }
}

impl From<tokenizers::Error> for NativeError {
    fn from(err: tokenizers::Error) -> Self {
        Self::tokenizer(err.to_string())
    }
}

impl From<candle_core::Error> for NativeError {
    fn from(err: candle_core::Error) -> Self {
        Self::tensor_op(err.to_string())
    }
}