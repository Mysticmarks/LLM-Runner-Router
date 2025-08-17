//! Protocol implementations for LLM Router client

pub mod http;

#[cfg(feature = "grpc")]
pub mod grpc;

#[cfg(feature = "websocket")]
pub mod websocket;